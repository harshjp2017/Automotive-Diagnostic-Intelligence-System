"""
Auto Service RAG - Workshop Manual Ingestion Chunker
Segments OEM workshop service manuals, TSBs, and wiring schematics into domain-aware chunks
preserving DTC codes, torque specifications, and safety-critical warnings.
"""

import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

@dataclass
class ServiceChunk:
    chunk_id: str
    vehicle_make: str
    vehicle_model: str
    year_range: str
    system: str
    title: str
    section_code: str
    content: str
    dtc_codes: List[str]
    torque_specs: Dict[str, str]
    safety_warnings: List[str]
    metadata: Dict[str, Any]

class ManualChunker:
    """
    Intelligent chunker for automotive service manuals.
    Ensures torque specifications, DTC codes, and warning callouts are not split across chunks.
    """

    DTC_PATTERN = re.compile(r'\b([PCBU][0-3][0-9A-F]{3})\b', re.IGNORECASE)
    TORQUE_PATTERN = re.compile(
        r'([\w\s\-\/\(\)]+?):\s*([0-9\.]+\s*(?:Nm|lb-ft|lb-in|ft-lb|in-lb|kg-m)(?:\s*\+\s*[0-9]+(?:\s*deg|°))?)',
        re.IGNORECASE
    )
    WARNING_PATTERN = re.compile(
        r'(?:WARNING|CAUTION|DANGER|SAFETY NOTICE):?\s*(.+?)(?=(?:WARNING|CAUTION|DANGER|SAFETY NOTICE|\n\n|\Z))',
        re.IGNORECASE | re.DOTALL
    )

    def __init__(self, max_chunk_tokens: int = 600, overlap_tokens: int = 80):
        self.max_chunk_tokens = max_chunk_tokens
        self.overlap_tokens = overlap_tokens

    def extract_dtc_codes(self, text: str) -> List[str]:
        """Finds all standard SAE J2012 / ISO 15031 OBD-II diagnostic trouble codes."""
        matches = self.DTC_PATTERN.findall(text)
        return sorted(list(set(code.upper() for code in matches)))

    def extract_torque_specs(self, text: str) -> Dict[str, str]:
        """Extracts fastener names and specified factory torque values."""
        specs = {}
        for match in self.TORQUE_PATTERN.finditer(text):
            component = match.group(1).strip(" -*\t\r\n")
            torque = match.group(2).strip()
            if len(component) > 2 and len(component) < 50:
                specs[component] = torque
        return specs

    def extract_safety_warnings(self, text: str) -> List[str]:
        """Extracts high-voltage, fuel pressure, and pyrotechnic warning notices."""
        warnings = []
        for match in self.WARNING_PATTERN.finditer(text):
            warning_text = match.group(1).strip()
            if warning_text and len(warning_text) < 300:
                warnings.append(warning_text)
        return warnings

    def chunk_section(
        self,
        raw_text: str,
        vehicle_make: str,
        vehicle_model: str,
        year_range: str,
        system: str,
        title: str,
        section_code: str,
    ) -> List[ServiceChunk]:
        """Splits manual text while preserving metadata and domain entities."""
        dtc_codes = self.extract_dtc_codes(raw_text)
        torque_specs = self.extract_torque_specs(raw_text)
        safety_warnings = self.extract_safety_warnings(raw_text)

        paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
        chunks: List[ServiceChunk] = []

        current_text_blocks: List[str] = []
        current_len = 0
        chunk_idx = 1

        for p in paragraphs:
            approx_tokens = len(p) // 4
            if current_len + approx_tokens > self.max_chunk_tokens and current_text_blocks:
                full_chunk_text = "\n\n".join(current_text_blocks)
                chunks.append(
                    ServiceChunk(
                        chunk_id=f"{section_code.lower().replace(' ', '-')}-{chunk_idx}",
                        vehicle_make=vehicle_make,
                        vehicle_model=vehicle_model,
                        year_range=year_range,
                        system=system,
                        title=f"{title} (Part {chunk_idx})",
                        section_code=section_code,
                        content=full_chunk_text,
                        dtc_codes=self.extract_dtc_codes(full_chunk_text) or dtc_codes,
                        torque_specs=self.extract_torque_specs(full_chunk_text) or torque_specs,
                        safety_warnings=self.extract_safety_warnings(full_chunk_text) or safety_warnings,
                        metadata={"chunk_index": chunk_idx, "word_count": len(full_chunk_text.split())},
                    )
                )
                chunk_idx += 1
                current_text_blocks = [p]
                current_len = approx_tokens
            else:
                current_text_blocks.append(p)
                current_len += approx_tokens

        if current_text_blocks:
            full_chunk_text = "\n\n".join(current_text_blocks)
            chunks.append(
                ServiceChunk(
                    chunk_id=f"{section_code.lower().replace(' ', '-')}-{chunk_idx}",
                    vehicle_make=vehicle_make,
                    vehicle_model=vehicle_model,
                    year_range=year_range,
                    system=system,
                    title=f"{title} (Part {chunk_idx})" if chunk_idx > 1 else title,
                    section_code=section_code,
                    content=full_chunk_text,
                    dtc_codes=self.extract_dtc_codes(full_chunk_text) or dtc_codes,
                    torque_specs=self.extract_torque_specs(full_chunk_text) or torque_specs,
                    safety_warnings=self.extract_safety_warnings(full_chunk_text) or safety_warnings,
                    metadata={"chunk_index": chunk_idx, "word_count": len(full_chunk_text.split())},
                )
            )

        return chunks
