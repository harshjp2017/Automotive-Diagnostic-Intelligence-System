terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  description = "The Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Primary GCP compute region"
  type        = string
  default     = "us-central1"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Enable Core APIs
resource "google_project_service" "services" {
  for_each = toset([
    "aiplatform.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# 2. Cloud Storage Bucket for Manuals
resource "google_storage_bucket" "manuals" {
  name                        = "${var.project_id}-manuals"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.services]
}

# 3. BigQuery Dataset
resource "google_bigquery_dataset" "auto_service" {
  dataset_id  = "auto_service"
  description = "Auto Service RAG dataset for factory manuals and embeddings"
  location    = "US"

  depends_on = [google_project_service.services]
}

# 4. Runtime Service Account
resource "google_service_account" "api_runtime" {
  account_id   = "api-runtime"
  display_name = "Auto Service RAG API Runtime Service Account"
}

# 5. Least Privilege IAM Roles
resource "google_project_iam_member" "sa_roles" {
  for_each = toset([
    "roles/aiplatform.user",
    "roles/bigquery.dataViewer",
    "roles/bigquery.jobUser",
    "roles/storage.objectViewer",
  ])
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.api_runtime.email}"
}

# 6. Artifact Registry Repository
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "auto-service-rag"
  description   = "Docker images for Auto Service RAG API"
  format        = "DOCKER"

  depends_on = [google_project_service.services]
}

# Outputs
output "gcs_bucket_url" {
  value = google_storage_bucket.manuals.url
}

output "bigquery_dataset_id" {
  value = google_bigquery_dataset.auto_service.dataset_id
}

output "service_account_email" {
  value = google_service_account.api_runtime.email
}
