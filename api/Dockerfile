# Production Dockerfile for Auto Service RAG Cloud Run Service
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application directories
COPY api/ /app/api/
COPY retrieval/ /app/retrieval/
COPY ingest/ /app/ingest/

EXPOSE 8080

# Run uvicorn on 0.0.0.0:$PORT
CMD exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT} --workers 2
