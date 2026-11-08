"""
Auto Service RAG - Production FastAPI Service
Provides RESTful APIs for diagnostic query synthesis, manual indexing, and torque conversion.
Designed for deployment to Google Cloud Run with least-privilege IAM runtime.
"""

import time
import os
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.models import (
    DiagnosticQueryRequest,
    DiagnosticQueryResponse,
    IngestManualRequest,
    TorqueConversionRequest,
    TorqueConversionResponse,
)
from api.config import settings
from retrieval.hybrid_retriever import HybridRetriever
from retrieval.rag_orchestrator import RagOrchestrator
from retrieval.torque_filter import TorqueFilter

app = FastAPI(
    title="Auto Service RAG API",
    version="1.0.0",
    description="Grounded Automotive Diagnostics, OEM Workshop Manual Retrieval, and Torque Specification Synthesis.",
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

retriever = HybridRetriever(INITIAL_CHUNKS)
orchestrator = RagOrchestrator(
    retriever=retriever,
    project_id=settings.PROJECT_ID,
    location=settings.LOCATION,
    model=settings.GEMINI_MODEL,
)

@app.get("/health")
def health_check():
    """Liveness probe for Cloud Run."""
    return {
        "status": "healthy",
        "service": "auto-service-rag-api",
        "project_id": settings.PROJECT_ID,
        "location": settings.LOCATION,
        "model": settings.GEMINI_MODEL,
        "indexed_manuals": len(retriever.chunks),
    }

@app.post("/v1/query", response_model=DiagnosticQueryResponse)
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

@app.get("/v1/manuals")
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

@app.post("/v1/ingest")
def ingest_manual_chunk(chunk: IngestManualRequest):
    """Ingests a new manual chunk dynamically into the index."""
    new_item = chunk.model_dump()
    new_item["id"] = f"manual_{int(time.time())}"
    retriever.chunks.insert(0, new_item)
    return {"status": "indexed", "id": new_item["id"], "total_indexed": len(retriever.chunks)}

@app.post("/v1/torque/convert", response_model=TorqueConversionResponse)
def convert_torque(request: TorqueConversionRequest):
    """Converts and parses a bolt torque string into standardized units."""
    parsed = TorqueFilter.parse_torque_value(request.torque_string)
    return TorqueConversionResponse(**parsed)
