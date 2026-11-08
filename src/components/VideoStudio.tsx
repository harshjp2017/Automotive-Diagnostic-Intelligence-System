import React, { useState } from 'react';
import { Video, Film, Sparkles, Upload, Play, Clock, AlertCircle, CheckCircle2, RotateCcw, Trash2, Edit3 } from 'lucide-react';

const SAMPLE_IMAGE_PATH = '/src/assets/images/multimodal_sample_photo_1793739389613.jpg';

export const VideoStudio: React.FC = () => {
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [prompt, setPrompt] = useState('Cinematic aerial pan over a cyberpunk neon metropolis during a gentle rainstorm at dusk.');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [duration, setDuration] = useState<'5s' | '10s'>('5s');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoadSamplePhoto = async () => {
    try {
      const res = await fetch(SAMPLE_IMAGE_PATH);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
        setMode('image');
        setPrompt('Subtle time-lapse showing water droplets sliding down the monstera leaf with gentle morning breeze.');
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
        setMode('image');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);

    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          imageBase64: mode === 'image' ? imageBase64 : null,
          aspectRatio,
          duration,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Video generation failed');
      }

      setVideoUrl(data.videoUrl);
      setElapsedMs(data.elapsedMs);
    } catch (err: any) {
      setError(err.message || 'Failed to generate video');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Gemini Omni Flash 1.1</span>
              <span aria-hidden="true">·</span>
              <span>Interactions API</span>
              <span aria-hidden="true">·</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">Text-to-Video & Image Animation</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Omni Video Generation & Animation Studio
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
              Synthesize 16:9 or 9:16 high-definition video directly from creative text prompts or animate starting photos using Gemini Omni Flash via the official Interactions API.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMode('text');
                setPrompt('Cinematic macro view of luminous blue bioluminescent waves crashing gently on a midnight beach.');
                setImageBase64(null);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer"
            >
              Text-to-Video Preset
            </button>
            <button
              onClick={handleLoadSamplePhoto}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer"
            >
              Animate Photo Preset
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Controls vs Video Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Mode Switcher */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Generation Pipeline
              </span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setMode('text')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    mode === 'text'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Generate from Text
                </button>
                <button
                  onClick={() => setMode('image')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    mode === 'image'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Animate Image
                </button>
              </div>
            </div>

            {/* Aspect Ratio & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Aspect Ratio (Mandatory)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAspectRatio('16:9')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                      aspectRatio === '16:9'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    16:9 Landscape
                  </button>
                  <button
                    onClick={() => setAspectRatio('9:16')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                      aspectRatio === '9:16'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    9:16 Portrait
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Clip Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDuration('5s')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                      duration === '5s'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    5 Seconds
                  </button>
                  <button
                    onClick={() => setDuration('10s')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                      duration === '10s'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    10 Seconds
                  </button>
                </div>
              </div>
            </div>

            {/* Image Uploader when Animate Image mode */}
            {mode === 'image' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-900 dark:text-white">
                    Starting Keyframe Photo
                  </label>
                  <button
                    onClick={handleLoadSamplePhoto}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                  >
                    Load Sample Photo
                  </button>
                </div>

                {imageBase64 ? (
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <img
                      src={imageBase64}
                      alt="Starting frame"
                      className="w-16 h-16 object-cover rounded-md border"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-medium text-slate-900 dark:text-white block">Keyframe loaded</span>
                      <span className="text-[11px] text-slate-500">Model will synthesize temporal motion from this frame</span>
                    </div>
                    <button
                      onClick={() => setImageBase64(null)}
                      className="text-xs text-red-500 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    <span>Upload starting photo to animate</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>
            )}

            {/* Prompt input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Motion & Direction Prompt
                </label>
                {prompt && (
                  <button
                    type="button"
                    onClick={() => setPrompt('')}
                    className="text-[11px] font-semibold text-slate-400 hover:text-red-500 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Clear prompt text"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                    <span>Clear Prompt</span>
                  </button>
                )}
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Describe lighting, camera movement, and kinetic behavior..."
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || (!prompt && !imageBase64)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                  isGenerating || (!prompt && !imageBase64)
                    ? 'bg-blue-400 opacity-60 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Synthesizing Video via Omni Flash...</span>
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4" />
                    <span>{mode === 'image' ? 'Animate Photo into Video' : 'Generate Video from Prompt'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrompt('');
                  setImageBase64(null);
                }}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer shrink-0"
                title="Reset input fields"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Video Playback & Output (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col min-h-[480px]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-500" />
                Rendered Video Viewport
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.querySelector('textarea');
                    el?.focus();
                  }}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Edit prompt text"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Prompt</span>
                </button>
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setVideoUrl(null);
                      setElapsedMs(null);
                      setError(null);
                    }}
                    className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-900 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Delete / clear generated video"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Video</span>
                  </button>
                )}
                <span className="text-xs text-slate-500 font-mono">
                  {aspectRatio} · {duration}
                </span>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-2">
              {isGenerating ? (
                <div className="text-center p-6 space-y-3">
                  <div className="w-12 h-12 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Omni Flash Temporal Synthesis Running...
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Calling ai.interactions.create with model gemini-omni-1.1-flash. Generating keyframes and physics simulation.
                  </p>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-xs space-y-2 max-w-md w-full">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Video Generation Note</span>
                  </div>
                  <p className="text-red-600 dark:text-red-300 font-mono text-[11px] break-words">
                    {error}
                  </p>
                  <p className="text-slate-500 text-[11px] pt-1 border-t border-red-100 dark:border-red-900/40">
                    Gemini Omni Flash is a paid tier model. Ensure your attached API key has billing enabled in Google AI Studio to render production video clips.
                  </p>
                </div>
              ) : videoUrl ? (
                <div className="w-full flex flex-col items-center space-y-3">
                  <div
                    className={`relative rounded-xl overflow-hidden bg-black shadow-lg border border-slate-800 ${
                      aspectRatio === '9:16' ? 'w-64 aspect-[9/16]' : 'w-full aspect-[16/9]'
                    }`}
                  >
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Generated in {elapsedMs ? `${(elapsedMs / 1000).toFixed(1)}s` : '~'}
                    </span>
                    <span>·</span>
                    <a
                      href={videoUrl}
                      download={`gemini_omni_video_${Date.now()}.mp4`}
                      className="text-blue-600 hover:underline cursor-pointer"
                    >
                      Download MP4
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                    <Film className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No Video Generated Yet
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                    Choose Text-to-Video or Animate Image, select 16:9 or 9:16 aspect ratio, and click generate to invoke Gemini Omni Flash.
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
