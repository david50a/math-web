import sys
import os
import re
import math
from typing import List, Tuple, Union, Optional

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

def quadratic_equation_solver(equation: str)-> Tuple[Union[float, Tuple, List], List[MathStep]]:
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

def completing_the_square(equation: str)-> Tuple[Union[float, Tuple, List], List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    a, b, c = parse_quadratic(equation)
    
    if a == 0:
        return quadratic_equation_solver(equation)
        
    a_str, b_str, c_str = fmt_num(a), fmt_num(b), fmt_num(c)
    steps.append(MathStep(f"Identify polynomial coefficients: a = {a_str}, b = {b_str}, c = {c_str}", rf"a = {a_str}, \quad b = {b_str}, \quad c = {c_str}", "equation"))
    steps.append(MathStep("Apply the completing the square method", r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}", "equation"))
    
    delta = b**2 - 4*a*c
    delta_str = fmt_num(delta)
    steps.append(MathStep("Calculate the discriminant D = b^2 - 4ac", rf"D = ({b_str})^2 - 4 \cdot ({a_str}) \cdot ({c_str}) = {delta_str}", "equation"))
    
    if delta < 0:
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
    
def factoring_quadratic(equation: str)-> Tuple[Union[float, Tuple, List], List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    a, b, c = parse_quadratic(equation)
    
    if a == 0:
        return quadratic_equation_solver(equation)
        
    a_str, b_str, c_str = fmt_num(a), fmt_num(b), fmt_num(c)
    steps.append(MathStep(f"Identify polynomial coefficients: a = {a_str}, b = {b_str}, c = {c_str}", rf"a = {a_str}, \quad b = {b_str}, \quad c = {c_str}", "equation"))
    steps.append(MathStep("Apply the factoring method", r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}", "equation"))
    
    delta = b**2 - 4*a*c
    delta_str = fmt_num(delta)
    steps.append(MathStep("Calculate the discriminant D = b^2 - 4ac", rf"D = ({b_str})^2 - 4 \cdot ({a_str}) \cdot ({c_str}) = {delta_str}", "equation"))
    
    if delta < 0:
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

def cubic_equation_solver(equation: str)-> Tuple[Union[float, Tuple, List], List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    a, b, c, d = parse_polynomial(equation)
    
    if a == 0:
        return quadratic_equation_solver(equation)
        
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
        roots = [t1 - b / (3*a)]
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

def rational_root_theorem_solver(equation: str)-> Tuple[Union[float, Tuple, List], List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    a, b, c, d = parse_polynomial(equation)
    steps.append(MathStep(f"Identify polynomial coefficients: a = {a}, b = {b}, c = {c}, d = {d}",
                          rf"a = {a}, \quad b = {b}, \quad c = {c}, \quad d = {d}", "equation"))
    
    latex_th = r"\text{Candidate roots } \frac{p}{q} \text{ where } p \mid d \text{ and } q \mid a"
    steps.append(MathStep("Rational Root Theorem: Any rational root p/q requires p to be a factor of constant term d and q a factor of leading coefficient a", latex_th, "equation"))
    
    p, q = d, a
    steps.append(MathStep(f"Identify p = {p} and q = {q}", rf"p = {p}, \quad q = {q}", "equation"))
    
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

    # Test candidates f(r) == 0
    found_root = None
    for r in sorted_candidates:
        if abs(a * (r**3) + b * (r**2) + c * r + d) < 1e-9:
            found_root = r
            break
            
    if found_root is not None:
        r = found_root
        steps.append(MathStep(f"Root found: x = {fmt_num(r)}", rf"f({fmt_num(r)}) = 0 \implies x_1 = {fmt_num(r)}", "equation"))
        
        # Synthetic division: (a*x^3 + b*x^2 + c*x + d) / (x - r) = a_new*x^2 + b_new*x + c_new
        a_new = a
        b_new = a * r + b
        c_new = b_new * r + c
        
        steps.append(MathStep(f"Perform synthetic division by (x - {fmt_num(r)})",
                              rf"({fmt_num(a)}x^3 + {fmt_num(b)}x^2 + {fmt_num(c)}x + {fmt_num(d)}) = (x - {fmt_num(r)})({fmt_num(a_new)}x^2 + {fmt_num(b_new)}x + {fmt_num(c_new)})", "equation"))
        
        quad_str = f"{a_new}x^2 + {b_new}x + {c_new} = 0"
        quad_sol, quad_steps = quadratic_equation_solver(quad_str)
        steps.extend(quad_steps)
        
        roots_list = [r]
        if isinstance(quad_sol, tuple):
            roots_list.extend(list(quad_sol))
        elif isinstance(quad_sol, (int, float)):
            roots_list.append(quad_sol)
            
        all_roots = sorted(list(set([round(val, 6) for val in roots_list])))
        return all_roots, steps
    else:
        steps.append(MathStep("No rational roots found via Rational Root Theorem. Falling back to general cubic solver.", r"\text{No rational roots}", "equation"))
        c_roots, c_steps = cubic_equation_solver(equation)
        steps.extend(c_steps)
        return c_roots, steps

# Alias to maintain compatibility with raditional_root_theorem_solver
raditional_root_theorem_solver = rational_root_theorem_solver

def solve_equation(equation: str, type_of_equation: str = 'one_variable') -> Tuple[Union[float, Tuple, List], List[MathStep]]:
    steps = []
    
    if type_of_equation == 'one_variable':
        # Fast path using parse_polynomial
        a, b, c, d = parse_polynomial(equation)
        
        if a != 0:
            return rational_root_theorem_solver(equation)
        elif b != 0:
            return quadratic_equation_solver(equation)
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

