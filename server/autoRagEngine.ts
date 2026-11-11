import { GoogleGenAI } from '@google/genai';

/* =========================================================================================
 * CHUNKING STRATEGY 1: DOMAIN-AWARE SEMANTIC ENTITY CHUNKING (START)
 * =========================================================================================
 * WHAT DOES DOMAIN-AWARE SEMANTIC CHUNKING DO?
 * -----------------------------------------------------------------------------------------
 * Conventional RAG systems slice raw documents using naive "fixed-size token chunking"
 * (e.g. cutting text every 500 tokens). In mission-critical automotive repair, this fails:
 *   1. It slices fastener bolt torque tables in half, severing fastener names from their
 *      critical torque values (e.g. risking stripped aluminum cylinder head threads).
 *   2. It fractures SAE J2012 Diagnostic Trouble Code (DTC) symptoms from their pinpoint
 *      multimeter/oscilloscope test steps.
 *   3. It separates high-voltage battery disconnect safety warnings from repair procedures.
 *
 * DOMAIN-AWARE SEMANTIC CHUNKING solves this by chunking strictly along:
 *   - Official OEM Workshop Section Codes (e.g., WSM 303-07A, TSB 21-2119, USER-MANUAL-01).
 *   - Complete, self-contained functional repair procedures.
 *   - Explicit extraction and indexing of structured domain entities:
 *       • torqueSpecs: Fastener tightening specs with units (Nm / ft-lb / lb-in).
 *       • dtcCodes: Applicable SAE OBD-II trouble codes (e.g. P0300, B00A0).
 *       • yearRange: Generation model spans (e.g. 2018-2024).
 *       • system: Vehicle mechanical/electrical subsystem (e.g. Engine Powertrain, SRS).
 *
 * DETAILED AUTOMOTIVE EXAMPLE: Ford F-150 EcoBoost 3.5L (DTC P0300 Random Misfire)
 * -----------------------------------------------------------------------------------------
 * - Naive Token Chunking:
 *     Chunk A gets: "Diagnostic procedure for P0300 on 3.5L EcoBoost... check spark plug gap 0.030 in..."
 *     Chunk B gets: "...inspect intake valve carbon... Torque: Spark Plugs 15 Nm, Coils 10 Nm."
 *     Problem: When searching "spark plug gap", Chunk A is retrieved without the torque spec!
 * - Domain-Aware Semantic Entity Chunking (Below):
 *     Binds the entire procedure, 0.030" gap rule, VCT cam phaser bulletin (TSB 21-2119),
 *     fuel rail pressure checks, and the exact fastener torque table (15 Nm spark plugs,
 *     10 Nm coils) into a single atomic, queryable entity (`ServiceManualChunk`).
 * ========================================================================================= */

export interface ServiceManualChunk {
  id: string;
  vehicleMake: string;
  vehicleModel: string;
  yearRange: string;
  system: string; // e.g., 'Engine Powertrain', 'OBD-II Diagnostics', 'Fuel System', 'High Voltage Battery'
  title: string;
  sectionCode: string; // e.g., 'SEC 303-01A-04'
  content: string;
  torqueSpecs?: { [component: string]: string };
  dtcCodes?: string[];
  embedding?: number[];
}

export const INITIAL_MANUAL_CHUNKS: ServiceManualChunk[] = [
{
    "id": "pagani-p100-u0003",
    "vehicleMake": "Pagani",
    "vehicleModel": "P100",
    "yearRange": "2018-2026",
    "system": "High-Speed CAN Communication Bus & Gateway Network",
    "title": "u0003 Code - High-Speed CAN Communication Bus (+) KBB",
    "sectionCode": "WSM-CAN-U0003",
    "content": "DIAGNOSTIC & REPAIR PROCEDURE FOR DTC U0003 (HIGH-SPEED CAN COMMUNICATION BUS (+) HIGH/OPEN):\n1. DTC Condition & Architecture: DTC U0003 triggers when control modules on the High-Speed Controller Area Network (CAN-H) detect abnormal bus voltage (shorted to battery power B+ or open circuit) on the CAN High line (Pin 6 of the OBD-II Data Link Connector DLC).\n2. Diagnostic Equipment Required: Digital Multimeter (CAT III 600V), 2-channel Digital Storage Oscilloscope (DSO), Breakout Box (BOB), OEM-level bi-directional diagnostic scan tool.\n3. Visual & Wiring Harness Inspection:\n   - Inspect the twisted-pair wiring (CAN-H White/Red and CAN-L Brown) routed between the Central Gateway (CGW) module, Electronic Stability Program (ESP), Powertrain Control Module (PCM), and Transmission Control Module (TCM).\n   - Check for harness pinching against steering column or chassis brackets, water intrusion at cowl bulkhead drains, and backed-out pins at intermediate disconnects.\n4. Step 1 - Terminating Resistance Measurement:\n   - Switch ignition OFF, disconnect 12V negative battery cable, and wait 60 seconds for control module capacitors to discharge.\n   - Connect calibrated Digital Multimeter across DLC Pin 6 (CAN High) and Pin 14 (CAN Low).\n   - Specified Resistance: 60 Ω ± 4 Ω (indicating both 120 Ω terminating resistors in PCM and Central Gateway are in parallel).\n   - If reading is ~120 Ω: One of the 120 Ω terminating resistors or an open circuit in that bus branch exists.\n   - If reading is < 50 Ω or ~0 Ω: Short circuit between CAN-H and CAN-L lines or shorted transceiver silicon.\n5. Step 2 - Operating Voltage Baseline Test:\n   - Reconnect battery and switch ignition to ON (Engine OFF).\n   - Measure voltage between DLC Pin 6 (CAN-H) and chassis ground: Expected 2.5V to 3.5V dominant signal.\n   - Measure voltage between DLC Pin 14 (CAN-L) and chassis ground: Expected 1.5V to 2.5V dominant signal.\n   - If Pin 6 voltage is steady at ~12.0V - 14.0V: CAN High line is shorted to Battery B+ circuit.\n6. Step 3 - Module Isolation Protocol:\n   - If CAN-H is pulled high, disconnect electronic control units one by one in sequence (e.g. Steering Column Module, ABS/ESP Controller, Audio Gateway) while monitoring DLC Pin 6 voltage.\n   - When voltage drops back into the 2.5V-3.5V operational window, the last disconnected module contains an internally shorted CAN transceiver.\n7. Verification & Repair Reassembly:\n   - Repair damaged wiring using environmental heat-shrink solder splices maintaining tight wire twisting (min 1 twist per inch).\n   - Reconnect all control units, clear fault memories with OEM scan tool, and perform full CAN bus operational drive cycle.",
    "dtcCodes": [
      "U0003"
    ],
    "torqueSpecs": {
      "Central Gateway (CGW) Mounting Screws": "4.5 Nm (40 lb-in)",
      "DLC OBD-II Connector Bracket Bolts": "2.5 Nm (22 lb-in)",
      "Powertrain Module Connector Retaining Bolt": "6.0 Nm (53 lb-in)",
      "Chassis Main Ground Terminal (W10/4)": "9.0 Nm (80 lb-in)"
    }
  },
  {
    "id": "mercedes-c-class-w205",
    "vehicleMake": "Mercedes",
    "vehicleModel": "C-Class",
    "yearRange": "2019-2024",
    "system": "Electrical & CAN Bus Network",
    "title": "Mercedes C-Class W205 High-Speed Bus & Gateway Diagnostic Tree",
    "sectionCode": "OEM-W205-CAN",
    "content": "DIAGNOSTIC & REPAIR PROCEDURE FOR MERCEDES C-CLASS (W205) CAN BUS COMMUNICATION:\n1. Condition: Central Gateway (CGW) reports communication failure or intermittent loss of communication with powertrain or body control modules (DTC U0001 / U0003).\n2. Physical Inspection: Check front passenger footwell SAM (Signal Acquisition and Actuation Module) and harness junction X30/32 for moisture intrusion from sunroof or cowl drains.\n3. Terminating Resistance Test: Disconnect 12V battery. Measure resistance between Pin 6 (CAN-H) and Pin 14 (CAN-L) at Data Link Connector (DLC). Specified value: 60 Ω ± 4 Ω.\n4. Bus Operating Voltage Test: Reconnect battery, switch ignition ON. Verify CAN-H voltage is 2.5V-3.5V and CAN-L voltage is 1.5V-2.5V. If CAN-H is pegged at 12V, locate short to power in bulkhead connector.\n5. Control Module Isolation: Disconnect modules on CAN backbone one by one until normal 2.5V-3.5V dominant signal restores.",
    "dtcCodes": [
      "U0001",
      "U0003"
    ],
    "torqueSpecs": {
      "Central Gateway (CGW) Bracket Bolts": "4.5 Nm (40 lb-in)",
      "OBD-II DLC Port Retaining Screws": "2.0 Nm (18 lb-in)",
      "SAM Control Unit Fasteners": "3.5 Nm (31 lb-in)"
    }
  },
  {
    "id": "mercedes-s-class-u0003",
    "vehicleMake": "Mercedes",
    "vehicleModel": "S Class",
    "yearRange": "2018-2026",
    "system": "High-Speed CAN Communication Bus & Gateway Network",
    "title": "u0003 Code - High-Speed CAN Communication Bus (+) _ KBB",
    "sectionCode": "WSM-CAN-U0003",
    "content": "DIAGNOSTIC & REPAIR PROCEDURE FOR DTC U0003 (HIGH-SPEED CAN COMMUNICATION BUS (+) HIGH/OPEN):\n1. DTC Condition & Architecture: DTC U0003 triggers when control modules on the High-Speed Controller Area Network (CAN-H) detect abnormal bus voltage (shorted to battery power B+ or open circuit) on the CAN High line (Pin 6 of the OBD-II Data Link Connector DLC).\n2. Diagnostic Equipment Required: Digital Multimeter (CAT III 600V), 2-channel Digital Storage Oscilloscope (DSO), Breakout Box (BOB), OEM-level bi-directional diagnostic scan tool.\n3. Visual & Wiring Harness Inspection:\n   - Inspect the twisted-pair wiring (CAN-H White/Red and CAN-L Brown) routed between the Central Gateway (CGW) module, Electronic Stability Program (ESP), Powertrain Control Module (PCM), and Transmission Control Module (TCM).\n   - Check for harness pinching against steering column or chassis brackets, water intrusion at cowl bulkhead drains, and backed-out pins at intermediate disconnects.\n4. Step 1 - Terminating Resistance Measurement:\n   - Switch ignition OFF, disconnect 12V negative battery cable, and wait 60 seconds for control module capacitors to discharge.\n   - Connect calibrated Digital Multimeter across DLC Pin 6 (CAN High) and Pin 14 (CAN Low).\n   - Specified Resistance: 60 Ω ± 4 Ω (indicating both 120 Ω terminating resistors in PCM and Central Gateway are in parallel).\n   - If reading is ~120 Ω: One of the 120 Ω terminating resistors or an open circuit in that bus branch exists.\n   - If reading is < 50 Ω or ~0 Ω: Short circuit between CAN-H and CAN-L lines or shorted transceiver silicon.\n5. Step 2 - Operating Voltage Baseline Test:\n   - Reconnect battery and switch ignition to ON (Engine OFF).\n   - Measure voltage between DLC Pin 6 (CAN-H) and chassis ground: Expected 2.5V to 3.5V dominant signal.\n   - Measure voltage between DLC Pin 14 (CAN-L) and chassis ground: Expected 1.5V to 2.5V dominant signal.\n   - If Pin 6 voltage is steady at ~12.0V - 14.0V: CAN High line is shorted to Battery B+ circuit.\n6. Step 3 - Module Isolation Protocol:\n   - If CAN-H is pulled high, disconnect electronic control units one by one in sequence (e.g. Steering Column Module, ABS/ESP Controller, Audio Gateway) while monitoring DLC Pin 6 voltage.\n   - When voltage drops back into the 2.5V-3.5V operational window, the last disconnected module contains an internally shorted CAN transceiver.\n7. Verification & Repair Reassembly:\n   - Repair damaged wiring using environmental heat-shrink solder splices maintaining tight wire twisting (min 1 twist per inch).\n   - Reconnect all control units, clear fault memories with OEM scan tool, and perform full CAN bus operational drive cycle.",
    "dtcCodes": [
      "U0003"
    ],
    "torqueSpecs": {
      "Central Gateway (CGW) Mounting Screws": "4.5 Nm (40 lb-in)",
      "DLC OBD-II Connector Bracket Bolts": "2.5 Nm (22 lb-in)",
      "Powertrain Module Connector Retaining Bolt": "6.0 Nm (53 lb-in)",
      "Chassis Main Ground Terminal (W10/4)": "9.0 Nm (80 lb-in)"
    }
  },
  {
    "id": "ford-ecoboost-p0300",
    "vehicleMake": "Ford",
    "vehicleModel": "F-150 EcoBoost 3.5L",
    "yearRange": "2018-2024",
    "system": "Engine Powertrain",
    "title": "Ignition System & Random Misfire Diagnostic Procedure (DTC P0300 / P0302)",
    "sectionCode": "TSB 21-2119 / WSM 303-07A",
    "content": "DIAGNOSTIC PROCEDURE FOR RANDOM MISFIRE (P0300) ON 3.5L ECOBOOST V6:\n1. Verify spark plug electrode gap: Factory specification is strictly 0.030 in (0.76 mm). Over-gapped plugs caused by spark erosion under twin-turbo boost pressures exceeding 14 psi will blow out spark kernel, triggering intermittent high-load misfires.\n2. Direct-Injection Carbon Build-up: Inspect intake valves using borescope. Direct-injected engines lack port fuel washing; heavy carbon buildup on intake valve tulips causes air tumbling turbulence and cold-start misfire codes.\n3. VCT Camshaft Phasers (TSB 21-2119): Check for cold-start rattle lasting 2-5 seconds. Worn locking pins in intake camshaft phasers cause timing deviation and intermittent P0016/P0300.\n4. Fuel Rail Pressure Sensor (FRP): Verify low-pressure fuel pump delivery (55-65 psi) and high-pressure rail pressure (2,150 psi at idle, up to 2,900 psi under wide-open throttle).",
    "torqueSpecs": {
      "Spark Plugs": "15 Nm (133 lb-in)",
      "Ignition Coil Retaining Bolts": "10 Nm (89 lb-in)",
      "Intake Manifold Upper Bolts": "10 Nm (89 lb-in) in cross pattern",
      "High-Pressure Fuel Pump Mounting Bolts": "12 Nm + 45 degrees"
    },
    "dtcCodes": [
      "P0300",
      "P0301",
      "P0302",
      "P0303",
      "P0016"
    ]
  },
  {
    "id": "toyota-rav4-p0171",
    "vehicleMake": "Toyota",
    "vehicleModel": "RAV4 / Camry 2.5L Dynamic Force",
    "yearRange": "2019-2025",
    "system": "Air Intake & Fuel Delivery",
    "title": "DTC P0171: System Too Lean (Bank 1) Diagnostic Tree & Smoke Testing",
    "sectionCode": "RM-34J0U-ENG-082",
    "content": "DIAGNOSIS OF SYSTEM TOO LEAN (BANK 1 - DTC P0171) ON A25A-FKS 2.5L:\n1. Short Term & Long Term Fuel Trim (STFT + LTFT): Connect Techstream or OBD-II scanner. If combined fuel trim exceeds +35% at idle but drops to normal (< +10%) at 2,500 RPM, the root cause is an intake vacuum leak downstream of the Mass Air Flow (MAF) meter.\n2. Smoke Test Intake Plenum: Inject diagnostic smoke at 1.0 psi into the intake air duct. Inspect PCV valve vacuum hose junction, brake booster check valve grommet, and intake manifold gasket runner seals.\n3. Mass Air Flow Sensor Calibration: Clean hot-wire element with designated MAF cleaner. At warm idle with no loads, standard MAF flow rate should be 1.8 to 2.4 g/sec.\n4. High-Pressure Direct Injector Port Seals: Inspect Teflon combustion seals on cylinder 1-4 direct injectors. Deteriorated seal rings allow unmetered air draw during intake stroke.",
    "torqueSpecs": {
      "Intake Manifold to Cylinder Head": "21 Nm (15 ft-lb)",
      "Throttle Body Mounting Bolts": "10 Nm (89 lb-in)",
      "MAF Sensor Screws": "1.5 Nm (13 lb-in)",
      "PCV Valve Threaded Fitting": "27 Nm (20 ft-lb)"
    },
    "dtcCodes": [
      "P0171",
      "P0174",
      "P0101",
      "P0505"
    ]
  },
  {
    "id": "honda-civic-p0420",
    "vehicleMake": "Honda",
    "vehicleModel": "Civic / Accord 1.5L VTEC Turbo",
    "yearRange": "2017-2024",
    "system": "Exhaust & Emissions Control",
    "title": "DTC P0420: Catalytic Converter System Efficiency Below Threshold",
    "sectionCode": "HON-SM-160-CAT-03",
    "content": "DIAGNOSTIC VERIFICATION FOR CATALYTIC CONVERTER EFFICIENCY (DTC P0420):\n1. Pre-Catalyst vs Post-Catalyst O2 Sensor Waveform Analysis:\n   - Primary Air-Fuel Ratio (A/F) Sensor should fluctuate between 0.65V and 0.85V responding to closed-loop stoichiometry.\n   - Secondary Heated Oxygen Sensor (HO2S Bank 1 Sensor 2) MUST maintain a steady line around 0.60V to 0.75V if catalytic washcoat is actively storing oxygen.\n   - If secondary sensor mirrors primary sensor switching frequency (ratio > 0.7), catalytic converter substrate is degraded or thermally glazed.\n2. Exhaust Leak Inspection: Check flex pipe flange and turbocharger downpipe gasket. Cold air induction into exhaust upstream of secondary sensor falsely dilutes gas mixture, causing false P0420 trigger.\n3. Fuel Dilution Check: 1.5L Turbo engines subject to short trips can suffer oil dilution by gasoline, which poisons catalyst washcoat over extended intervals.",
    "torqueSpecs": {
      "Downpipe to Turbocharger Flange Nuts": "38 Nm (28 ft-lb)",
      "Primary Air-Fuel Ratio Sensor": "44 Nm (32 ft-lb)",
      "Secondary Oxygen Sensor": "44 Nm (32 ft-lb)",
      "Exhaust Heat Shield Fasteners": "9.8 Nm (87 lb-in)"
    },
    "dtcCodes": [
      "P0420",
      "P0137",
      "P0138",
      "P0141"
    ]
  },
  {
    "id": "bmw-b58-p112f",
    "vehicleMake": "BMW",
    "vehicleModel": "340i / 540i B58 3.0L Turbo",
    "yearRange": "2016-2024",
    "system": "Cooling & Engine Thermal Management",
    "title": "DTC P112F / 20A704: Electric Coolant Pump RPM Deviation & Bleed Protocol",
    "sectionCode": "REP-BMW-B58-1151",
    "content": "DIAGNOSTIC & REPLACEMENT PROCEDURE FOR B58 THERMAL COOLING MODULE:\n1. Electric Water Pump (EWP) Failure Modes: Codes 20A704 / P112F indicate internal rotor drag, motor stator temperature overload, or LIN-bus communication dropout.\n2. Visual Inspection: Inspect Oil Filter Housing (OFH) and heat exchanger assembly for micro-fractures in plastic casing leaking ethylene glycol onto serpentine belt.\n3. MANDATORY ELECTRONIC COOLANT BLEEDING PROCEDURE:\n   a. Connect battery tender (minimum 30A clean supply).\n   b. Turn ignition ON (engine OFF).\n   c. Set cabin climate control to MAXIMUM temperature (84°F / 28°C) and LOWEST fan speed.\n   d. Hold accelerator pedal fully to floor for 10 seconds.\n   e. Electric water pump will activate automated 12-minute pulse bleed cycle. Keep reservoir cap on loosely to vent displaced air pockets.",
    "torqueSpecs": {
      "Electric Coolant Pump Bolts (Aluminum - Replace Every Time)": "8 Nm + 90 degrees",
      "Thermostat Housing Bolts": "10 Nm (89 lb-in)",
      "Oil Filter Housing to Engine Block": "12 Nm (106 lb-in)"
    },
    "dtcCodes": [
      "P112F",
      "P0128",
      "20A704",
      "1D2008"
    ]
  },
  {
    "id": "tesla-model3-hv-isolation",
    "vehicleMake": "Tesla",
    "vehicleModel": "Model 3 / Model Y AWD",
    "yearRange": "2018-2025",
    "system": "High Voltage Powertrain & Battery",
    "title": "BMS_a064 & BMS_a066: High Voltage Isolation Loss Fault Isolation",
    "sectionCode": "TN-ELEC-HV-042",
    "content": "SAFETY DIRECTIVE: 400V HIGH VOLTAGE SYSTEM - CERTIFIED TECHNICIANS ONLY.\nPPE REQUIRED: Class 0 (1000V rated) insulating gloves inspected within 6 months, arc-flash face shield.\n1. Isolation Resistance Threshold: Vehicle requires minimum 500 kOhm (0.5 MOhm) isolation resistance between HV positive/negative bus and chassis ground. Codes BMS_a064 / BMS_a066 trigger when isolation drops below 190 kOhm.\n2. First Responder / Service Manual First Disconnect: Remove rear seat bottom, disconnect Low Voltage 12V/16V battery negative terminal, then cut First Responder Loop / disconnect High Voltage Pyro Fuse disconnect harness. Wait 5 minutes for bus capacitor bleeding below 50V DC.\n3. Component Isolation Elimination: Disconnect A/C Compressor, Cabin PTC Heater, Front Drive Inverter, and Rear Drive Inverter sequentially with mega-ohmmeter to isolate source of chassis leakage.",
    "torqueSpecs": {
      "Pyro-Fuse Manual Disconnect Nut": "9 Nm (80 lb-in)",
      "HV Penthouse Enclosure Bolts": "8 Nm (71 lb-in)",
      "HV Battery Pack Rail Bolts": "62 Nm (46 ft-lb)"
    },
    "dtcCodes": [
      "BMS_a064",
      "BMS_a066",
      "DI_u014",
      "THC_w012"
    ]
  },
  {
    "id": "chevy-silverado-p050d",
    "vehicleMake": "Chevrolet",
    "vehicleModel": "Silverado / Tahoe 5.3L / 6.2L EcoTec3",
    "yearRange": "2015-2024",
    "system": "Valve Train & Active Fuel Management",
    "title": "DTC P050D / P0300: Cold Start Rough Idle & AFM/DFM Lifter Collapse Diagnostic",
    "sectionCode": "GM TSB 21-NA-199 / PIP5553",
    "content": "DIAGNOSTIC PROTOCOL FOR AFM/DFM COLLAPSED LIFTER & MISFIRE (P050D):\n1. Symptoms: Distinct metallic ticking cadence from valve cover synchronized with engine RPM, accompanied by cylinder misfire under light-throttle cylinder deactivation transition.\n2. Compression & Cylinder Leakdown Test: Perform running compression test. A collapsed AFM deactivating lifter will fail to open the intake or exhaust valve fully, yielding low dynamic compression (< 90 psi) while static cranking compression appears marginal.\n3. VLOM (Valve Lifter Oil Manifold) Inspection: Check oil pressure screen beneath oil pressure sensor at rear of engine block. Particulate debris blocking oil passages starves lifter locking pins of hydraulic pressure, causing premature pin release and lifter collapse.",
    "torqueSpecs": {
      "Cylinder Head Bolts (TTY - New Bolts Required)": "Pass 1: 40 Nm, Pass 2: 90 deg, Pass 3: 90 deg",
      "Rocker Arm Trunnion Bolts": "30 Nm (22 ft-lb)",
      "VLOM Manifold Bolts": "12 Nm (106 lb-in)",
      "Valve Cover Perimeter Bolts": "10 Nm (89 lb-in)"
    },
    "dtcCodes": [
      "P050D",
      "P0300",
      "P0301",
      "P0307"
    ]
  },
];

export const activeManualChunks: ServiceManualChunk[] = [...INITIAL_MANUAL_CHUNKS];

/* =========================================================================================
 * CHUNKING STRATEGY 1: DOMAIN-AWARE SEMANTIC ENTITY CHUNKING (END)
 * ========================================================================================= */

// Cosine similarity computation between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Generate embedding using gemini-embedding-2-preview
export async function generateEmbedding(ai: GoogleGenAI, text: string): Promise<number[]> {
  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: text,
    });
    const values = result.embeddings?.[0]?.values || (result as any).embedding?.values;
    if (values && Array.isArray(values)) {
      return values;
    }
    return [];
  } catch (err) {
    console.warn('Embedding generation warning, using fallback term-frequency vector', err);
    return [];
  }
}

// Keyword-based score fallback if embedding API is throttled or offline
export function lexicalScore(query: string, chunk: ServiceManualChunk): number {
  const qTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const text = `${chunk.title} ${chunk.vehicleMake} ${chunk.vehicleModel} ${chunk.system} ${chunk.content} ${(chunk.dtcCodes || []).join(' ')}`.toLowerCase();
  let hits = 0;
  for (const term of qTerms) {
    if (text.includes(term)) hits += 1;
  }
  return qTerms.length > 0 ? hits / qTerms.length : 0;
}
