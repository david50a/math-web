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
from math_models import MathStep, Node, Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln, to_latex as ml_to_latex
from typing import List
import textwrap
import numpy as np


# ─────────────────────────────────────────────────────────────────────────────
# THEME — Pure Black & Mathematical High-Contrast Aesthetic
# ─────────────────────────────────────────────────────────────────────────────
DEEP_BG       = "#000000"  # Pure Pitch Black
BG_MID        = "#000000"  # Pure Black
PANEL_BG      = "#08080C"  # Deep Obsidian / Black Glass
PANEL_BORDER  = "#22222E"  # Subtle Border

ACCENT_CYAN   = "#38BDF8"  # Primary Math Cyan
ACCENT_BLUE   = "#60A5FA"  # Function Curve Blue
ACCENT_TEAL   = "#2DD4BF"  # Lemma Mint
ACCENT_PURPLE = "#C084FC"  # Vector / Matrix Purple
ACCENT_GOLD   = "#FBBF24"  # Theorem Gold
ACCENT_CORAL  = "#FB7185"  # Derivative Rose / Tangent
ACCENT_GREEN  = "#34D399"  # Proof Emerald
ACCENT_PINK   = "#F472B6"  # Parameter Pink
TEXT_DIM      = "#94A3B8"  # Slate Muted
TEXT_SUBTLE   = "#475569"  # Slate Subtle
TEXT_BRIGHT   = "#FFFFFF"  # Pure Bright White

RULE_COLORS = {
    "Power Rule":    ACCENT_GOLD,
    "Product Rule":  ACCENT_PURPLE,
    "Sum Rule":      ACCENT_CYAN,
    "Chain Rule":    ACCENT_CORAL,
    "Constant Rule": TEXT_DIM,
    "Quotient Rule": ACCENT_PINK,
    "Difference":    ACCENT_TEAL,
    "Substitution":  ACCENT_PURPLE,
    "Integration":   ACCENT_GREEN,
    "Quadratic":     ACCENT_CYAN,
    "Factoring":     ACCENT_TEAL,
    "Elimination":   ACCENT_BLUE,
}

# Formal mathematical theorems and worked derivations
RULE_EXAMPLES = {
    "Power Rule":    (r"\dfrac{d}{dx}\left(x^n\right) = n \cdot x^{n-1}",
                      r"\text{e.g. } \dfrac{d}{dx}(x^3) = 3x^2"),
    "Product Rule":  (r"\dfrac{d}{dx}(u \cdot v) = u'v + uv'",
                      r"\text{e.g. } (x^2 \sin x)' = 2x\sin x + x^2\cos x"),
    "Sum Rule":      (r"\dfrac{d}{dx}(u + v) = \dfrac{du}{dx} + \dfrac{dv}{dx}",
                      r"\text{e.g. } (x^2+3x)' = 2x+3"),
    "Chain Rule":    (r"\dfrac{d}{dx}\left[f(g(x))\right] = f'(g(x)) \cdot g'(x)",
                      r"\text{e.g. } (\sin(x^2))' = 2x\cos(x^2)"),
    "Constant Rule": (r"\dfrac{d}{dx}(c) = 0 \quad (c \in \mathbb{R})",
                      r"\text{e.g. } (5)' = 0"),
    "Quotient Rule": (r"\dfrac{d}{dx}\left(\dfrac{u}{v}\right) = \dfrac{u'v - uv'}{v^2}",
                      r"\text{e.g. } \left(\dfrac{x^2}{x+1}\right)'"),
}


# ─────────────────────────────────────────────────────────────────────────────
# STEP FILTERING
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# NODE → CALLABLE
# ─────────────────────────────────────────────────────────────────────────────

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
    margin = max((hi - lo) * 0.2, 1.0)
    return lo - margin, hi + margin


def safe_plot(axes, func, x_range=(-3.0, 3.0), color=ACCENT_CYAN,
              stroke_width=3.2, y_clip=None):
    if y_clip is None:
        y_clip = _auto_y_range(func, x_range[0], x_range[1])

    lo_clip, hi_clip = y_clip

    def plotted(x):
        try:
            y = float(func(x))
            if not np.isfinite(y):
                return lo_clip
            return y
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
# MATHEMATICAL UI HELPERS & VISUAL COMPONENTS
# ─────────────────────────────────────────────────────────────────────────────

def wrap_text(text, width=64):
    return "\n".join(textwrap.wrap(text, width=width))


def detect_rule(description: str):
    for rule in RULE_COLORS:
        if rule.lower() in description.lower():
            return rule
    return None


def make_background(scene: Scene):
    """Pure black background with subtle mathematical Cartesian grid and watermarks."""
    scene.camera.background_color = "#000000"
    bg = Rectangle(
        width=config.frame_width + 0.2,
        height=config.frame_height + 0.2,
        fill_color="#000000",
        fill_opacity=1, stroke_width=0,
    ).set_z_index(-30)

    # Ambient mathematical coordinate grid lines on black
    grid_lines = VGroup()
    for x in np.arange(-7.2, 7.5, 0.8):
        grid_lines.add(Line([x, -4.2, 0], [x, 4.2, 0], stroke_width=0.35, stroke_color="#181822", stroke_opacity=0.7))
    for y in np.arange(-4.2, 4.5, 0.8):
        grid_lines.add(Line([-7.2, y, 0], [7.2, y, 0], stroke_width=0.35, stroke_color="#181822", stroke_opacity=0.7))
    grid_lines.set_z_index(-25)

    # Ambient watermark mathematical constants and operators on black
    math_watermarks = VGroup(
        MathTex(r"\int", font_size=42, color="#1E1E2A").move_to([-6.2, 3.2, 0]),
        MathTex(r"\sum_{n=1}^\infty", font_size=28, color="#1E1E2A").move_to([5.8, 3.1, 0]),
        MathTex(r"\nabla \times \mathbf{F}", font_size=26, color="#1E1E2A").move_to([-6.0, -3.2, 0]),
        MathTex(r"\pi \approx 3.14159", font_size=22, color="#1E1E2A").move_to([5.6, -3.3, 0]),
        MathTex(r"\mathbb{R}^n", font_size=26, color="#1A1A26").move_to([0, 3.3, 0]),
        MathTex(r"\dfrac{\partial f}{\partial x}", font_size=26, color="#1A1A26").move_to([0, -3.3, 0])
    ).set_z_index(-22)

    # Clean ambient intersection dots
    dots = VGroup(*[
        Dot(point=[xi, yi, 0], radius=0.015, color="#252535")
        for xi in np.arange(-7.2, 7.5, 1.6)
        for yi in np.arange(-4.2, 4.5, 1.6)
    ]).set_z_index(-20)

    # Crisp boundary frame
    vignette_border = RoundedRectangle(
        corner_radius=0.18,
        width=config.frame_width - 0.35,
        height=config.frame_height - 0.35,
        stroke_color="#1C1C28",
        stroke_width=1.0,
        fill_opacity=0
    ).set_z_index(-10)

    scene.add(bg, grid_lines, math_watermarks, dots, vignette_border)
    return bg, dots


def glowing_title(text: str, font_size=34):
    """Formal mathematical theorem/problem banner with notation."""
    is_tex = ("$" in text or "\\" in text)
    try:
        if is_tex:
            lbl = Tex(text, font_size=font_size, color=TEXT_BRIGHT)
        else:
            lbl = Text(text, font_size=font_size, color=TEXT_BRIGHT, weight=BOLD)
    except Exception:
        lbl = Text(text, font_size=font_size, color=TEXT_BRIGHT, weight=BOLD)
    
    line_w = min(max(lbl.width + 1.2, 4.5), config.frame_width - 1.5)
    ul = Line(LEFT * (line_w / 2), RIGHT * (line_w / 2),
              stroke_width=2.5, color=ACCENT_CYAN)
    ul.next_to(lbl, DOWN, buff=0.18)
    
    glow = Line(LEFT * (line_w / 2), RIGHT * (line_w / 2),
                stroke_width=8, color=ACCENT_CYAN, stroke_opacity=0.28)
    glow.move_to(ul)

    # Left and right mathematical brackets or coordinate marker points
    left_mark = MathTex(r"\langle", font_size=24, color=ACCENT_CYAN).next_to(lbl, LEFT, buff=0.18)
    right_mark = MathTex(r"\rangle", font_size=24, color=ACCENT_CYAN).next_to(lbl, RIGHT, buff=0.18)

    return VGroup(lbl, glow, ul, left_mark, right_mark)


def step_badge(index: int, total: int):
    """Mathematical index capsule: e.g. [ Step k = 1 / n ]."""
    pill_w = 2.4
    pill_h = 0.54
    pill_bg = RoundedRectangle(
        corner_radius=0.16, width=pill_w, height=pill_h,
        fill_color=PANEL_BG, fill_opacity=0.96,
        stroke_color=ACCENT_CYAN, stroke_width=1.8,
    )
    glow_pill = pill_bg.copy().set_stroke(color=ACCENT_CYAN, width=6, opacity=0.22)
    
    # LaTeX formatted mathematical step counter
    step_tex = MathTex(rf"\mathbf{{Step}}\ k = {index} \big/ {total}", font_size=18, color=ACCENT_CYAN)
    step_tex.move_to(pill_bg)

    return VGroup(glow_pill, pill_bg, step_tex).to_corner(UR, buff=0.42).shift(DOWN * 0.08)


def explanation_card(text: str, rule: str = None, width=None):
    """Formal mathematical lemma/derivation note card with LaTeX rule badge."""
    wrapped = wrap_text(text, 64)
    body    = Text(wrapped, font_size=19, color=TEXT_BRIGHT, line_spacing=1.35)
    
    card_w  = width or min(config.frame_width - 1.0, 13.8)
    card_h  = max(body.height + 0.8, 1.35)
    
    rect = RoundedRectangle(
        corner_radius=0.16, width=card_w, height=card_h,
        fill_color=PANEL_BG, fill_opacity=0.95,
        stroke_color=PANEL_BORDER, stroke_width=1.6,
    )
    glow_rect = rect.copy().set_stroke(color=ACCENT_CYAN, width=4, opacity=0.15)
    
    rule_color = RULE_COLORS.get(rule, ACCENT_CYAN) if rule else ACCENT_CYAN
    left_strip = RoundedRectangle(
        corner_radius=0.04,
        width=0.08, height=card_h - 0.26,
        fill_color=rule_color, fill_opacity=1.0,
        stroke_width=0
    ).align_to(rect, LEFT).shift(RIGHT * 0.15)

    # Prefix explanation with formal derivation arrow (⟹)
    deriv_arrow = MathTex(r"\implies", font_size=26, color=rule_color)\
                  .align_to(rect, LEFT).shift(RIGHT * 0.35)
    body.move_to(rect).shift(RIGHT * 0.3)
    
    group = VGroup(glow_rect, rect, left_strip, deriv_arrow, body)
    
    if rule:
        color   = RULE_COLORS.get(rule, ACCENT_GOLD)
        pill_bg = RoundedRectangle(
            corner_radius=0.12, height=0.44,
            width=len(rule) * 0.14 + 1.1,
            fill_color="#000000", fill_opacity=0.98,
            stroke_color=color, stroke_width=1.6,
        )
        pill_glow = pill_bg.copy().set_stroke(color=color, width=5, opacity=0.28)
        pill_txt = MathTex(rf"\mathbf{{\mathbb{{T}}hm:}}\ \text{{{rule}}}", font_size=16, color=color)
        pill_txt.move_to(pill_bg)
        pill = VGroup(pill_glow, pill_bg, pill_txt)
        pill.next_to(rect, UP, buff=0.12).align_to(rect, RIGHT).shift(LEFT * 0.3)
        group.add(pill)
        
    group.to_edge(DOWN, buff=0.35)
    return group


def rule_example_panel(rule: str):
    """Mathematical definition & lemma worked derivation panel."""
    if rule not in RULE_EXAMPLES:
        return None
    formula_str, example_str = RULE_EXAMPLES[rule]
    color = RULE_COLORS.get(rule, ACCENT_GOLD)

    header = MathTex(rf"\mathbf{{\underline{{\text{{Definition / Rule:}}\ {rule}}}}}", font_size=18, color=color)
    formula = MathTex(formula_str, font_size=21, color=TEXT_BRIGHT)
    example = MathTex(example_str, font_size=18, color=TEXT_DIM)

    content = VGroup(header, formula, example).arrange(DOWN, buff=0.22, aligned_edge=LEFT)

    panel_w = max(content.width + 0.85, 4.4)
    panel_h = content.height + 0.65
    
    bg = RoundedRectangle(
        corner_radius=0.16, width=panel_w, height=panel_h,
        fill_color=PANEL_BG, fill_opacity=0.96,
        stroke_color=color, stroke_width=1.5,
    )
    glow_bg = bg.copy().set_stroke(color=color, width=6, opacity=0.2)
    content.move_to(bg).shift(RIGHT * 0.12)

    bar = RoundedRectangle(
        corner_radius=0.04,
        width=0.08, height=panel_h - 0.22,
        fill_color=color, fill_opacity=0.9,
        stroke_width=0,
    ).align_to(bg, LEFT).shift(RIGHT * 0.12)

    return VGroup(glow_bg, bg, bar, content)


def equation_box(mobject, color=ACCENT_CYAN):
    """Rigorous mathematical step display card with subtle coordinate anchors."""
    card = RoundedRectangle(
        corner_radius=0.16,
        width=mobject.width + 0.95,
        height=mobject.height + 0.68,
        stroke_color=color,
        stroke_width=1.8,
        fill_color=PANEL_BG,
        fill_opacity=0.90
    ).move_to(mobject)

    glow = card.copy().set_stroke(color=color, width=8, opacity=0.22).set_fill(opacity=0)
    
    # Mathematical frame brackets
    b_left = MathTex(r"\big[", font_size=28, color=color).align_to(card, LEFT).shift(RIGHT*0.12)
    b_right = MathTex(r"\big]", font_size=28, color=color).align_to(card, RIGHT).shift(LEFT*0.12)
    
    return VGroup(glow, card, b_left, b_right)


def progress_bar(ratio: float, width=6.5):
    """Mathematical interval progress indicator [0, 1]."""
    track = RoundedRectangle(
        corner_radius=0.04, width=width, height=0.07,
        fill_color="#181822", fill_opacity=1.0, stroke_width=0
    )
    fill_w = max(width * min(max(ratio, 0.02), 1.0), 0.1)
    fill = RoundedRectangle(
        corner_radius=0.04, width=fill_w, height=0.07,
        fill_color=ACCENT_CYAN, fill_opacity=1.0, stroke_width=0
    ).align_to(track, LEFT)
    
    tip_dot = Dot(fill.get_right(), radius=0.055, color=ACCENT_CYAN)
    tip_glow = Dot(fill.get_right(), radius=0.12, color=ACCENT_CYAN, fill_opacity=0.35)
    
    return VGroup(track, fill, tip_glow, tip_dot).to_edge(UP, buff=0.14)


def play_intro(scene: Scene, title_group: VGroup):
    """Cinematic entry sequence for problem statement."""
    title_group.shift(UP * 0.4)
    scene.play(
        FadeIn(title_group[0], shift=DOWN * 0.25, run_time=0.9),
        FadeIn(title_group[3], shift=RIGHT * 0.1, run_time=0.6),
        FadeIn(title_group[4], shift=LEFT * 0.1, run_time=0.6)
    )
    scene.play(
        Create(title_group[2], run_time=0.7),
        FadeIn(title_group[1], run_time=0.7)
    )
    scene.wait(0.35)


def play_outro(scene: Scene, final_eq):
    """Rigorous mathematical conclusion with Q.E.D. / Halmos symbol and conclusion frame."""
    frame = RoundedRectangle(
        corner_radius=0.18,
        width=final_eq.width + 1.1,
        height=final_eq.height + 0.85,
        stroke_color=ACCENT_GREEN, stroke_width=2.8,
        fill_color=PANEL_BG, fill_opacity=0.94,
    ).move_to(final_eq)
    
    glow_frame = frame.copy().set_stroke(color=ACCENT_GREEN, width=12, opacity=0.3).set_fill(opacity=0)
    
    # Formal conclusion box with Halmos square Q.E.D.
    badge_bg = RoundedRectangle(
        corner_radius=0.16, width=3.8, height=0.68,
        fill_color="#021C14", fill_opacity=0.96,
        stroke_color=ACCENT_GREEN, stroke_width=1.8
    )
    badge_glow = badge_bg.copy().set_stroke(color=ACCENT_GREEN, width=8, opacity=0.35)
    
    qed_txt = MathTex(r"\therefore\ \mathbf{Result\ Verified}\ \ \blacksquare\ \text{Q.E.D.}",
                      font_size=20, color=TEXT_BRIGHT)
    qed_txt.move_to(badge_bg)
    done_badge = VGroup(badge_glow, badge_bg, qed_txt).next_to(frame, DOWN, buff=0.35)
    
    scene.play(
        Circumscribe(final_eq, color=ACCENT_GREEN, run_time=1.0),
        Create(glow_frame, run_time=0.8),
        Create(frame, run_time=0.8)
    )
    scene.play(
        FadeIn(done_badge, shift=UP * 0.2, run_time=0.6),
        Flash(done_badge.get_center(), color=ACCENT_GREEN, line_length=0.25, num_lines=12, run_time=0.8)
    )
    scene.wait(2.8)


# ─────────────────────────────────────────────────────────────────────────────
# MATHEMATICAL GRAPH & FUNCTION PANEL
# ─────────────────────────────────────────────────────────────────────────────

def _nice_tick_step(span: float) -> float:
    raw = span / 6.0
    for step in [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]:
        if raw <= step:
            return step
    return round(raw)


def build_derivative_axes(scene: Scene, orig_func=None, deriv_func=None):
    """
    Build mathematical Cartesian coordinate axes with grid lines and LaTeX ticks.
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
            "color": "#334155", "stroke_width": 2.0,
            "include_tip": True, "tip_length": 0.2, "tip_width": 0.14,
        },
        x_axis_config={
            "numbers_to_include": range(-3, 4),
            "label_constructor": MathTex, "font_size": 16, "color": TEXT_DIM,
        },
        y_axis_config={
            "numbers_to_include": y_ticks,
            "label_constructor": MathTex, "font_size": 16, "color": TEXT_DIM,
        },
    )
    axes.to_edge(LEFT, buff=0.5).shift(DOWN * 0.3)

    # Subtle Cartesian coordinate grid
    h_lines = VGroup(*[
        DashedLine(axes.c2p(X_LO, y), axes.c2p(X_HI, y),
                   stroke_width=0.6, color="#1E293B", dash_length=0.1)
        for y in y_ticks
    ])
    v_lines = VGroup(*[
        DashedLine(axes.c2p(x, y_lo), axes.c2p(x, y_hi),
                   stroke_width=0.6, color="#1E293B", dash_length=0.1)
        for x in range(-3, 4)
    ])
    
    ax_labels = axes.get_axis_labels(
        x_label=MathTex(r"x \in \mathbb{R}", font_size=18, color=ACCENT_CYAN),
        y_label=MathTex(r"y = f(x)", font_size=18, color=ACCENT_CYAN),
    )

    origin_pt = axes.c2p(0, 0)
    origin_dot = Dot(origin_pt, radius=0.04, color=TEXT_DIM)
    origin_lbl = MathTex(r"\mathcal{O}", font_size=16, color=TEXT_DIM).next_to(origin_dot, DL, buff=0.08)

    scene.play(
        Create(h_lines, run_time=0.4),
        Create(v_lines, run_time=0.4),
        Create(axes, run_time=0.8),
        FadeIn(ax_labels, run_time=0.5),
        FadeIn(origin_dot, origin_lbl, run_time=0.4)
    )
    axes._y_lo = y_lo
    axes._y_hi = y_hi
    return axes


def add_graph_legend(axes, orig_label_tex, deriv_label_tex):
    """Mathematical function & derivative legend box."""
    orig_line  = Line(ORIGIN, RIGHT*0.45, stroke_width=3.0, color=ACCENT_CYAN)
    orig_lbl   = MathTex(orig_label_tex, font_size=18, color=ACCENT_CYAN)
    deriv_line = Line(ORIGIN, RIGHT*0.45, stroke_width=3.0, color=ACCENT_CORAL)
    deriv_lbl  = MathTex(deriv_label_tex, font_size=18, color=ACCENT_CORAL)

    row1 = VGroup(orig_line, orig_lbl).arrange(RIGHT, buff=0.12)
    row2 = VGroup(deriv_line, deriv_lbl).arrange(RIGHT, buff=0.12)
    rows = VGroup(row1, row2).arrange(DOWN, buff=0.18, aligned_edge=LEFT)

    header = MathTex(r"\mathbf{\mathcal{F}\text{unctions:}}", font_size=16, color=TEXT_DIM)
    content = VGroup(header, rows).arrange(DOWN, buff=0.14, aligned_edge=LEFT)

    bg = RoundedRectangle(
        corner_radius=0.12, width=content.width + 0.45, height=content.height + 0.4,
        fill_color=PANEL_BG, fill_opacity=0.94,
        stroke_color=PANEL_BORDER, stroke_width=1.2,
    )
    content.move_to(bg)
    legend = VGroup(bg, content)
    legend.next_to(axes, UP, buff=0.18).align_to(axes, RIGHT)
    return legend


# ─────────────────────────────────────────────────────────────────────────────
# MAIN SCENE
# ─────────────────────────────────────────────────────────────────────────────

class UniversalMathAnimation(Scene):

    def construct(self):
        input_str    = os.environ.get("MATH_EXPR", "x^2 + 3*x")
        problem_type = os.environ.get("MATH_OP", "derivative")
        method_id    = os.environ.get("MATH_METHOD_ID", "").strip()
        method_name  = os.environ.get("MATH_METHOD_NAME", "").strip()

        # Method-specific rendering if requested by user
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
                elif method_id == "integral-simpson":
                    from main import parse_expr
                    clean_expr = input_str
                    if clean_expr.lower().startswith('integrate(') and clean_expr.endswith(')'):
                        clean_expr = clean_expr[10:-1]
                    node = parse_expr(clean_expr)
                    _, steps = integral.integrate_numerical(node, 0, 1, 6, "simpson")
                    title_str = method_name or "Simpson's Rule Quadrature"
                elif method_id == "integral-trapezoid":
                    from main import parse_expr
                    clean_expr = input_str
                    if clean_expr.lower().startswith('integrate(') and clean_expr.endswith(')'):
                        clean_expr = clean_expr[10:-1]
                    node = parse_expr(clean_expr)
                    _, steps = integral.integrate_numerical(node, 0, 1, 6, "trapezoid")
                    title_str = method_name or "Trapezoidal Rule Quadrature"
                elif method_id == "integral-midpoint":
                    from main import parse_expr
                    clean_expr = input_str
                    if clean_expr.lower().startswith('integrate(') and clean_expr.endswith(')'):
                        clean_expr = clean_expr[10:-1]
                    node = parse_expr(clean_expr)
                    _, steps = integral.integrate_numerical(node, 0, 1, 6, "midpoint")
                    title_str = method_name or "Midpoint Rule Quadrature"
                elif method_id == "derive-rules":
                    from main import parse_expr
                    clean_expr = input_str
                    if clean_expr.lower().startswith('derive(') and clean_expr.endswith(')'):
                        clean_expr = clean_expr[7:-1]
                    node = parse_expr(clean_expr)
                    _, steps = derivative.derive(node)
                    title_str = method_name or "Differentiation Rules"
                elif method_id == "derive-limit-definition":
                    from main import parse_expr
                    clean_expr = input_str
                    if clean_expr.lower().startswith('derive(') and clean_expr.endswith(')'):
                        clean_expr = clean_expr[7:-1]
                    node = parse_expr(clean_expr)
                    d_res, _ = derivative.derive(node)
                    d_ans = to_string(d_res)
                    steps = [
                        MathStep("Difference quotient formulation", r"f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}", "equation"),
                        MathStep("Expand & evaluate limit as h -> 0", rf"f'(x) = {d_ans}", "equation")
                    ]
                    title_str = method_name or "Definition of Derivative"
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
                    title_str = method_name or "Matrix Inversion"
                elif method_id == "matrix-det":
                    matrices = re.findall(r'\[\[.*?\]\]|\[.*?\]', input_str)
                    if matrices:
                        matrix = ast.literal_eval(matrices[0])
                        _, steps = solvers.determinant(matrix)
                    title_str = method_name or "Matrix Determinant"
                elif method_id == "stats-direct-mean":
                    data_str = re.search(r'\((.*)\)', input_str).group(1) if '(' in input_str else input_str
                    steps = stats_engine.mean(data_str)
                    title_str = method_name or "Arithmetic Mean"
                elif method_id == "stats-median":
                    data_str = re.search(r'\((.*)\)', input_str).group(1) if '(' in input_str else input_str
                    steps = stats_engine.median(data_str)
                    title_str = method_name or "Median Resolution"

                if steps:
                    self.render_math_steps(steps, title_str)
                    return
            except Exception as err:
                print(f"Error handling method_id '{method_id}': {err}")

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
        title_group = glowing_title(title_str, font_size=36)
        title_group.to_edge(UP, buff=0.55)
        play_intro(self, title_group)

        n = len(steps)
        current_equation = None
        current_eq_box = None
        current_card = None
        pbar = None

        for i, step in enumerate(steps):
            rule     = detect_rule(step.description)
            new_card = explanation_card(step.description, rule)
            new_pbar = progress_bar((i + 1) / n)
            badge    = step_badge(i + 1, n)
            theme_color = RULE_COLORS.get(rule, ACCENT_CYAN) if rule else ACCENT_CYAN

            if step.type == "matrix":
                matrix_data = step.data or [[0]]
                fmt = [[(str(int(v)) if abs(v-int(v))<1e-9 else f"{v:.2f}") for v in row]
                       for row in matrix_data]
                new_eq = Matrix(fmt, element_to_mobject=Text, h_buff=1.6, v_buff=1.1)\
                         .scale(0.72).center().shift(UP*0.55)
            elif step.type == "text":
                new_eq = Text(step.latex.replace("\\\\","\n"), font_size=24,
                              color=TEXT_BRIGHT).center().shift(UP*0.55)
            else:
                new_eq = MathTex(step.latex, color=theme_color).scale(1.25).center().shift(UP*0.55)

            new_eq_box = equation_box(new_eq, color=theme_color)

            anims = []
            if pbar:
                anims.append(FadeOut(pbar))
            anims += [FadeIn(new_pbar), FadeIn(badge)]

            if current_card:
                anims.append(ReplacementTransform(current_card, new_card))
            else:
                anims.append(FadeIn(new_card, shift=UP*0.15))

            if current_equation is None:
                anims += [FadeIn(new_eq, scale=0.9), FadeIn(new_eq_box)]
            else:
                anims += [
                    ReplacementTransform(current_equation, new_eq),
                    ReplacementTransform(current_eq_box, new_eq_box)
                ]

            self.play(*anims, run_time=1.1)

            # Highlight significant intermediate or final steps
            if i == n - 1:
                self.play(Circumscribe(new_eq, color=ACCENT_GREEN, run_time=0.9))
            elif rule:
                self.play(Indicate(new_eq, color=theme_color, scale_factor=1.05, run_time=0.7))

            self.wait(4.2)
            self.play(FadeOut(badge), run_time=0.4)
            current_equation = new_eq
            current_eq_box = new_eq_box
            current_card = new_card
            pbar = new_pbar

        if current_card:
            self.play(FadeOut(current_card), FadeOut(current_eq_box), run_time=0.5)
        play_outro(self, current_equation)

    # ══════════════════════════════════════════════════════════════════════════
    # GEOMETRY
    # ══════════════════════════════════════════════════════════════════════════

    def render_geometry(self, steps, title_str):
        if not steps:
            return
        make_background(self)
        title_group = glowing_title(title_str, font_size=36)
        title_group.to_edge(UP, buff=0.55)
        play_intro(self, title_group)

        COLOR_MAP = {"blue": ACCENT_CYAN, "green": ACCENT_GREEN,
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
                    c = COLOR_MAP.get(sd.get("color","blue").lower(), ACCENT_CYAN)
                    if sd.get("type") == "polygon":
                        pts = sd.get("points", [])
                        if len(pts) >= 3:
                            poly = Polygon(*pts, color=c, stroke_width=2.5)
                            poly.set_fill(c, opacity=sd.get("fill_opacity", 0.18))
                            new_mobs.add(poly)
                    elif sd.get("type") == "circle":
                        circ = Circle(radius=sd.get("radius",1.0), color=c, stroke_width=2.5)\
                               .move_to(sd.get("center", ORIGIN))
                        circ.set_fill(c, opacity=0.15)
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
                eq = MathTex(step.latex, color=ACCENT_CYAN).scale(1.25)
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
                self.wait(4.2)
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
                                  color=ACCENT_CYAN,
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
        current_eq_box = None
        current_rule_panel = None
        current_card = None
        pbar = None

        for i, step in enumerate(steps):
            rule     = detect_rule(step.description)
            new_card = explanation_card(step.description, rule)
            new_pbar = progress_bar((i+1)/n)
            badge    = step_badge(i+1, n)
            eq_color = RULE_COLORS.get(rule, ACCENT_GOLD) if rule else ACCENT_CYAN

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
                new_eq.to_edge(RIGHT, buff=0.9).shift(UP*0.85)
            else:
                new_eq.center().shift(UP*0.55)

            new_eq_box = equation_box(new_eq, color=eq_color)

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
            
            if current_card:
                anims.append(ReplacementTransform(current_card, new_card))
            else:
                anims.append(FadeIn(new_card, shift=UP*0.1))

            if current_equation is None:
                anims += [FadeIn(new_eq, scale=0.85), FadeIn(new_eq_box)]
            else:
                anims += [
                    ReplacementTransform(current_equation, new_eq),
                    ReplacementTransform(current_eq_box, new_eq_box)
                ]

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

            self.wait(4.5)
            self.play(FadeOut(badge), run_time=0.4)
            current_equation = new_eq
            current_eq_box = new_eq_box
            current_rule_panel = new_rule_panel
            current_card = new_card
            pbar = new_pbar

        if current_rule_panel:
            self.play(FadeOut(current_rule_panel), run_time=0.4)
        if current_card:
            self.play(FadeOut(current_card), FadeOut(current_eq_box), run_time=0.5)

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
        title_group = glowing_title(self.title_str, font_size=36)
        title_group.to_edge(UP, buff=0.55)
        play_intro(self, title_group)

        n = len(self.steps)
        current_equation = None
        current_eq_box = None
        current_card = None
        pbar = None

        for i, step in enumerate(self.steps):
            rule     = detect_rule(step.description)
            new_card = explanation_card(step.description, rule)
            new_pbar = progress_bar((i + 1) / n)
            badge    = step_badge(i + 1, n)
            theme_color = RULE_COLORS.get(rule, ACCENT_CYAN) if rule else ACCENT_CYAN

            if step.type == "matrix":
                matrix_data = step.data or [[0]]
                fmt = [[(str(int(v)) if abs(v-int(v))<1e-9 else f"{v:.2f}") for v in row]
                       for row in matrix_data]
                new_eq = Matrix(fmt, element_to_mobject=Text, h_buff=1.6, v_buff=1.1)\
                         .scale(0.72).center().shift(UP*0.55)
            elif step.type == "text":
                new_eq = Text(step.latex.replace("\\\\","\n"), font_size=24,
                              color=TEXT_BRIGHT).center().shift(UP*0.55)
            else:
                new_eq = MathTex(step.latex, color=theme_color).scale(1.25).center().shift(UP*0.55)

            new_eq_box = equation_box(new_eq, color=theme_color)

            anims = []
            if pbar:
                anims.append(FadeOut(pbar))
            anims += [FadeIn(new_pbar), FadeIn(badge)]

            if current_card:
                anims.append(ReplacementTransform(current_card, new_card))
            else:
                anims.append(FadeIn(new_card, shift=UP*0.15))

            if current_equation is None:
                anims += [FadeIn(new_eq, scale=0.9), FadeIn(new_eq_box)]
            else:
                anims += [
                    ReplacementTransform(current_equation, new_eq),
                    ReplacementTransform(current_eq_box, new_eq_box)
                ]

            self.play(*anims, run_time=1.1)

            if i == n - 1:
                self.play(Circumscribe(new_eq, color=ACCENT_GREEN, run_time=0.9))
            elif rule:
                self.play(Indicate(new_eq, color=theme_color, scale_factor=1.05, run_time=0.7))

            self.wait(4.2)
            self.play(FadeOut(badge), run_time=0.4)
            current_equation = new_eq
            current_eq_box = new_eq_box
            current_card = new_card
            pbar = new_pbar

        if current_card:
            self.play(FadeOut(current_card), FadeOut(current_eq_box), run_time=0.5)
        play_outro(self, current_equation)


class GeometrySolverScene(Scene):
    def __init__(self, steps: List[MathStep], title_str: str, **kwargs):
        self.steps     = steps
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        if not self.steps:
            return
        make_background(self)
        title_group = glowing_title(self.title_str, font_size=36)
        title_group.to_edge(UP, buff=0.55)
        play_intro(self, title_group)

        COLOR_MAP = {"blue": ACCENT_CYAN, "green": ACCENT_GREEN,
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
                    c = COLOR_MAP.get(sd.get("color","blue").lower(), ACCENT_CYAN)
                    if sd.get("type") == "polygon":
                        pts = sd.get("points",[])
                        if len(pts)>=3:
                            poly = Polygon(*pts, color=c, stroke_width=2.5)
                            poly.set_fill(c, opacity=sd.get("fill_opacity",0.18))
                            new_mobs.add(poly)
                    elif sd.get("type") == "circle":
                        circ = Circle(radius=sd.get("radius",1.0), color=c, stroke_width=2.5)\
                               .move_to(sd.get("center",ORIGIN))
                        circ.set_fill(c, opacity=0.15)
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
                eq = MathTex(step.latex, color=ACCENT_CYAN).scale(1.25)
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