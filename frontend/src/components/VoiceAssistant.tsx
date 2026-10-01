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
  VoicePersona,
  getBestHumanVoice,
  getVoiceDisplayName,
  isNeuralVoice,
} from "../utils/speechUtils";
import { KatexMath } from "./Whiteboard";
import { ThemeType } from "../types";

interface VoiceAssistantProps {
  onSolveEquation?: (equation: string) => void;
  onNavigateScene?: (direction: "next" | "prev" | "first") => void;
  onSwitchView?: (view: "whiteboard" | "graph" | "explanation" | "cheatsheet") => void;
  activeScene?: any;
  solution?: any;
  currentView?: string;
  theme?: ThemeType;
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
  theme = "chalkboard",
}: VoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [transcript, setTranscript] = useState("");
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [autoSpeakReplies, setAutoSpeakReplies] = useState(true);
  const [voicePersona, setVoicePersona] = useState<VoicePersona>(() => {
    return (localStorage.getItem("math_assistant_persona") as VoicePersona) || "natural";
  });
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
        ? `The user is currently studying the equation: "${solution.equation}". Current step: "${activeScene?.title || ""}" with explanation: "${activeScene?.explanation || ""}". View: "${currentView || "whiteboard"}". Answer directly and concisely with clear mathematical intuition.`
        : `Current view: ${currentView || "whiteboard"}. Answer concisely with clear mathematical intuition.`;

      // Multi-turn conversation history for human-like conversational memory
      const recentHistory = messages
        .filter((m) => m.id !== "welcome-1")
        .slice(-8)
        .map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }));

      const payloadMessages = [
        ...recentHistory,
        { role: "user", content: question },
      ];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payloadMessages,
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
      respondWithVoice("I'm here with you! Feel free to ask me to solve any equation, explain steps, or explore graphs.");
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
        persona: voicePersona,
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

  // Dynamic prompt chips based on active equation and context
  const getContextualChips = () => {
    if (solution?.equation) {
      const eq = solution.equation.toLowerCase();
      if (eq.includes("^2") || eq.includes("quadratic") || eq.includes("x^2")) {
        return [
          "Why is the discriminant important?",
          "Explain this step",
          "What do roots mean on a graph?",
          "Can we solve by factoring?",
          "Next step",
        ];
      }
      if (eq.includes("integrate") || eq.includes("derive") || eq.includes("derivative")) {
        return [
          "Explain the calculus intuition",
          "What is the slope / area here?",
          "Explain this step",
          "Next step",
        ];
      }
      if (eq.includes("det") || eq.includes("eigen") || eq.includes("[")) {
        return [
          "What does an eigenvalue mean?",
          "Explain this matrix step",
          "Show whiteboard",
        ];
      }
    }
    return [
      "Solve x^2 - 5x + 6 = 0",
      "Why is D < 0 complex?",
      "Explain this step",
      "Show graph",
      "Why factor?",
    ];
  };

  // Quick prompt chip clicked
  const handleQuickPrompt = (promptText: string) => {
    handleProcessVoiceInput(promptText);
  };

  const isLightAcademic = theme === "lightAcademic";
  const isDarkAI = theme === "darkAI";
  const isNotebook = theme === "notebook";
  const isBlueprint = theme === "blueprint";
  const isCosmos = theme === "cosmos";
  const isChalkboard = theme === "chalkboard";

  const getOrbButtonStyles = () => {
    if (isLightAcademic) {
      return "bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] shadow-2xl shadow-slate-300/80 academic-light-frame";
    }
    if (isDarkAI) {
      return "bg-[#111827] hover:bg-[#182338] text-[#F8FAFC] border border-[#273449] shadow-2xl shadow-indigo-950/80 dark-ai-frame";
    }
    if (isNotebook) {
      return "bg-[#FFFDF8] hover:bg-[#FAF5EA] text-[#242018] border border-[#E2DAC7] shadow-2xl shadow-stone-300/70 notebook-frame";
    }
    if (isBlueprint) {
      return "bg-[#061b36] hover:bg-[#0a274c] text-cyan-200 border border-cyan-500/40 shadow-2xl shadow-cyan-950/80";
    }
    if (isCosmos) {
      return "bg-[#0e0724] hover:bg-[#180d3d] text-purple-200 border border-purple-500/40 shadow-2xl shadow-purple-950/80";
    }
    return "bg-gradient-to-r from-[#12241b] via-[#1a3829] to-[#254d39] hover:from-[#183224] hover:to-[#2f5e46] text-amber-200 border border-amber-500/40 shadow-black/80 academic-frame";
  };

  const getOrbGlowStyles = () => {
    if (isLightAcademic) return "from-blue-500/30 to-indigo-500/30";
    if (isDarkAI) return "from-indigo-500/40 to-cyan-500/40";
    if (isNotebook) return "from-blue-400/30 to-red-400/30";
    if (isBlueprint) return "from-cyan-500/40 to-blue-500/40";
    if (isCosmos) return "from-purple-500/40 to-pink-500/40";
    return "from-amber-500/40 to-emerald-500/40";
  };

  const getOrbIconStyles = () => {
    if (isLightAcademic) return { box: "bg-blue-50 border border-blue-200", icon: "text-[#2563EB]" };
    if (isDarkAI) return { box: "bg-indigo-950/70 border border-[#273449]", icon: "text-cyan-400" };
    if (isNotebook) return { box: "bg-stone-100 border border-[#E2DAC7]", icon: "text-[#1E40AF]" };
    if (isBlueprint) return { box: "bg-cyan-950/70 border border-cyan-500/30", icon: "text-cyan-300" };
    if (isCosmos) return { box: "bg-purple-950/70 border border-purple-500/30", icon: "text-purple-300" };
    return { box: "bg-amber-400/20 border border-amber-400/30", icon: "text-amber-300" };
  };

  const getWindowStyles = () => {
    if (isLightAcademic) return "bg-white/98 border border-[#E2E8F0] academic-light-frame shadow-slate-300/80 text-[#0F172A]";
    if (isDarkAI) return "bg-[#111827]/98 border border-[#273449] dark-ai-frame shadow-indigo-950/90 text-[#F8FAFC]";
    if (isNotebook) return "bg-[#FFFDF8]/98 border border-[#E2DAC7] notebook-frame shadow-stone-300/80 text-[#242018]";
    if (isBlueprint) return "bg-[#061b36]/98 border border-cyan-500/40 shadow-cyan-950/90 text-cyan-50";
    if (isCosmos) return "bg-[#0e0724]/98 border border-purple-500/40 shadow-purple-950/90 text-purple-50";
    return "bg-[#0c1813]/98 border border-amber-900/40 academic-frame shadow-black/90";
  };

  const getHeaderStyles = () => {
    if (isLightAcademic) return "bg-slate-50 border-b border-[#E2E8F0]";
    if (isDarkAI) return "bg-[#0B1020] border-b border-[#273449]";
    if (isNotebook) return "bg-[#FAF8F3] border-b border-[#E2DAC7]";
    if (isBlueprint) return "bg-[#041224] border-b border-cyan-500/30";
    if (isCosmos) return "bg-[#060412] border-b border-purple-500/30";
    return "bg-[#09130f] border-b border-amber-900/30";
  };

  const getChipsBarStyles = () => {
    if (isLightAcademic) return "bg-slate-50 border-t border-[#E2E8F0]";
    if (isDarkAI) return "bg-[#0B1020] border-t border-[#273449]";
    if (isNotebook) return "bg-[#FAF8F3] border-t border-[#E2DAC7]";
    if (isBlueprint) return "bg-[#041224] border-t border-cyan-500/30";
    if (isCosmos) return "bg-[#060412] border-t border-purple-500/30";
    return "bg-[#09130f] border-t border-amber-900/30";
  };

  const getControlBarStyles = () => {
    if (isLightAcademic) return "bg-slate-100 border-t border-[#E2E8F0]";
    if (isDarkAI) return "bg-[#070b14] border-t border-[#273449]";
    if (isNotebook) return "bg-[#F5EFE3] border-t border-[#E2DAC7]";
    if (isBlueprint) return "bg-[#030d1a] border-t border-cyan-500/30";
    if (isCosmos) return "bg-[#04020c] border-t border-purple-500/30";
    return "bg-[#08110d] border-t border-amber-900/30";
  };

  const orbIcons = getOrbIconStyles();

  return (
    <>
      {/* Floating Assistant Orb / Launcher Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 select-none">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className={`group relative flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md ${getOrbButtonStyles()}`}
            title="Open Math Voice Assistant"
          >
            {/* Animated Glow Ring */}
            <div className={`absolute -inset-1 rounded-full bg-gradient-to-r ${getOrbGlowStyles()} opacity-40 blur-sm group-hover:opacity-100 transition duration-500 animate-pulse`} />

            <div className={`relative flex items-center justify-center w-8 h-8 rounded-full ${orbIcons.box}`}>
              <Bot className={`w-5 h-5 ${orbIcons.icon} animate-bounce`} />
            </div>
            <div className="relative text-left pr-1 hidden sm:block">
              <p className={`text-xs font-bold leading-tight flex items-center gap-1.5 ${
                isLightAcademic ? "text-[#0F172A] font-sans" :
                isDarkAI ? "text-[#F8FAFC] font-mono" :
                isNotebook ? "text-[#242018] font-academic" :
                isBlueprint ? "text-cyan-200 font-mono" :
                isCosmos ? "text-purple-200 font-sans" :
                "text-amber-200 font-scholar-title"
              }`}>
                {isLightAcademic ? "Academic Voice Mentor" : isDarkAI ? "Neural Voice AI" : isNotebook ? "Notebook Dictation" : "Scholar Voice Mentor"}
                <span className={`w-2 h-2 rounded-full animate-ping ${
                  isLightAcademic ? "bg-blue-600" :
                  isDarkAI ? "bg-cyan-400" :
                  isNotebook ? "bg-blue-700" :
                  isBlueprint ? "bg-cyan-400" :
                  isCosmos ? "bg-purple-400" :
                  "bg-amber-400"
                }`} />
              </p>
              <p className={`text-[10px] ${
                isLightAcademic ? "text-slate-500 font-sans" :
                isDarkAI ? "text-cyan-300/70 font-mono" :
                isNotebook ? "text-stone-600 font-academic italic" :
                isBlueprint ? "text-cyan-300/70 font-mono" :
                isCosmos ? "text-purple-300/70 font-sans" :
                "text-amber-200/70 font-academic italic"
              }`}>
                Oral Explication & Dictation
              </p>
            </div>
          </button>
        )}

        {/* Expanded Voice Assistant Window */}
        {isOpen && (
          <div
            className={`w-[90vw] max-w-sm sm:max-w-md backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${getWindowStyles()} ${
              isMinimized ? "h-20" : "h-[540px]"
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 ${getHeaderStyles()}`}>
              <div className="flex items-center gap-2.5">
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl shadow-md ${orbIcons.box}`}>
                  <Bot className={`w-4 h-4 ${orbIcons.icon}`} />
                  {assistantState === "listening" && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0F111A] animate-ping" />
                  )}
                </div>
                <div>
                  <h3 className={`text-xs font-bold flex items-center gap-1.5 ${
                    isLightAcademic ? "text-slate-900 font-sans" :
                    isDarkAI ? "text-white font-mono" :
                    isNotebook ? "text-[#242018] font-academic" :
                    isBlueprint ? "text-cyan-200 font-mono" :
                    isCosmos ? "text-purple-200 font-sans" :
                    "text-amber-200 font-scholar-title"
                  }`}>
                    {isLightAcademic ? "Academic Voice Mentor" : isDarkAI ? "Neural Voice AI" : isNotebook ? "Notebook Dictation" : "Scholar Voice Mentor"}
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase font-bold ${
                        assistantState === "listening"
                          ? "bg-red-500/20 text-red-500 border border-red-500/40 animate-pulse"
                          : assistantState === "speaking"
                          ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/40"
                          : assistantState === "thinking"
                          ? "bg-amber-500/20 text-amber-600 border border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-600 border border-emerald-500/40"
                      }`}
                    >
                      {assistantState === "listening"
                        ? "Listening..."
                        : assistantState === "speaking"
                        ? "Speaking 🔊"
                        : assistantState === "thinking"
                        ? "Pondering..."
                        : "Ready"}
                    </span>
                  </h3>
                  <p className={`text-[10px] ${
                    isLightAcademic ? "text-slate-500 font-sans" :
                    isDarkAI ? "text-slate-400 font-mono" :
                    isNotebook ? "text-stone-600 font-academic italic" :
                    isBlueprint ? "text-cyan-300/70 font-mono" :
                    isCosmos ? "text-purple-300/70 font-sans" :
                    "text-amber-200/60 font-academic italic"
                  }`}>
                    Dictate propositions or question the fellow
                  </p>
                </div>
              </div>

              <div className={`flex items-center gap-1 ${
                isLightAcademic ? "text-slate-400" :
                isDarkAI ? "text-slate-400" :
                isNotebook ? "text-stone-400" :
                "text-amber-200/60"
              }`}>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded-lg transition-all ${
                    isLightAcademic ? "hover:text-slate-900 hover:bg-slate-200/60" :
                    isNotebook ? "hover:text-stone-900 hover:bg-stone-200/60" :
                    "hover:text-white hover:bg-white/10"
                  }`}
                  title="Voice Settings"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className={`p-1.5 rounded-lg transition-all ${
                    isLightAcademic ? "hover:text-slate-900 hover:bg-slate-200/60" :
                    isNotebook ? "hover:text-stone-900 hover:bg-stone-200/60" :
                    "hover:text-white hover:bg-white/10"
                  }`}
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
                  className={`p-1.5 hover:text-red-500 rounded-lg transition-all ${
                    isLightAcademic ? "hover:bg-slate-200/60" :
                    isNotebook ? "hover:bg-stone-200/60" :
                    "hover:bg-white/10"
                  }`}
                  title="Close Voice Assistant"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Optional Voice Settings Drawer */}
            {showSettings && !isMinimized && (
              <div className={`px-4 py-3 text-xs space-y-2.5 border-b ${
                isLightAcademic ? "bg-slate-50 border-slate-200 text-slate-700" :
                isDarkAI ? "bg-[#0B1020] border-[#273449] text-slate-300" :
                isNotebook ? "bg-[#FAF8F3] border-[#E2DAC7] text-stone-800" :
                "bg-black/40 border-white/10 text-white/70"
              }`}>
                {/* Voice Persona Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span>Human Voice Persona</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </span>
                    <button
                      onClick={() => {
                        const previewText = voicePersona === "scholar"
                          ? "Hello! I am your mathematical scholar assistant. I explain principles and proofs step by step with natural human speech."
                          : voicePersona === "friendly"
                          ? "Hi there! I am your conversational math companion, ready to explore problems and intuition together."
                          : "Greetings! I am Professor AI, ready to derive solutions, analyze equations, and explain theorems.";
                        setAssistantState("speaking");
                        speakCleanText(previewText, {
                          rate: speechRate,
                          persona: voicePersona,
                          onEnd: () => setAssistantState("idle"),
                          onError: () => setAssistantState("idle"),
                        });
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-mono transition-colors cursor-pointer ${
                        isLightAcademic ? "bg-blue-100 text-blue-700 hover:bg-blue-200" :
                        isNotebook ? "bg-stone-200 text-stone-800 hover:bg-stone-300" :
                        isDarkAI ? "bg-indigo-950/80 text-cyan-300 border border-indigo-800/40 hover:bg-indigo-900" :
                        "bg-white/10 text-amber-300 hover:bg-white/20"
                      }`}
                      title="Test Voice"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Test Voice</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => {
                        setVoicePersona("natural");
                        localStorage.setItem("math_assistant_persona", "natural");
                      }}
                      className={`py-1.5 px-1 rounded text-[10px] font-semibold tracking-tight transition-all border ${
                        voicePersona === "natural"
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                          : isLightAcademic ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          : isNotebook ? "bg-[#FFFDF8] border-[#E2DAC7] text-stone-700 hover:bg-[#F5EFE0]"
                          : isDarkAI ? "bg-[#111827] border-[#273449] text-slate-300 hover:bg-[#1a2336]"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      Prof. Male
                    </button>
                    <button
                      onClick={() => {
                        setVoicePersona("scholar");
                        localStorage.setItem("math_assistant_persona", "scholar");
                      }}
                      className={`py-1.5 px-1 rounded text-[10px] font-semibold tracking-tight transition-all border ${
                        voicePersona === "scholar"
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                          : isLightAcademic ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          : isNotebook ? "bg-[#FFFDF8] border-[#E2DAC7] text-stone-700 hover:bg-[#F5EFE0]"
                          : isDarkAI ? "bg-[#111827] border-[#273449] text-slate-300 hover:bg-[#1a2336]"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      Scholar Female
                    </button>
                    <button
                      onClick={() => {
                        setVoicePersona("friendly");
                        localStorage.setItem("math_assistant_persona", "friendly");
                      }}
                      className={`py-1.5 px-1 rounded text-[10px] font-semibold tracking-tight transition-all border ${
                        voicePersona === "friendly"
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                          : isLightAcademic ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          : isNotebook ? "bg-[#FFFDF8] border-[#E2DAC7] text-stone-700 hover:bg-[#F5EFE0]"
                          : isDarkAI ? "bg-[#111827] border-[#273449] text-slate-300 hover:bg-[#1a2336]"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      Conversational
                    </button>
                  </div>
                  <div className={`mt-1.5 px-2 py-1 rounded text-[9px] flex items-center justify-between font-mono ${
                    isLightAcademic ? "bg-slate-200/60 text-slate-600" :
                    isNotebook ? "bg-stone-200/60 text-stone-600" :
                    isDarkAI ? "bg-[#111827] text-slate-400" :
                    "bg-white/5 text-white/50"
                  }`}>
                    <span className="truncate">
                      Active: {getVoiceDisplayName(getBestHumanVoice({ persona: voicePersona }))}
                    </span>
                    <span className="shrink-0 text-emerald-400 font-sans font-medium text-[8px] uppercase tracking-wider ml-1">
                      Human Audio
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>Voice Cadence ({speechRate}x)</span>
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
                  <span>Auto-read Spoken Replies</span>
                  <button
                    onClick={() => setAutoSpeakReplies(!autoSpeakReplies)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      autoSpeakReplies
                        ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                        : "bg-black/10 text-slate-400"
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
                <div className={`flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs scrollbar-thin ${
                  isLightAcademic ? "bg-[#F8FAFC]" :
                  isDarkAI ? "bg-[#0B1020]" :
                  isNotebook ? "bg-notebook-canvas" :
                  isBlueprint ? "bg-[#041224]" :
                  isCosmos ? "bg-[#060412]" :
                  "bg-blackboard-canvas"
                }`}>
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
                            ? isLightAcademic
                              ? "bg-[#2563EB] text-white rounded-br-none shadow-md shadow-blue-500/20"
                              : isDarkAI
                              ? "bg-[#6366F1] text-white rounded-br-none shadow-md shadow-indigo-950/40"
                              : isNotebook
                              ? "bg-[#1E40AF] text-[#FAF8F3] rounded-br-none shadow-md shadow-stone-300/40"
                              : isBlueprint
                              ? "bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-950/40"
                              : isCosmos
                              ? "bg-purple-600 text-white rounded-br-none shadow-md shadow-purple-950/40"
                              : "bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/20"
                            : isLightAcademic
                            ? "bg-white border border-[#E2E8F0] text-[#0F172A] rounded-bl-none shadow-sm"
                            : isDarkAI
                            ? "bg-[#111827] border border-[#273449] text-[#F8FAFC] rounded-bl-none shadow-sm"
                            : isNotebook
                            ? "bg-[#FFFDF8] border border-[#E2DAC7] text-[#242018] rounded-bl-none shadow-sm font-academic"
                            : isBlueprint
                            ? "bg-[#082244] border border-cyan-500/30 text-cyan-100 rounded-bl-none shadow-sm font-mono"
                            : isCosmos
                            ? "bg-[#130b30] border border-purple-500/30 text-purple-100 rounded-bl-none shadow-sm font-sans"
                            : "bg-[#0f1d16] border border-amber-900/30 text-[#ededdf] rounded-bl-none shadow-md font-academic"
                        }`}
                      >
                        <p className="leading-relaxed">{msg.text}</p>
                        {msg.mathFormula && (
                          <div className={`mt-2 pt-2 border-t font-mono text-xs ${
                            isLightAcademic ? "border-slate-200 text-blue-700" :
                            isDarkAI ? "border-[#273449] text-cyan-300" :
                            isNotebook ? "border-[#E2DAC7] text-[#1E40AF]" :
                            isBlueprint ? "border-cyan-500/30 text-cyan-300" :
                            isCosmos ? "border-purple-500/30 text-purple-300" :
                            "border-white/20 text-blue-300"
                          }`}>
                            <KatexMath math={msg.mathFormula} block={false} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className={`text-[9px] font-mono ${
                          isLightAcademic ? "text-slate-400" :
                          isNotebook ? "text-stone-400" :
                          "text-white/30"
                        }`}>
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        {msg.sender === "assistant" && (
                          <button
                            onClick={() => {
                              setAssistantState("speaking");
                              speakCleanText(msg.text, {
                                rate: speechRate,
                                persona: voicePersona,
                                onEnd: () => setAssistantState("idle"),
                                onError: () => setAssistantState("idle"),
                              });
                            }}
                            className={`p-0.5 rounded hover:scale-110 transition-transform cursor-pointer ${
                              isLightAcademic ? "text-slate-400 hover:text-blue-600" :
                              isNotebook ? "text-stone-400 hover:text-blue-900" :
                              "text-white/40 hover:text-white"
                            }`}
                            title="Listen in Human Voice"
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Real-time Listening Wave & Interim Transcript */}
                  {assistantState === "listening" && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <Radio className="w-4 h-4 text-red-400 animate-pulse shrink-0 mt-0.5" />
                      <div className="space-y-1 w-full">
                        <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider">
                          Listening now...
                        </p>
                        <p className={`text-xs italic font-mono ${
                          isLightAcademic ? "text-slate-800" :
                          isNotebook ? "text-stone-800" :
                          "text-white/90"
                        }`}>
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
                    <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                      <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                      <span className="text-xs font-mono">AI Tutor is thinking...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Voice Command Suggestion Chips */}
                <div className={`px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar ${getChipsBarStyles()}`}>
                  <span className={`text-[10px] uppercase font-bold shrink-0 flex items-center gap-1 ${
                    isLightAcademic ? "text-slate-500 font-sans" :
                    isDarkAI ? "text-cyan-300/80 font-mono" :
                    isNotebook ? "text-stone-600 font-academic" :
                    isBlueprint ? "text-cyan-300/80 font-mono" :
                    isCosmos ? "text-purple-300/80 font-sans" :
                    "text-amber-300/60 font-scholar-title"
                  }`}>
                    <HelpCircle className={`w-3 h-3 ${
                      isLightAcademic ? "text-blue-600" :
                      isDarkAI ? "text-cyan-400" :
                      isNotebook ? "text-blue-800" :
                      "text-amber-400"
                    }`} />
                    Try:
                  </span>
                  {getContextualChips().map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleQuickPrompt(chip)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        isLightAcademic
                          ? "bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-700 font-sans"
                          : isDarkAI
                          ? "bg-[#111827] hover:bg-[#1f2937] border border-[#273449] text-cyan-300 hover:text-cyan-200 font-mono"
                          : isNotebook
                          ? "bg-[#FFFDF8] hover:bg-[#F2ECE0] border border-[#E2DAC7] text-stone-800 font-academic italic"
                          : isBlueprint
                          ? "bg-[#061b36] hover:bg-[#0a274c] border border-cyan-500/30 text-cyan-200 font-mono"
                          : isCosmos
                          ? "bg-[#0e0724] hover:bg-[#180d3d] border border-purple-500/30 text-purple-200 font-sans"
                          : "bg-[#12231b] hover:bg-[#1a3528] border border-amber-900/30 hover:border-amber-500/40 font-academic italic text-amber-200/80 hover:text-amber-100"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Bottom Control Bar */}
                <div className={`p-3 flex items-center justify-between gap-2 ${getControlBarStyles()}`}>
                  <div className="flex items-center gap-2">
                    {/* Main Voice Toggle Button */}
                    <button
                      onClick={toggleListening}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer transform active:scale-95 ${
                        assistantState === "listening"
                          ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/40 animate-pulse"
                          : isLightAcademic
                          ? "bg-[#2563EB] hover:bg-blue-700 text-white shadow-blue-500/25"
                          : isDarkAI
                          ? "bg-[#6366F1] hover:bg-indigo-600 text-white shadow-indigo-950/60"
                          : isNotebook
                          ? "bg-[#1E40AF] hover:bg-blue-900 text-[#FAF8F3] shadow-stone-400/30"
                          : isBlueprint
                          ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/60"
                          : isCosmos
                          ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/60"
                          : "bg-[#183626] hover:bg-[#234d37] border border-amber-500/40 text-amber-200 shadow-black/40"
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
                        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                          isLightAcademic
                            ? "bg-slate-200 hover:bg-slate-300 text-slate-800"
                            : isNotebook
                            ? "bg-stone-200 hover:bg-stone-300 text-stone-800"
                            : "bg-white/10 hover:bg-white/20 text-white"
                        }`}
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
                      className={`px-3 py-2 rounded-xl text-[10px] font-mono flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isLightAcademic
                          ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs"
                          : isDarkAI
                          ? "bg-[#111827] hover:bg-[#1f2937] border-[#273449] text-cyan-300"
                          : isNotebook
                          ? "bg-[#FFFDF8] hover:bg-[#FAF5EA] border-[#E2DAC7] text-stone-700 shadow-xs"
                          : "bg-white/5 hover:bg-white/10 border-white/10 text-white/80 hover:text-white"
                      }`}
                      title="Read current step explanation aloud"
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${
                        isLightAcademic ? "text-blue-600" :
                        isDarkAI ? "text-cyan-400" :
                        isNotebook ? "text-blue-800" :
                        "text-blue-400"
                      }`} />
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
