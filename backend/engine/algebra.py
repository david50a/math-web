import sys
import os
import re
import math
import ast
from fractions import Fraction
from typing import List, Tuple, Union, Optional, Dict, Set

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from math_models import MathStep, Node, parse_expr, to_latex, Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln
from derivative import derive

# Regex pattern matching polynomial terms: optional sign, float/int coefficient, variable name, optional exponent
POLYNOMIAL_TERM_PATTERN = re.compile(
    r'([+-]?(?:\d+(?:\.\d+)?|\.\d+)?)(?:([a-zA-Z])(?:\^(\d+))?)?'
)

def fmt_num(num: Union[int, float]) -> str:
    """Format float/int nicely for output display and LaTeX representations."""
    if isinstance(num, int) or abs(num - round(num)) < 1e-9:
        return str(int(round(num)))
    return f"{num:.4g}"

def parse_polynomial(equation: str) -> Tuple[Union[int, float], Union[int, float], Union[int, float], Union[int, float]]:
    """
    Efficiently parses any polynomial equation or expression into coefficients (a, b, c, d)
    corresponding to degree 3, 2, 1, 0 terms: a*x^3 + b*x^2 + c*x + d = 0.
    Handles terms on both sides of '=', arbitrary ordering, integer/float coefficients,
    and combining like terms.
    """
    equation = equation.replace(" ", "")
    if '=' in equation:
        lhs_str, rhs_str = equation.split('=', 1)
    else:
        lhs_str, rhs_str = equation, ""

    deg_map = {}

    def parse_side(side_str: str, sign_multiplier: float = 1.0):
        if not side_str:
            return
        for match in POLYNOMIAL_TERM_PATTERN.finditer(side_str):
            coeff_str, var_name, pow_str = match.groups()
            
            # Skip empty matches
            if not coeff_str and not var_name:
                continue
                
            if coeff_str in ("", "+"):
                coeff = 1.0
            elif coeff_str == "-":
                coeff = -1.0
            else:
                try:
                    coeff = float(coeff_str)
                except ValueError:
                    continue
                    
            coeff *= sign_multiplier
            
            if var_name:
                degree = int(pow_str) if pow_str else 1
            else:
                degree = 0
                
            deg_map[degree] = deg_map.get(degree, 0.0) + coeff

    parse_side(lhs_str, 1.0)
    parse_side(rhs_str, -1.0)

    def simplify_num(val: float):
        if abs(val - round(val)) < 1e-9:
            return int(round(val))
        return round(val, 6)

    a = simplify_num(deg_map.get(3, 0.0))
    b = simplify_num(deg_map.get(2, 0.0))
    c = simplify_num(deg_map.get(1, 0.0))
    d = simplify_num(deg_map.get(0, 0.0))

    return a, b, c, d

def function_value(equation: str, x_val: float) -> Tuple[float, List[MathStep]]:
    steps = []
    
    # Fast path for polynomials using Horner's method
    if not any(fn in equation.lower() for fn in ['sin', 'cos', 'exp', 'log', 'ln', '/']):
        a, b, c, d = parse_polynomial(equation)
        # Horner's scheme: ((a*x + b)*x + c)*x + d
        val = ((a * x_val + b) * x_val + c) * x_val + d
        val_simplified = int(val) if abs(val - int(val)) < 1e-9 else round(val, 6)
        
        steps.append(MathStep(f"Evaluate polynomial at x = {x_val}",
                              rf"f({x_val}) = ({fmt_num(a)})({x_val})^3 + ({fmt_num(b)})({x_val})^2 + ({fmt_num(c)})({x_val}) + ({fmt_num(d)}) = {val_simplified}",
                              "equation"))
        return val_simplified, steps

    # General AST evaluation path
    function = parse_expr(equation)
    def indoor_solver(node: Node, value: float) -> float:
        if isinstance(node, Add):
            left = indoor_solver(node.left, value)
            right = indoor_solver(node.right, value)
            steps.append(MathStep(f"Adding {left} and {right}", to_latex(Add(Const(left), Const(right))), "equation"))
            return left + right
        elif isinstance(node, Mul):
            left = indoor_solver(node.left, value)
            right = indoor_solver(node.right, value)
            steps.append(MathStep(f"Multiplying {left} and {right}", to_latex(Mul(Const(left), Const(right))), "equation"))
            return left * right
        elif isinstance(node, Pow):
            base = indoor_solver(node.base, value)
            steps.append(MathStep(f"Raising {base} to the power of {node.exp}", to_latex(Pow(Const(base), node.exp)), "equation"))
            return base ** node.exp
        elif isinstance(node, Sin):
            inner = indoor_solver(node.inner, value)
            steps.append(MathStep(f"Taking the sine of {inner}", to_latex(Sin(Const(inner))), "equation"))
            return math.sin(inner)
        elif isinstance(node, Cos):
            inner = indoor_solver(node.inner, value)
            steps.append(MathStep(f"Taking the cosine of {inner}", to_latex(Cos(Const(inner))), "equation"))
            return math.cos(inner)
        elif isinstance(node, Exp):
            inner = indoor_solver(node.inner, value)
            steps.append(MathStep(f"Taking the exponential of {inner}", to_latex(Exp(Const(inner))), "equation"))
            return math.exp(inner)
        elif isinstance(node, Ln):
            inner = indoor_solver(node.inner, value)
            steps.append(MathStep(f"Taking the natural logarithm of {inner}", to_latex(Ln(Const(inner))), "equation"))
            return math.log(inner)
        elif isinstance(node, Var):
            steps.append(MathStep(f"Substituting {node.name} with {value}", to_latex(Const(value)), "equation"))
            return value
        elif isinstance(node, Const):
            return node.value
        else:
            return 0.0
    
    return indoor_solver(function, x_val), steps

def derivative_value(equation: str, x_val: float) -> Tuple[float, List[MathStep]]:
    steps = []
    
    # Fast path for polynomials
    if not any(fn in equation.lower() for fn in ['sin', 'cos', 'exp', 'log', 'ln', '/']):
        a, b, c, d = parse_polynomial(equation)
        # Derivative of a*x^3 + b*x^2 + c*x + d is 3a*x^2 + 2b*x + c
        val = (3 * a * x_val + 2 * b) * x_val + c
        val_simplified = int(val) if abs(val - int(val)) < 1e-9 else round(val, 6)
        
        steps.append(MathStep(f"Differentiate polynomial terms",
                              rf"f'(x) = {fmt_num(3*a)}x^2 + {fmt_num(2*b)}x + {fmt_num(c)}", "equation"))
        steps.append(MathStep(f"Substitute x = {x_val} into derivative",
                              rf"f'({x_val}) = {val_simplified}", "equation"))
        return val_simplified, steps

    # General AST derivative path
    ast_expr = parse_expr(equation)
    dx, steps_der = derive(ast_expr)
    steps.extend(steps_der)
    steps.append(MathStep(f"Substituting x with {x_val} to get the value for the derivative", to_latex(Const(x_val)), "equation"))
    
    def indoor_solver(node: Node, value: float) -> float:
        if isinstance(node, Add):
            left = indoor_solver(node.left, value)
            right = indoor_solver(node.right, value)
            steps.append(MathStep(f"Adding {left} and {right}", to_latex(Add(Const(left), Const(right))), "equation"))
            return left + right
        elif isinstance(node, Mul):
            left = indoor_solver(node.left, value)
            right = indoor_solver(node.right, value)
            steps.append(MathStep(f"Multiplying {left} and {right}", to_latex(Mul(Const(left), Const(right))), "equation"))
            return left * right
        elif isinstance(node, Pow):
            base = indoor_solver(node.base, value)
            steps.append(MathStep(f"Raising {base} to the power of {node.exp}", to_latex(Pow(Const(base), node.exp)), "equation"))
            return base ** node.exp
        elif isinstance(node, Sin):
            inner = indoor_solver(node.inner, value)
            steps.append(MathStep(f"Taking the sine of {inner}", to_latex(Sin(Const(inner))), "equation"))
            return math.sin(inner)
        elif isinstance(node, Cos):
            inner = indoor_solver(node.inner, value)
            steps.append(MathStep(f"Taking the cosine of {inner}", to_latex(Cos(Const(inner))), "equation"))
            return math.cos(inner)
        elif isinstance(node, Exp):
            inner = indoor_solver(node.inner, value)
            steps.append(MathStep(f"Taking the exponential of {inner}", to_latex(Exp(Const(inner))), "equation"))
            return math.exp(inner)
        elif isinstance(node, Ln):
            inner = indoor_solver(node.inner, value)
            steps.append(MathStep(f"Taking the natural logarithm of {inner}", to_latex(Ln(Const(inner))), "equation"))
            return math.log(inner)
        elif isinstance(node, Var):
            steps.append(MathStep(f"Substituting {node.name} with {value}", to_latex(Const(value)), "equation"))
            return value
        elif isinstance(node, Const):
            return node.value
        else:
            return 0.0
    
    return indoor_solver(dx, x_val), steps

def get_linear_coeffs(node: Node) -> Tuple[float, float]:
    """Recursively computes (a, b) coefficient pair for linear AST representation: a*x + b."""
    if isinstance(node, Const):
        return 0.0, float(node.value)
    elif isinstance(node, Var):
        return 1.0, 0.0
    elif isinstance(node, Add):
        a1, b1 = get_linear_coeffs(node.left)
        a2, b2 = get_linear_coeffs(node.right)
        return a1 + a2, b1 + b2
    elif isinstance(node, Mul):
        a1, b1 = get_linear_coeffs(node.left)
        a2, b2 = get_linear_coeffs(node.right)
        if a1 != 0 and a2 != 0:
            raise ValueError("Non-linear term: variable multiplied by variable")
        return a1 * b2 + a2 * b1, b1 * b2
    elif isinstance(node, Pow):
        if node.exp == 0:
            return 0.0, 1.0
        elif node.exp == 1:
            return get_linear_coeffs(node.base)
        else:
            a, b = get_linear_coeffs(node.base)
            if a != 0:
                raise ValueError(f"Non-linear term: variable raised to power {node.exp}")
            return 0.0, b ** node.exp
    elif isinstance(node, (Sin, Cos, Exp, Ln)):
        a, b = get_linear_coeffs(node.inner)
        if a != 0:
            raise ValueError(f"Non-linear function operating on variable: {type(node).__name__}")
        if isinstance(node, Sin): val = math.sin(b)
        elif isinstance(node, Cos): val = math.cos(b)
        elif isinstance(node, Exp): val = math.exp(b)
        elif isinstance(node, Ln): val = math.log(b)
        return 0.0, val
    return 0.0, 0.0

def parse_quadratic(equation: str) -> Tuple[Union[int, float], Union[int, float], Union[int, float]]:
    """Extract (a, b, c) quadratic coefficients."""
    _, a, b, c = parse_polynomial(equation)
    return a, b, c

def format_complex_latex(re_part: float, im_part: float) -> str:
    """Format a complex number (re_part + im_part*i) cleanly in LaTeX."""
    re_clean = 0.0 if abs(re_part) < 1e-9 else (int(round(re_part)) if abs(re_part - round(re_part)) < 1e-9 else round(re_part, 4))
    im_clean = 0.0 if abs(im_part) < 1e-9 else (int(round(im_part)) if abs(im_part - round(im_part)) < 1e-9 else round(im_part, 4))
    
    if im_clean == 0:
        return fmt_num(re_clean)
    
    im_abs = abs(im_clean)
    im_str = "i" if abs(im_abs - 1.0) < 1e-9 else f"{fmt_num(im_abs)}i"
    
    if re_clean == 0:
        return im_str if im_clean > 0 else f"-{im_str}"
    
    sign = "+" if im_clean > 0 else "-"
    return f"{fmt_num(re_clean)} {sign} {im_str}"

def quadratic_equation_solver(equation: str, allow_complex: bool = True)-> Tuple[Union[float, complex, Tuple, List], List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    steps.append(MathStep("Rearrange terms to standard form ax^2 + bx + c = 0", f"{equation}", "equation"))
    
    # Efficiently extract coefficients using parse_polynomial
    _, a, b, c = parse_polynomial(equation)
    
    if a == 0:
        if b != 0:
            sol = -c / b
            sol_str = fmt_num(sol)
            steps.append(MathStep("Equation is linear (a = 0)", f"{fmt_num(b)}x + {fmt_num(c)} = 0", "equation"))
            steps.append(MathStep("Solve for x", f"x = {sol_str}", "equation"))
            return sol, steps
        else:
            if c == 0:
                steps.append(MathStep("Equation has infinitely many solutions", r"\text{All real numbers } x", "equation"))
                return float('inf'), steps
            else:
                steps.append(MathStep("Equation has no solution", r"\text{No solution}", "equation"))
                return float('nan'), steps

    a_str = fmt_num(a)
    b_str = fmt_num(b)
    c_str = fmt_num(c)

    # Construct clean LaTeX representation of ax^2 + bx + c = 0
    quad_latex_parts = []
    if a == 1: quad_latex_parts.append("x^2")
    elif a == -1: quad_latex_parts.append("-x^2")
    else: quad_latex_parts.append(f"{a_str}x^2")

    if b > 0: quad_latex_parts.append(f"+ {b_str if b != 1 else ''}x")
    elif b < 0: quad_latex_parts.append(f"- {fmt_num(abs(b)) if abs(b) != 1 else ''}x")

    if c > 0: quad_latex_parts.append(f"+ {c_str}")
    elif c < 0: quad_latex_parts.append(f"- {fmt_num(abs(c))}")

    quad_latex = " ".join(quad_latex_parts) + " = 0"
    steps.append(MathStep("Standard quadratic form", quad_latex, "equation"))

    steps.append(MathStep(f"Identify coefficients: a = {a_str}, b = {b_str}, c = {c_str}", rf"a = {a_str}, \quad b = {b_str}, \quad c = {c_str}", "equation"))
    steps.append(MathStep("Apply the quadratic formula", r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}", "equation"))
    
    delta = b**2 - 4*a*c
    delta_str = fmt_num(delta)
    steps.append(MathStep("Calculate the discriminant D = b^2 - 4ac", rf"D = ({b_str})^2 - 4 \cdot ({a_str}) \cdot ({c_str}) = {delta_str}", "equation"))
    
    if delta < 0:
        if allow_complex:
            re_part = -b / (2 * a)
            im_part = math.sqrt(-delta) / (2 * abs(a))
            sol1_str = format_complex_latex(re_part, im_part)
            sol2_str = format_complex_latex(re_part, -im_part)
            sqrt_abs_delta = math.sqrt(-delta)
            sqrt_delta_str = "i" if abs(sqrt_abs_delta - 1.0) < 1e-9 else f"{fmt_num(sqrt_abs_delta)}i"
            
            steps.append(MathStep("The discriminant is negative (D < 0), yielding complex conjugate solutions",
                                  rf"D = {delta_str} < 0 \implies \sqrt{{D}} = \sqrt{{{delta_str}}} = {sqrt_delta_str}", "equation"))
            steps.append(MathStep("Substitute coefficients into quadratic formula",
                                  rf"x = \frac{{-({b_str}) \pm {sqrt_delta_str}}}{{2 \cdot ({a_str})}}", "equation"))
            steps.append(MathStep("Calculate the two complex roots",
                                  rf"x_1 = {sol1_str}, \quad x_2 = {sol2_str}", "equation"))
            return complex(re_part, im_part), complex(re_part, -im_part), steps
        else:
            steps.append(MathStep("The discriminant is negative (D < 0), so there are no real solutions", r"\text{No real solutions } (D < 0)", "equation"))
            return None, steps
    elif delta == 0:
        steps.append(MathStep("The discriminant is zero (D = 0), so there is exactly one real solution", r"x = \frac{-b}{2a}", "equation"))
        sol = -b / (2*a)
        sol_str = fmt_num(sol)
        steps.append(MathStep("Substitute coefficients into formula", rf"x = \frac{{-({b_str})}}{{2 \cdot ({a_str})}} = {sol_str}", "equation"))
        return sol, steps
    else:
        sqrt_delta = delta**0.5
        sol1 = (-b + sqrt_delta) / (2*a)
        sol2 = (-b - sqrt_delta) / (2*a)
        sol1_str, sol2_str = fmt_num(sol1), fmt_num(sol2)
        
        steps.append(MathStep("Substitute discriminant and coefficients into formula", rf"x = \frac{{-({b_str}) \pm \sqrt{{{delta_str}}}}}{{2 \cdot ({a_str})}}", "equation"))
        steps.append(MathStep("Calculate the two real roots", rf"x_1 = {sol1_str}, \quad x_2 = {sol2_str}", "equation"))
        return sol1, sol2, steps

def completing_the_square(equation: str, allow_complex: bool = True)-> Tuple[Union[float, complex, Tuple, List], List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    a, b, c = parse_quadratic(equation)
    
    if a == 0:
        return quadratic_equation_solver(equation, allow_complex=allow_complex)
        
    a_str, b_str, c_str = fmt_num(a), fmt_num(b), fmt_num(c)
    steps.append(MathStep(f"Identify polynomial coefficients: a = {a_str}, b = {b_str}, c = {c_str}", rf"a = {a_str}, \quad b = {b_str}, \quad c = {c_str}", "equation"))
    steps.append(MathStep("Apply the completing the square method", r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}", "equation"))
    
    delta = b**2 - 4*a*c
    delta_str = fmt_num(delta)
    steps.append(MathStep("Calculate the discriminant D = b^2 - 4ac", rf"D = ({b_str})^2 - 4 \cdot ({a_str}) \cdot ({c_str}) = {delta_str}", "equation"))
    
    if delta < 0:
        if allow_complex:
            re_part = -b / (2 * a)
            im_part = math.sqrt(-delta) / (2 * abs(a))
            sol1_str = format_complex_latex(re_part, im_part)
            sol2_str = format_complex_latex(re_part, -im_part)
            h = -b / (2 * a)
            steps.append(MathStep("Write in completed square form with imaginary unit i",
                                  rf"\left(x - ({fmt_num(h)})\right)^2 = \frac{{{delta_str}}}{{4 \cdot ({a_str})^2}}", "equation"))
            steps.append(MathStep("Take square root on both sides",
                                  rf"x - ({fmt_num(h)}) = \pm {fmt_num(im_part)}i", "equation"))
            steps.append(MathStep("Calculate the two complex roots",
                                  rf"x_1 = {sol1_str}, \quad x_2 = {sol2_str}", "equation"))
            return complex(re_part, im_part), complex(re_part, -im_part), steps
        else:
            steps.append(MathStep("The discriminant is negative (D < 0), so there are no real solutions", r"\text{No real solutions } (D < 0)", "equation"))
            return None, steps
    elif delta == 0:
        steps.append(MathStep("The discriminant is zero (D = 0), so there is exactly one real solution", r"x = \frac{-b}{2a}", "equation"))
        sol = -b / (2*a)
        sol_str = fmt_num(sol)
        steps.append(MathStep("Substitute coefficients into formula", rf"x = \frac{{-({b_str})}}{{2 \cdot ({a_str})}} = {sol_str}", "equation"))
        return sol, steps
    else:
        sqrt_delta = delta**0.5
        sol1 = (-b + sqrt_delta) / (2*a)
        sol2 = (-b - sqrt_delta) / (2*a)
        sol1_str, sol2_str = fmt_num(sol1), fmt_num(sol2)
        
        steps.append(MathStep("Substitute discriminant and coefficients into formula", rf"x = \frac{{-({b_str}) \pm \sqrt{{{delta_str}}}}}{{2 \cdot ({a_str})}}", "equation"))
        steps.append(MathStep("Calculate the two real roots", rf"x_1 = {sol1_str}, \quad x_2 = {sol2_str}", "equation"))
        return sol1, sol2, steps
    
def factoring_quadratic(equation: str, allow_complex: bool = True)-> Tuple[Union[float, complex, Tuple, List], List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    a, b, c = parse_quadratic(equation)
    
    if a == 0:
        return quadratic_equation_solver(equation, allow_complex=allow_complex)
        
    a_str, b_str, c_str = fmt_num(a), fmt_num(b), fmt_num(c)
    steps.append(MathStep(f"Identify polynomial coefficients: a = {a_str}, b = {b_str}, c = {c_str}", rf"a = {a_str}, \quad b = {b_str}, \quad c = {c_str}", "equation"))
    steps.append(MathStep("Apply the factoring method", r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}", "equation"))
    
    delta = b**2 - 4*a*c
    delta_str = fmt_num(delta)
    steps.append(MathStep("Calculate the discriminant D = b^2 - 4ac", rf"D = ({b_str})^2 - 4 \cdot ({a_str}) \cdot ({c_str}) = {delta_str}", "equation"))
    
    if delta < 0:
        if allow_complex:
            re_part = -b / (2 * a)
            im_part = math.sqrt(-delta) / (2 * abs(a))
            sol1_str = format_complex_latex(re_part, im_part)
            sol2_str = format_complex_latex(re_part, -im_part)
            steps.append(MathStep("Factor equation over the complex field C",
                                  rf"{a_str}\left(x - ({sol1_str})\right)\left(x - ({sol2_str})\right) = 0", "equation"))
            steps.append(MathStep("Calculate the two complex roots",
                                  rf"x_1 = {sol1_str}, \quad x_2 = {sol2_str}", "equation"))
            return complex(re_part, im_part), complex(re_part, -im_part), steps
        else:
            steps.append(MathStep("The discriminant is negative (D < 0), so there are no real solutions", r"\text{No real solutions } (D < 0)", "equation"))
            return None, steps
    elif delta == 0:
        steps.append(MathStep("The discriminant is zero (D = 0), so there is exactly one real solution", r"x = \frac{-b}{2a}", "equation"))
        sol = -b / (2*a)
        sol_str = fmt_num(sol)
        steps.append(MathStep("Substitute coefficients into formula", rf"x = \frac{{-({b_str})}}{{2 \cdot ({a_str})}} = {sol_str}", "equation"))
        return sol, steps
    else:
        sqrt_delta = delta**0.5
        sol1 = (-b + sqrt_delta) / (2*a)
        sol2 = (-b - sqrt_delta) / (2*a)
        sol1_str, sol2_str = fmt_num(sol1), fmt_num(sol2)
        
        steps.append(MathStep("Substitute discriminant and coefficients into formula", rf"x = \frac{{-({b_str}) \pm \sqrt{{{delta_str}}}}}{{2 \cdot ({a_str})}}", "equation"))
        steps.append(MathStep("Calculate the two real roots", rf"x_1 = {sol1_str}, \quad x_2 = {sol2_str}", "equation"))
        return sol1, sol2, steps

def cubic_equation_solver(equation: str, allow_complex: bool = True)-> Tuple[Union[float, complex, Tuple, List], List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    a, b, c, d = parse_polynomial(equation)
    
    if a == 0:
        return quadratic_equation_solver(equation, allow_complex=allow_complex)
        
    a_str, b_str, c_str, d_str = fmt_num(a), fmt_num(b), fmt_num(c), fmt_num(d)
    steps.append(MathStep(f"Identify polynomial coefficients: a = {a_str}, b = {b_str}, c = {c_str}, d = {d_str}",
                          rf"a = {a_str}, \quad b = {b_str}, \quad c = {c_str}, \quad d = {d_str}", "equation"))
    
    # Solve cubic ax^3 + bx^2 + cx + d = 0 using depressed cubic transformation t^3 + p*t + q = 0
    p = (3*a*c - b**2) / (3 * a**2)
    q = (2*b**3 - 9*a*b*c + 27*a**2*d) / (27 * a**3)
    
    discriminant = (q/2)**2 + (p/3)**3
    roots = []
    
    if abs(discriminant) < 1e-9:
        if abs(p) < 1e-9 and abs(q) < 1e-9:
            roots = [-b / (3*a)]
        else:
            r1 = 2 * (-q/2)**(1/3) if q < 0 else -2 * (q/2)**(1/3)
            r2 = -r1 / 2
            shift = -b / (3*a)
            roots = [r1 + shift, r2 + shift]
    elif discriminant > 0:
        sqrt_disc = math.sqrt(discriminant)
        u_val = -q/2 + sqrt_disc
        v_val = -q/2 - sqrt_disc
        u = math.copysign(abs(u_val)**(1/3), u_val)
        v = math.copysign(abs(v_val)**(1/3), v_val)
        t1 = u + v
        shift = -b / (3*a)
        real_root = round(t1 + shift, 6)
        
        if allow_complex:
            re_c = -(u + v) / 2 + shift
            im_c = (math.sqrt(3) / 2) * abs(u - v)
            if abs(im_c) > 1e-9:
                c1_str = format_complex_latex(re_c, im_c)
                c2_str = format_complex_latex(re_c, -im_c)
                steps.append(MathStep("Cardano's method: 1 real root and 2 complex conjugate roots (discriminant > 0)",
                                      rf"x_1 = {fmt_num(real_root)}, \quad x_2 = {c1_str}, \quad x_3 = {c2_str}", "equation"))
                return [real_root, complex(re_c, im_c), complex(re_c, -im_c)], steps
        roots = [real_root]
    else:
        r = math.sqrt(-(p/3)**3)
        phi = math.acos(max(-1.0, min(1.0, -q / (2 * r))))
        t1 = 2 * (-p/3)**0.5 * math.cos(phi / 3)
        t2 = 2 * (-p/3)**0.5 * math.cos((phi + 2*math.pi) / 3)
        t3 = 2 * (-p/3)**0.5 * math.cos((phi + 4*math.pi) / 3)
        shift = -b / (3*a)
        roots = [t1 + shift, t2 + shift, t3 + shift]
        
    sorted_roots = sorted(list(set([round(r, 6) for r in roots])))
    roots_formatted = ", ".join(fmt_num(r) for r in sorted_roots)
    latex_roots = r"x \in \{" + roots_formatted + r"\}"
    steps.append(MathStep("Calculate real roots of cubic equation", latex_roots, "equation"))
    return sorted_roots, steps

def rational_root_theorem_solver(equation: str, allow_complex: bool = True)-> Tuple[Union[float, complex, Tuple, List], List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    a, b, c, d = parse_polynomial(equation)
    
    # Determine leading coefficient and degree
    if a != 0:
        lead_coeff = a
        deg = 3
    elif b != 0:
        lead_coeff = b
        deg = 2
    elif c != 0:
        lead_coeff = c
        deg = 1
    else:
        return float('nan'), [MathStep("No variable found", r"\text{No solution}", "equation")]

    steps.append(MathStep(f"Identify polynomial coefficients: a = {a}, b = {b}, c = {c}, d = {d}",
                          rf"a = {a}, \quad b = {b}, \quad c = {c}, \quad d = {d}", "equation"))
    
    latex_th = r"\text{Candidate roots } \frac{p}{q} \text{ where } p \mid d \text{ and } q \mid a_{\text{lead}}"
    steps.append(MathStep("Rational Root Theorem: Any rational root p/q requires p to be a factor of constant term d and q a factor of leading coefficient", latex_th, "equation"))
    
    p, q = d, lead_coeff
    steps.append(MathStep(f"Identify constant term p = {p} and leading coefficient q = {q}", rf"p = {p}, \quad q = {q}", "equation"))
    
    # Calculate integer factors of p and q safely
    factors_p = set()
    p_abs = abs(int(p))
    if p_abs != 0:
        for i in range(1, int(math.isqrt(p_abs)) + 1):
            if p_abs % i == 0:
                factors_p.add(i)
                factors_p.add(-i)
                factors_p.add(p_abs // i)
                factors_p.add(-(p_abs // i))
    else:
        factors_p.add(0)

    factors_q = set()
    q_abs = abs(int(q))
    if q_abs != 0:
        for j in range(1, int(math.isqrt(q_abs)) + 1):
            if q_abs % j == 0:
                factors_q.add(j)
                factors_q.add(-j)
                factors_q.add(q_abs // j)
                factors_q.add(-(q_abs // j))

    sorted_p = sorted(list(factors_p))
    sorted_q = sorted(list(factors_q))
    p_str = ", ".join(str(x) for x in sorted_p)
    q_str = ", ".join(str(x) for x in sorted_q)
    steps.append(MathStep(f"Factors of p ({p}): {sorted_p}", r"p \in \{" + p_str + r"\}", "equation"))
    steps.append(MathStep(f"Factors of q ({q}): {sorted_q}", r"q \in \{" + q_str + r"\}", "equation"))
    
    # Candidate roots p / q
    possible_roots = set()
    for fp in factors_p:
        for fq in factors_q:
            if fq != 0:
                possible_roots.add(fp / fq)
                
    sorted_candidates = sorted(list(possible_roots))
    candidates_str = ", ".join(fmt_num(r) for r in sorted_candidates)
    steps.append(MathStep(f"Possible rational roots p/q: {candidates_str}",
                          r"x \in \{" + candidates_str + r"\}", "equation"))

    def eval_poly(x_val: float) -> float:
        return a * (x_val**3) + b * (x_val**2) + c * x_val + d

    # Test candidates f(r) == 0
    found_root = None
    for r in sorted_candidates:
        if abs(eval_poly(r)) < 1e-9:
            found_root = r
            break
            
    if found_root is not None:
        r = found_root
        steps.append(MathStep(f"Root found: x = {fmt_num(r)}", rf"f({fmt_num(r)}) = 0 \implies x_1 = {fmt_num(r)}", "equation"))
        
        if deg == 3:
            # Synthetic division for cubic: a*x^2 + (a*r + b)*x + ((a*r + b)*r + c)
            a_new = a
            b_new = a * r + b
            c_new = b_new * r + c
            
            steps.append(MathStep(f"Perform synthetic division by (x - {fmt_num(r)})",
                                  rf"({fmt_num(a)}x^3 + {fmt_num(b)}x^2 + {fmt_num(c)}x + {fmt_num(d)}) = (x - {fmt_num(r)})({fmt_num(a_new)}x^2 + {fmt_num(b_new)}x + {fmt_num(c_new)})", "equation"))
            
            b_sign = "+ " if b_new >= 0 else "- "
            c_sign = "+ " if c_new >= 0 else "- "
            quad_str = f"{a_new}x^2 {b_sign}{abs(b_new)}x {c_sign}{abs(c_new)} = 0"
            quad_res = quadratic_equation_solver(quad_str, allow_complex=allow_complex)
            quad_steps = quad_res[-1]
            quad_sols = quad_res[:-1]
            steps.extend(quad_steps)
            
            roots_list = [r]
            for s in quad_sols:
                if isinstance(s, (int, float, complex)):
                    roots_list.append(s)
            return roots_list, steps
        elif deg == 2:
            # Synthetic division for quadratic: b*x^2 + c*x + d = (x - r)(b*x - d/r)
            b_new = b
            c_new = b * r + c
            r2 = -c_new / b_new
            steps.append(MathStep(f"Factor into linear binomials",
                                  rf"({fmt_num(b)}x^2 + {fmt_num(c)}x + {fmt_num(d)}) = ({fmt_num(b)}x + {fmt_num(c_new)})(x - {fmt_num(r)}) = 0", "equation"))
            steps.append(MathStep(f"Solve for second root", rf"x_2 = {fmt_num(r2)}", "equation"))
            return [r, r2], steps
        else:
            return [r], steps
    else:
        steps.append(MathStep("No rational roots found via Rational Root Theorem. Falling back to general polynomial solver.", r"\text{No rational roots}", "equation"))
        if deg == 3:
            c_res = cubic_equation_solver(equation, allow_complex=allow_complex)
            c_steps = c_res[-1]
            c_roots = c_res[:-1]
            steps.extend(c_steps)
            return c_roots, steps
        elif deg == 2:
            q_res = quadratic_equation_solver(equation, allow_complex=allow_complex)
            q_steps = q_res[-1]
            q_roots = q_res[:-1]
            steps.extend(q_steps)
            return q_roots, steps
        else:
            return None, steps

# Alias to maintain compatibility with raditional_root_theorem_solver
raditional_root_theorem_solver = rational_root_theorem_solver

def solve_equation(equation: str, type_of_equation: str = 'one_variable', allow_complex: bool = True) -> Tuple[Union[float, complex, Tuple, List], List[MathStep]]:
    steps = []
    
    if type_of_equation == 'one_variable':
        # Fast path using parse_polynomial
        a, b, c, d = parse_polynomial(equation)
        
        if a != 0:
            return rational_root_theorem_solver(equation, allow_complex=allow_complex)
        elif b != 0:
            return quadratic_equation_solver(equation, allow_complex=allow_complex)
        else:
            # Linear equation: cx + d = 0
            var_coeff = c
            const_term = d
            
            steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
            v_str = fmt_num(var_coeff)
            c_str = fmt_num(const_term)
            
            sign = "+" if const_term >= 0 else ""
            simplified_latex = f"{v_str}x {sign if const_term >= 0 else '-'} {abs(const_term):.4g} = 0".replace(" + 0", "")
            steps.append(MathStep("Simplify and collect like terms", simplified_latex, "equation"))
            
            if var_coeff == 0:
                if const_term == 0:
                    steps.append(MathStep("Equation has infinitely many solutions", r"\text{All real numbers } x", "equation"))
                    return float('inf'), steps
                else:
                    steps.append(MathStep("Equation has no solution", r"\text{No solution}", "equation"))
                    return float('nan'), steps
                    
            sol = -const_term / var_coeff
            sol_str = fmt_num(sol)
            
            steps.append(MathStep("Isolate variable term", f"{v_str}x = {-const_term:.4g}", "equation"))
            steps.append(MathStep("Solve for x", f"x = {sol_str}", "equation"))
            
            return sol, steps
    else:
        raise Exception('Invalid equation type')


# ==============================================================================
# PURE PYTHON POLYNOMIAL ENGINE (100% SCRATCH, ZERO SYMPY)
# ==============================================================================

def fmt_fraction_latex(frac: Union[Fraction, int, float]) -> str:
    """Format a number or Fraction into clean, publication-quality LaTeX."""
    if isinstance(frac, float):
        if abs(frac - round(frac)) < 1e-9:
            return str(int(round(frac)))
        return f"{frac:.4g}"
    if not isinstance(frac, Fraction):
        try:
            frac = Fraction(frac)
        except Exception:
            return str(frac)
    if frac.denominator == 1:
        return str(frac.numerator)
    if frac < 0:
        return rf"-\frac{{{abs(frac.numerator)}}}{{{frac.denominator}}}"
    return rf"\frac{{{frac.numerator}}}{{{frac.denominator}}}"

class PurePoly:
    """Pure-Python polynomial class represented as a sparse power->Fraction dictionary."""
    def __init__(self, coeffs: Dict[int, Union[Fraction, int, float]], var: str = 'x'):
        self.var = var
        self.coeffs: Dict[int, Fraction] = {}
        for p, c in coeffs.items():
            f = Fraction(c) if not isinstance(c, Fraction) else c
            if f != 0:
                self.coeffs[p] = f

    @property
    def degree(self) -> int:
        return max(self.coeffs.keys()) if self.coeffs else 0

    def coeff(self, deg: int) -> Fraction:
        return self.coeffs.get(deg, Fraction(0))

    def is_zero(self) -> bool:
        return len(self.coeffs) == 0

    def eval(self, x_val: Union[int, float, Fraction]) -> Union[float, Fraction]:
        res = Fraction(0) if isinstance(x_val, (int, Fraction)) else 0.0
        for p, c in self.coeffs.items():
            res += c * (x_val ** p)
        return res

    def to_latex(self) -> str:
        if not self.coeffs:
            return "0"
        powers = sorted(self.coeffs.keys(), reverse=True)
        terms = []
        for p in powers:
            c = self.coeffs[p]
            is_neg = c < 0
            abs_c = abs(c)
            c_str = str(abs_c.numerator) if abs_c.denominator == 1 else rf"\frac{{{abs_c.numerator}}}{{{abs_c.denominator}}}"
            if p == 0:
                term = c_str
            elif p == 1:
                term = self.var if abs_c == 1 else f"{c_str}{self.var}"
            else:
                term = f"{self.var}^{{{p}}}" if abs_c == 1 else f"{c_str}{self.var}^{{{p}}}"
            if not terms:
                terms.append(f"-{term}" if is_neg else term)
            else:
                sign = " - " if is_neg else " + "
                terms.append(f"{sign}{term}")
        return "".join(terms)

    def to_string(self) -> str:
        return self.to_latex().replace(r"\frac", "").replace("{", "").replace("}", "")

def detect_variable(s: str) -> str:
    """Finds single-letter variable names ignoring standard math functions."""
    s_clean = re.sub(r'\b(sin|cos|tan|cot|sec|csc|exp|log|ln|sqrt|abs)\b', '', s, flags=re.IGNORECASE)
    vars_found = re.findall(r'[a-zA-Z]', s_clean)
    if 'x' in vars_found or 'X' in vars_found:
        return 'x'
    return vars_found[0].lower() if vars_found else 'x'

def parse_poly_ast(expr_str: str, var: str = 'x') -> Dict[int, Fraction]:
    """Parses algebraic expression using restricted Python AST into polynomial coefficient dict."""
    s = expr_str.strip()
    if not s:
        return {}
    s = s.replace('^', '**')
    s = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', s)
    s = re.sub(r'(\d)\(', r'\1*(', s)
    s = re.sub(r'\)([a-zA-Z0-9])', r')*\1', s)
    s = re.sub(r'\)\(', r')*(', s)
    s = re.sub(rf'\b{var}\(', rf'{var}*(', s)

    tree = ast.parse(s, mode='eval')

    def to_poly(node):
        if isinstance(node, ast.Expression):
            return to_poly(node.body)
        elif isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return {0: Fraction(str(node.value))}
            raise ValueError("Non-numeric constant")
        elif isinstance(node, ast.Name):
            if node.id.lower() == var.lower():
                return {1: Fraction(1)}
            raise ValueError(f"Unknown variable: {node.id}")
        elif isinstance(node, ast.UnaryOp):
            val = to_poly(node.operand)
            if isinstance(node.op, ast.USub):
                return {p: -c for p, c in val.items()}
            elif isinstance(node.op, ast.UAdd):
                return val
            raise ValueError("Unsupported unary op")
        elif isinstance(node, ast.BinOp):
            left = to_poly(node.left)
            right = to_poly(node.right)
            if isinstance(node.op, ast.Add):
                res = dict(left)
                for p, c in right.items():
                    res[p] = res.get(p, Fraction(0)) + c
                return {p: c for p, c in res.items() if c != 0}
            elif isinstance(node.op, ast.Sub):
                res = dict(left)
                for p, c in right.items():
                    res[p] = res.get(p, Fraction(0)) - c
                return {p: c for p, c in res.items() if c != 0}
            elif isinstance(node.op, ast.Mult):
                res = {}
                for p1, c1 in left.items():
                    for p2, c2 in right.items():
                        res[p1 + p2] = res.get(p1 + p2, Fraction(0)) + c1 * c2
                return {p: c for p, c in res.items() if c != 0}
            elif isinstance(node.op, ast.Pow):
                if len(right) == 1 and 0 in right and right[0].denominator == 1 and right[0] >= 0:
                    power = int(right[0])
                    res = {0: Fraction(1)}
                    for _ in range(power):
                        new_res = {}
                        for p1, c1 in res.items():
                            for p2, c2 in left.items():
                                new_res[p1 + p2] = new_res.get(p1 + p2, Fraction(0)) + c1 * c2
                        res = new_res
                    return {p: c for p, c in res.items() if c != 0}
                raise ValueError("Power must be non-negative integer")
            elif isinstance(node.op, ast.Div):
                if len(right) == 1 and 0 in right and right[0] != 0:
                    denom = right[0]
                    return {p: c / denom for p, c in left.items()}
                raise ValueError("Division only supported by constant")
            raise ValueError("Unsupported binary op")
        raise ValueError(f"Unsupported node: {type(node)}")

    return to_poly(tree)

def parse_poly_regex(side_str: str, var: str = 'x') -> Dict[int, Fraction]:
    deg_map = {}
    pattern = re.compile(rf'([+-]?(?:\d+(?:\.\d+)?|\.\d+)?)(?:({var})(?:\^(\d+))?)?', re.IGNORECASE)
    for match in pattern.finditer(side_str.replace(" ", "")):
        coeff_str, var_name, pow_str = match.groups()
        if not coeff_str and not var_name:
            continue
        if coeff_str in ("", "+"):
            coeff = Fraction(1)
        elif coeff_str == "-":
            coeff = Fraction(-1)
        else:
            try:
                coeff = Fraction(coeff_str)
            except ValueError:
                continue
        degree = int(pow_str) if pow_str else (1 if var_name else 0)
        deg_map[degree] = deg_map.get(degree, Fraction(0)) + coeff
    return {p: c for p, c in deg_map.items() if c != 0}

def parse_poly_side(side_str: str, var: str = 'x') -> PurePoly:
    try:
        coeffs = parse_poly_ast(side_str, var)
        return PurePoly(coeffs, var)
    except Exception:
        coeffs = parse_poly_regex(side_str, var)
        return PurePoly(coeffs, var)

def parse_equation_to_poly(eq_str: str) -> Tuple[PurePoly, str, str, str]:
    clean_str = re.sub(r'^(y|f\(x\))\s*=\s*', '', eq_str.strip(), flags=re.IGNORECASE)
    var = detect_variable(clean_str)
    if '=' in clean_str:
        lhs_str, rhs_str = clean_str.split('=', 1)
    else:
        lhs_str, rhs_str = clean_str, '0'
    lhs_poly = parse_poly_side(lhs_str, var)
    rhs_poly = parse_poly_side(rhs_str, var)
    all_powers = set(lhs_poly.coeffs.keys()) | set(rhs_poly.coeffs.keys())
    diff_coeffs = {p: lhs_poly.coeff(p) - rhs_poly.coeff(p) for p in all_powers}
    poly = PurePoly(diff_coeffs, var)
    return poly, var, lhs_str, rhs_str

def poly_div_root(poly: PurePoly, r: Fraction) -> Tuple[PurePoly, Fraction]:
    deg = poly.degree
    coeffs = [poly.coeff(d) for d in range(deg, -1, -1)]
    quot = [coeffs[0]]
    for i in range(1, deg):
        quot.append(coeffs[i] + quot[-1] * r)
    rem = coeffs[-1] + quot[-1] * r
    res_poly = {deg - 1 - i: quot[i] for i in range(deg)}
    return PurePoly(res_poly, poly.var), rem

def factor_poly(poly: PurePoly) -> Tuple[str, List[Tuple[str, Fraction, int]], PurePoly]:
    """Factors a polynomial into linear and irreducible factors with Zero Product details."""
    var = poly.var
    if poly.degree == 0:
        return poly.to_latex(), [], poly
    factors = []
    curr = PurePoly(poly.coeffs, var)
    
    # 1. GCF x^k
    min_p = min(curr.coeffs.keys()) if curr.coeffs else 0
    if min_p > 0:
        gcf_latex = f"{var}^{{{min_p}}}" if min_p > 1 else var
        factors.append((gcf_latex, Fraction(0), min_p))
        curr = PurePoly({p - min_p: c for p, c in curr.coeffs.items()}, var)

    # 2. Rational roots
    def get_factors(n):
        s = set()
        for i in range(1, int(math.isqrt(n)) + 1):
            if n % i == 0:
                s.add(i); s.add(n // i)
        return s

    while curr.degree >= 1:
        deg = curr.degree
        lead = abs(curr.coeff(deg).numerator * curr.coeff(0).denominator)
        const = abs(curr.coeff(0).numerator * curr.coeff(deg).denominator)
        if const == 0:
            factors.append((var, Fraction(0), 1))
            curr = PurePoly({p - 1: c for p, c in curr.coeffs.items() if p > 0}, var)
            continue
        p_facs = get_factors(const)
        q_facs = get_factors(lead)
        cands = set()
        for p in p_facs:
            for q in q_facs:
                cands.add(Fraction(p, q))
                cands.add(Fraction(-p, q))
        found = None
        for cand in sorted(cands):
            if curr.eval(cand) == 0:
                found = cand
                break
        if found is not None:
            q = found.denominator
            p = found.numerator
            if q == 1:
                term_latex = f"({var} - {p})" if p > 0 else f"({var} + {-p})"
            else:
                term_latex = f"({q}{var} - {p})" if p > 0 else f"({q}{var} + {-p})"
            factors.append((term_latex, found, 1))
            curr, _ = poly_div_root(curr, found)
        else:
            break

    rem_latex = ""
    if curr.degree > 0:
        rem_latex = f"({curr.to_latex()})"
    
    factored_latex = "".join([f[0] for f in factors]) + rem_latex
    return factored_latex, factors, curr

def solve_biquadratic(poly: PurePoly, allow_complex: bool = True) -> Tuple[List, List[MathStep]]:
    """Solves bi-quadratic polynomial (ax^4 + bx^2 + c = 0) via substitution u = x^2."""
    var = poly.var
    a = float(poly.coeff(4))
    b = float(poly.coeff(2))
    c = float(poly.coeff(0))
    
    D = b**2 - 4*a*c
    steps = []
    b_sign = "+ " if b >= 0 else "- "
    c_sign = "+ " if c >= 0 else "- "
    steps.append(MathStep(
        f"Substitute u = {var}^2 to convert into a quadratic equation in u",
        rf"u = {var}^2 \implies {a:g}u^2 {b_sign}{abs(b):g}u {c_sign}{abs(c):g} = 0",
        "equation"
    ))
    
    if D < 0 and not allow_complex:
        steps.append(MathStep(
            "Discriminant is negative",
            r"D < 0 \implies \text{No real solutions}",
            "equation"
        ))
        return [], steps
        
    sqrt_D = math.sqrt(D) if D >= 0 else complex(0, math.sqrt(-D))
    u1 = (-b + sqrt_D) / (2*a)
    u2 = (-b - sqrt_D) / (2*a)
    
    u_sols = [u1] if D == 0 else [u1, u2]
    steps.append(MathStep(
        "Solve quadratic equation for u",
        ", ".join([f"u = {u:g}" if isinstance(u, float) else f"u = {u}" for u in u_sols]),
        "equation"
    ))
    
    x_sols = []
    for u in u_sols:
        if isinstance(u, (int, float)):
            if u > 0:
                sq = math.isqrt(int(u)) if u.is_integer() else None
                if sq and sq*sq == int(u):
                    x_sols.extend([sq, -sq])
                    steps.append(MathStep(
                        f"Back-substitute u = {var}^2 for u = {u:g}",
                        rf"{var}^2 = {u:g} \implies {var} = \pm {sq}",
                        "equation"
                    ))
                else:
                    r = math.sqrt(u)
                    x_sols.extend([r, -r])
                    steps.append(MathStep(
                        f"Back-substitute u = {var}^2 for u = {u:g}",
                        rf"{var}^2 = {u:g} \implies {var} = \pm \sqrt{{{u:g}}}",
                        "equation"
                    ))
            elif u == 0:
                x_sols.append(0)
                steps.append(MathStep(
                    f"Back-substitute u = {var}^2 for u = 0",
                    rf"{var}^2 = 0 \implies {var} = 0",
                    "equation"
                ))
            else:
                if allow_complex:
                    pos_u = -u
                    sq = math.isqrt(int(pos_u)) if pos_u.is_integer() else None
                    if sq and sq*sq == int(pos_u):
                        x_sols.extend([complex(0, sq), complex(0, -sq)])
                        steps.append(MathStep(
                            f"Back-substitute u = {var}^2 for u = {u:g}",
                            rf"{var}^2 = {u:g} \implies {var} = \pm {sq}i",
                            "equation"
                        ))
                    else:
                        r = math.sqrt(pos_u)
                        x_sols.extend([complex(0, r), complex(0, -r)])
                        steps.append(MathStep(
                            f"Back-substitute u = {var}^2 for u = {u:g}",
                            rf"{var}^2 = {u:g} \implies {var} = \pm i\sqrt{{{pos_u:g}}}",
                            "equation"
                        ))
    return x_sols, steps

def solve_algebra_pure(input_str: str, allow_complex: bool = True) -> Tuple[str, List[MathStep]]:
    """
    Pure Python algebraic equation solver. Generates full step-by-step mathematical reasoning.
    Zero external dependencies.
    """
    poly, var, lhs_str, rhs_str = parse_equation_to_poly(input_str)
    steps = []
    
    steps.append(MathStep(
        description="Write down the equation",
        latex=f"{lhs_str.strip()} = {rhs_str.strip()}",
        type="equation"
    ))
    
    simplified_latex = poly.to_latex()
    steps.append(MathStep(
        description="Subtract right-hand side from both sides to set the equation to 0",
        latex=f"{simplified_latex} = 0",
        type="equation"
    ))
    
    deg = poly.degree
    if poly.is_zero():
        steps.append(MathStep("Equation has infinitely many solutions", r"\text{All real numbers } " + var, "equation"))
        return r"\text{All real numbers}", steps
        
    if deg == 0:
        steps.append(MathStep("Constant non-zero expression has no solution", r"\text{No solution}", "equation"))
        return r"\text{No solution}", steps
        
    if deg == 1:
        a = poly.coeff(1)
        b = poly.coeff(0)
        neg_b = -b
        sol = neg_b / a
        coeff_var_str = var if a == 1 else (f"-{var}" if a == -1 else f"{fmt_fraction_latex(a)}{var}")
        steps.append(MathStep(
            description=f"Isolate the variable term {var}",
            latex=f"{coeff_var_str} = {fmt_fraction_latex(neg_b)}",
            type="equation"
        ))
        steps.append(MathStep(
            description=f"Divide both sides by the coefficient of {var}",
            latex=f"{var} = {fmt_fraction_latex(sol)}",
            type="equation"
        ))
        final_str = f"{var} = {fmt_fraction_latex(sol)}"
        return final_str, steps
        
    elif deg == 2:
        a = float(poly.coeff(2))
        b = float(poly.coeff(1))
        c = float(poly.coeff(0))
        D = b**2 - 4*a*c
        
        
            description=f"Identify coefficients of quadratic equation a{var}^2 + b{var} + c = 0",
            latex=f"a = {a:g}, \\quad b = {b:g}, \\quad c = {c:g}",
            type="equation"
        ))
        steps.append(MathStep(
            description="Calculate the discriminant: D = b^2 - 4ac",
            latex=rf"D = ({b:g})^2 - 4 \cdot ({a:g}) \cdot ({c:g}) = {D:g}",
            type="equation"
        ))
        
        neg_b_val = -b
        neg_b_str = f"{neg_b_val:g}"
        
        if D < 0:
            if not allow_complex:
                steps.append(MathStep(
                    description="Discriminant is negative (D < 0), so there are no real solutions",
                    latex=r"\text{No real solutions } (D < 0)",
                    type="equation"
                ))
                return r"\text{No real solutions}", steps
            else:
                sqrt_D = math.sqrt(-D)
                re_part = -b / (2*a)
                im_part = sqrt_D / (2*a)
                re_str = f"{re_part:g}" if abs(re_part) > 1e-9 else ""
                im_str = f"{abs(im_part):g}i" if abs(abs(im_part) - 1.0) > 1e-9 else "i"
                if re_str:
                    sols_str = f"{var} = {re_str} \\pm {im_str}"
                else:
                    sols_str = f"{var} = \\pm {im_str}"
                steps.append(MathStep(
                    description="Since discriminant D < 0, roots are complex conjugates involving imaginary unit i = \\sqrt{-1}",
                    latex=rf"{var} = \frac{{{neg_b_str} \pm i\sqrt{{{abs(D):g}}}}}{{2 \cdot {a:g}}} \implies {sols_str}",
                    type="equation"
                ))
                return sols_str, steps
        elif D == 0:
            sol = -b / (2*a)
            sol_str = f"{var} = {sol:g}"
            steps.append(MathStep(
                description="Discriminant D = 0, so there is one repeated real root",
                latex=rf"{var} = \frac{{{neg_b_str}}}{{2 \cdot {a:g}}} = {sol:g}",
                type="equation"
            ))
            return sol_str, steps
        else:
            sqrt_D = math.isqrt(int(D)) if float(D).is_integer() and math.isqrt(int(D))**2 == int(D) else math.sqrt(D)
            s1 = (-b + sqrt_D) / (2*a)
            s2 = (-b - sqrt_D) / (2*a)
            steps.append(MathStep(
                description="Apply the quadratic formula",
                latex=rf"{var} = \frac{{{neg_b_str} \pm \sqrt{{{D:g}}}}}{{2 \cdot {a:g}}}",
                type="equation"
            ))
            steps.append(MathStep(
                description=f"Calculate two distinct real roots of {var}",
                latex=f"{var} = {s1:g}, \\quad {var} = {s2:g}",
                type="equation"
            ))
            return f"{var} = {s1:g}, \\quad {var} = {s2:g}", steps
            
    elif deg == 3:
        try:
            r1_roots, r1_steps = rational_root_theorem_solver(input_str, allow_complex=allow_complex)
            if r1_steps:
                steps.extend(r1_steps)
                roots_list = r1_roots if isinstance(r1_roots, list) else [r1_roots]
                roots_str = ", ".join([f"{var} = {fmt_num(r)}" if isinstance(r, (int, float)) else f"{var} = {format_complex_latex(r.real, r.imag)}" for r in roots_list if r is not None])
                return roots_str, steps
        except Exception:
            pass

    # Degree >= 4 (or general polynomial)
    factored_latex, factors, rem = factor_poly(poly)
    if factored_latex != poly.to_latex():
        steps.append(MathStep(
            description="Factor the polynomial into algebraic factors",
            latex=f"{factored_latex} = 0",
            type="equation"
        ))
        steps.append(MathStep(
            description="Apply the Zero Product Property: set each factor equal to 0",
            latex=r"A \cdot B = 0 \implies A = 0 \text{ or } B = 0",
            type="equation"
        ))
        
    sols = []
    for term_latex, root_val, mult in factors:
        mult_str = f" (multiplicity {mult})" if mult > 1 else ""
        steps.append(MathStep(
            description=f"Solve factor {term_latex} = 0{mult_str}",
            latex=rf"{term_latex} = 0 \implies {var} = {fmt_fraction_latex(root_val)}",
            type="equation"
        ))
        sols.append(f"{var} = {fmt_fraction_latex(root_val)}")
        
    if rem.degree == 2:
        rem_a = float(rem.coeff(2))
        rem_b = float(rem.coeff(1))
        rem_c = float(rem.coeff(0))
        rem_D = rem_b**2 - 4*rem_a*rem_c
        if rem_D >= 0:
            sq = math.sqrt(rem_D)
            r1 = (-rem_b + sq) / (2*rem_a)
            r2 = (-rem_b - sq) / (2*rem_a)
            steps.append(MathStep(
                description=f"Solve remaining quadratic factor ({rem.to_latex()}) = 0",
                latex=rf"({rem.to_latex()}) = 0 \implies {var} = {r1:g}, \quad {var} = {r2:g}",
                type="equation"
            ))
            sols.extend([f"{var} = {r1:g}", f"{var} = {r2:g}"])
        elif allow_complex:
            sq = math.sqrt(-rem_D)
            im = sq / (2*rem_a)
            re_p = -rem_b / (2*rem_a)
            re_s = f"{re_p:g}" if abs(re_p) > 1e-9 else ""
            im_s = f"{abs(im):g}i" if abs(abs(im) - 1.0) > 1e-9 else "i"
            steps.append(MathStep(
                description=f"Solve remaining quadratic factor ({rem.to_latex()}) = 0 for complex roots",
                latex=rf"({rem.to_latex()}) = 0 \implies {var} = {re_s} \pm {im_s}" if re_s else rf"({rem.to_latex()}) = 0 \implies {var} = \pm {im_s}",
                type="equation"
            ))
            sols.append(f"{var} = {re_s} \\pm {im_s}" if re_s else f"{var} = \\pm {im_s}")
            
    final_ans = ", ".join(sols) if sols else "Roots computed"
    steps.append(MathStep(
        description=f"Find the final values of {var}",
        latex=final_ans,
        type="equation"
    ))
    return final_ans, steps

if __name__ == '__main__':
    expression = 'x^3-16x-9=0'
    print("Parsing polynomial:", parse_polynomial(expression))
    print("\nSolving cubic equation:")
    roots, steps = cubic_equation_solver(expression)
    print("Roots:", roots)
    print("\nRational root theorem solver output:")
    print(rational_root_theorem_solver(expression))
    print("\nSolving quadratic equation (x^2 - 5x + 6 = 0):")
    sol1, sol2, quad_steps = quadratic_equation_solver("x^2 - 5x + 6 = 0")
    print("Quadratic roots:", sol1, sol2)


