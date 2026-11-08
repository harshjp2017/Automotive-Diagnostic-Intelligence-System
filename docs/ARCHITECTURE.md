# Auto Service RAG - Architecture & System Design

## 1. System Overview
Auto Service RAG is a production retrieval-augmented generation platform purpose-built for automotive service workshops, master technicians, and fleet maintenance engineers. It ingests OEM factory service manuals, Technical Service Bulletins (TSBs), and diagnostic trees, indexes them with BigQuery and Vertex AI embeddings (`text-embedding-004`), and produces grounded diagnostic repair procedures using **Gemini 3.8 Flash**.

```
+---------------------------------------------------------------------------------+
|                               INGESTION PIPELINE                                |
|                                                                                 |
|  [OEM Service Manuals] -> [PDF Parser] -> [Domain Chunker]                     |
|  (PDFs, TSBs, WSMs)                      - Extracts DTC Codes                   |
|                                          - Extracts Torque Specs                |
|                                          - Preserves Safety Warnings            |
|                                                     |                           |
|                                                     v                           |
|  [Google Cloud Storage]               [Vertex AI text-embedding-004]            |
|  gs://PROJECT_ID-manuals                            |                           |
|                                                     v                           |
|                                       [BigQuery Vector Database]                |
|                                       Dataset: auto_service.manual_chunks       |
+---------------------------------------------------------------------------------+
                                       |
                                       v
+---------------------------------------------------------------------------------+
|                               RETRIEVAL & SERVING                               |
|                                                                                 |
|  [Mechanic Diagnostic Query]                                                    |
|  (Make, Model, DTC, Symptoms)                                                   |
|                |                                                                |
|                v                                                                |
|  [Hybrid Retriever] -------------------> [Diagnostic Re-Ranker]                |
|  - Cosine Vector Similarity (60%)        - Exact DTC match boost (+3.0)         |
|  - BM25 Lexical Keyword Score (40%)      - Torque spec completeness (+1.0)      |
|  - Exact DTC Fault Code Boost (+5.0)     - Safety alert priority (+0.8)         |
|  - Make/Model Alignment (+2.0)                          |                       |
|                                                         v                       |
|                                          [Grounded Context Synthesis]           |
|                                          - Verbatim Torque Spec Table           |
|                                          - Highlighted Safety Hazards           |
|                                                         |                       |
|                                                         v                       |
|                                          [Gemini 3.8 Flash Inference]           |
|                                          Model: gemini-3.8-flash                |
|                                          System: ASE Master Certified Specialist|
|                                                         |                       |
|                                                         v                       |
|  [Cloud Run REST API] <----------------- [Authoritative Diagnostic Plan]        |
|  Port 8080 (FastAPI)                     - Root Cause Analysis                  |
|                                          - Step-by-Step Testing Protocol        |
|                                          - Section Code Citations               |
|                                          - Bolt Torque Specs Verbatim           |
+---------------------------------------------------------------------------------+
```

## 2. Core Modules
- **`ingest/`**: Ingestion, OCR parsing, domain chunking, and embedding generation.
- **`retrieval/`**: Hybrid vector + lexical search, DTC code boosting, and torque spec parsing.
- **`api/`**: FastAPI REST service with endpoints for queries, manual listing, and live ingestion.
- **`evals/`**: Quantitative evaluation suite measuring keyword coverage, citation fidelity, and torque accuracy.
- **`infra/`**: Automated bash scripts, BigQuery DDL schema, and Terraform IaC configuration.
- **`docs/`**: Comprehensive guides, architecture documentation, and API references.

## 3. Security & Least Privilege Model
The API runs on Google Cloud Run under a dedicated service account `api-runtime@$PROJECT_ID.iam.gserviceaccount.com` granted strictly:
1. `roles/aiplatform.user` (Vertex AI prediction and embedding generation)
2. `roles/bigquery.dataViewer` (Read access to manual chunks)
3. `roles/bigquery.jobUser` (Execute query jobs in BigQuery)
4. `roles/storage.objectViewer` (Read access to workshop manual PDFs in Cloud Storage)
