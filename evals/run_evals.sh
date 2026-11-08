#!/usr/bin/env bash
set -e

echo "Starting Auto Service RAG Evaluation Suite..."
PROJECT_ID=${1:-$GOOGLE_CLOUD_PROJECT}

if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID="PROJECT_ID"
fi

echo "Project: $PROJECT_ID"
python3 evals/rag_eval.py "$PROJECT_ID"
