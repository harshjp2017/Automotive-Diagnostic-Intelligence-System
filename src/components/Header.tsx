import React from 'react';
import { Sun, Moon, Wrench, Sparkles, LogIn, LogOut, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  hasApiKey: boolean;
  onExecutePrompt: () => void;
  isExecuting: boolean;
  user: any;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDark,
  setIsDark,
  hasApiKey,
  onExecutePrompt,
  isExecuting,
  user,
  onSignIn,
  onSignOut,
}) => {
  const navItems = [
    { id: 'autorag', label: 'Auto Service RAG' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark (Auto Service RAG) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Wrench className="w-4 h-4" />
          </div>
          <button
            onClick={() => setActiveTab('autorag')}
            className="text-left cursor-pointer focus:outline-none"
          >
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap block">
              Auto Service RAG
            </span>
          </button>
        </div>

        {/* Zone 2: Single Project Active Tab */}
        <nav className="hidden sm:flex items-center gap-3 text-sm font-medium">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Automotive Engineering Platform</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">Gemini 3.8 + Firestore</span>
          </div>
        </nav>

        {/* Zone 3: Auth & Primary Action + Theme Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Firebase Auth Button */}
          {user ? (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-slate-500" />
              )}
              <span className="font-medium text-slate-700 dark:text-slate-200 max-w-[90px] truncate hidden sm:inline">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <button
                onClick={onSignOut}
                title="Sign out"
                className="text-slate-400 hover:text-red-500 p-0.5 ml-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 text-blue-500" />
              <span>Google Sign-In</span>
            </button>
          )}

          <button
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle theme"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={onExecutePrompt}
            disabled={isExecuting}
            className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              isExecuting
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
            }`}
          >
            {isExecuting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run Prompt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile indicator */}
      <div className="sm:hidden flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-xs">
        <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" />
          <span>Auto Service RAG</span>
        </span>
        <span className="text-[10px] text-slate-500 font-mono">Vertex AI & Gemini 3.8</span>
      </div>
    </header>
  );
};
