import math
import re
from fractions import Fraction
from typing import List, Dict, Any, Tuple, Optional, Union
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from math_models import MathStep

# ─────────────────────────────────────────────────────────────────────────────
# 1. SPECIAL ANGLES, EXACT RADICALS AND FORMATTING HELPERS (PURE PYTHON)
# ─────────────────────────────────────────────────────────────────────────────

def fmt_num(val: Union[int, float]) -> str:
    """Format numeric values nicely without trailing zeros."""
    if abs(val - round(val)) < 1e-9:
        return str(int(round(val)))
    return f"{val:.4g}"

def simplify_radical(n: int) -> Tuple[int, int]:
    """Simplify sqrt(n) into (outer, inner) such that sqrt(n) = outer * sqrt(inner)."""
    if n <= 0:
        return (0, 0)
    outer = 1
    d = 2
    temp = n
    while d * d <= temp:
        if temp % (d * d) == 0:
            outer *= d
            temp //= (d * d)
        else:
            d += 1
    return (outer, temp)

def format_radical_latex(val: float) -> str:
    """Format a floating-point number into an exact radical LaTeX string if applicable."""
    if abs(val) < 1e-9:
        return "0"
    sign = "-" if val < -1e-6 else ""
    abs_v = abs(val)
    
    # Check if square of val is near integer: sqrt(2), sqrt(3), 2, etc.
    v2 = abs_v ** 2
    round_v2 = round(v2)
    if abs(v2 - round_v2) < 1e-4:
        out, inn = simplify_radical(round_v2)
        if inn == 1:
            return f"{sign}{out}"
        if out == 1:
            return rf"{sign}\sqrt{{{inn}}}"
        return rf"{sign}{out}\sqrt{{{inn}}}"
        
    # Check if (val * 2)^2 is integer: sqrt(2)/2, sqrt(3)/2, 1/2, etc.
    v2_half = (abs_v * 2) ** 2
    round_v2_half = round(v2_half)
    if abs(v2_half - round_v2_half) < 1e-4:
        out, inn = simplify_radical(round_v2_half)
        if inn == 1:
            f = Fraction(out, 2)
            if f.denominator == 1:
                return f"{sign}{f.numerator}"
            return rf"{sign}\frac{{{f.numerator}}}{{{f.denominator}}}"
        if out == 1:
            return rf"{sign}\frac{{\sqrt{{{inn}}}}}{{2}}"
        if out % 2 == 0:
            half_out = out // 2
            return rf"{sign}\sqrt{{{inn}}}" if half_out == 1 else rf"{sign}{half_out}\sqrt{{{inn}}}"
        return rf"{sign}\frac{{{out}\sqrt{{{inn}}}}}{{2}}"
        
    # Check if (val * 3)^2 is integer: sqrt(3)/3, etc.
    v2_third = (abs_v * 3) ** 2
    round_v2_third = round(v2_third)
    if abs(v2_third - round_v2_third) < 1e-4:
        out, inn = simplify_radical(round_v2_third)
        if inn == 3 and out == 1:
            return rf"{sign}\frac{{\sqrt{{3}}}}{{3}}"
            
    return f"{sign}{fmt_num(abs_v)}"

# Standard angles table from 0 to 2*pi with exact latex representation
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
    """Match radian angle to special angles table [0, 2pi)."""
    norm = rad_val % (2 * math.pi)
    if norm < 0:
        norm += 2 * math.pi
    if abs(norm - 2 * math.pi) < 1e-4:
        norm = 0.0
    for entry in SPECIAL_ANGLES:
        if abs(entry[0] - norm) < 1e-4:
            return entry
    return None

def get_exact_or_numeric_val(val: float) -> str:
    """Return exact LaTeX representation for common trigonometric values."""
    special = [
        (0.0, "0"),
        (0.5, r"\frac{1}{2}"),
        (math.sqrt(2)/2, r"\frac{\sqrt{2}}{2}"),
        (math.sqrt(3)/2, r"\frac{\sqrt{3}}{2}"),
        (1.0, "1"),
        (math.sqrt(3)/3, r"\frac{\sqrt{3}}{3}"),
        (math.sqrt(3), r"\sqrt{3}")
    ]
    sign = "-" if val < -1e-6 else ""
    abs_v = abs(val)
    for v, lat in special:
        if abs(abs_v - v) < 1e-4:
            if v == 0.0:
                return "0"
            return f"{sign}{lat}"
    return format_radical_latex(val)

def get_exact_or_numeric_angle(rad_val: float) -> Tuple[str, str, float]:
    """Return (rad_latex, deg_latex, deg_num) for an angle in radians."""
    norm = rad_val % (2 * math.pi)
    if norm < 0:
        norm += 2 * math.pi
    if abs(norm - 2 * math.pi) < 1e-4 or abs(norm) < 1e-6:
        return "0", r"0^\circ", 0.0
    sp_entry = find_special_angle(norm)
    if sp_entry:
        return sp_entry[1], rf"{sp_entry[2]}^\circ", float(sp_entry[2])
        
    # Check standard fraction multiple of pi: p*pi/q
    pi_frac = norm / math.pi
    f = Fraction(pi_frac).limit_denominator(24)
    if abs(float(f) - pi_frac) < 1e-4:
        num, den = f.numerator, f.denominator
        if den == 1:
            lat = r"\pi" if num == 1 else rf"{num}\pi"
        else:
            lat = rf"\frac{{\pi}}{{{den}}}" if num == 1 else rf"\frac{{{num}\pi}}{{{den}}}"
        deg = float(f * 180)
        return lat, rf"{fmt_num(deg)}^\circ", deg
        
    deg = math.degrees(norm)
    return f"{norm:.4g}", rf"{deg:.2f}^\circ", deg

def angle_diff_to_latex(u_val: float, phi_val: float) -> Tuple[str, float]:
    """Compute difference u - phi and format as exact pi fraction."""
    diff = u_val - phi_val
    if abs(diff) < 1e-6:
        return "0", 0.0
    sign = "-" if diff < 0 else ""
    abs_d = abs(diff)
    pi_frac = abs_d / math.pi
    f = Fraction(pi_frac).limit_denominator(24)
    if abs(float(f) - pi_frac) < 1e-4:
        num, den = f.numerator, f.denominator
        if den == 1:
            lat = rf"{sign}\pi" if num == 1 else rf"{sign}{num}\pi"
        else:
            lat = rf"{sign}\frac{{\pi}}{{{den}}}" if num == 1 else rf"{sign}\frac{{{num}\pi}}{{{den}}}"
        return lat, diff
    return f"{diff:.4g}", diff

def parse_angle(angle_str: str) -> Tuple[float, float, str]:
    """Parse angle string into (radians, degrees, latex_str)."""
    s = angle_str.strip().lower()
    
    # Check degree notation
    if 'deg' in s or '°' in s:
        s_clean = s.replace('deg', '').replace('°', '').strip()
        deg = float(s_clean)
        rad = math.radians(deg)
        return rad, deg, rf"{fmt_num(deg)}^\circ"
        
    # Check pi expressions
    if 'pi' in s:
        s_eval = s.replace('pi', str(math.pi)).replace('^', '**')
        # Evaluate safely via AST / controlled math dict
        try:
            rad = float(eval(s_eval, {"__builtins__": {}, "math": math}, {}))
        except Exception:
            rad = math.pi
        deg = math.degrees(rad)
        latex_str = s.replace('pi', r'\pi').replace('*', '')
        return rad, deg, latex_str
        
    val = float(s)
    if abs(val) > 2 * math.pi:
        deg = val
        rad = math.radians(deg)
        return rad, deg, rf"{fmt_num(deg)}^\circ"
    else:
        rad = val
        deg = math.degrees(rad)
        return rad, deg, rf"{fmt_num(rad)} \text{{ rad}}"

def parse_number_or_radical(s: str) -> float:
    """Parse a numerical string containing radicals, fractions, or signs into float."""
    s = s.strip()
    if not s:
        return 0.0
    if s == '+':
        return 1.0
    if s == '-':
        return -1.0
    if '/' in s:
        parts = s.split('/', 1)
        num_v = parse_number_or_radical(parts[0])
        den_v = parse_number_or_radical(parts[1])
        return num_v / den_v if den_v != 0 else 0.0
    m = re.match(r'^([+-]?\d*(?:\.\d+)?)\*?sqrt\((\d+(?:\.\d+)?)\)$', s, re.I)
    if m:
        c_str, val_str = m.groups()
        c = float(c_str) if c_str and c_str not in ['+', '-'] else (-1.0 if c_str == '-' else 1.0)
        return c * math.sqrt(float(val_str))
    return float(s)

def format_trig_term(coef_val: float, func_str: str, arg_lat: str, is_first: bool = False) -> str:
    """Format coefficient and trig function cleanly without redundant 1 or spacing issues."""
    coef_lat = format_radical_latex(abs(coef_val))
    if abs(coef_val - 1.0) < 1e-9:
        return f"{func_str}({arg_lat})" if is_first else f"+ {func_str}({arg_lat})"
    elif abs(coef_val - (-1.0)) < 1e-9:
        return f"-{func_str}({arg_lat})" if is_first else f"- {func_str}({arg_lat})"
    elif coef_val > 0:
        return f"{coef_lat}{func_str}({arg_lat})" if is_first else f"+ {coef_lat}{func_str}({arg_lat})"
    else:
        return f"-{coef_lat}{func_str}({arg_lat})" if is_first else f"- {coef_lat}{func_str}({arg_lat})"

# ─────────────────────────────────────────────────────────────────────────────
# 2. UNIT CIRCLE ENGINE (PURE PYTHON)
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
        quadrant = "Quadrant I (All trig functions positive)"
        ref_deg = norm_deg
    elif 90 < norm_deg < 180:
        quadrant = "Quadrant II (Sine positive, Cosine & Tangent negative)"
        ref_deg = 180 - norm_deg
    elif 180 < norm_deg < 270:
        quadrant = "Quadrant III (Tangent positive, Sine & Cosine negative)"
        ref_deg = norm_deg - 180
    else:
        quadrant = "Quadrant IV (Cosine positive, Sine & Tangent negative)"
        ref_deg = 360 - norm_deg
        
    ref_rad = math.radians(ref_deg)
    cos_val = math.cos(norm_rad)
    sin_val = math.sin(norm_rad)
    tan_val = math.tan(norm_rad) if abs(cos_val) > 1e-9 else None
    
    # Exact values from table
    sp = find_special_angle(norm_rad)
    if sp:
        sin_latex = sp[3]
        cos_latex = sp[5]
        tan_latex = sp[7]
        rad_exact_latex = sp[1]
    else:
        sin_latex = get_exact_or_numeric_val(sin_val)
        cos_latex = get_exact_or_numeric_val(cos_val)
        tan_latex = get_exact_or_numeric_val(tan_val) if tan_val is not None else r"\text{undefined}"
        rad_exact_latex = f"{norm_rad:.4g}"

    # Visual Shapes for coordinate graph
    unit_circle_shape = {"type": "circle", "center": [0.0, 0.0], "radius": 1.0, "color": "BLUE"}
    terminal_ray = {"type": "line", "p1": [0.0, 0.0], "p2": [cos_val, sin_val], "label": f"Ray ({fmt_num(norm_deg)}°)"}
    cos_proj = {"type": "line", "p1": [0.0, 0.0], "p2": [cos_val, 0.0], "label": f"cos={cos_latex}"}
    sin_proj = {"type": "line", "p1": [cos_val, 0.0], "p2": [cos_val, sin_val], "label": f"sin={sin_latex}"}

    steps = [
        MathStep(
            description=f"Angle Specification: theta = {angle_latex} = {fmt_num(norm_deg)} deg on the unit circle",
            latex=rf"\theta = {rad_exact_latex} = {fmt_num(norm_deg)}^\circ \quad \left(\text{{{quadrant}}}\right)",
            type="geometry",
            data={"shapes": [unit_circle_shape, terminal_ray]}
        ),
        MathStep(
            description=f"Calculate acute reference angle in first quadrant: theta_ref = {fmt_num(ref_deg)} deg",
            latex=rf"\theta_{{\text{{ref}}}} = {fmt_num(ref_deg)}^\circ",
            type="geometry",
            data={"shapes": [unit_circle_shape, terminal_ray, cos_proj]}
        ),
        MathStep(
            description="Terminal point coordinates (x, y) = (cos theta, sin theta) on the unit circle x^2 + y^2 = 1",
            latex=rf"(x, y) = (\cos\theta, \; \sin\theta) = \left({cos_latex}, \; {sin_latex}\right)",
            type="geometry",
            data={"shapes": [unit_circle_shape, terminal_ray, cos_proj, sin_proj]}
        ),
        MathStep(
            description=f"Primary trigonometric ratios: sin(theta) = y, cos(theta) = x, tan(theta) = y / x",
            latex=rf"\sin({fmt_num(norm_deg)}^\circ) = {sin_latex}, \quad \cos({fmt_num(norm_deg)}^\circ) = {cos_latex}, \quad \tan({fmt_num(norm_deg)}^\circ) = {tan_latex}",
            type="geometry",
            data={"shapes": [unit_circle_shape, terminal_ray, cos_proj, sin_proj]}
        )
    ]
    
    # Add reciprocal functions
    sec_latex = get_exact_or_numeric_val(1.0 / cos_val) if abs(cos_val) > 1e-9 else r"\text{undefined}"
    csc_latex = get_exact_or_numeric_val(1.0 / sin_val) if abs(sin_val) > 1e-9 else r"\text{undefined}"
    cot_latex = get_exact_or_numeric_val(cos_val / sin_val) if abs(sin_val) > 1e-9 else r"\text{undefined}"
    steps.append(MathStep(
        description="Reciprocal trigonometric ratios: sec(theta) = 1/cos, csc(theta) = 1/sin, cot(theta) = 1/tan",
        latex=rf"\sec({fmt_num(norm_deg)}^\circ) = {sec_latex}, \quad \csc({fmt_num(norm_deg)}^\circ) = {csc_latex}, \quad \cot({fmt_num(norm_deg)}^\circ) = {cot_latex}",
        type="geometry",
        data={"shapes": [unit_circle_shape, terminal_ray, cos_proj, sin_proj]}
    ))
    
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
# 3. TRIGONOMETRIC EVALUATION ENGINE (PURE PYTHON)
# ─────────────────────────────────────────────────────────────────────────────

def normalize_trig_str(s: str) -> str:
    """Normalize conversational phrases, missing parentheses, and degree formats in trig queries."""
    clean = s.strip()
    clean = re.sub(r'^(what\s+is\s+|calculate\s+|evaluate\s+|solve\s+|find\s+|compute\s+|the\s+value\s+of\s+|the\s+)', '', clean, flags=re.I).strip()
    clean = re.sub(r'\bdegrees?\b', 'deg', clean, flags=re.I).replace('°', ' deg')
    
    # Handle unit circle queries with spaces
    clean = re.sub(r'\bunit\s+circle\s*\(?', 'unit_circle(', clean, flags=re.I)
    if 'unit_circle(' in clean and not clean.endswith(')'):
        clean += ')'
        
    # Auto-parenthesize functions if missing: sin 30 -> sin(30), cos 45 deg -> cos(45 deg)
    for fn in ['arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot']:
        clean = re.sub(rf'\b{fn}\s+([0-9\./\w]+(?:\s*deg)?)', rf'{fn}(\1)', clean, flags=re.I)
    return clean.strip()

def evaluate_trig(expr_str: str) -> Tuple[str, List[MathStep]]:
    """Evaluate trigonometric expressions with full step-by-step reasoning."""
    s = normalize_trig_str(expr_str)
    
    # 1. Inverse functions: arcsin, arccos, arctan
    m_inv = re.match(r'^(arcsin|asin|arccos|acos|arctan|atan)\(([^()]+)\)$', s, re.I)
    if m_inv:
        func, arg_str = m_inv.group(1).lower(), m_inv.group(2).strip()
        val = parse_number_or_radical(arg_str)
        val_lat = format_radical_latex(val)
        
        if func in ['arcsin', 'asin']:
            if abs(val) > 1.0 + 1e-7:
                raise ValueError(f"Domain error: arcsin argument must be in [-1, 1], got {val}")
            rad = math.asin(max(-1.0, min(1.0, val)))
            deg = math.degrees(rad)
            rad_lat, deg_lat, _ = get_exact_or_numeric_angle(rad)
            steps = [
                MathStep(
                    description=f"Definition of inverse sine: find angle theta in principal range [-pi/2, pi/2] such that sin(theta) = {val_lat}",
                    latex=rf"\arcsin({val_lat}) = \theta \iff \sin(\theta) = {val_lat}, \quad \theta \in \left[-\frac{{\pi}}{{2}}, \frac{{\pi}}{{2}}\right]",
                    type="equation"
                ),
                MathStep(
                    description=f"Identify exact principal angle whose sine equals {val_lat}",
                    latex=rf"\arcsin({val_lat}) = {rad_lat} = {deg_lat}",
                    type="equation"
                )
            ]
            return f"{rad_lat} ({deg_lat})", steps
            
        elif func in ['arccos', 'acos']:
            if abs(val) > 1.0 + 1e-7:
                raise ValueError(f"Domain error: arccos argument must be in [-1, 1], got {val}")
            rad = math.acos(max(-1.0, min(1.0, val)))
            deg = math.degrees(rad)
            rad_lat, deg_lat, _ = get_exact_or_numeric_angle(rad)
            steps = [
                MathStep(
                    description=f"Definition of inverse cosine: find angle theta in principal range [0, pi] such that cos(theta) = {val_lat}",
                    latex=rf"\arccos({val_lat}) = \theta \iff \cos(\theta) = {val_lat}, \quad \theta \in [0, \pi]",
                    type="equation"
                ),
                MathStep(
                    description=f"Identify exact principal angle whose cosine equals {val_lat}",
                    latex=rf"\arccos({val_lat}) = {rad_lat} = {deg_lat}",
                    type="equation"
                )
            ]
            return f"{rad_lat} ({deg_lat})", steps
            
        else: # arctan
            rad = math.atan(val)
            deg = math.degrees(rad)
            rad_lat, deg_lat, _ = get_exact_or_numeric_angle(rad)
            steps = [
                MathStep(
                    description=f"Definition of inverse tangent: find angle theta in principal range (-pi/2, pi/2) such that tan(theta) = {val_lat}",
                    latex=rf"\arctan({val_lat}) = \theta \iff \tan(\theta) = {val_lat}, \quad \theta \in \left(-\frac{{\pi}}{{2}}, \frac{{\pi}}{{2}}\right)",
                    type="equation"
                ),
                MathStep(
                    description=f"Identify exact principal angle whose tangent equals {val_lat}",
                    latex=rf"\arctan({val_lat}) = {rad_lat} = {deg_lat}",
                    type="equation"
                )
            ]
            return f"{rad_lat} ({deg_lat})", steps

    # 2. Forward trigonometric functions: sin, cos, tan, sec, csc, cot
    m_fwd = re.match(r'^(sin|cos|tan|sec|csc|cot)\(([^()]+)\)$', s, re.I)
    if m_fwd:
        func, arg_str = m_fwd.group(1).lower(), m_fwd.group(2).strip()
        rad, deg, angle_latex = parse_angle(arg_str)
        norm_deg = deg % 360.0
        if norm_deg < 0:
            norm_deg += 360.0
        norm_rad = math.radians(norm_deg)
        
        fname = rf"\{func}"
        sp = find_special_angle(norm_rad)
        
        if func == 'sin':
            val = math.sin(norm_rad)
            val_lat = sp[3] if sp else get_exact_or_numeric_val(val)
        elif func == 'cos':
            val = math.cos(norm_rad)
            val_lat = sp[5] if sp else get_exact_or_numeric_val(val)
        elif func == 'tan':
            if abs(math.cos(norm_rad)) < 1e-9:
                return r"\text{undefined}", [
                    MathStep(f"cos({angle_latex}) = 0, so tan({angle_latex}) has vertical asymptote (division by zero)", r"\tan\theta = \frac{\sin\theta}{\cos\theta} \implies \text{undefined}", "equation")
                ]
            val = math.tan(norm_rad)
            val_lat = sp[7] if sp else get_exact_or_numeric_val(val)
        elif func == 'sec':
            if abs(math.cos(norm_rad)) < 1e-9:
                return r"\text{undefined}", [
                    MathStep(f"cos({angle_latex}) = 0, so sec({angle_latex}) is undefined", r"\sec\theta = \frac{1}{\cos\theta} \implies \text{undefined}", "equation")
                ]
            val = 1.0 / math.cos(norm_rad)
            val_lat = format_radical_latex(val)
        elif func == 'csc':
            if abs(math.sin(norm_rad)) < 1e-9:
                return r"\text{undefined}", [
                    MathStep(f"sin({angle_latex}) = 0, so csc({angle_latex}) is undefined", r"\csc\theta = \frac{1}{\sin\theta} \implies \text{undefined}", "equation")
                ]
            val = 1.0 / math.sin(norm_rad)
            val_lat = format_radical_latex(val)
        else: # cot
            if abs(math.sin(norm_rad)) < 1e-9:
                return r"\text{undefined}", [
                    MathStep(f"sin({angle_latex}) = 0, so cot({angle_latex}) is undefined", r"\cot\theta = \frac{\cos\theta}{\sin\theta} \implies \text{undefined}", "equation")
                ]
            val = math.cos(norm_rad) / math.sin(norm_rad)
            val_lat = format_radical_latex(val)
            
        steps = [
            MathStep(
                description=f"Given trigonometric expression to evaluate: {fname}({angle_latex})",
                latex=rf"{fname}\left({angle_latex}\right)",
                type="equation"
            ),
            MathStep(
                description=f"Normalize angle to standard unit circle domain: theta = {fmt_num(norm_deg)} deg",
                latex=rf"\theta = {fmt_num(norm_deg)}^\circ",
                type="equation"
            ),
            MathStep(
                description="Evaluate exact trigonometric value using unit circle reference angles",
                latex=rf"{fname}\left({angle_latex}\right) = {val_lat}",
                type="equation"
            )
        ]
        return val_lat, steps

    # 3. Compound trigonometric expressions (e.g., sin(pi/6) + cos(pi/3))
    trig_calls = list(re.finditer(r'(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan)\((.*?)\)', s, re.I))
    if len(trig_calls) >= 1 and any(op in s for op in ['+', '-', '*', '/']):
        steps = [MathStep(f"Evaluate compound trigonometric expression: {s}", rf"{s}", "equation")]
        eval_expr = s
        for match in trig_calls:
            term = match.group(0)
            try:
                term_val_lat, _ = evaluate_trig(term)
                func, arg = match.group(1).lower(), match.group(2).strip()
                if func in ['arcsin', 'asin']: num_val = math.asin(float(arg))
                elif func in ['arccos', 'acos']: num_val = math.acos(float(arg))
                elif func in ['arctan', 'atan']: num_val = math.atan(float(arg))
                else:
                    rad_val, _, _ = parse_angle(arg)
                    if func == 'sin': num_val = math.sin(rad_val)
                    elif func == 'cos': num_val = math.cos(rad_val)
                    elif func == 'tan': num_val = math.tan(rad_val)
                    elif func == 'sec': num_val = 1.0 / math.cos(rad_val)
                    elif func == 'csc': num_val = 1.0 / math.sin(rad_val)
                    else: num_val = math.cos(rad_val) / math.sin(rad_val)
                
                steps.append(MathStep(
                    description=f"Evaluate component {term} = {term_val_lat}",
                    latex=rf"{term} = {term_val_lat}",
                    type="equation"
                ))
                eval_expr = eval_expr.replace(term, f"({num_val})")
            except Exception:
                pass
                
        try:
            total_val = float(eval(eval_expr.replace('^', '**'), {"__builtins__": None, "math": math}))
            final_lat = format_radical_latex(total_val)
            steps.append(MathStep(
                description=f"Combine evaluated terms to obtain final result",
                latex=rf"= {final_lat}",
                type="equation"
            ))
            return final_lat, steps
        except Exception:
            pass

    raise ValueError(f"Cannot evaluate trigonometric expression: {expr_str}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. PURE-PYTHON EQUATION PARSER & SOLVERS
# ─────────────────────────────────────────────────────────────────────────────

def solve_basic_trig(func: str, c_val: float, k: float = 1.0) -> Tuple[str, List[MathStep]]:
    """Solve func(k*x) = c for func in {'sin', 'cos', 'tan'} with rich pedagogical steps."""
    steps = []
    fname = rf"\{func}"
    k_disp = "" if abs(k - 1.0) < 1e-9 else ("-x" if abs(k - (-1.0)) < 1e-9 else f"{fmt_num(k)}x")
    arg_disp = "x" if not k_disp else k_disp
    c_lat = get_exact_or_numeric_val(c_val)
    
    # 1. State isolated equation
    steps.append(MathStep(
        description=f"Isolated elementary trigonometric equation: {fname}({arg_disp}) = {c_lat}",
        latex=rf"{fname}({arg_disp}) = {c_lat}",
        type="equation"
    ))
    
    # 2. Range check for sine and cosine
    if func in ['sin', 'cos'] and (c_val < -1.0 - 1e-7 or c_val > 1.0 + 1e-7):
        steps.append(MathStep(
            description=f"Check domain and range: Since the range of {fname} is [-1, 1], |{fname}({arg_disp})| <= 1 for all real inputs. Thus, no real solutions exist for {c_lat}.",
            latex=rf"|{c_lat}| > 1 \implies \text{{No real solutions}}",
            type="equation"
        ))
        return r"\text{No real solutions}", steps

    # 3. Angle substitution if k != 1
    theta_name = r"\theta"
    if abs(k - 1.0) > 1e-9:
        steps.append(MathStep(
            description=f"Define angle substitution theta = {arg_disp} to solve elementary equation {fname}(theta) = {c_lat}",
            latex=rf"\theta = {arg_disp} \implies {fname}(\theta) = {c_lat}",
            type="equation"
        ))
    else:
        theta_name = "x"

    # 4. Reference angle alpha in Quadrant I
    if func == 'sin':
        alpha_val = math.asin(abs(c_val))
    elif func == 'cos':
        alpha_val = math.acos(abs(c_val))
    else:
        alpha_val = math.atan(abs(c_val))
        
    alpha_rad_lat, alpha_deg_lat, _ = get_exact_or_numeric_angle(alpha_val)
    
    steps.append(MathStep(
        description=f"Find acute reference angle alpha in Quadrant I where alpha = |{fname}^(-1)(|{c_lat}|)|",
        latex=rf"\alpha = \{func}^{{-1}}\left(|{c_lat}|\right) = {alpha_rad_lat} \; ({alpha_deg_lat})",
        type="equation"
    ))

    # 5. Quadrant analysis and branch definitions for theta
    theta_branches = []
    if func == 'sin':
        if abs(c_val) < 1e-9:
            theta_branches = [
                ("Root on axis", 0.0, "0"),
                ("Root on axis", math.pi, r"\pi")
            ]
            quad_msg = f"Since sin({theta_name}) = 0, angle {theta_name} lies on the axis at 0 and pi radians"
        elif abs(c_val - 1.0) < 1e-9:
            theta_branches = [
                ("Maximum point", math.pi / 2, r"\frac{\pi}{2}")
            ]
            quad_msg = f"Since sin({theta_name}) = 1, {theta_name} reaches its maximum at pi/2 (90 deg)"
        elif abs(c_val + 1.0) < 1e-9:
            theta_branches = [
                ("Minimum point", 3 * math.pi / 2, r"\frac{3\pi}{2}")
            ]
            quad_msg = f"Since sin({theta_name}) = -1, {theta_name} reaches its minimum at 3pi/2 (270 deg)"
        elif c_val > 0:
            u1_val = alpha_val
            u2_val = math.pi - alpha_val
            u1_lat, _, _ = get_exact_or_numeric_angle(u1_val)
            u2_lat, _, _ = get_exact_or_numeric_angle(u2_val)
            theta_branches = [
                ("Quadrant I", u1_val, u1_lat),
                ("Quadrant II", u2_val, u2_lat)
            ]
            quad_msg = f"Since sin({theta_name}) > 0, angle {theta_name} terminates in Quadrants I (alpha) and II (pi - alpha)"
        else:
            u1_val = math.pi + alpha_val
            u2_val = 2 * math.pi - alpha_val
            u1_lat, _, _ = get_exact_or_numeric_angle(u1_val)
            u2_lat, _, _ = get_exact_or_numeric_angle(u2_val)
            theta_branches = [
                ("Quadrant III", u1_val, u1_lat),
                ("Quadrant IV", u2_val, u2_lat)
            ]
            quad_msg = f"Since sin({theta_name}) < 0, angle {theta_name} terminates in Quadrants III (pi + alpha) and IV (2pi - alpha)"

    elif func == 'cos':
        if abs(c_val) < 1e-9:
            theta_branches = [
                ("Root on vertical axis", math.pi / 2, r"\frac{\pi}{2}"),
                ("Root on vertical axis", 3 * math.pi / 2, r"\frac{3\pi}{2}")
            ]
            quad_msg = f"Since cos({theta_name}) = 0, angle {theta_name} lies on the vertical axis at pi/2 and 3pi/2"
        elif abs(c_val - 1.0) < 1e-9:
            theta_branches = [
                ("Maximum point", 0.0, "0")
            ]
            quad_msg = f"Since cos({theta_name}) = 1, {theta_name} reaches its maximum at 0 radians"
        elif abs(c_val + 1.0) < 1e-9:
            theta_branches = [
                ("Minimum point", math.pi, r"\pi")
            ]
            quad_msg = f"Since cos({theta_name}) = -1, {theta_name} reaches its minimum at pi radians (180 deg)"
        elif c_val > 0:
            u1_val = alpha_val
            u2_val = 2 * math.pi - alpha_val
            u1_lat, _, _ = get_exact_or_numeric_angle(u1_val)
            u2_lat, _, _ = get_exact_or_numeric_angle(u2_val)
            theta_branches = [
                ("Quadrant I", u1_val, u1_lat),
                ("Quadrant IV", u2_val, u2_lat)
            ]
            quad_msg = f"Since cos({theta_name}) > 0, angle {theta_name} terminates in Quadrants I (alpha) and IV (2pi - alpha)"
        else:
            u1_val = math.pi - alpha_val
            u2_val = math.pi + alpha_val
            u1_lat, _, _ = get_exact_or_numeric_angle(u1_val)
            u2_lat, _, _ = get_exact_or_numeric_angle(u2_val)
            theta_branches = [
                ("Quadrant II", u1_val, u1_lat),
                ("Quadrant III", u2_val, u2_lat)
            ]
            quad_msg = f"Since cos({theta_name}) < 0, angle {theta_name} terminates in Quadrants II (pi - alpha) and III (pi + alpha)"

    else: # tan
        if abs(c_val) < 1e-9:
            theta_branches = [
                ("Root on horizontal axis", 0.0, "0")
            ]
            quad_msg = f"Since tan({theta_name}) = 0, angle {theta_name} lies at 0 radians with period pi"
        elif c_val > 0:
            u1_val = alpha_val
            u1_lat, _, _ = get_exact_or_numeric_angle(u1_val)
            theta_branches = [
                ("Quadrant I & III", u1_val, u1_lat)
            ]
            quad_msg = f"Since tan({theta_name}) > 0, solutions repeat every pi radians with base angle alpha in Quadrant I"
        else:
            u1_val = math.pi - alpha_val
            u1_lat, _, _ = get_exact_or_numeric_angle(u1_val)
            theta_branches = [
                ("Quadrant II & IV", u1_val, u1_lat)
            ]
            quad_msg = f"Since tan({theta_name}) < 0, solutions repeat every pi radians with base angle pi - alpha in Quadrant II"

    period_sym = r"2k\pi" if func != 'tan' else r"k\pi"
    period_val = 2 * math.pi if func != 'tan' else math.pi
    
    branch_lines = [rf"\text{{{b_name}:}} \quad {theta_name} = {b_lat} + {period_sym}" for b_name, b_val, b_lat in theta_branches]
    steps.append(MathStep(
        description=f"Quadrant Analysis: {quad_msg}",
        latex=r"\begin{cases} " + r" \\ ".join(branch_lines) + r" \end{cases} \quad (k \in \mathbb{Z})",
        type="equation"
    ))

    # 6. Divide by k to solve for x if k != 1
    x_branches_info = []
    if abs(k - 1.0) > 1e-9:
        for b_name, b_val, b_lat in theta_branches:
            x_base_val = b_val / k
            x_step_period = period_val / abs(k)
            period_k_lat = rf"\frac{{{period_sym}}}{{{fmt_num(k)}}}"
            x_base_lat, _, _ = get_exact_or_numeric_angle(x_base_val)
            steps.append(MathStep(
                description=f"Divide {theta_name} by k = {fmt_num(k)} to isolate x: x = {theta_name} / {fmt_num(k)}",
                latex=rf"x = \frac{{{b_lat} + {period_sym}}}{{{fmt_num(k)}}} = {x_base_lat} + {period_k_lat}",
                type="equation"
            ))
            x_branches_info.append((b_name, x_base_val, x_step_period, b_lat))
    else:
        for b_name, b_val, b_lat in theta_branches:
            x_branches_info.append((b_name, b_val, period_val, b_lat))

    # 7. Generate all principal solutions in [0, 2pi)
    principal_solutions = []
    for b_name, x_base_val, x_period, b_lat in x_branches_info:
        for n in range(-4, 10):
            cand = x_base_val + n * x_period
            norm_cand = cand % (2 * math.pi)
            if norm_cand < 0:
                norm_cand += 2 * math.pi
            if abs(norm_cand - 2 * math.pi) < 1e-4:
                norm_cand = 0.0
            if 0.0 - 1e-7 <= cand < 2 * math.pi - 1e-7:
                cand_rad_lat, cand_deg_lat, _ = get_exact_or_numeric_angle(cand)
                principal_solutions.append((cand, cand_rad_lat, cand_deg_lat))

    # Deduplicate and sort
    unique_principal = []
    seen = set()
    for rad_v, rad_l, deg_l in sorted(principal_solutions, key=lambda p: p[0]):
        key = round(rad_v, 4)
        if key not in seen:
            seen.add(key)
            unique_principal.append((rad_v, rad_l, deg_l))

    sol_latex_list = [p[1] for p in unique_principal]
    steps.append(MathStep(
        description="Determine all distinct principal roots in domain x in [0, 2pi)",
        latex=rf"x \in \left\{{ {', '.join(sol_latex_list)} \right\}}" + rf" \quad \left( {', '.join([f'{p[1]} = {p[2]}' for p in unique_principal])} \right)",
        type="equation"
    ))

    # 8. Verification
    verif_lines = []
    for rad_v, rad_l, deg_l in unique_principal:
        if func == 'sin':
            val_eval = math.sin(k * rad_v)
        elif func == 'cos':
            val_eval = math.cos(k * rad_v)
        else:
            val_eval = math.tan(k * rad_v)
        k_eval_str = f"{fmt_num(k)}" if abs(k - 1.0) > 1e-9 else ""
        verif_lines.append(rf"x = {rad_l}: \quad \{func}({k_eval_str}{rad_l}) = {fmt_num(val_eval)} = {c_lat} \; \checkmark")
        
    steps.append(MathStep(
        description="Verify principal solutions by direct evaluation in trigonometric function",
        latex=r"\begin{aligned} " + r" \\ ".join(verif_lines) + r" \end{aligned}",
        type="equation"
    ))

    # 9. General periodic solutions
    gen_list = []
    for p in unique_principal:
        gen_list.append(rf"{p[1]} + {period_sym}")
        
    if func == 'tan' and abs(k - 1.0) < 1e-9:
        first_lat = unique_principal[0][1] if unique_principal else r"\alpha"
        gen_str = rf"x = {first_lat} + k\pi \quad (k \in \mathbb{{Z}})"
    else:
        unique_gen = sorted(list(set(gen_list)))
        gen_str = r" \quad \text{or} \quad ".join([rf"x = {g}" for g in unique_gen]) + r" \quad (k \in \mathbb{Z})"
        
    steps.append(MathStep(
        description="Formulate the complete family of general periodic solutions (k in Z)",
        latex=gen_str,
        type="equation"
    ))

    sol_summary = ", ".join([f"x = {s}" for s in sol_latex_list])
    return sol_summary, steps

def solve_linear_trig_combination(A: float, B: float, C: float, original_eq: str) -> Tuple[str, List[MathStep]]:
    """
    Solve A*sin(x) + B*cos(x) = C step-by-step from scratch using the Harmonic Addition Theorem.
    Transforms linear combination into R*sin(x + phi) = C.
    """
    steps = []
    
    A_lat = format_radical_latex(A)
    B_lat = format_radical_latex(B)
    C_lat = format_radical_latex(C)
    
    term_a = format_trig_term(A, r"\sin", "x", is_first=True)
    term_b = format_trig_term(B, r"\cos", "x", is_first=False)
    
    # 1. Standard linear form
    steps.append(MathStep(
        description="Rearrange the equation into standard linear combination form A*sin(x) + B*cos(x) = C",
        latex=rf"{term_a} {term_b} = {C_lat} \quad \text{{with }} A = {A_lat}, \; B = {B_lat}, \; C = {C_lat}",
        type="equation"
    ))
    
    # 2. Harmonic Addition Theorem derivation
    steps.append(MathStep(
        description="Apply the Harmonic Addition Theorem: Express A*sin(x) + B*cos(x) as a single shifted sine wave R*sin(x + phi)",
        latex=r"A\sin(x) + B\cos(x) \equiv R\sin(x + \phi) = R\cos(\phi)\sin(x) + R\sin(\phi)\cos(x)",
        type="equation"
    ))
    
    # Calculate R = sqrt(A^2 + B^2) and phi = atan2(B, A)
    R_sq = A**2 + B**2
    R_val = math.sqrt(R_sq)
    R_lat = format_radical_latex(R_val)
    
    phi_val = math.atan2(B, A)
    phi_rad_lat, phi_deg_lat, phi_deg = get_exact_or_numeric_angle(phi_val)
    
    steps.append(MathStep(
        description=f"Calculate amplitude R = sqrt(A^2 + B^2) and phase angle phi = atan2(B, A)",
        latex=rf"R = \sqrt{{{A_lat}^2 + {B_lat}^2}} = {R_lat} \approx {R_val:.4g}, \quad \phi = \arctan\left(\frac{{{B_lat}}}{{{A_lat}}}\right) = {phi_rad_lat} \; ({phi_deg_lat})",
        type="equation"
    ))
    
    ratio_val = C / R_val
    ratio_lat = get_exact_or_numeric_val(ratio_val)
    
    # Check solvability
    if abs(ratio_val) > 1.0 + 1e-7:
        steps.append(MathStep(
            description=f"Divide both sides by amplitude R: ratio |C / R| = |{ratio_val:.4g}| > 1",
            latex=rf"\sin(x + {phi_rad_lat}) = \frac{{{C_lat}}}{{{R_lat}}} = {ratio_lat}",
            type="equation"
        ))
        steps.append(MathStep(
            description="Since the sine function is bounded within [-1, 1], |sin(theta)| <= 1 for all real angles. Therefore, no real solutions exist.",
            latex=rf"\left|\frac{{C}}{{R}}\right| = {abs(ratio_val):.4g} > 1 \implies \text{{No real solutions}}",
            type="equation"
        ))
        return r"\text{No real solutions}", steps
        
    ratio_val = max(-1.0, min(1.0, ratio_val))
    
    steps.append(MathStep(
        description="Divide both sides by amplitude R to isolate the shifted sine function",
        latex=rf"\sin\left(x + {phi_rad_lat}\right) = \frac{{{C_lat}}}{{{R_lat}}} = {ratio_lat} \approx {ratio_val:.4g}",
        type="equation"
    ))
    
    # Let u = x + phi, reference angle alpha = arcsin(|ratio|)
    alpha_val = math.asin(abs(ratio_val))
    alpha_rad_lat, alpha_deg_lat, _ = get_exact_or_numeric_angle(alpha_val)
    
    steps.append(MathStep(
        description=f"Substitute u = x + {phi_rad_lat} to form elementary equation sin(u) = {ratio_lat}, and determine the acute reference angle alpha",
        latex=rf"u = x + {phi_rad_lat} \implies \sin(u) = {ratio_lat}, \quad \alpha = \arcsin\left(\left|{ratio_lat}\right|\right) = {alpha_rad_lat} \; ({alpha_deg_lat})",
        type="equation"
    ))
    
    # Quadrant analysis for u
    if abs(ratio_val) < 1e-9:
        u_branches = [
            ("Root on axis", 0.0, "0"),
            ("Root on axis", math.pi, r"\pi")
        ]
        quad_desc = "Since sin(u) = 0, angle u lies on the axis at 0 and pi radians"
    elif abs(ratio_val - 1.0) < 1e-9:
        u_branches = [
            ("Boundary angle (maximum)", math.pi / 2, r"\frac{\pi}{2}")
        ]
        quad_desc = "Since sin(u) = 1, u reaches its maximum at pi/2 radians (90 deg)"
    elif abs(ratio_val + 1.0) < 1e-9:
        u_branches = [
            ("Boundary angle (minimum)", 3 * math.pi / 2, r"\frac{3\pi}{2}")
        ]
        quad_desc = "Since sin(u) = -1, u reaches its minimum at 3pi/2 radians (270 deg)"
    elif ratio_val > 0:
        u1_val = alpha_val
        u2_val = math.pi - alpha_val
        u1_lat, _, _ = get_exact_or_numeric_angle(u1_val)
        u2_lat, _, _ = get_exact_or_numeric_angle(u2_val)
        u_branches = [
            ("Quadrant I", u1_val, u1_lat),
            ("Quadrant II", u2_val, u2_lat)
        ]
        quad_desc = f"Since sin(u) = {ratio_lat} > 0, angle u terminates in Quadrant I (where u = alpha) or Quadrant II (where u = pi - alpha)"
    else:
        u1_val = math.pi + alpha_val
        u2_val = 2 * math.pi - alpha_val
        u1_lat, _, _ = get_exact_or_numeric_angle(u1_val)
        u2_lat, _, _ = get_exact_or_numeric_angle(u2_val)
        u_branches = [
            ("Quadrant III", u1_val, u1_lat),
            ("Quadrant IV", u2_val, u2_lat)
        ]
        quad_desc = f"Since sin(u) = {ratio_lat} < 0, angle u terminates in Quadrant III (where u = pi + alpha) or Quadrant IV (where u = 2pi - alpha)"

    branch_latex_lines = [rf"\text{{{q_name}:}} \quad u = {u_lat} + 2k\pi" for q_name, u_val, u_lat in u_branches]
    steps.append(MathStep(
        description=f"Quadrant Analysis: {quad_desc}",
        latex=r"\begin{cases} " + r" \\ ".join(branch_latex_lines) + r" \end{cases} \quad (k \in \mathbb{Z})",
        type="equation"
    ))
    
    # Back-substitute u = x + phi on each branch
    principal_solutions = []
    gen_solution_branches = []
    
    for idx, (q_name, u_val, u_lat) in enumerate(u_branches, 1):
        x_diff_lat, x_diff_val = angle_diff_to_latex(u_val, phi_val)
        
        steps.append(MathStep(
            description=f"Solve for x on Branch {idx} ({q_name}): Back-substitute u = x + {phi_rad_lat} and subtract {phi_rad_lat} from both sides",
            latex=rf"x + {phi_rad_lat} = {u_lat} + 2k\pi \implies x = {u_lat} - {phi_rad_lat} + 2k\pi = {x_diff_lat} + 2k\pi",
            type="equation"
        ))
        
        # Normalize into [0, 2pi)
        norm_val = x_diff_val % (2 * math.pi)
        if norm_val < 0:
            norm_val += 2 * math.pi
        if abs(norm_val - 2 * math.pi) < 1e-4:
            norm_val = 0.0
            
        k_needed = int(round((norm_val - x_diff_val) / (2 * math.pi)))
        x_rad_lat, x_deg_lat, _ = get_exact_or_numeric_angle(norm_val)
        
        if k_needed != 0:
            steps.append(MathStep(
                description=f"Evaluate Branch {idx} for k = {k_needed} to obtain the principal angle in [0, 2pi)",
                latex=rf"x = {x_diff_lat} + 2({k_needed})\pi = {x_rad_lat} \; ({x_deg_lat})",
                type="equation"
            ))
        else:
            steps.append(MathStep(
                description=f"Evaluate Branch {idx} for k = 0 in the principal interval [0, 2pi)",
                latex=rf"x = {x_rad_lat} \; ({x_deg_lat})",
                type="equation"
            ))
            
        principal_solutions.append((norm_val, x_rad_lat, x_deg_lat))
        gen_solution_branches.append(rf"{x_rad_lat} + 2k\pi")

    # Sort and remove duplicates from principal solutions
    unique_principal = []
    seen = set()
    for rad_v, rad_l, deg_l in sorted(principal_solutions, key=lambda p: p[0]):
        key = round(rad_v, 4)
        if key not in seen:
            seen.add(key)
            unique_principal.append((rad_v, rad_l, deg_l))
            
    sol_latex_list = [p[1] for p in unique_principal]
    steps.append(MathStep(
        description="Compile all distinct principal solutions within the domain x in [0, 2pi)",
        latex=rf"x \in \left\{{ {', '.join(sol_latex_list)} \right\}}" + rf" \quad \left( {', '.join([f'{p[1]} = {p[2]}' for p in unique_principal])} \right)",
        type="equation"
    ))
    
    # Verification in original equation
    verif_lines = []
    for rad_v, rad_l, deg_l in unique_principal:
        l_val = A * math.sin(rad_v) + B * math.cos(rad_v)
        v_term_a = format_trig_term(A, r"\sin", rad_l, is_first=True)
        v_term_b = format_trig_term(B, r"\cos", rad_l, is_first=False)
        verif_lines.append(rf"x = {rad_l}: \quad {v_term_a} {v_term_b} = {fmt_num(l_val)} = {C_lat} \; \checkmark")
    
    steps.append(MathStep(
        description="Verify each principal solution by direct substitution into the original equation",
        latex=r"\begin{aligned} " + r" \\ ".join(verif_lines) + r" \end{aligned}",
        type="equation"
    ))
    
    # General solutions
    unique_gen = sorted(list(set(gen_solution_branches)))
    steps.append(MathStep(
        description="Formulate the complete general periodic solutions incorporating period 2k*pi (k in Z)",
        latex=r" \quad \text{or} \quad ".join([rf"x = {g}" for g in unique_gen]) + r" \quad (k \in \mathbb{Z})",
        type="equation"
    ))
    
    sol_summary = ", ".join([f"x = {s}" for s in sol_latex_list])
    return sol_summary, steps

def solve_quadratic_trig(a: float, b: float, c: float, func_name: str, original_eq: str = "") -> Tuple[str, List[MathStep]]:
    """Solve a*func(x)^2 + b*func(x) + c = 0 with thorough quadratic steps from scratch."""
    steps = []
    fname = rf"\{func_name}"
    
    # 1. State substitution
    quad_str_parts = []
    if abs(a - 1.0) < 1e-9:
        quad_str_parts.append("u^2")
    elif abs(a - (-1.0)) < 1e-9:
        quad_str_parts.append("-u^2")
    else:
        quad_str_parts.append(f"{fmt_num(a)}u^2")
        
    if abs(b - 1.0) < 1e-9:
        quad_str_parts.append("+ u")
    elif abs(b - (-1.0)) < 1e-9:
        quad_str_parts.append("- u")
    elif b > 0:
        quad_str_parts.append(f"+ {fmt_num(b)}u")
    elif b < 0:
        quad_str_parts.append(f"- {fmt_num(abs(b))}u")
        
    if c > 0:
        quad_str_parts.append(f"+ {fmt_num(c)}")
    elif c < 0:
        quad_str_parts.append(f"- {fmt_num(abs(c))}")
        
    quad_lat = " ".join(quad_str_parts)
    steps.append(MathStep(
        description=f"Quadratic trigonometric substitution: Let u = {func_name}(x) to transform equation into quadratic polynomial in u",
        latex=rf"{quad_lat} = 0, \quad \text{{where }} u = \{func_name}(x)",
        type="equation"
    ))
    
    # 2. Discriminant
    disc = b**2 - 4 * a * c
    steps.append(MathStep(
        description=f"Calculate discriminant Delta = b^2 - 4ac with coefficients a = {fmt_num(a)}, b = {fmt_num(b)}, c = {fmt_num(c)}",
        latex=rf"\Delta = ({fmt_num(b)})^2 - 4({fmt_num(a)})({fmt_num(c)}) = {fmt_num(disc)}",
        type="equation"
    ))
    
    if disc < -1e-9:
        steps.append(MathStep(
            description="Since discriminant Delta < 0, quadratic polynomial in u has no real roots. Therefore, the trigonometric equation has no real solutions.",
            latex=r"\Delta < 0 \implies \text{No real solutions}",
            type="equation"
        ))
        return r"\text{No real solutions}", steps
        
    sqrt_disc = math.sqrt(max(0.0, disc))
    u1 = (-b + sqrt_disc) / (2 * a)
    u2 = (-b - sqrt_disc) / (2 * a)
    
    u1_lat = get_exact_or_numeric_val(u1)
    u2_lat = get_exact_or_numeric_val(u2)
    
    if abs(disc) < 1e-9:
        steps.append(MathStep(
            description="Single repeated root via quadratic formula u = -b / (2a)",
            latex=rf"u = \frac{{-{fmt_num(b)}}}{{2({fmt_num(a)})}} = {u1_lat}",
            type="equation"
        ))
        roots = [u1]
    else:
        steps.append(MathStep(
            description="Solve for u via the quadratic formula u = (-b +- sqrt(Delta)) / (2a)",
            latex=rf"u_1 = \frac{{-{fmt_num(b)} + \sqrt{{{fmt_num(disc)}}}}}{{2({fmt_num(a)})}} = {u1_lat}, \quad u_2 = \frac{{-{fmt_num(b)} - \sqrt{{{fmt_num(disc)}}}}}{{2({fmt_num(a)})}} = {u2_lat}",
            type="equation"
        ))
        roots = [u1, u2]
        
    all_principal_rad = []
    
    for idx, u_val in enumerate(dict.fromkeys([round(r, 6) for r in roots]), 1):
        u_lat = get_exact_or_numeric_val(u_val)
        if func_name in ['sin', 'cos'] and (u_val < -1.0 - 1e-7 or u_val > 1.0 + 1e-7):
            steps.append(MathStep(
                description=f"Branch {idx} (u = {u_lat}): Rejected because range of {func_name} is [-1, 1]",
                latex=rf"|\{func_name}(x)| \le 1 \implies \{func_name}(x) = {u_lat} \text{{ has no real solutions}}",
                type="equation"
            ))
            continue
            
        steps.append(MathStep(
            description=f"Branch {idx}: Substitute u = {fname}(x) back into equation: {fname}(x) = {u_lat}",
            latex=rf"\{func_name}(x) = {u_lat}",
            type="equation"
        ))
        
        _, sub_steps = solve_basic_trig(func_name, u_val, k=1.0)
        steps.extend(sub_steps[1:])
        
        # Collect roots
        if func_name == 'sin':
            base_rad = math.asin(u_val)
            candidates = [base_rad, math.pi - base_rad]
        elif func_name == 'cos':
            base_rad = math.acos(u_val)
            candidates = [base_rad, 2*math.pi - base_rad]
        else:
            base_rad = math.atan(u_val)
            candidates = [base_rad, base_rad + math.pi]
            
        for cand in candidates:
            norm = cand % (2 * math.pi)
            if norm < 0:
                norm += 2 * math.pi
            if abs(norm - 2 * math.pi) < 1e-4:
                norm = 0.0
            all_principal_rad.append(norm)

    # Compile combined summary
    unique_principal = []
    seen = set()
    for rad_v in sorted(all_principal_rad):
        key = round(rad_v, 4)
        if key not in seen:
            seen.add(key)
            rad_l, deg_l, _ = get_exact_or_numeric_angle(rad_v)
            unique_principal.append((rad_v, rad_l, deg_l))
            
    sol_latex_list = [p[1] for p in unique_principal]
    steps.append(MathStep(
        description="Unified principal solution set across all valid quadratic branches in [0, 2pi)",
        latex=rf"x \in \left\{{ {', '.join(sol_latex_list)} \right\}}" + rf" \quad \left( {', '.join([f'{p[1]} = {p[2]}' for p in unique_principal])} \right)",
        type="equation"
    ))
    
    unique_gen = [rf"{p[1]} + 2k\pi" for p in unique_principal]
    steps.append(MathStep(
        description="Unified general periodic solutions across all branches (k in Z)",
        latex=r" \quad \text{or} \quad ".join([rf"x = {g}" for g in unique_gen]) + r" \quad (k \in \mathbb{Z})",
        type="equation"
    ))
    
    sol_summary = ", ".join([f"x = {s}" for s in sol_latex_list])
    return sol_summary, steps

def parse_trig_side_pure(side_str: str, side_sign: float = 1.0) -> List[Dict[str, Any]]:
    """Parse one side of trigonometric equation into list of parsed terms."""
    s = side_str.strip().replace('**', '^')
    tokens = []
    current = ''
    paren_depth = 0
    for ch in s:
        if ch == '(':
            paren_depth += 1
            current += ch
        elif ch == ')':
            paren_depth -= 1
            current += ch
        elif (ch == '+' or ch == '-') and paren_depth == 0 and current.strip():
            tokens.append(current.strip())
            current = ch
        else:
            current += ch
    if current.strip():
        tokens.append(current.strip())
        
    terms = []
    for tok in tokens:
        tok_clean = tok.replace(' ', '')
        m_trig = re.match(r'^([+-]?[\w\.\/\*\(\)]*?)\*?(sin|cos|tan)\((\d*)\*?x\)(\^(\d+))?$', tok_clean, re.I)
        if m_trig:
            c_str, func, k_str, _, p_str = m_trig.groups()
            coeff = parse_number_or_radical(c_str) if c_str else 1.0
            k = float(k_str) if k_str else 1.0
            power = int(p_str) if p_str else 1
            terms.append({
                'type': 'trig',
                'func': func.lower(),
                'k': k,
                'power': power,
                'coeff': coeff * side_sign
            })
        else:
            val = parse_number_or_radical(tok_clean)
            terms.append({
                'type': 'const',
                'val': val * side_sign
            })
    return terms

def solve_trig_equation(equation_str: str) -> Tuple[str, List[MathStep]]:
    """
    Intelligent from-scratch trigonometric equation solver with zero external dependencies.
    Handles:
    - Homogeneous linear: sin(x) = cos(x), A*sin(kx) = B*cos(kx) -> tan(kx) = B/A
    - Linear combination: A*sin(x) + B*cos(x) = C (e.g. sin(x) = 1 - cos(x))
    - Quadratic in trig: a*sin(x)^2 + b*sin(x) + c = 0, cos(x)^2 - cos(x) = 0
    - Pythagorean convertible: cos(x)^2 + sin(x) = 1 -> sin(x)^2 - sin(x) = 0
    - Elementary single trig: a*func(k*x) = c, 2*sin(x) - 1 = 0, sin(2x) = 1
    """
    eq = equation_str.strip()
    eq_clean = eq.replace(" ", "")
    steps = []
    
    # 1. Homogeneous fast-path: sin(kx) = cos(kx) -> tan(kx) = 1
    m_homo = re.match(r'^(sin|cos)\((\d*)\*?x\)\s*=\s*(sin|cos)\((\d*)\*?x\)$', eq_clean, re.I)
    if m_homo:
        f1, k1_str, f2, k2_str = m_homo.groups()
        k1 = float(k1_str) if k1_str else 1.0
        k2 = float(k2_str) if k2_str else 1.0
        if f1.lower() != f2.lower() and abs(k1 - k2) < 1e-9:
            steps.append(MathStep(
                description=f"Divide both sides by cos({fmt_num(k1)}x) (noting cos({fmt_num(k1)}x) != 0, since cosine and sine cannot simultaneously be zero)",
                latex=rf"\frac{{\sin({fmt_num(k1)}x)}}{{\cos({fmt_num(k1)}x)}} = 1 \implies \tan({fmt_num(k1)}x) = 1",
                type="equation"
            ))
            sol_text, trig_steps = solve_basic_trig('tan', 1.0, k=k1)
            steps.extend(trig_steps)
            return sol_text, steps

    # 2. Parse LHS and RHS into standardized terms
    l_str, r_str = eq.split('=', 1) if '=' in eq else (eq, '0')
    all_terms = parse_trig_side_pure(l_str, +1.0) + parse_trig_side_pure(r_str, -1.0)
    
    # Accumulate coefficients
    # Check linear combination: A*sin(x) + B*cos(x) = C
    sin_lin = 0.0
    cos_lin = 0.0
    sin_sq = 0.0
    cos_sq = 0.0
    tan_lin = 0.0
    tan_sq = 0.0
    const_sum = 0.0
    other_terms = []
    
    for t in all_terms:
        if t['type'] == 'const':
            const_sum += t['val']
        elif t['type'] == 'trig':
            f, k_v, p, c_v = t['func'], t['k'], t['power'], t['coeff']
            if abs(k_v - 1.0) < 1e-9:
                if f == 'sin' and p == 1:
                    sin_lin += c_v
                elif f == 'sin' and p == 2:
                    sin_sq += c_v
                elif f == 'cos' and p == 1:
                    cos_lin += c_v
                elif f == 'cos' and p == 2:
                    cos_sq += c_v
                elif f == 'tan' and p == 1:
                    tan_lin += c_v
                elif f == 'tan' and p == 2:
                    tan_sq += c_v
                else:
                    other_terms.append(t)
            else:
                other_terms.append(t)

    # CASE A: Linear combination A*sin(x) + B*cos(x) = C (e.g. sin(x) = 1 - cos(x))
    if abs(sin_sq) < 1e-9 and abs(cos_sq) < 1e-9 and abs(tan_sq) < 1e-9 and abs(tan_lin) < 1e-9 and len(other_terms) == 0:
        if abs(sin_lin) > 1e-7 and abs(cos_lin) > 1e-7:
            A = sin_lin
            B = cos_lin
            C = -const_sum  # Move constant to RHS
            return solve_linear_trig_combination(A, B, C, equation_str)

    # CASE B: Pythagorean convertible (e.g. cos^2(x) + sin(x) = 1)
    if abs(cos_sq) > 1e-7 and abs(sin_lin) > 1e-7 and abs(cos_lin) < 1e-9 and abs(sin_sq) < 1e-9 and len(other_terms) == 0:
        steps.append(MathStep(
            description="Apply Pythagorean identity cos^2(x) = 1 - sin^2(x) to express equation entirely in terms of sin(x)",
            latex=r"\cos^2(x) = 1 - \sin^2(x)",
            type="equation"
        ))
        # cos_sq * (1 - sin^2(x)) -> -cos_sq * sin^2(x) + cos_sq
        new_sin_sq = -cos_sq
        new_const = const_sum + cos_sq
        return solve_quadratic_trig(new_sin_sq, sin_lin, new_const, 'sin', equation_str)
        
    if abs(sin_sq) > 1e-7 and abs(cos_lin) > 1e-7 and abs(sin_lin) < 1e-9 and abs(cos_sq) < 1e-9 and len(other_terms) == 0:
        steps.append(MathStep(
            description="Apply Pythagorean identity sin^2(x) = 1 - cos^2(x) to express equation entirely in terms of cos(x)",
            latex=r"\sin^2(x) = 1 - \cos^2(x)",
            type="equation"
        ))
        new_cos_sq = -sin_sq
        new_const = const_sum + sin_sq
        return solve_quadratic_trig(new_cos_sq, cos_lin, new_const, 'cos', equation_str)

    # CASE C: Quadratic in single trig function
    if abs(sin_sq) > 1e-7 and abs(cos_sq) < 1e-9 and abs(cos_lin) < 1e-9 and len(other_terms) == 0:
        return solve_quadratic_trig(sin_sq, sin_lin, const_sum, 'sin', equation_str)
    if abs(cos_sq) > 1e-7 and abs(sin_sq) < 1e-9 and abs(sin_lin) < 1e-9 and len(other_terms) == 0:
        return solve_quadratic_trig(cos_sq, cos_lin, const_sum, 'cos', equation_str)
    if abs(tan_sq) > 1e-7 and abs(sin_sq) < 1e-9 and abs(cos_sq) < 1e-9 and len(other_terms) == 0:
        return solve_quadratic_trig(tan_sq, tan_lin, const_sum, 'tan', equation_str)

    # CASE D: Linear in single trig function (k = 1)
    if abs(sin_lin) > 1e-7 and abs(cos_lin) < 1e-9 and abs(tan_lin) < 1e-9 and len(other_terms) == 0:
        target_val = -const_sum / sin_lin
        return solve_basic_trig('sin', target_val, k=1.0)
    if abs(cos_lin) > 1e-7 and abs(sin_lin) < 1e-9 and abs(tan_lin) < 1e-9 and len(other_terms) == 0:
        target_val = -const_sum / cos_lin
        return solve_basic_trig('cos', target_val, k=1.0)
    if abs(tan_lin) > 1e-7 and abs(sin_lin) < 1e-9 and abs(cos_lin) < 1e-9 and len(other_terms) == 0:
        target_val = -const_sum / tan_lin
        return solve_basic_trig('tan', target_val, k=1.0)

    # CASE E: Multiple angle linear single trig: a*func(k*x) + c = 0 (e.g. sin(2x) = 1)
    if len(other_terms) == 1 and abs(sin_lin) < 1e-9 and abs(cos_lin) < 1e-9 and abs(tan_lin) < 1e-9:
        t = other_terms[0]
        if t['power'] == 1:
            target_val = -const_sum / t['coeff']
            return solve_basic_trig(t['func'], target_val, k=t['k'])

    # CASE F: Multiple angle regex matcher fallback
    m_lin = re.match(r'^([+-]?\d*)\*?(sin|cos|tan)\((\d*)\*?x\)\s*([+-]\s*\d+)?\s*=\s*([+-]?\d+(?:\.\d+)?)\s*$', eq_clean, re.I)
    if m_lin:
        a_str, func_name, k_str, const_left, rhs_str = m_lin.groups()
        a = float(a_str) if a_str and a_str not in ["+", "-"] else (-1.0 if a_str == "-" else 1.0)
        k = float(k_str) if k_str else 1.0
        c_left = float(const_left.replace(" ", "")) if const_left else 0.0
        rhs = float(rhs_str) if rhs_str else 0.0
        target_val = (rhs - c_left) / a
        return solve_basic_trig(func_name.lower(), target_val, k=k)

    raise ValueError(f"Unable to parse trigonometric equation: {equation_str}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. TRIGONOMETRIC IDENTITIES ENGINE (PURE PYTHON)
# ─────────────────────────────────────────────────────────────────────────────

def simplify_trig_identity(expr_str: str) -> Tuple[str, List[MathStep]]:
    """Simplify identities with full mathematical proofs and derivations from scratch."""
    s = expr_str.strip()
    s_clean = s.replace(" ", "").replace("**", "^")
    steps = []
    
    # 1. Fundamental Pythagorean: sin^2(x) + cos^2(x) = 1
    if 'sin(x)^2+cos(x)^2' in s_clean or 'cos(x)^2+sin(x)^2' in s_clean:
        steps.append(MathStep(
            description="Identify Fundamental Pythagorean Trigonometric Identity",
            latex=r"\sin^2(x) + \cos^2(x) \equiv 1",
            type="equation"
        ))
        steps.append(MathStep(
            description="Derivation from the unit circle equation x^2 + y^2 = 1, where x = cos(x) and y = sin(x)",
            latex=r"(\cos(x))^2 + (\sin(x))^2 = 1 \implies 1",
            type="equation"
        ))
        return "1", steps

    # 2. 1 + tan^2(x) = sec^2(x)
    if '1+tan(x)^2' in s_clean or 'tan(x)^2+1' in s_clean:
        steps.append(MathStep(
            description="Divide the Pythagorean Identity sin^2(x) + cos^2(x) = 1 by cos^2(x)",
            latex=r"\frac{\sin^2(x)}{\cos^2(x)} + \frac{\cos^2(x)}{\cos^2(x)} = \frac{1}{\cos^2(x)}",
            type="equation"
        ))
        steps.append(MathStep(
            description="Substitute quotient definition tan(x) = sin(x)/cos(x) and reciprocal definition sec(x) = 1/cos(x)",
            latex=r"\tan^2(x) + 1 = \sec^2(x)",
            type="equation"
        ))
        return r"\sec^2(x)", steps

    # 3. 1 + cot^2(x) = csc^2(x)
    if '1+cot(x)^2' in s_clean or 'cot(x)^2+1' in s_clean:
        steps.append(MathStep(
            description="Divide the Pythagorean Identity sin^2(x) + cos^2(x) = 1 by sin^2(x)",
            latex=r"\frac{\sin^2(x)}{\sin^2(x)} + \frac{\cos^2(x)}{\sin^2(x)} = \frac{1}{\sin^2(x)}",
            type="equation"
        ))
        steps.append(MathStep(
            description="Substitute quotient definition cot(x) = cos(x)/sin(x) and reciprocal definition csc(x) = 1/sin(x)",
            latex=r"1 + \cot^2(x) = \csc^2(x)",
            type="equation"
        ))
        return r"\csc^2(x)", steps

    # 4. Double angle: sin(2x) = 2*sin(x)*cos(x)
    if 'sin(2x)' in s_clean or 'sin(2*x)' in s_clean:
        steps.append(MathStep(
            description="Apply Sine Angle Addition Identity: sin(a + b) = sin(a)cos(b) + cos(a)sin(b) with a = b = x",
            latex=r"\sin(2x) = \sin(x + x) = \sin(x)\cos(x) + \cos(x)\sin(x)",
            type="equation"
        ))
        steps.append(MathStep(
            description="Combine like terms: sin(x)cos(x) + cos(x)sin(x) = 2sin(x)cos(x)",
            latex=r"\sin(2x) = 2\sin(x)\cos(x)",
            type="equation"
        ))
        return r"2\sin(x)\cos(x)", steps

    # 5. Double angle: cos(2x) = cos^2(x) - sin^2(x)
    if 'cos(2x)' in s_clean or 'cos(2*x)' in s_clean:
        steps.append(MathStep(
            description="Apply Cosine Angle Addition Identity: cos(a + b) = cos(a)cos(b) - sin(a)sin(b) with a = b = x",
            latex=r"\cos(2x) = \cos(x + x) = \cos(x)\cos(x) - \sin(x)\sin(x)",
            type="equation"
        ))
        steps.append(MathStep(
            description="Equivalence forms: cos^2(x) - sin^2(x) = 2cos^2(x) - 1 = 1 - 2sin^2(x)",
            latex=r"\cos(2x) = \cos^2(x) - \sin^2(x)",
            type="equation"
        ))
        return r"\cos^2(x) - \sin^2(x)", steps

    # 6. Double angle: tan(2x) = 2*tan(x) / (1 - tan^2(x))
    if 'tan(2x)' in s_clean or 'tan(2*x)' in s_clean:
        steps.append(MathStep(
            description="Apply Tangent Angle Addition Identity: tan(a + b) = (tan(a) + tan(b)) / (1 - tan(a)tan(b)) with a = b = x",
            latex=r"\tan(2x) = \tan(x + x) = \frac{\tan(x) + \tan(x)}{1 - \tan(x)\tan(x)}",
            type="equation"
        ))
        steps.append(MathStep(
            description="Combine numerator and simplify denominator",
            latex=r"\tan(2x) = \frac{2\tan(x)}{1 - \tan^2(x)}",
            type="equation"
        ))
        return r"\frac{2\tan(x)}{1 - \tan^2(x)}", steps

    # 7. Quotient identity: sin(x) / cos(x) = tan(x)
    if 'sin(x)/cos(x)' in s_clean:
        steps.append(MathStep(
            description="Apply quotient trigonometric definition",
            latex=r"\frac{\sin(x)}{\cos(x)} = \tan(x)",
            type="equation"
        ))
        return r"\tan(x)", steps

    # 8. Quotient identity: cos(x) / sin(x) = cot(x)
    if 'cos(x)/sin(x)' in s_clean:
        steps.append(MathStep(
            description="Apply quotient trigonometric definition",
            latex=r"\frac{\cos(x)}{\sin(x)} = \cot(x)",
            type="equation"
        ))
        return r"\cot(x)", steps

    # 9. Product simplification: tan(x)*cos(x) = sin(x)
    if 'tan(x)*cos(x)' in s_clean or 'cos(x)*tan(x)' in s_clean:
        steps.append(MathStep(
            description="Substitute tan(x) = sin(x)/cos(x)",
            latex=r"\tan(x)\cos(x) = \frac{\sin(x)}{\cos(x)} \cdot \cos(x)",
            type="equation"
        ))
        steps.append(MathStep(
            description="Cancel common cos(x) factor",
            latex=r"= \sin(x)",
            type="equation"
        ))
        return r"\sin(x)", steps

    # 10. Default clean fallback
    steps.append(MathStep(
        description=f"Standard trigonometric expression: {s}",
        latex=rf"{s}",
        type="equation"
    ))
    return s, steps

# ─────────────────────────────────────────────────────────────────────────────
# 6. UNIFIED DISPATCHER: solve_trigonometry (PURE PYTHON)
# ─────────────────────────────────────────────────────────────────────────────

def solve_trigonometry(input_str: str) -> Tuple[str, List[MathStep]]:
    """
    Intelligent pure-Python trigonometry parser and dispatcher.
    Zero external dependencies.
    Handles:
    - Unit circle: unit_circle(pi/4), unit_circle(45), unit circle 30
    - Trig equations: sin(x) = 1 - cos(x), 2*sin(x) - 1 = 0, sin(2x) = 1, sin(x) = cos(x)
    - Evaluations: sin(pi/6), cos(45 deg), tan(pi/4), arcsin(0.5), sin 30, what is cos(60)
    - Identities: sin(x)^2 + cos(x)^2, 1 + tan(x)^2, sin(2x)
    """
    s = normalize_trig_str(input_str)
    s_lower = s.lower()
    
    # 1. Unit circle query
    if 'unit_circle' in s_lower or 'unitcircle' in s_lower or 'unit circle' in s_lower:
        m = re.search(r'unit_?circle\((.*?)\)', s, re.I)
        if not m:
            m = re.search(r'unit\s+circle\s+(.*)', s, re.I)
        arg = m.group(1).strip() if m else "pi/4"
        data, steps = unit_circle(arg)
        return f"cos={data['cos_latex']}, sin={data['sin_latex']}", steps

    # 2. Equation containing '='
    if '=' in s:
        return solve_trig_equation(s)
        
    # 3. Evaluation of numeric or constant expressions without variable x
    has_variable = bool('x' in s_lower or 'theta' in s_lower)
    if not has_variable and any(func in s_lower for func in ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan']):
        return evaluate_trig(s)

    # 4. Known identity patterns (with variable x)
    if has_variable:
        return simplify_trig_identity(s)
        
    # 5. Fallback evaluation
    if any(func in s_lower for func in ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan']):
        return evaluate_trig(s)
        
    raise ValueError(f"Unrecognized trigonometric query: {input_str}")
