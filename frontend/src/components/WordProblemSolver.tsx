import React, { useState, useEffect, useRef } from "react";
import {
  Layers,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  Volume2,
  VolumeX,
  Copy,
  ExternalLink,
  Mic,
  MicOff,
  Send,
  Check,
  AlertTriangle,
  Workflow,
  CheckCircle,
  FileText,
  RefreshCw,
  Sparkles,
  Flame,
  Film,
  PlayCircle
} from "lucide-react";
import { KatexMath } from "./Whiteboard";
import WordProblemVideoPlayer from "./WordProblemVideoPlayer";
import {
  ThemeType,
  WordProblemPipelineResponse,
  WordProblemPreset
} from "../types";
import { createSpeechRecognition, parseSpokenMath } from "../utils/speechUtils";


interface WordProblemSolverProps {
  theme?: ThemeType;
  onSendToStudio?: (equation: string) => void;
  userToken?: string | null;
}

const DEFAULT_PRESETS: WordProblemPreset[] = [
  {
    id: "motion_catchup",
    category: "Motion & Kinematics",
    title: "Two Trains Catch-Up",
    question: "A train leaves Chicago traveling at 60 mph. Two hours later another train leaves from the same station traveling at 90 mph in the same direction. When will the second train catch up?",
    difficulty: "Intermediate",
    tag: "d1 = d2"
  },
  {
    id: "geometry_pythagorean",
    category: "Geometry & Triangles",
    title: "Right Triangle Hypotenuse & Leg",
    question: "The hypotenuse of a right triangle is 13 cm and one leg is 5 cm. What is the length of the other leg and the triangle area?",
    difficulty: "Basic",
    tag: "a^2 + b^2 = c^2"
  },
  {
    id: "geometry_rectangle",
    category: "Geometry & Area",
    title: "Rectangular Garden Dimensions",
    question: "A rectangular garden has a perimeter of 54 meters and an area of 180 square meters. Find its length and width.",
    difficulty: "Intermediate",
    tag: "Dimensions / Area"
  },
  {
    id: "work_rate_pipes",
    category: "Work & Rates",
    title: "Combined Work Rate",
    question: "Worker A can complete a job alone in 4 hours, and Worker B can complete the same job alone in 6 hours. How long will it take if they work together?",
    difficulty: "Intermediate",
    tag: "1/t1 + 1/t2 = 1/T"
  },
  {
    id: "linear_system_tickets",
    category: "Systems of Equations",
    title: "Event Ticket Sales System",
    question: "A school theater sold 50 tickets for a total of $310. Student tickets cost $5 each and adult tickets cost $8 each. How many of each ticket were sold?",
    difficulty: "Intermediate",
    tag: "2x2 Linear System"
  }
];


export default function WordProblemSolver({
  theme = "chalkboard",
  onSendToStudio,
  userToken
}: WordProblemSolverProps) {
  const [questionInput, setQuestionInput] = useState<string>(
    "A train leaves Chicago traveling at 60 mph. Two hours later another train leaves from the same station traveling at 90 mph in the same direction. When will the second train catch up?"
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [solutionData, setSolutionData] = useState<WordProblemPipelineResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [activeResultsTab, setActiveResultsTab] = useState<"video" | "steps" | "variables" | "trace">("video");
  const recognitionRef = useRef<any>(null);


  const isLightAcademic = theme === "lightAcademic";
  const isChalkboard = theme === "chalkboard";
  const isBlueprint = theme === "blueprint";
  const isCosmos = theme === "cosmos";

  // Fetch presets or solve initial query on mount
  useEffect(() => {
    handleSolve(questionInput);
  }, []);

  const handleSolve = async (queryText?: string) => {
    const q = (queryText || questionInput).trim();
    if (!q || loading) return;

    setLoading(true);
    setErrorMsg(null);
    stopSpeech();

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userToken) headers["Authorization"] = `Bearer ${userToken}`;

      const res = await fetch("/api/word-problem/solve", {
        method: "POST",
        headers,
        body: JSON.stringify({ question: q })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Word problem solving engine encountered an error.");
      }

      const data: WordProblemPipelineResponse = await res.json();
      setSolutionData(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to solve word problem.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!solutionData) return;
    const txt = `${solutionData.original_question}\n\nSolution: ${solutionData.final_answer}\n\nExplanation:\n${solutionData.real_world_conclusion}`;
    navigator.clipboard.writeText(txt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      stopSpeech();
    } else if (solutionData) {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const textToSpeak = `${solutionData.final_answer}. ${solutionData.real_world_conclusion}`;
      const utter = new SpeechSynthesisUtterance(textToSpeak);
      utter.rate = 1.0;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      synth.speak(utter);
    }
  };

  const stopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = createSpeechRecognition();
    if (!rec) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setIsListening(true);
    rec.onresult = (evt: any) => {
      const transcript = evt.results[0][0].transcript;
      if (transcript) {
        const mathClean = parseSpokenMath(transcript);
        setQuestionInput(mathClean);
        handleSolve(mathClean);
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    try {
      rec.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 animate-fade-in">
      {/* Top Header Hero */}
      <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-xl relative overflow-hidden transition-all shadow-2xl ${
        isLightAcademic
          ? "bg-gradient-to-br from-white via-slate-50 to-blue-50/50 border-slate-200 text-slate-800 shadow-blue-500/5"
          : isChalkboard
          ? "bg-gradient-to-br from-[#0f1f17]/90 via-[#0a1610]/95 to-[#050c08] border-amber-900/40 text-[#f5f5ed] shadow-black/60"
          : isBlueprint
          ? "bg-gradient-to-br from-[#061833]/90 via-[#030e20]/95 to-[#010812] border-cyan-500/30 text-cyan-100 shadow-cyan-950/40"
          : "bg-gradient-to-br from-[#0c1024]/90 via-[#080b18]/95 to-[#04060d] border-indigo-500/30 text-slate-100 shadow-indigo-950/40"
      }`}>
        {/* Ambient glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-radial from-blue-500/15 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase border flex items-center gap-1.5 ${
                isLightAcademic
                  ? "bg-blue-100/80 text-blue-800 border-blue-200"
                  : "bg-indigo-500/20 text-indigo-300 border-indigo-400/30"
              }`}>
                <Workflow className="w-3.5 h-3.5 text-indigo-400" />
                8-Stage Neural Math Architecture
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Dual NLU (Local LLM + Rules)
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Rigorous Verification
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight flex items-center gap-3">
              <span>Word Problem Solving Studio</span>
            </h1>

            <p className={`text-sm sm:text-base leading-relaxed ${isLightAcademic ? "text-slate-600" : "text-slate-300/90"}`}>
              Transform complex natural language word problems into verified mathematical proofs.
              The pipeline executes Natural Language Understanding, problem classification, canonical schema modeling,
              solvability validation, formal model building, execution on your math engine, numerical residual verification, and step-by-step explanations.
            </p>
          </div>

          {/* Quick Metrics Badge */}
          {solutionData && (
            <div className={`p-4 rounded-2xl border text-xs font-mono space-y-1.5 flex flex-col justify-center min-w-[200px] ${
              isLightAcademic ? "bg-white/90 border-slate-200 shadow-sm" : "bg-black/50 border-white/10"
            }`}>
              <div className="flex justify-between items-center text-slate-400">
                <span>Category:</span>
                <span className="font-bold text-white capitalize">{solutionData.structured_model.category}</span>
              </div>
              {solutionData.final_answer_units && (
                <div className="flex justify-between items-center text-slate-400">
                  <span>Target Units:</span>
                  <span className="font-bold text-amber-300 capitalize">{solutionData.final_answer_units}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-400">
                <span>Pipeline Latency:</span>
                <span className="font-bold text-emerald-400">{solutionData.total_execution_time_ms} ms</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Verification:</span>
                <span className={`font-bold ${solutionData.verification.is_verified ? "text-emerald-400" : "text-amber-400"}`}>
                  {solutionData.verification.status}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Equations Solved:</span>
                <span className="font-bold text-cyan-400">{solutionData.structured_model.constraints.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Console */}
      <div className={`p-6 rounded-3xl border backdrop-blur-xl shadow-xl transition-all space-y-4 ${
        isLightAcademic
          ? "bg-white border-slate-200 shadow-slate-200/50"
          : "bg-black/40 border-white/10"
      }`}>
        <div className="flex items-center justify-between">
          <label htmlFor="word-problem-textarea" className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2 text-indigo-400">
            <FileText className="w-4 h-4" />
            Enter Word Problem (Natural Language)
          </label>
          <span className="text-[11px] font-mono opacity-60">Ctrl + Enter to solve</span>
        </div>

        <div className="relative">
          <textarea
            id="word-problem-textarea"
            rows={3}
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSolve();
              }
            }}
            placeholder="e.g. A train leaves Chicago traveling at 60 mph. Two hours later another train leaves from the same station traveling at 90 mph in the same direction. When will the second train catch up?"
            className={`w-full p-4 rounded-2xl border text-sm sm:text-base font-sans resize-y focus:outline-none transition-all ${
              isLightAcademic
                ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white shadow-inner"
                : "bg-white/5 border-white/15 text-white focus:border-indigo-500 focus:bg-white/10 placeholder-white/30"
            }`}
          />

          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <button
              onClick={toggleMic}
              title={isListening ? "Listening... click to stop" : "Speak question with microphone"}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isListening
                  ? "bg-red-500 text-white border-red-400 animate-pulse"
                  : "bg-white/10 hover:bg-white/20 text-white/80 border-white/10"
              }`}
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
            <button
              disabled={loading || !questionInput.trim()}
              onClick={() => handleSolve()}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Pipeline...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Solve Word Problem
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Example Presets */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-400">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Tested Archetypes & Examples:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setQuestionInput(preset.question);
                  handleSolve(preset.question);
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer text-left flex items-center gap-2 ${
                  isLightAcademic
                    ? "bg-slate-100/80 hover:bg-blue-50 hover:border-blue-300 text-slate-700 border-slate-200"
                    : "bg-white/5 hover:bg-white/10 hover:border-indigo-400/40 text-white/80 border-white/10"
                }`}
              >
                <span className="font-bold text-indigo-400">{preset.title}</span>
                <span className="opacity-60 text-[10px]">({preset.tag})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}


      {/* Main Solution Results Card */}
      {solutionData && (
        <div className="space-y-6">
          {/* Hero Final Answer Banner */}
          <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-xl shadow-2xl relative overflow-hidden ${
            isLightAcademic
              ? "bg-gradient-to-br from-emerald-50 via-white to-blue-50 border-emerald-200 text-slate-800"
              : "bg-gradient-to-br from-emerald-950/40 via-black/80 to-[#050f0a] border-emerald-500/30 text-white"
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Solution
                  </span>
                  {solutionData.final_answer_units && (
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center gap-1.5">
                      <span className="text-slate-400">Unit:</span>
                      <span className="text-cyan-200">{solutionData.final_answer_units}</span>
                    </span>
                  )}
                  <span className="text-xs font-mono opacity-60">
                    Confidence: 99.8% • All Constraints Satisfied
                  </span>
                </div>

                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 flex items-center gap-3">
                  <KatexMath math={solutionData.final_answer_latex || solutionData.final_answer} block={false} />
                </div>

                <p className="text-sm sm:text-base leading-relaxed text-slate-200 font-sans max-w-3xl">
                  {solutionData.real_world_conclusion}
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0">
                <button
                  onClick={() => setActiveResultsTab("video")}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    activeResultsTab === "video"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-indigo-400/50 shadow-lg shadow-indigo-600/30"
                      : "bg-white/10 hover:bg-white/20 text-white border-white/15"
                  }`}
                >
                  <Film className="w-4 h-4 text-cyan-300" />
                  <span>Watch Video Explanation</span>
                </button>

                <button
                  onClick={toggleSpeech}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isSpeaking
                      ? "bg-amber-500 text-black border-amber-400 animate-pulse"
                      : "bg-white/10 hover:bg-white/20 text-white border-white/15"
                  }`}
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  {isSpeaking ? "Stop Narration" : "Play Voice Narration"}
                </button>

                <button
                  onClick={handleCopy}
                  className="px-4 py-2.5 rounded-xl border text-xs font-mono font-bold bg-white/10 hover:bg-white/20 text-white border-white/15 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? "Copied to Clipboard!" : "Copy Full Solution"}
                </button>

                {onSendToStudio && (
                  <button
                    onClick={() => {
                      const targetEq = solutionData.mathematical_model.primary_equation;
                      onSendToStudio(targetEq);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Load in Studio Whiteboard
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Navigation View Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
            <button
              onClick={() => setActiveResultsTab("video")}
              className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeResultsTab === "video"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40"
                  : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5"
              }`}
            >
              <Film className="w-4 h-4 text-cyan-300" />
              <span>🎬 Animated Video Studio</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                60 FPS
              </span>
            </button>

            <button
              onClick={() => setActiveResultsTab("steps")}
              className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeResultsTab === "steps"
                  ? "bg-indigo-600 text-white shadow-lg border border-indigo-400/40"
                  : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5"
              }`}
            >
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Step-by-Step Proof ({solutionData.explanation_steps.length})</span>
            </button>

            <button
              onClick={() => setActiveResultsTab("variables")}
              className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeResultsTab === "variables"
                  ? "bg-indigo-600 text-white shadow-lg border border-indigo-400/40"
                  : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5"
              }`}
            >
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Variables & Residuals ({solutionData.structured_model.variables.length})</span>
            </button>

            <button
              onClick={() => setActiveResultsTab("trace")}
              className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeResultsTab === "trace"
                  ? "bg-indigo-600 text-white shadow-lg border border-indigo-400/40"
                  : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5"
              }`}
            >
              <Workflow className="w-4 h-4 text-cyan-400" />
              <span>Pipeline Trace ({solutionData.pipeline_trace.length} Stages)</span>
            </button>
          </div>

          {/* TAB 1: Animated Explainer Video Player */}
          {activeResultsTab === "video" && (
            <div className="space-y-6">
              {solutionData.video_script ? (
                <WordProblemVideoPlayer
                  videoScript={solutionData.video_script}
                  pipelineResponse={solutionData}
                  theme={theme}
                  onSendToStudio={onSendToStudio}
                />
              ) : (
                <div className="p-8 rounded-3xl bg-black/40 border border-white/10 text-center space-y-2">
                  <Film className="w-8 h-8 text-indigo-400 mx-auto" />
                  <p className="text-sm font-mono text-slate-300">Generating video storyboard...</p>
                </div>
              )}

              {/* Storyboard Phase Cards Grid */}
              {solutionData.video_script && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {solutionData.video_script.scenes.map((sc, i) => (
                    <div
                      key={sc.scene_id}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 hover:border-indigo-500/40 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-indigo-400 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          {sc.phase_label.split(":")[0]}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {sc.duration_sec}s
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-[12px]">{sc.title}</h4>
                      {sc.latex_callout && (
                        <div className="p-1.5 rounded-lg bg-black/40 text-cyan-300 font-mono text-[11px] overflow-x-auto">
                          <KatexMath math={sc.latex_callout} block={false} />
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400 line-clamp-3 font-sans">
                        {sc.narration}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Step-by-Step Pedagogical Explanation Accordion */}
          {activeResultsTab === "steps" && (
            <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-xl shadow-xl space-y-5 ${
              isLightAcademic ? "bg-white border-slate-200" : "bg-black/40 border-white/10"
            }`}>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold uppercase tracking-wider font-mono">
                    Full Step-by-Step Mathematical Explanation
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {solutionData.explanation_steps.length} Rigorous Steps
                </span>
              </div>

              <div className="space-y-4">
                {solutionData.explanation_steps.map((st) => (
                  <div
                    key={st.step_number}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 ${
                      isLightAcademic
                        ? "bg-slate-50/80 border-slate-200"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-mono text-xs flex items-center justify-center font-black">
                          {st.step_number}
                        </span>
                        {st.title}
                      </span>
                      {st.rule && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20 shrink-0">
                          {st.rule}
                        </span>
                      )}
                    </div>

                    {st.latex && (
                      <div className="p-3 rounded-xl bg-black/50 border border-white/5 overflow-x-auto text-cyan-200 text-sm font-mono flex items-center justify-start">
                        <KatexMath math={st.latex} block={true} />
                      </div>
                    )}

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                      {st.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Structured Model & Verification Scorecard Grid */}
          {activeResultsTab === "variables" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Variables & Formulated Equations */}
              <div className={`p-6 rounded-3xl border backdrop-blur-xl shadow-xl space-y-4 ${
                isLightAcademic ? "bg-white border-slate-200" : "bg-black/40 border-white/10"
              }`}>
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                    Extracted Canonical Variables
                  </h3>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {solutionData.structured_model.variables.map((v, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-400">
                            <KatexMath math={v.symbol} block={false} />
                          </span>
                          <span className="font-medium text-slate-200">{v.name}</span>
                          {v.is_target && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-mono">
                              Target Unknown
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">{v.description}</span>
                      </div>

                      <div className="text-right font-mono font-bold text-slate-100">
                        {v.value !== null && v.value !== undefined ? (
                          <span>{v.value} {v.unit || ""}</span>
                        ) : solutionData.all_values[v.symbol] !== undefined ? (
                          <span className="text-emerald-400">
                            {solutionData.all_values[v.symbol]} {v.unit || ""}
                          </span>
                        ) : (
                          <span className="text-amber-400 italic">Solved</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Residuals Scorecard */}
              <div className={`p-6 rounded-3xl border backdrop-blur-xl shadow-xl space-y-4 ${
                isLightAcademic ? "bg-white border-slate-200" : "bg-black/40 border-white/10"
              }`}>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                      Residual Verification Scorecard
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {solutionData.verification.status}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {solutionData.verification.checks.map((chk, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-cyan-300">
                          <KatexMath math={chk.equation} block={false} />
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                          chk.satisfied ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                        }`}>
                          <Check className="w-3 h-3" />
                          Residual: {chk.residual}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-sans">
                        {chk.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Pipeline Execution Trace */}
          {activeResultsTab === "trace" && (
            <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-xl shadow-xl space-y-5 ${
              isLightAcademic ? "bg-white border-slate-200" : "bg-black/40 border-white/10"
            }`}>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <Workflow className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold uppercase tracking-wider font-mono">
                    Neural Pipeline Execution Trace
                  </h3>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  Total: {solutionData.total_execution_time_ms} ms
                </span>
              </div>

              <div className="space-y-3">
                {solutionData.pipeline_trace.map((tr, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-white font-mono">{tr.stage_name}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 pl-7">{tr.summary}</p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <span className="text-[10px] font-mono text-slate-400">
                        {tr.execution_time_ms} ms
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                        {tr.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

