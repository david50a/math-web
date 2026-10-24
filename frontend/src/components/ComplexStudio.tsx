import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Compass,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Check,
  Copy,
  ChevronRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Cpu,
  Layers,
  CircleDot,
  Send
} from "lucide-react";
import { KatexMath } from "./Whiteboard";
import { ThemeType, ComplexSolveResult, ComplexPreset } from "../types";
import { BOARD_THEMES } from "./boards/themePalette";

interface ComplexStudioProps {
  theme: ThemeType;
  initialZ?: string;
  onSendToStudio?: (formula: string) => void;
}

export default function ComplexStudio({
  theme,
  initialZ = "3 + 4i",
  onSendToStudio
}: ComplexStudioProps) {
  const [operation, setOperation] = useState<string>("details");
  const [z1Input, setZ1Input] = useState<string>(initialZ);
  const [z2Input, setZ2Input] = useState<string>("1 - 2i");
  const [powerN, setPowerN] = useState<number>(3);
  const [rootN, setRootN] = useState<number>(5);
  
  const [solution, setSolution] = useState<ComplexSolveResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [presets, setPresets] = useState<ComplexPreset[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showUnitCircle, setShowUnitCircle] = useState<boolean>(true);
  const [showConjugate, setShowConjugate] = useState<boolean>(true);
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
    handleSolve("details", initialZ);
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/complex/presets");
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (e) {
      console.warn("Could not load complex presets:", e);
    }
  };

  const handleSolve = async (
    op: string = operation,
    z1Val: string = z1Input,
    z2Val: string = z2Input,
    nVal?: number
  ) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        operation: op,
        z1: z1Val
      };
      if (["add", "subtract", "multiply", "divide", "distance"].includes(op)) {
        payload.z2 = z2Val;
      }
      if (op === "power") {
        payload.n = nVal !== undefined ? nVal : powerN;
      }
      if (op === "roots") {
        payload.n = nVal !== undefined ? nVal : rootN;
      }

      const res = await fetch("http://localhost:4000/api/complex/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Complex number calculation failed.");
      }

      const data = await res.json();
      setSolution(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to solve complex expression.");
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: ComplexPreset) => {
    setOperation(preset.op);
    setZ1Input(preset.z1);
    if (preset.z2) setZ2Input(preset.z2);
    if (preset.n) {
      if (preset.op === "roots") setRootN(preset.n);
      if (preset.op === "power") setPowerN(preset.n);
    }
    handleSolve(preset.op, preset.z1, preset.z2, preset.n);
  };

  // Coordinate conversion for SVG Argand plane (center at 200, 200)
  const svgSize = 400;
  const center = svgSize / 2;
  const scale = 36 * zoomLevel; // 1 unit = 36px * zoom

  const toSvgX = (real: number) => center + real * scale;
  const toSvgY = (imag: number) => center - imag * scale;

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: colors.canvasBg, color: colors.text }}
    >
      {/* Top Header / Mode Bar */}
      <header
        className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 backdrop-blur-md"
        style={{ borderColor: colors.border, backgroundColor: isLight ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.75)" }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Complex Numbers Studio</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                Argand Plane & Euler Form
              </span>
            </div>
            <p className="text-xs opacity-65">
              Interactive complex analysis, polar coordinates, De Moivre roots & algebraic operations
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
        {/* Left Interactive Editor & Controls (38% width) */}
        <section
          className="w-full lg:w-[440px] border-r flex flex-col p-5 overflow-y-auto space-y-5"
          style={{ borderColor: colors.border }}
        >
          {/* Operation Selector Tabs */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-2 block">
              Operation Mode
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/40 border border-white/5">
              {[
                { id: "details", label: "Polar & Modulus" },
                { id: "add", label: "Addition (z₁ + z₂)" },
                { id: "subtract", label: "Subtraction (z₁ - z₂)" },
                { id: "multiply", label: "Multiply (z₁ · z₂)" },
                { id: "divide", label: "Divide (z₁ / z₂)" },
                { id: "power", label: "Power (zⁿ)" },
                { id: "roots", label: "Roots (ⁿ√z)" },
                { id: "quadratic", label: "Quadratic (az²+bz+c)" }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => {
                    setOperation(btn.id);
                    handleSolve(btn.id, z1Input, z2Input);
                  }}
                  className={`text-xs font-medium py-2 px-2.5 rounded-lg transition-all duration-150 text-left truncate ${
                    operation === btn.id
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md font-semibold"
                      : "opacity-75 hover:opacity-100 hover:bg-white/5"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Input z1 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider opacity-75 flex justify-between">
              <span>{operation === "quadratic" ? "Quadratic Equation" : "Primary Complex Number (z₁)"}</span>
              <span className="opacity-60 lowercase font-mono">e.g. 3 + 4i, polar(2, pi/3)</span>
            </label>
            <input
              type="text"
              value={z1Input}
              onChange={(e) => setZ1Input(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSolve()}
              placeholder={operation === "quadratic" ? "z^2 - 4*z + 13 = 0" : "3 + 4i"}
              className="w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm outline-none transition-all focus:ring-2 focus:ring-cyan-500/50"
              style={{
                backgroundColor: isLight ? "#ffffff" : "rgba(15,23,42,0.6)",
                borderColor: colors.border
              }}
            />
          </div>

          {/* Secondary Input z2 if binary operation */}
          {["add", "subtract", "multiply", "divide", "distance"].includes(operation) && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider opacity-75 flex justify-between">
                <span>Secondary Complex Number (z₂)</span>
                <span className="opacity-60 lowercase font-mono">e.g. 1 - 2i, cis(pi/4)</span>
              </label>
              <input
                type="text"
                value={z2Input}
                onChange={(e) => setZ2Input(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSolve()}
                placeholder="1 - 2i"
                className="w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm outline-none transition-all focus:ring-2 focus:ring-cyan-500/50"
                style={{
                  backgroundColor: isLight ? "#ffffff" : "rgba(15,23,42,0.6)",
                  borderColor: colors.border
                }}
              />
            </div>
          )}

          {/* Power N selector */}
          {operation === "power" && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="uppercase tracking-wider opacity-75">Exponent Power (n)</span>
                <span className="font-mono text-cyan-400">n = {powerN}</span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                value={powerN}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setPowerN(val);
                  handleSolve("power", z1Input, z2Input, val);
                }}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          )}

          {/* Root N selector */}
          {operation === "roots" && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="uppercase tracking-wider opacity-75">Degree of Roots (n-gon)</span>
                <span className="font-mono text-cyan-400">{rootN} roots</span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                value={rootN}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setRootN(val);
                  handleSolve("roots", z1Input, z2Input, val);
                }}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={() => handleSolve()}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            {loading ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Computing Complex Field...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Calculate & Map to Argand Plane</span>
              </>
            )}
          </button>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <span className="font-bold">Error:</span> {errorMsg}
            </div>
          )}

          {/* Quick Stats Card */}
          {solution?.primary && (
            <div
              className="p-4 rounded-xl border space-y-2.5 text-xs backdrop-blur-sm"
              style={{
                borderColor: colors.border,
                backgroundColor: isLight ? "#f8fafc" : "rgba(30,41,59,0.4)"
              }}
            >
              <div className="flex justify-between items-center font-bold text-cyan-400">
                <span>Polar Properties of z₁</span>
                <span>|z₁| = {solution.primary.modulus}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <span className="opacity-60 block">Real Part Re(z)</span>
                  <span className="font-semibold text-sm">{solution.primary.real}</span>
                </div>
                <div>
                  <span className="opacity-60 block">Imag Part Im(z)</span>
                  <span className="font-semibold text-sm">{solution.primary.imag}i</span>
                </div>
                <div>
                  <span className="opacity-60 block">Argument (θ)</span>
                  <span className="font-semibold text-sm">{solution.primary.argument_deg}°</span>
                </div>
                <div>
                  <span className="opacity-60 block">Conjugate (z̄)</span>
                  <span className="font-semibold text-sm">{solution.primary.conjugate.cartesian_latex}</span>
                </div>
              </div>

              {onSendToStudio && (
                <button
                  onClick={() => onSendToStudio(solution.final_answer)}
                  className="w-full mt-2 py-2 px-3 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400 flex items-center justify-center gap-1.5 transition-all text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Solution to Math Studio</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* Right Section: Interactive Argand Diagram (Top) + Step-by-Step Derivation (Bottom) */}
        <section className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          {/* Top Visualizer: Argand Plane Canvas */}
          <div
            className="p-5 rounded-2xl border shadow-xl flex flex-col items-center justify-center relative overflow-hidden"
            style={{
              borderColor: colors.border,
              backgroundColor: isLight ? "#ffffff" : "rgba(15,23,42,0.7)"
            }}
          >
            {/* Diagram Controls */}
            <div className="w-full flex justify-between items-center mb-3 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wide uppercase text-cyan-400">Argand Plane (Complex Field ℂ)</span>
                <span className="opacity-60">Re (Horizontal) vs Im (Vertical)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUnitCircle(!showUnitCircle)}
                  className={`px-2.5 py-1 rounded-md border text-xs transition-all ${
                    showUnitCircle ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" : "opacity-60 border-white/10"
                  }`}
                >
                  Unit Circle
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

            {/* SVG Complex Plane Canvas */}
            <div className="w-full flex justify-center py-2 select-none">
              <svg
                width={svgSize}
                height={svgSize}
                className="rounded-xl border border-white/10 transition-transform duration-200"
                style={{ backgroundColor: isLight ? "#f8fafc" : "#090d16" }}
              >
                <defs>
                  <marker
                    id="arrow-cyan"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                  </marker>
                  <marker
                    id="arrow-pink"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#ec4899" />
                  </marker>
                  <marker
                    id="arrow-green"
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

                {/* Grid Lines */}
                {[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map((val) => (
                  <g key={val} opacity="0.15">
                    <line
                      x1={center + val * scale}
                      y1="0"
                      x2={center + val * scale}
                      y2={svgSize}
                      stroke="currentColor"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="0"
                      y1={center - val * scale}
                      x2={svgSize}
                      y2={center - val * scale}
                      stroke="currentColor"
                      strokeDasharray="2 2"
                    />
                  </g>
                ))}

                {/* Primary Axes */}
                <line x1="0" y1={center} x2={svgSize} y2={center} stroke="#64748b" strokeWidth="1.8" />
                <line x1={center} y1="0" x2={center} y2={svgSize} stroke="#64748b" strokeWidth="1.8" />

                {/* Axis Labels */}
                <text x={svgSize - 24} y={center - 8} fill="#94a3b8" fontSize="12" fontWeight="bold">
                  Re
                </text>
                <text x={center + 8} y="20" fill="#94a3b8" fontSize="12" fontWeight="bold">
                  Im (i)
                </text>

                {/* Unit Circle (r = 1) */}
                {showUnitCircle && (
                  <circle
                    cx={center}
                    cy={center}
                    r={scale}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    opacity="0.3"
                  />
                )}

                {/* Roots Polygon if operation is roots */}
                {operation === "roots" && solution?.roots && solution.roots.length > 2 && (
                  <polygon
                    points={solution.roots.map((r) => `${toSvgX(r.real)},${toSvgY(r.imag)}`).join(" ")}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                )}

                {/* Circle for Root radius */}
                {operation === "roots" && solution?.root_radius && (
                  <circle
                    cx={center}
                    cy={center}
                    r={solution.root_radius * scale}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.5"
                  />
                )}

                {/* Plot Vectors & Points from solution */}
                {solution?.plot_points?.map((pt, idx) => {
                  const sx = toSvgX(pt.real);
                  const sy = toSvgY(pt.imag);
                  const color = pt.color || "#38bdf8";

                  return (
                    <g key={idx}>
                      {/* Vector Arrow from origin to point */}
                      <line
                        x1={center}
                        y1={center}
                        x2={sx}
                        y2={sy}
                        stroke={color}
                        strokeWidth="2.2"
                      />
                      {/* Point node */}
                      <circle cx={sx} cy={sy} r="5" fill={color} filter="drop-shadow(0 0 6px rgba(56,189,248,0.5))" />
                      <text
                        x={sx + 8}
                        y={sy - 8}
                        fill={color}
                        fontSize="12"
                        fontWeight="bold"
                        className="pointer-events-none"
                      >
                        {pt.label} ({pt.real}, {pt.imag}i)
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Bottom Section: Step-by-Step Rigorous Mathematical Derivation */}
          <div
            className="p-5 rounded-2xl border shadow-xl space-y-4"
            style={{
              borderColor: colors.border,
              backgroundColor: isLight ? "#ffffff" : "rgba(15,23,42,0.7)"
            }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: colors.border }}>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-base">Mathematical Proof & Step-by-Step Derivation</h3>
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
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent border border-cyan-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider text-cyan-400 font-bold block mb-1">
                    Final Result
                  </span>
                  <div className="text-lg font-bold">
                    <KatexMath math={solution.final_answer} block={false} />
                  </div>
                </div>
              </div>
            )}

            {/* Individual Steps */}
            <div className="space-y-3">
              {solution?.steps.map((st, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border transition-all hover:border-cyan-500/40"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: isLight ? "#f8fafc" : "rgba(30,41,59,0.3)"
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-cyan-400">{st.stepTitle}</span>
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
