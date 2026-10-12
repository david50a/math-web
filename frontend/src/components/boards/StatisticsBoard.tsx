import React, { useEffect, useRef, useState, useMemo } from "react";
import { ThemeType } from "../../types";
import { BOARD_THEMES } from "./themePalette";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Calculator,
  RotateCcw
} from "lucide-react";

interface StatisticsBoardProps {
  equationStr?: string;
  theme: ThemeType;
}

export default function StatisticsBoard({
  equationStr = "",
  theme
}: StatisticsBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [showBellCurve, setShowBellCurve] = useState<boolean>(true);
  const [showBoxPlot, setShowBoxPlot] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"visual" | "metrics">("visual");

  // Check if input is a paired dataset for linear regression / correlation
  const regressionData = useMemo(() => {
    const raw = equationStr.toLowerCase();
    const hasRegKeyword =
      raw.includes("regression") ||
      raw.includes("linreg") ||
      raw.includes("correlation") ||
      raw.includes("least_squares");

    // Extract pairs: [(1, 2), (2, 3)] or [1, 2], [3, 4]
    const pairs: { x: number; y: number }[] = [];
    const parenMatches = Array.from(
      equationStr.matchAll(/[\(\[]\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*[\)\]]/g)
    );
    for (const m of parenMatches) {
      pairs.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
    }

    if (pairs.length < 2 && !hasRegKeyword) return null;
    const effectivePairs =
      pairs.length >= 2
        ? pairs
        : [
            { x: 1, y: 2.2 },
            { x: 2, y: 3.8 },
            { x: 3, y: 4.9 },
            { x: 4, y: 7.1 },
            { x: 5, y: 8.5 }
          ];

    const n = effectivePairs.length;
    const sumX = effectivePairs.reduce((acc, p) => acc + p.x, 0);
    const sumY = effectivePairs.reduce((acc, p) => acc + p.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;
    const ssXX = effectivePairs.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0);
    const ssYY = effectivePairs.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0);
    const ssXY = effectivePairs.reduce((acc, p) => acc + (p.x - meanX) * (p.y - meanY), 0);
    const slope = ssXX > 1e-9 ? ssXY / ssXX : 0;
    const intercept = meanY - slope * meanX;
    const denom = Math.sqrt(ssXX * ssYY);
    const r = denom > 1e-9 ? ssXY / denom : 0;
    const r2 = r * r;

    return {
      pairs: effectivePairs,
      n,
      meanX: Math.round(meanX * 100) / 100,
      meanY: Math.round(meanY * 100) / 100,
      slope: Math.round(slope * 1000) / 1000,
      intercept: Math.round(intercept * 1000) / 1000,
      r: Math.round(r * 10000) / 10000,
      r2: Math.round(r2 * 10000) / 10000
    };
  }, [equationStr]);

  // Extract raw numbers from input or fallback to balanced dataset
  const dataset = useMemo(() => {
    const raw = equationStr;
    const arrayMatch = raw.match(/\[(.*?)\]/);
    if (arrayMatch && !regressionData) {
      const nums = arrayMatch[1]
        .split(",")
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n));
      if (nums.length > 0) return nums.sort((a, b) => a - b);
    }
    // Default standard statistics distribution
    return [10, 15, 18, 20, 22, 25, 25, 28, 30, 35, 40, 50];
  }, [equationStr, regressionData]);

  // Compute key statistical metrics
  const stats = useMemo(() => {
    const n = dataset.length;
    if (n === 0) return null;

    const sum = dataset.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;

    // Median
    const mid = Math.floor(n / 2);
    const median = n % 2 === 0 ? (dataset[mid - 1] + dataset[mid]) / 2 : dataset[mid];

    // Quartiles
    const lowerHalf = dataset.slice(0, mid);
    const upperHalf = n % 2 === 0 ? dataset.slice(mid) : dataset.slice(mid + 1);
    const q1 =
      lowerHalf.length > 0
        ? lowerHalf.length % 2 === 0
          ? (lowerHalf[lowerHalf.length / 2 - 1] + lowerHalf[lowerHalf.length / 2]) / 2
          : lowerHalf[Math.floor(lowerHalf.length / 2)]
        : dataset[0];
    const q3 =
      upperHalf.length > 0
        ? upperHalf.length % 2 === 0
          ? (upperHalf[upperHalf.length / 2 - 1] + upperHalf[upperHalf.length / 2]) / 2
          : upperHalf[Math.floor(upperHalf.length / 2)]
        : dataset[n - 1];

    const min = dataset[0];
    const max = dataset[n - 1];
    const range = max - min;
    const iqr = q3 - q1;

    // Variance & Standard Deviation (Sample vs Population)
    const popVariance = dataset.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const popStdDev = Math.sqrt(popVariance);
    const sampleVariance =
      n > 1 ? dataset.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1) : 0;
    const sampleStdDev = Math.sqrt(sampleVariance);

    // Mode
    const freqMap: Record<number, number> = {};
    let maxFreq = 0;
    let modeVal = dataset[0];
    dataset.forEach((val) => {
      freqMap[val] = (freqMap[val] || 0) + 1;
      if (freqMap[val] > maxFreq) {
        maxFreq = freqMap[val];
        modeVal = val;
      }
    });

    return {
      n,
      sum: Math.round(sum * 100) / 100,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      q1: Math.round(q1 * 100) / 100,
      q3: Math.round(q3 * 100) / 100,
      min,
      max,
      range,
      iqr: Math.round(iqr * 100) / 100,
      stdDev: Math.round(popStdDev * 100) / 100,
      sampleStdDev: Math.round(sampleStdDev * 100) / 100,
      variance: Math.round(popVariance * 100) / 100,
      mode: maxFreq > 1 ? modeVal : "None"
    };
  }, [dataset]);

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

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    // A. SCATTER PLOT & LINEAR REGRESSION MODE
    if (regressionData) {
      const { pairs, slope, intercept, r } = regressionData;
      const padX = 50;
      const padY = 40;
      const plotW = width - padX * 2;
      const plotH = height - padY * 2;

      const minX = Math.min(...pairs.map((p) => p.x)) - 1;
      const maxX = Math.max(...pairs.map((p) => p.x)) + 1;
      const minY = Math.min(...pairs.map((p) => p.y)) - 1;
      const maxY = Math.max(...pairs.map((p) => p.y)) + 1;

      const toScreenX = (x: number) => padX + ((x - minX) / (maxX - minX)) * plotW;
      const toScreenY = (y: number) => height - padY - ((y - minY) / (maxY - minY)) * plotH;

      // Axes
      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padX, toScreenY(minY));
      ctx.lineTo(width - padX, toScreenY(minY));
      ctx.moveTo(toScreenX(minX), padY);
      ctx.lineTo(toScreenX(minX), height - padY);
      ctx.stroke();

      // Regression Line
      const x1 = minX;
      const y1 = slope * x1 + intercept;
      const x2 = maxX;
      const y2 = slope * x2 + intercept;

      ctx.beginPath();
      ctx.strokeStyle = colors.secondaryCurve;
      ctx.lineWidth = 2.5;
      ctx.moveTo(toScreenX(x1), toScreenY(y1));
      ctx.lineTo(toScreenX(x2), toScreenY(y2));
      ctx.stroke();

      // Scatter Points
      pairs.forEach((pt) => {
        const sx = toScreenX(pt.x);
        const sy = toScreenY(pt.y);

        // Residual line to fit
        const yPred = slope * pt.x + intercept;
        ctx.beginPath();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = "#ffffff33";
        ctx.lineWidth = 1;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, toScreenY(yPred));
        ctx.stroke();
        ctx.setLineDash([]);

        // Point
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = colors.point;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Regression Formula Label
      ctx.fillStyle = colors.secondaryCurve;
      ctx.font = "bold 12px monospace";
      const signB = intercept >= 0 ? `+ ${intercept}` : `- ${Math.abs(intercept)}`;
      ctx.fillText(`y = ${slope}x ${signB}  (r = ${r})`, padX + 10, padY + 16);

      return;
    }

    // B. UNIVARIATE DISTRIBUTION MODE
    if (!stats) return;

    const paddingX = 40;
    const chartW = width - paddingX * 2;
    const chartH = height * 0.55;
    const chartBaseY = height * 0.65;

    const minX = Math.min(stats.min - 5, stats.mean - 3 * stats.stdDev);
    const maxX = Math.max(stats.max + 5, stats.mean + 3 * stats.stdDev);

    const toScreenX = (val: number) => paddingX + ((val - minX) / (maxX - minX)) * chartW;

    // 1. Grid & Axes
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingX, chartBaseY);
    ctx.lineTo(width - paddingX, chartBaseY);
    ctx.stroke();

    // 2. Frequency Histogram / Bins
    const numBins = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(stats.n))));
    const binSize = (maxX - minX) / numBins;
    const bins: number[] = new Array(numBins).fill(0);

    dataset.forEach((val) => {
      const idx = Math.min(numBins - 1, Math.max(0, Math.floor((val - minX) / binSize)));
      bins[idx]++;
    });

    const maxBinCount = Math.max(...bins, 1);

    bins.forEach((count, idx) => {
      const bMin = minX + idx * binSize;
      const bMax = bMin + binSize;
      const sx1 = toScreenX(bMin) + 2;
      const sx2 = toScreenX(bMax) - 2;
      const bW = sx2 - sx1;
      const bH = (count / maxBinCount) * (chartH - 20);
      const sy = chartBaseY - bH;

      // Bar fill & stroke
      ctx.fillStyle = `${colors.curve}26`;
      ctx.fillRect(sx1, sy, bW, bH);
      ctx.strokeStyle = colors.curve;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx1, sy, bW, bH);

      // Frequency label
      if (count > 0) {
        ctx.fillStyle = colors.text;
        ctx.font = "bold 9px monospace";
        ctx.fillText(count.toString(), sx1 + bW / 2 - 4, sy - 4);
      }
    });

    // 3. Normal Distribution Bell Curve Overlay
    if (showBellCurve && stats.stdDev > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = colors.secondaryCurve;
      ctx.lineWidth = 2.5;

      const normFn = (x: number) => {
        const exponent = -0.5 * Math.pow((x - stats.mean) / stats.stdDev, 2);
        return Math.exp(exponent);
      };

      let isFirst = true;
      for (let px = paddingX; px <= width - paddingX; px += 2) {
        const xVal = minX + ((px - paddingX) / chartW) * (maxX - minX);
        const yNorm = normFn(xVal);
        const py = chartBaseY - yNorm * (chartH - 25);
        if (isFirst) {
          ctx.moveTo(px, py);
          isFirst = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. Mean & Median Vertical Lines
    const meanX = toScreenX(stats.mean);
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = colors.secondaryCurve;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(meanX, 20);
    ctx.lineTo(meanX, chartBaseY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = colors.secondaryCurve;
    ctx.font = "bold 10px monospace";
    ctx.fillText(`μ = ${stats.mean}`, meanX + 4, 30);

    const medianX = toScreenX(stats.median);
    ctx.beginPath();
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.moveTo(medianX, 35);
    ctx.lineTo(medianX, chartBaseY);
    ctx.stroke();

    ctx.fillStyle = colors.accent;
    ctx.font = "bold 10px monospace";
    ctx.fillText(`Med = ${stats.median}`, medianX + 4, 45);

    // 5. Box-and-Whisker Plot below baseline
    if (showBoxPlot) {
      const boxY = height * 0.82;
      const boxH = 20;

      const sMin = toScreenX(stats.min);
      const sQ1 = toScreenX(stats.q1);
      const sMed = toScreenX(stats.median);
      const sQ3 = toScreenX(stats.q3);
      const sMax = toScreenX(stats.max);

      // Whisker Line
      ctx.beginPath();
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 1.5;
      ctx.moveTo(sMin, boxY + boxH / 2);
      ctx.lineTo(sMax, boxY + boxH / 2);
      ctx.stroke();

      // Caps
      ctx.beginPath();
      ctx.moveTo(sMin, boxY + 2);
      ctx.lineTo(sMin, boxY + boxH - 2);
      ctx.moveTo(sMax, boxY + 2);
      ctx.lineTo(sMax, boxY + boxH - 2);
      ctx.stroke();

      // IQR Box
      ctx.fillStyle = `${colors.accent}33`;
      ctx.fillRect(sQ1, boxY, sQ3 - sQ1, boxH);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(sQ1, boxY, sQ3 - sQ1, boxH);

      // Median line
      ctx.beginPath();
      ctx.strokeStyle = colors.point;
      ctx.lineWidth = 2.5;
      ctx.moveTo(sMed, boxY);
      ctx.lineTo(sMed, boxY + boxH);
      ctx.stroke();

      // Labels
      ctx.fillStyle = colors.textMuted;
      ctx.font = "9px monospace";
      ctx.fillText(`Min: ${stats.min}`, sMin - 15, boxY + boxH + 12);
      ctx.fillText(`Q1: ${stats.q1}`, sQ1 - 10, boxY - 4);
      ctx.fillText(`Q3: ${stats.q3}`, sQ3 - 10, boxY - 4);
      ctx.fillText(`Max: ${stats.max}`, sMax - 10, boxY + boxH + 12);
    }
  }, [dataset, stats, regressionData, showBellCurve, showBoxPlot, theme]);

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
            {regressionData ? (
              <>
                <TrendingUp className="w-3.5 h-3.5" />
                <span>OLS Linear Regression (N = {regressionData.n})</span>
              </>
            ) : (
              <>
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Distribution Analysis (N = {stats?.n})</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!regressionData && (
            <>
              <button
                onClick={() => setShowBellCurve(!showBellCurve)}
                className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
                  showBellCurve
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-white/5 text-white/60 hover:text-white border-white/10"
                }`}
              >
                <Activity className="w-3 h-3" />
                Bell Curve
              </button>

              <button
                onClick={() => setShowBoxPlot(!showBoxPlot)}
                className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
                  showBoxPlot
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                    : "bg-white/5 text-white/60 hover:text-white border-white/10"
                }`}
              >
                <Layers className="w-3 h-3" />
                Box Plot
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab(activeTab === "visual" ? "metrics" : "visual")}
            className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
              activeTab === "metrics"
                ? "bg-purple-500/30 text-purple-200 border-purple-500/40 font-bold"
                : "bg-white/5 text-white/70 hover:text-white border-white/10"
            }`}
          >
            <Calculator className="w-3 h-3" />
            {activeTab === "visual" ? "Summary Metrics" : "Visual Chart"}
          </button>
        </div>
      </div>

      {/* Main Area: Visual Canvas vs Full Metrics Table */}
      {activeTab === "visual" ? (
        <div className="relative flex-1 min-h-[280px] w-full overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
      ) : (
        <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
          {regressionData ? (
            <div className="space-y-3">
              <h4 className="text-amber-400 font-bold text-sm">Linear Regression Model Parameters</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Pearson Correlation (r)</span>
                  <span className="text-emerald-400 font-bold text-sm">{regressionData.r}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">R² Determination</span>
                  <span className="text-cyan-400 font-bold text-sm">{regressionData.r2}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Slope (m)</span>
                  <span className="text-amber-300 font-bold text-sm">{regressionData.slope}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Intercept (b)</span>
                  <span className="text-purple-300 font-bold text-sm">{regressionData.intercept}</span>
                </div>
              </div>
            </div>
          ) : stats ? (
            <div className="space-y-3">
              <h4 className="text-cyan-400 font-bold text-sm">Comprehensive Statistical Moments</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Sample Mean (x̄)</span>
                  <span className="text-emerald-400 font-bold text-sm">{stats.mean}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Median (Q2)</span>
                  <span className="text-cyan-400 font-bold text-sm">{stats.median}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Sample StdDev (s)</span>
                  <span className="text-amber-300 font-bold text-sm">{stats.sampleStdDev}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Pop StdDev (σ)</span>
                  <span className="text-purple-300 font-bold text-sm">{stats.stdDev}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Q1 (25th %)</span>
                  <span className="text-white font-bold">{stats.q1}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Q3 (75th %)</span>
                  <span className="text-white font-bold">{stats.q3}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">IQR (Q3 - Q1)</span>
                  <span className="text-white font-bold">{stats.iqr}</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10">
                  <span className="text-white/50 text-[10px] block">Range (Max - Min)</span>
                  <span className="text-white font-bold">{stats.range}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Bottom Metric Cards */}
      <div
        className="px-3.5 py-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{
          borderColor: activeColors.cardBorder,
          backgroundColor: activeColors.cardBg
        }}
      >
        {regressionData ? (
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <div className="flex items-center gap-1">
              <span className="text-white/50 text-[10px]">Model:</span>
              <span className="text-amber-300 font-bold">
                y = {regressionData.slope}x {regressionData.intercept >= 0 ? `+ ${regressionData.intercept}` : `- ${Math.abs(regressionData.intercept)}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/50 text-[10px]">Pearson r:</span>
              <span className="text-emerald-400 font-bold">{regressionData.r}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/50 text-[10px]">R²:</span>
              <span className="text-cyan-300 font-bold">{regressionData.r2}</span>
            </div>
          </div>
        ) : stats ? (
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <div className="flex items-center gap-1">
              <span className="text-white/50 text-[10px]">Mean μ:</span>
              <span className="text-amber-300 font-bold">{stats.mean}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/50 text-[10px]">Median:</span>
              <span className="text-cyan-300 font-bold">{stats.median}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/50 text-[10px]">StdDev s:</span>
              <span className="text-emerald-400 font-bold">{stats.sampleStdDev}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/50 text-[10px]">IQR:</span>
              <span className="text-purple-300 font-bold">{stats.iqr}</span>
            </div>
          </div>
        ) : null}

        <div className="text-[10px] text-white/40 font-mono">
          Axiom Statistical Engine
        </div>
      </div>
    </div>
  );
}
