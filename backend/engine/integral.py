import sys
import os
import math
from typing import List, Tuple, Optional, Dict, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from math_models import (
    MathStep, Node, Const, Var, Add, Mul, Pow, Sin, Cos, Tan, Sec, Exp, Ln, Arcsin, Arctan,
    to_string, to_latex, simplify
)

# ──────────────────────────────────────────────
#  AST Helper & Inspection Utilities
# ──────────────────────────────────────────────

def is_const(node: Node) -> Tuple[bool, float]:
    """Check if node represents a numerical constant."""
    if isinstance(node, Const):
        return True, float(node.value)
    if isinstance(node, Mul):
        l_ok, l_val = is_const(node.left)
        r_ok, r_val = is_const(node.right)
        if l_ok and r_ok:
            return True, l_val * r_val
    if isinstance(node, Add):
        l_ok, l_val = is_const(node.left)
        r_ok, r_val = is_const(node.right)
        if l_ok and r_ok:
            return True, l_val + r_val
    if isinstance(node, Pow):
        l_ok, l_val = is_const(node.base)
        if l_ok:
            return True, float(l_val ** node.exp)
    return False, 0.0

def is_var(node: Node) -> bool:
    """Check if node is variable x."""
    return isinstance(node, Var)

def is_linear(node: Node) -> Tuple[bool, float, float]:
    """
    Check if node is a linear expression in x: a*x + b.
    Returns (True, a, b) if linear, else (False, 0.0, 0.0).
    """
    if isinstance(node, Var):
        return True, 1.0, 0.0

    if isinstance(node, Mul):
        c_ok, c_val = is_const(node.left)
        if c_ok and is_var(node.right):
            return True, c_val, 0.0
        c_ok2, c_val2 = is_const(node.right)
        if c_ok2 and is_var(node.left):
            return True, c_val2, 0.0

    if isinstance(node, Add):
        # a*x + b
        l_lin, l_a, l_b = is_linear(node.left)
        r_c, r_val = is_const(node.right)
        if l_lin and r_c:
            return True, l_a, l_b + r_val

        r_lin, r_a, r_b = is_linear(node.right)
        l_c, l_val = is_const(node.left)
        if r_lin and l_c:
            return True, r_a, r_b + l_val

    return False, 0.0, 0.0

def is_quadratic(node: Node) -> Tuple[bool, float, float, float]:
    """
    Check if node is a quadratic expression: a*x^2 + b*x + c.
    Returns (True, a, b, c) if quadratic, else (False, 0.0, 0.0, 0.0).
    """
    if isinstance(node, Pow) and is_var(node.base) and node.exp == 2:
        return True, 1.0, 0.0, 0.0

    if isinstance(node, Mul):
        c_ok, c_val = is_const(node.left)
        if c_ok:
            q_ok, a, b, c = is_quadratic(node.right)
            if q_ok:
                return True, c_val * a, c_val * b, c_val * c
        c_ok2, c_val2 = is_const(node.right)
        if c_ok2:
            q_ok, a, b, c = is_quadratic(node.left)
            if q_ok:
                return True, c_val2 * a, c_val2 * b, c_val2 * c

    if isinstance(node, Add):
        # Case 1: left is quadratic term, right is const/linear
        q_left, a_l, b_l, c_l = is_quadratic(node.left)
        r_c, c_val = is_const(node.right)
        if q_left and r_c:
            return True, a_l, b_l, c_l + c_val

        r_lin, r_a, r_b = is_linear(node.right)
        if q_left and r_lin:
            return True, a_l, b_l + r_a, c_l + r_b

        # Case 2: right is quadratic term, left is const/linear
        q_right, a_r, b_r, c_r = is_quadratic(node.right)
        l_c, c_val2 = is_const(node.left)
        if q_right and l_c:
            return True, a_r, b_r, c_r + c_val2

        l_lin, l_a, l_b = is_linear(node.left)
        if q_right and l_lin:
            return True, a_r, b_r + l_a, c_r + l_b

    return False, 0.0, 0.0, 0.0

def eval_node(node: Node, x_val: float) -> float:
    """Evaluate mathematical expression at a specific numerical x value."""
    if isinstance(node, Const):
        return float(node.value)
    if isinstance(node, Var):
        return float(x_val)
    if isinstance(node, Add):
        return eval_node(node.left, x_val) + eval_node(node.right, x_val)
    if isinstance(node, Mul):
        return eval_node(node.left, x_val) * eval_node(node.right, x_val)
    if isinstance(node, Pow):
        base_v = eval_node(node.base, x_val)
        return float(base_v ** node.exp)
    if isinstance(node, Sin):
        return math.sin(eval_node(node.inner, x_val))
    if isinstance(node, Cos):
        return math.cos(eval_node(node.inner, x_val))
    if isinstance(node, Tan):
        return math.tan(eval_node(node.inner, x_val))
    if isinstance(node, Sec):
        return 1.0 / math.cos(eval_node(node.inner, x_val))
    if isinstance(node, Exp):
        return math.exp(eval_node(node.inner, x_val))
    if isinstance(node, Ln):
        inner_v = eval_node(node.inner, x_val)
        return math.log(abs(inner_v)) if inner_v != 0 else -1e9
    if isinstance(node, Arcsin):
        return math.asin(eval_node(node.inner, x_val))
    if isinstance(node, Arctan):
        return math.atan(eval_node(node.inner, x_val))
    raise TypeError(f"Cannot evaluate node: {type(node)}")


# ──────────────────────────────────────────────
#  1. Basic Rules & Inversion Engine
# ──────────────────────────────────────────────

def integrate_basic_rules(node: Node) -> Tuple[Optional[Node], List[MathStep]]:
    steps = []

    # Constant rule: \int c dx = c*x
    if isinstance(node, Const):
        res = simplify(Mul(Const(node.value), Var()))
        steps.append(MathStep(f"Apply constant rule to {to_string(node)}", to_latex(res), "equation", data=node))
        return res, steps

    # Variable rule: \int x dx = 0.5*x^2
    if isinstance(node, Var):
        res = Mul(Const(0.5), Pow(Var(), 2))
        steps.append(MathStep("Apply variable power rule to x", to_latex(res), "equation", data=node))
        return res, steps

    # Sum rule: \int (f(x) + g(x)) dx = \int f(x) dx + \int g(x) dx
    if isinstance(node, Add):
        left_i, left_steps = integrate_node(node.left)
        right_i, right_steps = integrate_node(node.right)
        steps.extend(left_steps)
        steps.extend(right_steps)
        res = simplify(Add(left_i, right_i))
        steps.append(MathStep(f"Apply sum rule to {to_string(node)}", to_latex(res), "equation", data=node))
        return res, steps

    # Constant multiple rule: \int c*f(x) dx = c*\int f(x) dx
    if isinstance(node, Mul):
        if isinstance(node.left, Const):
            c = node.left.value
            inner_i, inner_steps = integrate_node(node.right)
            steps.extend(inner_steps)
            res = simplify(Mul(Const(c), inner_i))
            steps.append(MathStep(f"Pull out constant {c}", to_latex(res), "equation", data=node))
            return res, steps
        elif isinstance(node.right, Const):
            c = node.right.value
            inner_i, inner_steps = integrate_node(node.left)
            steps.extend(inner_steps)
            res = simplify(Mul(Const(c), inner_i))
            steps.append(MathStep(f"Pull out constant {c}", to_latex(res), "equation", data=node))
            return res, steps

    # Power rule: \int x^n dx = x^(n+1)/(n+1) or ln(x) if n == -1
    if isinstance(node, Pow) and isinstance(node.base, Var):
        n = node.exp
        if n == -1:
            res = Ln(Var())
            steps.append(MathStep("Apply reciprocal power rule: \\int x^{-1} dx = \\ln|x|", to_latex(res), "equation", data=node))
            return res, steps

        res = simplify(Mul(Const(1.0 / (n + 1.0)), Pow(Var(), n + 1)))
        steps.append(MathStep(f"Apply power rule to {to_string(node)}", to_latex(res), "equation", data=node))
        return res, steps

    # Sine rule: \int sin(x) dx = -cos(x)
    if isinstance(node, Sin) and isinstance(node.inner, Var):
        res = Mul(Const(-1.0), Cos(Var()))
        steps.append(MathStep("Basic trig integral: \\int \\sin(x) dx = -\\cos(x)", to_latex(res), "equation", data=node))
        return res, steps

    # Cosine rule: \int cos(x) dx = sin(x)
    if isinstance(node, Cos) and isinstance(node.inner, Var):
        res = Sin(Var())
        steps.append(MathStep("Basic trig integral: \\int \\cos(x) dx = \\sin(x)", to_latex(res), "equation", data=node))
        return res, steps

    # Tangent rule: \int tan(x) dx = -ln|cos(x)|
    if isinstance(node, Tan) and isinstance(node.inner, Var):
        res = Mul(Const(-1.0), Ln(Cos(Var())))
        steps.append(MathStep("Trig integral: \\int \\tan(x) dx = -\\ln|\\cos(x)|", to_latex(res), "equation", data=node))
        return res, steps

    # Exponential rule: \int e^x dx = e^x
    if isinstance(node, Exp) and isinstance(node.inner, Var):
        res = Exp(Var())
        steps.append(MathStep("Exponential rule: \\int e^x dx = e^x", to_latex(res), "equation", data=node))
        return res, steps

    # Logarithm rule: \int ln(x) dx = x*ln(x) - x
    if isinstance(node, Ln) and isinstance(node.inner, Var):
        res = simplify(Add(Mul(Var(), Ln(Var())), Mul(Const(-1.0), Var())))
        steps.append(MathStep("Logarithmic integration: \\int \\ln(x) dx = x \\ln(x) - x", to_latex(res), "equation", data=node))
        return res, steps

    # Inverse trig basic: 1 / (1 + x^2) -> arctan(x)
    if isinstance(node, Pow) and node.exp == -1:
        q_ok, a, b, c = is_quadratic(node.base)
        if q_ok and a == 1.0 and b == 0.0 and c == 1.0:
            res = Arctan(Var())
            steps.append(MathStep("Inverse trig rule: \\int \\frac{1}{1+x^2} dx = \\arctan(x)", to_latex(res), "equation", data=node))
            return res, steps

    return None, []


# ──────────────────────────────────────────────
#  2. u-Substitution Engine
# ──────────────────────────────────────────────

def integrate_u_substitution(node: Node) -> Tuple[Optional[Node], List[MathStep]]:
    steps = []

    # Pattern A: Linear Substitution u = a*x + b in Power / Exp / Trig / Inverse Trig
    # 1. (a*x + b)^n
    if isinstance(node, Pow):
        is_lin, a, b = is_linear(node.base)
        if is_lin and a != 0:
            n = node.exp
            if n == -1:
                res = simplify(Mul(Const(1.0 / a), Ln(node.base)))
                steps.append(MathStep(f"Linear substitution u = {to_string(node.base)}, du = {a} dx", to_latex(res), "equation", data=node))
                return res, steps
            else:
                res = simplify(Mul(Const(1.0 / (a * (n + 1))), Pow(node.base, n + 1)))
                steps.append(MathStep(f"Linear u-substitution for {to_string(node)}: u = {to_string(node.base)}", to_latex(res), "equation", data=node))
                return res, steps

    # 2. e^(a*x + b)
    if isinstance(node, Exp):
        is_lin, a, b = is_linear(node.inner)
        if is_lin and a != 0:
            res = simplify(Mul(Const(1.0 / a), Exp(node.inner)))
            steps.append(MathStep(f"Linear u-substitution u = {to_string(node.inner)}: \\int e^{{{to_string(node.inner)}}} dx = \\frac{{1}}{{{a}}} e^{{{to_string(node.inner)}}}", to_latex(res), "equation", data=node))
            return res, steps

    # 3. sin(a*x + b)
    if isinstance(node, Sin):
        is_lin, a, b = is_linear(node.inner)
        if is_lin and a != 0:
            res = simplify(Mul(Const(-1.0 / a), Cos(node.inner)))
            steps.append(MathStep(f"Linear u-substitution u = {to_string(node.inner)}: \\int \\sin({to_string(node.inner)}) dx = -\\frac{{1}}{{{a}}} \\cos({to_string(node.inner)})", to_latex(res), "equation", data=node))
            return res, steps

    # 4. cos(a*x + b)
    if isinstance(node, Cos):
        is_lin, a, b = is_linear(node.inner)
        if is_lin and a != 0:
            res = simplify(Mul(Const(1.0 / a), Sin(node.inner)))
            steps.append(MathStep(f"Linear u-substitution u = {to_string(node.inner)}: \\int \\cos({to_string(node.inner)}) dx = \\frac{{1}}{{{a}}} \\sin({to_string(node.inner)})", to_latex(res), "equation", data=node))
            return res, steps

    # 5. tan(a*x + b)
    if isinstance(node, Tan):
        is_lin, a, b = is_linear(node.inner)
        if is_lin and a != 0:
            res = simplify(Mul(Const(-1.0 / a), Ln(Cos(node.inner))))
            steps.append(MathStep(f"Linear u-substitution u = {to_string(node.inner)} for tangent", to_latex(res), "equation", data=node))
            return res, steps

    # Pattern B: Derivative Matching  c * x * f(a*x^2 + b)
    if isinstance(node, Mul):
        # Check if one factor is x (or constant * x) and the other is f(a*x^2 + b)
        factor_x = None
        other_term = None

        if is_var(node.left) or (isinstance(node.left, Mul) and is_var(node.left.right)):
            factor_x = node.left
            other_term = node.right
        elif is_var(node.right) or (isinstance(node.right, Mul) and is_var(node.right.right)):
            factor_x = node.right
            other_term = node.left

        if factor_x is not None and other_term is not None:
            # Check for x * e^(a*x^2 + b)
            if isinstance(other_term, Exp):
                q_ok, a, b, c = is_quadratic(other_term.inner)
                if q_ok and a != 0 and b == 0:
                    res = simplify(Mul(Const(1.0 / (2.0 * a)), Exp(other_term.inner)))
                    steps.append(MathStep(f"Substitution u = {to_string(other_term.inner)}, du = {2*a}x dx", to_latex(res), "equation", data=node))
                    return res, steps

            # Check for x * sin(a*x^2 + b)
            if isinstance(other_term, Sin):
                q_ok, a, b, c = is_quadratic(other_term.inner)
                if q_ok and a != 0 and b == 0:
                    res = simplify(Mul(Const(-1.0 / (2.0 * a)), Cos(other_term.inner)))
                    steps.append(MathStep(f"Substitution u = {to_string(other_term.inner)}, du = {2*a}x dx", to_latex(res), "equation", data=node))
                    return res, steps

            # Check for x * cos(a*x^2 + b)
            if isinstance(other_term, Cos):
                q_ok, a, b, c = is_quadratic(other_term.inner)
                if q_ok and a != 0 and b == 0:
                    res = simplify(Mul(Const(1.0 / (2.0 * a)), Sin(other_term.inner)))
                    steps.append(MathStep(f"Substitution u = {to_string(other_term.inner)}, du = {2*a}x dx", to_latex(res), "equation", data=node))
                    return res, steps

            # Check for x * (a*x^2 + b)^n
            if isinstance(other_term, Pow):
                q_ok, a, b, c = is_quadratic(other_term.base)
                if q_ok and a != 0 and b == 0:
                    n = other_term.exp
                    if n == -1:
                        res = simplify(Mul(Const(1.0 / (2.0 * a)), Ln(other_term.base)))
                        steps.append(MathStep(f"Substitution u = {to_string(other_term.base)}, du = {2*a}x dx", to_latex(res), "equation", data=node))
                        return res, steps
                    else:
                        res = simplify(Mul(Const(1.0 / (2.0 * a * (n + 1))), Pow(other_term.base, n + 1)))
                        steps.append(MathStep(f"Substitution u = {to_string(other_term.base)}, du = {2*a}x dx", to_latex(res), "equation", data=node))
                        return res, steps

        # Check for ln(x) / x = ln(x) * x^-1
        if (isinstance(node.left, Ln) and is_var(node.left.inner) and isinstance(node.right, Pow) and is_var(node.right.base) and node.right.exp == -1) or \
           (isinstance(node.right, Ln) and is_var(node.right.inner) and isinstance(node.left, Pow) and is_var(node.left.base) and node.left.exp == -1):
            res = simplify(Mul(Const(0.5), Pow(Ln(Var()), 2)))
            steps.append(MathStep("Substitution u = \\ln(x), du = \\frac{1}{x} dx", to_latex(res), "equation", data=node))
            return res, steps

    return None, []


# ──────────────────────────────────────────────
#  3. Integration by Parts (IBP) Engine
# ──────────────────────────────────────────────

def integrate_by_parts(node: Node) -> Tuple[Optional[Node], List[MathStep]]:
    r"""
    Integration by Parts: \int u dv = u*v - \int v du
    Handles forms: x*e^(ax), x*sin(ax), x*cos(ax), x*ln(x), x^2*e^x.
    """
    steps = []

    if isinstance(node, Mul):
        u_candidate = None
        dv_candidate = None

        # Form 1: x * e^(a*x + b)
        if is_var(node.left) and isinstance(node.right, Exp):
            u_candidate, dv_candidate = node.left, node.right
        elif is_var(node.right) and isinstance(node.left, Exp):
            u_candidate, dv_candidate = node.right, node.left

        if u_candidate is not None and isinstance(dv_candidate, Exp):
            is_lin, a, b = is_linear(dv_candidate.inner)
            if is_lin and a != 0:
                # u = x, dv = e^(ax+b) dx => v = (1/a)e^(ax+b)
                # \int x e^(ax+b) dx = (x/a)e^(ax+b) - (1/a^2)e^(ax+b)
                term1 = Mul(Mul(Const(1.0 / a), Var()), Exp(dv_candidate.inner))
                term2 = Mul(Const(-1.0 / (a * a)), Exp(dv_candidate.inner))
                res = simplify(Add(term1, term2))
                steps.append(MathStep(f"Integration by parts with u = x, dv = e^{{{to_string(dv_candidate.inner)}}} dx", to_latex(res), "equation", data=node))
                return res, steps

        # Form 2: x * sin(a*x + b)
        if is_var(node.left) and isinstance(node.right, Sin):
            u_candidate, dv_candidate = node.left, node.right
        elif is_var(node.right) and isinstance(node.left, Sin):
            u_candidate, dv_candidate = node.right, node.left

        if u_candidate is not None and isinstance(dv_candidate, Sin):
            is_lin, a, b = is_linear(dv_candidate.inner)
            if is_lin and a != 0:
                # u = x, dv = sin(ax+b) dx => v = (-1/a)cos(ax+b)
                # \int = (-x/a)cos(ax+b) + (1/a^2)sin(ax+b)
                term1 = Mul(Mul(Const(-1.0 / a), Var()), Cos(dv_candidate.inner))
                term2 = Mul(Const(1.0 / (a * a)), Sin(dv_candidate.inner))
                res = simplify(Add(term1, term2))
                steps.append(MathStep(f"Integration by parts with u = x, dv = \\sin({to_string(dv_candidate.inner)}) dx", to_latex(res), "equation", data=node))
                return res, steps

        # Form 3: x * cos(a*x + b)
        if is_var(node.left) and isinstance(node.right, Cos):
            u_candidate, dv_candidate = node.left, node.right
        elif is_var(node.right) and isinstance(node.left, Cos):
            u_candidate, dv_candidate = node.right, node.left

        if u_candidate is not None and isinstance(dv_candidate, Cos):
            is_lin, a, b = is_linear(dv_candidate.inner)
            if is_lin and a != 0:
                # u = x, dv = cos(ax+b) dx => v = (1/a)sin(ax+b)
                # \int = (x/a)sin(ax+b) + (1/a^2)cos(ax+b)
                term1 = Mul(Mul(Const(1.0 / a), Var()), Sin(dv_candidate.inner))
                term2 = Mul(Const(1.0 / (a * a)), Cos(dv_candidate.inner))
                res = simplify(Add(term1, term2))
                steps.append(MathStep(f"Integration by parts with u = x, dv = \\cos({to_string(dv_candidate.inner)}) dx", to_latex(res), "equation", data=node))
                return res, steps

        # Form 4: x^n * ln(x)
        pow_term = None
        ln_term = None
        if isinstance(node.left, Pow) and is_var(node.left.base) and isinstance(node.right, Ln) and is_var(node.right.inner):
            pow_term, ln_term = node.left, node.right
        elif isinstance(node.right, Pow) and is_var(node.right.base) and isinstance(node.left, Ln) and is_var(node.left.inner):
            pow_term, ln_term = node.right, node.left
        elif is_var(node.left) and isinstance(node.right, Ln) and is_var(node.right.inner):
            pow_term, ln_term = Pow(Var(), 1), node.right
        elif is_var(node.right) and isinstance(node.left, Ln) and is_var(node.left.inner):
            pow_term, ln_term = Pow(Var(), 1), node.left

        if pow_term is not None and ln_term is not None:
            n = pow_term.exp
            # \int x^n ln(x) dx = \frac{x^{n+1}}{n+1} \ln(x) - \frac{x^{n+1}}{(n+1)^2}
            term1 = Mul(Mul(Const(1.0 / (n + 1.0)), Pow(Var(), n + 1)), Ln(Var()))
            term2 = Mul(Const(-1.0 / ((n + 1.0) ** 2)), Pow(Var(), n + 1))
            res = simplify(Add(term1, term2))
            steps.append(MathStep(f"Integration by parts with u = \\ln(x), dv = x^{{{n}}} dx", to_latex(res), "equation", data=node))
            return res, steps

    return None, []


# ──────────────────────────────────────────────
#  4. Partial Fractions Decomposition Engine
# ──────────────────────────────────────────────

def integrate_partial_fractions(node: Node) -> Tuple[Optional[Node], List[MathStep]]:
    """
    Handles rational functions P(x)/Q(x):
    - 1 / (x^2 + a^2) -> (1/a)*arctan(x/a)
    - 1 / (x^2 - a^2) -> (1/(2a))*ln|(x-a)/(x+a)|
    - (px + q) / (x^2 + a^2) -> (p/2)*ln(x^2+a^2) + (q/a)*arctan(x/a)
    - 1 / ((x-a)*(x-b)) -> Partial fraction decomposition
    """
    steps = []

    # Check for P(x) / Q(x) representation: Pow(Q, -1) or Mul(P, Pow(Q, -1))
    p_node = Const(1.0)
    q_node = None

    if isinstance(node, Pow) and node.exp == -1:
        q_node = node.base
    elif isinstance(node, Mul) and isinstance(node.right, Pow) and node.right.exp == -1:
        p_node = node.left
        q_node = node.right.base
    elif isinstance(node, Mul) and isinstance(node.left, Pow) and node.left.exp == -1:
        p_node = node.right
        q_node = node.left.base

    if q_node is not None:
        # Case A: Quadratic denominator Q(x) = a_q*x^2 + b_q*x + c_q
        q_ok, a_q, b_q, c_q = is_quadratic(q_node)

        if q_ok and a_q != 0 and b_q == 0:
            # Q(x) = a_q*x^2 + c_q
            # Check numerator P(x) = p_val*x + q_val
            p_lin, p_val, q_val = is_linear(p_node)
            if not p_lin:
                p_c, const_val = is_const(p_node)
                if p_c:
                    p_lin, p_val, q_val = True, 0.0, const_val

            if p_lin:
                if c_q > 0:
                    # Form: (p*x + q) / (a*x^2 + c) with c > 0 -> arctan & ln terms
                    # \int p*x / (a*x^2 + c) = (p / (2*a)) * ln(a*x^2 + c)
                    # \int q / (a*x^2 + c) = (q / (sqrt(a*c))) * arctan(sqrt(a/c)*x)
                    k = math.sqrt(c_q / a_q)
                    ln_part = None
                    tan_part = None

                    if p_val != 0:
                        ln_part = Mul(Const(p_val / (2.0 * a_q)), Ln(q_node))

                    if q_val != 0:
                        tan_coeff = q_val / (a_q * k)
                        tan_arg = Mul(Const(1.0 / k), Var()) if k != 1.0 else Var()
                        tan_part = Mul(Const(tan_coeff), Arctan(tan_arg))

                    if ln_part and tan_part:
                        res = simplify(Add(ln_part, tan_part))
                    elif ln_part:
                        res = simplify(ln_part)
                    else:
                        res = simplify(tan_part)

                    steps.append(MathStep(f"Partial fraction integration: \\frac{{{to_string(p_node)}}}{{{to_string(q_node)}}} using \\arctan and \\ln", to_latex(res), "equation", data=node))
                    return res, steps

                elif c_q < 0:
                    # Form: 1 / (x^2 - a^2) -> (1/(2a))*ln|(x-a)/(x+a)|
                    a_val = math.sqrt(-c_q / a_q)
                    if p_val == 0 and q_val == 1.0 and a_q == 1.0:
                        # 1 / (x^2 - a^2)
                        num = Add(Var(), Const(-a_val))
                        den = Add(Var(), Const(a_val))
                        frac = Mul(num, Pow(den, -1))
                        res = simplify(Mul(Const(1.0 / (2.0 * a_val)), Ln(frac)))
                        steps.append(MathStep(f"Partial fractions: \\int \\frac{{1}}{{x^2 - {a_val**2}}} dx = \\frac{{1}}{{{2*a_val}}} \\ln\\left|\\frac{{x-{a_val}}}{{x+{a_val}}}\\right|", to_latex(res), "equation", data=node))
                        return res, steps

        # Case B: Factored denominator Q(x) = (x - a)*(x - b)
        if isinstance(q_node, Mul):
            l_lin, l_a, l_b = is_linear(q_node.left)
            r_lin, r_a, r_b = is_linear(q_node.right)

            if l_lin and r_lin and l_a == 1.0 and r_a == 1.0:
                root_a = -l_b
                root_b = -r_b

                if root_a != root_b:
                    p_lin, p_val, q_val = is_linear(p_node)
                    if not p_lin:
                        p_c, const_val = is_const(p_node)
                        if p_c:
                            p_lin, p_val, q_val = True, 0.0, const_val

                    if p_lin:
                        # A / (x - root_a) + B / (x - root_b)
                        # A = (p*root_a + q) / (root_a - root_b)
                        # B = (p*root_b + q) / (root_b - root_a)
                        coeff_A = (p_val * root_a + q_val) / (root_a - root_b)
                        coeff_B = (p_val * root_b + q_val) / (root_b - root_a)

                        term_A = Mul(Const(coeff_A), Ln(Add(Var(), Const(-root_a))))
                        term_B = Mul(Const(coeff_B), Ln(Add(Var(), Const(-root_b))))
                        res = simplify(Add(term_A, term_B))

                        steps.append(MathStep(f"Partial fraction decomposition: \\frac{{{to_string(p_node)}}}{{({to_string(q_node.left)})({to_string(q_node.right)})}} = \\frac{{{coeff_A:.2f}}}{{{to_string(q_node.left)}}} + \\frac{{{coeff_B:.2f}}}{{{to_string(q_node.right)}}}", to_latex(res), "equation", data=node))
                        return res, steps

    return None, []


# ──────────────────────────────────────────────
#  5. Trigonometric Substitution & Identities Engine
# ──────────────────────────────────────────────

def integrate_trig_sub(node: Node) -> Tuple[Optional[Node], List[MathStep]]:
    """
    Handles trig power reduction & algebraic trig substitution forms:
    - sin^2(x) -> x/2 - sin(2x)/4
    - cos^2(x) -> x/2 + sin(2x)/4
    - tan^2(x) -> tan(x) - x
    - sqrt(a^2 - x^2) -> (x/2)sqrt(a^2-x^2) + (a^2/2)arcsin(x/a)
    """
    steps = []

    # 1. sin^2(x)
    if isinstance(node, Pow) and isinstance(node.base, Sin) and is_var(node.base.inner) and node.exp == 2:
        res = simplify(Add(Mul(Const(0.5), Var()), Mul(Const(-0.25), Sin(Mul(Const(2.0), Var())))))
        steps.append(MathStep("Use trig power reduction identity: \\sin^2(x) = \\frac{1-\\cos(2x)}{2}", to_latex(res), "equation", data=node))
        return res, steps

    # 2. cos^2(x)
    if isinstance(node, Pow) and isinstance(node.base, Cos) and is_var(node.base.inner) and node.exp == 2:
        res = simplify(Add(Mul(Const(0.5), Var()), Mul(Const(0.25), Sin(Mul(Const(2.0), Var())))))
        steps.append(MathStep("Use trig power reduction identity: \\cos^2(x) = \\frac{1+\\cos(2x)}{2}", to_latex(res), "equation", data=node))
        return res, steps

    # 3. tan^2(x)
    if isinstance(node, Pow) and isinstance(node.base, Tan) and is_var(node.base.inner) and node.exp == 2:
        res = simplify(Add(Tan(Var()), Mul(Const(-1.0), Var())))
        steps.append(MathStep("Use trig identity: \\tan^2(x) = \\sec^2(x) - 1", to_latex(res), "equation", data=node))
        return res, steps

    # 4. sqrt(a^2 - x^2) = (a^2 - x^2)^0.5
    if isinstance(node, Pow) and node.exp == 0.5:
        q_ok, a_q, b_q, c_q = is_quadratic(node.base)
        if q_ok and a_q == -1.0 and b_q == 0.0 and c_q > 0:
            a_val = math.sqrt(c_q)
            # (x/2)sqrt(a^2 - x^2) + (a^2/2)arcsin(x/a)
            term1 = Mul(Mul(Const(0.5), Var()), Pow(node.base, 0.5))
            term2 = Mul(Const(0.5 * c_q), Arcsin(Mul(Const(1.0 / a_val), Var())))
            res = simplify(Add(term1, term2))
            steps.append(MathStep(f"Trig substitution x = {a_val:.2f}\\sin(\\theta) for \\sqrt{{{c_q:.2f}-x^2}}", to_latex(res), "equation", data=node))
            return res, steps

    return None, []


# ──────────────────────────────────────────────
#  6. Numerical Methods Engine (Definite Integrals)
# ──────────────────────────────────────────────

def integrate_numerical(node: Node, a: float, b: float, n: int = 100, method: str = 'simpson') -> Tuple[float, List[MathStep]]:
    r"""
    Computes numerical definite integral \int_a^b f(x) dx.
    Methods supported: 'midpoint', 'trapezoidal', 'simpson'.
    """
    steps = []
    if n % 2 != 0 and method == 'simpson':
        n += 1  # Simpson's rule requires an even number of subintervals

    h = (b - a) / n
    method_name = method.capitalize()

    steps.append(MathStep(
        f"Numerical definite integration from x = {a} to x = {b} using {method_name} Rule (n = {n})",
        f"\\int_{{{a}}}^{{{b}}} f(x) dx \\quad \\text{{with }} h = \\frac{{{b} - {a}}}{{{n}}} = {h:.4f}",
        "equation"
    ))

    if method.lower() == 'midpoint':
        total_sum = 0.0
        for i in range(n):
            x_mid = a + (i + 0.5) * h
            y_mid = eval_node(node, x_mid)
            total_sum += y_mid

        integral_val = h * total_sum
        steps.append(MathStep(
            f"Sum midpoint evaluations: S = \\sum_{{i=1}}^{{{n}}} f(x_i^*) = {total_sum:.4f}",
            f"I \\approx h \\cdot S = {h:.4f} \\times {total_sum:.4f} = {integral_val:.6f}",
            "equation"
        ))
        return integral_val, steps

    elif method.lower() == 'trapezoidal':
        y_a = eval_node(node, a)
        y_b = eval_node(node, b)
        sum_interior = 0.0

        for i in range(1, n):
            x_i = a + i * h
            sum_interior += eval_node(node, x_i)

        integral_val = (h / 2.0) * (y_a + 2.0 * sum_interior + y_b)
        steps.append(MathStep(
            f"Interior sum: S_{{int}} = \\sum_{{i=1}}^{{{n-1}}} f(x_i) = {sum_interior:.4f}",
            f"I \\approx \\frac{{{h:.4f}}}{{2}} \\left(f({a}) + 2({sum_interior:.4f}) + f({b})\\right) = {integral_val:.6f}",
            "equation"
        ))
        return integral_val, steps

    else:  # Simpson's Rule (1/3)
        y_a = eval_node(node, a)
        y_b = eval_node(node, b)
        odd_sum = 0.0
        even_sum = 0.0

        for i in range(1, n):
            x_i = a + i * h
            y_i = eval_node(node, x_i)
            if i % 2 == 1:
                odd_sum += y_i
            else:
                even_sum += y_i

        integral_val = (h / 3.0) * (y_a + 4.0 * odd_sum + 2.0 * even_sum + y_b)
        steps.append(MathStep(
            f"Simpson's weighted sums: S_{{odd}} = {odd_sum:.4f}, S_{{even}} = {even_sum:.4f}",
            f"I \\approx \\frac{{{h:.4f}}}{{3}} \\left(f({a}) + 4({odd_sum:.4f}) + 2({even_sum:.4f}) + f({b})\\right) = {integral_val:.6f}",
            "equation"
        ))
        return integral_val, steps


# ──────────────────────────────────────────────
#  Main Integral Engine Dispatcher
# ──────────────────────────────────────────────

def integrate_node(node: Node) -> Tuple[Node, List[MathStep]]:
    """
    Main entry point for symbolic integration.
    Cascades through the 5 symbolic rule engines in order.
    """
    # 1. Basic Rules & Inversion
    res, steps = integrate_basic_rules(node)
    if res is not None:
        return res, steps

    # 2. u-Substitution
    res, steps = integrate_u_substitution(node)
    if res is not None:
        return res, steps

    # 3. Integration by Parts
    res, steps = integrate_by_parts(node)
    if res is not None:
        return res, steps

    # 4. Partial Fractions
    res, steps = integrate_partial_fractions(node)
    if res is not None:
        return res, steps

    # 5. Trigonometric Substitution & Identities
    res, steps = integrate_trig_sub(node)
    if res is not None:
        return res, steps

    raise Exception(f"Unsupported expression for symbolic integration: {to_string(node)}")


if __name__ == "__main__":
    from math_models import parse_expr

    test_exprs = [
        "x^2 + 3*x + sin(x) + e^x",
        "sin(5*x)",
        "x * e^(x^2)",
        "x * e^x",
        "x * sin(x)",
        "ln(x)",
        "1 / (x^2 + 4)",
        "1 / (x^2 - 1)",
        "sin(x)^2",
        "tan(x)",
        "sqrt(4 - x^2)"
    ]

    print("=== Integral Engine Diagnostic Suite ===\n")
    for expr_str in test_exprs:
        print(f"Testing: {expr_str}")
        node = parse_expr(expr_str)
        res, steps = integrate_node(node)
        print("Steps:")
        for s in steps:
            print(f"  - {s.description}: {s.latex}")
        print(f"Result: {to_string(res)} + C\n" + "-"*50)

    # Numerical integration test
    print(r"\nTesting Definite Numerical Integration: \int_0^1 x^2 dx")
    node_num = parse_expr("x^2")
    num_val, num_steps = integrate_numerical(node_num, 0.0, 1.0, n=10, method="simpson")
    print("Numerical Steps:")
    for s in num_steps:
        print(f"  - {s.description}: {s.latex}")
    print(f"Numerical Result: {num_val:.6f}")
