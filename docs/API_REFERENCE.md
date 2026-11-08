# Auto Service RAG - API Reference

Base URL (Local): `http://localhost:8080`  
Base URL (Cloud Run): `https://auto-service-rag-api-<hash>-uc.a.run.app`

---

### 1. Health Probe
**`GET /health`**

Returns service health, project ID, active Gemini model, and count of indexed manuals.

**Response:**
```json
{
  "status": "healthy",
  "service": "auto-service-rag-api",
  "project_id": "auto-service-rag",
  "location": "us-central1",
  "model": "gemini-3.8-flash",
  "indexed_manuals": 2
}
```

---

### 2. Execute Diagnostic RAG Query
**`POST /v1/query`**

Performs hybrid retrieval against indexed workshop manuals and synthesizes an ASE Master Certified diagnostic plan with Gemini 3.8 Flash.

**Request Body:**
```json
{
  "vehicle_make": "Ford",
  "vehicle_model": "F-150 EcoBoost 3.5L",
  "vehicle_year": "2021",
  "engine": "3.5L Twin Turbo",
  "dtc_code": "P0300",
  "symptoms": "Intermittent engine shudder under highway acceleration",
  "inquiry": "Provide full diagnostic verification tree, testing steps, and factory torque specs.",
  "top_k": 3
}
```

**Response Body:**
```json
{
  "diagnosis": "ROOT CAUSE ANALYSIS & DIAGNOSTIC TREE (DTC P0300 - FORD 3.5L ECOBOOST)...",
  "torque_specs": {
    "Spark Plugs": "15 Nm (133 lb-in)",
    "Ignition Coil Retaining Bolts": "10 Nm (89 lb-in)",
    "Intake Manifold Upper Bolts": "10 Nm (89 lb-in)",
    "High-Pressure Fuel Pump Mounting Bolts": "12 Nm + 45 deg"
  },
  "sources_cited": [
    "TSB 21-2119 / WSM 303-07A: Ignition System & Random Misfire Diagnostic Procedure"
  ],
  "retrieved_chunks_count": 1,
  "elapsed_ms": 1420,
  "model": "gemini-3.8-flash"
}
```

---

### 3. List Indexed Workshop Manuals
**`GET /v1/manuals`**

Returns summary metadata of all indexed service manual sections.

---

### 4. Ingest Manual Chunk
**`POST /v1/ingest`**

Dynamically indexes a custom OEM technical service bulletin or workshop manual excerpt.

**Request Body:**
```json
{
  "vehicle_make": "BMW",
  "vehicle_model": "340i B58",
  "year_range": "2016-2024",
  "system": "Cooling",
  "title": "Electric Water Pump Bleed Procedure",
  "section_code": "REP-BMW-B58-1151",
  "content": "Turn ignition on, set climate to 84F, hold throttle 10 seconds...",
  "dtc_codes": ["P112F"],
  "torque_specs": {
    "Coolant Pump Fasteners": "9 Nm"
  }
}
```

---

### 5. Fastener Torque Unit Converter
**`POST /v1/torque/convert`**

Parses and converts torque specifications between metric and imperial units.

**Request Body:**
```json
{
  "torque_string": "15 Nm (133 lb-in)"
}
```

**Response Body:**
```json
{
  "raw": "15 Nm (133 lb-in)",
  "nm": 15.0,
  "ft_lb": 11.1,
  "in_lb": 133.0,
  "angle_degrees": null,
  "is_torque_to_yield": false
}
```
