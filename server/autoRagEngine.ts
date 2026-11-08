import { GoogleGenAI } from '@google/genai';

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
    id: 'user-manual-01-b00a0',
    vehicleMake: 'Harsh Patel',
    vehicleModel: 'vision 2050',
    yearRange: '2021',
    system: 'Body Electronics & Safety (SRS/OCS)',
    title: 'B00A0-Occupant Classification System (OCS) Sensor Fault',
    sectionCode: 'USER-MANUAL-01',
    content: `DIAGNOSTIC & REPAIR PROCEDURE FOR DTC B00A0 (OCCUPANT CLASSIFICATION SYSTEM SENSOR):
1. Diagnostic Verification: DTC B00A0 sets when the Supplemental Restraint System (SRS) or Occupant Classification System (OCS) electronic control module detects an out-of-range signal, harness discontinuity, or calibration mismatch from the passenger seat weight sensing mat.
2. Visual & Harness Inspection: Check the multi-pin yellow SRS harness and connectors beneath the passenger seat assembly for pin fretting, terminal spread, or pinching caused by seat adjustment tracks.
3. Resistance and Reference Voltage: Verify 5.0V reference supply from the OCS module to the strain-gauge sensor. Sensor resistance should read between 2.2k and 4.7k ohms under zero-weight calibration state.
4. Zero-Point Calibration: Following seat cushion or sensor replacement, perform zero-point mass calibration using OEM scan tool with the seat completely empty and vehicle parked on a level surface.
5. Safety Warning: Always disconnect 12V low-voltage battery and wait 90 seconds to allow the SRS backup capacitor to discharge completely before disconnecting any yellow SRS/OCS wiring harnesses.`,
    torqueSpecs: {
      'Passenger Seat Mounting Bolts to Floorpan': '48 Nm (35 ft-lb)',
      'OCS Module Bracket Fasteners': '9 Nm (80 lb-in)',
      'Seat Belt Buckle Anchor Bolt': '40 Nm (30 ft-lb)',
    },
    dtcCodes: ['B00A0', 'B00A1', 'B0001', 'B0010'],
  },
  {
    id: 'ford-ecoboost-p0300',
    vehicleMake: 'Ford',
    vehicleModel: 'F-150 EcoBoost 3.5L',
    yearRange: '2018-2024',
    system: 'Engine Powertrain',
    title: 'Ignition System & Random Misfire Diagnostic Procedure (DTC P0300 / P0302)',
    sectionCode: 'TSB 21-2119 / WSM 303-07A',
    content: `DIAGNOSTIC PROCEDURE FOR RANDOM MISFIRE (P0300) ON 3.5L ECOBOOST V6:
1. Verify spark plug electrode gap: Factory specification is strictly 0.030 in (0.76 mm). Over-gapped plugs caused by spark erosion under twin-turbo boost pressures exceeding 14 psi will blow out spark kernel, triggering intermittent high-load misfires.
2. Direct-Injection Carbon Build-up: Inspect intake valves using borescope. Direct-injected engines lack port fuel washing; heavy carbon buildup on intake valve tulips causes air tumbling turbulence and cold-start misfire codes.
3. VCT Camshaft Phasers (TSB 21-2119): Check for cold-start rattle lasting 2-5 seconds. Worn locking pins in intake camshaft phasers cause timing deviation and intermittent P0016/P0300.
4. Fuel Rail Pressure Sensor (FRP): Verify low-pressure fuel pump delivery (55-65 psi) and high-pressure rail pressure (2,150 psi at idle, up to 2,900 psi under wide-open throttle).`,
    torqueSpecs: {
      'Spark Plugs': '15 Nm (133 lb-in)',
      'Ignition Coil Retaining Bolts': '10 Nm (89 lb-in)',
      'Intake Manifold Upper Bolts': '10 Nm (89 lb-in) in cross pattern',
      'High-Pressure Fuel Pump Mounting Bolts': '12 Nm + 45 degrees',
    },
    dtcCodes: ['P0300', 'P0301', 'P0302', 'P0303', 'P0016'],
  },
  {
    id: 'toyota-rav4-p0171',
    vehicleMake: 'Toyota',
    vehicleModel: 'RAV4 / Camry 2.5L Dynamic Force',
    yearRange: '2019-2025',
    system: 'Air Intake & Fuel Delivery',
    title: 'DTC P0171: System Too Lean (Bank 1) Diagnostic Tree & Smoke Testing',
    sectionCode: 'RM-34J0U-ENG-082',
    content: `DIAGNOSIS OF SYSTEM TOO LEAN (BANK 1 - DTC P0171) ON A25A-FKS 2.5L:
1. Short Term & Long Term Fuel Trim (STFT + LTFT): Connect Techstream or OBD-II scanner. If combined fuel trim exceeds +35% at idle but drops to normal (< +10%) at 2,500 RPM, the root cause is an intake vacuum leak downstream of the Mass Air Flow (MAF) meter.
2. Smoke Test Intake Plenum: Inject diagnostic smoke at 1.0 psi into the intake air duct. Inspect PCV valve vacuum hose junction, brake booster check valve grommet, and intake manifold gasket runner seals.
3. Mass Air Flow Sensor Calibration: Clean hot-wire element with designated MAF cleaner. At warm idle with no loads, standard MAF flow rate should be 1.8 to 2.4 g/sec.
4. High-Pressure Direct Injector Port Seals: Inspect Teflon combustion seals on cylinder 1-4 direct injectors. Deteriorated seal rings allow unmetered air draw during intake stroke.`,
    torqueSpecs: {
      'Intake Manifold to Cylinder Head': '21 Nm (15 ft-lb)',
      'Throttle Body Mounting Bolts': '10 Nm (89 lb-in)',
      'MAF Sensor Screws': '1.5 Nm (13 lb-in)',
      'PCV Valve Threaded Fitting': '27 Nm (20 ft-lb)',
    },
    dtcCodes: ['P0171', 'P0174', 'P0101', 'P0505'],
  },
  {
    id: 'honda-civic-p0420',
    vehicleMake: 'Honda',
    vehicleModel: 'Civic / Accord 1.5L VTEC Turbo',
    yearRange: '2017-2024',
    system: 'Exhaust & Emissions Control',
    title: 'DTC P0420: Catalytic Converter System Efficiency Below Threshold',
    sectionCode: 'HON-SM-160-CAT-03',
    content: `DIAGNOSTIC VERIFICATION FOR CATALYTIC CONVERTER EFFICIENCY (DTC P0420):
1. Pre-Catalyst vs Post-Catalyst O2 Sensor Waveform Analysis:
   - Primary Air-Fuel Ratio (A/F) Sensor should fluctuate between 0.65V and 0.85V responding to closed-loop stoichiometry.
   - Secondary Heated Oxygen Sensor (HO2S Bank 1 Sensor 2) MUST maintain a steady line around 0.60V to 0.75V if catalytic washcoat is actively storing oxygen.
   - If secondary sensor mirrors primary sensor switching frequency (ratio > 0.7), catalytic converter substrate is degraded or thermally glazed.
2. Exhaust Leak Inspection: Check flex pipe flange and turbocharger downpipe gasket. Cold air induction into exhaust upstream of secondary sensor falsely dilutes gas mixture, causing false P0420 trigger.
3. Fuel Dilution Check: 1.5L Turbo engines subject to short trips can suffer oil dilution by gasoline, which poisons catalyst washcoat over extended intervals.`,
    torqueSpecs: {
      'Downpipe to Turbocharger Flange Nuts': '38 Nm (28 ft-lb)',
      'Primary Air-Fuel Ratio Sensor': '44 Nm (32 ft-lb)',
      'Secondary Oxygen Sensor': '44 Nm (32 ft-lb)',
      'Exhaust Heat Shield Fasteners': '9.8 Nm (87 lb-in)',
    },
    dtcCodes: ['P0420', 'P0137', 'P0138', 'P0141'],
  },
  {
    id: 'bmw-b58-p112f',
    vehicleMake: 'BMW',
    vehicleModel: '340i / 540i B58 3.0L Turbo',
    yearRange: '2016-2024',
    system: 'Cooling & Engine Thermal Management',
    title: 'DTC P112F / 20A704: Electric Coolant Pump RPM Deviation & Bleed Protocol',
    sectionCode: 'REP-BMW-B58-1151',
    content: `DIAGNOSTIC & REPLACEMENT PROCEDURE FOR B58 THERMAL COOLING MODULE:
1. Electric Water Pump (EWP) Failure Modes: Codes 20A704 / P112F indicate internal rotor drag, motor stator temperature overload, or LIN-bus communication dropout.
2. Visual Inspection: Inspect Oil Filter Housing (OFH) and heat exchanger assembly for micro-fractures in plastic casing leaking ethylene glycol onto serpentine belt.
3. MANDATORY ELECTRONIC COOLANT BLEEDING PROCEDURE:
   a. Connect battery tender (minimum 30A clean supply).
   b. Turn ignition ON (engine OFF).
   c. Set cabin climate control to MAXIMUM temperature (84°F / 28°C) and LOWEST fan speed.
   d. Hold accelerator pedal fully to floor for 10 seconds.
   e. Electric water pump will activate automated 12-minute pulse bleed cycle. Keep reservoir cap on loosely to vent displaced air pockets.`,
    torqueSpecs: {
      'Electric Coolant Pump Bolts (Aluminum - Replace Every Time)': '8 Nm + 90 degrees',
      'Thermostat Housing Bolts': '10 Nm (89 lb-in)',
      'Oil Filter Housing to Engine Block': '12 Nm (106 lb-in)',
    },
    dtcCodes: ['P112F', 'P0128', '20A704', '1D2008'],
  },
  {
    id: 'tesla-model3-hv-isolation',
    vehicleMake: 'Tesla',
    vehicleModel: 'Model 3 / Model Y AWD',
    yearRange: '2018-2025',
    system: 'High Voltage Powertrain & Battery',
    title: 'BMS_a064 & BMS_a066: High Voltage Isolation Loss Fault Isolation',
    sectionCode: 'TN-ELEC-HV-042',
    content: `SAFETY DIRECTIVE: 400V HIGH VOLTAGE SYSTEM - CERTIFIED TECHNICIANS ONLY.
PPE REQUIRED: Class 0 (1000V rated) insulating gloves inspected within 6 months, arc-flash face shield.
1. Isolation Resistance Threshold: Vehicle requires minimum 500 kOhm (0.5 MOhm) isolation resistance between HV positive/negative bus and chassis ground. Codes BMS_a064 / BMS_a066 trigger when isolation drops below 190 kOhm.
2. First Responder / Service Manual First Disconnect: Remove rear seat bottom, disconnect Low Voltage 12V/16V battery negative terminal, then cut First Responder Loop / disconnect High Voltage Pyro Fuse disconnect harness. Wait 5 minutes for bus capacitor bleeding below 50V DC.
3. Component Isolation Elimination: Disconnect A/C Compressor, Cabin PTC Heater, Front Drive Inverter, and Rear Drive Inverter sequentially with mega-ohmmeter to isolate source of chassis leakage.`,
    torqueSpecs: {
      'Pyro-Fuse Manual Disconnect Nut': '9 Nm (80 lb-in)',
      'HV Penthouse Enclosure Bolts': '8 Nm (71 lb-in)',
      'HV Battery Pack Rail Bolts': '62 Nm (46 ft-lb)',
    },
    dtcCodes: ['BMS_a064', 'BMS_a066', 'DI_u014', 'THC_w012'],
  },
  {
    id: 'chevy-silverado-p050d',
    vehicleMake: 'Chevrolet',
    vehicleModel: 'Silverado / Tahoe 5.3L / 6.2L EcoTec3',
    yearRange: '2015-2024',
    system: 'Valve Train & Active Fuel Management',
    title: 'DTC P050D / P0300: Cold Start Rough Idle & AFM/DFM Lifter Collapse Diagnostic',
    sectionCode: 'GM TSB 21-NA-199 / PIP5553',
    content: `DIAGNOSTIC PROTOCOL FOR AFM/DFM COLLAPSED LIFTER & MISFIRE (P050D):
1. Symptoms: Distinct metallic ticking cadence from valve cover synchronized with engine RPM, accompanied by cylinder misfire under light-throttle cylinder deactivation transition.
2. Compression & Cylinder Leakdown Test: Perform running compression test. A collapsed AFM deactivating lifter will fail to open the intake or exhaust valve fully, yielding low dynamic compression (< 90 psi) while static cranking compression appears marginal.
3. VLOM (Valve Lifter Oil Manifold) Inspection: Check oil pressure screen beneath oil pressure sensor at rear of engine block. Particulate debris blocking oil passages starves lifter locking pins of hydraulic pressure, causing premature pin release and lifter collapse.`,
    torqueSpecs: {
      'Cylinder Head Bolts (TTY - New Bolts Required)': 'Pass 1: 40 Nm, Pass 2: 90 deg, Pass 3: 90 deg',
      'Rocker Arm Trunnion Bolts': '30 Nm (22 ft-lb)',
      'VLOM Manifold Bolts': '12 Nm (106 lb-in)',
      'Valve Cover Perimeter Bolts': '10 Nm (89 lb-in)',
    },
    dtcCodes: ['P050D', 'P0300', 'P0301', 'P0307'],
  },
];

// In-memory knowledge store (supports dynamic manual ingestion)
export const activeManualChunks: ServiceManualChunk[] = [...INITIAL_MANUAL_CHUNKS];

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
