import time
from typing import Optional
from .models import GeometrySolveResponse
from .nlp_parser import parse_geometry_question
from .solver_engine import solve_generic_geometry_problem
from .diagram_builder import build_diagram_for_problem
from .validator import validate_geometry_solution
from .explainer import generate_teacher_insights

async def run_geometry_pipeline(question: str, api_key: Optional[str] = None) -> GeometrySolveResponse:
    """
    Executes the complete geometry pipeline:
    React Frontend -> FastAPI Backend -> Natural Language Parser -> Geometry Problem Model
    -> Diagram Builder & Solver Engine -> Validation Engine -> Solution Explanation -> Structured JSON.
    """
    start_time = time.perf_counter()

    # 1. Natural Language Parser -> Geometry Problem Model
    problem_model = await parse_geometry_question(question, api_key=api_key)

    # 2. Solver Engine -> Calculations & Proof Steps
    parts, all_steps, calc_context = solve_generic_geometry_problem(problem_model)

    # 3. Diagram Builder -> SVG Primitives & Coordinates
    diagram = build_diagram_for_problem(problem_model, calc_context)

    # 4. Validation Engine -> Checks & Consistency
    validation = validate_geometry_solution(calc_context, all_steps)

    # 5. Solution Explanation -> Teacher Insights & Socratic Dialogue
    teacher = generate_teacher_insights(problem_model, calc_context)

    execution_time = (time.perf_counter() - start_time) * 1000.0

    return GeometrySolveResponse(
        problem_model=problem_model,
        diagram=diagram,
        parts=parts,
        all_steps=all_steps,
        validation=validation,
        teacher=teacher,
        execution_time_ms=round(execution_time, 2)
    )
