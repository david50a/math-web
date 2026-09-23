import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Play,
  Square,
  HelpCircle,
  ArrowRight,
  Radio,
  Sliders,
} from "lucide-react";
import {
  createSpeechRecognition,
  parseSpokenMath,
  speakCleanText,
  cancelSpeech,
  cleanLatexForSpeech,
} from "../utils/speechUtils";
import { KatexMath } from "./Whiteboard";

interface VoiceAssistantProps {
  onSolveEquation?: (equation: string) => void;
  onNavigateScene?: (direction: "next" | "prev" | "first") => void;
  onSwitchView?: (view: "whiteboard" | "graph" | "explanation" | "cheatsheet") => void;
  activeScene?: any;
  solution?: any;
  currentView?: string;
}

type AssistantState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface AssistantMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  mathFormula?: string;
  timestamp: Date;
}

export default function VoiceAssistant({
  onSolveEquation,
  onNavigateScene,
  onSwitchView,
  activeScene,
  solution,
  currentView,
}: VoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [transcript, setTranscript] = useState("");
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [autoSpeakReplies, setAutoSpeakReplies] = useState(true);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "Hello! I am your Math Voice Assistant. Speak naturally to solve equations, control steps, or ask math questions!",
      timestamp: new Date(),
    },
  ]);
  const [showSettings, setShowSettings] = useState(false);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isListeningRef = useRef<boolean>(false);

  // Initialize Speech Recognition
  useEffect(() => {
    const recognition = createSpeechRecognition();
    if (!recognition) {
      setIsRecognitionSupported(false);
      return;
    }

    recognition.onstart = () => {
      isListeningRef.current = true;
      setAssistantState("listening");
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      let currentInterim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const finalSpeech = event.results[i][0].transcript;
          handleProcessVoiceInput(finalSpeech);
          return;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }
      setTranscript(currentInterim);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition event error:", event.error);
      isListeningRef.current = false;
      if (assistantState !== "speaking") {
        setAssistantState("idle");
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      if (assistantState === "listening") {
        setAssistantState("idle");
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      cancelSpeech();
    };
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, assistantState]);

  // Start or stop listening
  const toggleListening = () => {
    if (!isRecognitionSupported) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListeningRef.current) {
      recognitionRef.current?.stop();
      isListeningRef.current = false;
      setAssistantState("idle");
    } else {
      cancelSpeech();
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn("Error starting speech recognition:", err);
      }
    }
  };

  // Process user speech command or question
  const handleProcessVoiceInput = async (spokenText: string) => {
    if (!spokenText.trim()) return;

    setTranscript(spokenText);
    const userMsg: AssistantMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: spokenText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const lower = spokenText.toLowerCase().trim();

    // 1. Check for Scene Navigation Commands
    if (
      lower.includes("next step") ||
      lower.includes("next scene") ||
      lower.includes("forward") ||
      lower === "next"
    ) {
      onNavigateScene?.("next");
      respondWithVoice("Moving to next step.");
      return;
    }

    if (
      lower.includes("previous step") ||
      lower.includes("prior step") ||
      lower.includes("go back") ||
      lower === "back" ||
      lower === "previous"
    ) {
      onNavigateScene?.("prev");
      respondWithVoice("Going back to the previous step.");
      return;
    }

    if (
      lower.includes("first step") ||
      lower.includes("beginning") ||
      lower.includes("restart steps")
    ) {
      onNavigateScene?.("first");
      respondWithVoice("Starting from the first step.");
      return;
    }

    // 2. Read current step / explanation aloud
    if (
      lower.includes("read this step") ||
      lower.includes("read step") ||
      lower.includes("explain this step") ||
      lower.includes("repeat explanation") ||
      lower.includes("read aloud")
    ) {
      if (activeScene && activeScene.explanation) {
        respondWithVoice(
          `Step ${activeScene.title || ""}: ${activeScene.explanation}`
        );
      } else {
        respondWithVoice("There is no active step explanation to read right now.");
      }
      return;
    }

    // 3. View Switch Commands
    if (lower.includes("show graph") || lower.includes("open graph") || lower.includes("plot")) {
      onSwitchView?.("graph");
      respondWithVoice("Switching to interactive graph view.");
      return;
    }

    if (
      lower.includes("show whiteboard") ||
      lower.includes("open whiteboard") ||
      lower.includes("step by step")
    ) {
      onSwitchView?.("whiteboard");
      respondWithVoice("Switching to math whiteboard view.");
      return;
    }

    if (
      lower.includes("engine options") ||
      lower.includes("all engines") ||
      lower.includes("analyze equation") ||
      lower.includes("explanation suite")
    ) {
      onSwitchView?.("explanation");
      respondWithVoice("Opening multi-engine analysis suite.");
      return;
    }

    // 4. Solve Command
    if (
      lower.startsWith("solve") ||
      lower.startsWith("calculate") ||
      lower.startsWith("evaluate") ||
      lower.startsWith("integrate") ||
      lower.startsWith("differentiate") ||
      lower.startsWith("derive") ||
      lower.startsWith("find") ||
      lower.includes("squared") ||
      lower.includes("equals")
    ) {
      const parsedMath = parseSpokenMath(spokenText);
      if (parsedMath && onSolveEquation) {
        onSolveEquation(parsedMath);
        respondWithVoice(
          `Solving: ${cleanLatexForSpeech(parsedMath)}`,
          parsedMath
        );
        return;
      }
    }

    // 5. Conversational Math Q&A / Tutor Mode
    await handleAskAITutor(spokenText);
  };

  // Query AI Chat Tutor and speak the reply
  const handleAskAITutor = async (question: string) => {
    setAssistantState("thinking");

    try {
      const contextStr = solution
        ? `The user is currently studying the equation: "${solution.equation}". Current step title: "${activeScene?.title || ""}", explanation: "${activeScene?.explanation || ""}". Answer concisely with helpful mathematical intuition.`
        : "You are a concise, friendly voice math tutor.";

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: question }],
          context: contextStr,
        }),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const data = await response.json();
      const reply = data.reply || "I analyzed your question, but could not produce a response.";
      respondWithVoice(reply);
    } catch (err) {
      console.error(err);
      respondWithVoice("I had trouble reaching the AI tutor service. You can ask me to solve equations or navigate steps anytime!");
    }
  };

  // Helper to add response and trigger TTS
  const respondWithVoice = (text: string, mathFormula?: string) => {
    const assistantMsg: AssistantMessage = {
      id: Date.now().toString(),
      sender: "assistant",
      text,
      mathFormula,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    if (autoSpeakReplies) {
      setAssistantState("speaking");
      speakCleanText(text, {
        rate: speechRate,
        onEnd: () => {
          setAssistantState("idle");
        },
        onError: () => {
          setAssistantState("idle");
        },
      });
    } else {
      setAssistantState("idle");
    }
  };

  const stopCurrentSpeech = () => {
    cancelSpeech();
    setAssistantState("idle");
  };

  // Quick prompt chip clicked
  const handleQuickPrompt = (promptText: string) => {
    handleProcessVoiceInput(promptText);
  };

  return (
    <>
      {/* Floating Assistant Orb / Launcher Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 select-none">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-full shadow-2xl shadow-indigo-500/40 border border-white/20 transition-all transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
            title="Open AI Math Voice Assistant"
          >
            {/* Animated Glow Ring */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-50 blur-sm group-hover:opacity-100 transition duration-500 animate-pulse" />

            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
              <Bot className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div className="relative text-left pr-1 hidden sm:block">
              <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                Voice Assistant
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </p>
              <p className="text-[10px] text-white/80 font-mono">Click to speak & control</p>
            </div>
          </button>
        )}

        {/* Expanded Voice Assistant Window */}
        {isOpen && (
          <div
            className={`w-[90vw] max-w-sm sm:max-w-md bg-[#0F111A]/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden transition-all duration-300 ${
              isMinimized ? "h-20" : "h-[540px]"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-900/60 to-purple-900/60 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
                  <Bot className="w-4 h-4 text-white" />
                  {assistantState === "listening" && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0F111A] animate-ping" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Math Voice Assistant
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase font-bold ${
                        assistantState === "listening"
                          ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                          : assistantState === "speaking"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : assistantState === "thinking"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                      }`}
                    >
                      {assistantState === "listening"
                        ? "Listening..."
                        : assistantState === "speaking"
                        ? "Speaking 🔊"
                        : assistantState === "thinking"
                        ? "Thinking..."
                        : "Ready"}
                    </span>
                  </h3>
                  <p className="text-[10px] text-white/50 font-mono">
                    Speak equations, navigation or questions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-white/60">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Voice Settings"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title={isMinimized ? "Expand" : "Minimize"}
                >
                  {isMinimized ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => {
                    stopCurrentSpeech();
                    if (isListeningRef.current) recognitionRef.current?.stop();
                    setIsOpen(false);
                  }}
                  className="p-1.5 hover:text-red-400 hover:bg-white/10 rounded-lg transition-all"
                  title="Close Voice Assistant"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Optional Voice Settings Drawer */}
            {showSettings && !isMinimized && (
              <div className="px-4 py-3 bg-black/40 border-b border-white/10 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Voice Rate ({speechRate}x)</span>
                  <input
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-24 accent-blue-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Auto-read Spoken Replies</span>
                  <button
                    onClick={() => setAutoSpeakReplies(!autoSpeakReplies)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      autoSpeakReplies
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {autoSpeakReplies ? "Enabled" : "Muted"}
                  </button>
                </div>
              </div>
            )}

            {!isMinimized && (
              <>
                {/* Chat History & Spoken Transcript */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs scrollbar-thin scrollbar-thumb-white/10">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.sender === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                          msg.sender === "user"
                            ? "bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/20"
                            : "bg-white/10 border border-white/10 text-white/90 rounded-bl-none shadow-md"
                        }`}
                      >
                        <p className="leading-relaxed">{msg.text}</p>
                        {msg.mathFormula && (
                          <div className="mt-2 pt-2 border-t border-white/20 text-blue-300 font-mono text-xs">
                            <KatexMath math={msg.mathFormula} block={false} />
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-white/30 mt-1 px-1 font-mono">
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}

                  {/* Real-time Listening Wave & Interim Transcript */}
                  {assistantState === "listening" && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <Radio className="w-4 h-4 text-red-400 animate-pulse shrink-0 mt-0.5" />
                      <div className="space-y-1 w-full">
                        <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                          Listening now...
                        </p>
                        <p className="text-xs text-white/90 italic font-mono">
                          {transcript || 'Say "Solve x^2 - 4 = 0" or "Next step"...'}
                        </p>
                        {/* Audio equalizer animation bars */}
                        <div className="flex items-center gap-1 pt-1">
                          <span className="w-1 h-3 bg-red-400 rounded-full animate-bounce" />
                          <span className="w-1 h-5 bg-red-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                          <span className="w-1 h-2 bg-red-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1 h-6 bg-red-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                          <span className="w-1 h-4 bg-red-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Thinking Spinner */}
                  {assistantState === "thinking" && (
                    <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300">
                      <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                      <span className="text-xs font-mono">AI Tutor is thinking...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Voice Command Suggestion Chips */}
                <div className="px-3 py-2 bg-black/40 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[10px] uppercase font-bold text-white/40 shrink-0 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-blue-400" />
                    Try:
                  </span>
                  {[
                    "Solve x^2 - 5x + 6 = 0",
                    "Explain this step",
                    "Next step",
                    "Show graph",
                    "Why factor?",
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleQuickPrompt(chip)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-blue-600/30 border border-white/10 hover:border-blue-500/40 rounded-lg text-[10px] font-mono text-blue-300 hover:text-white whitespace-nowrap transition-all cursor-pointer shrink-0"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Bottom Control Bar */}
                <div className="p-3 bg-[#0A0C14] border-t border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Main Voice Toggle Button */}
                    <button
                      onClick={toggleListening}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer transform active:scale-95 ${
                        assistantState === "listening"
                          ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/40 animate-pulse"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30"
                      }`}
                    >
                      {assistantState === "listening" ? (
                        <>
                          <MicOff className="w-4 h-4" />
                          Stop Listening
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          Push to Speak
                        </>
                      )}
                    </button>

                    {/* Stop Speaking / Audio Mute Button */}
                    {assistantState === "speaking" && (
                      <button
                        onClick={stopCurrentSpeech}
                        className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
                        title="Stop Voice Output"
                      >
                        <Square className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>

                  {/* Read active step shortcut */}
                  {activeScene?.explanation && (
                    <button
                      onClick={() =>
                        respondWithVoice(
                          `Step ${activeScene.title || ""}: ${activeScene.explanation}`
                        )
                      }
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl text-[10px] font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Read current step explanation aloud"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                      Read Step
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
