from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class GeometrySolveRequest(BaseModel):
    question: str
    api_key: Optional[str] = None
    detail_level: Optional[str] = "full"

class GeometricPoint(BaseModel):
    name: str
    x: float
    y: float
    label: str
    color: Optional[str] = "#38bdf8"
    highlight: Optional[bool] = False

class GeometricSegment(BaseModel):
    start: str
    end: str
    length_label: Optional[str] = None
    is_dashed: bool = False
    is_construction: bool = False
    color: Optional[str] = "#94a3b8"
    stroke_width: Optional[float] = 2.0

class GeometricAngle(BaseModel):
    vertex: str
    p1: str
    p2: str
    label: str
    degrees: Optional[float] = None
    is_right_angle: bool = False
    color: Optional[str] = "#fbbf24"

class GeometricPolygon(BaseModel):
    name: str
    vertices: List[str]
    fill_color: Optional[str] = "rgba(56, 189, 248, 0.08)"
    stroke_color: Optional[str] = "#38bdf8"

class GeometricCircle(BaseModel):
    center: List[float]
    center_name: Optional[str] = "I"
    radius: float
    label: str = "Incircle"
    is_incircle: bool = True
    color: Optional[str] = "#ec4899"
    fill_color: Optional[str] = "rgba(236, 72, 153, 0.08)"

class GeometricVector(BaseModel):
    start: str
    end: str
    label: str
    components: Optional[List[float]] = None
    color: Optional[str] = "#10b981"
    stroke_width: Optional[float] = 2.5
    is_dashed: bool = False

class ComplexNumberPoint(BaseModel):
    name: str
    real: float
    imag: float
    polar_r: float
    polar_theta_deg: float
    label: str
    color: Optional[str] = "#38bdf8"

class DiagramData(BaseModel):
    title: str = "Geometric Figure"
    viewbox: Dict[str, float] = Field(default_factory=lambda: {"min_x": -20, "min_y": -20, "width": 140, "height": 140})
    points: List[GeometricPoint] = Field(default_factory=list)
    segments: List[GeometricSegment] = Field(default_factory=list)
    polygons: List[GeometricPolygon] = Field(default_factory=list)
    circles: List[GeometricCircle] = Field(default_factory=list)
    angles: List[GeometricAngle] = Field(default_factory=list)
    vectors: List[GeometricVector] = Field(default_factory=list)
    complex_points: List[ComplexNumberPoint] = Field(default_factory=list)
    annotations: List[str] = Field(default_factory=list)

class ProofStep(BaseModel):
    step_num: int
    part: str
    claim: str
    latex: str
    justification: str
    theorem: Optional[str] = None
    figure_highlight: Optional[List[str]] = None

class SubQuestionSolution(BaseModel):
    part_id: str
    title: str
    prompt: str
    answer_latex: str
    answer_summary: str
    steps: List[ProofStep] = Field(default_factory=list)

class GeometryProblemModel(BaseModel):
    raw_question: str
    title: str
    shape_type: str
    given_facts: List[str] = Field(default_factory=list)
    target_questions: List[Dict[str, str]] = Field(default_factory=list)
    symbols: Dict[str, str] = Field(default_factory=dict)

class ValidationResult(BaseModel):
    is_valid: bool = True
    checks: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

class TeacherInsights(BaseModel):
    conceptual_overview: str
    socratic_prompts: List[str] = Field(default_factory=list)
    key_theorems: List[str] = Field(default_factory=list)
    common_mistakes: List[str] = Field(default_factory=list)
    exam_tips: List[str] = Field(default_factory=list)

class GeometrySolveResponse(BaseModel):
    problem_model: GeometryProblemModel
    diagram: DiagramData
    parts: List[SubQuestionSolution]
    all_steps: List[ProofStep]
    validation: ValidationResult
    teacher: TeacherInsights
    execution_time_ms: float

class TeacherAskRequest(BaseModel):
    question: str
    context_problem: str
    student_query: str
    part_id: Optional[str] = None
    api_key: Optional[str] = None

class TeacherAskResponse(BaseModel):
    reply: str
    hints: List[str] = Field(default_factory=list)
    suggested_next_steps: List[str] = Field(default_factory=list)
