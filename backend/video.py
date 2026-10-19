import sys
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.path.join(BASE_DIR, "engine")
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)
if ENGINE_DIR not in sys.path:
    sys.path.append(ENGINE_DIR)

from manim import *
import linear_algebra_solver as solvers
import derivative
import integral
import stats_engine
import geometry
import eigenvalues_and_eigenvector as eigen
import re
import math
import ast
from math_models import MathStep, Node, Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln, to_latex as ml_to_latex, to_string
from typing import List
import textwrap
import numpy as np


# ══════════════════════════════════════════════════════════════════════════════
# 3BLUE1BROWN SIGNATURE COLOR PALETTE & AESTHETIC CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

B3_BG         = "#0E1117"  # Deep chalkboard charcoal
B3_BLUE       = "#58C4DD"  # Signature 3B1B Sky Blue
B3_DARK_BLUE  = "#29ABCA"  # Deep blue accent
B3_TEAL       = "#5CD0B3"  # Mint Teal
B3_GREEN      = "#83C167"  # Signature 3B1B Olive-Emerald Green
B3_YELLOW     = "#FFFF00"  # Vibrant 3B1B Notation Yellow
B3_GOLD       = "#E8C15A"  # Warm Chalk Gold
B3_RED        = "#FC6255"  # Signature 3B1B Coral Red
B3_MAROON     = "#C55F73"  # Rose Maroon
B3_PURPLE     = "#9A72AC"  # Signature 3B1B Purple
B3_WHITE      = "#ECEFF4"  # Chalkboard White
B3_DIM        = "#94A3B8"  # Subtle Notation Grey
B3_GRID       = "#1E293B"  # Muted Coordinate Grid

RULE_COLORS = {
    "Power Rule":    B3_YELLOW,
    "Product Rule":  B3_PURPLE,
    "Sum Rule":      B3_BLUE,
    "Chain Rule":    B3_RED,
    "Constant Rule": B3_TEAL,
    "Quotient Rule": B3_MAROON,
    "Difference":    B3_TEAL,
    "Substitution":  B3_PURPLE,
    "Integration":   B3_GREEN,
    "Quadratic":     B3_GOLD,
    "Factoring":     B3_TEAL,
    "Elimination":   B3_BLUE,
}


# ══════════════════════════════════════════════════════════════════════════════
# COMPATIBILITY STUB (EYES / MASCOT REMOVED FOR PURE MATHEMATICAL FOCUS)
# ══════════════════════════════════════════════════════════════════════════

class PiCreature(VGroup):
    """Backwards-compatibility stub (character/eyes removed)."""
    def __init__(self, *args, **kwargs):
        super().__init__()

    def look_at(self, *args, **kwargs):
        return Wait(0.01)

    def blink(self, *args, **kwargs):
        return Wait(0.01)

    def cheer(self, *args, **kwargs):
        return Wait(0.01)


# ══════════════════════════════════════════════════════════════════════════════
# BACKGROUND & 3B1B GRAPHICAL HELPERS
# ══════════════════════════════════════════════════════════════════════════

def make_3b1b_background(scene: Scene):
    """Classic 3Blue1Brown chalkboard background with subtle ambient math elements."""
    scene.camera.background_color = B3_BG
    bg = Rectangle(
        width=config.frame_width + 0.5,
        height=config.frame_height + 0.5,
        fill_color=B3_BG,
        fill_opacity=1, stroke_width=0,
    ).set_z_index(-30)

    # Ambient subtle coordinate dots
    dots = VGroup(*[
        Dot(point=[xi, yi, 0], radius=0.015, color="#1E293B")
        for xi in np.arange(-7.0, 7.5, 1.5)
        for yi in np.arange(-4.0, 4.5, 1.5)
    ]).set_z_index(-20)

    scene.add(bg, dots)
    return bg, dots


def make_3b1b_title(text: str, font_size=32):
    """Elegant title with subtle 3B1B underline."""
    is_tex = ("$" in text or "\\" in text)
    try:
        if is_tex:
            lbl = Tex(text, font_size=font_size, color=B3_WHITE)
        else:
            lbl = Text(text, font_size=font_size, color=B3_WHITE, weight=BOLD)
    except Exception:
        lbl = Text(text, font_size=font_size, color=B3_WHITE, weight=BOLD)

    underline_w = min(max(lbl.width + 0.8, 3.8), config.frame_width - 1.5)
    ul = Line(LEFT * (underline_w / 2), RIGHT * (underline_w / 2),
              stroke_width=2.2, color=B3_BLUE).next_to(lbl, DOWN, buff=0.15)
    
    return VGroup(lbl, ul)


def make_3b1b_annotation(text: str, color=B3_GOLD, width=11.5):
    """Clean, minimalist chalkboard annotation box (no heavy rounded cards)."""
    wrapped = "\n".join(textwrap.wrap(text, width=60))
    body = Text(wrapped, font_size=18, color=B3_WHITE, line_spacing=1.3).set_z_index(25)
    
    accent_bar = Line(UP * (body.height / 2 + 0.1), DOWN * (body.height / 2 + 0.1),
                      stroke_width=3.5, color=color).next_to(body, LEFT, buff=0.25).set_z_index(24)
    
    group = VGroup(accent_bar, body).to_edge(DOWN, buff=0.45)
    return group


def detect_rule(description: str):
    for rule in RULE_COLORS:
        if rule.lower() in description.lower():
            return rule
    return None


def _is_human_readable_step(step: MathStep, idx: int, total: int) -> bool:
    if idx == 0 or idx == total - 1:
        return True
    desc_lower = step.description.lower()
    for rule in RULE_COLORS:
        if rule.lower() in desc_lower:
            return True
    if any(w in desc_lower for w in ["derivative", "applying", "result", "factor", "formula", "matrix", "integral"]):
        return True
    return False


def filter_derivative_steps(steps: List[MathStep]) -> List[MathStep]:
    n = len(steps)
    kept = [s for i, s in enumerate(steps) if _is_human_readable_step(s, i, n)]
    if steps and steps[0] not in kept:
        kept.insert(0, steps[0])
    if steps and steps[-1] not in kept:
        kept.append(steps[-1])
    return kept


# ══════════════════════════════════════════════════════════════════════════════
# NODE TO CALLABLE
# ══════════════════════════════════════════════════════════════════════════

def node_to_function(node):
    if isinstance(node, Const):
        v = node.value
        return lambda x, _v=v: float(_v)
    if isinstance(node, Var):
        return lambda x: float(x)
    if isinstance(node, Add):
        l = node_to_function(node.left)
        r = node_to_function(node.right)
        return lambda x, _l=l, _r=r: _l(x) + _r(x)
    if isinstance(node, Mul):
        l = node_to_function(node.left)
        r = node_to_function(node.right)
        return lambda x, _l=l, _r=r: _l(x) * _r(x)
    if isinstance(node, Pow):
        b = node_to_function(node.base)
        exp = node.exp
        return lambda x, _b=b, _e=exp: float(_b(x)) ** _e
    if isinstance(node, Sin):
        i = node_to_function(node.inner)
        return lambda x, _i=i: np.sin(_i(x))
    if isinstance(node, Cos):
        i = node_to_function(node.inner)
        return lambda x, _i=i: np.cos(_i(x))
    if isinstance(node, Exp):
        i = node_to_function(node.inner)
        return lambda x, _i=i: np.exp(_i(x))
    if isinstance(node, Ln):
        i = node_to_function(node.inner)
        return lambda x, _i=i: np.log(max(float(_i(x)), 1e-9))
    return lambda x: 0.0


def _auto_y_range(func, x_lo=-3.5, x_hi=3.5, samples=300):
    xs = np.linspace(x_lo, x_hi, samples)
    ys = []
    for x in xs:
        try:
            y = float(func(x))
            if np.isfinite(y):
                ys.append(y)
        except Exception:
            pass
    if not ys:
        return -5.0, 9.0
    y_arr = np.array(ys)
    lo = float(np.percentile(y_arr, 5))
    hi = float(np.percentile(y_arr, 95))
    margin = max((hi - lo) * 0.25, 1.2)
    return lo - margin, hi + margin


def safe_plot(axes, func, x_range=(-3.0, 3.0), color=B3_BLUE, stroke_width=3.2, y_clip=None):
    if y_clip is None:
        y_clip = _auto_y_range(func, x_range[0], x_range[1])

    lo_clip, hi_clip = y_clip

    def plotted(x):
        try:
            y = float(func(x))
            if not np.isfinite(y):
                return lo_clip
            return np.clip(y, lo_clip, hi_clip)
        except Exception:
            return lo_clip

    return axes.plot(
        plotted,
        x_range=[x_range[0], x_range[1], 0.015],
        color=color,
        stroke_width=stroke_width,
        use_smoothing=True,
    )


# ══════════════════════════════════════════════════════════════════════════════
# MAIN UNIVERSAL ANIMATION SCENE
# ══════════════════════════════════════════════════════════════════════════

class UniversalMathAnimation(Scene):

    def construct(self):
        input_str    = os.environ.get("MATH_EXPR", "x^2 + 3*x")
        problem_type = os.environ.get("MATH_OP", "derivative")
        method_id    = os.environ.get("MATH_METHOD_ID", "").strip()
        method_name  = os.environ.get("MATH_METHOD_NAME", "").strip()

        # Method-specific handling if requested
        if method_id:
            try:
                import algebra
                steps = None
                title_str = method_name or f"Solving: {input_str}"

                if method_id == "quad-formula":
                    *_, steps = algebra.quadratic_equation_solver(input_str)
                    title_str = method_name or f"Quadratic Formula: {input_str}"
                elif method_id == "quad-factor":
                    *_, steps = algebra.factoring_quadratic(input_str)
                    title_str = method_name or f"Factoring Method: {input_str}"
                elif method_id == "quad-complete-square":
                    *_, steps = algebra.completing_the_square(input_str)
                    title_str = method_name or f"Completing the Square: {input_str}"
                elif method_id in ["quad-rational-roots", "cubic-rational-root"]:
                    *_, steps = algebra.rational_root_theorem_solver(input_str)
                    title_str = method_name or f"Rational Root Theorem: {input_str}"
                elif method_id == "cubic-cardano":
                    c_res = algebra.cubic_equation_solver(input_str)
                    steps = c_res[-1]
                    title_str = method_name or f"Cardano's Method: {input_str}"
                elif method_id == "integral-symbolic":
                    from main import parse_expr
                    clean_expr = input_str
                    if clean_expr.lower().startswith('integrate(') and clean_expr.endswith(')'):
                        clean_expr = clean_expr[10:-1]
                    node = parse_expr(clean_expr)
                    _, steps = integral.integrate_node(node)
                    title_str = method_name or "Symbolic Integration"
                elif method_id in ["integral-simpson", "integral-trapezoid", "integral-midpoint"]:
                    from main import parse_expr
                    clean_expr = input_str
                    if clean_expr.lower().startswith('integrate(') and clean_expr.endswith(')'):
                        clean_expr = clean_expr[10:-1]
                    node = parse_expr(clean_expr)
                    rule_type = "simpson" if "simpson" in method_id else ("trapezoid" if "trapezoid" in method_id else "midpoint")
                    _, steps = integral.integrate_numerical(node, 0, 1, 6, rule_type)
                    title_str = method_name or f"{rule_type.capitalize()} Rule Quadrature"
                elif method_id == "derive-rules":
                    from main import parse_expr
                    clean_expr = input_str
                    if clean_expr.lower().startswith('derive(') and clean_expr.endswith(')'):
                        clean_expr = clean_expr[7:-1]
                    node = parse_expr(clean_expr)
                    _, steps = derivative.derive(node)
                    title_str = method_name or "Differentiation Rules"
                elif method_id in ["linear-rref", "matrix-rref"]:
                    matrices = re.findall(r'\[\[.*?\]\]|\[.*?\]', input_str)
                    if matrices:
                        matrix = ast.literal_eval(matrices[0])
                        if len(matrix) > 0 and len(matrix[0]) == len(matrix) + 1:
                            A = [row[:-1] for row in matrix]
                            b = [row[-1] for row in matrix]
                            _, steps = solvers.solve_linear_system(A, b)
                        else:
                            _, steps = solvers.reduced_row_echelon(matrix)
                    title_str = method_name or "Gaussian Elimination (RREF)"
                elif method_id == "linear-cramer":
                    matrices = re.findall(r'\[\[.*?\]\]|\[.*?\]', input_str)
                    if matrices:
                        matrix = ast.literal_eval(matrices[0])
                        A = [row[:-1] for row in matrix]
                        b = [row[-1] for row in matrix]
                        _, steps = solvers.cremer(A, b)
                    title_str = method_name or "Cramer's Rule"
                elif method_id == "linear-inverse":
                    matrices = re.findall(r'\[\[.*?\]\]|\[.*?\]', input_str)
                    if matrices:
                        matrix = ast.literal_eval(matrices[0])
                        A = [row[:-1] for row in matrix] if len(matrix[0]) == len(matrix) + 1 else matrix
                        _, steps = solvers.inverse(A)
                    title_str = method_name or "Matrix Inverse"
                else:
                    from main import solve_algebra
                    _, steps = solve_algebra(input_str)
                    title_str = method_name or f"Solving: {input_str}"

                if steps:
                    self.render_math_steps(steps, title_str)
                    return
            except Exception as e:
                pass

        # Dispatch based on problem_type
        if problem_type == "matrix":
            self.render_linear_algebra_3b1b(input_str)
        elif problem_type == "derivative":
            self.render_derivative_3b1b(input_str)
        elif problem_type == "integral":
            self.render_integral_3b1b(input_str)
        elif problem_type == "trigonometry":
            try:
                import trigonometry
                title_str, steps = trigonometry.solve_trigonometry(input_str)
                self.render_math_steps(steps, title_str)
            except Exception:
                pass
        elif problem_type == "statistics":
            try:
                title_str, steps = stats_engine.solve_statistics(input_str)
                self.render_math_steps(steps, title_str)
            except Exception as e:
                print(f"Error rendering statistics video: {e}")
        elif problem_type == "geometry":
            try:
                import geometry
                title_str, steps = geometry.solve_geometry(input_str)
                self.render_geometry(steps, title_str)
            except Exception:
                pass
        else:
            try:
                from main import solve_algebra
                _, steps = solve_algebra(input_str)
                self.render_math_steps(steps, f"Solving: {input_str}")
            except Exception:
                pass

    # ══════════════════════════════════════════════════════════════════════════
    # OPTION 1: CALCULUS OVERHAUL (DERIVATIVE & INTEGRAL)
    # ══════════════════════════════════════════════════════════════════════════

    def render_derivative_3b1b(self, input_str: str):
        """
        3Blue1Brown-style derivative visualizer:
        - Plots function f(x)
        - Dynamic tangent line sliding along the curve
        - Slope triangle: dx, df, and instantaneous rate of change
        - Morphs into the derivative function f'(x) tracing the tangent slopes
        """
        from main import parse_expr
        try:
            node = parse_expr(input_str)
            orig_node = node
            soln_node, steps = derivative.derive(node)
            steps = filter_derivative_steps(steps)
        except Exception:
            return

        make_3b1b_background(self)

        title_group = make_3b1b_title(rf"The Derivative: Rate of Change", font_size=32).to_edge(UP, buff=0.45)
        self.play(FadeIn(title_group, shift=DOWN * 0.2), run_time=0.7)

        # Axes setup
        func = node_to_function(orig_node)
        deriv_func = node_to_function(soln_node)
        y_lo, y_hi = _auto_y_range(func, -3.0, 3.0)

        axes = Axes(
            x_range=[-3.2, 3.2, 1],
            y_range=[math.floor(y_lo), math.ceil(y_hi), max(1, round((y_hi - y_lo) / 5))],
            x_length=6.0,
            y_length=4.8,
            axis_config={"color": B3_DIM, "stroke_width": 2.0},
        ).to_edge(LEFT, buff=0.6).shift(DOWN * 0.2)

        curve_f = safe_plot(axes, func, x_range=(-3.0, 3.0), color=B3_BLUE, stroke_width=3.5)
        f_label = MathTex(rf"f(x) = {ml_to_latex(orig_node)}", font_size=22, color=B3_BLUE).next_to(axes, UP, buff=0.15).align_to(axes, LEFT)

        self.play(
            Create(axes, run_time=0.7),
            Create(curve_f, run_time=0.9),
            FadeIn(f_label)
        )

        # ── Tangent Line & Slope Triangle Demonstration ──────────────────────
        x_val = 1.0
        y_val = func(x_val)
        slope = (func(x_val + 0.001) - func(x_val - 0.001)) / 0.002

        # Tangent line segment
        p1 = axes.c2p(x_val - 1.2, y_val - 1.2 * slope)
        p2 = axes.c2p(x_val + 1.2, y_val + 1.2 * slope)
        tangent_line = Line(p1, p2, color=B3_YELLOW, stroke_width=3.2)
        pt_dot = Dot(axes.c2p(x_val, y_val), radius=0.065, color=B3_YELLOW)

        # Slope triangle (dx, df)
        dx_val = 0.6
        p_corner = axes.c2p(x_val + dx_val, y_val)
        p_top = axes.c2p(x_val + dx_val, y_val + dx_val * slope)
        dx_line = Line(axes.c2p(x_val, y_val), p_corner, color=B3_TEAL, stroke_width=2.5)
        df_line = Line(p_corner, p_top, color=B3_RED, stroke_width=2.5)

        dx_label = MathTex(r"dx", font_size=16, color=B3_TEAL).next_to(dx_line, DOWN, buff=0.06)
        df_label = MathTex(r"df", font_size=16, color=B3_RED).next_to(df_line, RIGHT, buff=0.06)
        slope_label = MathTex(r"\text{Slope} = \dfrac{df}{dx}", font_size=20, color=B3_YELLOW).next_to(tangent_line, UP, buff=0.12)

        tangent_group = VGroup(tangent_line, pt_dot, dx_line, df_line, dx_label, df_label, slope_label)

        # Right side equation steps
        curr_step_eq = None
        curr_card = None

        if steps:
            curr_step_eq = MathTex(steps[0].latex, color=B3_WHITE).scale(1.2).to_edge(RIGHT, buff=0.8).shift(UP * 0.8)
            curr_card = make_3b1b_annotation(steps[0].description, color=B3_BLUE)
            self.play(FadeIn(curr_step_eq), FadeIn(curr_card), Create(tangent_group), run_time=1.0)
        else:
            self.play(Create(tangent_group), run_time=0.8)

        self.wait(1.5)

        # Slide tangent line along curve to demonstrate dynamic derivative
        for test_x in [0.0, 1.8]:
            try:
                y_t = func(test_x)
                slope_t = (func(test_x + 0.001) - func(test_x - 0.001)) / 0.002
                new_p1 = axes.c2p(test_x - 1.2, y_t - 1.2 * slope_t)
                new_p2 = axes.c2p(test_x + 1.2, y_t + 1.2 * slope_t)
                new_line = Line(new_p1, new_p2, color=B3_YELLOW, stroke_width=3.2)
                new_dot = Dot(axes.c2p(test_x, y_t), radius=0.065, color=B3_YELLOW)
                self.play(
                    Transform(tangent_line, new_line),
                    Transform(pt_dot, new_dot),
                    run_time=0.9
                )
                self.wait(0.5)
            except Exception:
                pass

        # Progress through algebraic steps
        for i, step in enumerate(steps[1:]):
            rule = detect_rule(step.description)
            rule_color = RULE_COLORS.get(rule, B3_GOLD)
            new_step_eq = MathTex(step.latex, color=rule_color).scale(1.2).to_edge(RIGHT, buff=0.8).shift(UP * 0.8)
            new_card = make_3b1b_annotation(step.description, color=rule_color)

            anims = [
                ReplacementTransform(curr_step_eq, new_step_eq),
                ReplacementTransform(curr_card, new_card)
            ]
            self.play(*anims, run_time=0.9)
            curr_step_eq = new_step_eq
            curr_card = new_card
            self.wait(1.8)

        # Final revelation: Plot f'(x) curve
        curve_fp = safe_plot(axes, deriv_func, x_range=(-3.0, 3.0), color=B3_YELLOW, stroke_width=3.5)
        fp_label = MathTex(rf"f'(x) = {ml_to_latex(soln_node)}", font_size=22, color=B3_YELLOW).next_to(f_label, DOWN, buff=0.1).align_to(f_label, LEFT)

        self.play(
            Create(curve_fp, run_time=1.2),
            FadeIn(fp_label),
            Indicate(curr_step_eq, color=B3_GREEN, scale_factor=1.05),
            run_time=1.1
        )
        self.wait(2.5)

    def render_integral_3b1b(self, input_str: str):
        """
        3Blue1Brown-style integral visualizer:
        - Plots function f(x)
        - Shows Riemann sum rectangles partitioning [a, b]
        - Demonstrates dx width approaching 0 as rectangles morph into smooth shaded area
        """
        from main import parse_expr
        try:
            clean_expr = input_str
            if clean_expr.lower().startswith('integrate(') and clean_expr.endswith(')'):
                clean_expr = clean_expr[10:-1]
            node = parse_expr(clean_expr)
            soln_node, steps = integral.integrate_node(node)
        except Exception:
            return

        make_3b1b_background(self)

        title_group = make_3b1b_title(r"Integration: Continuous Accumulation of Area", font_size=30).to_edge(UP, buff=0.45)
        self.play(FadeIn(title_group, shift=DOWN * 0.2), run_time=0.7)

        func = node_to_function(node)
        y_lo, y_hi = _auto_y_range(func, -1.0, 3.0)

        axes = Axes(
            x_range=[-1.0, 3.2, 1],
            y_range=[max(-1.0, math.floor(y_lo)), math.ceil(y_hi) + 1, max(1, round((y_hi - y_lo) / 4))],
            x_length=6.0,
            y_length=4.8,
            axis_config={"color": B3_DIM, "stroke_width": 2.0},
        ).to_edge(LEFT, buff=0.6).shift(DOWN * 0.2)

        curve = safe_plot(axes, func, x_range=(-0.8, 3.0), color=B3_BLUE, stroke_width=3.5)
        f_lbl = MathTex(rf"f(x) = {ml_to_latex(node)}", font_size=22, color=B3_BLUE).next_to(axes, UP, buff=0.15).align_to(axes, LEFT)

        self.play(Create(axes, run_time=0.7), Create(curve, run_time=0.9), FadeIn(f_lbl))

        # Interval [0, 2]
        x_a, x_b = 0.0, 2.0
        brace = BraceBetweenPoints(axes.c2p(x_a, 0), axes.c2p(x_b, 0), DOWN, buff=0.1)
        brace_lbl = MathTex(r"\Delta x \to dx", font_size=18, color=B3_TEAL).next_to(brace, DOWN, buff=0.08)

        # 1. Coarse Riemann Rectangles
        rects_coarse = axes.get_riemann_rectangles(curve, x_range=[x_a, x_b], dx=0.5, color=B3_TEAL, fill_opacity=0.5)
        riemann_note = make_3b1b_annotation(r"Summing approximating rectangles: \sum f(x_i) \Delta x", color=B3_TEAL)

        self.play(
            Create(rects_coarse, run_time=0.9),
            FadeIn(brace), FadeIn(brace_lbl),
            FadeIn(riemann_note)
        )
        self.wait(1.5)

        # 2. Refined Riemann Rectangles (dx smaller)
        rects_fine = axes.get_riemann_rectangles(curve, x_range=[x_a, x_b], dx=0.15, color=B3_GREEN, fill_opacity=0.6)
        fine_note = make_3b1b_annotation(r"As \Delta x \to 0, the sum approaches the exact integral \int f(x) dx", color=B3_GREEN)

        self.play(
            ReplacementTransform(rects_coarse, rects_fine),
            ReplacementTransform(riemann_note, fine_note),
            run_time=1.0
        )
        self.wait(1.5)

        # 3. Continuous Integral Area
        smooth_area = axes.get_area(curve, x_range=[x_a, x_b], color=B3_BLUE, opacity=0.45)
        self.play(ReplacementTransform(rects_fine, smooth_area), run_time=0.8)

        # Right-side integral formula
        int_eq = MathTex(rf"\int ({ml_to_latex(node)})\,dx = {ml_to_latex(soln_node)} + C", color=B3_YELLOW).scale(1.15).to_edge(RIGHT, buff=0.8).shift(UP * 0.8)
        self.play(
            FadeIn(int_eq),
            Indicate(int_eq, color=B3_GREEN, scale_factor=1.05),
            run_time=1.0
        )
        self.wait(2.5)

    # ══════════════════════════════════════════════════════════════════════════
    # OPTION 2: LINEAR ALGEBRA OVERHAUL (MATRICES & TRANSFORMATIONS)
    # ══════════════════════════════════════════════════════════════════════════

    def render_linear_algebra_3b1b(self, input_str: str):
        """
        Classic 'Essence of Linear Algebra' visualizer:
        - 2D coordinate grid with NumberPlane
        - Basis vectors i-hat (green) and j-hat (red)
        - Unit square representing unit area
        - Smoothly transforms space via matrix [[a, b], [c, d]]
        - Shows that columns are the transformed basis vectors
        - Visualizes the Determinant as the scaling factor of area
        """
        make_3b1b_background(self)

        title_group = make_3b1b_title(r"Linear Transformations: How Space Warps", font_size=32).to_edge(UP, buff=0.45)
        self.play(FadeIn(title_group, shift=DOWN * 0.2), run_time=0.7)

        # Parse or default matrix
        matrices = re.findall(r'\[\[.*?\]\]|\[.*?\]', input_str)
        a, b, c, d = 1.5, 0.5, 0.5, 1.2
        if matrices:
            try:
                raw_mat = ast.literal_eval(matrices[0])
                if len(raw_mat) >= 2 and len(raw_mat[0]) >= 2:
                    a = float(raw_mat[0][0])
                    b = float(raw_mat[0][1])
                    c = float(raw_mat[1][0])
                    d = float(raw_mat[1][1])
            except Exception:
                pass

        det_val = a * d - b * c

        # 2D Coordinate Grid
        plane = NumberPlane(
            x_range=[-4, 4, 1], y_range=[-3.5, 3.5, 1],
            x_length=7.0, y_length=5.0,
            background_line_style={"stroke_color": "#334155", "stroke_width": 1.2, "stroke_opacity": 0.55}
        ).to_edge(LEFT, buff=0.6).shift(DOWN * 0.2)

        self.play(Create(plane, run_time=0.8))

        # Basis vectors: i-hat (green) & j-hat (red)
        i_vec = Arrow(plane.c2p(0, 0), plane.c2p(1, 0), buff=0, color=B3_GREEN, stroke_width=4.5)
        j_vec = Arrow(plane.c2p(0, 0), plane.c2p(0, 1), buff=0, color=B3_RED, stroke_width=4.5)

        i_lbl = MathTex(r"\hat{\imath}", font_size=20, color=B3_GREEN).next_to(i_vec.get_end(), DR, buff=0.08)
        j_lbl = MathTex(r"\hat{\jmath}", font_size=20, color=B3_RED).next_to(j_vec.get_end(), UL, buff=0.08)

        # Unit Square Area = 1
        unit_sq = Polygon(
            plane.c2p(0, 0), plane.c2p(1, 0), plane.c2p(1, 1), plane.c2p(0, 1),
            fill_color=B3_YELLOW, fill_opacity=0.35, stroke_color=B3_YELLOW, stroke_width=1.8
        )

        # Right side Matrix Representation
        mat_tex = MathTex(
            rf"A = \begin{{bmatrix}} {a:.1f} & {b:.1f} \\ {c:.1f} & {d:.1f} \end{{bmatrix}}",
            color=B3_WHITE
        ).scale(1.2).to_edge(RIGHT, buff=0.9).shift(UP * 1.0)

        # Color the columns to match i-hat and j-hat
        col_note = make_3b1b_annotation(r"Columns dictate where the basis vectors \hat{\imath} and \hat{\jmath} land", color=B3_BLUE)

        self.play(
            Create(unit_sq), GrowArrow(i_vec), GrowArrow(j_vec),
            FadeIn(i_lbl), FadeIn(j_lbl),
            FadeIn(mat_tex), FadeIn(col_note),
            run_time=1.0
        )
        self.wait(1.5)

        # ── Matrix Space Transformation ──────────────────────────────────────
        new_i = Arrow(plane.c2p(0, 0), plane.c2p(a, c), buff=0, color=B3_GREEN, stroke_width=4.5)
        new_j = Arrow(plane.c2p(0, 0), plane.c2p(b, d), buff=0, color=B3_RED, stroke_width=4.5)
        new_sq = Polygon(
            plane.c2p(0, 0), plane.c2p(a, c), plane.c2p(a + b, c + d), plane.c2p(b, d),
            fill_color=B3_YELLOW, fill_opacity=0.4, stroke_color=B3_YELLOW, stroke_width=1.8
        )

        trans_note = make_3b1b_annotation(rf"Transformed unit area = \det(A) = {det_val:.2f}", color=B3_YELLOW)

        self.play(
            plane.animate.apply_matrix([[a, b], [c, d]]),
            Transform(unit_sq, new_sq),
            Transform(i_vec, new_i),
            Transform(j_vec, new_j),
            i_lbl.animate.next_to(plane.c2p(a, c), DR, buff=0.08),
            j_lbl.animate.next_to(plane.c2p(b, d), UL, buff=0.08),
            ReplacementTransform(col_note, trans_note),
            run_time=1.8
        )
        self.wait(1.0)

        # Determinant calculation badge
        det_eq = MathTex(
            rf"\det(A) = ({a:.1f})({d:.1f}) - ({b:.1f})({c:.1f}) = {det_val:.2f}",
            color=B3_YELLOW
        ).scale(1.05).next_to(mat_tex, DOWN, buff=0.45)

        self.play(
            FadeIn(det_eq),
            Indicate(det_eq, color=B3_GREEN),
            run_time=1.0
        )
        self.wait(2.5)

    # ══════════════════════════════════════════════════════════════════════════
    # OPTION 3: GENERAL 3B1B AESTHETIC & EQUATION STEPPING
    # ══════════════════════════════════════════════════════════════════════════

    def render_math_steps(self, steps, title_str):
        """
        Pure 3B1B chalkboard derivation:
        - Minimalist typography and blackboard background
        - Terms color-coded to their derivation rules
        - Curly braces explaining key transformations
        """
        if not steps:
            return

        make_3b1b_background(self)

        title_group = make_3b1b_title(title_str, font_size=32).to_edge(UP, buff=0.45)
        self.play(FadeIn(title_group, shift=DOWN * 0.2), run_time=0.7)

        n = len(steps)
        current_eq = None
        current_card = None

        for i, step in enumerate(steps):
            rule = detect_rule(step.description)
            rule_color = RULE_COLORS.get(rule, B3_BLUE) if rule else B3_BLUE
            is_final = (i == n - 1)
            step_color = B3_GREEN if is_final else rule_color

            if step.type == "matrix":
                matrix_data = step.data or [[0]]
                fmt = [[(str(int(v)) if abs(v - int(v)) < 1e-9 else f"{v:.2f}") for v in row]
                       for row in matrix_data]
                new_eq = Matrix(fmt, element_to_mobject=Text, element_to_mobject_config={"color": "#FFFFFF"},
                                h_buff=1.5, v_buff=1.0).scale(0.85).center().shift(UP * 0.5)
                new_eq.get_brackets().set_color(step_color)
            elif step.type == "text":
                new_eq = Text(step.latex.replace("\\\\", "\n"), font_size=26, color=B3_WHITE).center().shift(UP * 0.5)
            else:
                new_eq = MathTex(step.latex, color=step_color).scale(1.35).center().shift(UP * 0.5)

            new_card = make_3b1b_annotation(step.description, color=step_color)

            anims = []

            if current_card:
                anims.append(ReplacementTransform(current_card, new_card))
            else:
                anims.append(FadeIn(new_card, shift=UP * 0.1))

            if current_eq is None:
                anims.append(FadeIn(new_eq, scale=0.9))
            else:
                anims.append(ReplacementTransform(current_eq, new_eq))

            self.play(*anims, run_time=1.0)

            if is_final:
                # Halmos Q.E.D.
                qed = MathTex(r"\blacksquare\ \text{Q.E.D.}", font_size=24, color=B3_GREEN).next_to(new_eq, DOWN, buff=0.4)
                self.play(
                    Indicate(new_eq, color=B3_GREEN, scale_factor=1.05),
                    FadeIn(qed),
                    run_time=0.9
                )
            elif rule:
                self.play(Indicate(new_eq, color=rule_color, scale_factor=1.04, run_time=0.6))

            self.wait(2.2)
            current_eq = new_eq
            current_card = new_card

        self.wait(1.5)

    def render_geometry(self, steps, title_str):
        """Minimalist 3B1B geometric proof visualization."""
        if not steps:
            return

        make_3b1b_background(self)
        title_group = make_3b1b_title(title_str, font_size=32).to_edge(UP, buff=0.45)
        self.play(FadeIn(title_group, shift=DOWN * 0.2), run_time=0.7)

        current_mobs = VGroup()
        current_card = None

        COLOR_MAP = {"blue": B3_BLUE, "green": B3_GREEN, "teal": B3_TEAL,
                     "purple": B3_PURPLE, "gold": B3_GOLD, "coral": B3_RED}

        for i, step in enumerate(steps):
            new_card = make_3b1b_annotation(step.description, color=B3_BLUE)
            new_mobs = VGroup()

            if step.type == "geometry" and isinstance(step.data, dict):
                for sd in step.data.get("shapes", []):
                    c = COLOR_MAP.get(sd.get("color", "blue").lower(), B3_BLUE)
                    if sd.get("type") == "polygon":
                        pts = sd.get("points", [])
                        if len(pts) >= 3:
                            poly = Polygon(*pts, color=c, stroke_width=2.5)
                            poly.set_fill(c, opacity=sd.get("fill_opacity", 0.2))
                            new_mobs.add(poly)
                    elif sd.get("type") == "circle":
                        circ = Circle(radius=sd.get("radius", 1.0), color=c, stroke_width=2.5).move_to(sd.get("center", ORIGIN))
                        circ.set_fill(c, opacity=0.15)
                        new_mobs.add(circ)
                    elif sd.get("type") == "line":
                        p1_c = sd.get("p1", sd.get("start", ORIGIN))
                        p2_c = sd.get("p2", sd.get("end", RIGHT))
                        p1_3d = [p1_c[0], p1_c[1], 0] if len(p1_c) == 2 else p1_c
                        p2_3d = [p2_c[0], p2_c[1], 0] if len(p2_c) == 2 else p2_c
                        new_mobs.add(Line(p1_3d, p2_3d, stroke_width=2.5, color=c))

            anims = []
            if current_card:
                anims.append(ReplacementTransform(current_card, new_card))
            else:
                anims.append(FadeIn(new_card))

            if len(new_mobs):
                if len(current_mobs):
                    anims.append(ReplacementTransform(current_mobs, new_mobs))
                else:
                    anims.append(Create(new_mobs))
                current_mobs = new_mobs

            self.play(*anims, run_time=1.0)
            self.wait(2.5)
            current_card = new_card

        self.wait(1.5)


# ══════════════════════════════════════════════════════════════════════════════
# STANDALONE SCENE WRAPPERS
# ══════════════════════════════════════════════════════════════════════════

class MathStepsScene(UniversalMathAnimation):
    def __init__(self, steps: List[MathStep], title_str: str, **kwargs):
        self.steps = steps
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        self.render_math_steps(self.steps, self.title_str)


class GeometrySolverScene(UniversalMathAnimation):
    def __init__(self, steps: List[MathStep], title_str: str, **kwargs):
        self.steps = steps
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        self.render_geometry(self.steps, self.title_str)


def generate_solver_video(
    steps: List[MathStep],
    title: str,
    output_path: str,
    scene_class=MathStepsScene,
):
    output_dir = os.path.dirname(output_path)
    output_file = os.path.basename(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    config.media_dir = output_dir
    config.output_file = output_file
    scene = scene_class(steps, title)
    scene.render()


class WordProblemManimScene(Scene):

    def __init__(self, scenes_data, title_str, **kwargs):
        self.scenes_data = scenes_data
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        make_3b1b_background(self)
        title_group = make_3b1b_title(self.title_str, font_size=30).to_edge(UP, buff=0.45)
        self.play(FadeIn(title_group, shift=DOWN * 0.2), run_time=0.7)

        current_mobs = VGroup()
        for sc in self.scenes_data:
            phase_mob = Text(sc.get("phase_label", ""), font_size=20, color=B3_BLUE).next_to(title_group, DOWN, buff=0.3)
            title_mob = Text(sc.get("title", ""), font_size=24, color=B3_WHITE).next_to(phase_mob, DOWN, buff=0.2)
            
            anims = [FadeIn(phase_mob), FadeIn(title_mob)]
            latex_callout = sc.get("latex_callout")
            math_mob = None
            if latex_callout:
                try:
                    math_mob = MathTex(latex_callout, color=B3_GOLD).scale(1.2).shift(DOWN * 0.5)
                    anims.append(FadeIn(math_mob))
                except Exception:
                    math_mob = Text(str(latex_callout), font_size=22, color=B3_GOLD).shift(DOWN * 0.5)
                    anims.append(FadeIn(math_mob))
            
            narr = sc.get("narration", "")[:120]
            narr_wrapped = textwrap.fill(narr, width=50)
            narr_mob = Text(narr_wrapped, font_size=16, color=B3_DIM).to_edge(DOWN, buff=0.6)
            anims.append(FadeIn(narr_mob))

            new_group = VGroup(phase_mob, title_mob, narr_mob)
            if math_mob:
                new_group.add(math_mob)

            if len(current_mobs) > 0:
                self.play(ReplacementTransform(current_mobs, new_group), run_time=1.0)
            else:
                self.play(*anims, run_time=1.0)
            current_mobs = new_group
            self.wait(2.0)
        
        qed = MathTex(r"\blacksquare\ \text{Verified}", font_size=24, color=B3_GREEN).to_edge(DOWN, buff=0.4)
        self.play(FadeIn(qed), run_time=0.6)
        self.wait(1.5)


def render_word_problem_manim(scenes_data: list, title: str, output_path: str):
    output_dir = os.path.dirname(output_path)
    output_file = os.path.basename(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    config.media_dir = output_dir
    config.output_file = output_file
    scene = WordProblemManimScene(scenes_data, title)
    scene.render()


if __name__ == "__main__":
    UniversalMathAnimation().render()