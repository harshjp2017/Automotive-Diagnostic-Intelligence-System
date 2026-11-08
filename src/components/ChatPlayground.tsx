import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Clock, Sparkles, Brain, Zap, ShieldAlert, Edit3, Check, X } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatPlaygroundProps {
  model: string;
  setModel?: (m: string) => void;
  systemInstruction: string;
}

export const ChatPlayground: React.FC<ChatPlaygroundProps> = ({
  model: initialModel,
  systemInstruction: initialSys,
}) => {
  const [selectedModel, setSelectedModel] = useState(initialModel || 'gemini-3.8-flash');
  const [selectedRole, setSelectedRole] = useState<'master_tech' | 'general' | 'architect' | 'researcher' | 'analyst'>('master_tech');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');

  const roles = [
    {
      id: 'master_tech',
      name: 'Master Tech (RAG Manuals Grounded)',
      model: 'gemini-3.8-flash',
      prompt: 'You are the Lead ASE Master Certified Diagnostic Specialist for Auto Service RAG. You have direct access to factory service manuals and TSBs (Ford F-150, Toyota RAV4 Hybrid, Tesla Model 3, BMW 330i, Chevrolet Silverado, and custom manuals like Harsh Patel vision 2050). Always provide verified DTC steps, torque specs, safety callouts, and manual citations.',
    },
    {
      id: 'general',
      name: 'General Assistant',
      model: 'gemini-3.8-flash',
      prompt: 'You are a versatile, knowledgeable, and helpful AI assistant for general engineering and technical problem solving.',
    },
    {
      id: 'architect',
      name: 'Complex Reasoning (Argon)',
      model: 'gemini-4-argon',
      prompt: 'You are a world-class principal system architect. Focus on deep multi-step deduction, mathematical rigor, and software invariants.',
    },
    {
      id: 'researcher',
      name: 'High-Speed (Flash Lite)',
      model: 'gemini-3.1-flash-lite',
      prompt: 'You are a lightning-fast technical assistant. Deliver rapid, direct, and concise answers without unnecessary preamble.',
    },
    {
      id: 'analyst',
      name: 'Data & Systems Analyst',
      model: 'gemini-3.8-flash',
      prompt: 'You are an expert data analyst and systems troubleshooter. Structure your evaluations with concrete metrics and tabular data.',
    },
  ];

  const currentSysInstruction = customSystemPrompt || roles.find((r) => r.id === selectedRole)?.prompt || '';
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      content: 'Hello! I am your Lead ASE Master Technician & Engineering Assistant, directly grounded in the shop\'s Auto Service RAG OEM manual database (including Ford, Toyota, Tesla, BMW, Chevrolet, and custom shop manuals like Harsh Patel vision 2050). How can I assist your diagnostic or repair work today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Exclude initial greeting turn so history starts with a user turn
      const history = messages
        .filter((m) => m.id !== '1' || m.role === 'user')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history,
          model: selectedModel,
          systemInstruction: currentSysInstruction,
        }),
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          res.ok
            ? 'Received unexpected response format from server.'
            : `Server returned error (${res.status}): ${rawText.slice(0, 160)}`
        );
      }

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.text || 'No response returned.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        elapsedMs: data.elapsedMs,
        tokens: data.usageMetadata?.totalTokenCount,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `Error: ${err.message}. If you hit a rate limit (15 RPM), please pause briefly and retry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleStartEditMessage = (m: ChatMessage) => {
    setEditingMsgId(m.id);
    setEditingContent(m.content);
  };

  const handleSaveEditMessage = (id: string) => {
    if (!editingContent.trim()) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: editingContent.trim() } : m))
    );
    setEditingMsgId(null);
    setEditingContent('');
  };

  const handleClear = () => {
    setMessages([
      {
        id: '1',
        role: 'model',
        content: `Chat session reset with role [${roles.find(r => r.id === selectedRole)?.name}]. Grounded in Auto Service RAG knowledge base. Ready for technical instructions.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col h-[700px]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Gemini Chatbot with Specialized Roles
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-medium text-blue-600 dark:text-blue-400">{selectedModel}</span>
              <span aria-hidden="true">·</span>
              <span>Full Multi-Turn History</span>
              <span aria-hidden="true">·</span>
              <span>System Role Grounding</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model Selector */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash (General Tasks)</option>
              <option value="gemini-4-argon">gemini-4-argon (Complex Reasoning)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast Speed)</option>
            </select>

            <button
              onClick={handleClear}
              className="p-1.5 text-slate-500 hover:text-red-500 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Roles Strip */}
        <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-[11px] text-slate-400 mr-1">Role:</span>
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setSelectedRole(r.id as any);
                setSelectedModel(r.model);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs font-medium ${
                selectedRole === r.id
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((m) => {
            const isError = m.content.startsWith('Error:') || m.content.toLowerCase().includes('is not valid json');

            return (
              <div
                key={m.id}
                className={`group flex items-start gap-3 ${
                  m.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : isError
                      ? 'bg-red-100 text-red-600 border border-red-300 dark:bg-red-950 dark:border-red-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {m.role === 'user' ? (
                    <User className="w-3.5 h-3.5" />
                  ) : isError ? (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
                </div>

                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isError
                      ? 'bg-red-50/90 dark:bg-red-950/50 text-red-900 dark:text-red-200 border-2 border-red-300 dark:border-red-800/80 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  {editingMsgId === m.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={3}
                        className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingMsgId(null)}
                          className="px-2.5 py-1 rounded text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditMessage(m.id)}
                          className="px-3 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          <span>Save Edit</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {isError ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-red-200 dark:border-red-800/60 text-xs font-bold text-red-700 dark:text-red-300">
                            <span className="flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                              <span>Error Alert</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMessage(m.id);
                              }}
                              className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                              title="Delete and dismiss this error message"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete Error</span>
                            </button>
                          </div>
                          <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-red-800 dark:text-red-200">
                            {m.content}
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      )}

                      <div
                        className={`mt-2 pt-1.5 border-t ${
                          m.role === 'user'
                            ? 'border-blue-500/40 text-blue-100'
                            : isError
                            ? 'border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400'
                            : 'border-slate-200/60 dark:border-slate-700/60 text-slate-400'
                        } flex items-center justify-between text-[11px] font-mono tabular-nums`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{m.timestamp}</span>
                          {m.elapsedMs && (
                            <>
                              <span>·</span>
                              <span>{m.elapsedMs}ms</span>
                            </>
                          )}
                          {m.tokens && (
                            <>
                              <span>·</span>
                              <span>{m.tokens} tokens</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 ml-3">
                          <button
                            type="button"
                            onClick={() => handleStartEditMessage(m)}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                              m.role === 'user'
                                ? 'bg-blue-700 hover:bg-blue-800 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200'
                            }`}
                            title="Edit this message text"
                          >
                            <Edit3 className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMessage(m.id);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                              m.role === 'user'
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-red-100 dark:bg-red-950/60 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                            }`}
                            title="Delete this message"
                          >
                            <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                <span>Gemini is generating response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything or request code assistance..."
              disabled={isLoading}
              className="flex-1 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`p-2.5 rounded-lg text-white transition-all cursor-pointer ${
                isLoading || !input.trim()
                  ? 'bg-blue-400 opacity-60 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
