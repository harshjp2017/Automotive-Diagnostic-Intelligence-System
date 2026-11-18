"""Google ADK FastAPI entrypoint exposing ADK Web/API, A2A, and Automotive RAG APIs."""

from __future__ import annotations

import contextlib
import os
from collections.abc import AsyncIterator

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.main import router as api_router
from app.app_utils import services

allow_origins = (
    os.getenv("ALLOW_ORIGINS", "").split(",") if os.getenv("ALLOW_ORIGINS") else ["*"]
)
otel_to_cloud = os.environ.get(
    "GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY", ""
).lower() in ("true", "1")

AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    from a2a.server.tasks import InMemoryTaskStore
    from google.adk.cli.fast_api import get_fast_api_app
    from google.adk.runners import Runner

    from app.app_utils.a2a import attach_a2a_routes
    from app.app_utils.reasoning_engine_adapter import attach_reasoning_engine_routes

    @contextlib.asynccontextmanager
    async def lifespan(fastapi_app: FastAPI) -> AsyncIterator[None]:
        from app.agent import app as adk_app
        from app.agent import root_agent

        runner = Runner(
            app=adk_app,
            session_service=services.get_session_service(),
            artifact_service=services.get_artifact_service(),
            auto_create_session=True,
        )
        fastapi_app.state.runner = runner
        fastapi_app.state.agent_app_name = adk_app.name
        await attach_a2a_routes(
            fastapi_app,
            agent=root_agent,
            runner=runner,
            task_store=InMemoryTaskStore(),
            rpc_path=f"/a2a/{adk_app.name}",
        )
        yield

    app: FastAPI = get_fast_api_app(
        agents_dir=AGENT_DIR,
        web=True,
        artifact_service_uri=services.ARTIFACT_SERVICE_URI,
        allow_origins=allow_origins,
        session_service_uri=services.SESSION_SERVICE_URI,
        otel_to_cloud=otel_to_cloud,
        lifespan=lifespan,
    )
    attach_reasoning_engine_routes(app)
except ImportError:
    app = FastAPI(
        title="dtc-diagnostics-system (ADK Fallback)",
        version="1.0.0",
        description="ADK-compatible FastAPI entrypoint for Automotive Diagnostic Intelligence System.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.title = "dtc-diagnostics-system"
app.description = "Google ADK & Automotive Diagnostic Intelligence System API"
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
