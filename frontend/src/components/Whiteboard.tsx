import React, { useEffect, useRef } from "react";
import { VideoScene, ThemeType } from "../types";
import { Sparkles, Terminal, Cpu, GraduationCap, BookOpen } from "lucide-react";

export function KatexMath({ math = "", block = false }: { math?: string; block?: boolean; key?: React.Key }) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const cleanMath = (math || "").trim()
      .replace(/^\\\[\s*/, "")
      .replace(/\s*\\\]$/, "")
      .replace(/^\\\(\s*/, "")
      .replace(/\s*\\\)$/, "")
      .replace(/^\$\$\s*/, "")
      .replace(/\s*\$\$$/, "")
      .replace(/^\$\s*/, "")
      .replace(/\s*\$$/, "");

    try {
      if ((window as any).katex && cleanMath) {
        (window as any).katex.render(cleanMath, containerRef.current, {
          displayMode: block,
          throwOnError: false,
        });
      } else {
        containerRef.current.textContent = cleanMath || "";
      }
    } catch (err) {
      console.error("KaTeX rendering error:", err);
      containerRef.current.textContent = cleanMath || "";
    }
  }, [math, block]);

  return <span ref={containerRef} className="inline-block" />;
}

interface WhiteboardProps {
  scene: VideoScene;
  theme: ThemeType;
  isNarrating: boolean;
  typingProgress: number; // Percent of subtitle/narration text written out
}

export default function Whiteboard({ scene, theme, isNarrating, typingProgress }: WhiteboardProps) {
  
  // Theme Background and Border Overrides
  const themesList = {
    blueprint: {
      outer: "bg-[#041224] border-cyan-500/40 text-cyan-100 shadow-2xl shadow-cyan-950/50 blueprint-frame font-mono",
      boardBg: "bg-blueprint-canvas border-cyan-500/40",
      fontFamily: "font-mono-math",
      primaryText: "text-cyan-300 [text-shadow:0_0_10px_rgba(56,189,248,0.6)] font-bold",
      secondaryText: "text-sky-300 font-mono",
      accentDot: "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]",
      gridLines: "bg-[linear-gradient(rgba(56,189,248,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.12)_1px,transparent_1px),linear-gradient(rgba(56,189,248,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.04)_1px,transparent_1px)] bg-[size:50px_50px,50px_50px,10px_10px,10px_10px]"
    },
    chalkboard: {
      outer: "bg-[#0b1612] border-amber-900/30 text-[#f5f5ed] shadow-2xl shadow-black/60 academic-frame",
      boardBg: "bg-blackboard-canvas border-[rgba(212,175,55,0.25)]",
      fontFamily: "font-academic",
      primaryText: "text-[#fde047] [text-shadow:0_0_1px_rgba(255,255,255,0.9),0_0_8px_rgba(253,224,71,0.4)]", // Yellow chalk
      secondaryText: "text-[#86efac] [text-shadow:0_0_1px_rgba(255,255,255,0.8),0_0_6px_rgba(134,239,172,0.35)]",
      accentDot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
      gridLines: "bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:18px_18px]"
    },
    cosmos: {
      outer: "bg-[#060412] border-purple-500/40 text-purple-100 shadow-2xl shadow-purple-950/60 cosmos-frame",
      boardBg: "bg-cosmos-canvas border-purple-500/30",
      fontFamily: "font-sans",
      primaryText: "text-purple-300 [text-shadow:0_0_12px_rgba(168,85,247,0.7),0_0_2px_rgba(255,255,255,0.9)] font-bold",
      secondaryText: "text-amber-300 [text-shadow:0_0_8px_rgba(251,191,36,0.5)]",
      accentDot: "bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.9)]",
      gridLines: "bg-[radial-gradient(rgba(168,85,247,0.08)_1px,transparent_1px)] bg-[size:20px_20px]"
    },
    glassmorphic: {
      outer: "bg-slate-900/85 border-slate-800 text-slate-100 shadow-slate-950/30 backdrop-blur-md",
      boardBg: "bg-slate-950/40 border-slate-800/50",
      fontFamily: "font-sans",
      primaryText: "text-fuchsia-300 bg-gradient-to-r from-fuchsia-300 to-indigo-300 bg-clip-text text-transparent",
      secondaryText: "text-slate-400",
      accentDot: "bg-fuchsia-400",
      gridLines: "bg-[radial-gradient(rgba(139,92,246,0.04)_1px,transparent_1px)] bg-[size:12px_12px]"
    },
    darkroom: {
      outer: "bg-zinc-950 border-zinc-900 text-zinc-100 shadow-black",
      boardBg: "bg-black border-red-950",
      fontFamily: "font-mono",
      primaryText: "text-red-500", // laser crimson
      secondaryText: "text-zinc-500",
      accentDot: "bg-red-600",
      gridLines: "bg-[linear-gradient(rgba(244,63,94,0.02)_1px,transparent_1px)] bg-[size:10px_10px]"
    },
    cyberpunk: {
      outer: "bg-[#0d0914] border-yellow-500/40 text-yellow-100 shadow-yellow-950/30",
      boardBg: "bg-[#150d24] border-yellow-500/30",
      fontFamily: "font-mono",
      primaryText: "text-yellow-400 font-black", // Cyber neon yellow
      secondaryText: "text-cyan-400",
      accentDot: "bg-yellow-400 shadow-lg shadow-yellow-400/50",
      gridLines: "bg-[linear-gradient(rgba(234,179,8,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:18px_18px]"
    },
    sunset: {
      outer: "bg-[#1c0f0a] border-amber-800/40 text-amber-100 shadow-amber-950/30",
      boardBg: "bg-[#29140c] border-amber-700/30",
      fontFamily: "font-sans",
      primaryText: "text-amber-300 font-bold", // Golden amber glow
      secondaryText: "text-orange-300",
      accentDot: "bg-amber-500",
      gridLines: "bg-[radial-gradient(rgba(245,158,11,0.05)_1px,transparent_1px)] bg-[size:14px_14px]"
    },
    synthwave: {
      outer: "bg-[#14061f] border-pink-500/40 text-pink-100 shadow-pink-950/40",
      boardBg: "bg-[#1f0a33] border-pink-500/30",
      fontFamily: "font-mono",
      primaryText: "text-pink-400 font-bold", // Hot neon magenta
      secondaryText: "text-purple-300",
      accentDot: "bg-pink-500 shadow-lg shadow-pink-500/50",
      gridLines: "bg-[linear-gradient(rgba(236,72,153,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.06)_1px,transparent_1px)] bg-[size:20px_20px]"
    },
    nordic: {
      outer: "bg-[#0b1219] border-slate-700/50 text-slate-100 shadow-slate-950/30",
      boardBg: "bg-[#101b26] border-slate-700/40",
      fontFamily: "font-sans",
      primaryText: "text-sky-200 font-bold", // Clean arctic ice
      secondaryText: "text-slate-400",
      accentDot: "bg-sky-400",
      gridLines: "bg-[radial-gradient(rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:16px_16px]"
    },
    matrix: {
      outer: "bg-[#040d06] border-green-600/50 text-green-100 shadow-green-950/40",
      boardBg: "bg-[#061409] border-green-600/30",
      fontFamily: "font-mono",
      primaryText: "text-green-400 font-bold", // Terminal phosphor green
      secondaryText: "text-emerald-300",
      accentDot: "bg-green-500 shadow-lg shadow-green-500/50",
      gridLines: "bg-[linear-gradient(rgba(34,197,94,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.06)_1px,transparent_1px)] bg-[size:16px_16px]"
    },
    royal: {
      outer: "bg-[#180814] border-amber-500/40 text-amber-100 shadow-purple-950/40",
      boardBg: "bg-[#240c1e] border-amber-500/30",
      fontFamily: "font-sans",
      primaryText: "text-amber-300 font-black", // Royal gold
      secondaryText: "text-rose-300",
      accentDot: "bg-amber-400 shadow-lg shadow-amber-400/50",
      gridLines: "bg-[radial-gradient(rgba(245,158,11,0.06)_1px,transparent_1px)] bg-[size:16px_16px]"
    }
  };

  const isChalkboard = theme === "chalkboard";
  const isBlueprint = theme === "blueprint";
  const isCosmos = theme === "cosmos";
  const style = themesList[theme] || themesList.chalkboard;

  // Render a clean visual simulation of formula steps
  return (
    <div className={`flex flex-col h-full rounded-2xl border p-5 sm:p-6 transition-all duration-300 relative ${style.outer}`}>
      {/* Visual board watermark/header */}
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${style.accentDot} animate-pulse`} />
          <span className={`text-[11px] uppercase tracking-wider font-semibold ${
            isChalkboard 
              ? "font-scholar-title text-amber-200/90" 
              : isBlueprint 
              ? "font-mono text-cyan-300 tracking-widest" 
              : isCosmos 
              ? "font-sans font-bold text-purple-200 tracking-wider" 
              : "font-mono opacity-60"
          }`}>
            {isChalkboard 
              ? `Lemma §0${scene.sceneNumber} • ${scene.subTitle}` 
              : isBlueprint 
              ? `SPEC §0${scene.sceneNumber} // ${scene.subTitle}` 
              : isCosmos 
              ? `Harmonic Axiom §0${scene.sceneNumber} • ${scene.subTitle}` 
              : `SCENE ${scene.sceneNumber}: ${scene.subTitle}`}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] select-none ${
          isChalkboard 
            ? "bg-[#182a20] border border-amber-500/30 text-amber-300 font-scholar-title tracking-wider shadow-sm"
            : isBlueprint
            ? "bg-[#051c38] border border-cyan-500/40 text-cyan-300 font-mono tracking-widest shadow-sm"
            : isCosmos
            ? "bg-[#130b2e] border border-purple-500/40 text-purple-200 font-sans tracking-wider shadow-sm"
            : "bg-black/30 border border-white/5 text-white/50 font-mono"
        }`}>
          <Sparkles className={`w-3 h-3 animate-spin ${isChalkboard ? "text-amber-300" : isBlueprint ? "text-cyan-400" : isCosmos ? "text-purple-400" : "text-blue-400"}`} />
          {isChalkboard 
            ? "Modern Blackboard Lecture" 
            : isBlueprint 
            ? "Technical Drafting Spec [1px GRID]" 
            : isCosmos 
            ? "Sacred Geometry & Harmonics" 
            : "Whiteboard Animation Active"}
        </div>
      </div>

      {/* Main Board Canvas backdrop */}
      <div className={`flex-1 rounded-xl border relative overflow-hidden flex flex-col p-6 min-h-[170px] justify-between transition-colors duration-300 ${style.boardBg}`}>
        {/* Background Grid Pattern */}
        <div className={`absolute inset-0 pointer-events-none ${style.gridLines}`} />

        {/* Content Container */}
        <div className="relative z-10 space-y-4">
          <div className="space-y-1">
            <span className={`text-[10px] tracking-wider block uppercase ${
              isChalkboard ? "font-scholar-title text-amber-300/70" : isBlueprint ? "text-cyan-400/80 font-mono" : isCosmos ? "text-purple-300/80 font-mono" : "text-white/40 font-mono"
            }`}>
              {isChalkboard ? "Proposition Title" : isBlueprint ? "Drafting Spec Item" : isCosmos ? "Harmonic Theorem" : "Title"}
            </span>
            <h2 className={`text-xl sm:text-2xl font-semibold tracking-tight ${style.fontFamily} ${
              isChalkboard ? "text-[#f7f7f0] font-academic tracking-wide" : isBlueprint ? "text-cyan-100 font-mono" : isCosmos ? "text-purple-50 font-sans" : ""
            }`}>
              {scene.title}
            </h2>
          </div>

          <div className={`py-3 border-y ${
            isChalkboard ? "border-white/15 bg-black/15 -mx-6 px-6" : isBlueprint ? "border-cyan-500/20 bg-cyan-950/20 -mx-6 px-6" : isCosmos ? "border-purple-500/20 bg-purple-950/20 -mx-6 px-6" : "border-white/5"
          }`}>
            <span className={`text-[10px] tracking-wider block uppercase mb-1 ${
              isChalkboard ? "font-scholar-title text-amber-300/70" : isBlueprint ? "text-cyan-400/80 font-mono" : isCosmos ? "text-purple-300/80 font-mono" : "text-white/40 font-mono"
            }`}>
              {isChalkboard ? "Chalk Derivation Formula" : isBlueprint ? "Analytical Derivation" : isCosmos ? "Cosmic Fabric Derivation" : "Mathematical formula"}
            </span>
            <div className={`text-2xl sm:text-3xl font-medium tracking-wide py-1 text-center select-all select-none selection:bg-amber-400/20 overflow-x-auto whitespace-normal break-words scrollbar-none scroll-smooth ${style.fontFamily} ${style.primaryText}`}>
              <KatexMath math={scene.primaryMath} block={true} />
            </div>
          </div>

          {scene.secondaryMath && (
            <div className="space-y-1">
              <span className={`text-[10px] tracking-wider block uppercase ${
                isChalkboard ? "font-scholar-title text-emerald-400/70" : isBlueprint ? "text-sky-400/80 font-mono" : isCosmos ? "text-amber-300/80 font-mono" : "text-white/40 font-mono"
              }`}>
                {isChalkboard ? "Scholastic Commentary & Step" : isBlueprint ? "Calculated Coordinate Invariants" : isCosmos ? "Harmonic Phase & Ratio" : "Working step details"}
              </span>
              <div className={`text-sm sm:text-base opacity-95 ${
                isChalkboard ? "font-chalk text-emerald-200 tracking-wide text-base" : isBlueprint ? "font-mono text-cyan-200" : isCosmos ? "font-sans text-purple-200" : `italic ${style.fontFamily} ${style.secondaryText}`
              }`}>
                <KatexMath math={scene.secondaryMath} block={false} />
              </div>
            </div>
          )}
        </div>

        {/* Chalk Rail Visual Accent for Chalkboard */}
        {isChalkboard && (
          <div className="relative z-10 -mx-6 -mb-6 mt-4 pt-2.5 pb-1 px-4 chalk-rail flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-scholar-title text-amber-200/60 uppercase tracking-widest">Chalk Tray:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-2 rounded-sm bg-[#fafafa] shadow-[0_0_4px_rgba(255,255,255,0.7)]" title="Calcite White Chalk" />
                <span className="w-5 h-2 rounded-sm bg-[#fde047] shadow-[0_0_4px_rgba(253,224,71,0.7)]" title="Canary Yellow Chalk" />
                <span className="w-5 h-2 rounded-sm bg-[#86efac] shadow-[0_0_4px_rgba(134,239,172,0.7)]" title="Sage Mint Chalk" />
                <span className="w-5 h-2 rounded-sm bg-[#7dd3fc] shadow-[0_0_4px_rgba(125,211,252,0.7)]" title="Celestial Blue Chalk" />
              </div>
            </div>
            <div className="w-12 h-3 bg-[#422919] border border-[#6b472e] rounded-xs flex items-center justify-center text-[7px] text-amber-200/70 font-mono">
              felt eraser
            </div>
          </div>
        )}

        {/* Drafting Scale Ruler Accent for The Architect's Blueprint */}
        {isBlueprint && (
          <div className="relative z-10 -mx-6 -mb-6 mt-4 pt-2 pb-1.5 px-4 bg-[#03152b] border-t border-cyan-500/30 flex items-center justify-between font-mono text-[9px] text-cyan-400/80">
            <div className="flex items-center gap-2">
              <span className="text-[8px] uppercase tracking-widest font-bold">10mm Drafting Scale:</span>
              <span className="font-mono text-[10px] tracking-widest text-cyan-300">|▪▪▪▪|▪▪▪▪|▪▪▪▪|▪▪▪▪|</span>
            </div>
            <div className="text-[8px] uppercase text-cyan-300/70 tracking-widest">
              TOLERANCE ±0.001mm • CAD 2D
            </div>
          </div>
        )}

        {/* Sacred Geometry Harmonic Bar Accent for Generative Cosmos */}
        {isCosmos && (
          <div className="relative z-10 -mx-6 -mb-6 mt-4 pt-2 pb-1.5 px-4 bg-[#08041c] border-t border-purple-500/30 flex items-center justify-between font-sans text-[9px] text-purple-300/80">
            <div className="flex items-center gap-2">
              <span className="text-[8px] uppercase tracking-widest font-bold text-amber-300">Golden Ratio:</span>
              <span className="font-mono text-[10px] text-purple-200">Φ = 1.6180339887...</span>
            </div>
            <div className="text-[8px] uppercase text-purple-300/70 tracking-widest flex items-center gap-1.5">
              <span>Fractal Harmonic Field</span>
              <span className="text-amber-400">✦</span>
            </div>
          </div>
        )}

        {/* Narrating indicator overlay */}
        {isNarrating && (
          <div className={`absolute right-4 bottom-8 z-20 flex items-center gap-2 backdrop-blur-md px-3 py-1.5 rounded-lg border text-[10px] select-none shadow-lg ${
            isChalkboard ? "bg-[#0c1813]/90 border-amber-500/30 font-scholar-title text-amber-300" : isBlueprint ? "bg-[#041a34]/90 border-cyan-500/40 font-mono text-cyan-300" : isCosmos ? "bg-[#0f092b]/90 border-purple-500/40 text-purple-200" : "bg-black/80 border-white/20 text-white"
          }`}>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isChalkboard ? "bg-amber-400" : isBlueprint ? "bg-cyan-400" : "bg-purple-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isChalkboard ? "bg-amber-500" : isBlueprint ? "bg-cyan-500" : "bg-purple-500"}`}></span>
            </span>
            {isChalkboard ? "Lecturer Voice In Sync" : isBlueprint ? "Telemetry Voice Stream" : "Harmonic Voice Resonating"}
          </div>
        )}
      </div>

      {/* Subtitles Narrator Card below */}
      <div className={`mt-4 border rounded-xl p-4 flex gap-3 h-[96px] overflow-hidden ${
        isChalkboard 
          ? "bg-[#0e1a14] border-amber-900/30 shadow-inner"
          : isBlueprint
          ? "bg-[#041427] border-cyan-500/30 shadow-inner"
          : isCosmos
          ? "bg-[#0a061c] border-purple-500/30 shadow-inner"
          : "bg-black/40 border-white/5"
      }`}>
        <div className="flex-shrink-0 pt-0.5">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
            isChalkboard 
              ? "bg-[#16271e] border-amber-500/30 text-amber-300 shadow-sm"
              : isBlueprint
              ? "bg-[#051c38] border-cyan-500/40 text-cyan-300 shadow-sm"
              : isCosmos
              ? "bg-[#120a30] border-purple-500/40 text-purple-300 shadow-sm"
              : "bg-white/5 border-white/10 text-white/70"
          }`}>
            {isChalkboard ? <GraduationCap className="w-4 h-4 text-amber-400" /> : isBlueprint ? <Cpu className="w-4 h-4 text-cyan-400" /> : isCosmos ? <Sparkles className="w-4 h-4 text-purple-400" /> : <Terminal className="w-4 h-4 text-blue-400" />}
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-start">
          <span className={`text-[10px] uppercase tracking-wider mb-0.5 ${
            isChalkboard ? "text-amber-300/70 font-scholar-title font-semibold" : isBlueprint ? "text-cyan-400/80 font-mono" : isCosmos ? "text-purple-300/80 font-sans font-semibold" : "text-white/40 font-mono"
          }`}>
            {isChalkboard ? "The Scholar's Lecture Commentary" : isBlueprint ? "Engineering Technical Commentary" : isCosmos ? "The Cosmic Harmonic Commentary" : "Automated Narration Audio / Script"}
          </span>
          <p className={`text-xs leading-relaxed overflow-y-auto pr-1 select-none whitespace-normal break-words ${
            isChalkboard ? "font-academic text-[#ededdf] text-[13px] leading-relaxed" : isBlueprint ? "font-mono text-cyan-100 text-xs" : isCosmos ? "font-sans text-purple-100 text-[13px]" : "font-sans text-white/80"
          }`}>
            {scene.explanation.substring(0, Math.floor(scene.explanation.length * typingProgress))}
            {typingProgress < 1 && (
              <span className={`inline-block w-1.5 h-3.5 ml-0.5 animate-pulse ${isChalkboard ? "bg-amber-400" : isBlueprint ? "bg-cyan-400" : "bg-purple-400"}`} />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
