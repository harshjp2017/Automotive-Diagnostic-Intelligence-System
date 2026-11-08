import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Gauge,
  CheckCircle2,
  Clock,
  Coins,
  AlertTriangle,
  Info,
  Layers,
  ArrowUpRight,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { QuotaState } from '../types';

interface QuotaTrackerProps {
  quotaState: QuotaState;
  onResetSessionQuota: () => void;
}

export const QuotaTracker: React.FC<QuotaTrackerProps> = ({
  quotaState,
  onResetSessionQuota,
}) => {
  const [estRpm, setEstRpm] = useState(10);
  const [estTokensPerReq, setEstTokensPerReq] = useState(1200);
  const [secondsRemainingInMinute, setSecondsRemainingInMinute] = useState(60);

  // Countdown timer for 60-second rate limit window
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setSecondsRemainingInMinute(60 - now.getSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalCalculatedTpm = estRpm * estTokensPerReq;
  const isRpmExceeded = estRpm > 15;
  const isTpmExceeded = totalCalculatedTpm > 1000000;
  const estDailyRequests = estRpm * 60 * 24; // If continuous

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Google Account Sign-In</span>
              <span aria-hidden="true">·</span>
              <span>Zero Cost ($0.00)</span>
              <span aria-hidden="true">·</span>
              <span>Immediate Activation</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Google AI Studio Free Tier Limits & Quotas
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
              Understand the exact rate limits, data privacy rules, and capacity boundaries available to any user with a standard Google account.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Rate Window Reset In</span>
              <span className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {secondsRemainingInMinute}s
              </span>
            </div>
            <button
              type="button"
              onClick={onResetSessionQuota}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-900/60 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Reset and clear all session quota counters"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset / Clear Session Counters</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Core Rate Limit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: 15 RPM */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Requests / Minute
            </span>
            <Gauge className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
              15
            </span>
            <span className="text-xs text-slate-500 font-medium">RPM limit</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
            Maximum of 15 queries per rolling 60-second window across free models like Gemini 3.8 Flash.
          </p>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Current session:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
              {quotaState.requestsThisMinute} / 15
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                quotaState.requestsThisMinute >= 15 ? 'bg-red-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(100, (quotaState.requestsThisMinute / 15) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 2: 1,000,000 TPM */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tokens / Minute
            </span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
              1,000,000
            </span>
            <span className="text-xs text-slate-500 font-medium">TPM limit</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
            Generous token throughput allowing large contextual prompts and extensive multimodal payloads on the free tier.
          </p>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Session tokens (min):</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
              {quotaState.tokensThisMinute.toLocaleString()} / 1M
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, (quotaState.tokensThisMinute / 1000000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 3: 1,500 RPD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Requests / Day
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
              1,500
            </span>
            <span className="text-xs text-slate-500 font-medium">RPD limit</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
            Daily request quota resets midnight Pacific Time (PT). More than enough for prototyping and testing.
          </p>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Session total:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
              {quotaState.requestsToday} / 1,500
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${Math.min(100, (quotaState.requestsToday / 1500) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Free Tier Capacity Calculator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          Free Tier Capacity Calculator
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Simulate whether your expected workload fits cleanly within the Google AI Studio free tier limits or if you will encounter rate limiting (HTTP 429).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                <span>Expected Request Rate</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {estRpm} RPM
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={estRpm}
                onChange={(e) => setEstRpm(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>1 RPM</span>
                <span className="text-amber-500 font-semibold">15 RPM (Free Max)</span>
                <span>30 RPM</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                <span>Average Tokens per Request (Prompt + Response)</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {estTokensPerReq.toLocaleString()} tokens
                </span>
              </div>
              <input
                type="range"
                min="200"
                max="80000"
                step="200"
                value={estTokensPerReq}
                onChange={(e) => setEstTokensPerReq(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>200</span>
                <span>40,000</span>
                <span>80,000</span>
              </div>
            </div>
          </div>

          {/* Calculator Output */}
          <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                Feasibility Assessment
              </span>
              <div className="flex items-center gap-2 mb-3">
                {isRpmExceeded || isTpmExceeded ? (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Exceeds Free Tier Limits (Will Receive 429)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>100% Covered by Free Tier ($0.00 / mo)</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Calculated TPM:</span>
                  <span className={`font-mono font-semibold tabular-nums ${isTpmExceeded ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                    {totalCalculatedTpm.toLocaleString()} / 1,000,000 TPM
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Request Capacity Utilization:</span>
                  <span className={`font-mono font-semibold tabular-nums ${isRpmExceeded ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                    {((estRpm / 15) * 100).toFixed(0)}% of 15 RPM
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-slate-800">
              {isRpmExceeded ? (
                <span>Recommendation: Implement a 4-second delay between requests or client-side batching to stay under 15 RPM.</span>
              ) : (
                <span>Your application can run continuously on a free Google account with zero billing configuration required.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison: Free Tier vs Pay-as-you-go */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          Google Account Free Tier vs Pay-As-You-Go Comparison
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Detailed comparison of capabilities, data handling policies, and quota guarantees.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-4">Feature / Dimension</th>
                <th className="py-3 px-4 text-blue-600 dark:text-blue-400">Free Tier (Google Account Only)</th>
                <th className="py-3 px-4 text-slate-700 dark:text-slate-300">Pay-As-You-Go (Cloud Billing)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              <tr>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">Cost per Month</td>
                <td className="py-3 px-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">$0.00 (Free of Charge)</td>
                <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">Metered per million tokens</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">Billing / Credit Card</td>
                <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">No Credit Card Required</td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Requires Google Cloud Billing setup</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">RPM (Rate Limit)</td>
                <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">15 RPM</td>
                <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">Up to 1,000+ RPM</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">TPM (Tokens per Minute)</td>
                <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">1,000,000 TPM</td>
                <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">4,000,000+ TPM</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">Daily Cap (RPD)</td>
                <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">1,500 RPD</td>
                <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">Unlimited (subject to budget alerts)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">Data Privacy Policy</td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                  Data may be used to train & refine Google models (standard free tier terms)
                </td>
                <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                  Zero training on customer prompts or responses
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">Frontier Reasoning Models</td>
                <td className="py-3 px-4 text-slate-500">Gemini 3.8 Flash, Gemini 3.1 Flash Lite</td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                  + Gemini 4 Argon, Gemini 3 Pro Image, Omni Flash
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
