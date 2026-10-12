import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { ThemeType } from "../../types";
import { BOARD_THEMES } from "./themePalette";
import {
  Scale,
  Sparkles,
  TrendingUp,
  RotateCcw,
  Maximize2,
  CheckCircle2
} from "lucide-react";

interface DualEquationBoardProps {
  equationStr?: string;
  theme: ThemeType;
}

export default function DualEquationBoard({
  equationStr = "2x + 5 = 15",
  theme
}: DualEquationBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Split into LHS and RHS expressions
  const { lhsStr, rhsStr } = useMemo(() => {
    const parts = equationStr.split("=");
    if (parts.length >= 2) {
      return { lhsStr: parts[0].trim(), rhsStr: parts[1].trim() };
    }
    return { lhsStr: equationStr, rhsStr: "0" };
  }, [equationStr]);

  // Evaluators for LHS and RHS
  const evalLhs = useCallback((xVal: number): number => {
    try {
      let s = lhsStr
        .replace(/Math\./g, "")
        .replace(/\^/g, "**")
        .replace(/(\d)([a-zA-Z])/g, "$1*$2");
      const fn = new Function("x", `return ${s};`);
      const val = fn(xVal);
      return isNaN(val) || !isFinite(val) ? 0 : val;
    } catch {
      return 2 * xVal + 5;
    }
  }, [lhsStr]);

  const evalRhs = useCallback((xVal: number): number => {
    try {
      let s = rhsStr
        .replace(/Math\./g, "")
        .replace(/\^/g, "**")
        .replace(/(\d)([a-zA-Z])/g, "$1*$2");
      const fn = new Function("x", `return ${s};`);
      const val = fn(xVal);
      return isNaN(val) || !isFinite(val) ? 0 : val;
    } catch {
      return 15;
    }
  }, [rhsStr]);

  // Find intersection point(s) where LHS == RHS
  const intersections = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    let prevDiff = evalLhs(-10) - evalRhs(-10);

    for (let x = -9.9; x <= 10; x += 0.1) {
      const diff = evalLhs(x) - evalRhs(x);
      if ((prevDiff <= 0 && diff >= 0) || (prevDiff >= 0 && diff <= 0)) {
        // Interpolate zero
        const rootX = x - 0.1 + (-prevDiff * 0.1) / (diff - prevDiff);
        const rootY = evalLhs(rootX);
        if (!pts.some((p) => Math.abs(p.x - rootX) < 0.2)) {
          pts.push({
            x: Math.round(rootX * 100) / 100,
            y: Math.round(rootY * 100) / 100
          });
        }
      }
      prevDiff = diff;
    }
    return pts;
  }, [evalLhs, evalRhs]);

  // Canvas Drawing
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

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    // Compute bounds centered on first intersection
    const centerPoint = intersections[0] || { x: 0, y: 0 };
    const spanX = 14;
    const spanY = 16;
    const minX = centerPoint.x - spanX / 2;
    const maxX = centerPoint.x + spanX / 2;
    const minY = centerPoint.y - spanY / 2;
    const maxY = centerPoint.y + spanY / 2;

    const toScreenX = (x: number) => ((x - minX) / (maxX - minX)) * width;
    const toScreenY = (y: number) => height - ((y - minY) / (maxY - minY)) * height;
    const toMathX = (px: number) => minX + (px / width) * (maxX - minX);

    // Grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(minX); gx <= maxX; gx += 2) {
      const sx = toScreenX(gx);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }
    for (let gy = Math.ceil(minY); gy <= maxY; gy += 2) {
      const sy = toScreenY(gy);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // Axes
    const ox = toScreenX(0);
    const oy = toScreenY(0);
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1.5;
    if (ox >= 0 && ox <= width) {
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, height);
      ctx.stroke();
    }
    if (oy >= 0 && oy <= height) {
      ctx.beginPath();
      ctx.moveTo(0, oy);
      ctx.lineTo(width, oy);
      ctx.stroke();
    }

    // Curve 1: y = LHS
    ctx.beginPath();
    ctx.strokeStyle = colors.curve;
    ctx.lineWidth = 2.5;
    let isFirst = true;
    for (let px = 0; px <= width; px += 2) {
      const xVal = toMathX(px);
      const yVal = evalLhs(xVal);
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
    }
    ctx.stroke();

    // Curve 2: y = RHS
    ctx.beginPath();
    ctx.strokeStyle = colors.secondaryCurve;
    ctx.lineWidth = 2.5;
    isFirst = true;
    for (let px = 0; px <= width; px += 2) {
      const xVal = toMathX(px);
      const yVal = evalRhs(xVal);
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
    }
    ctx.stroke();

    // Intersection Points (Solution Points)
    intersections.forEach((pt) => {
      const sx = toScreenX(pt.x);
      const sy = toScreenY(pt.y);

      // Vertical dashed projection to X-axis
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.setLineDash([3, 3]);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, Math.min(height, Math.max(0, oy)));
      ctx.stroke();
      ctx.restore();

      // Glowing outer ring
      ctx.beginPath();
      ctx.arc(sx, sy, 10, 0, Math.PI * 2);
      ctx.fillStyle = `${colors.point}33`;
      ctx.fill();

      // Intersection Point
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = colors.point;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Solution Callout
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`Solution: x = ${pt.x}`, sx + 10, sy - 8);
    });
  }, [lhsStr, rhsStr, evalLhs, evalRhs, intersections, theme]);

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
            <Scale className="w-3.5 h-3.5" />
            <span>Dual Plot: {lhsStr} = {rhsStr}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeColors.curve }} />
            <span className="text-white/70">y₁ = {lhsStr}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeColors.secondaryCurve }} />
            <span className="text-white/70">y₂ = {rhsStr}</span>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 min-h-[280px] w-full overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Bottom Solution Readout */}
      <div
        className="px-3.5 py-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{
          borderColor: activeColors.cardBorder,
          backgroundColor: activeColors.cardBg
        }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-white/60">Equilibrium Solution:</span>
          {intersections.length > 0 ? (
            <div className="flex gap-2 font-mono font-bold text-emerald-400">
              {intersections.map((pt, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                  x = {pt.x}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-amber-300 font-mono">No real intersection in view</span>
          )}
        </div>

        <div className="text-[10px] text-white/40 font-mono">
          Dual-Plot Equation Balance Board
        </div>
      </div>
    </div>
  );
}
