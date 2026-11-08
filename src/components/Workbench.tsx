import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Brain,
  FileCode,
  Image as ImageIcon,
  Copy,
  Check,
  RotateCcw,
  Clock,
  Coins,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Edit3,
  X,
  ClipboardList,
  Save
} from 'lucide-react';
import { GenerateResponse, UsageMetadata } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, deleteDoc, updateDoc, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';

interface WorkbenchProps {
  model: string;
  setModel: (m: string) => void;
  systemInstruction: string;
  setSystemInstruction: (s: string) => void;
  thinkingLevel: string;
  setThinkingLevel: (l: string) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  responseFormat: string;
  setResponseFormat: (f: string) => void;
  imageBase64: string | null;
  setImageBase64: (img: string | null) => void;
  isExecuting: boolean;
  onExecute: () => void;
  lastResponse: GenerateResponse | null;
  error: string | null;
  onRecordQuota: (tokens: number) => void;
  user: any;
  onRequireAuth: () => void;
}

const SAMPLE_IMAGE_PATH = '/src/assets/images/multimodal_sample_photo_1793739389613.jpg';

export const Workbench: React.FC<WorkbenchProps> = ({
  model,
  setModel,
  systemInstruction,
  setSystemInstruction,
  thinkingLevel,
  setThinkingLevel,
  prompt,
  setPrompt,
  responseFormat,
  setResponseFormat,
  imageBase64,
  setImageBase64,
  isExecuting,
  onExecute,
  lastResponse,
  error,
  user,
  onRequireAuth,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showJsonSchema, setShowJsonSchema] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<any[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);
  const [showEditPromptModal, setShowEditPromptModal] = useState(false);
  const [promptNotification, setPromptNotification] = useState<string | null>(null);
  const [isOutputCleared, setIsOutputCleared] = useState(false);

  // Subscribe to user's saved prompts in Firestore
  useEffect(() => {
    if (!user) {
      setSavedPrompts([]);
      return;
    }
    try {
      const q = query(
        collection(db, 'savedPrompts'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
          setSavedPrompts(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'savedPrompts')
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn('Error subscribing to saved prompts:', e);
    }
  }, [user]);

  const handleDeleteSavedPrompt = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      if (user) {
        await deleteDoc(doc(db, 'savedPrompts', id));
      }
      setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
      setPromptNotification('Saved prompt deleted.');
      setTimeout(() => setPromptNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'savedPrompts');
      setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleClearAllSavedPrompts = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      if (user) {
        for (const p of savedPrompts) {
          try {
            await deleteDoc(doc(db, 'savedPrompts', p.id));
          } catch {
            // continue
          }
        }
      }
      setSavedPrompts([]);
      setPromptNotification('All saved prompts deleted.');
      setTimeout(() => setPromptNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'savedPrompts');
      setSavedPrompts([]);
    }
  };

  const handleSavePromptEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrompt) return;
    try {
      if (user) {
        await updateDoc(doc(db, 'savedPrompts', editingPrompt.id), {
          title: editingPrompt.title,
          prompt: editingPrompt.prompt,
          systemInstruction: editingPrompt.systemInstruction || '',
          model: editingPrompt.model || 'gemini-3.8-flash',
          thinkingLevel: editingPrompt.thinkingLevel || 'MEDIUM',
        });
      }
      setSavedPrompts((prev) =>
        prev.map((p) => (p.id === editingPrompt.id ? { ...editingPrompt } : p))
      );
      setShowEditPromptModal(false);
      setEditingPrompt(null);
      setPromptNotification('Prompt updated successfully.');
      setTimeout(() => setPromptNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'savedPrompts');
    }
  };

  const handleSaveToFirestore = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!prompt.trim()) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'savedPrompts'), {
        id: `prompt_${Date.now()}`,
        userId: user.uid,
        title: prompt.slice(0, 45).trim() + (prompt.length > 45 ? '...' : ''),
        prompt: prompt.trim(),
        model,
        systemInstruction: systemInstruction || '',
        thinkingLevel: thinkingLevel || 'MEDIUM',
        createdAt: new Date().toISOString(),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'savedPrompts');
    } finally {
      setIsSaving(false);
    }
  };
  const [jsonSchema, setJsonSchema] = useState(`{
  "type": "OBJECT",
  "properties": {
    "summary": { "type": "STRING" },
    "key_takeaways": { "type": "ARRAY", "items": { "type": "STRING" } },
    "confidence_score": { "type": "NUMBER" }
  },
  "required": ["summary", "key_takeaways"]
}`);

  const handleCopy = () => {
    if (!lastResponse?.text) return;
    navigator.clipboard.writeText(lastResponse.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadSampleImage = async () => {
    try {
      const res = await fetch(SAMPLE_IMAGE_PATH);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
        if (!prompt || prompt.includes('Quantum')) {
          setPrompt('Identify this plant specimen, describe its venation patterns, and explain how fenestration benefits the species in nature.');
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('Error loading sample image', e);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const presetPrompts = [
    {
      title: 'Multimodal Plant Analysis',
      action: () => handleLoadSampleImage(),
    },
    {
      title: 'Quantum Computing Analogy',
      action: () => {
        setImageBase64(null);
        setPrompt('Explain quantum superposition and entanglement using an analogy with a coin flip, suitable for a 12-year-old.');
      },
    },
    {
      title: 'JSON Extraction',
      action: () => {
        setImageBase64(null);
        setResponseFormat('json');
        setShowJsonSchema(true);
        setPrompt('Extract key details from this customer note: "Customer Alex Chen called on Nov 3 regarding invoice #9401 for $450. Promised callback within 24 hours."');
      },
    },
    {
      title: 'TypeScript Performance Audit',
      action: () => {
        setImageBase64(null);
        setPrompt('Review this code and suggest 3 high-impact performance optimizations:\n\nfunction findDuplicates(arr: number[]): number[] {\n  return arr.filter((item, index) => arr.indexOf(item) !== index);\n}');
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Strip with Clean Unboxed Context */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Google Account Free Tier</span>
              <span aria-hidden="true">·</span>
              <span>No Credit Card Required</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">15 RPM & 1,000,000 TPM Free</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Gemini API Playground & Free Tier Workbench
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
              Execute live multimodal prompts, tune reasoning depth via Thinking Level, and extract structured JSON directly using the official server-side @google/genai SDK.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Quick test:</span>
            <div className="flex flex-wrap gap-1.5">
              {presetPrompts.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={preset.action}
                  className="px-2.5 py-1 text-xs font-medium rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Configuration & Input (Left) vs Output & Metrics (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Controls Bar: Model & Parameters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Model & Parameter Controls
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Active on Free Quota
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Model Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Free Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setModel('gemini-3.8-flash')}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all cursor-pointer ${
                      model === 'gemini-3.8-flash'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Gemini 3.8 Flash</span>
                      <Sparkles className="w-3 h-3 text-blue-500" />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Multimodal + Thinking
                    </span>
                  </button>

                  <button
                    onClick={() => setModel('gemini-3.1-flash-lite')}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all cursor-pointer ${
                      model === 'gemini-3.1-flash-lite'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Gemini 3.1 Flash Lite</span>
                      <Zap className="w-3 h-3 text-amber-500" />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Fastest response
                    </span>
                  </button>
                </div>
              </div>

              {/* Thinking Level or Latency Focus */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Thinking Level (Reasoning Budget)
                </label>
                {model === 'gemini-3.8-flash' ? (
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {(['LOW', 'MEDIUM', 'HIGH'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setThinkingLevel(lvl)}
                        className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer text-center ${
                          thinkingLevel === lvl
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/80 rounded-lg text-slate-500 dark:text-slate-400">
                    Flash Lite runs in instant low-latency mode without reasoning step.
                  </div>
                )}
              </div>
            </div>

            {/* Response Format Toggle */}
            <div className="pt-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Format:</span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    onClick={() => {
                      setResponseFormat('text');
                      setShowJsonSchema(false);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      responseFormat === 'text'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Markdown Text
                  </button>
                  <button
                    onClick={() => {
                      setResponseFormat('json');
                      setShowJsonSchema(true);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      responseFormat === 'json'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Structured JSON
                  </button>
                </div>
              </div>

              {responseFormat === 'json' && (
                <button
                  onClick={() => setShowJsonSchema(!showJsonSchema)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  {showJsonSchema ? 'Hide Schema' : 'Edit Schema'}
                </button>
              )}
            </div>

            {showJsonSchema && responseFormat === 'json' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  JSON Schema (responseSchema)
                </label>
                <textarea
                  value={jsonSchema}
                  onChange={(e) => setJsonSchema(e.target.value)}
                  rows={4}
                  className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* System Instruction */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-blue-500" />
                System Instruction (Optional)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSystemInstruction('You are an expert AI engineer providing concise, accurate code and technical architecture.')}
                  className="text-[11px] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 cursor-pointer"
                >
                  + Architect
                </button>
                <button
                  onClick={() => setSystemInstruction('You are a structured data extractor. Return pure JSON without conversational filler.')}
                  className="text-[11px] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 cursor-pointer"
                >
                  + Extractor
                </button>
                {systemInstruction && (
                  <button
                    onClick={() => setSystemInstruction('')}
                    className="text-[11px] text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              placeholder="e.g. You are a senior engineer who writes bulleted, actionable advice with code examples."
              rows={2}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Multimodal Attachment (Image) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                Multimodal Image Input (Vision)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadSampleImage}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  Load Sample Photo
                </button>
                {imageBase64 && (
                  <button
                    onClick={() => setImageBase64(null)}
                    className="text-xs text-red-500 hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {imageBase64 ? (
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <img
                  src={imageBase64}
                  alt="Attachment preview"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 object-cover rounded-md border border-slate-200 dark:border-slate-700"
                />
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-white block">Image attached</span>
                  <span className="text-[11px] text-slate-500">Base64 encoded data ready for Gemini multimodal evaluation</span>
                </div>
              </div>
            ) : (
              <label className="flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
                <span>Click to upload image or load sample botanical photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Prompt Input */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-900 dark:text-white">
                Prompt Content
              </label>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                {prompt.length} chars
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here..."
              rows={5}
              className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPrompt('');
                    setImageBase64(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Clear Input
                </button>
                <button
                  onClick={handleSaveToFirestore}
                  disabled={isSaving || !prompt.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-400 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savedSuccess ? (
                    <>
                      <BookmarkCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Saved to Firestore</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isSaving ? 'Saving...' : 'Save to Firestore'}</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={onExecute}
                disabled={isExecuting || (!prompt && !imageBase64)}
                className={`px-5 py-2 text-xs font-semibold rounded-lg text-white transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                  isExecuting || (!prompt && !imageBase64)
                    ? 'bg-blue-400 cursor-not-allowed opacity-70'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                }`}
              >
                {isExecuting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Executing on Free Tier...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Execute Request
                  </>
                )}
              </button>
            </div>
          </div>

          {/* User's Saved Prompts (Firestore) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-blue-500" />
                Saved Prompts ({savedPrompts.length})
              </span>
              <div className="flex items-center gap-2">
                {savedPrompts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllSavedPrompts}
                    className="text-[11px] text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-1 cursor-pointer font-semibold px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-900/60 transition-colors"
                    title="Delete all saved prompts"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
                <span className="text-[10px] text-slate-400 font-mono">
                  {user ? 'Firestore synced' : 'Sign in to sync'}
                </span>
              </div>
            </div>

            {promptNotification && (
              <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>{promptNotification}</span>
              </div>
            )}

            {savedPrompts.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedPrompts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setPrompt(p.prompt);
                      if (p.systemInstruction) setSystemInstruction(p.systemInstruction);
                      if (p.model) setModel(p.model);
                      if (p.thinkingLevel) setThinkingLevel(p.thinkingLevel);
                    }}
                    className="group p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-400 cursor-pointer text-xs transition-colors"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span className="truncate mr-2 font-medium">{p.title || 'Untitled Prompt'}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setEditingPrompt({ ...p });
                            setShowEditPromptModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                          title="Edit this prompt"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedPrompt(p.id, e)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-900/60 transition-colors cursor-pointer"
                          title="Delete this prompt"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-1">{p.prompt}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No saved prompts yet. Enter a prompt and click "Save to Firestore".</p>
            )}
          </div>
        </div>

        {/* Right Column: Response Output & Telemetry (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Response Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col min-h-[500px]">
            {/* Header with Telemetry */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Model Output
                </span>
                {lastResponse && !isOutputCleared && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Success
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {lastResponse && !isOutputCleared && (
                  <button
                    type="button"
                    onClick={() => setIsOutputCleared(true)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                    title="Clear and delete output from view"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Output</span>
                  </button>
                )}
                {lastResponse?.text && !isOutputCleared && (
                  <button
                    onClick={handleCopy}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Telemetry Strip (if response exists) */}
            {lastResponse && !isOutputCleared && (
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs mb-4">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Latency</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-200 tabular-nums">
                    {lastResponse.elapsedMs} ms
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Tokens</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-200 tabular-nums">
                    {lastResponse.usageMetadata?.totalTokenCount || '~'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Model</span>
                  <span className="font-mono font-medium text-blue-600 dark:text-blue-400 truncate block">
                    {lastResponse.model.replace('gemini-', '')}
                  </span>
                </div>
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto max-h-[550px] pr-1">
              {isExecuting ? (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-10 h-10 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Querying {model} via Google AI Studio...
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Calling server-side @google/genai SDK with User-Agent telemetry
                  </p>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-xs space-y-2">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Generation Request Failed</span>
                  </div>
                  <p className="text-red-600 dark:text-red-300 break-words font-mono text-[11px]">
                    {error}
                  </p>
                  <div className="text-slate-600 dark:text-slate-400 pt-2 border-t border-red-100 dark:border-red-900/40">
                    <span className="font-medium text-slate-800 dark:text-slate-200 block mb-1">
                      Troubleshooting Tips:
                    </span>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Free tier rate limit: 15 RPM. If 429 was returned, wait 10 seconds.</li>
                      <li>Check your API key in Settings &gt; Secrets if receiving 403.</li>
                      <li>Ensure you are querying free models (gemini-3.8-flash, gemini-3.1-flash-lite).</li>
                    </ul>
                  </div>
                </div>
              ) : (lastResponse?.text && !isOutputCleared) ? (
                <div className="space-y-4">
                  {lastResponse.responseFormat === 'json' ? (
                    <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto leading-relaxed border border-slate-800">
                      {lastResponse.text}
                    </pre>
                  ) : (
                    <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {lastResponse.text}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Ready for Evaluation
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                      Select a prompt preset or enter your custom instructions to run Gemini 3.8 Flash on Google AI Studio Free Tier.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Info Banner */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Google Account Free Tier</span>
              <span>15 RPM Limit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Prompt Modal (Firestore) */}
      {showEditPromptModal && editingPrompt && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Saved Prompt
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Firestore ID: {editingPrompt.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditPromptModal(false);
                  setEditingPrompt(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePromptEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Prompt Title</label>
                <input
                  type="text"
                  value={editingPrompt.title}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Prompt Text</label>
                <textarea
                  rows={5}
                  value={editingPrompt.prompt}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">System Instruction (Optional)</label>
                <textarea
                  rows={2}
                  value={editingPrompt.systemInstruction || ''}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, systemInstruction: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => {
                    handleDeleteSavedPrompt(editingPrompt.id, e);
                    setShowEditPromptModal(false);
                    setEditingPrompt(null);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-950 dark:text-red-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Prompt</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditPromptModal(false);
                      setEditingPrompt(null);
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
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
