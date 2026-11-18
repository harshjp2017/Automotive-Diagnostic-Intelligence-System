import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AutoServiceRag } from './components/AutoServiceRag';
import { ApiStatus, GenerateResponse, QuotaState } from './types';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import { auth, googleProvider, testFirestoreConnection } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('autorag');
  const [isDark, setIsDark] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // User Auth State
  const [user, setUser] = useState<any>(null);

  // Prompt configuration state
  const [model, setModel] = useState<string>('gemini-3.8-flash');
  const [systemInstruction, setSystemInstruction] = useState<string>('');
  const [thinkingLevel, setThinkingLevel] = useState<string>('MEDIUM');
  const [prompt, setPrompt] = useState<string>('Explain how quantum supremacy differs from classical computing, and provide 3 concrete industry applications.');
  const [responseFormat, setResponseFormat] = useState<string>('text');
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Execution state
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Server API & Quota state
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [quotaState, setQuotaState] = useState<QuotaState>({
    requestsThisMinute: 0,
    tokensThisMinute: 0,
    requestsToday: 0,
    lastRequestTime: Date.now(),
  });

  // Dark mode effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Auth & Connection Initialization
  useEffect(() => {
    testFirestoreConnection();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Fetch initial API status
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => setApiStatus(data))
      .catch((err) => console.error('Failed to load API status:', err));
  }, []);

  // Rolling 60s quota reset timer
  useEffect(() => {
    const interval = setInterval(() => {
      setQuotaState((prev) => ({
        ...prev,
        requestsThisMinute: 0,
        tokensThisMinute: 0,
      }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Firebase Auth sign-in error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Firebase Auth sign-out error:', err);
    }
  };

  // Execution runner
  const handleExecute = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setError(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model,
          systemInstruction,
          thinkingLevel,
          responseFormat,
          imageBase64,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setLastResponse(data);

      // Record quota usage
      const tokensUsed = data.usageMetadata?.totalTokenCount || 500;
      setQuotaState((prev) => ({
        requestsThisMinute: prev.requestsThisMinute + 1,
        tokensThisMinute: prev.tokensThisMinute + tokensUsed,
        requestsToday: prev.requestsToday + 1,
        lastRequestTime: Date.now(),
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to complete execution');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSelectModelFromMatrix = (selectedModelId: string) => {
    setModel(selectedModelId);
    setActiveTab('workbench');
  };

  const handleResetSessionQuota = () => {
    setQuotaState({
      requestsThisMinute: 0,
      tokensThisMinute: 0,
      requestsToday: 0,
      lastRequestTime: Date.now(),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Navigation Bar with Google Sign-in and Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDark={isDark}
        setIsDark={setIsDark}
        hasApiKey={Boolean(apiStatus?.hasApiKey)}
        onExecutePrompt={handleExecute}
        isExecuting={isExecuting}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {/* Main Viewport: Single Unified Automotive Project */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AutoServiceRag
          user={user}
          onRequireAuth={handleSignIn}
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
          onExecute={handleExecute}
          lastResponse={lastResponse}
          error={error}
          quotaState={quotaState}
          onResetSessionQuota={handleResetSessionQuota}
          onRecordQuota={(tokens) => {
            setQuotaState((prev) => ({
              ...prev,
              requestsThisMinute: prev.requestsThisMinute + 1,
              tokensThisMinute: prev.tokensThisMinute + tokens,
              requestsToday: prev.requestsToday + 1,
              lastRequestTime: Date.now(),
            }));
          }}
          onSelectModelFromMatrix={handleSelectModelFromMatrix}
        />
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Auto Service RAG
            </span>
            <span>·</span>
            <span>Automotive Diagnostic Intelligence Platform</span>
            {user && (
              <>
                <span>·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Firestore Connected ({user.email})
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-5">
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              <span>Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://ai.google.dev/gemini-api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              <span>Gemini Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => setActiveTab('setup')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Setup Guide
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
