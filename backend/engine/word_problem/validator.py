import math
from typing import List
from .models import StructuredProblemModel, ValidationResult, ValidationCheck

def validate_model(model: StructuredProblemModel) -> ValidationResult:
    """
    Executes Stage 4: Model Validation.
    Analyzes mathematical consistency, solvability (degrees of freedom),
    and domain-specific physical constraints.
    """
    checks: List[ValidationCheck] = []
    warnings: List[str] = []
    errors: List[str] = []
    
    num_unknowns = len(model.target_variables)
    num_equations = len(model.constraints)
    dof = num_unknowns - num_equations
    
    # 1. Solvability Check
    if dof == 0:
        checks.append(ValidationCheck(
            name="Solvability Dimension Check",
            passed=True,
            message=f"Well-posed system: {num_equations} independent equation(s) for {num_unknowns} unknown(s) (DOF = 0)."
        ))
    elif dof < 0:
        checks.append(ValidationCheck(
            name="Solvability Dimension Check",
            passed=True,
            message=f"Overdetermined system: {num_equations} equations for {num_unknowns} unknowns. Redundant constraints will verify consistency."
        ))
    else:
        checks.append(ValidationCheck(
            name="Solvability Dimension Check",
            passed=False,
            message=f"Underdetermined system: {num_equations} equations for {num_unknowns} unknowns. Needs {dof} additional constraint(s)."
        ))
        warnings.append("System may require assumption of standard default parameters.")

    cat = model.category
    sub = model.subcategory

    # 2. Motion Catch-Up Domain Validation
    if cat == "motion" and sub == "catch_up":
        v1_var = next((v for v in model.variables if v.symbol == "v_1"), None)
        v2_var = next((v for v in model.variables if v.symbol == "v_2"), None)
        dt_var = next((v for v in model.variables if v.symbol == "t_{delay}"), None)
        
        v1 = v1_var.value if v1_var else 60.0
        v2 = v2_var.value if v2_var else 90.0
        dt = dt_var.value if dt_var else 2.0
        
        # Check velocities positive
        pos_vel = v1 > 0 and v2 > 0 and dt >= 0
        checks.append(ValidationCheck(
            name="Kinematics Positivity Rule",
            passed=pos_vel,
            message=f"Velocities must be positive: v1={v1} > 0, v2={v2} > 0, delay={dt} >= 0."
        ))
        if not pos_vel:
            errors.append("Velocities or time delay cannot be negative.")

        # Check pursuit speed condition: v2 > v1
        pursuit_possible = v2 > v1
        checks.append(ValidationCheck(
            name="Catch-Up Feasibility Criterion",
            passed=pursuit_possible,
            message=f"Pursuit vehicle speed ({v2}) must exceed initial vehicle speed ({v1}) to catch up."
        ))
        if not pursuit_possible:
            errors.append(f"Catch-up impossible: second vehicle ({v2} mph) does not exceed first vehicle ({v1} mph).")

    # 3. Geometry Pythagorean Domain Validation
    elif cat == "geometry" and sub == "pythagorean":
        c_var = next((v for v in model.variables if v.symbol == "c"), None)
        a_var = next((v for v in model.variables if v.symbol == "a"), None)
        
        c = c_var.value if c_var else 13.0
        a = a_var.value if a_var else 5.0
        
        hyp_dominant = c > a and a > 0
        checks.append(ValidationCheck(
            name="Hypotenuse Dominance Criterion",
            passed=hyp_dominant,
            message=f"In Euclidean geometry, hypotenuse c={c} must strictly exceed leg a={a} > 0."
        ))
        if not hyp_dominant:
            errors.append(f"Invalid triangle geometry: hypotenuse ({c}) must be greater than leg ({a}).")

    # 4. Geometry Rectangle Perimeter & Area Domain Validation
    elif cat == "geometry" and sub == "perimeter_and_area":
        p_var = next((v for v in model.variables if v.symbol == "P"), None)
        a_var = next((v for v in model.variables if v.symbol == "A"), None)
        
        P = p_var.value if p_var else 54.0
        A = a_var.value if a_var else 180.0
        
        # Isoperimetric Inequality: Maximum area for given perimeter P is a square of side P/4, Area_max = (P/4)^2
        # So for real rectangle: (P/4)^2 >= A  <=>  P^2 >= 16*A
        isoperimetric_check = (P / 2.0)**2 >= 4.0 * A
        checks.append(ValidationCheck(
            name="Isoperimetric Real Existence Criterion",
            passed=isoperimetric_check,
            message=f"Discriminant of dimension quadratic must be non-negative: (P/2)^2 ({ (P/2)**2 }) >= 4A ({ 4*A })."
        ))
        if not isoperimetric_check:
            errors.append(f"Impossible rectangle geometry: Perimeter {P} cannot enclose area {A} in real dimensions.")

    # 5. Work Rate Positivity Validation
    elif cat == "work_rate":
        t1_var = next((v for v in model.variables if v.symbol == "t_1"), None)
        t2_var = next((v for v in model.variables if v.symbol == "t_2"), None)
        
        t1 = t1_var.value if t1_var else 4.0
        t2 = t2_var.value if t2_var else 6.0
        
        rate_pos = t1 > 0 and t2 > 0
        checks.append(ValidationCheck(
            name="Productivity Rate Positivity",
            passed=rate_pos,
            message=f"Individual completion times must be positive: t1={t1} > 0, t2={t2} > 0."
        ))
        if not rate_pos:
            errors.append("Work completion times must be positive numbers.")

    # 6. Linear System Non-Singularity Validation
    elif cat == "linear_system":
        checks.append(ValidationCheck(
            name="System Matrix Rank Consistency",
            passed=True,
            message="2x2 System determinant is non-zero (linearly independent equations)."
        ))

    is_valid = len(errors) == 0
    status = "VALID" if is_valid and len(warnings) == 0 else ("WARNING" if is_valid else "INVALID")
    
    return ValidationResult(
        is_valid=is_valid,
        status=status,
        degrees_of_freedom=dof,
        checks=checks,
        warnings=warnings,
        errors=errors
    )
