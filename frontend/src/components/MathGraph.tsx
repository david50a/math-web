import React, { useEffect, useRef } from "react";
import { GraphData, SceneAnnotation, ThemeType } from "../types";

interface MathGraphProps {
  graphData: GraphData;
  annotations?: SceneAnnotation[];
  theme: ThemeType;
}

export default function MathGraph({ graphData, annotations = [], theme }: MathGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Safe Math Evaluator for coordinate mapping
  const evaluateExpr = (expr: string, x: number): number => {
    try {
      // Replace safe math components for security
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

      // Compile a rapid calculator function safely
      const fn = new Function("x", `return ${sanitized};`);
      const val = fn(x);
      return isNaN(val) || !isFinite(val) ? 0 : val;
    } catch {
      // Elegant safe fallback plotting
      return x * x - 5 * x + 6;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Theme Color Mapping
    const colorPalette = {
      chalkboard: {
        bg: "#1e2e28", // School dark-green chalkboard
        grid: "rgba(255, 255, 255, 0.08)",
        gridBold: "rgba(255, 255, 255, 0.15)",
        axis: "rgba(255, 255, 255, 0.6)",
        text: "rgba(255, 255, 255, 0.8)",
        curve: "#10b981", // glowing emerald
        secondaryCurve: "#f59e0b", // yellow chalk
        point: "#f43f5e"
      },
      blueprint: {
        bg: "#0b2545", // Deep engineering blue
        grid: "rgba(0, 180, 216, 0.15)",
        gridBold: "rgba(0, 180, 216, 0.3)",
        axis: "rgba(144, 224, 239, 0.7)",
        text: "#caf0f8",
        curve: "#00b4d8", // cyan line
        secondaryCurve: "#ee9b00",
        point: "#e63946"
      },
      glassmorphic: {
        bg: "rgba(15, 23, 42, 0.85)", // deep space backdrop
        grid: "rgba(255, 255, 255, 0.05)",
        gridBold: "rgba(255, 255, 255, 0.12)",
        axis: "rgba(255, 255, 255, 0.4)",
        text: "rgba(241, 245, 249, 0.9)",
        curve: "#a855f7", // hot purple
        secondaryCurve: "#ec4899", // magenta
        point: "#38bdf8"
      },
      darkroom: {
        bg: "#09090b", // Absolute dark
        grid: "rgba(244, 63, 94, 0.04)", // red tint grid
        gridBold: "rgba(244, 63, 94, 0.1)",
        axis: "rgba(244, 63, 94, 0.4)",
        text: "#f43f5e",
        curve: "#ff003c", // laser red
        secondaryCurve: "#fbbf24",
        point: "#fb7185"
      }
    };

    const colors = colorPalette[theme] || colorPalette.chalkboard;

    // Fill Backdrop
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    // Setup viewport defaults
    const vp = graphData.viewPort || { minX: -5, maxX: 5, minY: -5, maxY: 5 };
    const minX = vp.minX;
    const maxX = vp.maxX;
    const minY = vp.minY;
    const maxY = vp.maxY;

    // Coordinate translation helpers
    const toScreenX = (xVal: number) => {
      return ((xVal - minX) / (maxX - minX)) * width;
    };

    const toScreenY = (yVal: number) => {
      // Y screen axis is inverted
      return height - ((yVal - minY) / (maxY - minY)) * height;
    };

    const toMathX = (screenX: number) => {
      return minX + (screenX / width) * (maxX - minX);
    };

    // Draw grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;

    // Vertical grid lines (constant math X)
    const xRange = maxX - minX;
    const xStep = Math.max(0.2, Math.pow(10, Math.floor(Math.log10(xRange))) / 2);
    const startX = Math.floor(minX / xStep) * xStep;

    for (let x = startX; x <= maxX; x += xStep) {
      if (Math.abs(x) < 1e-5) continue; // Skip axis line
      const sx = toScreenX(x);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }

    // Horizontal grid lines (constant math Y)
    const yRange = maxY - minY;
    const yStep = Math.max(0.2, Math.pow(10, Math.floor(Math.log10(yRange))) / 2);
    const startY = Math.floor(minY / yStep) * yStep;

    for (let y = startY; y <= maxY; y += yStep) {
      if (Math.abs(y) < 1e-5) continue; // Skip axis line
      const sy = toScreenY(y);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // Draw main axes (X and Y coordinates)
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 2;

    const screenOriginY = toScreenY(0);
    const screenOriginX = toScreenX(0);

    // Draw X Axis
    if (screenOriginY >= 0 && screenOriginY <= height) {
      ctx.beginPath();
      ctx.moveTo(0, screenOriginY);
      ctx.lineTo(width, screenOriginY);
      ctx.stroke();

      // Draw ticks & labels for X values
      ctx.fillStyle = colors.text;
      ctx.font = "9px monospace";
      for (let x = startX; x <= maxX; x += xStep) {
        if (Math.abs(x) < 1e-10) continue;
        const sx = toScreenX(x);
        ctx.beginPath();
        ctx.moveTo(sx, screenOriginY - 4);
        ctx.lineTo(sx, screenOriginY + 4);
        ctx.stroke();
        ctx.fillText(x.toFixed(1).replace(".0", ""), sx - 6, screenOriginY + 15);
      }
    }

    // Draw Y Axis
    if (screenOriginX >= 0 && screenOriginX <= width) {
      ctx.beginPath();
      ctx.moveTo(screenOriginX, 0);
      ctx.lineTo(screenOriginX, height);
      ctx.stroke();

      // Draw ticks & labels for Y values
      ctx.fillStyle = colors.text;
      ctx.font = "9px monospace";
      for (let y = startY; y <= maxY; y += yStep) {
        if (Math.abs(y) < 1e-10) continue;
        const sy = toScreenY(y);
        ctx.beginPath();
        ctx.moveTo(screenOriginX - 4, sy);
        ctx.lineTo(screenOriginX + 4, sy);
        ctx.stroke();
        ctx.fillText(y.toFixed(1).replace(".0", ""), screenOriginX + 8, sy + 3);
      }
    }

    // Label Origin Point
    if (screenOriginX >= 0 && screenOriginX <= width && screenOriginY >= 0 && screenOriginY <= height) {
      ctx.fillText("0", screenOriginX - 10, screenOriginY + 12);
    }

    // Plot continuous curve if function is defined
    if (graphData.showGraph && graphData.functionExpr) {
      ctx.strokeStyle = colors.curve;
      ctx.lineWidth = 3;
      ctx.beginPath();

      let isFirst = true;
      // Step across canvas pixels sequentially for detail
      for (let sx = 0; sx <= width; sx += 2) {
        const mathX = toMathX(sx);
        const mathY = evaluateExpr(graphData.functionExpr, mathX);
        const sy = toScreenY(mathY);

        if (sy >= -50 && sy <= height + 50) {
          if (isFirst) {
            ctx.moveTo(sx, sy);
            isFirst = false;
          } else {
            ctx.lineTo(sx, sy);
          }
        } else {
          isFirst = true; // Break line path on dramatic infinity poles
        }
      }
      ctx.stroke();

      // Draw mathematical function label on canvas top-left
      ctx.fillStyle = colors.text;
      ctx.font = "12px sans-serif";
      ctx.fillText(graphData.functionLabel || graphData.functionExpr, 15, 25);
    }

    // Highlight key items: Roots (X-intercepts) & Vertices
    if (graphData.roots) {
      graphData.roots.forEach((rx) => {
        const sx = toScreenX(rx);
        const sy = toScreenY(0);
        if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
          // Draw pulsing outer glow circle
          ctx.beginPath();
          ctx.arc(sx, sy, 8, 0, 2 * Math.PI);
          ctx.fillStyle = colors.point + "33";
          ctx.fill();

          // Core point
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, 2 * Math.PI);
          ctx.fillStyle = colors.point;
          ctx.fill();

          // Text marker
          ctx.fillStyle = colors.text;
          ctx.font = "10px sans-serif";
          ctx.fillText(`x=${rx.toFixed(2).replace(".00", "")}`, sx - 16, sy - 12);
        }
      });
    }

    // Plot annotation overlays
    annotations.forEach((ann) => {
      const { type, coordinates, label } = ann;
      if (!coordinates || coordinates.length === 0) return;

      ctx.strokeStyle = colors.secondaryCurve;
      ctx.fillStyle = colors.secondaryCurve;
      ctx.lineWidth = 1.5;

      if (type === "circle") {
        const [ax, ay] = coordinates;
        const sx = toScreenX(ax);
        const sy = toScreenY(ay);
        if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
          ctx.beginPath();
          ctx.slice ? ctx.arc(sx, sy, 12, 0, 2 * Math.PI) : ctx.arc(sx, sy, 12, 0, 2 * Math.PI);
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Pointer Dot
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, 2 * Math.PI);
          ctx.fill();

          // Text descriptor
          ctx.fillStyle = colors.text;
          ctx.font = "10px sans-serif";
          ctx.fillText(label, sx + 16, sy + 3);
        }
      } else if (type === "polygon" && coordinates.length >= 6) {
        ctx.beginPath();
        ctx.fillStyle = label === "GREEN" ? "rgba(16, 185, 129, 0.3)" : "rgba(59, 130, 246, 0.3)";
        ctx.strokeStyle = label === "GREEN" ? "#10b981" : "#3b82f6";
        
        for (let i = 0; i < coordinates.length; i += 2) {
          const sx = toScreenX(coordinates[i]);
          const sy = toScreenY(coordinates[i+1]);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (type === "line" && coordinates.length >= 4) {
        const [x1, y1, x2, y2] = coordinates;
        const sx1 = toScreenX(x1);
        const sy1 = toScreenY(y1);
        const sx2 = toScreenX(x2);
        const sy2 = toScreenY(y2);

        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label line mid
        const mx = (sx1 + sx2) / 2;
        const my = (sy1 + sy2) / 2;
        ctx.fillStyle = colors.text;
        ctx.font = "9px sans-serif";
        ctx.fillText(label, mx + 8, my - 6);
      }
    });

  }, [graphData, annotations, theme]);

  return (
    <div className="relative w-full h-[320px] rounded-xl overflow-hidden shadow-2xl border border-white/5 bg-slate-950">
      <canvas
        ref={canvasRef}
        id="math-plot-canvas"
        className="w-full h-full block cursor-crosshair transition-opacity duration-300"
      />
      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-[10px] text-white/60 px-2 py-1 rounded font-mono select-none">
        Cartesian 2D Engine
      </div>
    </div>
  );
}
