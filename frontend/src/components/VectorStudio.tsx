import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Layers,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Check,
  Copy,
  ZoomIn,
  ZoomOut,
  Send,
  Boxes,
  Compass,
  Maximize2
} from "lucide-react";
import { KatexMath } from "./Whiteboard";
import { ThemeType, VectorSolveResult, VectorPreset } from "../types";
import { BOARD_THEMES } from "./boards/themePalette";

interface VectorStudioProps {
  theme: ThemeType;
  initialU?: string;
  onSendToStudio?: (formula: string) => void;
}

export default function VectorStudio({
  theme,
  initialU = "[3, 4]",
  onSendToStudio
}: VectorStudioProps) {
  const [operation, setOperation] = useState<string>("details");
  const [uInput, setUInput] = useState<string>(initialU);
  const [vInput, setVInput] = useState<string>("[1, 2]");
  const [wInput, setWInput] = useState<string>("[0, 1, 1]");
  const [scalarC, setScalarC] = useState<number>(2.0);

  const [solution, setSolution] = useState<VectorSolveResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [presets, setPresets] = useState<VectorPreset[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [copiedLatex, setCopiedLatex] = useState<boolean>(false);

  const rawColors = BOARD_THEMES[theme] || BOARD_THEMES.darkAI;
  const colors = {
    ...rawColors,
    border: rawColors.cardBorder,
    canvasBg: rawColors.cardBg
  };
  const isLight = theme === "lightAcademic" || theme === "notebook";

  useEffect(() => {
    fetchPresets();
    handleSolve("details", initialU);
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/vector/presets");
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (e) {
      console.warn("Could not load vector presets:", e);
    }
  };

  const handleSolve = async (
    op: string = operation,
    uVal: string = uInput,
    vVal: string = vInput,
    wVal: string = wInput,
    cVal: number = scalarC
  ) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        operation: op,
        u: uVal
      };
      if (["add", "subtract", "dot", "angle", "projection", "cross", "plane_equation"].includes(op)) {
        payload.v = vVal;
      }
      if (["triple_product", "plane_equation"].includes(op)) {
        payload.w = wVal;
      }
      if (op === "scale") {
        payload.scalar_c = cVal;
      }

      const res = await fetch("http://localhost:4000/api/vector/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Vector calculation failed.");
      }

      const data: VectorSolveResult = await res.json();
      setSolution(data);
      
      // Auto-switch to 3D mode if 3D vector or cross product
      if (data.dimension === 3 || op === "cross" || op === "triple_product" || op === "plane_equation") {
        setIs3DMode(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to solve vector expression.");
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: VectorPreset) => {
    setOperation(preset.op);
    setUInput(preset.u);
    if (preset.v) setVInput(preset.v);
    if (preset.w) setWInput(preset.w);
    if (preset.scalar_c) setScalarC(preset.scalar_c);
    handleSolve(preset.op, preset.u, preset.v, preset.w, preset.scalar_c);
  };

  // Coordinate projection for 2D and 3D isometric SVG
  const svgSize = 400;
  const center = svgSize / 2;
  const scale = 32 * zoomLevel;

  // 2D projection
  const to2DX = (x: number) => center + x * scale;
  const to2DY = (y: number) => center - y * scale;

  // 3D Isometric projection: x goes down-left, y goes right, z goes straight up
  const to3DX = (x: number, y: number, z: number = 0) => {
    const isoAngle = Math.PI / 6; // 30 degrees
    return center + (y * Math.cos(isoAngle) - x * Math.cos(isoAngle)) * scale;
  };
  const to3DY = (x: number, y: number, z: number = 0) => {
    const isoAngle = Math.PI / 6;
    return center + (y * Math.sin(isoAngle) + x * Math.sin(isoAngle) - z) * scale;
  };

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: colors.canvasBg, color: colors.text }}
    >
      {/* Top Header / Mode Bar */}
      <header
        className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 backdrop-blur-md"
        style={{
          borderColor: colors.border,
          backgroundColor: isLight ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.75)"
        }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
            <Boxes className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Vectors & 3D Analytic Studio</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                2D / 3D Coordinate Geometry
              </span>
            </div>
            <p className="text-xs opacity-65">
              Dot and cross products, orthogonal projections, angles, planes & Bagrut 582 vectors
            </p>
          </div>
        </div>

        {/* Quick Presets Dropdown */}
        <div className="flex items-center gap-2">
          {presets.slice(0, 3).map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                borderColor: colors.border,
                backgroundColor: isLight ? "#f1f5f9" : "rgba(30,41,59,0.7)"
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Inputs & Parameters (38% width) */}
        <section
          className="w-full lg:w-[440px] border-r flex flex-col p-5 overflow-y-auto space-y-5"
          style={{ borderColor: colors.border }}
        >
          {/* Operation Selector Tabs */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-2 block">
              Vector Operation
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/40 border border-white/5">
              {[
                { id: "details", label: "Magnitude & Norm" },
                { id: "add", label: "Addition (u + v)" },
                { id: "subtract", label: "Subtraction (u - v)" },
                { id: "dot", label: "Dot Product & θ" },
                { id: "projection", label: "Projection (proj_v u)" },
                { id: "cross", label: "Cross Product (u × v)" },
                { id: "triple_product", label: "Triple Product (u · (v×w))" },
                { id: "plane_equation", label: "3D Plane Equation" }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => {
                    setOperation(btn.id);
                    handleSolve(btn.id, uInput, vInput, wInput);
                  }}
                  className={`text-xs font-medium py-2 px-2.5 rounded-lg transition-all duration-150 text-left truncate ${
                    operation === btn.id
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md font-semibold"
                      : "opacity-75 hover:opacity-100 hover:bg-white/5"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Vector u */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider opacity-75 flex justify-between">
              <span>Primary Vector (u)</span>
              <span className="opacity-60 lowercase font-mono">e.g. [1, 2, 3] or 2i - 3j + k</span>
            </label>
            <input
              type="text"
              value={uInput}
              onChange={(e) => setUInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSolve()}
              placeholder="[1, 2, 3]"
              className="w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500/50"
              style={{
                backgroundColor: isLight ? "#ffffff" : "rgba(15,23,42,0.6)",
                borderColor: colors.border
              }}
            />
          </div>

          {/* Secondary Vector v */}
          {["add", "subtract", "dot", "angle", "projection", "cross", "triple_product", "plane_equation"].includes(operation) && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider opacity-75 flex justify-between">
                <span>Secondary Vector (v)</span>
                <span className="opacity-60 lowercase font-mono">e.g. [3, -1, 2]</span>
              </label>
              <input
                type="text"
                value={vInput}
                onChange={(e) => setVInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSolve()}
                placeholder="[3, -1, 2]"
                className="w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500/50"
                style={{
                  backgroundColor: isLight ? "#ffffff" : "rgba(15,23,42,0.6)",
                  borderColor: colors.border
                }}
              />
            </div>
          )}

          {/* Tertiary Vector w or Point P0 */}
          {["triple_product", "plane_equation"].includes(operation) && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider opacity-75 flex justify-between">
                <span>{operation === "plane_equation" ? "Base Point P₀ on Plane" : "Third Vector (w)"}</span>
                <span className="opacity-60 lowercase font-mono">e.g. [1, 1, 1]</span>
              </label>
              <input
                type="text"
                value={wInput}
                onChange={(e) => setWInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSolve()}
                placeholder="[1, 1, 1]"
                className="w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500/50"
                style={{
                  backgroundColor: isLight ? "#ffffff" : "rgba(15,23,42,0.6)",
                  borderColor: colors.border
                }}
              />
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={() => handleSolve()}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            {loading ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Computing Vector Space...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Calculate & Render Vectors</span>
              </>
            )}
          </button>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <span className="font-bold">Error:</span> {errorMsg}
            </div>
          )}

          {/* Summary Card */}
          {solution?.primary && (
            <div
              className="p-4 rounded-xl border space-y-2.5 text-xs backdrop-blur-sm"
              style={{
                borderColor: colors.border,
                backgroundColor: isLight ? "#f8fafc" : "rgba(30,41,59,0.4)"
              }}
            >
              <div className="flex justify-between items-center font-bold text-emerald-400">
                <span>Vector Properties</span>
                <span>||u|| = {solution.primary.magnitude}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <span className="opacity-60 block">Dimension</span>
                  <span className="font-semibold text-sm">{solution.primary.dimension}D</span>
                </div>
                <div>
                  <span className="opacity-60 block">Unit Vector û</span>
                  <span className="font-semibold text-xs truncate block">{solution.primary.unit_form}</span>
                </div>
                {solution.dot_product !== undefined && (
                  <div>
                    <span className="opacity-60 block">Dot Product u · v</span>
                    <span className="font-semibold text-sm">{solution.dot_product}</span>
                  </div>
                )}
                {solution.angle_deg !== undefined && (
                  <div>
                    <span className="opacity-60 block">Included Angle θ</span>
                    <span className="font-semibold text-sm">{solution.angle_deg}°</span>
                  </div>
                )}
                {solution.parallelogram_area !== undefined && (
                  <div>
                    <span className="opacity-60 block">Parallelogram Area</span>
                    <span className="font-semibold text-sm">{solution.parallelogram_area}</span>
                  </div>
                )}
                {solution.volume !== undefined && (
                  <div>
                    <span className="opacity-60 block">Volume of Box</span>
                    <span className="font-semibold text-sm">{solution.volume}</span>
                  </div>
                )}
              </div>

              {onSendToStudio && (
                <button
                  onClick={() => onSendToStudio(solution.final_answer)}
                  className="w-full mt-2 py-2 px-3 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 flex items-center justify-center gap-1.5 transition-all text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Solution to Math Studio</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* Right Section: Interactive Vector Diagram & Mathematical Derivations */}
        <section className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          {/* Top Visualizer: Vector Canvas */}
          <div
            className="p-5 rounded-2xl border shadow-xl flex flex-col items-center justify-center relative overflow-hidden"
            style={{
              borderColor: colors.border,
              backgroundColor: isLight ? "#ffffff" : "rgba(15,23,42,0.7)"
            }}
          >
            {/* Canvas Header & Toggles */}
            <div className="w-full flex justify-between items-center mb-3 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wide uppercase text-emerald-400">
                  {is3DMode ? "3D Isometric Vector Space (ℝ³)" : "2D Cartesian Vector Plane (ℝ²)"}
                </span>
                <span className="opacity-60">Basis: î, ĵ{is3DMode ? ", k̂" : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIs3DMode(!is3DMode)}
                  className={`px-2.5 py-1 rounded-md border text-xs transition-all ${
                    is3DMode ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "opacity-60 border-white/10"
                  }`}
                >
                  {is3DMode ? "3D Mode" : "2D Mode"}
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                  className="p-1 rounded-md border border-white/10 hover:bg-white/5"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                  className="p-1 rounded-md border border-white/10 hover:bg-white/5"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="p-1 rounded-md border border-white/10 hover:bg-white/5"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* SVG Vector Canvas */}
            <div className="w-full flex justify-center py-2 select-none">
              <svg
                width={svgSize}
                height={svgSize}
                className="rounded-xl border border-white/10 transition-transform duration-200"
                style={{ backgroundColor: isLight ? "#f8fafc" : "#090d16" }}
              >
                <defs>
                  <marker id="arrow-emerald" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                  </marker>
                  <marker id="arrow-sky" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                  </marker>
                  <marker id="arrow-amber" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                  </marker>
                  <marker id="arrow-pink" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#ec4899" />
                  </marker>
                </defs>

                {/* 2D or 3D Axes */}
                {!is3DMode ? (
                  <>
                    {/* 2D Cartesian Axes */}
                    <line x1="0" y1={center} x2={svgSize} y2={center} stroke="#475569" strokeWidth="1.5" />
                    <line x1={center} y1="0" x2={center} y2={svgSize} stroke="#475569" strokeWidth="1.5" />
                    <text x={svgSize - 20} y={center - 8} fill="#94a3b8" fontSize="12" fontWeight="bold">X</text>
                    <text x={center + 8} y="20" fill="#94a3b8" fontSize="12" fontWeight="bold">Y</text>
                  </>
                ) : (
                  <>
                    {/* 3D Isometric Axes */}
                    {/* X axis (down-left) */}
                    <line x1={center} y1={center} x2={to3DX(5, 0, 0)} y2={to3DY(5, 0, 0)} stroke="#ef4444" strokeWidth="1.8" />
                    <text x={to3DX(5.2, 0, 0)} y={to3DY(5.2, 0, 0)} fill="#ef4444" fontSize="12" fontWeight="bold">X</text>

                    {/* Y axis (down-right) */}
                    <line x1={center} y1={center} x2={to3DX(0, 5, 0)} y2={to3DY(0, 5, 0)} stroke="#10b981" strokeWidth="1.8" />
                    <text x={to3DX(0, 5.2, 0)} y={to3DY(0, 5.2, 0)} fill="#10b981" fontSize="12" fontWeight="bold">Y</text>

                    {/* Z axis (straight up) */}
                    <line x1={center} y1={center} x2={to3DX(0, 0, 5)} y2={to3DY(0, 0, 5)} stroke="#38bdf8" strokeWidth="1.8" />
                    <text x={to3DX(0, 0, 5.2)} y={to3DY(0, 0, 5.2)} fill="#38bdf8" fontSize="12" fontWeight="bold">Z</text>
                  </>
                )}

                {/* Vectors Rendering */}
                {solution?.vectors?.map((vec, idx) => {
                  const colorsList = ["#10b981", "#38bdf8", "#f59e0b", "#ec4899", "#a855f7"];
                  const col = colorsList[idx % colorsList.length];
                  const c = vec.components;
                  const x = c[0] || 0;
                  const y = c[1] || 0;
                  const z = c[2] || 0;

                  const targetX = is3DMode ? to3DX(x, y, z) : to2DX(x);
                  const targetY = is3DMode ? to3DY(x, y, z) : to2DY(y);

                  return (
                    <g key={idx}>
                      <line
                        x1={center}
                        y1={center}
                        x2={targetX}
                        y2={targetY}
                        stroke={col}
                        strokeWidth="2.5"
                      />
                      <circle cx={targetX} cy={targetY} r="4.5" fill={col} filter="drop-shadow(0 0 6px currentColor)" />
                      <text
                        x={targetX + 8}
                        y={targetY - 8}
                        fill={col}
                        fontSize="12"
                        fontWeight="bold"
                        className="pointer-events-none"
                      >
                        {vec.label} ({c.map((v) => Math.round(v * 100) / 100).join(", ")})
                      </text>
                    </g>
                  );
                })}

                {/* Parallelogram Shade for Cross Product or Addition */}
                {(operation === "cross" || operation === "add") && solution?.vectors && solution.vectors.length >= 2 && (
                  (() => {
                    const uComp = solution.vectors[0].components;
                    const vComp = solution.vectors[1].components;
                    const p0 = [0, 0, 0];
                    const p1 = [uComp[0], uComp[1], uComp[2] || 0];
                    const p2 = [uComp[0] + vComp[0], uComp[1] + vComp[1], (uComp[2] || 0) + (vComp[2] || 0)];
                    const p3 = [vComp[0], vComp[1], vComp[2] || 0];

                    const pts = [p0, p1, p2, p3].map((p) =>
                      is3DMode ? `${to3DX(p[0], p[1], p[2])},${to3DY(p[0], p[1], p[2])}` : `${to2DX(p[0])},${to2DY(p[1])}`
                    );

                    return (
                      <polygon
                        points={pts.join(" ")}
                        fill="rgba(16, 185, 129, 0.12)"
                        stroke="#10b981"
                        strokeWidth="1.2"
                        strokeDasharray="4 4"
                      />
                    );
                  })()
                )}
              </svg>
            </div>
          </div>

          {/* Bottom Section: Step-by-Step Rigorous Mathematical Derivations */}
          <div
            className="p-5 rounded-2xl border shadow-xl space-y-4"
            style={{
              borderColor: colors.border,
              backgroundColor: isLight ? "#ffffff" : "rgba(15,23,42,0.7)"
            }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: colors.border }}>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Mathematical Proof & Component Breakdown</h3>
              </div>
              {solution && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(solution.final_answer);
                    setCopiedLatex(true);
                    setTimeout(() => setCopiedLatex(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all hover:bg-white/5"
                  style={{ borderColor: colors.border }}
                >
                  {copiedLatex ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLatex ? "Copied" : "Copy Solution"}</span>
                </button>
              )}
            </div>

            {/* Final Answer Banner */}
            {solution && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block mb-1">
                    Final Result
                  </span>
                  <div className="text-lg font-bold">
                    <KatexMath math={solution.final_answer} block={false} />
                  </div>
                </div>
              </div>
            )}

            {/* Step-by-Step Derivations */}
            <div className="space-y-3">
              {solution?.steps.map((st, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border transition-all hover:border-emerald-500/40"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: isLight ? "#f8fafc" : "rgba(30,41,59,0.3)"
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-emerald-400">{st.stepTitle}</span>
                  </div>
                  <div className="my-2 py-1 overflow-x-auto text-sm">
                    <KatexMath math={st.latex} block={true} />
                  </div>
                  <p className="text-xs opacity-75 leading-relaxed">{st.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
