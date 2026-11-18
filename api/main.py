"""
Auto Service RAG - Production FastAPI Service
Provides RESTful APIs for diagnostic query synthesis, manual indexing, and torque conversion.
Designed for deployment to Google Cloud Run with least-privilege IAM runtime.
"""

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.models import (
    DiagnosticQueryRequest,
    DiagnosticQueryResponse,
    IngestManualRequest,
    TorqueConversionRequest,
    TorqueConversionResponse,
)
from api.config import settings
from app.agent import (
    ADK_SDK_AVAILABLE,
    convert_fastener_torque,
    evaluate_warranty_coverage,
    get_adk_metadata,
    load_normalized_manual_chunks,
    lookup_nhtsa_complaints,
    lookup_nhtsa_recalls,
    search_workshop_manuals,
    verify_diagnostic_contradictions,
)
from retrieval.hybrid_retriever import HybridRetriever
from retrieval.rag_orchestrator import RagOrchestrator
from retrieval.torque_filter import TorqueFilter

app = FastAPI(
    title="Auto Service RAG API",
    version="1.0.0",
    description="Grounded Automotive Diagnostics, OEM Workshop Manual Retrieval, and ADK Multi-Agent Triage.",
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

# Seed in-memory retriever with initial factory workshop manuals
INITIAL_CHUNKS = [
    {
        "id": "ford-ecoboost-p0300",
        "vehicle_make": "Ford",
        "vehicle_model": "F-150 EcoBoost 3.5L",
        "year_range": "2018-2024",
        "system": "Engine Powertrain",
        "title": "Ignition System & Random Misfire Diagnostic Procedure (DTC P0300 / P0302)",
        "section_code": "TSB 21-2119 / WSM 303-07A",
        "content": (
            "1. Verify spark plug electrode gap: Factory specification is strictly 0.030 in (0.76 mm). "
            "Over-gapped plugs caused by spark erosion under twin-turbo boost pressures exceeding 14 psi "
            "will blow out spark kernel, triggering intermittent high-load misfires.\n"
            "2. Direct-Injection Carbon Build-up: Inspect intake valves using borescope.\n"
            "3. VCT Camshaft Phasers (TSB 21-2119): Check for cold-start rattle lasting 2-5 seconds.\n"
            "4. Fuel Rail Pressure Sensor (FRP): Verify low-pressure delivery (55-65 psi) and high-pressure rail (2,150 psi at idle)."
        ),
        "torque_specs": {
            "Spark Plugs": "15 Nm (133 lb-in)",
            "Ignition Coil Retaining Bolts": "10 Nm (89 lb-in)",
            "Intake Manifold Upper Bolts": "10 Nm (89 lb-in)",
            "High-Pressure Fuel Pump Mounting Bolts": "12 Nm + 45 deg",
        },
        "dtc_codes": ["P0300", "P0301", "P0302", "P0016"],
        "safety_warnings": ["WARNING: Fuel system remains under extreme pressure up to 3,000 psi. Relieve pressure before disconnecting lines."],
    },
    {
        "id": "tesla-m3-hv-penthouse",
        "vehicle_make": "Tesla",
        "vehicle_model": "Model 3 / Model Y",
        "year_range": "2020-2026",
        "system": "High Voltage Powertrain & Safety",
        "title": "High Voltage Pyrofuse Disconnect & De-energization Protocol",
        "section_code": "SI-20-44-001 / WSM 4401",
        "content": (
            "1. High-Voltage Interlock Loop (HVIL): The HVIL loop is a continuous 12V circuit that loops through every high-voltage connector.\n"
            "2. Low-Voltage 12V / 16V Battery Disconnect: Always disconnect low-voltage first to de-energize contactor coils.\n"
            "3. First Responder Cut Loop: Cut loop is located under the front passenger cowl.\n"
            "4. Verification of Zero Energy State: Connect CAT-IV 1000V rated DMM. Verify residual voltage is under 12V DC."
        ),
        "torque_specs": {
            "High Voltage Penthouse Cover Fasteners": "9 Nm (80 lb-in)",
            "High Voltage Busbar Retaining Bolts": "18 Nm (13.3 ft-lb)",
            "Pyro-fuse Retaining Fasteners": "8 Nm (71 lb-in)",
        },
        "dtc_codes": ["BMS_a064", "BMS_u018"],
        "safety_warnings": ["DANGER: Lethal high voltage (350V - 450V DC) present. Service only with Class 0 electrical gloves."],
    },
]

_disk_chunks = load_normalized_manual_chunks()
retriever = HybridRetriever(_disk_chunks if _disk_chunks else INITIAL_CHUNKS)
orchestrator = RagOrchestrator(
    retriever=retriever,
    project_id=settings.PROJECT_ID,
    location=settings.LOCATION,
    model=settings.GEMINI_MODEL,
)


class AdkRunRequest(BaseModel):
    vehicle_make: str = ""
    vehicle_model: str = ""
    vehicle_year: str = "2022"
    engine: Optional[str] = ""
    dtc_code: Optional[str] = ""
    mileage: int = 36000
    symptoms: Optional[str] = ""
    inquiry: Optional[str] = ""


@router.get("/health")
def health_check():
    """Liveness probe for Cloud Run."""
    return {
        "status": "healthy",
        "service": "auto-service-rag-api",
        "project_id": settings.PROJECT_ID,
        "location": settings.LOCATION,
        "model": settings.GEMINI_MODEL,
        "indexed_manuals": len(retriever.chunks),
        "adk_sdk_available": ADK_SDK_AVAILABLE,
    }


@router.get("/.well-known/agent-card.json")
def get_agent_card():
    """A2A & Google ADK compatible Agent Card describing dtc_diagnostics_agent."""
    base_url = os.environ.get("APP_URL", f"http://localhost:{settings.API_PORT}")
    return {
        "name": "dtc_diagnostics_agent",
        "description": (
            "Google ADK supervisor agent coordinating OEM workshop manual RAG, "
            "NHTSA recall/complaint lookup, warranty triage, and contradiction self-reflection."
        ),
        "version": "1.0.0",
        "url": f"{base_url}/a2a/app",
        "protocolVersion": "0.3",
        "capabilities": {
            "streaming": True,
            "pushNotifications": False,
            "stateTransitionHistory": True,
        },
        "defaultInputModes": ["text"],
        "defaultOutputModes": ["text"],
        "skills": [
            {
                "id": "diagnostic_specialist",
                "name": "OEM Workshop Manual & Torque Diagnostics",
                "description": "Two-stage hybrid retrieval over OEM manuals and bidirectional torque spec conversion.",
                "tags": ["dtc", "obd2", "torque", "oem-manuals"],
            },
            {
                "id": "recall_safety_specialist",
                "name": "NHTSA Recalls & ODI Defect Complaints",
                "description": "Searches NHTSA recall campaigns and ODI consumer complaint clusters.",
                "tags": ["nhtsa", "recalls", "odi", "safety"],
            },
            {
                "id": "warranty_policy_specialist",
                "name": "Warranty Coverage & 10-K Triage",
                "description": "Evaluates Bumper-to-Bumper, Powertrain, HV/Emissions, and Recall coverage.",
                "tags": ["warranty", "10-k", "triage"],
            },
            {
                "id": "self_reflection_verifier",
                "name": "Diagnostic Contradiction & Safety Self-Reflection",
                "description": "Validates HV lockout warnings, fuel pressure relief, and torque spec completeness.",
                "tags": ["verification", "safety", "self-reflection"],
            },
        ],
        "supportedInterfaces": [
            {"protocolBinding": "JSONRPC", "protocolVersion": "0.3", "url": f"{base_url}/a2a/app"},
            {"protocolBinding": "HTTP+JSON", "protocolVersion": "1.0", "url": f"{base_url}/v1/adk/run"},
        ],
    }


@router.get("/v1/adk/agents")
def list_adk_agents():
    """Lists the configured Google ADK root agent, specialist sub-agents, and tools."""
    return get_adk_metadata()


@router.post("/v1/adk/run")
def run_adk_agent_workflow(request: AdkRunRequest):
    """Executes the ADK multi-agent diagnostic, recall, warranty, and self-reflection pipeline."""
    start_time = time.time()
    trace: List[Dict[str, Any]] = []

    manual_res = json.loads(
        search_workshop_manuals(
            query=f"{request.symptoms or ''} {request.inquiry or ''}".strip(),
            vehicle_make=request.vehicle_make,
            vehicle_model=request.vehicle_model,
            vehicle_year=request.vehicle_year,
            dtc_code=request.dtc_code or "",
        )
    )
    matched_manuals = manual_res.get("matched_manuals", [])
    converted_torque = {}
    for m in matched_manuals:
        for fastener, spec in (m.get("torque_specs") or {}).items():
            converted_torque[fastener] = json.loads(convert_fastener_torque(str(spec)))

    trace.append(
        {
            "agent": "diagnostic_specialist",
            "toolsCalled": ["search_workshop_manuals", "convert_fastener_torque"],
            "status": "completed",
            "summary": f"Retrieved {len(matched_manuals)} OEM manual chunk(s) and standardized {len(converted_torque)} torque spec(s).",
        }
    )

    recalls_res = json.loads(
        lookup_nhtsa_recalls(
            vehicle_make=request.vehicle_make,
            vehicle_model=request.vehicle_model,
            keyword=request.dtc_code or "",
        )
    )
    complaints_res = json.loads(
        lookup_nhtsa_complaints(
            vehicle_make=request.vehicle_make,
            vehicle_model=request.vehicle_model,
            symptom_keyword=request.dtc_code or "",
        )
    )
    trace.append(
        {
            "agent": "recall_safety_specialist",
            "toolsCalled": ["lookup_nhtsa_recalls", "lookup_nhtsa_complaints"],
            "status": "completed",
            "summary": (
                f"Matched {recalls_res.get('total_matched', 0)} NHTSA recall(s) and "
                f"{complaints_res.get('total_matched', 0)} ODI complaint(s)."
            ),
        }
    )

    warranty_res = json.loads(
        evaluate_warranty_coverage(
            vehicle_make=request.vehicle_make,
            vehicle_model=request.vehicle_model,
            vehicle_year=request.vehicle_year,
            mileage=request.mileage,
            dtc_code=request.dtc_code or "",
        )
    )
    trace.append(
        {
            "agent": "warranty_policy_specialist",
            "toolsCalled": ["evaluate_warranty_coverage"],
            "status": "completed",
            "summary": f"Warranty verdict: {warranty_res.get('verdict')}",
        }
    )

    diagnosis_text = ""
    combined_torque: Dict[str, str] = {}
    sources_cited: List[str] = []
    model_used = settings.GEMINI_MODEL
    try:
        rag_result = orchestrator.generate_diagnosis(
            vehicle_make=request.vehicle_make,
            vehicle_model=request.vehicle_model,
            vehicle_year=request.vehicle_year,
            engine=request.engine or "",
            dtc_code=request.dtc_code or "",
            symptoms=request.symptoms or "",
            inquiry=request.inquiry or "",
            top_k=3,
        )
        diagnosis_text = rag_result["diagnosis"]
        combined_torque = rag_result["torque_specs"]
        sources_cited = rag_result["sources_cited"]
        model_used = rag_result["model"]
    except Exception:
        for m in matched_manuals:
            combined_torque.update(m.get("torque_specs") or {})
            sources_cited.append(f"{m.get('section_code')}: {m.get('title')}")
        top_content = matched_manuals[0]["content"] if matched_manuals else "No exact manual match found."
        diagnosis_text = (
            f"ADK Multi-Agent Diagnostic Synthesis for {request.vehicle_year} "
            f"{request.vehicle_make} {request.vehicle_model} (DTC {request.dtc_code or 'N/A'}):\n\n"
            f"{top_content}"
        )

    reflection_res = json.loads(
        verify_diagnostic_contradictions(
            diagnosis_summary=diagnosis_text,
            dtc_code=request.dtc_code or "",
            vehicle_make=request.vehicle_make,
        )
    )
    trace.append(
        {
            "agent": "dtc_diagnostics_agent",
            "toolsCalled": ["verify_diagnostic_contradictions"],
            "status": reflection_res.get("self_reflection_status", "PASS"),
            "summary": f"Self-reflection completed: {reflection_res.get('self_reflection_status')}",
            "findings": reflection_res.get("findings", []),
        }
    )

    return {
        "diagnosis": diagnosis_text,
        "adkTrace": trace,
        "warrantyAssessment": warranty_res,
        "matchedRecalls": recalls_res.get("recalls", []),
        "complaintSummary": {
            "totalMatched": complaints_res.get("total_matched", 0),
            "crashReports": complaints_res.get("crash_reports", 0),
            "fireReports": complaints_res.get("fire_reports", 0),
        },
        "torqueSpecs": combined_torque,
        "convertedTorque": converted_torque,
        "sourcesCited": sources_cited,
        "retrievedChunks": matched_manuals,
        "selfReflection": reflection_res,
        "elapsedMs": round((time.time() - start_time) * 1000),
        "model": model_used,
    }


@router.post("/v1/query", response_model=DiagnosticQueryResponse)
def execute_rag_query(request: DiagnosticQueryRequest):
    """
    Executes grounded RAG diagnostic workflow for an automotive service technician.
    """
    try:
        result = orchestrator.generate_diagnosis(
            vehicle_make=request.vehicle_make,
            vehicle_model=request.vehicle_model,
            vehicle_year=request.vehicle_year,
            engine=request.engine or "",
            dtc_code=request.dtc_code or "",
            symptoms=request.symptoms or "",
            inquiry=request.inquiry or "",
            top_k=request.top_k,
        )
        return DiagnosticQueryResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/manuals")
def list_indexed_manuals():
    """Lists summary of all currently indexed OEM workshop manual chunks."""
    summaries = [
        {
            "id": c.get("id"),
            "vehicle_make": c.get("vehicle_make"),
            "vehicle_model": c.get("vehicle_model"),
            "year_range": c.get("year_range"),
            "system": c.get("system"),
            "title": c.get("title"),
            "section_code": c.get("section_code"),
            "dtc_codes": c.get("dtc_codes", []),
            "has_torque_specs": bool(c.get("torque_specs")),
        }
        for c in retriever.chunks
    ]
    return {"manuals": summaries, "total_count": len(summaries)}


@router.post("/v1/ingest")
def ingest_manual_chunk(chunk: IngestManualRequest):
    """Ingests a new manual chunk dynamically into the index."""
    new_item = chunk.model_dump()
    new_item["id"] = f"manual_{int(time.time())}"
    retriever.chunks.insert(0, new_item)
    return {"status": "indexed", "id": new_item["id"], "total_indexed": len(retriever.chunks)}


@router.post("/v1/torque/convert", response_model=TorqueConversionResponse)
def convert_torque(request: TorqueConversionRequest):
    """Converts and parses a bolt torque string into standardized units."""
    parsed = TorqueFilter.parse_torque_value(request.torque_string)
    return TorqueConversionResponse(**parsed)


app.include_router(router)
