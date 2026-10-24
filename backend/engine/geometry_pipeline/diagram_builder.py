import math
from typing import Dict, Any, List
from .models import (
    DiagramData,
    GeometricPoint,
    GeometricSegment,
    GeometricPolygon,
    GeometricCircle,
    GeometricAngle,
    GeometricVector,
    ComplexNumberPoint
)

def build_trapezoid_diagram(calc_context: Dict[str, Any]) -> DiagramData:
    """
    Constructs accurate SVG primitives & coordinates for Trapezoid (e.g. ABCD, PQRS),
    diagonal, extension rays to point (e.g. E, T), and the incircle.
    """
    verts = calc_context.get("vertex_names", ["A", "B", "C", "D"])
    VA, VB, VC, VD = verts[0], verts[1], verts[2], verts[3]
    VE = calc_context.get("extension_point", "E")
    param = calc_context.get("param_var", "k")
    ang_sym = calc_context.get("angle_sym", r"\alpha")
    c2 = calc_context.get("c2", 2.0)
    alpha_deg = calc_context.get("alpha_deg", 60.0)
    angle_adc_deg = calc_context.get("angle_adc_deg", 30.0)
    r_val = calc_context.get("inradius", 14.0)

    base_y = 210.0
    x_D, y_D = 40.0, base_y
    x_C, y_C = 240.0, base_y
    
    # Midpoint of DC is at x=140
    # E is vertex of triangle EDC at x=140, y = base_y - 200 * sin(60°) = 210 - 173.2 = 36.8
    x_E, y_E = 140.0, 36.8
    
    # A is on segment ED
    ratio_top = 1.0 / c2 if c2 > 0 else 0.5
    x_A = x_E + (x_D - x_E) * ratio_top
    y_A = y_E + (y_D - y_E) * ratio_top
    
    # B is on segment EC
    x_B = x_E + (x_C - x_E) * ratio_top
    y_B = y_E + (y_C - y_E) * ratio_top
    
    # Incenter of extension triangle:
    x_I, y_I = 140.0, 152.3
    r_incircle = 57.7
    
    points = [
        GeometricPoint(name=VA, x=round(x_A, 1), y=round(y_A, 1), label=VA, color="#38bdf8", highlight=True),
        GeometricPoint(name=VB, x=round(x_B, 1), y=round(y_B, 1), label=VB, color="#38bdf8", highlight=True),
        GeometricPoint(name=VC, x=round(x_C, 1), y=round(y_C, 1), label=VC, color="#38bdf8", highlight=True),
        GeometricPoint(name=VD, x=round(x_D, 1), y=round(y_D, 1), label=VD, color="#38bdf8", highlight=True),
        GeometricPoint(name=VE, x=round(x_E, 1), y=round(y_E, 1), label=f"{VE} (Intersection)", color="#a855f7", highlight=False),
        GeometricPoint(name="I", x=round(x_I, 1), y=round(y_I, 1), label="I (Incenter)", color="#ec4899", highlight=False)
    ]
    
    segments = [
        # Trapezoid core edges
        GeometricSegment(start=VA, end=VB, length_label=param, color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start=VB, end=VC, length_label=param, color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start=VC, end=VD, length_label=f"{int(c2) if c2 == int(c2) else c2}{param}", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start=VD, end=VA, length_label=f"{VD}{VA}", color="#38bdf8", stroke_width=2.5),
        
        # Diagonal AC
        GeometricSegment(start=VA, end=VC, length_label=f"{VA}{VC}", is_dashed=True, color="#f59e0b", stroke_width=2.0),
        
        # Extensions to VE
        GeometricSegment(start=VA, end=VE, length_label="Extension", is_dashed=True, is_construction=True, color="#c084fc", stroke_width=1.8),
        GeometricSegment(start=VB, end=VE, length_label="Extension", is_dashed=True, is_construction=True, color="#c084fc", stroke_width=1.8),
        
        # Inradius indicator line
        GeometricSegment(start="I", end="I_perp", length_label=f"r = {r_val:.0f}", is_dashed=True, is_construction=True, color="#ec4899", stroke_width=1.5)
    ]
    
    points.append(GeometricPoint(name="I_perp", x=140.0, y=210.0, label="Touch Point", color="#ec4899"))
    
    polygons = [
        GeometricPolygon(
            name=f"Trapezoid {VA}{VB}{VC}{VD}",
            vertices=[VA, VB, VC, VD],
            fill_color="rgba(56, 189, 248, 0.12)",
            stroke_color="#38bdf8"
        ),
        GeometricPolygon(
            name=f"Triangle {VE}{VD}{VC}",
            vertices=[VE, VD, VC],
            fill_color="rgba(168, 85, 247, 0.05)",
            stroke_color="rgba(168, 85, 247, 0.4)"
        )
    ]
    
    circles = [
        GeometricCircle(
            center=[x_I, y_I],
            center_name="I",
            radius=r_incircle,
            label=f"Incircle (r = {r_val:.0f})",
            is_incircle=True,
            color="#ec4899",
            fill_color="rgba(236, 72, 153, 0.07)"
        )
    ]
    
    angles = [
        GeometricAngle(vertex=VB, p1=VA, p2=VC, label=ang_sym, degrees=alpha_deg, color="#fbbf24"),
        GeometricAngle(vertex=VD, p1=VA, p2=VC, label=f"{angle_adc_deg:.0f}°", degrees=angle_adc_deg, color="#34d399"),
        GeometricAngle(vertex=VA, p1=VD, p2=VC, label="90°", degrees=90.0, is_right_angle=True, color="#ef4444")
    ]
    
    return DiagramData(
        title=f"Trapezoid {VA}{VB}{VC}{VD} with Extensions & Incircle",
        viewbox={"min_x": 10.0, "min_y": 15.0, "width": 260.0, "height": 220.0},
        points=points,
        segments=segments,
        polygons=polygons,
        circles=circles,
        angles=angles,
        annotations=[
            f"{VA}{VB} ∥ {VD}{VC} (Parallel Bases)",
            f"{VA}{VB} = {VB}{VC} = {param} (Isosceles △{VA}{VB}{VC})",
            f"△{VE}{VA}{VB} ∼ △{VE}{VD}{VC} (Similarity ratio 1:{c2:.0f})",
            f"Inradius r = {r_val:.0f} (△{VE}{VD}{VC})"
        ]
    )

def build_right_triangle_diagram(calc_context: Dict[str, Any]) -> DiagramData:
    """
    Constructs accurate SVG primitives for Right Triangle ABC with right angle at C,
    hypotenuse AB, and inscribed circle with radius r = (a + b - c)/2.
    """
    a_val = calc_context.get("leg_a", 12.0)
    b_val = calc_context.get("leg_b", 5.0)
    c_val = calc_context.get("hypotenuse", 13.0)
    r_val = calc_context.get("inradius", 2.0)
    
    # Scale into standard SVG viewport (width ~260, height ~220)
    # Right angle at C (50, 190)
    x_C, y_C = 50.0, 190.0
    # Horizontal leg BC
    leg_bc_px = 160.0
    # Vertical leg AC
    leg_ac_px = leg_bc_px * (a_val / b_val)
    # Clamp vertical to fit nicely
    if leg_ac_px > 150.0:
        scale_ratio = 150.0 / leg_ac_px
        leg_ac_px = 150.0
        leg_bc_px *= scale_ratio
        
    x_B = x_C + leg_bc_px
    y_B = y_C
    
    x_A = x_C
    y_A = y_C - leg_ac_px
    
    # Incenter I px: at distance r_px from both AC and BC
    scale_factor = leg_bc_px / b_val
    r_px = r_val * scale_factor
    x_I = x_C + r_px
    y_I = y_C - r_px
    
    points = [
        GeometricPoint(name="A", x=round(x_A, 1), y=round(y_A, 1), label="A", color="#38bdf8", highlight=True),
        GeometricPoint(name="B", x=round(x_B, 1), y=round(y_B, 1), label="B", color="#38bdf8", highlight=True),
        GeometricPoint(name="C", x=round(x_C, 1), y=round(y_C, 1), label="C (90°)", color="#ef4444", highlight=True),
        GeometricPoint(name="I", x=round(x_I, 1), y=round(y_I, 1), label="I (Incenter)", color="#ec4899", highlight=False),
        GeometricPoint(name="I_perp_BC", x=round(x_I, 1), y=round(y_C, 1), label="Touch BC", color="#ec4899"),
        GeometricPoint(name="I_perp_AC", x=round(x_C, 1), y=round(y_I, 1), label="Touch AC", color="#ec4899")
    ]
    
    segments = [
        GeometricSegment(start="A", end="C", length_label=f"AC = {a_val}", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="C", end="B", length_label=f"BC = {b_val}", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="A", end="B", length_label=f"AB = {c_val:.2f}", color="#f59e0b", stroke_width=2.8),
        # Inradius projection segments
        GeometricSegment(start="I", end="I_perp_BC", length_label=f"r = {r_val:.2f}", is_dashed=True, is_construction=True, color="#ec4899", stroke_width=1.5),
        GeometricSegment(start="I", end="I_perp_AC", length_label=f"r = {r_val:.2f}", is_dashed=True, is_construction=True, color="#ec4899", stroke_width=1.5)
    ]
    
    polygons = [
        GeometricPolygon(
            name="Triangle ABC",
            vertices=["A", "C", "B"],
            fill_color="rgba(56, 189, 248, 0.12)",
            stroke_color="#38bdf8"
        )
    ]
    
    circles = [
        GeometricCircle(
            center=[round(x_I, 1), round(y_I, 1)],
            center_name="I",
            radius=round(r_px, 1),
            label=f"Incircle (r = {r_val:.2f})",
            is_incircle=True,
            color="#ec4899",
            fill_color="rgba(236, 72, 153, 0.08)"
        )
    ]
    
    angles = [
        GeometricAngle(vertex="C", p1="A", p2="B", label="90°", degrees=90.0, is_right_angle=True, color="#ef4444")
    ]
    
    return DiagramData(
        title=f"Right Triangle ABC with Incircle (AC={a_val}, BC={b_val})",
        viewbox={"min_x": 20.0, "min_y": 20.0, "width": 240.0, "height": 200.0},
        points=points,
        segments=segments,
        polygons=polygons,
        circles=circles,
        angles=angles,
        annotations=[
            f"Right Angle ∠C = 90° (Hypotenuse AB = {c_val:.2f})",
            f"Pythagorean Theorem: AB² = AC² + BC² = {a_val**2:.0f} + {b_val**2:.0f} = {c_val**2:.0f}",
            f"Inradius Formula: r = (a + b - c)/2 = {r_val:.2f}",
            f"Area(△ABC) = {0.5*a_val*b_val:.1f}, Incircle Area = {math.pi*r_val**2:.2f}"
        ]
    )

def build_cyclic_quad_diagram(calc_context: Dict[str, Any]) -> DiagramData:
    """
    Constructs accurate SVG primitives for Cyclic Quadrilateral ABCD inscribed in a circle
    with diameter AC = 10, right angle at B (6, 8, 10) and right angle at D (isosceles right triangle).
    """
    # Circumcircle centered at (130, 115) with radius 80
    cx, cy = 130.0, 115.0
    R_px = 80.0
    
    # Diameter AC horizontal across the circle
    x_A, y_A = cx - R_px, cy
    x_C, y_C = cx + R_px, cy
    
    # Vertex B on upper semicircle: angle 106.26° so AB=6, BC=8
    # theta = 106.26 deg -> cos = -0.28, sin = 0.96
    rad_b = math.radians(106.26)
    x_B = cx + R_px * math.cos(rad_b)
    y_B = cy - R_px * math.sin(rad_b)
    
    # Vertex D on lower semicircle: angle 270° (perpendicular down, isosceles right triangle ADC)
    x_D = cx
    y_D = cy + R_px
    
    points = [
        GeometricPoint(name="A", x=round(x_A, 1), y=round(y_A, 1), label="A", color="#38bdf8", highlight=True),
        GeometricPoint(name="B", x=round(x_B, 1), y=round(y_B, 1), label="B (90°)", color="#34d399", highlight=True),
        GeometricPoint(name="C", x=round(x_C, 1), y=round(y_C, 1), label="C", color="#38bdf8", highlight=True),
        GeometricPoint(name="D", x=round(x_D, 1), y=round(y_D, 1), label="D (90°)", color="#34d399", highlight=True),
        GeometricPoint(name="O", x=round(cx, 1), y=round(cy, 1), label="O (Center)", color="#f59e0b", highlight=False)
    ]
    
    segments = [
        GeometricSegment(start="A", end="B", length_label="AB = 6", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="B", end="C", length_label="BC = 8", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="C", end="D", length_label="CD = 5√2", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="D", end="A", length_label="DA = 5√2", color="#38bdf8", stroke_width=2.5),
        # Diameter AC
        GeometricSegment(start="A", end="C", length_label="Diameter AC = 10", is_dashed=True, color="#f59e0b", stroke_width=2.2)
    ]
    
    polygons = [
        GeometricPolygon(
            name="Quadrilateral ABCD",
            vertices=["A", "B", "C", "D"],
            fill_color="rgba(56, 189, 248, 0.12)",
            stroke_color="#38bdf8"
        )
    ]
    
    circles = [
        GeometricCircle(
            center=[round(cx, 1), round(cy, 1)],
            center_name="O",
            radius=round(R_px, 1),
            label="Circumcircle (R = 5)",
            is_incircle=False,
            color="#f59e0b",
            fill_color="rgba(245, 158, 11, 0.05)"
        )
    ]
    
    angles = [
        GeometricAngle(vertex="B", p1="A", p2="C", label="90°", degrees=90.0, is_right_angle=True, color="#ef4444"),
        GeometricAngle(vertex="D", p1="A", p2="C", label="90°", degrees=90.0, is_right_angle=True, color="#ef4444")
    ]
    
    return DiagramData(
        title="Cyclic Quadrilateral ABCD Inscribed in Circumcircle",
        viewbox={"min_x": 30.0, "min_y": 15.0, "width": 200.0, "height": 200.0},
        points=points,
        segments=segments,
        polygons=polygons,
        circles=circles,
        angles=angles,
        annotations=[
            "Thales' Inscribed Angle Theorem: ∠ABC = 90° and ∠ADC = 90°",
            "Chord AC passes through Circumcenter O (Diameter = 10, Radius R = 5)",
            "Area(ABCD) = Area(△ABC) + Area(△ADC) = 24 + 25 = 49",
            "Perimeter = 6 + 8 + 5√2 + 5√2 ≈ 28.14"
        ]
    )

def build_pyramid_vector_diagram(calc_context: Dict[str, Any]) -> DiagramData:
    """
    Constructs accurate 3D isometric representation of Triangular Pyramid SABC,
    with apex S, base vertices A, B, C, centroid M, vector arrows u, v, w, and altitude SM.
    """
    # Apex S high center
    x_S, y_S = 130.0, 35.0
    
    # Base triangle vertices in perspective
    x_A, y_A = 40.0, 175.0
    x_B, y_B = 220.0, 185.0
    x_C, y_C = 125.0, 225.0
    
    # Centroid M of base
    x_M = (x_A + x_B + x_C) / 3.0
    y_M = (y_A + y_B + y_C) / 3.0
    
    points = [
        GeometricPoint(name="S", x=round(x_S, 1), y=round(y_S, 1), label="S (Apex)", color="#ec4899", highlight=True),
        GeometricPoint(name="A", x=round(x_A, 1), y=round(y_A, 1), label="A", color="#38bdf8", highlight=True),
        GeometricPoint(name="B", x=round(x_B, 1), y=round(y_B, 1), label="B", color="#38bdf8", highlight=True),
        GeometricPoint(name="C", x=round(x_C, 1), y=round(y_C, 1), label="C", color="#38bdf8", highlight=True),
        GeometricPoint(name="M", x=round(x_M, 1), y=round(y_M, 1), label="M (Centroid)", color="#fbbf24", highlight=True)
    ]
    
    # Edge segments
    segments = [
        # Base edges
        GeometricSegment(start="A", end="B", length_label="AB = v - u", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="B", end="C", length_label="BC = w - v", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="C", end="A", length_label="CA = u - w", color="#38bdf8", stroke_width=2.5),
        # Altitude SM dashed
        GeometricSegment(start="S", end="M", length_label="Altitude h", is_dashed=True, is_construction=True, color="#fbbf24", stroke_width=2.2)
    ]
    
    # Vectors u, v, w, and altitude SM
    vectors = [
        GeometricVector(start="S", end="A", label="u (SA)", components=[6.0, 0.0, 0.0], color="#10b981", stroke_width=2.5),
        GeometricVector(start="S", end="B", label="v (SB)", components=[3.0, 5.2, 0.0], color="#10b981", stroke_width=2.5),
        GeometricVector(start="S", end="C", label="w (SC)", components=[3.0, 1.7, 4.9], color="#10b981", stroke_width=2.5),
        GeometricVector(start="S", end="M", label="SM = (u+v+w)/3", color="#fbbf24", stroke_width=2.2, is_dashed=True)
    ]
    
    polygons = [
        GeometricPolygon(
            name="Base ABC",
            vertices=["A", "B", "C"],
            fill_color="rgba(56, 189, 248, 0.15)",
            stroke_color="#38bdf8"
        ),
        GeometricPolygon(
            name="Face SAB",
            vertices=["S", "A", "B"],
            fill_color="rgba(16, 185, 129, 0.06)",
            stroke_color="rgba(16, 185, 129, 0.4)"
        )
    ]
    
    angles = [
        GeometricAngle(vertex="S", p1="A", p2="B", label="60°", degrees=60.0, color="#fbbf24"),
        GeometricAngle(vertex="M", p1="S", p2="A", label="90°", degrees=90.0, is_right_angle=True, color="#ef4444")
    ]
    
    return DiagramData(
        title="3D Triangular Pyramid SABC with Base Centroid & Altitude Vectors",
        viewbox={"min_x": 15.0, "min_y": 15.0, "width": 240.0, "height": 230.0},
        points=points,
        segments=segments,
        polygons=polygons,
        circles=[],
        angles=angles,
        vectors=vectors,
        annotations=[
            "Lateral Edges: ||u|| = ||v|| = ||w|| = 6 with u · v = 18",
            "Lateral Face Vertex Angle: cos(θ) = 18/36 = 1/2 ⇒ θ = 60° (Equilateral Faces)",
            "Centroid Vector: SM = 1/3 (u + v + w)",
            "Orthogonality Proof: SM · AB = 0 and SM · BC = 0 ⇒ SM ⊥ Base(ABC)"
        ]
    )

def build_complex_square_diagram(calc_context: Dict[str, Any]) -> DiagramData:
    """
    Constructs accurate Argand plane SVG primitives for the roots of (z - 2)^4 = -16,
    forming a regular square centered at (2, 0) with side length 2√2 and area 8.
    """
    # Center of Argand grid: Real axis at y = 125, Imaginary axis at x = 70 (scale = 35 px/unit)
    x_origin = 70.0
    y_origin = 125.0
    unit_scale = 35.0
    
    # Center of square z_c = 2.0 + 0i
    x_center = x_origin + 2.0 * unit_scale
    y_center = y_origin
    radius_px = 2.0 * unit_scale # radius = 2
    
    # 4 Roots: z_k = 2 + 2*cis(45° + 90°*k)
    # k=0: 2 + sqrt(2) + i*sqrt(2) ≈ 3.41 + 1.41i
    # k=1: 2 - sqrt(2) + i*sqrt(2) ≈ 0.59 + 1.41i
    # k=2: 2 - sqrt(2) - i*sqrt(2) ≈ 0.59 - 1.41i
    # k=3: 2 + sqrt(2) - i*sqrt(2) ≈ 3.41 - 1.41i
    offset = math.sqrt(2.0) * unit_scale
    
    x_z0, y_z0 = x_center + offset, y_center - offset
    x_z1, y_z1 = x_center - offset, y_center - offset
    x_z2, y_z2 = x_center - offset, y_center + offset
    x_z3, y_z3 = x_center + offset, y_center + offset
    
    points = [
        GeometricPoint(name="O", x=round(x_origin, 1), y=round(y_origin, 1), label="0 (Origin)", color="#94a3b8", highlight=False),
        GeometricPoint(name="C", x=round(x_center, 1), y=round(y_center, 1), label="Center (2,0)", color="#f59e0b", highlight=True),
        GeometricPoint(name="z0", x=round(x_z0, 1), y=round(y_z0, 1), label="z₀ (3.41 + 1.41i)", color="#38bdf8", highlight=True),
        GeometricPoint(name="z1", x=round(x_z1, 1), y=round(y_z1, 1), label="z₁ (0.59 + 1.41i)", color="#38bdf8", highlight=True),
        GeometricPoint(name="z2", x=round(x_z2, 1), y=round(y_z2, 1), label="z₂ (0.59 - 1.41i)", color="#38bdf8", highlight=True),
        GeometricPoint(name="z3", x=round(x_z3, 1), y=round(y_z3, 1), label="z₃ (3.41 - 1.41i)", color="#38bdf8", highlight=True)
    ]
    
    complex_points = [
        ComplexNumberPoint(name="z0", real=3.41, imag=1.41, polar_r=3.69, polar_theta_deg=22.5, label="z₀ = 2 + √2 + i√2", color="#38bdf8"),
        ComplexNumberPoint(name="z1", real=0.59, imag=1.41, polar_r=1.53, polar_theta_deg=67.3, label="z₁ = 2 - √2 + i√2", color="#38bdf8"),
        ComplexNumberPoint(name="z2", real=0.59, imag=-1.41, polar_r=1.53, polar_theta_deg=-67.3, label="z₂ = 2 - √2 - i√2", color="#38bdf8"),
        ComplexNumberPoint(name="z3", real=3.41, imag=-1.41, polar_r=3.69, polar_theta_deg=-22.5, label="z₃ = 2 + √2 - i√2", color="#38bdf8")
    ]
    
    segments = [
        # Axes
        GeometricSegment(start="Re_neg", end="Re_pos", length_label="Real Axis (Re)", color="#64748b", stroke_width=1.5),
        GeometricSegment(start="Im_neg", end="Im_pos", length_label="Imag Axis (Im)", color="#64748b", stroke_width=1.5),
        # Square edges
        GeometricSegment(start="z0", end="z1", length_label="s = 2√2", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="z1", end="z2", length_label="s = 2√2", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="z2", end="z3", length_label="s = 2√2", color="#38bdf8", stroke_width=2.5),
        GeometricSegment(start="z3", end="z0", length_label="s = 2√2", color="#38bdf8", stroke_width=2.5),
        # Spokes from center
        GeometricSegment(start="C", end="z0", length_label="R = 2", is_dashed=True, color="#f59e0b", stroke_width=1.5),
        GeometricSegment(start="C", end="z1", is_dashed=True, color="#f59e0b", stroke_width=1.5)
    ]
    
    # Extra points for axes endpoints
    points.extend([
        GeometricPoint(name="Re_neg", x=20.0, y=round(y_origin, 1), label="-1", color="#64748b"),
        GeometricPoint(name="Re_pos", x=250.0, y=round(y_origin, 1), label="+5", color="#64748b"),
        GeometricPoint(name="Im_neg", x=round(x_origin, 1), y=225.0, label="-2.5i", color="#64748b"),
        GeometricPoint(name="Im_pos", x=round(x_origin, 1), y=25.0, label="+2.5i", color="#64748b")
    ])
    
    polygons = [
        GeometricPolygon(
            name="Square in Complex Plane",
            vertices=["z0", "z1", "z2", "z3"],
            fill_color="rgba(56, 189, 248, 0.15)",
            stroke_color="#38bdf8"
        )
    ]
    
    circles = [
        GeometricCircle(
            center=[round(x_center, 1), round(y_center, 1)],
            center_name="C",
            radius=round(radius_px, 1),
            label="Locus Circle |z - 2| = 2",
            is_incircle=False,
            color="#f59e0b",
            fill_color="rgba(245, 158, 11, 0.05)"
        )
    ]
    
    angles = [
        GeometricAngle(vertex="z1", p1="z0", p2="z2", label="90°", degrees=90.0, is_right_angle=True, color="#ef4444")
    ]
    
    return DiagramData(
        title="Complex Plane Square: Roots of (z - 2)^4 = -16",
        viewbox={"min_x": 15.0, "min_y": 15.0, "width": 245.0, "height": 220.0},
        points=points,
        segments=segments,
        polygons=polygons,
        circles=circles,
        angles=angles,
        complex_points=complex_points,
        annotations=[
            "Roots equation: (z - 2)^4 = -16 = 16 cis(180°)",
            "Substitution w = z - 2: |w| = 2, Arg(w_k) = 45° + 90°·k",
            "Vertices form an axis-aligned square rotated by 45° around center (2, 0)",
            "Side Length s = 2√2 ≈ 2.83, Exact Area = s² = 8"
        ]
    )

def build_diagram_for_problem(model: Any, calc_context: Dict[str, Any]) -> DiagramData:
    """
    Dispatches to appropriate diagram builder according to calc_context['shape_type'].
    """
    shape_type = calc_context.get("shape_type", "").lower()
    
    if "right_triangle" in shape_type or "hypotenuse" in shape_type:
        return build_right_triangle_diagram(calc_context)
    elif "cyclic_quadrilateral" in shape_type or "circle" in shape_type:
        return build_cyclic_quad_diagram(calc_context)
    elif "pyramid" in shape_type or "vector" in shape_type:
        return build_pyramid_vector_diagram(calc_context)
    elif "complex" in shape_type or "square" in shape_type:
        return build_complex_square_diagram(calc_context)
    elif "trapezoid" in shape_type:
        return build_trapezoid_diagram(calc_context)
        
    # Check problem model text if shape_type was not set
    if hasattr(model, "raw_question"):
        q = model.raw_question.lower()
        if "pyramid" in q or "vector" in q:
            return build_pyramid_vector_diagram(calc_context)
        if "complex" in q or "argand" in q or "(z - 2)" in q:
            return build_complex_square_diagram(calc_context)
        if "right triangle" in q or "hypotenuse" in q:
            return build_right_triangle_diagram(calc_context)
        if "cyclic" in q or "inscribed" in q:
            return build_cyclic_quad_diagram(calc_context)
            
    return build_trapezoid_diagram(calc_context)
