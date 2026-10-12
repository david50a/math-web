import React, { useEffect, useRef, useState, useMemo } from "react";
import { ThemeType } from "../../types";
import { BOARD_THEMES } from "./themePalette";
import {
  RotateCcw,
  Sparkles,
  Activity,
  Maximize2,
  Layers,
  CircleDot
} from "lucide-react";

interface TrigBoardProps {
  equationStr?: string;
  theme: ThemeType;
}

export default function TrigBoard({
  equationStr = "",
  theme
}: TrigBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Angle theta in radians
  const [angleRad, setAngleRad] = useState<number>(Math.PI / 4); // 45 deg default
  const [showWave, setShowWave] = useState<boolean>(true);
  const [showTangentLine, setShowTangentLine] = useState<boolean>(true);
  const [isDraggingAngle, setIsDraggingAngle] = useState<boolean>(false);

  // Parse preset angle if present in equation (e.g. unit_circle(pi/3))
  useEffect(() => {
    const raw = equationStr.toLowerCase();
    if (raw.includes("pi/6")) setAngleRad(Math.PI / 6);
    else if (raw.includes("pi/4")) setAngleRad(Math.PI / 4);
    else if (raw.includes("pi/3")) setAngleRad(Math.PI / 3);
    else if (raw.includes("pi/2")) setAngleRad(Math.PI / 2);
    else if (raw.includes("pi")) setAngleRad(Math.PI);
  }, [equationStr]);

  const degVal = Math.round(((angleRad * 180) / Math.PI) % 360);
  const sinVal = Math.sin(angleRad);
  const cosVal = Math.cos(angleRad);
  const tanVal = Math.tan(angleRad);

  // Exact representation lookup
  const exactLabel = useMemo(() => {
    const d = ((degVal % 360) + 360) % 360;
    if (d === 0) return { rad: "0", sin: "0", cos: "1" };
    if (d === 30) return { rad: "π/6", sin: "1/2", cos: "√3/2" };
    if (d === 45) return { rad: "π/4", sin: "√2/2", cos: "√2/2" };
    if (d === 60) return { rad: "π/3", sin: "√3/2", cos: "1/2" };
    if (d === 90) return { rad: "π/2", sin: "1", cos: "0" };
    if (d === 180) return { rad: "π", sin: "0", cos: "-1" };
    if (d === 270) return { rad: "3π/2", sin: "-1", cos: "0" };
    return {
      rad: `${(angleRad / Math.PI).toFixed(2)}π`,
      sin: sinVal.toFixed(3),
      cos: cosVal.toFixed(3)
    };
  }, [degVal, angleRad, sinVal, cosVal]);

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

    // Clear Background
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    // Layout: Left half is Unit Circle, Right half is Sine Wave
    const circleWidth = showWave ? width * 0.52 : width;
    const circleCx = circleWidth / 2;
    const circleCy = height / 2;
    const radius = Math.min(circleWidth * 0.36, height * 0.36, 110);

    // 1. UNIT CIRCLE
    // Background Grid
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(circleCx, circleCy, radius * 0.5, 0, Math.PI * 2);
    ctx.arc(circleCx, circleCy, radius * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // Circle Axes
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(circleCx - radius - 20, circleCy);
    ctx.lineTo(circleCx + radius + 20, circleCy);
    ctx.moveTo(circleCx, circleCy - radius - 20);
    ctx.lineTo(circleCx, circleCy + radius + 20);
    ctx.stroke();

    // Unit Circle Circumference
    ctx.beginPath();
    ctx.arc(circleCx, circleCy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = colors.curve;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Key points on circle (-1, 0, 1)
    ctx.fillStyle = colors.textMuted;
    ctx.font = "9px monospace";
    ctx.fillText("1", circleCx + radius + 4, circleCy + 10);
    ctx.fillText("-1", circleCx - radius - 14, circleCy + 10);
    ctx.fillText("1", circleCx + 4, circleCy - radius - 4);
    ctx.fillText("-1", circleCx + 4, circleCy + radius + 12);

    // Revolving point P on circle
    const px = circleCx + Math.cos(angleRad) * radius;
    const py = circleCy - Math.sin(angleRad) * radius;

    // Angle Arc
    ctx.beginPath();
    ctx.arc(circleCx, circleCy, 24, 0, -angleRad, true);
    ctx.strokeStyle = colors.secondaryCurve;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Projection Triangle:
    // Base (cos): (circleCx, circleCy) -> (px, circleCy)
    ctx.beginPath();
    ctx.strokeStyle = "#38bdf8"; // Light blue for cos
    ctx.lineWidth = 3;
    ctx.moveTo(circleCx, circleCy);
    ctx.lineTo(px, circleCy);
    ctx.stroke();

    // Height (sin): (px, circleCy) -> (px, py)
    ctx.beginPath();
    ctx.strokeStyle = "#4ade80"; // Mint green for sin
    ctx.lineWidth = 3;
    ctx.moveTo(px, circleCy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Radial ray (hypotenuse = 1)
    ctx.beginPath();
    ctx.strokeStyle = colors.point;
    ctx.lineWidth = 2;
    ctx.moveTo(circleCx, circleCy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Tangent segment if enabled
    if (showTangentLine && Math.abs(cosVal) > 0.05) {
      const tanScreenLen = Math.tan(angleRad) * radius;
      const tanX = circleCx + radius;
      const tanY = circleCy - tanScreenLen;

      if (Math.abs(tanY - circleCy) < height * 0.8) {
        ctx.save();
        ctx.strokeStyle = "#ec4899"; // Pink for tan
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(circleCx, circleCy);
        ctx.lineTo(tanX, tanY);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 2.5;
        ctx.moveTo(tanX, circleCy);
        ctx.lineTo(tanX, tanY);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Point P dot
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = colors.point;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Coordinate Label at P
    ctx.fillStyle = colors.text;
    ctx.font = "bold 10px monospace";
    ctx.fillText(`P(${cosVal.toFixed(2)}, ${sinVal.toFixed(2)})`, px + 8, py - 6);

    // 2. SYNCHRONIZED SINE WAVE
    if (showWave) {
      const waveX0 = circleWidth + 10;
      const waveWidth = width - waveX0 - 15;
      const waveCy = circleCy;

      // Wave Axis
      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(waveX0, waveCy);
      ctx.lineTo(waveX0 + waveWidth, waveCy);
      ctx.stroke();

      // Connector line from circle point to wave point
      ctx.save();
      ctx.strokeStyle = "rgba(74, 222, 128, 0.4)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(waveX0 + ((angleRad % (Math.PI * 2)) / (Math.PI * 2)) * waveWidth, py);
      ctx.stroke();
      ctx.restore();

      // Sine Wave Curve
      ctx.beginPath();
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      for (let x = 0; x <= waveWidth; x += 2) {
        const rad = (x / waveWidth) * Math.PI * 2;
        const wy = waveCy - Math.sin(rad) * radius;
        if (x === 0) ctx.moveTo(waveX0 + x, wy);
        else ctx.lineTo(waveX0 + x, wy);
      }
      ctx.stroke();

      // Active point on wave
      const activeWaveX = waveX0 + ((angleRad % (Math.PI * 2)) / (Math.PI * 2)) * waveWidth;
      ctx.beginPath();
      ctx.arc(activeWaveX, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#4ade80";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Wave Label
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 10px monospace";
      ctx.fillText("y = sin(θ)", waveX0 + 4, 18);
    }
  }, [angleRad, showWave, showTangentLine, theme, cosVal, sinVal]);

  // Handle Drag on Unit Circle
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDraggingAngle(true);
    handleAngleChangeFromMouse(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingAngle) {
      handleAngleChangeFromMouse(e);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingAngle(false);
  };

  const handleAngleChangeFromMouse = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const circleWidth = showWave ? rect.width * 0.52 : rect.width;
    const cx = circleWidth / 2;
    const cy = rect.height / 2;

    const dx = px - cx;
    const dy = cy - py; // Invert Y
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;
    setAngleRad(angle);
  };

  const PRESET_ANGLES = [
    { label: "0°", rad: 0 },
    { label: "30° (π/6)", rad: Math.PI / 6 },
    { label: "45° (π/4)", rad: Math.PI / 4 },
    { label: "60° (π/3)", rad: Math.PI / 3 },
    { label: "90° (π/2)", rad: Math.PI / 2 },
    { label: "180° (π)", rad: Math.PI },
    { label: "270° (3π/2)", rad: (3 * Math.PI) / 2 }
  ];

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
            <CircleDot className="w-3.5 h-3.5 animate-pulse" />
            <span>Unit Circle (θ = {degVal}° / {exactLabel.rad})</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowWave(!showWave)}
            className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
              showWave
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-white/5 text-white/60 hover:text-white border-white/10"
            }`}
          >
            <Activity className="w-3 h-3" />
            Wave Sync
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 min-h-[280px] w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="w-full h-full cursor-crosshair block"
        />
      </div>

      {/* Angle Selector & Presets */}
      <div
        className="px-3.5 py-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{
          borderColor: activeColors.cardBorder,
          backgroundColor: activeColors.cardBg
        }}
      >
        <div className="flex items-center gap-2 font-mono">
          <span className="text-white/50 text-[10px]">θ Slider:</span>
          <input
            type="range"
            min="0"
            max={Math.PI * 2}
            step="0.05"
            value={angleRad}
            onChange={(e) => setAngleRad(parseFloat(e.target.value))}
            className="w-24 accent-amber-400 cursor-pointer"
          />
          <span className="text-amber-300 font-bold">{degVal}°</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {PRESET_ANGLES.map((pa) => (
            <button
              key={pa.label}
              onClick={() => setAngleRad(pa.rad)}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition cursor-pointer"
            >
              {pa.label}
            </button>
          ))}
        </div>

        {/* Readout Values */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[#38bdf8] font-bold">cos:</span>
            <span className="text-white font-bold">{exactLabel.cos}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#4ade80] font-bold">sin:</span>
            <span className="text-white font-bold">{exactLabel.sin}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#ec4899] font-bold">tan:</span>
            <span className="text-white font-bold">
              {Math.abs(cosVal) < 0.01 ? "undef" : tanVal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
