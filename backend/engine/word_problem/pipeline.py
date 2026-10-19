import time
from typing import Dict, Any, List
from .models import (
    WordProblemPipelineResponse,
    StageTrace,
    ValidationResult
)
from .nlu import understand_natural_language
from .classifier import classify_problem
from .structured_model import build_structured_model
from .validator import validate_model
from .math_builder import build_mathematical_model
from .engine_adapter import execute_math_engine
from .verifier import verify_solution
from .explainer import build_step_by_step_explanation
from .video_generator import generate_video_script

async def run_word_problem_pipeline(question: str) -> WordProblemPipelineResponse:
    """
    Orchestrates the entire 8-stage architecture:
      1. Natural Language Understanding (Local LLM + Rules)
      2. Problem Classification
      3. Structured Problem Model
      4. Model Validation
      5. Mathematical Model Builder
      6. YOUR MATH ENGINE
      7. Solution Verification
      8. Step-by-Step Explanation
    """
    total_start = time.perf_counter()
    pipeline_traces: List[StageTrace] = []

    # -------------------------------------------------------------
    # Stage 1: Natural Language Understanding (Local LLM + Rules)
    # -------------------------------------------------------------
    t0 = time.perf_counter()
    nlu_result = await understand_natural_language(question)
    nlu_time = (time.perf_counter() - t0) * 1000.0
    pipeline_traces.append(StageTrace(
        stage_id="nlu",
        stage_name="Natural Language Understanding (Local LLM + Rules)",
        status="completed",
        execution_time_ms=round(nlu_time, 2),
        summary=f"Extracted {len(nlu_result.entities)} entities and {len(nlu_result.quantities)} numerical quantities. Enhanced by LLM: {nlu_result.llm_enhanced}.",
        details=nlu_result.to_dict()
    ))

    # -------------------------------------------------------------
    # Stage 2: Problem Classification
    # -------------------------------------------------------------
    t0 = time.perf_counter()
    classification = classify_problem(nlu_result)
    class_time = (time.perf_counter() - t0) * 1000.0
    pipeline_traces.append(StageTrace(
        stage_id="classification",
        stage_name="Problem Classification",
        status="completed",
        execution_time_ms=round(class_time, 2),
        summary=f"Classified as '{classification.display_name}' ({classification.difficulty} difficulty, {classification.confidence*100:.0f}% confidence).",
        details=classification.to_dict()
    ))

    # -------------------------------------------------------------
    # Stage 3: Structured Problem Model
    # -------------------------------------------------------------
    t0 = time.perf_counter()
    structured_model = build_structured_model(nlu_result, classification)
    struct_time = (time.perf_counter() - t0) * 1000.0
    pipeline_traces.append(StageTrace(
        stage_id="structured_model",
        stage_name="Structured Problem Model",
        status="completed",
        execution_time_ms=round(struct_time, 2),
        summary=f"Constructed canonical schema with {len(structured_model.variables)} variables and {len(structured_model.constraints)} constraint equations.",
        details=structured_model.model_dump()
    ))

    # -------------------------------------------------------------
    # Stage 4: Model Validation
    # -------------------------------------------------------------
    t0 = time.perf_counter()
    validation = validate_model(structured_model)
    valid_time = (time.perf_counter() - t0) * 1000.0
    pipeline_traces.append(StageTrace(
        stage_id="validation",
        stage_name="Model Validation",
        status="completed" if validation.is_valid else "warning",
        execution_time_ms=round(valid_time, 2),
        summary=f"Status: {validation.status}. Degrees of Freedom = {validation.degrees_of_freedom}. {len(validation.checks)} check(s) passed.",
        details=validation.model_dump()
    ))

    # -------------------------------------------------------------
    # Stage 5: Mathematical Model Builder
    # -------------------------------------------------------------
    t0 = time.perf_counter()
    math_model = build_mathematical_model(structured_model)
    math_time = (time.perf_counter() - t0) * 1000.0
    pipeline_traces.append(StageTrace(
        stage_id="math_builder",
        stage_name="Mathematical Model Builder",
        status="completed",
        execution_time_ms=round(math_time, 2),
        summary=f"Built formal equation for {math_model.target_engine}: {math_model.primary_equation}",
        details=math_model.model_dump()
    ))

    # -------------------------------------------------------------
    # Stage 6: YOUR MATH ENGINE
    # -------------------------------------------------------------
    t0 = time.perf_counter()
    engine_result = execute_math_engine(math_model)
    engine_time = (time.perf_counter() - t0) * 1000.0
    pipeline_traces.append(StageTrace(
        stage_id="engine",
        stage_name="YOUR MATH ENGINE",
        status="completed" if engine_result.success else "error",
        execution_time_ms=round(engine_time, 2),
        summary=f"Engine '{engine_result.engine_name}' computed: {engine_result.solution_values} with {len(engine_result.intermediate_steps)} intermediate step(s).",
        details=engine_result.model_dump()
    ))

    # -------------------------------------------------------------
    # Stage 7: Solution Verification
    # -------------------------------------------------------------
    t0 = time.perf_counter()
    verification = verify_solution(structured_model, engine_result)
    verif_time = (time.perf_counter() - t0) * 1000.0
    pipeline_traces.append(StageTrace(
        stage_id="verification",
        stage_name="Solution Verification",
        status="completed" if verification.is_verified else "warning",
        execution_time_ms=round(verif_time, 2),
        summary=f"Status: {verification.status}. Checked {len(verification.checks)} constraint(s). Domain sanity: {verification.domain_sanity_passed}.",
        details=verification.model_dump()
    ))

    # -------------------------------------------------------------
    # Stage 8: Step-by-Step Explanation
    # -------------------------------------------------------------
    # -------------------------------------------------------------
    t0 = time.perf_counter()
    steps, final_ans, final_ans_latex, conclusion, final_units = build_step_by_step_explanation(
        structured_model,
        math_model,
        engine_result,
        verification
    )
    expl_time = (time.perf_counter() - t0) * 1000.0
    pipeline_traces.append(StageTrace(
        stage_id="explanation",
        stage_name="Step-by-Step Explanation",
        status="completed",
        execution_time_ms=round(expl_time, 2),
        summary=f"Synthesized {len(steps)} pedagogical step(s) with LaTeX, units ({final_units or 'unitless'}), and conclusion.",
        details={"steps_count": len(steps), "final_answer": final_ans, "final_units": final_units}
    ))

    # -------------------------------------------------------------
    # Stage 9: Video Explainer Storyboard
    # -------------------------------------------------------------
    t0 = time.perf_counter()
    video_script = generate_video_script(
        structured_model,
        math_model,
        engine_result,
        verification,
        steps,
        conclusion,
        question
    )
    video_time = (time.perf_counter() - t0) * 1000.0
    pipeline_traces.append(StageTrace(
        stage_id="video_explainer",
        stage_name="Animated Video Storyboard & Scenario Simulation",
        status="completed",
        execution_time_ms=round(video_time, 2),
        summary=f"Generated {len(video_script.scenes)} video scenes with physical parameters, synchronized subtitles, and audio narration.",
        details={"scene_count": len(video_script.scenes), "total_duration": video_script.total_duration_sec}
    ))

    total_time = (time.perf_counter() - total_start) * 1000.0

    primary_target = structured_model.target_variables[0] if structured_model.target_variables else "x"
    numeric_val = engine_result.solution_values.get(primary_target)

    return WordProblemPipelineResponse(
        success=True,
        original_question=question,
        final_answer=final_ans,
        final_answer_latex=final_ans_latex,
        final_answer_units=final_units,
        target_variable=primary_target,
        numeric_value=numeric_val,
        all_values=engine_result.solution_values,
        nlu_output=nlu_result.to_dict(),
        classification=classification.to_dict(),
        structured_model=structured_model,
        validation=validation,
        mathematical_model=math_model,
        engine_result=engine_result,
        verification=verification,
        explanation_steps=steps,
        real_world_conclusion=conclusion,
        video_script=video_script,
        pipeline_trace=pipeline_traces,
        total_execution_time_ms=round(total_time, 2)
    )

