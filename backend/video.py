"""
video.py - Manim renderer for the math-solver videos.

Every scene shares the same "chrome": an animated title card that settles into
a header, a step counter, a progress bar, a caption area and a fade-out outro.
Public API (unchanged): UniversalMathAnimation, MathStepsScene,
GeometrySolverScene, WordProblemManimScene, generate_solver_video,
render_word_problem_manim.
"""
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
import traceback
from math_models import MathStep, Node, Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln, to_latex as ml_to_latex, to_string
from typing import List
import textwrap
import numpy as np


# ══════════════════════════════════════════════════════════════════════════════
# THEME
# ══════════════════════════════════════════════════════════════════════════════

B3_BG         = "#0E1117"  # Deep chalkboard charcoal
B3_BLUE       = "#58C4DD"  # Sky blue
B3_DARK_BLUE  = "#29ABCA"  # Deep blue accent
B3_TEAL       = "#5CD0B3"  # Mint teal
B3_GREEN      = "#83C167"  # Emerald green
B3_YELLOW     = "#F5D547"  # Notation yellow (softened from pure #FFFF00)
B3_GOLD       = "#E8C15A"  # Warm gold
B3_RED        = "#FC6255"  # Coral red
B3_MAROON     = "#C55F73"  # Rose maroon
B3_PURPLE     = "#9A72AC"  # Purple
B3_WHITE      = "#ECEFF4"  # Chalkboard white
B3_DIM        = "#94A3B8"  # Subtle grey
B3_GRID       = "#1E293B"  # Muted grid

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

# Layout (frame is 14.22 x 8 units)
CAPTION_Y   = -3.05            # centre line of the caption strip
PANEL_X     = 3.85             # centre x of the right-hand panel
PANEL_W     = 5.6
PANEL_H     = 2.4
AXES_CENTER = np.array([-3.35, -0.05, 0.0])


def _pick_font() -> str:
    """Use a clean sans-serif if one is installed; otherwise Manim's default."""
    try:
        import manimpango
        available = set(manimpango.list_fonts())
    except Exception:
        return ""
    for name in ("Inter", "SF Pro Display", "Segoe UI", "Helvetica Neue",
                 "Helvetica", "Arial", "DejaVu Sans"):
        if name in available:
            return name
    return ""


FONT = _pick_font()


def T(text, font_size=24, color=B3_WHITE, **kwargs):
    """Text with the project font applied."""
    return Text(str(text), font_size=font_size, color=color, font=FONT, **kwargs)


def _log_error(context: str):
    print(f"[video] {context} failed:", file=sys.stderr)
    traceback.print_exc()


# ══════════════════════════════════════════════════════════════════════════════
# COMPATIBILITY STUB
# ══════════════════════════════════════════════════════════════════════════════

class PiCreature(VGroup):
    """Backwards-compatibility stub (character removed)."""
    def __init__(self, *args, **kwargs):
        super().__init__()

    def look_at(self, *args, **kwargs):
        return Wait(0.01)

    def blink(self, *args, **kwargs):
        return Wait(0.01)

    def cheer(self, *args, **kwargs):
        return Wait(0.01)


# ══════════════════════════════════════════════════════════════════════════════
# RICH TEXT: plain words + inline LaTeX, so no raw "\Delta x" ever hits the screen
# ══════════════════════════════════════════════════════════════════════════════

_UNICODE_TO_TEX = {
    "→": r"$\rightarrow$", "≠": r"$\neq$", "≤": r"$\leq$", "≥": r"$\geq$",
    "×": r"$\times$", "·": r"$\cdot$", "±": r"$\pm$", "π": r"$\pi$",
    "∞": r"$\infty$", "θ": r"$\theta$", "Δ": r"$\Delta$", "∫": r"$\int$",
    "∑": r"$\sum$", "²": r"$^2$", "³": r"$^3$", "−": "-", "–": "--", "—": "---",
}
_TEX_TO_UNICODE = {
    r"\Delta": "Δ", r"\to": "→", r"\rightarrow": "→", r"\sum": "Σ", r"\int": "∫",
    r"\cdot": "·", r"\times": "×", r"\pi": "π", r"\infty": "∞", r"\theta": "θ",
    r"\leq": "≤", r"\geq": "≥", r"\neq": "≠", r"\pm": "±", r"\det": "det",
    r"\hat": "", r"\imath": "i", r"\jmath": "j", r"\dfrac": "", r"\frac": "",
}
_FUNC_TOKEN = re.compile(r"^[A-Za-z]'?\([^)]*\)[,.;:]*$")


_SHORT_WORDS = frozenset(
    "a i an as at be by do go if in is it me my no of on or so to up us we and are but can for "
    "has the was you not use get set let put add try see".split())


def _is_mathy_short(tok: str) -> bool:
    """Short token that reads as math (x, 0, dx, =, +) rather than an English word."""
    core = tok.rstrip(",.;:")
    return (0 < len(core) <= 3 and core.lower() not in _SHORT_WORDS
            and re.fullmatch(r"[A-Za-z0-9=+\-*/]+", core) is not None)


def _mark_math(text: str) -> str:
    """Wrap math-looking tokens of an unmarked sentence in $...$."""
    toks = text.split()
    flags = [any(c in t for c in "\\^_{}") or bool(_FUNC_TOKEN.match(t)) for t in toks]
    bridged = flags[:]
    for i in range(1, len(toks)):              # absorb "x", "0", "dx", "=" that belong to a math run
        prev_is_math = bridged[i - 1]
        if not flags[i] and prev_is_math and _is_mathy_short(toks[i]) and not toks[i - 1].endswith((",", ".", ";", ":")):
            bridged[i] = True
    out, run = [], []

    def flush():
        if run:
            out.append("$" + " ".join(run) + "$")
            run.clear()

    for tok, is_math in zip(toks, bridged):
        if is_math:
            m = re.match(r"^(.*?)([,.;:]*)$", tok)
            run.append(m.group(1))
            if m.group(2):
                flush()
                out[-1] += m.group(2)
        else:
            flush()
            out.append(tok)
    flush()
    return " ".join(out)


def _wrap_marked(marked: str, width: int) -> List[str]:
    """Word-wrap without ever splitting inside a $...$ run."""
    protected = re.sub(r"\$[^$]*\$", lambda m: m.group(0).replace(" ", "\u00a0"), marked)
    lines = textwrap.wrap(protected, width=width, break_long_words=False, break_on_hyphens=False)
    return [ln.replace("\u00a0", " ") for ln in lines]


def _escape_plain(s: str) -> str:
    for k, v in _UNICODE_TO_TEX.items():
        s = s.replace(k, v)
    return (s.replace("&", r"\&").replace("%", r"\%").replace("#", r"\#")
             .replace("<", "$<$").replace(">", "$>$").replace("~", r"\textasciitilde{}"))


def _line_to_tex(line: str) -> str:
    parts = re.split(r"(\$[^$]*\$)", line)
    out = []
    for p in parts:
        if len(p) > 1 and p.startswith("$") and p.endswith("$"):
            out.append(p)
        elif p.strip():
            out.append(r"\textsf{" + _escape_plain(p) + "}")
        elif p:
            out.append(r"\ ")
    return "".join(out)


def _strip_tex(s: str) -> str:
    for k in sorted(_TEX_TO_UNICODE, key=len, reverse=True):
        s = s.replace(k, _TEX_TO_UNICODE[k])
    s = re.sub(r"\\[a-zA-Z]+", "", s)
    s = s.replace("$", "").replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", s).strip()


def rich_line(line: str, color=B3_WHITE, font_size=24):
    try:
        return Tex(_line_to_tex(line), color=color, font_size=font_size)
    except Exception:
        return T(_strip_tex(line), font_size=int(font_size * 0.85), color=color)


def rich_text(text: str, color=B3_WHITE, font_size=24, width_chars=78, line_buff=0.14):
    text = " ".join(str(text).split())
    marked = text if "$" in text else _mark_math(text)
    lines = _wrap_marked(marked, width_chars) or [" "]
    return VGroup(*[rich_line(ln, color, font_size) for ln in lines]).arrange(
        DOWN, aligned_edge=LEFT, buff=line_buff)


def reading_time(text: str, lo=1.8, hi=6.5) -> float:
    """How long a viewer needs to read a caption."""
    words = len(re.findall(r"\w+", str(text)))
    return min(hi, max(lo, 1.0 + 0.3 * words))


def _truncate(text: str, limit: int) -> str:
    text = " ".join(str(text).split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",;:")
    return cut + "…"


def fit(mob, max_w=None, max_h=None):
    if max_w and mob.width > max_w:
        mob.scale_to_fit_width(max_w)
    if max_h and mob.height > max_h:
        mob.scale_to_fit_height(max_h)
    return mob


def safe_mathtex(latex, color=B3_WHITE, scale=1.0, font_size=48):
    try:
        m = MathTex(latex, color=color, font_size=font_size)
    except Exception:
        _log_error(f"MathTex({latex!r})")
        return T(_strip_tex(str(latex)), font_size=30, color=color)
    return m.scale(scale) if scale != 1 else m


def _nice_step(span: float, target: int = 5) -> float:
    raw = max(span, 1e-9) / target
    mag = 10 ** math.floor(math.log10(raw))
    for m in (1, 2, 5, 10):
        if raw <= m * mag:
            return m * mag
    return 10 * mag


def _fmt_num(v) -> str:
    try:
        if abs(v - round(v)) < 1e-9:
            return str(int(round(v)))
        return f"{v:.2f}".rstrip("0").rstrip(".")
    except Exception:
        return str(v)


# ══════════════════════════════════════════════════════════════════════════════
# BACKGROUND, TITLE, CAPTION
# ══════════════════════════════════════════════════════════════════════════════

def make_3b1b_background(scene: Scene):
    """Dark chalkboard background with a faint dot lattice."""
    scene.camera.background_color = B3_BG
    bg = Rectangle(
        width=config.frame_width + 0.5, height=config.frame_height + 0.5,
        fill_color=B3_BG, fill_opacity=1, stroke_width=0,
    ).set_z_index(-30)
    dots = VGroup(*[
        Dot(point=[xi, yi, 0], radius=0.015, color=B3_GRID)
        for xi in np.arange(-7.0, 7.5, 1.5)
        for yi in np.arange(-4.0, 4.5, 1.5)
    ]).set_z_index(-20)
    scene.add(bg, dots)
    return bg, dots


def make_3b1b_title(text: str, font_size=32, max_width=None):
    """Title with an accent underline, auto-shrunk to max_width."""
    is_tex = ("$" in text or "\\" in text)
    try:
        if is_tex:
            lbl = Tex(text, font_size=font_size, color=B3_WHITE)
        else:
            lbl = T(text, font_size=font_size, color=B3_WHITE, weight=BOLD)
    except Exception:
        lbl = T(_strip_tex(text), font_size=font_size, color=B3_WHITE, weight=BOLD)
    if max_width and lbl.width > max_width:
        lbl.scale_to_fit_width(max_width)
    w = min(max(lbl.width + 0.8, 3.8), config.frame_width - 1.5)
    ul = Line(LEFT * (w / 2), RIGHT * (w / 2), stroke_width=2.4, color=B3_BLUE).next_to(lbl, DOWN, buff=0.15)
    return VGroup(lbl, ul)


def make_3b1b_annotation(text: str, color=B3_GOLD, width=11.8):
    """Caption strip: accent bar + wrapped text (with real typeset math)."""
    body = rich_text(text, color=B3_WHITE, font_size=24, width_chars=78)
    fit(body, width - 0.5, 1.35)
    bar = Line(UP * (body.height / 2 + 0.08), DOWN * (body.height / 2 + 0.08),
               stroke_width=4, color=color)
    group = VGroup(bar, body).arrange(RIGHT, buff=0.28)
    return group.move_to([0, CAPTION_Y, 0]).set_z_index(10)


def swap(old, new):
    """Clean cross-fade (instead of letter-morphing ReplacementTransform)."""
    return [FadeTransform(old, new)]


def place_panel(mob, y=-0.1):
    return fit(mob, PANEL_W, PANEL_H).move_to([PANEL_X, y, 0])


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


def build_step_mobject(step: MathStep, color):
    """Equation mobject for one step (matrix / text / LaTeX)."""
    if step.type == "matrix":
        try:
            data = step.data or [[0]]
            fmt = [[_fmt_num(v) for v in row] for row in data]
            m = Matrix(fmt, h_buff=1.4, v_buff=0.9).scale(0.95)
            m.set_color(B3_WHITE)
            m.get_brackets().set_color(color)
            return m
        except Exception:
            _log_error("matrix step")
    if step.type == "text":
        return T(step.latex.replace("\\\\", "\n"), font_size=30, color=B3_WHITE, line_spacing=1.2)
    return safe_mathtex(step.latex, color=B3_WHITE, scale=1.25)


def rule_badge(rule: str, color):
    label = T(rule.upper(), font_size=16, color=color)
    box = RoundedRectangle(corner_radius=0.14, width=label.width + 0.5, height=label.height + 0.3,
                           stroke_color=color, stroke_width=1.6, fill_opacity=0)
    return VGroup(box, label.move_to(box))


# ══════════════════════════════════════════════════════════════════════════════
# CHROME: title card -> header, step counter, progress bar, outro
# ══════════════════════════════════════════════════════════════════════════════

class Chrome:
    def __init__(self, scene: Scene, title_str: str, total_steps: int):
        self.scene = scene
        self.title_str = title_str
        self.total = max(int(total_steps), 1)
        W = config.frame_width
        self._x0 = -W / 2
        self._W = W
        self._y = -config.frame_height / 2 + 0.06
        self.title = make_3b1b_title(title_str, 30, max_width=W - 4.4).to_edge(UP, buff=0.35).set_z_index(10)
        self._track = Line([-W / 2, self._y, 0], [W / 2, self._y, 0], stroke_width=4, color=B3_GRID).set_z_index(10)
        self._fill = Line([-W / 2, self._y, 0], [-W / 2 + 0.02, self._y, 0],
                          stroke_width=4, color=B3_BLUE).set_z_index(11)
        self._counter = None

    def play_intro(self):
        s = self.scene
        big = make_3b1b_title(self.title_str, 54, max_width=self._W - 2.0).move_to(ORIGIN).set_z_index(10)
        s.play(FadeIn(big[0], shift=UP * 0.25), Create(big[1]), run_time=1.1)
        s.wait(0.7)
        s.play(ReplacementTransform(big, self.title), FadeIn(self._track), FadeIn(self._fill), run_time=1.0)

    def step(self, idx: int):
        """Animations that move the 'Step i of n' counter and progress bar."""
        idx = max(0, min(idx, self.total - 1))
        label = T(f"Step {idx + 1} of {self.total}", font_size=18, color=B3_DIM)
        label.to_corner(UR, buff=0.45).set_z_index(10)
        end_x = self._x0 + self._W * (idx + 1) / self.total
        anims = [self._fill.animate.put_start_and_end_on(
            [self._x0, self._y, 0], [max(end_x, self._x0 + 0.05), self._y, 0])]
        if self._counter is None:
            anims.append(FadeIn(label))
        else:
            anims.append(FadeTransform(self._counter, label))
        self._counter = label
        return anims

    def outro(self, focus=None, label="Result", color=B3_GREEN, hold=2.0, exclude=()):
        s = self.scene
        if focus is not None:
            box = SurroundingRectangle(focus, color=color, buff=0.22, corner_radius=0.12,
                                       stroke_width=2.5).set_z_index(10)
            tag = T(label.upper(), font_size=16, color=color).next_to(box, UP, buff=0.12).align_to(box, LEFT)
            tag.set_z_index(10)
            s.play(Create(box), FadeIn(tag), run_time=0.9)
        s.wait(hold)
        for m in s.mobjects:
            m.clear_updaters()
        targets = [m for m in s.mobjects if m not in exclude]
        if targets:
            s.play(FadeOut(Group(*targets)), run_time=0.9)


def _message_card(scene: Scene, headline: str, detail: str = ""):
    make_3b1b_background(scene)
    head = T(headline, font_size=36, color=B3_WHITE, weight=BOLD)
    grp = VGroup(head)
    if detail:
        grp.add(rich_text(detail, color=B3_DIM, font_size=24, width_chars=70))
    grp.arrange(DOWN, buff=0.4).move_to(ORIGIN)
    scene.play(FadeIn(grp, shift=UP * 0.2), run_time=0.8)
    scene.wait(2.5)


# ══════════════════════════════════════════════════════════════════════════════
# NODE -> CALLABLE, PLOTTING
# ══════════════════════════════════════════════════════════════════════════════

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


def _safe_eval(func, x, default=0.0):
    try:
        y = float(func(x))
        return y if np.isfinite(y) else default
    except Exception:
        return default


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


def safe_plot(axes, func, x_range=(-3.0, 3.0), color=B3_BLUE, stroke_width=3.5, y_clip=None, samples=400):
    """
    Plot func and cut the curve where it leaves the visible y-range
    (no flat 'clamped' lines along the top/bottom of the axes).
    """
    if y_clip is None:
        y_clip = _auto_y_range(func, x_range[0], x_range[1])
    lo, hi = y_clip
    runs, cur = [], []
    for x in np.linspace(x_range[0], x_range[1], samples):
        y = _safe_eval(func, x, default=float("nan"))
        if np.isfinite(y) and lo <= y <= hi:
            cur.append(axes.c2p(x, y))
        else:
            if len(cur) >= 2:
                runs.append(cur)
            cur = []
    if len(cur) >= 2:
        runs.append(cur)
    group = VGroup()
    for pts in runs:
        seg = VMobject(stroke_color=color, stroke_width=stroke_width, fill_opacity=0)
        seg.set_points_smoothly(pts)
        group.add(seg)
    if not len(group):
        group.add(VMobject())
    group.underlying_function = func
    return group


def build_axes(x_min, x_max, y_lo, y_hi, x_length=6.4, y_length=4.3):
    """Axes with clean numbering; the y-range always contains 0."""
    y_lo, y_hi = min(y_lo, 0.0), max(y_hi, 0.0)
    step = _nice_step(y_hi - y_lo)
    y_min = math.floor(y_lo / step) * step
    y_max = math.ceil(y_hi / step) * step
    places = 0 if step >= 1 else 1
    axes = Axes(
        x_range=[x_min, x_max, 1], y_range=[y_min, y_max, step],
        x_length=x_length, y_length=y_length,
        axis_config={"color": B3_DIM, "stroke_width": 2.0, "include_tip": False,
                     "include_numbers": True, "font_size": 18},
        x_axis_config={"numbers_to_exclude": [0], "decimal_number_config": {"num_decimal_places": 0}},
        y_axis_config={"numbers_to_exclude": [0], "decimal_number_config": {"num_decimal_places": places}},
    )
    return axes, y_min, y_max


# ══════════════════════════════════════════════════════════════════════════════
# MAIN SCENE
# ══════════════════════════════════════════════════════════════════════════════

class UniversalMathAnimation(Scene):
    _played = False

    def play(self, *args, **kwargs):
        self._played = True
        return super().play(*args, **kwargs)

    def construct(self):
        try:
            self._dispatch()
        except Exception:
            _log_error("scene")
        if not self._played:
            _message_card(self, "We couldn't visualize this one",
                          "Check the expression and try again.")

    def _dispatch(self):
        input_str    = os.environ.get("MATH_EXPR", "x^2 + 3*x")
        problem_type = os.environ.get("MATH_OP", "derivative")
        method_id    = os.environ.get("MATH_METHOD_ID", "").strip()
        method_name  = os.environ.get("MATH_METHOD_NAME", "").strip()

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
            except Exception:
                _log_error(f"method '{method_id}'")

        if problem_type == "matrix":
            self.render_linear_algebra_3b1b(input_str)
        elif problem_type == "derivative":
            self.render_derivative_3b1b(input_str)
        elif problem_type == "integral":
            self.render_integral_3b1b(input_str)
        elif problem_type == "trigonometry":
            import trigonometry
            title_str, steps = trigonometry.solve_trigonometry(input_str)
            self.render_math_steps(steps, title_str)
        elif problem_type == "statistics":
            title_str, steps = stats_engine.solve_statistics(input_str)
            self.render_math_steps(steps, title_str)
        elif problem_type == "geometry":
            title_str, steps = geometry.solve_geometry(input_str)
            self.render_geometry(steps, title_str)
        else:
            from main import solve_algebra
            _, steps = solve_algebra(input_str)
            self.render_math_steps(steps, f"Solving: {input_str}")

    # ══════════════════════════════════════════════════════════════════════════
    # DERIVATIVE
    # ══════════════════════════════════════════════════════════════════════════

    def render_derivative_3b1b(self, input_str: str):
        """
        Tangent line slides along f(x) with a live slope triangle and readout,
        the symbolic steps appear on the right, and finally f'(x) is traced.
        """
        from main import parse_expr
        try:
            node = parse_expr(input_str)
            orig_node = node
            soln_node, steps = derivative.derive(node)
            steps = filter_derivative_steps(steps)
        except Exception:
            _log_error("derivative parse")
            return

        make_3b1b_background(self)
        chrome = Chrome(self, "The Derivative: Rate of Change", len(steps) + 1)
        chrome.play_intro()

        func = node_to_function(orig_node)
        dfunc = node_to_function(soln_node)

        # one y-range that also fits f' when that is reasonable
        lo_f, hi_f = _auto_y_range(func, -3.0, 3.0)
        lo_d, hi_d = _auto_y_range(dfunc, -3.0, 3.0)
        y_lo, y_hi = lo_f, hi_f
        if (max(hi_f, hi_d) - min(lo_f, lo_d)) <= 3 * (hi_f - lo_f):
            y_lo, y_hi = min(lo_f, lo_d), max(hi_f, hi_d)

        X_MIN, X_MAX = -3.2, 3.2
        axes, y_min, y_max = build_axes(X_MIN, X_MAX, y_lo, y_hi)
        axes.move_to(AXES_CENTER)
        clip = (y_min, y_max)

        curve_f = safe_plot(axes, func, (-3.0, 3.0), B3_BLUE, 3.6, y_clip=clip)
        f_label = fit(MathTex(rf"f(x) = {ml_to_latex(orig_node)}", font_size=30, color=B3_BLUE), 3.2, 0.6)
        f_label.move_to([0, 2.65, 0]).align_to(axes, LEFT)

        self.play(Create(axes), run_time=0.8)
        self.play(Create(curve_f), FadeIn(f_label), run_time=1.3)

        # ── live tangent geometry, all driven by one tracker ─────────────────
        x_t = ValueTracker(1.0)

        def slope(x):
            return (_safe_eval(func, x + 1e-3) - _safe_eval(func, x - 1e-3)) / 2e-3

        def geom():
            x = x_t.get_value()
            y = _safe_eval(func, x)
            m = slope(x)
            h = 1.2
            if abs(m) > 1e-6:
                h = min(h, abs(min(y_max - y, y - y_min) / m))
            h = min(h, X_MAX - x, x - X_MIN)
            visible = (y_min <= y <= y_max) and h > 0.12
            dx = max(min(0.6, X_MAX - x - 0.1), 0.15)
            return x, y, m, max(h, 0.12), dx, visible

        def vis(mob, v):
            return mob if v else mob.set_opacity(0)

        def make_tangent():
            x, y, m, h, dx, v = geom()
            return vis(Line(axes.c2p(x - h, y - m * h), axes.c2p(x + h, y + m * h),
                            color=B3_YELLOW, stroke_width=3.5), v)

        def make_dot():
            x, y, m, h, dx, v = geom()
            return vis(Dot(axes.c2p(x, y), radius=0.07, color=B3_YELLOW), v)

        def make_dx_line():
            x, y, m, h, dx, v = geom()
            ok = v and y_min <= y + m * dx <= y_max
            return vis(Line(axes.c2p(x, y), axes.c2p(x + dx, y), color=B3_TEAL, stroke_width=3), ok)

        def make_df_line():
            x, y, m, h, dx, v = geom()
            ok = v and y_min <= y + m * dx <= y_max
            return vis(Line(axes.c2p(x + dx, y), axes.c2p(x + dx, y + m * dx), color=B3_RED, stroke_width=3), ok)

        tangent = always_redraw(make_tangent)
        pt_dot = always_redraw(make_dot)
        dx_line = always_redraw(make_dx_line)
        df_line = always_redraw(make_df_line)

        dx_lbl = MathTex(r"dx", font_size=24, color=B3_TEAL)
        df_lbl = MathTex(r"df", font_size=24, color=B3_RED)

        def upd_dx(lbl):
            x, y, m, h, dx, v = geom()
            lbl.move_to(axes.c2p(x + dx / 2, y) + DOWN * 0.24)
            lbl.set_opacity(1 if (v and y_min <= y + m * dx <= y_max) else 0)

        def upd_df(lbl):
            x, y, m, h, dx, v = geom()
            lbl.move_to(axes.c2p(x + dx, y + m * dx / 2) + RIGHT * 0.3)
            lbl.set_opacity(1 if (v and y_min <= y + m * dx <= y_max) else 0)

        dx_lbl.add_updater(upd_dx)
        df_lbl.add_updater(upd_df)

        slope_lbl = MathTex(r"\text{slope}\;=", font_size=34, color=B3_YELLOW)
        slope_num = DecimalNumber(slope(1.0), num_decimal_places=2, font_size=40, color=B3_YELLOW)
        slope_num.add_updater(lambda d: d.set_value(slope(x_t.get_value())).next_to(slope_lbl, RIGHT, buff=0.2))
        readout = VGroup(slope_lbl, slope_num).arrange(RIGHT, buff=0.2).move_to([PANEL_X, 2.0, 0])

        cap = make_3b1b_annotation(
            r"At each point, the derivative is the slope of the tangent line: $\dfrac{df}{dx}$", color=B3_YELLOW)
        self.play(*chrome.step(0), FadeIn(cap, shift=UP * 0.1), Create(tangent), FadeIn(pt_dot),
                  Create(dx_line), Create(df_line), FadeIn(dx_lbl), FadeIn(df_lbl),
                  FadeIn(readout), run_time=1.3)
        self.wait(1.0)

        for target, rt in ((-1.5, 1.6), (2.2, 2.6), (1.0, 1.2)):
            self.play(x_t.animate.set_value(target), run_time=rt, rate_func=smooth)
        self.wait(0.4)

        # ── symbolic steps in the right panel ────────────────────────────────
        panel_cur, cap_cur = None, cap
        for i, step in enumerate(steps):
            rule = detect_rule(step.description)
            color = RULE_COLORS.get(rule, B3_GOLD) if rule else B3_GOLD
            eq = place_panel(build_step_mobject(step, color), y=-0.15)
            new_cap = make_3b1b_annotation(step.description, color=color)
            anims = chrome.step(i + 1) + swap(cap_cur, new_cap)
            anims += swap(panel_cur, eq) if panel_cur is not None else [FadeIn(eq, shift=UP * 0.15)]
            self.play(*anims, run_time=0.9)
            if rule:
                self.play(Indicate(eq, color=color, scale_factor=1.04), run_time=0.6)
            self.wait(reading_time(step.description))
            panel_cur, cap_cur = eq, new_cap

        # ── reveal f'(x) and let a dot ride on it ────────────────────────────
        curve_fp = safe_plot(axes, dfunc, (-3.0, 3.0), B3_YELLOW, 3.6, y_clip=clip)
        fp_label = fit(MathTex(rf"f'(x) = {ml_to_latex(soln_node)}", font_size=30, color=B3_YELLOW), 3.2, 0.6)
        fp_label.move_to([0, 2.65, 0]).align_to(axes, RIGHT)
        final_cap = make_3b1b_annotation(
            r"Plotting the slope at every $x$ traces out a new function: $f'(x)$.", color=B3_GREEN)

        def make_rider():
            x = x_t.get_value()
            y = _safe_eval(dfunc, x)
            d = Dot(axes.c2p(x, y), radius=0.08, color=B3_YELLOW)
            return d if y_min <= y <= y_max else d.set_opacity(0)

        rider = always_redraw(make_rider)
        self.play(Create(curve_fp), FadeIn(fp_label), *swap(cap_cur, final_cap), run_time=1.6)
        self.add(rider)
        for target, rt in ((-1.8, 2.0), (2.2, 3.0)):
            self.play(x_t.animate.set_value(target), run_time=rt, rate_func=smooth)
        chrome.outro(focus=panel_cur, label="f′(x)")

    # ══════════════════════════════════════════════════════════════════════════
    # INTEGRAL
    # ══════════════════════════════════════════════════════════════════════════

    def render_integral_3b1b(self, input_str: str):
        """Riemann rectangles -> thinner rectangles -> exact area, then the symbolic steps."""
        from main import parse_expr
        try:
            clean_expr = input_str
            if clean_expr.lower().startswith('integrate(') and clean_expr.endswith(')'):
                clean_expr = clean_expr[10:-1]
            node = parse_expr(clean_expr)
            soln_node, steps = integral.integrate_node(node)
            steps = filter_derivative_steps(steps) if steps else []
        except Exception:
            _log_error("integral parse")
            return

        make_3b1b_background(self)
        chrome = Chrome(self, "Integration: Accumulating Area", 3 + len(steps))
        chrome.play_intro()

        func = node_to_function(node)
        F = node_to_function(soln_node)
        y_lo, y_hi = _auto_y_range(func, -1.0, 3.2)
        axes, y_min, y_max = build_axes(-1.0, 3.2, y_lo, y_hi, x_length=6.2)
        axes.move_to(AXES_CENTER)
        clip = (y_min, y_max)

        curve = safe_plot(axes, func, (-0.9, 3.2), B3_BLUE, 3.6, y_clip=clip)
        f_label = fit(MathTex(rf"f(x) = {ml_to_latex(node)}", font_size=30, color=B3_BLUE), 5.6, 0.6)
        f_label.move_to([0, 2.65, 0]).align_to(axes, LEFT)
        self.play(Create(axes), run_time=0.8)
        self.play(Create(curve), FadeIn(f_label), run_time=1.3)

        a, b = 0.0, 2.0

        def clamp_y(y):
            return min(max(y, y_min), y_max)

        def rectangles(dx, color, opacity):
            n = max(int(round((b - a) / dx)), 1)
            w = (b - a) / n
            rects, total = VGroup(), 0.0
            for k in range(n):
                xk = a + k * w
                h = _safe_eval(func, xk)
                total += h * w
                rect = Polygon(axes.c2p(xk, 0), axes.c2p(xk + w, 0),
                               axes.c2p(xk + w, clamp_y(h)), axes.c2p(xk, clamp_y(h)),
                               fill_color=color, fill_opacity=opacity,
                               stroke_color=B3_WHITE, stroke_width=1.0)
                rects.add(rect)
            return rects, total

        def area_shape():
            xs = np.linspace(a, b, 90)
            pts = [axes.c2p(a, 0)] + [axes.c2p(x, clamp_y(_safe_eval(func, x))) for x in xs] + [axes.c2p(b, 0)]
            return Polygon(*pts, fill_color=B3_BLUE, fill_opacity=0.45, stroke_width=0)

        brace = BraceBetweenPoints(axes.c2p(a, 0), axes.c2p(b, 0), DOWN, buff=0.35)
        brace_lbl = MathTex(r"[a,\,b]", font_size=24, color=B3_TEAL).next_to(brace, DOWN, buff=0.08)

        # phase 1
        rects1, s1 = rectangles(0.5, B3_TEAL, 0.55)
        sum1 = MathTex(rf"\sum f(x_i)\,\Delta x \approx {s1:.3f}", font_size=40, color=B3_TEAL)
        sum1 = place_panel(sum1, y=0.5)
        cap1 = make_3b1b_annotation(r"Approximate the area with rectangles: $\sum f(x_i)\,\Delta x$", color=B3_TEAL)
        self.play(*chrome.step(0), Create(rects1), FadeIn(brace), FadeIn(brace_lbl),
                  FadeIn(cap1, shift=UP * 0.1), FadeIn(sum1), run_time=1.4)
        self.wait(2.0)

        # phase 2
        rects2, s2 = rectangles(0.1, B3_GREEN, 0.6)
        sum2 = place_panel(MathTex(rf"\sum f(x_i)\,\Delta x \approx {s2:.3f}", font_size=40, color=B3_GREEN), y=0.5)
        cap2 = make_3b1b_annotation(r"Thinner rectangles: as $\Delta x \to 0$ the sum approaches the exact area.",
                                    color=B3_GREEN)
        self.play(*chrome.step(1), *swap(rects1, rects2), *swap(sum1, sum2), *swap(cap1, cap2), run_time=1.2)
        self.wait(2.0)

        # phase 3
        area = area_shape()
        try:
            exact = F(b) - F(a)
            result = MathTex(rf"\int_{{0}}^{{2}} f(x)\,dx = {exact:.3f}", font_size=40, color=B3_YELLOW)
        except Exception:
            result = MathTex(r"\int_{0}^{2} f(x)\,dx", font_size=40, color=B3_YELLOW)
        result = place_panel(result, y=0.5)
        cap3 = make_3b1b_annotation(r"In the limit, the sum is the definite integral $\int_a^b f(x)\,dx$.",
                                    color=B3_YELLOW)
        self.play(*chrome.step(2), *swap(rects2, area), *swap(sum2, result), *swap(cap2, cap3), run_time=1.2)
        self.wait(2.0)

        # symbolic steps
        panel_cur, cap_cur = result, cap3
        for i, step in enumerate(steps):
            rule = detect_rule(step.description)
            color = RULE_COLORS.get(rule, B3_GREEN) if rule else B3_GREEN
            eq = place_panel(build_step_mobject(step, color), y=0.2)
            new_cap = make_3b1b_annotation(step.description, color=color)
            self.play(*chrome.step(3 + i), *swap(panel_cur, eq), *swap(cap_cur, new_cap), run_time=0.9)
            self.wait(reading_time(step.description))
            panel_cur, cap_cur = eq, new_cap

        chrome.outro(focus=panel_cur, label="Result")

    # ══════════════════════════════════════════════════════════════════════════
    # LINEAR ALGEBRA
    # ══════════════════════════════════════════════════════════════════════════

    def render_linear_algebra_3b1b(self, input_str: str):
        """
        Basis vectors and a unit square ride a grid that is warped by A.
        The grid lives in a framed viewport so the warped lines never spill onto the text.
        """
        make_3b1b_background(self)

        matrices = re.findall(r'\[\[.*?\]\]|\[.*?\]', input_str)
        a, b, c, d = 1.5, 0.5, 0.5, 1.2
        if matrices:
            try:
                raw = ast.literal_eval(matrices[0])
                if len(raw) >= 2 and len(raw[0]) >= 2:
                    a, b, c, d = float(raw[0][0]), float(raw[0][1]), float(raw[1][0]), float(raw[1][1])
            except Exception:
                pass
        det_val = a * d - b * c
        M = [[a, b], [c, d]]

        chrome = Chrome(self, "Linear Transformations: How Space Warps", 4)
        chrome.play_intro()

        # viewport + masks (so warped grid lines are cropped cleanly)
        VW, VH = 7.0, 4.9
        VC = np.array([-3.15, 0.1, 0.0])
        left, right = VC[0] - VW / 2, VC[0] + VW / 2
        top, bottom = VC[1] + VH / 2, VC[1] - VH / 2
        W, H = config.frame_width, config.frame_height
        masks = VGroup(
            Rectangle(width=W + 2, height=3, fill_color=B3_BG, fill_opacity=1, stroke_width=0).move_to([0, top + 1.5, 0]),
            Rectangle(width=W + 2, height=3, fill_color=B3_BG, fill_opacity=1, stroke_width=0).move_to([0, bottom - 1.5, 0]),
            Rectangle(width=3, height=H + 2, fill_color=B3_BG, fill_opacity=1, stroke_width=0).move_to([left - 1.5, 0, 0]),
            Rectangle(width=8, height=H + 2, fill_color=B3_BG, fill_opacity=1, stroke_width=0).move_to([right + 4, 0, 0]),
        ).set_z_index(1)
        border = Rectangle(width=VW, height=VH, stroke_color=B3_GRID, stroke_width=1.8,
                           fill_opacity=0).move_to(VC).set_z_index(2)
        self.add(masks, border)

        # equal-unit scale chosen so the transformed square stays inside the viewport
        pts = [(1, 0), (0, 1), (1, 1), (a, c), (b, d), (a + b, c + d)]
        X = max(abs(p[0]) for p in pts)
        Y = max(abs(p[1]) for p in pts)
        u = min(VW / 2 / (X + 0.7), VH / 2 / (Y + 0.7), 0.95)
        N = 14

        def make_plane(line_color, opacity, width):
            return NumberPlane(
                x_range=[-N, N, 1], y_range=[-N, N, 1], x_length=2 * N * u, y_length=2 * N * u,
                faded_line_ratio=0,
                background_line_style={"stroke_color": line_color, "stroke_width": width, "stroke_opacity": opacity},
                axis_config={"color": B3_DIM, "stroke_width": 2.2, "stroke_opacity": min(1.0, opacity + 0.35)},
            ).move_to(VC)

        ghost = make_plane(B3_DIM, 0.16, 1.0)
        plane = make_plane(B3_BLUE, 0.6, 1.6)
        O = plane.c2p(0, 0)

        def arrow(end, color):
            end_pt = plane.c2p(*end)
            if np.linalg.norm(end_pt - O) < 1e-3:
                return Dot(O, color=color, radius=0.06)
            return Arrow(O, end_pt, buff=0, color=color, stroke_width=5)

        i_vec, j_vec = arrow((1, 0), B3_GREEN), arrow((0, 1), B3_RED)
        i_lbl = MathTex(r"\hat{\imath}", font_size=30, color=B3_GREEN).next_to(plane.c2p(1, 0), DR, buff=0.08)
        j_lbl = MathTex(r"\hat{\jmath}", font_size=30, color=B3_RED).next_to(plane.c2p(0, 1), UL, buff=0.08)
        unit_sq = Polygon(plane.c2p(0, 0), plane.c2p(1, 0), plane.c2p(1, 1), plane.c2p(0, 1),
                          fill_color=B3_YELLOW, fill_opacity=0.35, stroke_color=B3_YELLOW, stroke_width=2)

        mat = Matrix([[_fmt_num(a), _fmt_num(b)], [_fmt_num(c), _fmt_num(d)]], h_buff=1.2, v_buff=0.9)
        mat.get_columns()[0].set_color(B3_GREEN)
        mat.get_columns()[1].set_color(B3_RED)
        mat_lbl = MathTex("A=", font_size=48, color=B3_WHITE)
        mat_grp = VGroup(mat_lbl, mat).arrange(RIGHT, buff=0.3).scale(0.95).move_to([PANEL_X, 1.35, 0]).set_z_index(10)

        # step 1: the basis
        cap1 = make_3b1b_annotation(
            r"The plane is built from two basis vectors: $\hat{\imath}$ (green) and $\hat{\jmath}$ (red). "
            r"The unit square has area 1.", color=B3_BLUE)
        self.play(*chrome.step(0), FadeIn(ghost), FadeIn(plane), run_time=1.0)
        self.play(Create(unit_sq), GrowArrow(i_vec) if isinstance(i_vec, Arrow) else FadeIn(i_vec),
                  GrowArrow(j_vec) if isinstance(j_vec, Arrow) else FadeIn(j_vec),
                  FadeIn(i_lbl), FadeIn(j_lbl), FadeIn(cap1, shift=UP * 0.1), run_time=1.2)
        self.wait(3.0)

        # step 2: the matrix
        cap2 = make_3b1b_annotation(r"Each column of $A$ records where a basis vector will land.", color=B3_GREEN)
        self.play(*chrome.step(1), FadeIn(mat_grp, shift=LEFT * 0.2), *swap(cap1, cap2), run_time=1.0)
        self.play(Indicate(mat.get_columns()[0], color=B3_GREEN), Indicate(mat.get_columns()[1], color=B3_RED),
                  run_time=1.0)
        self.wait(1.2)

        # step 3: warp space
        new_i, new_j = arrow((a, c), B3_GREEN), arrow((b, d), B3_RED)
        cap3 = make_3b1b_annotation(
            "The whole grid follows: lines stay parallel and evenly spaced, and the origin stays fixed.",
            color=B3_YELLOW)
        self.play(
            *chrome.step(2),
            plane.animate.apply_matrix(M, about_point=O),
            unit_sq.animate.apply_matrix(M, about_point=O),
            Transform(i_vec, new_i), Transform(j_vec, new_j),
            i_lbl.animate.next_to(plane.c2p(a, c), DR, buff=0.08),
            j_lbl.animate.next_to(plane.c2p(b, d), UL, buff=0.08),
            *swap(cap2, cap3),
            run_time=2.4, rate_func=smooth,
        )
        self.wait(1.5)

        # step 4: determinant
        det_eq = MathTex(
            rf"\det(A) = ({_fmt_num(a)})({_fmt_num(d)}) - ({_fmt_num(b)})({_fmt_num(c)}) = {det_val:.2f}",
            font_size=36, color=B3_YELLOW)
        det_eq = fit(det_eq, PANEL_W, 0.9).next_to(mat_grp, DOWN, buff=0.6).set_z_index(10)
        if abs(det_val) < 1e-9:
            msg = r"$\det(A)=0$: the plane collapses onto a line, so $A$ has no inverse."
        elif det_val < 0:
            msg = (r"$\det(A)<0$: space is flipped (orientation reverses) and areas scale by "
                   rf"$|\det A| = {abs(det_val):.2f}$.")
        else:
            msg = rf"The unit square's area becomes $\det(A) = {det_val:.2f}$: areas scale by this factor."
        cap4 = make_3b1b_annotation(msg, color=B3_YELLOW)
        self.play(*chrome.step(3), FadeIn(det_eq, shift=UP * 0.15), *swap(cap3, cap4), run_time=1.0)
        self.wait(reading_time(msg))
        chrome.outro(focus=det_eq, label="Determinant", exclude=list(masks))

    # ══════════════════════════════════════════════════════════════════════════
    # STEP-BY-STEP DERIVATIONS
    # ══════════════════════════════════════════════════════════════════════════

    def render_math_steps(self, steps, title_str):
        """Equation on the board, one idea per step, rule-colored captions."""
        if not steps:
            return
        make_3b1b_background(self)
        n = len(steps)
        chrome = Chrome(self, title_str, n)
        chrome.play_intro()

        cur_group, cur_cap, last_eq = None, None, None
        for i, step in enumerate(steps):
            rule = detect_rule(step.description)
            is_final = (i == n - 1)
            color = B3_GREEN if is_final else (RULE_COLORS.get(rule, B3_BLUE) if rule else B3_BLUE)

            eq = build_step_mobject(step, color)
            parts = [eq]
            if rule and not is_final:
                parts.insert(0, rule_badge(rule, color))
            group = VGroup(*parts).arrange(DOWN, buff=0.5)
            fit(group, config.frame_width - 2.0, 3.3).move_to([0, 0.35, 0])

            cap = make_3b1b_annotation(step.description, color=color)
            anims = chrome.step(i)
            anims += swap(cur_cap, cap) if cur_cap is not None else [FadeIn(cap, shift=UP * 0.1)]
            anims += swap(cur_group, group) if cur_group is not None else [FadeIn(group, shift=UP * 0.15, scale=0.96)]
            self.play(*anims, run_time=0.9)
            if rule and not is_final:
                self.play(Indicate(eq, color=color, scale_factor=1.04), run_time=0.6)

            self.wait(reading_time(step.description))
            cur_group, cur_cap, last_eq = group, cap, eq

        chrome.outro(focus=last_eq, label="Result")

    # ══════════════════════════════════════════════════════════════════════════
    # GEOMETRY
    # ══════════════════════════════════════════════════════════════════════════

    def render_geometry(self, steps, title_str):
        """Shapes are auto-fitted to the stage with one shared transform, so they never drift or clip."""
        if not steps:
            return
        make_3b1b_background(self)
        chrome = Chrome(self, title_str, len(steps))
        chrome.play_intro()

        COLOR_MAP = {"blue": B3_BLUE, "green": B3_GREEN, "teal": B3_TEAL, "purple": B3_PURPLE,
                     "gold": B3_GOLD, "coral": B3_RED, "red": B3_RED, "yellow": B3_YELLOW,
                     "white": B3_WHITE}

        def p3(p):
            p = list(p)
            return np.array([p[0], p[1], p[2] if len(p) > 2 else 0.0], dtype=float)

        built = []
        for step in steps:
            mobs = VGroup()
            if step.type == "geometry" and isinstance(step.data, dict):
                for sd in step.data.get("shapes", []):
                    col = COLOR_MAP.get(str(sd.get("color", "blue")).lower(), B3_BLUE)
                    kind = sd.get("type")
                    try:
                        if kind == "polygon" and len(sd.get("points", [])) >= 3:
                            poly = Polygon(*[p3(p) for p in sd["points"]], color=col, stroke_width=3)
                            poly.set_fill(col, opacity=sd.get("fill_opacity", 0.2))
                            mobs.add(poly)
                        elif kind == "circle":
                            circ = Circle(radius=sd.get("radius", 1.0), color=col, stroke_width=3)
                            circ.move_to(p3(sd.get("center", ORIGIN))).set_fill(col, opacity=0.15)
                            mobs.add(circ)
                        elif kind == "line":
                            p1 = sd.get("p1", sd.get("start", ORIGIN))
                            p2 = sd.get("p2", sd.get("end", RIGHT))
                            mobs.add(Line(p3(p1), p3(p2), stroke_width=3, color=col))
                    except Exception:
                        _log_error(f"geometry shape {kind}")
            built.append(mobs)

        # one shared fit-to-stage transform across every step
        stage_c, stage_w, stage_h = np.array([0.0, 0.0, 0.0]), config.frame_width - 2.5, 4.3
        filled = [m for m in built if len(m)]
        if filled:
            allg = VGroup(*filled)
            c = allg.get_center()
            bw, bh = max(allg.width, 1e-6), max(allg.height, 1e-6)
            s = min(stage_w / bw, stage_h / bh, 2.5)
            for m in filled:
                m.shift(stage_c - c)
                m.scale(s, about_point=stage_c)

        cur_mobs, cur_cap = None, None
        for i, step in enumerate(steps):
            cap = make_3b1b_annotation(step.description, color=B3_BLUE)
            new_mobs = built[i]
            anims = chrome.step(i)
            anims += swap(cur_cap, cap) if cur_cap is not None else [FadeIn(cap, shift=UP * 0.1)]
            if len(new_mobs):
                if cur_mobs is not None and len(cur_mobs):
                    if len(cur_mobs) == len(new_mobs):
                        anims.append(ReplacementTransform(cur_mobs, new_mobs))
                    else:
                        anims += swap(cur_mobs, new_mobs)
                else:
                    anims.append(Create(new_mobs))
                cur_mobs = new_mobs
            self.play(*anims, run_time=1.1)
            self.wait(reading_time(step.description))
            cur_cap = cap

        chrome.outro(focus=cur_mobs if cur_mobs is not None and len(cur_mobs) else None, label="Result")


# ══════════════════════════════════════════════════════════════════════════════
# STANDALONE SCENE WRAPPERS
# ══════════════════════════════════════════════════════════════════════════════

class MathStepsScene(UniversalMathAnimation):
    def __init__(self, steps: List[MathStep], title_str: str, **kwargs):
        self.steps = steps
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        try:
            self.render_math_steps(self.steps, self.title_str)
        except Exception:
            _log_error("MathStepsScene")
        if not self._played:
            _message_card(self, "Nothing to show", "No steps were produced for this problem.")


class GeometrySolverScene(UniversalMathAnimation):
    def __init__(self, steps: List[MathStep], title_str: str, **kwargs):
        self.steps = steps
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        try:
            self.render_geometry(self.steps, self.title_str)
        except Exception:
            _log_error("GeometrySolverScene")
        if not self._played:
            _message_card(self, "Nothing to show", "No steps were produced for this problem.")


# Output quality: (width, height, fps). Override with MATH_VIDEO_QUALITY or the `quality` argument.
_QUALITY = {"low": (854, 480, 15), "medium": (1280, 720, 30),
            "high": (1920, 1080, 30), "production": (1920, 1080, 60)}


def _prepare_output(output_path: str, quality: str = None):
    output_dir = os.path.dirname(output_path)
    output_file = os.path.basename(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    config.media_dir = output_dir
    config.output_file = output_file
    q = (quality or os.environ.get("MATH_VIDEO_QUALITY", "high")).lower()
    w, h, fps = _QUALITY.get(q, _QUALITY["high"])
    config.pixel_width, config.pixel_height, config.frame_rate = w, h, fps


def generate_solver_video(
    steps: List[MathStep],
    title: str,
    output_path: str,
    scene_class=MathStepsScene,
    quality: str = None,
):
    _prepare_output(output_path, quality)
    scene = scene_class(steps, title)
    scene.render()


# ══════════════════════════════════════════════════════════════════════════════
# WORD PROBLEMS
# ══════════════════════════════════════════════════════════════════════════════

class WordProblemManimScene(Scene):

    def __init__(self, scenes_data, title_str, **kwargs):
        self.scenes_data = scenes_data
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        if not self.scenes_data:
            _message_card(self, "Nothing to show", "No scenes were produced for this problem.")
            return

        make_3b1b_background(self)
        n = len(self.scenes_data)
        chrome = Chrome(self, self.title_str, n)
        chrome.play_intro()

        cur_group, cur_cap, last_math = None, None, None
        for i, sc in enumerate(self.scenes_data):
            parts = []
            phase = sc.get("phase_label", "")
            if phase:
                parts.append(rule_badge(phase, B3_BLUE))
            title_txt = sc.get("title", "")
            if title_txt:
                parts.append(fit(T(title_txt, font_size=38, color=B3_WHITE, weight=BOLD), 11.0, 1.0))
            math_mob = None
            latex_callout = sc.get("latex_callout")
            if latex_callout:
                math_mob = safe_mathtex(latex_callout, color=B3_GOLD, scale=1.2)
                fit(math_mob, 10.5, 1.8)
                parts.append(math_mob)
            if not parts:
                parts.append(T(" "))
            group = VGroup(*parts).arrange(DOWN, buff=0.55).move_to([0, 0.3, 0])
            fit(group, 11.5, 4.2)

            narr = _truncate(sc.get("narration", ""), 220)
            cap = make_3b1b_annotation(narr or " ", color=B3_BLUE)

            anims = chrome.step(i)
            anims += swap(cur_cap, cap) if cur_cap is not None else [FadeIn(cap, shift=UP * 0.1)]
            anims += swap(cur_group, group) if cur_group is not None else [FadeIn(group, shift=UP * 0.15)]
            self.play(*anims, run_time=1.0)
            self.wait(reading_time(narr, lo=2.0))
            cur_group, cur_cap = group, cap
            if math_mob is not None:
                last_math = math_mob

        chrome.outro(focus=last_math, label="Verified")


def render_word_problem_manim(scenes_data: list, title: str, output_path: str, quality: str = None):
    _prepare_output(output_path, quality)
    scene = WordProblemManimScene(scenes_data, title)
    scene.render()


if __name__ == "__main__":
    UniversalMathAnimation().render()