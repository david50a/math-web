"""
Comprehensive Vector Mathematics Engine.
Supports:
1. 2D and 3D Vectors (algebraic, component, and standard unit vector notations).
2. Vector Magnitude, Normalization (Unit Vector), and Direction Cosines.
3. Linear Operations: Addition (Parallelogram rule), Subtraction, and Scalar Scaling.
4. Dot Product (Scalar Product), Angle between vectors, Orthogonality & Collinearity.
5. Vector Projection (proj_v u) and Orthogonal Component (Rejection).
6. Cross Product (Vector Product in 3D), Normal Vector, Parallelogram & Triangle Areas.
7. Scalar Triple Product (Volume of Parallelepiped, Coplanarity Test).
8. 3D Analytic Geometry: Line & Plane Equations, Point-to-Plane Distance.
"""

import math
import re
from typing import Dict, Any, List, Optional, Tuple, Union
import sympy as sp

def fmt_v(val: float, decimals: int = 4) -> str:
    """Format float neatly."""
    if abs(val - round(val)) < 1e-7:
        return str(int(round(val)))
    return f"{round(val, decimals):.{decimals}f}".rstrip('0').rstrip('.')

def parse_vector(expr_str: str) -> List[float]:
    """
    Parses vector from formats:
    - [1, 2] or [1, 2, 3]
    - (1, 2) or (1, 2, 3)
    - 2i + 3j - 4k or 2*i + 3*j - 4*k
    - vector(1, 2, 3)
    """
    s = expr_str.strip()
    
    # 1. Bracket or parenthesis format: [x, y, z] or (x, y, z)
    match_list = re.findall(r'[-+]?\s*\d*\.?\d+(?:/\d+)?', s)
    if ('[' in s or '(' in s or 'vector' in s.lower()) and match_list:
        coords = []
        for token in match_list:
            token_clean = token.replace(" ", "")
            try:
                coords.append(float(sp.sympify(token_clean).evalf()))
            except Exception:
                coords.append(float(token_clean))
        if 2 <= len(coords) <= 3:
            return coords

    # 2. i, j, k component form: e.g. "2i - 3j + k"
    if any(u in s.lower() for u in ['i', 'j', 'k']):
        # extract coefficients for i, j, k
        def extract_coeff(unit: str, text: str) -> float:
            pattern = rf'([+-]?\s*\d*\.?\d*)\s*\*?\s*{unit}\b'
            m = re.search(pattern, text, re.IGNORECASE)
            if not m:
                return 0.0
            val_str = m.group(1).replace(" ", "")
            if not val_str or val_str == '+':
                return 1.0
            if val_str == '-':
                return -1.0
            return float(val_str)

        vx = extract_coeff('i', s)
        vy = extract_coeff('j', s)
        vz = extract_coeff('k', s)
        if abs(vz) > 1e-9 or 'k' in s.lower():
            return [vx, vy, vz]
        return [vx, vy]

    # Fallback comma-split
    parts = s.strip("[]() ").split(',')
    if 2 <= len(parts) <= 3:
        return [float(sp.sympify(p.strip()).evalf()) for p in parts]

    raise ValueError(f"Could not parse vector expression: '{expr_str}'. Example formats: '[1, 2, 3]', '(2, -1)', or '2i - 3j + 4k'.")

def vector_to_latex(v: List[float], label: str = "v") -> str:
    """Formats vector as LaTeX column vector or component bracket."""
    if len(v) == 2:
        return r"\begin{pmatrix} " + f"{fmt_v(v[0])} \\\\ {fmt_v(v[1])}" + r" \end{pmatrix}"
    return r"\begin{pmatrix} " + f"{fmt_v(v[0])} \\\\ {fmt_v(v[1])} \\\\ {fmt_v(v[2])}" + r" \end{pmatrix}"

def vector_to_unit_form(v: List[float]) -> str:
    """Formats vector in terms of i, j, k."""
    units = [r"\hat{i}", r"\hat{j}", r"\hat{k}"]
    terms = []
    for idx, val in enumerate(v):
        if abs(val) < 1e-9:
            continue
        sign = "+" if val > 0 and len(terms) > 0 else ("-" if val < 0 and len(terms) == 0 else "")
        coeff_str = "" if abs(abs(val) - 1.0) < 1e-9 else fmt_v(abs(val))
        if val < 0 and len(terms) > 0:
            terms.append(f"- {coeff_str}{units[idx]}")
        else:
            terms.append(f"{sign} {coeff_str}{units[idx]}".strip())
    return " ".join(terms) if terms else r"\vec{0}"

def get_vector_details(v: List[float], label: str = "u") -> Dict[str, Any]:
    """Computes magnitude, unit vector, and direction cosines."""
    mag_sq = sum(x**2 for x in v)
    mag = math.sqrt(mag_sq)
    unit_v = [x / mag for x in v] if mag > 1e-9 else [0.0] * len(v)
    
    dir_cosines = [round(x / mag, 4) if mag > 1e-9 else 0.0 for x in v]
    dir_angles_deg = [round(math.degrees(math.acos(max(-1.0, min(1.0, c)))), 2) for c in dir_cosines]

    return {
        "label": label,
        "dimension": len(v),
        "components": [round(x, 4) for x in v],
        "magnitude": round(mag, 4),
        "magnitude_squared": round(mag_sq, 4),
        "unit_vector": [round(x, 4) for x in unit_v],
        "latex": vector_to_latex(v, label),
        "unit_form": vector_to_unit_form(v),
        "unit_vector_latex": vector_to_latex(unit_v, f"\\hat{{{label}}}"),
        "direction_cosines": dir_cosines,
        "direction_angles_deg": dir_angles_deg
    }

def solve_vector_operation(
    op: str,
    u_str: str,
    v_str: Optional[str] = None,
    w_str: Optional[str] = None,
    scalar_c: Optional[float] = None
) -> Dict[str, Any]:
    """
    Executes and generates full mathematical step-by-step proofs for vector operations.
    op in: 'details', 'add', 'subtract', 'scale', 'dot', 'angle', 'projection', 'cross', 'triple_product', 'plane_equation'
    """
    steps = []
    
    u = parse_vector(u_str)
    dim = len(u)
    u_det = get_vector_details(u, "\\vec{u}")

    # 1. Single Vector Details
    if op == 'details':
        steps.append({
            "stepTitle": "1. Vector Component Breakdown",
            "latex": f"\\vec{{u}} = {u_det['latex']} = {u_det['unit_form']}",
            "description": f"Vector in {dim}-dimensional Euclidean space $\\mathbb{{R}}^{{{dim}}}$."
        })
        steps.append({
            "stepTitle": "2. Calculate Euclidean Norm (Magnitude ||u||)",
            "latex": f"\\|\\vec{{u}}\\| = \\sqrt{{{ ' + '.join([f'({fmt_v(x)})^2' for x in u]) }}} = \\sqrt{{{fmt_v(u_det['magnitude_squared'])}}} = {fmt_v(u_det['magnitude'])}",
            "description": "Pythagorean length calculated from coordinate projections."
        })
        steps.append({
            "stepTitle": "3. Normalize to Unit Vector (û = u / ||u||)",
            "latex": f"\\hat{{u}} = \\frac{{\\vec{{u}}}}{{\\|\\vec{{u}}\\|}} = {u_det['unit_vector_latex']}",
            "description": "Direction vector with magnitude exactly equal to 1."
        })
        if dim == 3:
            steps.append({
                "stepTitle": "4. Direction Cosines and Angles",
                "latex": f"\\cos\\alpha = {fmt_v(u_det['direction_cosines'][0])} \\implies \\alpha = {fmt_v(u_det['direction_angles_deg'][0])}^\\circ, \\quad \\cos\\beta = {fmt_v(u_det['direction_cosines'][1])} \\implies \\beta = {fmt_v(u_det['direction_angles_deg'][1])}^\\circ, \\quad \\cos\\gamma = {fmt_v(u_det['direction_cosines'][2])} \\implies \\gamma = {fmt_v(u_det['direction_angles_deg'][2])}^\\circ",
                "description": "Angles measured from positive x, y, and z coordinate axes."
            })
            
        return {
            "operation": "details",
            "dimension": dim,
            "summary": f"Vector $\\vec{{u}}$ with magnitude $\\|\\vec{{u}}\\| = {fmt_v(u_det['magnitude'])}$.",
            "final_answer": u_det['latex'],
            "primary": u_det,
            "steps": steps,
            "vectors": [u_det]
        }

    # 2. Scalar Scaling: c * u
    if op == 'scale':
        c = scalar_c if scalar_c is not None else 2.0
        res = [c * x for x in u]
        res_det = get_vector_details(res, f"{fmt_v(c)}\\vec{{u}}")
        steps.append({
            "stepTitle": "1. Multiply Each Component by Scalar c",
            "latex": f"{fmt_v(c)} \\vec{{u}} = {fmt_v(c)} {u_det['latex']} = \\begin{{pmatrix}} { ' \\\\ '.join([f'{fmt_v(c)} \\cdot ({fmt_v(x)})' for x in u]) } \\end{{pmatrix}}",
            "description": "Homogeneous dilation by scalar factor $c$."
        })
        steps.append({
            "stepTitle": "2. Resulting Scaled Vector",
            "latex": f"{fmt_v(c)} \\vec{{u}} = {res_det['latex']}",
            "description": f"Magnitude scales by $|c| = {fmt_v(abs(c))}$: $\\|c\\vec{{u}}\\| = {fmt_v(res_det['magnitude'])}$."
        })
        return {
            "operation": "scale",
            "scalar_c": c,
            "summary": f"${fmt_v(c)} \\vec{{u}} = {res_det['latex']}$.",
            "final_answer": res_det['latex'],
            "primary": u_det,
            "result": res_det,
            "steps": steps,
            "vectors": [u_det, res_det]
        }

    # Binary operations requiring v
    if not v_str:
        raise ValueError(f"Operation '{op}' requires a second vector v.")
        
    v = parse_vector(v_str)
    # Pad to 3D if one is 3D and one is 2D
    if len(u) == 2 and len(v) == 3:
        u = [u[0], u[1], 0.0]
        u_det = get_vector_details(u, "\\vec{u}")
    elif len(u) == 3 and len(v) == 2:
        v = [v[0], v[1], 0.0]
    elif len(u) != len(v):
        raise ValueError(f"Vector dimensions do not match: u has dim {len(u)}, v has dim {len(v)}.")
        
    v_det = get_vector_details(v, "\\vec{v}")
    dim = len(u)

    # 3. Vector Addition: u + v
    if op == 'add':
        res = [u[i] + v[i] for i in range(dim)]
        res_det = get_vector_details(res, "\\vec{u} + \\vec{v}")
        steps.append({
            "stepTitle": "1. Component-wise Summation",
            "latex": f"\\vec{{u}} + \\vec{{v}} = \\begin{{pmatrix}} { ' \\\\ '.join([f'{fmt_v(u[i])} + {fmt_v(v[i])}' for i in range(dim)]) } \\end{{pmatrix}}",
            "description": "Combine horizontal and vertical projections along basis axes."
        })
        steps.append({
            "stepTitle": "2. Resultant Vector",
            "latex": f"\\vec{{u}} + \\vec{{v}} = {res_det['latex']}",
            "description": "Geometrically corresponds to the Parallelogram Law (or Head-to-Tail triangle method)."
        })
        steps.append({
            "stepTitle": "3. Resultant Magnitude",
            "latex": f"\\|\\vec{{u}} + \\vec{{v}}\\| = {fmt_v(res_det['magnitude'])}",
            "description": "Notice $\\|\\vec{u} + \\vec{v}\\| \\le \\|\\vec{u}\\| + \\|\\vec{v}\\|$ (Triangle Inequality)."
        })
        return {
            "operation": "add",
            "summary": f"$\\vec{{u}} + \\vec{{v}} = {res_det['latex']}$ with magnitude {fmt_v(res_det['magnitude'])}.",
            "final_answer": res_det['latex'],
            "primary": u_det,
            "secondary": v_det,
            "result": res_det,
            "steps": steps,
            "vectors": [u_det, v_det, res_det]
        }

    # 4. Vector Subtraction: u - v
    if op == 'subtract':
        res = [u[i] - v[i] for i in range(dim)]
        res_det = get_vector_details(res, "\\vec{u} - \\vec{v}")
        steps.append({
            "stepTitle": "1. Component-wise Subtraction",
            "latex": f"\\vec{{u}} - \\vec{{v}} = \\begin{{pmatrix}} { ' \\\\ '.join([f'{fmt_v(u[i])} - ({fmt_v(v[i])})' for i in range(dim)]) } \\end{{pmatrix}}",
            "description": "Subtract coordinate components."
        })
        steps.append({
            "stepTitle": "2. Difference Displacement Vector",
            "latex": f"\\vec{{u}} - \\vec{{v}} = {res_det['latex']}",
            "description": "Represents the direct vector connecting the tip of $\\vec{v}$ to the tip of $\\vec{u}$."
        })
        return {
            "operation": "subtract",
            "summary": f"$\\vec{{u}} - \\vec{{v}} = {res_det['latex']}$.",
            "final_answer": res_det['latex'],
            "primary": u_det,
            "secondary": v_det,
            "result": res_det,
            "steps": steps,
            "vectors": [u_det, v_det, res_det]
        }

    # 5. Dot Product (Scalar Product): u · v
    if op in ['dot', 'angle']:
        dot_terms = [f"({fmt_v(u[i])})({fmt_v(v[i])})" for i in range(dim)]
        dot_val = sum(u[i] * v[i] for i in range(dim))
        
        steps.append({
            "stepTitle": "1. Compute Algebraic Dot Product Formula",
            "latex": f"\\vec{{u}} \\cdot \\vec{{v}} = { ' + '.join(dot_terms) } = {fmt_v(dot_val)}",
            "description": "Sum of products of corresponding components."
        })
        
        # Calculate angle theta
        cos_theta = 0.0
        angle_rad = 0.0
        angle_deg = 0.0
        if u_det['magnitude'] > 1e-9 and v_det['magnitude'] > 1e-9:
            cos_theta = dot_val / (u_det['magnitude'] * v_det['magnitude'])
            cos_theta = max(-1.0, min(1.0, cos_theta))
            angle_rad = math.acos(cos_theta)
            angle_deg = math.degrees(angle_rad)

        steps.append({
            "stepTitle": "2. Geometric Dot Product Formula: u · v = ||u|| ||v|| cos(theta)",
            "latex": f"\\cos\\theta = \\frac{{\\vec{{u}} \\cdot \\vec{{v}}}}{{\\|\\vec{{u}}\\| \\|\\vec{{v}}\\|}} = \\frac{{{fmt_v(dot_val)}}}{{({fmt_v(u_det['magnitude'])})({fmt_v(v_det['magnitude'])})}} = {fmt_v(cos_theta)}",
            "description": "Relates the algebraic dot product to the included angle $\\theta$."
        })
        steps.append({
            "stepTitle": "3. Evaluate Included Angle theta",
            "latex": f"\\theta = \\arccos({fmt_v(cos_theta)}) = {fmt_v(angle_deg)}^\\circ \\quad ({fmt_v(angle_rad)} \\text{{ rad}})",
            "description": "The geometric angle between the two vector lines."
        })
        
        ortho_status = "Orthogonal (Perpendicular, 90°)" if abs(dot_val) < 1e-6 else ("Acute (< 90°)" if dot_val > 0 else "Obtuse (> 90°)")
        steps.append({
            "stepTitle": "4. Orthogonality Condition",
            "latex": f"\\vec{{u}} \\cdot \\vec{{v}} = {fmt_v(dot_val)} \\implies \\text{{{ortho_status}}}",
            "description": "Two vectors are perpendicular if and only if their dot product equals 0."
        })
        
        return {
            "operation": op,
            "dot_product": round(dot_val, 4),
            "cos_theta": round(cos_theta, 4),
            "angle_rad": round(angle_rad, 4),
            "angle_deg": round(angle_deg, 2),
            "is_orthogonal": abs(dot_val) < 1e-6,
            "summary": f"Dot product $\\vec{{u}} \\cdot \\vec{{v}} = {fmt_v(dot_val)}$ with included angle $\\theta = {fmt_v(angle_deg)}^\\circ$.",
            "final_answer": f"\\vec{{u}} \\cdot \\vec{{v}} = {fmt_v(dot_val)}, \\quad \\theta = {fmt_v(angle_deg)}^\\circ",
            "primary": u_det,
            "secondary": v_det,
            "steps": steps,
            "vectors": [u_det, v_det]
        }

    # 6. Vector Projection: proj_v u = ((u · v) / ||v||^2) * v
    if op == 'projection':
        dot_val = sum(u[i] * v[i] for i in range(dim))
        v_mag_sq = v_det['magnitude_squared']
        if v_mag_sq < 1e-12:
            raise ZeroDivisionError("Cannot project onto a zero vector.")
            
        scalar_comp = dot_val / v_det['magnitude']
        proj_coeff = dot_val / v_mag_sq
        proj_vec = [proj_coeff * x for x in v]
        rejection_vec = [u[i] - proj_vec[i] for i in range(dim)]
        
        proj_det = get_vector_details(proj_vec, "\\operatorname{proj}_{\\vec{v}}\\vec{u}")
        rej_det = get_vector_details(rejection_vec, "\\operatorname{rej}_{\\vec{v}}\\vec{u}")
        
        steps.append({
            "stepTitle": "1. Scalar Component (comp_v u)",
            "latex": f"\\operatorname{{comp}}_{{\\vec{{v}}}}\\vec{{u}} = \\frac{{\\vec{{u}} \\cdot \\vec{{v}}}}{{\\|\\vec{{v}}\\|}} = \\frac{{{fmt_v(dot_val)}}}{{{fmt_v(v_det['magnitude'])}}} = {fmt_v(scalar_comp)}",
            "description": "The signed length of the shadow cast by $\\vec{u}$ onto $\\vec{v}$."
        })
        steps.append({
            "stepTitle": "2. Vector Projection Formula: proj_v u = ((u · v) / ||v||^2) v",
            "latex": f"\\operatorname{{proj}}_{{\\vec{{v}}}}\\vec{{u}} = \\left( \\frac{{{fmt_v(dot_val)}}}{{{fmt_v(v_mag_sq)}}} \\right) {v_det['latex']} = {proj_det['latex']}",
            "description": "The parallel vector component along the direction of $\\vec{v}$."
        })
        steps.append({
            "stepTitle": "3. Orthogonal Rejection (Perpendicular Component)",
            "latex": f"\\vec{{u}}_{{\\perp}} = \\vec{{u}} - \\operatorname{{proj}}_{{\\vec{{v}}}}\\vec{{u}} = {u_det['latex']} - {proj_det['latex']} = {rej_det['latex']}",
            "description": "Component perpendicular to $\\vec{v}$, satisfying $\\vec{u}_{\\perp} \\cdot \\vec{v} = 0$."
        })
        return {
            "operation": "projection",
            "scalar_projection": round(scalar_comp, 4),
            "projection_vector": proj_det,
            "rejection_vector": rej_det,
            "summary": f"Vector projection of $\\vec{{u}}$ onto $\\vec{{v}}$ is ${proj_det['latex']}$ with scalar component {fmt_v(scalar_comp)}.",
            "final_answer": proj_det['latex'],
            "primary": u_det,
            "secondary": v_det,
            "result": proj_det,
            "steps": steps,
            "vectors": [u_det, v_det, proj_det, rej_det]
        }

    # 7. Cross Product (Vector Product): u × v (3D only)
    if op == 'cross':
        # Ensure 3D
        u3 = u if len(u) == 3 else [u[0], u[1], 0.0]
        v3 = v if len(v) == 3 else [v[0], v[1], 0.0]
        
        # Cross product determinant
        cx = u3[1] * v3[2] - u3[2] * v3[1]
        cy = u3[2] * v3[0] - u3[0] * v3[2]
        cz = u3[0] * v3[1] - u3[1] * v3[0]
        c_vec = [cx, cy, cz]
        c_det = get_vector_details(c_vec, "\\vec{u} \\times \\vec{v}")
        
        parallelogram_area = c_det['magnitude']
        triangle_area = parallelogram_area / 2.0
        
        steps.append({
            "stepTitle": "1. 3×3 Determinant Formalism",
            "latex": r"\vec{u} \times \vec{v} = \begin{vmatrix} \hat{i} & \hat{j} & \hat{k} \\" + f"{fmt_v(u3[0])} & {fmt_v(u3[1])} & {fmt_v(u3[2])} \\\\ {fmt_v(v3[0])} & {fmt_v(v3[1])} & {fmt_v(v3[2])}" + r"\end{vmatrix}",
            "description": "Constructed via the formal determinant of the standard basis."
        })
        steps.append({
            "stepTitle": "2. Laplace Cofactor Expansion",
            "latex": f"= \\hat{{i}} \\begin{{vmatrix}} {fmt_v(u3[1])} & {fmt_v(u3[2])} \\\\ {fmt_v(v3[1])} & {fmt_v(v3[2])} \\end{{vmatrix}} - \\hat{{j}} \\begin{{vmatrix}} {fmt_v(u3[0])} & {fmt_v(u3[2])} \\\\ {fmt_v(v3[0])} & {fmt_v(v3[2])} \\end{{vmatrix}} + \\hat{{k}} \\begin{{vmatrix}} {fmt_v(u3[0])} & {fmt_v(u3[1])} \\\\ {fmt_v(v3[0])} & {fmt_v(v3[1])} \\end{{vmatrix}}",
            "description": "Expand along the top basis row."
        })
        steps.append({
            "stepTitle": "3. Resulting Cross Product Normal Vector",
            "latex": f"\\vec{{u}} \\times \\vec{{v}} = {c_det['latex']} = {c_det['unit_form']}",
            "description": "A vector strictly perpendicular to both $\\vec{u}$ and $\\vec{v}$ governed by the Right-Hand Rule."
        })
        steps.append({
            "stepTitle": "4. Parallelogram & Triangle Area",
            "latex": f"\\text{{Area}}(\\text{{Parallelogram}}) = \\|\\vec{{u}} \\times \\vec{{v}}\\| = {fmt_v(parallelogram_area)}, \\quad \\text{{Area}}(\\triangle) = \\frac{{1}}{{2}}\\|\\vec{{u}} \\times \\vec{{v}}\\| = {fmt_v(triangle_area)}",
            "description": "The magnitude of the cross product equals the area of the parallelogram spanned by the two vectors."
        })
        
        return {
            "operation": "cross",
            "cross_vector": c_det,
            "parallelogram_area": round(parallelogram_area, 4),
            "triangle_area": round(triangle_area, 4),
            "summary": f"Cross product $\\vec{{u}} \\times \\vec{{v}} = {c_det['latex']}$ with parallelogram area {fmt_v(parallelogram_area)}.",
            "final_answer": c_det['latex'],
            "primary": u_det,
            "secondary": v_det,
            "result": c_det,
            "steps": steps,
            "vectors": [u_det, v_det, c_det]
        }

    # 8. Scalar Triple Product: u · (v × w)
    if op == 'triple_product':
        if not w_str:
            raise ValueError("Scalar triple product requires a third vector w.")
        w = parse_vector(w_str)
        u3 = u if len(u) == 3 else [u[0], u[1], 0.0]
        v3 = v if len(v) == 3 else [v[0], v[1], 0.0]
        w3 = w if len(w) == 3 else [w[0], w[1], 0.0]
        w_det = get_vector_details(w3, "\\vec{w}")
        
        # Determinant of 3x3 matrix
        mat = sp.Matrix([u3, v3, w3])
        det_val = float(mat.det())
        vol = abs(det_val)
        is_coplanar = abs(det_val) < 1e-6
        
        steps.append({
            "stepTitle": "1. 3×3 Determinant Formulation for Triple Product",
            "latex": r"\vec{u} \cdot (\vec{v} \times \vec{w}) = \begin{vmatrix} " + f"{fmt_v(u3[0])} & {fmt_v(u3[1])} & {fmt_v(u3[2])} \\\\ {fmt_v(v3[0])} & {fmt_v(v3[1])} & {fmt_v(v3[2])} \\\\ {fmt_v(w3[0])} & {fmt_v(w3[1])} & {fmt_v(w3[2])}" + r" \end{vmatrix}",
            "description": "Scalar triple product equals the determinant of the 3×3 coordinate matrix."
        })
        steps.append({
            "stepTitle": "2. Evaluate Determinant",
            "latex": f"\\vec{{u}} \\cdot (\\vec{{v}} \\times \\vec{{w}}) = {fmt_v(det_val)}",
            "description": "Signed volume of the parallelepiped."
        })
        steps.append({
            "stepTitle": "3. Volume of Parallelepiped",
            "latex": f"V = |\\vec{{u}} \\cdot (\\vec{{v}} \\times \\vec{{w}})| = |{fmt_v(det_val)}| = {fmt_v(vol)}",
            "description": "Geometric volume spanned by the three edges."
        })
        steps.append({
            "stepTitle": "4. Coplanarity Test",
            "latex": f"\\text{{Coplanar: }} {is_coplanar} \\quad (\\det = {fmt_v(det_val)})",
            "description": "Three vectors are coplanar if and only if their scalar triple product is zero."
        })
        
        return {
            "operation": "triple_product",
            "triple_product": round(det_val, 4),
            "volume": round(vol, 4),
            "is_coplanar": is_coplanar,
            "summary": f"Scalar triple product $\\vec{{u}} \\cdot (\\vec{{v}} \\times \\vec{{w}}) = {fmt_v(det_val)}$ with parallelepiped volume {fmt_v(vol)}.",
            "final_answer": f"V = {fmt_v(vol)}",
            "primary": u_det,
            "secondary": v_det,
            "tertiary": w_det,
            "steps": steps,
            "vectors": [u_det, v_det, w_det]
        }

    # 9. 3D Plane Equation: Plane through point P0 with spanning vectors u and v
    if op == 'plane_equation':
        u3 = u if len(u) == 3 else [u[0], u[1], 0.0]
        v3 = v if len(v) == 3 else [v[0], v[1], 0.0]
        
        # Normal vector n = u x v
        nx = u3[1] * v3[2] - u3[2] * v3[1]
        ny = u3[2] * v3[0] - u3[0] * v3[2]
        nz = u3[0] * v3[1] - u3[1] * v3[0]
        n_mag = math.hypot(nx, ny, nz)
        if n_mag < 1e-9:
            raise ValueError("Vectors u and v are collinear and cannot define a unique plane.")
            
        # Point P0 defaults to origin or can be parsed from w_str
        p0 = parse_vector(w_str) if w_str else [0.0, 0.0, 0.0]
        if len(p0) == 2:
            p0 = [p0[0], p0[1], 0.0]
            
        D = -(nx * p0[0] + ny * p0[1] + nz * p0[2])
        sign_D = "+" if D >= 0 else "-"
        plane_latex = f"{fmt_v(nx)}x {'+ ' if ny >= 0 else '- '}{fmt_v(abs(ny))}y {'+ ' if nz >= 0 else '- '}{fmt_v(abs(nz))}z {sign_D} {fmt_v(abs(D))} = 0"
        
        steps.append({
            "stepTitle": "1. Find Normal Vector n via Cross Product u × v",
            "latex": f"\\vec{{n}} = \\vec{{u}} \\times \\vec{{v}} = {vector_to_latex([nx, ny, nz], '\\vec{n}')}",
            "description": "The normal vector $\\vec{n} = \\langle A, B, C \\rangle$ is perpendicular to every direction on the plane."
        })
        steps.append({
            "stepTitle": "2. Point-Normal Form Equation of the Plane",
            "latex": f"A(x - x_0) + B(y - y_0) + C(z - z_0) = 0 \\implies {fmt_v(nx)}(x - {fmt_v(p0[0])}) + {fmt_v(ny)}(y - {fmt_v(p0[1])}) + {fmt_v(nz)}(z - {fmt_v(p0[2])}) = 0",
            "description": "Dot product of normal $\\vec{n}$ with displacement $(P - P_0)$ equals zero."
        })
        steps.append({
            "stepTitle": "3. General Algebraic Plane Equation",
            "latex": plane_latex,
            "description": "Standard Cartesian equation $Ax + By + Cz + D = 0$."
        })
        
        return {
            "operation": "plane_equation",
            "normal_vector": get_vector_details([nx, ny, nz], "\\vec{n}"),
            "plane_latex": plane_latex,
            "point_p0": p0,
            "coefficients": {"A": round(nx, 4), "B": round(ny, 4), "C": round(nz, 4), "D": round(D, 4)},
            "summary": f"Plane equation: ${plane_latex}$.",
            "final_answer": plane_latex,
            "primary": u_det,
            "secondary": v_det,
            "steps": steps,
            "vectors": [u_det, v_det, get_vector_details([nx, ny, nz], "\\vec{n}")]
        }

    raise ValueError(f"Unknown vector operation: '{op}'")

def get_vector_presets() -> List[Dict[str, Any]]:
    """Curated presets for high school, 5-unit Bagrut 582, and college linear algebra."""
    return [
        {
            "id": "cross_product_normal",
            "title": "3D Cross Product & Normal Vector",
            "category": "3D Geometry",
            "description": "Compute u × v for u = [1, 2, 3] and v = [3, -1, 2], finding the orthogonal normal and area of the spanned parallelogram.",
            "op": "cross",
            "u": "[1, 2, 3]",
            "v": "[3, -1, 2]"
        },
        {
            "id": "vector_projection_work",
            "title": "Vector Projection & Orthogonal Rejection",
            "category": "Projections & Angles",
            "description": "Project u = [4, 3] onto v = [2, 0], decomposing u into parallel and perpendicular components.",
            "op": "projection",
            "u": "[4, 3]",
            "v": "[2, 0]"
        },
        {
            "id": "dot_product_angle",
            "title": "Angle Between 3D Vectors",
            "category": "Dot Product",
            "description": "Find the angle between u = [1, 1, 0] and v = [0, 1, 1] using cos(theta) = (u · v) / (||u|| ||v||).",
            "op": "angle",
            "u": "[1, 1, 0]",
            "v": "[0, 1, 1]"
        },
        {
            "id": "bagrut_582_plane",
            "title": "Bagrut 582: Equation of a 3D Plane",
            "category": "5-Unit Bagrut",
            "description": "Find the equation of the plane passing through P0(1, 2, 3) spanned by vectors u = [1, 0, 2] and v = [0, 3, 1].",
            "op": "plane_equation",
            "u": "[1, 0, 2]",
            "v": "[0, 3, 1]",
            "w": "[1, 2, 3]"
        },
        {
            "id": "coplanar_triple_product",
            "title": "Coplanarity & Parallelepiped Volume",
            "category": "Triple Product",
            "description": "Compute u · (v × w) to determine if three 3D vectors lie in the exact same plane.",
            "op": "triple_product",
            "u": "[1, 2, 3]",
            "v": "[4, 5, 6]",
            "w": "[7, 8, 9]"
        },
        {
            "id": "parallelogram_addition",
            "title": "Vector Addition (Parallelogram Law)",
            "category": "2D Vectors",
            "description": "Add 2D vectors u = [3, 1] and v = [1, 4] with graphical parallelogram representation.",
            "op": "add",
            "u": "[3, 1]",
            "v": "[1, 4]"
        }
    ]
