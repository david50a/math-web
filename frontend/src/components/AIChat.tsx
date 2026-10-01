import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, RefreshCw } from "lucide-react";
import { KatexMath } from "./Whiteboard";

interface Message {
  role: "user" | "assistant";
  content: string;
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
}

export default function AIChat({ solution, currentSence }: AIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
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
      const modelMessage: Message = {
        role: "assistant",
        content: replyText
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

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-6 z-50 w-12 h-12 bg-[#12241b] hover:bg-[#1a3528] text-amber-300 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-amber-500/40 shadow-black/60 academic-frame"
        title="Consult Scholar AI Tutor"
      >
        {isOpen ? <X className="w-5 h-5 text-amber-200" /> : <MessageSquare className="w-5 h-5 text-amber-300" />}
      </button>

      {/* Slide-out / Pop-up Chat Window */}
      {isOpen && (
        <div className="fixed bottom-36 right-6 z-50 w-[360px] h-[480px] bg-[#0c1813]/95 border border-amber-900/40 rounded-2xl flex flex-col shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 academic-frame">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-amber-900/30 bg-[#09130f]/90">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.6)]"></div>
              <span className="text-xs font-scholar-title font-bold tracking-wider text-amber-200">Scholar AI Tutor</span>
              <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-300/80 px-1.5 py-0.5 rounded font-mono">Academic Fellow</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-amber-200/50 hover:text-amber-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-blackboard-canvas">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-amber-200/50">
                <MessageSquare className="w-8 h-8 mb-2 text-amber-400/40" />
                <p className="text-xs font-scholar-title font-bold tracking-wider text-amber-200">Consult The Academy</p>
                <p className="text-[11px] mt-1 font-academic italic text-[#ededdf]/70">Inquire into any theorem, mathematical derivation, calculus step, or geometric plot on the blackboard.</p>
              </div>
            ) : (
              history.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${msg.role === "user"
                      ? "bg-[#183526] text-amber-100 border border-amber-500/30 rounded-tr-none shadow-sm"
                      : "bg-[#0f1d16] border border-amber-900/30 text-[#ededdf] rounded-tl-none font-academic text-[13px]"
                      }`}
                  >
                    <FormattedChatMessage content={msg.content} />
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#0f1d16] border border-amber-900/30 rounded-xl rounded-tl-none px-3 py-2 text-xs text-amber-200/60 flex items-center gap-2 font-academic italic">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                  <span>The Scholar is formulating the proof...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Textarea Input Footer */}
          <div className="p-3 border-t border-amber-900/30 bg-[#09130f] flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Inquire of the Scholar..."
              className="flex-1 bg-[#111f18] border border-amber-900/40 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400/60 resize-none h-9 scrollbar-none font-sans"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={loading || !message.trim()}
              className="w-9 h-9 bg-[#1a3627] hover:bg-[#244b36] disabled:opacity-40 text-amber-300 border border-amber-500/40 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
