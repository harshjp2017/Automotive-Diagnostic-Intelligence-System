"""
Auto Service RAG - Embedder Module
Generates high-dimensional vector embeddings using Google GenAI SDK
Compatible with Vertex AI (ADC / service account) and Google AI Studio.
"""

import os
from typing import List, Optional
from google import genai
from google.genai import types

class ManualEmbedder:
    """Embeds automotive workshop manual chunks using Google's text-embedding-004 model."""

    DEFAULT_MODEL = "text-embedding-004"

    def __init__(
        self,
        project_id: Optional[str] = None,
        location: str = "us-central1",
        model: str = DEFAULT_MODEL,
        api_key: Optional[str] = None,
    ):
        self.model = model
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("PROJECT_ID")
        self.location = location or os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")

        if self.project_id and self.project_id != "PROJECT_ID":
            self.client = genai.Client(vertexai=True, project=self.project_id, location=self.location)
        elif self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            # Fall back to ADC project lookup
            self.client = genai.Client(vertexai=True, location=self.location)

    def embed_text(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> List[float]:
        """Generates embedding vector for a single chunk of text."""
        response = self.client.models.embed_content(
            model=self.model,
            contents=text,
            config=types.EmbedContentConfig(
                task_type=task_type,
            ),
        )
        if hasattr(response, "embeddings") and response.embeddings:
            return response.embeddings[0].values
        elif hasattr(response, "embedding") and response.embedding:
            return response.embedding.values
        raise ValueError("No embeddings returned by embedding API.")

    def embed_query(self, query: str) -> List[float]:
        """Generates embedding vector for a mechanic's search inquiry."""
        return self.embed_text(query, task_type="RETRIEVAL_QUERY")

    def embed_batch(self, texts: List[str], task_type: str = "RETRIEVAL_DOCUMENT") -> List[List[float]]:
        """Batch generates embeddings."""
        results: List[List[float]] = []
        for text in texts:
            results.append(self.embed_text(text, task_type=task_type))
        return results
