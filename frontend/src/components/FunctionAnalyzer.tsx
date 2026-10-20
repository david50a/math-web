import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ThemeType, FunctionAnalysisResult, FunctionExtremum, FunctionRoot, FunctionInflection } from "../types";
import { BOARD_THEMES } from "./boards/themePalette";
import { KatexMath } from "./Whiteboard";
import {
  TrendingUp,
  Activity,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Sliders,
  Table,
  BookOpen,
  Split,
  Crosshair,
  Compass,
  CornerDownRight,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";

interface FunctionAnalyzerProps {
  theme: ThemeType;
  initialFunction?: string;
  onSendToStudio?: (expr: string) => void;
}

const PRESET_FUNCTIONS = [
  { name: "Cubic Extrema", expr: "x^3 - 3*x^2 + 2", desc: "Local max at (0,2), local min at (2,-2), inflection at (1,0)" },
  { name: "Double Well (W-Curve)", expr: "x^4 - 4*x^2", desc: "Two symmetric minima and one local maximum at origin" },
  { name: "Rational with Asymptotes", expr: "(x^2 - 1)/(x - 2)", desc: "Vertical asymptote at x=2 and oblique slant asymptote y=x+2" },
  { name: "Trig Wave Complex", expr: "sin(x) + 0.5*cos(2*x)", desc: "Harmonic superposition with multiple oscillatory peaks" },
  { name: "Gaussian Wave Packet", expr: "x * exp(-x^2)", desc: "Odd symmetry, peak at x=1/√2, asymptotic to zero" },
  { name: "Runge Rational Curve", expr: "(2*x)/(x^2 + 1)", desc: "Bounded smooth rational with global max at (1,1)" },
  { name: "Damped Sine Wave", expr: "exp(-0.2*x) * sin(2*x)", desc: "Physics oscillator decay with alternating extrema" },
  { name: "Logarithmic Curve", expr: "ln(x^2 + 1) - 0.5*x", desc: "Smooth transcendental function with inflection" }
];

export default function FunctionAnalyzer({
  theme,
  initialFunction = "x^3 - 3*x^2 + 2",
  onSendToStudio
}: FunctionAnalyzerProps) {
  const [funcInput, setFuncInput] = useState<string>(initialFunction);
  const [activeFunc, setActiveFunc] = useState<string>(initialFunction);
  const [analysis, setAnalysis] = useState<FunctionAnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active detail tab
  const [activeTab, setActiveTab] = useState<"calculus" | "algebra" | "integral" | "steps" | "table">("calculus");

  // Canvas Viewport & Camera
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewPort, setViewPort] = useState({ minX: -6, maxX: 6, minY: -5, maxY: 5 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);

  // Canvas Layer Visibility Toggles
  const [showDerivative, setShowDerivative] = useState<boolean>(false);
  const [showSecondDerivative, setShowSecondDerivative] = useState<boolean>(false);
  const [showTangent, setShowTangent] = useState<boolean>(true);
  const [showExtremaPoints, setShowExtremaPoints] = useState<boolean>(true);
  const [showRoots, setShowRoots] = useState<boolean>(true);
  const [showInflection, setShowInflection] = useState<boolean>(true);
  const [showAsymptotes, setShowAsymptotes] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showArea, setShowArea] = useState<boolean>(false);

  // Definite Integral bounds for interactive shading
  const [intBoundA, setIntBoundA] = useState<number>(-1);
  const [intBoundB, setIntBoundB] = useState<number>(2);
  const [riemannN, setRiemannN] = useState<number>(12);
  const [showRiemannBars, setShowRiemannBars] = useState<boolean>(false);

  // Table generation range
  const [tableStep, setTableStep] = useState<number>(0.5);

  // Step Category Filter & Accordion toggles
  const [stepCategoryFilter, setStepCategoryFilter] = useState<string>("all");
  const [showDerivSteps, setShowDerivSteps] = useState<boolean>(false);
  const [showCritSteps, setShowCritSteps] = useState<boolean>(false);
  const [showRootsSteps, setShowRootsSteps] = useState<boolean>(false);
  const [showIntegralSteps, setShowIntegralSteps] = useState<boolean>(false);

  const colors = BOARD_THEMES[theme] || BOARD_THEMES.darkAI;
  const isLight = theme === "lightAcademic" || theme === "notebook";
  const isChalkboard = theme === "chalkboard";

  // Safe numerical function evaluator
  const evaluateFn = useCallback(
    (xVal: number, exprStr: string = activeFunc): number => {
      try {
        let sanitized = exprStr
          .replace(/Math\./g, "")
          .replace(/\^/g, "**")
          .replace(/\bsin\b/g, "Math.sin")
          .replace(/\bcos\b/g, "Math.cos")
          .replace(/\btan\b/g, "Math.tan")
          .replace(/\bsqrt\b/g, "Math.sqrt")
          .replace(/\bexp\b/g, "Math.exp")
          .replace(/\bln\b/g, "Math.log")
          .replace(/\blog\b/g, "Math.log")
          .replace(/\babs\b/g, "Math.abs")
          .replace(/\bpi\b/g, "Math.PI")
          .replace(/\be\b/g, "Math.E");
        sanitized = sanitized.replace(/(\d)([a-zA-Z\(])/g, "$1*$2");
        sanitized = sanitized.replace(/(\))([a-zA-Z0-9\(])/g, "$1*$2");
        const fn = new Function("x", `return ${sanitized};`);
        const val = fn(xVal);
        return isNaN(val) || !isFinite(val) ? NaN : val;
      } catch {
        return NaN;
      }
    },
    [activeFunc]
  );

  // Numerical derivatives
  const evaluateDeriv = useCallback(
    (xVal: number): number => {
      const h = 0.0001;
      const fPlus = evaluateFn(xVal + h);
      const fMinus = evaluateFn(xVal - h);
      if (isNaN(fPlus) || isNaN(fMinus)) return NaN;
      return (fPlus - fMinus) / (2 * h);
    },
    [evaluateFn]
  );

  const evaluateSecondDeriv = useCallback(
    (xVal: number): number => {
      const h = 0.001;
      const fMid = evaluateFn(xVal);
      const fPlus = evaluateFn(xVal + h);
      const fMinus = evaluateFn(xVal - h);
      if (isNaN(fMid) || isNaN(fPlus) || isNaN(fMinus)) return NaN;
      return (fPlus - 2 * fMid + fMinus) / (h * h);
    },
    [evaluateFn]
  );

  // Fetch full symbolic analysis from Backend
  const runAnalysis = async (expr: string) => {
    if (!expr || !expr.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setActiveFunc(expr);

    try {
      const res = await fetch("/api/function/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: expr,
          domain_min: viewPort.minX,
          domain_max: viewPort.maxX
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to analyze function");
      }

      const data: FunctionAnalysisResult = await res.json();
      setAnalysis(data);

      // Auto-adjust viewport if extrema or roots are outside
      if (data.extrema.length > 0 || data.roots.length > 0) {
        let allX = [...data.extrema.map((e) => e.x), ...data.roots.map((r) => r.x)];
        let allY = data.extrema.map((e) => e.y);
        if (allX.length > 0 && allY.length > 0) {
          const minX = Math.min(-5, ...allX) - 2;
          const maxX = Math.max(5, ...allX) + 2;
          const minY = Math.min(-4, ...allY) - 2;
          const maxY = Math.max(4, ...allY) + 2;
          setViewPort({
            minX: Math.max(-30, Math.floor(minX)),
            maxX: Math.min(30, Math.ceil(maxX)),
            minY: Math.max(-30, Math.floor(minY)),
            maxY: Math.min(30, Math.ceil(maxY))
          });
        }
      }
    } catch (err: any) {
      console.warn("Backend analysis error, falling back to local analysis:", err.message);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run on mount
  useEffect(() => {
    runAnalysis(initialFunction);
  }, []);

  // Canvas Drawing Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const { minX, maxX, minY, maxY } = viewPort;
    const toCanvasX = (x: number) => ((x - minX) / (maxX - minX)) * width;
    const toCanvasY = (y: number) => height - ((y - minY) / (maxY - minY)) * height;

    // Background
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    // 1. Grid Lines
    if (showGrid) {
      const stepX = (maxX - minX) > 20 ? 5 : (maxX - minX) > 10 ? 2 : 1;
      const stepY = (maxY - minY) > 20 ? 5 : (maxY - minY) > 10 ? 2 : 1;

      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.grid;

      for (let x = Math.ceil(minX / stepX) * stepX; x <= maxX; x += stepX) {
        if (Math.abs(x) < 0.0001) continue;
        const cx = toCanvasX(x);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();

        ctx.fillStyle = colors.textMuted;
        ctx.font = "9px monospace";
        ctx.fillText(x.toString(), cx + 3, toCanvasY(0) + 12);
      }

      for (let y = Math.ceil(minY / stepY) * stepY; y <= maxY; y += stepY) {
        if (Math.abs(y) < 0.0001) continue;
        const cy = toCanvasY(y);
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.stroke();

        ctx.fillStyle = colors.textMuted;
        ctx.font = "9px monospace";
        ctx.fillText(y.toString(), toCanvasX(0) + 5, cy - 3);
      }
    }

    // 2. Axes
    const originX = toCanvasX(0);
    const originY = toCanvasY(0);

    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 2;

    // X Axis
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Y Axis
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Axis Arrows
    ctx.fillStyle = colors.axis;
    ctx.beginPath();
    ctx.moveTo(width - 8, originY - 4);
    ctx.lineTo(width, originY);
    ctx.lineTo(width - 8, originY + 4);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(originX - 4, 8);
    ctx.lineTo(originX, 0);
    ctx.lineTo(originX + 4, 8);
    ctx.fill();

    // Axis labels
    ctx.fillStyle = colors.text;
    ctx.font = "bold 11px monospace";
    ctx.fillText("x", width - 14, originY - 8);
    ctx.fillText("y", originX + 8, 14);

    // 3. Shaded Definite Integral Area & Riemann Rectangles
    if (showArea) {
      const a = Math.min(intBoundA, intBoundB);
      const b = Math.max(intBoundA, intBoundB);

      // Smooth area fill
      ctx.fillStyle = isLight ? "rgba(37, 99, 235, 0.15)" : "rgba(56, 189, 248, 0.2)";
      ctx.beginPath();
      ctx.moveTo(toCanvasX(a), originY);

      const areaSteps = 150;
      const areaDx = (b - a) / areaSteps;
      for (let i = 0; i <= areaSteps; i++) {
        const xVal = a + i * areaDx;
        const yVal = evaluateFn(xVal);
        if (!isNaN(yVal)) {
          ctx.lineTo(toCanvasX(xVal), toCanvasY(yVal));
        }
      }
      ctx.lineTo(toCanvasX(b), originY);
      ctx.closePath();
      ctx.fill();

      // Riemann Rectangles overlay
      if (showRiemannBars && riemannN > 0) {
        const rDx = (b - a) / riemannN;
        for (let i = 0; i < riemannN; i++) {
          const rx = a + i * rDx;
          const rMid = rx + rDx * 0.5;
          const ry = evaluateFn(rMid);
          if (!isNaN(ry)) {
            const rx1 = toCanvasX(rx);
            const rx2 = toCanvasX(rx + rDx);
            const ryTop = toCanvasY(ry);
            const rw = rx2 - rx1;
            const rh = originY - ryTop;

            ctx.fillStyle = isLight ? "rgba(124, 58, 237, 0.2)" : "rgba(168, 85, 247, 0.25)";
            ctx.fillRect(rx1, ryTop, rw, rh);
            ctx.strokeStyle = isLight ? "rgba(124, 58, 237, 0.7)" : "rgba(168, 85, 247, 0.8)";
            ctx.lineWidth = 1;
            ctx.strokeRect(rx1, ryTop, rw, rh);
          }
        }
      }

      // Bound boundary lines
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(toCanvasX(a), 0);
      ctx.lineTo(toCanvasX(a), height);
      ctx.moveTo(toCanvasX(b), 0);
      ctx.lineTo(toCanvasX(b), height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Asymptotes (Dashed Lines)
    if (showAsymptotes && analysis?.asymptotes) {
      ctx.setLineDash([5, 5]);

      // Vertical Asymptotes (red/amber dashed)
      analysis.asymptotes.vertical.forEach((va) => {
        const cx = toCanvasX(va.x);
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();

        ctx.fillStyle = "#f43f5e";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`x = ${va.x}`, cx + 4, 25);
      });

      // Horizontal Asymptotes (blue dashed)
      analysis.asymptotes.horizontal.forEach((ha) => {
        const cy = toCanvasY(ha.y);
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.stroke();

        ctx.fillStyle = "#06b6d4";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`y = ${ha.y}`, 10, cy - 4);
      });

      // Oblique Asymptotes (yellow dashed)
      analysis.asymptotes.oblique.forEach((oa) => {
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const yStart = oa.m * minX + oa.b;
        const yEnd = oa.m * maxX + oa.b;
        ctx.moveTo(toCanvasX(minX), toCanvasY(yStart));
        ctx.lineTo(toCanvasX(maxX), toCanvasY(yEnd));
        ctx.stroke();

        ctx.fillStyle = "#facc15";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`y = ${oa.m}x + ${oa.b}`, toCanvasX(1), toCanvasY(oa.m * 1 + oa.b) - 8);
      });

      ctx.setLineDash([]);
    }

    // Helper to draw a continuous curve with asymptote jump breaking
    const drawCurve = (fn: (x: number) => number, strokeColor: string, lineWidth: number, isGlow: boolean = false) => {
      ctx.save();
      if (isGlow) {
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 8;
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      const numSamples = width * 1.5;
      const dx = (maxX - minX) / numSamples;
      let isDrawing = false;
      let lastY = 0;

      for (let i = 0; i <= numSamples; i++) {
        const xVal = minX + i * dx;
        const yVal = fn(xVal);

        if (isNaN(yVal) || !isFinite(yVal) || Math.abs(yVal) > 200 || (isDrawing && Math.abs(yVal - lastY) > (maxY - minY) * 1.5)) {
          isDrawing = false;
          continue;
        }

        const cx = toCanvasX(xVal);
        const cy = toCanvasY(yVal);

        if (!isDrawing) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          isDrawing = true;
        } else {
          ctx.lineTo(cx, cy);
        }
        lastY = yVal;
      }
      ctx.stroke();
      ctx.restore();
    };

    // 5. Draw Second Derivative Curve f''(x)
    if (showSecondDerivative) {
      drawCurve(evaluateSecondDeriv, isLight ? "#9333ea" : "#c084fc", 1.8);
    }

    // 6. Draw First Derivative Curve f'(x)
    if (showDerivative) {
      drawCurve(evaluateDeriv, isLight ? "#0d9488" : "#2dd4bf", 2.0);
    }

    // 7. Draw Main Function f(x)
    drawCurve(evaluateFn, colors.curve, 3.0, !isLight);

    // 8. Tangent Line at mouse hover
    if (showTangent && hoverCoord) {
      const x0 = hoverCoord.x;
      const y0 = evaluateFn(x0);
      const slope = evaluateDeriv(x0);

      if (!isNaN(y0) && !isNaN(slope)) {
        const tanSpan = (maxX - minX) * 0.25;
        const x1 = x0 - tanSpan;
        const y1 = y0 - slope * tanSpan;
        const x2 = x0 + tanSpan;
        const y2 = y0 + slope * tanSpan;

        ctx.strokeStyle = "#e11d48";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(x1), toCanvasY(y1));
        ctx.lineTo(toCanvasX(x2), toCanvasY(y2));
        ctx.stroke();
        ctx.setLineDash([]);

        // Tangent Contact Point
        ctx.fillStyle = "#e11d48";
        ctx.beginPath();
        ctx.arc(toCanvasX(x0), toCanvasY(y0), 5, 0, Math.PI * 2);
        ctx.fill();

        // Tangent slope badge
        ctx.fillStyle = isLight ? "#1e293b" : "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`Slope f'(${x0.toFixed(2)}) = ${slope.toFixed(2)}`, toCanvasX(x0) + 8, toCanvasY(y0) - 8);
      }
    }

    // 9. Critical Points & Extrema Markers (Local Max & Min)
    if (showExtremaPoints && analysis?.extrema) {
      analysis.extrema.forEach((ext) => {
        if (ext.x < minX || ext.x > maxX || ext.y < minY || ext.y > maxY) return;
        const cx = toCanvasX(ext.x);
        const cy = toCanvasY(ext.y);
        const isMax = ext.type === "local_max";

        // Glow ring
        ctx.save();
        ctx.fillStyle = isMax ? "#22c55e" : "#3b82f6";
        ctx.shadowColor = isMax ? "#22c55e" : "#3b82f6";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        // White inner pip
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Label pill
        const label = `${isMax ? "▲ Max" : "▼ Min"}: (${ext.x}, ${ext.y})`;
        ctx.font = "bold 10px monospace";
        const textWidth = ctx.measureText(label).width;
        const padX = 5;
        const pillY = isMax ? cy - 22 : cy + 12;

        ctx.fillStyle = isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 23, 42, 0.85)";
        ctx.strokeStyle = isMax ? "#22c55e" : "#3b82f6";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - textWidth / 2 - padX, pillY - 10, textWidth + padX * 2, 17, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isMax ? "#16a34a" : "#2563eb";
        ctx.fillText(label, cx - textWidth / 2, pillY + 2);
      });
    }

    // 10. Roots / Zeros Markers (f(x) = 0)
    if (showRoots && analysis?.roots) {
      analysis.roots.forEach((rt) => {
        if (rt.x < minX || rt.x > maxX) return;
        const cx = toCanvasX(rt.x);
        const cy = toCanvasY(0);

        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 9px monospace";
        ctx.fillText(`x=${rt.x}`, cx - 12, cy + 14);
      });
    }

    // 11. Y-Intercept
    if (analysis?.y_intercept) {
      const y0 = analysis.y_intercept.y;
      if (y0 >= minY && y0 <= maxY) {
        const cx = toCanvasX(0);
        const cy = toCanvasY(y0);
        ctx.fillStyle = "#a855f7";
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#a855f7";
        ctx.font = "bold 9px monospace";
        ctx.fillText(`(0, ${y0})`, cx + 8, cy - 2);
      }
    }

    // 12. Inflection Points Markers (f''(x) = 0)
    if (showInflection && analysis?.inflection_points) {
      analysis.inflection_points.forEach((inf) => {
        if (inf.x < minX || inf.x > maxX || inf.y < minY || inf.y > maxY) return;
        const cx = toCanvasX(inf.x);
        const cy = toCanvasY(inf.y);

        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 9px monospace";
        ctx.fillText(`Inflection (${inf.x}, ${inf.y})`, cx + 7, cy + 3);
      });
    }
  }, [
    viewPort,
    activeFunc,
    analysis,
    showDerivative,
    showSecondDerivative,
    showTangent,
    showExtremaPoints,
    showRoots,
    showInflection,
    showAsymptotes,
    showGrid,
    showArea,
    intBoundA,
    intBoundB,
    riemannN,
    showRiemannBars,
    hoverCoord,
    colors,
    isLight
  ]);

  // Mouse pan & zoom handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const mathX = viewPort.minX + (px / rect.width) * (viewPort.maxX - viewPort.minX);
    const mathY = viewPort.maxY - (py / rect.height) * (viewPort.maxY - viewPort.minY);
    setHoverCoord({ x: parseFloat(mathX.toFixed(3)), y: parseFloat(mathY.toFixed(3)) });

    if (isDragging && dragStart) {
      const dxPix = e.clientX - dragStart.x;
      const dyPix = e.clientY - dragStart.y;
      const scaleX = (viewPort.maxX - viewPort.minX) / rect.width;
      const scaleY = (viewPort.maxY - viewPort.minY) / rect.height;

      setViewPort((prev) => ({
        minX: prev.minX - dxPix * scaleX,
        maxX: prev.maxX - dxPix * scaleX,
        minY: prev.minY + dyPix * scaleY,
        maxY: prev.maxY + dyPix * scaleY
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.85 : 1.15;
    zoom(factor);
  };

  const zoom = (factor: number) => {
    setViewPort((prev) => {
      const midX = (prev.minX + prev.maxX) / 2;
      const midY = (prev.minY + prev.maxY) / 2;
      const spanX = ((prev.maxX - prev.minX) * factor) / 2;
      const spanY = ((prev.maxY - prev.minY) * factor) / 2;
      return {
        minX: midX - spanX,
        maxX: midX + spanX,
        minY: midY - spanY,
        maxY: midY + spanY
      };
    });
  };

  const resetView = () => {
    setViewPort({ minX: -6, maxX: 6, minY: -5, maxY: 5 });
  };

  // Definite integral numerical calculation (Simpson's 3/8 Rule)
  const exactDefiniteIntegral = useMemo(() => {
    const a = Math.min(intBoundA, intBoundB);
    const b = Math.max(intBoundA, intBoundB);
    const n = 200;
    const dx = (b - a) / n;
    let sum = evaluateFn(a) + evaluateFn(b);
    for (let i = 1; i < n; i++) {
      const x = a + i * dx;
      sum += evaluateFn(x) * (i % 2 === 0 ? 2 : 4);
    }
    const res = (sum * dx) / 3;
    return isNaN(res) ? 0 : Math.round(res * 1000) / 1000;
  }, [intBoundA, intBoundB, evaluateFn]);

  // Riemann Sum approximation
  const riemannSumValue = useMemo(() => {
    const a = Math.min(intBoundA, intBoundB);
    const b = Math.max(intBoundA, intBoundB);
    const n = Math.max(1, riemannN);
    const dx = (b - a) / n;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const xMid = a + (i + 0.5) * dx;
      const y = evaluateFn(xMid);
      if (!isNaN(y)) sum += y * dx;
    }
    return Math.round(sum * 1000) / 1000;
  }, [intBoundA, intBoundB, riemannN, evaluateFn]);

  // Dynamic Value Table rows
  const tableRows = useMemo(() => {
    const rows = [];
    const min = -5;
    const max = 5;
    const step = Math.max(0.1, tableStep);
    for (let x = min; x <= max + 0.001; x += step) {
      const xRound = Math.round(x * 100) / 100;
      const y = evaluateFn(xRound);
      const dy = evaluateDeriv(xRound);
      const d2y = evaluateSecondDeriv(xRound);
      rows.push({
        x: xRound,
        y: isNaN(y) ? "Undef" : y.toFixed(3),
        dy: isNaN(dy) ? "Undef" : dy.toFixed(3),
        d2y: isNaN(d2y) ? "Undef" : d2y.toFixed(3)
      });
    }
    return rows;
  }, [evaluateFn, evaluateDeriv, evaluateSecondDeriv, tableStep]);

  return (
    <div className={`flex-1 flex flex-col w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-6 ${colors.text}`}>
      {/* 1. Header & Function Search Bar */}
      <div className={`p-5 sm:p-7 rounded-2xl border transition-all ${
        isChalkboard
          ? "bg-[#0b1712] border-amber-900/40 text-amber-100 shadow-xl"
          : isLight
          ? "bg-white border-slate-200 text-slate-900 shadow-sm"
          : "bg-slate-900/60 border-slate-800 text-white backdrop-blur-xl shadow-2xl"
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg ${
              isChalkboard
                ? "bg-[#182c21] border border-amber-500/50 text-amber-300"
                : isLight
                ? "bg-blue-600 text-white"
                : "bg-gradient-to-br from-indigo-500 to-cyan-400 text-white"
            }`}>
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Function Analyzer Studio</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold bg-blue-500/10 text-blue-400 border-blue-500/20">
                  Full Curve Analysis
                </span>
              </div>
              <p className={`text-xs mt-0.5 opacity-70 ${isChalkboard ? "text-amber-200/70" : ""}`}>
                Enter any real function f(x) to instantly compute Extrema (Max/Min), Derivatives, Integrals, Roots, Concavity, and Asymptotes.
              </p>
            </div>
          </div>

          {/* Preset Function Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setFuncInput(val);
                    runAnalysis(val);
                  }
                }}
                className={`w-full px-3 py-2 text-xs font-mono rounded-xl border focus:outline-none cursor-pointer appearance-none ${
                  isChalkboard
                    ? "bg-[#13251c] border-amber-900/40 text-amber-200"
                    : isLight
                    ? "bg-slate-50 border-slate-200 text-slate-800"
                    : "bg-slate-800/80 border-slate-700 text-slate-200"
                }`}
                defaultValue=""
              >
                <option value="" disabled>Explore Preset Functions...</option>
                {PRESET_FUNCTIONS.map((p, idx) => (
                  <option key={idx} value={p.expr}>
                    {p.name} — {p.expr}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                const randomPreset = PRESET_FUNCTIONS[Math.floor(Math.random() * PRESET_FUNCTIONS.length)];
                setFuncInput(randomPreset.expr);
                runAnalysis(randomPreset.expr);
              }}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                isLight ? "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 hover:bg-white/10 border-white/10 text-white/80"
              }`}
              title="Pick Random Function"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Input Bar with Submit Button */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div className="relative flex-1">
            <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-sm select-none ${
              isChalkboard ? "text-amber-400" : "text-blue-400"
            }`}>
              f(x) =
            </span>
            <input
              type="text"
              value={funcInput}
              onChange={(e) => setFuncInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runAnalysis(funcInput);
              }}
              placeholder="e.g. x^3 - 3*x^2 + 2, (x^2 - 1)/(x - 2), sin(x), x*exp(-x^2)"
              className={`w-full pl-18 pr-4 py-3 rounded-xl border font-mono text-base focus:outline-none transition-all shadow-inner ${
                isChalkboard
                  ? "bg-[#08120d] border-amber-900/60 text-amber-100 focus:border-amber-400"
                  : isLight
                  ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                  : "bg-slate-950/80 border-slate-800 text-white focus:border-blue-500"
              }`}
            />
          </div>

          <button
            onClick={() => runAnalysis(funcInput)}
            disabled={loading}
            className={`px-6 py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
              isChalkboard
                ? "bg-[#183626] hover:bg-[#234d37] text-amber-200 border border-amber-500/40 font-scholar-title"
                : isLight
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30"
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Computing...</span>
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                <span>Analyze Function</span>
              </>
            )}
          </button>
        </div>

        {/* Live LaTeX Formatted Preview */}
        {funcInput.trim() && (
          <div className="mt-3 flex items-center justify-between text-xs font-mono opacity-80 overflow-x-auto">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">LaTeX Equation Preview:</span>
            <div className="text-sm">
              <KatexMath math={`f(x) = ${analysis?.latex || funcInput}`} block={false} />
            </div>
          </div>
        )}

        {/* Error message if any */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Key Metrics Snapshot Cards (Extrema, Roots, Deriv, Asymptotes) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Extrema KPI */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/50 border-slate-800"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Extrema (Max / Min)</span>
            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black font-mono">
              {analysis?.extrema.length || 0}
            </span>
            <span className="text-xs ml-1 opacity-70">critical points</span>
          </div>
          <p className="text-[11px] font-mono mt-1 text-emerald-400 truncate">
            {analysis?.extrema.map((e) => `${e.type === "local_max" ? "Max" : "Min"}(${e.x},${e.y})`).join(", ") || "No extrema"}
          </p>
        </div>

        {/* First Derivative KPI */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/50 border-slate-800"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">First Derivative f'(x)</span>
            <span className="p-1 rounded-md bg-cyan-500/10 text-cyan-400">
              <Activity className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 overflow-x-auto scrollbar-none py-0.5">
            <KatexMath math={`f'(x) = ${analysis?.derivative_latex || "\\dots"}`} block={false} />
          </div>
          <p className="text-[11px] font-mono mt-1 opacity-70 truncate">
            Instantaneous tangent rate
          </p>
        </div>

        {/* Roots / Zeros KPI */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/50 border-slate-800"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Roots / Zeros</span>
            <span className="p-1 rounded-md bg-rose-500/10 text-rose-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black font-mono">
              {analysis?.roots.length || 0}
            </span>
            <span className="text-xs ml-1 opacity-70">x-intercepts</span>
          </div>
          <p className="text-[11px] font-mono mt-1 text-rose-400 truncate">
            {analysis?.roots.map((r) => `x=${r.x}`).join(", ") || "No real roots"}
          </p>
        </div>

        {/* Domain & Parity KPI */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/50 border-slate-800"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Symmetry &amp; Parity</span>
            <span className="p-1 rounded-md bg-purple-500/10 text-purple-400">
              <Compass className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-sm font-bold font-mono truncate block">
              {analysis?.symmetry.split("(")[0] || "General"}
            </span>
          </div>
          <p className="text-[11px] font-mono mt-1 opacity-70 truncate">
            {analysis?.domain || "(-∞, ∞)"}
          </p>
        </div>
      </div>

      {/* 3. Main Workspace: Canvas Graph (Left) & Deep Dive Analysis Panels (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Canvas Plotter (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className={`rounded-2xl border p-4 relative overflow-hidden flex flex-col ${
            isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800 backdrop-blur-xl"
          }`}>
            {/* Canvas Toolbar Top */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold flex items-center gap-1.5 font-mono">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Cartesian Plot: <KatexMath math="f(x)" block={false} />
                </span>
                {hoverCoord && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/40 border border-white/10 text-cyan-300">
                    x: {hoverCoord.x.toFixed(2)}, y: {hoverCoord.y.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Viewport Zoom & Reset */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => zoom(0.8)}
                  className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => zoom(1.25)}
                  className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={resetView}
                  className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer"
                  title="Reset Coordinates"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Interactive HTML5 Canvas */}
            <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden cursor-crosshair border border-white/10">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="w-full h-full block"
              />
            </div>

            {/* Canvas Layer Toggles Strip */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/10 text-[11px] font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-50 mr-1">Layers:</span>

              <button
                onClick={() => setShowDerivative(!showDerivative)}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showDerivative
                    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                    : "opacity-60 hover:opacity-100 border-white/10"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                f'(x) Derivative
              </button>

              <button
                onClick={() => setShowSecondDerivative(!showSecondDerivative)}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showSecondDerivative
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    : "opacity-60 hover:opacity-100 border-white/10"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                f''(x) Concavity
              </button>

              <button
                onClick={() => setShowTangent(!showTangent)}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showTangent
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "opacity-60 hover:opacity-100 border-white/10"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Tangent Line
              </button>

              <button
                onClick={() => setShowArea(!showArea)}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showArea
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                    : "opacity-60 hover:opacity-100 border-white/10"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Integral Area
              </button>

              <button
                onClick={() => setShowExtremaPoints(!showExtremaPoints)}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showExtremaPoints
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "opacity-60 hover:opacity-100 border-white/10"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Extrema
              </button>
            </div>
          </div>

          {/* Quick Action: Send to Studio Whiteboard */}
          {onSendToStudio && (
            <button
              onClick={() => onSendToStudio(activeFunc)}
              className={`w-full py-3 px-4 rounded-xl border font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                isChalkboard
                  ? "bg-[#183626] hover:bg-[#234d37] text-amber-200 border-amber-500/40"
                  : isLight
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10"
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Open in Whiteboard Studio (Step-by-Step Lesson &amp; Manim Video)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right: Comprehensive Math Analysis Notebook (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Segmented Navigation Tabs */}
          <div className={`p-1 rounded-xl border flex items-center text-xs font-semibold ${
            isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-slate-100 border-slate-200" : "bg-slate-900/80 border-slate-800"
          }`}>
            <button
              onClick={() => setActiveTab("calculus")}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === "calculus"
                  ? (isLight ? "bg-white text-blue-600 shadow-xs font-bold" : "bg-white/15 text-white font-bold")
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              Calculus
            </button>
            <button
              onClick={() => setActiveTab("algebra")}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === "algebra"
                  ? (isLight ? "bg-white text-blue-600 shadow-xs font-bold" : "bg-white/15 text-white font-bold")
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              Algebra
            </button>
            <button
              onClick={() => setActiveTab("integral")}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === "integral"
                  ? (isLight ? "bg-white text-blue-600 shadow-xs font-bold" : "bg-white/15 text-white font-bold")
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              Integral
            </button>
            <button
              onClick={() => setActiveTab("steps")}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === "steps"
                  ? (isLight ? "bg-white text-blue-600 shadow-xs font-bold" : "bg-white/15 text-white font-bold")
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              Steps
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === "table"
                  ? (isLight ? "bg-white text-blue-600 shadow-xs font-bold" : "bg-white/15 text-white font-bold")
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              Table
            </button>
          </div>

          {/* Tab 1: Calculus & Extrema Deep Dive */}
          {activeTab === "calculus" && (
            <div className={`p-5 rounded-2xl border space-y-5 ${
              isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
            }`}>
              {/* Critical Points & Extrema Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Critical Points &amp; Extrema (Max / Min)
                </h3>
                {analysis?.extrema && analysis.extrema.length > 0 ? (
                  <div className="space-y-2">
                    {analysis.extrema.map((ext, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          ext.type === "local_max"
                            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                            : "bg-blue-950/20 border-blue-500/30 text-blue-200"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider block font-mono">
                            {ext.label}
                          </span>
                          <span className="text-sm font-bold font-mono">
                            ({ext.x}, {ext.y})
                          </span>
                        </div>
                        <div className="text-right text-[11px] font-mono">
                          <span className="block opacity-70">f''({ext.x}) = {ext.test_value}</span>
                          <span className="font-bold">
                            {ext.test_value < 0 ? "f'' < 0 (Concave Down)" : "f'' > 0 (Concave Up)"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs opacity-60 font-mono p-3 rounded-xl bg-white/5 border border-white/5">
                    No real critical points found within domain. The function may be strictly monotonic.
                  </p>
                )}
              </div>

              {/* Monotonicity: Increasing & Decreasing Intervals */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Monotonicity Intervals
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-500/30">
                    <span className="text-[10px] text-teal-300 font-bold uppercase block mb-1">Increasing (f' &gt; 0)</span>
                    <span className="text-teal-100">
                      {analysis?.monotonicity.increasing.join(" ∪ ") || "None"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <span className="text-[10px] text-amber-300 font-bold uppercase block mb-1">Decreasing (f' &lt; 0)</span>
                    <span className="text-amber-100">
                      {analysis?.monotonicity.decreasing.join(" ∪ ") || "None"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Inflection Points & Concavity */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Split className="w-4 h-4 text-purple-400" />
                  Inflection Points (f''(x) = 0)
                </h3>
                {analysis?.inflection_points && analysis.inflection_points.length > 0 ? (
                  <div className="space-y-1.5">
                    {analysis.inflection_points.map((inf, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg border border-purple-500/30 bg-purple-950/20 flex items-center justify-between text-xs font-mono">
                        <span className="text-purple-300 font-bold">Point #{idx + 1}</span>
                        <span className="text-purple-100 font-bold">({inf.x}, {inf.y})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs opacity-60 font-mono p-3 rounded-xl bg-white/5 border border-white/5">
                    No inflection points detected within the tested domain.
                  </p>
                )}
              </div>

              {/* Collapsible: Step-by-Step Derivative Derivation Rules */}
              {analysis?.derivative_steps && analysis.derivative_steps.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <button
                    onClick={() => setShowDerivSteps(!showDerivSteps)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-950/30 transition-all text-xs font-mono cursor-pointer"
                  >
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Derivative Rules &amp; Steps ({analysis.derivative_steps.length})
                    </span>
                    <ChevronDown className={`w-4 h-4 text-cyan-400 transition-transform ${showDerivSteps ? "rotate-180" : ""}`} />
                  </button>

                  {showDerivSteps && (
                    <div className="mt-2 space-y-2 p-2 rounded-xl bg-black/40 border border-white/5">
                      {analysis.derivative_steps.map((st, i) => (
                        <div key={i} className="p-2 rounded-lg bg-black/30 border border-white/5 text-xs font-mono space-y-1">
                          <span className="text-[10px] text-cyan-400 font-semibold block">{st.description}</span>
                          <div className="text-sm overflow-x-auto py-0.5">
                            <KatexMath math={st.latex} block={false} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Collapsible: Critical Points Solving Steps */}
              {analysis?.critical_points_steps && analysis.critical_points_steps.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowCritSteps(!showCritSteps)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/30 transition-all text-xs font-mono cursor-pointer"
                  >
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Critical Points Solving Steps ({analysis.critical_points_steps.length})
                    </span>
                    <ChevronDown className={`w-4 h-4 text-emerald-400 transition-transform ${showCritSteps ? "rotate-180" : ""}`} />
                  </button>

                  {showCritSteps && (
                    <div className="mt-2 space-y-2 p-2 rounded-xl bg-black/40 border border-white/5">
                      {analysis.critical_points_steps.map((st, i) => (
                        <div key={i} className="p-2 rounded-lg bg-black/30 border border-white/5 text-xs font-mono space-y-1">
                          <span className="text-[10px] text-emerald-400 font-semibold block">{st.description}</span>
                          <div className="text-sm overflow-x-auto py-0.5">
                            <KatexMath math={st.latex} block={false} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Algebraic Properties & Asymptotes */}
          {activeTab === "algebra" && (
            <div className={`p-5 rounded-2xl border space-y-4 ${
              isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
            }`}>
              {/* Roots / Zeros */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-rose-400">
                  Real Roots / X-Intercepts (f(x) = 0)
                </h3>
                {analysis?.roots && analysis.roots.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {analysis.roots.map((r, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 text-xs font-mono">
                        <span className="text-rose-400 font-bold block">Root {i + 1}:</span>
                        <KatexMath math={`x = ${r.latex}`} block={false} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs opacity-60 font-mono">No real roots. Curve does not cross y = 0.</p>
                )}
              </div>

              {/* Y-Intercept */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-purple-400">
                  Y-Intercept (f(0))
                </h3>
                <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/30 text-xs font-mono">
                  {analysis?.y_intercept ? (
                    <KatexMath math={`(0, ${analysis.y_intercept.y})`} block={false} />
                  ) : (
                    "Undefined at x = 0 (Vertical Asymptote or Domain Boundary)"
                  )}
                </div>
              </div>

              {/* Asymptotes */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-amber-400">
                  Asymptotes &amp; Discontinuities
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/10">
                    <span className="text-[10px] text-red-400 uppercase font-bold block">Vertical Asymptotes:</span>
                    <span>
                      {analysis?.asymptotes.vertical.map((va) => `x = ${va.x}`).join(", ") || "None"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/10">
                    <span className="text-[10px] text-cyan-400 uppercase font-bold block">Horizontal Asymptotes:</span>
                    <span>
                      {analysis?.asymptotes.horizontal.map((ha) => `y = ${ha.y}`).join(", ") || "None"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/10">
                    <span className="text-[10px] text-yellow-400 uppercase font-bold block">Oblique / Slant Asymptotes:</span>
                    <span>
                      {analysis?.asymptotes.oblique.map((oa) => oa.expr).join(", ") || "None"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Collapsible: Root Factoring & Algebraic Steps */}
              {analysis?.roots_steps && analysis.roots_steps.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <button
                    onClick={() => setShowRootsSteps(!showRootsSteps)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/30 transition-all text-xs font-mono cursor-pointer"
                  >
                    <span className="font-bold text-rose-300 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Root Factoring &amp; Solving Steps ({analysis.roots_steps.length})
                    </span>
                    <ChevronDown className={`w-4 h-4 text-rose-400 transition-transform ${showRootsSteps ? "rotate-180" : ""}`} />
                  </button>

                  {showRootsSteps && (
                    <div className="mt-2 space-y-2 p-2 rounded-xl bg-black/40 border border-white/5">
                      {analysis.roots_steps.map((st, i) => (
                        <div key={i} className="p-2 rounded-lg bg-black/30 border border-white/5 text-xs font-mono space-y-1">
                          <span className="text-[10px] text-rose-400 font-semibold block">{st.description}</span>
                          <div className="text-sm overflow-x-auto py-0.5">
                            <KatexMath math={st.latex} block={false} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Definite Integral & Riemann Sum Tool */}
          {activeTab === "integral" && (
            <div className={`p-5 rounded-2xl border space-y-4 ${
              isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Definite Integral Calculator: <KatexMath math="\int_a^b f(x)\,dx" block={false} />
                </h3>
                <button
                  onClick={() => setShowArea(true)}
                  className="text-[10px] text-sky-400 hover:underline font-mono"
                >
                  Highlight on Canvas
                </button>
              </div>

              {/* Antiderivative Formula */}
              <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/30 text-xs font-mono">
                <span className="text-[10px] text-sky-300 font-bold uppercase block mb-1">Continuous Antiderivative:</span>
                <KatexMath math={`\\int f(x)\\,dx = ${analysis?.integral_latex || "\\dots"}`} block={false} />
              </div>

              {/* Bound sliders */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <label className="text-[10px] font-bold uppercase opacity-60 block mb-1">Lower Bound (a = {intBoundA})</label>
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={0.5}
                    value={intBoundA}
                    onChange={(e) => {
                      setIntBoundA(parseFloat(e.target.value));
                      setShowArea(true);
                    }}
                    className="w-full accent-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase opacity-60 block mb-1">Upper Bound (b = {intBoundB})</label>
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={0.5}
                    value={intBoundB}
                    onChange={(e) => {
                      setIntBoundB(parseFloat(e.target.value));
                      setShowArea(true);
                    }}
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>

              {/* Riemann Partitions Control */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="opacity-70">Riemann Rectangles (n = {riemannN}):</span>
                  <button
                    onClick={() => setShowRiemannBars(!showRiemannBars)}
                    className="text-[10px] px-2 py-0.5 rounded border border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                  >
                    {showRiemannBars ? "Hide Rectangles" : "Show Rectangles"}
                  </button>
                </div>
                <input
                  type="range"
                  min={4}
                  max={40}
                  step={2}
                  value={riemannN}
                  onChange={(e) => {
                    setRiemannN(parseInt(e.target.value));
                    setShowRiemannBars(true);
                    setShowArea(true);
                  }}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Result Comparison Cards */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/30">
                  <span className="text-[10px] text-sky-400 font-bold uppercase block">Exact Integral:</span>
                  <span className="text-lg font-bold text-sky-200">{exactDefiniteIntegral}</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30">
                  <span className="text-[10px] text-purple-400 font-bold uppercase block">Riemann Sum (n={riemannN}):</span>
                  <span className="text-lg font-bold text-purple-200">{riemannSumValue}</span>
                </div>
              </div>

              {/* Collapsible: Integration Steps */}
              {analysis?.integral_steps && analysis.integral_steps.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <button
                    onClick={() => setShowIntegralSteps(!showIntegralSteps)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-sky-500/30 bg-sky-950/20 hover:bg-sky-950/30 transition-all text-xs font-mono cursor-pointer"
                  >
                    <span className="font-bold text-sky-300 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Antiderivative Integration Steps ({analysis.integral_steps.length})
                    </span>
                    <ChevronDown className={`w-4 h-4 text-sky-400 transition-transform ${showIntegralSteps ? "rotate-180" : ""}`} />
                  </button>

                  {showIntegralSteps && (
                    <div className="mt-2 space-y-2 p-2 rounded-xl bg-black/40 border border-white/5">
                      {analysis.integral_steps.map((st, i) => (
                        <div key={i} className="p-2 rounded-lg bg-black/30 border border-white/5 text-xs font-mono space-y-1">
                          <span className="text-[10px] text-sky-400 font-semibold block">{st.description}</span>
                          <div className="text-sm overflow-x-auto py-0.5">
                            <KatexMath math={st.latex} block={false} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Step-by-Step Rigorous Proofs */}
          {activeTab === "steps" && (
            <div className={`p-5 rounded-2xl border space-y-3 max-h-[520px] overflow-y-auto pr-1.5 scrollbar-thin ${
              isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-white/10">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  Step-by-Step Mathematical Solutions
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {analysis?.step_by_step.length || 0} Total Steps
                </span>
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pb-2 text-[10px] font-mono">
                {[
                  { id: "all", label: "All Steps" },
                  { id: "derivative", label: "Derivatives" },
                  { id: "extrema", label: "Critical & Extrema" },
                  { id: "roots", label: "Roots" },
                  { id: "inflection", label: "Inflection" },
                  { id: "integral", label: "Integral" }
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setStepCategoryFilter(chip.id)}
                    className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                      stepCategoryFilter === chip.id
                        ? "bg-blue-600 text-white border-blue-500 font-bold"
                        : "opacity-60 hover:opacity-100 border-white/10 bg-white/5"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {analysis?.step_by_step && analysis.step_by_step.length > 0 ? (
                analysis.step_by_step
                  .filter((st) => stepCategoryFilter === "all" || st.category === stepCategoryFilter)
                  .map((step, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Step #{idx + 1}
                          </span>
                          <h4 className="text-xs font-bold tracking-tight">{step.title}</h4>
                        </div>
                        {step.category && (
                          <span className="text-[8px] uppercase tracking-wider font-mono px-1.5 py-0.2 rounded bg-white/5 border border-white/10 opacity-70">
                            {step.category}
                          </span>
                        )}
                      </div>

                      <div className="p-2 rounded-lg bg-black/40 border border-white/5 text-sm overflow-x-auto my-1">
                        <KatexMath math={step.latex} block={true} />
                      </div>

                      <p className="text-[11px] opacity-75 font-sans leading-relaxed">
                        {step.explanation}
                      </p>
                    </div>
                  ))
              ) : (
                <p className="text-xs opacity-60 font-mono">No steps matching the selected filter.</p>
              )}
            </div>
          )}

          {/* Tab 5: Dynamic Numerical Value Table */}
          {activeTab === "table" && (
            <div className={`p-5 rounded-2xl border space-y-3 ${
              isChalkboard ? "bg-[#0b1712] border-amber-900/40" : isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
            }`}>
              <div className="flex items-center justify-between text-xs font-mono">
                <h3 className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-emerald-400" />
                  Table of Values
                </h3>
                <div className="flex items-center gap-1">
                  <span className="opacity-60 text-[10px]">Δx:</span>
                  {[0.25, 0.5, 1.0].map((stepVal) => (
                    <button
                      key={stepVal}
                      onClick={() => setTableStep(stepVal)}
                      className={`px-1.5 py-0.5 rounded text-[10px] border cursor-pointer ${
                        tableStep === stepVal ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold" : "opacity-50"
                      }`}
                    >
                      {stepVal}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[360px] overflow-y-auto scrollbar-thin border border-white/10 rounded-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-black/50 border-b border-white/10 sticky top-0">
                    <tr>
                      <th className="p-2 text-blue-400">x</th>
                      <th className="p-2 text-emerald-400">f(x)</th>
                      <th className="p-2 text-cyan-400">f'(x)</th>
                      <th className="p-2 text-purple-400">f''(x)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tableRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-2 font-bold">{row.x}</td>
                        <td className="p-2 text-emerald-200">{row.y}</td>
                        <td className="p-2 text-cyan-200">{row.dy}</td>
                        <td className="p-2 text-purple-200">{row.d2y}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
