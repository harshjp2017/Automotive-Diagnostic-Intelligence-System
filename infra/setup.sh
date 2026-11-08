#!/usr/bin/env bash
# ==============================================================================
# Auto Service RAG - Google Cloud Infrastructure Automated Provisioning Script
# ==============================================================================
set -euo pipefail

# 1. Project ID Configuration
PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="us-central1"
SERVICE_ACCOUNT_NAME="api-runtime"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "PROJECT_ID" ]; then
  echo "Error: Please provide a valid Google Cloud Project ID."
  echo "Usage: ./infra/setup.sh YOUR_PROJECT_ID"
  exit 1
fi

echo "========================================================================"
echo "Provisioning Auto Service RAG Infrastructure on Google Cloud"
echo "Project ID:      $PROJECT_ID"
echo "Compute Region:  $REGION"
echo "========================================================================"

# 2. Authenticate & Set Active Project
echo "\n[1/7] Setting active GCP project..."
gcloud config set project "$PROJECT_ID"

# 3. Enable Required Google Cloud APIs
echo "\n[2/7] Enabling GCP Service APIs..."
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

# 4. Set Compute Region
echo "\n[3/7] Setting default compute region to $REGION..."
gcloud config set compute/region "$REGION"

# 5. Create Google Cloud Storage Bucket for Factory Manuals
BUCKET_NAME="${PROJECT_ID}-manuals"
echo "\n[4/7] Creating Cloud Storage Bucket (gs://${BUCKET_NAME})..."
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" &>/dev/null; then
  gcloud storage buckets create "gs://${BUCKET_NAME}" \
    --location="$REGION" \
    --uniform-bucket-level-access
  echo "Bucket gs://${BUCKET_NAME} created successfully."
else
  echo "Bucket gs://${BUCKET_NAME} already exists. Skipping."
fi

# 6. Create BigQuery Dataset for Auto Service RAG
echo "\n[5/7] Creating BigQuery Dataset '${PROJECT_ID}:auto_service'..."
if ! bq show "${PROJECT_ID}:auto_service" &>/dev/null; then
  bq --location=US mk --dataset "${PROJECT_ID}:auto_service"
  echo "BigQuery dataset auto_service created."
else
  echo "BigQuery dataset auto_service already exists. Skipping."
fi

# Initialize BigQuery Tables
echo "\n[5b/7] Initializing BigQuery schema from infra/bigquery_schema.sql..."
bq query --use_legacy_sql=false < infra/bigquery_schema.sql

# 7. Create Least-Privilege Runtime Service Account
SA_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "\n[6/7] Creating runtime service account '${SERVICE_ACCOUNT_NAME}'..."
if ! gcloud iam service-accounts describe "$SA_EMAIL" &>/dev/null; then
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
    --display-name="Auto Service RAG API Runtime"
  echo "Service account created: $SA_EMAIL"
else
  echo "Service account $SA_EMAIL already exists. Skipping creation."
fi

# 8. Grant Least-Privilege IAM Roles
echo "\n[7/7] Binding IAM roles to $SA_EMAIL..."
ROLES=(
  "roles/aiplatform.user"
  "roles/bigquery.dataViewer"
  "roles/bigquery.jobUser"
  "roles/storage.objectViewer"
)

for ROLE in "${ROLES[@]}"; do
  echo "  - Binding $ROLE..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --condition=None \
    --quiet
done

echo "\n========================================================================"
echo "Infrastructure Provisioning Complete!"
echo "Bucket:          gs://${BUCKET_NAME}"
echo "BigQuery:        ${PROJECT_ID}:auto_service"
echo "Service Account: ${SA_EMAIL}"
echo "========================================================================"
