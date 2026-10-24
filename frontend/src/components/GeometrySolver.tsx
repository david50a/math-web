import React, { useState, useEffect, useRef } from "react";
import {
  Compass,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Volume2,
  VolumeX,
  MessageSquare,
  Send,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronRight,
  GraduationCap
} from "lucide-react";
import { KatexMath } from "./Whiteboard";
import {
  ThemeType,
  GeometrySolveResponse,
  GeometryPreset,
  GeometricPoint,
  GeometryProofStep
} from "../types";
import { BOARD_THEMES } from "./boards/themePalette";

interface GeometrySolverProps {
  theme: ThemeType;
  userToken?: string | null;
  onSendToStudio?: (equation: string) => void;
}

export default function GeometrySolver({
  theme,
  userToken,
  onSendToStudio
}: GeometrySolverProps) {
  const [questionInput, setQuestionInput] = useState<string>(
    "Trapezoid ABCD (AB parallel DC).\n" +
    "It is given that the length of base AB is equal to the length of side BC.\n" +
    "Let AB = BC = k and angle ABC = alpha (where 0^circ < alpha < 90^circ).\n" +
    "a. Show that AC = 2k cos(90^circ - alpha/2) = 2k sin(alpha/2).\n" +
    "It is given that AD = sqrt(3)k and DC = 2k.\n" +
    "b. Find the value of alpha.\n" +
    "c. Find the measure of angle ADC.\n" +
    "The extensions of sides DA and CB intersect at point E.\n" +
    "It is given that the radius of the incircle of triangle EDC is 14.\n" +
    "d. Find the value of k."
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [solution, setSolution] = useState<GeometrySolveResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string>("all");
  const [presets, setPresets] = useState<GeometryPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>("bagrut_trapezoid_incircle");

  // Diagram Toggles & Zoom
  const [showExtensions, setShowExtensions] = useState<boolean>(true);
  const [showIncircle, setShowIncircle] = useState<boolean>(true);
  const [showAngles, setShowAngles] = useState<boolean>(true);
  const [showLengths, setShowLengths] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  // AI Teacher Chat
  const [teacherChat, setTeacherChat] = useState<Array<{ sender: "user" | "teacher"; text: string; time?: string }>>([
    {
      sender: "teacher",
      text: "Hello! I am Axiom, your AI Geometry Tutor. Ask me any question about the steps, alternate derivations, or why specific geometric theorems apply!"
    }
  ]);
  const [studentQuery, setStudentQuery] = useState<string>("");
  const [isAskingTeacher, setIsAskingTeacher] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [copiedPart, setCopiedPart] = useState<string | null>(null);

  const rawColors = BOARD_THEMES[theme] || BOARD_THEMES.darkAI;
  const colors = {
    ...rawColors,
    border: rawColors.cardBorder,
    canvasBg: rawColors.cardBg
  };
  const isLight = theme === "lightAcademic" || theme === "notebook";
  const isChalkboard = theme === "chalkboard";

  // Fetch presets on mount
  useEffect(() => {
    fetchPresets();
    handleSolveGeometry();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch("/api/geometry/presets");
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (err) {
      console.warn("Could not load geometry presets:", err);
    }
  };

  const handleSolveGeometry = async (customQuestion?: string) => {
    const q = customQuestion || questionInput;
    if (!q.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/geometry/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned ${res.status}`);
      }

      const data: GeometrySolveResponse = await res.json();
      setSolution(data);
      setSelectedPart("all");

      // Auto-update teacher initial greeting with problem title & conceptual overview
      if (data.teacher?.conceptual_overview) {
        setTeacherChat([
          {
            sender: "teacher",
            text: `Welcome! We have solved ${data.problem_model.title || "this problem"} across ${data.parts.length} structured parts.\n\nKey Insight: ${data.teacher.conceptual_overview}`
          }
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to solve geometry problem.");
    } finally {
      setLoading(false);
    }
  };

  const handleAskTeacher = async (queryText?: string) => {
    const query = queryText || studentQuery;
    if (!query.trim() || isAskingTeacher) return;

    const userMsg = { sender: "user" as const, text: query, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setTeacherChat(prev => [...prev, userMsg]);
    if (!queryText) setStudentQuery("");

    setIsAskingTeacher(true);
    try {
      const res = await fetch("/api/geometry/ask-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionInput,
          context_problem: solution?.problem_model.title || "Geometry Problem",
          student_query: query,
          part_id: selectedPart !== "all" ? selectedPart : null
        })
      });

      if (res.ok) {
        const data = await res.json();
        const teacherMsg = {
          sender: "teacher" as const,
          text: data.reply || "Let's review the theorem together.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setTeacherChat(prev => [...prev, teacherMsg]);
      }
    } catch (err) {
      setTeacherChat(prev => [
        ...prev,
        {
          sender: "teacher",
          text: "I experienced a brief connection interruption. In short: remember that in isosceles triangles, an altitude bisects both the vertex angle and the opposite base!"
        }
      ]);
    } finally {
      setIsAskingTeacher(false);
    }
  };

  const handleCopyLatex = (latex: string, partId: string) => {
    navigator.clipboard.writeText(latex);
    setCopiedPart(partId);
    setTimeout(() => setCopiedPart(null), 2000);
  };

  const toggleSpeak = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text.replace(/[$#\\*_]/g, " "));
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const filteredSteps = solution?.all_steps.filter(s =>
    selectedPart === "all" ? true : s.part === selectedPart
  ) || [];

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${isLight ? "bg-slate-50 text-slate-900" : "bg-[#0b101b] text-slate-100"}`}>
      {/* Top Header & Presets */}
      <div className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 backdrop-blur-md ${isLight ? "bg-white/80 border-slate-200" : "bg-slate-900/60 border-white/10"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent">
                Axiom Geometry Solver & AI Teacher
              </h1>
              <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                End-to-End Pipeline
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Natural Language NLP → Geometry Problem Model → Diagram Builder & Solver Engine → Validation → AI Teacher
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Presets:
          </span>
          {presets.map(preset => {
            const isActive = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setActivePresetId(preset.id);
                  setQuestionInput(preset.question);
                  handleSolveGeometry(preset.question);
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${isActive
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-500/30"
                  : isLight
                    ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                    : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300"
                  }`}
                title={preset.title}
              >
                {preset.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel: Question Input & Interactive Diagram (45%) */}
        <div className={`w-full lg:w-[45%] flex flex-col border-r overflow-y-auto ${isLight ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950/40"}`}>
          {/* Question Input Card */}
          <div className="p-5 border-b border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Enter Geometry Question
              </label>
              {solution && (
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Solved in {solution.execution_time_ms}ms
                </span>
              )}
            </div>

            <textarea
              value={questionInput}
              onChange={e => setQuestionInput(e.target.value)}
              rows={5}
              placeholder="Enter geometry problem (e.g. Trapezoid ABCD with AB || DC, AB = BC = k, angle ABC = alpha...)"
              className={`w-full p-3.5 rounded-xl text-xs font-mono border resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all ${isLight
                ? "bg-slate-50 border-slate-300 text-slate-900"
                : "bg-slate-900/80 border-white/10 text-slate-100"
                }`}
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Supports multi-parts (a, b, c, d), parameters (k, α), and proofs
              </span>
              <button
                onClick={() => handleSolveGeometry()}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" /> Solving Geometry...
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4" /> Solve & Build Diagram
                  </>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
              </div>
            )}
          </div>

          {/* Interactive Geometric Diagram Renderer */}
          <div className="flex-1 p-5 flex flex-col space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Dynamic Diagram Model
              </h2>

              {/* Viewport & Layer Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowExtensions(!showExtensions)}
                  className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition-all ${showExtensions ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-white/5 border-white/10 text-slate-400"
                    }`}
                  title="Toggle point E extensions"
                >
                  {showExtensions ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Extensions (E)
                </button>

                <button
                  onClick={() => setShowIncircle(!showIncircle)}
                  className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition-all ${showIncircle ? "bg-pink-500/20 border-pink-500/40 text-pink-300" : "bg-white/5 border-white/10 text-slate-400"
                    }`}
                  title="Toggle inradius circle"
                >
                  {showIncircle ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Incircle
                </button>

                <div className="flex items-center bg-slate-900 border border-white/10 rounded-lg p-0.5 ml-1">
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 2.0))}
                    className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.7))}
                    className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setZoomLevel(1); setPan({ x: 0, y: 0 }); }}
                    className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
                    title="Reset view"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* SVG Visual Slate */}
            <div className={`relative flex-1 min-h-[340px] rounded-2xl border flex items-center justify-center overflow-hidden transition-all ${isLight ? "bg-slate-100/80 border-slate-300" : "bg-slate-950 border-white/10 shadow-inner"
              }`}>
              {/* Technical Grid Pattern */}
              <div
                className="absolute inset-0 opacity-[0.07] pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(#38bdf8 1px, transparent 1px)",
                  backgroundSize: "20px 20px"
                }}
              />

              {solution?.diagram ? (
                <svg
                  viewBox={`${solution.diagram.viewbox.min_x} ${solution.diagram.viewbox.min_y} ${solution.diagram.viewbox.width} ${solution.diagram.viewbox.height}`}
                  className="w-full h-full max-h-[420px] transition-transform duration-300 select-none"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${pan.x}px, ${pan.y}px)`
                  }}
                >
                  <defs>
                    <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="glow-pink" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <marker
                      id="arrow-vector"
                      viewBox="0 0 10 10"
                      refX="5"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                    </marker>
                  </defs>

                  {/* Polygons */}
                  {solution.diagram.polygons.map((poly, idx) => {
                    const isExtensionTriangle = poly.name.toLowerCase().includes("triangle") && !poly.name.toLowerCase().includes("abc");
                    if (isExtensionTriangle && !showExtensions) return null;

                    const pointMap = new Map<string, GeometricPoint>(solution.diagram.points.map(p => [p.name, p]));
                    const pts = poly.vertices
                      .map(v => pointMap.get(v))
                      .filter(Boolean) as GeometricPoint[];

                    if (pts.length < 3) return null;
                    const pathD = `M ${pts.map(p => `${p.x},${p.y}`).join(" L ")} Z`;

                    return (
                      <path
                        key={idx}
                        d={pathD}
                        fill={poly.fill_color || "rgba(56, 189, 248, 0.1)"}
                        stroke={poly.stroke_color || "#38bdf8"}
                        strokeWidth="1.5"
                        strokeDasharray={isExtensionTriangle ? "4 4" : undefined}
                      />
                    );
                  })}

                  {/* Incircle */}
                  {showIncircle && solution.diagram.circles.map((circ, idx) => (
                    <g key={idx}>
                      <circle
                        cx={circ.center[0]}
                        cy={circ.center[1]}
                        r={circ.radius}
                        fill={circ.fill_color || "rgba(236, 72, 153, 0.08)"}
                        stroke={circ.color || "#ec4899"}
                        strokeWidth="2"
                        strokeDasharray="3 3"
                        filter="url(#glow-pink)"
                      />
                      <circle
                        cx={circ.center[0]}
                        cy={circ.center[1]}
                        r="3.5"
                        fill="#ec4899"
                      />
                    </g>
                  ))}

                  {/* Segments */}
                  {solution.diagram.segments.map((seg, idx) => {
                    if (seg.is_construction && !showExtensions) return null;
                    const pointMap = new Map<string, GeometricPoint>(solution.diagram.points.map(p => [p.name, p]));
                    const p1 = pointMap.get(seg.start);
                    const p2 = pointMap.get(seg.end);
                    if (!p1 || !p2) return null;

                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;

                    return (
                      <g key={idx}>
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke={seg.color || "#94a3b8"}
                          strokeWidth={seg.stroke_width || 2}
                          strokeDasharray={seg.is_dashed ? "5 4" : undefined}
                          strokeLinecap="round"
                        />
                        {showLengths && seg.length_label && (
                          <g transform={`translate(${midX}, ${midY - 5})`}>
                            <rect
                              x="-14"
                              y="-9"
                              width="28"
                              height="14"
                              rx="3"
                              fill="#0f172a"
                              opacity="0.8"
                            />
                            <text
                              x="0"
                              y="2"
                              textAnchor="middle"
                              fontSize="8"
                              fill={seg.color || "#cbd5e1"}
                              fontWeight="600"
                            >
                              {seg.length_label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Geometric Vectors (with arrow heads) */}
                  {solution.diagram.vectors && solution.diagram.vectors.map((vec, idx) => {
                    const pointMap = new Map<string, GeometricPoint>(solution.diagram.points.map(p => [p.name, p]));
                    const p1 = pointMap.get(vec.start);
                    const p2 = pointMap.get(vec.end);
                    if (!p1 || !p2) return null;
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;

                    return (
                      <g key={`vec-${idx}`}>
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke={vec.color || "#10b981"}
                          strokeWidth={vec.stroke_width || 2.5}
                          strokeDasharray={vec.is_dashed ? "4 3" : undefined}
                          markerEnd="url(#arrow-vector)"
                        />
                        <text
                          x={midX + 6}
                          y={midY - 6}
                          fontSize="9"
                          fill={vec.color || "#10b981"}
                          fontWeight="bold"
                        >
                          {vec.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Geometric Angles & Right-Angle Square Symbols */}
                  {showAngles && solution.diagram.angles && solution.diagram.angles.map((ang, idx) => {
                    const pointMap = new Map<string, GeometricPoint>(solution.diagram.points.map(p => [p.name, p]));
                    const pV = pointMap.get(ang.vertex);
                    const p1 = pointMap.get(ang.p1);
                    const p2 = pointMap.get(ang.p2);
                    if (!pV || !p1 || !p2) return null;

                    const d1x = p1.x - pV.x;
                    const d1y = p1.y - pV.y;
                    const d2x = p2.x - pV.x;
                    const d2y = p2.y - pV.y;
                    const len1 = Math.hypot(d1x, d1y) || 1;
                    const len2 = Math.hypot(d2x, d2y) || 1;
                    const u1x = d1x / len1;
                    const u1y = d1y / len1;
                    const u2x = d2x / len2;
                    const u2y = d2y / len2;

                    if (ang.is_right_angle) {
                      const sz = 9.0;
                      const c1x = pV.x + sz * u1x;
                      const c1y = pV.y + sz * u1y;
                      const c2x = pV.x + sz * u2x;
                      const c2y = pV.y + sz * u2y;
                      const cornerX = c1x + sz * u2x;
                      const cornerY = c1y + sz * u2y;

                      return (
                        <g key={`ang-${idx}`}>
                          <path
                            d={`M ${c1x} ${c1y} L ${cornerX} ${cornerY} L ${c2x} ${c2y}`}
                            fill="none"
                            stroke={ang.color || "#ef4444"}
                            strokeWidth="1.6"
                          />
                        </g>
                      );
                    }

                    const bisectX = (u1x + u2x) / 2;
                    const bisectY = (u1y + u2y) / 2;
                    const bisectLen = Math.hypot(bisectX, bisectY) || 1;
                    const lblX = pV.x + (bisectX / bisectLen) * 16;
                    const lblY = pV.y + (bisectY / bisectLen) * 16;

                    return (
                      <g key={`ang-${idx}`}>
                        <text
                          x={lblX}
                          y={lblY}
                          fontSize="8.5"
                          textAnchor="middle"
                          fill={ang.color || "#fbbf24"}
                          fontWeight="bold"
                        >
                          {ang.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Complex Number Points (Argand coordinates badges) */}
                  {solution.diagram.complex_points && solution.diagram.complex_points.map((cp, idx) => {
                    const pointMap = new Map<string, GeometricPoint>(solution.diagram.points.map(p => [p.name, p]));
                    const pt = pointMap.get(cp.name);
                    if (!pt) return null;
                    return (
                      <g key={`cp-${idx}`}>
                        <rect
                          x={pt.x + 6}
                          y={pt.y - 14}
                          width="78"
                          height="14"
                          rx="3"
                          fill="#090d16"
                          opacity="0.9"
                          stroke="#38bdf8"
                          strokeWidth="0.6"
                        />
                        <text
                          x={pt.x + 10}
                          y={pt.y - 4}
                          fontSize="7"
                          fill="#38bdf8"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {cp.real} {cp.imag >= 0 ? `+ ${cp.imag}i` : `- ${Math.abs(cp.imag)}i`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Vertices & Labels */}
                  {solution.diagram.points.map((pt, idx) => {
                    if ((pt.name === "E" || pt.name === "T" || pt.label.toLowerCase().includes("intersection")) && !showExtensions) return null;
                    if (pt.name === "I" && !showIncircle) return null;
                    if (pt.name === "I_perp") return null;

                    const isHovered = hoveredPoint === pt.name;

                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoveredPoint(pt.name)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        className="cursor-pointer transition-all"
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 4}
                          fill={pt.color || "#38bdf8"}
                          filter={pt.highlight ? "url(#glow-cyan)" : undefined}
                          className="transition-all"
                        />
                        <text
                          x={pt.x + (pt.x > 140 ? 6 : -14)}
                          y={pt.y + (pt.y > 150 ? 12 : -6)}
                          fontSize="10"
                          fontWeight="bold"
                          fill={isLight ? "#0f172a" : "#f8fafc"}
                        >
                          {pt.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Compass className="w-10 h-10 stroke-[1.5] text-slate-600" />
                  <p className="text-xs">Diagram will appear here upon solving</p>
                </div>
              )}
            </div>

            {/* Diagram Legend Annotations */}
            {solution?.diagram?.annotations && (
              <div className="flex flex-wrap gap-2 pt-1">
                {solution.diagram.annotations.map((ann, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300"
                  >
                    • {ann}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Step-by-Step Multi-Part Solution & AI Teacher (55%) */}
        <div className="w-full lg:w-[55%] flex flex-col overflow-y-auto">
          {/* Sub-Question Navigation Tabs */}
          <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/40 border-white/10"}`}>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setSelectedPart("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedPart === "all"
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                  : isLight
                    ? "bg-white text-slate-600 hover:bg-slate-200"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
              >
                All Parts ({solution?.parts.length || 0})
              </button>

              {solution?.parts.map(p => (
                <button
                  key={p.part_id}
                  onClick={() => setSelectedPart(p.part_id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${selectedPart === p.part_id
                    ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                    : isLight
                      ? "bg-white text-slate-600 hover:bg-slate-200"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                >
                  <span className="uppercase">{p.part_id}.</span>
                  <span className="truncate max-w-[90px]">{p.title.replace(`Part ${p.part_id}:`, "")}</span>
                </button>
              ))}
            </div>

            {solution?.validation && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Valid Geometry
              </div>
            )}
          </div>

          {/* Solution Body */}
          <div className="flex-1 p-6 space-y-6">
            {/* Parts Cards */}
            {solution?.parts
              .filter(p => selectedPart === "all" || p.part_id === selectedPart)
              .map(part => (
                <div
                  key={part.part_id}
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${isLight
                    ? "bg-white border-slate-200 shadow-sm"
                    : "bg-slate-900/40 border-white/10 hover:border-cyan-500/30"
                    }`}
                >
                  {/* Part Header & Answer Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">
                        {part.title}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-200 mt-0.5">
                        {part.prompt}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleCopyLatex(part.answer_latex, part.part_id)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedPart === part.part_id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied LaTeX
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy LaTeX
                        </>
                      )}
                    </button>
                  </div>

                  {/* Highlighted Result Card */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-transparent border border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className={isLight ? "text-[10px] uppercase font-bold tracking-wider text-black-600" : "text-[10px] uppercase font-bold tracking-wider text-cyan-400"}>
                        Final Mathematical Result
                      </span>
                      <div className={isLight ? "text-base text-black-400 font-mono text-xs" : "text-base text-cyan-200 font-semibold mt-1"}>
                        <KatexMath math={part.answer_latex} block />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 max-w-xs text-right">
                      {part.answer_summary}
                    </p>
                  </div>

                  {/* Formal Two-Column Proof Table */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Formal Deductions & Theorems
                    </span>

                    <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 bg-white/[0.02] p-2.5 text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-6">Mathematical Claim & LaTeX</div>
                        <div className="col-span-5">Geometric Justification / Theorem</div>
                      </div>

                      {/* Steps */}
                      {part.steps.map(step => (
                        <div
                          key={step.step_num}
                          className={isLight ? "grid grid-cols-12 p-3 text-xs items-start hover:bg-cyan-500/[0.03] transition-colors" : "grid grid-cols-12 p-3 text-xs items-start hover:bg-cyan-500/[0.03] transition-colors"}
                        >
                          <div className={isLight ? "col-span-1 text-center font-mono text-black-400 font-semibold" : "col-span-1 text-center font-mono text-cyan-400 font-semibold"}>
                            {step.step_num}
                          </div>
                          <div className="col-span-6 pr-3 space-y-1">
                            <p className="text-slate-300 font-medium">{step.claim}</p>
                            <div className={isLight ? "text-black-200 font-mono text-xs overflow-x-auto py-1" : "text-cyan-200 font-mono text-xs overflow-x-auto py-1"}>
                              <KatexMath math={step.latex} />
                            </div>
                          </div>
                          <div className="col-span-5 pl-2 space-y-1 border-l border-white/5">
                            {step.theorem && (
                              <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                                {step.theorem}
                              </span>
                            )}
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {step.justification}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

            {/* AI Teacher Section ("Axiom AI Geometry Tutor") */}
            <div className={`p-6 rounded-2xl border transition-all space-y-4 ${isLight ? "bg-white border-slate-200" : "bg-gradient-to-br from-slate-900/90 to-cyan-950/20 border-cyan-500/20"
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Axiom AI Geometry Tutor</h3>
                    <p className="text-[11px] text-slate-400">Socratic guidance, theorem drilldowns & exam insights</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleSpeak(teacherChat[teacherChat.length - 1]?.text || "")}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                  title={isSpeaking ? "Mute Speech" : "Read Aloud"}
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4 text-cyan-400 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Socratic Quick Prompt Chips */}
              {solution?.teacher?.socratic_prompts && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {solution.teacher.socratic_prompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleAskTeacher(prompt)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-cyan-300 text-left transition-all"
                    >
                      💡 {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat Dialogue Stream */}
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                {teacherChat.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl text-xs leading-relaxed ${msg.sender === "teacher"
                      ? "bg-slate-900/80 border border-white/10 text-slate-200"
                      : "bg-cyan-500/15 border border-cyan-500/30 text-cyan-100 ml-8"
                      }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                      <span className="font-semibold text-cyan-400">
                        {msg.sender === "teacher" ? "Axiom (Tutor)" : "You (Student)"}
                      </span>
                      {msg.time && <span>{msg.time}</span>}
                    </div>
                    <div className="whitespace-pre-line">{msg.text}</div>
                  </div>
                ))}
              </div>

              {/* Student Query Input */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={studentQuery}
                  onChange={e => setStudentQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAskTeacher()}
                  placeholder="Ask a question about this geometry proof (e.g., 'Why is △EAB ∼ △EDC?')..."
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-slate-900 border border-white/10 text-slate-100 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={() => handleAskTeacher()}
                  disabled={isAskingTeacher || !studentQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Ask
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
