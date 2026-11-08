# Auto Service RAG - Deployment Guide

## Prerequisites
- Google Cloud SDK (`gcloud` CLI) installed
- Python 3.10+
- Google Cloud Billing-enabled account

---

## Step 1: Authentication
Authenticate your local CLI and configure Application Default Credentials (ADC):
```bash
# Authenticate gcloud user account
gcloud auth login

# Generate Application Default Credentials for local Python SDK usage
gcloud auth application-default login

# Verify active authentication
gcloud auth list
```

---

## Step 2: Project Creation & Configuration
Create the designated project and set compute region:
```bash
export PROJECT_ID="auto-service-rag-$(whoami)"

# Create GCP project
gcloud projects create $PROJECT_ID --name="Auto Service RAG"

# Set default project
gcloud config set project $PROJECT_ID

# Set compute region
gcloud config set compute/region us-central1
```

---

## Step 3: Enable Core Google Cloud APIs
Enable the required APIs for Vertex AI, BigQuery, Cloud Storage, and Cloud Run:
```bash
gcloud services enable \
  aiplatform.googleapis.com \
  bigquery.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  cloudtrace.googleapis.com
```

---

## Step 4: Provision Cloud Storage & BigQuery
```bash
# Create Cloud Storage bucket for factory manuals
gcloud storage buckets create gs://${PROJECT_ID}-manuals \
  --location=us-central1 \
  --uniform-bucket-level-access

# Create BigQuery dataset for manuals and vector search
bq --location=US mk --dataset ${PROJECT_ID}:auto_service

# Initialize BigQuery schema
bq query --use_legacy_sql=false < infra/bigquery_schema.sql
```

---

## Step 5: Provision Least-Privilege Service Account
Create an isolated runtime identity for the API service:
```bash
gcloud iam service-accounts create api-runtime \
  --display-name="Auto Service RAG API Runtime"

# Bind least-privilege roles
for R in roles/aiplatform.user roles/bigquery.dataViewer roles/bigquery.jobUser roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:api-runtime@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role=$R
done
```

---

## Step 6: Smoke Test Connectivity
Verify Vertex AI and Gemini 3.8 Flash connectivity from Python:
```bash
pip install google-genai
python3 smoke_test.py $PROJECT_ID
```

---

## Step 7: Run Local Development Server
```bash
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8080
```
Open interactive Swagger documentation at `http://localhost:8080/docs`.

---

## Step 8: Deploy to Google Cloud Run
Deploy containerized service directly to Cloud Run:
```bash
gcloud builds submit --config=infra/cloudbuild.yaml --substitutions=_PROJECT_ID=$PROJECT_ID
```
