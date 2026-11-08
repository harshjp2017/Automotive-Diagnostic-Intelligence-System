"""
Auto Service RAG - Hybrid Workshop Manual Retriever
Combines Vector Search (embeddings) with Lexical / DTC Code Matching
"""

import math
import re
from typing import List, Dict, Any, Optional

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two vector embeddings."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)

class HybridRetriever:
    """Performs hybrid vector + lexical retrieval over automotive manual chunks."""

    def __init__(self, manual_chunks: Optional[List[Dict[str, Any]]] = None):
        self.chunks = manual_chunks or []

    def load_chunks(self, chunks: List[Dict[str, Any]]):
        self.chunks = chunks

    def lexical_score(self, query: str, chunk: Dict[str, Any]) -> float:
        """Computes lexical BM25-like keyword relevance score."""
        tokens = [t.lower() for t in re.findall(r'\b\w+\b', query) if len(t) > 2]
        if not tokens:
            return 0.0

        content_lower = chunk.get("content", "").lower()
        title_lower = chunk.get("title", "").lower()
        system_lower = chunk.get("system", "").lower()
        make_lower = chunk.get("vehicle_make", "").lower()
        model_lower = chunk.get("vehicle_model", "").lower()

        score = 0.0
        for token in tokens:
            if token in content_lower:
                score += 1.0
            if token in title_lower:
                score += 2.5
            if token in system_lower:
                score += 2.0
            if token in make_lower or token in model_lower:
                score += 3.0

        return score / max(1.0, math.sqrt(len(tokens)))

    def retrieve(
        self,
        query: str,
        vehicle_make: str = "",
        vehicle_model: str = "",
        dtc_code: str = "",
        query_embedding: Optional[List[float]] = None,
        top_k: int = 3,
        vector_weight: float = 0.6,
        lexical_weight: float = 0.4,
    ) -> List[Dict[str, Any]]:
        """
        Executes hybrid retrieval combining vector similarity, lexical scoring, and DTC bonuses.
        """
        scored_candidates = []
        target_dtc = dtc_code.strip().upper()

        for chunk in self.chunks:
            # 1. Lexical Score
            l_score = self.lexical_score(query, chunk)

            # 2. Vector Similarity (if embeddings available)
            v_score = 0.0
            chunk_embedding = chunk.get("embedding")
            if query_embedding and chunk_embedding:
                v_score = cosine_similarity(query_embedding, chunk_embedding)

            # 3. Domain DTC Code Matching Bonus
            dtc_bonus = 0.0
            chunk_dtcs = [c.upper() for c in chunk.get("dtc_codes", [])]
            if target_dtc and target_dtc in chunk_dtcs:
                dtc_bonus = 5.0  # Massive boost for exact OEM fault code match
            elif target_dtc and any(target_dtc in c for c in chunk_dtcs):
                dtc_bonus = 2.5

            # 4. Make & Model Alignment Bonus
            make_bonus = 0.0
            chunk_make = chunk.get("vehicle_make", "").lower()
            if vehicle_make and vehicle_make.lower() in chunk_make:
                make_bonus = 2.0

            total_score = (vector_weight * v_score) + (lexical_weight * l_score) + dtc_bonus + make_bonus

            scored_candidates.append({
                "chunk": chunk,
                "score": round(total_score, 4),
                "lexical_score": round(l_score, 4),
                "vector_score": round(v_score, 4),
                "dtc_matched": bool(dtc_bonus > 0),
            })

        # Rank by total score descending
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        return scored_candidates[:top_k]
