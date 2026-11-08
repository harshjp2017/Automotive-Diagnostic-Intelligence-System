# Data Sources Terms of Use & Legal Compliance Audit

This document details the licensing, terms of service, fair access policies, and legal frameworks governing each data source utilized in the **Auto Service RAG** platform.

---

## 1. National Highway Traffic Safety Administration (NHTSA) Public APIs

* **Source Entities**: U.S. Department of Transportation (DOT) & National Highway Traffic Safety Administration (NHTSA)
* **Endpoints**: 
  - Recalls API: `https://api.nhtsa.gov/recalls`
  - Office of Defects Investigation (ODI) Complaints API: `https://api.nhtsa.gov/complaints/complaintsByVehicle`
  - Vehicle Product Information Catalog (vPIC): `https://vpic.nhtsa.dot.gov/api/`
* **Copyright & Legal Status**:
  - **U.S. Government Work**: Under **17 U.S.C. § 105**, works of the United States Government are not subject to copyright protection within the United States. All data, safety recalls, and defect complaint records published by NHTSA reside in the **public domain**.
  - **Open Data Policy**: Compliant with OMB Memorandum M-13-13 (*Open Data Policy—Managing Information as an Asset*) and the *Foundations for Evidence-Based Policymaking Act of 2018*.
* **Usage Conditions & Fair Access**:
  - **API Rate Limiting & Courtesy**: While public and requiring no proprietary API key for consumer recall endpoints, NHTSA asks automated clients to throttle requests to avoid denial-of-service impacts on government infrastructure (recommended politeness backoff: 200–500ms between calls).
  - **User-Agent Header**: Requests must include an identifiable `User-Agent` string identifying the application or research organization.
  - **Attribution & Disclaimer**: Commercial and non-commercial products using NHTSA data must state that the product is not endorsed, certified, or sponsored by NHTSA or the U.S. Department of Transportation.
  - **Integrity**: Data must not be altered in a manner that misrepresents safety recall status, campaign numbers, or official defect determinations.

---

## 2. SEC EDGAR Corporate Filings (Form 10-K & 20-F Financial Disclosures)

* **Source Entity**: U.S. Securities and Exchange Commission (SEC) Electronic Data Gathering, Analysis, and Retrieval (EDGAR) system.
* **Relevant Sections**:
  - Form 10-K / Form 20-F: *Note on Product Warranties and Accruals* (Note 14/15/23)
  - Balance Sheet & Income Statement: Accrued Warranty Reserves, Automotive Gross Margins, and R&D Spend.
* **Copyright & Legal Status**:
  - SEC filings submitted by public companies (Ford Motor Company, General Motors, Tesla Inc., Toyota Motor Corporation ADR, BMW Group ADR) are **public disclosure records** made pursuant to the Securities Exchange Act of 1934.
  - The text and financial tables contained within regulatory filings are not subject to copyright restrictions when extracted for analytical, research, or enterprise tooling purposes.
* **Fair Access & Operational Guidelines (SEC EDGAR Policy)**:
  - **User-Agent Requirement**: In accordance with SEC fair access policies, automated requests to `sec.gov/edgar` MUST declare a custom `User-Agent` containing the requester's name/organization and a valid contact email (e.g., `Sample Company AdminContact@<sample company domain>.com`). Generic library headers (such as `Python-urllib` or `curl`) are rejected with HTTP 403.
  - **Rate Limits**: SEC limits requests to a maximum of **10 requests per second**. Exceeding this rate will trigger automated IP-based rate limiting.
  - **Permissible Use**: Financial figures may be extracted, indexed, aggregated, and stored in enterprise data warehouses (Google BigQuery) for cost benchmarking and warranty analytics.

---

## 3. OEM Factory Workshop Manuals & Technical Service Bulletins (TSBs)

* **Source Entities**: Original Equipment Manufacturers (OEMs), including Ford Motor Company, Toyota Motor Corporation, Tesla Inc., General Motors, American Honda Motor Co., BMW AG, and synthetic prototype vehicle divisions (Harsh Patel Vision 2050).
* **Legal Frameworks & Right to Repair**:
  - **Clean Air Act § 202(m) & EPA Service Information Regulations (40 CFR Part 86)**: Enforces that automotive manufacturers must make emissions-related diagnostic, service, and repair information available to independent repair shops and toolmakers on reasonable terms.
  - **Motor Vehicle Owners' Right to Repair Act / Massachusetts Right to Repair Law**: Mandates open access to onboard telematics, scan tool interfaces, and diagnostic trouble code trees to ensure consumers and independent repair facilities can diagnose and repair modern vehicles.
  - **Magnuson-Moss Warranty Act (15 U.S.C. § 2302)**: Prohibits tie-in sales and warranty voiding when consumers or independent service centers utilize standard repair procedures and third-party parts complying with OEM specifications.
* **Fair Use & Transformative Enterprise RAG (17 U.S.C. § 107)**:
  - **Transformative Purpose**: The Auto Service RAG engine extracts technical facts—specifically SAE J2012 Diagnostic Trouble Codes (DTCs), fastener bolt torque values (Nm / ft-lb), circuit resistance/voltage specifications, and safety callouts.
  - **Factual Nature**: Purely technical specifications, torque values, and diagnostic pinout procedures are factual operational data. The system generates transformative diagnostic synthesis and safety triage reports, rather than reproducing copyrighted manual designs.
  - **Mechanic Workshop Use**: Technicians and fleet operators maintain subscriptions or authorized licenses to OEM service portals (e.g., Ford PTS, Toyota TIS, GM ACDelco TDS) and ingest their authorized workshop documentation for internal fleet maintenance.
* **Safety & Accuracy Disclaimer**:
  - All repair procedures, torque specifications, and high-voltage disconnect steps generated by the system must be verified by certified ASE (Automotive Service Excellence) technicians against official OEM workshop documentation prior to vehicle disassembly.

---

## Summary Matrix

| Data Source | Governing Body | License / Legal Status | Permitted Use | Key Restriction / Requirement |
|---|---|---|---|---|
| **NHTSA Recalls & Complaints** | U.S. DOT / NHTSA | Public Domain (17 U.S.C. § 105) | Full commercial & research use | Identify User-Agent; throttle API calls; no official endorsement claim |
| **SEC EDGAR 10-K Data** | U.S. SEC | Public Regulatory Disclosure | Financial & warranty analytics | User-Agent must include contact info; max 10 req/sec |
| **OEM Workshop Manuals & TSBs** | Vehicle OEMs | Right to Repair / 40 CFR 86 / Fair Use | Diagnostic triage & workshop repair | Transformative factual extraction; ASE certified verification |
