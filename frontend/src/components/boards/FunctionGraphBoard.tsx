import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { GraphData, SceneAnnotation, ThemeType } from "../../types";
import { BOARD_THEMES } from "./themePalette";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  TrendingUp,
  Table,
  Eye,
  Layers,
  Sparkles,
  Info
} from "lucide-react";

interface FunctionGraphBoardProps {
  graphData: GraphData;
  annotations?: SceneAnnotation[];
  theme: ThemeType;
  customExpr?: string;
  onSolveExpr?: (expr: string) => void;
}

export default function FunctionGraphBoard({
  graphData,
  annotations = [],
  theme,
  customExpr,
  onSolveExpr
}: FunctionGraphBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport bounds
  const [viewPort, setViewPort] = useState({
    minX: graphData.viewPort?.minX ?? -6,
    maxX: graphData.viewPort?.maxX ?? 6,
    minY: graphData.viewPort?.minY ?? -6,
    maxY: graphData.viewPort?.maxY ?? 6
  });

  // Interactive mouse inspection state
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const [showTangent, setShowTangent] = useState(false);
  const [showValueTable, setShowValueTable] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Sync viewport when incoming graphData changes
  useEffect(() => {
    if (graphData.viewPort) {
      setViewPort(graphData.viewPort);
    }
  }, [graphData.viewPort]);

  // Expression string to plot
  const expr = useMemo(() => {
    return customExpr || graphData.functionExpr || "x^2 - 5x + 6";
  }, [customExpr, graphData.functionExpr]);

  // Safe Math Function Evaluator
  const evaluateFn = useCallback(
    (xVal: number): number => {
      try {
        let sanitized = expr
          .replace(/Math\./g, "")
          .replace(/\^/g, "**")
          .replace(/\bsin\b/g, "Math.sin")
          .replace(/\bcos\b/g, "Math.cos")
          .replace(/\btan\b/g, "Math.tan")
          .replace(/\bsqrt\b/g, "Math.sqrt")
          .replace(/\bpow\b/g, "Math.pow")
          .replace(/\babs\b/g, "Math.abs")
          .replace(/\bpi\b/g, "Math.PI")
          .replace(/\bexp\b/g, "Math.exp")
          .replace(/\blog\b/g, "Math.log")
          .replace(/\bln\b/g, "Math.log")
          .replace(/\be\b/g, "Math.E");

        // Handle implicit multiplication like 5x -> 5*x
        sanitized = sanitized.replace(/(\d)([a-zA-Z])/g, "$1*$2");

        const fn = new Function("x", `return ${sanitized};`);
        const val = fn(xVal);
        return isNaN(val) || !isFinite(val) ? 0 : val;
      } catch {
        return xVal * xVal - 5 * xVal + 6;
      }
    },
    [expr]
  );

  // Compute numerical derivative f'(x)
  const evaluateDerivative = useCallback(
    (xVal: number): number => {
      const h = 0.0001;
      return (evaluateFn(xVal + h) - evaluateFn(xVal - h)) / (2 * h);
    },
    [evaluateFn]
  );

  // Find roots or critical points numerically if not provided
  const detectedPoints = useMemo(() => {
    const roots: number[] = graphData.roots ? [...graphData.roots] : [];
    let vertex = graphData.vertex;

    // Scan for roots in range [-10, 10]
    if (roots.length === 0) {
      let prevX = -10;
      let prevY = evaluateFn(prevX);
      for (let x = -9.9; x <= 10; x += 0.1) {
        const y = evaluateFn(x);
        if ((prevY <= 0 && y >= 0) || (prevY >= 0 && y <= 0)) {
          // Linear interpolation for zero
          const r = prevX + (-prevY * (x - prevX)) / (y - prevY);
          if (!roots.some((existing) => Math.abs(existing - r) < 0.2)) {
            roots.push(Math.round(r * 100) / 100);
          }
        }
        prevX = x;
        prevY = y;
      }
    }

    // Scan for local extremum in range [-6, 6] if vertex is missing
    if (!vertex) {
      let bestX = 0;
      let minDeriv = Infinity;
      for (let x = -5; x <= 5; x += 0.05) {
        const d = Math.abs(evaluateDerivative(x));
        if (d < minDeriv) {
          minDeriv = d;
          bestX = x;
        }
      }
      if (minDeriv < 0.05) {
        vertex = {
          x: Math.round(bestX * 100) / 100,
          y: Math.round(evaluateFn(bestX) * 100) / 100
        };
      }
    }

    const yIntercept = Math.round(evaluateFn(0) * 100) / 100;

    return { roots, vertex, yIntercept };
  }, [evaluateFn, evaluateDerivative, graphData.roots, graphData.vertex]);

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

    // 1. Clear background
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const { minX, maxX, minY, maxY } = viewPort;

    const toScreenX = (x: number) => ((x - minX) / (maxX - minX)) * width;
    const toScreenY = (y: number) => height - ((y - minY) / (maxY - minY)) * height;
    const toMathX = (px: number) => minX + (px / width) * (maxX - minX);

    // 2. Grid lines
    if (showGrid) {
      const stepX = Math.max(1, Math.round((maxX - minX) / 12));
      const stepY = Math.max(1, Math.round((maxY - minY) / 10));

      const startGridX = Math.floor(minX / stepX) * stepX;
      const endGridX = Math.ceil(maxX / stepX) * stepX;
      for (let gx = startGridX; gx <= endGridX; gx += stepX) {
        const sx = toScreenX(gx);
        ctx.beginPath();
        ctx.strokeStyle = gx === 0 ? colors.axis : colors.grid;
        ctx.lineWidth = gx === 0 ? 1.5 : 1;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
        ctx.stroke();

        if (gx !== 0 && sx > 10 && sx < width - 10) {
          ctx.fillStyle = colors.textMuted;
          ctx.font = "9px monospace";
          ctx.fillText(gx.toString(), sx + 3, Math.min(height - 4, Math.max(12, toScreenY(0) + 12)));
        }
      }

      const startGridY = Math.floor(minY / stepY) * stepY;
      const endGridY = Math.ceil(maxY / stepY) * stepY;
      for (let gy = startGridY; gy <= endGridY; gy += stepY) {
        const sy = toScreenY(gy);
        ctx.beginPath();
        ctx.strokeStyle = gy === 0 ? colors.axis : colors.grid;
        ctx.lineWidth = gy === 0 ? 1.5 : 1;
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
        ctx.stroke();

        if (gy !== 0 && sy > 10 && sy < height - 10) {
          ctx.fillStyle = colors.textMuted;
          ctx.font = "9px monospace";
          ctx.fillText(gy.toString(), Math.min(width - 24, Math.max(4, toScreenX(0) + 4)), sy - 3);
        }
      }
    }

    // 3. Coordinate axes
    const originX = toScreenX(0);
    const originY = toScreenY(0);

    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1.5;
    // X-Axis
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();
    // Y-Axis
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = colors.text;
    ctx.font = "bold 10px monospace";
    ctx.fillText("x", width - 12, originY - 6);
    ctx.fillText("y", originX + 6, 12);

    // 4. Function Curve
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = colors.curve;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Glow effect
    ctx.shadowColor = colors.curve;
    ctx.shadowBlur = 8;

    let isFirst = true;
    const numSteps = width * 1.5;
    for (let i = 0; i <= numSteps; i++) {
      const px = (i / numSteps) * width;
      const xVal = toMathX(px);
      const yVal = evaluateFn(xVal);

      if (isFinite(yVal)) {
        const py = toScreenY(yVal);
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
      } else {
        isFirst = true;
      }
    }
    ctx.stroke();
    ctx.restore();

    // 5. Roots & Key Points Highlight
    detectedPoints.roots.forEach((rx) => {
      const sx = toScreenX(rx);
      const sy = toScreenY(0);
      if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
        // Outer halo
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.fillStyle = colors.point + "33";
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = colors.point;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle = colors.text;
        ctx.font = "bold 10px monospace";
        ctx.fillText(`x = ${rx}`, sx - 16, sy - 10);
      }
    });

    // Y-Intercept
    const yIntX = toScreenX(0);
    const yIntY = toScreenY(detectedPoints.yIntercept);
    if (yIntX >= 0 && yIntX <= width && yIntY >= 0 && yIntY <= height) {
      ctx.beginPath();
      ctx.arc(yIntX, yIntY, 4, 0, Math.PI * 2);
      ctx.fillStyle = colors.secondaryCurve;
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = "9px monospace";
      ctx.fillText(`(0, ${detectedPoints.yIntercept})`, yIntX + 6, yIntY - 4);
    }

    // Vertex / Extrema
    if (detectedPoints.vertex) {
      const vx = toScreenX(detectedPoints.vertex.x);
      const vy = toScreenY(detectedPoints.vertex.y);
      if (vx >= 0 && vx <= width && vy >= 0 && vy <= height) {
        ctx.beginPath();
        ctx.arc(vx, vy, 5, 0, Math.PI * 2);
        ctx.fillStyle = colors.accent;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = colors.text;
        ctx.font = "bold 9px monospace";
        ctx.fillText(
          `V(${detectedPoints.vertex.x}, ${detectedPoints.vertex.y})`,
          vx + 8,
          vy + 4
        );
      }
    }

    // 6. Interactive Hover Tracker & Tangent
    if (hoverCoord) {
      const hx = toScreenX(hoverCoord.x);
      const hy = toScreenY(hoverCoord.y);

      // Tangent line
      if (showTangent) {
        const slope = evaluateDerivative(hoverCoord.x);
        const tanSpan = (maxX - minX) * 0.4;
        const x1 = hoverCoord.x - tanSpan;
        const y1 = hoverCoord.y - slope * tanSpan;
        const x2 = hoverCoord.x + tanSpan;
        const y2 = hoverCoord.y + slope * tanSpan;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = colors.secondaryCurve;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(toScreenX(x1), toScreenY(y1));
        ctx.lineTo(toScreenX(x2), toScreenY(y2));
        ctx.stroke();
        ctx.restore();

        // Tangent slope badge
        ctx.fillStyle = colors.secondaryCurve;
        ctx.font = "bold 10px monospace";
        ctx.fillText(`m = ${slope.toFixed(2)}`, hx + 12, hy - 18);
      }

      // Vertical & horizontal guide lines
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, height);
      ctx.moveTo(0, hy);
      ctx.lineTo(width, hy);
      ctx.stroke();
      ctx.restore();

      // Glowing cursor point on curve
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fillStyle = colors.curve;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Floating coordinate HUD
      const tooltip = `(${hoverCoord.x.toFixed(2)}, ${hoverCoord.y.toFixed(2)})`;
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      const tw = ctx.measureText(tooltip).width + 12;
      const tx = Math.min(width - tw - 6, Math.max(6, hx + 10));
      const ty = Math.max(20, hy - 10);
      ctx.fillRect(tx, ty - 14, tw, 18);
      ctx.strokeStyle = colors.curve;
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, ty - 14, tw, 18);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.fillText(tooltip, tx + 6, ty - 2);
    }
  }, [
    viewPort,
    theme,
    evaluateFn,
    evaluateDerivative,
    detectedPoints,
    hoverCoord,
    showTangent,
    showGrid
  ]);

  // Mouse Handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (isDragging && dragStart) {
      const dxPx = px - dragStart.x;
      const dyPx = py - dragStart.y;
      const spanX = viewPort.maxX - viewPort.minX;
      const spanY = viewPort.maxY - viewPort.minY;
      const dxMath = (dxPx / rect.width) * spanX;
      const dyMath = (dyPx / rect.height) * spanY;

      setViewPort((prev) => ({
        minX: prev.minX - dxMath,
        maxX: prev.maxX - dxMath,
        minY: prev.minY + dyMath,
        maxY: prev.maxY + dyMath
      }));
      setDragStart({ x: px, y: py });
      return;
    }

    const { minX, maxX } = viewPort;
    const mathX = minX + (px / rect.width) * (maxX - minX);
    const mathY = evaluateFn(mathX);
    setHoverCoord({ x: mathX, y: mathY });
  };

  const handleMouseLeave = () => {
    setHoverCoord(null);
    setIsDragging(false);
    setDragStart(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Zoom controls
  const handleZoom = (factor: number) => {
    setViewPort((prev) => {
      const cx = (prev.minX + prev.maxX) / 2;
      const cy = (prev.minY + prev.maxY) / 2;
      const spanX = (prev.maxX - prev.minX) * factor;
      const spanY = (prev.maxY - prev.minY) * factor;
      return {
        minX: cx - spanX / 2,
        maxX: cx + spanX / 2,
        minY: cy - spanY / 2,
        maxY: cy + spanY / 2
      };
    });
  };

  const handleReset = () => {
    setViewPort({ minX: -6, maxX: 6, minY: -6, maxY: 6 });
  };

  const tableValues = useMemo(() => {
    const list = [];
    for (let x = -4; x <= 4; x++) {
      list.push({ x, y: Math.round(evaluateFn(x) * 100) / 100 });
    }
    return list;
  }, [evaluateFn]);

  const activeColors = BOARD_THEMES[theme] || BOARD_THEMES.chalkboard;

  return (
    <div className="flex flex-col h-full w-full rounded-2xl overflow-hidden border transition-all duration-300"
      style={{
        backgroundColor: activeColors.bg,
        borderColor: activeColors.cardBorder
      }}
    >
      {/* Top Interactive Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b backdrop-blur-md"
        style={{ borderColor: activeColors.cardBorder }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold"
            style={{
              backgroundColor: activeColors.cardBg,
              color: activeColors.curve,
              border: `1px solid ${activeColors.cardBorder}`
            }}
          >
            <Sparkles className="w-3 h-3 animate-pulse" />
            <span>f(x) = {expr}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowTangent(!showTangent)}
            className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
              showTangent
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-white/5 text-white/60 hover:text-white border-white/10"
            }`}
            title="Toggle Tangent line at cursor"
          >
            <TrendingUp className="w-3 h-3" />
            Tangent
          </button>

          <button
            onClick={() => setShowValueTable(!showValueTable)}
            className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
              showValueTable
                ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                : "bg-white/5 text-white/60 hover:text-white border-white/10"
            }`}
            title="Toggle (x, y) value table"
          >
            <Table className="w-3 h-3" />
            Table
          </button>

          <div className="h-4 w-[1px] bg-white/10 mx-0.5" />

          <button
            onClick={() => handleZoom(0.8)}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer border border-white/10"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(1.25)}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer border border-white/10"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer border border-white/10"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 min-h-[300px] w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Value Table Drawer Popover */}
        {showValueTable && (
          <div className="absolute top-2 right-2 z-20 w-44 rounded-xl border p-2.5 shadow-xl backdrop-blur-lg animate-in fade-in slide-in-from-top-2"
            style={{
              backgroundColor: activeColors.cardBg,
              borderColor: activeColors.cardBorder
            }}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Table of Values</span>
              <button
                onClick={() => setShowValueTable(false)}
                className="text-white/50 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-xs">
              <div className="grid grid-cols-2 text-[10px] text-white/50 font-bold border-b border-white/5 pb-0.5">
                <span>x</span>
                <span className="text-right">f(x)</span>
              </div>
              {tableValues.map((row) => (
                <div
                  key={row.x}
                  className="grid grid-cols-2 text-[11px] hover:bg-white/5 px-1 py-0.5 rounded cursor-pointer transition"
                  onClick={() => setHoverCoord({ x: row.x, y: row.y })}
                >
                  <span className="text-white/70">{row.x}</span>
                  <span className="text-right font-bold" style={{ color: activeColors.curve }}>
                    {row.y}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Mathematical Insights Bar */}
      <div className="px-3 py-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
        style={{
          borderColor: activeColors.cardBorder,
          backgroundColor: activeColors.cardBg
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {detectedPoints.roots.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-white/50">Roots:</span>
              <div className="flex gap-1">
                {detectedPoints.roots.map((r, i) => (
                  <span
                    key={i}
                    className="font-mono text-[11px] px-1.5 py-0.2 rounded font-bold"
                    style={{
                      backgroundColor: `${activeColors.point}22`,
                      color: activeColors.point
                    }}
                  >
                    x = {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase font-bold text-white/50">Y-Int:</span>
            <span className="font-mono text-[11px] text-white/80">
              (0, {detectedPoints.yIntercept})
            </span>
          </div>

          {detectedPoints.vertex && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-white/50">Vertex:</span>
              <span className="font-mono text-[11px] font-bold" style={{ color: activeColors.accent }}>
                ({detectedPoints.vertex.x}, {detectedPoints.vertex.y})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
          <span>Click &amp; Drag to pan</span>
          <span>•</span>
          <span>Hover to track coordinates</span>
        </div>
      </div>
    </div>
  );
}
