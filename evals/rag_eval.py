"""
Auto Service RAG - Automated Evaluation Suite
Runs gold-standard diagnostic benchmarks and grades model outputs with quantitative metrics.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, List

from evals.metrics import RagMetrics
from retrieval.hybrid_retriever import HybridRetriever
from retrieval.rag_orchestrator import RagOrchestrator

def run_evaluation_suite(
    test_cases_path: str = "evals/test_cases.json",
    project_id: str = None,
) -> Dict[str, Any]:
    """Runs end-to-end evaluation benchmark."""
    print("=" * 65)
    print("Auto Service RAG - Automated Benchmark Evaluation Suite")
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
    ]

    retriever = HybridRetriever(chunks)
    orchestrator = RagOrchestrator(retriever=retriever, project_id=project_id)

    results = []
    total_keyword_cov = 0.0
    total_citation_fid = 0.0
    total_torque_acc = 0.0
    total_safety_comp = 0.0

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

            kw_cov = RagMetrics.calculate_keyword_coverage(diag, tc.get("expected_keywords", []))
            cit_fid = RagMetrics.calculate_citation_fidelity(sources, tc.get("expected_section", ""))
            tq_acc = RagMetrics.calculate_torque_accuracy(torque, tc.get("expected_torque_keys", []))
            safe_comp = RagMetrics.calculate_safety_compliance(diag, tc.get("must_contain_warning", False))

            total_keyword_cov += kw_cov
            total_citation_fid += cit_fid
            total_torque_acc += tq_acc
            total_safety_comp += safe_comp

            print(f"   -> Keyword Coverage:   {kw_cov * 100:.1f}%")
            print(f"   -> Citation Fidelity:  {cit_fid * 100:.1f}%")
            print(f"   -> Torque Accuracy:    {tq_acc * 100:.1f}%")
            print(f"   -> Safety Compliance:  {safe_comp * 100:.1f}%\n")

            results.append({
                "test_id": tc["id"],
                "keyword_coverage": kw_cov,
                "citation_fidelity": cit_fid,
                "torque_accuracy": tq_acc,
                "safety_compliance": safe_comp,
                "latency_ms": resp["elapsed_ms"],
            })

        except Exception as e:
            print(f"   -> [FAIL] Error executing test case: {e}\n")
            results.append({"test_id": tc["id"], "error": str(e)})

    n = max(1, len(results))
    summary = {
        "total_test_cases": len(test_cases),
        "mean_keyword_coverage": round(total_keyword_cov / n, 3),
        "mean_citation_fidelity": round(total_citation_fid / n, 3),
        "mean_torque_accuracy": round(total_torque_acc / n, 3),
        "mean_safety_compliance": round(total_safety_comp / n, 3),
        "results": results,
    }

    print("=" * 65)
    print("EVALUATION SUMMARY REPORT")
    print(f"Average Technical Keyword Coverage: {summary['mean_keyword_coverage'] * 100:.1f}%")
    print(f"Average Citation Section Fidelity:  {summary['mean_citation_fidelity'] * 100:.1f}%")
    print(f"Average Fastener Torque Accuracy:   {summary['mean_torque_accuracy'] * 100:.1f}%")
    print(f"Average Safety Protocol Compliance: {summary['mean_safety_compliance'] * 100:.1f}%")
    print("=" * 65)

    return summary

if __name__ == "__main__":
    project = sys.argv[1] if len(sys.argv) > 1 else None
    run_evaluation_suite(project_id=project)
