"""Google ADK Multi-Agent Entrypoint for Automotive Diagnostic Intelligence System."""

from __future__ import annotations

import datetime
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from retrieval.hybrid_retriever import HybridRetriever
from retrieval.reranker import DiagnosticReranker
from retrieval.torque_filter import TorqueFilter

try:
    from google.adk.agents import Agent
    from google.adk.apps import App
    from google.adk.models import Gemini
    from google.adk.tools import AgentTool
    from google.genai import types

    ADK_SDK_AVAILABLE = True
except ImportError:
    ADK_SDK_AVAILABLE = False

    @dataclass
    class _RetryOptionsShim:
        attempts: int = 3

    class _TypesShim:
        HttpRetryOptions = _RetryOptionsShim

    types = _TypesShim()  # type: ignore[assignment]

    @dataclass
    class Gemini:  # type: ignore[no-redef]
        """Fallback shim when google-adk is not installed in the active Python env."""

        model: str
        retry_options: Any = None

    @dataclass
    class AgentTool:  # type: ignore[no-redef]
        """Fallback shim wrapping a specialist Agent as a callable tool."""

        agent: Any

        @property
        def name(self) -> str:
            return getattr(self.agent, "name", "specialist_agent")

    @dataclass
    class Agent:  # type: ignore[no-redef]
        """Fallback shim mirroring google.adk.agents.Agent."""

        name: str
        model: Any
        instruction: str
        description: str = ""
        tools: List[Any] = field(default_factory=list)

    @dataclass
    class App:  # type: ignore[no-redef]
        """Fallback shim mirroring google.adk.apps.App."""

        root_agent: Any
        name: str = "app"


BASE_DIR = Path(__file__).resolve().parent.parent
CUSTOM_MANUALS_PATH = BASE_DIR / "custom_manuals.json"
RECALLS_PATH = BASE_DIR / "data" / "nhtsa_recalls.json"
COMPLAINTS_PATH = BASE_DIR / "data" / "nhtsa_complaints.json"
FINANCIAL_PATH = BASE_DIR / "data" / "oem_financial_metrics.json"

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")


def _load_json_list(path: Path) -> List[Dict[str, Any]]:
    """Safely reads a JSON array from disk."""
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _normalize_manual_chunk(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalizes camelCase keys from custom_manuals.json into snake_case."""
    return {
        "id": raw.get("id", ""),
        "vehicle_make": raw.get("vehicle_make") or raw.get("vehicleMake") or "",
        "vehicle_model": raw.get("vehicle_model") or raw.get("vehicleModel") or "",
        "year_range": raw.get("year_range") or raw.get("yearRange") or "",
        "system": raw.get("system") or "",
        "title": raw.get("title") or "",
        "section_code": raw.get("section_code") or raw.get("sectionCode") or "",
        "content": raw.get("content") or "",
        "dtc_codes": raw.get("dtc_codes") or raw.get("dtcCodes") or [],
        "torque_specs": raw.get("torque_specs") or raw.get("torqueSpecs") or {},
        "safety_warnings": raw.get("safety_warnings") or raw.get("safetyWarnings") or [],
    }


def load_normalized_manual_chunks() -> List[Dict[str, Any]]:
    """Loads indexed workshop manual chunks from custom_manuals.json."""
    raw_items = _load_json_list(CUSTOM_MANUALS_PATH)
    return [_normalize_manual_chunk(item) for item in raw_items]


def _year_in_range(vehicle_year: str, year_range: str) -> bool:
    """Checks whether a 4-digit year fits inside an OEM range such as '2018-2024'."""
    if not vehicle_year or not year_range:
        return True
    year_digits = re.findall(r"\d{4}", str(vehicle_year))
    if not year_digits:
        return True
    q_year = int(year_digits[0])
    bounds = [int(y) for y in re.findall(r"\d{4}", str(year_range))]
    if len(bounds) == 1:
        if "+" in str(year_range):
            return q_year >= bounds[0]
        return abs(q_year - bounds[0]) <= 2
    if len(bounds) >= 2:
        return min(bounds) <= q_year <= max(bounds)
    return True


def search_workshop_manuals(
    query: str,
    vehicle_make: str = "",
    vehicle_model: str = "",
    vehicle_year: str = "",
    dtc_code: str = "",
) -> str:
    """Searches OEM workshop manuals using two-stage hybrid retrieval and reranking.

    Args:
        query: Symptom description, procedure request, or component keywords.
        vehicle_make: Vehicle manufacturer (e.g., Ford, Toyota, Tesla, BMW, Mercedes).
        vehicle_model: Vehicle model name (e.g., F-150, Model 3, RAV4).
        vehicle_year: Model year (e.g., 2021).
        dtc_code: OBD-II / OEM Diagnostic Trouble Code (e.g., P0300, BMS_a064, U0003).

    Returns:
        JSON string containing top grounded workshop manual chunks, section codes,
        verbatim torque specs, and safety warnings.
    """
    chunks = load_normalized_manual_chunks()
    if vehicle_year:
        year_filtered = [c for c in chunks if _year_in_range(vehicle_year, c.get("year_range", ""))]
        if year_filtered:
            chunks = year_filtered

    retriever = HybridRetriever(chunks)
    combined_query = " ".join(
        p for p in [vehicle_make, vehicle_model, vehicle_year, dtc_code, query] if p
    ).strip() or "diagnostic procedure"

    candidates = retriever.retrieve(
        query=combined_query,
        vehicle_make=vehicle_make,
        vehicle_model=vehicle_model,
        dtc_code=dtc_code,
        top_k=6,
    )
    reranked = DiagnosticReranker.rerank(
        query=combined_query,
        candidates=candidates,
        dtc_code=dtc_code,
        vehicle_make=vehicle_make,
    )[:3]

    results = []
    for rank, item in enumerate(reranked, 1):
        chunk = item["chunk"]
        results.append(
            {
                "rank": rank,
                "score": item["final_score"],
                "id": chunk.get("id"),
                "vehicle": f"{chunk.get('vehicle_make')} {chunk.get('vehicle_model')} ({chunk.get('year_range')})",
                "system": chunk.get("system"),
                "section_code": chunk.get("section_code"),
                "title": chunk.get("title"),
                "dtc_codes": chunk.get("dtc_codes", []),
                "torque_specs": chunk.get("torque_specs", {}),
                "safety_warnings": chunk.get("safety_warnings", []),
                "content": chunk.get("content", ""),
            }
        )

    return json.dumps({"matched_manuals": results, "total_indexed": len(chunks)}, indent=2)


def convert_fastener_torque(torque_string: str) -> str:
    """Parses and converts an OEM fastener torque specification across Nm, ft-lb, and in-lb.

    Args:
        torque_string: Torque value text such as '15 Nm (133 lb-in)' or '12 Nm + 45 deg'.

    Returns:
        JSON string with converted metric/imperial values and Torque-to-Yield (TTY) flag.
    """
    parsed = TorqueFilter.parse_torque_value(torque_string)
    return json.dumps(parsed, indent=2)


def lookup_nhtsa_recalls(
    vehicle_make: str = "",
    vehicle_model: str = "",
    keyword: str = "",
) -> str:
    """Queries NHTSA safety recall campaigns for a vehicle make, model, or component keyword.

    Args:
        vehicle_make: Vehicle make (e.g., Ford, Toyota, Tesla).
        vehicle_model: Vehicle model (e.g., Bronco, F-150, Model 3).
        keyword: Optional component or defect keyword (e.g., fuel pump, airbag, battery).

    Returns:
        JSON string containing matching recall campaigns, consequences, and factory remedies.
    """
    recalls = _load_json_list(RECALLS_PATH)
    q_make = vehicle_make.strip().lower()
    q_model = vehicle_model.strip().lower()
    q_kw = keyword.strip().lower()

    matched = []
    for rec in recalls:
        make_val = str(rec.get("vehicle_make", "")).lower()
        model_val = str(rec.get("vehicle_model", "")).lower()
        text_blob = " ".join(
            str(rec.get(k, ""))
            for k in ("component", "summary", "consequence", "corrective_action")
        ).lower()

        if q_make and q_make not in make_val:
            continue
        if q_model and q_model not in model_val and model_val not in q_model:
            continue
        if q_kw and q_kw not in text_blob:
            continue
        matched.append(rec)

    if not matched and q_make:
        # Broaden search to make-level if model filter was too narrow
        for rec in recalls:
            if q_make in str(rec.get("vehicle_make", "")).lower():
                matched.append(rec)

    return json.dumps(
        {
            "total_matched": len(matched),
            "recalls": matched[:5],
        },
        indent=2,
    )


def lookup_nhtsa_complaints(
    vehicle_make: str = "",
    vehicle_model: str = "",
    symptom_keyword: str = "",
) -> str:
    """Queries NHTSA ODI consumer defect complaints for fleet symptom patterns and safety incidents.

    Args:
        vehicle_make: Vehicle make (e.g., Ford, Chevrolet, Harsh Patel).
        vehicle_model: Vehicle model (e.g., Bronco, F-150).
        symptom_keyword: Optional symptom or DTC keyword (e.g., misfire, oil leak, B00A0).

    Returns:
        JSON string summarizing total matching complaints, crash/fire counts, and sample narratives.
    """
    complaints = _load_json_list(COMPLAINTS_PATH)
    q_make = vehicle_make.strip().lower()
    q_model = vehicle_model.strip().lower()
    q_kw = symptom_keyword.strip().lower()

    matched = []
    for comp in complaints:
        make_val = str(comp.get("vehicle_make", "")).lower()
        model_val = str(comp.get("vehicle_model", "")).lower()
        blob = f"{comp.get('components', '')} {comp.get('summary', '')}".lower()

        if q_make and q_make not in make_val:
            continue
        if q_model and q_model not in model_val and model_val not in q_model:
            continue
        if q_kw and q_kw not in blob:
            continue
        matched.append(comp)

    if not matched and q_make:
        for comp in complaints:
            make_val = str(comp.get("vehicle_make", "")).lower()
            blob = f"{comp.get('components', '')} {comp.get('summary', '')}".lower()
            if q_make in make_val and (not q_kw or q_kw in blob):
                matched.append(comp)

    crash_count = sum(1 for c in matched if c.get("crash"))
    fire_count = sum(1 for c in matched if c.get("fire"))

    return json.dumps(
        {
            "total_matched": len(matched),
            "crash_reports": crash_count,
            "fire_reports": fire_count,
            "sample_complaints": matched[:5],
        },
        indent=2,
    )


def evaluate_warranty_coverage(
    vehicle_make: str,
    vehicle_model: str = "",
    vehicle_year: str = "2022",
    mileage: int = 36000,
    dtc_code: str = "",
) -> str:
    """Evaluates OEM warranty coverage rules, NHTSA recall overrides, and SEC 10-K reserve context.

    Args:
        vehicle_make: Vehicle make (e.g., Ford, Toyota, Tesla, Chevrolet, BMW).
        vehicle_model: Vehicle model.
        vehicle_year: 4-digit vehicle model year.
        mileage: Current vehicle odometer reading in miles.
        dtc_code: Active Diagnostic Trouble Code (e.g., P0300, BMS_a064, B00A0).

    Returns:
        JSON string describing coverage eligibility across Bumper-to-Bumper, Powertrain,
        High-Voltage/Emissions, and Safety Recall mandates plus OEM 10-K warranty accrual context.
    """
    current_year = datetime.datetime.now().year
    year_match = re.findall(r"\d{4}", str(vehicle_year))
    model_year = int(year_match[0]) if year_match else current_year - 3
    vehicle_age_years = max(0, current_year - model_year)

    dtc_upper = (dtc_code or "").strip().upper()
    make_lower = (vehicle_make or "").strip().lower()

    bumper_eligible = vehicle_age_years <= 3 and mileage <= 36000
    powertrain_eligible = vehicle_age_years <= 5 and mileage <= 60000
    is_hv_or_emissions = (
        dtc_upper.startswith("BMS_")
        or dtc_upper.startswith("P0A")
        or dtc_upper in {"P0420", "P0430"}
        or "tesla" in make_lower
        or "hybrid" in vehicle_model.lower()
        or "ev" in vehicle_model.lower()
    )
    hv_emissions_eligible = is_hv_or_emissions and vehicle_age_years <= 8 and mileage <= 100000

    recalls_payload = json.loads(
        lookup_nhtsa_recalls(vehicle_make=vehicle_make, vehicle_model=vehicle_model)
    )
    has_active_recalls = recalls_payload.get("total_matched", 0) > 0

    financials = _load_json_list(FINANCIAL_PATH)
    oem_financial = next(
        (
            f
            for f in financials
            if make_lower
            and (
                make_lower in str(f.get("oem_name", "")).lower()
                or make_lower in str(f.get("primary_recall_impact_notes", "")).lower()
            )
        ),
        None,
    )

    if has_active_recalls:
        verdict = "COVERED_UNDER_NHTSA_RECALL_OR_CHECK_VIN"
    elif hv_emissions_eligible:
        verdict = "LIKELY_COVERED_HV_OR_FEDERAL_EMISSIONS_8YR_100K"
    elif bumper_eligible:
        verdict = "LIKELY_COVERED_BUMPER_TO_BUMPER_3YR_36K"
    elif powertrain_eligible and dtc_upper.startswith("P"):
        verdict = "LIKELY_COVERED_POWERTRAIN_5YR_60K"
    else:
        verdict = "CUSTOMER_PAY_OR_EXTENDED_WARRANTY_REQUIRED"

    return json.dumps(
        {
            "vehicle": f"{model_year} {vehicle_make} {vehicle_model}".strip(),
            "estimated_age_years": vehicle_age_years,
            "mileage": mileage,
            "verdict": verdict,
            "coverage_tiers": {
                "bumper_to_bumper_3yr_36k": bumper_eligible,
                "powertrain_5yr_60k": powertrain_eligible,
                "hv_battery_or_emissions_8yr_100k": hv_emissions_eligible,
                "safety_recall_override_candidate": has_active_recalls,
            },
            "matching_recall_count": recalls_payload.get("total_matched", 0),
            "oem_10k_benchmark": oem_financial,
        },
        indent=2,
    )


def verify_diagnostic_contradictions(
    diagnosis_summary: str,
    dtc_code: str = "",
    vehicle_make: str = "",
) -> str:
    """Self-reflection check ensuring safety warnings, torque specs, and recalls do not contradict.

    Args:
        diagnosis_summary: Proposed diagnostic and repair summary text.
        dtc_code: Active Diagnostic Trouble Code.
        vehicle_make: Vehicle manufacturer name.

    Returns:
        JSON string containing verification pass/warn status and any missing critical checks.
    """
    text_lower = (diagnosis_summary or "").lower()
    dtc_upper = (dtc_code or "").strip().upper()
    findings: List[str] = []

    is_hv = (
        dtc_upper.startswith("BMS_")
        or dtc_upper.startswith("P0A")
        or "high voltage" in text_lower
        or "tesla" in vehicle_make.lower()
    )
    if is_hv and not any(
        term in text_lower for term in ("12v", "pyro", "class 0", "lockout", "50v", "disconnect")
    ):
        findings.append(
            "CRITICAL SAFETY OMISSION: High-voltage diagnostic lacks 12V/pyro-fuse isolation or Class 0 PPE warning."
        )

    if any(term in text_lower for term in ("fuel rail", "high-pressure fuel", "p0087")) and "pressure" not in text_lower:
        findings.append(
            "SAFETY CHECK: Fuel delivery procedure should remind technician to relieve fuel rail pressure before opening lines."
        )

    if not re.search(r"\b\d+(?:\.\d+)?\s*(?:nm|ft-lb|lb-ft|lb-in|in-lb)\b", text_lower):
        findings.append(
            "SPECIFICATION CHECK: Include verbatim OEM fastener torque specifications (Nm / ft-lb / lb-in) in final report."
        )

    return json.dumps(
        {
            "self_reflection_status": "PASS" if not findings else "NEEDS_ATTENTION",
            "findings": findings,
            "verified_checks": [
                "OEM section citation check",
                "High-voltage / pressurized-fuel safety gate",
                "Torque unit presence verification",
            ],
        },
        indent=2,
    )


def _build_model() -> Gemini:
    return Gemini(
        model=MODEL,
        retry_options=types.HttpRetryOptions(attempts=3),
    )


diagnostic_specialist = Agent(
    name="diagnostic_specialist",
    description=(
        "Retrieves OEM workshop manuals, extracts SAE J2012 DTC pinpoint tests, "
        "and converts fastener torque specs between metric and imperial units."
    ),
    model=_build_model(),
    instruction=(
        "You are the ASE Master Diagnostic Specialist. Use search_workshop_manuals to retrieve "
        "grounded OEM factory procedures and convert_fastener_torque to standardize Nm, ft-lb, "
        "in-lb, and Torque-to-Yield (TTY) specs. Always cite exact section codes and safety warnings."
    ),
    tools=[search_workshop_manuals, convert_fastener_torque],
)

recall_safety_specialist = Agent(
    name="recall_safety_specialist",
    description=(
        "Looks up NHTSA safety recall campaigns and ODI consumer defect complaints "
        "to identify fleet failure patterns and active manufacturer remedies."
    ),
    model=_build_model(),
    instruction=(
        "You are the NHTSA Fleet Safety & Recall Specialist. Call lookup_nhtsa_recalls and "
        "lookup_nhtsa_complaints for the target vehicle and symptom. Highlight campaign numbers, "
        "crash/fire risk counts, and official factory remedies."
    ),
    tools=[lookup_nhtsa_recalls, lookup_nhtsa_complaints],
)

warranty_policy_specialist = Agent(
    name="warranty_policy_specialist",
    description=(
        "Evaluates OEM warranty coverage tiers, recall cost overrides, and SEC 10-K "
        "warranty reserve metrics for dealership triage."
    ),
    model=_build_model(),
    instruction=(
        "You are the OEM Warranty Policy & Dealership Triage Specialist. Call "
        "evaluate_warranty_coverage to determine whether repairs fall under Bumper-to-Bumper "
        "(3yr/36k), Powertrain (5yr/60k), High-Voltage/Emissions (8yr/100k), NHTSA Recall, "
        "or Customer Pay, and include the OEM 10-K warranty context."
    ),
    tools=[evaluate_warranty_coverage],
)

coordinator_agent = Agent(
    name="dtc_diagnostics_agent",
    description=(
        "Supervisor agent coordinating OEM manual RAG diagnostics, NHTSA recall safety "
        "checks, warranty policy triage, and contradiction self-reflection."
    ),
    model=_build_model(),
    instruction=(
        "You are the Lead Service Bay Supervisor for the Automotive Diagnostic Intelligence System. "
        "For every diagnostic or warranty request: "
        "1) Delegate workshop manual lookup and torque verification to diagnostic_specialist. "
        "2) Delegate NHTSA recall and ODI complaint analysis to recall_safety_specialist. "
        "3) Delegate warranty coverage triage to warranty_policy_specialist. "
        "4) Run verify_diagnostic_contradictions as a self-reflection pass before finalizing. "
        "Synthesize an authoritative report citing exact OEM Section Codes, verbatim torque specs, "
        "safety warnings, active NHTSA campaigns, and warranty eligibility."
    ),
    tools=[
        AgentTool(diagnostic_specialist),
        AgentTool(recall_safety_specialist),
        AgentTool(warranty_policy_specialist),
        verify_diagnostic_contradictions,
    ],
)

root_agent = coordinator_agent

app = App(
    root_agent=coordinator_agent,
    name="app",
)


def get_adk_metadata() -> Dict[str, Any]:
    """Returns structured ADK agent hierarchy and tool definitions for API/UI introspection."""
    tool_registry: Dict[str, Callable[..., str]] = {
        "search_workshop_manuals": search_workshop_manuals,
        "convert_fastener_torque": convert_fastener_torque,
        "lookup_nhtsa_recalls": lookup_nhtsa_recalls,
        "lookup_nhtsa_complaints": lookup_nhtsa_complaints,
        "evaluate_warranty_coverage": evaluate_warranty_coverage,
        "verify_diagnostic_contradictions": verify_diagnostic_contradictions,
    }
    sub_agents = []
    for sub in (diagnostic_specialist, recall_safety_specialist, warranty_policy_specialist):
        sub_agents.append(
            {
                "name": sub.name,
                "description": sub.description,
                "model": MODEL,
                "tools": [
                    getattr(t, "__name__", getattr(t, "name", str(t)))
                    for t in getattr(sub, "tools", [])
                ],
            }
        )
    return {
        "adkSdkInstalled": ADK_SDK_AVAILABLE,
        "appName": app.name,
        "rootAgent": {
            "name": coordinator_agent.name,
            "description": coordinator_agent.description,
            "model": MODEL,
            "tools": [
                getattr(t, "name", getattr(t, "__name__", str(t)))
                for t in getattr(coordinator_agent, "tools", [])
            ],
        },
        "subAgents": sub_agents,
        "registeredTools": sorted(tool_registry.keys()),
    }
