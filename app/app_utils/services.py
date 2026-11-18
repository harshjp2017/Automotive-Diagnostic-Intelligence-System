"""Process-wide ADK session, artifact, and memory service helpers.

Registered under ``shared://`` so ADK web routes, A2A routes, and the
reasoning_engine adapter share one backend instance.
"""

from __future__ import annotations

import functools
import os
from typing import Any

SESSION_SERVICE_URI = "shared://session"
ARTIFACT_SERVICE_URI = "shared://artifact"
MEMORY_SERVICE_URI = os.environ.get("MEMORY_SERVICE_URI")

_AGENT_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)


@functools.cache
def get_session_service() -> Any:
    """Returns configured ADK session service (URI, Vertex AI, or In-Memory)."""
    if uri := os.environ.get("SESSION_SERVICE_URI"):
        from google.adk.cli.utils.service_factory import (
            create_session_service_from_options,
        )

        return create_session_service_from_options(
            base_dir=_AGENT_DIR, session_service_uri=uri
        )
    if agent_engine_id := os.environ.get("GOOGLE_CLOUD_AGENT_ENGINE_ID"):
        from google.adk.sessions.vertex_ai_session_service import VertexAiSessionService

        return VertexAiSessionService(
            project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
            location=os.environ.get("GOOGLE_CLOUD_AGENT_ENGINE_LOCATION")
            or os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
            agent_engine_id=agent_engine_id,
        )
    from google.adk.sessions.in_memory_session_service import InMemorySessionService

    return InMemorySessionService()


@functools.cache
def get_artifact_service() -> Any:
    """Returns configured ADK artifact service (GCS bucket or In-Memory)."""
    from google.adk.artifacts import GcsArtifactService, InMemoryArtifactService

    if bucket := os.environ.get("LOGS_BUCKET_NAME"):
        return GcsArtifactService(bucket_name=bucket)
    return InMemoryArtifactService()


@functools.cache
def get_memory_service() -> Any:
    """Returns configured ADK memory service (Vertex Memory Bank or In-Memory)."""
    if agent_engine_id := os.environ.get("GOOGLE_CLOUD_AGENT_ENGINE_ID"):
        from google.adk.memory.vertex_ai_memory_bank_service import (
            VertexAiMemoryBankService,
        )

        return VertexAiMemoryBankService(
            project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
            location=os.environ.get("GOOGLE_CLOUD_AGENT_ENGINE_LOCATION")
            or os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
            agent_engine_id=agent_engine_id,
        )
    from google.adk.memory.in_memory_memory_service import InMemoryMemoryService

    return InMemoryMemoryService()


try:
    from google.adk.cli.service_registry import get_service_registry

    _registry = get_service_registry()
    _registry.register_session_service("shared", lambda uri, **kw: get_session_service())
    _registry.register_artifact_service("shared", lambda uri, **kw: get_artifact_service())
except ImportError:
    pass
