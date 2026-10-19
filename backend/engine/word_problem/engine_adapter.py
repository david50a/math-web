import sys
import os
import re
from typing import Dict, Any, List, Tuple
from .models import MathematicalModel, EngineExecutionResult, MathStepDetail

# Ensure engine path is available
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

import algebra
import geometry
import sympy as sp

def _parse_algebra_solution_to_floats(raw_solution_str: str) -> List[float]:
    """
    Parses algebra raw solutions which may be in LaTeX or SymPy format, e.g.:
    't = \\frac{3}{2}', 'x = 4', 'w = 12, \\quad w = 15', or 'x = -\\frac{5}{2}'
    and converts them to exact floating point values.
    """
    parts = re.split(r'\\quad|,', str(raw_solution_str))
    vals = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if '=' in part:
            rhs = part.split('=', 1)[1].strip()
        else:
            rhs = part
        
        # Replace LaTeX fractions \frac{num}{den} -> ((num)/(den))
        converted = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'((\1)/(\2))', rhs)
        converted = re.sub(r'\\sqrt\{([^{}]+)\}', r'((\1)**0.5)', converted)
        converted = converted.replace('^', '**').replace('{', '(').replace('}', ')')
        converted = converted.replace(r'\cdot', '*').replace(r'\times', '*')
        
        try:
            expr = sp.sympify(converted)
            num = float(expr.evalf())
            vals.append(num)
        except Exception:
            for n in re.findall(r'[-+]?\d*\.?\d+', converted):
                try:
                    vals.append(float(n))
                except ValueError:
                    pass
    return vals

def execute_math_engine(math_model: MathematicalModel) -> EngineExecutionResult:
    """
    Executes Stage 6: YOUR MATH ENGINE.
    Dispatches to your backend math engines (algebra, geometry, etc.), captures
    analytical solutions and step-by-step transformation steps.
    """
    spec = math_model.engine_call_spec
    module_name = spec.get("module", "algebra")
    func_name = spec.get("function", "solve_algebra_pure")
    
    solution_values: Dict[str, float] = {}
    intermediate_steps: List[MathStepDetail] = []
    raw_solution = None
    success = False
    error_message = None

    try:
        if module_name == "algebra" and func_name == "solve_algebra_pure":
            eq = spec.get("equation", math_model.primary_equation)
            var_name = spec.get("variable", "x")
            
            # Call your algebra pure engine!
            raw_solution, steps = algebra.solve_algebra_pure(eq, allow_complex=False)
            
            # Parse step objects from MathStep
            step_idx = 1
            for st in steps:
                latex_val = getattr(st, 'latex', '') or getattr(st, 'description', '')
                desc_val = getattr(st, 'description', '') or getattr(st, 'rule', 'Algebraic simplification')
                rule_val = getattr(st, 'rule', None)
                intermediate_steps.append(MathStepDetail(
                    step_number=step_idx,
                    title=f"Step {step_idx}: Algebraic Transformation",
                    latex=latex_val,
                    explanation=desc_val,
                    rule=rule_val
                ))
                step_idx += 1
                
            # Extract numerical values from raw_solution (e.g., "t = \frac{3}{2}", "x = 4", or "w = 12, \quad w = 15")
            float_vals = _parse_algebra_solution_to_floats(str(raw_solution))
                    
            if float_vals:
                # Pick primary positive value
                pos_vals = [f for f in float_vals if f > 0]
                primary_val = pos_vals[0] if pos_vals else float_vals[0]
                solution_values[var_name] = primary_val
                
                # Check derived variables
                derived = spec.get("derived_vars", {})
                for d_var, expr in derived.items():
                    try:
                        # Safe evaluate derived expression with variable value
                        eval_scope = {var_name: primary_val}
                        # Replace variable occurrences
                        derived_num = eval(expr, {"__builtins__": {}}, eval_scope)
                        solution_values[d_var] = float(derived_num)
                    except Exception as ex:
                        print(f"Derived eval error for {d_var}: {ex}")

            success = True

        elif module_name == "geometry" and func_name == "pythagorean":
            kwargs = spec.get("kwargs", {})
            a = kwargs.get("a")
            b = kwargs.get("b")
            c = kwargs.get("c")
            
            # Call your geometry engine!
            raw_val, steps = geometry.pythagorean(a=a, b=b, c=c)
            raw_solution = raw_val
            
            target_var = "b" if b is None else ("c" if c is None else "a")
            solution_values[target_var] = float(raw_val)
            
            step_idx = 1
            for st in steps:
                intermediate_steps.append(MathStepDetail(
                    step_number=step_idx,
                    title=f"Step {step_idx}: Geometric Derivation",
                    latex=getattr(st, 'latex', '') or getattr(st, 'description', ''),
                    explanation=getattr(st, 'description', '') or "Geometric calculation",
                    rule=getattr(st, 'rule', 'Pythagorean Theorem')
                ))
                step_idx += 1
                
            # Derived vars (like Area)
            derived = spec.get("derived_vars", {})
            for d_var, expr in derived.items():
                try:
                    eval_scope = {"a": a, "b": b, "c": c}
                    eval_scope = {k: v for k, v in eval_scope.items() if v is not None}
                    eval_scope[target_var] = float(raw_val)
                    val_calc = eval(expr, {"__builtins__": {}}, eval_scope)
                    solution_values[d_var] = float(val_calc)
                except Exception as ex:
                    print(f"Geometry derived error: {ex}")
                    
            success = True

        else:
            # Fallback evaluation
            eq = math_model.primary_equation
            raw_solution, steps = algebra.solve_algebra_pure(eq)
            success = True

    except Exception as e:
        success = False
        error_message = str(e)
        print(f"Error during math engine execution: {e}")

    return EngineExecutionResult(
        raw_solution=str(raw_solution),
        solution_values=solution_values,
        intermediate_steps=intermediate_steps,
        engine_name=f"{module_name}.{func_name}",
        success=success,
        error_message=error_message
    )
