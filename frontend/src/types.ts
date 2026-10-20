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

export interface FunctionExtremum {
  x: number;
  y: number;
  type: "local_max" | "local_min" | "saddle";
  label: string;
  x_latex: string;
  y_latex: string;
  test_value: number;
}

export interface FunctionRoot {
  x: number;
  latex: string;
  exact: string;
}

export interface FunctionInflection {
  x: number;
  y: number;
  x_latex: string;
  y_latex: string;
}

export interface FunctionAsymptotes {
  vertical: Array<{ x: number; latex: string }>;
  horizontal: Array<{ y: number; latex: string }>;
  oblique: Array<{ m: number; b: number; latex: string; expr: string }>;
}

export interface FunctionStepItem {
  description: string;
  latex: string;
}

export interface FunctionAnalysisStep {
  title: string;
  latex: string;
  explanation: string;
  category?: "general" | "derivative" | "extrema" | "roots" | "inflection" | "integral" | string;
}

export interface FunctionAnalysisResult {
  expression: string;
  latex: string;
  derivative_latex: string;
  derivative_expr: string;
  second_derivative_latex: string;
  second_derivative_expr: string;
  integral_latex: string;
  integral_expr: string;
  domain: string;
  y_intercept?: { x: number; y: number; latex: string } | null;
  roots: FunctionRoot[];
  extrema: FunctionExtremum[];
  inflection_points: FunctionInflection[];
  asymptotes: FunctionAsymptotes;
  symmetry: string;
  monotonicity: {
    increasing: string[];
    decreasing: string[];
  };
  derivative_steps?: FunctionStepItem[];
  critical_points_steps?: FunctionStepItem[];
  roots_steps?: FunctionStepItem[];
  extrema_steps?: FunctionStepItem[];
  inflection_steps?: FunctionStepItem[];
  integral_steps?: FunctionStepItem[];
  step_by_step: FunctionAnalysisStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PROOF ENGINE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ProofStep {
  step_number: number;
  title: string;
  latex: string;
  justification: string;
  rule_name?: string;
  sub_steps?: string[];
  status?: "valid" | "verified" | "assumption" | "conclusion" | "invalid";
}

export interface TruthTableRow {
  variables: Record<string, boolean>;
  intermediate: Record<string, boolean>;
  lhs: boolean;
  rhs: boolean;
  equivalent: boolean;
}

export interface TruthTableData {
  headers: string[];
  rows: TruthTableRow[];
  isTautology: boolean;
}

export interface InductionProofData {
  base_case: {
    n_val: number;
    lhs_val: string;
    rhs_val: string;
    lhs_latex: string;
    rhs_latex: string;
    is_valid: boolean;
    explanation: string;
  };
  hypothesis: {
    k_statement: string;
    k_latex: string;
    explanation: string;
  };
  inductive_step: {
    target_latex: string;
    steps: ProofStep[];
    conclusion_latex: string;
  };
  summary: string;
}

export interface ProofResult {
  statement: string;
  latex_statement: string;
  is_valid: boolean;
  proof_type: "induction" | "identity" | "trig_identity" | "algebraic_identity" | "contradiction" | "calculus" | "logic" | "inequality" | "custom" | string;
  proof_type_label: string;
  summary: string;
  formal_steps: ProofStep[];
  qed_symbol: string;
  confidence: number;
  induction_data?: InductionProofData;
  truth_table?: TruthTableData;
  alternate_proofs?: Array<{
    name: string;
    description: string;
    steps: ProofStep[];
  }>;
  assumptions?: string[];
  lemmas_used?: string[];
  execution_time_ms: number;
}

export interface ProofPreset {
  id: string;
  category: "Induction" | "Identities" | "Contradiction" | "Calculus Theorems" | "Propositional Logic" | string;
  title: string;
  statement: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Olympiad" | string;
  description: string;
  tags: string[];
}

export interface StepVerificationResult {
  is_valid: boolean;
  rule_name: string;
  latex_current?: string;
  latex_next?: string;
  difference_latex?: string;
  target_reached?: boolean;
  feedback: string;
}
