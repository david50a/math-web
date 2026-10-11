import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Scan,
  Camera,
  UploadCloud,
  Shapes,
  Sparkles,
  Calculator,
  RotateCcw,
  Check,
  ChevronRight,
  Info,
  Maximize2,
  RefreshCw,
  Compass,
  Ruler,
  Layers,
  ArrowRight
} from "lucide-react";
import { KatexMath } from "./Whiteboard";
import { ThemeType } from "../types";

export interface ShapeSolveResult {
  type: string;
  subtype: string;
  sides?: { a: number; b: number; c: number };
  angles?: {
    A: number;
    B: number;
    C: number;
    A_rad?: number;
    B_rad?: number;
    C_rad?: number;
  };
  area?: number;
  perimeter?: number;
  altitudes?: { ha: number; hb: number; hc: number };
  inradius?: number;
  circumradius?: number;
  vertices?: number[][];
  radius?: number;
  diameter?: number;
  circumference?: number;
  width?: number;
  height?: number;
  diagonal?: number;
  confidence?: number;
  detectedLabels?: string[];
  steps?: { description: string; latex: string; type?: string; data?: any }[];
}

interface ShapeInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeType;
  onApplyToWhiteboard: (equationStr: string) => void;
}

type TabType = "inspector" | "vision";
type ShapeTemplate = "right" | "sss" | "sas" | "asa" | "ssa" | "circle" | "rectangle";

export default function ShapeInspectorModal({
  isOpen,
  onClose,
  theme,
  onApplyToWhiteboard
}: ShapeInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("inspector");
  const [selectedTemplate, setSelectedTemplate] = useState<ShapeTemplate>("right");

  // Input state
  const [sideA, setSideA] = useState<string>("3");
  const [sideB, setSideB] = useState<string>("4");
  const [sideC, setSideC] = useState<string>("");
  const [angleA, setAngleA] = useState<string>("");
  const [angleB, setAngleB] = useState<string>("");
  const [angleC, setAngleC] = useState<string>("90");
  const [isRightAngle, setIsRightAngle] = useState<boolean>(true);

  // Circle & Rectangle inputs
  const [radiusInput, setRadiusInput] = useState<string>("5");
  const [widthInput, setWidthInput] = useState<string>("6");
  const [heightInput, setHeightInput] = useState<string>("4");

  // Output & loading
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ShapeSolveResult | null>(null);

  // Vision / OCR state
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme-aware styles
  const isChalkboard = theme === "chalkboard";
  const isBlueprint = theme === "blueprint";
  const isCosmos = theme === "cosmos";
  const isLightAcademic = theme === "lightAcademic";
  const isDarkAI = theme === "darkAI";
  const isNotebook = theme === "notebook";

  // Quick preset helper
  const applyPreset = (template: ShapeTemplate) => {
    setSelectedTemplate(template);
    setErrorMsg(null);
    if (template === "right") {
      setSideA("3");
      setSideB("4");
      setSideC("");
      setAngleA("");
      setAngleB("");
      setAngleC("90");
      setIsRightAngle(true);
    } else if (template === "sss") {
      setSideA("5");
      setSideB("6");
      setSideC("7");
      setAngleA("");
      setAngleB("");
      setAngleC("");
      setIsRightAngle(false);
    } else if (template === "sas") {
      setSideA("5");
      setSideB("7");
      setSideC("");
      setAngleA("");
      setAngleB("");
      setAngleC("45");
      setIsRightAngle(false);
    } else if (template === "asa") {
      setSideA("");
      setSideB("");
      setSideC("8");
      setAngleA("40");
      setAngleB("60");
      setAngleC("");
      setIsRightAngle(false);
    } else if (template === "ssa") {
      setSideA("10");
      setSideB("8");
      setSideC("");
      setAngleA("50");
      setAngleB("");
      setAngleC("");
      setIsRightAngle(false);
    } else if (template === "circle") {
      setRadiusInput("5");
    } else if (template === "rectangle") {
      setWidthInput("6");
      setHeightInput("4");
    }
  };

  // Solve shape on mount or template switch
  useEffect(() => {
    if (isOpen) {
      handleSolveShape();
    }
  }, [isOpen, selectedTemplate]);

  // Handle solving
  const handleSolveShape = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let payload: any = {};
      if (selectedTemplate === "circle") {
        payload = {
          shapeType: "circle",
          radius: radiusInput ? parseFloat(radiusInput) : 5
        };
      } else if (selectedTemplate === "rectangle") {
        payload = {
          shapeType: "rectangle",
          width: widthInput ? parseFloat(widthInput) : 6,
          height: heightInput ? parseFloat(heightInput) : 4
        };
      } else {
        payload = {
          shapeType: "triangle",
          a: sideA ? parseFloat(sideA) : null,
          b: sideB ? parseFloat(sideB) : null,
          c: sideC ? parseFloat(sideC) : null,
          A: angleA ? parseFloat(angleA) : null,
          B: angleB ? parseFloat(angleB) : null,
          C: angleC ? parseFloat(angleC) : null,
          isRight: isRightAngle || selectedTemplate === "right"
        };
      }

      const res = await fetch("/api/solve-shape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to solve geometric shape.");
      }

      const data: ShapeSolveResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Calculation error.");
    } finally {
      setLoading(false);
    }
  };

  // Shape OCR Vision Process
  const processImageForShape = async (base64Img: string) => {
    setVisionImage(base64Img);
    setIsOcrProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/shape-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Img })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Shape recognition failed.");
      }

      const data: ShapeSolveResult = await res.json();
      setResult(data);

      // Auto-populate inspector tab with detected values
      if (data.type === "triangle" && data.sides) {
        setSelectedTemplate(data.subtype === "Right Triangle" ? "right" : "sss");
        setSideA(data.sides.a.toString());
        setSideB(data.sides.b.toString());
        setSideC(data.sides.c.toString());
        if (data.angles) {
          setAngleA(data.angles.A.toString());
          setAngleB(data.angles.B.toString());
          setAngleC(data.angles.C.toString());
        }
        setIsRightAngle(data.subtype === "Right Triangle");
      } else if (data.type === "circle" && data.radius) {
        setSelectedTemplate("circle");
        setRadiusInput(data.radius.toString());
      } else if (data.type === "rectangle" && data.width && data.height) {
        setSelectedTemplate("rectangle");
        setWidthInput(data.width.toString());
        setHeightInput(data.height.toString());
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to analyze diagram.");
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result as string;
      processImageForShape(b64);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Camera handling
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access failed", err);
      setIsCameraActive(false);
      setErrorMsg("Camera access denied or unavailable.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      stopCamera();
      processImageForShape(dataUrl);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  if (!isOpen) return null;

  // Render SVG Diagram for triangle, circle, or rectangle
  const renderSvgDiagram = () => {
    if (!result) return null;

    if (result.type === "circle" && result.radius) {
      const r = result.radius;
      return (
        <svg viewBox="0 0 320 240" className="w-full h-full max-h-64 select-none">
          <defs>
            <radialGradient id="circleGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.05" />
            </radialGradient>
          </defs>
          <circle cx="160" cy="120" r="70" fill="url(#circleGrad)" stroke="#3B82F6" strokeWidth="2.5" />
          <circle cx="160" cy="120" r="3.5" fill="#60A5FA" />
          <line x1="160" y1="120" x2="230" y2="120" stroke="#60A5FA" strokeWidth="2" strokeDasharray="3 3" />
          <text x="195" y="112" fill="#93C5FD" fontSize="11" fontWeight="bold" textAnchor="middle">
            r = {r}
          </text>
          <text x="160" y="210" fill="#E2E8F0" fontSize="12" fontWeight="bold" textAnchor="middle">
            Diameter = {result.diameter} | Area = {result.area}
          </text>
        </svg>
      );
    }

    if (result.type === "rectangle" && result.width && result.height) {
      const w = result.width;
      const h = result.height;
      const maxDim = Math.max(w, h);
      const scale = 140 / maxDim;
      const svgW = w * scale;
      const svgH = h * scale;
      const x0 = (320 - svgW) / 2;
      const y0 = (240 - svgH) / 2;

      return (
        <svg viewBox="0 0 320 240" className="w-full h-full max-h-64 select-none">
          <defs>
            <linearGradient id="rectGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <rect
            x={x0}
            y={y0}
            width={svgW}
            height={svgH}
            fill="url(#rectGrad)"
            stroke="#10B981"
            strokeWidth="2.5"
            rx="2"
          />
          {/* Diagonal */}
          <line
            x1={x0}
            y1={y0 + svgH}
            x2={x0 + svgW}
            y2={y0}
            stroke="#34D399"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          {/* Labels */}
          <text x={x0 + svgW / 2} y={y0 + svgH + 18} fill="#6EE7B7" fontSize="11" fontWeight="bold" textAnchor="middle">
            w = {w}
          </text>
          <text x={x0 - 12} y={y0 + svgH / 2} fill="#6EE7B7" fontSize="11" fontWeight="bold" textAnchor="middle">
            h = {h}
          </text>
          <text x={x0 + svgW / 2} y={y0 + svgH / 2 - 6} fill="#A7F3D0" fontSize="10" textAnchor="middle">
            diag = {result.diagonal}
          </text>
        </svg>
      );
    }

    // TRIANGLE RENDERING
    if (result.vertices && result.vertices.length === 3) {
      const raw = result.vertices;
      // Coordinates: raw[0]=A, raw[1]=B, raw[2]=C
      const xs = raw.map((p) => p[0]);
      const ys = raw.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const spanX = Math.max(maxX - minX, 0.001);
      const spanY = Math.max(maxY - minY, 0.001);

      const margin = 40;
      const width = 340;
      const height = 230;

      const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY);

      // SVG coordinates (flip Y because SVG Y goes downward)
      const toSvg = (x: number, y: number) => {
        const svgX = margin + (x - minX) * scale + (width - 2 * margin - spanX * scale) / 2;
        const svgY = height - margin - (y - minY) * scale - (height - 2 * margin - spanY * scale) / 2;
        return [svgX, svgY];
      };

      const [ax, ay] = toSvg(raw[0][0], raw[0][1]);
      const [bx, by] = toSvg(raw[1][0], raw[1][1]);
      const [cx, cy] = toSvg(raw[2][0], raw[2][1]);

      // Midpoints for side length labels
      const midC = [(ax + bx) / 2, (ay + by) / 2]; // side c opposite to C
      const midA = [(bx + cx) / 2, (by + cy) / 2]; // side a opposite to A
      const midB = [(ax + cx) / 2, (ay + cy) / 2]; // side b opposite to B

      const sides = result.sides || { a: 0, b: 0, c: 0 };
      const angles = result.angles || { A: 0, B: 0, C: 0 };

      // Check right angle vertex
      const isRight = result.subtype.toLowerCase().includes("right");

      return (
        <svg viewBox="0 0 340 230" className="w-full h-full max-h-64 select-none">
          <defs>
            <linearGradient id="triGrad" x1="0%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Triangle Body */}
          <polygon
            points={`${ax},${ay} ${bx},${by} ${cx},${cy}`}
            fill="url(#triGrad)"
            stroke="#3B82F6"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Right Angle Square indicator if angle C or A is 90 */}
          {isRight && Math.abs(angles.C - 90) < 1 && (
            <path
              d={`M ${cx + 12} ${cy} L ${cx + 12} ${cy + 12} L ${cx} ${cy + 12}`}
              fill="none"
              stroke="#60A5FA"
              strokeWidth="1.5"
            />
          )}

          {/* Altitude line from C to base AB */}
          <line x1={cx} y1={cy} x2={cx} y2={ay} stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="3 3" />

          {/* Vertices Dots */}
          <circle cx={ax} cy={ay} r="4" fill="#3B82F6" />
          <circle cx={bx} cy={by} r="4" fill="#3B82F6" />
          <circle cx={cx} cy={cy} r="4" fill="#6366F1" />

          {/* Vertex Labels */}
          <text x={ax - 14} y={ay + 14} fill="#93C5FD" fontSize="11" fontWeight="bold">
            A ({angles.A}°)
          </text>
          <text x={bx + 6} y={by + 14} fill="#93C5FD" fontSize="11" fontWeight="bold">
            B ({angles.B}°)
          </text>
          <text x={cx} y={cy - 10} fill="#C7D2FE" fontSize="11" fontWeight="bold" textAnchor="middle">
            C ({angles.C}°)
          </text>

          {/* Side Length Labels */}
          {/* Side c (base AB) */}
          <text x={midC[0]} y={midC[1] + 16} fill="#F8FAFC" fontSize="11" fontWeight="bold" textAnchor="middle">
            c = {sides.c}
          </text>
          {/* Side a (BC) */}
          <text x={midA[0] + 12} y={midA[1]} fill="#F8FAFC" fontSize="11" fontWeight="bold">
            a = {sides.a}
          </text>
          {/* Side b (AC) */}
          <text x={midB[0] - 14} y={midB[1]} fill="#F8FAFC" fontSize="11" fontWeight="bold" textAnchor="end">
            b = {sides.b}
          </text>
        </svg>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          isChalkboard
            ? "bg-[#091510] border-amber-900/50 text-[#FAF8F2]"
            : isBlueprint
            ? "bg-[#031326] border-cyan-500/40 text-cyan-100 font-mono"
            : isCosmos
            ? "bg-[#070514] border-purple-500/40 text-purple-100"
            : isLightAcademic
            ? "bg-white border-slate-200 text-slate-900 shadow-xl"
            : isDarkAI
            ? "bg-[#0B1020] border-[#273449] text-slate-100 font-mono"
            : isNotebook
            ? "bg-[#FAF8F3] border-[#E2DAC7] text-stone-900 font-academic"
            : "bg-[#0F1117] border-white/15 text-white"
        }`}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Shapes className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight uppercase">
                  Geometric Vision & Shape OCR Solver
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  OCR for Shapes
                </span>
              </div>
              <p className="text-xs opacity-70">
                Instantly compute unknown angles, side lengths, altitudes, & area from diagrams or known parameters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Tab Switcher */}
            <div className="flex rounded-lg p-1 bg-white/5 border border-white/10">
              <button
                onClick={() => {
                  setActiveTab("inspector");
                  stopCamera();
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "inspector"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                Shape Solver
              </button>
              <button
                onClick={() => setActiveTab("vision")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "vision"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <Scan className="w-3.5 h-3.5" />
                Diagram OCR
              </button>
            </div>

            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 rounded-lg opacity-60 hover:opacity-100 hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-500/15 border border-red-500/40 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === "vision" ? (
            /* TAB 1: DIAGRAM OCR & CAMERA VISION */
            <div className="space-y-6">
              <div className="border-2 border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-white/5 relative group hover:border-blue-500/50 transition-all">
                {isCameraActive ? (
                  <div className="relative w-full max-w-md aspect-video bg-black rounded-xl overflow-hidden shadow-inner">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3">
                      <button
                        onClick={capturePhoto}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-full shadow-lg flex items-center gap-2 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        Capture Diagram
                      </button>
                      <button
                        onClick={stopCamera}
                        className="px-4 py-2 bg-black/60 hover:bg-black/80 text-white text-xs rounded-full cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : visionImage ? (
                  <div className="relative w-full max-w-sm aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/15 flex items-center justify-center">
                    <img src={visionImage} alt="Scanned Diagram" className="max-h-full max-w-full object-contain" />
                    {isOcrProcessing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-blue-400">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span className="text-xs font-bold tracking-wider uppercase">
                          Detecting geometric shapes & labels...
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => setVisionImage(null)}
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/90 text-white rounded-full cursor-pointer"
                      title="Clear Image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold">Upload Geometric Shape or Diagram</h4>
                      <p className="text-xs opacity-60 max-w-md mt-1">
                        Upload an exam problem, textbook photo, or hand-drawn shape. Axiom Shape OCR will recognize vertices, side labels, and solve missing angles!
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                      >
                        <UploadCloud className="w-4 h-4" />
                        Upload Diagram
                      </button>
                      <button
                        onClick={startCamera}
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-white/15 cursor-pointer flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4 text-cyan-400" />
                        Snap with Camera
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sample Quick Diagrams */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Try Quick Diagram Presets:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      applyPreset("right");
                      setActiveTab("inspector");
                    }}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all cursor-pointer"
                  >
                    <span className="text-xs font-bold block text-blue-400">Right Triangle (3, 4, ?)</span>
                    <span className="text-[10px] opacity-60 block mt-0.5">Find hypotenuse & angles</span>
                  </button>
                  <button
                    onClick={() => {
                      applyPreset("sss");
                      setActiveTab("inspector");
                    }}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all cursor-pointer"
                  >
                    <span className="text-xs font-bold block text-emerald-400">SSS Triangle (5, 6, 7)</span>
                    <span className="text-[10px] opacity-60 block mt-0.5">Heron & Law of Cosines</span>
                  </button>
                  <button
                    onClick={() => {
                      applyPreset("sas");
                      setActiveTab("inspector");
                    }}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all cursor-pointer"
                  >
                    <span className="text-xs font-bold block text-purple-400">SAS Triangle (5, 7, 45°)</span>
                    <span className="text-[10px] opacity-60 block mt-0.5">Find side c & other angles</span>
                  </button>
                  <button
                    onClick={() => {
                      applyPreset("circle");
                      setActiveTab("inspector");
                    }}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all cursor-pointer"
                  >
                    <span className="text-xs font-bold block text-cyan-400">Circle (r = 5)</span>
                    <span className="text-[10px] opacity-60 block mt-0.5">Area, Circumference</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: INTERACTIVE SHAPE SOLVER */
            <div className="space-y-6">
              {/* Shape Template Selector Buttons */}
              <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 mr-2 flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5" />
                  Template:
                </span>
                {[
                  { id: "right", label: "Right △ (a, b, c)", desc: "SOH-CAH-TOA" },
                  { id: "sss", label: "SSS △ (3 Sides)", desc: "Law of Cosines" },
                  { id: "sas", label: "SAS △ (2 Sides + ∠)", desc: "Side-Angle-Side" },
                  { id: "asa", label: "ASA △ (2 ∠ + Side)", desc: "Angle-Side-Angle" },
                  { id: "ssa", label: "SSA △ (2 Sides + ∠)", desc: "Side-Side-Angle" },
                  { id: "circle", label: "Circle ⭕", desc: "Radius & Area" },
                  { id: "rectangle", label: "Rectangle ⬛", desc: "Width & Height" }
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyPreset(tpl.id as ShapeTemplate)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedTemplate === tpl.id
                        ? "bg-blue-600 text-white shadow-md border border-blue-400/40"
                        : "bg-white/5 hover:bg-white/10 opacity-70 hover:opacity-100 border border-white/10"
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              {/* TWO COLUMN GRID: LEFT = INPUTS, RIGHT = INTERACTIVE SVG & METRICS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT: PARAMETER INPUTS (5 COLS) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                        <Compass className="w-4 h-4" />
                        Shape Parameters
                      </span>
                      <button
                        onClick={() => applyPreset(selectedTemplate)}
                        className="text-[11px] opacity-60 hover:opacity-100 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    </div>

                    {selectedTemplate === "circle" ? (
                      <div>
                        <label className="text-xs font-bold block mb-1.5 opacity-80">Radius (r)</label>
                        <input
                          type="number"
                          step="any"
                          value={radiusInput}
                          onChange={(e) => setRadiusInput(e.target.value)}
                          placeholder="e.g. 5"
                          className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-sm font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    ) : selectedTemplate === "rectangle" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold block mb-1.5 opacity-80">Width (w)</label>
                          <input
                            type="number"
                            step="any"
                            value={widthInput}
                            onChange={(e) => setWidthInput(e.target.value)}
                            placeholder="e.g. 6"
                            className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-sm font-mono focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1.5 opacity-80">Height (h)</label>
                          <input
                            type="number"
                            step="any"
                            value={heightInput}
                            onChange={(e) => setHeightInput(e.target.value)}
                            placeholder="e.g. 4"
                            className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-sm font-mono focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      /* TRIANGLE INPUTS */
                      <div className="space-y-4">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider opacity-60 block mb-2">
                            Side Lengths:
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[11px] font-bold block mb-1 opacity-70">Side a</label>
                              <input
                                type="number"
                                step="any"
                                value={sideA}
                                onChange={(e) => setSideA(e.target.value)}
                                placeholder="e.g. 3"
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/20 rounded-lg text-xs font-mono focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold block mb-1 opacity-70">Side b</label>
                              <input
                                type="number"
                                step="any"
                                value={sideB}
                                onChange={(e) => setSideB(e.target.value)}
                                placeholder="e.g. 4"
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/20 rounded-lg text-xs font-mono focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold block mb-1 opacity-70">Side c (base)</label>
                              <input
                                type="number"
                                step="any"
                                value={sideC}
                                onChange={(e) => setSideC(e.target.value)}
                                placeholder={selectedTemplate === "right" ? "hypot" : "e.g. 5"}
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/20 rounded-lg text-xs font-mono focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider opacity-60 block mb-2">
                            Angles (in degrees):
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[11px] font-bold block mb-1 opacity-70">∠ A (°)</label>
                              <input
                                type="number"
                                step="any"
                                value={angleA}
                                onChange={(e) => setAngleA(e.target.value)}
                                placeholder="e.g. 36.87"
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/20 rounded-lg text-xs font-mono focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold block mb-1 opacity-70">∠ B (°)</label>
                              <input
                                type="number"
                                step="any"
                                value={angleB}
                                onChange={(e) => setAngleB(e.target.value)}
                                placeholder="e.g. 53.13"
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/20 rounded-lg text-xs font-mono focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold block mb-1 opacity-70">∠ C (°)</label>
                              <input
                                type="number"
                                step="any"
                                value={angleC}
                                onChange={(e) => setAngleC(e.target.value)}
                                placeholder="e.g. 90"
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/20 rounded-lg text-xs font-mono focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Right Triangle Toggle */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="rightAngleCheck"
                            checked={isRightAngle}
                            onChange={(e) => {
                              setIsRightAngle(e.target.checked);
                              if (e.target.checked && !angleC) setAngleC("90");
                            }}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <label htmlFor="rightAngleCheck" className="text-xs font-bold opacity-80 cursor-pointer select-none">
                            Right Triangle (∠ C = 90° Hypotenuse c)
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Solve Button */}
                    <button
                      onClick={handleSolveShape}
                      disabled={loading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Computing Sides & Angles...
                        </>
                      ) : (
                        <>
                          <Calculator className="w-4 h-4" />
                          Find Missing Sides & Angles
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* RIGHT: LIVE SVG DIAGRAM & COMPUTED METRICS (7 COLS) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Visual SVG Slate */}
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden">
                    <div className="absolute top-3 left-4 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {result?.subtype || "Interactive Canvas"}
                      </span>
                      {result?.confidence && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {Math.round(result.confidence * 100)}% Confidence
                        </span>
                      )}
                    </div>

                    {renderSvgDiagram()}
                  </div>

                  {/* COMPUTED METRICS GRID */}
                  {result && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {result.angles && (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
                            Angles (A, B, C)
                          </span>
                          <span className="text-xs font-black text-blue-400 block mt-1">
                            {result.angles.A}° | {result.angles.B}° | {result.angles.C}°
                          </span>
                        </div>
                      )}

                      {result.sides && (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
                            Side Lengths
                          </span>
                          <span className="text-xs font-black text-cyan-400 block mt-1">
                            a={result.sides.a}, b={result.sides.b}, c={result.sides.c}
                          </span>
                        </div>
                      )}

                      <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
                          Area (A)
                        </span>
                        <span className="text-xs font-black text-emerald-400 block mt-1">
                          {result.area ?? 0} sq units
                        </span>
                      </div>

                      <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
                          Perimeter (P)
                        </span>
                        <span className="text-xs font-black text-amber-400 block mt-1">
                          {result.perimeter ?? result.circumference ?? 0}
                        </span>
                      </div>

                      {result.altitudes && (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
                            Altitude (hc)
                          </span>
                          <span className="text-xs font-black text-purple-400 block mt-1">
                            {result.altitudes.hc}
                          </span>
                        </div>
                      )}

                      {result.inradius !== undefined && result.inradius > 0 && (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
                            Inradius (r)
                          </span>
                          <span className="text-xs font-black text-pink-400 block mt-1">
                            {result.inradius}
                          </span>
                        </div>
                      )}

                      {result.circumradius !== undefined && result.circumradius > 0 && (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
                            Circumradius (R)
                          </span>
                          <span className="text-xs font-black text-indigo-400 block mt-1">
                            {result.circumradius}
                          </span>
                        </div>
                      )}

                      {result.diagonal !== undefined && (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
                            Diagonal
                          </span>
                          <span className="text-xs font-black text-teal-400 block mt-1">
                            {result.diagonal}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP-BY-STEP PROOFS / DERIVATIONS */}
                  {result?.steps && result.steps.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        Mathematical Derivation & Proofs:
                      </span>
                      <div className="space-y-2">
                        {result.steps.map((st, i) => (
                          <div key={i} className="text-xs p-2.5 rounded-lg bg-black/30 border border-white/5">
                            <div className="font-semibold text-white/90 mb-1">{st.description}</div>
                            {st.latex && (
                              <div className="text-blue-300 font-mono overflow-x-auto py-0.5">
                                <KatexMath math={st.latex} block={false} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/5">
          <div className="text-xs opacity-60 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-400" />
            <span>Computes angles and sides with analytical trigonometry, Law of Cosines, & Law of Sines.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={() => {
                let eqCmd = "";
                if (result?.type === "triangle" && result.sides) {
                  if (result.subtype === "Right Triangle") {
                    eqCmd = `pythagorean(${result.sides.a}, ${result.sides.b})`;
                  } else {
                    eqCmd = `triangle(${result.sides.a}, ${result.sides.b}, ${result.sides.c})`;
                  }
                } else if (result?.type === "circle" && result.radius) {
                  eqCmd = `circle(${result.radius})`;
                } else if (result?.type === "rectangle" && result.width && result.height) {
                  eqCmd = `rectangle(${result.width}, ${result.height})`;
                } else {
                  eqCmd = "triangle(3, 4, 5)";
                }

                stopCamera();
                onClose();
                onApplyToWhiteboard(eqCmd);
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer ml-auto sm:ml-0"
            >
              <ArrowRight className="w-4 h-4" />
              Transfer to Whiteboard Lecture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
