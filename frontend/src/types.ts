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

export interface MethodStep {
  stepTitle: string;
  description: string;
  latex: string;
}

export interface MethodSolution {
  methodId: string;
  methodName: string;
  badgeTag: string;
  techniqueSummary: string;
  formulaLatex: string;
  steps: MethodStep[];
  finalResultLatex: string;
  prosAndCons: {
    pros: string;
    cons: string;
  };
}

export interface EquationSolution {
  equation: string;
  equationType: string;
  summary: string;
  finalAnswer: string;
  scenes: VideoScene[];
  methods?: MethodSolution[];
  demoMode?: boolean;
  needsKey?: boolean;
}

export type ThemeType = 
  | "blueprint" 
  | "chalkboard" 
  | "cosmos"
  | "lightAcademic"
  | "darkAI"
  | "notebook"
  | "glassmorphic" 
  | "darkroom" 
  | "cyberpunk" 
  | "sunset" 
  | "synthwave" 
  | "nordic" 
  | "matrix" 
  | "royal";
export type NarratorType = "natural" | "assistant" | "cyborg" | "mute";

export interface WordProblemEntity {
  name: string;
  category: string;
  properties?: Record<string, any>;
}

export interface WordProblemVariable {
  symbol: string;
  name: string;
  value?: number | null;
  unit?: string | null;
  is_target: boolean;
  description: string;
}

export interface WordProblemConstraint {
  raw_statement: string;
  equation_formula: string;
  latex?: string;
  explanation: string;
}

export interface StructuredProblemModel {
  problem_text: string;
  category: string;
  subcategory: string;
  difficulty: string;
  entities: WordProblemEntity[];
  variables: WordProblemVariable[];
  target_variables: string[];
  constraints: WordProblemConstraint[];
  domain_assumptions: string[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface ValidationResult {
  is_valid: boolean;
  status: "VALID" | "WARNING" | "INVALID";
  degrees_of_freedom: number;
  checks: ValidationCheck[];
  warnings: string[];
  errors: string[];
}

export interface MathematicalModel {
  target_engine: string;
  primary_equation: string;
  equations: string[];
  unknowns: string[];
  latex_form: string;
  engine_call_spec: Record<string, any>;
}

export interface WordProblemMathStep {
  step_number: number;
  title: string;
  latex: string;
  explanation: string;
  rule?: string;
}

export interface EngineExecutionResult {
  raw_solution: any;
  solution_values: Record<string, number>;
  intermediate_steps: WordProblemMathStep[];
  engine_name: string;
  success: boolean;
  error_message?: string | null;
}

export interface VerificationCheck {
  equation: string;
  lhs_val: number;
  rhs_val: number;
  residual: number;
  satisfied: boolean;
  explanation: string;
}

export interface VerificationResult {
  status: "VERIFIED" | "PARTIALLY_VERIFIED" | "FAILED";
  is_verified: boolean;
  checks: VerificationCheck[];
  discarded_extraneous_roots: string[];
  domain_sanity_passed: boolean;
  notes: string[];
}

export interface StageTrace {
  stage_id: string;
  stage_name: string;
  status: "completed" | "skipped" | "error" | "warning";
  execution_time_ms: number;
  summary: string;
  details: Record<string, any>;
}

export interface SubtitleItem {
  start_sec: number;
  end_sec: number;
  text: string;
}

export interface EquationBuildingStep {
  source_phrase: string;
  concept: string;
  math_translation: string;
  latex: string;
  explanation: string;
}

export interface VideoScene {
  scene_id: "situation" | "model_setup" | "solving" | "conclusion" | string;
  title: string;
  phase_label: string;
  start_time_sec: number;
  duration_sec: number;
  narration: string;
  subtitles: SubtitleItem[];
  visual_type: "motion_race" | "geometry_pythagorean" | "geometry_rectangle" | "work_rate" | "linear_balance" | "generic" | string;
  visual_params: Record<string, any>;
  latex_callout?: string | null;
  step_details?: Array<{ latex: string; rule: string }>;
  equation_building_steps?: EquationBuildingStep[];
}

export interface VideoScript {
  title: string;
  total_duration_sec: number;
  scenes: VideoScene[];
  category: string;
  subcategory: string;
  equation_building_steps: EquationBuildingStep[];
}


export interface WordProblemPipelineResponse {
  success: boolean;
  original_question: string;
  final_answer: string;
  final_answer_latex: string;
  final_answer_units?: string | null;
  target_variable: string;
  numeric_value?: number | null;
  all_values: Record<string, number>;
  nlu_output: Record<string, any>;
  classification: Record<string, any>;
  structured_model: StructuredProblemModel;
  validation: ValidationResult;
  mathematical_model: MathematicalModel;
  engine_result: EngineExecutionResult;
  verification: VerificationResult;
  explanation_steps: WordProblemMathStep[];
  real_world_conclusion: string;
  video_script?: VideoScript;
  pipeline_trace: StageTrace[];
  total_execution_time_ms: number;
}


export interface WordProblemPreset {
  id: string;
  category: string;
  title: string;
  question: string;
  difficulty: string;
  tag: string;
}


