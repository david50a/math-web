"""
Comprehensive Complex Numbers Engine.
Supports:
1. Rectangular (Cartesian), Polar, Trigonometric, and Exponential forms.
2. Arithmetic: Addition, Subtraction, Multiplication (with angle addition), Division (conjugate rationalization).
3. Modulus (|z|), Argument (Arg(z) in radians and degrees), Complex Conjugate (z*).
4. Powers (z^n via De Moivre's Theorem).
5. n-th Roots of Complex Numbers (symmetrically distributed on circle in Argand plane).
6. Complex Quadratic & Polynomial Equations.
7. Geometry in the Argand Plane (distance, midpoint, circle |z - z_0| = R, rotation).
"""

import math
import cmath
import re
from typing import Dict, Any, List, Optional, Tuple, Union
import sympy as sp

def fmt_val(v: float, decimals: int = 4) -> str:
    """Format float cleanly, stripping trailing zeros if integer."""
    if abs(v - round(v)) < 1e-7:
        return str(int(round(v)))
    return f"{round(v, decimals):.{decimals}f}".rstrip('0').rstrip('.')

def clean_complex_str(s: str) -> str:
    """Standardize complex string (e.g. 3 + 4i -> 3 + 4*I)."""
    s = s.strip()
    # Replace i or j with I for sympy/parsing
    s = re.sub(r'(?<=\d)i\b', '*I', s, flags=re.IGNORECASE)
    s = re.sub(r'(?<=\d)j\b', '*I', s, flags=re.IGNORECASE)
    s = re.sub(r'\bi\b', 'I', s)
    s = re.sub(r'\bj\b', 'I', s)
    s = s.replace('^', '**')
    return s

def parse_complex_number(expr_str: str) -> Tuple[float, float, str]:
    """
    Parses a complex number expression into (real, imag, latex).
    Accepts: '3 + 4i', '2*exp(i*pi/3)', 'polar(2, pi/4)', 'sqrt(3) - i', etc.
    """
    cleaned = clean_complex_str(expr_str)
    
    # Check for polar format polar(r, theta) or cis(theta)
    polar_match = re.match(r'polar\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)', cleaned, re.IGNORECASE)
    if polar_match:
        r_expr = sp.sympify(polar_match.group(1))
        th_expr = sp.sympify(polar_match.group(2))
        r_val = float(r_expr.evalf())
        th_val = float(th_expr.evalf())
        real_val = r_val * math.cos(th_val)
        imag_val = r_val * math.sin(th_val)
        latex_str = sp.latex(r_expr * sp.exp(sp.I * th_expr))
        return real_val, imag_val, latex_str

    cis_match = re.match(r'cis\s*\(\s*([^)]+)\s*\)', cleaned, re.IGNORECASE)
    if cis_match:
        th_expr = sp.sympify(cis_match.group(1))
        th_val = float(th_expr.evalf())
        real_val = math.cos(th_val)
        imag_val = math.sin(th_val)
        latex_str = sp.latex(sp.exp(sp.I * th_expr))
        return real_val, imag_val, latex_str

    try:
        val = sp.sympify(cleaned)
        re_part = float(sp.re(val).evalf())
        im_part = float(sp.im(val).evalf())
        latex_str = sp.latex(val)
        return re_part, im_part, latex_str
    except Exception:
        # Fallback regex for standard a + bi
        m = re.match(r'^([+-]?\s*\d*\.?\d*)\s*([+-]\s*\d*\.?\d*)\s*[ij]$', expr_str.strip())
        if m:
            r_str = m.group(1).replace(" ", "")
            i_str = m.group(2).replace(" ", "")
            r_val = float(r_str) if r_str and r_str not in ['+', '-'] else (1.0 if r_str == '+' else (-1.0 if r_str == '-' else 0.0))
            i_val = float(i_str) if i_str and i_str not in ['+', '-'] else (1.0 if i_str == '+' else (-1.0 if i_str == '-' else 1.0))
            return r_val, i_val, f"{fmt_val(r_val)} + {fmt_val(i_val)}i"
        raise ValueError(f"Could not parse complex expression: {expr_str}")

def get_complex_details(real: float, imag: float, label: str = "z") -> Dict[str, Any]:
    """Generates all representations and polar quantities for a complex number."""
    modulus = math.hypot(real, imag)
    arg_rad = math.atan2(imag, real)
    arg_deg = math.degrees(arg_rad)
    
    # Format Cartesian LaTeX
    if abs(imag) < 1e-9:
        cartesian_latex = fmt_val(real)
    elif abs(real) < 1e-9:
        if abs(imag - 1.0) < 1e-9:
            cartesian_latex = "i"
        elif abs(imag + 1.0) < 1e-9:
            cartesian_latex = "-i"
        else:
            cartesian_latex = f"{fmt_val(imag)}i"
    else:
        sign = "+" if imag > 0 else "-"
        im_val_str = "" if abs(abs(imag) - 1.0) < 1e-9 else fmt_val(abs(imag))
        cartesian_latex = f"{fmt_val(real)} {sign} {im_val_str}i"

    # Format Polar & Exponential LaTeX
    r_str = fmt_val(modulus)
    th_deg_str = f"{fmt_val(arg_deg)}^\\circ"
    
    # Approximate nice fractions of pi
    pi_ratio = arg_rad / math.pi
    pi_latex = None
    common_denoms = [1, 2, 3, 4, 6, 12]
    for d in common_denoms:
        n = round(pi_ratio * d)
        if abs(pi_ratio - n / d) < 1e-4:
            if n == 0:
                pi_latex = "0"
            elif n == d:
                pi_latex = r"\pi"
            elif n == -d:
                pi_latex = r"-\pi"
            elif d == 1:
                pi_latex = f"{n}" + r"\pi"
            else:
                sign_str = "-" if n < 0 else ""
                num_str = "" if abs(n) == 1 else str(abs(n))
                pi_latex = f"{sign_str}" + r"\frac{" + f"{num_str}" + r"\pi}{" + f"{d}" + r"}"
            break
            
    angle_display = pi_latex if pi_latex else f"{fmt_val(arg_rad)} \\text{{ rad}}"
    
    polar_latex = f"{r_str} \\left(\\cos({angle_display}) + i \\sin({angle_display})\\right)"
    exponential_latex = f"{r_str} e^{{i ({angle_display})}}"
    cis_latex = f"{r_str} \\operatorname{{cis}}({th_deg_str})"

    return {
        "label": label,
        "real": round(real, 6),
        "imag": round(imag, 6),
        "modulus": round(modulus, 6),
        "argument_rad": round(arg_rad, 6),
        "argument_deg": round(arg_deg, 4),
        "angle_display": angle_display,
        "cartesian_latex": cartesian_latex,
        "polar_latex": polar_latex,
        "exponential_latex": exponential_latex,
        "cis_latex": cis_latex,
        "conjugate": {
            "real": round(real, 6),
            "imag": round(-imag, 6),
            "cartesian_latex": f"{fmt_val(real)} - {fmt_val(imag)}i" if imag > 0 else f"{fmt_val(real)} + {fmt_val(-imag)}i"
        }
    }

def solve_complex_operation(op: str, z1_str: str, z2_str: Optional[str] = None, n_val: Optional[int] = None) -> Dict[str, Any]:
    """
    Solves complex arithmetic, conversions, powers, roots, or geometry with detailed steps.
    op in: 'details', 'add', 'subtract', 'multiply', 'divide', 'power', 'roots', 'conjugate', 'distance', 'quadratic'
    """
    steps = []
    
    # 1. Quadratic solver special case: a*z^2 + b*z + c = 0
    if op == 'quadratic':
        # z1_str is equation e.g. "z^2 - 4*z + 13 = 0"
        eq_clean = clean_complex_str(z1_str)
        z = sp.Symbol('z')
        eq_parts = eq_clean.split('=')
        lhs = sp.sympify(eq_parts[0]) - (sp.sympify(eq_parts[1]) if len(eq_parts) > 1 else 0)
        poly = sp.Poly(lhs, z)
        coeffs = poly.all_coeffs()
        if len(coeffs) == 3:
            a, b, c = float(coeffs[0]), float(coeffs[1]), float(coeffs[2])
            disc = b**2 - 4*a*c
            steps.append({
                "stepTitle": "1. Identify Quadratic Coefficients",
                "latex": f"a = {fmt_val(a)}, \\quad b = {fmt_val(b)}, \\quad c = {fmt_val(c)}",
                "description": "Standard quadratic form $az^2 + bz + c = 0$."
            })
            steps.append({
                "stepTitle": "2. Calculate Discriminant (D)",
                "latex": f"\\Delta = b^2 - 4ac = ({fmt_val(b)})^2 - 4({fmt_val(a)})({fmt_val(c)}) = {fmt_val(disc)}",
                "description": "If $\\Delta < 0$, the roots are complex conjugates."
            })
            
            sq_disc = cmath.sqrt(disc)
            r1 = (-b + sq_disc) / (2*a)
            r2 = (-b - sq_disc) / (2*a)
            
            det1 = get_complex_details(r1.real, r1.imag, "z_1")
            det2 = get_complex_details(r2.real, r2.imag, "z_2")
            
            steps.append({
                "stepTitle": "3. Apply the Quadratic Formula",
                "latex": f"z = \\frac{{-b \\pm \\sqrt{{\\Delta}}}}{{2a}} = \\frac{{-{fmt_val(b)} \\pm \\sqrt{{{fmt_val(disc)}}}}}{{2({fmt_val(a)})}}",
                "description": "Evaluating the square root in the complex field $\\mathbb{C}$."
            })
            steps.append({
                "stepTitle": "4. Formulate the Two Conjugate Roots",
                "latex": f"z_1 = {det1['cartesian_latex']}, \\quad z_2 = {det2['cartesian_latex']}",
                "description": "The solutions lie symmetrically across the real axis."
            })
            
            return {
                "operation": "quadratic",
                "equation": z1_str,
                "summary": f"Complex quadratic solved with discriminant $\\Delta = {fmt_val(disc)}$.",
                "final_answer": f"z_1 = {det1['cartesian_latex']}, \\; z_2 = {det2['cartesian_latex']}",
                "steps": steps,
                "primary": det1,
                "secondary": det2,
                "roots": [det1, det2],
                "plot_points": [
                    {"label": "z₁", "real": det1["real"], "imag": det1["imag"], "color": "#38bdf8"},
                    {"label": "z₂", "real": det2["real"], "imag": det2["imag"], "color": "#ec4899"}
                ]
            }

    # Parse primary complex number z1
    r1, i1, z1_latex = parse_complex_number(z1_str)
    z1_det = get_complex_details(r1, i1, "z_1")
    
    # 2. Single number details & conversions
    if op in ['details', 'convert']:
        steps.append({
            "stepTitle": "1. Cartesian Component Breakdown",
            "latex": f"\\operatorname{{Re}}(z) = {fmt_val(r1)}, \\quad \\operatorname{{Im}}(z) = {fmt_val(i1)}",
            "description": "Extract the real and imaginary parts along the orthogonal axes of the Argand plane."
        })
        steps.append({
            "stepTitle": "2. Calculate Modulus (Absolute Value |z|)",
            "latex": f"|z| = r = \\sqrt{{\\operatorname{{Re}}(z)^2 + \\operatorname{{Im}}(z)^2}} = \\sqrt{{({fmt_val(r1)})^2 + ({fmt_val(i1)})^2}} = {fmt_val(z1_det['modulus'])}",
            "description": "The geometric distance from the origin $(0, 0)$ to point $z$ in the complex plane."
        })
        steps.append({
            "stepTitle": "3. Calculate Principal Argument (Arg z)",
            "latex": f"\\theta = \\operatorname{{atan2}}({fmt_val(i1)}, {fmt_val(r1)}) = {z1_det['angle_display']} \\quad ({fmt_val(z1_det['argument_deg'])}^\\circ)",
            "description": "The counter-clockwise angle between the positive real axis and the vector $z$."
        })
        steps.append({
            "stepTitle": "4. Polar and Exponential Form",
            "latex": f"z = {z1_det['polar_latex']} = {z1_det['exponential_latex']}",
            "description": "Euler's trigonometric and exponential representation of the complex number."
        })
        steps.append({
            "stepTitle": "5. Complex Conjugate",
            "latex": f"\\bar{{z}} = {z1_det['conjugate']['cartesian_latex']}",
            "description": "Reflection across the horizontal real axis (inverting the imaginary component)."
        })
        
        return {
            "operation": "details",
            "summary": f"Complex number $z = {z1_det['cartesian_latex']}$ with modulus $|z| = {fmt_val(z1_det['modulus'])}$ and argument $\\theta = {fmt_val(z1_det['argument_deg'])}^\\circ$.",
            "final_answer": z1_det['polar_latex'],
            "primary": z1_det,
            "steps": steps,
            "plot_points": [
                {"label": "z", "real": z1_det["real"], "imag": z1_det["imag"], "color": "#38bdf8"},
                {"label": "z̄", "real": z1_det["conjugate"]["real"], "imag": z1_det["conjugate"]["imag"], "color": "#94a3b8"}
            ]
        }

    # 3. Powers via De Moivre's Theorem: z^n
    if op == 'power':
        n = n_val if n_val is not None else 3
        r_n = z1_det['modulus'] ** n
        th_n = z1_det['argument_rad'] * n
        re_n = r_n * math.cos(th_n)
        im_n = r_n * math.sin(th_n)
        zn_det = get_complex_details(re_n, im_n, f"z^{{{n}}}")
        
        steps.append({
            "stepTitle": "1. Express z in Polar Form",
            "latex": f"z = {z1_det['modulus']:.4f} e^{{i ({z1_det['angle_display']})}}",
            "description": "Compute base modulus $r$ and argument $\\theta$."
        })
        steps.append({
            "stepTitle": "2. Apply De Moivre's Theorem: (r e^{i theta})^n = r^n e^{i n theta}",
            "latex": f"z^{{{n}}} = ({fmt_val(z1_det['modulus'])})^{{{n}}} \\left[\\cos({n} \\cdot {z1_det['angle_display']}) + i \\sin({n} \\cdot {z1_det['angle_display']})\\right]",
            "description": "Powers multiply the argument by $n$ and raise the magnitude to $n$."
        })
        steps.append({
            "stepTitle": "3. Evaluate Power Modulus and Scaled Argument",
            "latex": f"r^{{{n}}} = {fmt_val(r_n)}, \\quad n\\theta = {fmt_val(math.degrees(th_n))}^\\circ",
            "description": "Compute the expanded trigonometric components."
        })
        steps.append({
            "stepTitle": "4. Convert to Rectangular Form",
            "latex": f"z^{{{n}}} = {zn_det['cartesian_latex']}",
            "description": "Multiply out real and imaginary trigonometric projections."
        })
        
        return {
            "operation": "power",
            "power_n": n,
            "summary": f"Power $z^{{{n}}} = {zn_det['cartesian_latex']}$ calculated via De Moivre's theorem.",
            "final_answer": zn_det['cartesian_latex'],
            "primary": z1_det,
            "result": zn_det,
            "steps": steps,
            "plot_points": [
                {"label": "z", "real": z1_det["real"], "imag": z1_det["imag"], "color": "#38bdf8"},
                {"label": f"z^{n}", "real": zn_det["real"], "imag": zn_det["imag"], "color": "#f59e0b"}
            ]
        }

    # 4. n-th Roots of Complex Number: w_k = r^(1/n) * cis((theta + 2k*pi)/n)
    if op == 'roots':
        n = max(2, min(n_val if n_val is not None else 3, 12))
        r = z1_det['modulus']
        theta = z1_det['argument_rad']
        root_r = r ** (1.0 / n)
        
        steps.append({
            "stepTitle": "1. Fundamental Theorem of Algebra (n Complex Roots)",
            "latex": f"w_k = \\sqrt[{n}]{{{fmt_val(r)}}} \\left[ \\cos\\left(\\frac{{{z1_det['angle_display']} + 2k\\pi}}{{{n}}}\\right) + i\\sin\\left(\\frac{{{z1_det['angle_display']} + 2k\\pi}}{{{n}}}\\right) \\right], \\quad k = 0, 1, \\dots, {n-1}",
            "description": f"Every non-zero complex number has exactly {n} distinct {n}-th roots distributed regularly on a circle."
        })
        steps.append({
            "stepTitle": "2. Circle Radius of Roots in the Argand Plane",
            "latex": f"R = \\sqrt[{n}]{{|z|}} = \\sqrt[{n}]{{{fmt_val(r)}}} = {fmt_val(root_r)}",
            "description": f"All roots lie on a circle centered at the origin of radius $R = {fmt_val(root_r)}$, separated by angle $2\\pi/{n} = {fmt_val(360.0/n)}^\\circ$."
        })
        
        roots_list = []
        plot_points = [{"label": "z", "real": z1_det["real"], "imag": z1_det["imag"], "color": "#94a3b8"}]
        colors = ["#38bdf8", "#ec4899", "#10b981", "#fbbf24", "#a855f7", "#06b6d4", "#f97316", "#84cc16"]
        
        for k in range(n):
            phi_k = (theta + 2 * math.pi * k) / n
            rk_x = root_r * math.cos(phi_k)
            rk_y = root_r * math.sin(phi_k)
            k_det = get_complex_details(rk_x, rk_y, f"w_{k}")
            roots_list.append(k_det)
            plot_points.append({
                "label": f"w_{k}",
                "real": k_det["real"],
                "imag": k_det["imag"],
                "color": colors[k % len(colors)]
            })
            steps.append({
                "stepTitle": f"Root k = {k}: w_{k}",
                "latex": f"w_{{{k}}} = {fmt_val(root_r)} \\operatorname{{cis}}({fmt_val(math.degrees(phi_k))}^\\circ) = {k_det['cartesian_latex']}",
                "description": f"Angle for root {k}: $\\phi_{{{k}}} = ({fmt_val(z1_det['argument_deg'])}^\\circ + {k*360}^\\circ)/{n} = {fmt_val(math.degrees(phi_k))}^\\circ$."
            })

        return {
            "operation": "roots",
            "root_n": n,
            "root_radius": round(root_r, 4),
            "summary": f"Computed all {n} distinct complex roots of $z$, forming a regular {n}-gon inscribed in a circle of radius {fmt_val(root_r)}.",
            "final_answer": ", ".join([w['cartesian_latex'] for w in roots_list]),
            "primary": z1_det,
            "roots": roots_list,
            "steps": steps,
            "plot_points": plot_points
        }

    # Binary operations requiring z2
    if not z2_str:
        raise ValueError(f"Operation '{op}' requires a second complex number z2.")
        
    r2, i2, z2_latex = parse_complex_number(z2_str)
    z2_det = get_complex_details(r2, i2, "z_2")

    # 5. Addition
    if op == 'add':
        res_r = r1 + r2
        res_i = i1 + i2
        res_det = get_complex_details(res_r, res_i, "z_1 + z_2")
        steps.append({
            "stepTitle": "1. Algebraic Grouping of Real and Imaginary Components",
            "latex": f"z_1 + z_2 = ({fmt_val(r1)} + {fmt_val(i1)}i) + ({fmt_val(r2)} + {fmt_val(i2)}i) = ({fmt_val(r1)} + {fmt_val(r2)}) + ({fmt_val(i1)} + {fmt_val(i2)})i",
            "description": "Add respective real parts and imaginary parts separately."
        })
        steps.append({
            "stepTitle": "2. Sum Calculation",
            "latex": f"z_1 + z_2 = {res_det['cartesian_latex']}",
            "description": "Corresponds geometrically to the Parallelogram Law of vector addition in the Argand plane."
        })
        return {
            "operation": "add",
            "summary": f"$({z1_det['cartesian_latex']}) + ({z2_det['cartesian_latex']}) = {res_det['cartesian_latex']}$.",
            "final_answer": res_det['cartesian_latex'],
            "primary": z1_det,
            "secondary": z2_det,
            "result": res_det,
            "steps": steps,
            "plot_points": [
                {"label": "z₁", "real": z1_det["real"], "imag": z1_det["imag"], "color": "#38bdf8"},
                {"label": "z₂", "real": z2_det["real"], "imag": z2_det["imag"], "color": "#ec4899"},
                {"label": "z₁ + z₂", "real": res_det["real"], "imag": res_det["imag"], "color": "#10b981"}
            ]
        }

    # 6. Subtraction
    if op == 'subtract':
        res_r = r1 - r2
        res_i = i1 - i2
        res_det = get_complex_details(res_r, res_i, "z_1 - z_2")
        steps.append({
            "stepTitle": "1. Subtract Real and Imaginary Parts",
            "latex": f"z_1 - z_2 = ({fmt_val(r1)} - {fmt_val(r2)}) + ({fmt_val(i1)} - {fmt_val(i2)})i",
            "description": "Subtract coordinate components."
        })
        steps.append({
            "stepTitle": "2. Resulting Difference Vector",
            "latex": f"z_1 - z_2 = {res_det['cartesian_latex']}",
            "description": "Represents the displacement vector directed from $z_2$ to $z_1$ in the complex plane."
        })
        return {
            "operation": "subtract",
            "summary": f"$({z1_det['cartesian_latex']}) - ({z2_det['cartesian_latex']}) = {res_det['cartesian_latex']}$.",
            "final_answer": res_det['cartesian_latex'],
            "primary": z1_det,
            "secondary": z2_det,
            "result": res_det,
            "steps": steps,
            "plot_points": [
                {"label": "z₁", "real": z1_det["real"], "imag": z1_det["imag"], "color": "#38bdf8"},
                {"label": "z₂", "real": z2_det["real"], "imag": z2_det["imag"], "color": "#ec4899"},
                {"label": "z₁ - z₂", "real": res_det["real"], "imag": res_det["imag"], "color": "#fbbf24"}
            ]
        }

    # 7. Multiplication: (a + bi)(c + di) = (ac - bd) + (ad + bc)i
    if op == 'multiply':
        res_r = r1 * r2 - i1 * i2
        res_i = r1 * i2 + i1 * r2
        res_det = get_complex_details(res_r, res_i, "z_1 \\cdot z_2")
        steps.append({
            "stepTitle": "1. Distributive Expansion (FOIL)",
            "latex": f"z_1 \\cdot z_2 = ({fmt_val(r1)} \\cdot {fmt_val(r2)}) + ({fmt_val(r1)} \\cdot {fmt_val(i2)}i) + ({fmt_val(i1)}i \\cdot {fmt_val(r2)}) + ({fmt_val(i1)}i \\cdot {fmt_val(i2)}i)",
            "description": "Expand using the distributive law of algebra."
        })
        steps.append({
            "stepTitle": "2. Substitute i^2 = -1",
            "latex": f"= ({fmt_val(r1 * r2)} - {fmt_val(i1 * i2)}) + ({fmt_val(r1 * i2)} + {fmt_val(i1 * r2)})i = {res_det['cartesian_latex']}",
            "description": "Apply the foundational definition of the imaginary unit $i^2 = -1$."
        })
        steps.append({
            "stepTitle": "3. Geometric Interpretation (Polar Scaling & Rotation)",
            "latex": f"|z_1 \\cdot z_2| = |z_1| \\cdot |z_2| = {fmt_val(z1_det['modulus'])} \\cdot {fmt_val(z2_det['modulus'])} = {fmt_val(res_det['modulus'])}, \\quad \\operatorname{{Arg}}(z_1 z_2) = \\theta_1 + \\theta_2 = {fmt_val(res_det['argument_deg'])}^\\circ",
            "description": "Complex multiplication dilates by $|z_2|$ and rotates by $\\operatorname{{Arg}}(z_2)$."
        })
        return {
            "operation": "multiply",
            "summary": f"$({z1_det['cartesian_latex']}) \\cdot ({z2_det['cartesian_latex']}) = {res_det['cartesian_latex']}$.",
            "final_answer": res_det['cartesian_latex'],
            "primary": z1_det,
            "secondary": z2_det,
            "result": res_det,
            "steps": steps,
            "plot_points": [
                {"label": "z₁", "real": z1_det["real"], "imag": z1_det["imag"], "color": "#38bdf8"},
                {"label": "z₂", "real": z2_det["real"], "imag": z2_det["imag"], "color": "#ec4899"},
                {"label": "z₁ · z₂", "real": res_det["real"], "imag": res_det["imag"], "color": "#a855f7"}
            ]
        }

    # 8. Division: z1 / z2
    if op == 'divide':
        denom = r2**2 + i2**2
        if denom < 1e-12:
            raise ZeroDivisionError("Cannot divide by zero complex number z2.")
        res_r = (r1 * r2 + i1 * i2) / denom
        res_i = (i1 * r2 - r1 * i2) / denom
        res_det = get_complex_details(res_r, res_i, "z_1 / z_2")
        
        steps.append({
            "stepTitle": "1. Multiply Numerator and Denominator by Conjugate z̄₂",
            "latex": f"\\frac{{z_1}}{{z_2}} = \\frac{{{z1_det['cartesian_latex']}}}{{{z2_det['cartesian_latex']}}} \\cdot \\frac{{{z2_det['conjugate']['cartesian_latex']}}}{{{z2_det['conjugate']['cartesian_latex']}}}",
            "description": "Rationalize the denominator by multiplying by the complex conjugate $\\bar{z}_2 = c - di$."
        })
        steps.append({
            "stepTitle": "2. Evaluate Denominator Modulus Squared",
            "latex": f"z_2 \\cdot \\bar{{z}}_2 = c^2 + d^2 = ({fmt_val(r2)})^2 + ({fmt_val(i2)})^2 = {fmt_val(denom)}",
            "description": "A complex number multiplied by its conjugate yields a strictly non-negative real number."
        })
        steps.append({
            "stepTitle": "3. Expand Numerator Product",
            "latex": f"z_1 \\cdot \\bar{{z}}_2 = ({fmt_val(r1 * r2 + i1 * i2)}) + ({fmt_val(i1 * r2 - r1 * i2)})i",
            "description": "Multiply out the complex numerator."
        })
        steps.append({
            "stepTitle": "4. Divide through by Real Denominator",
            "latex": f"\\frac{{z_1}}{{z_2}} = \\frac{{{fmt_val(r1 * r2 + i1 * i2)}}}{{{fmt_val(denom)}}} + \\frac{{{fmt_val(i1 * r2 - r1 * i2)}}}{{{fmt_val(denom)}}}i = {res_det['cartesian_latex']}",
            "description": "Final simplified Cartesian quotient."
        })
        return {
            "operation": "divide",
            "summary": f"$\\frac{{{z1_det['cartesian_latex']}}}{{{z2_det['cartesian_latex']}}} = {res_det['cartesian_latex']}$.",
            "final_answer": res_det['cartesian_latex'],
            "primary": z1_det,
            "secondary": z2_det,
            "result": res_det,
            "steps": steps,
            "plot_points": [
                {"label": "z₁", "real": z1_det["real"], "imag": z1_det["imag"], "color": "#38bdf8"},
                {"label": "z₂", "real": z2_det["real"], "imag": z2_det["imag"], "color": "#ec4899"},
                {"label": "z₁ / z₂", "real": res_det["real"], "imag": res_det["imag"], "color": "#06b6d4"}
            ]
        }

    # 9. Distance and Geometry between z1 and z2
    if op == 'distance':
        dist = math.hypot(r1 - r2, i1 - i2)
        mid_r = (r1 + r2) / 2.0
        mid_i = (i1 + i2) / 2.0
        mid_det = get_complex_details(mid_r, mid_i, "M")
        steps.append({
            "stepTitle": "1. Distance Formula in Complex Plane",
            "latex": f"d(z_1, z_2) = |z_1 - z_2| = \\sqrt{{(\\operatorname{{Re}}(z_1) - \\operatorname{{Re}}(z_2))^2 + (\\operatorname{{Im}}(z_1) - \\operatorname{{Im}}(z_2))^2}}",
            "description": "Modulus of difference equals Euclidean distance."
        })
        steps.append({
            "stepTitle": "2. Calculate Distance",
            "latex": f"|z_1 - z_2| = \\sqrt{{({fmt_val(r1)} - {fmt_val(r2)})^2 + ({fmt_val(i1)} - {fmt_val(i2)})^2}} = {fmt_val(dist)}",
            "description": "Length of segment connecting $z_1$ and $z_2$."
        })
        steps.append({
            "stepTitle": "3. Complex Midpoint M",
            "latex": f"M = \\frac{{z_1 + z_2}}{{2}} = \\frac{{{fmt_val(r1 + r2)}}}{{2}} + \\frac{{{fmt_val(i1 + i2)}}}{{2}}i = {mid_det['cartesian_latex']}",
            "description": "Geometric center of the line segment joining $z_1$ and $z_2$."
        })
        return {
            "operation": "distance",
            "distance": round(dist, 4),
            "midpoint": mid_det,
            "summary": f"Distance between $z_1$ and $z_2$ is $|z_1 - z_2| = {fmt_val(dist)}$ with midpoint $M = {mid_det['cartesian_latex']}$.",
            "final_answer": f"d = {fmt_val(dist)}, \\quad M = {mid_det['cartesian_latex']}",
            "primary": z1_det,
            "secondary": z2_det,
            "steps": steps,
            "plot_points": [
                {"label": "z₁", "real": z1_det["real"], "imag": z1_det["imag"], "color": "#38bdf8"},
                {"label": "z₂", "real": z2_det["real"], "imag": z2_det["imag"], "color": "#ec4899"},
                {"label": "M", "real": mid_det["real"], "imag": mid_det["imag"], "color": "#10b981"}
            ]
        }

    raise ValueError(f"Unknown operation: {op}")

def get_complex_presets() -> List[Dict[str, Any]]:
    """Curated presets for high school, 5-unit Bagrut, and Olympiad math."""
    return [
        {
            "id": "roots_of_unity_5",
            "title": "Fifth Roots of Unity (z^5 = 1)",
            "category": "Roots & Polygons",
            "description": "Find and visualize all 5 complex roots of unity forming a regular pentagon in the Argand plane.",
            "op": "roots",
            "z1": "1",
            "n": 5
        },
        {
            "id": "eulers_identity",
            "title": "Euler's Identity & Powers of i",
            "category": "Euler Form",
            "description": "Examine i^i, polar representations of i, and Euler's formula e^(i*pi) + 1 = 0.",
            "op": "details",
            "z1": "i"
        },
        {
            "id": "multiplication_rotation",
            "title": "Complex Multiplication as Rotation",
            "category": "Geometry & Transformations",
            "description": "Multiply (1 + i) by (sqrt(3) + i), demonstrating angle addition 45° + 30° = 75°.",
            "op": "multiply",
            "z1": "1 + i",
            "z2": "sqrt(3) + i"
        },
        {
            "id": "bagrut_582_roots",
            "title": "Bagrut 582: Roots of (1 - sqrt(3)i)^4",
            "category": "5-Unit Bagrut",
            "description": "Calculate powers and roots of complex numbers using De Moivre's theorem from national exams.",
            "op": "power",
            "z1": "1 - sqrt(3)*i",
            "n": 4
        },
        {
            "id": "complex_quadratic",
            "title": "Complex Quadratic Equation",
            "category": "Polynomials",
            "description": "Solve z^2 - 4z + 13 = 0 yielding conjugate roots 2 ± 3i.",
            "op": "quadratic",
            "z1": "z^2 - 4*z + 13 = 0"
        },
        {
            "id": "cube_roots_minus_8",
            "title": "Cube Roots of -8",
            "category": "Roots & Polygons",
            "description": "Calculate the three complex cube roots of -8 lying on a circle of radius 2.",
            "op": "roots",
            "z1": "-8",
            "n": 3
        }
    ]
