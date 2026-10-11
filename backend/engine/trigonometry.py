import math
import re
import ast
from typing import List, Dict, Any, Tuple, Optional, Union
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from math_models import MathStep

def fmt_num(val: Union[int, float]) -> str:
    """Format numeric values nicely for steps and LaTeX representations."""
    if abs(val - round(val)) < 1e-9:
        return str(int(round(val)))
    return f"{val:.4g}"

# ─────────────────────────────────────────────────────────────────────────────
# 1. SPECIAL ANGLES AND EXACT VALUES TABLE
# ─────────────────────────────────────────────────────────────────────────────

# Standard angles in radians from 0 to 2*pi with exact latex representation
SPECIAL_ANGLES = [
    # (radians_value, rad_latex, deg_value, sin_latex, sin_val, cos_latex, cos_val, tan_latex)
    (0.0, "0", 0, "0", 0.0, "1", 1.0, "0"),
    (math.pi / 6, r"\frac{\pi}{6}", 30, r"\frac{1}{2}", 0.5, r"\frac{\sqrt{3}}{2}", math.sqrt(3)/2, r"\frac{\sqrt{3}}{3}"),
    (math.pi / 4, r"\frac{\pi}{4}", 45, r"\frac{\sqrt{2}}{2}", math.sqrt(2)/2, r"\frac{\sqrt{2}}{2}", math.sqrt(2)/2, "1"),
    (math.pi / 3, r"\frac{\pi}{3}", 60, r"\frac{\sqrt{3}}{2}", math.sqrt(3)/2, r"\frac{1}{2}", 0.5, r"\sqrt{3}"),
    (math.pi / 2, r"\frac{\pi}{2}", 90, "1", 1.0, "0", 0.0, r"\text{undefined}"),
    (2 * math.pi / 3, r"\frac{2\pi}{3}", 120, r"\frac{\sqrt{3}}{2}", math.sqrt(3)/2, r"-\frac{1}{2}", -0.5, r"-\sqrt{3}"),
    (3 * math.pi / 4, r"\frac{3\pi}{4}", 135, r"\frac{\sqrt{2}}{2}", math.sqrt(2)/2, r"-\frac{\sqrt{2}}{2}", -math.sqrt(2)/2, "-1"),
    (5 * math.pi / 6, r"\frac{5\pi}{6}", 150, r"\frac{1}{2}", 0.5, r"-\frac{\sqrt{3}}{2}", -math.sqrt(3)/2, r"-\frac{\sqrt{3}}{3}"),
    (math.pi, r"\pi", 180, "0", 0.0, "-1", -1.0, "0"),
    (7 * math.pi / 6, r"\frac{7\pi}{6}", 210, r"-\frac{1}{2}", -0.5, r"-\frac{\sqrt{3}}{2}", -math.sqrt(3)/2, r"\frac{\sqrt{3}}{3}"),
    (5 * math.pi / 4, r"\frac{5\pi}{4}", 225, r"-\frac{\sqrt{2}}{2}", -math.sqrt(2)/2, r"-\frac{\sqrt{2}}{2}", -math.sqrt(2)/2, "1"),
    (4 * math.pi / 3, r"\frac{4\pi}{3}", 240, r"-\frac{\sqrt{3}}{2}", -math.sqrt(3)/2, r"-\frac{1}{2}", -0.5, r"\sqrt{3}"),
    (3 * math.pi / 2, r"\frac{3\pi}{2}", 270, "-1", -1.0, "0", 0.0, r"\text{undefined}"),
    (5 * math.pi / 3, r"\frac{5\pi}{3}", 300, r"-\frac{\sqrt{3}}{2}", -math.sqrt(3)/2, r"\frac{1}{2}", 0.5, r"-\sqrt{3}"),
    (7 * math.pi / 4, r"\frac{7\pi}{4}", 315, r"-\frac{\sqrt{2}}{2}", -math.sqrt(2)/2, r"\frac{\sqrt{2}}{2}", math.sqrt(2)/2, "-1"),
    (11 * math.pi / 6, r"\frac{11\pi}{6}", 330, r"-\frac{1}{2}", -0.5, r"\frac{\sqrt{3}}{2}", math.sqrt(3)/2, r"-\frac{\sqrt{3}}{3}"),
    (2 * math.pi, r"2\pi", 360, "0", 0.0, "1", 1.0, "0"),
]

def find_special_angle(rad_val: float) -> Optional[Tuple]:
    # Normalize to [0, 2pi)
    normalized = rad_val % (2 * math.pi)
    if normalized < 0:
        normalized += 2 * math.pi
    for entry in SPECIAL_ANGLES:
        if abs(entry[0] - normalized) < 1e-4:
            return entry
    return None

def parse_angle(angle_str: str) -> Tuple[float, float, str]:
    """Parse angle string into (radians, degrees, latex_str)."""
    s = angle_str.strip().lower()
    
    # Check degree notation
    if 'deg' in s or '°' in s:
        s_clean = s.replace('deg', '').replace('°', '').strip()
        deg = float(s_clean)
        rad = math.radians(deg)
        return rad, deg, f"{fmt_num(deg)}^\\circ"
        
    # Check pi expressions
    if 'pi' in s:
        s_eval = s.replace('pi', str(math.pi)).replace('^', '**')
        # Common fractions: pi/6, pi/4, pi/3, pi/2, 2*pi/3, 3*pi/4, 5*pi/6, pi, 3*pi/2, 2*pi
        rad = float(eval(s_eval, {"__builtins__": {}}, {}))
        deg = math.degrees(rad)
        latex_str = s.replace('pi', r'\pi').replace('*', '')
        return rad, deg, latex_str
        
    # Numerical assumed radian unless > 2*pi and user clearly typed degrees
    val = float(s)
    if abs(val) > 2 * math.pi:
        # User probably entered degrees (e.g. 45, 90, 180)
        deg = val
        rad = math.radians(deg)
        return rad, deg, f"{fmt_num(deg)}^\\circ"
    else:
        rad = val
        deg = math.degrees(rad)
        return rad, deg, f"{fmt_num(rad)} \\text{{ rad}}"

# ─────────────────────────────────────────────────────────────────────────────
# 2. UNIT CIRCLE ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def unit_circle(angle_input: str) -> Tuple[Dict[str, Any], List[MathStep]]:
    """Compute unit circle coordinates, quadrant, reference angle, and trig ratios."""
    rad, deg, angle_latex = parse_angle(angle_input)
    
    # Normalize to [0, 2*pi) and [0, 360)
    norm_deg = deg % 360.0
    if norm_deg < 0:
        norm_deg += 360.0
    norm_rad = math.radians(norm_deg)
    
    # Determine Quadrant
    if norm_deg == 0 or norm_deg == 360:
        quadrant = "Positive x-axis"
        ref_deg = 0.0
    elif norm_deg == 90:
        quadrant = "Positive y-axis"
        ref_deg = 90.0
    elif norm_deg == 180:
        quadrant = "Negative x-axis"
        ref_deg = 0.0
    elif norm_deg == 270:
        quadrant = "Negative y-axis"
        ref_deg = 90.0
    elif 0 < norm_deg < 90:
        quadrant = "Quadrant I (All trig positive)"
        ref_deg = norm_deg
    elif 90 < norm_deg < 180:
        quadrant = "Quadrant II (Sine positive, Cosine negative)"
        ref_deg = 180 - norm_deg
    elif 180 < norm_deg < 270:
        quadrant = "Quadrant III (Tangent positive, Sine/Cosine negative)"
        ref_deg = norm_deg - 180
    else:
        quadrant = "Quadrant IV (Cosine positive, Sine negative)"
        ref_deg = 360 - norm_deg
        
    ref_rad = math.radians(ref_deg)
    cos_val = math.cos(norm_rad)
    sin_val = math.sin(norm_rad)
    tan_val = math.tan(norm_rad) if abs(cos_val) > 1e-9 else None
    
    # Check special angle exact values
    sp = find_special_angle(norm_rad)
    if sp:
        sin_latex = sp[3]
        cos_latex = sp[5]
        tan_latex = sp[7]
        rad_exact_latex = sp[1]
    else:
        sin_latex = f"{sin_val:.4g}"
        cos_latex = f"{cos_val:.4g}"
        tan_latex = f"{tan_val:.4g}" if tan_val is not None else r"\text{undefined}"
        rad_exact_latex = f"{norm_rad:.4g}"

    # Visual Shapes for coordinate graph
    unit_circle_shape = {"type": "circle", "center": [0.0, 0.0], "radius": 1.0, "color": "BLUE"}
    terminal_ray = {"type": "line", "p1": [0.0, 0.0], "p2": [cos_val, sin_val], "label": f"Ray ({fmt_num(norm_deg)}°)"}
    cos_proj = {"type": "line", "p1": [0.0, 0.0], "p2": [cos_val, 0.0], "label": f"cos={cos_latex}"}
    sin_proj = {"type": "line", "p1": [cos_val, 0.0], "p2": [cos_val, sin_val], "label": f"sin={sin_latex}"}

    steps = [
        MathStep(
            description=f"Angle Specification: theta = {angle_latex} = {fmt_num(norm_deg)} deg",
            latex=rf"\theta = {rad_exact_latex} = {fmt_num(norm_deg)}^\circ \quad \left(\text{{{quadrant}}}\right)",
            type="geometry",
            data={"shapes": [unit_circle_shape, terminal_ray]}
        ),
        MathStep(
            description=f"Calculate reference angle in acute domain: theta_ref = {fmt_num(ref_deg)} deg",
            latex=rf"\theta_{{\text{{ref}}}} = {fmt_num(ref_deg)}^\circ",
            type="geometry",
            data={"shapes": [unit_circle_shape, terminal_ray, cos_proj]}
        ),
        MathStep(
            description="Terminal point coordinates (x, y) = (cos theta, sin theta) on unit circle x^2 + y^2 = 1",
            latex=rf"(x, y) = (\cos\theta, \; \sin\theta) = \left({cos_latex}, \; {sin_latex}\right)",
            type="geometry",
            data={"shapes": [unit_circle_shape, terminal_ray, cos_proj, sin_proj]}
        ),
        MathStep(
            description=f"Primary trigonometric function values at theta = {fmt_num(norm_deg)} deg",
            latex=rf"\sin({fmt_num(norm_deg)}^\circ) = {sin_latex}, \quad \cos({fmt_num(norm_deg)}^\circ) = {cos_latex}, \quad \tan({fmt_num(norm_deg)}^\circ) = {tan_latex}",
            type="geometry",
            data={"shapes": [unit_circle_shape, terminal_ray, cos_proj, sin_proj]}
        )
    ]
    
    return {
        "deg": norm_deg,
        "rad": norm_rad,
        "cos": cos_val,
        "sin": sin_val,
        "tan": tan_val,
        "cos_latex": cos_latex,
        "sin_latex": sin_latex,
        "tan_latex": tan_latex
    }, steps

# ─────────────────────────────────────────────────────────────────────────────
# 3. TRIGONOMETRIC EVALUATION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_trig(expr_str: str) -> Tuple[str, List[MathStep]]:
    """Evaluate trigonometric expressions like sin(pi/6), cos(45 deg), tan(pi/4), etc."""
    s = expr_str.strip()
    
    # Check simple function calls: func(arg)
    m = re.match(r'^(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan)\((.*?)\)$', s, re.I)
    if m:
        func = m.group(1).lower()
        arg_str = m.group(2).strip()
        
        # Inverse functions
        if func in ['arcsin', 'asin', 'arccos', 'acos', 'arctan', 'atan']:
            val = float(eval(arg_str.replace('sqrt', 'math.sqrt'), {"math": math}, {}))
            if func in ['arcsin', 'asin']:
                if abs(val) > 1.0:
                    raise ValueError(f"Domain error: arcsin argument must be in [-1, 1], got {val}")
                rad = math.asin(val)
                deg = math.degrees(rad)
                sp = find_special_angle(rad)
                res_latex = sp[1] if sp else f"{rad:.4g}"
                steps = [
                    MathStep(
                        description=f"Evaluate inverse sine: arcsin({fmt_num(val)})",
                        latex=rf"\arcsin({fmt_num(val)}) = \theta \iff \sin(\theta) = {fmt_num(val)}, \quad \theta \in \left[-\frac{{\pi}}{{2}}, \frac{{\pi}}{{2}}\right]",
                        type="equation"
                    ),
                    MathStep(
                        description=f"Angle in principal range whose sine is {fmt_num(val)}",
                        latex=rf"\arcsin({fmt_num(val)}) = {res_latex} = {deg:.2f}^\circ",
                        type="equation"
                    )
                ]
                return f"{res_latex} ({deg:.2f} deg)", steps
                
            elif func in ['arccos', 'acos']:
                if abs(val) > 1.0:
                    raise ValueError(f"Domain error: arccos argument must be in [-1, 1], got {val}")
                rad = math.acos(val)
                deg = math.degrees(rad)
                sp = find_special_angle(rad)
                res_latex = sp[1] if sp else f"{rad:.4g}"
                steps = [
                    MathStep(
                        description=f"Evaluate inverse cosine: arccos({fmt_num(val)})",
                        latex=rf"\arccos({fmt_num(val)}) = \theta \iff \cos(\theta) = {fmt_num(val)}, \quad \theta \in [0, \pi]",
                        type="equation"
                    ),
                    MathStep(
                        description=f"Angle in principal range whose cosine is {fmt_num(val)}",
                        latex=rf"\arccos({fmt_num(val)}) = {res_latex} = {deg:.2f}^\circ",
                        type="equation"
                    )
                ]
                return f"{res_latex} ({deg:.2f} deg)", steps
                
            elif func in ['arctan', 'atan']:
                rad = math.atan(val)
                deg = math.degrees(rad)
                sp = find_special_angle(rad)
                res_latex = sp[1] if sp else f"{rad:.4g}"
                steps = [
                    MathStep(
                        description=f"Evaluate inverse tangent: arctan({fmt_num(val)})",
                        latex=rf"\arctan({fmt_num(val)}) = \theta \iff \tan(\theta) = {fmt_num(val)}, \quad \theta \in \left(-\frac{{\pi}}{{2}}, \frac{{\pi}}{{2}}\right)",
                        type="equation"
                    ),
                    MathStep(
                        description=f"Angle in principal range whose tangent is {fmt_num(val)}",
                        latex=rf"\arctan({fmt_num(val)}) = {res_latex} = {deg:.2f}^\circ",
                        type="equation"
                    )
                ]
                return f"{res_latex} ({deg:.2f} deg)", steps
                
        # Forward trigonometric functions
        rad, deg, angle_latex = parse_angle(arg_str)
        sp = find_special_angle(rad)
        
        if func == 'sin':
            val = math.sin(rad)
            res_latex = sp[3] if sp else f"{val:.4g}"
            fname = r"\sin"
        elif func == 'cos':
            val = math.cos(rad)
            res_latex = sp[5] if sp else f"{val:.4g}"
            fname = r"\cos"
        elif func == 'tan':
            if abs(math.cos(rad)) < 1e-9:
                return r"\text{undefined}", [MathStep(f"cos({angle_latex}) = 0, so tan is undefined (vertical asymptote)", r"\tan\theta = \frac{\sin\theta}{\cos\theta} \implies \text{undefined}", "equation")]
            val = math.tan(rad)
            res_latex = sp[7] if sp else f"{val:.4g}"
            fname = r"\tan"
        elif func == 'sec':
            if abs(math.cos(rad)) < 1e-9:
                return r"\text{undefined}", [MathStep(f"cos({angle_latex}) = 0, so sec is undefined", r"\sec\theta = \frac{1}{\cos\theta} \implies \text{undefined}", "equation")]
            val = 1.0 / math.cos(rad)
            res_latex = f"{val:.4g}"
            fname = r"\sec"
        elif func == 'csc':
            if abs(math.sin(rad)) < 1e-9:
                return r"\text{undefined}", [MathStep(f"sin({angle_latex}) = 0, so csc is undefined", r"\csc\theta = \frac{1}{\sin\theta} \implies \text{undefined}", "equation")]
            val = 1.0 / math.sin(rad)
            res_latex = f"{val:.4g}"
            fname = r"\csc"
        else: # cot
            if abs(math.sin(rad)) < 1e-9:
                return r"\text{undefined}", [MathStep(f"sin({angle_latex}) = 0, so cot is undefined", r"\cot\theta = \frac{\cos\theta}{\sin\theta} \implies \text{undefined}", "equation")]
            val = math.cos(rad) / math.sin(rad)
            res_latex = f"{val:.4g}"
            fname = r"\cot"

        steps = [
            MathStep(
                description=f"Evaluate {fname}({angle_latex})",
                latex=rf"{fname}\left({angle_latex}\right)",
                type="equation"
            ),
            MathStep(
                description=f"Angle corresponds to {fmt_num(deg % 360)} deg on the unit circle",
                latex=rf"\theta = {fmt_num(deg % 360)}^\circ",
                type="equation"
            ),
            MathStep(
                description="Exact evaluation",
                latex=rf"{fname}\left({angle_latex}\right) = {res_latex}",
                type="equation"
            )
        ]
        return res_latex, steps

    # Fallback to SymPy evaluation if available
    try:
        import sympy as sp
        from main import safe_sympify
        sym_expr = safe_sympify(s, sp)
        evaluated = sp.simplify(sym_expr)
        res_latex = sp.latex(evaluated)
        steps = [
            MathStep(
                description=f"Simplify trigonometric expression: {s}",
                latex=rf"{sp.latex(sym_expr)}",
                type="equation"
            ),
            MathStep(
                description="Apply trigonometric identities and special values",
                latex=rf"= {res_latex}",
                type="equation"
            )
        ]
        return res_latex, steps
    except Exception:
        raise ValueError(f"Cannot evaluate trigonometric expression: {expr_str}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. TRIGONOMETRIC EQUATION SOLVER
# ─────────────────────────────────────────────────────────────────────────────

def solve_trig_equation(equation_str: str) -> Tuple[str, List[MathStep]]:
    """
    Solve trigonometric equations, e.g.:
    - sin(x) = 0.5
    - 2*sin(x) - 1 = 0
    - cos(x) = 1/2
    - tan(x) = 1
    - 2*sin(x)^2 + sin(x) - 1 = 0
    - sin(2x) = 1
    - sin(x) = cos(x)
    """
    eq = equation_str.replace(" ", "")
    steps = []
    
    # 1. Quadratic in Trig: a*sin(x)^2 + b*sin(x) + c = 0 or cos(x)
    quad_match = re.search(r'([+-]?\d*)\*?(sin|cos|tan)\(x\)\^2\s*([+-]\s*\d*)\*?(sin|cos|tan)\(x\)\s*([+-]\s*\d+)?\s*=\s*0', eq, re.I)
    if quad_match:
        a_str, f1, b_str, f2, c_str = quad_match.groups()
        if f1.lower() == f2.lower():
            func_name = f1.lower()
            a = float(a_str) if a_str and a_str not in ["+", "-"] else (-1.0 if a_str == "-" else 1.0)
            b = float(b_str.replace(" ", "")) if b_str and b_str not in ["+", "-"] else (-1.0 if "-" in b_str else 1.0)
            c = float(c_str.replace(" ", "")) if c_str else 0.0
            
            steps.append(MathStep(
                description=f"Quadratic trigonometric equation in {func_name}(x): {fmt_num(a)}u^2 + {fmt_num(b)}u + {fmt_num(c)} = 0 with u = {func_name}(x)",
                latex=rf"{fmt_num(a)}u^2 + {fmt_num(b)}u + {fmt_num(c)} = 0, \quad \text{{where }} u = \{func_name}(x)",
                type="equation"
            ))
            
            disc = b**2 - 4*a*c
            if disc < 0:
                steps.append(MathStep(
                    description=f"Discriminant Delta = b^2 - 4ac = {fmt_num(disc)} < 0: No real solutions",
                    latex=r"\Delta < 0 \implies \text{No real solutions}",
                    type="equation"
                ))
                return r"\text{No real solutions}", steps
                
            u1 = (-b + math.sqrt(disc)) / (2*a)
            u2 = (-b - math.sqrt(disc)) / (2*a)
            
            steps.append(MathStep(
                description="Solve for u via quadratic formula",
                latex=rf"u_1 = {fmt_num(u1)}, \quad u_2 = {fmt_num(u2)}",
                type="equation"
            ))
            
            all_sol_rad = []
            all_sol_deg = []
            
            for u_val in set([u1, u2]):
                if func_name in ['sin', 'cos'] and abs(u_val) > 1.0:
                    steps.append(MathStep(
                        description=f"Case {func_name}(x) = {fmt_num(u_val)}: rejected since |u| > 1",
                        latex=rf"|\{func_name}(x)| \le 1 \implies \{func_name}(x) = {fmt_num(u_val)} \text{{ has no real solutions}}",
                        type="equation"
                    ))
                    continue
                    
                sub_sol, sub_steps = solve_basic_trig(func_name, u_val)
                steps.extend(sub_steps)
                
            final_ans = "Combined solutions across roots in [0, 2pi)"
            return final_ans, steps

    # 2. Linear in Single Trig: a*func(k*x) = c or func(x) = c
    m_lin = re.match(r'^([+-]?\d*)\*?(sin|cos|tan)\((\d*)\*?x\)\s*([+-]\s*\d+)?\s*=\s*([+-]?\d+(?:\.\d+)?)\s*$', eq, re.I)
    if m_lin:
        a_str, func_name, k_str, const_left, rhs_str = m_lin.groups()
        a = float(a_str) if a_str and a_str not in ["+", "-"] else (-1.0 if a_str == "-" else 1.0)
        k = float(k_str) if k_str else 1.0
        c_left = float(const_left.replace(" ", "")) if const_left else 0.0
        rhs = float(rhs_str) if rhs_str else 0.0
        
        target_val = (rhs - c_left) / a
        
        steps.append(MathStep(
            description=f"Isolate {func_name}({fmt_num(k)}x)",
            latex=rf"\{func_name}({fmt_num(k)}x) = {fmt_num(target_val)}",
            type="equation"
        ))
        
        sol_text, trig_steps = solve_basic_trig(func_name.lower(), target_val, k=k)
        steps.extend(trig_steps)
        return sol_text, steps

    # 3. sin(x) = cos(x) -> tan(x) = 1
    if 'sin(x)=cos(x)' in eq or 'cos(x)=sin(x)' in eq:
        steps.append(MathStep(
            description="Divide both sides by cos(x) (assuming cos(x) != 0)",
            latex=r"\frac{\sin(x)}{\cos(x)} = 1 \implies \tan(x) = 1",
            type="equation"
        ))
        sol_text, trig_steps = solve_basic_trig('tan', 1.0)
        steps.extend(trig_steps)
        return sol_text, steps

    # 4. Linear combination: A*sin(x) + B*cos(x) = C or sin(x) = 1 - cos(x)
    try:
        import sympy as sp
        x_var = sp.Symbol('x')
        l_str, r_str = eq.split('=', 1) if '=' in eq else (eq, '0')
        from main import safe_sympify
        l_sym = safe_sympify(l_str, sp)
        r_sym = safe_sympify(r_str, sp)
        expr_sym = sp.expand(l_sym - r_sym)
        
        coeff_sin = expr_sym.coeff(sp.sin(x_var))
        coeff_cos = expr_sym.coeff(sp.cos(x_var))
        remainder = expr_sym - coeff_sin * sp.sin(x_var) - coeff_cos * sp.cos(x_var)
        
        if coeff_sin != 0 and coeff_cos != 0 and not remainder.has(x_var):
            A = float(coeff_sin)
            B = float(coeff_cos)
            C = -float(remainder)  # A*sin(x) + B*cos(x) = C
            
            R = math.hypot(A, B)
            phi = math.atan2(B, A)
            
            steps.append(MathStep(
                description="Rearrange into standard linear trigonometric form A*sin(x) + B*cos(x) = C",
                latex=rf"{fmt_num(A)}\sin(x) + {fmt_num(B)}\cos(x) = {fmt_num(C)}",
                type="equation"
            ))
            
            steps.append(MathStep(
                description=f"Apply harmonic addition theorem: R*sin(x + phi) with R = sqrt(A^2 + B^2) = {fmt_num(R)} and phi = atan2(B, A)",
                latex=rf"R = \sqrt{{{fmt_num(A)}^2 + {fmt_num(B)}^2}} = {fmt_num(R)}, \quad \phi = \arctan\left(\frac{{{fmt_num(B)}}}{{{fmt_num(A)}}}\right) \approx {fmt_num(phi)} \text{{ rad}}",
                type="equation"
            ))
            
            ratio = C / R
            if abs(ratio) > 1.0 + 1e-7:
                steps.append(MathStep(
                    description=f"|C/R| = |{fmt_num(ratio)}| > 1: sine cannot exceed 1, no real solutions exist",
                    latex=rf"\sin(x + \phi) = {fmt_num(ratio)} \implies \text{{No real solutions}}",
                    type="equation"
                ))
                return r"\text{No real solutions}", steps
                
            ratio = max(-1.0, min(1.0, ratio))
            steps.append(MathStep(
                description="Divide both sides by R to isolate the shifted sine",
                latex=rf"\sin\left(x + {fmt_num(phi)}\right) = {fmt_num(ratio)}",
                type="equation"
            ))
            
            sol_set = sp.solveset(expr_sym, x_var, domain=sp.Interval(0, 2*sp.pi, right_open=True))
            solutions = sorted(list(sol_set), key=lambda v: float(v)) if hasattr(sol_set, '__iter__') else []
            sol_latex_list = [sp.latex(s) for s in solutions]
            
            steps.append(MathStep(
                description="Determine principal angles in [0, 2pi)",
                latex=rf"x \in \left\{{ {', '.join(sol_latex_list)} \right\}}",
                type="equation"
            ))
            
            steps.append(MathStep(
                description="Add periodicity 2k*pi for general solutions (k in Z)",
                latex=rf"{', '.join([f'x = {s} + 2k\\pi' for s in sol_latex_list])} \quad (k \in \mathbb{{Z}})",
                type="equation"
            ))
            
            sol_summary = ", ".join([f"x = {s}" for s in sol_latex_list])
            return sol_summary, steps
    except Exception:
        pass

    # 4. General SymPy solver for arbitrary trig equations
    try:
        import sympy as sp
        from main import safe_sympify
        
        l_str, r_str = eq.split('=', 1) if '=' in eq else (eq, '0')
        l_sym = safe_sympify(l_str, sp)
        r_sym = safe_sympify(r_str, sp)
        eq_sym = sp.simplify(l_sym - r_sym)
        x_var = sp.Symbol('x')
        
        # Solve in [0, 2pi)
        sol_set = sp.solveset(eq_sym, x_var, domain=sp.Interval(0, 2*sp.pi, right_open=True))
        solutions = list(sol_set) if hasattr(sol_set, '__iter__') else []
        
        sol_latex_list = [sp.latex(s) for s in solutions]
        sol_summary = ", ".join([f"x = {s}" for s in sol_latex_list]) if sol_latex_list else "No solutions in [0, 2pi)"
        
        steps.append(MathStep(
            description="Convert equation to standard form f(x) = 0",
            latex=rf"{sp.latex(eq_sym)} = 0",
            type="equation"
        ))
        steps.append(MathStep(
            description="Find exact roots in principal domain x in [0, 2pi)",
            latex=rf"x \in \left\{{ {', '.join(sol_latex_list)} \right\}}",
            type="equation"
        ))
        steps.append(MathStep(
            description="Add periodicity for full general solutions (k in Z)",
            latex=r"x = \theta + 2k\pi \quad (k \in \mathbb{Z})",
            type="equation"
        ))
        return sol_summary, steps
    except Exception:
        raise ValueError(f"Unable to parse trigonometric equation: {equation_str}")

def solve_basic_trig(func: str, c: float, k: float = 1.0) -> Tuple[str, List[MathStep]]:
    """Solve func(k*x) = c for func in {'sin', 'cos', 'tan'}."""
    steps = []
    fname = rf"\{func}"
    
    if func in ['sin', 'cos'] and (c < -1.0 - 1e-9 or c > 1.0 + 1e-9):
        steps.append(MathStep(
            description=f"Since the range of {fname} is [-1, 1], there are no real solutions for {fname}(kx) = {fmt_num(c)}",
            latex=rf"\{func}({fmt_num(k)}x) = {fmt_num(c)} \implies \text{{No real solutions}}",
            type="equation"
        ))
        return r"\text{No real solutions}", steps

    # Find reference angle alpha = |arcsin/arccos/arctan(c)|
    if func == 'sin':
        ref_rad = math.asin(abs(c))
        # Solutions for u = k*x in [0, 2pi)
        if abs(c) < 1e-9:
            base_angles = [0.0, math.pi]
        elif c > 0:
            base_angles = [ref_rad, math.pi - ref_rad]
        else:
            base_angles = [math.pi + ref_rad, 2*math.pi - ref_rad]
            
    elif func == 'cos':
        ref_rad = math.acos(abs(c))
        if abs(c - 1.0) < 1e-9:
            base_angles = [0.0]
        elif abs(c + 1.0) < 1e-9:
            base_angles = [math.pi]
        elif c > 0:
            base_angles = [ref_rad, 2*math.pi - ref_rad]
        else:
            base_angles = [math.pi - ref_rad, math.pi + ref_rad]
            
    else: # tan
        ref_rad = math.atan(abs(c))
        if c >= 0:
            base_angles = [ref_rad, math.pi + ref_rad]
        else:
            base_angles = [math.pi - ref_rad, 2*math.pi - ref_rad]

    # Convert base angles for x = u / k
    x_solutions_rad = [ang / k for ang in base_angles]
    x_latex_list = []
    
    for ang in x_solutions_rad:
        sp = find_special_angle(ang)
        if sp:
            x_latex_list.append(sp[1])
        else:
            x_latex_list.append(f"{ang:.4g}")
            
    sol_str = ", ".join([f"x = {s}" for s in x_latex_list])
    
    steps.append(MathStep(
        description=f"Reference angle: alpha = {ref_rad:.4g} rad ({math.degrees(ref_rad):.2f} deg)",
        latex=rf"\alpha = \{func}^{{-1}}(|{fmt_num(c)}|) \approx {ref_rad:.4g}",
        type="equation"
    ))
    steps.append(MathStep(
        description="Identify quadrants matching sign and determine base angles in [0, 2pi)",
        latex=rf"{fmt_num(k)}x \in \left\{{ {', '.join(x_latex_list)} \right\}}",
        type="equation"
    ))
    steps.append(MathStep(
        description="General periodic solution (k in Z)",
        latex=r"x = \theta + 2k\pi \quad (k \in \mathbb{Z})" if func != 'tan' else r"x = \theta + k\pi \quad (k \in \mathbb{Z})",
        type="equation"
    ))
    
    return sol_str, steps

# ─────────────────────────────────────────────────────────────────────────────
# 5. TRIGONOMETRIC IDENTITIES SIMPLIFIER
# ─────────────────────────────────────────────────────────────────────────────

def simplify_trig_identity(expr_str: str) -> Tuple[str, List[MathStep]]:
    """Simplify identities such as sin(x)^2 + cos(x)^2, sin(2x), 1 + tan(x)^2, etc."""
    s = expr_str.strip()
    steps = []
    
    # 1. Fundamental Pythagorean: sin^2 + cos^2 = 1
    if 'sin(x)^2+cos(x)^2' in s.replace(' ', '') or 'cos(x)^2+sin(x)^2' in s.replace(' ', ''):
        steps.append(MathStep(
            description="Identify Fundamental Pythagorean Trigonometric Identity",
            latex=r"\sin^2(x) + \cos^2(x) \equiv 1",
            type="equation"
        ))
        steps.append(MathStep(
            description="Derived from unit circle x^2 + y^2 = 1 where x = cos(theta), y = sin(theta)",
            latex=r"\cos^2(x) + \sin^2(x) = 1",
            type="equation"
        ))
        return "1", steps

    # 2. 1 + tan(x)^2 = sec(x)^2
    if '1+tan(x)^2' in s.replace(' ', '') or 'tan(x)^2+1' in s.replace(' ', ''):
        steps.append(MathStep(
            description="Divide Pythagorean Identity sin^2(x) + cos^2(x) = 1 by cos^2(x)",
            latex=r"\frac{\sin^2(x)}{\cos^2(x)} + \frac{\cos^2(x)}{\cos^2(x)} = \frac{1}{\cos^2(x)}",
            type="equation"
        ))
        steps.append(MathStep(
            description="Substitute tan(x) = sin(x)/cos(x) and sec(x) = 1/cos(x)",
            latex=r"1 + \tan^2(x) = \sec^2(x)",
            type="equation"
        ))
        return r"\sec^2(x)", steps

    # 3. Double angle: sin(2x)
    if 'sin(2x)' in s.replace(' ', '') or 'sin(2*x)' in s.replace(' ', ''):
        steps.append(MathStep(
            description="Apply Sine Angle Addition Identity: sin(a + b) = sin(a)cos(b) + cos(a)sin(b) with a = b = x",
            latex=r"\sin(2x) = \sin(x + x) = \sin(x)\cos(x) + \cos(x)\sin(x)",
            type="equation"
        ))
        steps.append(MathStep(
            description="Combine like terms",
            latex=r"\sin(2x) = 2\sin(x)\cos(x)",
            type="equation"
        ))
        return r"2\sin(x)\cos(x)", steps

    # 4. Double angle: cos(2x)
    if 'cos(2x)' in s.replace(' ', '') or 'cos(2*x)' in s.replace(' ', ''):
        steps.append(MathStep(
            description="Apply Cosine Angle Addition Identity: cos(a + b) = cos(a)cos(b) - sin(a)sin(b) with a = b = x",
            latex=r"\cos(2x) = \cos(x + x) = \cos(x)\cos(x) - \sin(x)\sin(x)",
            type="equation"
        ))
        steps.append(MathStep(
            description="Forms: cos^2(x) - sin^2(x) = 2cos^2(x) - 1 = 1 - 2sin^2(x)",
            latex=r"\cos(2x) = \cos^2(x) - \sin^2(x)",
            type="equation"
        ))
        return r"\cos^2(x) - \sin^2(x)", steps

    # Fallback to SymPy trigonometric simplification
    try:
        import sympy as sp
        from main import safe_sympify
        sym_expr = safe_sympify(s, sp)
        simplified = sp.trigsimp(sym_expr)
        steps.append(MathStep(
            description=f"Given trigonometric expression: {s}",
            latex=rf"{sp.latex(sym_expr)}",
            type="equation"
        ))
        steps.append(MathStep(
            description="Apply trigonometric simplification rules",
            latex=rf"= {sp.latex(simplified)}",
            type="equation"
        ))
        return sp.latex(simplified), steps
    except Exception:
        raise ValueError(f"Unable to simplify trigonometric identity: {expr_str}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. UNIFIED DISPATCHER: solve_trigonometry
# ─────────────────────────────────────────────────────────────────────────────

def solve_trigonometry(input_str: str) -> Tuple[str, List[MathStep]]:
    """
    Intelligent trigonometry parser and dispatcher.
    Handles:
    - Unit circle: unit_circle(pi/4), unit_circle(45)
    - Trig equations: sin(x) = 0.5, 2*sin(x) - 1 = 0, cos(x) = 1/2
    - Evaluations: sin(pi/6), cos(45 deg), tan(pi/4), arcsin(0.5)
    - Identities: sin(x)^2 + cos(x)^2, 1 + tan(x)^2, sin(2x)
    """
    s = input_str.strip()
    s_lower = s.lower()
    
    # 1. Unit circle query
    if s_lower.startswith('unit_circle') or s_lower.startswith('unitcircle'):
        m = re.search(r'unit_?circle\((.*?)\)', s, re.I)
        arg = m.group(1).strip() if m else "pi/4"
        data, steps = unit_circle(arg)
        return f"cos={data['cos_latex']}, sin={data['sin_latex']}", steps

    # 2. Equation containing '='
    if '=' in s:
        return solve_trig_equation(s)
        
    # 3. Known identity patterns
    if ('sin' in s_lower or 'cos' in s_lower or 'tan' in s_lower) and ('^2' in s or '2x' in s or '2*x' in s):
        return simplify_trig_identity(s)
        
    # 4. Standard evaluation
    if any(func in s_lower for func in ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan']):
        return evaluate_trig(s)
        
    raise ValueError(f"Unrecognized trigonometric query: {input_str}")
