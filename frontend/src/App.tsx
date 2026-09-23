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
  MicOff
} from "lucide-react";
import MathGraph from "./components/MathGraph";
import Whiteboard, { KatexMath } from "./components/Whiteboard";
import { EquationSolution, VideoScene, ThemeType, NarratorType } from "./types";
import AuthModal from "./components/AuthModal";
import PaymentModal from "./components/PaymentModal";
import AIChat from "./components/AIChat";
import Explanation from "./components/Explanation";
import VoiceAssistant from "./components/VoiceAssistant";
import { createSpeechRecognition, parseSpokenMath } from "./utils/speechUtils";

// Static reference presets for instant exploration
const PRESET_EQUATIONS = [
  { name: "Derive Quadratic", expr: "x^2 - 5x + 6" },
  { name: "Integrate Quadratic", expr: "integrate(x^2 - 5x + 6)" },
  { name: "Matrix Determinant", expr: "det([[1, 2], [3, 4]])" },
  { name: "Matrix Eigenvalue", expr: "eigen([[1, 2], [2, 1]])" },
  { name: "Statistics Mean", expr: "mean([10, 20, 30, 40, 50])" },
  { name: "Translate Circle", expr: "translate(circle, 2, -1)" }
];

const THEME_CLASSES: Record<ThemeType, { bg: string, border: string, accent: string, text: string, dot: string, label: string }> = {
  chalkboard: {
    bg: "bg-[#0c1813]",
    border: "border-emerald-800/40",
    accent: "text-amber-300",
    text: "text-emerald-100",
    dot: "bg-emerald-500",
    label: "Chalkboard"
  },
  blueprint: {
    bg: "bg-[#05172e]",
    border: "border-cyan-800/40",
    accent: "text-cyan-400",
    text: "text-blue-100",
    dot: "bg-cyan-500",
    label: "Blueprint"
  },
  glassmorphic: {
    bg: "bg-[#120826]",
    border: "border-purple-500/30",
    accent: "text-fuchsia-400",
    text: "text-purple-100",
    dot: "bg-fuchsia-500",
    label: "Glass Space"
  },
  darkroom: {
    bg: "bg-[#09090b]",
    border: "border-zinc-800",
    accent: "text-red-400",
    text: "text-zinc-100",
    dot: "bg-red-500",
    label: "Laser Dark"
  },
  cyberpunk: {
    bg: "bg-[#0d0914]",
    border: "border-yellow-500/40",
    accent: "text-yellow-400",
    text: "text-yellow-100",
    dot: "bg-yellow-400",
    label: "Cyber Neon"
  },
  sunset: {
    bg: "bg-[#1c0f0a]",
    border: "border-amber-800/40",
    accent: "text-amber-400",
    text: "text-amber-100",
    dot: "bg-amber-500",
    label: "Amber Sunset"
  },
  synthwave: {
    bg: "bg-[#14061f]",
    border: "border-pink-500/40",
    accent: "text-pink-400",
    text: "text-pink-100",
    dot: "bg-pink-500",
    label: "Synthwave"
  },
  nordic: {
    bg: "bg-[#0b1219]",
    border: "border-slate-700/50",
    accent: "text-sky-300",
    text: "text-slate-100",
    dot: "bg-sky-400",
    label: "Nordic Clean"
  },
  matrix: {
    bg: "bg-[#040d06]",
    border: "border-green-600/40",
    accent: "text-green-400",
    text: "text-green-100",
    dot: "bg-green-500",
    label: "Matrix Terminal"
  },
  royal: {
    bg: "bg-[#180814]",
    border: "border-amber-500/30",
    accent: "text-amber-300",
    text: "text-amber-100",
    dot: "bg-amber-400",
    label: "Royal Velvet"
  }
};


export default function App() {
  const [equationInput, setEquationInput] = useState<string>("x^2 - 5x + 6");
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
  const [currentView, setCurrentView] = useState<"dashboard" | "methods">("dashboard");

  // Auth & Session States
  const [userToken, setUserToken] = useState<string | null>(localStorage.getItem("math_token"));
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem("math_email"));
  const [isPremium, setIsPremium] = useState<boolean>(localStorage.getItem("math_premium") === "true");

  // Modal Control States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const handleTheme = (newTheme: ThemeType) => {
    setTheme(newTheme);
    localStorage.setItem('math_theme', newTheme);
  };

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
  const [ocrPreviewImage, setOcrPreviewImage] = useState<string | null>(null);
  const [ocrExtractedMath, setOcrExtractedMath] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecordingMainInput, setIsRecordingMainInput] = useState(false);
  const mainRecognitionRef = useRef<any>(null);

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

  // Audio trigger
  const triggerAudioNarration = (text: string) => {
    try {
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      // Stop ongoing voice
      window.speechSynthesis.cancel();

      // Clean LaTeX commands from narrative audio output so it speaks human words
      const cleanerSpeech = text
        .replace(/\\sin/g, "sine")
        .replace(/\\cos/g, "cosine")
        .replace(/\\pi/g, "pie")
        .replace(/\\frac/g, "fraction")
        .replace(/\\quad/g, " ")
        .replace(/\\text\{([^}]+)\}/g, "$1")
        .replace(/\\approx/g, "approximately")
        .replace(/\\lim_\{x \\to 0\}/g, "the limit as x approaches zero of")
        .replace(/_1/g, " sub one")
        .replace(/_2/g, " sub two")
        .replace(/\^2/g, " squared")
        .replace(/D =/g, "the discriminant equals")
        .replace(/\\pm/g, "plus or minus");

      const utterance = new SpeechSynthesisUtterance(cleanerSpeech);

      // Select appropriate synthesized tone profile
      const voices = window.speechSynthesis.getVoices();
      const maleVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        return name.includes("male") ||
          name.includes("david") ||
          name.includes("guy") ||
          name.includes("george") ||
          name.includes("daniel") ||
          name.includes("thomas") ||
          name.includes("james") ||
          name.includes("microsoft david");
      });

      if (maleVoice) {
        utterance.voice = maleVoice;
      }

      if (narrator === "cyborg") {
        utterance.pitch = 0.4;
        utterance.rate = 0.85 * speed;
      } else if (narrator === "assistant") {
        utterance.pitch = 1.0; // Lowered from 1.3 for male voice
        utterance.rate = 1.1 * speed;
      } else {
        // Natural profile
        utterance.pitch = 0.9; // Slightly lower pitch for deeper male voice
        utterance.rate = 0.95 * speed;
      }

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

  return (
    <div className={`w-full min-h-screen ${THEME_CLASSES[theme].bg} text-white font-sans flex flex-col overflow-x-hidden antialiased selection:bg-blue-600/30`}>

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
                <h3 className="text-lg font-black uppercase tracking-tight">Math Image OCR Scanner</h3>
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
                        <span className="text-xs font-bold tracking-wider uppercase font-mono">Recognizing Math Symbols...</span>
                      </div>
                    )}
                  </div>

                  {/* Extracted Math Result Display & Manual Correction */}
                  <div>
                    <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest block mb-1.5">
                      Extracted Math Equation (Editable)
                    </label>
                    <input
                      type="text"
                      value={ocrExtractedMath}
                      onChange={(e) => setOcrExtractedMath(e.target.value)}
                      placeholder="OCR Extracted Math Result..."
                      className="w-full bg-white/5 border border-white/20 px-4 py-3 font-mono text-sm focus:outline-none focus:border-blue-500 rounded-lg text-blue-300"
                    />
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

      {/* Top Navigation Bar adhering strictly to the theme */}
      <header className="flex flex-col sm:flex-row justify-between items-center px-6 sm:px-8 py-4 sm:h-20 border-b border-white/10 gap-4">
        <label htmlFor="equation-bar-input" className="flex items-center gap-2 cursor-pointer select-none">
          <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center font-bold text-xl text-white">Σ</div>
          <span className="text-xl font-black tracking-tighter uppercase">MathMotion.io</span>
        </label>

        <nav className="flex items-center gap-4 sm:gap-8 text-[11px] font-bold uppercase tracking-widest text-white/50">
          <button
            onClick={() => setCurrentView("dashboard")}
            className={`hover:text-white transition-colors cursor-pointer ${currentView === "dashboard" ? "text-white border-b-2 border-blue-600 pb-1" : ""}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentView("methods")}
            className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 ${currentView === "methods" ? "text-white border-b-2 border-blue-600 pb-1" : ""}`}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            Solving Methods
          </button>
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Pricing Plans
          </button>
        </nav>

        <div className="flex items-center gap-3">
          {/* Quick Randomize */}
          <button
            onClick={() => {
              const randomPreset = PRESET_EQUATIONS[Math.floor(Math.random() * PRESET_EQUATIONS.length)];
              setEquationInput(randomPreset.expr);
              handleSolve(randomPreset.expr);
            }}
            className="px-4 py-2 border border-white/20 text-white text-xs font-black uppercase tracking-tighter hover:bg-white/5 transition-all cursor-pointer transform active:scale-95 rounded-sm"
            id="new_project_btn"
          >
            Quick Randomize +
          </button>

          {/* Session controls */}
          {userToken ? (
            <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-black text-white uppercase select-none">
                {userEmail?.slice(0, 1) || "U"}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-white/40 max-w-[100px] truncate">{userEmail}</span>
                <span className={`text-[8px] font-black uppercase tracking-wider ${isPremium ? "text-emerald-400" : "text-blue-400"}`}>
                  {isPremium ? "Pro Tier" : "Free Tier"}
                </span>
              </div>
              {!isPremium && (
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[8px] font-bold px-2 py-1 rounded transition-colors uppercase tracking-widest cursor-pointer ml-1.5"
                >
                  Go Pro
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="text-white/40 hover:text-red-400 p-1 transition-colors cursor-pointer ml-1"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setAuthModalMode("signin"); setIsAuthModalOpen(true); }}
                className="px-3.5 py-2 text-white/80 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthModalMode("signup"); setIsAuthModalOpen(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-tighter transition-all cursor-pointer rounded-sm transform active:scale-95"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* View Switcher: Methods Guide or Dashboard */}
      {currentView === "methods" ? (
        <Explanation
          theme={theme}
          initialEquation={equationInput}
          onTryExample={(expr) => {
            setEquationInput(expr);
            setCurrentView("dashboard");
            handleSolve(expr);
          }}
          onClose={() => setCurrentView("dashboard")}
        />
      ) : (
        /* Main interactive grid dashboard layouts */
        <main className="flex-1 flex flex-col lg:flex-row h-full">

          {/* Left Interactive Editor and Video Slate Section (70% width) */}
          <section className="flex-1 border-r border-white/10 flex flex-col p-4 sm:p-8" id="left-editor-section">

            {/* Main Huge Typography Header matching Bold Typography Theme */}
            <div className="flex-1 space-y-8">
              <div className="relative group">
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-2 block">
                  Current Expression
                </span>
                <h1 className="text-5xl sm:text-7xl lg:text-8xl leading-[0.85] font-black tracking-tighter break-words uppercase">
                  {solution?.equation || "∫(sin x + cos x) dx"}
                </h1>

                <div
                  className="absolute -top-3 right-0 bg-blue-600 px-3 py-1 text-[9px] font-bold tracking-widest text-white uppercase select-none rounded-[2px]"
                  id="solving-indicator"
                >
                  {loading ? "PARSING..." : "READY"}
                </div>
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
                <div className="bg-blue-950/30 border border-blue-500/20 text-blue-300 rounded-xl p-3 text-xs flex items-center gap-2 animate-pulse font-mono">
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
                    <div className="h-[360px] bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-white/40">
                      <Sparkles className="w-8 h-8 mb-2 text-indigo-400 animate-pulse" />
                      <span>No active math whiteboard. Write an equation below to start.</span>
                    </div>
                  )}
                </div>

                {/* 2D Cartesian Function Plot Visualizer Canvas */}
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Geometry & Plots Visualizer</span>
                    {currentScene?.graphData.showGraph && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                        Expr: {currentScene.graphData.functionExpr}
                      </span>
                    )}
                  </div>
                  {currentScene && currentScene.graphData ? (
                    <MathGraph
                      graphData={currentScene.graphData}
                      annotations={currentScene.annotations}
                      theme={theme}
                    />
                  ) : (
                    <div className="h-[320px] bg-[#0A0A0A] border border-white/5 rounded-xl flex items-center justify-center text-white/30 text-xs">
                      No coordinate metrics mapped for current step.
                    </div>
                  )}

                  {/* Visual coordinate context info cards beneath Graph */}
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                      <p className="text-white/40 text-[9px] uppercase font-bold tracking-widest">Calculus Level</p>
                      <p className="text-base font-bold mt-1 text-white">
                        {solution?.equationType || "Pre-Algebra"}
                      </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                      <p className="text-white/40 text-[9px] uppercase font-bold tracking-widest">Final Solution</p>
                      <div className="text-sm font-bold mt-1 font-mono text-blue-400 truncate overflow-x-auto whitespace-normal scrollbar-none">
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

            {/* New equation entry prompt bar aligned with Bold Typography template */}
            <div className="mt-8 pt-6 border-t border-white/10" id="equation-entry-panel">
              {/* Quick Math & LaTeX Symbols Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 font-mono mr-1">Insert Symbol:</span>
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
                    className="bg-white/5 hover:bg-blue-600/30 hover:border-blue-500/50 text-white/80 hover:text-white px-2 py-1 text-[10px] font-mono rounded border border-white/10 transition-colors cursor-pointer"
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
                    placeholder="ENTER NEW EQUATION (e.g., y = x^2 - 4x + 4)..."
                    className="w-full bg-white/5 border-2 border-white/20 px-4 py-3.5 font-mono text-base focus:outline-none focus:border-blue-600 transition-colors uppercase placeholder:text-white/30 tracking-wide rounded-sm"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs px-2 py-1 bg-white/10 rounded cursor-pointer"
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
                  className={`p-3.5 transition-all cursor-pointer rounded-sm flex items-center justify-center border-2 ${isRecordingMainInput
                    ? "bg-red-500/30 border-red-500 text-red-400 animate-pulse"
                    : "bg-white/10 hover:bg-white/20 text-blue-400 border-white/20"
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
                  className="bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white p-3.5 transition-colors cursor-pointer rounded-sm flex items-center justify-center border-2 border-white/20"
                >
                  {isOcrLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                  ) : (
                    <Scan className="w-5 h-5 text-blue-400" />
                  )}
                </button>

                <button
                  onClick={() => handleSolve(equationInput)}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-black uppercase tracking-tighter px-8 py-3.5 transition-colors cursor-pointer rounded-sm flex items-center justify-center gap-2 text-sm"
                  id="parse_equation_btn"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Parsing...
                    </>
                  ) : "Parse & Synthesize"}
                </button>
              </div>

              {/* Live KaTeX Equation Preview Card */}
              {equationInput.trim() && (
                <div className="mt-3 px-4 py-2.5 bg-blue-950/20 border border-blue-500/30 rounded-lg flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-blue-400 font-bold tracking-wider">Live LaTeX Preview:</span>
                  <div className="text-sm font-medium text-white px-2 py-0.5 bg-black/40 rounded border border-white/5">
                    <KatexMath math={equationInput} block={false} />
                  </div>
                </div>
              )}

              {/* Quick-select equations suggestions deck */}
              <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-white/50">
                <span className="font-bold uppercase tracking-wider text-[10px]">Ready Presets:</span>
                {PRESET_EQUATIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setEquationInput(preset.expr);
                      handleSolve(preset.expr);
                    }}
                    className="bg-white/5 hover:bg-white/15 hover:text-white text-white/70 px-2.5 py-1 rounded font-mono border border-white/5 transition-all text-[11px] cursor-pointer"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

          </section>

          {/* Right Settings and Configuration Sidebar (w-80 sidebar) */}
          <aside className="w-full lg:w-80 flex flex-col border-t lg:border-t-0 border-white/10" id="right-aside-settings">

            {/* Dynamic settings options box */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-1.5 mb-4">
                <Sliders className="w-4 h-4 text-blue-500" />
                <h2 className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">
                  Motion & Playback
                </h2>
              </div>

              <div className="space-y-6">

                {/* Board Skins & Layout Styles selector */}
                <div>
                  <label className="text-[10px] uppercase font-bold block mb-2 text-white/60 tracking-wider">
                    Whiteboard Skin Theme ({Object.keys(THEME_CLASSES).length} Themes)
                  </label>
                  <div className="grid grid-cols-2 gap-2" id="skin-themes-deck">
                    {(Object.keys(THEME_CLASSES) as ThemeType[]).map((tKey) => {
                      const tInfo = THEME_CLASSES[tKey];
                      const isSelected = theme === tKey;
                      return (
                        <button
                          key={tKey}
                          onClick={() => handleTheme(tKey)}
                          className={`py-2 px-2 text-[10px] font-bold uppercase border tracking-tight transition-all rounded flex items-center justify-between gap-1.5 cursor-pointer ${isSelected
                            ? "bg-white text-black border-white shadow-md shadow-white/20"
                            : "border-white/20 text-white/80 hover:bg-white/10 hover:border-white/40"
                            }`}
                        >
                          <span className="truncate">{tInfo.label}</span>
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tInfo.dot} ${isSelected ? "ring-2 ring-black" : ""}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Synthesized voice setting */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] uppercase font-bold block text-white/60 tracking-wider">
                      Auto Audio Narrator
                    </label>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-white/60 hover:text-white"
                      title={isMuted ? "Unmute Voice" : "Mute Voice"}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2" id="narrator-type-deck">
                    <button
                      onClick={() => { setNarrator("natural"); setIsMuted(false); }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${narrator === "natural" && !isMuted ? "bg-blue-600 text-white border-blue-500" : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      Professor AI
                    </button>
                    <button
                      onClick={() => { setNarrator("assistant"); setIsMuted(false); }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${narrator === "assistant" && !isMuted ? "bg-blue-600 text-white border-blue-500" : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      Assistant Calm
                    </button>
                    <button
                      onClick={() => { setNarrator("cyborg"); setIsMuted(false); }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${narrator === "cyborg" && !isMuted ? "bg-blue-600 text-white border-blue-500" : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      Cosmic Synth
                    </button>
                    <button
                      onClick={() => { setNarrator("mute"); }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${narrator === "mute" || isMuted ? "bg-zinc-800 text-white border-zinc-700" : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      Muted
                    </button>
                  </div>
                </div>

                {/* Video play speed multiplier */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] uppercase font-bold block text-white/60 tracking-wider">
                      Narration Pace / Speed
                    </label>
                    <span className="text-[10px] font-mono text-blue-400 font-bold">{speed}x</span>
                  </div>
                  <div className="flex gap-1 bg-white/5 p-1 rounded border border-white/10">
                    {[0.5, 1.0, 1.5, 2.0].map((sVal) => (
                      <button
                        key={sVal}
                        onClick={() => setSpeed(sVal)}
                        className={`flex-1 text-[10px] py-1 px-1 text-center font-mono rounded transition-colors ${speed === sVal ? "bg-blue-600 text-white font-bold" : "text-white/50 hover:text-white"
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
                    <label className="text-[10px] uppercase font-bold block text-white/60 tracking-wider">
                      Video Render Quality
                    </label>
                    <span className="text-[10px] font-mono text-blue-400 font-bold uppercase">
                      {videoQuality === "low" ? "480p15 (Low)" : videoQuality === "medium" ? "720p30 (Med)" : "1080p60 (High)"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2" id="video-quality-deck">
                    <button
                      onClick={() => setVideoQuality("low")}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded ${videoQuality === "low" ? "bg-blue-600 text-white border-blue-500" : "border-white/10 text-white/60 hover:bg-white/5"
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
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded relative ${videoQuality === "medium" ? "bg-blue-600 text-white border-blue-500" : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      Medium
                      {!isPremium && <span className="absolute -top-1.5 -right-1.5 text-[7px] bg-amber-500 text-black px-1 rounded font-sans font-bold">PRO</span>}
                    </button>
                    <button
                      onClick={() => {
                        if (!isPremium) {
                          setIsPaymentModalOpen(true);
                        } else {
                          setVideoQuality("high");
                        }
                      }}
                      className={`py-2 px-1 text-[10px] font-mono border tracking-tight transition-all rounded relative ${videoQuality === "high" ? "bg-blue-600 text-white border-blue-500" : "border-white/10 text-white/60 hover:bg-white/5"
                        }`}
                    >
                      High
                      {!isPremium && <span className="absolute -top-1.5 -right-1.5 text-[7px] bg-amber-500 text-black px-1 rounded font-sans font-bold">PRO</span>}
                    </button>
                  </div>
                </div>


              </div>
            </div>

            {/* Active Generation and History Log Queue */}
            <div className="flex-1 p-6 flex flex-col min-h-[180px]">
              <div className="flex items-center gap-1.5 mb-4">
                <Layers className="w-4 h-4 text-blue-500" />
                <h2 className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">
                  Render & Synthesis Queue
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
                    className={`group flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border transition-all cursor-pointer rounded-lg ${solution?.equation.toLowerCase() === item.equation.toLowerCase() ? "border-blue-500 bg-blue-950/20" : "border-white/5"
                      }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center font-mono text-xs text-white/60 group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-all border border-white/5">
                      #0{historyList.length - index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black uppercase text-white truncate font-mono">
                        {item.equation}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-white/40 tracking-wider font-medium">{item.type}</span>
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.2 rounded font-mono">
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
                className="mt-4 w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 transition-colors font-black uppercase text-xs tracking-tighter cursor-pointer rounded-sm transform active:scale-95 flex items-center justify-center gap-2"
                id="render_sequence_bar"
              >
                {renderingVideo ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Rendering MP4...
                  </>
                ) : "Export Video Solution"}
              </button>
            </div>

          </aside>
        </main>
      )}

      {/* Synchronized Live Video Timeline Overlay Footer matching "Bold Typography" */}
      <footer className="bg-[#0F0F0F] border-t border-white/10 flex flex-col md:flex-row items-center px-6 sm:px-8 py-4 md:h-28 gap-4 md:gap-8">

        {/* Playback absolute timestamp block */}
        <div className="flex flex-row md:flex-col gap-2 md:gap-1 justify-between w-full md:w-20 border-b md:border-b-0 pb-2 md:pb-0 border-white/10">
          <div className="text-sm font-black uppercase font-mono tracking-tight flex items-center gap-1.5" id="total_time_tracker">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            00:0{solution?.scenes.length ? activeSceneIndex + 1 : 0}:00
          </div>
          <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
            {solution?.scenes.length ? `Scene ${activeSceneIndex + 1}/${solution.scenes.length}` : "No Board"}
          </div>
        </div>

        {/* Horizontal step segment tracks highlighting in real time based on selection */}
        <div className="flex-1 flex gap-2 w-full h-12 items-center overflow-x-auto py-1 scrollbar-none" id="timeline-tracks-deck">
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
                    ? "bg-blue-600/30 border-blue-500 text-white"
                    : "bg-white/5 hover:bg-white/10 border-white/10 text-white/40"
                    }`}
                >
                  <span className="text-[8px] font-bold uppercase block opacity-60">Step 0{scene.sceneNumber}</span>
                  <span className="text-[10px] font-bold truncate block">{scene.title}</span>
                </button>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-[10px] text-white/20 uppercase tracking-widest font-mono">
              Waiting for equation parsing to map step timeline...
            </div>
          )}
        </div>

        {/* High-fidelity Video deck triggers */}
        <div className="flex gap-3 justify-center w-full md:w-auto">
          <button
            onClick={() => {
              if (solution) {
                const prev = Math.max(0, activeSceneIndex - 1);
                setActiveSceneIndex(prev);
                setIsPlaying(false);
              }
            }}
            disabled={!solution || activeSceneIndex === 0}
            className="w-10 h-10 border border-white/20 flex items-center justify-center hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer rounded-sm"
            title="Backward Step"
          >
            <SkipBack className="w-4 h-4 text-white" />
          </button>

          <button
            onClick={() => {
              if (!solution) return;
              setIsPlaying(!isPlaying);
            }}
            disabled={!solution}
            className="w-12 h-12 bg-white text-black flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all transform active:scale-90 font-bold disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black cursor-pointer rounded-sm"
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
            className="w-10 h-10 border border-white/20 flex items-center justify-center hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer rounded-sm"
            title="Forward Step"
          >
            <SkipForward className="w-4 h-4 text-white" />
          </button>
        </div>

      </footer>

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

      {/* AI Chat assistant */}
      <AIChat solution={solution} currentSence={currentScene} />

      {/* Floating AI Math Voice Assistant */}
      <VoiceAssistant
        solution={solution}
        activeScene={currentScene}
        currentView={currentView}
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
          }
        }}
      />

    </div>
  );
}
