import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { GraphData, ThemeType } from "../../types";
import { BOARD_THEMES } from "./themePalette";
import {
  TrendingUp,
  Sliders,
  RotateCcw,
  Sparkles,
  Layers,
  Activity,
  Maximize2
} from "lucide-react";

interface CalculusBoardProps {
  equationStr?: string;
  graphData?: GraphData;
  theme: ThemeType;
}

export default function CalculusBoard({
  equationStr = "",
  graphData,
  theme
}: CalculusBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isIntegral = useMemo(() => {
    return equationStr.toLowerCase().startsWith("integrate") || equationStr.includes("∫");
  }, [equationStr]);

  // Extract base integrand/function expression
  const fnExpr = useMemo(() => {
    let clean = equationStr.trim();
    if (clean.toLowerCase().startsWith("integrate")) {
      const match = clean.match(/integrate\((.*?)(?:,|$)/i);
      clean = match ? match[1] : clean.replace(/integrate\(/i, "").replace(/\)$/, "");
    } else if (clean.toLowerCase().startsWith("derive")) {
      const match = clean.match(/derive\((.*?)(?:,|$)/i);
      clean = match ? match[1] : clean.replace(/derive\(/i, "").replace(/\)$/, "");
    }
    return clean || graphData?.functionExpr || "x^2 - 4";
  }, [equationStr, graphData?.functionExpr]);

  // Calculus interactive parameters
  // For Integrals: bounds [a, b]
  const [boundA, setBoundA] = useState<number>(0);
  const [boundB, setBoundB] = useState<number>(3);
  const [riemannPartitions, setRiemannPartitions] = useState<number>(10);
  const [showRiemann, setShowRiemann] = useState<boolean>(true);
  const [riemannType, setRiemannType] = useState<"mid" | "left" | "right">("mid");

  // For Derivatives: tangent point x0
  const [pointX0, setPointX0] = useState<number>(1);
  const [showSecant, setShowSecant] = useState<boolean>(false);
  const [secantDelta, setSecantDelta] = useState<number>(1.5);
  const [showDerivativeCurve, setShowDerivativeCurve] = useState<boolean>(false);

  // Safe Math Function Evaluator
  const evaluateFn = useCallback(
    (xVal: number): number => {
      try {
        let sanitized = fnExpr
          .replace(/Math\./g, "")
          .replace(/\^/g, "**")
          .replace(/\bsin\b/g, "Math.sin")
          .replace(/\bcos\b/g, "Math.cos")
          .replace(/\btan\b/g, "Math.tan")
          .replace(/\bsqrt\b/g, "Math.sqrt")
          .replace(/\bexp\b/g, "Math.exp")
          .replace(/\bln\b/g, "Math.log");
        sanitized = sanitized.replace(/(\d)([a-zA-Z])/g, "$1*$2");
        const fn = new Function("x", `return ${sanitized};`);
        const val = fn(xVal);
        return isNaN(val) || !isFinite(val) ? 0 : val;
      } catch {
        return xVal * xVal - 4;
      }
    },
    [fnExpr]
  );

  // Numerical Derivative
  const evaluateDerivative = useCallback(
    (xVal: number): number => {
      const h = 0.0001;
      return (evaluateFn(xVal + h) - evaluateFn(xVal - h)) / (2 * h);
    },
    [evaluateFn]
  );

  // Calculate numerical Riemann Sum and Definite Integral
  const calcIntegral = useMemo(() => {
    const a = Math.min(boundA, boundB);
    const b = Math.max(boundA, boundB);
    const n = Math.max(1, riemannPartitions);
    const dx = (b - a) / n;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      let xSample = a + i * dx;
      if (riemannType === "left") xSample = a + i * dx;
      else if (riemannType === "right") xSample = a + (i + 1) * dx;
      else xSample = a + (i + 0.5) * dx;
      sum += evaluateFn(xSample) * dx;
    }

    // High accuracy Simpson's rule for benchmark
    const simpsonN = 100;
    const simpsonDx = (b - a) / simpsonN;
    let simpsonSum = evaluateFn(a) + evaluateFn(b);
    for (let i = 1; i < simpsonN; i++) {
      const x = a + i * simpsonDx;
      simpsonSum += evaluateFn(x) * (i % 2 === 0 ? 2 : 4);
    }
    const exact = (simpsonSum * simpsonDx) / 3;

    return {
      riemann: Math.round(sum * 1000) / 1000,
      exact: Math.round(exact * 1000) / 1000
    };
  }, [boundA, boundB, riemannPartitions, riemannType, evaluateFn]);

  // Main Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const colors = BOARD_THEMES[theme] || BOARD_THEMES.chalkboard;

    // Clear background
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const minX = -5;
    const maxX = 5;
    const minY = -6;
    const maxY = 6;

    const toScreenX = (x: number) => ((x - minX) / (maxX - minX)) * width;
    const toScreenY = (y: number) => height - ((y - minY) / (maxY - minY)) * height;
    const toMathX = (px: number) => minX + (px / width) * (maxX - minX);

    // Grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(minX); gx <= maxX; gx++) {
      const sx = toScreenX(gx);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }
    for (let gy = Math.ceil(minY); gy <= maxY; gy++) {
      const sy = toScreenY(gy);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // Axes
    const originX = toScreenX(0);
    const originY = toScreenY(0);
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // 1. INTEGRAL MODE: Shaded Area & Riemann Rectangles
    if (isIntegral) {
      const a = Math.min(boundA, boundB);
      const b = Math.max(boundA, boundB);

      // A. Smooth Area fill under curve
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(toScreenX(a), toScreenY(0));
      for (let px = toScreenX(a); px <= toScreenX(b); px += 2) {
        const xVal = toMathX(px);
        ctx.lineTo(px, toScreenY(evaluateFn(xVal)));
      }
      ctx.lineTo(toScreenX(b), toScreenY(0));
      ctx.closePath();
      ctx.fillStyle = `${colors.curve}26`;
      ctx.fill();
      ctx.restore();

      // B. Riemann Sum Rectangles
      if (showRiemann) {
        const n = riemannPartitions;
        const dx = (b - a) / n;
        for (let i = 0; i < n; i++) {
          const rx1 = a + i * dx;
          const rx2 = rx1 + dx;
          let rxSample = rx1 + dx / 2;
          if (riemannType === "left") rxSample = rx1;
          if (riemannType === "right") rxSample = rx2;

          const ry = evaluateFn(rxSample);

          const sx1 = toScreenX(rx1);
          const sx2 = toScreenX(rx2);
          const syTop = toScreenY(ry);
          const syBase = toScreenY(0);

          const rWidth = sx2 - sx1;
          const rHeight = syBase - syTop;

          ctx.fillStyle = ry >= 0 ? `${colors.accent}33` : `${colors.point}33`;
          ctx.fillRect(sx1, Math.min(syBase, syTop), rWidth, Math.abs(rHeight));
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx1, Math.min(syBase, syTop), rWidth, Math.abs(rHeight));
        }
      }

      // Vertical bounds markers (a and b)
      [
        { val: a, label: `a = ${a}` },
        { val: b, label: `b = ${b}` }
      ].forEach((bm) => {
        const sx = toScreenX(bm.val);
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = colors.secondaryCurve;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = colors.secondaryCurve;
        ctx.font = "bold 11px monospace";
        ctx.fillText(bm.label, sx + 4, 20);
      });
    }

    // 2. Function Curve f(x)
    ctx.beginPath();
    ctx.strokeStyle = colors.curve;
    ctx.lineWidth = 2.5;
    let isFirst = true;
    for (let px = 0; px <= width; px += 2) {
      const x = toMathX(px);
      const y = evaluateFn(x);
      const py = toScreenY(y);
      if (py >= -height && py <= height * 2) {
        if (isFirst) {
          ctx.moveTo(px, py);
          isFirst = false;
        } else {
          ctx.lineTo(px, py);
        }
      } else {
        isFirst = true;
      }
    }
    ctx.stroke();

    // 3. DERIVATIVE MODE: Tangent Line & Secant
    if (!isIntegral) {
      const x0 = pointX0;
      const y0 = evaluateFn(x0);
      const slope = evaluateDerivative(x0);

      // Tangent Line
      const span = 4;
      const tx1 = x0 - span;
      const ty1 = y0 - slope * span;
      const tx2 = x0 + span;
      const ty2 = y0 + slope * span;

      ctx.beginPath();
      ctx.strokeStyle = colors.secondaryCurve;
      ctx.lineWidth = 2;
      ctx.moveTo(toScreenX(tx1), toScreenY(ty1));
      ctx.lineTo(toScreenX(tx2), toScreenY(ty2));
      ctx.stroke();

      // Point P(x0, y0)
      const sx0 = toScreenX(x0);
      const sy0 = toScreenY(y0);
      ctx.beginPath();
      ctx.arc(sx0, sy0, 6, 0, Math.PI * 2);
      ctx.fillStyle = colors.point;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Secant Line
      if (showSecant) {
        const xSec = x0 + secantDelta;
        const ySec = evaluateFn(xSec);
        const secSlope = (ySec - y0) / secantDelta;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(toScreenX(x0 - 2), toScreenY(y0 - secSlope * 2));
        ctx.lineTo(toScreenX(xSec + 2), toScreenY(ySec + secSlope * 2));
        ctx.stroke();
        ctx.restore();

        // Secant second point
        const sxSec = toScreenX(xSec);
        const sySec = toScreenY(ySec);
        ctx.beginPath();
        ctx.arc(sxSec, sySec, 5, 0, Math.PI * 2);
        ctx.fillStyle = colors.accent;
        ctx.fill();
      }

      // Slope callout
      ctx.fillStyle = colors.secondaryCurve;
      ctx.font = "bold 11px monospace";
      ctx.fillText(`Slope f'(${x0}) = ${slope.toFixed(2)}`, sx0 + 12, sy0 - 12);
    }
  }, [
    isIntegral,
    boundA,
    boundB,
    riemannPartitions,
    showRiemann,
    riemannType,
    pointX0,
    showSecant,
    secantDelta,
    evaluateFn,
    evaluateDerivative,
    theme
  ]);

  const activeColors = BOARD_THEMES[theme] || BOARD_THEMES.chalkboard;

  return (
    <div
      className="flex flex-col h-full w-full rounded-2xl overflow-hidden border transition-all duration-300"
      style={{
        backgroundColor: activeColors.bg,
        borderColor: activeColors.cardBorder
      }}
    >
      {/* Top Toolbar */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 border-b backdrop-blur-md"
        style={{ borderColor: activeColors.cardBorder }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold"
            style={{
              backgroundColor: activeColors.cardBg,
              color: activeColors.curve,
              border: `1px solid ${activeColors.cardBorder}`
            }}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>
              {isIntegral ? `∫ [${boundA}, ${boundB}] (${fnExpr}) dx` : `d/dx [${fnExpr}]`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isIntegral ? (
            <>
              <button
                onClick={() => setShowRiemann(!showRiemann)}
                className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
                  showRiemann
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-white/5 text-white/60 hover:text-white border-white/10"
                }`}
              >
                <Layers className="w-3 h-3" />
                Riemann Rectangles
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowSecant(!showSecant)}
                className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
                  showSecant
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-white/5 text-white/60 hover:text-white border-white/10"
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                Secant Line
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 min-h-[280px] w-full overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Controls Drawer for Dynamic Parameters */}
      <div
        className="px-3.5 py-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{
          borderColor: activeColors.cardBorder,
          backgroundColor: activeColors.cardBg
        }}
      >
        {isIntegral ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-white/50 text-[10px]">Bound a:</span>
              <input
                type="range"
                min="-4"
                max="4"
                step="0.5"
                value={boundA}
                onChange={(e) => setBoundA(parseFloat(e.target.value))}
                className="w-16 accent-emerald-400 cursor-pointer"
              />
              <span className="text-white font-bold">{boundA}</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-white/50 text-[10px]">Bound b:</span>
              <input
                type="range"
                min="-4"
                max="4"
                step="0.5"
                value={boundB}
                onChange={(e) => setBoundB(parseFloat(e.target.value))}
                className="w-16 accent-emerald-400 cursor-pointer"
              />
              <span className="text-white font-bold">{boundB}</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-white/50 text-[10px]">n Partitions:</span>
              <input
                type="range"
                min="4"
                max="30"
                step="1"
                value={riemannPartitions}
                onChange={(e) => setRiemannPartitions(parseInt(e.target.value))}
                className="w-16 accent-cyan-400 cursor-pointer"
              />
              <span className="text-cyan-300 font-bold">{riemannPartitions}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-white/50 text-[10px]">Evaluate Point x₀:</span>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.2"
                value={pointX0}
                onChange={(e) => setPointX0(parseFloat(e.target.value))}
                className="w-24 accent-amber-400 cursor-pointer"
              />
              <span className="text-amber-300 font-bold">{pointX0}</span>
            </div>

            {showSecant && (
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-white/50 text-[10px]">Δx:</span>
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.2"
                  value={secantDelta}
                  onChange={(e) => setSecantDelta(parseFloat(e.target.value))}
                  className="w-20 accent-cyan-400 cursor-pointer"
                />
                <span className="text-cyan-300 font-bold">{secantDelta}</span>
              </div>
            )}
          </div>
        )}

        {/* Readout metric */}
        <div className="font-mono text-xs flex items-center gap-2">
          {isIntegral ? (
            <>
              <span className="text-white/60">Area:</span>
              <span className="text-emerald-400 font-bold">
                ∫ ≈ {calcIntegral.exact}
              </span>
            </>
          ) : (
            <>
              <span className="text-white/60">Slope m:</span>
              <span className="text-amber-400 font-bold">
                f'({pointX0}) = {evaluateDerivative(pointX0).toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
