@echo off
title Cloud Run Proxy - dtc-diagnostics-system
echo ========================================================
echo Starting Cloud Run Authenticated Proxy...
echo Target: dtc-diagnostics-system (us-central1)
echo URL:    http://localhost:8080
echo ========================================================

start "" http://localhost:8080/docs
gcloud run services proxy dtc-diagnostics-system --region us-central1 --project my-project-2026-514503 --port 8080
pause
