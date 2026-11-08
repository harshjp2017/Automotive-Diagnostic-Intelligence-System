import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Globe,
  ExternalLink,
  Sparkles,
  Navigation,
  Clock,
  AlertCircle,
  RefreshCw,
  Zap,
  ShieldAlert,
  Trash2,
  Edit3,
  Check,
} from 'lucide-react';

interface GroundingErrorInfo {
  message: string;
  isQuota: boolean;
  statusCode?: number;
}

export const GroundingStudio: React.FC = () => {
  const [activeTool, setActiveTool] = useState<'search' | 'maps'>('search');
  const [prompt, setPrompt] = useState('What were the latest major breakthroughs in quantum computing announced this month?');
  const [latitude, setLatitude] = useState('37.78193');
  const [longitude, setLongitude] = useState('-122.40476');
  const [useLiveLocation, setUseLiveLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [editResponseText, setEditResponseText] = useState('');
  const [response, setResponse] = useState<{
    text: string;
    sources: any[];
    elapsedMs: number;
    type: 'search' | 'maps';
    isUngroundedFallback?: boolean;
  } | null>(null);
  const [errorInfo, setErrorInfo] = useState<GroundingErrorInfo | null>(null);

  // 60-second rolling quota countdown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude.toFixed(5));
          setLongitude(pos.coords.longitude.toFixed(5));
          setUseLiveLocation(true);
        },
        (err) => {
          console.warn('Geolocation denied or unavailable:', err.message);
        }
      );
    }
  };

  const handleExecute = async () => {
    if (isLoading || !prompt.trim()) return;
    setIsLoading(true);
    setErrorInfo(null);

    try {
      if (activeTool === 'search') {
        const res = await fetch('/api/grounding/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        if (!res.ok) {
          const rawStr = JSON.stringify(data);
          let isQuota = Boolean(data.isQuota);
          let cleanMsg = data.error || 'Search grounding failed';
          if (
            res.status === 429 ||
            rawStr.includes('429') ||
            rawStr.includes('RESOURCE_EXHAUSTED') ||
            cleanMsg.toLowerCase().includes('quota') ||
            cleanMsg.toLowerCase().includes('rate limit')
          ) {
            isQuota = true;
            cleanMsg =
              'Gemini Free Tier rate limit reached (15 RPM or daily Grounding quota exceeded). The rolling quota window refreshes every 60 seconds.';
            setCooldownSeconds(60);
          }
          setErrorInfo({ message: cleanMsg, isQuota, statusCode: res.status });
          return;
        }

        setResponse({
          text: data.text,
          sources: data.webSources || [],
          elapsedMs: data.elapsedMs,
          type: 'search',
        });
      } else {
        const res = await fetch('/api/grounding/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            latitude: Number(latitude),
            longitude: Number(longitude),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const rawStr = JSON.stringify(data);
          let isQuota = Boolean(data.isQuota);
          let cleanMsg = data.error || 'Maps grounding failed';
          if (
            res.status === 429 ||
            rawStr.includes('429') ||
            rawStr.includes('RESOURCE_EXHAUSTED') ||
            cleanMsg.toLowerCase().includes('quota') ||
            cleanMsg.toLowerCase().includes('rate limit')
          ) {
            isQuota = true;
            cleanMsg =
              'Gemini Free Tier rate limit reached (15 RPM or daily Grounding quota exceeded). The rolling quota window refreshes every 60 seconds.';
            setCooldownSeconds(60);
          }
          setErrorInfo({ message: cleanMsg, isQuota, statusCode: res.status });
          return;
        }

        setResponse({
          text: data.text,
          sources: data.mapSources || [],
          elapsedMs: data.elapsedMs,
          type: 'maps',
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Grounding request failed';
      const isQuota =
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('rate limit');

      if (isQuota) {
        setCooldownSeconds(60);
        setErrorInfo({
          message:
            'Gemini Free Tier rate limit reached (15 RPM or daily Grounding quota exceeded). The rolling quota window refreshes every 60 seconds.',
          isQuota: true,
          statusCode: 429,
        });
      } else {
        let displayMsg = errMsg;
        try {
          if (typeof displayMsg === 'string' && displayMsg.includes('{"error":')) {
            const jsonStart = displayMsg.indexOf('{');
            const parsed = JSON.parse(displayMsg.slice(jsonStart));
            if (parsed?.error?.message) {
              displayMsg = parsed.error.message;
            }
          }
        } catch {
          // keep original
        }
        setErrorInfo({
          message: displayMsg,
          isQuota: false,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Immediate fallback without tools: uses Gemini 3.8 Flash directly so users are never blocked
  const handleRunUngrounded = async () => {
    if (isLoading || !prompt.trim()) return;
    setIsLoading(true);
    setErrorInfo(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: 'gemini-3.8-flash',
          thinkingLevel: 'off',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ungrounded fallback request failed');
      }

      setResponse({
        text: data.text,
        sources: [],
        elapsedMs: data.elapsedMs || 0,
        type: 'search',
        isUngroundedFallback: true,
      });
    } catch (err: any) {
      setErrorInfo({
        message: err.message || 'Ungrounded request failed',
        isQuota: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sampleSearchQueries = [
    'Recent NASA discoveries and astronomical news this week',
    'Who won the most recent Nobel Prize in Physics and what was the discovery?',
    'Current state of commercial fusion reactor pilot tests in 2026',
  ];

  const sampleMapsQueries = [
    'Find top-rated specialty coffee roasters near this location with outdoor seating',
    'Recommend three quiet public parks or botanical gardens nearby',
    'Best tech coworking spaces with high-speed fiber internet in the area',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Google Search & Maps Grounding</span>
              <span aria-hidden="true">·</span>
              <span>Gemini 3.8 Flash</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Real-World Live Web & Geography</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Search & Maps Live Grounding
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
              Equip Gemini 3.8 Flash with live Google Search indices for real-time web news or Google Maps retrieval for location-aware queries with verifiable web links and review citations.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg shrink-0">
            <button
              onClick={() => {
                setActiveTool('search');
                setPrompt('What were the latest major breakthroughs in quantum computing announced this month?');
                setResponse(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTool === 'search'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span>Google Search</span>
            </button>
            <button
              onClick={() => {
                setActiveTool('maps');
                setPrompt('What good specialty coffee shops and quiet cafes are located near here?');
                setResponse(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTool === 'maps'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              <span>Google Maps</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Query Input & Geographic Coordinates vs Verified Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {activeTool === 'search' ? (
                  <>
                    <Globe className="w-4 h-4 text-blue-500" />
                    <span>Google Search Grounding Tool</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 text-red-500" />
                    <span>Google Maps Grounding Tool</span>
                  </>
                )}
              </span>
              <span className="text-xs text-slate-500">Model: gemini-3.8-flash</span>
            </div>

            {/* Geolocation Controls for Maps */}
            {activeTool === 'maps' && (
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-blue-500" />
                    Geographic Coordinates (retrievalConfig)
                  </span>
                  <button
                    onClick={handleGetLocation}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                  >
                    Detect My Location
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Latitude</label>
                    <input
                      type="text"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Longitude</label>
                    <input
                      type="text"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Prompt input */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Query with Grounded Context
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Quick Prompt Presets */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1.5">Sample Grounded Queries:</span>
              <div className="space-y-1.5">
                {(activeTool === 'search' ? sampleSearchQueries : sampleMapsQueries).map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(q)}
                    className="w-full text-left text-xs p-2 rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    • {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExecute}
                disabled={isLoading || !prompt.trim()}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                  isLoading || !prompt.trim()
                    ? 'bg-blue-400 opacity-60 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Grounding via Google {activeTool === 'search' ? 'Search' : 'Maps'}...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Execute Grounded Query</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setPrompt('')}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                title="Clear / Delete prompt input"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Output & Verified Sources (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Grounded Response & Source Links
              </span>
              <div className="flex items-center gap-2">
                {response && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditResponseText(response.text);
                        setIsEditingResponse(!isEditingResponse);
                      }}
                      className="text-xs px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 flex items-center gap-1 cursor-pointer font-medium transition-colors"
                      title="Edit response text"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEditingResponse ? 'Cancel Edit' : 'Edit Output'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResponse(null);
                        setIsEditingResponse(false);
                      }}
                      className="text-xs px-2 py-0.5 rounded border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 flex items-center gap-1 cursor-pointer font-medium transition-colors"
                      title="Clear / Delete grounded response"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Output</span>
                    </button>
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      {response.elapsedMs} ms
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[550px] pr-1 space-y-4">
              {isLoading ? (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-10 h-10 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Retrieving real-time data from {activeTool === 'search' ? 'Google Search Index' : 'Google Maps Platform'}...
                  </p>
                </div>
              ) : errorInfo ? (
                errorInfo.isQuota ? (
                  <div className="p-4 sm:p-5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 rounded-lg shrink-0 mt-0.5">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                            Gemini Free Tier Quota Limit (429: Resource Exhausted)
                          </h4>
                          {cooldownSeconds > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-200/90 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 animate-pulse">
                              <Clock className="w-3 h-3" />
                              Rolling quota refresh in {cooldownSeconds}s
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                          Google Search and Google Maps Grounding share a strict free-tier rate limit (15 RPM and daily grounding quotas on Google AI Studio). The rolling 1-minute window automatically replenishes quota every 60 seconds.
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-amber-200 dark:border-amber-800/80 flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleRunUngrounded}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Run Without Grounding (Immediate Result)</span>
                      </button>

                      <button
                        onClick={handleExecute}
                        disabled={isLoading || cooldownSeconds > 0}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          cooldownSeconds > 0
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-500 cursor-not-allowed'
                            : 'bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>{cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s to Retry` : 'Retry Grounded Search'}</span>
                      </button>

                      <a
                        href="https://ai.google.dev/gemini-api/docs/rate-limits"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 hover:underline ml-auto"
                      >
                        <span>Rate Limit Docs</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Grounding Error</span>
                      </div>
                      <button
                        onClick={handleRunUngrounded}
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Try without grounding</span>
                      </button>
                    </div>
                    <p className="text-red-600 dark:text-red-300 font-mono text-[11px] break-words">
                      {errorInfo.message}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleExecute}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded text-[11px] font-medium hover:bg-red-200 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry Request</span>
                      </button>
                    </div>
                  </div>
                )
              ) : response ? (
                <div className="space-y-4">
                  {response.isUngroundedFallback && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-blue-800 dark:text-blue-300">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>
                          <strong>Direct Model Answer:</strong> Generated via Gemini 3.8 Flash without grounding tools.
                        </span>
                      </div>
                      <button
                        onClick={handleExecute}
                        disabled={cooldownSeconds > 0}
                        className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                      >
                        {cooldownSeconds > 0 ? `Retry Grounded in ${cooldownSeconds}s` : 'Retry with Grounding'}
                      </button>
                    </div>
                  )}

                  {/* Grounded Text / Editor */}
                  {isEditingResponse ? (
                    <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Edit Grounded Response Notes:
                      </div>
                      <textarea
                        value={editResponseText}
                        onChange={(e) => setEditResponseText(e.target.value)}
                        rows={6}
                        className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingResponse(false)}
                          className="px-2.5 py-1 text-xs rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResponse({ ...response, text: editResponseText });
                            setIsEditingResponse(false);
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {response.text}
                    </div>
                  )}

                  {/* Mandatory Web / Maps Citations per Grounding Guidelines */}
                  {response.sources.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white block uppercase tracking-wider">
                        {response.type === 'search' ? 'Verified Web Sources' : 'Google Maps Place Citations'}
                      </span>
                      <div className="space-y-2">
                        {response.sources.map((src, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <a
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{src.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            </a>
                            {src.reviewSnippets && src.reviewSnippets.length > 0 && (
                              <p className="text-[11px] text-slate-500 mt-1 italic">
                                "{src.reviewSnippets[0]}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Ready for Real-Time Grounding
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                    Choose Google Search or Google Maps, enter a query, and explore verified factual grounding.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
