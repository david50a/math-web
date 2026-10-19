from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field

class Entity(BaseModel):
    name: str
    category: str = "general"  # actor, object, geometric_shape, agent
    properties: Dict[str, Any] = Field(default_factory=dict)

class ProblemVariable(BaseModel):
    symbol: str
    name: str
    value: Optional[float] = None
    unit: Optional[str] = None
    is_target: bool = False
    description: str = ""

class ConstraintEquation(BaseModel):
    raw_statement: str
    equation_formula: str  # e.g., "d1 == d2", "2*l + 2*w == 54"
    latex: Optional[str] = None
    explanation: str = ""

class StructuredProblemModel(BaseModel):
    problem_text: str
    category: str
    subcategory: str
    difficulty: str = "Intermediate"
    entities: List[Entity] = Field(default_factory=list)
    variables: List[ProblemVariable] = Field(default_factory=list)
    target_variables: List[str] = Field(default_factory=list)
    constraints: List[ConstraintEquation] = Field(default_factory=list)
    domain_assumptions: List[str] = Field(default_factory=list)

class ValidationCheck(BaseModel):
    name: str
    passed: bool
    message: str

class ValidationResult(BaseModel):
    is_valid: bool
    status: str  # "VALID", "WARNING", "INVALID"
    degrees_of_freedom: int
    checks: List[ValidationCheck] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)

class MathematicalModel(BaseModel):
    target_engine: str  # "algebra", "geometry", "trigonometry", "linear_algebra", "calculus"
    primary_equation: str  # e.g., "60*(t+2) = 90*t" or "-w^2 + 27*w - 180 = 0"
    equations: List[str] = Field(default_factory=list)
    unknowns: List[str] = Field(default_factory=list)
    latex_form: str
    engine_call_spec: Dict[str, Any] = Field(default_factory=dict)

class MathStepDetail(BaseModel):
    step_number: int
    title: str
    latex: str
    explanation: str
    rule: Optional[str] = None

class EngineExecutionResult(BaseModel):
    raw_solution: Any
    solution_values: Dict[str, float]
    intermediate_steps: List[MathStepDetail] = Field(default_factory=list)
    engine_name: str
    success: bool
    error_message: Optional[str] = None

class VerificationCheck(BaseModel):
    equation: str
    lhs_val: float
    rhs_val: float
    residual: float
    satisfied: bool
    explanation: str

class VerificationResult(BaseModel):
    status: str  # "VERIFIED", "PARTIALLY_VERIFIED", "FAILED"
    is_verified: bool
    checks: List[VerificationCheck] = Field(default_factory=list)
    discarded_extraneous_roots: List[str] = Field(default_factory=list)
    domain_sanity_passed: bool
    notes: List[str] = Field(default_factory=list)

class StageTrace(BaseModel):
    stage_id: str
    stage_name: str
    status: str  # "completed", "skipped", "error"
    execution_time_ms: float
    summary: str
    details: Dict[str, Any] = Field(default_factory=dict)

class SubtitleItem(BaseModel):
    start_sec: float
    end_sec: float
    text: str

class EquationBuildingStep(BaseModel):
    source_phrase: str
    concept: str
    math_translation: str
    latex: str
    explanation: str

class VideoScene(BaseModel):
    scene_id: str  # "situation", "model_setup", "solving", "conclusion"
    title: str
    phase_label: str  # e.g., "1. The Real-World Situation"
    start_time_sec: float
    duration_sec: float
    narration: str
    subtitles: List[SubtitleItem] = Field(default_factory=list)
    visual_type: str  # "motion_race", "geometry_pythagorean", "geometry_rectangle", "work_rate", "linear_balance", "generic"
    visual_params: Dict[str, Any] = Field(default_factory=dict)
    latex_callout: Optional[str] = None
    step_details: Optional[List[Dict[str, Any]]] = None
    equation_building_steps: Optional[List[EquationBuildingStep]] = None

class VideoScript(BaseModel):
    title: str
    total_duration_sec: float
    scenes: List[VideoScene] = Field(default_factory=list)
    category: str
    subcategory: str
    equation_building_steps: List[EquationBuildingStep] = Field(default_factory=list)


class WordProblemPipelineResponse(BaseModel):
    success: bool
    original_question: str
    final_answer: str
    final_answer_latex: str
    final_answer_units: Optional[str] = None
    target_variable: str
    numeric_value: Optional[float] = None
    all_values: Dict[str, float] = Field(default_factory=dict)
    
    # Architecture Stages Data
    nlu_output: Dict[str, Any]
    classification: Dict[str, Any]
    structured_model: StructuredProblemModel
    validation: ValidationResult
    mathematical_model: MathematicalModel
    engine_result: EngineExecutionResult
    verification: VerificationResult
    explanation_steps: List[MathStepDetail]
    real_world_conclusion: str
    
    # Video Explainer Storyboard
    video_script: Optional[VideoScript] = None

    # Live Pipeline Execution Trace
    pipeline_trace: List[StageTrace]
    total_execution_time_ms: float

