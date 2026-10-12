import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, RefreshCw, Sparkles, ChevronDown, ChevronUp, Brain, Cpu } from "lucide-react";
import { KatexMath } from "./Whiteboard";
import { ThemeType } from "../types";
import MorphOrb from "@/components/ui/ai-thiking-orb-and-input";

interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
}

function ThinkingAccordion({ reasoning }: { reasoning?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!reasoning) return null;

  return (
    <div className="mb-2.5 rounded-lg border border-purple-500/30 bg-purple-950/30 overflow-hidden text-xs shadow-inner">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-purple-300 hover:text-purple-100 hover:bg-purple-900/40 transition-colors text-[11px] font-mono cursor-pointer select-none"
      >
        <span className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span className="font-semibold text-purple-200">NVIDIA Nemotron 3.5 Thought Process</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
            16k Budget
          </span>
        </span>
        <span className="flex items-center gap-1 text-purple-300">
          <span className="text-[10px]">{expanded ? "Collapse" : "Expand"}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {expanded && (
        <div className="p-2.5 bg-black/60 border-t border-purple-500/20 max-h-56 overflow-y-auto font-mono text-[11px] text-purple-100/90 whitespace-pre-wrap leading-relaxed select-text scrollbar-thin">
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isOpen]);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: message
    };

    setHistory((prev) => [...prev, userMessage]);
    setMessage("");
    setLoading(true);

    try {
      const contextStr = solution
        ? `The user is currently solving: ${solution.equation}. They are looking at this specific step: "${currentSence?.title} - ${currentSence?.explanation}".`
        : "";

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, userMessage],
          context: contextStr
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
        content: "I'm having trouble connecting right now. Please ensure the frontend server was restarted with npm run dev."
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

  // Determine theme styles
  const isLightAcademic = theme === "lightAcademic";
  const isDarkAI = theme === "darkAI";
  const isNotebook = theme === "notebook";
  const isBlueprint = theme === "blueprint";
  const isCosmos = theme === "cosmos";
  const isChalkboard = theme === "chalkboard";

  const getButtonStyles = () => {
    if (isLightAcademic) {
      return "bg-white hover:bg-slate-50 text-[#2563EB] border border-[#E2E8F0] shadow-xl shadow-slate-300/60 academic-light-frame";
    }
    if (isDarkAI) {
      return "bg-[#111827] hover:bg-[#182338] text-cyan-400 border border-[#273449] shadow-xl shadow-indigo-950/80 dark-ai-frame";
    }
    if (isNotebook) {
      return "bg-[#FFFDF8] hover:bg-[#FAF5EA] text-[#1E40AF] border border-[#E2DAC7] shadow-xl shadow-stone-300/60 notebook-frame";
    }
    if (isBlueprint) {
      return "bg-[#061b36] hover:bg-[#0a274c] text-cyan-300 border border-cyan-500/40 shadow-xl shadow-cyan-950/60";
    }
    if (isCosmos) {
      return "bg-[#0e0724] hover:bg-[#180d3d] text-purple-300 border border-purple-500/40 shadow-xl shadow-purple-950/60";
    }
    // Chalkboard / default
    return "bg-[#12241b] hover:bg-[#1a3528] text-amber-300 border border-amber-500/40 shadow-black/60 academic-frame";
  };

  const getWindowStyles = () => {
    if (isLightAcademic) {
      return "bg-white/98 border border-[#E2E8F0] shadow-2xl text-[#0F172A] academic-light-frame";
    }
    if (isDarkAI) {
      return "bg-[#111827]/98 border border-[#273449] shadow-2xl text-[#F8FAFC] dark-ai-frame";
    }
    if (isNotebook) {
      return "bg-[#FFFDF8]/98 border border-[#E2DAC7] shadow-2xl text-[#242018] notebook-frame";
    }
    if (isBlueprint) {
      return "bg-[#061b36]/98 border border-cyan-500/40 shadow-2xl text-cyan-50";
    }
    if (isCosmos) {
      return "bg-[#0e0724]/98 border border-purple-500/40 shadow-2xl text-purple-50";
    }
    return "bg-[#0c1813]/98 border border-amber-900/40 shadow-2xl shadow-black/80 academic-frame";
  };

  const getHeaderStyles = () => {
    if (isLightAcademic) {
      return "bg-slate-50/95 border-b border-[#E2E8F0]";
    }
    if (isDarkAI) {
      return "bg-[#0B1020]/95 border-b border-[#273449]";
    }
    if (isNotebook) {
      return "bg-[#FAF8F3]/95 border-b border-[#E2DAC7]";
    }
    if (isBlueprint) {
      return "bg-[#041224]/95 border-b border-cyan-500/30";
    }
    if (isCosmos) {
      return "bg-[#060412]/95 border-b border-purple-500/30";
    }
    return "bg-[#09130f]/90 border-b border-amber-900/30";
  };

  const getBodyBg = () => {
    if (isLightAcademic) return "bg-[#F8FAFC]";
    if (isDarkAI) return "bg-[#0B1020]";
    if (isNotebook) return "bg-notebook-canvas";
    if (isBlueprint) return "bg-[#041224]";
    if (isCosmos) return "bg-[#060412]";
    return "bg-blackboard-canvas";
  };

  const getFooterStyles = () => {
    if (isLightAcademic) return "bg-slate-50 border-t border-[#E2E8F0]";
    if (isDarkAI) return "bg-[#0B1020] border-t border-[#273449]";
    if (isNotebook) return "bg-[#FAF8F3] border-t border-[#E2DAC7]";
    if (isBlueprint) return "bg-[#041224] border-t border-cyan-500/30";
    if (isCosmos) return "bg-[#060412] border-t border-purple-500/30";
    return "bg-[#09130f] border-t border-amber-900/30";
  };

  return (
    <>
      {/* Floating Toggle Button (only when not standalone) */}
      {!standalone && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed bottom-20 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer ${getButtonStyles()}`}
          title={isLightAcademic ? "Consult Academic AI Tutor" : isDarkAI ? "Consult Neural AI Tutor" : isNotebook ? "Consult Notebook Tutor" : "Consult Scholar AI Tutor"}
        >
          {isOpen ? (
            <X className={`w-5 h-5 ${isLightAcademic ? "text-[#2563EB]" : isDarkAI ? "text-cyan-300" : isNotebook ? "text-[#1E40AF]" : isBlueprint ? "text-cyan-300" : isCosmos ? "text-purple-300" : "text-amber-200"}`} />
          ) : (
            <MessageSquare className={`w-5 h-5 ${isLightAcademic ? "text-[#2563EB]" : isDarkAI ? "text-cyan-300" : isNotebook ? "text-[#1E40AF]" : isBlueprint ? "text-cyan-300" : isCosmos ? "text-purple-300" : "text-amber-300"}`} />
          )}
        </button>
      )}

      {/* Slide-out / Pop-up Chat Window OR Full Standalone Workspace */}
      {(isOpen || standalone) && (
        <div className={standalone 
          ? `w-full max-w-5xl mx-auto h-[calc(100vh-140px)] min-h-[640px] rounded-2xl flex flex-col backdrop-blur-xl overflow-hidden border shadow-2xl transition-all relative ${getWindowStyles()}`
          : `fixed bottom-36 right-6 z-50 w-[360px] sm:w-[460px] h-[520px] sm:h-[560px] rounded-2xl flex flex-col backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 shadow-2xl ${getWindowStyles()}`
        }>
          {/* Header */}
          <div className={`flex items-center justify-between p-4 ${getHeaderStyles()}`}>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                isLightAcademic ? "bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.6)]" :
                isDarkAI ? "bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.6)]" :
                isNotebook ? "bg-[#1E40AF] shadow-[0_0_6px_rgba(30,64,175,0.5)]" :
                isBlueprint ? "bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.6)]" :
                isCosmos ? "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.6)]" :
                "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
              }`}></div>
              <span className={`text-xs font-bold tracking-wider ${
                isLightAcademic ? "text-slate-900 font-sans" :
                isDarkAI ? "text-white font-mono" :
                isNotebook ? "text-[#242018] font-academic font-bold" :
                isBlueprint ? "text-cyan-200 font-mono" :
                isCosmos ? "text-purple-200 font-sans" :
                "text-amber-200 font-scholar-title"
              }`}>
                {isLightAcademic ? "Academic AI Tutor" : isDarkAI ? "Neural Math Solver" : isNotebook ? "Notebook Math Tutor" : "Scholar AI Tutor"}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 ${
                isLightAcademic ? "bg-blue-50 border border-blue-200 text-blue-700" :
                isDarkAI ? "bg-indigo-950/60 border border-[#273449] text-cyan-300" :
                isNotebook ? "bg-stone-100 border border-[#E2DAC7] text-stone-800" :
                isBlueprint ? "bg-cyan-950/60 border border-cyan-500/30 text-cyan-300" :
                isCosmos ? "bg-purple-950/60 border border-purple-500/30 text-purple-300" :
                "bg-amber-500/10 border border-amber-500/20 text-amber-300/80"
              }`}>
                <Cpu className="w-2.5 h-2.5 text-purple-400" />
                <span>NVIDIA Nemotron 3.5</span>
              </span>
            </div>
            {(onClose || !standalone) && (
              <button
                onClick={() => {
                  if (standalone && onClose) onClose();
                  else setIsOpen(false);
                }}
                className={`transition-colors cursor-pointer ${
                  isLightAcademic ? "text-slate-400 hover:text-slate-800" :
                  isDarkAI ? "text-slate-400 hover:text-white" :
                  isNotebook ? "text-stone-400 hover:text-stone-900" :
                  isBlueprint ? "text-cyan-400/60 hover:text-cyan-200" :
                  isCosmos ? "text-purple-400/60 hover:text-purple-200" :
                  "text-amber-200/50 hover:text-amber-200"
                }`}
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mode Switcher Tabs */}
          <div className={`flex items-center justify-around px-3 py-1.5 border-b text-[11px] font-bold uppercase tracking-wider gap-1.5 ${getHeaderStyles()}`}>
            <button
              onClick={() => setMode("orb")}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === "orb"
                  ? (isLightAcademic ? "bg-blue-600 text-white shadow-xs" : isDarkAI ? "bg-indigo-600 text-white" : isNotebook ? "bg-blue-900 text-amber-50" : "bg-amber-400/20 text-amber-200 border border-amber-400/30")
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Thinking Orb
            </button>
            <button
              onClick={() => setMode("chat")}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === "chat"
                  ? (isLightAcademic ? "bg-blue-600 text-white shadow-xs" : isDarkAI ? "bg-indigo-600 text-white" : isNotebook ? "bg-blue-900 text-amber-50" : "bg-amber-400/20 text-amber-200 border border-amber-400/30")
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat Tutor
            </button>
          </div>

          {mode === "orb" ? (
            <div className={`flex-1 relative flex flex-col items-center justify-center overflow-hidden ${getBodyBg()}`}>
              <div className="absolute top-2 left-0 right-0 text-center z-20 pointer-events-none px-4">
                <span className={`text-[9px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border backdrop-blur-md ${
                  isLightAcademic ? "bg-white/90 border-slate-200 text-blue-700 shadow-xs" :
                  isDarkAI ? "bg-indigo-950/90 border-[#273449] text-cyan-300" :
                  isNotebook ? "bg-[#FFFDF8]/90 border-[#E2DAC7] text-stone-800" :
                  "bg-black/70 border-amber-500/30 text-amber-300/90"
                }`}>
                  ✨ Type math proposition to trigger /api/solve
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
          <div className={`flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin ${getBodyBg()}`}>
            {history.length === 0 ? (
              <div className={`h-full flex flex-col items-center justify-center text-center p-6 ${
                isLightAcademic ? "text-slate-500" :
                isDarkAI ? "text-slate-400" :
                isNotebook ? "text-stone-600" :
                isBlueprint ? "text-cyan-300/70" :
                isCosmos ? "text-purple-300/70" :
                "text-amber-200/50"
              }`}>
                <MessageSquare className={`w-8 h-8 mb-2 ${
                  isLightAcademic ? "text-blue-500/50" :
                  isDarkAI ? "text-cyan-400/50" :
                  isNotebook ? "text-blue-700/50" :
                  isBlueprint ? "text-cyan-400/50" :
                  isCosmos ? "text-purple-400/50" :
                  "text-amber-400/40"
                }`} />
                <p className={`text-xs font-bold tracking-wider ${
                  isLightAcademic ? "text-slate-900 font-sans" :
                  isDarkAI ? "text-white font-mono" :
                  isNotebook ? "text-[#242018] font-academic" :
                  isBlueprint ? "text-cyan-200 font-mono" :
                  isCosmos ? "text-purple-200 font-sans" :
                  "text-amber-200 font-scholar-title"
                }`}>
                  {isLightAcademic ? "Consult Academic AI" : isDarkAI ? "Ask Deep Solver" : isNotebook ? "Notebook Inquiries" : "Consult The Academy"}
                </p>
                <p className={`text-[11px] mt-1 ${
                  isLightAcademic ? "text-slate-500 font-sans" :
                  isDarkAI ? "text-slate-400 font-mono" :
                  isNotebook ? "text-stone-600 font-academic italic" :
                  isBlueprint ? "text-cyan-300/70 font-mono" :
                  isCosmos ? "text-purple-300/70 font-sans" :
                  "text-[#ededdf]/70 font-academic italic"
                }`}>
                  Inquire into any theorem, mathematical derivation, calculus step, or geometric plot.
                </p>
              </div>
            ) : (
              history.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? isLightAcademic
                          ? "bg-[#2563EB] text-white rounded-tr-none shadow-sm font-sans"
                          : isDarkAI
                          ? "bg-[#6366F1] text-white border border-indigo-400/30 rounded-tr-none shadow-sm font-mono"
                          : isNotebook
                          ? "bg-[#1E40AF] text-[#FAF8F3] rounded-tr-none shadow-sm font-sans"
                          : isBlueprint
                          ? "bg-cyan-600 text-white border border-cyan-400/30 rounded-tr-none shadow-sm font-mono"
                          : isCosmos
                          ? "bg-purple-600 text-white border border-purple-400/30 rounded-tr-none shadow-sm font-sans"
                          : "bg-[#183526] text-amber-100 border border-amber-500/30 rounded-tr-none shadow-sm"
                        : isLightAcademic
                        ? "bg-white border border-[#E2E8F0] text-[#0F172A] rounded-tl-none font-sans shadow-xs"
                        : isDarkAI
                        ? "bg-[#111827] border border-[#273449] text-[#F8FAFC] rounded-tl-none font-mono text-[12px]"
                        : isNotebook
                        ? "bg-[#FFFDF8] border border-[#E2DAC7] text-[#242018] rounded-tl-none font-academic text-[13px] shadow-xs"
                        : isBlueprint
                        ? "bg-[#082244] border border-cyan-500/30 text-cyan-100 rounded-tl-none font-mono text-[12px]"
                        : isCosmos
                        ? "bg-[#130b30] border border-purple-500/30 text-purple-100 rounded-tl-none font-sans text-[12px]"
                        : "bg-[#0f1d16] border border-amber-900/30 text-[#ededdf] rounded-tl-none font-academic text-[13px]"
                    }`}
                  >
                    {msg.role === "assistant" && msg.reasoning && (
                      <ThinkingAccordion reasoning={msg.reasoning} />
                    )}
                    <FormattedChatMessage content={msg.content} />
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className={`rounded-xl rounded-tl-none px-3 py-2 text-xs flex items-center gap-2 ${
                  isLightAcademic
                    ? "bg-white border border-[#E2E8F0] text-slate-600 font-sans shadow-xs"
                    : isDarkAI
                    ? "bg-[#111827] border border-[#273449] text-cyan-300 font-mono"
                    : isNotebook
                    ? "bg-[#FFFDF8] border border-[#E2DAC7] text-stone-700 font-academic italic"
                    : isBlueprint
                    ? "bg-[#082244] border border-cyan-500/30 text-cyan-300 font-mono"
                    : isCosmos
                    ? "bg-[#130b30] border border-purple-500/30 text-purple-300 font-sans"
                    : "bg-[#0f1d16] border border-amber-900/30 text-amber-200/60 font-academic italic"
                }`}>
                  <RefreshCw className={`w-3 h-3 animate-spin ${
                    isLightAcademic ? "text-blue-600" :
                    isDarkAI ? "text-cyan-400" :
                    isNotebook ? "text-blue-800" :
                    isBlueprint ? "text-cyan-400" :
                    isCosmos ? "text-purple-400" :
                    "text-amber-400"
                  }`} />
                  <span>{isLightAcademic ? "Formulating analytical response..." : isDarkAI ? "Executing neural inference..." : isNotebook ? "Writing out mathematical proof..." : "The Scholar is formulating the proof..."}</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Textarea Input Footer */}
          <div className={`p-3 flex gap-2 ${getFooterStyles()}`}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isLightAcademic ? "Ask about any formula or step..." : isDarkAI ? "Query neural math solver..." : isNotebook ? "Note down a question..." : "Inquire of the Scholar..."}
              className={`flex-1 rounded-xl px-3 py-2 text-xs resize-none h-9 scrollbar-none transition-colors focus:outline-none ${
                isLightAcademic
                  ? "bg-white border border-[#E2E8F0] text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] font-sans"
                  : isDarkAI
                  ? "bg-[#111827] border border-[#273449] text-[#F8FAFC] placeholder:text-slate-500 focus:border-[#6366F1] font-mono"
                  : isNotebook
                  ? "bg-[#FFFDF8] border border-[#E2DAC7] text-[#242018] placeholder:text-stone-400 focus:border-[#1E40AF] font-academic"
                  : isBlueprint
                  ? "bg-[#082244] border border-cyan-500/30 text-cyan-100 placeholder:text-cyan-400/40 focus:border-cyan-400 font-mono"
                  : isCosmos
                  ? "bg-[#130b30] border border-purple-500/30 text-purple-100 placeholder:text-purple-400/40 focus:border-purple-400 font-sans"
                  : "bg-[#111f18] border border-amber-900/40 text-amber-100 placeholder:text-amber-200/30 focus:border-amber-400/60 font-sans"
              }`}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={loading || !message.trim()}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-sm disabled:opacity-40 ${
                isLightAcademic
                  ? "bg-[#2563EB] hover:bg-blue-700 text-white"
                  : isDarkAI
                  ? "bg-[#6366F1] hover:bg-indigo-600 text-white"
                  : isNotebook
                  ? "bg-[#1E40AF] hover:bg-blue-900 text-[#FAF8F3]"
                  : isBlueprint
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                  : isCosmos
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-[#1a3627] hover:bg-[#244b36] text-amber-300 border border-amber-500/40"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  )}
    </>
  );
}

