import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  AlertTriangle,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Car,
  Cpu,
  ShieldAlert,
  Save,
  Plus,
  Terminal,
  ExternalLink,
  ChevronRight,
  BookOpen,
  ClipboardList,
  MessageSquare,
  MapPin,
  Box,
  Video,
  Activity,
  Code,
  Sparkles,
  Layers,
  RefreshCw,
  Zap,
  Upload,
  FileUp,
  File,
  Edit3,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';

// Nested Sub-modules
import { Workbench } from './Workbench';
import { ThreeGame } from './ThreeGame';
import { VideoStudio } from './VideoStudio';
import { GroundingStudio } from './GroundingStudio';
import { ChatPlayground } from './ChatPlayground';
import { QuotaTracker } from './QuotaTracker';
import { ModelMatrix } from './ModelMatrix';
import { CodeExport } from './CodeExport';
import { SetupGuide } from './SetupGuide';
import { QuotaState, GenerateResponse } from '../types';

export type AutoModule =
  | 'diagnostic'
  | 'manuals'
  | 'safety'
  | 'chat'
  | 'grounding'
  | 'workbench'
  | 'simulation'
  | 'video'
  | 'quotas'
  | 'code'
  | 'cloud';

interface AutoServiceRagProps {
  user: any;
  onRequireAuth: () => void;
  // Shared Workbench and Studio Props
  model?: string;
  setModel?: (m: string) => void;
  systemInstruction?: string;
  setSystemInstruction?: (s: string) => void;
  thinkingLevel?: string;
  setThinkingLevel?: (t: string) => void;
  prompt?: string;
  setPrompt?: (p: string) => void;
  responseFormat?: string;
  setResponseFormat?: (r: string) => void;
  imageBase64?: string | null;
  setImageBase64?: (img: string | null) => void;
  isExecuting?: boolean;
  onExecute?: () => void;
  lastResponse?: GenerateResponse | null;
  error?: string | null;
  quotaState?: QuotaState;
  onResetSessionQuota?: () => void;
  onRecordQuota?: (tokens: number) => void;
  onSelectModelFromMatrix?: (modelId: string) => void;
}

interface ServiceTicket {
  id: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  engine: string;
  dtcCode: string;
  symptoms: string;
  diagnosis: string;
  repairSteps: string;
  torqueSpecs: string;
  sourcesCited: string;
  status: string;
  createdAt: string;
}

export const AutoServiceRag: React.FC<AutoServiceRagProps> = ({
  user,
  onRequireAuth,
  model = 'gemini-3.8-flash',
  setModel = () => {},
  systemInstruction = '',
  setSystemInstruction = () => {},
  thinkingLevel = 'MEDIUM',
  setThinkingLevel = () => {},
  prompt = '',
  setPrompt = () => {},
  responseFormat = 'text',
  setResponseFormat = () => {},
  imageBase64 = null,
  setImageBase64 = () => {},
  isExecuting = false,
  onExecute = () => {},
  lastResponse = null,
  error: parentError = null,
  quotaState = {
    requestsThisMinute: 0,
    tokensThisMinute: 0,
    requestsToday: 0,
    lastRequestTime: Date.now(),
  },
  onResetSessionQuota = () => {},
  onRecordQuota = () => {},
  onSelectModelFromMatrix = () => {},
}) => {
  // Current active sub-module under the automotive project
  const [activeModule, setActiveModule] = useState<AutoModule>('diagnostic');

  // Vehicle Diagnostic Input State
  const [vehicleMake, setVehicleMake] = useState('Ford');
  const [vehicleModel, setVehicleModel] = useState('F-150 EcoBoost 3.5L');
  const [vehicleYear, setVehicleYear] = useState('2021');
  const [engine, setEngine] = useState('3.5L Twin-Turbo V6 (D35)');
  const [dtcCode, setDtcCode] = useState('P0300');
  const [symptoms, setSymptoms] = useState('Engine stumbling and rough idle under heavy acceleration between 45-60 MPH. Check Engine Light flashing intermittently.');
  const [queryText, setQueryText] = useState('Provide root cause diagnosis, spark plug gap specifications, intake valve carbon inspection criteria, and factory torque specs.');

  // Execution State
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [result, setResult] = useState<{
    diagnosis: string;
    torqueSpecs: { [k: string]: string };
    sourcesCited: string[];
    retrievedChunks: any[];
    rerankLog?: any[];
    elapsedMs: number;
    model?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number>(0.2);

  // Firestore Saved Tickets
  const [savedTickets, setSavedTickets] = useState<ServiceTicket[]>([]);
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [ticketSavedSuccess, setTicketSavedSuccess] = useState(false);

  // Indexed Manuals State & Metadata Filters
  const [manualsList, setManualsList] = useState<any[]>([]);
  const [manualsFilter, setManualsFilter] = useState('');
  const [manualModelFilter, setManualModelFilter] = useState('');
  const [manualYearFilter, setManualYearFilter] = useState('');
  const [selectedManual, setSelectedManual] = useState<any | null>(null);
  const [manualNotification, setManualNotification] = useState<string | null>(null);

  // Ingest Manual State
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestMode, setIngestMode] = useState<'upload' | 'manual'>('upload');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadExtractedSummary, setUploadExtractedSummary] = useState<any | null>(null);
  const [uploadStage, setUploadStage] = useState<string>('Reading document buffer...');
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const [ingestMake, setIngestMake] = useState('');
  const [ingestModel, setIngestModel] = useState('');
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestSection, setIngestSection] = useState('');
  const [ingestContent, setIngestContent] = useState('');
  const [ingestSuccess, setIngestSuccess] = useState(false);

  // Edit Manual State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingManual, setEditingManual] = useState<any | null>(null);
  const [editMake, setEditMake] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editYearRange, setEditYearRange] = useState('');
  const [editSystem, setEditSystem] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSectionCode, setEditSectionCode] = useState('');
  const [editDtcCodes, setEditDtcCodes] = useState('');
  const [editTorqueSpecsText, setEditTorqueSpecsText] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const [viewingManualContent, setViewingManualContent] = useState<any | null>(null);

  // NHTSA Recalls & SEC 10-K Warranty State
  const [nhtsaRecalls, setNhtsaRecalls] = useState<any[]>([]);
  const [nhtsaComplaints, setNhtsaComplaints] = useState<any[]>([]);
  const [oemFinancialMetrics, setOemFinancialMetrics] = useState<any[]>([]);
  const [safetyFilterMake, setSafetyFilterMake] = useState<string>('All');
  const [safetySubTab, setSafetySubTab] = useState<'recalls' | 'complaints' | 'financial' | 'terms'>('recalls');
  const [isLoadingSafety, setIsLoadingSafety] = useState(false);

  // Edit Diagnostic Ticket State (Firestore)
  const [editingTicket, setEditingTicket] = useState<ServiceTicket | null>(null);
  const [showEditTicketModal, setShowEditTicketModal] = useState(false);
  const [isSavingTicketEdit, setIsSavingTicketEdit] = useState(false);

  // Edit NHTSA & Financial Metrics State
  const [editingRecall, setEditingRecall] = useState<any | null>(null);
  const [showEditRecallModal, setShowEditRecallModal] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState<any | null>(null);
  const [showEditComplaintModal, setShowEditComplaintModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState<any | null>(null);
  const [showEditMetricModal, setShowEditMetricModal] = useState(false);

  // Semantic Symptom Clustering State
  const [complaintClusters, setComplaintClusters] = useState<any[]>([]);
  const [complaintViewMode, setComplaintViewMode] = useState<'raw' | 'clusters'>('raw');
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);

  const fetchComplaintClusters = async (make: string) => {
    try {
      setIsLoadingClusters(true);
      const res = await fetch(`/api/nhtsa/clusters?make=${encodeURIComponent(make)}`);
      if (res.ok) {
        const data = await res.json();
        setComplaintClusters(data.clusters || []);
      }
    } catch (err) {
      console.warn('Failed to fetch complaint clusters:', err);
    } finally {
      setIsLoadingClusters(false);
    }
  };

  // GCloud CLI Guide Tab Toggle (in Diagnostic view)
  const [showGcloudGuide, setShowGcloudGuide] = useState(false);

  // Pre-configured OEM Scenarios
  const presetScenarios = [
    {
      label: 'Ford EcoBoost P0300',
      make: 'Ford',
      model: 'F-150 EcoBoost 3.5L',
      year: '2021',
      engine: '3.5L Twin-Turbo V6',
      dtc: 'P0300',
      symptom: 'Intermittent bucking under boost, flashing CEL above 45 MPH.',
      query: 'Verify spark plug gap, intake carbon build-up, and VCT phaser rattle criteria per TSB 21-2119.',
    },
    {
      label: 'Toyota RAV4 P0171',
      make: 'Toyota',
      model: 'RAV4 / Camry 2.5L',
      year: '2022',
      engine: '2.5L Dynamic Force (A25A-FKS)',
      dtc: 'P0171',
      symptom: 'System Too Lean Bank 1, positive fuel trims exceeding +35% at idle.',
      query: 'Intake vacuum smoke testing procedures, MAF sensor flow rates, and direct injector port seal inspection.',
    },
    {
      label: 'Honda Civic P0420',
      make: 'Honda',
      model: 'Civic 1.5L Turbo',
      year: '2020',
      engine: '1.5L VTEC Turbo (L15B7)',
      dtc: 'P0420',
      symptom: 'Catalyst efficiency below threshold, secondary O2 sensor switching frequency elevated.',
      query: 'Check downpipe flange leaks, O2 sensor voltage waveforms, and oil fuel dilution effects.',
    },
    {
      label: 'BMW B58 Coolant P112F',
      make: 'BMW',
      model: '340i / 540i B58',
      year: '2019',
      engine: '3.0L Turbo Inline-6 (B58)',
      dtc: 'P112F',
      symptom: 'Electric water pump deviation, cooling fan running on high speed at cold start.',
      query: 'Water pump replacement procedure, aluminum stretch bolt torque, and mandatory 12-minute electronic bleed protocol.',
    },
    {
      label: 'Tesla Model 3 HV Isolation',
      make: 'Tesla',
      model: 'Model 3 / Model Y',
      year: '2023',
      engine: 'Dual Motor AWD 400V',
      dtc: 'BMS_a064',
      symptom: 'High voltage isolation loss alert, maximum charge rate curtailed.',
      query: 'High voltage isolation resistance threshold, pyro fuse disconnect steps, and mega-ohmmeter testing isolation.',
    },
    {
      label: 'Chevy Silverado P050D',
      make: 'Chevrolet',
      model: 'Silverado 1500 5.3L',
      year: '2020',
      engine: '5.3L EcoTec3 V8',
      dtc: 'P050D',
      symptom: 'Cold start rough idle, misfire count on cylinder 7 during open-loop warm-up.',
      query: 'AFM/DFM collapsed lifter diagnosis, VLOM pressure testing, and cylinder head torque-to-yield sequence.',
    },
  ];

  // Fetch manuals list safely
  const loadManuals = () => {
    fetch('/api/rag/manuals')
      .then((res) => res.text())
      .then((rawText) => {
        try {
          const data = JSON.parse(rawText);
          if (data.manuals) {
            setManualsList(data.manuals);
            if (!selectedManual && data.manuals.length > 0) {
              setSelectedManual(data.manuals[0]);
            }
          }
        } catch {
          console.warn('Non-JSON response from /api/rag/manuals');
        }
      })
      .catch((err) => console.error('Failed to load manuals:', err));
  };

  const loadSafetyData = async () => {
    setIsLoadingSafety(true);
    try {
      const [recResp, compResp, finResp] = await Promise.all([
        fetch('/api/nhtsa/recalls'),
        fetch('/api/nhtsa/complaints'),
        fetch('/api/financial/metrics'),
      ]);
      const [recData, compData, finData] = await Promise.all([
        recResp.json(),
        compResp.json(),
        finResp.json(),
      ]);
      if (recData?.recalls) setNhtsaRecalls(recData.recalls);
      if (compData?.complaints) setNhtsaComplaints(compData.complaints);
      if (finData?.metrics) setOemFinancialMetrics(finData.metrics);
    } catch (e) {
      console.error('Failed to load safety and financial data:', e);
    } finally {
      setIsLoadingSafety(false);
    }
  };

  useEffect(() => {
    loadManuals();
    loadSafetyData();
  }, []);

  // Listen to Firestore Saved Tickets for user
  useEffect(() => {
    if (!user) {
      const stored = localStorage.getItem('auto_service_local_tickets');
      if (stored) {
        try {
          setSavedTickets(JSON.parse(stored));
          return;
        } catch {
          // ignore
        }
      }
      setSavedTickets([
        {
          id: 'ticket_demo_p0300',
          vehicleYear: '2021',
          vehicleMake: 'Ford',
          vehicleModel: 'F-150 EcoBoost 3.5L',
          engine: '3.5L Twin-Turbo EcoBoost V6',
          dtcCode: 'P0300',
          symptoms: 'Engine stumbling and rough idle under heavy acceleration between 45-60 MPH. Check engine light blinking intermittently.',
          diagnosis: 'Multi-cylinder misfire detected. Grounded in WSM Section 303-07A. Suspect worn spark plug electrode gap or degraded coil boots.',
          repairSteps: '1. Scan Mode $06 cylinder misfire counts. 2. Verify spark plug gap at 0.030-0.033 in. 3. Swap coil pack between cylinders 1 and 2.',
          torqueSpecs: 'Spark Plugs: 15 Nm (133 lb-in); Ignition Coil Retaining Bolts: 10 Nm (89 lb-in)',
          sourcesCited: 'TSB 21-2119 / WSM 303-07A: Ignition System & Random Misfire Diagnostic Procedure',
          status: 'open',
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    try {
      const ticketsRef = collection(db, 'autoServiceTickets');
      const q = query(
        ticketsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const tickets: ServiceTicket[] = [];
          snapshot.forEach((docSnap) => {
            tickets.push({ id: docSnap.id, ...docSnap.data() } as ServiceTicket);
          });
          setSavedTickets(tickets);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'autoServiceTickets');
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.error('Error listening to tickets:', e);
    }
  }, [user]);

  const handleApplyPreset = (preset: typeof presetScenarios[0]) => {
    setVehicleMake(preset.make);
    setVehicleModel(preset.model);
    setVehicleYear(preset.year);
    setEngine(preset.engine);
    setDtcCode(preset.dtc);
    setSymptoms(preset.symptom);
    setQueryText(preset.query);
  };

  const handleRunDiagnostic = async (overrideModel?: string) => {
    if (isDiagnosing) return;
    setIsDiagnosing(true);
    setError(null);

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleMake,
          vehicleModel,
          vehicleYear,
          engine,
          dtcCode,
          symptoms,
          query: queryText,
          model: overrideModel || 'gemini-3.8-flash',
          temperature,
        }),
      });

      // Safely parse JSON or handle HTML proxy errors (e.g. 504 / 502)
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        let friendlyMsg = 'The diagnostic inference service timed out or is temporarily warming up. Please retry.';
        if (rawText.includes('504') || rawText.toLowerCase().includes('gateway timeout')) {
          friendlyMsg = 'Gateway Timeout (504): Model response took longer than the request window. Click "Retry Diagnostic" or try "Fast Diagnostic (Flash-Lite)".';
        } else if (rawText.includes('502') || rawText.toLowerCase().includes('bad gateway')) {
          friendlyMsg = 'Server Bad Gateway (502): The dev server was refreshing. Please retry.';
        }
        throw new Error(friendlyMsg);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete RAG diagnostic');
      }

      setResult({
        diagnosis: data.diagnosis,
        torqueSpecs: data.torqueSpecs || {},
        sourcesCited: data.sourcesCited || [],
        retrievedChunks: data.retrievedChunks || [],
        rerankLog: data.rerankLog || [],
        elapsedMs: data.elapsedMs || 0,
        model: data.model || overrideModel || 'gemini-3.8-flash',
      });

      onRecordQuota(650);
    } catch (err: any) {
      setError(err.message || 'Diagnostic failed');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSaveTicketToFirestore = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!result) return;

    setIsSavingTicket(true);
    try {
      const torqueStr = Object.entries(result.torqueSpecs)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');

      await addDoc(collection(db, 'autoServiceTickets'), {
        id: `ticket_${Date.now()}`,
        userId: user.uid,
        vehicleYear,
        vehicleMake,
        vehicleModel,
        engine,
        dtcCode,
        symptoms,
        diagnosis: result.diagnosis,
        repairSteps: 'See diagnostic report',
        torqueSpecs: torqueStr,
        sourcesCited: result.sourcesCited.join(' | '),
        status: 'open',
        createdAt: new Date().toISOString(),
      });

      setTicketSavedSuccess(true);
      setTimeout(() => setTicketSavedSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'autoServiceTickets');
    } finally {
      setIsSavingTicket(false);
    }
  };

  // Ticket Notification & Report Editing State
  const [ticketNotification, setTicketNotification] = useState<string | null>(null);
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [reportEditText, setReportEditText] = useState('');

  const handleDeleteTicket = async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (user) {
        await deleteDoc(doc(db, 'autoServiceTickets', ticketId));
      }
      setSavedTickets((prev) => {
        const next = prev.filter((t) => t.id !== ticketId);
        if (!user) {
          localStorage.setItem('auto_service_local_tickets', JSON.stringify(next));
        }
        return next;
      });
      setTicketNotification('Diagnostic ticket deleted successfully.');
      setTimeout(() => setTicketNotification(null), 3500);
    } catch (err) {
      console.error('Failed to delete ticket from Firestore:', err);
      handleFirestoreError(err, OperationType.DELETE, 'autoServiceTickets');
      setSavedTickets((prev) => {
        const next = prev.filter((t) => t.id !== ticketId);
        if (!user) {
          localStorage.setItem('auto_service_local_tickets', JSON.stringify(next));
        }
        return next;
      });
      setTicketNotification('Ticket removed from view.');
      setTimeout(() => setTicketNotification(null), 3500);
    }
  };

  const handleClearAllTickets = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      if (user) {
        for (const t of savedTickets) {
          try {
            await deleteDoc(doc(db, 'autoServiceTickets', t.id));
          } catch {
            // continue
          }
        }
      }
      setSavedTickets([]);
      if (!user) {
        localStorage.setItem('auto_service_local_tickets', JSON.stringify([]));
      }
      setTicketNotification('All diagnostic tickets cleared.');
      setTimeout(() => setTicketNotification(null), 3500);
    } catch (err) {
      console.error('Error clearing tickets:', err);
      handleFirestoreError(err, OperationType.DELETE, 'autoServiceTickets');
      setSavedTickets([]);
      if (!user) {
        localStorage.setItem('auto_service_local_tickets', JSON.stringify([]));
      }
    }
  };

  const handleOpenEditTicket = (t: ServiceTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingTicket({ ...t });
    setShowEditTicketModal(true);
  };

  const handleSaveTicketEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    setIsSavingTicketEdit(true);
    try {
      if (user) {
        const ticketRef = doc(db, 'autoServiceTickets', editingTicket.id);
        await updateDoc(ticketRef, {
          vehicleMake: editingTicket.vehicleMake,
          vehicleModel: editingTicket.vehicleModel,
          vehicleYear: editingTicket.vehicleYear,
          engine: editingTicket.engine,
          dtcCode: editingTicket.dtcCode,
          symptoms: editingTicket.symptoms,
          status: editingTicket.status || 'open',
          diagnosis: editingTicket.diagnosis,
          repairSteps: editingTicket.repairSteps || 'See diagnostic report',
          torqueSpecs: editingTicket.torqueSpecs || '',
          sourcesCited: editingTicket.sourcesCited || '',
        });
      }
      setSavedTickets((prev) =>
        prev.map((t) => (t.id === editingTicket.id ? { ...editingTicket } : t))
      );
      setShowEditTicketModal(false);
      setEditingTicket(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'autoServiceTickets');
    } finally {
      setIsSavingTicketEdit(false);
    }
  };

  const handleClearIntake = () => {
    setVehicleMake('');
    setVehicleModel('');
    setVehicleYear('');
    setEngine('');
    setDtcCode('');
    setSymptoms('');
    setQueryText('');
  };

  // Safety Tab Edit & Delete Handlers
  const handleDeleteRecall = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      await fetch(`/api/nhtsa/recalls/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setNhtsaRecalls((prev) => prev.filter((r) => String(r.recall_id) !== String(id) && r.nhtsa_campaign_number !== id));
    } catch (err) {
      console.error('Failed to delete recall:', err);
      setNhtsaRecalls((prev) => prev.filter((r) => String(r.recall_id) !== String(id) && r.nhtsa_campaign_number !== id));
    }
  };

  const handleSaveRecallEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecall) return;
    try {
      const id = editingRecall.recall_id || editingRecall.nhtsa_campaign_number;
      await fetch(`/api/nhtsa/recalls/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRecall),
      });
      setNhtsaRecalls((prev) =>
        prev.map((r) => (r.recall_id === editingRecall.recall_id ? { ...editingRecall } : r))
      );
      setShowEditRecallModal(false);
      setEditingRecall(null);
    } catch (err) {
      console.error('Failed to update recall:', err);
    }
  };

  const handleDeleteComplaint = async (id: string | number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      await fetch(`/api/nhtsa/complaints/${id}`, { method: 'DELETE' });
      setNhtsaComplaints((prev) => prev.filter((c) => String(c.odi_number) !== String(id)));
    } catch (err) {
      console.error('Failed to delete complaint:', err);
      setNhtsaComplaints((prev) => prev.filter((c) => String(c.odi_number) !== String(id)));
    }
  };

  const handleSaveComplaintEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComplaint) return;
    try {
      await fetch(`/api/nhtsa/complaints/${editingComplaint.odi_number}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingComplaint),
      });
      setNhtsaComplaints((prev) =>
        prev.map((c) => (c.odi_number === editingComplaint.odi_number ? { ...editingComplaint } : c))
      );
      setShowEditComplaintModal(false);
      setEditingComplaint(null);
    } catch (err) {
      console.error('Failed to update complaint:', err);
    }
  };

  const handleDeleteMetric = async (ticker: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      await fetch(`/api/financial/metrics/${ticker}`, { method: 'DELETE' });
      setOemFinancialMetrics((prev) => prev.filter((m) => m.oem_ticker.toUpperCase() !== ticker.toUpperCase()));
    } catch (err) {
      console.error('Failed to delete metric:', err);
      setOemFinancialMetrics((prev) => prev.filter((m) => m.oem_ticker.toUpperCase() !== ticker.toUpperCase()));
    }
  };

  const handleSaveMetricEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMetric) return;
    try {
      await fetch(`/api/financial/metrics/${editingMetric.oem_ticker}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMetric),
      });
      setOemFinancialMetrics((prev) =>
        prev.map((m) => (m.oem_ticker === editingMetric.oem_ticker ? { ...editingMetric } : m))
      );
      setShowEditMetricModal(false);
      setEditingMetric(null);
    } catch (err) {
      console.error('Failed to update metric:', err);
    }
  };

  const handleQuickCreateManual = async () => {
    const make = (ingestMake || '').trim() || 'Pagani';
    const model = (ingestModel || '').trim() || '300';
    const title = (ingestTitle || '').trim() || `u0003 Code - High-Speed CAN Communication Bus (+) KBB`;
    const content = (ingestContent || '').trim() || `DIAGNOSTIC & REPAIR PROCEDURE FOR ${make.toUpperCase()} ${model.toUpperCase()} (DTC U0003 HIGH-SPEED CAN BUS (+) HIGH/OPEN):
1. DTC Condition & Architecture: Abnormal voltage on CAN-H line Pin 6 of the OBD-II Data Link Connector DLC.
2. Step 1 - Terminating Resistance Measurement: Ignition OFF, disconnect 12V battery, wait 60s. Measure resistance across DLC Pin 6 (CAN-H) and Pin 14 (CAN-L). Specified resistance: 60 Ω ± 4 Ω.
3. Step 2 - Operating Voltage Baseline Test: Key ON, Engine OFF. DLC Pin 6 (CAN-H) to ground: 2.5V - 3.5V dominant signal. DLC Pin 14 (CAN-L) to ground: 1.5V - 2.5V dominant signal.
4. Step 3 - Module Isolation: Disconnect modules on CAN backbone one by one until normal voltage restores.
5. Reassembly: Solder splices with dual-wall heatshrink, clear fault memory, and complete drive cycle.`;

    try {
      const res = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleMake: make,
          vehicleModel: model,
          yearRange: '2018-2026',
          system: 'High-Speed CAN Communication Bus & Gateway Network',
          title: title,
          sectionCode: 'WSM-CAN-U0003',
          content: content,
          dtcCodes: ['U0003'],
          torqueSpecs: {
            'Central Gateway (CGW) Mounting Screws': '4.5 Nm (40 lb-in)',
            'DLC OBD-II Connector Bracket Bolts': '2.5 Nm (22 lb-in)',
            'Powertrain Module Connector Retaining Bolt': '6.0 Nm (53 lb-in)',
            'Chassis Main Ground Terminal (W10/4)': '9.0 Nm (80 lb-in)'
          }
        }),
      });
      if (res.ok) {
        setIngestSuccess(true);
        loadManuals();
        setTimeout(() => {
          setIngestSuccess(false);
          setShowIngestModal(false);
          setIngestTitle('');
          setIngestContent('');
          setIngestMake('');
          setIngestModel('');
        }, 1200);
      }
    } catch (e) {
      console.error('Quick manual creation failed', e);
    }
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const make = (ingestMake || '').trim() || 'Universal';
    const model = (ingestModel || '').trim() || 'All Models';
    const title = (ingestTitle || '').trim() || `${make} ${model} Workshop Diagnostic Procedure`;
    const content = (ingestContent || '').trim() || `DIAGNOSTIC & REPAIR PROCEDURE FOR ${make} ${model}:
1. Connect OEM bi-directional scan tool and read active and pending DTCs.
2. Verify battery voltage (minimum 12.6V float) before initiating high-speed CAN diagnostic pinout tests.
3. Inspect wiring harness, terminal drag, and ground points.
4. Execute component functional actuation tests.
5. Reconnect and torque fasteners according to OEM specifications.`;

    try {
      const res = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleMake: make,
          vehicleModel: model,
          yearRange: '2018-2026',
          system: 'Electrical & Diagnostic Procedures',
          title,
          sectionCode: ingestSection || 'WSM-OEM-01',
          content,
          dtcCodes: ['U0003'],
          torqueSpecs: {
            'Diagnostic Port Retaining Screws': '2.5 Nm (22 lb-in)',
            'Module Fasteners': '4.5 Nm (40 lb-in)'
          }
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIngestSuccess(true);
        loadManuals();
        setTimeout(() => {
          setIngestSuccess(false);
          setShowIngestModal(false);
          setIngestTitle('');
          setIngestContent('');
          setIngestMake('');
          setIngestModel('');
        }, 1200);
      }
    } catch (e) {
      console.error('Ingest failed', e);
    }
  };

  const handleCancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setIsUploadingPdf(false);
    setUploadFile(null);
    setUploadError(null);
  };

  const handleFileUpload = async (file: File) => {
    setUploadFile(file);
    setUploadError(null);
    setUploadExtractedSummary(null);
    setIsUploadingPdf(true);
    setUploadStage('Reading document and preparing binary buffer...');

    // Abort controller for client-side cancellation and timeout
    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    // Change stage message over time to keep user informed of background RAG parsing
    const timer1 = setTimeout(() => {
      setUploadStage('Analyzing document structure and DTC codes with Gemini...');
    }, 2000);
    const timer2 = setTimeout(() => {
      setUploadStage('Extracting diagnostic pinpoint steps, CAN parameters & torque specs...');
    }, 4500);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch('/api/rag/upload-manual', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: base64Data,
              fileName: file.name,
              mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
              overrideMake: ingestMake || undefined,
              overrideModel: ingestModel || undefined,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to process document');
          }

          setIngestSuccess(true);
          setUploadExtractedSummary(data.extractedData || data.chunk);
          loadManuals();
          setTimeout(() => {
            setIngestSuccess(false);
            setShowIngestModal(false);
            setUploadFile(null);
            setUploadExtractedSummary(null);
          }, 2500);
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') {
            setUploadError('Upload cancelled by user.');
          } else {
            setUploadError(fetchErr.message || 'Server error processing manual');
          }
        } finally {
          clearTimeout(timer1);
          clearTimeout(timer2);
          setIsUploadingPdf(false);
          uploadAbortControllerRef.current = null;
        }
      };
      reader.onerror = () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        setUploadError('Failed to read file from disk');
        setIsUploadingPdf(false);
        uploadAbortControllerRef.current = null;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setUploadError(err.message || 'File upload failed');
      setIsUploadingPdf(false);
      uploadAbortControllerRef.current = null;
    }
  };

  const handleStartEdit = (manual: any) => {
    setEditingManual(manual);
    setEditMake(manual.vehicleMake || '');
    setEditModel(manual.vehicleModel || '');
    setEditYearRange(manual.yearRange || '');
    setEditSystem(manual.system || '');
    setEditTitle(manual.title || '');
    setEditSectionCode(manual.sectionCode || '');
    setEditDtcCodes((manual.dtcCodes || []).join(', '));
    setEditTorqueSpecsText(
      manual.torqueSpecs && Object.keys(manual.torqueSpecs).length > 0
        ? JSON.stringify(manual.torqueSpecs, null, 2)
        : '{\n  "Component": "15 Nm (133 lb-in)"\n}'
    );
    setEditContent(manual.content || '');
    setEditError(null);
    setEditSuccess(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingManual) return;
    setIsSavingEdit(true);
    setEditError(null);

    let parsedTorque: any = {};
    if (editTorqueSpecsText.trim()) {
      try {
        parsedTorque = JSON.parse(editTorqueSpecsText);
      } catch {
        setEditError('Torque specifications must be valid JSON format (e.g. {"Spark Plugs": "15 Nm"}).');
        setIsSavingEdit(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/rag/manuals/${encodeURIComponent(editingManual.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleMake: editMake,
          vehicleModel: editModel,
          yearRange: editYearRange,
          system: editSystem,
          title: editTitle,
          sectionCode: editSectionCode,
          content: editContent,
          dtcCodes: editDtcCodes.split(',').map((s) => s.trim()).filter(Boolean),
          torqueSpecs: parsedTorque,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update workshop manual');
      }

      setEditSuccess(true);
      loadManuals();
      setTimeout(() => {
        setEditSuccess(false);
        setShowEditModal(false);
        setEditingManual(null);
      }, 1200);
    } catch (err: any) {
      setEditError(err.message || 'Error saving manual changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteManual = async (manualId: string, title?: string, e?: React.MouseEvent, make?: string, model?: string) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    // Optimistically remove from UI immediately
    setManualsList((prev) => prev.filter((m) => m.id !== manualId && !(make && model && m.vehicleMake === make && m.vehicleModel === model)));
    if (selectedManual?.id === manualId) {
      setSelectedManual(null);
    }

    try {
      const queryParams = make && model ? `?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}` : '';
      const res = await fetch(`/api/rag/manuals/${encodeURIComponent(manualId)}${queryParams}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete manual');
      }
      setManualNotification(`Manual "${title || manualId}" deleted successfully from custom_manuals.json`);
      setTimeout(() => setManualNotification(null), 3500);
      loadManuals();
    } catch (err: any) {
      console.error('Delete manual failed:', err);
      loadManuals();
    }
  };

  // 11 Unified Sub-Tabs under the Auto Service RAG Project
  const automotiveModules = [
    { id: 'diagnostic' as const, label: 'DTC Diagnostics', icon: Wrench, badge: 'Core RAG' },
    { id: 'manuals' as const, label: 'OEM Shop Manuals', icon: BookOpen, count: manualsList.length },
    { id: 'safety' as const, label: 'NHTSA Recalls & 10-K Warranty', icon: ShieldAlert, badge: 'BigQuery' },
    { id: 'chat' as const, label: 'Technician Chat', icon: MessageSquare },
    { id: 'grounding' as const, label: 'Service & Parts Maps', icon: MapPin },
    { id: 'workbench' as const, label: 'Multimodal Lab', icon: Cpu },
    { id: 'simulation' as const, label: '3D Powertrain Lab', icon: Box },
    { id: 'video' as const, label: 'Repair Video Studio', icon: Video },
    { id: 'quotas' as const, label: 'Quotas & Models', icon: Activity },
    { id: 'code' as const, label: 'SDK & SQL Export', icon: Code },
    { id: 'cloud' as const, label: 'GCP CLI & IAM', icon: Terminal },
  ];

  return (
    <div className="space-y-6">
      {/* Top Project Banner */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Car className="w-3.5 h-3.5" />
                <span>Auto Service RAG Project</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>OEM Service Manual Knowledge Base</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Vertex AI & Gemini 3.8 Flash</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <span>Automotive Diagnostic Intelligence System</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Unified engineering platform for vehicle diagnostics, factory workshop manual retrieval, bolt torque specs, 3D mechanical simulations, and least-privilege Google Cloud infrastructure.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveModule('cloud')}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-500" />
              <span>GCP CLI & IAM</span>
            </button>
            <button
              onClick={() => setShowIngestModal(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ingest Manual</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Bar: All 10 Modules under this Single Automotive Tab */}
        <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max pb-1">
            {automotiveModules.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-blue-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        isActive
                          ? 'bg-blue-800/80 text-blue-100'
                          : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {typeof item.count === 'number' && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-blue-800/80 text-blue-100'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODULE 1: DTC DIAGNOSTIC RAG (CORE AUTOMOTIVE WORKSPACE) */}
      {activeModule === 'diagnostic' && (
        <div className="space-y-6">
          {/* Quick OEM Scenarios Strip */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>OEM Scenarios:</span>
              </span>
              {presetScenarios.map((sc, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(sc)}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main 2-Column Work Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Vehicle & OBD-II Intake (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-500" />
                    Vehicle & OBD-II Trouble Code Intake
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearIntake}
                      className="text-[11px] font-semibold text-slate-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                      title="Clear and reset all intake fields"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                      <span>Clear Intake</span>
                    </button>
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      RAG Grounded
                    </span>
                  </div>
                </div>

                {/* Make / Model / Year / Engine */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Make</label>
                    <input
                      type="text"
                      value={vehicleMake}
                      onChange={(e) => setVehicleMake(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Model</label>
                    <input
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Year</label>
                    <input
                      type="text"
                      value={vehicleYear}
                      onChange={(e) => setVehicleYear(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Engine / Powertrain</label>
                    <input
                      type="text"
                      value={engine}
                      onChange={(e) => setEngine(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Diagnostic Trouble Code */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-500">OBD-II DTC Trouble Code</label>
                    <span className="text-[10px] text-slate-400 font-mono">e.g. P0300, P0171, BMS_a064</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={dtcCode}
                      onChange={(e) => setDtcCode(e.target.value.toUpperCase())}
                      className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Symptoms Reported */}
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    Observed Symptoms & Customer Complaint
                  </label>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={2}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Specific Mechanic Inquiry */}
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    Mechanic Technical Diagnostic Request
                  </label>
                  <textarea
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    rows={2}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Model Temperature Parameter Control */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      <span>Inference Temperature</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {temperature.toFixed(2)}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <button
                      type="button"
                      onClick={() => setTemperature(0.0)}
                      className={`hover:text-blue-500 cursor-pointer ${temperature === 0.0 ? 'text-blue-600 font-bold' : ''}`}
                    >
                      0.0 (Strict)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemperature(0.2)}
                      className={`hover:text-blue-500 cursor-pointer ${temperature === 0.2 ? 'text-blue-600 font-bold' : ''}`}
                    >
                      0.2 (Rec.)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemperature(1.0)}
                      className={`hover:text-blue-500 cursor-pointer ${temperature === 1.0 ? 'text-blue-600 font-bold' : ''}`}
                    >
                      1.0 (Standard)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemperature(2.0)}
                      className={`hover:text-blue-500 cursor-pointer ${temperature === 2.0 ? 'text-blue-600 font-bold' : ''}`}
                    >
                      2.0 (Max Temp)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunDiagnostic()}
                    disabled={isDiagnosing}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                      isDiagnosing ? 'bg-blue-400 cursor-not-allowed opacity-75' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isDiagnosing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Searching OEM Manuals & Grounding...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Execute Auto Service RAG Diagnostic</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClearIntake}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                    title="Clear and reset intake fields"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Saved Diagnostic Tickets (Firestore / Local synced) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-blue-500" />
                    Saved Diagnostic Tickets ({savedTickets.length})
                  </span>
                  <div className="flex items-center gap-2">
                    {savedTickets.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllTickets}
                        className="text-[11px] text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 cursor-pointer font-semibold px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900/60 transition-colors"
                        title="Delete all saved tickets"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear All</span>
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {user ? 'Firestore synced' : 'Local / Guest'}
                    </span>
                  </div>
                </div>

                {ticketNotification && (
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 text-xs flex items-center gap-1.5 transition-all">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{ticketNotification}</span>
                  </div>
                )}

                {savedTickets.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {savedTickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setVehicleMake(t.vehicleMake);
                          setVehicleModel(t.vehicleModel);
                          setVehicleYear(t.vehicleYear);
                          setEngine(t.engine);
                          setDtcCode(t.dtcCode);
                          setSymptoms(t.symptoms);
                        }}
                        className="group p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-400 cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                          <span className="truncate mr-2 font-medium">
                            {t.vehicleYear} {t.vehicleMake} {t.vehicleModel}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono text-[10px]">
                              {t.dtcCode}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditTicket(t, e)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                              title="Edit this diagnostic ticket"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTicket(e, t.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-900/60 transition-colors cursor-pointer"
                              title="Delete this ticket"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-1">{t.symptoms}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No tickets saved yet. Run a diagnostic and click "Save to Firestore".</p>
                )}
              </div>
            </div>

            {/* Right Column: RAG Grounded Output & Technical Bulletins (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col min-h-[580px]">
                {/* Output Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-blue-500" />
                      RAG Diagnostic Report & OEM Manual Excerpts
                    </span>
                    <span className="text-xs text-slate-500 font-mono mt-0.5 block">
                      Grounding: Factory Workshop Manuals + Gemini 3.8 Flash
                    </span>
                  </div>

                  {result && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          setSafetyFilterMake(vehicleMake || 'All');
                          setActiveModule('safety');
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Cross-reference NHTSA Recalls and 10-K Warranty Reserves for this vehicle"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="hidden sm:inline">NHTSA Recalls &amp; 10-K</span>
                        <span className="sm:hidden">Recalls</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReportEditText(result.diagnosis);
                          setIsEditingReport(true);
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Edit diagnostic report text"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                        <span>Edit Report</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResult(null)}
                        className="p-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Clear and delete current diagnostic report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Clear Report</span>
                      </button>
                      <button
                        onClick={handleSaveTicketToFirestore}
                        disabled={isSavingTicket}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {ticketSavedSuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Ticket Saved</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5 text-blue-500" />
                            <span>Save to Firestore</span>
                          </>
                        )}
                      </button>
                      <span className="text-xs font-mono text-slate-400 tabular-nums">
                        {result.elapsedMs} ms
                      </span>
                    </div>
                  )}
                </div>

                {/* Diagnostic Report Content */}
                <div className="flex-1 overflow-y-auto max-h-[620px] pr-2 space-y-4">
                  {isDiagnosing ? (
                    <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <div className="w-12 h-12 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin" />
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Retrieving Workshop Manuals for {vehicleMake} {vehicleModel}...
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Computing vector similarity across OEM service bulletins and compiling step-by-step diagnostic tree.
                      </p>
                    </div>
                  ) : error ? (
                    <div className="p-4 sm:p-5 bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 rounded-lg shrink-0 mt-0.5">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-red-900 dark:text-red-200 uppercase tracking-wider">
                            RAG Diagnostic Evaluation Notice
                          </h4>
                          <p className="text-xs text-red-700 dark:text-red-300 font-mono leading-relaxed break-words">
                            {error}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-red-200 dark:border-red-900/60 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleRunDiagnostic('gemini-3.8-flash')}
                          disabled={isDiagnosing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                          <span>Retry Diagnostic (Gemini 3.8 Flash)</span>
                        </button>
                        <button
                          onClick={() => handleRunDiagnostic('gemini-3.1-flash-lite')}
                          disabled={isDiagnosing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Fast Diagnostic (Flash-Lite ~1.5s)</span>
                        </button>
                      </div>
                    </div>
                  ) : result ? (
                    <div className="space-y-5">
                      {/* Cited Manuals Strip */}
                      <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 p-3 rounded-lg">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-blue-700 dark:text-blue-300 block mb-1.5">
                          Grounding Citations (Retrieved OEM Documents):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {result.sourcesCited.map((src, i) => (
                            <span
                              key={i}
                              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded text-xs border border-blue-100 dark:border-blue-900/40 font-mono"
                            >
                              {src}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Two-Stage Retrieval & Re-ranking Audit */}
                      {result.rerankLog && result.rerankLog.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>Two-Stage Re-ranking &amp; Metadata Filter Audit</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              Stage 1: Vector/Lexical + Metadata → Stage 2: Diagnostic Deep Re-rank
                            </span>
                          </div>

                          <div className="space-y-2">
                            {result.rerankLog.map((log: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                      Rank #{log.finalRerankedRank}
                                    </span>
                                    {log.initialStage1Rank !== log.finalRerankedRank && (
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                                        (Re-ranked from #{log.initialStage1Rank})
                                      </span>
                                    )}
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                      {log.sectionCode}: {log.title}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    Vehicle: {log.vehicle}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                  {log.metadataFilterStatus.modelMatch && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                      ✓ Model Match
                                    </span>
                                  )}
                                  {log.metadataFilterStatus.yearMatch && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                      ✓ Year In Range
                                    </span>
                                  )}
                                  {log.metadataFilterStatus.dtcMatch && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                      ✓ DTC Match
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono text-slate-400 ml-1">
                                    Score: {log.stage2RerankScore}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Factory Torque Specs Table if present */}
                      {Object.keys(result.torqueSpecs).length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-blue-500" />
                            Factory Bolt Torque Specifications (OEM Workshop Manual)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {Object.entries(result.torqueSpecs).map(([comp, tq], idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                              >
                                <span className="text-slate-600 dark:text-slate-400 truncate mr-2">{comp}</span>
                                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
                                  {tq}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Diagnostic Prose */}
                      <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                        {result.diagnosis}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Wrench className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Auto Service RAG Ready
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                        Select an OEM preset scenario above or enter a vehicle and DTC trouble code to execute a grounded diagnostic repair analysis.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 2: OEM SHOP MANUALS LIBRARY & INGESTION */}
      {activeModule === 'manuals' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  <span>Factory Workshop Manual Knowledge Base ({manualsList.length} Indexed)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-indexed OEM technical service bulletins, pinouts, and torque tables queried by the RAG vector engine.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Make / Title / DTC..."
                  value={manualsFilter}
                  onChange={(e) => setManualsFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white w-36 sm:w-44"
                />
                <input
                  type="text"
                  placeholder="Model (e.g. F-150)..."
                  value={manualModelFilter}
                  onChange={(e) => setManualModelFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white w-32 sm:w-36"
                />
                <input
                  type="text"
                  placeholder="Year (e.g. 2021)..."
                  value={manualYearFilter}
                  onChange={(e) => setManualYearFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white w-24"
                />
                <button
                  onClick={() => {
                    setIngestMode('upload');
                    setShowIngestModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Upload PDF Manual</span>
                </button>
                <button
                  onClick={() => {
                    setIngestMode('manual');
                    setShowIngestModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Type / Paste</span>
                </button>
              </div>
            </div>

            {manualNotification && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-semibold animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{manualNotification}</span>
              </div>
            )}

            {/* Manuals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {manualsList
                .filter(
                  (m) =>
                    (!manualsFilter ||
                      m.title.toLowerCase().includes(manualsFilter.toLowerCase()) ||
                      m.vehicleMake.toLowerCase().includes(manualsFilter.toLowerCase()) ||
                      m.system.toLowerCase().includes(manualsFilter.toLowerCase()) ||
                      m.dtcCodes?.some((d: string) => d.toLowerCase().includes(manualsFilter.toLowerCase()))) &&
                    (!manualModelFilter ||
                      m.vehicleModel.toLowerCase().includes(manualModelFilter.toLowerCase())) &&
                    (!manualYearFilter ||
                      (m.yearRange && m.yearRange.includes(manualYearFilter.trim())))
                )
                .map((manual) => (
                  <div
                    key={manual.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-blue-400 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {manual.vehicleMake} · {manual.vehicleModel}
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {manual.yearRange}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {manual.title}
                      </h4>
                      <span className="inline-block text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                        Section: {manual.sectionCode}
                      </span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      {manual.dtcCodes && manual.dtcCodes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {manual.dtcCodes.map((dtc: string) => (
                            <span
                              key={dtc}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-semibold"
                            >
                              {dtc}
                            </span>
                          ))}
                        </div>
                      )}

                      {manual.torqueSpecs && Object.keys(manual.torqueSpecs).length > 0 && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800/60">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[10px] uppercase mb-0.5">
                            Factory Torque Sample:
                          </span>
                          <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
                            {Object.entries(manual.torqueSpecs)[0][0]}: {String(Object.entries(manual.torqueSpecs)[0][1])}
                          </span>
                        </div>
                      )}

                      {/* Manual Action Buttons: View, Edit, Delete */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setViewingManualContent(manual)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Content</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleStartEdit(manual)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer transition-colors"
                            title="Edit manual metadata, torque specs, and content"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={(e) => handleDeleteManual(manual.id, manual.title, e, manual.vehicleMake, manual.vehicleModel)}
                            className="inline-flex items-center gap-1 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                            title="Remove manual from RAG index"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODULE: NHTSA SAFETY RECALLS & 10-K WARRANTY METRICS */}
      {activeModule === 'safety' && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>NHTSA Safety & Corporate 10-K Intelligence</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">auto_service.nhtsa_recalls</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">auto_service.oem_financial_metrics</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Fleet Safety Recalls & OEM Warranty Analytics</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                  Real-time synchronization between public NHTSA Office of Defects Investigation (ODI) data, factory safety recall campaigns, and SEC EDGAR Form 10-K audited warranty reserve liabilities.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadSafetyData}
                  disabled={isLoadingSafety}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSafety ? 'animate-spin text-blue-600' : ''}`} />
                  <span>Refresh BigQuery Cache</span>
                </button>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Safety Recalls Loaded</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                  {nhtsaRecalls.length}
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  <span>auto_service.nhtsa_recalls</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">ODI Complaints Indexed</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                  {nhtsaComplaints.length}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>auto_service.nhtsa_complaints</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Tracked OEM Warranty Spend</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                  $17.8B
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  SEC EDGAR 10-K Note 14/15
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Average Warranty % Rev</div>
                <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5 font-mono">
                  1.78%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  Benchmark: Toyota &lt;1.0%
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tabs & Make Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSafetySubTab('recalls')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  safetySubTab === 'recalls'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                NHTSA Recalls ({nhtsaRecalls.filter((r) => safetyFilterMake === 'All' || (r.vehicle_make || '').toLowerCase().includes(safetyFilterMake.toLowerCase())).length})
              </button>
              <button
                onClick={() => setSafetySubTab('complaints')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  safetySubTab === 'complaints'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                ODI Complaints ({nhtsaComplaints.filter((c) => safetyFilterMake === 'All' || (c.vehicle_make || '').toLowerCase().includes(safetyFilterMake.toLowerCase())).length})
              </button>
              <button
                onClick={() => setSafetySubTab('financial')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  safetySubTab === 'financial'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                OEM 10-K Financials ({oemFinancialMetrics.length})
              </button>
              <button
                onClick={() => setSafetySubTab('terms')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  safetySubTab === 'terms'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Terms of Use & Compliance
              </button>
            </div>

            {/* Vehicle Make Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Make:</span>
              {['All', 'Ford', 'Toyota', 'Tesla', 'Honda', 'Chevrolet', 'Harsh Patel'].map((m) => (
                <button
                  key={m}
                  onClick={() => setSafetyFilterMake(m)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                    safetyFilterMake === m
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: NHTSA SAFETY RECALLS */}
          {safetySubTab === 'recalls' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Showing official safety recall campaigns registered with NHTSA Office of Defects Investigation</span>
                <span className="font-mono text-[11px]">BigQuery Table: auto_service.nhtsa_recalls</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nhtsaRecalls
                  .filter((r) => safetyFilterMake === 'All' || (r.vehicle_make || '').toLowerCase().includes(safetyFilterMake.toLowerCase()))
                  .map((recall, idx) => (
                    <div
                      key={`recall-${recall.recall_id || recall.nhtsa_campaign_number}-${idx}`}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-amber-400 dark:hover:border-amber-500/50 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Campaign #{recall.nhtsa_campaign_number}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-mono text-slate-400 mr-1">
                              {recall.recall_date}
                            </span>
                            <button
                              onClick={() => {
                                setEditingRecall({ ...recall });
                                setShowEditRecallModal(true);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors cursor-pointer"
                              title="Edit this recall"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteRecall(recall.recall_id || recall.nhtsa_campaign_number, e)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors cursor-pointer"
                              title="Delete this recall"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {recall.vehicle_make} {recall.vehicle_model} ({recall.model_year})
                        </h3>

                        <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 mb-2">
                          Component: {recall.component}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                          {recall.summary}
                        </p>

                        {recall.consequence && (
                          <div className="p-2.5 bg-red-50/60 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 rounded-lg text-xs text-red-700 dark:text-red-300 mb-3">
                            <strong className="block text-[10px] uppercase tracking-wider mb-0.5 text-red-800 dark:text-red-400">
                              Safety Consequence / Risk:
                            </strong>
                            <span>{recall.consequence}</span>
                          </div>
                        )}

                        {recall.corrective_action && (
                          <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                            <strong className="block text-[10px] uppercase tracking-wider mb-0.5 text-emerald-700 dark:text-emerald-400">
                              Factory Remedy / Corrective Action:
                            </strong>
                            <span>{recall.corrective_action}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Potentially Affected: <strong className="text-slate-700 dark:text-slate-200 font-mono">{recall.potential_units_affected ? Number(recall.potential_units_affected).toLocaleString() : 'N/A'}</strong> units</span>
                        <span className="font-mono text-[10px] truncate max-w-[180px]">17 U.S.C. § 105 Public</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 2: ODI CONSUMER COMPLAINTS */}
          {safetySubTab === 'complaints' && (
            <div className="space-y-4">
              {/* Header with Cluster View Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>NHTSA Consumer Defect Telematics & Symptom Clustering</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Embed complaint narratives to group unstructured customer symptoms into root cause clusters
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium self-start sm:self-auto">
                  <button
                    onClick={() => setComplaintViewMode('raw')}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                      complaintViewMode === 'raw'
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Raw Stream ({nhtsaComplaints.filter((c) => safetyFilterMake === 'All' || (c.vehicle_make || '').toLowerCase().includes(safetyFilterMake.toLowerCase())).length})
                  </button>
                  <button
                    onClick={() => {
                      setComplaintViewMode('clusters');
                      fetchComplaintClusters(safetyFilterMake);
                    }}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      complaintViewMode === 'clusters'
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Semantic Symptom Clusters</span>
                  </button>
                </div>
              </div>

              {/* CLUSTER VIEW */}
              {complaintViewMode === 'clusters' && (
                <div className="space-y-4">
                  {isLoadingClusters ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <div className="text-xs text-slate-500 font-medium">Clustering complaint narratives using vector embeddings...</div>
                    </div>
                  ) : complaintClusters.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <p className="text-xs text-slate-500">No clusters found for selected make. Click to refresh or choose another make.</p>
                      <button
                        onClick={() => fetchComplaintClusters(safetyFilterMake)}
                        className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium cursor-pointer"
                      >
                        Run Cluster Analysis
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {complaintClusters.map((cluster) => (
                        <div
                          key={cluster.clusterId}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-blue-400 dark:hover:border-blue-500 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                cluster.severity.includes('Critical')
                                  ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900'
                                  : cluster.severity.includes('High')
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                              }`}>
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>{cluster.severity.split('-')[0].trim()} Priority</span>
                              </span>

                              <div className="text-right">
                                <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                                  {cluster.complaintCount} Reports ({cluster.percentage}%)
                                </span>
                              </div>
                            </div>

                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                              {cluster.title}
                            </h3>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5 mb-2">
                              System: {cluster.category}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mb-3">
                              {cluster.associatedDtc?.map((code: string) => (
                                <span
                                  key={code}
                                  className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  DTC {code}
                                </span>
                              ))}
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {cluster.associatedManual}
                              </span>
                            </div>

                            {/* Recommended Factory Action */}
                            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 mb-3 leading-relaxed">
                              <strong className="block text-[10px] uppercase tracking-wider mb-0.5 text-emerald-700 dark:text-emerald-400">
                                Factory Root Cause / Corrective Service:
                              </strong>
                              <span>{cluster.recommendedRemedy}</span>
                            </div>

                            {/* Sample Customer Quotes */}
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                Representative Customer Complaints:
                              </div>
                              {cluster.sampleComplaints?.map((samp: any) => (
                                <div
                                  key={samp.odiNumber}
                                  className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800"
                                >
                                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                                    <span className="font-bold text-blue-600 dark:text-blue-400">ODI #{samp.odiNumber}</span>
                                    <span>{samp.model}</span>
                                  </div>
                                  <p className="italic text-[11px]">"{samp.summarySnippet}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* RAW COMPLAINTS STREAM */}
              {complaintViewMode === 'raw' && (
                <div className="space-y-3">
                  {nhtsaComplaints
                    .filter((c) => safetyFilterMake === 'All' || (c.vehicle_make || '').toLowerCase().includes(safetyFilterMake.toLowerCase()))
                    .map((comp, idx) => (
                      <div
                        key={`comp-${comp.odi_number}-${idx}`}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-blue-400 dark:hover:border-blue-500/50 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                            ODI #{comp.odi_number}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {comp.vehicle_make} {comp.vehicle_model} ({comp.model_year})
                          </span>
                          <span className="text-xs text-slate-500 font-medium">· {comp.components}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {comp.crash && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                              CRASH REPORTED
                            </span>
                          )}
                          {comp.fire && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                              FIRE REPORTED
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-slate-400">
                            Filed: {comp.date_complaint_filed || 'Recent'}
                          </span>
                          <button
                            onClick={() => {
                              setEditingComplaint({ ...comp });
                              setShowEditComplaintModal(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
                            title="Edit this complaint"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteComplaint(comp.odi_number, e)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors cursor-pointer"
                            title="Delete this complaint"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        "{comp.summary}"
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Injuries: <strong className="font-mono text-slate-600 dark:text-slate-300">{comp.number_of_injuries}</strong> | Fatalities: <strong className="font-mono text-slate-600 dark:text-slate-300">{comp.number_of_deaths}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: OEM 10-K FINANCIAL METRICS */}
          {safetySubTab === 'financial' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Audited corporate financial figures from SEC EDGAR Form 10-K / 20-F (Note 14/15/23 on Product Warranties)</span>
                <span className="font-mono text-[11px]">BigQuery Table: auto_service.oem_financial_metrics</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">OEM & Ticker</th>
                      <th className="py-3 px-3">FY</th>
                      <th className="py-3 px-3">Automotive Rev</th>
                      <th className="py-3 px-3">Net Income</th>
                      <th className="py-3 px-3">Warranty Accrual</th>
                      <th className="py-3 px-3">Claims Paid</th>
                      <th className="py-3 px-3">Warranty % Rev</th>
                      <th className="py-3 px-3">R&D Spend</th>
                      <th className="py-3 px-4">Primary Warranty Cost Drivers</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                    {oemFinancialMetrics.map((oem, idx) => (
                      <tr key={oem.oem_ticker + oem.fiscal_year || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{oem.oem_name}</div>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold">
                            {oem.oem_ticker}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-medium">{oem.fiscal_year}</td>
                        <td className="py-3 px-3 font-mono font-semibold">${oem.total_revenue_usd_billion}B</td>
                        <td className={`py-3 px-3 font-mono font-semibold ${oem.net_income_usd_billion >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                          ${oem.net_income_usd_billion}B
                        </td>
                        <td className="py-3 px-3 font-mono">${Number(oem.warranty_accrual_expense_usd_million).toLocaleString()}M</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          ${Number(oem.warranty_claims_paid_usd_million).toLocaleString()}M
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${
                              oem.warranty_as_pct_of_revenue < 1.2
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : oem.warranty_as_pct_of_revenue < 2.0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {oem.warranty_as_pct_of_revenue}%
                            </span>
                            <div className="w-12 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full ${
                                  oem.warranty_as_pct_of_revenue < 1.2
                                    ? 'bg-emerald-500'
                                    : oem.warranty_as_pct_of_revenue < 2.0
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, (oem.warranty_as_pct_of_revenue / 3) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono">${oem.rd_expense_usd_billion}B</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">
                          {oem.primary_recall_impact_notes}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingMetric({ ...oem });
                                setShowEditMetricModal(true);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
                              title="Edit this OEM financial record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteMetric(oem.oem_ticker, e)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors cursor-pointer"
                              title="Delete this OEM financial record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-slate-700 dark:text-slate-300">
                <strong>Executive RAG ROI Insight</strong>: Automotive OEMs spend between 1.0% and 2.7% of total revenue ($3B–$4.8B per OEM annually) on warranty claims. Misdiagnosis and unwarranted parts swapping account for an estimated 15%–22% of service bay losses. Deploying an accurate, zero-hallucination RAG diagnostic system directly curbs unnecessary component replacements.
              </div>
            </div>
          )}

          {/* TAB 4: TERMS OF USE & LEGAL COMPLIANCE */}
          {safetySubTab === 'terms' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Audited legal frameworks, copyright exemptions, and terms of service</span>
                <span className="font-mono text-[11px]">docs/DATA_SOURCES_TERMS_OF_USE.md</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">NHTSA Public API</h4>
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                      17 U.S.C. § 105 · Public Domain
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1.5">
                      Works of the United States Government are not subject to copyright protection within the U.S. All safety defect investigations, recalls, and consumer complaint records reside in the public domain.
                    </p>
                    <ul className="text-xs text-slate-500 dark:text-slate-400 mt-3 space-y-1">
                      <li>• User-Agent header required on requests</li>
                      <li>• 200–500ms API politeness backoff enforced</li>
                      <li>• No official government endorsement claimed</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 font-mono text-[10px] text-slate-400">
                    Source: api.nhtsa.gov
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">SEC EDGAR 10-K Data</h4>
                    </div>
                    <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mb-2">
                      Securities Exchange Act of 1934
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1.5">
                      Statutory regulatory disclosures filed by publicly traded corporations. Financial statements, footnote tables, and warranty reserve disclosures are public records intended for open financial analysis.
                    </p>
                    <ul className="text-xs text-slate-500 dark:text-slate-400 mt-3 space-y-1">
                      <li>• Compliant with SEC Fair Access policy</li>
                      <li>• Max 10 requests per second rate limit</li>
                      <li>• Declares developer contact in request header</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 font-mono text-[10px] text-slate-400">
                    Source: sec.gov/edgar
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">OEM Workshop Manuals</h4>
                    </div>
                    <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mb-2">
                      Right to Repair · 40 CFR Part 86
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1.5">
                      Clean Air Act § 202(m) and state Right to Repair statutes mandate that automotive manufacturers provide diagnostic trouble code trees and service info to independent repair facilities.
                    </p>
                    <ul className="text-xs text-slate-500 dark:text-slate-400 mt-3 space-y-1">
                      <li>• Transformative factual extraction (17 U.S.C. § 107)</li>
                      <li>• Extracts torque specs &amp; pinout voltages</li>
                      <li>• ASE master technician verification required</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 font-mono text-[10px] text-slate-400">
                    Source: OEM PTS / TIS / ACDelco TDS
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODULE 3: TECHNICIAN CHATBOT */}
      {activeModule === 'chat' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>
                <strong>Mechanic Conversational Assistant</strong>: Pre-loaded with ASE Master Technician instructions for interactive diagnostic troubleshooting.
              </span>
            </span>
            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">gemini-3.8-flash</span>
          </div>
          <ChatPlayground
            model={model}
            setModel={setModel}
            systemInstruction={
              systemInstruction ||
              'You are an ASE Master Certified Automotive Diagnostic Specialist and Shop Foreman. Provide authoritative root-cause analysis, wiring check sequences, and factory torque specs.'
            }
          />
        </div>
      )}

      {/* MODULE 4: PARTS & SERVICE MAPS GROUNDING */}
      {activeModule === 'grounding' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>
                <strong>Automotive Service Grounding</strong>: Locate authorized dealerships, OEM parts suppliers, and salvage yards grounded by Google Maps.
              </span>
            </span>
            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">gemini-3.8-flash + googleMaps</span>
          </div>
          <GroundingStudio />
        </div>
      )}

      {/* MODULE 5: MULTIMODAL WORKBENCH */}
      {activeModule === 'workbench' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>
                <strong>Diagnostic Multimodal Workbench</strong>: Upload oscilloscope waveforms, bore-scope images, or worn spark plug photos for direct Gemini visual diagnosis.
              </span>
            </span>
            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">Multimodal Vision</span>
          </div>
          <Workbench
            model={model}
            setModel={setModel}
            systemInstruction={systemInstruction}
            setSystemInstruction={setSystemInstruction}
            thinkingLevel={thinkingLevel}
            setThinkingLevel={setThinkingLevel}
            prompt={prompt}
            setPrompt={setPrompt}
            responseFormat={responseFormat}
            setResponseFormat={setResponseFormat}
            imageBase64={imageBase64}
            setImageBase64={setImageBase64}
            isExecuting={isExecuting}
            onExecute={onExecute}
            lastResponse={lastResponse}
            error={parentError}
            user={user}
            onRequireAuth={onRequireAuth}
            onRecordQuota={onRecordQuota}
          />
        </div>
      )}

      {/* MODULE 6: 3D POWERTRAIN SIMULATION */}
      {activeModule === 'simulation' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-600" />
              <span>
                <strong>3D Component Simulation Lab</strong>: Real-time Three.js spatial simulation for inspecting high-voltage battery modules, engine blocks, and sensor arrays.
              </span>
            </span>
            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">Three.js WebGL</span>
          </div>
          <ThreeGame user={user} onRequireAuth={onRequireAuth} />
        </div>
      )}

      {/* MODULE 7: REPAIR VIDEO STUDIO */}
      {activeModule === 'video' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-600" />
              <span>
                <strong>Component Animation Studio</strong>: Generate technical mechanical video animations and step-by-step repair explainers using Gemini Omni Flash.
              </span>
            </span>
            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">gemini-omni-1.1-flash</span>
          </div>
          <VideoStudio />
        </div>
      )}

      {/* MODULE 8: QUOTAS & MODELS MATRIX */}
      {activeModule === 'quotas' && (
        <div className="space-y-6">
          <QuotaTracker quotaState={quotaState} onResetSessionQuota={onResetSessionQuota} />
          <ModelMatrix onSelectModelForWorkbench={onSelectModelFromMatrix} />
        </div>
      )}

      {/* MODULE 9: SDK & SQL EXPORT */}
      {activeModule === 'code' && (
        <div className="space-y-4">
          <CodeExport
            model={model}
            systemInstruction={systemInstruction}
            thinkingLevel={thinkingLevel}
            prompt={prompt}
            responseFormat={responseFormat}
          />
        </div>
      )}

      {/* MODULE 10: GCP SETUP, CLI & LEAST-PRIVILEGE IAM */}
      {activeModule === 'cloud' && (
        <div className="space-y-6">
          {/* GCP CLI Architecture Card */}
          <div className="p-5 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 space-y-4 font-mono text-xs shadow-lg">
            <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
              <span className="flex items-center gap-2 font-semibold text-white">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Google Cloud Production Architecture for Auto Service RAG
              </span>
              <span className="text-[11px] text-blue-400 font-medium">9 Services + Least-Privilege IAM</span>
            </div>

            <div className="bg-black/70 p-3.5 rounded-lg space-y-2 text-emerald-400 overflow-x-auto text-[11px]">
              <div># 1. Authenticate with Google Cloud</div>
              <div className="text-white">gcloud auth login</div>
              <div className="text-white">gcloud auth application-default login</div>

              <div className="pt-1.5 text-emerald-400"># 2. Create the Auto Service RAG Google Cloud Project</div>
              <div className="text-white">gcloud projects create auto-service-rag-prod --name="Auto Service RAG"</div>

              <div className="pt-1.5 text-emerald-400"># 3. Set as active project in your CLI context</div>
              <div className="text-white">gcloud config set project auto-service-rag-prod</div>

              <div className="pt-1.5 text-emerald-400"># 4. Enable Google Cloud APIs for RAG, Vector Search, Storage & Containers</div>
              <div className="text-amber-300 leading-relaxed">
                gcloud services enable aiplatform.googleapis.com bigquery.googleapis.com \<br />
                &nbsp;&nbsp;storage.googleapis.com run.googleapis.com artifactregistry.googleapis.com \<br />
                &nbsp;&nbsp;cloudbuild.googleapis.com secretmanager.googleapis.com \<br />
                &nbsp;&nbsp;logging.googleapis.com cloudtrace.googleapis.com
              </div>

              <div className="pt-1.5 text-emerald-400"># 5. Set default compute region (us-central1)</div>
              <div className="text-white">gcloud config set compute/region us-central1</div>

              <div className="pt-1.5 text-emerald-400"># 6. Create Cloud Storage bucket for OEM Workshop Manuals & TSBs</div>
              <div className="text-cyan-300">
                gcloud storage buckets create gs://auto-service-rag-prod-manuals \<br />
                &nbsp;&nbsp;--location=us-central1 --uniform-bucket-level-access
              </div>

              <div className="pt-1.5 text-emerald-400"># 7. Create BigQuery dataset for RAG vector search & diagnostics</div>
              <div className="text-cyan-300">
                bq --location=US mk --dataset auto-service-rag-prod:auto_service
              </div>

              <div className="pt-1.5 text-emerald-400"># 8. Create least-privilege runtime service account & bind IAM roles</div>
              <div className="text-amber-300 leading-relaxed">
                gcloud iam service-accounts create api-runtime --display-name="API runtime"<br />
                for R in roles/aiplatform.user roles/bigquery.dataViewer roles/bigquery.jobUser roles/storage.objectViewer; do<br />
                &nbsp;&nbsp;gcloud projects add-iam-policy-binding auto-service-rag-prod \<br />
                &nbsp;&nbsp;&nbsp;&nbsp;--member="serviceAccount:api-runtime@auto-service-rag-prod.iam.gserviceaccount.com" \<br />
                &nbsp;&nbsp;&nbsp;&nbsp;--role=$R<br />
                done
              </div>

              <div className="pt-1.5 text-emerald-400"># 9. Deploy container to Cloud Run with api-runtime Service Account</div>
              <div className="text-white">
                gcloud run deploy auto-service-rag \<br />
                &nbsp;&nbsp;--image=us-central1-docker.pkg.dev/auto-service-rag-prod/app/service:latest \<br />
                &nbsp;&nbsp;--service-account=api-runtime@auto-service-rag-prod.iam.gserviceaccount.com \<br />
                &nbsp;&nbsp;--region=us-central1 --allow-unauthenticated
              </div>

              <div className="pt-1.5 text-emerald-400"># 10. Python Smoke Test via Vertex AI</div>
              <div className="text-cyan-300">
                pip install google-genai<br />
                python3 smoke_test.py auto-service-rag-prod
              </div>
            </div>

            {/* Least-Privilege IAM Roles Cards */}
            <div className="pt-2 font-sans border-t border-slate-800">
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Least-Privilege IAM Roles for <code className="text-emerald-400 font-mono">api-runtime</code>:</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="font-mono text-amber-300 font-semibold block text-[10px]">roles/aiplatform.user</span>
                  <span className="text-slate-400">Run Gemini inference & generate text embeddings</span>
                </div>
                <div className="p-2 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="font-mono text-amber-300 font-semibold block text-[10px]">roles/bigquery.dataViewer</span>
                  <span className="text-slate-400">Read-only access to auto_service.manual_chunks</span>
                </div>
                <div className="p-2 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="font-mono text-amber-300 font-semibold block text-[10px]">roles/bigquery.jobUser</span>
                  <span className="text-slate-400">Execute BigQuery VECTOR_SEARCH jobs</span>
                </div>
                <div className="p-2 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="font-mono text-amber-300 font-semibold block text-[10px]">roles/storage.objectViewer</span>
                  <span className="text-slate-400">Read OEM PDFs from gs://PROJECT_ID-manuals</span>
                </div>
              </div>
            </div>
          </div>

          <SetupGuide />
        </div>
      )}

      {/* Manual Ingestion Modal (PDF Upload + Manual Text Entry) */}
      {showIngestModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Factory Workshop Manual
                </h3>
              </div>
              <button
                onClick={() => {
                  handleCancelUpload();
                  setShowIngestModal(false);
                  setUploadError(null);
                  setUploadExtractedSummary(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 text-xs">
              <button
                type="button"
                onClick={() => setIngestMode('upload')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  ingestMode === 'upload'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload PDF Manual (AI Auto-Extract)</span>
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('manual')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  ingestMode === 'manual'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Type / Paste Text</span>
              </button>
            </div>

            {/* Tab 1: PDF Document Upload */}
            {ingestMode === 'upload' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-1">Make (Optional Override)</label>
                    <input
                      type="text"
                      value={ingestMake}
                      onChange={(e) => setIngestMake(e.target.value)}
                      placeholder="e.g. Ford, Toyota, Tesla"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Model (Optional Override)</label>
                    <input
                      type="text"
                      value={ingestModel}
                      onChange={(e) => setIngestModel(e.target.value)}
                      placeholder="e.g. F-150, Model 3"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Direct 1-Click Manual Creation from Make/Model */}
                <div className="flex items-center justify-between p-2.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-xs">
                  <div className="flex flex-col pr-2">
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                      Create manual directly for {ingestMake || 'Make'} {ingestModel || 'Model'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Instantly saves to custom_manuals.json & autoRagEngine.ts with full wiring & torque specs
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickCreateManual}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save {ingestMake || 'Vehicle'} {ingestModel || 'Manual'}</span>
                  </button>
                </div>

                {/* Drag and Drop Upload Zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    isUploadingPdf
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <input
                    type="file"
                    id="manual-file-input"
                    accept=".pdf,.txt,.md"
                    className="hidden"
                    disabled={isUploadingPdf}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />

                  {isUploadingPdf ? (
                    <div className="space-y-3 py-3">
                      <div className="w-10 h-10 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin mx-auto" />
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Analyzing {uploadFile?.name || 'Manual'} with Gemini 3.8 Flash...
                      </p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                        {uploadStage}
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                        Extracting vehicle make/model, DTC codes, diagnostic testing procedures, and bolt torque specifications.
                      </p>
                      <button
                        type="button"
                        onClick={handleCancelUpload}
                        className="mt-2 px-3 py-1 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                      >
                        Cancel Upload
                      </button>
                    </div>
                  ) : ingestSuccess && uploadExtractedSummary ? (
                    <div className="space-y-2 py-3 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto" />
                      <p className="text-xs font-bold">Successfully Parsed and Indexed into RAG!</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                        {uploadExtractedSummary.title || 'OEM Service Manual'}
                      </p>
                    </div>
                  ) : (
                    <label
                      htmlFor="manual-file-input"
                      className="cursor-pointer space-y-2 block"
                    >
                      <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                          Click to upload PDF manual
                        </span>{' '}
                        <span className="text-slate-500">or drag and drop here</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Supports OEM Service Manuals in PDF, Markdown (.md), or Plain Text (.txt) up to 20MB
                      </p>
                    </label>
                  )}
                </div>

                {uploadError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs space-y-2">
                    <div className="text-red-700 dark:text-red-300 font-medium">{uploadError}</div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (uploadFile) {
                            handleFileUpload(uploadFile);
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                      >
                        Retry Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIngestMode('manual');
                          setIngestTitle(uploadFile?.name?.replace(/\.[^/.]+$/, '') || 'Workshop Manual');
                          setUploadError(null);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                      >
                        Switch to Manual Ingestion
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                    How PDF Extraction Works:
                  </span>
                  <p>
                    Gemini 3.8 Flash reads the entire PDF workshop manual directly. It automatically extracts SAE J2012 OBD-II trouble codes, factory bolt torque specifications (Nm / ft-lb), and safety warnings without requiring you to type anything manually.
                  </p>
                </div>
              </div>
            ) : (
              /* Tab 2: Manual Text Ingestion */
              <form onSubmit={handleIngestSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-500 block mb-1">Make</label>
                    <input
                      type="text"
                      value={ingestMake}
                      onChange={(e) => setIngestMake(e.target.value)}
                      placeholder="e.g. Porsche, Audi, Ford"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Model</label>
                    <input
                      type="text"
                      value={ingestModel}
                      onChange={(e) => setIngestModel(e.target.value)}
                      placeholder="e.g. 911 GT3, F-150"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 block mb-1">Manual Title / Section (Optional)</label>
                  <input
                    type="text"
                    value={ingestTitle}
                    onChange={(e) => setIngestTitle(e.target.value)}
                    placeholder="e.g. u0003 Code - High-Speed CAN Communication Bus (+) KBB"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-500 block mb-1">Manual Text Content (Optional)</label>
                  <textarea
                    rows={5}
                    value={ingestContent}
                    onChange={(e) => setIngestContent(e.target.value)}
                    placeholder="Paste OEM technical service bulletin text, pinout diagrams, test voltages, and torque specifications..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 font-mono text-[11px] text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {ingestSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Indexed into RAG Store!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Segment & Index Manual into RAG Store</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Workshop Manual Modal */}
      {showEditModal && editingManual && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Workshop Manual
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    ID: {editingManual.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingManual(null);
                  setEditError(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-500 block mb-1">Make</label>
                  <input
                    type="text"
                    required
                    value={editMake}
                    onChange={(e) => setEditMake(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Model</label>
                  <input
                    type="text"
                    required
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Year Range</label>
                  <input
                    type="text"
                    value={editYearRange}
                    onChange={(e) => setEditYearRange(e.target.value)}
                    placeholder="e.g. 2018-2024"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 block mb-1">Vehicle System / Domain</label>
                  <input
                    type="text"
                    value={editSystem}
                    onChange={(e) => setEditSystem(e.target.value)}
                    placeholder="e.g. Engine Powertrain, High Voltage, Air Intake"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Section / TSB Code</label>
                  <input
                    type="text"
                    required
                    value={editSectionCode}
                    onChange={(e) => setEditSectionCode(e.target.value)}
                    placeholder="e.g. WSM 303-07A, TSB 21-2119"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Manual Document Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-900 dark:text-white font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">
                  SAE J2012 Diagnostic Trouble Codes (Comma Separated)
                </label>
                <input
                  type="text"
                  value={editDtcCodes}
                  onChange={(e) => setEditDtcCodes(e.target.value.toUpperCase())}
                  placeholder="e.g. P0300, P0301, P0016, B00A0"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 font-mono text-blue-600 dark:text-blue-400 font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-500">Fastener Torque Specs (JSON Object)</label>
                  <span className="text-[10px] text-slate-400 font-mono">key: Component, value: Torque spec</span>
                </div>
                <textarea
                  rows={3}
                  value={editTorqueSpecsText}
                  onChange={(e) => setEditTorqueSpecsText(e.target.value)}
                  placeholder='{\n  "Spark Plugs": "15 Nm (133 lb-in)"\n}'
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 font-mono text-[11px] text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">
                  Technical Diagnostic & Repair Procedures (Manual Content)
                </label>
                <textarea
                  required
                  rows={6}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Technical steps, pinout voltages, inspection criteria..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 font-mono text-[11px] text-slate-900 dark:text-white"
                />
              </div>

              {editError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300">
                  {editError}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingManual(null);
                  }}
                  className="px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isSavingEdit ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Manual Updates...</span>
                    </>
                  ) : editSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Manual Changes Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes & Update RAG Index</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Full Manual Content Modal */}
      {viewingManualContent && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {viewingManualContent.vehicleMake} {viewingManualContent.vehicleModel}
                  </span>
                  <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                    {viewingManualContent.yearRange}
                  </span>
                  <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400">
                    {viewingManualContent.sectionCode}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {viewingManualContent.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingManualContent(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1 text-xs">
              {/* DTCs */}
              {viewingManualContent.dtcCodes && viewingManualContent.dtcCodes.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Indexed Fault Codes:
                  </span>
                  {viewingManualContent.dtcCodes.map((dtc: string) => (
                    <span
                      key={dtc}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold"
                    >
                      {dtc}
                    </span>
                  ))}
                </div>
              )}

              {/* Fastener Torque Specs */}
              {viewingManualContent.torqueSpecs && Object.keys(viewingManualContent.torqueSpecs).length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-500" />
                    <span>Factory Torque Specifications</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(viewingManualContent.torqueSpecs).map(([comp, tq], idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px]"
                      >
                        <span className="text-slate-600 dark:text-slate-400 truncate mr-2">{comp}</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                          {String(tq)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Content */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Diagnostic Procedure & Technical Instructions:
                </span>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                  {viewingManualContent.content || 'No text content available.'}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const m = viewingManualContent;
                    setViewingManualContent(null);
                    handleStartEdit(m);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit This Manual</span>
                </button>
                <button
                  onClick={(e) => {
                    const m = viewingManualContent;
                    setViewingManualContent(null);
                    handleDeleteManual(m.id, m.title, e, m.vehicleMake, m.vehicleModel);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded border border-rose-200 dark:border-rose-900 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Manual</span>
                </button>
              </div>
              <button
                onClick={() => setViewingManualContent(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT SAVED DIAGNOSTIC TICKET (FIRESTORE) */}
      {showEditTicketModal && editingTicket && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Diagnostic Ticket
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    ID: {editingTicket.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditTicketModal(false);
                  setEditingTicket(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTicketEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Make</label>
                  <input
                    type="text"
                    value={editingTicket.vehicleMake}
                    onChange={(e) => setEditingTicket({ ...editingTicket, vehicleMake: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Model</label>
                  <input
                    type="text"
                    value={editingTicket.vehicleModel}
                    onChange={(e) => setEditingTicket({ ...editingTicket, vehicleModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Year</label>
                  <input
                    type="text"
                    value={editingTicket.vehicleYear}
                    onChange={(e) => setEditingTicket({ ...editingTicket, vehicleYear: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">DTC Code</label>
                  <input
                    type="text"
                    value={editingTicket.dtcCode}
                    onChange={(e) => setEditingTicket({ ...editingTicket, dtcCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
                  <select
                    value={editingTicket.status || 'open'}
                    onChange={(e) => setEditingTicket({ ...editingTicket, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Powertrain / Engine</label>
                <input
                  type="text"
                  value={editingTicket.engine}
                  onChange={(e) => setEditingTicket({ ...editingTicket, engine: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Observed Symptoms</label>
                <textarea
                  rows={2}
                  value={editingTicket.symptoms}
                  onChange={(e) => setEditingTicket({ ...editingTicket, symptoms: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => {
                    handleDeleteTicket(e, editingTicket.id);
                    setShowEditTicketModal(false);
                    setEditingTicket(null);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-950 dark:text-red-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Ticket</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditTicketModal(false);
                      setEditingTicket(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTicketEdit}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isSavingTicketEdit ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Updates</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT NHTSA RECALL */}
      {showEditRecallModal && editingRecall && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Safety Recall Campaign
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Campaign #{editingRecall.nhtsa_campaign_number}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditRecallModal(false);
                  setEditingRecall(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecallEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Make</label>
                  <input
                    type="text"
                    value={editingRecall.vehicle_make}
                    onChange={(e) => setEditingRecall({ ...editingRecall, vehicle_make: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Model</label>
                  <input
                    type="text"
                    value={editingRecall.vehicle_model}
                    onChange={(e) => setEditingRecall({ ...editingRecall, vehicle_model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Year</label>
                  <input
                    type="number"
                    value={editingRecall.model_year}
                    onChange={(e) => setEditingRecall({ ...editingRecall, model_year: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Component</label>
                <input
                  type="text"
                  value={editingRecall.component}
                  onChange={(e) => setEditingRecall({ ...editingRecall, component: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Defect Summary</label>
                <textarea
                  rows={2}
                  value={editingRecall.summary}
                  onChange={(e) => setEditingRecall({ ...editingRecall, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Safety Risk / Consequence</label>
                <textarea
                  rows={2}
                  value={editingRecall.consequence}
                  onChange={(e) => setEditingRecall({ ...editingRecall, consequence: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Factory Remedy / Corrective Action</label>
                <textarea
                  rows={2}
                  value={editingRecall.corrective_action}
                  onChange={(e) => setEditingRecall({ ...editingRecall, corrective_action: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteRecall(editingRecall.recall_id || editingRecall.nhtsa_campaign_number);
                    setShowEditRecallModal(false);
                    setEditingRecall(null);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-950 dark:text-red-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Recall</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditRecallModal(false);
                      setEditingRecall(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Updates</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT NHTSA COMPLAINT */}
      {showEditComplaintModal && editingComplaint && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Consumer Defect Complaint
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    ODI #{editingComplaint.odi_number}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditComplaintModal(false);
                  setEditingComplaint(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveComplaintEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Components</label>
                  <input
                    type="text"
                    value={editingComplaint.components}
                    onChange={(e) => setEditingComplaint({ ...editingComplaint, components: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Injuries Count</label>
                  <input
                    type="number"
                    value={editingComplaint.number_of_injuries}
                    onChange={(e) => setEditingComplaint({ ...editingComplaint, number_of_injuries: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 py-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingComplaint.crash || false}
                    onChange={(e) => setEditingComplaint({ ...editingComplaint, crash: e.target.checked })}
                    className="rounded text-red-600"
                  />
                  <span>Crash Occurred</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingComplaint.fire || false}
                    onChange={(e) => setEditingComplaint({ ...editingComplaint, fire: e.target.checked })}
                    className="rounded text-orange-600"
                  />
                  <span>Fire Reported</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Complaint Narrative</label>
                <textarea
                  rows={4}
                  value={editingComplaint.summary}
                  onChange={(e) => setEditingComplaint({ ...editingComplaint, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-sans"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteComplaint(editingComplaint.odi_number);
                    setShowEditComplaintModal(false);
                    setEditingComplaint(null);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-950 dark:text-red-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Complaint</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditComplaintModal(false);
                      setEditingComplaint(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Updates</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT OEM 10-K FINANCIAL METRICS */}
      {showEditMetricModal && editingMetric && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit OEM 10-K Warranty Reserves
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    {editingMetric.oem_name} ({editingMetric.oem_ticker})
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditMetricModal(false);
                  setEditingMetric(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMetricEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Fiscal Year</label>
                  <input
                    type="number"
                    value={editingMetric.fiscal_year}
                    onChange={(e) => setEditingMetric({ ...editingMetric, fiscal_year: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Auto Rev ($B)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingMetric.total_revenue_usd_billion}
                    onChange={(e) => setEditingMetric({ ...editingMetric, total_revenue_usd_billion: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Net Income ($B)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingMetric.net_income_usd_billion}
                    onChange={(e) => setEditingMetric({ ...editingMetric, net_income_usd_billion: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Warranty Accrual ($M)</label>
                  <input
                    type="number"
                    value={editingMetric.warranty_accrual_expense_usd_million}
                    onChange={(e) => setEditingMetric({ ...editingMetric, warranty_accrual_expense_usd_million: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Claims Paid ($M)</label>
                  <input
                    type="number"
                    value={editingMetric.warranty_claims_paid_usd_million}
                    onChange={(e) => setEditingMetric({ ...editingMetric, warranty_claims_paid_usd_million: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Warranty % Rev</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingMetric.warranty_as_pct_of_revenue}
                    onChange={(e) => setEditingMetric({ ...editingMetric, warranty_as_pct_of_revenue: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Primary Warranty Cost Drivers</label>
                <textarea
                  rows={3}
                  value={editingMetric.primary_recall_impact_notes}
                  onChange={(e) => setEditingMetric({ ...editingMetric, primary_recall_impact_notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteMetric(editingMetric.oem_ticker);
                    setShowEditMetricModal(false);
                    setEditingMetric(null);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-950 dark:text-red-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Record</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditMetricModal(false);
                      setEditingMetric(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Updates</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: EDIT RAG DIAGNOSTIC REPORT */}
      {isEditingReport && result && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Diagnostic Report
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Modify root cause analysis, repair steps, or torque notes
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsEditingReport(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 flex flex-col space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Diagnostic Markdown Content
              </label>
              <textarea
                value={reportEditText}
                onChange={(e) => setReportEditText(e.target.value)}
                rows={16}
                className="w-full flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setIsEditingReport(false);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-950 dark:text-red-400 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Report</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingReport(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResult({ ...result, diagnosis: reportEditText });
                    setIsEditingReport(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Report Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
