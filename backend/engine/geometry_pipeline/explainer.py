from typing import Dict, Any, List
from .models import TeacherInsights, GeometryProblemModel

def generate_teacher_insights(model: GeometryProblemModel, calc_context: Dict[str, Any]) -> TeacherInsights:
    """
    Constructs high-level pedagogical insights, socratic prompts, and exam tips
    tailored to the active geometry problem type.
    """
    shape_type = calc_context.get("shape_type", "trapezoid").lower()

    if "right_triangle" in shape_type:
        overview = (
            "Right triangles form the cornerstone of Euclidean geometry and trigonometry. "
            "In this problem, the fundamental link between the legs (a, b), the hypotenuse (c), "
            "and the inscribed circle (incircle radius r) is established via both Pythagorean theorem "
            "and the algebraic tangent-segment formula r = (a + b - c)/2."
        )
        socratic_prompts = [
            "Why does the inradius formula r = (a + b - c)/2 hold specifically for right triangles?",
            "How does the ratio of incircle area to triangle area change as the legs become equal (isosceles right triangle)?",
            "Could you find the circumradius R solely from hypotenuse AB without knowing the legs?"
        ]
        key_theorems = [
            "Pythagorean Theorem: a² + b² = c²",
            "Right Triangle Inradius Formula: r = (a + b - c) / 2",
            "General Inradius Relation: r = Area / semiperimeter",
            "Thales' Right Angle Theorem: Circumcenter is the midpoint of hypotenuse"
        ]
        common_mistakes = [
            "Forgetting to square root when calculating the hypotenuse from a² + b².",
            "Confusing inradius (r) with circumradius (R = c/2).",
            "Using the perimeter instead of semiperimeter s = (a+b+c)/2 in the general area formula."
        ]
        exam_tips = [
            "Always remember that the incenter and legs form a square of side length r at the 90° vertex!",
            "Double-check inradius using both r = (a+b-c)/2 and r = Area/s to ensure zero calculation slips.",
            "Write units or denote unitless ratios clearly."
        ]

    elif "cyclic_quadrilateral" in shape_type:
        overview = (
            "Cyclic quadrilaterals demonstrate the power of inscribed circle theorems. "
            "Recognizing that diagonal AC subtends 90° angles at both B and D immediately identifies AC as a diameter "
            "of the circumcircle (Thales' theorem), splitting the quad into two independent right triangles!"
        )
        socratic_prompts = [
            "Why must opposite angles in any cyclic quadrilateral sum to 180°?",
            "What would Ptolemy's Theorem state about the product of the diagonals AC · BD here?",
            "Can a quadrilateral with angle measures 90°, 85°, 90°, 95° be inscribed in a circle?"
        ]
        key_theorems = [
            "Thales' Inscribed Diameter Theorem (∠ = 90° ⇔ chord is a diameter)",
            "Converse of Pythagorean Theorem (Right angle detection)",
            "Inscribed Angle Theorem (Subtended arcs & chord properties)",
            "Area Decomposition for Orthogonal Diagonal/Diameter Triangles"
        ]
        common_mistakes = [
            "Assuming diagonal BD also passes through the center without proving it.",
            "Adding opposite angles to 360° instead of 180°.",
            "Forgetting that the circumradius R is half of diameter AC, so R = 5."
        ]
        exam_tips = [
            "Whenever you detect a 90° inscribed angle, highlight its subtending chord—it is guaranteed to be a circle diameter!",
            "Divide the area calculation across the diameter into two right triangles for quick arithmetic.",
            "State Thales' theorem by name on exams for full justification credit."
        ]

    elif "pyramid" in shape_type:
        overview = (
            "3D Vector Geometry (Bagrut 582 standard) turns spatial solid geometry into rigorous linear algebra. "
            "By expressing apex-to-base vectors SA = u, SB = v, SC = w and taking inner products, "
            "we prove that the pyramid's altitude falls directly onto base centroid M: SM · AB = 0."
        )
        socratic_prompts = [
            "Why does SM · AB = 0 and SM · BC = 0 together prove that SM is perpendicular to the entire base plane?",
            "What does the scalar triple product (u × v) · w represent geometrically in this pyramid?",
            "If the lateral face angle θ was 90° instead of 60°, what would the dot products u · v equal?"
        ]
        key_theorems = [
            "Dot Product Definition: u · v = ||u|| ||v|| cos(θ)",
            "Triangle Centroid Vector Representation: OM = (OA + OB + OC)/3",
            "Line-Plane Perpendicularity: A line perpendicular to two intersecting lines is perpendicular to the plane",
            "Equilateral Face Characterization from Equal Edge Magnitudes"
        ]
        common_mistakes = [
            "Expanding (v - u) dot products without applying the distributive law correctly.",
            "Confusing the centroid M of base ABC with the incenter or circumcenter (they coincide only in equilateral bases).",
            "Neglecting to state that AB and BC are non-parallel when concluding line-plane perpendicularity."
        ]
        exam_tips = [
            "Always state displacement vectors clearly: AB = v - u, BC = w - v.",
            "Group terms symmetrically when evaluating SM · AB to let identical dot products cancel to 0 effortlessly.",
            "Highlight the two independent spanning directions in the base plane."
        ]

    elif "complex" in shape_type:
        overview = (
            "Complex Numbers bridge algebra and 2D geometry in the Argand plane. "
            "Solving (z - 2)⁴ = -16 reveals 4 roots uniformly distributed at 90° intervals on a circle of radius 2 centered at (2, 0). "
            "Connecting these roots produces a square with side length 2√2 and area 8."
        )
        socratic_prompts = [
            "Why do the nth roots of any complex number always form a regular n-gon in the complex plane?",
            "How does the substitution w = z - 2 translate the center of the square from the origin to (2, 0)?",
            "What is the connection between multiplication by i and a 90° counterclockwise rotation?"
        ]
        key_theorems = [
            "De Moivre's Theorem for Fractional Powers: w^(1/n) = r^(1/n) cis((θ + 2πk)/n)",
            "Complex Plane Translation: z = w + z₀ shifts coordinates by vector z₀",
            "Regular Polygon Root Distribution in Argand Plane",
            "Modulus Metric: |z_a - z_b| equals Euclidean distance between points"
        ]
        common_mistakes = [
            "Forgetting to add 2πk (or 360°k) when taking the 4th roots of -16.",
            "Assuming the square is centered at the origin (0, 0) instead of the translated center (2, 0).",
            "Miscalculating the side length by using root modulus 2 instead of Euclidean distance 2√2."
        ]
        exam_tips = [
            "Substitute w = z - 2 first, solve for w, then translate back z = w + 2 at the very end.",
            "Draw a quick Argand sketch with axes Re and Im to verify that vertices form 90° right angles.",
            "Double-check that opposite vertices are separated by diameter 2R = 4."
        ]

    else:
        # Default Trapezoid
        verts = calc_context.get("vertex_names", ["A", "B", "C", "D"])
        VA, VB, VC, VD = verts[0], verts[1], verts[2], verts[3]
        VE = calc_context.get("extension_point", "E")
        param = calc_context.get("param_var", "k")
        ang_sym = calc_context.get("angle_sym", r"\alpha")
        c2 = calc_context.get("c2", 2.0)

        overview = (
            f"This problem is a masterclass in combining Euclidean Geometry with Trigonometry (Bagrut 5-units standard). "
            f"The key breakthrough is recognizing that diagonal {VA}{VC} connects the isosceles triangle {VA}{VB}{VC} with the lower triangle {VA}{VD}{VC}. "
            f"By extending legs {VD}{VA} and {VC}{VB} to meet at point {VE}, we unlock Thales' Theorem (AA similarity), turning an intimidating incircle problem into an elegant ratio calculation!"
        )
        socratic_prompts = [
            f"Why can we immediately deduce that ∠{VD}{VC}{VA} = ∠{VA}{VC}{VB} without measuring?",
            f"What happens to the area and perimeter of a triangle when all its dimensions are scaled by a factor of {c2:.0f}?",
            f"Could you find the value of {param} if the circumcircle radius was given instead of the incircle radius?"
        ]
        key_theorems = [
            f"Alternate Interior Angles Theorem ({VA}{VB} ∥ {VD}{VC})",
            "Law of Cosines (in general triangles)",
            "Trigonometric Cofunction Identity: cos(90° - θ) = sin(θ)",
            "Converse of Pythagorean Theorem (Right-angle detection)",
            "AA Triangle Similarity (Thales' theorem for parallel transversals)",
            "Incircle Radius Formula: r = Area / semiperimeter"
        ]
        common_mistakes = [
            f"Confusing vertex angle with base angles in isosceles triangle {VA}{VB}{VC}.",
            f"Forgetting to check the given interval 0° < {ang_sym} < 90° when inverting trigonometric equations.",
            f"Assuming trapezoid {VA}{VB}{VC}{VD} is isosceles without proving it first.",
            f"Incorrectly applying the similarity ratio 1:{c2:.0f} to area instead of 1:{c2**2:.0f} (Area scales with ratio squared!)."
        ]
        exam_tips = [
            "Always write down the geometric theorem name next to every deduction (Statement | Justification column format).",
            f"Draw construction extensions (like point {VE}) in dashed lines to clearly distinguish given elements from auxiliary lines.",
            f"Keep the variable '{param}' factored out until the very last step—notice how it cancels out completely in parts b & c!"
        ]

    return TeacherInsights(
        conceptual_overview=overview,
        socratic_prompts=socratic_prompts,
        key_theorems=key_theorems,
        common_mistakes=common_mistakes,
        exam_tips=exam_tips
    )
