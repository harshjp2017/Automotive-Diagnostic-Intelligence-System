"""
Auto Service RAG - API Settings & Environment Configuration
"""

import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_ID: str = os.environ.get("GOOGLE_CLOUD_PROJECT", os.environ.get("PROJECT_ID", "auto-service-rag"))
    LOCATION: str = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    BIGQUERY_DATASET: str = os.environ.get("BIGQUERY_DATASET", "auto_service")
    GCS_BUCKET: str = os.environ.get("GCS_BUCKET", f"{PROJECT_ID}-manuals")
    GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
    EMBEDDING_MODEL: str = os.environ.get("EMBEDDING_MODEL", "text-embedding-004")
    API_PORT: int = int(os.environ.get("PORT", "8080"))
    LOG_LEVEL: str = os.environ.get("LOG_LEVEL", "INFO")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
