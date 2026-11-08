-- ==============================================================================
-- Auto Service RAG - BigQuery DDL Schema
-- Dataset: auto_service
-- Location: US
-- ==============================================================================

-- 1. Workshop Manual Chunks Table
CREATE TABLE IF NOT EXISTS `auto_service.manual_chunks` (
  chunk_id STRING NOT NULL OPTIONS(description="Unique identifier for the manual chunk"),
  vehicle_make STRING NOT NULL OPTIONS(description="OEM Manufacturer (e.g., Ford, Toyota, Tesla, BMW)"),
  vehicle_model STRING NOT NULL OPTIONS(description="Model designation and powertrain (e.g., F-150 EcoBoost 3.5L)"),
  year_range STRING NOT NULL OPTIONS(description="Applicable model years (e.g., 2018-2024)"),
  system STRING NOT NULL OPTIONS(description="Vehicle sub-system (e.g., Engine Powertrain, High Voltage Battery)"),
  title STRING NOT NULL OPTIONS(description="Document or TSB section title"),
  section_code STRING NOT NULL OPTIONS(description="OEM Section or TSB code (e.g., WSM 303-07A)"),
  content STRING NOT NULL OPTIONS(description="Full diagnostic text and technical procedures"),
  dtc_codes ARRAY<STRING> OPTIONS(description="List of SAE J2012 diagnostic trouble codes referenced"),
  torque_specs JSON OPTIONS(description="Key-value mapping of component fastener torque specifications"),
  safety_warnings ARRAY<STRING> OPTIONS(description="Safety-critical notices (High Voltage, High Pressure Fuel)"),
  embedding ARRAY<FLOAT64> OPTIONS(description="768-dimensional text-embedding-004 vector representation"),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
CLUSTER BY vehicle_make, system;

-- 2. Diagnostic Query Audit Logs Table
CREATE TABLE IF NOT EXISTS `auto_service.query_audit_logs` (
  log_id STRING NOT NULL,
  user_email STRING,
  vehicle_make STRING,
  vehicle_model STRING,
  vehicle_year STRING,
  dtc_code STRING,
  symptoms STRING,
  mechanic_inquiry STRING,
  retrieved_chunk_ids ARRAY<STRING>,
  diagnosis_summary STRING,
  latency_ms INT64,
  model_used STRING,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(timestamp)
CLUSTER BY vehicle_make, dtc_code;

-- 3. NHTSA Safety Recalls Table (Public NHTSA API Ingestion)
CREATE TABLE IF NOT EXISTS `auto_service.nhtsa_recalls` (
  recall_id STRING NOT NULL OPTIONS(description="Unique recall ID or Artemis ID"),
  nhtsa_campaign_number STRING NOT NULL OPTIONS(description="Official NHTSA Campaign Number (e.g., 21V770000)"),
  vehicle_make STRING NOT NULL OPTIONS(description="Vehicle manufacturer"),
  vehicle_model STRING NOT NULL OPTIONS(description="Vehicle model"),
  model_year INT64 NOT NULL OPTIONS(description="Model year of affected vehicles"),
  component STRING OPTIONS(description="Vehicle system or component impacted (e.g., AIR BAGS, ELECTRICAL SYSTEM)"),
  summary STRING OPTIONS(description="Detailed description of the safety defect"),
  consequence STRING OPTIONS(description="Consequence of the defect (e.g., risk of fire, crash, or injury)"),
  corrective_action STRING OPTIONS(description="Manufacturer remedy (e.g., software update, part replacement)"),
  potential_units_affected INT64 OPTIONS(description="Number of potentially affected vehicles"),
  recall_date DATE OPTIONS(description="Date the recall was officially published by NHTSA"),
  source_api STRING DEFAULT "https://api.nhtsa.gov/recalls",
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(ingested_at)
CLUSTER BY vehicle_make, vehicle_model;

-- 4. NHTSA Consumer Complaints Table (Public NHTSA ODI Ingestion)
CREATE TABLE IF NOT EXISTS `auto_service.nhtsa_complaints` (
  odi_number INT64 NOT NULL OPTIONS(description="Office of Defects Investigation (ODI) unique complaint ID"),
  vehicle_make STRING NOT NULL,
  vehicle_model STRING NOT NULL,
  model_year INT64 NOT NULL,
  components STRING OPTIONS(description="Component categories reported by consumer"),
  summary STRING OPTIONS(description="Consumer reported narrative and symptoms"),
  crash BOOLEAN OPTIONS(description="Whether a crash occurred as a result of the failure"),
  fire BOOLEAN OPTIONS(description="Whether a fire occurred"),
  number_of_injuries INT64 OPTIONS(description="Reported injuries count"),
  number_of_deaths INT64 OPTIONS(description="Reported fatalities count"),
  date_of_incident STRING OPTIONS(description="Reported date of the incident"),
  date_complaint_filed STRING OPTIONS(description="Date filed with NHTSA"),
  vin_prefix STRING OPTIONS(description="11-character masked VIN prefix"),
  source_api STRING DEFAULT "https://api.nhtsa.gov/complaints",
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(ingested_at)
CLUSTER BY vehicle_make, components;

-- 5. OEM Financial & Warranty Metrics Table (SEC EDGAR 10-K Data)
CREATE TABLE IF NOT EXISTS `auto_service.oem_financial_metrics` (
  oem_ticker STRING NOT NULL OPTIONS(description="Stock ticker symbol (e.g., F, GM, TM, TSLA, BMWYY)"),
  oem_name STRING NOT NULL OPTIONS(description="Manufacturer legal corporate entity"),
  fiscal_year INT64 NOT NULL OPTIONS(description="Fiscal reporting year"),
  total_revenue_usd_billion FLOAT64 NOT NULL OPTIONS(description="Total annual automotive revenue in USD billions"),
  net_income_usd_billion FLOAT64 NOT NULL OPTIONS(description="Annual GAAP net income in USD billions"),
  warranty_accrual_expense_usd_million FLOAT64 NOT NULL OPTIONS(description="Accrued warranty expense from Note 14/15 in USD millions"),
  warranty_claims_paid_usd_million FLOAT64 NOT NULL OPTIONS(description="Actual cash warranty claims paid out to dealers in USD millions"),
  warranty_as_pct_of_revenue FLOAT64 NOT NULL OPTIONS(description="Warranty claims paid as percentage of automotive revenue"),
  rd_expense_usd_billion FLOAT64 OPTIONS(description="Annual Research & Development spend in USD billions"),
  primary_recall_impact_notes STRING OPTIONS(description="Major technical recalls or TSB campaigns impacting warranty accruals"),
  source_sec_form STRING DEFAULT "Form 10-K / 20-F Note on Product Warranties",
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2018, 2030, 1))
CLUSTER BY oem_ticker;

