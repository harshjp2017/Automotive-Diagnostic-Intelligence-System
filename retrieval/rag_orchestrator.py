"""
Auto Service RAG - RAG Orchestrator
Coordinates retrieval, prompt assembly, torque specification synthesis, and Gemini generation.
"""

import os
import json
import time
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types

from retrieval.hybrid_retriever import HybridRetriever
from retrieval.reranker import DiagnosticReranker
from retrieval.torque_filter import TorqueFilter

class RagOrchestrator:
    """End-to-end orchestration for OEM grounded automotive diagnostics."""

    DEFAULT_MODEL = "gemini-3.8-flash"

    SYSTEM_INSTRUCTION = """You are an ASE Master Certified Automotive Technical Specialist & OEM Field Service Engineer.
Your objective is to deliver an authoritative, grounded diagnostic and repair report based STRICTLY on the retrieved factory workshop manuals.

Execution Rules:
1. Always CITE the exact OEM Section Code and Manual Title from the retrieved excerpts.
2. Provide a structured Root Cause Analysis with testing verification steps (multimeter, fuel pressure gauge, borescope, oscilloscope).
3. Always transcribe relevant fastener bolt torque specifications VERBATIM. Note if bolts are Torque-to-Yield (TTY).
4. Prominently display any SAFETY WARNINGS (High Voltage disconnect, fuel pressure relief, pyrotechnic precautions).
5. If retrieved excerpts do not contain the complete procedure, state clearly what is documented and identify what requires supplementary OEM technical bulletins."""

    def __init__(
        self,
        retriever: HybridRetriever,
        project_id: Optional[str] = None,
        location: str = "us-central1",
        model: str = DEFAULT_MODEL,
        api_key: Optional[str] = None,
    ):
        self.retriever = retriever
        self.reranker = DiagnosticReranker()
        self.model = model
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("PROJECT_ID")
        self.location = location or os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")

        if self.project_id and self.project_id != "PROJECT_ID":
            self.client = genai.Client(vertexai=True, project=self.project_id, location=self.location)
        elif self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = genai.Client(vertexai=True, location=self.location)

    def generate_diagnosis(
        self,
        vehicle_make: str,
        vehicle_model: str,
        vehicle_year: str,
        engine: str = "",
        dtc_code: str = "",
        symptoms: str = "",
        inquiry: str = "",
        top_k: int = 3,
    ) -> Dict[str, Any]:
        """Runs the complete RAG diagnostic workflow."""
        start_time = time.time()
        search_query = f"{vehicle_make} {vehicle_model} {engine} {dtc_code} {symptoms} {inquiry}".strip()

        # 1. Retrieve candidates
        candidates = self.retriever.retrieve(
            query=search_query,
            vehicle_make=vehicle_make,
            vehicle_model=vehicle_model,
            dtc_code=dtc_code,
            top_k=top_k * 2,
        )

        # 2. Re-rank
        reranked = self.reranker.rerank(
            query=search_query,
            candidates=candidates,
            dtc_code=dtc_code,
            vehicle_make=vehicle_make,
        )[:top_k]

        matched_chunks = [item["chunk"] for item in reranked]

        # 3. Aggregate torque specifications
        combined_torque: Dict[str, str] = {}
        for chunk in matched_chunks:
            specs = chunk.get("torque_specs")
            if isinstance(specs, str):
                try:
                    specs = json.loads(specs)
                except:
                    specs = {}
            if isinstance(specs, dict):
                combined_torque.update(specs)

        # 4. Construct Context Block
        context_parts = []
        for idx, chunk in enumerate(matched_chunks):
            part = f"""--- RETRIEVED MANUAL [{idx + 1}] ---
Vehicle: {chunk.get('vehicle_make', '')} {chunk.get('vehicle_model', '')} ({chunk.get('year_range', '')})
System: {chunk.get('system', '')}
Section Code: {chunk.get('section_code', '')}
Title: {chunk.get('title', '')}
Content:
{chunk.get('content', '')}"""
            context_parts.append(part)

        context_text = "\n\n".join(context_parts)

        # 5. Build User Prompt
        user_prompt = f"""VEHICLE UNDER DIAGNOSIS:
- Year/Make/Model: {vehicle_year} {vehicle_make} {vehicle_model} {f'({engine})' if engine else ''}
- Diagnostic Trouble Code (DTC): {dtc_code or 'None Reported'}
- Customer Reported Symptoms: {symptoms or 'General diagnostic inspection required'}
- Mechanic Inquiry: {inquiry or 'Provide complete diagnostic verification tree, testing steps, safety precautions, and torque specs.'}

RETRIEVED FACTORY WORKSHOP MANUAL EXCERPTS:
{context_text}

Generate the comprehensive diagnostic and repair plan now."""

        # 6. Call Gemini 3.8 Flash
        response = self.client.models.generate_content(
            model=self.model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=self.SYSTEM_INSTRUCTION,
                temperature=0.2,
            ),
        )

        elapsed_ms = round((time.time() - start_time) * 1000)

        return {
            "diagnosis": response.text,
            "torque_specs": combined_torque,
            "sources_cited": [f"{c.get('section_code')}: {c.get('title')}" for c in matched_chunks],
            "retrieved_chunks_count": len(matched_chunks),
            "elapsed_ms": elapsed_ms,
            "model": self.model,
        }
