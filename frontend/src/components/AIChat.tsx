import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Sparkles, ChevronDown, ChevronUp, Cpu, Trash2, ArrowUpRight, Key, Check, ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";
import { KatexMath } from "./Whiteboard";
import { ThemeType } from "../types";
import MorphOrb from "@/components/ui/ai-thiking-orb-and-input";

interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
}

const STARTER_PROMPTS = [
  { label: "Right Triangle / Pythagoras", query: "Find hypotenuse of right triangle with legs a = 3, b = 4" },
  { label: "Trig Equation", query: "Solve 2\\sin(x) - 1 = 0 on [0, 2\\pi]" },
  { label: "Circle Properties", query: "Find area and circumference of circle with radius r = 5" },
  { label: "Unit Circle Coordinates", query: "Unit circle coordinates for \\theta = \\frac{\\pi}{3}" },
  { label: "Triangle Heron's Area", query: "Find area of triangle with sides a = 5, b = 12, c = 13" },
  { label: "Trig Identity Proof", query: "Simplify \\sin^2(x) + \\cos^2(x)" },
];

function ThinkingAccordion({ reasoning }: { reasoning?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!reasoning) return null;

  return (
    <div className="mb-3 rounded-xl border border-purple-500/30 bg-purple-950/25 backdrop-blur-md overflow-hidden text-xs shadow-inner">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-purple-300 hover:text-purple-100 hover:bg-purple-900/30 transition-colors text-[11px] font-mono cursor-pointer select-none"
      >
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
          </span>
          <span className="font-semibold text-purple-200">Orb Thought Process</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
            16k Budget
          </span>
        </span>
        <span className="flex items-center gap-1 text-purple-300/80">
          <span className="text-[10px]">{expanded ? "Collapse" : "Expand"}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {expanded && (
        <div className="p-3 bg-black/70 border-t border-purple-500/20 max-h-56 overflow-y-auto font-mono text-[11px] text-purple-100/90 whitespace-pre-wrap leading-relaxed select-text scrollbar-thin scrollbar-thumb-purple-500/30">
          {reasoning}
        </div>
      )}
    </div>
  );
}

function FormattedChatMessage({ content }: { content?: string }) {
  if (!content) return null;
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\)|(?:\$[^$\n]+\$))/g;
  const parts = content.split(regex);

  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, index) => {
        if (!part) return null;
        if (
          part.startsWith("$$") ||
          part.startsWith("\\[") ||
          part.startsWith("\\(") ||
          part.startsWith("$")
        ) {
          const isBlock = part.startsWith("$$") || part.startsWith("\\[");
          return <KatexMath key={index} math={part} block={isBlock} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}

interface AIChatProps {
  solution?: any;
  currentSence?: any;
  theme?: ThemeType;
  onSolveEquation?: (equation: string) => void;
  standalone?: boolean;
  onClose?: () => void;
}

export default function AIChat({
  solution,
  currentSence,
  theme = "chalkboard",
  onSolveEquation,
  standalone = false,
  onClose,
}: AIChatProps) {
  const [isOpen, setIsOpen] = useState(standalone);
  const [mode, setMode] = useState<"chat" | "orb">("orb");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem("math_api_key") || "");
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const [apiStatus, setApiStatus] = useState<{ connected: boolean; engine: string; model: string; hasKey: boolean } | null>(null);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch API status on mount
  useEffect(() => {
    fetch("/api/chat/status")
      .then((res) => res.json())
      .then((data) => setApiStatus(data))
      .catch((err) => console.warn("Failed to fetch chat status:", err));
  }, [customApiKey]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isOpen, mode, loading]);

  const handleTestKey = async () => {
    setTestingKey(true);
    setTestResult(null);
    const t0 = performance.now();
    try {
      const activeKey = tempApiKey.trim() || customApiKey || undefined;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeKey) headers["X-API-Key"] = activeKey;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [{ role: "user", content: "What is 2+2?" }],
          apiKey: activeKey,
        }),
      });

      const latency = Math.round(performance.now() - t0);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.reply) {
        setTestResult({
          success: true,
          message: `Connected successfully! Latency: ${latency}ms`,
          latency,
        });
      } else {
        throw new Error("No response received");
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `Connection failed: ${e.message}`,
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveKey = () => {
    const trimmed = tempApiKey.trim();
    if (trimmed) {
      localStorage.setItem("math_api_key", trimmed);
      setCustomApiKey(trimmed);
    } else {
      localStorage.removeItem("math_api_key");
      setCustomApiKey("");
    }
    setIsKeyModalOpen(false);
    setTestResult(null);
  };

  const handleClearKey = () => {
    localStorage.removeItem("math_api_key");
    setCustomApiKey("");
    setTempApiKey("");
    setTestResult(null);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || message).trim();
    if (!text || loading) return;

    const userMessage: Message = {
      role: "user",
      content: text
    };

    setHistory((prev) => [...prev, userMessage]);
    if (!textToSend) setMessage("");
    setLoading(true);

    try {
      const contextStr = solution
        ? `The user is currently solving: ${solution.equation}. They are looking at this specific step: "${currentSence?.title} - ${currentSence?.explanation}".`
        : "";

      const activeKey = customApiKey || localStorage.getItem("math_api_key") || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeKey) {
        headers["X-API-Key"] = activeKey;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [...history, userMessage],
          context: contextStr,
          apiKey: activeKey || undefined,
        })
      });

      if (!response.ok) {
        throw new Error("Chat request failed.");
      }

      const data = await response.json();
      const replyText = data.reply || data.response || data.message || "I'm here to help! Feel free to ask about any step or formula.";
      const reasoningText = data.reasoning;
      const modelMessage: Message = {
        role: "assistant",
        content: replyText,
        reasoning: reasoningText
      };

      setHistory((prev) => [...prev, modelMessage]);
    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm having trouble connecting right now. Please ensure the backend is running."
      };
      setHistory((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleOrbSolve = async (text: string): Promise<string> => {
    try {
      const token = localStorage.getItem("math_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/solve", {
        method: "POST",
        headers,
        body: JSON.stringify({ equation: text }),
      });

      if (res.status === 403) {
        const err = await res.json().catch(() => ({}));
        return err.detail || "Pro subscription required for advanced equation types.";
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return err.detail || `Unable to solve "${text}". Check syntax (e.g. x^2 - 5x + 6, det([[1,2],[3,4]])).`;
      }

      const data = await res.json();
      if (onSolveEquation) {
        onSolveEquation(text);
      }

      const ans = data.finalAnswer ? `Ans: ${data.finalAnswer}` : "Solved";
      const summary = data.summary ? ` • ${data.summary}` : "";
      const resultString = `${ans}${summary}`;

      setHistory((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: `Thinking Orb Solver:\n${resultString}` },
      ]);

      return resultString;
    } catch (e: any) {
      return `Solver error: ${e.message || "Failed to reach solver"}`;
    }
  };

  return (
    <>
      {/* Floating Assistant Orb Launcher Button */}
      {!standalone && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-20 right-6 z-50 group relative flex items-center justify-center w-14 h-14 rounded-full cursor-pointer shadow-2xl transition-all transform hover:scale-105 active:scale-95"
          title="Open Thinking Orb Chat"
        >
          {/* Pulsing aurora glow */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 opacity-70 blur-md group-hover:opacity-100 transition duration-500 animate-pulse" />
          
          {/* Glass orb button surface */}
          <div className="relative w-full h-full rounded-full bg-[#0f1117]/90 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-inner overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-purple-500/10 to-transparent pointer-events-none" />
            {isOpen ? (
              <X className="w-5 h-5 text-white relative z-10 transition-transform group-hover:rotate-90 duration-300" />
            ) : (
              <div className="relative flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-cyan-300 animate-pulse relative z-10" />
                <span className="absolute w-2 h-2 rounded-full bg-blue-400 blur-[2px]" />
              </div>
            )}
          </div>
        </button>
      )}

      {/* Slide-out / Pop-up Chat Window OR Standalone Workspace */}
      {(isOpen || standalone) && (
        <div
          className={
            standalone
              ? "w-full max-w-5xl mx-auto h-[calc(100vh-140px)] min-h-[640px] rounded-3xl flex flex-col bg-[#0b0e17]/95 border border-white/15 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(59,130,246,0.15)] backdrop-blur-2xl overflow-hidden relative"
              : "fixed bottom-28 right-6 z-50 w-[380px] sm:w-[480px] h-[580px] sm:h-[620px] rounded-3xl flex flex-col bg-[#0b0e17]/95 border border-white/15 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(59,130,246,0.15)] backdrop-blur-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300 relative"
          }
        >
          {/* Ambient Orb Aurora Lights Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
            <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-purple-500/15 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl" />
          </div>

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 py-3.5 bg-white/[0.03] border-b border-white/[0.08] backdrop-blur-md">
            <div className="flex items-center gap-3">
              {/* Mini glowing Orb */}
              <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 shadow-[0_0_12px_rgba(59,130,246,0.6)]">
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-wide text-white">Thinking Orb AI</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTempApiKey(customApiKey || localStorage.getItem("math_api_key") || "");
                      setTestResult(null);
                      setIsKeyModalOpen(true);
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1.5 cursor-pointer transition-all ${
                      apiStatus?.hasKey || customApiKey
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25 shadow-[0_0_8px_rgba(52,211,153,0.25)]"
                        : "bg-blue-500/15 text-blue-300 border border-blue-400/30 hover:bg-blue-500/25 shadow-[0_0_8px_rgba(59,130,246,0.25)]"
                    }`}
                    title="API Key & LLM Engine Settings"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${apiStatus?.hasKey || customApiKey ? "bg-emerald-400 animate-pulse" : "bg-blue-400"}`} />
                    <Key className="w-2.5 h-2.5" />
                    <span>{customApiKey ? "Custom Key" : apiStatus?.engine ? apiStatus.engine.replace("NVIDIA ", "") : "Nemotron 3.5"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {history.length > 0 && mode === "chat" && (
                <button
                  onClick={() => setHistory([])}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Clear chat history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {(onClose || !standalone) && (
                <button
                  onClick={() => {
                    if (standalone && onClose) onClose();
                    else setIsOpen(false);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="relative z-10 flex items-center gap-1.5 p-1 mx-4 my-2.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setMode("orb")}
              className={`flex-1 py-1.5 px-3 rounded-full flex items-center justify-center gap-2 text-xs font-medium transition-all cursor-pointer ${
                mode === "orb"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-blue-400/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Thinking Orb</span>
            </button>
            <button
              onClick={() => setMode("chat")}
              className={`flex-1 py-1.5 px-3 rounded-full flex items-center justify-center gap-2 text-xs font-medium transition-all cursor-pointer ${
                mode === "chat"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-blue-400/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-300" />
              <span>Chat Tutor</span>
            </button>
          </div>

          {/* Mode Content */}
          {mode === "orb" ? (
            <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
              <div className="absolute top-2 left-0 right-0 text-center z-20 pointer-events-none px-4">
                <span className="text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded-full bg-white/5 border border-white/10 text-cyan-300 backdrop-blur-md shadow-lg">
                  ✨ Type math proposition to trigger Thinking Orb solve
                </span>
              </div>
              <div className="w-full h-full relative">
                <MorphOrb
                  onSubmit={handleOrbSolve}
                  minThinkMs={2200}
                  className="w-full h-full"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative z-10">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                    {/* Glowing Orb Center Icon */}
                    <div className="relative w-16 h-16 rounded-full flex items-center justify-center mb-4">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 blur-lg opacity-70 animate-pulse" />
                      <div className="relative w-14 h-14 rounded-full bg-[#111624] border border-blue-400/40 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Sparkles className="w-7 h-7 text-cyan-300 animate-pulse" />
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold tracking-wide text-white">
                      Thinking Orb Math Tutor
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                      Ask any theorem, calculus step, linear algebra proof, or step-by-step derivation.
                    </p>

                    {/* Starter Suggestions */}
                    <div className="mt-5 w-full max-w-sm flex flex-col gap-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                        Suggested Inquiries
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {STARTER_PROMPTS.map((prompt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSend(prompt.query)}
                            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-blue-400/40 text-left transition-all duration-200 group cursor-pointer shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-slate-200 group-hover:text-blue-300 transition-colors">
                                {prompt.label}
                              </span>
                              <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-300 transition-colors" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  history.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
                    >
                      {msg.role === "user" ? (
                        <div className="max-w-[85%] rounded-2xl rounded-tr-xs px-4 py-2.5 text-[13px] leading-relaxed bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white border border-blue-400/30 shadow-[0_4px_18px_rgba(37,99,235,0.25)] font-sans">
                          <FormattedChatMessage content={msg.content} />
                        </div>
                      ) : (
                        <div className="max-w-[90%] rounded-2xl rounded-tl-xs px-4 py-3.5 text-[13px] leading-relaxed bg-[#0f141e]/90 border border-white/10 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] text-slate-100 backdrop-blur-xl">
                          {/* Answer status tag */}
                          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/[0.06] text-[10px] font-mono tracking-wider uppercase">
                            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                              <span>ANSWER</span>
                            </div>
                            <span className="text-slate-400 text-[9px] tracking-widest">ORB ENGINE</span>
                          </div>
                          {msg.reasoning && <ThinkingAccordion reasoning={msg.reasoning} />}
                          <FormattedChatMessage content={msg.content} />
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Orb Thinking / Loading Indicator */}
                {loading && (
                  <div className="flex justify-start animate-in fade-in duration-300">
                    <div className="rounded-2xl rounded-tl-xs px-4 py-3 bg-[#0f141e]/90 border border-white/10 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.6)] backdrop-blur-xl flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-6 h-6">
                        <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping opacity-60" />
                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-400 to-cyan-300 shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-pulse" />
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                        <span>Thinking & formulating proof</span>
                        <span className="inline-flex gap-1 ml-0.5">
                          <i className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
                          <i className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                          <i className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Orb Pill Input Bar Footer */}
              <div className="p-3.5 bg-[#0b0e14]/90 border-t border-white/[0.08] backdrop-blur-2xl relative z-20">
                {/* Underglow aura */}
                <div className="absolute inset-x-8 bottom-0 h-8 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-teal-600/20 blur-xl pointer-events-none" />

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="relative flex items-center gap-2.5 rounded-full bg-[#0f131c]/95 border border-white/15 px-4 py-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] focus-within:border-blue-400/60 focus-within:shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all"
                >
                  <Sparkles className="w-4 h-4 text-slate-400 shrink-0 transition-colors group-focus-within:text-blue-400" />
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask anything or propose an equation…"
                    className="flex-1 bg-transparent border-none outline-none text-[13px] text-slate-100 placeholder:text-slate-500 font-medium tracking-tight"
                  />
                  <button
                    type="submit"
                    disabled={loading || !message.trim()}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                      message.trim() && !loading
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_14px_rgba(59,130,246,0.6)] scale-105 active:scale-95"
                        : "bg-white/[0.06] text-slate-500 opacity-40 cursor-not-allowed"
                    }`}
                    title="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </>
          )}

          {/* API Key Configuration Modal Overlay */}
          {isKeyModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
              <div className="w-full max-w-sm rounded-2xl bg-[#0f1422] border border-white/20 p-5 shadow-2xl text-left relative flex flex-col gap-4">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">AI Engine & API Key</h4>
                      <p className="text-[11px] text-slate-400">Tutor & Voice Intelligence</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsKeyModalOpen(false);
                      setTestResult(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Backend Engine Status */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Active Provider</span>
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {customApiKey ? "Custom Override" : apiStatus?.engine || "NVIDIA Nemotron 3.5"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Model</span>
                    <span className="font-mono text-[10px] text-slate-300">
                      {apiStatus?.model || "nvidia/nemotron-3.5-lightning-30b-a3b"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Server Key Status</span>
                    <span className={`text-[10px] font-mono ${apiStatus?.hasKey ? "text-emerald-400" : "text-amber-400"}`}>
                      {apiStatus?.hasKey ? "Configured in .env" : "Not configured"}
                    </span>
                  </div>
                </div>

                {/* Key Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                    <span>Custom API Key (Optional)</span>
                    {customApiKey && (
                      <button
                        onClick={handleClearKey}
                        className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Reset to Server Default
                      </button>
                    )}
                  </label>
                  <input
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="Paste nvapi-..., AIzaSy..., or sk-..."
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 transition-colors font-mono"
                  />
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Leave blank to use the server's default NVIDIA Nemotron key from <code className="text-blue-300">.env</code>.
                  </p>
                </div>

                {/* Test feedback */}
                {testResult && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                      testResult.success
                        ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-400/30 text-rose-300"
                    }`}
                  >
                    {testResult.success ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span className="text-[11px] leading-tight">{testResult.message}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={testingKey}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingKey ? "animate-spin" : ""}`} />
                    <span>{testingKey ? "Testing..." : "Test Connection"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-medium text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
