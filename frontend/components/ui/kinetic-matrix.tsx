'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Sliders,
  Maximize2,
  Grid,
  Move,
  ArrowUpRight,
  Send,
  Layers,
  HelpCircle,
  Eye,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ParsedMatrixResult {
  matrix: number[][];
  dim: 2 | 3 | 4;
  rawExpr?: string;
}

// Utility to format a 2D array to readable matrix string
export function formatMatrixToString(matrix: number[][]): string {
  return `[${matrix.map(row => `[${row.join(", ")}]`).join(", ")}]`;
}

// Helper: 3x3 Determinant
export function det3x3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

// Helper: 4x4 Determinant via Laplace Expansion along row 0
export function det4x4(m: number[][]): number {
  let sum = 0;
  for (let j = 0; j < 4; j++) {
    const sub: number[][] = [];
    for (let r = 1; r < 4; r++) {
      const row: number[] = [];
      for (let c = 0; c < 4; c++) {
        if (c !== j) row.push(m[r][c]);
      }
      sub.push(row);
    }
    const sign = j % 2 === 0 ? 1 : -1;
    sum += sign * m[0][j] * det3x3(sub);
  }
  return sum;
}

// Helper: Universal Matrix Rank via Gaussian Elimination
export function computeMatrixRank(mat: number[][]): number {
  const m = mat.map(r => [...r]);
  const rows = m.length;
  const cols = m[0].length;
  let rank = 0;
  let row = 0;
  for (let col = 0; col < cols && row < rows; col++) {
    let pivot = row;
    while (pivot < rows && Math.abs(m[pivot][col]) < 1e-7) {
      pivot++;
    }
    if (pivot === rows) continue;
    const temp = m[row];
    m[row] = m[pivot];
    m[pivot] = temp;
    for (let i = row + 1; i < rows; i++) {
      const factor = m[i][col] / m[row][col];
      for (let j = col; j < cols; j++) {
        m[i][j] -= factor * m[row][j];
      }
    }
    row++;
    rank++;
  }
  return rank;
}

// Helper: Universal Matrix Inverse via Gauss-Jordan Elimination
export function invertMatrixNxN(mat: number[][]): number[][] | null {
  const n = mat.length;
  const aug: number[][] = mat.map((row, r) => {
    const rCopy = [...row];
    for (let c = 0; c < n; c++) {
      rCopy.push(r === c ? 1 : 0);
    }
    return rCopy;
  });

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }
    if (Math.abs(aug[maxRow][i]) < 1e-7) return null;

    const temp = aug[i];
    aug[i] = aug[maxRow];
    aug[maxRow] = temp;

    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        if (Math.abs(factor) > 1e-7) {
          for (let j = 0; j < 2 * n; j++) {
            aug[k][j] -= factor * aug[i][j];
          }
        }
      }
    }
  }

  return aug.map(row => row.slice(n));
}

// Robust parser supporting JSON/Python [[a,b],[c,d]], MATLAB [a b; c d], Wolfram {{a,b},{c,d}}, LaTeX \begin{pmatrix}, and det/eigen/inv wrappers
export function parseMatrixFromText(rawText: string): ParsedMatrixResult | null {
  if (!rawText || typeof rawText !== "string") return null;
  const text = rawText.trim();

  // 1. Try matching LaTeX: \begin{...matrix} ... \end{...matrix}
  const latexMatch = text.match(/\\begin\{(?:pmatrix|bmatrix|matrix|Bmatrix|vmatrix|Vmatrix)\}([\s\S]*?)\\end\{(?:pmatrix|bmatrix|matrix|Bmatrix|vmatrix|Vmatrix)\}/i);
  if (latexMatch) {
    const body = latexMatch[1].trim();
    const rows = body.split(/\\\\/).map(r => r.trim()).filter(Boolean);
    const parsedRows = rows.map(r => 
      r.split(/&/).map(c => parseFloat(c.trim())).filter(n => !isNaN(n))
    );
    if (parsedRows.length === 2 && parsedRows[0].length === 2 && parsedRows[1].length === 2) {
      return { matrix: parsedRows, dim: 2, rawExpr: text };
    }
    if (parsedRows.length === 3 && parsedRows[0].length === 3 && parsedRows[1].length === 3 && parsedRows[2].length === 3) {
      return { matrix: parsedRows, dim: 3, rawExpr: text };
    }
    if (parsedRows.length === 4 && parsedRows.every(r => r.length === 4)) {
      return { matrix: parsedRows, dim: 4, rawExpr: text };
    }
  }

  // 2. Try JSON / Python bracket syntax: [[a, b], [c, d]] or inside det([[...]]) or inv([[...]])
  const bracketMatch = text.match(/\[\s*(\[\s*[^\[\]]+\s*\](?:\s*,\s*\[\s*[^\[\]]+\s*\])+)\s*\]/);
  if (bracketMatch) {
    try {
      const rowMatches = bracketMatch[1].match(/\[\s*([^\[\]]+)\s*\]/g);
      if (rowMatches) {
        const parsedRows = rowMatches.map(rStr => {
          const inner = rStr.replace(/[\[\]]/g, "");
          return inner.split(/[\s,]+/).filter(Boolean).map(Number);
        });
        if (parsedRows.length === 2 && parsedRows[0].length === 2 && parsedRows[1].length === 2 && parsedRows.every(r => r.every(v => !isNaN(v)))) {
          return { matrix: parsedRows, dim: 2, rawExpr: text };
        }
        if (parsedRows.length === 3 && parsedRows[0].length === 3 && parsedRows[1].length === 3 && parsedRows[2].length === 3 && parsedRows.every(r => r.every(v => !isNaN(v)))) {
          return { matrix: parsedRows, dim: 3, rawExpr: text };
        }
        if (parsedRows.length === 4 && parsedRows.every(r => r.length === 4) && parsedRows.every(r => r.every(v => !isNaN(v)))) {
          return { matrix: parsedRows, dim: 4, rawExpr: text };
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Try Wolfram / Mathematica curly braces: {{a, b}, {c, d}}
  const braceMatch = text.match(/\{\s*(\{\s*[^\{\}]+\s*\}(?:\s*,\s*\{\s*[^\{\}]+\s*\})+)\s*\}/);
  if (braceMatch) {
    try {
      const rowMatches = braceMatch[1].match(/\{\s*([^\{\}]+)\s*\}/g);
      if (rowMatches) {
        const parsedRows = rowMatches.map(rStr => {
          const inner = rStr.replace(/[\{\}]/g, "");
          return inner.split(/[\s,]+/).filter(Boolean).map(Number);
        });
        if (parsedRows.length === 2 && parsedRows[0].length === 2 && parsedRows[1].length === 2 && parsedRows.every(r => r.every(v => !isNaN(v)))) {
          return { matrix: parsedRows, dim: 2, rawExpr: text };
        }
        if (parsedRows.length === 3 && parsedRows[0].length === 3 && parsedRows[1].length === 3 && parsedRows[2].length === 3 && parsedRows.every(r => r.every(v => !isNaN(v)))) {
          return { matrix: parsedRows, dim: 3, rawExpr: text };
        }
        if (parsedRows.length === 4 && parsedRows.every(r => r.length === 4) && parsedRows.every(r => r.every(v => !isNaN(v)))) {
          return { matrix: parsedRows, dim: 4, rawExpr: text };
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Try MATLAB / Octave semicolon row syntax: [1 2; 3 4] or [1, 2; 3, 4]
  const semiMatch = text.match(/\[\s*([^;\[\]]+(?:;[^;\[\]]+)+)\s*\]/);
  if (semiMatch) {
    const rows = semiMatch[1].split(";").map(r => r.trim()).filter(Boolean);
    const parsedRows = rows.map(r => r.split(/[\s,]+/).filter(Boolean).map(Number));
    if (parsedRows.length === 2 && parsedRows[0].length === 2 && parsedRows[1].length === 2 && parsedRows.every(r => r.every(v => !isNaN(v)))) {
      return { matrix: parsedRows, dim: 2, rawExpr: text };
    }
    if (parsedRows.length === 3 && parsedRows[0].length === 3 && parsedRows[1].length === 3 && parsedRows[2].length === 3 && parsedRows.every(r => r.every(v => !isNaN(v)))) {
      return { matrix: parsedRows, dim: 3, rawExpr: text };
    }
    if (parsedRows.length === 4 && parsedRows.every(r => r.length === 4) && parsedRows.every(r => r.every(v => !isNaN(v)))) {
      return { matrix: parsedRows, dim: 4, rawExpr: text };
    }
  }

  return null;
}

export interface KineticMatrixProps {
  title?: string;
  className?: string;
  theme?: string;
  initialMatrix?: number[][];
  matrixExpr?: string;
  onMatrixExprChange?: (expr: string) => void;
  onSolve?: (expr: string) => void;
  standalone?: boolean;
}

interface StepRREF {
  description: string;
  matrix: number[][];
}

export function KineticMatrix({
  title = "LINEAR ALGEBRA & MATRIX LAB",
  className = "",
  theme = "chalkboard",
  initialMatrix,
  matrixExpr,
  onMatrixExprChange,
  onSolve,
  standalone = false,
}: KineticMatrixProps) {
  const isChalkboard = theme === "chalkboard";
  const isBlueprint = theme === "blueprint";
  const isCosmos = theme === "cosmos";

  // Derive initial matrix from props or expression
  const initialParsed = useMemo(() => {
    if (matrixExpr) {
      const p = parseMatrixFromText(matrixExpr);
      if (p) return p;
    }
    if (initialMatrix) {
      if (initialMatrix.length === 4 && initialMatrix[0]?.length === 4) {
        return { matrix: initialMatrix, dim: 4 as const };
      }
      if (initialMatrix.length === 3 && initialMatrix[0]?.length === 3) {
        return { matrix: initialMatrix, dim: 3 as const };
      }
      if (initialMatrix.length === 2 && initialMatrix[0]?.length === 2) {
        return { matrix: initialMatrix, dim: 2 as const };
      }
    }
    return null;
  }, [initialMatrix, matrixExpr]);

  // Matrix Dimension: 2x2, 3x3, or 4x4
  const [dim, setDim] = useState<2 | 3 | 4>(() => initialParsed ? initialParsed.dim : 2);

  // Matrix Elements
  const [m2, setM2] = useState<number[][]>(() => 
    initialParsed && initialParsed.dim === 2
      ? initialParsed.matrix
      : (initialMatrix && initialMatrix.length === 2 && initialMatrix[0].length === 2
        ? initialMatrix
        : [[2, 1], [1, 2]])
  );
  const [m3, setM3] = useState<number[][]>(() =>
    initialParsed && initialParsed.dim === 3
      ? initialParsed.matrix
      : (initialMatrix && initialMatrix.length === 3 && initialMatrix[0].length === 3
        ? initialMatrix
        : [
            [2, 0, 1],
            [0, 1, 0],
            [1, 0, 2]
          ])
  );
  const [m4, setM4] = useState<number[][]>(() =>
    initialParsed && initialParsed.dim === 4
      ? initialParsed.matrix
      : (initialMatrix && initialMatrix.length === 4 && initialMatrix[0].length === 4
        ? initialMatrix
        : [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
          ])
  );

  // User Matrix Text Input state (direct typing / paste bar)
  const [matrixTextInput, setMatrixTextInput] = useState<string>(() => {
    if (matrixExpr) return matrixExpr;
    const current = initialParsed ? initialParsed.matrix : (dim === 2 ? m2 : dim === 3 ? m3 : m4);
    return formatMatrixToString(current);
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState<string | null>(() => initialParsed ? `${initialParsed.dim}×${initialParsed.dim} Matrix Loaded` : null);

  // Synchronize when initialMatrix or matrixExpr changes from outside (e.g. Studio equation bar)
  useEffect(() => {
    if (initialMatrix && initialMatrix.length > 0) {
      if (initialMatrix.length === 2 && initialMatrix[0]?.length === 2) {
        setDim(2);
        setM2(initialMatrix);
        setMatrixTextInput(formatMatrixToString(initialMatrix));
        setParseSuccess("2×2 Matrix Loaded from Studio");
        setParseError(null);
        setAnimProgress(1);
      } else if (initialMatrix.length === 3 && initialMatrix[0]?.length === 3) {
        setDim(3);
        setM3(initialMatrix);
        setMatrixTextInput(formatMatrixToString(initialMatrix));
        setParseSuccess("3×3 Matrix Loaded from Studio");
        setParseError(null);
        setAnimProgress(1);
      } else if (initialMatrix.length === 4 && initialMatrix[0]?.length === 4) {
        setDim(4);
        setM4(initialMatrix);
        setMatrixTextInput(formatMatrixToString(initialMatrix));
        setParseSuccess("4×4 Matrix Loaded from Studio");
        setParseError(null);
        setAnimProgress(1);
      }
    }
  }, [initialMatrix]);

  useEffect(() => {
    if (matrixExpr) {
      setMatrixTextInput(matrixExpr);
      const parsed = parseMatrixFromText(matrixExpr);
      if (parsed) {
        setDim(parsed.dim);
        if (parsed.dim === 2) {
          setM2(parsed.matrix);
        } else if (parsed.dim === 3) {
          setM3(parsed.matrix);
        } else {
          setM4(parsed.matrix);
        }
        setParseSuccess(`${parsed.dim}×${parsed.dim} Matrix Synced from User Input`);
        setParseError(null);
        setAnimProgress(1);
      }
    }
  }, [matrixExpr]);

  // Active Tab: visualizer | properties | rref
  const [activeTab, setActiveTab] = useState<"visualizer" | "properties" | "rref">("visualizer");

  // Transformation Animation State (interpolates from Identity I to A)
  const [animProgress, setAnimProgress] = useState(1); // 1 = fully transformed
  const [isAnimating, setIsAnimating] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  // Canvas View & Interactive Vector (2D)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(48); // pixels per unit
  const [testVector, setTestVector] = useState<[number, number]>([1, 1]); // draggable vector
  const [isDraggingVector, setIsDraggingVector] = useState(false);
  const [showEigenLines, setShowEigenLines] = useState(true);
  const [showUnitSquare, setShowUnitSquare] = useState(true);
  const [showTransformedGrid, setShowTransformedGrid] = useState(true);
  const [rotationAngle, setRotationAngle] = useState(45);

  // 3D Visualizer State (dim === 3 or dim === 4)
  const [zoom3D, setZoom3D] = useState(58);
  const yawRef = useRef(0.65); // azimuth angle
  const pitchRef = useRef(0.40); // elevation angle
  const [autoRotate3D, setAutoRotate3D] = useState(false);
  const [isOrbiting3D, setIsOrbiting3D] = useState(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const [showParallelepiped, setShowParallelepiped] = useState(true);
  const [showBasis3D, setShowBasis3D] = useState(true);
  const [showFloorGrid3D, setShowFloorGrid3D] = useState(true);
  const [showTestVector3D, setShowTestVector3D] = useState(true);
  const [testVector3D, setTestVector3D] = useState<[number, number, number]>([1, 1, 1]);
  const [last3DRotType, setLast3DRotType] = useState<"rot_z" | "rot_y" | "rot_x">("rot_z");
  const [renderTick, setRenderTick] = useState(0);

  const currentMatrix = dim === 2 ? m2 : dim === 3 ? m3 : m4;

  // Handle direct text/formula input change from the user
  const handleTextInputChange = (val: string) => {
    setMatrixTextInput(val);
    onMatrixExprChange?.(val);
    const parsed = parseMatrixFromText(val);
    if (parsed) {
      setParseError(null);
      setParseSuccess(`${parsed.dim}×${parsed.dim} Matrix Loaded`);
      setDim(parsed.dim);
      if (parsed.dim === 2) {
        setM2(parsed.matrix);
      } else if (parsed.dim === 3) {
        setM3(parsed.matrix);
      } else {
        setM4(parsed.matrix);
      }
      setAnimProgress(1);
    } else if (val.trim()) {
      setParseSuccess(null);
      if (val.includes("[") || val.includes("{") || val.includes(";")) {
        setParseError("Could not recognize 2×2, 3×3, or 4×4 matrix format");
      }
    } else {
      setParseError(null);
      setParseSuccess(null);
    }
  };

  // Handle cell input change
  const handleCellChange = (r: number, c: number, valStr: string) => {
    const val = parseFloat(valStr);
    const num = isNaN(val) ? 0 : val;
    let nextMat: number[][];
    if (dim === 2) {
      nextMat = m2.map(row => [...row]);
      nextMat[r][c] = num;
      setM2(nextMat);
    } else if (dim === 3) {
      nextMat = m3.map(row => [...row]);
      nextMat[r][c] = num;
      setM3(nextMat);
    } else {
      nextMat = m4.map(row => [...row]);
      nextMat[r][c] = num;
      setM4(nextMat);
    }
    const formatted = formatMatrixToString(nextMat);
    setMatrixTextInput(formatted);
    onMatrixExprChange?.(formatted);
    setParseError(null);
    setParseSuccess(`${dim}×${dim} Matrix Updated`);
    setAnimProgress(1); // jump to result
  };

  // Presets
  const applyPreset = (type: string) => {
    let nextM: number[][];
    if (dim === 2) {
      let m = m2;
      switch (type) {
        case "identity":
          m = [[1, 0], [0, 1]];
          break;
        case "rotation": {
          const rad = (rotationAngle * Math.PI) / 180;
          m = [
            [parseFloat(Math.cos(rad).toFixed(2)), parseFloat((-Math.sin(rad)).toFixed(2))],
            [parseFloat(Math.sin(rad).toFixed(2)), parseFloat(Math.cos(rad).toFixed(2))]
          ];
          break;
        }
        case "shear_x":
          m = [[1, 1.5], [0, 1]];
          break;
        case "shear_y":
          m = [[1, 0], [1.5, 1]];
          break;
        case "reflect_x":
          m = [[1, 0], [0, -1]];
          break;
        case "reflect_diag":
          m = [[0, 1], [1, 0]];
          break;
        case "scale":
          m = [[2, 0], [0, 0.5]];
          break;
        case "singular":
          m = [[2, 1], [4, 2]];
          break;
        case "projection":
          m = [[1, 0], [0, 0]];
          break;
        case "symmetric":
          m = [[3, 1], [1, 3]];
          break;
      }
      nextM = m;
      setM2(m);
    } else if (dim === 3) {
      const rad = (rotationAngle * Math.PI) / 180;
      const c = parseFloat(Math.cos(rad).toFixed(2));
      const s = parseFloat(Math.sin(rad).toFixed(2));
      let m = m3;
      switch (type) {
        case "identity":
          m = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
          break;
        case "rot_z":
          setLast3DRotType("rot_z");
          m = [
            [c, -s, 0],
            [s, c, 0],
            [0, 0, 1]
          ];
          break;
        case "rot_y":
          setLast3DRotType("rot_y");
          m = [
            [c, 0, s],
            [0, 1, 0],
            [-s, 0, c]
          ];
          break;
        case "rot_x":
          setLast3DRotType("rot_x");
          m = [
            [1, 0, 0],
            [0, c, -s],
            [0, s, c]
          ];
          break;
        case "shear":
          m = [[1, 1, 0], [0, 1, 1], [0, 0, 1]];
          break;
        case "scale":
          m = [[2, 0, 0], [0, 1.5, 0], [0, 0, 0.5]];
          break;
        case "projection":
          m = [[1, 0, 0], [0, 1, 0], [0, 0, 0]];
          break;
        case "singular":
          m = [[1, 2, 3], [2, 4, 6], [1, 1, 1]];
          break;
        case "symmetric":
          m = [[2, -1, 0], [-1, 2, -1], [0, -1, 2]];
          break;
        case "permutation":
          m = [[0, 1, 0], [0, 0, 1], [1, 0, 0]];
          break;
      }
      nextM = m;
      setM3(m);
    } else {
      // 4x4 Presets
      const rad = (rotationAngle * Math.PI) / 180;
      const c = parseFloat(Math.cos(rad).toFixed(2));
      const s = parseFloat(Math.sin(rad).toFixed(2));
      let m = m4;
      switch (type) {
        case "identity":
          m = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
          ];
          break;
        case "rot_xy_zw":
          m = [
            [c, -s, 0, 0],
            [s, c, 0, 0],
            [0, 0, c, -s],
            [0, 0, s, c]
          ];
          break;
        case "rot_xw":
          m = [
            [c, 0, 0, -s],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [s, 0, 0, c]
          ];
          break;
        case "scale":
          m = [
            [1.5, 0, 0, 0],
            [0, 1.2, 0, 0],
            [0, 0, 0.8, 0],
            [0, 0, 0, 1.3]
          ];
          break;
        case "hadamard":
          m = [
            [1, 1, 1, 1],
            [1, -1, 1, -1],
            [1, 1, -1, -1],
            [1, -1, -1, 1]
          ];
          break;
        case "singular":
          m = [
            [1, 0, 1, 2],
            [0, 1, 1, 1],
            [1, 1, 2, 3],
            [0, 0, 0, 0]
          ];
          break;
      }
      nextM = m;
      setM4(m);
    }
    const formatted = formatMatrixToString(nextM);
    setMatrixTextInput(formatted);
    onMatrixExprChange?.(formatted);
    setParseError(null);
    setParseSuccess(`${dim}×${dim} Preset Loaded`);
    setAnimProgress(1);
  };

  // Interpolated Matrix for smooth visual morphing (Identity -> M)
  const interpolated2x2 = useMemo(() => {
    const t = animProgress;
    return [
      [1 + (m2[0][0] - 1) * t, 0 + m2[0][1] * t],
      [0 + m2[1][0] * t, 1 + (m2[1][1] - 1) * t]
    ];
  }, [animProgress, m2]);

  const interpolated3x3 = useMemo(() => {
    const t = animProgress;
    return [
      [1 + (m3[0][0] - 1) * t, 0 + m3[0][1] * t, 0 + m3[0][2] * t],
      [0 + m3[1][0] * t, 1 + (m3[1][1] - 1) * t, 0 + m3[1][2] * t],
      [0 + m3[2][0] * t, 0 + m3[2][1] * t, 1 + (m3[2][2] - 1) * t]
    ];
  }, [animProgress, m3]);

  const interpolated4x4 = useMemo(() => {
    const t = animProgress;
    const I = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
    return m4.map((row, r) =>
      row.map((val, c) => I[r][c] + (val - I[r][c]) * t)
    );
  }, [animProgress, m4]);

  // Trigger transformation animation
  const playTransformationAnimation = () => {
    setIsAnimating(true);
    const start = performance.now();
    const duration = 1200; // ms

    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // smooth easeInOutQuad
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      setAnimProgress(eased);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        setIsAnimating(false);
        setAnimProgress(1);
      }
    };

    animFrameRef.current = requestAnimationFrame(frame);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // -------------------------------------------------------------
  // Mathematical Invariants & Calculations
  // -------------------------------------------------------------
  const mathMetrics = useMemo(() => {
    if (dim === 2) {
      const a = m2[0][0], b = m2[0][1];
      const c = m2[1][0], d = m2[1][1];

      // Determinant
      const det = a * d - b * c;
      const isSingular = Math.abs(det) < 1e-7;

      // Trace
      const trace = a + d;

      // Characteristic Equation: λ² - trace*λ + det = 0
      const discriminant = trace * trace - 4 * det;

      let eigenvalues: { lambda1: string; lambda2: string; isReal: boolean; v1?: [number, number]; v2?: [number, number] };
      if (discriminant >= 0) {
        const l1 = (trace + Math.sqrt(discriminant)) / 2;
        const l2 = (trace - Math.sqrt(discriminant)) / 2;

        // Compute eigenvectors
        const computeV = (l: number): [number, number] => {
          if (Math.abs(b) > 1e-6) {
            const v: [number, number] = [b, l - a];
            const mag = Math.hypot(v[0], v[1]) || 1;
            return [v[0] / mag, v[1] / mag];
          } else if (Math.abs(c) > 1e-6) {
            const v: [number, number] = [l - d, c];
            const mag = Math.hypot(v[0], v[1]) || 1;
            return [v[0] / mag, v[1] / mag];
          }
          return [1, 0];
        };

        eigenvalues = {
          lambda1: l1.toFixed(3).replace(/\.?0+$/, ''),
          lambda2: l2.toFixed(3).replace(/\.?0+$/, ''),
          isReal: true,
          v1: computeV(l1),
          v2: computeV(l2),
        };
      } else {
        const realPart = (trace / 2).toFixed(2);
        const imagPart = (Math.sqrt(-discriminant) / 2).toFixed(2);
        eigenvalues = {
          lambda1: `${realPart} + ${imagPart}i`,
          lambda2: `${realPart} - ${imagPart}i`,
          isReal: false,
        };
      }

      // Inverse
      let inverse: number[][] | null = null;
      if (!isSingular) {
        inverse = [
          [d / det, -b / det],
          [-c / det, a / det]
        ];
      }

      // Rank
      let rank = 2;
      if (Math.abs(a) < 1e-7 && Math.abs(b) < 1e-7 && Math.abs(c) < 1e-7 && Math.abs(d) < 1e-7) {
        rank = 0;
      } else if (isSingular) {
        rank = 1;
      }

      return {
        det,
        isSingular,
        trace,
        eigenvalues,
        inverse,
        rank,
        nullity: 2 - rank,
      };
    } else if (dim === 3) {
      // 3x3 Metrics
      const m = m3;
      const det = det3x3(m);

      const isSingular = Math.abs(det) < 1e-7;
      const trace = m[0][0] + m[1][1] + m[2][2];

      // Exact 3x3 Inversion via Classical Adjoint
      let inverse: number[][] | null = null;
      if (!isSingular) {
        const A00 = m[1][1] * m[2][2] - m[1][2] * m[2][1];
        const A01 = -(m[1][0] * m[2][2] - m[1][2] * m[2][0]);
        const A02 = m[1][0] * m[2][1] - m[1][1] * m[2][0];

        const A10 = -(m[0][1] * m[2][2] - m[0][2] * m[2][1]);
        const A11 = m[0][0] * m[2][2] - m[0][2] * m[2][0];
        const A12 = -(m[0][0] * m[2][1] - m[0][1] * m[2][0]);

        const A20 = m[0][1] * m[1][2] - m[0][2] * m[1][1];
        const A21 = -(m[0][0] * m[1][2] - m[0][2] * m[1][0]);
        const A22 = m[0][0] * m[1][1] - m[0][1] * m[1][0];

        inverse = [
          [A00 / det, A10 / det, A20 / det],
          [A01 / det, A11 / det, A21 / det],
          [A02 / det, A12 / det, A22 / det]
        ];
      }

      const rank = computeMatrixRank(m);

      return {
        det,
        isSingular,
        trace,
        eigenvalues: {
          lambda1: "Tr(A) = " + trace.toFixed(2),
          lambda2: "det(A) = " + det.toFixed(2),
          isReal: true
        },
        inverse,
        rank,
        nullity: 3 - rank
      };
    } else {
      // 4x4 Metrics
      const m = m4;
      const det = det4x4(m);
      const isSingular = Math.abs(det) < 1e-7;
      const trace = m[0][0] + m[1][1] + m[2][2] + m[3][3];
      const inverse = invertMatrixNxN(m);
      const rank = computeMatrixRank(m);

      return {
        det,
        isSingular,
        trace,
        eigenvalues: {
          lambda1: "Tr(A) = " + trace.toFixed(2),
          lambda2: "det(A) = " + det.toFixed(2),
          isReal: true
        },
        inverse,
        rank,
        nullity: 4 - rank
      };
    }
  }, [dim, m2, m3, m4]);

  // Transformed test vector (2D)
  const transformedTestVector = useMemo<[number, number]>(() => {
    if (dim === 2) {
      const a = m2[0][0], b = m2[0][1];
      const c = m2[1][0], d = m2[1][1];
      return [
        a * testVector[0] + b * testVector[1],
        c * testVector[0] + d * testVector[1]
      ];
    }
    return [0, 0];
  }, [dim, m2, testVector]);

  // Transformed test vector (3D)
  const transformed3DVector = useMemo<[number, number, number]>(() => {
    const [vx, vy, vz] = testVector3D;
    const [M0, M1, M2] = interpolated3x3;
    return [
      M0[0] * vx + M0[1] * vy + M0[2] * vz,
      M1[0] * vx + M1[1] * vy + M1[2] * vz,
      M2[0] * vx + M2[1] * vy + M2[2] * vz
    ];
  }, [testVector3D, interpolated3x3]);

  // -------------------------------------------------------------
  // Gauss-Jordan Row Reduction (RREF)
  // -------------------------------------------------------------
  const rrefSteps = useMemo<StepRREF[]>(() => {
    const steps: StepRREF[] = [];
    const mat: number[][] = (dim === 2 ? m2 : dim === 3 ? m3 : m4).map(r => [...r]);
    const rows = mat.length;
    const cols = mat[0].length;

    steps.push({
      description: "Initial Matrix A",
      matrix: mat.map(r => [...r])
    });

    let lead = 0;
    for (let r = 0; r < rows; r++) {
      if (cols <= lead) break;
      let i = r;
      while (Math.abs(mat[i][lead]) < 1e-7) {
        i++;
        if (rows === i) {
          i = r;
          lead++;
          if (cols === lead) return steps;
        }
      }

      if (i !== r) {
        // Swap rows
        const temp = mat[i];
        mat[i] = mat[r];
        mat[r] = temp;
        steps.push({
          description: `Swap Row ${r + 1} with Row ${i + 1} (R_${r + 1} ↔ R_${i + 1})`,
          matrix: mat.map(row => [...row])
        });
      }

      const val = mat[r][lead];
      if (Math.abs(val) > 1e-7 && Math.abs(val - 1) > 1e-7) {
        // Scale row to get leading 1
        for (let j = 0; j < cols; j++) {
          mat[r][j] /= val;
        }
        steps.push({
          description: `Scale Row ${r + 1} by ${parseFloat((1 / val).toFixed(3))} (R_${r + 1} ← R_${r + 1} / ${parseFloat(val.toFixed(2))})`,
          matrix: mat.map(row => [...row])
        });
      }

      for (let k = 0; k < rows; k++) {
        if (k !== r) {
          const factor = mat[k][lead];
          if (Math.abs(factor) > 1e-7) {
            for (let j = 0; j < cols; j++) {
              mat[k][j] -= factor * mat[r][j];
            }
            steps.push({
              description: `Eliminate element in Row ${k + 1}: (R_${k + 1} ← R_${k + 1} - (${parseFloat(factor.toFixed(2))})·R_${r + 1})`,
              matrix: mat.map(row => [...row])
            });
          }
        }
      }
      lead++;
    }

    steps.push({
      description: "Reduced Row Echelon Form (RREF)",
      matrix: mat.map(row => row.map(v => Math.abs(v) < 1e-7 ? 0 : parseFloat(v.toFixed(3))))
    });

    return steps;
  }, [dim, m2, m3, m4]);

  // -------------------------------------------------------------
  // Canvas Rendering (2D & 3D Interactive Transformation Visualizer)
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== "visualizer") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    if (dim === 2) {
      // ==========================================
      // 2D RENDERING PIPELINE
      // ==========================================
      const render2D = () => {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        ctx.clearRect(0, 0, width, height);

        // Colors based on theme
        const bgGridColor = isChalkboard ? "rgba(255, 230, 180, 0.08)" : "rgba(255, 255, 255, 0.07)";
        const axisColor = isChalkboard ? "rgba(240, 215, 160, 0.3)" : "rgba(255, 255, 255, 0.25)";
        const transGridColor = isChalkboard ? "rgba(217, 119, 6, 0.22)" : "rgba(59, 130, 246, 0.22)";

        // Draw original Cartesian background grid
        ctx.lineWidth = 1;
        ctx.strokeStyle = bgGridColor;
        const range = 12;

        for (let i = -range; i <= range; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * zoom, 0);
          ctx.lineTo(cx + i * zoom, height);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, cy - i * zoom);
          ctx.lineTo(width, cy - i * zoom);
          ctx.stroke();
        }

        // Draw Main Axes
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();

        // Matrix transformation components
        const [M00, M01] = interpolated2x2[0];
        const [M10, M11] = interpolated2x2[1];

        // Draw Transformed Grid Lines
        if (showTransformedGrid) {
          ctx.strokeStyle = transGridColor;
          ctx.lineWidth = 1;
          const gridLimit = 8;

          for (let k = -gridLimit; k <= gridLimit; k++) {
            const p1x = cx + (M00 * k + M01 * -gridLimit) * zoom;
            const p1y = cy - (M10 * k + M11 * -gridLimit) * zoom;
            const p2x = cx + (M00 * k + M01 * gridLimit) * zoom;
            const p2y = cy - (M10 * k + M11 * gridLimit) * zoom;

            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.stroke();

            const q1x = cx + (M00 * -gridLimit + M01 * k) * zoom;
            const q1y = cy - (M10 * -gridLimit + M11 * k) * zoom;
            const q2x = cx + (M00 * gridLimit + M01 * k) * zoom;
            const q2y = cy - (M10 * gridLimit + M11 * k) * zoom;

            ctx.beginPath();
            ctx.moveTo(q1x, q1y);
            ctx.lineTo(q2x, q2y);
            ctx.stroke();
          }
        }

        // Draw Transformed Unit Square Area (Parallelogram)
        if (showUnitSquare) {
          const oX = cx;
          const oY = cy;
          const iX = cx + M00 * zoom;
          const iY = cy - M10 * zoom;
          const diagX = cx + (M00 + M01) * zoom;
          const diagY = cy - (M10 + M11) * zoom;
          const jX = cx + M01 * zoom;
          const jY = cy - M11 * zoom;

          ctx.beginPath();
          ctx.moveTo(oX, oY);
          ctx.lineTo(iX, iY);
          ctx.lineTo(diagX, diagY);
          ctx.lineTo(jX, jY);
          ctx.closePath();

          ctx.fillStyle = isChalkboard
            ? "rgba(251, 191, 36, 0.16)"
            : "rgba(16, 185, 129, 0.15)";
          ctx.fill();

          ctx.strokeStyle = isChalkboard
            ? "rgba(251, 191, 36, 0.6)"
            : "rgba(16, 185, 129, 0.6)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Helper function to draw an arrow
        const drawArrow2D = (
          fromX: number,
          fromY: number,
          toX: number,
          toY: number,
          color: string,
          width: number,
          label: string
        ) => {
          const headlen = 9;
          const dx = toX - fromX;
          const dy = toY - fromY;
          const angle = Math.atan2(dy, dx);

          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = width;

          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();

          ctx.font = "bold 11px monospace";
          ctx.fillStyle = color;
          ctx.fillText(label, toX + 6, toY - 6);
        };

        // Draw Basis Vector i-hat transformed: A * [1, 0] = [M00, M10]
        const iEndX = cx + M00 * zoom;
        const iEndY = cy - M10 * zoom;
        drawArrow2D(cx, cy, iEndX, iEndY, "#10B981", 2.5, `Aî [${M00.toFixed(1)}, ${M10.toFixed(1)}]`);

        // Draw Basis Vector j-hat transformed: A * [0, 1] = [M01, M11]
        const jEndX = cx + M01 * zoom;
        const jEndY = cy - M11 * zoom;
        drawArrow2D(cx, cy, jEndX, jEndY, isChalkboard ? "#F59E0B" : "#8B5CF6", 2.5, `Aĵ [${M01.toFixed(1)}, ${M11.toFixed(1)}]`);

        // Draw Eigenvector directions (invariant lines)
        if (showEigenLines && mathMetrics.eigenvalues.isReal) {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = isChalkboard ? "rgba(252, 211, 77, 0.45)" : "rgba(236, 72, 153, 0.5)";
          ctx.lineWidth = 1.5;

          const drawEigenLine = (v: [number, number], label: string) => {
            const span = 15;
            ctx.beginPath();
            ctx.moveTo(cx - v[0] * span * zoom, cy + v[1] * span * zoom);
            ctx.lineTo(cx + v[0] * span * zoom, cy - v[1] * span * zoom);
            ctx.stroke();

            ctx.font = "10px monospace";
            ctx.fillStyle = isChalkboard ? "rgba(252, 211, 77, 0.8)" : "rgba(236, 72, 153, 0.8)";
            ctx.fillText(label, cx + v[0] * 3.5 * zoom, cy - v[1] * 3.5 * zoom);
          };

          if (mathMetrics.eigenvalues.v1) {
            drawEigenLine(mathMetrics.eigenvalues.v1, `λ₁=${mathMetrics.eigenvalues.lambda1}`);
          }
          if (mathMetrics.eigenvalues.v2 && mathMetrics.eigenvalues.lambda1 !== mathMetrics.eigenvalues.lambda2) {
            drawEigenLine(mathMetrics.eigenvalues.v2, `λ₂=${mathMetrics.eigenvalues.lambda2}`);
          }
          ctx.setLineDash([]);
        }

        // Draw User Draggable Test Vector v and transformed Av
        const vx = testVector[0];
        const vy = testVector[1];
        const vEndX = cx + vx * zoom;
        const vEndY = cy - vy * zoom;

        ctx.setLineDash([3, 3]);
        drawArrow2D(cx, cy, vEndX, vEndY, isChalkboard ? "rgba(240, 230, 210, 0.7)" : "rgba(255, 255, 255, 0.7)", 1.5, `v [${vx.toFixed(1)}, ${vy.toFixed(1)}]`);
        ctx.setLineDash([]);

        const avx = M00 * vx + M01 * vy;
        const avy = M10 * vx + M11 * vy;
        const avEndX = cx + avx * zoom;
        const avEndY = cy - avy * zoom;
        drawArrow2D(cx, cy, avEndX, avEndY, "#06B6D4", 2.5, `Av [${avx.toFixed(1)}, ${avy.toFixed(1)}]`);

        // Draggable handle at tip of v
        ctx.fillStyle = "#38BDF8";
        ctx.beginPath();
        ctx.arc(vEndX, vEndY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();
      };

      render2D();
    } else if (dim === 3) {
      // ==========================================
      // 3D RENDERING PIPELINE (dim === 3)
      // ==========================================
      const render3D = () => {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        ctx.clearRect(0, 0, width, height);

        const yaw = yawRef.current;
        const pitch = pitchRef.current;
        const currentZoom = zoom3D;

        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const cosP = Math.cos(pitch);
        const sinP = Math.sin(pitch);

        // 3D Isometric / Weak-Perspective Projection
        // (x, y, z) -> screen coordinate (sx, sy) + depth for sorting
        const project = (x: number, y: number, z: number) => {
          // Rotate around Z axis (yaw)
          const x1 = x * cosY - y * sinY;
          const y1 = x * sinY + y * cosY;
          const z1 = z;

          // Rotate around horizontal axis (pitch)
          const x2 = x1;
          const y2 = y1 * cosP - z1 * sinP;
          const z2 = y1 * sinP + z1 * cosP;

          const screenX = cx + x2 * currentZoom;
          const screenY = cy - z2 * currentZoom;

          return { x: screenX, y: screenY, depth: y2 };
        };

        // Draw Floor Grid (Z = 0 plane)
        if (showFloorGrid3D) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = isChalkboard ? "rgba(255, 230, 180, 0.08)" : "rgba(255, 255, 255, 0.07)";
          const gridRange = 3.5;

          for (let i = -3; i <= 3; i++) {
            const p1 = project(i, -gridRange, 0);
            const p2 = project(i, gridRange, 0);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            const q1 = project(-gridRange, i, 0);
            const q2 = project(gridRange, i, 0);
            ctx.beginPath();
            ctx.moveTo(q1.x, q1.y);
            ctx.lineTo(q2.x, q2.y);
            ctx.stroke();
          }
        }

        // Draw Reference Cartesian Axes (Faint dashed lines)
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = isChalkboard ? "rgba(240, 215, 160, 0.25)" : "rgba(255, 255, 255, 0.2)";
        const axisLen = 3.5;

        // X axis
        const px = project(axisLen, 0, 0);
        ctx.beginPath();
        ctx.moveTo(project(-axisLen, 0, 0).x, project(-axisLen, 0, 0).y);
        ctx.lineTo(px.x, px.y);
        ctx.stroke();

        // Y axis
        const py = project(0, axisLen, 0);
        ctx.beginPath();
        ctx.moveTo(project(0, -axisLen, 0).x, project(0, -axisLen, 0).y);
        ctx.lineTo(py.x, py.y);
        ctx.stroke();

        // Z axis
        const pz = project(0, 0, axisLen);
        ctx.beginPath();
        ctx.moveTo(project(0, 0, -axisLen).x, project(0, 0, -axisLen).y);
        ctx.lineTo(pz.x, pz.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Axis labels
        ctx.font = "10px monospace";
        ctx.fillStyle = isChalkboard ? "rgba(240, 215, 160, 0.5)" : "rgba(255, 255, 255, 0.4)";
        ctx.fillText("+x", px.x + 5, px.y);
        ctx.fillText("+y", py.x + 5, py.y);
        ctx.fillText("+z", pz.x + 5, pz.y);

        // 3D Basis Vectors transformed: columns of interpolated3x3
        const u = [interpolated3x3[0][0], interpolated3x3[1][0], interpolated3x3[2][0]]; // Col 0: A * [1, 0, 0]
        const v = [interpolated3x3[0][1], interpolated3x3[1][1], interpolated3x3[2][1]]; // Col 1: A * [0, 1, 0]
        const w = [interpolated3x3[0][2], interpolated3x3[1][2], interpolated3x3[2][2]]; // Col 2: A * [0, 0, 1]

        // 8 Vertices of the 3D Parallelepiped (Unit Cube transformed)
        const V0 = project(0, 0, 0);
        const V1 = project(u[0], u[1], u[2]);
        const V2 = project(v[0], v[1], v[2]);
        const V3 = project(w[0], w[1], w[2]);
        const V12 = project(u[0] + v[0], u[1] + v[1], u[2] + v[2]);
        const V13 = project(u[0] + w[0], u[1] + w[1], u[2] + w[2]);
        const V23 = project(v[0] + w[0], v[1] + w[1], v[2] + w[2]);
        const V123 = project(u[0] + v[0] + w[0], u[1] + v[1] + w[1], u[2] + v[2] + w[2]);

        // Draw 3D Parallelepiped faces (Sorted by depth using Painter's algorithm)
        if (showParallelepiped) {
          const faces = [
            [V0, V1, V12, V2],     // Bottom face (w=0)
            [V3, V13, V123, V23],  // Top face (w=1)
            [V0, V1, V13, V3],     // Front-left (v=0)
            [V2, V12, V123, V23],  // Back-right (v=1)
            [V0, V2, V23, V3],     // Left face (u=0)
            [V1, V12, V123, V13],  // Right face (u=1)
          ];

          const sortedFaces = faces.map(pts => {
            const avgDepth = (pts[0].depth + pts[1].depth + pts[2].depth + pts[3].depth) / 4;
            return { pts, avgDepth };
          }).sort((a, b) => b.avgDepth - a.avgDepth);

          const isSingular = mathMetrics.isSingular;
          sortedFaces.forEach(f => {
            ctx.beginPath();
            ctx.moveTo(f.pts[0].x, f.pts[0].y);
            ctx.lineTo(f.pts[1].x, f.pts[1].y);
            ctx.lineTo(f.pts[2].x, f.pts[2].y);
            ctx.lineTo(f.pts[3].x, f.pts[3].y);
            ctx.closePath();

            if (isSingular) {
              ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
              ctx.strokeStyle = "rgba(239, 68, 68, 0.65)";
            } else if (isChalkboard) {
              ctx.fillStyle = "rgba(251, 191, 36, 0.16)";
              ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
            } else {
              ctx.fillStyle = "rgba(59, 130, 246, 0.18)";
              ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
            }
            ctx.lineWidth = 1.3;
            ctx.fill();
            ctx.stroke();
          });
        }

        // Helper function for 3D Arrow
        const drawArrow3D = (
          from: { x: number; y: number },
          to: { x: number; y: number },
          color: string,
          lineWidth: number,
          label: string
        ) => {
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.hypot(dx, dy);
          if (len < 2) return;

          const angle = Math.atan2(dy, dx);
          const headLen = Math.min(10, Math.max(5, len * 0.22));

          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = lineWidth;

          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(to.x, to.y);
          ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();

          ctx.font = "bold 11px monospace";
          ctx.fillStyle = color;
          ctx.fillText(label, to.x + 6, to.y - 4);
        };

        // Draw Transformed 3D Basis Vectors
        if (showBasis3D) {
          // Ai-hat (Column 0: u) - Emerald
          drawArrow3D(
            V0,
            V1,
            "#10B981",
            2.5,
            `Aî [${u[0].toFixed(1)}, ${u[1].toFixed(1)}, ${u[2].toFixed(1)}]`
          );

          // Aj-hat (Column 1: v) - Amber
          drawArrow3D(
            V0,
            V2,
            "#F59E0B",
            2.5,
            `Aĵ [${v[0].toFixed(1)}, ${v[1].toFixed(1)}, ${v[2].toFixed(1)}]`
          );

          // Ak-hat (Column 2: w) - Violet
          drawArrow3D(
            V0,
            V3,
            isChalkboard ? "#E879F9" : "#8B5CF6",
            2.5,
            `Ak̂ [${w[0].toFixed(1)}, ${w[1].toFixed(1)}, ${w[2].toFixed(1)}]`
          );
        }

        // Draw 3D Test Vector v and transformed Av
        if (showTestVector3D) {
          const [vx, vy, vz] = testVector3D;
          const [avx, avy, avz] = transformed3DVector;

          const Vtip = project(vx, vy, vz);
          const Avtip = project(avx, avy, avz);

          // Original test vector v (dashed silver/white)
          ctx.setLineDash([3, 3]);
          drawArrow3D(
            V0,
            Vtip,
            isChalkboard ? "rgba(240, 230, 210, 0.7)" : "rgba(255, 255, 255, 0.7)",
            1.5,
            `v [${vx.toFixed(1)}, ${vy.toFixed(1)}, ${vz.toFixed(1)}]`
          );
          ctx.setLineDash([]);

          // Transformed test vector Av (cyan)
          drawArrow3D(
            V0,
            Avtip,
            "#06B6D4",
            2.5,
            `Av [${avx.toFixed(1)}, ${avy.toFixed(1)}, ${avz.toFixed(1)}]`
          );

          // Glowing tip handle
          ctx.fillStyle = "#06B6D4";
          ctx.beginPath();
          ctx.arc(Avtip.x, Avtip.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Origin indicator
        ctx.fillStyle = isChalkboard ? "#F59E0B" : "#38BDF8";
        ctx.beginPath();
        ctx.arc(V0.x, V0.y, 4, 0, Math.PI * 2);
        ctx.fill();
      };

      if (autoRotate3D) {
        const loop = () => {
          yawRef.current = (yawRef.current + 0.007) % (Math.PI * 2);
          render3D();
          animId = requestAnimationFrame(loop);
        };
        animId = requestAnimationFrame(loop);
      } else {
        render3D();
      }
    } else {
      // ==========================================
      // 4D HYPERSPACE / TESSERACT RENDERING PIPELINE (dim === 4)
      // ==========================================
      const render4D = () => {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        ctx.clearRect(0, 0, width, height);

        const yaw = yawRef.current;
        const pitch = pitchRef.current;
        const currentZoom = zoom3D;

        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const cosP = Math.cos(pitch);
        const sinP = Math.sin(pitch);

        const project3Dto2D = (x: number, y: number, z: number) => {
          const x1 = x * cosY - y * sinY;
          const y1 = x * sinY + y * cosY;
          const z1 = z;

          const x2 = x1;
          const y2 = y1 * cosP - z1 * sinP;
          const z2 = y1 * sinP + z1 * cosP;

          return {
            x: cx + x2 * currentZoom,
            y: cy - z2 * currentZoom,
            depth: y2
          };
        };

        const project4D = (x: number, y: number, z: number, w: number) => {
          const cameraDist4D = 4.0;
          const factor = cameraDist4D / (cameraDist4D + w * 0.45);
          const p2 = project3Dto2D(x * factor, y * factor, z * factor);
          return { ...p2, factor };
        };

        // Floor Grid (Z=0, W=0 reference)
        if (showFloorGrid3D) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = isChalkboard ? "rgba(255, 230, 180, 0.08)" : "rgba(255, 255, 255, 0.07)";
          const gridRange = 3.0;
          for (let i = -3; i <= 3; i++) {
            const p1 = project4D(i, -gridRange, 0, 0);
            const p2 = project4D(i, gridRange, 0, 0);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            const q1 = project4D(-gridRange, i, 0, 0);
            const q2 = project4D(gridRange, i, 0, 0);
            ctx.beginPath();
            ctx.moveTo(q1.x, q1.y);
            ctx.lineTo(q2.x, q2.y);
            ctx.stroke();
          }
        }

        // 4 Columns of interpolated4x4 (Basis Vectors in 4D)
        const c0 = [interpolated4x4[0][0], interpolated4x4[1][0], interpolated4x4[2][0], interpolated4x4[3][0]];
        const c1 = [interpolated4x4[0][1], interpolated4x4[1][1], interpolated4x4[2][1], interpolated4x4[3][1]];
        const c2 = [interpolated4x4[0][2], interpolated4x4[1][2], interpolated4x4[2][2], interpolated4x4[3][2]];
        const c3 = [interpolated4x4[0][3], interpolated4x4[1][3], interpolated4x4[2][3], interpolated4x4[3][3]];

        // 16 Vertices of Transformed Tesseract
        const vertices4D: [number, number, number, number][] = [];
        for (let k = 0; k < 16; k++) {
          const b0 = (k & 1) ? 1 : 0;
          const b1 = (k & 2) ? 1 : 0;
          const b2 = (k & 4) ? 1 : 0;
          const b3 = (k & 8) ? 1 : 0;
          vertices4D.push([
            b0 * c0[0] + b1 * c1[0] + b2 * c2[0] + b3 * c3[0],
            b0 * c0[1] + b1 * c1[1] + b2 * c2[1] + b3 * c3[1],
            b0 * c0[2] + b1 * c1[2] + b2 * c2[2] + b3 * c3[2],
            b0 * c0[3] + b1 * c1[3] + b2 * c2[3] + b3 * c3[3]
          ]);
        }

        const screenPts = vertices4D.map(v => project4D(v[0], v[1], v[2], v[3]));

        // 32 Edges
        for (let i = 0; i < 16; i++) {
          for (let bit = 1; bit <= 8; bit <<= 1) {
            const j = i ^ bit;
            if (i < j) {
              const isHyperEdge = bit === 8;
              const isOuterCube = Boolean((i & 8) && (j & 8));

              ctx.beginPath();
              ctx.moveTo(screenPts[i].x, screenPts[i].y);
              ctx.lineTo(screenPts[j].x, screenPts[j].y);

              if (isHyperEdge) {
                ctx.strokeStyle = isChalkboard ? "rgba(244, 114, 182, 0.75)" : "rgba(217, 70, 239, 0.8)";
                ctx.lineWidth = 1.6;
                ctx.setLineDash([4, 2]);
              } else if (isOuterCube) {
                ctx.strokeStyle = isChalkboard ? "rgba(251, 191, 36, 0.75)" : "rgba(56, 189, 248, 0.75)";
                ctx.lineWidth = 1.3;
                ctx.setLineDash([]);
              } else {
                ctx.strokeStyle = isChalkboard ? "rgba(251, 191, 36, 0.35)" : "rgba(56, 189, 248, 0.35)";
                ctx.lineWidth = 1.0;
                ctx.setLineDash([]);
              }
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }

        // Draw vertex dots
        screenPts.forEach((pt, idx) => {
          const isW1 = (idx & 8) !== 0;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isW1 ? 3.5 : 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isW1 ? "#F472B6" : (isChalkboard ? "#FCD34D" : "#38BDF8");
          ctx.fill();
        });

        // 4 Basis Arrows from origin
        const origin = screenPts[0];
        const drawBasisArrow = (target: { x: number; y: number }, color: string, label: string) => {
          ctx.beginPath();
          ctx.moveTo(origin.x, origin.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.font = "bold 10px monospace";
          ctx.fillStyle = color;
          ctx.fillText(label, target.x + 6, target.y + 3);
        };

        drawBasisArrow(screenPts[1], "#EF4444", "Ae₁");
        drawBasisArrow(screenPts[2], "#10B981", "Ae₂");
        drawBasisArrow(screenPts[4], "#3B82F6", "Ae₃");
        drawBasisArrow(screenPts[8], "#D946EF", "Ae₄ (4D)");
      };

      if (autoRotate3D) {
        const loop = () => {
          yawRef.current = (yawRef.current + 0.007) % (Math.PI * 2);
          render4D();
          animId = requestAnimationFrame(loop);
        };
        animId = requestAnimationFrame(loop);
      } else {
        render4D();
      }
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [
    activeTab,
    dim,
    interpolated2x2,
    interpolated3x3,
    interpolated4x4,
    zoom,
    zoom3D,
    testVector,
    testVector3D,
    transformed3DVector,
    showTransformedGrid,
    showUnitSquare,
    showEigenLines,
    showParallelepiped,
    showBasis3D,
    showFloorGrid3D,
    showTestVector3D,
    mathMetrics,
    isChalkboard,
    autoRotate3D,
    renderTick,
  ]);

  // Handle Canvas Mouse Dragging (for 2D vector & 3D orbit)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dim === 2) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const vx = (x - cx) / zoom;
      const vy = -(y - cy) / zoom;

      const dist = Math.hypot(vx - testVector[0], vy - testVector[1]);
      if (dist < 1.2 || e.shiftKey) {
        setIsDraggingVector(true);
        setTestVector([parseFloat(vx.toFixed(1)), parseFloat(vy.toFixed(1))]);
      }
    } else {
      setIsOrbiting3D(true);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dim === 2) {
      if (!isDraggingVector) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const vx = (x - cx) / zoom;
      const vy = -(y - cy) / zoom;

      setTestVector([parseFloat(vx.toFixed(1)), parseFloat(vy.toFixed(1))]);
    } else {
      if (!isOrbiting3D || !lastMousePosRef.current) return;
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;

      yawRef.current = (yawRef.current + dx * 0.008) % (Math.PI * 2);
      pitchRef.current = Math.max(-1.4, Math.min(1.4, pitchRef.current - dy * 0.008));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      setRenderTick(t => (t + 1) % 10000);
    }
  };

  const handleCanvasMouseUp = () => {
    if (dim === 2) {
      setIsDraggingVector(false);
    } else {
      setIsOrbiting3D(false);
      lastMousePosRef.current = null;
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (dim === 3) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -4 : 4;
      setZoom3D(z => Math.max(20, Math.min(130, z + delta)));
    }
  };

  // Quick Action to export directly to MathMotion AI Solver
  const handleExportToSolver = (type: "det" | "eigen" | "solve_sys") => {
    if (!onSolve) return;
    const m = dim === 2 ? m2 : m3;
    const matrixStr = `[${m.map(row => `[${row.join(", ")}]`).join(", ")}]`;

    if (type === "det") {
      onSolve(`det(${matrixStr})`);
    } else if (type === "eigen") {
      onSolve(`eigen(${matrixStr})`);
    } else {
      onSolve(`${matrixStr} * [1, 2]`);
    }
  };

  return (
    <div className={cn(
      "w-full rounded-2xl flex flex-col transition-all overflow-hidden border",
      isChalkboard
        ? "bg-[#0b1712] border-amber-900/40 text-amber-100"
        : "bg-[#0a0a0c] border-white/10 text-white",
      className
    )}>
      {/* Header Bar */}
      <div className={cn(
        "px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3",
        isChalkboard ? "border-amber-900/30 bg-[#0f221a]/80" : "border-white/10 bg-white/5"
      )}>
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border shadow-sm",
            isChalkboard ? "bg-[#183626] border-amber-500/40 text-amber-300" : "bg-blue-600/20 border-blue-500/40 text-blue-400"
          )}>
            [M]
          </div>
          <div>
            <h3 className={cn(
              "text-xs font-bold uppercase tracking-wider flex items-center gap-2",
              isChalkboard ? "font-scholar-title text-amber-200" : "font-mono text-white"
            )}>
              {title}
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded font-mono border",
                dim === 2
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : dim === 3
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-purple-500/10 text-purple-400 border-purple-500/20"
              )}>
                {dim}×{dim} Matrix
              </span>
            </h3>
          </div>
        </div>

        {/* Tab Switcher & Dimension Toggle */}
        <div className="flex items-center gap-2">
          {/* Dimension Toggle */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setDim(2)}
              className={cn(
                "px-2.5 py-1 rounded cursor-pointer transition-all",
                dim === 2 ? "bg-white/15 text-white font-bold" : "text-white/40 hover:text-white/70"
              )}
            >
              2×2
            </button>
            <button
              onClick={() => setDim(3)}
              className={cn(
                "px-2.5 py-1 rounded cursor-pointer transition-all",
                dim === 3 ? "bg-white/15 text-white font-bold" : "text-white/40 hover:text-white/70"
              )}
            >
              3×3
            </button>
            <button
              onClick={() => setDim(4)}
              className={cn(
                "px-2.5 py-1 rounded cursor-pointer transition-all",
                dim === 4 ? "bg-white/15 text-white font-bold" : "text-white/40 hover:text-white/70"
              )}
            >
              4×4
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setActiveTab("visualizer")}
              className={cn(
                "px-3 py-1 rounded cursor-pointer flex items-center gap-1.5 transition-all",
                activeTab === "visualizer" ? "bg-white/15 text-white font-bold shadow-xs" : "text-white/40 hover:text-white/70"
              )}
            >
              <Grid className="w-3.5 h-3.5 text-emerald-400" />
              Visualizer
            </button>
            <button
              onClick={() => setActiveTab("properties")}
              className={cn(
                "px-3 py-1 rounded cursor-pointer flex items-center gap-1.5 transition-all",
                activeTab === "properties" ? "bg-white/15 text-white font-bold shadow-xs" : "text-white/40 hover:text-white/70"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Invariants & Inversion
            </button>
            <button
              onClick={() => setActiveTab("rref")}
              className={cn(
                "px-3 py-1 rounded cursor-pointer flex items-center gap-1.5 transition-all",
                activeTab === "rref" ? "bg-white/15 text-white font-bold shadow-xs" : "text-white/40 hover:text-white/70"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              RREF Steps
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Interactive Matrix Inputs & Presets (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* User Input & Formula Syncer */}
          <div className={cn(
            "p-3.5 rounded-xl border flex flex-col gap-2.5 shadow-sm",
            isChalkboard ? "bg-[#081710] border-amber-900/40" : "bg-black/50 border-white/10"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
                <Sliders className="w-3 h-3 text-emerald-400" />
                User Matrix Input
              </span>
              {parseSuccess && (
                <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {parseSuccess}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={matrixTextInput}
                onChange={(e) => handleTextInputChange(e.target.value)}
                placeholder="e.g. [[1, 2], [3, 4]] or [1 2 3; 4 5 6; 7 8 9] or det(...)"
                className={cn(
                  "w-full px-3 py-2 text-xs font-mono rounded-lg border focus:outline-none transition-all",
                  parseError
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
                    : isChalkboard
                    ? "bg-[#10241b] border-amber-500/30 text-amber-100 focus:border-amber-400 placeholder:text-amber-200/30"
                    : "bg-white/5 border-white/15 text-white focus:border-blue-500 placeholder:text-white/30"
                )}
              />
            </div>

            {parseError && (
              <span className="text-[10px] font-mono text-rose-400">
                ⚠️ {parseError}
              </span>
            )}

            {/* Quick Syntax Chips & Studio Reload */}
            <div className="flex items-center justify-between text-[10px] font-mono text-white/50 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-white/40">Quick Paste:</span>
                <button
                  type="button"
                  onClick={() => handleTextInputChange("[[1, 2], [3, 4]]")}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white cursor-pointer"
                  title="2×2 Python/JSON matrix"
                >
                  2×2
                </button>
                <button
                  type="button"
                  onClick={() => handleTextInputChange("[[1, 2, 3], [0, 1, 4], [5, 6, 0]]")}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white cursor-pointer"
                  title="3×3 Python/JSON matrix"
                >
                  3×3
                </button>
                <button
                  type="button"
                  onClick={() => handleTextInputChange("[[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]")}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white cursor-pointer"
                  title="4×4 Tesseract Identity matrix"
                >
                  4×4
                </button>
                <button
                  type="button"
                  onClick={() => handleTextInputChange("[1 2; 3 4]")}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white cursor-pointer"
                  title="MATLAB semicolon syntax"
                >
                  [1 2; 3 4]
                </button>
              </div>

              {matrixExpr && (
                <button
                  type="button"
                  onClick={() => handleTextInputChange(matrixExpr)}
                  className="px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 cursor-pointer"
                  title="Reload matrix from Studio equation input"
                >
                  Reload Studio Input
                </button>
              )}
            </div>
          </div>

          {/* Matrix Input Bracket */}
          <div className={cn(
            "p-4 rounded-xl border flex flex-col gap-3",
            isChalkboard ? "bg-[#081510] border-amber-900/30" : "bg-black/40 border-white/10"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Matrix A Elements
              </span>
              <button
                onClick={() => applyPreset("identity")}
                className="text-[10px] font-mono text-white/40 hover:text-white flex items-center gap-1 cursor-pointer"
                title="Reset to Identity Matrix"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Reset
              </button>
            </div>

            {/* Matrix Brackets Display */}
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="text-4xl font-light text-white/30 select-none">[</span>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))`
                }}
              >
                {currentMatrix.map((row, r) =>
                  row.map((cell, c) => (
                    <input
                      key={`${r}-${c}`}
                      type="number"
                      step="0.5"
                      value={cell}
                      onChange={(e) => handleCellChange(r, c, e.target.value)}
                      className={cn(
                        "w-14 sm:w-16 h-11 text-center font-mono text-sm font-bold rounded-lg border focus:outline-none transition-all",
                        isChalkboard
                          ? "bg-[#10241b] border-amber-500/30 text-amber-200 focus:border-amber-400"
                          : "bg-white/5 border-white/15 text-white focus:border-blue-500"
                      )}
                    />
                  ))
                )}
              </div>
              <span className="text-4xl font-light text-white/30 select-none">]</span>
            </div>

            {/* Quick Presets */}
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 block mb-2">
                Geometric Presets
              </span>
              {dim === 2 ? (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => applyPreset("identity")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    Identity I
                  </button>
                  <button
                    onClick={() => applyPreset("rotation")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    Rotation ({rotationAngle}°)
                  </button>
                  <button
                    onClick={() => applyPreset("shear_x")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    Shear X
                  </button>
                  <button
                    onClick={() => applyPreset("scale")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    Scale
                  </button>
                  <button
                    onClick={() => applyPreset("reflect_diag")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    Reflect y=x
                  </button>
                  <button
                    onClick={() => applyPreset("singular")}
                    className="px-2.5 py-1 text-[10px] rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 cursor-pointer transition-all"
                  >
                    Singular (det=0)
                  </button>
                  <button
                    onClick={() => applyPreset("symmetric")}
                    className="px-2.5 py-1 text-[10px] rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 cursor-pointer transition-all"
                  >
                    Symmetric
                  </button>
                </div>
              ) : dim === 3 ? (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => applyPreset("identity")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    Identity I₃
                  </button>
                  <button
                    onClick={() => applyPreset("rot_z")}
                    className={cn(
                      "px-2.5 py-1 text-[10px] rounded border cursor-pointer transition-all",
                      last3DRotType === "rot_z" ? "bg-blue-600/30 border-blue-500 text-blue-200" : "bg-white/5 border-white/10 text-white/80"
                    )}
                  >
                    Rotate Z ({rotationAngle}°)
                  </button>
                  <button
                    onClick={() => applyPreset("rot_y")}
                    className={cn(
                      "px-2.5 py-1 text-[10px] rounded border cursor-pointer transition-all",
                      last3DRotType === "rot_y" ? "bg-blue-600/30 border-blue-500 text-blue-200" : "bg-white/5 border-white/10 text-white/80"
                    )}
                  >
                    Rotate Y
                  </button>
                  <button
                    onClick={() => applyPreset("rot_x")}
                    className={cn(
                      "px-2.5 py-1 text-[10px] rounded border cursor-pointer transition-all",
                      last3DRotType === "rot_x" ? "bg-blue-600/30 border-blue-500 text-blue-200" : "bg-white/5 border-white/10 text-white/80"
                    )}
                  >
                    Rotate X
                  </button>
                  <button
                    onClick={() => applyPreset("shear")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    3D Shear
                  </button>
                  <button
                    onClick={() => applyPreset("scale")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    3D Scale
                  </button>
                  <button
                    onClick={() => applyPreset("projection")}
                    className="px-2.5 py-1 text-[10px] rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 cursor-pointer transition-all"
                  >
                    Project (z=0)
                  </button>
                  <button
                    onClick={() => applyPreset("singular")}
                    className="px-2.5 py-1 text-[10px] rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 cursor-pointer transition-all"
                  >
                    Singular (det=0)
                  </button>
                  <button
                    onClick={() => applyPreset("symmetric")}
                    className="px-2.5 py-1 text-[10px] rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 cursor-pointer transition-all"
                  >
                    Symmetric
                  </button>
                  <button
                    onClick={() => applyPreset("permutation")}
                    className="px-2.5 py-1 text-[10px] rounded bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 cursor-pointer transition-all"
                  >
                    Permutation
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => applyPreset("identity")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    Identity I₄
                  </button>
                  <button
                    onClick={() => applyPreset("rot_xy_zw")}
                    className="px-2.5 py-1 text-[10px] rounded bg-blue-600/30 border border-blue-500/50 text-blue-200 cursor-pointer transition-all"
                  >
                    Double Rotation (XY & ZW)
                  </button>
                  <button
                    onClick={() => applyPreset("rot_xw")}
                    className="px-2.5 py-1 text-[10px] rounded bg-purple-600/30 border border-purple-500/50 text-purple-200 cursor-pointer transition-all"
                  >
                    4D X-W Tilt
                  </button>
                  <button
                    onClick={() => applyPreset("scale")}
                    className="px-2.5 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 cursor-pointer transition-all"
                  >
                    4D Scale
                  </button>
                  <button
                    onClick={() => applyPreset("hadamard")}
                    className="px-2.5 py-1 text-[10px] rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 cursor-pointer transition-all"
                  >
                    Hadamard H₄
                  </button>
                  <button
                    onClick={() => applyPreset("singular")}
                    className="px-2.5 py-1 text-[10px] rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 cursor-pointer transition-all"
                  >
                    Singular (det=0)
                  </button>
                </div>
              )}

              {/* Dynamic Rotation Slider (2D & 3D & 4D) */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/50">θ ({dim === 4 ? "4D" : dim === 3 ? last3DRotType.toUpperCase() : "2D"}):</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={rotationAngle}
                  onChange={(e) => {
                    const ang = parseInt(e.target.value);
                    setRotationAngle(ang);
                    const rad = (ang * Math.PI) / 180;
                    const c = parseFloat(Math.cos(rad).toFixed(2));
                    const s = parseFloat(Math.sin(rad).toFixed(2));

                    if (dim === 2) {
                      setM2([
                        [c, -s],
                        [s, c]
                      ]);
                    } else {
                      if (last3DRotType === "rot_z") {
                        setM3([
                          [c, -s, 0],
                          [s, c, 0],
                          [0, 0, 1]
                        ]);
                      } else if (last3DRotType === "rot_y") {
                        setM3([
                          [c, 0, s],
                          [0, 1, 0],
                          [-s, 0, c]
                        ]);
                      } else {
                        setM3([
                          [1, 0, 0],
                          [0, c, -s],
                          [0, s, c]
                        ]);
                      }
                    }
                    setAnimProgress(1);
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-white/80 w-9 text-right">{rotationAngle}°</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badge Card */}
          <div className={cn(
            "p-3.5 rounded-xl border flex flex-col gap-2 font-mono text-xs",
            isChalkboard ? "bg-[#0c1c15] border-amber-900/30" : "bg-black/30 border-white/10"
          )}>
            <div className="flex items-center justify-between pb-1 border-b border-white/10">
              <span className="text-[10px] uppercase font-bold text-white/50">Determinant det(A)</span>
              <span className={cn(
                "font-bold px-2 py-0.5 rounded text-xs",
                mathMetrics.isSingular
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              )}>
                {mathMetrics.det.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/50">Trace Tr(A):</span>
              <span className="text-white font-bold">{mathMetrics.trace.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/50">Rank / Nullity:</span>
              <span className="text-white font-bold">{mathMetrics.rank} / {mathMetrics.nullity}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/50">Invertible:</span>
              <span className={mathMetrics.isSingular ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                {mathMetrics.isSingular ? "No (Singular)" : "Yes (det ≠ 0)"}
              </span>
            </div>
          </div>

          {/* Export to MathMotion Solver Buttons */}
          {onSolve && (
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                Solve with MathMotion Engine
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleExportToSolver("det")}
                  className={cn(
                    "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all border",
                    isChalkboard
                      ? "bg-[#183626] hover:bg-[#234e37] border-amber-500/40 text-amber-200"
                      : "bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40 text-emerald-300"
                  )}
                >
                  <Send className="w-3 h-3" /> Solve det(A)
                </button>
                <button
                  onClick={() => handleExportToSolver("eigen")}
                  className={cn(
                    "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all border",
                    isChalkboard
                      ? "bg-[#183626] hover:bg-[#234e37] border-amber-500/40 text-amber-200"
                      : "bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/40 text-blue-300"
                  )}
                >
                  <Sparkles className="w-3 h-3" /> Solve Eigenvalues
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Tab View (8 cols) */}
        <div className="lg:col-span-8 flex flex-col">
          {/* TAB 1: 2D & 3D Transformation Visualizer */}
          {activeTab === "visualizer" && (
            <div className="flex flex-col gap-3">
              {/* Canvas Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={playTransformationAnimation}
                    disabled={isAnimating}
                    className={cn(
                      "px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                      isChalkboard
                        ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                    )}
                  >
                    {isAnimating ? <Pause className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Animate {dim === 3 ? "3D Space" : "Transformation"}
                  </button>
                  <button
                    onClick={() => setAnimProgress(animProgress === 1 ? 0 : 1)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white cursor-pointer font-mono text-[11px]"
                    title="Toggle between Identity and Transformed space"
                  >
                    Morph: {Math.round(animProgress * 100)}%
                  </button>
                </div>

                {/* Dimension-Aware Visual Toggles */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-white/70">
                  {dim === 2 ? (
                    <>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showTransformedGrid}
                          onChange={(e) => setShowTransformedGrid(e.target.checked)}
                          className="accent-emerald-500"
                        />
                        Grid Lines
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showUnitSquare}
                          onChange={(e) => setShowUnitSquare(e.target.checked)}
                          className="accent-amber-500"
                        />
                        Area |det|
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showEigenLines}
                          onChange={(e) => setShowEigenLines(e.target.checked)}
                          className="accent-pink-500"
                        />
                        Eigen-Axes
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showParallelepiped}
                          onChange={(e) => setShowParallelepiped(e.target.checked)}
                          className="accent-blue-500"
                        />
                        Parallelepiped |det|
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showBasis3D}
                          onChange={(e) => setShowBasis3D(e.target.checked)}
                          className="accent-emerald-500"
                        />
                        3D Basis Vectors
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showFloorGrid3D}
                          onChange={(e) => setShowFloorGrid3D(e.target.checked)}
                          className="accent-amber-500"
                        />
                        Floor Grid
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showTestVector3D}
                          onChange={(e) => setShowTestVector3D(e.target.checked)}
                          className="accent-cyan-500"
                        />
                        Vector v→Av
                      </label>
                    </>
                  )}

                  {/* Zoom controls */}
                  <div className="flex items-center bg-white/5 border border-white/10 rounded px-1">
                    <button
                      onClick={() => {
                        if (dim === 2) {
                          setZoom(z => Math.max(25, z - 6));
                        } else {
                          setZoom3D(z => Math.max(25, z - 6));
                        }
                      }}
                      className="px-1.5 py-0.5 text-white/50 hover:text-white cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-1 text-[10px]">{dim === 2 ? zoom : zoom3D}px</span>
                    <button
                      onClick={() => {
                        if (dim === 2) {
                          setZoom(z => Math.min(80, z + 6));
                        } else {
                          setZoom3D(z => Math.min(120, z + 6));
                        }
                      }}
                      className="px-1.5 py-0.5 text-white/50 hover:text-white cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Canvas Container */}
              <div className={cn(
                "relative h-[360px] sm:h-[420px] rounded-xl border overflow-hidden flex items-center justify-center select-none",
                isChalkboard ? "bg-[#06100c] border-amber-900/40" : "bg-black border-white/10"
              )}>
                <canvas
                  ref={canvasRef}
                  width={740}
                  height={420}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onWheel={handleCanvasWheel}
                  className={cn(
                    "w-full h-full",
                    dim === 2 ? "cursor-crosshair" : (isOrbiting3D ? "cursor-grabbing" : "cursor-grab")
                  )}
                />

                {/* 2D Overlay Badges */}
                {dim === 2 && (
                  <>
                    <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-mono pointer-events-none space-y-0.5 shadow-md">
                      <div className="text-emerald-400 font-bold">
                        • Green arrow: Aî = [{m2[0][0]}, {m2[1][0]}]
                      </div>
                      <div className="text-purple-400 font-bold">
                        • Violet arrow: Aĵ = [{m2[0][1]}, {m2[1][1]}]
                      </div>
                      <div className="text-cyan-400 font-bold">
                        • Drag blue dot to move test vector v [{testVector[0]}, {testVector[1]}] → Av [{transformedTestVector[0].toFixed(1)}, {transformedTestVector[1].toFixed(1)}]
                      </div>
                    </div>

                    <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg px-3 py-1.5 font-mono text-[11px] flex items-center gap-2 shadow-md">
                      <span className="text-white/50">Unit Area Scaled:</span>
                      <span className="text-amber-300 font-bold">|det(A)| = {Math.abs(mathMetrics.det).toFixed(2)}</span>
                    </div>
                  </>
                )}

                {/* 3D Overlay Badges */}
                {dim === 3 && (
                  <>
                    {/* Top-Left: Basis Vectors & Column Transformation */}
                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono pointer-events-none space-y-1 shadow-lg">
                      <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm" />
                        Aî = [{m3[0][0]}, {m3[1][0]}, {m3[2][0]}] (Column 1)
                      </div>
                      <div className="text-amber-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-sm" />
                        Aĵ = [{m3[0][1]}, {m3[1][1]}, {m3[2][1]}] (Column 2)
                      </div>
                      <div className="text-purple-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block shadow-sm" />
                        Ak̂ = [{m3[0][2]}, {m3[1][2]}, {m3[2][2]}] (Column 3)
                      </div>
                      <div className="text-cyan-300 pt-1 border-t border-white/10">
                        • v = [{testVector3D[0]}, {testVector3D[1]}, {testVector3D[2]}] → Av = [{transformed3DVector[0].toFixed(1)}, {transformed3DVector[1].toFixed(1)}, {transformed3DVector[2].toFixed(1)}]
                      </div>
                    </div>

                    {/* Top-Right: Camera Orbit Controls */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          yawRef.current = 0.65;
                          pitchRef.current = 0.40;
                          setZoom3D(58);
                          setRenderTick(t => t + 1);
                        }}
                        className="px-2 py-1 rounded-md bg-black/70 hover:bg-black/90 border border-white/15 text-white/80 hover:text-white text-[10px] font-mono cursor-pointer backdrop-blur-sm transition-all"
                        title="Reset 3D camera to isometric view"
                      >
                        Reset Angle
                      </button>
                      <button
                        onClick={() => setAutoRotate3D(prev => !prev)}
                        className={cn(
                          "px-2 py-1 rounded-md border text-[10px] font-mono cursor-pointer backdrop-blur-sm transition-all flex items-center gap-1",
                          autoRotate3D
                            ? "bg-blue-600/30 border-blue-500/50 text-blue-300"
                            : "bg-black/70 hover:bg-black/90 border-white/15 text-white/80 hover:text-white"
                        )}
                      >
                        <RotateCcw className={cn("w-2.5 h-2.5", autoRotate3D && "animate-spin")} />
                        {autoRotate3D ? "Orbiting" : "Auto-Orbit"}
                      </button>
                    </div>

                    {/* Bottom-Right: 3D Volume & Camera Tip */}
                    <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none">
                      <div className={cn(
                        "bg-black/85 backdrop-blur-md border rounded-lg px-3 py-1.5 font-mono text-[11px] flex items-center gap-2 shadow-lg",
                        mathMetrics.isSingular ? "border-rose-500/40 text-rose-300" : "border-emerald-500/30 text-emerald-300"
                      )}>
                        <span className="text-white/60">Parallelepiped Volume:</span>
                        <span className="font-bold">|det(A)| = {Math.abs(mathMetrics.det).toFixed(2)}</span>
                        {mathMetrics.isSingular && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">
                            Collapsed (det=0)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-white/50 bg-black/60 px-2 py-0.5 rounded border border-white/10">
                        🖱️ Click & drag to orbit • Scroll to zoom
                      </div>
                    </div>
                  </>
                )}

                {/* 4D Overlay Badges */}
                {dim === 4 && (
                  <>
                    {/* Top-Left: 4D Basis Columns */}
                    <div className="absolute top-3 left-3 bg-black/85 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono pointer-events-none space-y-1 shadow-lg">
                      <div className="text-red-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block shadow-sm" />
                        Ae₁ = [{m4[0][0]}, {m4[1][0]}, {m4[2][0]}, {m4[3][0]}] (Col 1)
                      </div>
                      <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm" />
                        Ae₂ = [{m4[0][1]}, {m4[1][1]}, {m4[2][1]}, {m4[3][1]}] (Col 2)
                      </div>
                      <div className="text-blue-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block shadow-sm" />
                        Ae₃ = [{m4[0][2]}, {m4[1][2]}, {m4[2][2]}, {m4[3][2]}] (Col 3)
                      </div>
                      <div className="text-fuchsia-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-fuchsia-400 inline-block shadow-sm" />
                        Ae₄ = [{m4[0][3]}, {m4[1][3]}, {m4[2][3]}, {m4[3][3]}] (Col 4 - 4D)
                      </div>
                    </div>

                    {/* Top-Right: Camera Orbit Controls */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          yawRef.current = 0.65;
                          pitchRef.current = 0.40;
                          setZoom3D(58);
                          setRenderTick(t => t + 1);
                        }}
                        className="px-2 py-1 rounded-md bg-black/70 hover:bg-black/90 border border-white/15 text-white/80 hover:text-white text-[10px] font-mono cursor-pointer backdrop-blur-sm transition-all"
                        title="Reset 4D camera angle"
                      >
                        Reset Angle
                      </button>
                      <button
                        onClick={() => setAutoRotate3D(prev => !prev)}
                        className={cn(
                          "px-2 py-1 rounded-md border text-[10px] font-mono cursor-pointer backdrop-blur-sm transition-all flex items-center gap-1",
                          autoRotate3D
                            ? "bg-purple-600/30 border-purple-500/50 text-purple-300"
                            : "bg-black/70 hover:bg-black/90 border-white/15 text-white/80 hover:text-white"
                        )}
                      >
                        <RotateCcw className={cn("w-2.5 h-2.5", autoRotate3D && "animate-spin")} />
                        {autoRotate3D ? "Orbiting" : "Auto-Orbit"}
                      </button>
                    </div>

                    {/* Bottom-Right: 4D Hypervolume & Camera Tip */}
                    <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none">
                      <div className={cn(
                        "bg-black/85 backdrop-blur-md border rounded-lg px-3 py-1.5 font-mono text-[11px] flex items-center gap-2 shadow-lg",
                        mathMetrics.isSingular ? "border-rose-500/40 text-rose-300" : "border-fuchsia-500/40 text-fuchsia-300"
                      )}>
                        <span className="text-white/60">Tesseract Hypervolume:</span>
                        <span className="font-bold">|det(A)| = {Math.abs(mathMetrics.det).toFixed(2)}</span>
                        {mathMetrics.isSingular && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">
                            Collapsed (det=0)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-white/50 bg-black/60 px-2 py-0.5 rounded border border-white/10">
                        🔬 4D Tesseract • 16 Vertices · 32 Hyper-Edges • Drag to rotate
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 3D Test Vector Control Strip */}
              {dim === 3 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs font-mono">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white/60 text-[11px]">3D Test Vector v:</span>
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                      <span className="text-white/40">[</span>
                      <input
                        type="number"
                        step="0.5"
                        value={testVector3D[0]}
                        onChange={(e) => setTestVector3D([parseFloat(e.target.value) || 0, testVector3D[1], testVector3D[2]])}
                        className="w-9 text-center bg-transparent text-white font-bold text-xs focus:outline-none"
                      />
                      <span className="text-white/40">,</span>
                      <input
                        type="number"
                        step="0.5"
                        value={testVector3D[1]}
                        onChange={(e) => setTestVector3D([testVector3D[0], parseFloat(e.target.value) || 0, testVector3D[2]])}
                        className="w-9 text-center bg-transparent text-white font-bold text-xs focus:outline-none"
                      />
                      <span className="text-white/40">,</span>
                      <input
                        type="number"
                        step="0.5"
                        value={testVector3D[2]}
                        onChange={(e) => setTestVector3D([testVector3D[0], testVector3D[1], parseFloat(e.target.value) || 0])}
                        className="w-9 text-center bg-transparent text-white font-bold text-xs focus:outline-none"
                      />
                      <span className="text-white/40">]</span>
                    </div>
                    <span className="text-white/40 text-[11px]">→ Av:</span>
                    <span className="text-cyan-300 font-bold text-[11px]">
                      [{transformed3DVector[0].toFixed(1)}, {transformed3DVector[1].toFixed(1)}, {transformed3DVector[2].toFixed(1)}]
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/40 mr-1">Presets:</span>
                    <button
                      onClick={() => setTestVector3D([1, 1, 1])}
                      className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-white/70 cursor-pointer"
                    >
                      [1,1,1]
                    </button>
                    <button
                      onClick={() => setTestVector3D([1, 0, 0])}
                      className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-white/70 cursor-pointer"
                    >
                      [1,0,0]
                    </button>
                    <button
                      onClick={() => setTestVector3D([0, 1, 1])}
                      className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-white/70 cursor-pointer"
                    >
                      [0,1,1]
                    </button>
                    <button
                      onClick={() => setTestVector3D([2, -1, 1])}
                      className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-white/70 cursor-pointer"
                    >
                      [2,-1,1]
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Properties, Invariants & Inversion */}
          {activeTab === "properties" && (
            <div className="flex flex-col gap-4 font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Determinant Card */}
                <div className={cn(
                  "p-4 rounded-xl border flex flex-col gap-2",
                  isChalkboard ? "bg-[#091712] border-amber-900/30" : "bg-black/40 border-white/10"
                )}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                    Determinant Formula & Meaning
                  </span>
                  <div className="text-lg font-bold text-amber-300">
                    det(A) = {mathMetrics.det.toFixed(2)}
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed font-sans">
                    {dim === 2 ? (
                      <>Calculated as <code className="bg-white/10 px-1 py-0.5 rounded text-amber-200">ad - bc</code> = ({m2[0][0]}·{m2[1][1]}) - ({m2[0][1]}·{m2[1][0]}).</>
                    ) : (
                      <>Calculated via cofactor expansion along the first row.</>
                    )}
                    {" "}
                    {mathMetrics.isSingular
                      ? "The determinant is zero, meaning space collapses by at least one dimension and volume/area becomes 0. Matrix is non-invertible."
                      : `Space is scaled by a factor of ${Math.abs(mathMetrics.det).toFixed(2)}. ${mathMetrics.det < 0 ? "Orientation is reversed (reflection)." : "Orientation is preserved."}`}
                  </p>
                </div>

                {/* Eigenvalues Card */}
                <div className={cn(
                  "p-4 rounded-xl border flex flex-col gap-2",
                  isChalkboard ? "bg-[#091712] border-amber-900/30" : "bg-black/40 border-white/10"
                )}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                    Eigenvalues (Characteristic Roots)
                  </span>
                  {dim === 2 ? (
                    <>
                      <div className="text-sm font-bold text-emerald-300">
                        λ₁ = {mathMetrics.eigenvalues.lambda1}
                      </div>
                      <div className="text-sm font-bold text-emerald-300">
                        λ₂ = {mathMetrics.eigenvalues.lambda2}
                      </div>
                      <p className="text-xs text-white/70 font-sans">
                        Roots of characteristic polynomial <code className="bg-white/10 px-1 py-0.5 rounded text-emerald-200">λ² - Tr(A)λ + det(A) = 0</code>.
                        {mathMetrics.eigenvalues.isReal
                          ? " Both eigenvalues are real numbers. Vectors along the eigenvector axes are only scaled, not rotated!"
                          : " Roots are complex conjugates, indicating rotational behavior without invariant real axes."}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-white/70 font-sans">
                      Trace Tr(A) = {mathMetrics.trace}. Click "Solve Eigenvalues" below to compute exact roots with step-by-step scholar proofs.
                    </p>
                  )}
                </div>
              </div>

              {/* Inverse Matrix Card */}
              <div className={cn(
                "p-4 rounded-xl border flex flex-col gap-2",
                isChalkboard ? "bg-[#091712] border-amber-900/30" : "bg-black/40 border-white/10"
              )}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Inverse Matrix A⁻¹
                </span>
                {mathMetrics.inverse ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-2">
                    <div className="text-xs text-white/70 font-sans">
                      {dim === 2 ? (
                        <>Formula: <code className="bg-white/10 px-1.5 py-0.5 rounded">1/det(A) · [d, -b; -c, a]</code></>
                      ) : (
                        <>Formula: <code className="bg-white/10 px-1.5 py-0.5 rounded">1/det(A) · Adj(A)</code></>
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-mono text-sm text-cyan-300 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
                      <span>[</span>
                      <div
                        className="grid gap-x-3 text-center"
                        style={{ gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))` }}
                      >
                        {mathMetrics.inverse.map((row, r) =>
                          row.map((val, c) => (
                            <span key={`${r}-${c}`}>{parseFloat(val.toFixed(2))}</span>
                          ))
                        )}
                      </div>
                      <span>]</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-xs font-sans">
                    {mathMetrics.isSingular
                      ? "Matrix A is SINGULAR (det = 0). It has no inverse because it cannot be reversed (space collapses by at least one dimension)."
                      : "Inverse matrix calculation ready."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Gauss-Jordan RREF Steps */}
          {activeTab === "rref" && (
            <div className="flex flex-col gap-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                  Gauss-Jordan Elimination Steps
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {rrefSteps.length} Operations
                </span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {rrefSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all",
                      idx === rrefSteps.length - 1
                        ? (isChalkboard ? "bg-[#142e20] border-amber-500/40" : "bg-emerald-950/30 border-emerald-500/40")
                        : "bg-black/30 border-white/10"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                          {idx + 1}
                        </span>
                        <span className={cn(
                          "font-bold",
                          idx === rrefSteps.length - 1 ? "text-emerald-300" : "text-white/80"
                        )}>
                          {step.description}
                        </span>
                      </div>
                    </div>

                    {/* Matrix display for step */}
                    <div className="flex items-center gap-1 font-mono text-xs bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg ml-auto sm:ml-0">
                      <span>[</span>
                      <div
                        className="grid gap-x-2 text-center"
                        style={{ gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))` }}
                      >
                        {step.matrix.map((row, r) =>
                          row.map((val, c) => (
                            <span key={`${r}-${c}`} className={val !== 0 ? "text-white font-bold" : "text-white/40"}>
                              {parseFloat(val.toFixed(2))}
                            </span>
                          ))
                        )}
                      </div>
                      <span>]</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KineticMatrix;
