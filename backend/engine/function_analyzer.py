"""
Comprehensive Mathematical Function Analysis Engine.
Calculates derivatives, extrema (max/min), roots, intercepts, inflection points,
asymptotes, integrals, concavity, monotonicity, and step-by-step derivations.
Uses existing core mathematical engines: derivative.py, algebra.py, integral.py, and math_models.py.
"""

import math
import re
import sys
import os
from typing import Dict, Any, List, Optional, Tuple
import sympy as sp

# Add engine directory to path to import existing engines
ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
if ENGINE_DIR not in sys.path:
    sys.path.append(ENGINE_DIR)
PARENT_DIR = os.path.dirname(ENGINE_DIR)
if PARENT_DIR not in sys.path:
    sys.path.append(PARENT_DIR)

try:
    from math_models import parse_expr, to_string, to_latex, MathStep, Node
    import derivative
    import algebra
    import integral
except ImportError as e:
    print(f"Function analyzer warning: could not import internal engines: {e}")
    parse_expr = None
    derivative = None
    algebra = None
    integral = None


def clean_expression_str(expr_str: str) -> str:
    """Sanitize and format user input into valid SymPy / Engine format."""
    s = expr_str.strip()
    
    # Remove leading f(x)= or y=
    s = re.sub(r'^(f\s*\(\s*x\s*\)|y)\s*=\s*', '', s, flags=re.IGNORECASE)
    
    # Convert ^ to **
    s = s.replace('^', '**')
    
    # Common function standardizations
    s = re.sub(r'\bln\b', 'log', s, flags=re.IGNORECASE)
    s = re.sub(r'\barcsin\b', 'asin', s, flags=re.IGNORECASE)
    s = re.sub(r'\barccos\b', 'acos', s, flags=re.IGNORECASE)
    s = re.sub(r'\barctan\b', 'atan', s, flags=re.IGNORECASE)
    
    # Natural exponential e^x -> exp(x)
    s = re.sub(r'\be\s*\*\*\s*([a-zA-Z0-9_]+)', r'exp(\1)', s)
    s = re.sub(r'\be\s*\*\*\s*\((.*?)\)', r'exp(\1)', s)
    
    # Insert multiplication between numbers and variables: 2x -> 2*x, 3sin(x) -> 3*sin(x)
    s = re.sub(r'(\d)\s*([a-zA-Z\(])', r'\1*\2', s)
    # Insert multiplication between closing paren and variable/number: )x -> )*x
    s = re.sub(r'(\))\s*([a-zA-Z0-9\(])', r'\1*\2', s)
    # Insert multiplication between variable and opening paren (except known function names)
    funcs = ['sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'asin', 'acos', 'atan', 'abs']
    for f in funcs:
        s = re.sub(rf'\b{f}\b', f'__{f}__', s)
    s = re.sub(r'([a-zA-Z0-9])\s*\(', r'\1*(', s)
    for f in funcs:
        s = s.replace(f'__{f}__*(', f'{f}(')
        s = s.replace(f'__{f}__', f)
        
    return s.strip()


def derive_with_existing_engine(expr_str: str) -> Tuple[Optional[str], Optional[str], List[Dict[str, str]]]:
    """
    Use existing derivative.py engine to compute first derivative with step-by-step rules.
    Falls back gracefully if expression contains unsupported AST structures.
    """
    steps = []
    if not derivative or not parse_expr:
        return None, None, steps

    try:
        # Standardize for parse_expr (converts ** to ^)
        ast_input = expr_str.replace('**', '^')
        node = parse_expr(ast_input)
        result_node, math_steps = derivative.derive(node)
        
        for ms in math_steps:
            steps.append({
                "description": ms.description,
                "latex": ms.latex
            })
            
        return to_string(result_node), to_latex(result_node), steps
    except Exception:
        return None, None, []


def integrate_with_existing_engine(expr_str: str) -> Tuple[Optional[str], Optional[str], List[Dict[str, str]]]:
    """
    Use existing integral.py engine to compute indefinite integral with step-by-step rules.
    """
    steps = []
    if not integral or not parse_expr:
        return None, None, steps

    try:
        ast_input = expr_str.replace('**', '^')
        node = parse_expr(ast_input)
        result_node, math_steps = integral.integrate_node(node)
        
        for ms in math_steps:
            steps.append({
                "description": ms.description,
                "latex": ms.latex
            })
            
        return to_string(result_node) + " + C", to_latex(result_node) + " + C", steps
    except Exception:
        return None, None, []


def solve_equation_with_existing_engine(eq_str: str) -> Tuple[Optional[str], List[Dict[str, str]]]:
    """
    Use existing algebra.py engine (solve_algebra_pure / quadratic_equation_solver)
    to solve algebraic equations with rich step-by-step factoring and reasoning.
    """
    steps = []
    if not algebra:
        return None, steps

    try:
        sol_str, math_steps = algebra.solve_algebra_pure(eq_str)
        for ms in math_steps:
            steps.append({
                "description": ms.description,
                "latex": ms.latex
            })
        return sol_str, steps
    except Exception:
        return None, []


def analyze_function(expr_str: str, domain_min: float = -10.0, domain_max: float = 10.0) -> Dict[str, Any]:
    """
    Perform deep mathematical analysis of a 1D single-variable real function f(x).
    Generates full step-by-step mathematical reasoning using existing engines and SymPy.
    """
    cleaned_expr = clean_expression_str(expr_str)
    x = sp.Symbol('x', real=True)
    
    # Parse into SymPy for exact mathematical properties
    try:
        f = sp.sympify(cleaned_expr, locals={'x': x, 'e': sp.E, 'pi': sp.pi})
    except Exception as e:
        raise ValueError(f"Could not parse function '{expr_str}': {str(e)}")
        
    f_latex = sp.latex(f)
    
    # ─────────────────────────────────────────────────────────────
    # 1. First Derivative f'(x) using existing derivative.py engine
    # ─────────────────────────────────────────────────────────────
    existing_df_str, existing_df_latex, derivative_steps = derive_with_existing_engine(cleaned_expr)
    
    try:
        df = sp.diff(f, x)
        df_latex = sp.latex(df)
        df_str = str(df).replace('**', '^')
    except Exception:
        df = None
        df_latex = existing_df_latex or "N/A"
        df_str = existing_df_str or "N/A"

    # If existing engine steps were empty (e.g. rational or advanced function), build steps with SymPy rules
    if not derivative_steps and df is not None:
        derivative_steps.append({
            "description": "Original Function Definition",
            "latex": f"f(x) = {f_latex}"
        })
        numer, denom = sp.fraction(f)
        if denom != 1:
            derivative_steps.append({
                "description": "Apply Calculus Quotient Rule: [u/v]' = (u'v - uv') / v^2",
                "latex": r"\frac{d}{dx}\left[\frac{u}{v}\right] = \frac{u'v - uv'}{v^2}"
            })
            derivative_steps.append({
                "description": f"Differentiate numerator u = {sp.latex(numer)} and denominator v = {sp.latex(denom)}",
                "latex": rf"u' = {sp.latex(sp.diff(numer, x))}, \quad v' = {sp.latex(sp.diff(denom, x))}"
            })
        else:
            derivative_steps.append({
                "description": "Differentiate each term with the Sum and Power Rules",
                "latex": rf"\frac{{d}}{{dx}}\left[{f_latex}\right] = {df_latex}"
            })
        derivative_steps.append({
            "description": "Simplify derivative expression to obtain f'(x)",
            "latex": f"f'(x) = {df_latex}"
        })

    # ─────────────────────────────────────────────────────────────
    # 2. Second Derivative f''(x) using existing derivative.py engine
    # ─────────────────────────────────────────────────────────────
    d2f = None
    d2f_steps = []
    if df is not None:
        try:
            _, _, d2f_steps = derive_with_existing_engine(df_str)
            d2f = sp.diff(df, x)
            d2f_latex = sp.latex(d2f)
            d2f_str = str(d2f).replace('**', '^')
        except Exception:
            d2f = None
            d2f_latex = "N/A"
            d2f_str = "N/A"
    else:
        d2f_latex = "N/A"
        d2f_str = "N/A"

    # ─────────────────────────────────────────────────────────────
    # 3. Indefinite Integral using existing integral.py engine
    # ─────────────────────────────────────────────────────────────
    existing_int_str, existing_int_latex, integral_steps = integrate_with_existing_engine(cleaned_expr)
    
    try:
        indef_int = sp.integrate(f, x)
        int_latex = sp.latex(indef_int) + " + C"
        int_str = str(indef_int).replace('**', '^') + " + C"
    except Exception:
        int_latex = existing_int_latex or "\\int f(x)\\,dx"
        int_str = existing_int_str or "N/A"

    if not integral_steps and indef_int is not None:
        integral_steps.append({
            "description": "Set up the indefinite integral",
            "latex": rf"\int \left({f_latex}\right)\,dx"
        })
        integral_steps.append({
            "description": "Integrate term by term applying the power rule ∫x^n dx = x^(n+1)/(n+1) and linearity",
            "latex": rf"\int f(x)\,dx = {int_latex}"
        })

    # ─────────────────────────────────────────────────────────────
    # 4. Y-Intercept f(0) using existing algebra.py function_value
    # ─────────────────────────────────────────────────────────────
    y_intercept = None
    y_intercept_steps = []
    try:
        if algebra:
            y_val_num, y_val_steps = algebra.function_value(cleaned_expr.replace('**', '^'), 0.0)
            for ms in y_val_steps:
                y_intercept_steps.append({"description": ms.description, "latex": ms.latex})
        y0_val = f.subs(x, 0)
        if y0_val.is_real and not (y0_val.is_infinite or y0_val == sp.nan):
            y_float = float(y0_val.evalf())
            y_intercept = {
                "x": 0.0,
                "y": round(y_float, 4),
                "latex": f"(0, {sp.latex(y0_val)})"
            }
            if not y_intercept_steps:
                y_intercept_steps.append({
                    "description": "Substitute x = 0 into the function f(x)",
                    "latex": rf"f(0) = {sp.latex(y0_val)}"
                })
    except Exception:
        pass

    # ─────────────────────────────────────────────────────────────
    # 5. Roots / Zeros f(x) = 0 using existing algebra.py solver
    # ─────────────────────────────────────────────────────────────
    roots = []
    seen_roots = set()
    root_eq_str = f"{cleaned_expr.replace('**', '^')} = 0"
    _, roots_steps = solve_equation_with_existing_engine(root_eq_str)

    try:
        roots_sym = sp.solve(f, x)
        for r in roots_sym:
            try:
                if r.is_real and not r.is_infinite:
                    rf = float(r.evalf())
                    r_round = round(rf, 4)
                    if r_round not in seen_roots:
                        seen_roots.add(r_round)
                        roots.append({
                            "x": r_round,
                            "latex": sp.latex(r),
                            "exact": str(r)
                        })
            except Exception:
                continue
    except Exception:
        pass

    # Numerical fallback for roots if symbolic failed
    if not roots:
        try:
            steps = 400
            dx = (domain_max - domain_min) / steps
            f_eval = sp.lambdify(x, f, modules=['math'])
            prev_y = None
            prev_x = domain_min
            for i in range(steps + 1):
                cur_x = domain_min + i * dx
                try:
                    cur_y = f_eval(cur_x)
                    if not math.isnan(cur_y) and not math.isinf(cur_y):
                        if prev_y is not None and prev_y * cur_y <= 0:
                            root_approx = cur_x if abs(cur_y) < abs(prev_y) else prev_x
                            r_round = round(root_approx, 4)
                            if r_round not in seen_roots:
                                seen_roots.add(r_round)
                                roots.append({
                                    "x": r_round,
                                    "latex": f"\\approx {r_round}",
                                    "exact": str(r_round)
                                })
                        prev_y = cur_y
                        prev_x = cur_x
                except Exception:
                    prev_y = None
        except Exception:
            pass

    # ─────────────────────────────────────────────────────────────
    # 6. Critical Points & Extrema (Max / Min) with existing algebra
    # ─────────────────────────────────────────────────────────────
    extrema = []
    seen_crit = set()
    critical_points_steps = []
    extrema_test_steps = []

    if df is not None:
        # Use existing algebra engine to solve f'(x) = 0 with steps
        df_eq_str = f"{df_str} = 0"
        _, critical_points_steps = solve_equation_with_existing_engine(df_eq_str)

        try:
            crit_sols = sp.solve(df, x)
            for c in crit_sols:
                try:
                    if c.is_real and not c.is_infinite:
                        cf = float(c.evalf())
                        c_round = round(cf, 4)
                        if c_round not in seen_crit:
                            seen_crit.add(c_round)
                            y_val = f.subs(x, c)
                            yf = float(y_val.evalf())
                            
                            # Second derivative test
                            curv = d2f.subs(x, c) if d2f is not None else 0
                            curv_f = float(curv.evalf()) if (curv is not None and curv.is_real) else 0.0
                                
                            if curv_f < -1e-7:
                                e_type = "local_max"
                                label = "Local Maximum"
                                test_expl = f"f''({c_round}) = {round(curv_f, 4)} < 0 \\implies \\text{{Local Maximum}}"
                            elif curv_f > 1e-7:
                                e_type = "local_min"
                                label = "Local Minimum"
                                test_expl = f"f''({c_round}) = {round(curv_f, 4)} > 0 \\implies \\text{{Local Minimum}}"
                            else:
                                e_type = "saddle"
                                label = "Stationary / Saddle Point"
                                test_expl = f"f''({c_round}) = 0 \\implies \\text{{Inconclusive / Saddle Point}}"

                            extrema_test_steps.append({
                                "description": f"Test critical point x = {c_round} in f''(x) to classify extremum",
                                "latex": rf"f''\left({sp.latex(c)}\right) = {sp.latex(curv)} \implies \textbf{{{label}}} \text{{ at }} ({c_round}, {round(yf, 4)})"
                            })
                                
                            extrema.append({
                                "x": c_round,
                                "y": round(yf, 4),
                                "type": e_type,
                                "label": label,
                                "x_latex": sp.latex(c),
                                "y_latex": sp.latex(y_val),
                                "test_value": round(curv_f, 4)
                            })
                except Exception:
                    continue
        except Exception:
            pass

    # Fallback numerical extrema detection if symbolic solve did not find points
    if not extrema and df is not None:
        try:
            f_eval = sp.lambdify(x, f, modules=['math'])
            df_eval = sp.lambdify(x, df, modules=['math'])
            d2f_eval = sp.lambdify(x, d2f, modules=['math']) if d2f is not None else None
            steps = 400
            dx = (domain_max - domain_min) / steps
            prev_df = None
            prev_x = domain_min
            for i in range(steps + 1):
                cur_x = domain_min + i * dx
                try:
                    cur_df = df_eval(cur_x)
                    if not math.isnan(cur_df) and not math.isinf(cur_df):
                        if prev_df is not None and prev_df * cur_df <= 0:
                            cx = round(cur_x if abs(cur_df) < abs(prev_df) else prev_x, 4)
                            if cx not in seen_crit:
                                seen_crit.add(cx)
                                cy = round(float(f_eval(cx)), 4)
                                curv_val = float(d2f_eval(cx)) if d2f_eval else (cur_df - prev_df)/dx
                                if curv_val < -1e-6:
                                    e_type = "local_max"
                                    label = "Local Maximum"
                                elif curv_val > 1e-6:
                                    e_type = "local_min"
                                    label = "Local Minimum"
                                else:
                                    e_type = "saddle"
                                    label = "Stationary Point"
                                extrema.append({
                                    "x": cx,
                                    "y": cy,
                                    "type": e_type,
                                    "label": label,
                                    "x_latex": f"\\approx {cx}",
                                    "y_latex": f"\\approx {cy}",
                                    "test_value": round(curv_val, 4)
                                })
                        prev_df = cur_df
                        prev_x = cur_x
                except Exception:
                    prev_df = None
        except Exception:
            pass

    extrema.sort(key=lambda item: item["x"])

    # ─────────────────────────────────────────────────────────────
    # 7. Inflection Points f''(x) = 0 with existing algebra engine
    # ─────────────────────────────────────────────────────────────
    inflection_points = []
    seen_infl = set()
    inflection_steps = []

    if d2f is not None:
        d2f_eq_str = f"{d2f_str} = 0"
        _, inflection_steps = solve_equation_with_existing_engine(d2f_eq_str)

        try:
            infl_sols = sp.solve(d2f, x)
            for inf in infl_sols:
                try:
                    if inf.is_real and not inf.is_infinite:
                        inf_f = float(inf.evalf())
                        inf_round = round(inf_f, 4)
                        if inf_round not in seen_infl:
                            seen_infl.add(inf_round)
                            y_val = f.subs(x, inf)
                            yf = float(y_val.evalf())
                            inflection_points.append({
                                "x": inf_round,
                                "y": round(yf, 4),
                                "x_latex": sp.latex(inf),
                                "y_latex": sp.latex(y_val)
                            })
                except Exception:
                    continue
        except Exception:
            pass
            
    inflection_points.sort(key=lambda item: item["x"])

    # ─────────────────────────────────────────────────────────────
    # 8. Asymptotes & Discontinuities
    # ─────────────────────────────────────────────────────────────
    asymptotes = {
        "vertical": [],
        "horizontal": [],
        "oblique": []
    }
    
    # Vertical asymptotes from denominator singularities
    try:
        numer, denom = sp.fraction(f)
        if denom != 1:
            d_roots = sp.solve(denom, x)
            seen_va = set()
            for dr in d_roots:
                try:
                    if dr.is_real and not dr.is_infinite:
                        va_val = round(float(dr.evalf()), 4)
                        if va_val not in seen_va:
                            seen_va.add(va_val)
                            asymptotes["vertical"].append({
                                "x": va_val,
                                "latex": f"x = {sp.latex(dr)}"
                            })
                except Exception:
                    pass
    except Exception:
        pass
        
    # Horizontal asymptotes: lim_{x -> +/-oo} f(x)
    try:
        lim_pos = sp.limit(f, x, sp.oo)
        seen_ha = set()
        if lim_pos.is_real and not lim_pos.is_infinite:
            ha_val = round(float(lim_pos.evalf()), 4)
            seen_ha.add(ha_val)
            asymptotes["horizontal"].append({
                "y": ha_val,
                "latex": f"y = {sp.latex(lim_pos)}"
            })
            
        lim_neg = sp.limit(f, x, -sp.oo)
        if lim_neg.is_real and not lim_neg.is_infinite:
            ha_neg_val = round(float(lim_neg.evalf()), 4)
            if ha_neg_val not in seen_ha:
                seen_ha.add(ha_neg_val)
                asymptotes["horizontal"].append({
                    "y": ha_neg_val,
                    "latex": f"y = {sp.latex(lim_neg)}"
                })
    except Exception:
        pass

    # Oblique / Slant Asymptotes: degree(num) == degree(den) + 1
    if not asymptotes["horizontal"]:
        try:
            m_lim = sp.limit(f / x, x, sp.oo)
            if m_lim.is_real and not m_lim.is_infinite and m_lim != 0:
                b_lim = sp.limit(f - m_lim * x, x, sp.oo)
                if b_lim.is_real and not b_lim.is_infinite:
                    m_f = round(float(m_lim.evalf()), 4)
                    b_f = round(float(b_lim.evalf()), 4)
                    b_sign = f"+ {b_f}" if b_f >= 0 else f"- {abs(b_f)}"
                    asymptotes["oblique"].append({
                        "m": m_f,
                        "b": b_f,
                        "latex": f"y = {sp.latex(m_lim)}x + {sp.latex(b_lim)}",
                        "expr": f"y = {m_f}x {b_sign}"
                    })
        except Exception:
            pass

    # ─────────────────────────────────────────────────────────────
    # 9. Symmetry & Parity
    # ─────────────────────────────────────────────────────────────
    symmetry = "None (Neither Even nor Odd)"
    try:
        f_neg = f.subs(x, -x)
        if sp.simplify(f_neg - f) == 0:
            symmetry = "Even Function (Symmetric across y-axis: f(-x) = f(x))"
        elif sp.simplify(f_neg + f) == 0:
            symmetry = "Odd Function (Point symmetry about origin: f(-x) = -f(x))"
    except Exception:
        pass

    # ─────────────────────────────────────────────────────────────
    # 10. Domain & Monotonicity
    # ─────────────────────────────────────────────────────────────
    domain_desc = "All Real Numbers (-\\infty, \\infty)"
    if asymptotes["vertical"]:
        excluded = ", ".join([f"x \\ne {va['x']}" for va in asymptotes["vertical"]])
        domain_desc = f"All real numbers except {excluded}"
    elif "sqrt" in str(f).lower() or "log" in str(f).lower():
        domain_desc = "Restricted real domain (check radicands \\ge 0, arguments > 0)"

    intervals_inc = []
    intervals_dec = []
    if extrema:
        crit_xs = sorted(list({item["x"] for item in extrema}))
        all_bounds = [domain_min] + crit_xs + [domain_max]
        for idx in range(len(all_bounds) - 1):
            mid_x = (all_bounds[idx] + all_bounds[idx + 1]) / 2.0
            try:
                test_df = float(df.subs(x, mid_x).evalf())
                interval_str = f"({all_bounds[idx]}, {all_bounds[idx+1]})"
                if test_df > 0:
                    intervals_inc.append(interval_str)
                else:
                    intervals_dec.append(interval_str)
            except Exception:
                pass

    # ─────────────────────────────────────────────────────────────
    # 11. Master Step-by-Step Pedagogical Derivations
    # ─────────────────────────────────────────────────────────────
    step_by_step = []

    # Step 1: Normalization
    step_by_step.append({
        "title": "Function Definition & Syntax Normalization",
        "latex": f"f(x) = {f_latex}",
        "explanation": f"The input function was parsed and canonicalized into exact mathematical form. Domain: {domain_desc}.",
        "category": "general"
    })

    # Step 2: First Derivative Derivation (from derivative.py)
    if derivative_steps:
        # Include top rule step
        step_by_step.append({
            "title": "First Derivative Computation f'(x)",
            "latex": f"f'(x) = \\frac{{d}}{{dx}}\\left[{f_latex}\\right] = {df_latex}",
            "explanation": f"Differentiated using core calculus rules (Sum, Power, Product, and Chain rules). Process generated {len(derivative_steps)} detailed algorithmic steps.",
            "category": "derivative"
        })
        for idx, ds in enumerate(derivative_steps[:6]):
            step_by_step.append({
                "title": f"Derivative Rule #{idx + 1}: {ds['description']}",
                "latex": ds["latex"],
                "explanation": f"Applied during symbolic differentiation of term.",
                "category": "derivative"
            })

    # Step 3: Critical Points Solving f'(x) = 0 (from algebra.py)
    if df is not None:
        step_by_step.append({
            "title": "Finding Stationary / Critical Points: f'(x) = 0",
            "latex": f"{df_latex} = 0",
            "explanation": "Set the first derivative equal to 0 to locate all points where the curve's instantaneous tangent is horizontal.",
            "category": "extrema"
        })
        for idx, cs in enumerate(critical_points_steps[:6]):
            step_by_step.append({
                "title": f"Solving Critical Point #{idx + 1}: {cs['description']}",
                "latex": cs["latex"],
                "explanation": "Algebraic reduction step to find critical roots.",
                "category": "extrema"
            })

    # Step 4: Second Derivative Test (Extrema Classification)
    if extrema_test_steps:
        step_by_step.append({
            "title": "Second Derivative Test (Extrema Classification)",
            "latex": f"f''(x) = {d2f_latex}",
            "explanation": "Evaluate f''(x) at each critical point to determine whether concavity corresponds to a local maximum (f'' < 0) or local minimum (f'' > 0).",
            "category": "extrema"
        })
        for es in extrema_test_steps:
            step_by_step.append({
                "title": es["description"],
                "latex": es["latex"],
                "explanation": "Determined by Second Derivative concavity test.",
                "category": "extrema"
            })

    # Step 5: Roots & Intercepts (from algebra.py)
    if roots_steps:
        step_by_step.append({
            "title": "Solving for Roots / X-Intercepts: f(x) = 0",
            "latex": f"{f_latex} = 0",
            "explanation": "Set f(x) to 0 and solve for the real roots using algebraic factorization and root theorems.",
            "category": "roots"
        })
        for idx, rs in enumerate(roots_steps[:6]):
            step_by_step.append({
                "title": f"Root Solving #{idx + 1}: {rs['description']}",
                "latex": rs["latex"],
                "explanation": "Factoring step applied to find function zeros.",
                "category": "roots"
            })

    # Step 6: Inflection Points f''(x) = 0
    if inflection_points:
        infl_strs = [f"({inf['x']}, {inf['y']})" for inf in inflection_points]
        step_by_step.append({
            "title": "Inflection Points & Concavity Flip f''(x) = 0",
            "latex": f"f''(x) = 0 \\implies " + ",\\; ".join(infl_strs),
            "explanation": "Points where the second derivative equals zero and changes sign, representing a transition in curvature.",
            "category": "inflection"
        })

    # Step 7: Indefinite Integral (from integral.py)
    if integral_steps:
        step_by_step.append({
            "title": "Antiderivative / Indefinite Integral ∫f(x) dx",
            "latex": f"\\int \\left({f_latex}\\right)\\,dx = {int_latex}",
            "explanation": f"Integrated using standard integration rules (Power rule, linearity, constant factor). Process generated {len(integral_steps)} steps.",
            "category": "integral"
        })
        for idx, is_step in enumerate(integral_steps[:6]):
            step_by_step.append({
                "title": f"Integration Rule #{idx + 1}: {is_step['description']}",
                "latex": is_step["latex"],
                "explanation": "Applied during antiderivative accumulation.",
                "category": "integral"
            })

    return {
        "expression": cleaned_expr,
        "latex": f_latex,
        "derivative_latex": df_latex,
        "derivative_expr": df_str,
        "second_derivative_latex": d2f_latex,
        "second_derivative_expr": d2f_str,
        "integral_latex": int_latex,
        "integral_expr": int_str,
        "domain": domain_desc,
        "y_intercept": y_intercept,
        "roots": roots,
        "extrema": extrema,
        "inflection_points": inflection_points,
        "asymptotes": asymptotes,
        "symmetry": symmetry,
        "monotonicity": {
            "increasing": intervals_inc,
            "decreasing": intervals_dec
        },
        "derivative_steps": derivative_steps,
        "critical_points_steps": critical_points_steps,
        "roots_steps": roots_steps,
        "extrema_steps": extrema_test_steps,
        "inflection_steps": inflection_steps,
        "integral_steps": integral_steps,
        "step_by_step": step_by_step
    }
