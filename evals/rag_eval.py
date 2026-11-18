"""
Auto Service RAG - Automated Evaluation Suite
Runs gold-standard diagnostic benchmarks and grades model outputs with quantitative metrics.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

from evals.metrics import RagMetrics
from retrieval.hybrid_retriever import HybridRetriever
from retrieval.rag_orchestrator import RagOrchestrator

def _select_mcp_tool(query: str) -> str:
    """Matches technician intent to the corresponding MCP tool (mirrors server.ts router)."""
    q = query.lower()
    if any(k in q for k in ("pid", "fuel trim", "sensor live", "coolant temp", "live telemetry")):
        return "read_live_pids"
    if any(k in q for k in ("freeze frame", "snapshot")):
        return "fetch_freeze_frame"
    if any(k in q for k in ("fleet", "bigquery", "cluster", "incidence")):
        return "query_dtc_fleet_clusters"
    if any(k in q for k in ("part", "stock", "inventory", "sp-578", "sp-594")):
        return "check_parts_stock"
    if any(k in q for k in ("labor", "book hour", "book time")):
        return "estimate_labor_time"
    return "read_live_pids"


def run_evaluation_suite(
    test_cases_path: str = "evals/test_cases.json",
    project_id: str = None,
) -> Dict[str, Any]:
    """Runs end-to-end 4-dimension evaluation benchmark."""
    print("=" * 65)
    print("Auto Service RAG - 4-Dimension Automated Benchmark Suite")
    print("=" * 65)

    path = Path(test_cases_path)
    if not path.exists():
        print(f"Test cases file not found at {test_cases_path}")
        sys.exit(1)

    test_cases = json.loads(path.read_text(encoding="utf-8"))
    print(f"Loaded {len(test_cases)} gold standard test cases.\n")

    # Sample manual chunks for benchmark
    chunks = [
        {
            "id": "ford-ecoboost-p0300",
            "vehicle_make": "Ford",
            "vehicle_model": "F-150 EcoBoost 3.5L",
            "year_range": "2018-2024",
            "system": "Engine Powertrain",
            "title": "Ignition System & Random Misfire Diagnostic Procedure (DTC P0300 / P0302)",
            "section_code": "TSB 21-2119 / WSM 303-07A",
            "content": (
                "Verify spark plug electrode gap: Factory specification is strictly 0.030 in (0.76 mm). "
                "Inspect intake valves using borescope for carbon buildup. "
                "VCT Camshaft Phasers (TSB 21-2119): Check for cold-start rattle."
            ),
            "torque_specs": {"Spark Plugs": "15 Nm (133 lb-in)"},
            "dtc_codes": ["P0300", "P0302", "P0016"],
            "safety_warnings": ["WARNING: Fuel system remains under extreme pressure up to 3,000 psi."],
        },
        {
            "id": "tesla-m3-hv-penthouse",
            "vehicle_make": "Tesla",
            "vehicle_model": "Model 3",
            "year_range": "2020-2026",
            "system": "High Voltage Powertrain & Safety",
            "title": "High Voltage Pyrofuse Disconnect & De-energization Protocol",
            "section_code": "WSM 4401",
            "content": (
                "High-Voltage Interlock Loop (HVIL): Disconnect 12V first to de-energize contactor coils. "
                "Verify zero energy state with 1000V rated meter before opening penthouse."
            ),
            "torque_specs": {"High Voltage Penthouse Cover Fasteners": "9 Nm (80 lb-in)"},
            "dtc_codes": ["BMS_a064"],
            "safety_warnings": ["DANGER: Lethal high voltage (350V - 450V DC) present."],
        },
        {
            "id": "toyota-a25a-p0171",
            "vehicle_make": "Toyota",
            "vehicle_model": "RAV4",
            "year_range": "2019-2025",
            "system": "Engine Fuel & Induction",
            "title": "DTC P0171: System Too Lean (Bank 1) Diagnostic Tree & Smoke Testing",
            "section_code": "RM-34J0U-ENG-082",
            "content": (
                "Short Term & Long Term Fuel Trim (STFT + LTFT): Inspect MAF and perform smoke test on intake manifold."
            ),
            "torque_specs": {"Intake Manifold to Cylinder Head": "21 Nm (15 ft-lb)"},
            "dtc_codes": ["P0171"],
            "safety_warnings": [],
        },
        {
            "id": "toyota-rav4-hv-p0a80",
            "vehicle_make": "Toyota",
            "vehicle_model": "RAV4 Hybrid",
            "year_range": "2019-2025",
            "system": "Hybrid Battery & High Voltage",
            "title": "HV Battery Pack Degradation & Service Plug Disconnect (DTC P0A80)",
            "section_code": "RM-HV-P0A80",
            "content": (
                "Disconnect high-voltage service plug grip before testing battery pack block degradation."
            ),
            "torque_specs": {"12V Auxiliary Terminal": "5.4 Nm"},
            "dtc_codes": ["P0A80"],
            "safety_warnings": ["WARNING: Disconnect high-voltage service plug with insulated Class 0 gloves."],
        },
    ]

    retriever = HybridRetriever(chunks)
    orchestrator = RagOrchestrator(
        retriever=retriever,
        project_id=project_id,
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
    )

    results = []
    total_keyword_cov = 0.0
    total_citation_fid = 0.0
    total_torque_acc = 0.0
    total_safety_comp = 0.0
    total_mcp_acc = 0.0

    for idx, tc in enumerate(test_cases, 1):
        print(f"[{idx}/{len(test_cases)}] Evaluating: {tc['id']} ({tc['vehicle_make']} {tc['vehicle_model']})...")
        try:
            resp = orchestrator.generate_diagnosis(
                vehicle_make=tc["vehicle_make"],
                vehicle_model=tc["vehicle_model"],
                vehicle_year=tc["vehicle_year"],
                engine=tc.get("engine", ""),
                dtc_code=tc.get("dtc_code", ""),
                symptoms=tc.get("symptoms", ""),
            )

            diag = resp["diagnosis"]
            sources = resp["sources_cited"]
            torque = resp["torque_specs"]
            invoked_tool = _select_mcp_tool(tc.get("symptoms", ""))

            kw_cov = RagMetrics.calculate_keyword_coverage(diag, tc.get("expected_keywords", []))
            cit_fid = RagMetrics.calculate_citation_fidelity(sources, tc.get("expected_section", ""))
            tq_acc = RagMetrics.calculate_torque_accuracy(torque, tc.get("expected_torque_keys", []))
            safe_comp = RagMetrics.calculate_safety_compliance(diag, tc.get("must_contain_warning", False))
            mcp_acc = RagMetrics.calculate_mcp_tool_accuracy(
                invoked_tool,
                tc.get("expected_mcp_tool", ""),
                tc.get("prohibited_mcp_tools", []),
            )

            total_keyword_cov += kw_cov
            total_citation_fid += cit_fid
            total_torque_acc += tq_acc
            total_safety_comp += safe_comp
            total_mcp_acc += mcp_acc

            print(f"   -> 1. RAG Retrieval (Citation):   {cit_fid * 100:.1f}%")
            print(f"   -> 2. Factual & Torque Precision: {tq_acc * 100:.1f}% (Keywords: {kw_cov * 100:.1f}%)")
            print(f"   -> 3. Safety & Grounding Gate:    {safe_comp * 100:.1f}%")
            print(f"   -> 4. MCP Tool Calling Accuracy:  {mcp_acc * 100:.1f}% ({invoked_tool})\n")

            results.append({
                "test_id": tc["id"],
                "rag_retrieval_quality": cit_fid,
                "keyword_coverage": kw_cov,
                "torque_accuracy": tq_acc,
                "safety_compliance": safe_comp,
                "mcp_tool_accuracy": mcp_acc,
                "invoked_mcp_tool": invoked_tool,
                "latency_ms": resp["elapsed_ms"],
            })

        except Exception as e:
            print(f"   -> [FAIL] Error executing test case: {e}\n")
            results.append({"test_id": tc["id"], "error": str(e)})

    n = max(1, len(results))
    summary = {
        "total_test_cases": len(test_cases),
        "mean_rag_retrieval_quality": round(total_citation_fid / n, 3),
        "mean_keyword_coverage": round(total_keyword_cov / n, 3),
        "mean_torque_accuracy": round(total_torque_acc / n, 3),
        "mean_safety_compliance": round(total_safety_comp / n, 3),
        "mean_mcp_tool_accuracy": round(total_mcp_acc / n, 3),
        "results": results,
    }

    print("=" * 65)
    print("4-DIMENSION EVALUATION SUMMARY REPORT")
    print(f"1. RAG Retrieval Quality (Citation): {summary['mean_rag_retrieval_quality'] * 100:.1f}%")
    print(f"2. Factual & Torque Precision:       {summary['mean_torque_accuracy'] * 100:.1f}%")
    print(f"3. Safety & Grounding Gate:          {summary['mean_safety_compliance'] * 100:.1f}%")
    print(f"4. MCP Tool Calling Accuracy:        {summary['mean_mcp_tool_accuracy'] * 100:.1f}%")
    print("=" * 65)

    return summary

if __name__ == "__main__":
    project = sys.argv[1] if len(sys.argv) > 1 else None
    run_evaluation_suite(project_id=project)
