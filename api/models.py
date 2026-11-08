"""
Auto Service RAG - API Request and Response Data Models
Pydantic schemas for REST API endpoints.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class DiagnosticQueryRequest(BaseModel):
    vehicle_make: str = Field(..., description="Vehicle make (e.g. Ford, Toyota, Tesla)")
    vehicle_model: str = Field(..., description="Vehicle model (e.g. F-150, RAV4, Model 3)")
    vehicle_year: str = Field(..., description="Model year (e.g. 2022)")
    engine: Optional[str] = Field(None, description="Engine or powertrain displacement (e.g. 3.5L EcoBoost)")
    dtc_code: Optional[str] = Field(None, description="Diagnostic trouble code (e.g. P0300, P0171)")
    symptoms: Optional[str] = Field(None, description="Customer reported symptoms or mechanical complaints")
    inquiry: Optional[str] = Field(None, description="Specific mechanic request or procedure inquiry")
    top_k: int = Field(3, ge=1, le=10, description="Number of manual chunks to retrieve")

class DiagnosticQueryResponse(BaseModel):
    diagnosis: str
    torque_specs: Dict[str, str]
    sources_cited: List[str]
    retrieved_chunks_count: int
    elapsed_ms: int
    model: str

class IngestManualRequest(BaseModel):
    vehicle_make: str
    vehicle_model: str
    year_range: str
    system: str
    title: str
    section_code: str
    content: str
    dtc_codes: Optional[List[str]] = []
    torque_specs: Optional[Dict[str, str]] = {}
    safety_warnings: Optional[List[str]] = []

class TorqueConversionRequest(BaseModel):
    torque_string: str

class TorqueConversionResponse(BaseModel):
    raw: str
    nm: Optional[float]
    ft_lb: Optional[float]
    in_lb: Optional[float]
    angle_degrees: Optional[int]
    is_torque_to_yield: bool
