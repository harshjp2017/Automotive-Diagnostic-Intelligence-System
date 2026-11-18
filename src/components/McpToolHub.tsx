import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  Play,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Box,
  Wrench,
  Search,
  Sparkles,
} from 'lucide-react';

interface McpTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface McpServer {
  id: string;
  name: string;
  version: string;
  protocol: string;
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number;
  description: string;
  tools: McpTool[];
}

export const McpToolHub: React.FC = () => {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string>('mcp-obd2-telemetry');
  const [selectedToolName, setSelectedToolName] = useState<string>('read_live_pids');
  const [toolArgsJson, setToolArgsJson] = useState<string>('{\n  "vehicle": "Ford F-150 EcoBoost 3.5L",\n  "pids": ["RPM", "COOLANT_TEMP", "STFT_B1", "LTFT_B1"]\n}');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'architecture' | 'evals' | 'guardrails'>('console');
  const [evalReport, setEvalReport] = useState<any>(null);
  const [isRunningEvals, setIsRunningEvals] = useState(false);
  const [guardrailResult, setGuardrailResult] = useState<any>(null);
  const [isTestingGuardrail, setIsTestingGuardrail] = useState(false);
  const [guardrailInputText, setGuardrailInputText] = useState<string>(
    'Repair Order #88412 for John Doe (555-867-5309, john.doe@example.com, Card 4532 1234 5678 9010). VIN 1FTFW1E84MK129481 throwing DTC P0300.'
  );

  const runGuardrailTest = async (payload: Record<string, any>) => {
    setIsTestingGuardrail(true);
    try {
      const res = await fetch('/api/guardrails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setGuardrailResult(data);
    } catch (err: any) {
      setGuardrailResult({ verdict: 'ERROR', error: err.message || 'Guardrail test failed' });
    } finally {
      setIsTestingGuardrail(false);
    }
  };

  const runEvalSuite = async () => {
    setIsRunningEvals(true);
    try {
      const res = await fetch('/api/evals/run', { method: 'POST' });
      const data = await res.json();
      setEvalReport(data);
    } catch (err: any) {
      setEvalReport({ status: 'ERROR', error: err.message || 'Failed to run evaluation suite' });
    } finally {
      setIsRunningEvals(false);
    }
  };

  const fetchServers = async () => {
    setIsLoadingServers(true);
    try {
      const res = await fetch('/api/mcp/servers');
      const data = await res.json();
      if (Array.isArray(data.servers)) {
        setServers(data.servers);
      }
    } catch (err) {
      console.warn('Failed to load MCP servers:', err);
    } finally {
      setIsLoadingServers(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const selectedServer = servers.find((s) => s.id === selectedServerId) || servers[0];

  const handleSelectTool = (server: McpServer, tool: McpTool) => {
    setSelectedServerId(server.id);
    setSelectedToolName(tool.name);

    if (tool.name === 'read_live_pids') {
      setToolArgsJson('{\n  "vehicle": "Ford F-150 EcoBoost 3.5L",\n  "pids": ["RPM", "COOLANT_TEMP", "STFT_B1", "LTFT_B1"]\n}');
    } else if (tool.name === 'fetch_freeze_frame') {
      setToolArgsJson('{\n  "dtc": "P0300",\n  "frameNumber": 0\n}');
    } else if (tool.name === 'run_actuator_test') {
      setToolArgsJson('{\n  "component": "EVAP_PURGE_VALVE",\n  "durationSeconds": 5\n}');
    } else if (tool.name === 'check_parts_stock') {
      setToolArgsJson('{\n  "partNumber": "SP-578",\n  "vehicle": "Ford F-150"\n}');
    } else if (tool.name === 'estimate_labor_time') {
      setToolArgsJson('{\n  "operation": "Spark Plug Replacement (All 6)",\n  "vehicle": "2021 Ford F-150 EcoBoost 3.5L"\n}');
    } else if (tool.name === 'query_dtc_fleet_clusters') {
      setToolArgsJson('{\n  "dtc": "P0300",\n  "region": "Midwest"\n}');
    } else if (tool.name === 'fetch_live_recalls_by_vin') {
      setToolArgsJson('{\n  "make": "Ford",\n  "model": "F-150",\n  "year": "2021"\n}');
    } else {
      setToolArgsJson('{}');
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgsJson);
      } catch (e: any) {
        throw new Error(`Invalid JSON arguments: ${e.message}`);
      }

      const res = await fetch('/api/mcp/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: selectedServerId,
          toolName: selectedToolName,
          arguments: parsedArgs,
        }),
      });

      const data = await res.json();
      setExecutionResult(data);
    } catch (err: any) {
      setExecutionResult({
        error: err.message || 'Execution failed',
        status: 'FAILED',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const quickPresets = [
    {
      title: 'Poll F-150 Live PIDs',
      serverId: 'mcp-obd2-telemetry',
      toolName: 'read_live_pids',
      args: '{\n  "vehicle": "Ford F-150 EcoBoost 3.5L",\n  "pids": ["RPM", "COOLANT_TEMP", "STFT_B1", "LTFT_B1"]\n}',
    },
    {
      title: 'P0300 Freeze Frame Snapshot',
      serverId: 'mcp-obd2-telemetry',
      toolName: 'fetch_freeze_frame',
      args: '{\n  "dtc": "P0300",\n  "frameNumber": 0\n}',
    },
    {
      title: 'Check SP-578 Spark Plug Stock',
      serverId: 'mcp-parts-inventory',
      toolName: 'check_parts_stock',
      args: '{\n  "partNumber": "SP-578",\n  "vehicle": "Ford F-150"\n}',
    },
    {
      title: 'BigQuery Fleet DTC Clusters',
      serverId: 'mcp-gcp-bigquery-fleet',
      toolName: 'query_dtc_fleet_clusters',
      args: '{\n  "dtc": "P0300",\n  "region": "Midwest"\n}',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Model Context Protocol v2024-11-05
              </span>
              <span className="text-xs text-indigo-300/80">· Open Tools & Hardware Standard</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <Cpu className="w-6 h-6 text-indigo-400" />
              <span>Model Context Protocol (MCP) Hardware & Tool Hub</span>
            </h1>
            <p className="text-xs text-indigo-200/90 max-w-2xl leading-relaxed">
              Decoupled, zero-trust tool architecture connecting Gemini 3.8 Flash to live vehicle CAN Bus hardware, OEM dealership parts inventory, Google Cloud BigQuery telematics, and NHTSA safety streams.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-indigo-500/30 rounded-xl p-3 text-center min-w-[90px]">
              <div className="text-xl font-bold text-emerald-400">4</div>
              <div className="text-[10px] text-slate-300">MCP Servers</div>
            </div>
            <div className="bg-slate-800/80 border border-indigo-500/30 rounded-xl p-3 text-center min-w-[90px]">
              <div className="text-xl font-bold text-indigo-300">10</div>
              <div className="text-[10px] text-slate-300">Active Tools</div>
            </div>
            <button
              onClick={fetchServers}
              disabled={isLoadingServers}
              className="p-2.5 rounded-xl bg-indigo-600/60 hover:bg-indigo-600 text-white cursor-pointer border border-indigo-400/40 transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh MCP Server Status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingServers ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Subtabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-indigo-900/60 text-xs">
          <button
            onClick={() => setActiveTab('console')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'console'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-indigo-200 hover:bg-indigo-900/40'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Interactive JSON-RPC Console</span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-indigo-200 hover:bg-indigo-900/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>MCP Protocol Architecture</span>
          </button>
          <button
            onClick={() => setActiveTab('evals')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evals'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-indigo-200 hover:bg-indigo-900/40'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>4-Dimension EVALs Suite</span>
          </button>
          <button
            onClick={() => setActiveTab('guardrails')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'guardrails'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-indigo-200 hover:bg-indigo-900/40'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>4-Layer Guardrails</span>
          </button>
        </div>
      </div>

      {activeTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Registered MCP Servers (4 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span>Registered MCP Servers ({servers.length})</span>
            </h2>

            <div className="space-y-3">
              {servers.map((s) => {
                const isSelected = s.id === selectedServerId;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedServerId(s.id);
                      if (s.tools.length > 0) {
                        handleSelectTool(s, s.tools[0]);
                      }
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {s.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                            v{s.version}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {s.description}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{s.latencyMs}ms</span>
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-mono mr-1">Tools:</span>
                      {s.tools.map((t) => {
                        const isToolActive = isSelected && selectedToolName === t.name;
                        return (
                          <button
                            key={t.name}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectTool(s, t);
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                              isToolActive
                                ? 'bg-blue-600 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                            }`}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Interactive Dispatcher (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-600" />
                    <span>MCP Tool Dispatcher: {selectedToolName}</span>
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target Server: <code className="text-blue-600 dark:text-blue-400">{selectedServerId}</code>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">Format: JSON-RPC 2.0</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Quick Test Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {quickPresets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedServerId(p.serverId);
                        setSelectedToolName(p.toolName);
                        setToolArgsJson(p.args);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* JSON Arguments Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Tool Input Arguments (JSON):
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">Strict JSON Schema</span>
                </div>
                <textarea
                  value={toolArgsJson}
                  onChange={(e) => setToolArgsJson(e.target.value)}
                  rows={4}
                  className="w-full p-3 font-mono text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Execute Button */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Zero-Trust Sandboxed Execution</span>
                </div>

                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all disabled:opacity-60"
                >
                  <Play className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
                  <span>{isExecuting ? 'Calling MCP Server...' : 'Execute Tool (JSON-RPC)'}</span>
                </button>
              </div>

              {/* Execution Result Box */}
              {executionResult && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Execution Response</span>
                    </span>
                    {executionResult.metadata?.durationMs && (
                      <span className="font-mono text-[11px] text-slate-400">
                        Roundtrip: {executionResult.metadata.durationMs}ms
                      </span>
                    )}
                  </div>

                  <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto max-h-[300px] border border-slate-800">
                    {JSON.stringify(executionResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'architecture' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-6">
          <div className="max-w-3xl space-y-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Why Model Context Protocol (MCP) in Automotive Engineering?
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Standard LLM integrations hardcode tool functions inside the monolithic application server. MCP standardizes client-server protocol over JSON-RPC 2.0 (stdio and SSE), enabling decoupled microservices for physical diagnostic hardware, parts inventory, and cloud analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Decoupled Microservices</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                CAN bus pass-thru drivers, dealership parts catalogs, and BigQuery data lakes can be upgraded independently without touching the core React frontend or Gemini model prompts.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Zero-Trust Safety Interlocks</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                High-voltage disconnects and bidirectional actuator tests (such as EVAP purging or cylinder shut-off) are gated by explicit technician safety authorization tokens.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Universal Model Portability</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Whether deploying Gemini 3.8 Flash in Google Cloud Run, Gemini 4 Argon for complex multi-hop root-cause analysis, or local shop edge devices, all models communicate via the identical JSON-RPC tool contracts.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'evals' && (
        <div className="space-y-6">
          {/* Control Header + Run Button */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span>Automated 4-Dimension Diagnostic &amp; MCP EVALs</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                Validates Hybrid RAG retrieval precision, exact OEM bolt torque specs, High-Voltage / fuel safety gates, and MCP tool selection accuracy across golden test cases.
              </p>
            </div>

            <button
              onClick={runEvalSuite}
              disabled={isRunningEvals}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all disabled:opacity-60 shrink-0"
            >
              <Play className={`w-4 h-4 ${isRunningEvals ? 'animate-spin' : ''}`} />
              <span>{isRunningEvals ? 'Running 4-Dimension Suite...' : 'Run 4-Dimension EVAL Suite'}</span>
            </button>
          </div>

          {/* Live Results Panel */}
          {evalReport && (
            <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Benchmark Verdict: {evalReport.status}
                  </span>
                </div>
                {evalReport.summary && (
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {evalReport.summary.passedCases}/{evalReport.summary.totalCases} Passed · {evalReport.summary.elapsedMs}ms
                  </span>
                )}
              </div>

              {evalReport.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">1. RAG Retrieval Quality</div>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{evalReport.summary.ragRetrievalQualityPct}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">2. Factual &amp; Torque Precision</div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{evalReport.summary.factualTorquePrecisionPct}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">3. Safety &amp; Grounding Gate</div>
                    <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{evalReport.summary.safetyGroundingGatePct}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">4. MCP Tool Accuracy</div>
                    <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{evalReport.summary.mcpToolCallingAccuracyPct}%</div>
                  </div>
                </div>
              )}

              {Array.isArray(evalReport.results) && (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2.5">Test Case</th>
                        <th className="p-2.5">Matched Manual</th>
                        <th className="p-2.5">Torque Checked</th>
                        <th className="p-2.5">MCP Tool Invoked</th>
                        <th className="p-2.5">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evalReport.results.map((r: any) => (
                        <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{r.vehicle}</td>
                          <td className="p-2.5 font-mono text-[11px]">{r.retrievedSection || 'None'}</td>
                          <td className="p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">{r.matchedTorque || 'Missing'}</td>
                          <td className="p-2.5 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">{r.invokedMcpTool}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.passedAll ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-700'}`}>
                              {r.passedAll ? 'PASS' : 'FAIL'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4 Dimensions Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">The 4 Dimensions Evaluated</h3>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3">Dimension</th>
                    <th className="p-3">What It Tests</th>
                    <th className="p-3">Example Failure Caught by EVALs</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-bold">1. RAG Retrieval Quality</td>
                    <td className="p-3">Did the hybrid retriever pull the exact OEM manual?</td>
                    <td className="p-3">Searching <code>P0300 on Ford F-150</code> pulls a Chevy manual instead of Ford WSM 303-07A.</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-bold">2. Factual &amp; Torque Precision</td>
                    <td className="p-3">Are technical values 100% exact to OEM specs?</td>
                    <td className="p-3">Recommending <strong>25 Nm</strong> on spark plugs instead of <strong>15 Nm</strong>, stripping the aluminum head.</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-bold">3. Safety &amp; Grounding Gate</td>
                    <td className="p-3">Did the model issue mandatory safety procedures?</td>
                    <td className="p-3">Servicing a Toyota RAV4 hybrid pack without disconnecting the High-Voltage service plug first.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">4. MCP Tool Calling Accuracy</td>
                    <td className="p-3">Did the agent invoke the right tool with valid args?</td>
                    <td className="p-3">Calling <code>run_actuator_test</code> when the technician only asked to read live sensor PIDs.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* When These EVALs Run */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">When &amp; Where EVALs Execute in Our App Lifecycle</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="font-bold text-blue-600 dark:text-blue-400">1. On-Demand / Local Dev</div>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Runs when you click <strong>Run 4-Dimension EVAL Suite</strong> or execute <code>python -m evals.rag_eval</code> after ingesting manuals or editing prompts.</p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="font-bold text-emerald-600 dark:text-emerald-400">2. Pre-Deploy CI/CD Gate</div>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Runs inside <code>evals/run_evals.sh</code> before pushing revisions to Cloud Run so regressions never go live.</p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="font-bold text-amber-600 dark:text-amber-400">3. Live Runtime (~6ms)</div>
                <p className="text-slate-500 dark:text-slate-400 mt-1"><code>verify_diagnostic_contradictions</code> runs synchronously on every live diagnosis turn as a real-time safety &amp; torque gate.</p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="font-bold text-purple-600 dark:text-purple-400">4. Model Upgrade Benchmark</div>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Executed via the ADK <code>/dev-ui</code> Evals tab &amp; Vertex AI AutoSxS whenever swapping Gemini models.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'guardrails' && (
        <div className="space-y-6">
          {/* Header & Live Preset Launcher */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-rose-600" />
                  <span>4-Layer Runtime Guardrails Live Test Console</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                  Inline circuit breakers executing on every chat turn, MCP actuation, and Gemini output to enforce EPA/NHTSA compliance, PII redaction, hardware safety interlocks, and OEM bolt torque integrity.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
                4 Active Defense Layers
              </span>
            </div>

            {/* 1-Click Preset Attack / Hazard Tests */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                1-Click Guardrail Trigger Presets:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  disabled={isTestingGuardrail}
                  onClick={() => runGuardrailTest({ scenario: 'tamper_attempt' })}
                  className="p-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-left cursor-pointer transition-colors"
                >
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-300">1. Attempt Airbag / DPF Bypass</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tests Layer 1 Compliance Gate</div>
                </button>
                <button
                  type="button"
                  disabled={isTestingGuardrail}
                  onClick={() => runGuardrailTest({ scenario: 'pii_leak' })}
                  className="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-left cursor-pointer transition-colors"
                >
                  <div className="text-xs font-bold text-amber-700 dark:text-amber-300">2. Paste Customer PII Repair Order</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tests Layer 2 DLP Scrubber</div>
                </button>
                <button
                  type="button"
                  disabled={isTestingGuardrail}
                  onClick={() => runGuardrailTest({ scenario: 'unsafe_actuator' })}
                  className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-left cursor-pointer transition-colors"
                >
                  <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">3. Trigger Actuator @ 1,800 RPM</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tests Layer 3 Hardware Interlock</div>
                </button>
                <button
                  type="button"
                  disabled={isTestingGuardrail}
                  onClick={() => runGuardrailTest({ scenario: 'torque_hallucination' })}
                  className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-left cursor-pointer transition-colors"
                >
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">4. Hallucinated 25 Nm Torque Fix</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tests Layer 4 OEM Spec Enforcer</div>
                </button>
              </div>
            </div>

            {/* Custom Input Sandbox */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Custom Technician Input / Draft Output Probe:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={guardrailInputText}
                  onChange={(e) => setGuardrailInputText(e.target.value)}
                  className="flex-1 text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Enter a prompt injection, PII repair order, or DTC query..."
                />
                <button
                  type="button"
                  disabled={isTestingGuardrail || !guardrailInputText.trim()}
                  onClick={() => runGuardrailTest({ scenario: 'custom', input: guardrailInputText })}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Test Input Guardrail</span>
                </button>
              </div>
            </div>

            {/* Guardrail Verdict & Before/After Payload Inspector */}
            {guardrailResult && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Guardrail Verdict: <code className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">{guardrailResult.verdict}</code>
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Gate latency: {guardrailResult.elapsedMs}ms
                  </span>
                </div>

                {guardrailResult.inputAudit && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-500 mb-1">Before (Raw Technician Input):</div>
                      <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200 break-words">{guardrailResult.inputAudit.rawInput}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        After ({guardrailResult.inputAudit.triggeredLayer}):
                      </div>
                      <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200 break-words">
                        {guardrailResult.inputAudit.blocked
                          ? guardrailResult.inputAudit.refusalMessage
                          : guardrailResult.inputAudit.sanitizedInput}
                      </div>
                    </div>
                  </div>
                )}

                {guardrailResult.outputAudit && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-rose-200 dark:border-rose-800">
                      <div className="font-bold text-rose-600 mb-1">Before (Hallucinated / Unsafe Draft):</div>
                      <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200">{guardrailResult.outputAudit.originalText}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">After (Enforced OEM Output):</div>
                      <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{guardrailResult.outputAudit.enforcedText}</div>
                    </div>
                  </div>
                )}

                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-[240px]">
                  {JSON.stringify(guardrailResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* 4 Defense Layers Architecture Overview */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">How We Architect Guardrails in Our App (4 Concrete Guardrails)</h3>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3">Guardrail Layer</th>
                    <th className="p-3">What It Protects Against</th>
                    <th className="p-3">Implementation in <code>server.ts</code> &amp; <code>app/agent.py</code></th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-bold">1. Input Compliance &amp; Tamper Guardrail</td>
                    <td className="p-3">Prompt injection or illegal EPA/NHTSA tampering (airbag bypass, DPF delete).</td>
                    <td className="p-3">Pre-check filter returning <code>BLOCKED_BY_SAFETY_POLICY</code> without spending LLM tokens.</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-bold">2. PII / Repair Order Scrubber</td>
                    <td className="p-3">Customer phone numbers, emails, and credit cards pasted into chat.</td>
                    <td className="p-3">DLP sanitizer masking PII tokens while keeping 17-char VINs &amp; DTCs intact.</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-bold">3. MCP Physical Actuation Interlock</td>
                    <td className="p-3">Executing <code>run_actuator_test</code> while engine runs or without confirmation.</td>
                    <td className="p-3">Enforces <code>gear === "PARK"</code>, <code>engineRpm === 0</code>, and interlock confirmation token.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">4. Deterministic Torque &amp; HV Enforcer</td>
                    <td className="p-3">Hallucinated bolt torque (25 Nm vs 15 Nm) or missing 400V / 3,000 PSI warnings.</td>
                    <td className="p-3">Verifies numeric Nm specs against retrieved OEM JSON &amp; injects mandatory safety warnings.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
