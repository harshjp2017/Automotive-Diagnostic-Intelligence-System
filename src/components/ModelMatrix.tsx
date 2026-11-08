import React, { useState } from 'react';
import { Sparkles, Zap, Brain, Image, Video, Music, Check, ExternalLink, ArrowRight } from 'lucide-react';

interface ModelMatrixProps {
  onSelectModelForWorkbench: (modelId: string) => void;
}

export const ModelMatrix: React.FC<ModelMatrixProps> = ({ onSelectModelForWorkbench }) => {
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');

  const models = [
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      tier: 'free',
      badge: 'Recommended Free',
      context: '1,048,576 tokens',
      modalities: ['Text', 'Code', 'Images', 'Audio', 'Video'],
      thinkingSupported: true,
      freeRpm: '15 RPM',
      freeTpm: '1,000,000 TPM',
      freeRpd: '1,500 RPD',
      cost: '$0.00 on Free Tier',
      description: 'The premier multimodal workhorse for high-volume applications. Supports dynamic thinkingLevel reasoning, system instructions, and JSON schemas.',
    },
    {
      id: 'gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash Lite',
      tier: 'free',
      badge: 'Lowest Latency Free',
      context: '1,048,576 tokens',
      modalities: ['Text', 'Code', 'Images'],
      thinkingSupported: false,
      freeRpm: '15 RPM',
      freeTpm: '1,000,000 TPM',
      freeRpd: '1,500 RPD',
      cost: '$0.00 on Free Tier',
      description: 'Optimized for high-frequency workflows, classification, fast summarization, and cost-effective bulk operations with sub-second response times.',
    },
    {
      id: 'gemini-4-argon',
      name: 'Gemini 4 Argon',
      tier: 'paid',
      badge: 'Requires Billing',
      context: '1,048,576 tokens',
      modalities: ['Text', 'Code'],
      thinkingSupported: true,
      freeRpm: 'N/A (Paid only)',
      freeTpm: 'N/A',
      freeRpd: 'N/A',
      cost: 'Paid Pay-As-You-Go',
      description: 'Google’s frontier model for deep reasoning, mathematical theorems, competition-level coding, and intricate multi-step deductions.',
    },
    {
      id: 'gemini-3-pro-image',
      name: 'Gemini 3 Pro Image',
      tier: 'paid',
      badge: 'Requires Billing',
      context: '131,072 tokens',
      modalities: ['Text to Image'],
      thinkingSupported: false,
      freeRpm: 'N/A (Paid only)',
      freeTpm: 'N/A',
      freeRpd: 'N/A',
      cost: 'Paid Pay-As-You-Go',
      description: 'High-fidelity generative image rendering with photo-realistic lighting, typography synthesis, and resolution scaling.',
    },
    {
      id: 'gemini-omni-1.1-flash',
      name: 'Gemini Omni 1.1 Flash',
      tier: 'paid',
      badge: 'Requires Billing',
      context: '128,000 tokens',
      modalities: ['Video Generation'],
      thinkingSupported: false,
      freeRpm: 'N/A (Paid only)',
      freeTpm: 'N/A',
      freeRpd: 'N/A',
      cost: 'Paid Pay-As-You-Go',
      description: 'Multimodal video generation, scene extension, and temporal cinematography via the Interactions API.',
    },
    {
      id: 'lyria-3-clip-preview',
      name: 'Lyria 3 Clip',
      tier: 'paid',
      badge: 'Requires Billing',
      context: 'N/A',
      modalities: ['Music Audio'],
      thinkingSupported: false,
      freeRpm: 'N/A (Paid only)',
      freeTpm: 'N/A',
      freeRpd: 'N/A',
      cost: 'Paid Pay-As-You-Go',
      description: 'Specialized 30-second generative music clip synthesis based on descriptive genre, instrumentation, and mood prompts.',
    },
  ];

  const filteredModels = models.filter((m) => {
    if (filter === 'free') return m.tier === 'free';
    if (filter === 'paid') return m.tier === 'paid';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Google AI Studio Model Catalog</span>
              <span aria-hidden="true">·</span>
              <span>Gemini 3.8 & Gemini 3.1</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Free Tier Supported</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Model Compatibility & Tier Matrix
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
              Inspect model capabilities, multimodal support, and determine which models are usable 100% free with your Google account versus those requiring Cloud Billing.
            </p>
          </div>

          {/* Interactive filter tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg shrink-0">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Models ({models.length})
            </button>
            <button
              onClick={() => setFilter('free')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filter === 'free'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Free Tier Only (2)
            </button>
            <button
              onClick={() => setFilter('paid')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filter === 'paid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Paid Tier Only (4)
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Models */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredModels.map((item) => {
          const isFree = item.tier === 'free';
          return (
            <div
              key={item.id}
              className={`bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                isFree
                  ? 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                  : 'border-slate-200 dark:border-slate-800 opacity-90'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </h3>
                    <span className="font-mono text-xs text-slate-400 block mt-0.5">
                      {item.id}
                    </span>
                  </div>

                  <span
                    className={`text-xs font-medium px-2.5 py-0.5 rounded ${
                      isFree
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed my-3">
                  {item.description}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100 dark:border-slate-800 my-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Context Window</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 font-mono">
                      {item.context}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Free Tier Cost</span>
                    <span className={`font-mono font-medium ${isFree ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                      {item.cost}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Modalities:</span>
                    <div className="flex flex-wrap gap-1">
                      {item.modalities.map((m, idx) => (
                        <span key={idx} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-700 dark:text-slate-300">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {isFree && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Free Quota:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                        {item.freeRpm} · {item.freeTpm}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-2">
                {isFree ? (
                  <button
                    onClick={() => onSelectModelForWorkbench(item.id)}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Use in Workbench</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="text-center py-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    Requires Cloud Billing attached to Google account
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
