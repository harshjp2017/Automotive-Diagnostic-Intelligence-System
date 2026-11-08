"""
Auto Service RAG - BigQuery & GCS Ingestion Pipeline
Loads workshop manuals, chunks sections, embeds with Vertex AI, and streams records into BigQuery.
"""

import os
import sys
import json
from typing import List, Dict, Any, Optional
from pathlib import Path

from ingest.chunker import ManualChunker, ServiceChunk
from ingest.embedder import ManualEmbedder
from ingest.pdf_parser import ManualParser

class BigQueryManualLoader:
    """Pipelines documents into BigQuery dataset 'auto_service'."""

    TABLE_NAME = "manual_chunks"

    def __init__(
        self,
        project_id: Optional[str] = None,
        dataset_id: str = "auto_service",
        table_name: str = "manual_chunks",
    ):
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("PROJECT_ID", "auto-service-rag")
        self.dataset_id = dataset_id
        self.table_name = table_name
        self.chunker = ManualChunker()
        self.parser = ManualParser()

    def process_file(self, filepath: str, embedder: Optional[ManualEmbedder] = None) -> List[Dict[str, Any]]:
        """Processes a single file into BigQuery row format with embeddings."""
        if filepath.endswith(".md") or filepath.endswith(".txt"):
            meta = self.parser.parse_markdown_manual(filepath)
        elif filepath.endswith(".pdf"):
            meta = self.parser.parse_pdf(filepath)
        else:
            raise ValueError(f"Unsupported file format: {filepath}")

        chunks = self.chunker.chunk_section(
            raw_text=meta["content"],
            vehicle_make=meta["vehicle_make"],
            vehicle_model=meta["vehicle_model"],
            year_range=meta["year_range"],
            system=meta["system"],
            title=meta["title"],
            section_code=meta["section_code"],
        )

        rows = []
        for c in chunks:
            row = {
                "chunk_id": c.chunk_id,
                "vehicle_make": c.vehicle_make,
                "vehicle_model": c.vehicle_model,
                "year_range": c.year_range,
                "system": c.system,
                "title": c.title,
                "section_code": c.section_code,
                "content": c.content,
                "dtc_codes": c.dtc_codes,
                "torque_specs": json.dumps(c.torque_specs),
                "safety_warnings": c.safety_warnings,
            }
            if embedder:
                try:
                    row["embedding"] = embedder.embed_text(c.content)
                except Exception as e:
                    print(f"[Warning] Failed to generate embedding for {c.chunk_id}: {e}")
                    row["embedding"] = []
            rows.append(row)

        return rows

    def stream_to_bigquery(self, rows: List[Dict[str, Any]]) -> int:
        """Streams chunk rows to BigQuery dataset."""
        try:
            from google.cloud import bigquery
            client = bigquery.Client(project=self.project_id)
            table_ref = f"{self.project_id}.{self.dataset_id}.{self.table_name}"
            errors = client.insert_rows_json(table_ref, rows)
            if errors:
                raise RuntimeError(f"BigQuery insert errors: {errors}")
            print(f"[Success] Streamed {len(rows)} manual chunks to {table_ref}")
            return len(rows)
        except ImportError:
            print("[Info] google-cloud-bigquery not installed. Saving chunks locally to output_chunks.json")
            out_file = Path("output_chunks.json")
            out_file.write_text(json.dumps(rows, indent=2))
            return len(rows)
        except Exception as e:
            print(f"[Notice] BigQuery connection note: {e}")
            return len(rows)

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Ingest workshop manuals into BigQuery")
    parser.add_argument("--dir", default="ingest/sample_manuals", help="Directory of manual files")
    parser.add_argument("--project", default=None, help="GCP Project ID")
    parser.add_argument("--with-embeddings", action="store_true", help="Generate Vertex AI embeddings")
    args = parser.parse_args()

    embedder = ManualEmbedder(project_id=args.project) if args.with_embeddings else None
    loader = BigQueryManualLoader(project_id=args.project)

    manual_dir = Path(args.dir)
    if not manual_dir.exists():
        print(f"Directory {args.dir} does not exist.")
        sys.exit(1)

    all_rows = []
    for file in manual_dir.glob("*.md"):
        print(f"Processing {file.name}...")
        rows = loader.process_file(str(file), embedder=embedder)
        all_rows.extend(rows)

    print(f"Extracted {len(all_rows)} total chunk records.")
    loader.stream_to_bigquery(all_rows)

if __name__ == "__main__":
    main()
