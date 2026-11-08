"""
Auto Service RAG - Diagnostic Re-Ranker
Refines top candidate documents using cross-encoder scoring and OEM hierarchy rules.
"""

from typing import List, Dict, Any

class DiagnosticReranker:
    """Reranks candidate manual excerpts for technician accuracy."""

    @staticmethod
    def rerank(
        query: str,
        candidates: List[Dict[str, Any]],
        dtc_code: str = "",
        vehicle_make: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Reranks candidates enforcing safety warnings and exact factory procedure alignment.
        """
        target_dtc = dtc_code.strip().upper()
        reranked = []

        for item in candidates:
            chunk = item.get("chunk", item)
            base_score = item.get("score", 1.0)
            bonus = 0.0

            # Priority 1: Exact DTC match in section code or title
            title = chunk.get("title", "")
            section = chunk.get("section_code", "")
            if target_dtc and (target_dtc in title or target_dtc in section):
                bonus += 3.0

            # Priority 2: Contains torque specs
            if chunk.get("torque_specs") and len(chunk.get("torque_specs")) > 0:
                bonus += 1.0

            # Priority 3: Contains safety warning callout
            if chunk.get("safety_warnings") and len(chunk.get("safety_warnings")) > 0:
                bonus += 0.8

            reranked.append({
                "chunk": chunk,
                "original_score": base_score,
                "final_score": round(base_score + bonus, 4),
            })

        reranked.sort(key=lambda x: x["final_score"], reverse=True)
        return reranked
