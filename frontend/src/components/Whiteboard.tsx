import React, { useEffect, useRef } from "react";
import { VideoScene, ThemeType } from "../types";
import { Sparkles, Terminal, Cpu } from "lucide-react";

export function KatexMath({ math, block = false }: { math: string; block?: boolean }) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        if ((window as any).katex) {
          (window as any).katex.render(math, containerRef.current, {
            displayMode: block,
            throwOnError: false,
          });
        } else {
          containerRef.current.textContent = math;
        }
      } catch (err) {
        console.error(err);
        containerRef.current.textContent = math;
      }
    }
  }, [math, block]);

  return <span ref={containerRef} />;
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
    chalkboard: {
      outer: "bg-emerald-950 border-emerald-800 text-emerald-100 shadow-emerald-950/20",
      boardBg: "bg-[#14231b] border-emerald-900/40",
      fontFamily: "font-mono",
      primaryText: "text-amber-200", // Yellow chalk
      secondaryText: "text-emerald-300",
      accentDot: "bg-amber-400",
      gridLines: "bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px]"
    },
    blueprint: {
      outer: "bg-blue-950 border-blue-900 text-blue-100 shadow-blue-950/20",
      boardBg: "bg-[#05172e] border-blue-800/40",
      fontFamily: "font-mono",
      primaryText: "text-cyan-300", // blueprint ink
      secondaryText: "text-blue-300",
      accentDot: "bg-cyan-500",
      gridLines: "bg-[linear-gradient(rgba(0,180,216,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,180,216,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"
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
    }
  };

  const style = themesList[theme] || themesList.chalkboard;

  // Render a clean visual simulation of formula steps
  return (
    <div className={`flex flex-col h-full rounded-2xl border p-6 transition-all duration-300 relative ${style.outer}`}>
      {/* Visual board watermark/header */}
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${style.accentDot} animate-pulse`} />
          <span className="text-[10px] uppercase tracking-wider font-mono opacity-60">
            SCENE {scene.sceneNumber}: {scene.subTitle}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/30 px-2 py-0.5 rounded text-[10px] font-mono border border-white/5 select-none text-white/50">
          <Sparkles className="w-3 h-3 text-amber-300 animate-spin" />
          Whiteboard Animation Active
        </div>
      </div>

      {/* Main Board Canvas backdrop */}
      <div className={`flex-1 rounded-xl border relative overflow-hidden flex flex-col p-6 min-h-[160px] justify-center transition-colors duration-300 ${style.boardBg}`}>
        {/* Background Grid Pattern */}
        <div className={`absolute inset-0 pointer-events-none ${style.gridLines}`} />

        {/* Content Container */}
        <div className="relative z-10 space-y-4">
          <div className="space-y-1">
            <span className="text-white/40 text-[10px] font-mono tracking-wider block uppercase">Title</span>
            <h2 className={`text-xl sm:text-2xl font-semibold tracking-tight ${style.fontFamily}`}>
              {scene.title}
            </h2>
          </div>

          <div className="py-2 border-y border-white/5">
            <span className="text-white/40 text-[10px] font-mono tracking-wider block uppercase mb-1">Mathematical formula</span>
            <div className={`text-2xl sm:text-3xl font-medium tracking-wide py-1 text-center select-all select-none selection:bg-white/20 overflow-x-auto whitespace-normal break-words scrollbar-none scroll-smooth ${style.fontFamily} ${style.primaryText}`}>
              <KatexMath math={scene.primaryMath} block={true} />
            </div>
          </div>

          {scene.secondaryMath && (
            <div className="space-y-1">
              <span className="text-white/40 text-[10px] font-mono tracking-wider block uppercase">Working step details</span>
              <div className={`text-sm sm:text-base opacity-90 italic ${style.fontFamily} ${style.secondaryText}`}>
                <KatexMath math={scene.secondaryMath} block={false} />
              </div>
            </div>
          )}
        </div>

        {/* Narrating indicator overlay */}
        {isNarrating && (
          <div className="absolute right-4 bottom-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/5 text-[10px] font-mono text-emerald-400 select-none">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            Narrator Voice Sync
          </div>
        )}
      </div>

      {/* Subtitles Narrator Card below */}
      <div className="mt-5 bg-black/40 border border-white/5 rounded-xl p-4 flex gap-3 h-[90px] overflow-hidden">
        <div className="flex-shrink-0 pt-0.5">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
            {theme === "chalkboard" ? <Cpu className="w-4 h-4 text-emerald-400" /> : <Terminal className="w-4 h-4 text-blue-400" />}
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-start">
          <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider mb-0.5">Automated Narration Audio / Script</span>
          <p className="text-xs text-white/80 leading-relaxed font-sans overflow-y-auto pr-1 select-none whitespace-normal break-words">
            {scene.explanation.substring(0, Math.floor(scene.explanation.length * typingProgress))}
            {typingProgress < 1 && (
              <span className="inline-block w-1.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
