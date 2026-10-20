import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sparkles,
  Cpu,
  Volume2,
  VolumeX,
  HelpCircle,
  RefreshCw,
  ChevronRight,
  Layers,
  AlertCircle,
  Clock,
  Sliders,
  Maximize2,
  User,
  LogOut,
  Star,
  ImagePlus,
  Camera,
  Upload,
  X,
  Check,
  Scan,
  BookOpen,
  Mic,
  MicOff,
  GraduationCap,
  Scroll,
  Shapes,
  MessageSquare,
  Palette,
  ChevronDown,
  Grid,
  Brain,
  TrendingUp,
  ShieldCheck
} from "lucide-react";
import FunctionAnalyzer from "./components/FunctionAnalyzer";
import ProofEngine from "./components/ProofEngine";
import MathGraph from "./components/MathGraph";

import UnifiedBoardContainer from "./components/boards/UnifiedBoardContainer";
import Whiteboard, { KatexMath } from "./components/Whiteboard";
import { EquationSolution, VideoScene, ThemeType, NarratorType } from "./types";
import AuthModal from "./components/AuthModal";
import CyberShieldModal from "./components/CyberShieldModal";
import PaymentModal from "./components/PaymentModal";
import AIChat from "./components/AIChat";
import Explanation from "./components/Explanation";
import WordProblemSolver from "./components/WordProblemSolver";
import VoiceAssistant from "./components/VoiceAssistant";
import ShapeInspectorModal from "./components/ShapeInspectorModal";
import KineticMatrix, { parseMatrixFromText } from "@/components/ui/kinetic-matrix";
import {
  createSpeechRecognition,
  parseSpokenMath,
  cleanLatexForSpeech,
  getBestHumanVoice,
  initSpeechVoices,
  getVoiceDisplayName,
  VoicePersona,
} from "./utils/speechUtils";

// Static reference presets for instant exploration
const PRESET_EQUATIONS = [
  { name: "Trig Equation", expr: "sin(x) = 0.5" },
  { name: "Unit Circle", expr: "unit_circle(pi/3)" },
  { name: "Distance Formula", expr: "distance([1, 2], [4, 6])" },
  { name: "Midpoint Formula", expr: "midpoint([2, -4], [6, 8])" },
  { name: "Pythagorean", expr: "pythagorean(3, 4)" },
  { name: "Dynamic Triangle", expr: "triangle(3, 4, 5)" },
  { name: "Circle Area", expr: "circle(5)" },
  { name: "Translate Circle", expr: "translate(circle, 2, -1)" },
  { name: "Rotate Square", expr: "rotate(square, 45)" },
  { name: "Derive Quadratic", expr: "x^2 - 5x + 6" },
  { name: "Integrate Quadratic", expr: "integrate(x^2 - 5x + 6)" },
  { name: "2×2 Determinant", expr: "det([[1, 2], [3, 4]])" },
  { name: "3×3 3D Matrix", expr: "[[2, 0, 1], [0, 1, 0], [1, 0, 2]]" },
  { name: "4×4 4D Tesseract", expr: "[[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]" },
  { name: "Matrix Eigenvalue", expr: "eigen([[1, 2], [2, 1]])" },
  { name: "Statistics Mean", expr: "mean([10, 20, 30, 40, 50])" },
  { name: "5-Number Summary", expr: "summary([12, 15, 18, 20, 24, 28, 30, 45])" },
  { name: "Linear Regression", expr: "regression([(1, 2), (2, 3), (3, 5), (4, 4), (5, 7)])" },
  { name: "Normal Z-Score", expr: "z_score([10, 20, 30, 40, 50], 35)" },
  { name: "Binomial Dist", expr: "binomial(10, 3, 0.5)" }
];

interface ThemeInfo {
  bg: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
  dot: string;
  label: string;
  subtitle?: string;
  bestFor?: string;
  vibe?: string;
  isFlagship?: boolean;
  isLight?: boolean;
}

const THEME_CLASSES: Record<ThemeType, ThemeInfo> = {
  blueprint: {
    bg: "bg-blueprint-canvas bg-[#0b1329]",
    border: "border-cyan-500/40",
    accent: "text-cyan-400",
    text: "text-cyan-100",
    muted: "text-cyan-300/70",
    dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]",
    label: "The Architect's Blueprint",
    subtitle: "Technical & Analytical",
    bestFor: "Advanced math tools, linear algebra visualizers, algorithmic demos, or engineering calculators.",
    vibe: "Technical drafting papers, isometric grid patterns, fine 1px structural lines, and monospace typography.",
    isFlagship: true
  },
  chalkboard: {
    bg: "bg-blackboard-canvas bg-[#111813]",
    border: "border-amber-900/40",
    accent: "text-amber-300",
    text: "text-[#f5f5ed]",
    muted: "text-amber-200/70",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
    label: "Chalk & Scholar",
    subtitle: "Classic Academic / Modern Blackboard",
    bestFor: "Educational platforms, lecture notes, theorem solvers, and step-by-step proofs.",
    vibe: "A clean, modern take on university blackboards and polished monograph typography (reminiscent of 3Blue1Brown or classic Springer-Verlag texts).",
    isFlagship: true
  },
  cosmos: {
    bg: "bg-cosmos-canvas bg-[#120a2a]",
    border: "border-purple-500/40",
    accent: "text-purple-300",
    text: "text-purple-100",
    muted: "text-purple-300/70",
    dot: "bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)]",
    label: "Generative Cosmos / Sacred Geometry",
    subtitle: "Visual & Exploratory",
    bestFor: "Visual math sandboxes (fractals, Mandelbrot sets, cellular automata, Fourier transforms).",
    vibe: "Dark, ambient, and fluid—framing mathematics as the hidden fabric of nature and physics.",
    isFlagship: true
  },
  lightAcademic: {
    bg: "bg-light-academic-canvas bg-[#ffffff]",
    border: "border-[#CBD5E1]",
    accent: "text-[#2563EB]",
    text: "text-[#0F172A]",
    muted: "text-[#475569]",
    dot: "bg-[#2563EB] shadow-[0_0_8px_rgba(37,99,235,0.4)]",
    label: "Light Academic",
    subtitle: "Clean & Trustworthy",
    bestFor: "Clean, high-trust environment for rigorous math solving, textbook problem exploration, and paper proof verification.",
    vibe: "Pure white cards (#FFFFFF), crisp slate text (#0F172A), cobalt blue primary (#2563EB), and vivid purple accents (#7C3AED).",
    isFlagship: true,
    isLight: true
  },
  darkAI: {
    bg: "bg-dark-ai-canvas bg-[#0b1020]",
    border: "border-[#273449]",
    accent: "text-[#6366F1]",
    text: "text-[#F8FAFC]",
    muted: "text-[#94A3B8]",
    dot: "bg-[#6366F1] shadow-[0_0_8px_rgba(99,102,241,0.7)]",
    label: "Dark AI",
    subtitle: "Next-Gen AI Core",
    bestFor: "Default dark theme for deep algorithmic focus, neural tensor graphing, and modern AI math tutoring.",
    vibe: "Deep neural background (#0B1020), slate dark cards (#111827), indigo primary (#6366F1), and cyan highlights (#06B6D4).",
    isFlagship: true
  },
  notebook: {
    bg: "bg-notebook-canvas bg-[#FAF8F3]",
    border: "border-[#D1C7B7]",
    accent: "text-[#1E40AF]",
    text: "text-[#242018]",
    muted: "text-[#574E3F]",
    dot: "bg-[#1E40AF] shadow-[0_0_8px_rgba(30,64,175,0.4)]",
    label: "Notebook",
    subtitle: "Digital Math Notebook",
    bestFor: "Simulating a mathematician's authentic personal lab notebook, scratchpad algebra, and study notes.",
    vibe: "Warm ivory paper (#FAF8F3), quadrille graph lines, Parker fountain pen blue (#1E40AF), and red margin indicators.",
    isFlagship: true,
    isLight: true
  },
  glassmorphic: {
    bg: "bg-[#120826]",
    border: "border-purple-500/30",
    accent: "text-fuchsia-400",
    text: "text-purple-100",
    muted: "text-purple-300/70",
    dot: "bg-fuchsia-500",
    label: "Glass Space"
  },
  darkroom: {
    bg: "bg-[#09090b]",
    border: "border-zinc-800",
    accent: "text-red-400",
    text: "text-zinc-100",
    muted: "text-zinc-400",
    dot: "bg-red-500",
    label: "Laser Dark"
  },
  cyberpunk: {
    bg: "bg-[#0d0914]",
    border: "border-yellow-500/40",
    accent: "text-yellow-400",
    text: "text-yellow-100",
    muted: "text-yellow-300/70",
    dot: "bg-yellow-400",
    label: "Cyber Neon"
  },
  sunset: {
    bg: "bg-[#1c0f0a]",
    border: "border-amber-800/40",
    accent: "text-amber-400",
    text: "text-amber-100",
    muted: "text-amber-300/70",
    dot: "bg-amber-500",
    label: "Amber Sunset"
  },
  synthwave: {
    bg: "bg-[#14061f]",
    border: "border-pink-500/40",
    accent: "text-pink-400",
    text: "text-pink-100",
    muted: "text-pink-300/70",
    dot: "bg-pink-500",
    label: "Synthwave"
  },
  nordic: {
    bg: "bg-[#0b1219]",
    border: "border-slate-700/50",
    accent: "text-sky-300",
    text: "text-slate-100",
    muted: "text-slate-400",
    dot: "bg-sky-400",
    label: "Nordic Clean"
  },
  matrix: {
    bg: "bg-[#040d06]",
    border: "border-green-600/40",
    accent: "text-green-400",
    text: "text-green-100",
    muted: "text-green-300/70",
    dot: "bg-green-500",
    label: "Matrix Terminal"
  },
  royal: {
    bg: "bg-[#180814]",
    border: "border-amber-500/30",
    accent: "text-amber-300",
    text: "text-amber-100",
    muted: "text-amber-200/70",
    dot: "bg-amber-400",
    label: "Royal Velvet"
  }
};


export default function App() {
  const [equationInput, setEquationInput] = useState<string>("x^2 - 5x + 6");
  const extractedMatrix = React.useMemo(() => parseMatrixFromText(equationInput), [equationInput]);
  const [loading, setLoading] = useState<boolean>(false);
  const [solution, setSolution] = useState<EquationSolution | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1.0); // Speed multiplier: 0.5x, 1x, 1.5x, 2x
  const [theme, setTheme] = useState<ThemeType>(() => { return (localStorage.getItem("math_theme") as ThemeType || "chalkboard"); });
  const [narrator, setNarrator] = useState<NarratorType>("natural");
  const [typingProgress, setTypingProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [renderingVideo, setRenderingVideo] = useState<boolean>(false);
  const [videoQuality, setVideoQuality] = useState<string>("medium");
  const [currentView, setCurrentView] = useState<"dashboard" | "methods" | "matrix" | "aichat" | "word_problems" | "functions" | "proofs">("dashboard");
  const [showMatrixBackground, setShowMatrixBackground] = useState<boolean>(true);


  // Auth & Session States
  const [userToken, setUserToken] = useState<string | null>(localStorage.getItem("math_token"));
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem("math_email"));
  const [isPremium, setIsPremium] = useState<boolean>(localStorage.getItem("math_premium") === "true");

  // Modal Control States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCyberModalOpen, setIsCyberModalOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const handleTheme = (newTheme: ThemeType) => {
    setTheme(newTheme);
    localStorage.setItem('math_theme', newTheme);
  };

  // Initialize speech voices cache on mount
  useEffect(() => {
    initSpeechVoices();
  }, []);

  // Verify token on mount
  useEffect(() => {
    if (userToken) {
      fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${userToken}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Invalid token");
        })
        .then(data => {
          setIsPremium(data.is_premium);
          setUserEmail(data.email);
          localStorage.setItem("math_premium", String(data.is_premium));
          localStorage.setItem("math_email", data.email);
        })
        .catch(() => {
          handleSignOut();
        });
    }
  }, [userToken]);

  const handleSignOut = () => {
    if (userToken) {
      fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${userToken}` }
      }).catch(() => {});
    }
    setUserToken(null);
    setUserEmail(null);
    setIsPremium(false);
    localStorage.removeItem("math_token");
    localStorage.removeItem("math_email");
    localStorage.removeItem("math_premium");
  };

  const handleAuthSuccess = (token: string, email: string, premium: boolean) => {
    setUserToken(token);
    setUserEmail(email);
    setIsPremium(premium);
    localStorage.setItem("math_token", token);
    localStorage.setItem("math_email", email);
    localStorage.setItem("math_premium", String(premium));
  };


  // Local history queue for render queue
  const [historyList, setHistoryList] = useState<Array<{ equation: string, type: string, completed: boolean, date: string }>>([
    { equation: "x^2 - 5x + 6", type: "Calculus Derivative", completed: true, date: "17:15" },
    { equation: "integrate(x^2 - 5x + 6)", type: "Calculus Integral", completed: true, date: "17:10" },
    { equation: "det([[1, 2], [3, 4]])", type: "Linear Algebra Det", completed: true, date: "17:05" }
  ]);

  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isShapeModalOpen, setIsShapeModalOpen] = useState(false);
  const [ocrPreviewImage, setOcrPreviewImage] = useState<string | null>(null);
  const [ocrExtractedMath, setOcrExtractedMath] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecordingMainInput, setIsRecordingMainInput] = useState(false);
  const mainRecognitionRef = useRef<any>(null);

  const formatOcrPreviewToLatex = (input: string): string => {
    if (!input) return "";
    let res = input.trim();

    // Convert determinant of matrix: det([[...], [...]])
    res = res.replace(/det\(\s*\[\s*\[(.*?)\]\s*,\s*\[(.*?)\]\s*\]\s*\)/gi, (_m, r1, r2) => {
      const c1 = r1.split(',').map((x: string) => x.trim()).join(' & ');
      const c2 = r2.split(',').map((x: string) => x.trim()).join(' & ');
      return `\\det\\begin{pmatrix}${c1} \\\\ ${c2}\\end{pmatrix}`;
    });
    res = res.replace(/det\(\s*\[\s*\[(.*?)\]\s*,\s*\[(.*?)\]\s*,\s*\[(.*?)\]\s*\]\s*\)/gi, (_m, r1, r2, r3) => {
      const c1 = r1.split(',').map((x: string) => x.trim()).join(' & ');
      const c2 = r2.split(',').map((x: string) => x.trim()).join(' & ');
      const c3 = r3.split(',').map((x: string) => x.trim()).join(' & ');
      return `\\det\\begin{pmatrix}${c1} \\\\ ${c2} \\\\ ${c3}\\end{pmatrix}`;
    });

    // Convert raw 2x2 matrix: [[a, b], [c, d]]
    res = res.replace(/\[\s*\[(.*?)\]\s*,\s*\[(.*?)\]\s*\]/g, (_m, r1, r2) => {
      const c1 = r1.split(',').map((x: string) => x.trim()).join(' & ');
      const c2 = r2.split(',').map((x: string) => x.trim()).join(' & ');
      return `\\begin{pmatrix}${c1} \\\\ ${c2}\\end{pmatrix}`;
    });

    // Convert raw 3x3 matrix: [[...], [...], [...]]
    res = res.replace(/\[\s*\[(.*?)\]\s*,\s*\[(.*?)\]\s*,\s*\[(.*?)\]\s*\]/g, (_m, r1, r2, r3) => {
      const c1 = r1.split(',').map((x: string) => x.trim()).join(' & ');
      const c2 = r2.split(',').map((x: string) => x.trim()).join(' & ');
      const c3 = r3.split(',').map((x: string) => x.trim()).join(' & ');
      return `\\begin{pmatrix}${c1} \\\\ ${c2} \\\\ ${c3}\\end{pmatrix}`;
    });

    res = res.replace(/integrate\((.*?)\)/gi, "\\int $1 dx");
    res = res.replace(/derive\((.*?)\)/gi, "\\frac{d}{dx}\\left[$1\\right]");
    res = res.replace(/sqrt\((.*?)\)/gi, "\\sqrt{$1}");
    res = res.replace(/\*/g, " \\cdot ");
    return res;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Main prompt speech-to-text dictation
  const toggleMainVoice = () => {
    if (isRecordingMainInput) {
      if (mainRecognitionRef.current) {
        mainRecognitionRef.current.stop();
      }
      setIsRecordingMainInput(false);
      return;
    }

    const recognition = createSpeechRecognition();
    if (!recognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    recognition.onstart = () => {
      setIsRecordingMainInput(true);
      setStatusMessage("Listening to spoken math equation...");
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) {
        const parsed = parseSpokenMath(finalTranscript);
        setEquationInput(parsed);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Main voice recognition error:", event.error);
      setIsRecordingMainInput(false);
      setStatusMessage("");
    };

    recognition.onend = () => {
      setIsRecordingMainInput(false);
      setStatusMessage("");
    };

    mainRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn("Failed to start voice recognition:", e);
      setIsRecordingMainInput(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setStatusMessage("Could not access camera. Please allow camera permissions or upload an image file.");
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureCameraSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/png");
      stopCamera();
      processOcrImage(base64);
    }
  };

  const processOcrImage = async (base64data: string) => {
    setOcrPreviewImage(base64data);
    setIsOcrLoading(true);
    setStatusMessage("Extracting math from image...");

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64data })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "OCR failed.");
      }

      const data = await response.json();
      setOcrExtractedMath(data.equation || "");
      setStatusMessage("Math extracted successfully!");
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`OCR Error: ${err.message}`);
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      setIsOcrModalOpen(true);
      processOcrImage(base64data);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const activeSceneRef = useRef<number>(0);
  const timerRef = useRef<any>(null);
  const typingTimerRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Sync activeSceneRef for timers
  useEffect(() => {
    activeSceneRef.current = activeSceneIndex;
  }, [activeSceneIndex]);

  // Load standard preset on mount
  useEffect(() => {
    handleSolve("x^2 - 5x + 6");
  }, []);

  // Handle auto-typing subtitle animation & text-to-speech narration loop
  useEffect(() => {
    if (!solution || !solution.scenes || solution.scenes.length === 0) return;

    const activeScene = solution.scenes[activeSceneIndex];
    if (!activeScene) return;

    // Reset typing layout
    setTypingProgress(0);
    clearInterval(typingTimerRef.current);

    // Speed modifiers
    const textLength = activeScene.explanation.length;
    let baseInterval = 25; // millisecond per letter
    if (speed === 0.5) baseInterval = 45;
    if (speed === 1.5) baseInterval = 15;
    if (speed === 2.0) baseInterval = 8;

    let lettersTyped = 0;
    typingTimerRef.current = setInterval(() => {
      lettersTyped += 1;
      const progress = Math.min(lettersTyped / textLength, 1);
      setTypingProgress(progress);
      if (progress >= 1) {
        clearInterval(typingTimerRef.current);
      }
    }, baseInterval);

    // Speak Math Solution Narration using synthesis API
    if (narrator !== "mute" && !isMuted) {
      triggerAudioNarration(activeScene.explanation);
    } else {
      stopSpeech();
    }

    return () => {
      clearInterval(typingTimerRef.current);
    };
  }, [activeSceneIndex, solution, speed, narrator, isMuted]);

  // Audio trigger using human neural voices and natural mathematical speech
  const triggerAudioNarration = (text: string) => {
    try {
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      // Stop ongoing voice
      window.speechSynthesis.cancel();

      // Clean LaTeX commands from narrative audio output so it speaks natural human mathematical language
      const cleanerSpeech = cleanLatexForSpeech(text);
      if (!cleanerSpeech) return;

      const utterance = new SpeechSynthesisUtterance(cleanerSpeech);

      // Select appropriate synthesized tone profile
      const persona: VoicePersona =
        narrator === "assistant" ? "scholar" : narrator === "cyborg" ? "friendly" : "natural";
      const humanVoice = getBestHumanVoice({ persona });

      if (humanVoice) {
        utterance.voice = humanVoice;
      }

      // Natural human pitch and conversational cadence
      utterance.pitch = 1.0;
      utterance.rate = Math.min(1.4, Math.max(0.75, 0.98 * speed));

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech Synthesis blocked or unsupported in current environment.", e);
    }
  };

  const stopSpeech = () => {
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch { }
  };

  // Video timeline play interval manager
  useEffect(() => {
    if (isPlaying) {
      // Scene duration calculation based on paragraph length & current timing speed
      const determineDuration = () => {
        if (!solution || !solution.scenes[activeSceneIndex]) return 6000;
        const textLen = solution.scenes[activeSceneIndex].explanation.length;
        // Approx 150ms per letter, divided by play speed
        const calcTime = Math.max(4500, textLen * 45);
        return calcTime / speed;
      };

      const setNextStepTimer = () => {
        const ms = determineDuration();
        timerRef.current = setTimeout(() => {
          if (!solution) return;
          const nextIndex = activeSceneRef.current + 1;
          if (nextIndex < solution.scenes.length) {
            setActiveSceneIndex(nextIndex);
            setNextStepTimer();
          } else {
            // Loop back to first scene smoothly
            setActiveSceneIndex(0);
            setNextStepTimer();
          }
        }, ms);
      };

      setNextStepTimer();
    } else {
      clearTimeout(timerRef.current);
      stopSpeech();
    }

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [isPlaying, activeSceneIndex, solution, speed]);

  // Query Backend solver (either mock fallback template or true Gemini parsing engine)
  const handleSolve = async (eq: string) => {
    if (!eq || eq.trim() === "") return;
    setLoading(true);
    setStatusMessage("Parsing expression syntax...");
    stopSpeech();
    setIsPlaying(false);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (userToken) {
        headers["Authorization"] = `Bearer ${userToken}`;
      }

      const response = await fetch("/api/solve", {
        method: "POST",
        headers,
        body: JSON.stringify({ equation: eq })
      });

      if (response.status === 403) {
        const errData = await response.json().catch(() => ({}));
        setIsPaymentModalOpen(true);
        throw new Error(errData.detail || "You have reached the free solve limit. Please upgrade to Pro.");
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Mathematical parsing service returned an error status.");
      }

      const data: EquationSolution = await response.json();
      setSolution(data);
      setActiveSceneIndex(0);
      setStatusMessage("");

      // Prepend to interactive output render list and move to top if already exists
      const filtered = historyList.filter((h) => h.equation.toLowerCase() !== eq.toLowerCase());
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setHistoryList([
        { equation: eq, type: data.equationType || "Parsed Equation", completed: true, date: timeStr },
        ...filtered.slice(0, 5)
      ]);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportVideo = async () => {
    if (!equationInput) return;
    setRenderingVideo(true);
    setStatusMessage(`Initializing Manim rendering engine (${videoQuality === "low" ? "480p" : videoQuality === "medium" ? "720p" : "1080p"})...`);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (userToken) {
        headers["Authorization"] = `Bearer ${userToken}`;
      }

      const response = await fetch("/api/render", {
        method: "POST",
        headers,
        body: JSON.stringify({
          equation: equationInput,
          quality: videoQuality
        })
      });

      if (response.status === 403) {
        const errData = await response.json().catch(() => ({}));
        setIsPaymentModalOpen(true);
        throw new Error(errData.detail || "Pro subscription required for this video quality level.");
      }

      if (!response.ok) throw new Error("Video rendering service failed.");

      const data = await response.json();

      setStatusMessage("Downloading secure stream...");
      const videoResponse = await fetch(data.video_url, {
        headers: userToken ? { "Authorization": `Bearer ${userToken}` } : {}
      });
      if (!videoResponse.ok) throw new Error("Failed to authenticate video stream.");

      const blob = await videoResponse.blob();
      const blobUrl = URL.createObjectURL(blob);

      setVideoUrl(blobUrl);
      setStatusMessage("Video compiled successfully!");
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Failed to render video: ${err.message}`);
    } finally {
      setRenderingVideo(false);
    }
  };


  const currentScene: VideoScene | undefined = solution?.scenes[activeSceneIndex];
  const isChalkboard = theme === "chalkboard";
  const isBlueprint = theme === "blueprint";
  const isCosmos = theme === "cosmos";
  const isLightAcademic = theme === "lightAcademic";
  const isDarkAI = theme === "darkAI";
  const isNotebook = theme === "notebook";
  const isLight = isLightAcademic || isNotebook;

  return (
    <div className={`w-full min-h-screen ${THEME_CLASSES[theme].bg} ${isLight ? THEME_CLASSES[theme].text : "text-white"} font-sans flex flex-col overflow-x-hidden antialiased ${isChalkboard ? "selection:bg-amber-400/30 selection:text-white" : isBlueprint ? "selection:bg-cyan-400/30 selection:text-cyan-100" : isCosmos ? "selection:bg-purple-400/30 selection:text-purple-100" : isLightAcademic ? "selection:bg-blue-600/20 selection:text-blue-900" : isNotebook ? "selection:bg-amber-200 selection:text-stone-900" : isDarkAI ? "selection:bg-indigo-500/30 selection:text-indigo-100" : "selection:bg-blue-600/30"
      }`}>

      {/* Video Modal Overlay */}
      {videoUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-10">
          <div className="relative w-full max-w-5xl bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-black uppercase tracking-tighter">Exported Math Animation</h3>
              <button
                onClick={() => {
                  if (videoUrl && videoUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(videoUrl);
                  }
                  setVideoUrl(null);
                }}
                className="text-white/40 hover:text-white transition-colors"
              >
                CLOSE [X]
              </button>
            </div>
            <div className="aspect-video bg-black">
              <video
                key={videoUrl}
                src={videoUrl}
                controls
                autoPlay
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                className="w-full h-full"
              />
            </div>
            <div className="p-4 bg-blue-600/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest text-center">
              Rendered using Manim Community Edition v0.18.0
            </div>
          </div>
        </div>
      )}

      {/* OCR Math Scanner Modal */}
      {isOcrModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-[#0F0F12] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-black uppercase tracking-tight">Math, Geometry & Trigonometry Visual Scanner</h3>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  setIsOcrModalOpen(false);
                  setOcrPreviewImage(null);
                  setOcrExtractedMath("");
                }}
                className="text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode selection or preview area */}
            <div className="space-y-4">
              {isCameraActive ? (
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 flex gap-3">
                    <button
                      onClick={captureCameraSnapshot}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      Take Photo
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer"
                    >
                      Cancel Camera
                    </button>
                  </div>
                </div>
              ) : ocrPreviewImage ? (
                <div className="space-y-4">
                  <div className="relative aspect-video max-h-[260px] bg-black/50 border border-white/10 rounded-xl overflow-hidden flex items-center justify-center p-2">
                    <img src={ocrPreviewImage} alt="OCR Target" className="max-h-full max-w-full object-contain rounded" />
                    {isOcrLoading && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-blue-400 gap-2">
                        <RefreshCw className="w-8 h-8 animate-spin" />
                        <span className="text-xs font-bold tracking-wider uppercase font-mono">Analyzing Math, Diagram & Symbols...</span>
                      </div>
                    )}
                  </div>

                  {/* Extracted Math Result Display & Manual Correction */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest block mb-1">
                      Extracted Math Problem / Geometry Query (Editable)
                    </label>
                    <input
                      type="text"
                      value={ocrExtractedMath}
                      onChange={(e) => setOcrExtractedMath(e.target.value)}
                      placeholder="e.g. pythagorean(3, 4), triangle(5, 7, 8), sin(x) = 0.5, unit_circle(pi/3), [[1, 2], [3, 4]]"
                      className="w-full bg-white/5 border border-white/20 px-4 py-3 font-mono text-sm focus:outline-none focus:border-blue-500 rounded-lg text-blue-300"
                    />

                    {/* Live LaTeX / Matrix Render Preview */}
                    {ocrExtractedMath && (
                      <div className="p-3 bg-black/60 border border-blue-500/30 rounded-lg flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400/80">Live Formatted Preview:</span>
                        <div className="text-sm font-mono text-blue-200">
                          <KatexMath math={formatOcrPreviewToLatex(ocrExtractedMath)} block={false} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Dropzone File Upload */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-44 border-2 border-dashed border-white/20 hover:border-blue-500/50 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all space-y-2 group"
                  >
                    <Upload className="w-8 h-8 text-white/40 group-hover:text-blue-400 transition-colors" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white/80">Upload Photo / Document</span>
                    <span className="text-[10px] text-white/40 font-mono">PNG, JPG, WEBP up to 10MB</span>
                  </div>

                  {/* Camera Scanner Trigger */}
                  <div
                    onClick={startCamera}
                    className="h-44 border-2 border-dashed border-white/20 hover:border-blue-500/50 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all space-y-2 group"
                  >
                    <Camera className="w-8 h-8 text-white/40 group-hover:text-blue-400 transition-colors" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white/80">Use Web Camera</span>
                    <span className="text-[10px] text-white/40 font-mono">Snap equation directly</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              {ocrPreviewImage && (
                <button
                  onClick={() => {
                    setOcrPreviewImage(null);
                    setOcrExtractedMath("");
                  }}
                  className="text-xs text-white/50 hover:text-white font-bold uppercase tracking-wider cursor-pointer"
                >
                  Clear & Re-scan
                </button>
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={() => {
                    stopCamera();
                    setIsOcrModalOpen(false);
                    setOcrPreviewImage(null);
                    setOcrExtractedMath("");
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!ocrExtractedMath || isOcrLoading}
                  onClick={() => {
                    stopCamera();
                    setEquationInput(ocrExtractedMath);
                    handleSolve(ocrExtractedMath);
                    setIsOcrModalOpen(false);
                    setOcrPreviewImage(null);
                    setOcrExtractedMath("");
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Insert & Solve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shape Vision & Geometric Solver Modal */}
      <ShapeInspectorModal
        isOpen={isShapeModalOpen}
        onClose={() => setIsShapeModalOpen(false)}
        theme={theme}
        onApplyToWhiteboard={(eqCmd) => {
          setEquationInput(eqCmd);
          handleSolve(eqCmd);
        }}
      />

      {/* Executive Top Navigation Bar */}
      <header className={`flex flex-col md:flex-row justify-between items-center px-5 sm:px-7 py-3 border-b gap-3 transition-colors ${isChalkboard
        ? "border-amber-900/40 bg-[#09130f]/95 backdrop-blur-xl"
        : isBlueprint
          ? "border-cyan-500/30 bg-[#041224]/95 backdrop-blur-xl"
          : isCosmos
            ? "border-purple-500/30 bg-[#060412]/95 backdrop-blur-xl"
            : isLightAcademic
              ? "border-slate-200 bg-white/95 backdrop-blur-xl shadow-xs"
              : isDarkAI
                ? "border-slate-800/80 bg-[#080d1a]/95 backdrop-blur-xl"
                : isNotebook
                  ? "border-[#E2DAC7] bg-[#FAF8F3]/95 backdrop-blur-xl"
                  : "border-white/10 bg-black/40 backdrop-blur-xl"
        }`}>
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <label htmlFor="equation-bar-input" className="flex items-center gap-2.5 cursor-pointer select-none group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shadow-md transition-all group-hover:scale-105 ${isChalkboard
              ? "bg-[#182c21] border border-amber-500/50 text-amber-300 font-scholar-title shadow-amber-900/30"
              : isBlueprint
                ? "bg-[#051e3c] border border-cyan-500/50 text-cyan-300 font-mono shadow-cyan-950/40"
                : isCosmos
                  ? "bg-[#150a30] border border-purple-500/50 text-purple-300 shadow-purple-950/40"
                  : isLightAcademic
                    ? "bg-blue-600 text-white shadow-blue-500/20"
                    : "bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-indigo-500/25"
              }`}>
              {isChalkboard ? "Σ" : isBlueprint ? "⌖" : isCosmos ? "✦" : "Σ"}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold tracking-tight ${isLightAcademic ? "text-slate-900" : isNotebook ? "text-stone-900 font-academic" : "text-white"
                }`}>
                MathMotion
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold ${isChalkboard
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                : isLightAcademic
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-white/10 text-white/80 border-white/15"
                }`}>
                Studio
              </span>
            </div>
          </label>
        </div>

        {/* Center: Segmented Navigation Pill Bar */}
        <nav className={`flex items-center p-1 rounded-xl border text-xs font-medium backdrop-blur-md transition-all ${isLightAcademic
          ? "bg-slate-100/80 border-slate-200 text-slate-600"
          : "bg-black/40 border-white/10 text-white/70"
          }`}>
          <button
            onClick={() => setCurrentView("dashboard")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "dashboard"
              ? (isLightAcademic ? "bg-white text-blue-700 font-bold shadow-xs" : "bg-white/15 text-white font-bold shadow-xs")
              : "hover:text-white hover:bg-white/5"
              }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Studio
          </button>
          <button
            onClick={() => setCurrentView("methods")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "methods"
              ? (isLightAcademic ? "bg-white text-blue-700 font-bold shadow-xs" : "bg-white/15 text-white font-bold shadow-xs")
              : "hover:text-white hover:bg-white/5"
              }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            Methods
          </button>
          <button
            onClick={() => setCurrentView("matrix")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "matrix"
              ? (isLightAcademic ? "bg-white text-blue-700 font-bold shadow-xs" : "bg-white/15 text-white font-bold shadow-xs")
              : "hover:text-white hover:bg-white/5"
              }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Matrix Lab
          </button>
          <button
            onClick={() => setCurrentView("aichat")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "aichat"
              ? (isLightAcademic ? "bg-white text-blue-700 font-bold shadow-xs" : "bg-white/15 text-white font-bold shadow-xs")
              : "hover:text-white hover:bg-white/5"
              }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            AI Chat
          </button>
          <button
            onClick={() => setCurrentView("word_problems")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "word_problems"
              ? (isLightAcademic ? "bg-white text-blue-700 font-bold shadow-xs" : "bg-white/15 text-white font-bold shadow-xs")
              : "hover:text-white hover:bg-white/5"
              }`}
          >
            <Brain className="w-3.5 h-3.5 text-pink-400" />
            Word Problems
          </button>
          <button
            onClick={() => setCurrentView("functions")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "functions"
              ? (isLightAcademic ? "bg-white text-blue-700 font-bold shadow-xs" : "bg-white/15 text-white font-bold shadow-xs")
              : "hover:text-white hover:bg-white/5"
              }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            Function Studio
          </button>
          <button
            onClick={() => setCurrentView("proofs")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "proofs"
              ? (isLightAcademic ? "bg-white text-blue-700 font-bold shadow-xs" : "bg-white/15 text-white font-bold shadow-xs")
              : "hover:text-white hover:bg-white/5"
              }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
            Proof Engine
          </button>
        </nav>


        {/* Right Action Toolbar */}
        <div className="flex items-center gap-2">
          {/* Theme Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${isLightAcademic
                ? "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs"
                : "bg-white/5 hover:bg-white/10 text-white/80 border-white/10"
                }`}
              title="Switch Studio Palette Theme"
            >
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline text-[11px]">{THEME_CLASSES[theme].label}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isThemeMenuOpen && (
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl border p-1.5 shadow-2xl backdrop-blur-xl z-50 text-xs ${isLightAcademic ? "bg-white/95 border-slate-200 text-slate-800" : "bg-black/95 border-white/15 text-white"
                }`}>
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50 border-b border-current/10 mb-1">
                  Studio Themes
                </div>
                {Object.keys(THEME_CLASSES).slice(0, 6).map((key) => {
                  const t = THEME_CLASSES[key as ThemeType];
                  const isSel = theme === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        handleTheme(key as ThemeType);
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${isSel
                        ? (isLightAcademic ? "bg-blue-50 text-blue-700 font-bold" : "bg-white/15 text-white font-bold")
                        : "opacity-80 hover:opacity-100 hover:bg-white/5"
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                        {t.label}
                      </span>
                      {isSel && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shape Vision & Solver Trigger */}
          <button
            onClick={() => setIsShapeModalOpen(true)}
            className={`px-2.5 sm:px-3 py-1.5 border text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${isLightAcademic
              ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
              : "bg-indigo-600/15 hover:bg-indigo-600/25 border-indigo-500/30 text-indigo-300"
              }`}
            title="Geometric Shape Solver & Diagram OCR"
          >
            <Shapes className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vision</span>
          </button>

          {/* Quick Random Proposition */}
          <button
            onClick={() => {
              const randomPreset = PRESET_EQUATIONS[Math.floor(Math.random() * PRESET_EQUATIONS.length)];
              setEquationInput(randomPreset.expr);
              handleSolve(randomPreset.expr);
            }}
            className={`px-2.5 py-1.5 border text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${isLightAcademic
              ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              : "bg-white/5 hover:bg-white/10 text-white/80 border-white/10"
              }`}
            title="Randomize Math Problem"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Randomize</span>
          </button>

          {/* Upgrade Modal Trigger */}
          {/* Cyber Guard Shield Button */}
          <button
            onClick={() => setIsCyberModalOpen(true)}
            title="Cyber Defense Matrix & Real-time Telemetry"
            className={`px-2.5 sm:px-3 py-1.5 border text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${isLightAcademic
              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 shadow-xs"
              : "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300"
              }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Cyber Guard</span>
          </button>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className={`px-2.5 sm:px-3 py-1.5 border text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${isLightAcademic
              ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 shadow-xs"
              : "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300"
              }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
            <span>Pro</span>
          </button>

          {/* User Session */}
          {userToken ? (
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs ${isChalkboard ? "bg-[#101d16] border-amber-900/40" : "bg-white/5 border-white/10"
              }`}>
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px]">
                {userEmail?.slice(0, 1) || "U"}
              </div>
              <button
                onClick={handleSignOut}
                className="opacity-50 hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAuthModalMode("signin"); setIsAuthModalOpen(true); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${isLightAcademic ? "bg-blue-600 text-white hover:bg-blue-500 border-blue-600" : "bg-white/10 hover:bg-white/20 text-white border-white/15"
                }`}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* View Switcher: Methods Guide or Matrix Lab or Dashboard */}
      {currentView === "methods" ? (
        <Explanation
          theme={theme}
          initialEquation={equationInput}
          currentSolution={solution}
          onTryExample={(expr) => {
            setEquationInput(expr);
            setCurrentView("dashboard");
            handleSolve(expr);
          }}
          onClose={() => setCurrentView("dashboard")}
        />
      ) : currentView === "matrix" ? (
        <div className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
          <KineticMatrix
            theme={theme}
            title={isChalkboard ? "SCHOLAR LINEAR ALGEBRA & MATRIX LAB" : "LINEAR ALGEBRA & MATRIX LAB"}
            standalone={true}
            initialMatrix={extractedMatrix?.matrix}
            matrixExpr={equationInput}
            onMatrixExprChange={(expr) => setEquationInput(expr)}
            onSolve={(expr) => {
              setEquationInput(expr);
              setCurrentView("dashboard");
              handleSolve(expr);
            }}
          />
        </div>
      ) : currentView === "aichat" ? (
        <div className="flex-1 p-4 sm:p-8 max-w-5xl mx-auto w-full flex flex-col">
          <AIChat
            solution={solution}
            currentSence={currentScene}
            theme={theme}
            standalone={true}
            onClose={() => setCurrentView("dashboard")}
            onSolveEquation={(eq) => {
              setEquationInput(eq);
              setCurrentView("dashboard");
              handleSolve(eq);
            }}
          />
        </div>
      ) : currentView === "word_problems" ? (
        <WordProblemSolver
          theme={theme}
          userToken={userToken}
          onSendToStudio={(eq) => {
            setEquationInput(eq);
            handleSolve(eq);
            setCurrentView("dashboard");
          }}
        />
      ) : currentView === "functions" ? (
        <FunctionAnalyzer
          theme={theme}
          initialFunction={equationInput || "x^3 - 3*x^2 + 2"}
          onSendToStudio={(expr) => {
            setEquationInput(expr);
            handleSolve(expr);
            setCurrentView("dashboard");
          }}
        />
      ) : currentView === "proofs" ? (
        <ProofEngine
          theme={theme}
          initialStatement="sum(i, 1, n) = n*(n+1)/2"
          onSendToStudio={(formula) => {
            setEquationInput(formula);
            handleSolve(formula);
            setCurrentView("dashboard");
          }}
        />
      ) : (

        /* Main interactive grid dashboard layouts */
        <main className="flex-1 flex flex-col lg:flex-row h-full">

          {/* Left Interactive Editor and Video Slate Section (70% width) */}
          <section className={`flex-1 border-r flex flex-col p-4 sm:p-8 transition-colors ${isChalkboard ? "border-amber-900/30" : "border-white/10"
            }`} id="left-editor-section">

            {/* Elegant Mathematical Proposition Card */}
            <div className="flex-1 space-y-6">
              <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${isChalkboard
                ? "bg-[#0b1712] border-amber-900/40 text-amber-100"
                : isLight
                  ? "bg-white border-slate-200 text-slate-900 shadow-sm"
                  : "bg-white/[0.03] border-white/10 text-white backdrop-blur-md"
                }`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${isChalkboard ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}>
                      {solution?.equationType || "Mathematical Equation"}
                    </span>
                    {currentScene && (
                      <span className="text-[11px] font-mono opacity-50">
                        Step {activeSceneIndex + 1} of {solution?.scenes?.length || 1}
                      </span>
                    )}
                  </div>

                  <div className={`flex items-center gap-2`}>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${loading
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-300 animate-pulse"
                      : isChalkboard
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                        : "bg-blue-500/15 border-blue-500/30 text-blue-300"
                      }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                      {loading ? "Deriving Solution..." : "Axiom Rigor: Verified"}
                    </span>
                  </div>
                </div>

                <div className="py-2 overflow-x-auto">
                  <div className="text-2xl sm:text-3xl font-mono tracking-tight font-bold">
                    <KatexMath math={solution?.equation || equationInput} block={false} />
                  </div>
                </div>

                {solution?.summary && (
                  <p className="text-xs opacity-70 mt-1 font-sans leading-relaxed max-w-3xl">
                    {solution.summary}
                  </p>
                )}
              </div>

              {/* Error or Notice status panel */}
              {solution?.needsKey && (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 flex gap-3 text-sm text-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">Demo Presentation Mode</span>
                    <span>Gemini API Key is not set in Settings Secrets. Rendering dynamic interactive whiteboard lessons with coordinate plotting locally.</span>
                  </div>
                </div>
              )}

              {statusMessage && (
                <div className={`rounded-xl p-3 text-xs flex items-center gap-2 animate-pulse font-mono ${isChalkboard
                  ? "bg-[#12231b] border border-amber-500/30 text-amber-200"
                  : "bg-blue-950/30 border border-blue-500/20 text-blue-300"
                  }`}>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {statusMessage}
                </div>
              )}

              {/* Grid container layout splitting whiteboard display vs coordinate plotting graph */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">

                {/* Animated Scene Whiteboard Box Component */}
                <div className="flex flex-col h-full justify-between" id="whiteboard-container">
                  {currentScene ? (
                    <Whiteboard
                      scene={currentScene}
                      theme={theme}
                      isNarrating={isPlaying && narrator !== "mute" && !isMuted}
                      typingProgress={typingProgress}
                    />
                  ) : (
                    <div className={`h-[360px] border border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center ${isChalkboard ? "bg-[#0e1a14] border-amber-900/40 text-amber-200/50" : "bg-white/5 border-white/10 text-white/40"
                      }`}>
                      <Sparkles className="w-8 h-8 mb-2 text-amber-400 animate-pulse" />
                      <span>No active math whiteboard. Write an equation below to start.</span>
                    </div>
                  )}
                </div>

                {/* Interactive Dynamic Board Container: automatically picks the correct board for every question */}
                <div className="flex flex-col space-y-2">
                  <UnifiedBoardContainer
                    solution={solution}
                    currentScene={currentScene}
                    equationInput={equationInput}
                    theme={theme}
                    extractedMatrix={extractedMatrix}
                    onSolve={handleSolve}
                    onEquationChange={(expr) => setEquationInput(expr)}
                  />



                  {/* Visual coordinate context info cards beneath Graph */}
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <div className={`p-3 rounded-xl ${isChalkboard ? "bg-[#0e1a14] border border-amber-900/40 academic-frame" : isLightAcademic ? "bg-white border border-[#E2E8F0] academic-light-frame" : isDarkAI ? "bg-[#111827] border border-[#273449] dark-ai-frame" : isNotebook ? "bg-[#FFFDF8] border border-[#E2DAC7] notebook-frame" : "bg-white/5 border border-white/10"
                      }`}>
                      <p className={`text-[9px] uppercase font-bold tracking-widest ${isChalkboard ? "text-amber-200/60 font-scholar-title" : isLightAcademic ? "text-slate-500 font-sans" : isDarkAI ? "text-slate-400 font-mono" : isNotebook ? "text-stone-600 font-academic" : "text-white/40"}`}>
                        {isChalkboard ? "Curriculum Rigor Level" : isLightAcademic ? "Academic Domain" : isDarkAI ? "Tensor Classification" : isNotebook ? "Notebook ToCalculuspic" : " Level"}
                      </p>
                      <p className={`text-base font-bold mt-1 ${isChalkboard ? "text-amber-100 font-scholar-title" : isLight ? "text-slate-900" : "text-white"}`}>
                        {solution?.equationType || "Pre-Algebra"}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${isChalkboard ? "bg-[#0e1a14] border border-amber-900/40 academic-frame" : isLightAcademic ? "bg-white border border-[#E2E8F0] academic-light-frame" : isDarkAI ? "bg-[#111827] border border-[#273449] dark-ai-frame" : isNotebook ? "bg-[#FFFDF8] border border-[#E2DAC7] notebook-frame" : "bg-white/5 border border-white/10"
                      }`}>
                      <p className={`text-[9px] uppercase font-bold tracking-widest ${isChalkboard ? "text-amber-200/60 font-scholar-title" : isLightAcademic ? "text-slate-500 font-sans" : isDarkAI ? "text-slate-400 font-mono" : isNotebook ? "text-stone-600 font-academic" : "text-white/40"}`}>
                        {isChalkboard ? "Analytical Solution (Q.E.D.)" : isLightAcademic ? "Rigorous Resolution" : isDarkAI ? "Calculated Root Vector" : isNotebook ? "Derived Solution" : "Final Solution"}
                      </p>
                      <div className={`text-sm font-bold mt-1 font-mono truncate overflow-x-auto whitespace-normal scrollbar-none ${isChalkboard ? "text-amber-300 font-academic" : isLightAcademic ? "text-blue-600" : isDarkAI ? "text-cyan-400 font-mono" : isNotebook ? "text-blue-900 font-academic" : "text-blue-400"
                        }`}>
                        {solution ? (
                          <span className="inline-flex items-center gap-1">
                            Ans: <KatexMath math={solution.finalAnswer} block={false} />
                          </span>
                        ) : (
                          "Calculating..."
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* New equation entry prompt bar aligned with Academic Chalkboard */}
            <div className={`mt-8 pt-6 border-t ${isChalkboard ? "border-amber-900/30" : isLight ? "border-slate-200" : "border-white/10"}`} id="equation-entry-panel">
              {/* Quick Math & LaTeX Symbols Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                <span className={`text-[9px] font-bold uppercase tracking-wider mr-1 ${isChalkboard ? "text-amber-300 font-scholar-title" : isLightAcademic ? "text-blue-700 font-sans" : isDarkAI ? "text-cyan-400 font-mono" : isNotebook ? "text-stone-700 font-academic font-bold" : "text-blue-400 font-mono"
                  }`}>
                  {isChalkboard ? "Scholar's Chalk Keys:" : isNotebook ? "Notebook Math Keys:" : isLightAcademic ? "Academic Notation:" : isDarkAI ? "Neural Math Tokens:" : "Insert Symbol:"}
                </span>
                {[
                  { label: "∫ dx", insert: "integrate(x^2)" },
                  { label: "d/dx", insert: "derive(x^2 + sin(x))" },
                  { label: "x²", insert: "^2" },
                  { label: "√x", insert: "sqrt(x)" },
                  { label: "sin", insert: "sin(x)" },
                  { label: "cos", insert: "cos(x)" },
                  { label: "ln", insert: "ln(x)" },
                  { label: "exp", insert: "exp(x)" },
                  { label: "matrix", insert: "[[1, 2], [3, 4]]" },
                  { label: "det", insert: "det([[1, 2], [3, 4]])" },
                  { label: "eigen", insert: "eigen([[4, 2], [2, 3]])" }
                ].map((sym, idx) => (
                  <button
                    key={idx}
                    onClick={() => setEquationInput((prev) => prev ? `${prev} ${sym.insert}` : sym.insert)}
                    className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors cursor-pointer ${isChalkboard
                      ? "bg-[#13221a] hover:bg-[#1c3829] hover:border-amber-500/50 text-amber-200/90 hover:text-amber-100 border-amber-900/40 shadow-xs"
                      : isLightAcademic
                        ? "bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-700 border-slate-200 shadow-xs"
                        : isDarkAI
                          ? "bg-[#111827] hover:bg-[#1f2937] hover:border-indigo-500/50 text-cyan-300 hover:text-cyan-200 border-[#273449]"
                          : isNotebook
                            ? "bg-[#FFFDF8] hover:bg-[#F5EFE0] hover:border-blue-400 text-stone-800 hover:text-blue-900 border-[#E2DAC7] shadow-xs"
                            : "bg-white/5 hover:bg-blue-600/30 hover:border-blue-500/50 text-white/80 hover:text-white border-white/10"
                      }`}
                  >
                    {sym.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    id="equation-bar-input"
                    name="equation-bar-input"
                    placeholder="Enter mathematical equation (e.g. x^2 - 5x + 6, det([[1, 2], [3, 4]]), sin(x) = 0.5)..."
                    className={`w-full border px-4 py-3.5 font-mono text-sm sm:text-base focus:outline-none transition-all rounded-xl ${isChalkboard
                      ? "bg-[#0a1510] border-amber-900/50 focus:border-amber-400 text-[#faf8f2] placeholder:text-amber-200/30"
                      : isLightAcademic
                        ? "bg-white border-slate-200 focus:border-blue-600 text-slate-900 placeholder:text-slate-400 shadow-xs"
                        : isDarkAI
                          ? "bg-[#0b1020] border-slate-800 focus:border-indigo-500 text-white placeholder:text-slate-500"
                          : isNotebook
                            ? "bg-[#FFFDF8] border-[#E2DAC7] focus:border-[#1E40AF] text-[#242018] placeholder:text-stone-400 shadow-xs"
                            : "bg-white/5 border-white/15 focus:border-blue-500 placeholder:text-white/30"
                      }`}
                    value={equationInput}
                    onChange={(e) => setEquationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSolve(equationInput);
                      }
                    }}
                  />
                  <button
                    onClick={() => setEquationInput("")}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-all ${isChalkboard
                      ? "text-amber-200/60 hover:text-amber-100 bg-[#16291e]"
                      : isLightAcademic
                        ? "text-slate-400 hover:text-slate-700 bg-slate-100"
                        : isNotebook
                          ? "text-stone-400 hover:text-stone-700 bg-stone-100"
                          : "text-white/50 hover:text-white bg-white/10"
                      }`}
                  >
                    Clear
                  </button>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {/* Voice Dictation Button for Main Input */}
                <button
                  onClick={toggleMainVoice}
                  title={isRecordingMainInput ? "Stop Dictation" : "Dictate Equation (Voice Input)"}
                  className={`p-3.5 transition-all cursor-pointer rounded-xl flex items-center justify-center border ${isRecordingMainInput
                    ? "bg-red-500/30 border-red-500 text-red-400 animate-pulse"
                    : (isChalkboard ? "bg-[#13221a] hover:bg-[#1b3427] text-amber-300 border-amber-900/40" : isLightAcademic ? "bg-white hover:bg-slate-50 text-blue-600 border-slate-200 shadow-xs" : isNotebook ? "bg-[#FFFDF8] hover:bg-[#F5EFE0] text-blue-900 border-[#E2DAC7] shadow-xs" : isDarkAI ? "bg-[#111827] hover:bg-[#1a2336] text-cyan-300 border-[#273449]" : "bg-white/10 hover:bg-white/20 text-blue-400 border-white/20")
                    }`}
                >
                  {isRecordingMainInput ? (
                    <MicOff className="w-5 h-5 animate-pulse" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={() => setIsOcrModalOpen(true)}
                  disabled={isOcrLoading}
                  title="Math Image OCR Scanner"
                  className={`p-3.5 transition-colors cursor-pointer rounded-xl flex items-center justify-center border disabled:opacity-40 ${isChalkboard
                    ? "bg-[#13221a] hover:bg-[#1b3427] text-amber-300 border-amber-900/40"
                    : isLightAcademic
                      ? "bg-white hover:bg-slate-50 text-blue-600 border-slate-200 shadow-xs"
                      : isNotebook
                        ? "bg-[#FFFDF8] hover:bg-[#F5EFE0] text-stone-700 border-[#E2DAC7] shadow-xs"
                        : isDarkAI
                          ? "bg-[#111827] hover:bg-[#1a2336] text-cyan-300 border-[#273449]"
                          : "bg-white/10 hover:bg-white/20 text-white border-white/20"
                    }`}
                >
                  {isOcrLoading ? (
                    <RefreshCw className={`w-5 h-5 animate-spin ${isChalkboard ? "text-amber-400" : "text-blue-400"}`} />
                  ) : (
                    <Scan className={`w-5 h-5 ${isChalkboard ? "text-amber-300" : isLightAcademic ? "text-blue-600" : isDarkAI ? "text-cyan-400" : isNotebook ? "text-stone-700" : "text-blue-400"}`} />
                  )}
                </button>

                {/* Shape Vision & Geometric Solver Button */}
                <button
                  onClick={() => setIsShapeModalOpen(true)}
                  title="Shape Vision & Geometric Solver (Find Angles, Sides, Area)"
                  className={`p-3.5 transition-colors cursor-pointer rounded-xl flex items-center justify-center border ${isChalkboard
                    ? "bg-[#183626] hover:bg-[#234d37] text-amber-200 border-amber-500/40 shadow-sm"
                    : isLightAcademic
                      ? "bg-white hover:bg-slate-50 text-indigo-600 border-indigo-200 shadow-xs"
                      : isNotebook
                        ? "bg-[#FFFDF8] hover:bg-[#F5EFE0] text-blue-900 border-[#E2DAC7] shadow-xs"
                        : isDarkAI
                          ? "bg-[#111827] hover:bg-[#1a2336] text-indigo-400 border-[#273449]"
                          : "bg-white/10 hover:bg-white/20 text-indigo-400 border-white/20"
                    }`}
                >
                  <Shapes className={`w-5 h-5 ${isChalkboard ? "text-amber-300" : isLightAcademic ? "text-indigo-600" : isDarkAI ? "text-indigo-400" : isNotebook ? "text-blue-900" : "text-indigo-400"}`} />
                </button>

                <button
                  onClick={() => handleSolve(equationInput)}
                  disabled={loading}
                  className={`font-bold px-7 py-3.5 transition-all cursor-pointer rounded-xl flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 ${isChalkboard
                    ? "bg-[#1a3829] hover:bg-[#254f3a] disabled:opacity-50 text-amber-200 border border-amber-500/40 font-scholar-title shadow-black/50"
                    : isLightAcademic
                      ? "bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-sans shadow-blue-500/20"
                      : isDarkAI
                        ? "bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50 text-white font-mono shadow-indigo-500/25"
                        : isNotebook
                          ? "bg-[#1E40AF] hover:bg-blue-900 disabled:opacity-50 text-[#FAF8F3] font-academic shadow-stone-400/40"
                          : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white"
                    }`}
                  id="parse_equation_btn"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Deriving Rigor...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Solve & Prove ↵</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live KaTeX Equation Preview Card */}
              {equationInput.trim() && (
                <div className={`mt-3 px-4 py-2.5 rounded-lg flex items-center justify-between border ${isChalkboard
                  ? "bg-[#0e1a14] border-amber-900/40"
                  : isLightAcademic
                    ? "bg-blue-50/60 border-blue-200"
                    : isDarkAI
                      ? "bg-[#111827] border-[#273449]"
                      : isNotebook
                        ? "bg-[#FAF5EA] border-[#E2DAC7]"
                        : "bg-blue-950/20 border-blue-500/30"
                  }`}>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isChalkboard ? "text-amber-300 font-scholar-title" : isLightAcademic ? "text-blue-700 font-sans font-semibold" : isDarkAI ? "text-cyan-400 font-mono" : isNotebook ? "text-stone-700 font-academic font-semibold" : "font-mono text-blue-400"
                    }`}>
                    Live LaTeX Preview:
                  </span>
                  <div className="flex items-center gap-2">
                    {extractedMatrix && (
                      <button
                        onClick={() => setCurrentView("matrix")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer border shadow-xs ${isChalkboard
                          ? "bg-[#183626] hover:bg-[#234e37] text-amber-200 border-amber-500/40"
                          : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30"
                          }`}
                        title="Explore and visualize this matrix in the interactive 2D/3D Matrix Lab"
                      >
                        <Grid className="w-3.5 h-3.5 text-emerald-400" />
                        Open in Matrix Lab ({extractedMatrix.dim}×{extractedMatrix.dim})
                      </button>
                    )}
                    <div className={`text-sm font-medium px-2 py-0.5 rounded border ${isChalkboard
                      ? "bg-black/50 text-amber-200 border-amber-500/20"
                      : isLightAcademic
                        ? "bg-white text-blue-700 border-blue-200 shadow-xs"
                        : isDarkAI
                          ? "bg-[#0B1020] text-cyan-300 border-[#273449]"
                          : isNotebook
                            ? "bg-[#FFFDF8] text-stone-900 border-[#E2DAC7] shadow-xs"
                            : "bg-black/40 text-white border-white/5"
                      }`}>
                      <KatexMath math={equationInput} block={false} />
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Math Tool Palette: Trigonometry & Geometry */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-white/5">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isChalkboard ? "text-amber-300/70 font-scholar-title" : "text-white/40 font-mono"
                  }`}>
                  Trig &amp; Geo Tools:
                </span>
                {[
                  { label: "sin(x)=0.5", val: "sin(x) = 0.5" },
                  { label: "cos(x)=0", val: "cos(x) = 0" },
                  { label: "tan(x)=1", val: "tan(x) = 1" },
                  { label: "unit_circle(π/3)", val: "unit_circle(pi/3)" },
                  { label: "distance([1,2],[4,6])", val: "distance([1, 2], [4, 6])" },
                  { label: "midpoint([2,-4],[6,8])", val: "midpoint([2, -4], [6, 8])" },
                  { label: "pythagorean(3, 4)", val: "pythagorean(3, 4)" },
                  { label: "circle(5)", val: "circle(5)" },
                  { label: "rotate(square, 45)", val: "rotate(square, 45)" },
                  { label: "translate(circle, 2, -1)", val: "translate(circle, 2, -1)" }
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setEquationInput(item.val);
                      handleSolve(item.val);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${isChalkboard
                      ? "bg-[#14261d] hover:bg-[#1d392b] text-emerald-200 border-emerald-900/40 hover:text-white"
                      : "bg-blue-900/20 hover:bg-blue-900/40 text-cyan-200 border-cyan-500/20 hover:text-white"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Quick-select equations suggestions deck */}
              <div className={`flex flex-wrap items-center gap-2 mt-3 text-xs ${isChalkboard ? "text-amber-200/60 font-scholar-title" : "text-white/50"}`}>
                <span className="font-bold uppercase tracking-wider text-[10px]">
                  {isChalkboard ? "Curated Propositions:" : "Ready Presets:"}
                </span>
                {PRESET_EQUATIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setEquationInput(preset.expr);
                      handleSolve(preset.expr);
                    }}
                    className={`px-2.5 py-1 rounded font-mono border transition-all text-[11px] cursor-pointer ${isChalkboard
                      ? "bg-[#111f18] hover:bg-[#1a3326] text-amber-200/80 hover:text-amber-100 border-amber-900/30"
                      : "bg-white/5 hover:bg-white/15 hover:text-white text-white/70 border-white/5"
                      }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

          </section>

          {/* Right Settings and Configuration Sidebar (w-80 sidebar) */}
          <aside className={`w-full lg:w-80 flex flex-col border-t lg:border-t-0 transition-colors ${isChalkboard ? "border-amber-900/30 bg-[#09130f]" : "border-white/10"
            }`} id="right-aside-settings">

            {/* Dynamic settings options box */}
            <div className={`p-6 border-b ${isChalkboard ? "border-amber-900/30" : "border-white/10"}`}>
              <div className="flex items-center gap-1.5 mb-4">
                <Sliders className={`w-4 h-4 ${isChalkboard ? "text-amber-400" : "text-blue-500"}`} />
                <h2 className={`text-xs font-bold uppercase tracking-[0.2em] ${isChalkboard ? "font-scholar-title text-amber-200/80" : "text-white/50"}`}>
                  {isChalkboard ? "Lecture & Playback Controls" : "Motion & Playback"}
                </h2>
              </div>

              <div className="space-y-6">

                {/* Board Skins & Layout Styles selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-[10px] uppercase font-bold tracking-wider ${isChalkboard ? "text-amber-200/80 font-scholar-title" : isBlueprint ? "text-cyan-300 font-mono" : isCosmos ? "text-purple-300 font-sans" : isLight ? "text-slate-800 font-sans font-bold" : "text-white/70"
                      }`}>
                      Flagship Math Themes (6 Editions)
                    </label>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${isChalkboard ? "border-amber-500/30 text-amber-300 bg-amber-500/10" : isBlueprint ? "border-cyan-500/30 text-cyan-300 bg-cyan-500/10" : isCosmos ? "border-purple-500/30 text-purple-300 bg-purple-500/10" : isLight ? "border-blue-300 text-blue-700 bg-blue-50" : "border-white/20 text-white/50"
                      }`}>
                      Curated
                    </span>
                  </div>

                  {/* 6 Flagship Themes Cards */}
                  <div className="space-y-2 mb-4" id="flagship-themes-deck">
                    {(["lightAcademic", "darkAI", "notebook", "chalkboard", "blueprint", "cosmos"] as ThemeType[]).map((tKey, idx) => {
                      const tInfo = THEME_CLASSES[tKey];
                      const isSelected = theme === tKey;
                      return (
                        <div
                          key={tKey}
                          onClick={() => handleTheme(tKey)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer relative group ${isSelected
                            ? tKey === "lightAcademic"
                              ? "bg-white border-[#2563EB] ring-2 ring-[#2563EB]/40 shadow-md shadow-blue-500/20"
                              : tKey === "darkAI"
                                ? "bg-[#111827] border-[#6366F1] ring-2 ring-[#6366F1]/40 shadow-md shadow-indigo-950/60"
                                : tKey === "notebook"
                                  ? "bg-[#FFFDF8] border-[#1E40AF] ring-2 ring-[#1E40AF]/40 shadow-md shadow-amber-900/20"
                                  : tKey === "blueprint"
                                    ? "bg-[#061d3b] border-cyan-400 ring-1 ring-cyan-400 shadow-md shadow-cyan-950/60"
                                    : tKey === "chalkboard"
                                      ? "bg-[#183626] border-amber-400 ring-1 ring-amber-400 shadow-md shadow-amber-950/60"
                                      : "bg-[#170c36] border-purple-400 ring-1 ring-purple-400 shadow-md shadow-purple-950/60"
                            : isLightAcademic
                              ? "bg-slate-50/70 hover:bg-slate-100 border-slate-200"
                              : isNotebook
                                ? "bg-[#FAF8F3]/70 hover:bg-[#F3EFE6] border-[#E2DAC7]"
                                : isDarkAI
                                  ? "bg-[#111827]/70 hover:bg-[#1a2336] border-[#273449]"
                                  : isChalkboard
                                    ? "bg-[#0c1813]/60 hover:bg-[#12241b] border-amber-900/30 hover:border-amber-500/30"
                                    : isBlueprint
                                      ? "bg-[#03152b]/60 hover:bg-[#061e3d] border-cyan-500/20 hover:border-cyan-500/40"
                                      : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-mono ${isSelected ? "text-amber-300 font-bold" : isLight ? "text-slate-500" : "opacity-40"}`}>
                                0{idx + 1}.
                              </span>
                              <span className={`text-[11px] font-bold tracking-tight ${isSelected
                                ? (tKey === "lightAcademic" ? "text-blue-600" : tKey === "darkAI" ? "text-cyan-300" : tKey === "notebook" ? "text-blue-900" : tKey === "blueprint" ? "text-cyan-200" : tKey === "chalkboard" ? "text-amber-200" : "text-purple-200")
                                : isLight ? "text-slate-800" : "text-white/90"
                                }`}>
                                {tInfo.label}
                              </span>
                            </div>
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tInfo.dot} ${isSelected ? "ring-2 ring-white/60" : ""}`} />
                          </div>

                          <div className={`text-[9px] uppercase tracking-wider font-semibold mb-1 flex items-center gap-1 ${isSelected ? (tKey === "lightAcademic" ? "text-blue-600" : tKey === "darkAI" ? "text-indigo-400" : tKey === "notebook" ? "text-stone-700 font-academic" : tKey === "blueprint" ? "text-cyan-400" : tKey === "chalkboard" ? "text-amber-300" : "text-purple-300") : (isLight ? "text-slate-500" : "text-white/50")
                            }`}>
                            <span>({tInfo.subtitle})</span>
                          </div>

                          <div className={`text-[9px] leading-snug space-y-0.5 ${isLight ? "opacity-90" : "opacity-80"}`}>
                            <p className={`${isLight ? "text-slate-600" : "text-white/70"} line-clamp-2`}>
                              <span className={`font-semibold ${isLight ? "text-slate-900" : "text-white/90"}`}>Best for: </span>
                              {tInfo.bestFor}
                            </p>
                            <p className={`${isLight ? "text-slate-500" : "text-white/50"} italic line-clamp-2`}>
                              <span className={`font-semibold not-italic ${isLight ? "text-slate-700" : "text-white/70"}`}>Vibe: </span>
                              {tInfo.vibe}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Alternative Palettes */}
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`text-[9px] uppercase font-bold tracking-wider opacity-60 ${isChalkboard ? "text-amber-200/60 font-scholar-title" : isBlueprint ? "text-cyan-300/60 font-mono" : isLight ? "text-slate-700 font-sans" : "text-white/60"
                      }`}>
                      Alternative Studio Palettes ({Object.keys(THEME_CLASSES).length - 6})
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5" id="skin-themes-deck">
                    {(Object.keys(THEME_CLASSES) as ThemeType[])
                      .filter((k) => k !== "blueprint" && k !== "chalkboard" && k !== "cosmos" && k !== "lightAcademic" && k !== "darkAI" && k !== "notebook")
                      .map((tKey) => {
                        const tInfo = THEME_CLASSES[tKey];
                        const isSelected = theme === tKey;
                        return (
                          <button
                            key={tKey}
                            onClick={() => handleTheme(tKey)}
                            className={`py-1.5 px-2 text-[10px] font-bold uppercase border tracking-tight transition-all rounded flex items-center justify-between gap-1 cursor-pointer ${isSelected
                              ? "bg-white text-black border-white shadow-md shadow-white/20"
                              : isChalkboard
                                ? "border-amber-900/30 text-amber-200/60 hover:bg-[#12241b]"
                                : isBlueprint
                                  ? "border-cyan-500/20 text-cyan-200/60 hover:bg-[#051c38]"
                                  : isLight
                                    ? "border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                                    : "border-white/10 text-white/70 hover:bg-white/5 hover:border-white/30"
                              }`}
                          >
                            <span className="truncate">{tInfo.label}</span>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${tInfo.dot}`} />
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Synthesized voice setting */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-[10px] uppercase font-bold block tracking-wider ${isChalkboard ? "text-amber-200/70 font-scholar-title" :
                      isLightAcademic ? "text-slate-700 font-sans" :
                        isNotebook ? "text-stone-800 font-academic" :
                          isDarkAI ? "text-slate-300 font-mono" :
                            "text-white/60"
                      }`}>
                      {isChalkboard ? "Lecturer Persona" : "Auto Audio Narrator"}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const testText = isChalkboard
                            ? "Step one: we apply the fundamental theorem of calculus to evaluate the definite integral."
                            : narrator === "assistant"
                              ? "Step one: let us analyze the discriminant to determine the nature of the roots."
                              : narrator === "cyborg"
                                ? "Step one: plotting the quadratic curve and identifying the vertex coordinates."
                                : "Step one: let us factor the quadratic polynomial into linear binomial factors.";
                          triggerAudioNarration(testText);
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-mono transition-colors cursor-pointer ${isChalkboard ? "bg-amber-900/40 text-amber-300 hover:bg-amber-800/60" :
                          isLightAcademic ? "bg-blue-100 text-blue-700 hover:bg-blue-200" :
                            isNotebook ? "bg-stone-200 text-stone-800 hover:bg-stone-300" :
                              isDarkAI ? "bg-indigo-950/80 text-cyan-300 border border-indigo-800/40 hover:bg-indigo-900" :
                                "bg-white/10 text-white/80 hover:bg-white/20"
                          }`}
                        title="Preview Narrator Voice"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Preview Voice</span>
                      </button>
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-1 rounded transition-colors cursor-pointer ${isLightAcademic ? "text-slate-500 hover:text-slate-800" :
                          isNotebook ? "text-stone-600 hover:text-stone-900" :
                            "text-white/60 hover:text-white"
                          }`}
                        title={isMuted ? "Unmute Voice" : "Mute Voice"}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className={`w-4 h-4 ${isChalkboard ? "text-amber-400" : isLightAcademic ? "text-blue-600" : isDarkAI ? "text-cyan-400" : "text-emerald-400"}`} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2" id="narrator-type-deck">
                    <button
                      onClick={() => { setNarrator("natural"); setIsMuted(false); }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${narrator === "natural" && !isMuted
                        ? isChalkboard ? "bg-[#183626] text-amber-200 border-amber-500/40"
                          : isLightAcademic ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : isDarkAI ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                              : isNotebook ? "bg-blue-900 text-white border-blue-900 shadow-sm"
                                : "bg-blue-600 text-white border-blue-500"
                        : isChalkboard ? "border-amber-900/30 text-amber-200/60 hover:bg-white/5"
                          : isLightAcademic ? "border-slate-200 text-slate-700 bg-white hover:bg-slate-100"
                            : isDarkAI ? "border-[#273449] text-slate-300 bg-[#111827] hover:bg-[#1a2336]"
                              : isNotebook ? "border-[#E2DAC7] text-stone-700 bg-[#FFFDF8] hover:bg-[#F5EFE0]"
                                : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      {isChalkboard ? "Prof. Emeritus (Male)" : "Professor AI (Male)"}
                    </button>
                    <button
                      onClick={() => { setNarrator("assistant"); setIsMuted(false); }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${narrator === "assistant" && !isMuted
                        ? isChalkboard ? "bg-[#183626] text-amber-200 border-amber-500/40"
                          : isLightAcademic ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : isDarkAI ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                              : isNotebook ? "bg-blue-900 text-white border-blue-900 shadow-sm"
                                : "bg-blue-600 text-white border-blue-500"
                        : isChalkboard ? "border-amber-900/30 text-amber-200/60 hover:bg-white/5"
                          : isLightAcademic ? "border-slate-200 text-slate-700 bg-white hover:bg-slate-100"
                            : isDarkAI ? "border-[#273449] text-slate-300 bg-[#111827] hover:bg-[#1a2336]"
                              : isNotebook ? "border-[#E2DAC7] text-stone-700 bg-[#FFFDF8] hover:bg-[#F5EFE0]"
                                : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      {isChalkboard ? "Oxford Fellow (Female)" : "Scholar AI (Female)"}
                    </button>
                    <button
                      onClick={() => { setNarrator("cyborg"); setIsMuted(false); }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${narrator === "cyborg" && !isMuted
                        ? isChalkboard ? "bg-[#183626] text-amber-200 border-amber-500/40"
                          : isLightAcademic ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : isDarkAI ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                              : isNotebook ? "bg-blue-900 text-white border-blue-900 shadow-sm"
                                : "bg-blue-600 text-white border-blue-500"
                        : isChalkboard ? "border-amber-900/30 text-amber-200/60 hover:bg-white/5"
                          : isLightAcademic ? "border-slate-200 text-slate-700 bg-white hover:bg-slate-100"
                            : isDarkAI ? "border-[#273449] text-slate-300 bg-[#111827] hover:bg-[#1a2336]"
                              : isNotebook ? "border-[#E2DAC7] text-stone-700 bg-[#FFFDF8] hover:bg-[#F5EFE0]"
                                : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      {isChalkboard ? "Cambridge Fellow" : "Conversational"}
                    </button>
                    <button
                      onClick={() => { setNarrator("mute"); }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${narrator === "mute" || isMuted
                        ? isChalkboard ? "bg-[#14231b] text-amber-200/70 border-amber-900/50"
                          : isLightAcademic ? "bg-slate-200 text-slate-800 border-slate-300"
                            : isDarkAI ? "bg-zinc-800 text-white border-zinc-700"
                              : isNotebook ? "bg-stone-300 text-stone-800 border-stone-400"
                                : "bg-zinc-800 text-white border-zinc-700"
                        : isChalkboard ? "border-amber-900/30 text-amber-200/60 hover:bg-white/5"
                          : isLightAcademic ? "border-slate-200 text-slate-700 bg-white hover:bg-slate-100"
                            : isDarkAI ? "border-[#273449] text-slate-300 bg-[#111827] hover:bg-[#1a2336]"
                              : isNotebook ? "border-[#E2DAC7] text-stone-700 bg-[#FFFDF8] hover:bg-[#F5EFE0]"
                                : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      Muted
                    </button>
                  </div>

                  {/* Active Voice Indicator Badge */}
                  <div className={`mt-2 px-2 py-1 rounded text-[9px] flex items-center justify-between font-mono ${isChalkboard ? "bg-[#111f18] text-amber-300/80 border border-amber-900/30" :
                    isLightAcademic ? "bg-slate-100 text-slate-600 border border-slate-200" :
                      isNotebook ? "bg-[#F5EFE0] text-stone-600 border border-[#E2DAC7]" :
                        isDarkAI ? "bg-[#111827] text-slate-400 border border-[#273449]" :
                          "bg-white/5 text-white/50 border border-white/5"
                    }`}>
                    <span className="truncate">
                      Voice: {getVoiceDisplayName(getBestHumanVoice({ persona: narrator === "assistant" ? "scholar" : narrator === "cyborg" ? "friendly" : "natural" }))}
                    </span>
                    <span className="shrink-0 text-emerald-400 font-sans font-medium text-[8px] uppercase tracking-wider ml-1">
                      Human Audio
                    </span>
                  </div>
                </div>

                {/* Video play speed multiplier */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className={`text-[10px] uppercase font-bold block tracking-wider ${isChalkboard ? "text-amber-200/70 font-scholar-title" : "text-white/60"}`}>
                      {isChalkboard ? "Lecture Cadence / Speed" : "Narration Pace / Speed"}
                    </label>
                    <span className={`text-[10px] font-mono font-bold ${isChalkboard ? "text-amber-300" : "text-blue-400"}`}>{speed}x</span>
                  </div>
                  <div className={`flex gap-1 p-1 rounded border ${isChalkboard ? "bg-[#111f18] border-amber-900/40" : "bg-white/5 border-white/10"}`}>
                    {[0.5, 1.0, 1.5, 2.0].map((sVal) => (
                      <button
                        key={sVal}
                        onClick={() => setSpeed(sVal)}
                        className={`flex-1 text-[10px] py-1 px-1 text-center font-mono rounded transition-colors ${speed === sVal
                          ? isChalkboard ? "bg-[#1b3829] text-amber-200 font-bold border border-amber-500/30" : "bg-blue-600 text-white font-bold"
                          : isChalkboard ? "text-amber-200/50 hover:text-amber-100" : "text-white/50 hover:text-white"
                          }`}
                      >
                        {sVal}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Render Quality */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className={`text-[10px] uppercase font-bold block tracking-wider ${isChalkboard ? "text-amber-200/70 font-scholar-title" : "text-white/60"}`}>
                      Video Render Quality
                    </label>
                    <span className={`text-[10px] font-mono font-bold uppercase ${isChalkboard ? "text-amber-300" : "text-blue-400"}`}>
                      {videoQuality === "low" ? "480p15 (Low)" : videoQuality === "medium" ? "720p30 (Med)" : "1080p60 (High)"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2" id="video-quality-deck">
                    <button
                      onClick={() => setVideoQuality("low")}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${videoQuality === "low"
                        ? isChalkboard ? "bg-[#183626] text-amber-200 border-amber-500/40" : "bg-blue-600 text-white border-blue-500"
                        : isChalkboard ? "border-amber-900/30 text-amber-200/60 hover:bg-white/5" : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      Low
                    </button>
                    <button
                      onClick={() => {
                        if (!isPremium) {
                          setIsPaymentModalOpen(true);
                        } else {
                          setVideoQuality("medium");
                        }
                      }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded relative ${videoQuality === "medium"
                        ? isChalkboard ? "bg-[#183626] text-amber-200 border-amber-500/40" : "bg-blue-600 text-white border-blue-500"
                        : isChalkboard ? "border-amber-900/30 text-amber-200/60 hover:bg-white/5" : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      Medium
                      {!isPremium && <span className="absolute -top-1.5 -right-1.5 text-[7px] bg-amber-400 text-black px-1 rounded font-scholar-title font-bold">FELLOW</span>}
                    </button>
                    <button
                      onClick={() => {
                        if (!isPremium) {
                          setIsPaymentModalOpen(true);
                        } else {
                          setVideoQuality("high");
                        }
                      }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded relative ${videoQuality === "high"
                        ? isChalkboard ? "bg-[#183626] text-amber-200 border-amber-500/40" : "bg-blue-600 text-white border-blue-500"
                        : isChalkboard ? "border-amber-900/30 text-amber-200/60 hover:bg-white/5" : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      High
                      {!isPremium && <span className="absolute -top-1.5 -right-1.5 text-[7px] bg-amber-400 text-black px-1 rounded font-scholar-title font-bold">FELLOW</span>}
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Active Generation and History Log Queue */}
            <div className="flex-1 p-6 flex flex-col min-h-[180px]">
              <div className="flex items-center gap-1.5 mb-4">
                <Layers className={`w-4 h-4 ${isChalkboard ? "text-amber-400" : "text-blue-500"}`} />
                <h2 className={`text-xs font-bold uppercase tracking-[0.2em] ${isChalkboard ? "font-scholar-title text-amber-200/80" : "text-white/50"}`}>
                  {isChalkboard ? "Manuscripts & Derivation Queue" : "Render & Synthesis Queue"}
                </h2>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-1.5 scrollbar-thin" id="renders-queue-deck">
                {historyList.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setEquationInput(item.equation);
                      handleSolve(item.equation);
                    }}
                    className={`group flex items-center gap-3 p-3 border transition-all cursor-pointer rounded-lg ${solution?.equation.toLowerCase() === item.equation.toLowerCase()
                      ? isChalkboard ? "border-amber-500/60 bg-[#16291e]" : "border-blue-500 bg-blue-950/20"
                      : isChalkboard ? "border-amber-900/30 bg-[#0e1a14] hover:bg-[#14261d]" : "border-white/5 bg-white/5 hover:bg-white/10"
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs transition-all border ${isChalkboard
                      ? "bg-[#182a20] border-amber-900/40 text-amber-300"
                      : "bg-black/40 text-white/60 group-hover:bg-blue-600/20 group-hover:text-blue-400 border-white/5"
                      }`}>
                      §0{historyList.length - index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black uppercase text-white truncate font-mono">
                        {item.equation}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[9px] tracking-wider font-medium ${isChalkboard ? "text-amber-200/50" : "text-white/40"}`}>{item.type}</span>
                        <span className={`text-[8px] px-1 py-0.2 rounded font-mono ${isChalkboard ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                          {item.date}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white transition-colors" />
                  </div>
                ))}
              </div>

              {/* Instant Render Sequence Action */}
              <button
                onClick={handleExportVideo}
                disabled={renderingVideo || !solution}
                className={`mt-4 w-full py-4 transition-colors font-black uppercase text-xs tracking-wider cursor-pointer rounded-sm transform active:scale-95 flex items-center justify-center gap-2 ${isChalkboard
                  ? "bg-[#1a3829] hover:bg-[#254f3a] disabled:opacity-40 text-amber-200 border border-amber-500/40 font-scholar-title shadow-lg shadow-black/40"
                  : "bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white tracking-tighter"
                  }`}
                id="render_sequence_bar"
              >
                {renderingVideo ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {isChalkboard ? "Rendering Manim Proof..." : "Rendering MP4..."}
                  </>
                ) : (isChalkboard ? "Export Video Manuscript" : "Export Video Solution")}
              </button>
            </div>

          </aside>
        </main>
      )}

      {/* Synchronized Live Video Timeline Overlay Footer matching Academic Slate (Studio view only) */}
      {currentView === "dashboard" && (
        <footer className={`border-t flex flex-col md:flex-row items-center px-6 sm:px-8 py-4 md:h-28 gap-4 md:gap-8 transition-colors ${isChalkboard ? "bg-[#09130f] border-amber-900/40" : "bg-[#0F0F0F] border-white/10"
          }`}>

          {/* Playback absolute timestamp block */}
          <div className={`flex flex-row md:flex-col gap-2 md:gap-1 justify-between w-full md:w-28 shrink-0 border-b md:border-b-0 pb-2 md:pb-0 ${isChalkboard ? "border-amber-900/30" : "border-white/10"
            }`}>
            <div className={`text-sm font-black uppercase font-mono tracking-tight flex items-center gap-1.5 ${isChalkboard ? "text-amber-300 font-scholar-title" : ""
              }`} id="total_time_tracker">
              <Clock className={`w-3.5 h-3.5 ${isChalkboard ? "text-amber-400" : "text-blue-500"}`} />
              00:0{solution?.scenes.length ? activeSceneIndex + 1 : 0}:00
            </div>
            <div className={`text-[9px] font-bold uppercase tracking-widest ${isChalkboard ? "text-amber-200/50 font-scholar-title" : "text-white/30"}`}>
              {solution?.scenes.length ? (isChalkboard ? `Lemma §0${activeSceneIndex + 1}/${solution.scenes.length}` : `Scene ${activeSceneIndex + 1}/${solution.scenes.length}`) : "No Board"}
            </div>
          </div>

          {/* High-fidelity Video deck triggers (Backward, Play/Pause, Forward) placed prominently on the left */}
          <div className="flex gap-2.5 items-center justify-center shrink-0">
            <button
              onClick={() => {
                if (solution) {
                  const prev = Math.max(0, activeSceneIndex - 1);
                  setActiveSceneIndex(prev);
                  setIsPlaying(false);
                }
              }}
              disabled={!solution || activeSceneIndex === 0}
              className={`w-10 h-10 border flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer rounded-sm ${isChalkboard
                ? "border-amber-900/40 text-amber-200 hover:bg-[#14261d]"
                : "border-white/20 text-white hover:bg-white/5 active:bg-white/10"
                }`}
              title="Backward Step"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (!solution) return;
                setIsPlaying(!isPlaying);
              }}
              disabled={!solution}
              className={`w-12 h-12 flex items-center justify-center transition-all transform active:scale-90 font-bold disabled:opacity-30 cursor-pointer rounded-sm ${isChalkboard
                ? "bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-400/20"
                : "bg-white text-black hover:bg-blue-600 hover:text-white"
                }`}
              title={isPlaying ? "Pause Scene Presentation" : "Play Scene Presentation"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => {
                if (solution) {
                  const next = Math.min(solution.scenes.length - 1, activeSceneIndex + 1);
                  setActiveSceneIndex(next);
                  setIsPlaying(false);
                }
              }}
              disabled={!solution || activeSceneIndex === (solution?.scenes.length || 1) - 1}
              className={`w-10 h-10 border flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer rounded-sm ${isChalkboard
                ? "border-amber-900/40 text-amber-200 hover:bg-[#14261d]"
                : "border-white/20 text-white hover:bg-white/5 active:bg-white/10"
                }`}
              title="Forward Step"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Horizontal step segment tracks highlighting in real time based on selection with right padding for floating widgets */}
          <div className="flex-1 flex gap-2 w-full h-12 items-center overflow-x-auto py-1 scrollbar-none pr-56 sm:pr-72" id="timeline-tracks-deck">
            {solution && solution.scenes.length > 0 ? (
              solution.scenes.map((scene, idx) => {
                const isActive = idx === activeSceneIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveSceneIndex(idx);
                      setIsPlaying(false); // Pause auto playback when manually stepping
                    }}
                    className={`h-full flex-1 min-w-[120px] border-l border-r px-3 flex flex-col justify-center transition-all duration-300 text-left rounded-[3px] cursor-pointer ${isActive
                      ? isChalkboard
                        ? "bg-[#183626] border-amber-500/60 text-amber-200 shadow-md"
                        : "bg-blue-600/30 border-blue-500 text-white"
                      : isChalkboard
                        ? "bg-[#0e1a14] hover:bg-[#14261d] border-amber-900/30 text-amber-200/50"
                        : "bg-white/5 hover:bg-white/10 border-white/10 text-white/40"
                      }`}
                  >
                    <span className={`text-[8px] font-bold uppercase block opacity-60 ${isChalkboard ? "font-scholar-title" : ""}`}>
                      {isChalkboard ? `Lemma §0${scene.sceneNumber}` : `Step 0${scene.sceneNumber}`}
                    </span>
                    <span className={`text-[10px] font-bold truncate block ${isChalkboard ? "font-academic text-[11px]" : ""}`}>{scene.title}</span>
                  </button>
                );
              })
            ) : (
              <div className={`flex-1 flex items-center justify-center text-[10px] uppercase tracking-widest font-mono ${isChalkboard ? "text-amber-200/30 font-scholar-title" : "text-white/20"
                }`}>
                Waiting for equation parsing to map derivation timeline...
              </div>
            )}
          </div>

        </footer>
      )}

      {/* Auth Modal popup */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Payment Upgrade Modal popup */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        userToken={userToken}
        onPaymentSuccess={() => {
          setIsPremium(true);
          localStorage.setItem("math_premium", "true");
        }}
      />

      {/* Cyber Defense Matrix Modal popup */}
      <CyberShieldModal
        isOpen={isCyberModalOpen}
        onClose={() => setIsCyberModalOpen(false)}
      />

      {/* AI Chat assistant */}
      {currentView !== "aichat" && (
        <AIChat solution={solution} currentSence={currentScene} theme={theme} onSolveEquation={handleSolve} />
      )}

      {/* Floating AI Math Voice Assistant */}
      <VoiceAssistant
        solution={solution}
        activeScene={currentScene}
        currentView={currentView}
        theme={theme}
        onSolveEquation={(eq) => {
          setEquationInput(eq);
          setCurrentView("dashboard");
          handleSolve(eq);
        }}
        onNavigateScene={(dir) => {
          if (!solution || !solution.scenes.length) return;
          if (dir === "next") {
            const next = Math.min(solution.scenes.length - 1, activeSceneIndex + 1);
            setActiveSceneIndex(next);
            setIsPlaying(false);
          } else if (dir === "prev") {
            const prev = Math.max(0, activeSceneIndex - 1);
            setActiveSceneIndex(prev);
            setIsPlaying(false);
          } else if (dir === "first") {
            setActiveSceneIndex(0);
            setIsPlaying(false);
          }
        }}
        onSwitchView={(view) => {
          if (view === "whiteboard" || view === "graph") {
            setCurrentView("dashboard");
          } else if (view === "explanation") {
            setCurrentView("methods");
          } else if (view === "matrix") {
            setCurrentView("matrix");
          } else if (view === "aichat") {
            setCurrentView("aichat");
          }
        }}
      />

    </div>
  );
}
