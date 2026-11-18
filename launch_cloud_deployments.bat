@echo off
title Google Cloud Deployments - DTC Diagnostics System
cls
echo ======================================================================
echo    Automotive Diagnostic Intelligence System - Cloud Launchpad
echo    Google Cloud Project: my-project-2026-514503 (us-central1)
echo ======================================================================
echo.
echo [1] Launch Cloud Run Live GUI App (https://dtc-diagnostics-system...)
echo [2] Launch Agent Runtime Deployment Console (Gemini Platform)
echo [3] Launch All Deployments on Agent Runtime List
echo [4] Launch A2A Agent Card in Browser
echo [5] Exit
echo.
set /p choice="Select an option [1-5]: "

if "%choice%"=="1" start "" "https://dtc-diagnostics-system-79334435048.us-central1.run.app"
if "%choice%"=="2" start "" "https://console.cloud.google.com/vertex-ai/agents/agent-engines/locations/us-central1/agent-engines/612833971339788288?project=my-project-2026-514503"
if "%choice%"=="3" start "" "https://console.cloud.google.com/agent-platform/runtimes?project=my-project-2026-514503"
if "%choice%"=="4" start "" "https://us-central1-aiplatform.googleapis.com/reasoningEngines/v1/projects/79334435048/locations/us-central1/reasoningEngines/612833971339788288/api/a2a/app/.well-known/agent-card.json"
exit /b
