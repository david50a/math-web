export interface SceneAnnotation {
  type: "circle" | "line" | "arrow" | "text" | string;
  label: string;
  coordinates: number[]; // [x, y] for circle, [x1, y1, x2, y2] for line
}

export interface GraphData {
  showGraph: boolean;
  functionExpr?: string;
  functionLabel?: string;
  roots?: number[];
  intercepts?: string[];
  vertex?: {
    x: number;
    y: number;
  };
  viewPort?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface VideoScene {
  sceneNumber: number;
  title: string;
  subTitle: string;
  explanation: string;
  primaryMath: string;
  secondaryMath: string;
  graphData: GraphData;
  annotations?: SceneAnnotation[];
}

export interface EquationSolution {
  equation: string;
  equationType: string;
  summary: string;
  finalAnswer: string;
  scenes: VideoScene[];
  demoMode?: boolean;
  needsKey?: boolean;
}

export type ThemeType = 
  | "chalkboard" 
  | "blueprint" 
  | "glassmorphic" 
  | "darkroom" 
  | "cyberpunk" 
  | "sunset" 
  | "synthwave" 
  | "nordic" 
  | "matrix" 
  | "royal";
export type NarratorType = "natural" | "assistant" | "cyborg" | "mute";

