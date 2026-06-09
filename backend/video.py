from manim import *
import linear_algebra_solver as solvers
import derivative
import integral
import re
import math
import os
import ast
from math_models import MathStep, Node, Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln
from typing import List
import textwrap
import numpy as np


# ─────────────────────────────────────────────────────────────────────────────
# THEME
# ─────────────────────────────────────────────────────────────────────────────
DEEP_BG       = "#0D0F1A"
PANEL_BG      = "#131729"
ACCENT_BLUE   = "#4FC3F7"
ACCENT_TEAL   = "#26C6DA"
ACCENT_PURPLE = "#B39DDB"
ACCENT_GOLD   = "#FFD54F"
ACCENT_CORAL  = "#FF7043"
ACCENT_GREEN  = "#66BB6A"
ACCENT_PINK   = "#F48FB1"
TEXT_DIM      = "#90A4AE"
TEXT_BRIGHT   = "#ECEFF1"

RULE_COLORS = {
    "Power Rule":    ACCENT_GOLD,
    "Product Rule":  ACCENT_PURPLE,
    "Sum Rule":      ACCENT_TEAL,
    "Chain Rule":    ACCENT_CORAL,
    "Constant Rule": TEXT_DIM,
    "Quotient Rule": ACCENT_PINK,
}

# Human-readable rule explanations shown as mini examples alongside each step
RULE_EXAMPLES = {
    "Power Rule":    (r"(x^n)' = n \cdot x^{n-1}",
                      r"\text{e.g. } (x^3)' = 3x^2"),
    "Product Rule":  (r"(u \cdot v)' = u'v + uv'",
                      r"\text{e.g. } (x^2 \sin x)' = 2x\sin x + x^2\cos x"),
    "Sum Rule":      (r"(u + v)' = u' + v'",
                      r"\text{e.g. } (x^2+x)' = 2x+1"),
    "Chain Rule":    (r"[f(g(x))]' = f'(g(x)) \cdot g'(x)",
                      r"\text{e.g. } (\sin(x^2))' = \cos(x^2) \cdot 2x"),
    "Constant Rule": (r"(c)' = 0",
                      r"\text{e.g. } (5)' = 0"),
    "Quotient Rule": (r"\left(\frac{u}{v}\right)' = \frac{u'v - uv'}{v^2}",
                      r"\text{e.g. } \left(\frac{x^2}{x+1}\right)'"),
}


# ─────────────────────────────────────────────────────────────────────────────
# STEP FILTERING  — the key fix for "split steps" confusion
# ─────────────────────────────────────────────────────────────────────────────

def _is_human_readable_step(step: MathStep, idx: int, total: int) -> bool:
    """
    Keep a step if it is:
      - the first step (original expression)
      - the last step (final result)
      - a step that mentions a named rule (Power, Sum, Product, Chain, …)
      - a step whose latex is substantially different from the previous one
    Skip pure internal sub-tree bookkeeping steps that confuse viewers.
    """
    if idx == 0 or idx == total - 1:
        return True
    desc_lower = step.description.lower()
    for rule in RULE_COLORS:
        if rule.lower() in desc_lower:
            return True
    # keep steps that look like a full derivative expression (contain d/dx or ')
    if "derivative" in desc_lower or "applying" in desc_lower or "result" in desc_lower:
        return True
    return False


def filter_derivative_steps(steps: List[MathStep]) -> List[MathStep]:
    """Return only the human-readable milestone steps."""
    n = len(steps)
    kept = [s for i, s in enumerate(steps) if _is_human_readable_step(s, i, n)]
    # Always guarantee at least first + last
    if steps and steps[0] not in kept:
        kept.insert(0, steps[0])
    if steps and steps[-1] not in kept:
        kept.append(steps[-1])
    return kept


# ─────────────────────────────────────────────────────────────────────────────
# NODE → CALLABLE
# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANT: every recursive call must bind its sub-functions into the default
# arguments of the lambda.  Python lambdas capture variables by *reference*,
# so without default-arg binding the last assigned value of l/r/b/i would be
# used at call time (classic late-binding closure bug).

def node_to_function(node):
    if isinstance(node, Const):
        v = node.value
        return lambda x, _v=v: _v
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
        b   = node_to_function(node.base)
        exp = node.exp          # scalar – safe to capture directly
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
    """
    Sample the function and return a (y_min, y_max) that shows the interesting
    part of the curve without letting extreme spikes dominate the view.
    Uses the 5th–95th percentile of sampled values so outliers don't crush the graph.
    """
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
    margin = max((hi - lo) * 0.2, 1.0)
    return lo - margin, hi + margin


def safe_plot(axes, func, x_range=(-3.0, 3.0), color=ACCENT_BLUE,
              stroke_width=2.8, y_clip=None):
    """
    Plot func on axes correctly.
    - y_clip: (lo, hi) hard clamp applied AFTER axes coordinate mapping,
      used only to drop isolated spikes; pass None to auto-detect.
    - We do NOT pre-clamp before passing to axes.plot because that would
      distort the curve shape near the clip boundary.
    """
    if y_clip is None:
        y_clip = _auto_y_range(func, x_range[0], x_range[1])

    lo_clip, hi_clip = y_clip

    def plotted(x):
        try:
            y = float(func(x))
            if not np.isfinite(y):
                return lo_clip          # push off-screen rather than crash
            return y                    # return RAW value — Manim maps to screen
        except Exception:
            return lo_clip

    return axes.plot(
        plotted,
        x_range=[x_range[0], x_range[1], 0.015],
        color=color,
        stroke_width=stroke_width,
        use_smoothing=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# UI HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def wrap_text(text, width=62):
    return "\n".join(textwrap.wrap(text, width=width))


def detect_rule(description: str):
    for rule in RULE_COLORS:
        if rule.lower() in description.lower():
            return rule
    return None


def make_background(scene: Scene):
    bg = Rectangle(
        width=config.frame_width + 0.1,
        height=config.frame_height + 0.1,
        fill_color=[DEEP_BG, "#111428"],
        fill_opacity=1, stroke_width=0,
    ).set_z_index(-10)
    dots = VGroup(*[
        Dot(point=[xi, yi, 0], radius=0.018, color="#1E2545")
        for xi in np.arange(-7, 7.5, 0.9)
        for yi in np.arange(-4, 4.5, 0.9)
    ]).set_z_index(-9)
    scene.add(bg, dots)
    return bg, dots


def glowing_title(text: str, font_size=40):
    lbl = (Tex(text, font_size=font_size, color=TEXT_BRIGHT)
           if ("$" in text or "\\" in text)
           else Text(text, font_size=font_size, color=TEXT_BRIGHT, weight=BOLD))
    ul  = Line(lbl.get_left() + DOWN*0.28, lbl.get_right() + DOWN*0.28,
               stroke_width=2.5, color=ACCENT_BLUE)
    glow = ul.copy().set_stroke(color=ACCENT_BLUE, width=8, opacity=0.25)
    return VGroup(lbl, glow, ul)


def step_badge(index: int, total: int):
    circle = Circle(radius=0.38, stroke_color=ACCENT_BLUE, stroke_width=2.5,
                    fill_color=PANEL_BG, fill_opacity=0.9)
    label  = Text(f"{index}/{total}", font_size=18, color=ACCENT_BLUE)
    return VGroup(circle, label).to_corner(UR, buff=0.35)


def explanation_card(text: str, rule: str = None, width=None):
    wrapped = wrap_text(text, 68)
    body    = Text(wrapped, font_size=20, color=TEXT_BRIGHT, line_spacing=1.4)
    card_w  = width or min(config.frame_width - 0.8, 14.0)
    card_h  = body.height + 0.7
    rect    = RoundedRectangle(
        corner_radius=0.18, width=card_w, height=card_h,
        fill_color=PANEL_BG, fill_opacity=0.92,
        stroke_color=ACCENT_BLUE, stroke_width=1.5,
    )
    body.move_to(rect)
    group = VGroup(rect, body)
    if rule:
        color   = RULE_COLORS.get(rule, ACCENT_GOLD)
        pill_bg = RoundedRectangle(
            corner_radius=0.12, height=0.38,
            width=len(rule)*0.14+0.6,
            fill_color=color, fill_opacity=0.22,
            stroke_color=color, stroke_width=1.3,
        )
        pill_txt = Text(rule, font_size=16, color=color, weight=BOLD)
        pill_txt.move_to(pill_bg)
        pill = VGroup(pill_bg, pill_txt)
        pill.next_to(rect, UP, buff=0.1).align_to(rect, RIGHT).shift(LEFT*0.2)
        group.add(pill)
    group.to_edge(DOWN, buff=0.25)
    return group


def rule_example_panel(rule: str):
    """
    A small panel (shown on the RIGHT side) with the rule formula + worked example.
    Returns None if the rule is not in RULE_EXAMPLES.
    """
    if rule not in RULE_EXAMPLES:
        return None
    formula_str, example_str = RULE_EXAMPLES[rule]
    color = RULE_COLORS.get(rule, ACCENT_GOLD)

    header = Text(f"Rule: {rule}", font_size=17, color=color, weight=BOLD)
    formula = MathTex(formula_str, font_size=22, color=TEXT_BRIGHT)
    example = MathTex(example_str, font_size=19, color=TEXT_DIM)

    content = VGroup(header, formula, example).arrange(DOWN, buff=0.18, aligned_edge=LEFT)

    panel_w = content.width + 0.7
    panel_h = content.height + 0.55
    bg = RoundedRectangle(
        corner_radius=0.14, width=panel_w, height=panel_h,
        fill_color=PANEL_BG, fill_opacity=0.95,
        stroke_color=color, stroke_width=1.4,
    )
    content.move_to(bg)

    # top-left colored bar accent
    bar = Rectangle(
        width=0.08, height=panel_h - 0.18,
        fill_color=color, fill_opacity=0.6,
        stroke_width=0,
    ).align_to(bg, LEFT).align_to(bg, UP).shift(RIGHT*0.05 + DOWN*0.09)

    return VGroup(bg, bar, content)


def equation_box(mobject, color=ACCENT_TEAL):
    box  = SurroundingRectangle(mobject, corner_radius=0.12, buff=0.22,
                                stroke_color=color, stroke_width=2.2,
                                fill_color=color, fill_opacity=0.08)
    glow = SurroundingRectangle(mobject, corner_radius=0.12, buff=0.28,
                                stroke_color=color, stroke_width=6,
                                stroke_opacity=0.18, fill_opacity=0)
    return VGroup(glow, box)


def progress_bar(ratio: float, width=6.0):
    track = Line(ORIGIN, RIGHT*width, stroke_width=3, color="#2A3050")
    fill  = Line(ORIGIN, RIGHT*width*max(ratio, 0.02),
                 stroke_width=3, color=ACCENT_BLUE)
    return VGroup(track, fill).to_edge(UP, buff=0.12).shift(DOWN*0.08)


def play_intro(scene: Scene, title_group: VGroup):
    title_group.shift(UP*0.5)
    scene.play(FadeIn(title_group[0], shift=DOWN*0.3, run_time=1.0))
    scene.play(Create(title_group[2], run_time=0.6),
               FadeIn(title_group[1], run_time=0.6))
    scene.wait(0.4)


def play_outro(scene: Scene, final_eq):
    frame = SurroundingRectangle(
        final_eq, corner_radius=0.16, buff=0.35,
        stroke_color=ACCENT_GREEN, stroke_width=3,
        fill_color=ACCENT_GREEN, fill_opacity=0.07,
    )
    glow_frame = frame.copy().set_stroke(color=ACCENT_GREEN, width=10, opacity=0.2).set_fill(opacity=0)
    done = Text("Done  ✓", font_size=30, color=ACCENT_GREEN, weight=BOLD)
    done.next_to(frame, DOWN, buff=0.35)
    scene.play(Create(glow_frame, run_time=0.6), Create(frame, run_time=0.6))
    scene.play(FadeIn(done, shift=UP*0.15, run_time=0.5))
    scene.wait(2.5)


# ─────────────────────────────────────────────────────────────────────────────
# DERIVATIVE-SPECIFIC GRAPH PANEL
# ─────────────────────────────────────────────────────────────────────────────

def _nice_tick_step(span: float) -> float:
    """Choose a human-friendly tick interval for the given axis span."""
    raw = span / 6.0
    for step in [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]:
        if raw <= step:
            return step
    return round(raw)


def build_derivative_axes(scene: Scene, orig_func=None, deriv_func=None):
    """
    Build axes whose y-range is computed from the actual functions so the
    curves always fit properly.  orig_func and deriv_func are plain callables.
    Returns the Axes object.
    """
    X_LO, X_HI = -3.5, 3.5

    funcs = [f for f in [orig_func, deriv_func] if f is not None]
    all_y = []
    xs = np.linspace(X_LO, X_HI, 400)
    for f in funcs:
        for x in xs:
            try:
                y = float(f(x))
                if np.isfinite(y):
                    all_y.append(y)
            except Exception:
                pass

    if all_y:
        y_arr = np.array(all_y)
        y_lo = float(np.percentile(y_arr, 3))
        y_hi = float(np.percentile(y_arr, 97))
        margin = max((y_hi - y_lo) * 0.18, 1.5)
        y_lo -= margin
        y_hi += margin
    else:
        y_lo, y_hi = -5.0, 9.0

    y_lo = math.floor(y_lo)
    y_hi = math.ceil(y_hi)
    y_step = _nice_tick_step(y_hi - y_lo)

    y_ticks = list(range(
        int(math.ceil(y_lo / y_step) * y_step),
        int(math.floor(y_hi / y_step) * y_step) + 1,
        int(y_step),
    ))

    axes = Axes(
        x_range=[X_LO, X_HI, 1],
        y_range=[y_lo, y_hi, y_step],
        x_length=5.6,
        y_length=5.4,
        axis_config={
            "color": "#2A3A5E", "stroke_width": 1.8,
            "include_tip": True, "tip_length": 0.18, "tip_width": 0.12,
        },
        x_axis_config={
            "numbers_to_include": range(-3, 4),
            "label_constructor": MathTex, "font_size": 17, "color": TEXT_DIM,
        },
        y_axis_config={
            "numbers_to_include": y_ticks,
            "label_constructor": MathTex, "font_size": 17, "color": TEXT_DIM,
        },
    )
    axes.to_edge(LEFT, buff=0.5).shift(DOWN * 0.3)

    h_lines = VGroup(*[
        DashedLine(axes.c2p(X_LO, y), axes.c2p(X_HI, y),
                   stroke_width=0.5, color="#1C2540", dash_length=0.12)
        for y in y_ticks
    ])
    v_lines = VGroup(*[
        DashedLine(axes.c2p(x, y_lo), axes.c2p(x, y_hi),
                   stroke_width=0.5, color="#1C2540", dash_length=0.12)
        for x in range(-3, 4)
    ])
    ax_labels = axes.get_axis_labels(
        x_label=MathTex("x", font_size=20, color=TEXT_DIM),
        y_label=MathTex("y", font_size=20, color=TEXT_DIM),
    )

    scene.play(
        Create(h_lines, run_time=0.4),
        Create(v_lines, run_time=0.4),
        Create(axes, run_time=0.9),
        FadeIn(ax_labels, run_time=0.5),
    )
    axes._y_lo = y_lo
    axes._y_hi = y_hi
    return axes


def add_graph_legend(axes, orig_label_tex, deriv_label_tex):
    """Small legend box showing which curve is f(x) and which is f'(x)."""
    orig_line  = Line(ORIGIN, RIGHT*0.45, stroke_width=2.8, color=ACCENT_BLUE)
    orig_lbl   = MathTex(orig_label_tex, font_size=18, color=ACCENT_BLUE)
    deriv_line = Line(ORIGIN, RIGHT*0.45, stroke_width=2.8, color=ACCENT_CORAL)
    deriv_lbl  = MathTex(deriv_label_tex, font_size=18, color=ACCENT_CORAL)

    row1 = VGroup(orig_line, orig_lbl).arrange(RIGHT, buff=0.12)
    row2 = VGroup(deriv_line, deriv_lbl).arrange(RIGHT, buff=0.12)
    rows = VGroup(row1, row2).arrange(DOWN, buff=0.18, aligned_edge=LEFT)

    bg = RoundedRectangle(
        corner_radius=0.1, width=rows.width+0.4, height=rows.height+0.35,
        fill_color=PANEL_BG, fill_opacity=0.9,
        stroke_color=TEXT_DIM, stroke_width=1.0,
    )
    rows.move_to(bg)
    legend = VGroup(bg, rows)
    legend.next_to(axes, UP, buff=0.18).align_to(axes, RIGHT)
    return legend


# ─────────────────────────────────────────────────────────────────────────────
# MAIN SCENE
# ─────────────────────────────────────────────────────────────────────────────

class UniversalMathAnimation(Scene):

    def construct(self):
        input_str    = os.environ.get("MATH_EXPR", "x^2 + 3*x")
        problem_type = os.environ.get("MATH_OP", "derivative")

        solution_node = None

        if problem_type == "matrix":
            try:
                matrix_match = re.search(r'\[.*\]', input_str)
                if not matrix_match:
                    return
                A = ast.literal_eval(matrix_match.group(0))
                if 'det' in input_str.lower():
                    solution_node, steps = solvers.determinant(A)
                    title_str = "Calculating Determinant"
                elif 'eigen' in input_str.lower() or 'char' in input_str.lower():
                    import eigenvalues_and_eigenvector as eigen
                    solution_node, steps = eigen.eigenvalue(A)
                    title_str = "Calculating Eigenvalues"
                else:
                    solution_node, steps = solvers.reduced_row_echelon(A)
                    title_str = "Gaussian Elimination"
            except Exception:
                return

        elif problem_type == "integral":
            try:
                from main import parse_expr
                node = parse_expr(input_str)
                from math_models import to_latex as ml_to_latex
                solution_node, steps = integral.integrate_node(node)
                title_str = rf"Integrating $\int ({ml_to_latex(node)})\,dx$"
            except Exception:
                return

        elif problem_type == "statistics":
            try:
                import sys
                import os
                sys.path.append(os.path.join(os.path.dirname(__file__), 'engine'))
                import stats_engine
                
                lower_input = input_str.lower()
                if "inter_quarterly_range" in lower_input:
                    data_str = re.search(r'inter_quarterly_range\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.inter_quarterly_range(data_str)
                    title_str = "Calculating Inter-quartile Range"
                elif "centile_of_classes" in lower_input:
                    match = re.search(r'centile_of_classes\((.*),\s*(\d+)\)', input_str, re.I)
                    data_str, centile = match.groups()
                    steps = stats_engine.centile_of_classes(data_str, int(centile))
                    title_str = f"Calculating {centile}th Centile of Classes"
                elif "std_score" in lower_input:
                    match = re.search(r'std_score\((.*),\s*(-?\d+\.?\d*)\)', input_str, re.I)
                    data_str, value = match.groups()
                    steps = stats_engine.std_score(data_str, float(value))
                    title_str = f"Calculating Standard Score for {value}"
                elif "std_dev_of_classes" in lower_input:
                    data_str = re.search(r'std_dev_of_classes\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.std_dev_of_classes(data_str)
                    title_str = "Calculating Standard Deviation of Classes"
                elif "variance_of_classes" in lower_input:
                    data_str = re.search(r'variance_of_classes\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.variance_of_classes(data_str)
                    title_str = "Calculating Variance of Classes"
                elif "mean_of_classes" in lower_input:
                    data_str = re.search(r'mean_of_classes\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.mean_of_classes(data_str)
                    title_str = "Calculating Mean of Classes"
                elif "median_of_classes" in lower_input:
                    data_str = re.search(r'median_of_classes\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.median_of_classes(data_str)
                    title_str = "Calculating Median of Classes"
                elif "mode_of_classes" in lower_input:
                    data_str = re.search(r'mode_of_classes\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.mode_of_classes(data_str)
                    title_str = "Calculating Mode of Classes"
                elif "std_dev" in lower_input:
                    data_str = re.search(r'std_dev\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.std_dev(data_str)
                    title_str = "Calculating Standard Deviation"
                elif "variance" in lower_input:
                    data_str = re.search(r'variance\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.variance(data_str)
                    title_str = "Calculating Variance"
                elif "mode" in lower_input:
                    data_str = re.search(r'mode\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.mode(data_str)
                    title_str = "Calculating Mode"
                elif "median" in lower_input:
                    data_str = re.search(r'median\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.median(data_str)
                    title_str = "Calculating Median"
                else:
                    data_str = re.search(r'mean\((.*)\)', input_str, re.I).group(1)
                    steps = stats_engine.mean(data_str)
                    title_str = "Calculating Mean"
            except Exception:
                return

        elif problem_type == "geometry":
            try:
                import geometry
                if "translate" in input_str.lower():
                    match = re.search(r'translate\((.*),\s*(.*),\s*(.*)\)', input_str, re.I)
                    shape, dx, dy = match.groups()
                    steps = geometry.translate(shape, float(dx), float(dy))
                    title_str = f"Translating {shape}"
                elif "rotate" in input_str.lower():
                    match = re.search(r'rotate\((.*),\s*(.*)\)', input_str, re.I)
                    shape, angle = match.groups()
                    steps = geometry.rotate(shape, float(angle))
                    title_str = f"Rotating {shape}"
                elif "scale" in input_str.lower():
                    match = re.search(r'scale\((.*),\s*(.*)\)', input_str, re.I)
                    shape, factor = match.groups()
                    steps = geometry.scale(shape, float(factor))
                    title_str = f"Scaling {shape}"
            except Exception:
                return

        elif problem_type == "algebra":
            try:
                from main import solve_algebra
                solution_node, steps = solve_algebra(input_str)
                title_str = f"Solving: {input_str}"
            except Exception:
                return

        else:  # derivative
            try:
                from main import parse_expr
                node = parse_expr(input_str)
                from math_models import to_latex as ml_to_latex
                orig_node     = node          # keep original for graphing
                solution_node_result, steps = derivative.derive(node)
                solution_node = solution_node_result
                title_str     = rf"Deriving $\dfrac{{d}}{{dx}}\!\left({ml_to_latex(node)}\right)$"
                # attach original node to self for the renderer
                self._orig_node = orig_node
                self._soln_node = solution_node
            except Exception:
                return

        if problem_type == "geometry":
            self.render_geometry(steps, title_str)
        elif problem_type in ["derivative", "integral", "matrix"]:
            self.title_str    = title_str
            self.steps        = steps
            self.problem_type = problem_type
            self.is_calculus  = problem_type in ["integral", "derivative"]
            self.render_calculus_matrix()
        else:
            self.render_math_steps(steps, title_str)

    # ══════════════════════════════════════════════════════════════════════════
    # GENERIC MATH STEPS
    # ══════════════════════════════════════════════════════════════════════════

    def render_math_steps(self, steps, title_str):
        if not steps:
            return
        make_background(self)
        title_group = glowing_title(title_str, font_size=38)
        title_group.to_edge(UP, buff=0.55)
        play_intro(self, title_group)

        n = len(steps)
        current_equation = None
        pbar = None

        for i, step in enumerate(steps):
            rule     = detect_rule(step.description)
            card     = explanation_card(step.description, rule)
            new_pbar = progress_bar((i + 1) / n)
            badge    = step_badge(i + 1, n)

            if step.type == "matrix":
                matrix_data = step.data or [[0]]
                fmt = [[(str(int(v)) if abs(v-int(v))<1e-9 else f"{v:.2f}") for v in row]
                       for row in matrix_data]
                new_eq = Matrix(fmt, element_to_mobject=Text, h_buff=1.6, v_buff=1.1)\
                         .scale(0.72).center().shift(UP*0.6)
            elif step.type == "text":
                new_eq = Text(step.latex.replace("\\\\","\n"), font_size=24,
                              color=TEXT_BRIGHT).center().shift(UP*0.6)
            else:
                new_eq = MathTex(step.latex, color=ACCENT_BLUE).scale(1.3).center().shift(UP*0.6)

            eq_hi = equation_box(new_eq, color=RULE_COLORS.get(rule, ACCENT_TEAL) if rule else ACCENT_TEAL)

            anims = []
            if pbar:  anims.append(FadeOut(pbar))
            anims += [FadeIn(new_pbar), FadeIn(badge), FadeIn(card, shift=UP*0.15)]
            if current_equation is None:
                anims += [FadeIn(new_eq, scale=0.85), FadeIn(eq_hi)]
            else:
                anims += [ReplacementTransform(current_equation, new_eq), FadeIn(eq_hi)]

            self.play(*anims, run_time=1.1)
            self.wait(4.5)
            self.play(FadeOut(card), FadeOut(eq_hi), FadeOut(badge), run_time=0.6)
            current_equation = new_eq
            pbar = new_pbar

        play_outro(self, current_equation)

    # ══════════════════════════════════════════════════════════════════════════
    # GEOMETRY
    # ══════════════════════════════════════════════════════════════════════════

    def render_geometry(self, steps, title_str):
        if not steps:
            return
        make_background(self)
        title_group = glowing_title(title_str)
        title_group.to_edge(UP, buff=0.55)
        play_intro(self, title_group)

        COLOR_MAP = {"blue": ACCENT_BLUE, "green": ACCENT_GREEN,
                     "teal": ACCENT_TEAL, "purple": ACCENT_PURPLE,
                     "gold": ACCENT_GOLD, "coral": ACCENT_CORAL}

        current_mobjects = VGroup()
        current_card = None
        n = len(steps)
        pbar = None

        for i, step in enumerate(steps):
            rule     = detect_rule(step.description)
            new_card = explanation_card(step.description, rule)
            new_pbar = progress_bar((i+1)/n)
            badge    = step_badge(i+1, n)

            anims = []
            if pbar:  anims.append(FadeOut(pbar))
            anims += [FadeIn(new_pbar), FadeIn(badge)]
            if current_card:
                anims.append(ReplacementTransform(current_card, new_card))
            else:
                anims.append(FadeIn(new_card, shift=UP*0.1))
            current_card = new_card

            new_mobs = VGroup()
            if step.type == "geometry" and isinstance(step.data, dict):
                for sd in step.data.get("shapes", []):
                    c = COLOR_MAP.get(sd.get("color","blue").lower(), ACCENT_BLUE)
                    if sd.get("type") == "polygon":
                        pts = sd.get("points", [])
                        if len(pts) >= 3:
                            poly = Polygon(*pts, color=c, stroke_width=2.5)
                            poly.set_fill(c, opacity=sd.get("fill_opacity", 0.15))
                            new_mobs.add(poly)
                    elif sd.get("type") == "circle":
                        circ = Circle(radius=sd.get("radius",1.0), color=c, stroke_width=2.5)\
                               .move_to(sd.get("center", ORIGIN))
                        circ.set_fill(c, opacity=0.12)
                        new_mobs.add(circ)
                    elif sd.get("type") == "line":
                        new_mobs.add(Line(sd.get("start",ORIGIN), sd.get("end",RIGHT),
                                         stroke_width=2.5, color=c))
                for ld in step.data.get("labels", []):
                    new_mobs.add(MathTex(ld.get("text",""), font_size=28,
                                         color=TEXT_BRIGHT).move_to(ld.get("pos", ORIGIN)))

            if len(new_mobs):
                if len(current_mobjects): anims.append(FadeOut(current_mobjects))
                anims.append(Create(new_mobs, lag_ratio=0.15))
                current_mobjects = new_mobs
            elif step.type == "equation":
                eq = MathTex(step.latex, color=ACCENT_BLUE).scale(1.25)
                if len(current_mobjects): anims.append(FadeOut(current_mobjects))
                anims.append(FadeIn(eq, scale=0.85))
                current_mobjects = VGroup(eq)
            elif step.type == "text":
                txt = Text(step.latex, font_size=24, color=TEXT_BRIGHT)
                if len(current_mobjects): anims.append(FadeOut(current_mobjects))
                anims.append(FadeIn(txt))
                current_mobjects = VGroup(txt)

            if anims:
                self.play(*anims, run_time=1.1)
                self.wait(4.5)
            self.play(FadeOut(badge), run_time=0.4)
            pbar = new_pbar

        if current_card: self.play(FadeOut(current_card))
        play_outro(self, current_mobjects)

    # ══════════════════════════════════════════════════════════════════════════
    # CALCULUS / MATRIX  — completely rewritten for derivatives
    # ══════════════════════════════════════════════════════════════════════════

    def render_calculus_matrix(self):
        steps       = self.steps
        title_str   = self.title_str
        is_calculus = self.is_calculus
        is_deriv    = self.problem_type == "derivative"

        # ── Filter steps for derivative only ──────────────────────────────
        if is_deriv:
            steps = filter_derivative_steps(steps)
        n = len(steps)

        make_background(self)

        title_group = glowing_title(title_str, font_size=34)
        title_group.to_edge(UP, buff=0.5)
        play_intro(self, title_group)

        # ── Axes ──────────────────────────────────────────────────────────
        axes = None
        orig_plot  = None   # f(x)  — drawn once, stays the whole time
        deriv_plot = None   # f'(x) — drawn only at the final step

        # Pre-compute callables so build_derivative_axes can set a correct y-range
        _orig_func  = node_to_function(self._orig_node) if (is_deriv and hasattr(self, '_orig_node'))  else None
        _deriv_func = node_to_function(self._soln_node) if (is_deriv and hasattr(self, '_soln_node')) else None

        if is_calculus:
            axes = build_derivative_axes(self,
                                         orig_func=_orig_func,
                                         deriv_func=_deriv_func)

        # ── Draw f(x) immediately, using axes' computed y-range for clipping ──
        if is_deriv and axes is not None and _orig_func is not None:
            y_clip = (axes._y_lo, axes._y_hi)
            orig_plot = safe_plot(axes, _orig_func,
                                  x_range=(-3.5, 3.5),
                                  color=ACCENT_BLUE,
                                  y_clip=y_clip)
            self.play(Create(orig_plot, run_time=1.2))

            # legend — only f(x) row visible now; f'(x) row added at final step
            from math_models import to_latex as ml_to_latex
            f_tex  = rf"f(x) = {ml_to_latex(self._orig_node)}"
            fp_tex = rf"f'(x) = {ml_to_latex(self._soln_node)}"
            legend = add_graph_legend(axes, f_tex, fp_tex)
            self.play(FadeIn(legend[0]), FadeIn(legend[1][0]), run_time=0.5)
        else:
            legend = None

        # ── Step loop ─────────────────────────────────────────────────────
        current_equation = None
        current_rule_panel = None
        pbar = None

        for i, step in enumerate(steps):
            rule     = detect_rule(step.description)
            card     = explanation_card(step.description, rule)
            new_pbar = progress_bar((i+1)/n)
            badge    = step_badge(i+1, n)
            eq_color = RULE_COLORS.get(rule, ACCENT_GOLD) if rule else ACCENT_GOLD

            # equation mobject
            if step.type == "matrix":
                raw = (step.data['matrix'] if isinstance(step.data, dict) and 'matrix' in step.data
                       else (step.data if isinstance(step.data, list) else [[0]]))
                fmt = [[(str(int(v)) if abs(v-int(v))<1e-9 else f"{v:.2f}") for v in row]
                       for row in raw]
                new_eq = Matrix(fmt, element_to_mobject=Text, h_buff=1.6, v_buff=1.1).scale(0.68)
            else:
                new_eq = MathTex(step.latex, color=eq_color).scale(1.2)

            # position: right side if axes present, else centre
            if is_calculus:
                new_eq.to_edge(RIGHT, buff=0.9).shift(UP*0.9)
            else:
                new_eq.center().shift(UP*0.6)

            eq_hi = equation_box(new_eq, color=eq_color)

            # rule example panel (right side, below equation)
            new_rule_panel = None
            if rule and is_deriv:
                new_rule_panel = rule_example_panel(rule)
                if new_rule_panel is not None:
                    if is_calculus:
                        new_rule_panel.to_edge(RIGHT, buff=0.9).shift(DOWN*0.5)
                    else:
                        new_rule_panel.to_edge(RIGHT, buff=0.9)

            # build animation list
            anims = []
            if pbar:  anims.append(FadeOut(pbar))
            anims += [FadeIn(new_pbar), FadeIn(badge)]
            anims.append(FadeIn(card, shift=UP*0.1))

            if current_equation is None:
                anims += [FadeIn(new_eq, scale=0.85), FadeIn(eq_hi)]
            else:
                anims += [ReplacementTransform(current_equation, new_eq), FadeIn(eq_hi)]

            if current_rule_panel: anims.append(FadeOut(current_rule_panel))
            if new_rule_panel:     anims.append(FadeIn(new_rule_panel, shift=LEFT*0.1))

            self.play(*anims, run_time=1.2)

            # ── At the FINAL step: draw f'(x) on the graph ────────────────
            if is_deriv and i == n - 1 and axes is not None and _deriv_func is not None:
                deriv_plot = safe_plot(axes, _deriv_func,
                                       x_range=(-3.5, 3.5),
                                       color=ACCENT_CORAL,
                                       y_clip=(axes._y_lo, axes._y_hi))
                # reveal the second legend row
                legend_anims = [Create(deriv_plot, run_time=1.4)]
                if legend is not None:
                    legend_anims += [FadeIn(legend[1][1])]
                self.play(*legend_anims)

            self.wait(5)
            self.play(FadeOut(card), FadeOut(eq_hi), FadeOut(badge), run_time=0.6)
            current_equation = new_eq
            current_rule_panel = new_rule_panel
            pbar = new_pbar

        if current_rule_panel:
            self.play(FadeOut(current_rule_panel), run_time=0.4)

        play_outro(self, current_equation)


# ─────────────────────────────────────────────────────────────────────────────
# STANDALONE SCENE CLASSES
# ─────────────────────────────────────────────────────────────────────────────

class MathStepsScene(Scene):
    def __init__(self, steps: List[MathStep], title_str: str, **kwargs):
        self.steps     = steps
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        if not self.steps:
            return
        make_background(self)
        title_group = glowing_title(self.title_str, font_size=38)
        title_group.to_edge(UP, buff=0.55)
        play_intro(self, title_group)

        n = len(self.steps)
        current_equation = None
        pbar = None

        for i, step in enumerate(self.steps):
            rule     = detect_rule(step.description)
            card     = explanation_card(step.description, rule)
            new_pbar = progress_bar((i+1)/n)
            badge    = step_badge(i+1, n)

            if step.type == "matrix":
                matrix_data = step.data or [[0]]
                fmt = [[(str(int(v)) if abs(v-int(v))<1e-9 else f"{v:.2f}") for v in row]
                       for row in matrix_data]
                new_eq = Matrix(fmt, element_to_mobject=Text, h_buff=1.6, v_buff=1.1)\
                         .scale(0.72).center().shift(UP*0.6)
            elif step.type == "text":
                new_eq = Text(step.latex.replace("\\\\","\n"), font_size=24,
                              color=TEXT_BRIGHT).center().shift(UP*0.6)
            else:
                new_eq = MathTex(step.latex, color=ACCENT_BLUE).scale(1.3).center().shift(UP*0.6)

            eq_hi = equation_box(new_eq, color=RULE_COLORS.get(rule, ACCENT_TEAL) if rule else ACCENT_TEAL)
            anims = []
            if pbar:  anims.append(FadeOut(pbar))
            anims += [FadeIn(new_pbar), FadeIn(badge), FadeIn(card, shift=UP*0.1)]
            if current_equation is None:
                anims += [FadeIn(new_eq, scale=0.85), FadeIn(eq_hi)]
            else:
                anims += [ReplacementTransform(current_equation, new_eq), FadeIn(eq_hi)]

            self.play(*anims, run_time=1.1)
            self.wait(4.5)
            self.play(FadeOut(card), FadeOut(eq_hi), FadeOut(badge), run_time=0.6)
            current_equation = new_eq
            pbar = new_pbar

        play_outro(self, current_equation)


class GeometrySolverScene(Scene):
    def __init__(self, steps: List[MathStep], title_str: str, **kwargs):
        self.steps     = steps
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        # delegates to UniversalMathAnimation.render_geometry logic via composition
        if not self.steps:
            return
        make_background(self)
        title_group = glowing_title(self.title_str)
        title_group.to_edge(UP, buff=0.55)
        play_intro(self, title_group)

        COLOR_MAP = {"blue": ACCENT_BLUE, "green": ACCENT_GREEN,
                     "teal": ACCENT_TEAL, "purple": ACCENT_PURPLE,
                     "gold": ACCENT_GOLD, "coral": ACCENT_CORAL}
        current_mobjects = VGroup()
        current_card = None
        n = len(self.steps)
        pbar = None

        for i, step in enumerate(self.steps):
            rule     = detect_rule(step.description)
            new_card = explanation_card(step.description, rule)
            new_pbar = progress_bar((i+1)/n)
            badge    = step_badge(i+1, n)
            anims = []
            if pbar:  anims.append(FadeOut(pbar))
            anims += [FadeIn(new_pbar), FadeIn(badge)]
            if current_card:
                anims.append(ReplacementTransform(current_card, new_card))
            else:
                anims.append(FadeIn(new_card, shift=UP*0.1))
            current_card = new_card

            new_mobs = VGroup()
            if step.type == "geometry" and isinstance(step.data, dict):
                for sd in step.data.get("shapes", []):
                    c = COLOR_MAP.get(sd.get("color","blue").lower(), ACCENT_BLUE)
                    if sd.get("type") == "polygon":
                        pts = sd.get("points",[])
                        if len(pts)>=3:
                            poly = Polygon(*pts, color=c, stroke_width=2.5)
                            poly.set_fill(c, opacity=sd.get("fill_opacity",0.15))
                            new_mobs.add(poly)
                    elif sd.get("type") == "circle":
                        circ = Circle(radius=sd.get("radius",1.0), color=c, stroke_width=2.5)\
                               .move_to(sd.get("center",ORIGIN))
                        circ.set_fill(c, opacity=0.12)
                        new_mobs.add(circ)
                    elif sd.get("type") == "line":
                        new_mobs.add(Line(sd.get("start",ORIGIN), sd.get("end",RIGHT),
                                         stroke_width=2.5, color=c))
                for ld in step.data.get("labels",[]):
                    new_mobs.add(MathTex(ld.get("text",""), font_size=28,
                                         color=TEXT_BRIGHT).move_to(ld.get("pos",ORIGIN)))
            if len(new_mobs):
                if len(current_mobjects): anims.append(FadeOut(current_mobjects))
                anims.append(Create(new_mobs, lag_ratio=0.15))
                current_mobjects = new_mobs
            elif step.type == "equation":
                eq = MathTex(step.latex, color=ACCENT_BLUE).scale(1.25)
                if len(current_mobjects): anims.append(FadeOut(current_mobjects))
                anims.append(FadeIn(eq, scale=0.85))
                current_mobjects = VGroup(eq)
            elif step.type == "text":
                txt = Text(step.latex, font_size=24, color=TEXT_BRIGHT)
                if len(current_mobjects): anims.append(FadeOut(current_mobjects))
                anims.append(FadeIn(txt))
                current_mobjects = VGroup(txt)

            if anims:
                self.play(*anims, run_time=1.1)
                self.wait(4.5)
            self.play(FadeOut(badge), run_time=0.4)
            pbar = new_pbar

        if current_card: self.play(FadeOut(current_card))
        play_outro(self, current_mobjects)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def generate_solver_video(
    steps: List[MathStep],
    title: str,
    output_path: str,
    scene_class=MathStepsScene,
):
    output_dir  = os.path.dirname(output_path)
    output_file = os.path.basename(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    config.media_dir   = output_dir
    config.output_file = output_file
    scene = scene_class(steps, title)
    scene.render()


if __name__ == "__main__":
    UniversalMathAnimation().render()