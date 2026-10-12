import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { SceneAnnotation, ThemeType } from "../../types";
import { BOARD_THEMES } from "./themePalette";
import {
  Compass,
  Ruler,
  RotateCcw,
  Layers,
  Sparkles,
  Info,
  Check,
  Lock,
  Unlock,
  Move,
  CircleDot,
  Calculator,
  Play,
  Send,
  HelpCircle,
  Eye,
  EyeOff
} from "lucide-react";

interface GeometryBoardProps {
  equationStr?: string;
  annotations?: SceneAnnotation[];
  theme: ThemeType;
  onSolve?: (expr: string) => void;
}

type ConstraintMode = "free" | "right" | "isosceles" | "equilateral";

interface Point2D {
  x: number;
  y: number;
}

export default function GeometryBoard({
  equationStr = "",
  annotations = [],
  theme,
  onSolve
}: GeometryBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Display toggles
  const [showLabels, setShowLabels] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showIncircle, setShowIncircle] = useState(false);
  const [showCircumcircle, setShowCircumcircle] = useState(false);
  const [showAltitudes, setShowAltitudes] = useState(false);
  const [showEulerLine, setShowEulerLine] = useState(false);
  const [constraintMode, setConstraintMode] = useState<ConstraintMode>("free");
  const [activeTab, setActiveTab] = useState<"diagram" | "trig" | "invariants">("diagram");

  // Interaction State
  const [draggingVertex, setDraggingVertex] = useState<"A" | "B" | "C" | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<"A" | "B" | "C" | null>(null);

  // Dynamic Triangle Vertices in normalized board coordinates (origin (0,0) near bottom center)
  // Default: A(-3, 0), B(3, 0), C(-1, 3.5)
  const [vertices, setVertices] = useState<{ A: Point2D; B: Point2D; C: Point2D }>({
    A: { x: -3, y: -0.5 },
    B: { x: 3, y: -0.5 },
    C: { x: -3, y: 3.5 }
  });

  // Track initial equation input to sync initial triangle shape
  useEffect(() => {
    const raw = equationStr.toLowerCase();
    const pythMatch = raw.match(/pythagor(?:ean)?\s*\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*\)/);
    if (pythMatch) {
      const a = parseFloat(pythMatch[1]);
      const b = parseFloat(pythMatch[2]);
      setVertices({
        A: { x: -b / 2, y: -a / 3 },
        B: { x: b / 2, y: -a / 3 },
        C: { x: -b / 2, y: (2 * a) / 3 }
      });
      setConstraintMode("right");
      return;
    }

    const triMatch = raw.match(/triangle\s*\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*\)/);
    if (triMatch) {
      const a = parseFloat(triMatch[1]);
      const b = parseFloat(triMatch[2]);
      const c = parseFloat(triMatch[3]);
      // Approximate placement using Law of Cosines for vertex C
      const cosC = Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b)));
      const sinC = Math.sqrt(Math.max(0, 1 - cosC * cosC));
      setVertices({
        A: { x: -c / 2, y: -1 },
        B: { x: c / 2, y: -1 },
        C: { x: -c / 2 + b * cosC, y: -1 + b * sinC }
      });
      setConstraintMode("free");
    }
  }, [equationStr]);

  // Static geometric problem type detection (e.g., distance, circle, rectangle)
  const staticGeomData = useMemo(() => {
    const raw = equationStr.toLowerCase();

    // 1. Distance between two points: distance([x1, y1], [x2, y2])
    const distMatch = raw.match(/dist(?:ance)?\s*\(\s*\[?\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]?\s*,\s*\[?\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]?\s*\)/);
    if (distMatch) {
      const x1 = parseFloat(distMatch[1]);
      const y1 = parseFloat(distMatch[2]);
      const x2 = parseFloat(distMatch[3]);
      const y2 = parseFloat(distMatch[4]);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const d = Math.sqrt(dx * dx + dy * dy);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      return {
        type: "distance",
        title: "Coordinate Distance & Midpoint",
        p1: { x: x1, y: y1 },
        p2: { x: x2, y: y2 },
        midpoint: { x: mx, y: my },
        distance: Math.round(d * 100) / 100,
        dx,
        dy
      };
    }

    // 2. Midpoint: midpoint([x1, y1], [x2, y2])
    const midMatch = raw.match(/mid(?:point)?\s*\(\s*\[?\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]?\s*,\s*\[?\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]?\s*\)/);
    if (midMatch) {
      const x1 = parseFloat(midMatch[1]);
      const y1 = parseFloat(midMatch[2]);
      const x2 = parseFloat(midMatch[3]);
      const y2 = parseFloat(midMatch[4]);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const d = Math.sqrt(dx * dx + dy * dy);
      return {
        type: "distance",
        title: "Coordinate Midpoint Theorem",
        p1: { x: x1, y: y1 },
        p2: { x: x2, y: y2 },
        midpoint: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
        distance: Math.round(d * 100) / 100,
        dx,
        dy
      };
    }

    // 3. Circle: circle(r)
    const circleMatch = raw.match(/circle\s*\(\s*(\d+\.?\d*)\s*\)/);
    if (circleMatch) {
      const r = parseFloat(circleMatch[1]);
      return {
        type: "circle",
        title: `Circle Geometry (r = ${r})`,
        radius: r,
        diameter: 2 * r,
        area: Math.round(Math.PI * r * r * 100) / 100,
        circumference: Math.round(2 * Math.PI * r * 100) / 100
      };
    }

    // 4. Rectangle: rectangle(w, h)
    const rectMatch = raw.match(/rectangle\s*\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*\)/);
    if (rectMatch) {
      const w = parseFloat(rectMatch[1]);
      const h = parseFloat(rectMatch[2]);
      const diag = Math.sqrt(w * w + h * h);
      return {
        type: "rectangle",
        title: `Rectangle (${w} × ${h})`,
        width: w,
        height: h,
        area: w * h,
        perimeter: 2 * (w + h),
        diagonal: Math.round(diag * 100) / 100
      };
    }

    return null;
  }, [equationStr]);

  const isDynamicTriangle = staticGeomData === null;

  // Real-time Dynamic Geometric & Trigonometric Solver
  const triangleData = useMemo(() => {
    const { A, B, C } = vertices;

    // Side lengths: a = |BC|, b = |AC|, c = |AB|
    const dist = (p1: Point2D, p2: Point2D) =>
      Math.hypot(p2.x - p1.x, p2.y - p1.y);

    const c = Math.max(0.001, dist(A, B));
    const a = Math.max(0.001, dist(B, C));
    const b = Math.max(0.001, dist(A, C));

    // Angles (degrees) via Law of Cosines
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const angleA_rad = Math.acos(clamp((b * b + c * c - a * a) / (2 * b * c)));
    const angleB_rad = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c)));
    const angleC_rad = Math.PI - angleA_rad - angleB_rad;

    const angleA = (angleA_rad * 180) / Math.PI;
    const angleB = (angleB_rad * 180) / Math.PI;
    const angleC = Math.max(0, (angleC_rad * 180) / Math.PI);

    // Area via Cross Product
    const crossArea = 0.5 * Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y));
    const perimeter = a + b + c;
    const s = perimeter / 2;

    // Altitudes
    const ha = crossArea > 0 ? (2 * crossArea) / a : 0;
    const hb = crossArea > 0 ? (2 * crossArea) / b : 0;
    const hc = crossArea > 0 ? (2 * crossArea) / c : 0;

    // Incircle: Center I = (aA + bB + cC) / (a + b + c), radius r = Area / s
    const incenter: Point2D = {
      x: (a * A.x + b * B.x + c * C.x) / perimeter,
      y: (a * A.y + b * B.y + c * C.y) / perimeter
    };
    const inradius = s > 0 ? crossArea / s : 0;

    // Circumcircle: Center O
    const D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    let circumcenter: Point2D = { x: 0, y: 0 };
    let circumradius = 0;
    if (Math.abs(D) > 1e-5) {
      const a2 = A.x * A.x + A.y * A.y;
      const b2 = B.x * B.x + B.y * B.y;
      const c2 = C.x * C.x + C.y * C.y;
      circumcenter = {
        x: (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / D,
        y: (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / D
      };
      circumradius = dist(A, circumcenter);
    } else {
      circumradius = c / 2;
    }

    // Centroid G = (A + B + C) / 3
    const centroid: Point2D = {
      x: (A.x + B.x + C.x) / 3,
      y: (A.y + B.y + C.y) / 3
    };

    // Orthocenter H: By Euler Line relation, H = 3G - 2O
    const orthocenter: Point2D = {
      x: 3 * centroid.x - 2 * circumcenter.x,
      y: 3 * centroid.y - 2 * circumcenter.y
    };

    // Trigonometric Ratios for Angle A
    const sinA = Math.sin(angleA_rad);
    const cosA = Math.cos(angleA_rad);
    const tanA = Math.abs(cosA) > 1e-4 ? Math.tan(angleA_rad) : NaN;

    // Law of Sines ratio (2R)
    const lawOfSinesRatio = sinA > 1e-4 ? a / sinA : 0;

    return {
      a: Math.round(a * 100) / 100,
      b: Math.round(b * 100) / 100,
      c: Math.round(c * 100) / 100,
      angleA: Math.round(angleA * 10) / 10,
      angleB: Math.round(angleB * 10) / 10,
      angleC: Math.round(angleC * 10) / 10,
      area: Math.round(crossArea * 100) / 100,
      perimeter: Math.round(perimeter * 100) / 100,
      ha: Math.round(ha * 100) / 100,
      hb: Math.round(hb * 100) / 100,
      hc: Math.round(hc * 100) / 100,
      incenter,
      inradius: Math.round(inradius * 100) / 100,
      circumcenter,
      circumradius: Math.round(circumradius * 100) / 100,
      centroid,
      orthocenter,
      sinA: Math.round(sinA * 1000) / 1000,
      cosA: Math.round(cosA * 1000) / 1000,
      tanA: isNaN(tanA) ? "∞" : (Math.round(tanA * 1000) / 1000).toString(),
      lawOfSinesRatio: Math.round(lawOfSinesRatio * 100) / 100
    };
  }, [vertices]);

  // Coordinate Conversion Helpers between Canvas Pixels and Board Space
  const getCanvasTransforms = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { toScreen: (p: Point2D) => p, toBoard: (p: Point2D) => p, scale: 35 };

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const cx = width / 2;
    const cy = height * 0.55;
    const scale = Math.min(width, height) / 11;

    const toScreen = (p: Point2D): Point2D => ({
      x: cx + p.x * scale,
      y: cy - p.y * scale
    });

    const toBoard = (p: Point2D): Point2D => ({
      x: (p.x - cx) / scale,
      y: (cy - p.y) / scale
    });

    return { toScreen, toBoard, scale, width, height, cx, cy };
  }, []);

  // Pointer Interaction Handlers for Dragging Vertices
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDynamicTriangle) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickPos: Point2D = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    const { toScreen } = getCanvasTransforms();
    const hitRadius = 22;

    const distTo = (p: Point2D) => {
      const sp = toScreen(p);
      return Math.hypot(sp.x - clickPos.x, sp.y - clickPos.y);
    };

    if (distTo(vertices.C) < hitRadius) {
      setDraggingVertex("C");
      canvas.setPointerCapture(e.pointerId);
    } else if (distTo(vertices.B) < hitRadius) {
      setDraggingVertex("B");
      canvas.setPointerCapture(e.pointerId);
    } else if (distTo(vertices.A) < hitRadius) {
      setDraggingVertex("A");
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pointerPos: Point2D = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    const { toScreen, toBoard } = getCanvasTransforms();

    // Hover state detection
    if (!draggingVertex) {
      const hitRadius = 18;
      if (Math.hypot(toScreen(vertices.C).x - pointerPos.x, toScreen(vertices.C).y - pointerPos.y) < hitRadius) {
        setHoveredVertex("C");
      } else if (Math.hypot(toScreen(vertices.B).x - pointerPos.x, toScreen(vertices.B).y - pointerPos.y) < hitRadius) {
        setHoveredVertex("B");
      } else if (Math.hypot(toScreen(vertices.A).x - pointerPos.x, toScreen(vertices.A).y - pointerPos.y) < hitRadius) {
        setHoveredVertex("A");
      } else {
        setHoveredVertex(null);
      }
      return;
    }

    // Dynamic Constraint Projection during drag
    const rawTarget = toBoard(pointerPos);

    setVertices((prev) => {
      const next = { ...prev };
      const { A, B } = prev;

      if (draggingVertex === "A") {
        next.A = rawTarget;
      } else if (draggingVertex === "B") {
        next.B = rawTarget;
      } else if (draggingVertex === "C") {
        if (constraintMode === "right") {
          // Thales' theorem: C must lie on semicircle with diameter AB
          // Midpoint M = (A + B) / 2, radius R = |AB| / 2
          const mx = (A.x + B.x) / 2;
          const my = (A.y + B.y) / 2;
          const r = Math.max(0.5, Math.hypot(B.x - A.x, B.y - A.y) / 2);
          const angle = Math.atan2(rawTarget.y - my, rawTarget.x - mx);
          next.C = {
            x: mx + r * Math.cos(angle),
            y: my + r * Math.sin(angle)
          };
        } else if (constraintMode === "isosceles") {
          // C must lie on the perpendicular bisector of AB (so AC = BC)
          const mx = (A.x + B.x) / 2;
          const my = (A.y + B.y) / 2;
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          // Normal vector to AB is (-dy, dx)
          const normLen = Math.hypot(-dy, dx);
          if (normLen > 1e-4) {
            const nx = -dy / normLen;
            const ny = dx / normLen;
            // Project (rawTarget - M) onto normal vector
            const dot = (rawTarget.x - mx) * nx + (rawTarget.y - my) * ny;
            next.C = {
              x: mx + dot * nx,
              y: my + dot * ny
            };
          } else {
            next.C = rawTarget;
          }
        } else if (constraintMode === "equilateral") {
          // Fixed equilateral apex height (sqrt(3)/2 * base)
          const mx = (A.x + B.x) / 2;
          const my = (A.y + B.y) / 2;
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const side = Math.hypot(dx, dy);
          const height = (side * Math.sqrt(3)) / 2;
          const nx = -dy / side;
          const ny = dx / side;
          const sign = rawTarget.y >= my ? 1 : -1;
          next.C = {
            x: mx + sign * height * nx,
            y: my + sign * height * ny
          };
        } else {
          // Free scalene dragging
          next.C = rawTarget;
        }
      }

      return next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingVertex) {
      const canvas = canvasRef.current;
      if (canvas) canvas.releasePointerCapture(e.pointerId);
      setDraggingVertex(null);
    }
  };

  // Preset Configurations
  const applyPreset = (presetName: string) => {
    if (presetName === "pyth345") {
      setVertices({ A: { x: -2, y: -0.5 }, B: { x: 2, y: -0.5 }, C: { x: -2, y: 2.5 } });
      setConstraintMode("right");
    } else if (presetName === "equilateral") {
      setVertices({ A: { x: -2.5, y: -1 }, B: { x: 2.5, y: -1 }, C: { x: 0, y: 3.33 } });
      setConstraintMode("equilateral");
    } else if (presetName === "golden") {
      setVertices({ A: { x: -1.5, y: -1 }, B: { x: 1.5, y: -1 }, C: { x: 0, y: 3.63 } });
      setConstraintMode("isosceles");
    } else if (presetName === "obtuse") {
      setVertices({ A: { x: -3, y: -0.5 }, B: { x: 1.5, y: -0.5 }, C: { x: -4, y: 2.2 } });
      setConstraintMode("free");
    }
  };

  // Render on HTML5 Canvas
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

    // Fill Canvas Background
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    // 1. Grid
    if (showGrid) {
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      const step = 28;
      for (let x = 0; x <= width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    const { toScreen, scale } = getCanvasTransforms();

    // 2. Render Non-triangle static queries if any (Distance, Rectangle, Circle)
    if (!isDynamicTriangle && staticGeomData) {
      if (staticGeomData.type === "distance" && staticGeomData.p1 && staticGeomData.p2) {
        const p1 = staticGeomData.p1;
        const p2 = staticGeomData.p2;
        const s1 = toScreen(p1);
        const s2 = toScreen(p2);

        // Segment
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.strokeStyle = colors.curve;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Points
        [s1, s2].forEach((pt, idx) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = colors.point;
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        });

        // Midpoint
        if (staticGeomData.midpoint) {
          const sm = toScreen(staticGeomData.midpoint);
          ctx.beginPath();
          ctx.arc(sm.x, sm.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = colors.secondaryCurve;
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = colors.text;
          ctx.font = "bold 11px monospace";
          ctx.fillText(`M (${staticGeomData.midpoint.x}, ${staticGeomData.midpoint.y})`, sm.x + 8, sm.y - 8);
        }
      } else if (staticGeomData.type === "circle") {
        const radPix = (staticGeomData.radius || 3) * scale * 0.7;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, radPix, 0, Math.PI * 2);
        ctx.fillStyle = `${colors.curve}1a`;
        ctx.fill();
        ctx.strokeStyle = colors.curve;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Radius line
        ctx.beginPath();
        ctx.moveTo(width / 2, height / 2);
        ctx.lineTo(width / 2 + radPix, height / 2);
        ctx.strokeStyle = colors.secondaryCurve;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      return;
    }

    // 3. Dynamic Interactive Constraint Triangle
    const sA = toScreen(vertices.A);
    const sB = toScreen(vertices.B);
    const sC = toScreen(vertices.C);

    // Circumcircle Overlay
    if (showCircumcircle && triangleData.circumradius > 0) {
      const sCircCenter = toScreen(triangleData.circumcenter);
      const sCircRad = triangleData.circumradius * scale;
      ctx.beginPath();
      ctx.arc(sCircCenter.x, sCircCenter.y, sCircRad, 0, Math.PI * 2);
      ctx.strokeStyle = "#38bdf840";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center dot O
      ctx.beginPath();
      ctx.arc(sCircCenter.x, sCircCenter.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.font = "10px monospace";
      ctx.fillText("O (Circumcenter)", sCircCenter.x + 6, sCircCenter.y - 6);
    }

    // Incircle Overlay
    if (showIncircle && triangleData.inradius > 0) {
      const sInCenter = toScreen(triangleData.incenter);
      const sInRad = triangleData.inradius * scale;
      ctx.beginPath();
      ctx.arc(sInCenter.x, sInCenter.y, sInRad, 0, Math.PI * 2);
      ctx.strokeStyle = "#34d39960";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center dot I
      ctx.beginPath();
      ctx.arc(sInCenter.x, sInCenter.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#34d399";
      ctx.fill();
      ctx.font = "10px monospace";
      ctx.fillText("I (Incenter)", sInCenter.x + 6, sInCenter.y - 6);
    }

    // Altitudes & Orthocenter
    if (showAltitudes) {
      const sH = toScreen(triangleData.orthocenter);
      ctx.strokeStyle = "#f43f5e50";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);

      // Altitude from C to AB
      ctx.beginPath();
      ctx.moveTo(sC.x, sC.y);
      ctx.lineTo(sC.x, sA.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(sH.x, sH.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#f43f5e";
      ctx.fill();
      ctx.font = "10px monospace";
      ctx.fillText("H (Orthocenter)", sH.x + 6, sH.y - 6);
    }

    // Euler Line (Collinear: Circumcenter O, Centroid G, Orthocenter H)
    if (showEulerLine) {
      const sO = toScreen(triangleData.circumcenter);
      const sH = toScreen(triangleData.orthocenter);
      ctx.beginPath();
      ctx.moveTo(sO.x - (sH.x - sO.x) * 0.3, sO.y - (sH.y - sO.y) * 0.3);
      ctx.lineTo(sH.x + (sH.x - sO.x) * 0.3, sH.y + (sH.y - sO.y) * 0.3);
      ctx.strokeStyle = "#f59e0b80";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 10px monospace";
      ctx.fillText("Euler Line (O - G - H)", (sO.x + sH.x) / 2 + 10, (sO.y + sH.y) / 2);
    }

    // Main Triangle Body
    ctx.beginPath();
    ctx.moveTo(sA.x, sA.y);
    ctx.lineTo(sB.x, sB.y);
    ctx.lineTo(sC.x, sC.y);
    ctx.closePath();

    ctx.fillStyle = `${colors.curve}1f`;
    ctx.fill();
    ctx.strokeStyle = colors.curve;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Right-angle square marker if angle C is ~90°
    if (Math.abs(triangleData.angleC - 90) < 1.5) {
      const sq = 14;
      const vCA = { x: sA.x - sC.x, y: sA.y - sC.y };
      const vCB = { x: sB.x - sC.x, y: sB.y - sC.y };
      const lenCA = Math.hypot(vCA.x, vCA.y);
      const lenCB = Math.hypot(vCB.x, vCB.y);
      if (lenCA > 0 && lenCB > 0) {
        const uA = { x: (vCA.x / lenCA) * sq, y: (vCA.y / lenCA) * sq };
        const uB = { x: (vCB.x / lenCB) * sq, y: (vCB.y / lenCB) * sq };
        ctx.beginPath();
        ctx.moveTo(sC.x + uA.x, sC.y + uA.y);
        ctx.lineTo(sC.x + uA.x + uB.x, sC.y + uA.y + uB.y);
        ctx.lineTo(sC.x + uB.x, sC.y + uB.y);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Dimension labels along edges
    if (showLabels) {
      ctx.fillStyle = colors.text;
      ctx.font = "bold 11px monospace";

      // Side c (AB)
      ctx.fillText(`c = ${triangleData.c}`, (sA.x + sB.x) / 2 - 15, (sA.y + sB.y) / 2 + 18);
      // Side a (BC)
      ctx.fillText(`a = ${triangleData.a}`, (sB.x + sC.x) / 2 + 12, (sB.y + sC.y) / 2);
      // Side b (AC)
      ctx.fillText(`b = ${triangleData.b}`, (sA.x + sC.x) / 2 - 40, (sA.y + sC.y) / 2);
    }

    // Angles
    if (showAngles) {
      ctx.fillStyle = colors.secondaryCurve;
      ctx.font = "bold 11px monospace";
      ctx.fillText(`A: ${triangleData.angleA}°`, sA.x - 30, sA.y + 16);
      ctx.fillText(`B: ${triangleData.angleB}°`, sB.x + 10, sB.y + 16);
      ctx.fillText(`C: ${triangleData.angleC}°`, sC.x - 20, sC.y - 18);
    }

    // Draggable Vertices (Pulsing circles with drag handles)
    const verticesList: { key: "A" | "B" | "C"; pt: Point2D; label: string }[] = [
      { key: "A", pt: sA, label: "A" },
      { key: "B", pt: sB, label: "B" },
      { key: "C", pt: sC, label: "C" }
    ];

    verticesList.forEach((v) => {
      const isDragging = draggingVertex === v.key;
      const isHovered = hoveredVertex === v.key;

      // Outer glow ring
      if (isDragging || isHovered) {
        ctx.beginPath();
        ctx.arc(v.pt.x, v.pt.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = isDragging ? "#38bdf844" : "#ffffff22";
        ctx.fill();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Inner solid point
      ctx.beginPath();
      ctx.arc(v.pt.x, v.pt.y, isDragging ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = v.key === "C" ? "#38bdf8" : colors.point;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [
    vertices,
    triangleData,
    theme,
    showGrid,
    showLabels,
    showAngles,
    showIncircle,
    showCircumcircle,
    showAltitudes,
    showEulerLine,
    draggingVertex,
    hoveredVertex,
    isDynamicTriangle,
    staticGeomData,
    getCanvasTransforms
  ]);

  const activeColors = BOARD_THEMES[theme] || BOARD_THEMES.chalkboard;

  // Handle Export / Send to Axiom Engine Solver
  const handleSolveCurrentShape = () => {
    if (!onSolve) return;
    if (constraintMode === "right" || Math.abs(triangleData.angleC - 90) < 1.5) {
      onSolve(`pythagorean(${triangleData.b}, ${triangleData.a})`);
    } else {
      onSolve(`triangle(${triangleData.a}, ${triangleData.b}, ${triangleData.c})`);
    }
  };

  return (
    <div
      className="flex flex-col h-full w-full rounded-2xl overflow-hidden border transition-all duration-300"
      style={{
        backgroundColor: activeColors.bg,
        borderColor: activeColors.cardBorder
      }}
    >
      {/* Top Header & Interactive Constraints Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between px-3.5 py-2.5 border-b backdrop-blur-md gap-2"
        style={{ borderColor: activeColors.cardBorder }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs font-bold shadow-sm"
            style={{
              backgroundColor: activeColors.cardBg,
              color: activeColors.curve,
              border: `1px solid ${activeColors.cardBorder}`
            }}
          >
            <Compass className="w-3.5 h-3.5 animate-spin-slow" />
            <span>
              {isDynamicTriangle
                ? `Dynamic Constraint Triangle (${constraintMode.toUpperCase()})`
                : staticGeomData?.title || "Geometry Canvas"}
            </span>
          </div>

          {/* Constraint Selector */}
          {isDynamicTriangle && (
            <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-white/10 text-[11px] font-mono">
              <button
                onClick={() => setConstraintMode("free")}
                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                  constraintMode === "free"
                    ? "bg-sky-500/30 text-sky-300 font-bold border border-sky-500/40"
                    : "text-white/60 hover:text-white"
                }`}
                title="Free Scalene: Drag any vertex anywhere"
              >
                Free
              </button>
              <button
                onClick={() => {
                  setConstraintMode("right");
                  applyPreset("pyth345");
                }}
                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                  constraintMode === "right"
                    ? "bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40"
                    : "text-white/60 hover:text-white"
                }`}
                title="Lock Right Angle (90°): Uses Thales' Circle constraint"
              >
                Right (90°)
              </button>
              <button
                onClick={() => {
                  setConstraintMode("isosceles");
                  applyPreset("golden");
                }}
                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                  constraintMode === "isosceles"
                    ? "bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40"
                    : "text-white/60 hover:text-white"
                }`}
                title="Lock Isosceles (AC = BC): Snaps to perpendicular bisector"
              >
                Isosceles
              </button>
              <button
                onClick={() => {
                  setConstraintMode("equilateral");
                  applyPreset("equilateral");
                }}
                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                  constraintMode === "equilateral"
                    ? "bg-purple-500/30 text-purple-300 font-bold border border-purple-500/40"
                    : "text-white/60 hover:text-white"
                }`}
                title="Lock Equilateral: 60°-60°-60° constraint"
              >
                Equilateral
              </button>
            </div>
          )}
        </div>

        {/* View & Overlay Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
              showLabels
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-white/5 text-white/60 hover:text-white border-white/10"
            }`}
          >
            <Ruler className="w-3 h-3" />
            Lengths
          </button>

          <button
            onClick={() => setShowAngles(!showAngles)}
            className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
              showAngles
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                : "bg-white/5 text-white/60 hover:text-white border-white/10"
            }`}
          >
            <CircleDot className="w-3 h-3" />
            Angles
          </button>

          {isDynamicTriangle && (
            <>
              <button
                onClick={() => setShowIncircle(!showIncircle)}
                className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
                  showIncircle
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-white/5 text-white/60 hover:text-white border-white/10"
                }`}
                title="Toggle Incircle & Incenter (I)"
              >
                Incircle
              </button>

              <button
                onClick={() => setShowCircumcircle(!showCircumcircle)}
                className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
                  showCircumcircle
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                    : "bg-white/5 text-white/60 hover:text-white border-white/10"
                }`}
                title="Toggle Circumcircle & Circumcenter (O)"
              >
                Circumcircle
              </button>

              <button
                onClick={() => setShowEulerLine(!showEulerLine)}
                className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
                  showEulerLine
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-white/5 text-white/60 hover:text-white border-white/10"
                }`}
                title="Toggle Euler Line (O - G - H)"
              >
                Euler Line
              </button>
            </>
          )}

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
              showGrid
                ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                : "bg-white/5 text-white/60 hover:text-white border-white/10"
            }`}
          >
            <Layers className="w-3 h-3" />
            Grid
          </button>

          {onSolve && isDynamicTriangle && (
            <button
              onClick={handleSolveCurrentShape}
              className="px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:brightness-110 shadow-sm"
              title="Solve this dynamically dragged triangle in the Axiom Engine"
            >
              <Send className="w-3 h-3" />
              Solve in Engine
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="relative flex-1 min-h-[340px] w-full overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`w-full h-full block ${
            isDynamicTriangle
              ? draggingVertex
                ? "cursor-grabbing"
                : hoveredVertex
                ? "cursor-grab"
                : "cursor-crosshair"
              : "cursor-default"
          }`}
          style={{ touchAction: "none" }}
        />

        {/* Drag Hint Overlay */}
        {isDynamicTriangle && (
          <div className="absolute top-2.5 left-3 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white/70">
            <Move className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>Drag vertices (A, B, C) to dynamically update constraints</span>
          </div>
        )}
      </div>

      {/* Bottom Real-Time Analysis & Trigonometric Invariant Panel */}
      <div
        className="px-3.5 py-2.5 border-t flex flex-col gap-2 text-xs"
        style={{
          borderColor: activeColors.cardBorder,
          backgroundColor: activeColors.cardBg
        }}
      >
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b pb-1.5 border-white/5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("diagram")}
              className={`text-[11px] font-mono cursor-pointer transition-colors pb-0.5 ${
                activeTab === "diagram" ? "text-cyan-400 font-bold border-b-2 border-cyan-400" : "text-white/50 hover:text-white"
              }`}
            >
              Metrics & Dimensions
            </button>
            <button
              onClick={() => setActiveTab("trig")}
              className={`text-[11px] font-mono cursor-pointer transition-colors pb-0.5 ${
                activeTab === "trig" ? "text-amber-400 font-bold border-b-2 border-amber-400" : "text-white/50 hover:text-white"
              }`}
            >
              Live Trigonometry & Laws
            </button>
            <button
              onClick={() => setActiveTab("invariants")}
              className={`text-[11px] font-mono cursor-pointer transition-colors pb-0.5 ${
                activeTab === "invariants" ? "text-emerald-400 font-bold border-b-2 border-emerald-400" : "text-white/50 hover:text-white"
              }`}
            >
              Centers & Invariants
            </button>
          </div>

          <div className="text-[10px] text-white/40 font-mono">
            Axiom Dynamic Constraint Engine
          </div>
        </div>

        {/* Tab 1: Dimensions & Metrics */}
        {activeTab === "diagram" && (
          <div className="flex flex-wrap items-center justify-between gap-3 font-mono">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-white/50">Sides:</span>
                <span className="text-emerald-400 font-bold">
                  a={triangleData.a}, b={triangleData.b}, c={triangleData.c}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-white/50">Angles:</span>
                <span className="text-purple-300 font-bold">
                  A={triangleData.angleA}°, B={triangleData.angleB}°, C={triangleData.angleC}°
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-white/50">Area:</span>
                <span className="text-cyan-300 font-bold">{triangleData.area} u²</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-white/50">Perimeter:</span>
                <span className="text-amber-300 font-bold">{triangleData.perimeter} u</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Live Analytical Trigonometry */}
        {activeTab === "trig" && (
          <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[11px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-amber-400 font-bold">Ratios (∠A):</span>
              <span className="text-white/80">sin(A) = <span className="text-cyan-300 font-bold">{triangleData.sinA}</span></span>
              <span className="text-white/80">cos(A) = <span className="text-cyan-300 font-bold">{triangleData.cosA}</span></span>
              <span className="text-white/80">tan(A) = <span className="text-cyan-300 font-bold">{triangleData.tanA}</span></span>
            </div>

            <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded border border-white/10">
              <span className="text-white/60">Law of Sines (a / sin A = 2R):</span>
              <span className="text-emerald-400 font-bold">{triangleData.lawOfSinesRatio}</span>
            </div>
          </div>
        )}

        {/* Tab 3: Triangle Centers & Invariants */}
        {activeTab === "invariants" && (
          <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[11px]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="text-white/60">Inradius (r):</span>
                <span className="text-emerald-400 font-bold">{triangleData.inradius} u</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white/60">Circumradius (R):</span>
                <span className="text-sky-400 font-bold">{triangleData.circumradius} u</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white/60">Altitudes:</span>
                <span className="text-rose-300 font-bold">ha={triangleData.ha}, hb={triangleData.hb}, hc={triangleData.hc}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
