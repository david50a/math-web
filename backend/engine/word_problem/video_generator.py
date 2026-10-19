import math
from typing import List, Dict, Any, Optional
from .models import (
    StructuredProblemModel,
    MathematicalModel,
    EngineExecutionResult,
    VerificationResult,
    MathStepDetail,
    VideoScript,
    VideoScene,
    SubtitleItem,
    EquationBuildingStep
)

def _build_subtitles(text: str, start_time: float, duration: float) -> List[SubtitleItem]:
    """Splits narration into roughly 3-5 word subtitle chunks spread across duration."""
    words = text.split()
    if not words:
        return []
    
    chunk_size = 7
    chunks = [" ".join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)]
    if not chunks:
        return [SubtitleItem(start_sec=start_time, end_sec=start_time + duration, text=text)]
    
    step_duration = duration / len(chunks)
    subtitles = []
    curr = start_time
    for chunk in chunks:
        end = min(start_time + duration, curr + step_duration)
        subtitles.append(SubtitleItem(
            start_sec=round(curr, 2),
            end_sec=round(end, 2),
            text=chunk
        ))
        curr = end
    return subtitles


def generate_video_script(
    model: StructuredProblemModel,
    math_model: MathematicalModel,
    engine_res: EngineExecutionResult,
    verification: VerificationResult,
    explanation_steps: List[MathStepDetail],
    conclusion: str,
    question: str
) -> VideoScript:
    """
    Constructs a comprehensive 4-phase pedagogical video storyboard:
      Phase 1: The Physical Situation (visual animation of vehicles, geometry, tank/pipes, scales)
      Phase 2: Mathematical Model Framing & Equation Building (sentence-by-sentence derivation from question text)
      Phase 3: Step-by-Step Algebraic Solution (dynamic transformation of the equation)
      Phase 4: Verification & Real-World Conclusion (back-substitution and final physical outcome)
    """
    cat = model.category.lower()
    sub = model.subcategory.lower()
    vals = engine_res.solution_values

    scenes: List[VideoScene] = []
    all_equation_building_steps: List[EquationBuildingStep] = []
    curr_time = 0.0

    # ══════════════════════════════════════════════════════════════════════════════
    # ARCHETYPE 1: Motion / Kinematics (Catch-Up or Head-to-Head)
    # ══════════════════════════════════════════════════════════════════════════════
    if "motion" in cat or sub in ["catch_up", "head_to_head", "relative_speed", "speed_distance_time"]:
        v1 = 60.0
        v2 = 90.0
        delay = 2.0
        for v in model.variables:
            name_lower = v.name.lower()
            sym_lower = v.symbol.lower()
            if "speed" in name_lower or "velocity" in name_lower or "rate" in name_lower or "v" in sym_lower:
                if "first" in name_lower or "1" in sym_lower or "a" in sym_lower:
                    v1 = float(v.value or v1)
                elif "second" in name_lower or "2" in sym_lower or "b" in sym_lower:
                    v2 = float(v.value or v2)
            if "delay" in name_lower or "later" in name_lower or "lead" in name_lower or "head" in name_lower or "start" in name_lower or "delay" in sym_lower:
                delay = float(v.value if v.value is not None else delay)

        speed_unit = next((v.unit for v in model.variables if v.symbol in ["v_1", "v1"] and v.unit), "mph")
        dist_unit = next((v.unit for v in model.variables if v.symbol in ["d", "dist"] and v.unit), "miles")
        time_unit = next((v.unit for v in model.variables if v.symbol in ["t", "time"] and v.unit), "hours")

        t_val = float(vals.get("t", vals.get("time", 4.0)))
        d_val = float(vals.get("d", vals.get("distance", v2 * t_val)))

        actor1 = model.entities[0].name if len(model.entities) >= 1 else "Vehicle A"
        actor2 = model.entities[1].name if len(model.entities) >= 2 else "Vehicle B"

        # Define Sentence-by-Sentence Equation Building Steps
        motion_eq_steps = [
            EquationBuildingStep(
                source_phrase=f"traveling at {v1:g} {speed_unit} ... traveling at {v2:g} {speed_unit}",
                concept="Distance Law: d = v · t",
                math_translation="Distance equals speed multiplied by time",
                latex=rf"d_1 = {v1:g} \cdot t_1, \quad d_2 = {v2:g} \cdot t_2",
                explanation=f"Each traveler's distance is its speed times the time it has been moving."
            ),
            EquationBuildingStep(
                source_phrase=f"{delay:g} {time_unit} later another traveler leaves",
                concept="Time Offset / Head Start",
                math_translation=f"t_A = t_B + {delay:g}",
                latex=rf"t_1 = t + {delay:g}, \quad t_2 = t",
                explanation=f"Because {actor2} departs {delay:g} {time_unit} after {actor1}, {actor1} travels for t + {delay:g} {time_unit} while {actor2} travels for t {time_unit}."
            ),
            EquationBuildingStep(
                source_phrase="When will the second traveler catch up?",
                concept="Equal Distance Catch-up Condition",
                math_translation="d_1 = d_2",
                latex=rf"d_1 = d_2 \implies {v1:g}(t + {delay:g}) = {v2:g}t",
                explanation="Catching up means reaching the exact same point, setting traveled distances equal."
            )
        ]
        all_equation_building_steps = motion_eq_steps

        # Scene 1: Physical Situation
        dur1 = 8.5
        narr1 = (
            f"Here is the situation: {actor1} departs traveling steadily at {v1:g} {speed_unit}. "
            f"{delay:g} {time_unit} later, {actor2} departs from the same point at {v2:g} {speed_unit} in the same direction. "
            f"When and where will {actor2} catch up with {actor1}?"
        )
        scenes.append(VideoScene(
            scene_id="situation",
            title="The Real-World Situation: Two Moving Vehicles",
            phase_label="Phase 1: The Real-World Situation",
            start_time_sec=curr_time,
            duration_sec=dur1,
            narration=narr1,
            subtitles=_build_subtitles(narr1, curr_time, dur1),
            visual_type="motion_race",
            visual_params={
                "actor1": actor1,
                "speed1": v1,
                "actor2": actor2,
                "speed2": v2,
                "delay": delay,
                "meet_time": t_val,
                "meet_distance": d_val,
                "speed_unit": speed_unit,
                "distance_unit": dist_unit,
                "time_unit": time_unit,
                "station_name": "Start"
            },
            latex_callout=f"v_1 = {v1:g}\\text{{ {speed_unit}}}, \\quad v_2 = {v2:g}\\text{{ {speed_unit}}}, \\quad \\Delta t = {delay:g}\\text{{ {time_unit}}}"
        ))
        curr_time += dur1

        # Scene 2: Mathematical Formulation & Equation Construction
        dur2 = 8.0
        narr2 = (
            f"Now, let's build the equation directly from the question words. "
            f"First, speeds of {v1:g} and {v2:g} {speed_unit} give distance equals speed times time. "
            f"Second, a {delay:g} {time_unit} head start means {actor1} travels for t plus {delay:g} {time_unit} while {actor2} travels for t {time_unit}. "
            f"Third, catching up means their distances are equal. "
            f"Equating them yields: {v1:g} times (t + {delay:g}) equals {v2:g}t!"
        )
        scenes.append(VideoScene(
            scene_id="model_setup",
            title="Building the Equation from the Question",
            phase_label="Phase 2: Building the Equation from the Question",
            start_time_sec=curr_time,
            duration_sec=dur2,
            narration=narr2,
            subtitles=_build_subtitles(narr2, curr_time, dur2),
            visual_type="motion_race",
            visual_params={
                "actor1": actor1,
                "speed1": v1,
                "actor2": actor2,
                "speed2": v2,
                "delay": delay,
                "meet_time": t_val,
                "meet_distance": d_val,
                "speed_unit": speed_unit,
                "distance_unit": dist_unit,
                "time_unit": time_unit,
                "show_equations": True,
                "show_equation_builder": True
            },
            latex_callout=f"d_1 = d_2 \\implies {v1:g}(t + {delay:g}) = {v2:g}t",
            equation_building_steps=motion_eq_steps
        ))
        curr_time += dur2

        # Scene 3: Step-by-Step Solving
        dur3 = 9.0
        delta_v = v2 - v1
        lead_dist = v1 * delay
        narr3 = (
            f"Now we solve for time t. We expand the left side to get {v1:g}t plus {lead_dist:g} equals {v2:g}t. "
            f"Subtracting {v1:g}t from both sides leaves {lead_dist:g} equals {delta_v:g}t. "
            f"Dividing by {delta_v:g}, we find t equals {t_val:g} {time_unit}."
        )
        scenes.append(VideoScene(
            scene_id="solving",
            title="Step-by-Step Algebraic Resolution",
            phase_label="Phase 3: Step-by-Step Algebraic Solution",
            start_time_sec=curr_time,
            duration_sec=dur3,
            narration=narr3,
            subtitles=_build_subtitles(narr3, curr_time, dur3),
            visual_type="motion_race",
            visual_params={
                "meet_time": t_val,
                "meet_distance": d_val,
                "actor1": actor1,
                "actor2": actor2,
                "speed1": v1,
                "speed2": v2,
                "delay": delay,
                "speed_unit": speed_unit,
                "distance_unit": dist_unit,
                "time_unit": time_unit,
                "solve_progress": 1.0
            },
            latex_callout=f"t = \\frac{{{lead_dist:g}}}{{{delta_v:g}}} = {t_val:g} \\text{{ {time_unit}}}",
            step_details=[
                {"latex": f"{v1:g}(t + {delay:g}) = {v2:g}t", "rule": "Governing Equation"},
                {"latex": f"{v1:g}t + {lead_dist:g} = {v2:g}t", "rule": "Distributive Property"},
                {"latex": f"{lead_dist:g} = {delta_v:g}t", "rule": f"Subtract {v1:g}t"},
                {"latex": f"t = {t_val:g} \\text{{ {time_unit}}}", "rule": f"Divide by {delta_v:g}"}
            ]
        ))
        curr_time += dur3

        # Scene 4: Verification & Real-World Conclusion
        dur4 = 7.5
        t_min_str = f" ({int(round(t_val * 60))} minutes)" if t_val != 1.0 else ""
        narr4 = (
            f"Plugging back into our equations: in {t_val:g} {time_unit}, {actor2} travels {v2:g} times {t_val:g}, which is {d_val:g} {dist_unit}. "
            f"{actor1} traveled for {t_val + delay:g} {time_unit} at {v1:g} {speed_unit}, also reaching {d_val:g} {dist_unit}! "
            f"The verification confirms {actor2} catches up after {t_val:g} {time_unit}{t_min_str}, at {d_val:g} {dist_unit}."
        )
        scenes.append(VideoScene(
            scene_id="conclusion",
            title="Physical Verification & Real-World Conclusion",
            phase_label="Phase 4: Physical Verification & Conclusion",
            start_time_sec=curr_time,
            duration_sec=dur4,
            narration=narr4,
            subtitles=_build_subtitles(narr4, curr_time, dur4),
            visual_type="motion_race",
            visual_params={
                "actor1": actor1,
                "speed1": v1,
                "actor2": actor2,
                "speed2": v2,
                "meet_time": t_val,
                "meet_distance": d_val,
                "speed_unit": speed_unit,
                "distance_unit": dist_unit,
                "time_unit": time_unit,
                "celebrate": True
            },
            latex_callout=f"\\text{{Catch-Up: }} t = {t_val:g}\\text{{ {time_unit}}}, \\quad d = {d_val:g}\\text{{ {dist_unit}}}"
        ))
        curr_time += dur4

    # ══════════════════════════════════════════════════════════════════════════════
    # ARCHETYPE 2: Geometry - Pythagorean Theorem
    # ══════════════════════════════════════════════════════════════════════════════
    elif "geometry" in cat and "pythagorean" in sub:
        a = next((float(v.value) for v in model.variables if v.symbol == "a" and v.value), 5.0)
        c = next((float(v.value) for v in model.variables if v.symbol == "c" and v.value), 13.0)
        b = float(vals.get("b", math.sqrt(max(0, c*c - a*a))))
        area = float(vals.get("A", 0.5 * a * b))
        unit = next((v.unit for v in model.variables if v.unit), "cm")

        pyth_eq_steps = [
            EquationBuildingStep(
                source_phrase="right triangle",
                concept="Right Angle Geometric Law",
                math_translation="Pythagorean Theorem",
                latex=r"a^2 + b^2 = c^2",
                explanation="Any right triangle in Euclidean geometry obeys the relation that the sum of leg squares equals the hypotenuse square."
            ),
            EquationBuildingStep(
                source_phrase=f"hypotenuse is {int(c)} {unit} and one leg is {int(a)} {unit}",
                concept="Assign Variables from Problem",
                math_translation=f"c = {int(c)}, a = {int(a)}",
                latex=rf"c = {int(c)} \text{{ {unit}}}, \quad a = {int(a)} \text{{ {unit}}}",
                explanation=f"We match the problem's given numbers to the hypotenuse c and known leg a."
            ),
            EquationBuildingStep(
                source_phrase="What is the length of the other leg?",
                concept="Formulate Equation for Missing Leg",
                math_translation=f"Substitute into a^2 + b^2 = c^2",
                latex=rf"{int(a)}^2 + b^2 = {int(c)}^2 \implies {int(a*a)} + b^2 = {int(c*c)}",
                explanation=f"Substituting known values establishes the algebraic equation to find leg b."
            )
        ]
        all_equation_building_steps = pyth_eq_steps

        # Scene 1: Situation
        dur1 = 8.0
        narr1 = (
            f"Consider this right triangle: the hypotenuse measures {int(c)} {unit}, and one known leg measures {int(a)} {unit}. "
            f"We must determine the length of the unknown perpendicular leg and the enclosed area."
        )
        scenes.append(VideoScene(
            scene_id="situation",
            title="The Geometric Situation: Right Triangle",
            phase_label="Phase 1: The Real-World Situation",
            start_time_sec=curr_time,
            duration_sec=dur1,
            narration=narr1,
            subtitles=_build_subtitles(narr1, curr_time, dur1),
            visual_type="geometry_pythagorean",
            visual_params={"a": a, "b": b, "c": c, "area": area, "unit": unit, "stage": "intro"},
            latex_callout=f"c = {int(c)} \\text{{ {unit}}}, \\quad a = {int(a)} \\text{{ {unit}}}, \\quad b = \\, ?"
        ))
        curr_time += dur1

        # Scene 2: Setup
        dur2 = 8.0
        narr2 = (
            f"To build our equation from the question: 'right triangle' invokes the Pythagorean theorem, a squared plus b squared equals c squared. "
            f"We plug in the known hypotenuse of {int(c)} and leg of {int(a)} to get {int(a)} squared plus b squared equals {int(c)} squared."
        )
        scenes.append(VideoScene(
            scene_id="model_setup",
            title="Building the Equation from the Question",
            phase_label="Phase 2: Building the Equation from the Question",
            start_time_sec=curr_time,
            duration_sec=dur2,
            narration=narr2,
            subtitles=_build_subtitles(narr2, curr_time, dur2),
            visual_type="geometry_pythagorean",
            visual_params={"a": a, "b": b, "c": c, "area": area, "unit": unit, "stage": "theorem_squares", "show_equation_builder": True},
            latex_callout=f"a^2 + b^2 = c^2 \\implies {int(a)}^2 + b^2 = {int(c)}^2",
            equation_building_steps=pyth_eq_steps
        ))
        curr_time += dur2

        # Scene 3: Solving
        dur3 = 8.5
        narr3 = (
            f"We square the known values: {int(a*a)} plus b squared equals {int(c*c)}. "
            f"Subtracting {int(a*a)} leaves b squared equals {int(c*c - a*a)}. "
            f"Taking the principal square root gives the missing leg b equals {int(b)} {unit}."
        )
        scenes.append(VideoScene(
            scene_id="solving",
            title="Step-by-Step Algebraic Resolution",
            phase_label="Phase 3: Step-by-Step Algebraic Solution",
            start_time_sec=curr_time,
            duration_sec=dur3,
            narration=narr3,
            subtitles=_build_subtitles(narr3, curr_time, dur3),
            visual_type="geometry_pythagorean",
            visual_params={"a": a, "b": b, "c": c, "area": area, "unit": unit, "stage": "solved"},
            latex_callout=f"b = \\sqrt{{{int(c*c)} - {int(a*a)}}} = {int(b)} \\text{{ {unit}}}",
            step_details=[
                {"latex": f"{int(a)}^2 + b^2 = {int(c)}^2", "rule": "Substitute Knowns"},
                {"latex": f"{int(a*a)} + b^2 = {int(c*c)}", "rule": "Compute Powers"},
                {"latex": f"b^2 = {int(c*c - a*a)}", "rule": f"Subtract {int(a*a)}"},
                {"latex": f"b = {int(b)} \\text{{ {unit}}}", "rule": "Square Root"}
            ]
        ))
        curr_time += dur3

        # Scene 4: Conclusion
        dur4 = 7.0
        narr4 = (
            f"With both perpendicular legs known as {int(a)} and {int(b)} {unit}, "
            f"the triangle's area is one-half base times height, which equals exactly {area:.1f} square {unit}. "
            f"The geometric proof is complete and fully verified."
        )
        scenes.append(VideoScene(
            scene_id="conclusion",
            title="Area Calculation & Real-World Conclusion",
            phase_label="Phase 4: Physical Verification & Conclusion",
            start_time_sec=curr_time,
            duration_sec=dur4,
            narration=narr4,
            subtitles=_build_subtitles(narr4, curr_time, dur4),
            visual_type="geometry_pythagorean",
            visual_params={"a": a, "b": b, "c": c, "area": area, "unit": unit, "stage": "conclusion"},
            latex_callout=f"b = {int(b)} \\text{{ {unit}}}, \\quad A = \\frac{1}{2}({int(a)})({int(b)}) = {area:.1f} \\text{{ {unit}}}^2"
        ))
        curr_time += dur4

    # ══════════════════════════════════════════════════════════════════════════════
    # ARCHETYPE 3: Geometry - Rectangle Perimeter & Area
    # ══════════════════════════════════════════════════════════════════════════════
    elif "geometry" in cat and ("perimeter" in sub or "area" in sub or "rectangle" in sub):
        l_val = float(vals.get("l", 15.0))
        w_val = float(vals.get("w", 12.0))
        if w_val > l_val:
            l_val, w_val = w_val, l_val
        p_val = 2 * (l_val + w_val)
        a_val = l_val * w_val
        unit = next((v.unit for v in model.variables if v.symbol in ["l", "w", "P"] and v.unit), "meters")

        rect_eq_steps = [
            EquationBuildingStep(
                source_phrase=f"perimeter of {int(p_val)} {unit}",
                concept="Perimeter Formula",
                math_translation=f"2(length + width) = {int(p_val)}",
                latex=rf"2(l + w) = {int(p_val)} \implies l + w = {int(p_val/2)}",
                explanation=f"Perimeter is the sum of all 4 outer border edges, giving 2 lengths plus 2 widths equals {int(p_val)} {unit}."
            ),
            EquationBuildingStep(
                source_phrase=f"area of {int(a_val)} square {unit}",
                concept="Area Formula",
                math_translation=f"length × width = {int(a_val)}",
                latex=rf"l \cdot w = {int(a_val)}",
                explanation=f"The enclosed area of any rectangle is the product of its length and width in square {unit}."
            ),
            EquationBuildingStep(
                source_phrase="Find its length and width",
                concept="Substitution into Quadratic",
                math_translation=f"Substitute l = {int(p_val/2)} - w into Area",
                latex=rf"({int(p_val/2)} - w)w = {int(a_val)} \implies w^2 - {int(p_val/2)}w + {int(a_val)} = 0",
                explanation="Substituting the perimeter expression into the area relationship yields a single-variable quadratic."
            )
        ]
        all_equation_building_steps = rect_eq_steps

        dur1 = 8.0
        narr1 = (
            f"We are analyzing a rectangular boundary with perimeter of {int(p_val)} {unit} "
            f"and an enclosed area of {int(a_val)} square {unit}. What are the exact length and width of the plot?"
        )
        scenes.append(VideoScene(
            scene_id="situation",
            title="The Geometric Situation: Rectangular Plot",
            phase_label="Phase 1: The Real-World Situation",
            start_time_sec=curr_time,
            duration_sec=dur1,
            narration=narr1,
            subtitles=_build_subtitles(narr1, curr_time, dur1),
            visual_type="geometry_rectangle",
            visual_params={"length": l_val, "width": w_val, "perimeter": p_val, "area": a_val, "unit": unit},
            latex_callout=f"P = {int(p_val)}\\text{{ {unit}}}, \\quad A = {int(a_val)}\\text{{ {unit}}}^2"
        ))
        curr_time += dur1

        dur2 = 8.0
        narr2 = (
            f"Let's see how each phrase builds an equation: "
            f"'Perimeter of {int(p_val)} {unit}' gives 2 times length plus width equals {int(p_val)}, so length plus width equals {int(p_val/2)}. "
            f"'Area of {int(a_val)}' gives length times width equals {int(a_val)}. "
            f"Substituting length as {int(p_val/2)} minus width builds the quadratic equation: w squared minus {int(p_val/2)}w plus {int(a_val)} equals 0!"
        )
        scenes.append(VideoScene(
            scene_id="model_setup",
            title="Building the Equation from the Question",
            phase_label="Phase 2: Building the Equation from the Question",
            start_time_sec=curr_time,
            duration_sec=dur2,
            narration=narr2,
            subtitles=_build_subtitles(narr2, curr_time, dur2),
            visual_type="geometry_rectangle",
            visual_params={"length": l_val, "width": w_val, "perimeter": p_val, "area": a_val, "unit": unit, "show_equation_builder": True},
            latex_callout=f"l + w = {int(p_val/2)}, \\quad l \\times w = {int(a_val)}",
            equation_building_steps=rect_eq_steps
        ))
        curr_time += dur2

        dur3 = 9.0
        narr3 = (
            f"Expressing length as {int(p_val/2)} minus width, we substitute into the area equation to form a quadratic: "
            f"w squared minus {int(p_val/2)}w plus {int(a_val)} equals zero. "
            f"Factoring this yields width equals {int(w_val)} {unit} and length equals {int(l_val)} {unit}."
        )
        scenes.append(VideoScene(
            scene_id="solving",
            title="Step-by-Step Quadratic Resolution",
            phase_label="Phase 3: Step-by-Step Algebraic Solution",
            start_time_sec=curr_time,
            duration_sec=dur3,
            narration=narr3,
            subtitles=_build_subtitles(narr3, curr_time, dur3),
            visual_type="geometry_rectangle",
            visual_params={"length": l_val, "width": w_val, "perimeter": p_val, "area": a_val, "unit": unit, "solved": True},
            latex_callout=f"w = {int(w_val)} \\text{{ {unit}}}, \\quad l = {int(l_val)} \\text{{ {unit}}}",
            step_details=[
                {"latex": f"2(l + w) = {int(p_val)} \\implies l = {int(p_val/2)} - w", "rule": "Perimeter Isolation"},
                {"latex": f"({int(p_val/2)} - w)w = {int(a_val)}", "rule": "Area Substitution"},
                {"latex": f"w^2 - {int(p_val/2)}w + {int(a_val)} = 0", "rule": "Standard Quadratic Form"},
                {"latex": f"(w - {int(w_val)})(w - {int(l_val)}) = 0", "rule": "Factoring Solution"}
            ]
        ))
        curr_time += dur3

        dur4 = 7.0
        narr4 = (
            f"We verify the dimensions: length {int(l_val)} {unit} by width {int(w_val)} {unit} gives a perimeter of "
            f"2 times {int(l_val+w_val)}, which is {int(p_val)} {unit}, and an area of {int(l_val*w_val)} square {unit}. Verified!"
        )
        scenes.append(VideoScene(
            scene_id="conclusion",
            title="Verification & Real-World Dimensions",
            phase_label="Phase 4: Physical Verification & Conclusion",
            start_time_sec=curr_time,
            duration_sec=dur4,
            narration=narr4,
            subtitles=_build_subtitles(narr4, curr_time, dur4),
            visual_type="geometry_rectangle",
            visual_params={"length": l_val, "width": w_val, "perimeter": p_val, "area": a_val, "unit": unit, "celebrate": True},
            latex_callout=f"\\text{{Dimensions: }} {int(l_val)}\\text{{ {unit}}} \\times {int(w_val)}\\text{{ {unit}}}"
        ))
        curr_time += dur4

    # ══════════════════════════════════════════════════════════════════════════════
    # ARCHETYPE 4: Work Rate / Pipes
    # ══════════════════════════════════════════════════════════════════════════════
    elif "work" in cat or "rate" in cat or sub in ["work_rate", "combined_work", "pipes_tank"]:
        t1 = 4.0
        t2 = 6.0
        for v in model.variables:
            if v.value and v.symbol in ["t_1", "t1", "a", "A", "w1"]:
                t1 = float(v.value)
            elif v.value and v.symbol in ["t_2", "t2", "b", "B", "w2"]:
                t2 = float(v.value)
        t_comb = float(vals.get("T", vals.get("t", (t1 * t2) / (t1 + t2))))
        unit = next((v.unit for v in model.variables if v.symbol in ["T", "t_1", "t_2"] and v.unit), "hours")
        rate_time_unit = unit[:-1] if unit.endswith('s') else unit

        work_eq_steps = [
            EquationBuildingStep(
                source_phrase=f"Worker A can complete a job alone in {int(t1)} {unit}",
                concept="Worker A Production Rate",
                math_translation=f"Rate_A = 1/{int(t1)} job/{rate_time_unit}",
                latex=rf"R_A = \frac{{1}}{{{int(t1)}}}",
                explanation=f"Completing 1 entire job in {int(t1)} {unit} means completing 1/{int(t1)} of the job each {rate_time_unit}."
            ),
            EquationBuildingStep(
                source_phrase=f"Worker B can complete the same job alone in {int(t2)} {unit}",
                concept="Worker B Production Rate",
                math_translation=f"Rate_B = 1/{int(t2)} job/{rate_time_unit}",
                latex=rf"R_B = \frac{{1}}{{{int(t2)}}}",
                explanation=f"Worker B accomplishes 1/{int(t2)} of the entire job per {rate_time_unit}."
            ),
            EquationBuildingStep(
                source_phrase="How long will it take if they work together?",
                concept="Harmonic Rate Addition Law",
                math_translation="Rate_A + Rate_B = 1/T",
                latex=rf"\frac{{1}}{{{int(t1)}}} + \frac{{1}}{{{int(t2)}}} = \frac{{1}}{{T}}",
                explanation="When working together simultaneously, their outputs add up to finish 1 job in time T."
            )
        ]
        all_equation_building_steps = work_eq_steps

        dur1 = 8.0
        narr1 = (
            f"Imagine a job or water tank: Worker A completes the entire task alone in {int(t1)} {unit}, "
            f"while Worker B completes it alone in {int(t2)} {unit}. Working simultaneously, how long until the job is done?"
        )
        scenes.append(VideoScene(
            scene_id="situation",
            title="The Real-World Situation: Shared Task & Flow Rates",
            phase_label="Phase 1: The Real-World Situation",
            start_time_sec=curr_time,
            duration_sec=dur1,
            narration=narr1,
            subtitles=_build_subtitles(narr1, curr_time, dur1),
            visual_type="work_rate",
            visual_params={"t1": t1, "t2": t2, "t_comb": t_comb, "unit": unit, "actor1": "Worker A", "actor2": "Worker B"},
            latex_callout=f"t_1 = {int(t1)}\\text{{ {unit}}}, \\quad t_2 = {int(t2)}\\text{{ {unit}}}"
        ))
        curr_time += dur1

        dur2 = 8.0
        narr2 = (
            f"Here is how we build the work equation: "
            f"'Worker A alone in {int(t1)} {unit}' translates to a rate of 1/{int(t1)} per {rate_time_unit}. "
            f"'Worker B alone in {int(t2)} {unit}' gives a rate of 1/{int(t2)}. "
            f"'Working together' means their rates add directly: 1/{int(t1)} plus 1/{int(t2)} equals 1 over T, our combined time!"
        )
        scenes.append(VideoScene(
            scene_id="model_setup",
            title="Building the Equation from the Question",
            phase_label="Phase 2: Building the Equation from the Question",
            start_time_sec=curr_time,
            duration_sec=dur2,
            narration=narr2,
            subtitles=_build_subtitles(narr2, curr_time, dur2),
            visual_type="work_rate",
            visual_params={"t1": t1, "t2": t2, "t_comb": t_comb, "unit": unit, "show_equation_builder": True},
            latex_callout=f"\\frac{{1}}{{{int(t1)}}} + \\frac{{1}}{{{int(t2)}}} = \\frac{{1}}{{T}}",
            equation_building_steps=work_eq_steps
        ))
        curr_time += dur2

        dur3 = 8.5
        narr3 = (
            f"Adding the rates together and solving gives T equals {t_comb:.2f} {unit}."
        )
        scenes.append(VideoScene(
            scene_id="solving",
            title="Step-by-Step Harmonic Resolution",
            phase_label="Phase 3: Step-by-Step Algebraic Solution",
            start_time_sec=curr_time,
            duration_sec=dur3,
            narration=narr3,
            subtitles=_build_subtitles(narr3, curr_time, dur3),
            visual_type="work_rate",
            visual_params={"t1": t1, "t2": t2, "t_comb": t_comb, "unit": unit, "solved": True},
            latex_callout=f"T = \\frac{{{int(t1*t2)}}}{{{int(t1+t2)}}} = {t_comb:.2f} \\text{{ {unit}}}",
            step_details=[
                {"latex": f"\\frac{{1}}{{{int(t1)}}} + \\frac{{1}}{{{int(t2)}}} = \\frac{{1}}{{T}}", "rule": "Work Rate Equation"},
                {"latex": f"T = {t_comb:.2f} \\text{{ {unit}}}", "rule": "Combined Solution"}
            ]
        ))
        curr_time += dur3

        dur4 = 7.0
        narr4 = (
            f"Working as a team, Worker A and Worker B finish the entire task in {t_comb:.2f} {unit}. All constraints are confirmed."
        )
        scenes.append(VideoScene(
            scene_id="conclusion",
            title="Verification & Team Completion",
            phase_label="Phase 4: Physical Verification & Conclusion",
            start_time_sec=curr_time,
            duration_sec=dur4,
            narration=narr4,
            subtitles=_build_subtitles(narr4, curr_time, dur4),
            visual_type="work_rate",
            visual_params={"t1": t1, "t2": t2, "t_comb": t_comb, "unit": unit, "celebrate": True},
            latex_callout=f"T = {t_comb:.2f} \\text{{ {unit}}}"
        ))
        curr_time += dur4

    # ══════════════════════════════════════════════════════════════════════════════
    # ARCHETYPE 5: Linear Systems (Tickets, Balances, Mixtures)
    # ══════════════════════════════════════════════════════════════════════════════
    elif "linear" in cat or "system" in cat or sub in ["tickets", "two_variables", "mixture"]:
        x_val = float(vals.get("x", 30.0))
        y_val = float(vals.get("y", 20.0))
        total_items = int(next((float(v.value) for v in model.variables if v.symbol == "N_{tot}" and v.value), x_val + y_val))
        total_cost = int(next((float(v.value) for v in model.variables if v.symbol == "V_{tot}" and v.value), 310.0))
        c1 = float(model.entities[0].properties.get("unit_cost", 5.0)) if len(model.entities) >= 1 and "unit_cost" in model.entities[0].properties else 5.0
        c2 = float(model.entities[1].properties.get("unit_cost", 8.0)) if len(model.entities) >= 2 and "unit_cost" in model.entities[1].properties else 8.0

        item_unit = next((v.unit for v in model.variables if v.symbol in ["x", "y", "N_{tot}"] and v.unit), "tickets")
        currency_unit = next((v.unit for v in model.variables if v.symbol == "V_{tot}" and v.unit), "USD")
        currency_sym = "$" if currency_unit == "USD" else ("€" if currency_unit == "EUR" else ("£" if currency_unit == "GBP" else ("₪" if currency_unit == "ILS" else "$")))

        linear_eq_steps = [
            EquationBuildingStep(
                source_phrase=f"sold {total_items} {item_unit}",
                concept="Quantity Conservation",
                math_translation=f"first_{item_unit} + second_{item_unit} = total",
                latex=rf"x + y = {total_items}",
                explanation=f"Assigning x for first type and y for second type gives x plus y equals {total_items} {item_unit}."
            ),
            EquationBuildingStep(
                source_phrase=f"First type costs {currency_sym}{int(c1)} and second type costs {currency_sym}{int(c2)}",
                concept="Monetary Contribution Rate",
                math_translation=f"{currency_sym}{int(c1)} each + {currency_sym}{int(c2)} each",
                latex=rf"\text{{Revenue}} = {int(c1)}x + {int(c2)}y",
                explanation=f"Each first item contributes {currency_sym}{int(c1)} and each second item contributes {currency_sym}{int(c2)}."
            ),
            EquationBuildingStep(
                source_phrase=f"total of {currency_sym}{total_cost}",
                concept="Total Budget Equation",
                math_translation=f"Combined value equals {currency_sym}{total_cost}",
                latex=rf"{int(c1)}x + {int(c2)}y = {total_cost}",
                explanation=f"Equating total earnings to recorded amount gives our second linear equation in {currency_unit}."
            )
        ]
        all_equation_building_steps = linear_eq_steps

        dur1 = 8.0
        narr1 = (
            f"Here is the scenario: a total of {total_items} {item_unit} were sold for a total value of {currency_sym}{total_cost}. "
            f"Type 1 costs {currency_sym}{int(c1)}, while Type 2 costs {currency_sym}{int(c2)}. How many of each were sold?"
        )
        scenes.append(VideoScene(
            scene_id="situation",
            title="The Real-World Scenario: Two Linear Classes",
            phase_label="Phase 1: The Real-World Situation",
            start_time_sec=curr_time,
            duration_sec=dur1,
            narration=narr1,
            subtitles=_build_subtitles(narr1, curr_time, dur1),
            visual_type="linear_balance",
            visual_params={"x": x_val, "y": y_val, "c1": c1, "c2": c2, "total_items": total_items, "total_cost": total_cost, "currency_sym": currency_sym, "currency_unit": currency_unit, "item_unit": item_unit},
            latex_callout=f"\\text{{Total: }} {total_items} \\text{{ {item_unit}}}, \\quad \\text{{Value: }} {currency_sym}{total_cost}"
        ))
        curr_time += dur1

        dur2 = 8.0
        narr2 = (
            f"To build the system of equations from the question text: "
            f"Total count of {item_unit} means x plus y equals {total_items}. "
            f"Individual costs give {int(c1)}x plus {int(c2)}y for total financial value. "
            f"Equating this to {currency_sym}{total_cost} gives our complete 2 by 2 linear system!"
        )
        scenes.append(VideoScene(
            scene_id="model_setup",
            title="Building the Equations from the Question",
            phase_label="Phase 2: Building the Equation from the Question",
            start_time_sec=curr_time,
            duration_sec=dur2,
            narration=narr2,
            subtitles=_build_subtitles(narr2, curr_time, dur2),
            visual_type="linear_balance",
            visual_params={"x": x_val, "y": y_val, "c1": c1, "c2": c2, "total_items": total_items, "total_cost": total_cost, "currency_sym": currency_sym, "currency_unit": currency_unit, "item_unit": item_unit, "show_equation_builder": True},
            latex_callout=f"\\begin{{cases}} x + y = {total_items} \\\\ {int(c1)}x + {int(c2)}y = {total_cost} \\end{{cases}}",
            equation_building_steps=linear_eq_steps
        ))
        curr_time += dur2

        dur3 = 8.5
        narr3 = (
            f"Multiplying the first equation by {int(c1)} gives {int(c1)}x plus {int(c1)}y equals {int(c1*total_items)}. "
            f"Subtracting this from the second equation eliminates x, leaving {int(c2 - c1)}y equals {int(total_cost - c1*total_items)}, "
            f"so y equals {int(y_val)} {item_unit}, and x equals {int(x_val)} {item_unit}."
        )
        scenes.append(VideoScene(
            scene_id="solving",
            title="Step-by-Step Elimination",
            phase_label="Phase 3: Step-by-Step Algebraic Solution",
            start_time_sec=curr_time,
            duration_sec=dur3,
            narration=narr3,
            subtitles=_build_subtitles(narr3, curr_time, dur3),
            visual_type="linear_balance",
            visual_params={"x": x_val, "y": y_val, "c1": c1, "c2": c2, "total_items": total_items, "total_cost": total_cost, "currency_sym": currency_sym, "currency_unit": currency_unit, "item_unit": item_unit, "solved": True},
            latex_callout=f"x = {int(x_val)}, \\quad y = {int(y_val)}",
            step_details=[
                {"latex": f"{int(c1)}x + {int(c2)}y = {total_cost}", "rule": "Cost Equation"},
                {"latex": f"-({int(c1)}x + {int(c1)}y = {int(c1*total_items)})", "rule": f"Multiply 1st eq by {int(c1)}"},
                {"latex": f"{int(c2 - c1)}y = {int(total_cost - c1*total_items)} \\implies y = {int(y_val)}", "rule": "Elimination"},
                {"latex": f"x = {total_items} - {int(y_val)} = {int(x_val)}", "rule": "Back Substitution"}
            ]
        ))
        curr_time += dur3

        dur4 = 7.0
        narr4 = (
            f"Checking the solution: {int(x_val)} {item_unit} at {currency_sym}{int(c1)} plus {int(y_val)} at {currency_sym}{int(c2)} "
            f"equals exactly {currency_sym}{total_cost}. The linear system is uniquely resolved!"
        )
        scenes.append(VideoScene(
            scene_id="conclusion",
            title="Verification & Final Count",
            phase_label="Phase 4: Physical Verification & Conclusion",
            start_time_sec=curr_time,
            duration_sec=dur4,
            narration=narr4,
            subtitles=_build_subtitles(narr4, curr_time, dur4),
            visual_type="linear_balance",
            visual_params={"x": x_val, "y": y_val, "c1": c1, "c2": c2, "total_items": total_items, "total_cost": total_cost, "currency_sym": currency_sym, "currency_unit": currency_unit, "item_unit": item_unit, "celebrate": True},
            latex_callout=f"{int(x_val)} \\text{{ Type 1}}, \\quad {int(y_val)} \\text{{ Type 2 {item_unit}}}"
        ))
        curr_time += dur4

    # ══════════════════════════════════════════════════════════════════════════════
    # GENERIC FALLBACK FOR ANY WORD PROBLEM
    # ══════════════════════════════════════════════════════════════════════════════
    else:
        ans_str = ", ".join([f"{k} = {v}" for k, v in vals.items()]) or str(engine_res.raw_solution)
        eq_str = math_model.primary_equation or "f(x) = 0"

        generic_eq_steps = [
            EquationBuildingStep(
                source_phrase="Extracted Relationships from Question",
                concept="Problem Translation",
                math_translation=eq_str,
                latex=math_model.latex_form or eq_str,
                explanation="Extracting numeric values and constraints directly from the question text forms our primary governing equation."
            )
        ]
        all_equation_building_steps = generic_eq_steps

        dur1 = 8.0
        narr1 = f"Let's break down this mathematical problem: {question[:140]}..."
        scenes.append(VideoScene(
            scene_id="situation",
            title="Understanding the Word Problem",
            phase_label="Phase 1: The Real-World Situation",
            start_time_sec=curr_time,
            duration_sec=dur1,
            narration=narr1,
            subtitles=_build_subtitles(narr1, curr_time, dur1),
            visual_type="generic",
            visual_params={"variables": [v.model_dump() for v in model.variables], "category": model.category},
            latex_callout=model.variables[0].symbol if model.variables else "x"
        ))
        curr_time += dur1

        dur2 = 8.0
        narr2 = f"Translating the question's relationships into mathematics gives the governing equation: {eq_str}."
        scenes.append(VideoScene(
            scene_id="model_setup",
            title="Building the Equation from the Question",
            phase_label="Phase 2: Building the Equation from the Question",
            start_time_sec=curr_time,
            duration_sec=dur2,
            narration=narr2,
            subtitles=_build_subtitles(narr2, curr_time, dur2),
            visual_type="generic",
            visual_params={"equation": eq_str, "latex": math_model.latex_form, "show_equation_builder": True},
            latex_callout=math_model.latex_form or eq_str,
            equation_building_steps=generic_eq_steps
        ))
        curr_time += dur2

        dur3 = 8.5
        narr3 = f"Applying algebraic solving techniques yields the analytical values: {ans_str}."
        scenes.append(VideoScene(
            scene_id="solving",
            title="Solving the Equation",
            phase_label="Phase 3: Step-by-Step Algebraic Solution",
            start_time_sec=curr_time,
            duration_sec=dur3,
            narration=narr3,
            subtitles=_build_subtitles(narr3, curr_time, dur3),
            visual_type="generic",
            visual_params={"solution": vals},
            latex_callout=math_model.latex_form,
            step_details=[{"latex": s.latex, "rule": s.rule or "Algebraic Step"} for s in explanation_steps[:4]]
        ))
        curr_time += dur3

        dur4 = 7.0
        narr4 = conclusion or f"The problem concludes with: {ans_str}. Verified!"
        scenes.append(VideoScene(
            scene_id="conclusion",
            title="Verified Conclusion",
            phase_label="Phase 4: Physical Verification & Conclusion",
            start_time_sec=curr_time,
            duration_sec=dur4,
            narration=narr4,
            subtitles=_build_subtitles(narr4, curr_time, dur4),
            visual_type="generic",
            visual_params={"values": vals, "status": verification.status},
            latex_callout=ans_str
        ))
        curr_time += dur4

    return VideoScript(
        title=f"Explainer Video: {model.category.title()} Problem",
        total_duration_sec=round(curr_time, 2),
        scenes=scenes,
        category=model.category,
        subcategory=model.subcategory,
        equation_building_steps=all_equation_building_steps
    )
