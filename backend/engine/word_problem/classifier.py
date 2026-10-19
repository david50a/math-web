from typing import Dict, Any, List
from .nlu import NLUResult

class ClassificationResult:
    def __init__(
        self,
        category: str,
        subcategory: str,
        display_name: str,
        governing_laws: List[str],
        formula_templates: List[str],
        difficulty: str,
        confidence: float
    ):
        self.category = category
        self.subcategory = subcategory
        self.display_name = display_name
        self.governing_laws = governing_laws
        self.formula_templates = formula_templates
        self.difficulty = difficulty
        self.confidence = confidence

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category,
            "subcategory": self.subcategory,
            "display_name": self.display_name,
            "governing_laws": self.governing_laws,
            "formula_templates": self.formula_templates,
            "difficulty": self.difficulty,
            "confidence": self.confidence
        }

def classify_problem(nlu: NLUResult) -> ClassificationResult:
    """
    Executes Stage 2: Problem Classification.
    Determines category, mathematical templates, governing laws, and difficulty.
    """
    t_lower = nlu.raw_text.lower()
    cat = nlu.detected_category
    sub = nlu.detected_subcategory

    # Motion / Speed-Time-Distance
    if cat == "motion" or any(w in t_lower for w in ["mph", "km/h", "speed", "traveling", "catch up"]):
        if "catch up" in t_lower or "same direction" in t_lower:
            return ClassificationResult(
                category="motion",
                subcategory="catch_up",
                display_name="Motion: Same-Direction Catch-Up Problem",
                governing_laws=[
                    "Distance = Velocity * Time ($d = v \\cdot t$)",
                    "Equated Distance Condition ($d_1 = d_2$)",
                    "Delayed Start Offset ($t_1 = t_2 + \\Delta t$)"
                ],
                formula_templates=["v_1 \\cdot (t + \\Delta t) = v_2 \\cdot t"],
                difficulty="Intermediate",
                confidence=0.95
            )
        elif "opposite direction" in t_lower or "towards each other" in t_lower:
            return ClassificationResult(
                category="motion",
                subcategory="opposite_direction",
                display_name="Motion: Opposite Directions Convergence / Divergence",
                governing_laws=[
                    "Distance = Velocity * Time ($d = v \\cdot t$)",
                    "Sum of Distances ($d_1 + d_2 = D_{total}$)"
                ],
                formula_templates=["v_1 \\cdot t + v_2 \\cdot t = D_{total}"],
                difficulty="Intermediate",
                confidence=0.92
            )
        else:
            return ClassificationResult(
                category="motion",
                subcategory="general_motion",
                display_name="Motion: Kinematics Rate Problem",
                governing_laws=["$d = v \\cdot t$"],
                formula_templates=["d = v \\cdot t"],
                difficulty="Basic",
                confidence=0.88
            )

    # Geometry: Right Triangle / Pythagorean
    if (cat == "geometry" and sub == "pythagorean") or any(w in t_lower for w in ["hypotenuse", "right triangle", "pythagor"]):
        return ClassificationResult(
            category="geometry",
            subcategory="pythagorean",
            display_name="Geometry: Right Triangle / Pythagorean Theorem",
            governing_laws=[
                "Pythagorean Theorem ($a^2 + b^2 = c^2$)",
                "Leg Extraction ($b = \\sqrt{c^2 - a^2}$)",
                "Triangle Area Formula ($A = \\frac{1}{2} a b$)"
            ],
            formula_templates=["a^2 + b^2 = c^2", "A = \\frac{1}{2} \\cdot a \\cdot b"],
            difficulty="Intermediate",
            confidence=0.96
        )

    # Geometry: Perimeter and Area
    if (cat == "geometry" and sub == "perimeter_and_area") or any(w in t_lower for w in ["perimeter", "area", "garden", "rectangle", "rectangular"]):
        return ClassificationResult(
            category="geometry",
            subcategory="perimeter_and_area",
            display_name="Geometry: Rectangle Dimensions from Perimeter & Area",
            governing_laws=[
                "Perimeter Equation ($P = 2l + 2w$)",
                "Area Equation ($A = l \\cdot w$)",
                "Quadratic Substitution ($w(P/2 - w) = A$)"
            ],
            formula_templates=["2l + 2w = P", "l \\cdot w = A"],
            difficulty="Intermediate",
            confidence=0.95
        )

    # Work Rate
    if cat == "work_rate" or any(w in t_lower for w in ["working together", "fill the tank", "cistern", "alone"]):
        return ClassificationResult(
            category="work_rate",
            subcategory="combined_work",
            display_name="Work & Rate: Reciprocal Work Rate Problem",
            governing_laws=[
                "Work Done = Rate * Time ($W = r \\cdot t$)",
                "Reciprocal Rate Sum ($\\frac{1}{t_1} + \\frac{1}{t_2} = \\frac{1}{T_{total}}$)"
            ],
            formula_templates=["\\frac{1}{t_1} + \\frac{1}{t_2} = \\frac{1}{T}"],
            difficulty="Intermediate",
            confidence=0.92
        )

    # Linear Systems: Tickets / Coins / Costs
    if cat == "linear_system" or any(w in t_lower for w in ["ticket", "tickets", "coins", "dimes", "quarters", "purchased"]):
        return ClassificationResult(
            category="linear_system",
            subcategory="cost_and_quantity",
            display_name="Linear Algebra: 2x2 Cost & Quantity System",
            governing_laws=[
                "Quantity Conservation ($x + y = N_{total}$)",
                "Total Value Equation ($c_1 x + c_2 y = V_{total}$)"
            ],
            formula_templates=["x + y = N", "c_1 x + c_2 y = V"],
            difficulty="Intermediate",
            confidence=0.94
        )

    # Age Problems
    if cat == "age" or any(w in t_lower for w in ["years older", "twice as old", "father and son"]):
        return ClassificationResult(
            category="age",
            subcategory="age_relationship",
            display_name="Algebra: Age Difference & Multiplier System",
            governing_laws=[
                "Age Difference Equation ($A - B = \\Delta$)",
                "Future/Past Ratio ($A + k = m \\cdot (B + k)$)"
            ],
            formula_templates=["A = B + d", "A + k = m(B + k)"],
            difficulty="Intermediate",
            confidence=0.91
        )

    # Mixture Problems
    if cat == "mixture" or any(w in t_lower for w in ["mixture", "solution", "acid", "alloy"]):
        return ClassificationResult(
            category="mixture",
            subcategory="concentration_mix",
            display_name="Algebra: Solution Concentration & Mixture",
            governing_laws=[
                "Total Mass Conservation ($V_1 + V_2 = V_{total}$)",
                "Pure Solute Conservation ($C_1 V_1 + C_2 V_2 = C_f V_{total}$)"
            ],
            formula_templates=["C_1 x + C_2 (V - x) = C_f V"],
            difficulty="Intermediate",
            confidence=0.90
        )

    # Default: General Algebra / Quadratic
    return ClassificationResult(
        category="general_algebra",
        subcategory="equation_solving",
        display_name="General Algebraic Formulation",
        governing_laws=["Algebraic Balance & Equation Transformation"],
        formula_templates=["f(x) = 0"],
        difficulty="Intermediate",
        confidence=0.80
    )
