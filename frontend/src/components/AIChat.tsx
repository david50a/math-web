import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, RefreshCw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
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
      const modelMessage: Message = {
        role: "assistant",
        content: data.reply
      };

      setHistory((prev) => [...prev, modelMessage]);
    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please ensure your local Ollama instance is running with `llama3` pulled."
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
        className="fixed bottom-32 right-6 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-white/10"
        title="Chat with AI Tutor"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </button>

      {/* Slide-out / Pop-up Chat Window */}
      {isOpen && (
        <div className="fixed bottom-48 right-6 z-50 w-[360px] h-[480px] bg-black/90 border border-white/10 rounded-2xl flex flex-col shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-black uppercase tracking-widest text-white/90">Llama 3 Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40">
                <MessageSquare className="w-8 h-8 mb-2 text-blue-500/50" />
                <p className="text-xs font-bold uppercase tracking-wider text-white/60">Ask Llama 3!</p>
                <p className="text-[11px] mt-1">Ask questions about formulas, equations, derivatives, integrals, or plots generated on screen.</p>
              </div>
            ) : (
              history.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none"
                      }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-xl rounded-tl-none px-3 py-2 text-xs text-white/40 flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                  <span>Llama 3 is thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Textarea Input Footer */}
          <div className="p-3 border-t border-white/10 bg-white/5 flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Llama 3..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 resize-none h-9 scrollbar-none"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={loading || !message.trim()}
              className="w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-white/40 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
