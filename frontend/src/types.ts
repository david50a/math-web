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

// ============================================================================
// GEOMETRY SOLVER PIPELINE TYPES
// ============================================================================

export interface GeometricPoint {
  name: string;
  x: number;
  y: number;
  label: string;
  color?: string;
  highlight?: boolean;
}

export interface GeometricSegment {
  start: string;
  end: string;
  length_label?: string;
  is_dashed?: boolean;
  is_construction?: boolean;
  color?: string;
  stroke_width?: number;
}

export interface GeometricAngle {
  vertex: string;
  p1: string;
  p2: string;
  label: string;
  degrees?: number;
  is_right_angle?: boolean;
  color?: string;
}

export interface GeometricPolygon {
  name: string;
  vertices: string[];
  fill_color?: string;
  stroke_color?: string;
}

export interface GeometricCircle {
  center: [number, number];
  center_name?: string;
  radius: number;
  label: string;
  is_incircle?: boolean;
  color?: string;
  fill_color?: string;
}

export interface GeometricVector {
  start: string;
  end: string;
  label: string;
  components?: number[];
  color?: string;
  stroke_width?: number;
  is_dashed?: boolean;
}

export interface ComplexNumberPoint {
  name: string;
  real: number;
  imag: number;
  polar_r: number;
  polar_theta_deg: number;
  label: string;
  color?: string;
}

export interface DiagramData {
  title: string;
  viewbox: {
    min_x: number;
    min_y: number;
    width: number;
    height: number;
  };
  points: GeometricPoint[];
  segments: GeometricSegment[];
  polygons: GeometricPolygon[];
  circles: GeometricCircle[];
  angles: GeometricAngle[];
  vectors?: GeometricVector[];
  complex_points?: ComplexNumberPoint[];
  annotations: string[];
}

export interface GeometryProofStep {
  step_num: number;
  part: string;
  claim: string;
  latex: string;
  justification: string;
  theorem?: string;
  figure_highlight?: string[];
}

export interface GeometrySubQuestion {
  part_id: string;
  title: string;
  prompt: string;
  answer_latex: string;
  answer_summary: string;
  steps: GeometryProofStep[];
}

export interface GeometryProblemModel {
  raw_question: string;
  title: string;
  shape_type: string;
  given_facts: string[];
  target_questions: Array<{ part_id: string; prompt: string }>;
  symbols: Record<string, string>;
}

export interface GeometryValidationResult {
  is_valid: boolean;
  checks: Array<{ name: string; status: string; detail: string }>;
  warnings: string[];
}

export interface GeometryTeacherInsights {
  conceptual_overview: string;
  socratic_prompts: string[];
  key_theorems: string[];
  common_mistakes: string[];
  exam_tips: string[];
}

export interface GeometrySolveResponse {
  problem_model: GeometryProblemModel;
  diagram: DiagramData;
  parts: GeometrySubQuestion[];
  all_steps: GeometryProofStep[];
  validation: GeometryValidationResult;
  teacher: GeometryTeacherInsights;
  execution_time_ms: number;
}

export interface GeometryPreset {
  id: string;
  category: string;
  title: string;
  question: string;
  difficulty: string;
  tags: string[];
}

export interface ComplexNumberData {
  label: string;
  real: number;
  imag: number;
  modulus: number;
  argument_rad: number;
  argument_deg: number;
  angle_display: string;
  cartesian_latex: string;
  polar_latex: string;
  exponential_latex: string;
  cis_latex: string;
  conjugate: {
    real: number;
    imag: number;
    cartesian_latex: string;
  };
}

export interface ComplexSolveStep {
  stepTitle: string;
  latex: string;
  description: string;
}

export interface ComplexPlotPoint {
  label: string;
  real: number;
  imag: number;
  color?: string;
}

export interface ComplexSolveResult {
  operation: string;
  summary: string;
  final_answer: string;
  primary?: ComplexNumberData;
  secondary?: ComplexNumberData;
  result?: ComplexNumberData;
  roots?: ComplexNumberData[];
  power_n?: number;
  root_n?: number;
  root_radius?: number;
  steps: ComplexSolveStep[];
  plot_points?: ComplexPlotPoint[];
}

export interface ComplexPreset {
  id: string;
  title: string;
  category: string;
  description: string;
  op: string;
  z1: string;
  z2?: string;
  n?: number;
}

export interface VectorDetails {
  label: string;
  dimension: number;
  components: number[];
  magnitude: number;
  magnitude_squared: number;
  unit_vector: number[];
  latex: string;
  unit_form: string;
  unit_vector_latex: string;
  direction_cosines?: number[];
  direction_angles_deg?: number[];
}

export interface VectorSolveStep {
  stepTitle: string;
  latex: string;
  description: string;
}

export interface VectorSolveResult {
  operation: string;
  dimension?: number;
  summary: string;
  final_answer: string;
  primary?: VectorDetails;
  secondary?: VectorDetails;
  tertiary?: VectorDetails;
  result?: VectorDetails;
  cross_vector?: VectorDetails;
  projection_vector?: VectorDetails;
  rejection_vector?: VectorDetails;
  dot_product?: number;
  angle_deg?: number;
  angle_rad?: number;
  cos_theta?: number;
  is_orthogonal?: boolean;
  parallelogram_area?: number;
  triangle_area?: number;
  triple_product?: number;
  volume?: number;
  is_coplanar?: boolean;
  plane_latex?: string;
  steps: VectorSolveStep[];
  vectors?: VectorDetails[];
}

export interface VectorPreset {
  id: string;
  title: string;
  category: string;
  description: string;
  op: string;
  u: string;
  v?: string;
  w?: string;
  scalar_c?: number;
}

