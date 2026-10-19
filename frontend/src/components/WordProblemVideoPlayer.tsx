import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Download,
  Film,
  Sparkles,
  Subtitles,
  FastForward,
  Rewind,
  CheckCircle2,
  Layers,
  ChevronRight,
  Video,
  FileVideo,
  FileText,
  ArrowRight,
  BookOpen
} from "lucide-react";
import { VideoScript, VideoScene, WordProblemPipelineResponse, ThemeType } from "../types";
import { KatexMath } from "./Whiteboard";


interface WordProblemVideoPlayerProps {
  videoScript: VideoScript;
  pipelineResponse: WordProblemPipelineResponse;
  theme?: ThemeType;
  onSendToStudio?: (expr: string) => void;
}

export default function WordProblemVideoPlayer({
  videoScript,
  pipelineResponse,
  theme = "chalkboard",
  onSendToStudio
}: WordProblemVideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [isManimRendering, setIsManimRendering] = useState<boolean>(false);
  const [manimVideoUrl, setManimVideoUrl] = useState<string | null>(null);

  // Time & Animation refs
  const currentTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const playbackSpeedRef = useRef<number>(1.0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Speech Narration Ref
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentNarratedSceneIdRef = useRef<string | null>(null);

  const totalDuration = videoScript.total_duration_sec || 30.0;

  // Sync refs with state
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    if (speechUtteranceRef.current && window.speechSynthesis) {
      speechUtteranceRef.current.rate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Current Scene Helper
  const currentScene: VideoScene = useMemo(() => {
    const scenes = videoScript.scenes;
    if (!scenes || scenes.length === 0) {
      return {
        scene_id: "generic",
        title: "Video Explanation",
        phase_label: "Phase 1: Problem Overview",
        start_time_sec: 0,
        duration_sec: totalDuration,
        narration: "",
        subtitles: [],
        visual_type: "generic",
        visual_params: {}
      };
    }
    for (let i = scenes.length - 1; i >= 0; i--) {
      if (currentTime >= scenes[i].start_time_sec - 0.05) {
        return scenes[i];
      }
    }
    return scenes[0];
  }, [videoScript, currentTime, totalDuration]);

  // Active Subtitle Helper
  const activeSubtitle = useMemo(() => {
    if (!showSubtitles || !currentScene.subtitles) return "";
    const match = currentScene.subtitles.find(
      (s) => currentTime >= s.start_sec && currentTime <= s.end_sec
    );
    return match ? match.text : currentScene.narration.slice(0, 90) + "...";
  }, [currentScene, currentTime, showSubtitles]);

  // Handle Speech Narration on Scene Change
  const speakCurrentScene = useCallback((scene: VideoScene) => {
    if (isMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (!scene.narration) return;

    const utter = new SpeechSynthesisUtterance(scene.narration);
    utter.rate = playbackSpeedRef.current;
    utter.pitch = 1.0;
    utter.lang = "en-US";
    speechUtteranceRef.current = utter;
    currentNarratedSceneIdRef.current = scene.scene_id;
    window.speechSynthesis.speak(utter);
  }, [isMuted]);

  // Stop Speech
  const stopSpeech = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    currentNarratedSceneIdRef.current = null;
  }, []);

  // Play / Pause toggle
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopSpeech();
    } else {
      if (currentTime >= totalDuration - 0.2) {
        seekTo(0);
      }
      setIsPlaying(true);
      speakCurrentScene(currentScene);
    }
  };

  const seekTo = (timeSec: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, timeSec));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    stopSpeech();
    if (isPlaying) {
      // Find scene at new time
      const targetScene = videoScript.scenes.find(
        (s) => clamped >= s.start_time_sec && clamped <= s.start_time_sec + s.duration_sec
      ) || currentScene;
      speakCurrentScene(targetScene);
    }
  };

  const handleSkip = (deltaSec: number) => {
    seekTo(currentTime + deltaSec);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // HIGH-PERFORMANCE 60FPS CANVAS RENDERER
  // ══════════════════════════════════════════════════════════════════════════════
  const renderFrame = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    // Background Dark Slate / Cyber Chalkboard
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#090d16");
    bgGrad.addColorStop(0.5, "#0b1220");
    bgGrad.addColorStop(1, "#050811");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid Overlay
    ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Determine current scene & progress within scene
    const scenes = videoScript.scenes;
    let scene = scenes[0];
    for (let i = scenes.length - 1; i >= 0; i--) {
      if (time >= scenes[i].start_time_sec - 0.05) {
        scene = scenes[i];
        break;
      }
    }

    const sceneProgress = Math.min(1.0, Math.max(0.0, (time - scene.start_time_sec) / scene.duration_sec));
    const globalProgress = Math.min(1.0, Math.max(0.0, time / totalDuration));

    // ──────────────────────────────────────────────────────────────────────────
    // VISUAL RENDERER: MOTION RACE (Train A & Train B Catch-up)
    // ──────────────────────────────────────────────────────────────────────────
    if (scene.visual_type === "motion_race") {
      const p = scene.visual_params;
      const v1 = p.speed1 || 60;
      const v2 = p.speed2 || 90;
      const delay = p.delay || 2.0;
      const meetTime = p.meet_time || 4.0;
      const meetDist = p.meet_distance || 360;

      const speedUnit = p.speed_unit || "mph";
      const distUnit = p.distance_unit || "miles";
      const timeUnit = p.time_unit || "hours";
      const distUnitShort = distUnit === "miles" ? "mi" : (distUnit === "kilometers" || distUnit === "km" ? "km" : distUnit === "meters" ? "m" : distUnit);
      const timeUnitShort = timeUnit === "hours" ? "h" : (timeUnit === "minutes" ? "min" : "s");

      // Simulated elapsed problem time T_sim in hours
      // Map global progress: at globalProgress = 0, T_sim = 0; at globalProgress = 0.8, T_sim = meetTime
      const simulatedHours = Math.min(meetTime, (time / (totalDuration * 0.75)) * meetTime);

      const trackY = height * 0.62;
      const startX = width * 0.12;
      const endX = width * 0.88;
      const trackLength = endX - startX;

      // Draw Horizon & Sky Stars
      ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
      for (let i = 0; i < 25; i++) {
        const starX = (i * 73 + 17) % width;
        const starY = (i * 41 + 11) % (trackY - 60);
        ctx.beginPath();
        ctx.arc(starX, starY, (i % 3 === 0) ? 1.5 : 1.0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Railway Track
      ctx.strokeStyle = "rgba(71, 85, 105, 0.8)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(startX - 20, trackY);
      ctx.lineTo(endX + 20, trackY);
      ctx.stroke();

      ctx.strokeStyle = "rgba(51, 65, 85, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX - 20, trackY + 8);
      ctx.lineTo(endX + 20, trackY + 8);
      ctx.stroke();

      // Railway Ties
      ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
      ctx.lineWidth = 2;
      for (let tx = startX; tx <= endX; tx += 24) {
        ctx.beginPath();
        ctx.moveTo(tx, trackY - 4);
        ctx.lineTo(tx, trackY + 12);
        ctx.stroke();
      }

      // Distance Markers Along Track
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      const stepM = Math.max(10, Math.round(meetDist / 6));
      for (let m = 0; m <= meetDist + stepM; m += stepM) {
        const markerX = startX + (m / meetDist) * (trackLength * 0.85);
        if (markerX <= endX) {
          ctx.beginPath();
          ctx.arc(markerX, trackY, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(`${m} ${distUnitShort}`, markerX, trackY + 26);
        }
      }

      // Station Flag / Sign at startX
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(startX - 6, trackY - 45, 12, 45);
      ctx.fillStyle = "rgba(14, 165, 233, 0.25)";
      ctx.fillRect(startX - 40, trackY - 65, 80, 20);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(startX - 40, trackY - 65, 80, 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText(`START (0 ${distUnitShort})`, startX, trackY - 51);

      // Current positions calculation
      // Train A distance:
      const d1 = v1 * (simulatedHours + delay);
      const frac1 = Math.min(1.0, d1 / meetDist);
      const train1X = startX + frac1 * (trackLength * 0.85);

      // Train B distance:
      let d2 = 0;
      let train2X = startX;
      if (simulatedHours > 0) {
        d2 = v2 * simulatedHours;
        const frac2 = Math.min(1.0, d2 / meetDist);
        train2X = startX + frac2 * (trackLength * 0.85);
      }

      const hasCaughtUp = Math.abs(train1X - train2X) < 4 && simulatedHours >= meetTime * 0.98;

      // ── Draw Train A (Orange/Gold Locomotive) ──
      const t1Y = trackY - 24;
      // Ambient glow
      const g1 = ctx.createRadialGradient(train1X, t1Y, 5, train1X, t1Y, 45);
      g1.addColorStop(0, "rgba(245, 158, 11, 0.3)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(train1X - 45, t1Y - 45, 90, 90);

      // Smoke puffs
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      for (let s = 1; s <= 3; s++) {
        const puffX = train1X - 25 - s * 14;
        const puffY = t1Y - 14 - Math.sin(time * 5 + s) * 4;
        ctx.beginPath();
        ctx.arc(puffX, puffY, 5 + s * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Train A Body
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.roundRect(train1X - 30, t1Y - 16, 50, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#b45309";
      ctx.fillRect(train1X + 10, t1Y - 12, 8, 16);

      // Wheels
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(train1X - 18, t1Y + 6, 5, 0, Math.PI * 2);
      ctx.arc(train1X - 2, t1Y + 6, 5, 0, Math.PI * 2);
      ctx.arc(train1X + 14, t1Y + 6, 5, 0, Math.PI * 2);
      ctx.fill();

      // Headlight beam
      const beamGrad1 = ctx.createLinearGradient(train1X + 20, t1Y, train1X + 80, t1Y);
      beamGrad1.addColorStop(0, "rgba(254, 240, 138, 0.4)");
      beamGrad1.addColorStop(1, "transparent");
      ctx.fillStyle = beamGrad1;
      ctx.beginPath();
      ctx.moveTo(train1X + 20, t1Y - 6);
      ctx.lineTo(train1X + 80, t1Y - 18);
      ctx.lineTo(train1X + 80, t1Y + 12);
      ctx.lineTo(train1X + 20, t1Y + 6);
      ctx.fill();

      // Train A HUD Badge
      ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
      ctx.strokeStyle = "#f59e0b";
      ctx.beginPath();
      ctx.roundRect(train1X - 35, t1Y - 44, 70, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Train A: ${v1} ${speedUnit}`, train1X, t1Y - 30);

      // Distance tag under track for Train A
      ctx.fillStyle = "#f59e0b";
      ctx.font = "9px monospace";
      ctx.fillText(`d1 = ${Math.round(d1)} ${distUnitShort}`, train1X, trackY + 44);

      // ── Draw Train B (Cyan High-Speed Bullet Train) ──
      const t2Y = trackY - 24;
      // Boost trail
      if (simulatedHours > 0) {
        const trailGrad = ctx.createLinearGradient(train2X - 50, t2Y, train2X, t2Y);
        trailGrad.addColorStop(0, "transparent");
        trailGrad.addColorStop(1, "rgba(6, 182, 212, 0.45)");
        ctx.fillStyle = trailGrad;
        ctx.fillRect(train2X - 50, t2Y - 14, 50, 18);
      }

      // Train B Body
      ctx.fillStyle = "#06b6d4";
      ctx.beginPath();
      ctx.roundRect(train2X - 32, t2Y - 16, 54, 20, 5);
      ctx.fill();
      ctx.fillStyle = "#0891b2";
      ctx.fillRect(train2X - 20, t2Y - 12, 30, 8);

      // Wheels
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(train2X - 18, t2Y + 6, 5, 0, Math.PI * 2);
      ctx.arc(train2X, t2Y + 6, 5, 0, Math.PI * 2);
      ctx.arc(train2X + 16, t2Y + 6, 5, 0, Math.PI * 2);
      ctx.fill();

      // Train B Headlight
      const beamGrad2 = ctx.createLinearGradient(train2X + 22, t2Y, train2X + 90, t2Y);
      beamGrad2.addColorStop(0, "rgba(103, 232, 249, 0.6)");
      beamGrad2.addColorStop(1, "transparent");
      ctx.fillStyle = beamGrad2;
      ctx.beginPath();
      ctx.moveTo(train2X + 22, t2Y - 6);
      ctx.lineTo(train2X + 90, t2Y - 18);
      ctx.lineTo(train2X + 90, t2Y + 12);
      ctx.lineTo(train2X + 22, t2Y + 6);
      ctx.fill();

      // Train B HUD Badge
      ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
      ctx.strokeStyle = "#06b6d4";
      ctx.beginPath();
      ctx.roundRect(train2X - 35, t2Y - 72, 70, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#a5f3fc";
      ctx.font = "bold 9px monospace";
      ctx.fillText(`Train B: ${v2} ${speedUnit}`, train2X, t2Y - 58);

      // Distance tag under track for Train B
      ctx.fillStyle = "#06b6d4";
      ctx.font = "9px monospace";
      ctx.fillText(`d2 = ${Math.round(d2)} ${distUnitShort}`, train2X, trackY + 58);

      // ── HUD Panel (Top Center): Clock & Catch-up Gauge ──
      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - 130, 20, 260, 48, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`ELAPSED TIME: ${simulatedHours.toFixed(1)} ${timeUnitShort} / ${meetTime} ${timeUnitShort}`, width * 0.5, 38);

      const gapDist = Math.max(0, Math.round(d1 - d2));
      ctx.fillStyle = hasCaughtUp ? "#4ade80" : "#facc15";
      ctx.font = "bold 10px monospace";
      ctx.fillText(
        hasCaughtUp ? `★ CATCH-UP ACHIEVED! (d1 = d2 = ${Math.round(meetDist)} ${distUnitShort})` : `GAP DISTANCE: ${gapDist} ${distUnitShort}`,
        width * 0.5,
        56
      );

      // Celebration starburst at meeting point
      if (hasCaughtUp) {
        ctx.strokeStyle = "#4ade80";
        ctx.lineWidth = 2;
        const cx = train1X;
        const cy = trackY - 14;
        for (let a = 0; a < 8; a++) {
          const angle = (a * Math.PI) / 4 + time * 3;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * 15, cy + Math.sin(angle) * 15);
          ctx.lineTo(cx + Math.cos(angle) * 35, cy + Math.sin(angle) * 35);
          ctx.stroke();
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VISUAL RENDERER: GEOMETRY PYTHAGOREAN (Right Triangle & Square Proof)
    // ──────────────────────────────────────────────────────────────────────────
    else if (scene.visual_type === "geometry_pythagorean") {
      const p = scene.visual_params;
      const a = p.a || 5;
      const b = p.b || 12;
      const c = p.c || 13;
      const unit = p.unit || "cm";

      const scale = Math.min(width, height) * 0.022;
      const originX = width * 0.42;
      const originY = height * 0.65;

      const legAX = originX;
      const legAY = originY - a * scale;
      const legBX = originX + b * scale;
      const legBY = originY;

      // Draw Triangle Legs Line by Line
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(legAX, legAY); // Leg A
      ctx.lineTo(legBX, legBY); // Hypotenuse C
      ctx.lineTo(originX, originY); // Leg B
      ctx.closePath();
      ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
      ctx.fill();
      ctx.stroke();

      // Right Angle Square indicator at origin
      const sqSize = 14;
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.strokeRect(originX, originY - sqSize, sqSize, sqSize);

      // Dimension labels with glowing pills
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";

      // Leg A Label (left)
      ctx.fillText(`a = ${a} ${unit}`, originX - 35, (originY + legAY) / 2);

      // Leg B Label (bottom)
      ctx.fillText(
        scene.scene_id === "situation" ? `b = ? ${unit}` : `b = ${b} ${unit}`,
        (originX + legBX) / 2,
        originY + 24
      );

      // Hypotenuse C Label (along hypotenuse)
      ctx.fillStyle = "#f43f5e";
      ctx.fillText(`c = ${c} ${unit}`, (legAX + legBX) / 2 + 15, (legAY + legBY) / 2 - 15);

      // Square areas on sides (Pythagorean Proof Visualization)
      if (scene.scene_id !== "situation") {
        // Square on side a (5x5 = 25)
        ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;
        ctx.fillRect(originX - a * scale, originY - a * scale, a * scale, a * scale);
        ctx.strokeRect(originX - a * scale, originY - a * scale, a * scale, a * scale);
        ctx.fillStyle = "#fef08a";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`a² = ${a * a}`, originX - (a * scale) / 2, originY - (a * scale) / 2);

        // Square on side b (12x12 = 144)
        ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
        ctx.strokeStyle = "#10b981";
        ctx.fillRect(originX, originY, b * scale, b * scale * 0.5);
        ctx.strokeRect(originX, originY, b * scale, b * scale * 0.5);
        ctx.fillStyle = "#a7f3d0";
        ctx.fillText(`b² = ${b * b}`, originX + (b * scale) / 2, originY + (b * scale * 0.25) + 4);

        // Top Banner Theorem
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.strokeStyle = "#38bdf8";
        ctx.beginPath();
        ctx.roundRect(width * 0.5 - 140, 20, 280, 44, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 12px monospace";
        ctx.fillText(`${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c} = ${c}²`, width * 0.5, 46);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VISUAL RENDERER: GEOMETRY RECTANGLE (Perimeter & Area plot)
    // ──────────────────────────────────────────────────────────────────────────
    else if (scene.visual_type === "geometry_rectangle") {
      const p = scene.visual_params;
      const l = p.length || 15;
      const w = p.width || 12;
      const perim = p.perimeter || 54;
      const area = p.area || 180;
      const unit = p.unit || "meters";

      const scale = Math.min(width, height) * 0.016;
      const rectW = l * scale;
      const rectH = w * scale;
      const rx = (width - rectW) / 2;
      const ry = (height - rectH) / 2 + 10;

      // Draw Garden Rectangle
      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3.5;
      ctx.fillRect(rx, ry, rectW, rectH);
      ctx.strokeRect(rx, ry, rectW, rectH);

      // Internal Garden Grid Tiles
      ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
      ctx.lineWidth = 1;
      const tileStep = rectW / 5;
      for (let gx = rx + tileStep; gx < rx + rectW; gx += tileStep) {
        ctx.beginPath();
        ctx.moveTo(gx, ry);
        ctx.lineTo(gx, ry + rectH);
        ctx.stroke();
      }
      const tileHStep = rectH / 4;
      for (let gy = ry + tileHStep; gy < ry + rectH; gy += tileHStep) {
        ctx.beginPath();
        ctx.moveTo(rx, gy);
        ctx.lineTo(rx + rectW, gy);
        ctx.stroke();
      }

      // Dimensions Calipers
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      // Length (top)
      ctx.fillText(`Length: ${l} ${unit}`, rx + rectW / 2, ry - 14);
      // Width (right)
      ctx.fillText(`Width: ${w} ${unit}`, rx + rectW + 55, ry + rectH / 2);

      // Center Area Badge
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "#10b981";
      ctx.beginPath();
      ctx.roundRect(rx + rectW / 2 - 75, ry + rectH / 2 - 25, 150, 50, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 12px monospace";
      ctx.fillText(`Area: ${area} sq ${unit}`, rx + rectW / 2, ry + rectH / 2 - 4);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.fillText(`Perimeter: 2(l + w) = ${perim} ${unit}`, rx + rectW / 2, ry + rectH / 2 + 14);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VISUAL RENDERER: WORK RATE (Dual Flow Pipes & Filling Reservoir)
    // ──────────────────────────────────────────────────────────────────────────
    else if (scene.visual_type === "work_rate") {
      const p = scene.visual_params;
      const t1 = p.t1 || 4.0;
      const t2 = p.t2 || 6.0;
      const tComb = p.t_comb || 2.4;
      const unit = p.unit || "hours";
      const timeUnitShort = unit === "hours" ? "h" : (unit === "minutes" ? "min" : (unit === "days" ? "d" : unit));

      const tankW = width * 0.32;
      const tankH = height * 0.48;
      const tankX = (width - tankW) / 2;
      const tankY = height * 0.38;

      // Simulated fill progress
      const simH = Math.min(tComb, (time / (totalDuration * 0.75)) * tComb);
      const fillPct = Math.min(1.0, simH / tComb);

      // Draw Glass Reservoir Tank
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.strokeRect(tankX, tankY, tankW, tankH);

      // Water Level with Wave Animation
      const waterH = tankH * fillPct;
      const waterY = tankY + tankH - waterH;
      const waterGrad = ctx.createLinearGradient(0, waterY, 0, tankY + tankH);
      waterGrad.addColorStop(0, "rgba(56, 189, 248, 0.7)");
      waterGrad.addColorStop(1, "rgba(3, 105, 161, 0.9)");
      ctx.fillStyle = waterGrad;

      ctx.beginPath();
      ctx.moveTo(tankX, waterY);
      for (let wx = tankX; wx <= tankX + tankW; wx += 10) {
        const wave = Math.sin((wx / 20) + time * 6) * 3;
        ctx.lineTo(wx, waterY + wave);
      }
      ctx.lineTo(tankX + tankW, tankY + tankH);
      ctx.lineTo(tankX, tankY + tankH);
      ctx.closePath();
      ctx.fill();

      // Pipe 1 (Left - Worker A)
      const p1X = tankX - 70;
      const p1Y = tankY - 30;
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(p1X, p1Y, 90, 16);
      ctx.fillRect(tankX + 10, p1Y, 16, 40);
      // Stream
      ctx.fillStyle = "rgba(245, 158, 11, 0.6)";
      ctx.fillRect(tankX + 14, p1Y + 40, 8, Math.max(0, waterY - (p1Y + 40)));

      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Worker A: 1/${t1} job/${timeUnitShort}`, p1X + 45, p1Y - 8);

      // Pipe 2 (Right - Worker B)
      const p2X = tankX + tankW - 20;
      const p2Y = tankY - 30;
      ctx.fillStyle = "#06b6d4";
      ctx.fillRect(p2X, p2Y, 90, 16);
      ctx.fillRect(tankX + tankW - 26, p2Y, 16, 40);
      // Stream
      ctx.fillStyle = "rgba(6, 182, 212, 0.6)";
      ctx.fillRect(tankX + tankW - 22, p2Y + 40, 8, Math.max(0, waterY - (p2Y + 40)));

      ctx.fillStyle = "#a5f3fc";
      ctx.font = "bold 10px monospace";
      ctx.fillText(`Worker B: 1/${t2} job/${timeUnitShort}`, p2X + 45, p2Y - 8);

      // Tank Fill Gauge
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - 110, 20, 220, 46, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`JOB PROGRESS: ${Math.round(fillPct * 100)}% COMPLETE`, width * 0.5, 38);
      ctx.fillStyle = fillPct >= 0.99 ? "#4ade80" : "#facc15";
      ctx.font = "bold 10px monospace";
      ctx.fillText(`Time Working Together: ${simH.toFixed(2)} / ${tComb} ${unit}`, width * 0.5, 54);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VISUAL RENDERER: LINEAR BALANCE (Ticket / Quantity Scale)
    // ──────────────────────────────────────────────────────────────────────────
    else if (scene.visual_type === "linear_balance") {
      const p = scene.visual_params;
      const xVal = p.x || 30;
      const yVal = p.y || 20;
      const c1 = p.c1 || 5;
      const c2 = p.c2 || 8;
      const totalItems = p.total_items || 50;
      const totalCost = p.total_cost || 310;
      const currencySym = p.currency_sym || "$";
      const itemUnit = p.item_unit || "Items";

      const scaleCenterX = width * 0.5;
      const scaleBaseY = height * 0.72;
      const beamLength = width * 0.44;

      // Draw Balance Beam Scale
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 4;
      // Fulcrum Triangle
      ctx.beginPath();
      ctx.moveTo(scaleCenterX, scaleBaseY - 60);
      ctx.lineTo(scaleCenterX - 25, scaleBaseY);
      ctx.lineTo(scaleCenterX + 25, scaleBaseY);
      ctx.closePath();
      ctx.fillStyle = "#334155";
      ctx.fill();
      ctx.stroke();

      // Crossbar Beam
      ctx.beginPath();
      ctx.moveTo(scaleCenterX - beamLength / 2, scaleBaseY - 60);
      ctx.lineTo(scaleCenterX + beamLength / 2, scaleBaseY - 60);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 5;
      ctx.stroke();

      // Left Pan (First Class: x)
      const leftPanX = scaleCenterX - beamLength / 2;
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftPanX, scaleBaseY - 60);
      ctx.lineTo(leftPanX - 35, scaleBaseY - 15);
      ctx.moveTo(leftPanX, scaleBaseY - 60);
      ctx.lineTo(leftPanX + 35, scaleBaseY - 15);
      ctx.stroke();

      ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(leftPanX, scaleBaseY - 15, 40, 0, Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${xVal} Type 1`, leftPanX, scaleBaseY + 12);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "10px monospace";
      ctx.fillText(`(${currencySym}${c1} ea = ${currencySym}${xVal * c1})`, leftPanX, scaleBaseY + 26);

      // Right Pan (Second Class: y)
      const rightPanX = scaleCenterX + beamLength / 2;
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rightPanX, scaleBaseY - 60);
      ctx.lineTo(rightPanX - 35, scaleBaseY - 15);
      ctx.moveTo(rightPanX, scaleBaseY - 60);
      ctx.lineTo(rightPanX + 35, scaleBaseY - 15);
      ctx.stroke();

      ctx.fillStyle = "rgba(168, 85, 247, 0.25)";
      ctx.strokeStyle = "#a855f7";
      ctx.beginPath();
      ctx.arc(rightPanX, scaleBaseY - 15, 40, 0, Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`${yVal} Type 2`, rightPanX, scaleBaseY + 12);
      ctx.fillStyle = "#c084fc";
      ctx.font = "10px monospace";
      ctx.fillText(`(${currencySym}${c2} ea = ${currencySym}${yVal * c2})`, rightPanX, scaleBaseY + 26);

      // Top System Balance Gauge
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - 130, 20, 260, 48, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`TOTAL VALUE: ${currencySym}${totalCost} BALANCED`, width * 0.5, 38);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.fillText(`Total Items: ${xVal} + ${yVal} = ${totalItems} ${itemUnit}`, width * 0.5, 54);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VISUAL RENDERER: GENERIC WORD PROBLEM
    // ──────────────────────────────────────────────────────────────────────────
    else {
      ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(width * 0.15, height * 0.25, width * 0.7, height * 0.45, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("MATHEMATICAL MODELING & PROOF CANVAS", width * 0.5, height * 0.35);

      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText(pipelineResponse.original_question.slice(0, 80) + "...", width * 0.5, height * 0.45);

      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 14px monospace";
      ctx.fillText(`Target Solution: ${pipelineResponse.final_answer}`, width * 0.5, height * 0.58);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SPECIAL ON-CANVAS EQUATION BUILDER OVERLAY FOR SCENE 2 (MODEL SETUP)
    // ──────────────────────────────────────────────────────────────────────────
    if (scene.scene_id === "model_setup" && (scene.equation_building_steps?.length || videoScript.equation_building_steps?.length)) {
      const eqSteps = (scene.equation_building_steps?.length ? scene.equation_building_steps : videoScript.equation_building_steps) || [];
      const cardW = Math.min(width * 0.88, 580);
      const cardH = Math.min(height * 0.56, 230);
      const cardX = (width - cardW) / 2;
      const cardY = height * 0.17;

      ctx.save();
      // Frosted Glassmorphism Card
      ctx.fillStyle = "rgba(10, 16, 32, 0.92)";
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 16);
      ctx.fill();
      ctx.stroke();

      // Card Header
      ctx.fillStyle = "rgba(99, 102, 241, 0.25)";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, 36, [16, 16, 0, 0]);
      ctx.fill();

      ctx.fillStyle = "#818cf8";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText("TRANSLATING QUESTION TEXT ➔ FORMAL EQUATION", cardX + 16, cardY + 23);

      // Render clause-by-clause steps
      const itemH = (cardH - 44) / Math.max(1, Math.min(3, eqSteps.length));
      eqSteps.slice(0, 3).forEach((st, idx) => {
        const iy = cardY + 44 + idx * itemH;

        // Step bullet
        ctx.fillStyle = "#6366f1";
        ctx.beginPath();
        ctx.arc(cardX + 24, iy + itemH * 0.45, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${idx + 1}`, cardX + 24, iy + itemH * 0.45 + 3);

        // Phrase in quotes
        ctx.fillStyle = "#facc15";
        ctx.font = "italic 11px sans-serif";
        ctx.textAlign = "left";
        const maxChar = Math.floor(cardW / 14);
        const phraseTxt = st.source_phrase.length > maxChar ? st.source_phrase.slice(0, maxChar - 3) + "..." : st.source_phrase;
        ctx.fillText(`"${phraseTxt}"`, cardX + 42, iy + itemH * 0.35);

        // Concept & Math Translation
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`➔  ${st.concept} :  ${st.math_translation}`, cardX + 42, iy + itemH * 0.72);
      });
      ctx.restore();
    }

    // Top Right Phase Watermark Badge
    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.roundRect(width - 230, 16, 215, 28, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(scene.phase_label, width - 220, 34);

  }, [videoScript, totalDuration, pipelineResponse]);

  // Main 60FPS Animation Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (timestamp: number) => {
      if (lastTimestampRef.current !== null && isPlayingRef.current) {
        const delta = (timestamp - lastTimestampRef.current) / 1000.0;
        const newTime = currentTimeRef.current + delta * playbackSpeedRef.current;
        if (newTime >= totalDuration) {
          currentTimeRef.current = totalDuration;
          setCurrentTime(totalDuration);
          setIsPlaying(false);
          stopSpeech();
        } else {
          currentTimeRef.current = newTime;
          setCurrentTime(newTime);
        }
      }
      lastTimestampRef.current = timestamp;

      // Handle Device Pixel Ratio for High-DPI screens
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      renderFrame(ctx, displayWidth, displayHeight, currentTimeRef.current);
      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      stopSpeech();
    };
  }, [totalDuration, renderFrame, stopSpeech]);

  // Handle Video Recording & Export (MediaRecorder)
  const handleExportWebm = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsRecording(true);
    setRecordingProgress(0);
    seekTo(0);
    setIsPlaying(true);

    try {
      const stream = canvas.captureStream(60);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm; codecs=vp9" });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `word_problem_explanation_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      recorder.start();

      // Monitor recording progress
      const checkInterval = setInterval(() => {
        if (currentTimeRef.current >= totalDuration - 0.2) {
          clearInterval(checkInterval);
          recorder.stop();
          setIsPlaying(false);
        } else {
          setRecordingProgress(Math.round((currentTimeRef.current / totalDuration) * 100));
        }
      }, 200);

    } catch (err) {
      console.error("Recording error:", err);
      setIsRecording(false);
    }
  };

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="w-full rounded-3xl border border-white/10 bg-[#070b14] overflow-hidden shadow-2xl relative select-none flex flex-col group transition-all"
    >
      {/* Top Video Header */}
      <div className="px-5 py-3.5 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold font-mono text-white tracking-wide">
                {videoScript.title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                60 FPS Video Studio
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Dynamic physical scenario simulation and step-by-step mathematical proof
            </p>
          </div>
        </div>

        {/* Quick Chapter Tabs */}
        <div className="hidden md:flex items-center gap-1.5">
          {videoScript.scenes.map((sc, idx) => (
            <button
              key={sc.scene_id}
              onClick={() => seekTo(sc.start_time_sec)}
              className={`px-3 py-1 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                currentScene.scene_id === sc.scene_id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40"
                  : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5"
              }`}
            >
              <span>{idx + 1}.</span>
              <span>{sc.scene_id === "situation" ? "Situation" : sc.scene_id === "model_setup" ? "Equation" : sc.scene_id === "solving" ? "Solving" : "Conclusion"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Video Viewport (Canvas + Floating Math Overlay) */}
      <div className="relative w-full aspect-video min-h-[360px] sm:min-h-[460px] bg-black flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-pointer"
          onClick={togglePlay}
        />

        {/* Large Play Overlay on Pause */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl shadow-indigo-500/50 backdrop-blur-sm transition-all transform hover:scale-110 cursor-pointer border border-indigo-400/40 z-20"
          >
            <Play className="w-9 h-9 fill-white ml-1" />
          </button>
        )}

        {/* Floating Mathematical HUD Overlay (Upper Left) */}
        {currentScene.latex_callout && (
          <div className="absolute top-4 left-4 z-10 max-w-sm p-3.5 rounded-2xl bg-black/75 border border-indigo-500/30 backdrop-blur-md shadow-2xl animate-fade-in space-y-1.5 pointer-events-none">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Governing Mathematical Model</span>
            </div>
            <div className="font-mono text-cyan-200 text-sm overflow-x-auto">
              <KatexMath math={currentScene.latex_callout} block={false} />
            </div>
          </div>
        )}

        {/* Floating Step Details Card in Scene 3 (Solving) */}
        {currentScene.scene_id === "solving" && currentScene.step_details && (
          <div className="absolute top-4 right-4 z-10 max-w-xs p-3.5 rounded-2xl bg-black/80 border border-emerald-500/30 backdrop-blur-md shadow-2xl space-y-2 pointer-events-none hidden sm:block">
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Algebraic Derivation
            </span>
            <div className="space-y-1.5">
              {currentScene.step_details.slice(0, 3).map((st, i) => (
                <div key={i} className="text-[11px] font-mono p-1.5 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-cyan-300">
                    <KatexMath math={st.latex} block={false} />
                  </div>
                  <span className="text-[9px] text-slate-400 block">{st.rule}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-time Subtitles Banner Overlay (Bottom Center) */}
        {showSubtitles && activeSubtitle && (
          <div className="absolute bottom-6 inset-x-8 max-w-2xl mx-auto z-10 text-center pointer-events-none">
            <div className="inline-block px-5 py-2.5 rounded-2xl bg-black/85 border border-white/15 text-white text-xs sm:text-sm font-sans font-medium tracking-wide shadow-2xl backdrop-blur-md animate-fade-in">
              {activeSubtitle}
            </div>
          </div>
        )}
      </div>

      {/* Video Scrubber & Playback Controls Bar */}
      <div className="px-5 py-3.5 bg-black/60 border-t border-white/10 backdrop-blur-md space-y-2.5">
        {/* Timeline Scrubber Bar with Chapter Notches */}
        <div className="relative group/scrubber cursor-pointer py-1.5">
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden relative">
            {/* Played progress */}
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full"
              style={{ width: `${(currentTime / totalDuration) * 100}%` }}
            />
          </div>

          {/* Chapter Notch Pins */}
          {videoScript.scenes.map((sc, i) => (
            <div
              key={i}
              title={sc.title}
              onClick={(e) => {
                e.stopPropagation();
                seekTo(sc.start_time_sec);
              }}
              className="absolute top-1 w-1.5 h-2.5 bg-white/60 hover:bg-amber-400 rounded-full transition-all"
              style={{ left: `${(sc.start_time_sec / totalDuration) * 100}%` }}
            />
          ))}

          {/* Interactive Range Input */}
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.05}
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          {/* Left: Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <button
              onClick={() => handleSkip(-5)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-all cursor-pointer"
              title="Rewind 5 seconds"
            >
              <Rewind className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleSkip(5)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-all cursor-pointer"
              title="Forward 5 seconds"
            >
              <FastForward className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekTo(0)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-all cursor-pointer"
              title="Restart Video"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Time Indicator */}
            <div className="text-slate-300 font-mono text-[11px] ml-2">
              <span className="text-white font-bold">{formatTime(currentTime)}</span>
              <span className="opacity-50"> / {formatTime(totalDuration)}</span>
            </div>
          </div>

          {/* Right: Audio, Speed, Subtitles, Export, Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Speed Selector */}
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="bg-white/10 text-white px-2 py-1 rounded-lg text-[11px] font-mono border border-white/10 focus:outline-none cursor-pointer"
            >
              <option value="0.5" className="bg-slate-900">0.5x</option>
              <option value="1.0" className="bg-slate-900">1.0x</option>
              <option value="1.25" className="bg-slate-900">1.25x</option>
              <option value="1.5" className="bg-slate-900">1.5x</option>
              <option value="2.0" className="bg-slate-900">2.0x</option>
            </select>

            {/* Audio Voice Narration Toggle */}
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                if (!isMuted) stopSpeech();
                else speakCurrentScene(currentScene);
              }}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isMuted ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/10 hover:bg-white/20 text-white"
              }`}
              title={isMuted ? "Unmute Voice Narration" : "Mute Voice Narration"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Subtitles CC Toggle */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                showSubtitles ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-400"
              }`}
              title="Toggle Subtitles / Captions"
            >
              <Subtitles className="w-4 h-4" />
            </button>

            {/* Export WebM Video Button */}
            <button
              onClick={handleExportWebm}
              disabled={isRecording}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] font-mono flex items-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              title="Export 60FPS Video File (.webm)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isRecording ? `Recording (${recordingProgress}%)` : "Export Video"}</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Sentence-by-Sentence Equation Translation Section */}
      {videoScript.equation_building_steps && videoScript.equation_building_steps.length > 0 && (
        <div className="p-5 sm:p-6 bg-[#090d18] border-t border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold font-mono text-white tracking-wide uppercase flex flex-wrap items-center gap-2">
                  <span>How from the Question We Build the Equation</span>
                  <span className="px-2 py-0.2 rounded-full text-[9px] bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-400/30">
                    Direct English ➔ Math Translation
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Tracing how every clause in the problem directly transforms into formal algebraic terms
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                const setupScene = videoScript.scenes.find(s => s.scene_id === "model_setup");
                if (setupScene) {
                  seekTo(setupScene.start_time_sec);
                  if (!isPlaying) togglePlay();
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
            >
              <span>Watch Formulation Phase</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {videoScript.equation_building_steps.map((st, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 hover:border-indigo-400/40 transition-all text-xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      Step {idx + 1}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 font-semibold">
                      {st.concept}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 font-serif italic text-[11px] leading-relaxed">
                    "{st.source_phrase}"
                  </div>

                  <div className="p-2 rounded-xl bg-black/60 border border-white/5 font-mono text-cyan-200 text-xs overflow-x-auto">
                    <KatexMath math={st.latex} block={false} />
                  </div>

                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    {st.explanation}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Translation:</span>
                  <span className="text-white font-bold">{st.math_translation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

