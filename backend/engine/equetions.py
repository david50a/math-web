import re
import math
from math_models import MathStep
from .linear_algebra_solver import solve_linear_system, matrix_to_latex

def parse_expression(expr: str):
    """
    Parses a linear expression into a dictionary of {variable: coefficient} and a constant.
    e.g., "2x - 3y + 5" -> {'x': 2.0, 'y': -3.0, '': 5.0}
    """
    expr = expr.replace(' ', '')
    if not expr:
        return {}, 0.0
    if not expr.startswith('+') and not expr.startswith('-'):
        expr = '+' + expr
        
    terms = re.findall(r'([+-])(\d*\.?\d*)([a-zA-Z]*)', expr)
    
    coeffs = {}
    constant = 0.0
    
    for sign, num_str, var in terms:
        mult = -1.0 if sign == '-' else 1.0
        val = 1.0 if num_str == '' else float(num_str)
        val *= mult
        
        if var:
            coeffs[var] = coeffs.get(var, 0.0) + val
        else:
            constant += val
            
    return coeffs, constant

def parse_linear_system(equations: list[str]):
    all_vars = set()
    parsed_eqs = []
    
    for eq in equations:
        if '=' not in eq:
            raise ValueError(f"Equation must contain '=': {eq}")
        left, right = eq.split('=', 1)
        
        left_coeffs, left_const = parse_expression(left)
        right_coeffs, right_const = parse_expression(right)
        
        eq_vars = {}
        for v, c in left_coeffs.items():
            eq_vars[v] = eq_vars.get(v, 0.0) + c
        for v, c in right_coeffs.items():
            eq_vars[v] = eq_vars.get(v, 0.0) - c
            
        const_val = right_const - left_const
        
        parsed_eqs.append((eq_vars, const_val))
        all_vars.update(eq_vars.keys())
        
    variables = sorted(list(all_vars))
    
    A = []
    b = []
    for eq_vars, const_val in parsed_eqs:
        row = [eq_vars.get(v, 0.0) for v in variables]
        A.append(row)
        b.append(const_val)
        
    return A, b, variables

def linear_equation(equations: list[str]):
    steps = []
    
    steps.append(MathStep(
        "Parse the system of linear equations",
        " \\\\ ".join(equations),
        "text"
    ))
    
    try:
        A, b, variables = parse_linear_system(equations)
    except Exception as e:
        steps.append(MathStep("Error parsing equations", str(e), "text"))
        return None, steps
        
    steps.append(MathStep(
        "Extract variables",
        ", ".join(variables),
        "text"
    ))
    
    # Format current equations state
    def format_equations(A, b, variables):
        lines = []
        for i in range(len(A)):
            terms = []
            for j, val in enumerate(A[i]):
                if abs(val) > 1e-9:
                    term = f"{abs(val):g}{variables[j]}" if abs(val) != 1 else variables[j]
                    if not terms:
                        if val < 0: term = "-" + term
                    else:
                        sign = "+" if val > 0 else "-"
                        term = f"{sign} {term}"
                    terms.append(term)
            if not terms: terms.append("0")
            lines.append(" ".join(terms) + f" = {b[i]:g}")
        return " \\\\ ".join(lines)

    steps.append(MathStep(
        "Initial system of equations",
        format_equations(A, b, variables),
        "equation"
    ))
    
    if len(A) != len(variables):
        steps.append(MathStep("Warning", "The system is not square (number of equations != number of variables).", "text"))
    
    try:
        # Solve algebraically (Gaussian elimination without matrices)
        n = len(A)
        for col in range(n):
            pivot = col
            while pivot < n and abs(A[pivot][col]) < 1e-9:
                pivot += 1
            if pivot == n: continue
            if pivot != col:
                A[col], A[pivot] = A[pivot], A[col]
                b[col], b[pivot] = b[pivot], b[col]
                steps.append(MathStep(f"Swap Equation {col+1} and Equation {pivot+1}", format_equations(A, b, variables), "equation"))
            
            pivot_val = A[col][col]
            if abs(pivot_val - 1.0) > 1e-9:
                A[col] = [x / pivot_val for x in A[col]]
                b[col] /= pivot_val
                steps.append(MathStep(f"Divide Equation {col+1} by {pivot_val:g}", format_equations(A, b, variables), "equation"))
                
            for r in range(col + 1, n):
                factor = A[r][col]
                if abs(factor) < 1e-9: continue
                A[r] = [A[r][j] - factor * A[col][j] for j in range(n)]
                b[r] -= factor * b[col]
                action = f"Subtract {factor:g} \\cdot \\text{{Equation }} {col+1} \\text{{ from Equation }} {r+1}" if factor > 0 else f"Add {abs(factor):g} \\cdot \\text{{Equation }} {col+1} \\text{{ to Equation }} {r+1}"
                steps.append(MathStep(action, format_equations(A, b, variables), "equation"))
                
        # Back substitution
        solution = [0.0] * n
        for i in range(n - 1, -1, -1):
            if abs(A[i][i]) < 1e-9:
                raise ValueError("System has no unique solution")
            s = b[i]
            for j in range(i + 1, n):
                s -= A[i][j] * solution[j]
            solution[i] = s / A[i][i]
            steps.append(MathStep(f"Substitute known variables into Equation {i+1} to solve for {variables[i]}", rf"{variables[i]} = {solution[i]:g}", "equation"))
        
        # Format the final solution
        sol_strs = [f"{var} = {val:.4g}" for var, val in zip(variables, solution)]
        steps.append(MathStep(
            "Final Solution",
            ", ".join(sol_strs),
            "text"
        ))
        
        return dict(zip(variables, solution)), steps
    except Exception as e:
        steps.append(MathStep("Error solving system", str(e), "text"))
        return None, steps

def parse_polynomial_expression(expr: str):
    """
    Parses a single-variable polynomial expression.
    Returns a tuple: (coefficients_dict, variable_name)
    e.g., "2x^2 - 3x + 5" -> ({2: 2.0, 1: -3.0, 0: 5.0}, 'x')
    """
    expr = expr.replace(' ', '')
    if not expr:
        return {}, None
    if not expr.startswith('+') and not expr.startswith('-'):
        expr = '+' + expr
        
    terms = re.findall(r'([+-])(\d*\.?\d*)([a-zA-Z]*)(\^\d+)?', expr)
    
    coeffs = {}
    var_name = None
    
    for sign, num_str, var, pow_str in terms:
        mult = -1.0 if sign == '-' else 1.0
        val = 1.0 if num_str == '' else float(num_str)
        val *= mult
        
        power = 0
        if var:
            if var_name is None:
                var_name = var
            elif var_name != var:
                raise ValueError(f"Only single-variable polynomials are supported. Found '{var_name}' and '{var}'.")
            
            if pow_str:
                power = int(pow_str[1:])
            else:
                power = 1
                
        coeffs[power] = coeffs.get(power, 0.0) + val
        
    return coeffs, var_name

def solve_polynomial_equation(equation: str):
    steps = []
    
    steps.append(MathStep(
        "Parse the polynomial equation",
        equation,
        "text"
    ))
    
    if '=' not in equation:
        steps.append(MathStep("Error", "Equation must contain '='", "text"))
        return None, steps
        
    left, right = equation.split('=', 1)
    
    try:
        left_coeffs, var_l = parse_polynomial_expression(left)
        right_coeffs, var_r = parse_polynomial_expression(right)
    except Exception as e:
        steps.append(MathStep("Error parsing", str(e), "text"))
        return None, steps
        
    var_name = var_l or var_r or 'x'
    if var_l and var_r and var_l != var_r:
        steps.append(MathStep("Error", "Different variables on left and right sides are not supported.", "text"))
        return None, steps
        
    # Combine coefficients: left - right = 0
    coeffs = {}
    all_powers = set(left_coeffs.keys()).union(right_coeffs.keys())
    for p in all_powers:
        val = left_coeffs.get(p, 0.0) - right_coeffs.get(p, 0.0)
        if abs(val) > 1e-9:
            coeffs[p] = val
            
    if not coeffs:
        steps.append(MathStep("Result", "0 = 0 (Identity, infinitely many solutions)", "text"))
        return [], steps
        
    degree = max(coeffs.keys())
    
def poly_to_latex(coeffs: dict[int, float], var_name: str):
    terms_str = []
    for p in sorted(coeffs.keys(), reverse=True):
        c = coeffs[p]
        if abs(c) < 1e-9: continue
        sign = "+" if c > 0 else "-"
        c_abs = abs(c)
        
        # Format coefficient
        if c_abs == 1 and p != 0:
            c_str = ""
        else:
            c_str = f"{c_abs:g}"
            
        if p == 0:
            term = f"{c_abs:g}"
        elif p == 1:
            term = f"{c_str}{var_name}"
        else:
            term = f"{c_str}{var_name}^{{{p}}}"
            
        if not terms_str:
            if sign == "-": term = "-" + term
        else:
            term = f"{sign} {term}"
        terms_str.append(term)
    return " ".join(terms_str) if terms_str else "0"

def get_factors(n: int):
    n = abs(int(n))
    if n == 0: return [1]
    factors = []
    for i in range(1, int(math.sqrt(n)) + 1):
        if n % i == 0:
            factors.append(i)
            if i*i != n:
                factors.append(n // i)
    return sorted(factors)

def evaluate_poly(coeffs: dict[int, float], x: float):
    return sum(c * (x**p) for p, c in coeffs.items())

def find_rational_root_details(coeffs: dict[int, float]):
    degree = max(coeffs.keys())
    a_n = coeffs[degree]
    a_0 = coeffs.get(0, 0)
    
    if abs(a_n - int(a_n)) > 1e-9 or abs(a_0 - int(a_0)) > 1e-9:
        # Fallback for non-integer coefficients
        for r in range(-10, 11):
            if abs(evaluate_poly(coeffs, float(r))) < 1e-8:
                return float(r), [], [], []
        return None, [], [], []

    a_n_int = abs(int(a_n))
    a_0_int = abs(int(a_0))
    
    p_factors = get_factors(a_0_int)
    q_factors = get_factors(a_n_int)
    
    candidates = set()
    for p in p_factors:
        for q in q_factors:
            candidates.add(p/q)
            candidates.add(-p/q)
    
    sorted_candidates = sorted(list(candidates))
    
    for root in sorted_candidates:
        if abs(evaluate_poly(coeffs, root)) < 1e-8:
            return root, p_factors, q_factors, sorted_candidates
            
    return None, p_factors, q_factors, sorted_candidates

def generate_synthetic_division_latex(coeffs: dict[int, float], root: float, result_coeffs: list[float]):
    degree = max(coeffs.keys())
    c_list = [coeffs.get(i, 0.0) for i in range(degree, -1, -1)]
    
    products = [0.0]
    for i in range(len(c_list) - 1):
        products.append(result_coeffs[i] * root)
    
    row1 = " & ".join([f"{c:g}" for c in c_list])
    row2 = " & " + " & ".join([f"{p:g}" for p in products[1:]])
    row3 = " & ".join([f"{r:g}" for r in result_coeffs])
    
    n = len(c_list)
    latex = r"\begin{array}{r|" + "r" * n + r"}" + "\n"
    latex += f"{root:g} & {row1} \\\\\n"
    latex += f" & {row2} \\\\ \hline\n"
    latex += f" & {row3}\n"
    latex += r"\end{array}"
    return latex

def generate_evaluation_latex(coeffs: dict[int, float], x: float, var_name: str):
    degree = max(coeffs.keys())
    terms = []
    for p in sorted(coeffs.keys(), reverse=True):
        c = coeffs[p]
        if abs(c) < 1e-9: continue
        
        c_str = f"{c:g}"
        if p == 0:
            term = f"({c_str})"
        elif p == 1:
            term = f"({c_str})({x:g})"
        else:
            term = f"({c_str})({x:g})^{{{p}}}"
        terms.append(term)
    
    val = evaluate_poly(coeffs, x)
    return " + ".join(terms).replace("+ -", "- ") + f" = {val:g}"

def synthetic_division(coeffs: dict[int, float], root: float):
    degree = max(coeffs.keys())
    c_list = [coeffs.get(i, 0.0) for i in range(degree, -1, -1)]
    
    new_c_list = []
    current = 0.0
    for c in c_list:
        val = c + current * root
        new_c_list.append(val)
        current = val
        
    new_coeffs = {}
    for i, val in enumerate(new_c_list[:-1]):
        new_p = degree - 1 - i
        if abs(val) > 1e-9:
            new_coeffs[new_p] = val
    return new_coeffs, new_c_list

def durand_kerner(coeffs: dict[int, float], max_iter=100):
    degree = max(coeffs.keys())
    a_n = coeffs[degree]
    norm_coeffs = {p: c / a_n for p, c in coeffs.items()}
    
    roots = []
    for i in range(degree):
        angle = (2 * math.pi * i) / degree + 0.5
        roots.append(complex(math.cos(angle), math.sin(angle)) * (0.4 + 0.9j)**i)
        
    for _ in range(max_iter):
        new_roots = roots[:]
        for i in range(degree):
            denom = 1.0 + 0j
            for j in range(degree):
                if i != j:
                    denom *= (roots[i] - roots[j])
            
            p_val = sum(norm_coeffs.get(p, 0.0) * (roots[i]**p) for p in range(degree + 1))
            new_roots[i] = roots[i] - p_val / denom
        
        diff = sum(abs(new_roots[i] - roots[i]) for i in range(degree))
        roots = new_roots
        if diff < 1e-10:
            break
    return roots

def solve_polynomial_equation(equation: str):
    steps = []
    steps.append(MathStep("Parse the polynomial equation", equation, "text"))
    
    if '=' not in equation:
        steps.append(MathStep("Error", "Equation must contain '='", "text"))
        return None, steps
        
    left, right = equation.split('=', 1)
    try:
        left_coeffs, var_l = parse_polynomial_expression(left)
        right_coeffs, var_r = parse_polynomial_expression(right)
    except Exception as e:
        steps.append(MathStep("Error parsing", str(e), "text"))
        return None, steps
        
    var_name = var_l or var_r or 'x'
    if var_l and var_r and var_l != var_r:
        steps.append(MathStep("Error", "Different variables on left and right sides are not supported.", "text"))
        return None, steps
        
    coeffs = {}
    all_powers = set(left_coeffs.keys()).union(right_coeffs.keys())
    for p in all_powers:
        val = left_coeffs.get(p, 0.0) - right_coeffs.get(p, 0.0)
        if abs(val) > 1e-9:
            coeffs[p] = val
            
    if not coeffs:
        steps.append(MathStep("Result", "0 = 0 (Identity, infinitely many solutions)", "text"))
        return [], steps
        
    degree = max(coeffs.keys())
    standard_form = poly_to_latex(coeffs, var_name) + " = 0"
    steps.append(MathStep("Write in standard form", standard_form, "equation"))
    
    all_roots = []
    
    def solve_recursive(current_coeffs, current_steps):
        nonlocal all_roots
        d = max(current_coeffs.keys())
        
        if d == 0:
            current_steps.append(MathStep("Result", f"{current_coeffs[0]:g} = 0 (No solution)", "text"))
            return
            
        elif d == 1:
            a = current_coeffs.get(1, 0.0)
            b = current_coeffs.get(0, 0.0)
            current_steps.append(MathStep(
                "Solve linear factor",
                rf"{a:g}{var_name} + ({b:g}) = 0",
                "equation"
            ))
            current_steps.append(MathStep(
                "Isolate the variable",
                rf"{a:g}{var_name} = {-b:g} \implies {var_name} = \frac{{{-b:g}}}{{{a:g}}}",
                "equation"
            ))
            sol = -b / a
            all_roots.append(sol)
            current_steps.append(MathStep("Linear solution", f"{var_name} = {sol:g}", "text"))
            return
            
        elif d == 2:
            a = current_coeffs.get(2, 0.0)
            b = current_coeffs.get(1, 0.0)
            c = current_coeffs.get(0, 0.0)
            
            current_steps.append(MathStep(
                "Identify coefficients",
                rf"a = {a:g}, \quad b = {b:g}, \quad c = {c:g}",
                "equation"
            ))
            
            disc = b**2 - 4*a*c
            current_steps.append(MathStep(
                "Calculate the discriminant ($\Delta = b^2 - 4ac$)",
                rf"\Delta = ({b:g})^2 - 4({a:g})({c:g}) = {disc:g}",
                "equation"
            ))
            
            current_steps.append(MathStep(
                "Apply the quadratic formula",
                rf"{var_name} = \frac{{-b \pm \sqrt{{\Delta}}}}{{2a}} = \frac{{-({b:g}) \pm \sqrt{{{disc:g}}}}}{{2({a:g})}}",
                "equation"
            ))
            
            if disc >= 0:
                sqrt_disc = math.sqrt(disc)
                current_steps.append(MathStep(
                    "Simplify the quadratic formula",
                    rf"{var_name} = \frac{{{ -b:g} \pm {sqrt_disc:g}}}{{{2*a:g}}}",
                    "equation"
                ))
                x1 = (-b + sqrt_disc) / (2*a)
                x2 = (-b - sqrt_disc) / (2*a)
                all_roots.extend([x1, x2])
                current_steps.append(MathStep(
                    "Final quadratic roots",
                    rf"{var_name}_1 = {x1:g}, \quad {var_name}_2 = {x2:g}",
                    "equation"
                ))
            else:
                real = -b / (2*a)
                imag = math.sqrt(-disc) / (2*a)
                all_roots.extend([(real, imag), (real, -imag)])
                current_steps.append(MathStep(
                    "Simplify the complex roots",
                    rf"{var_name} = {real:g} \pm {imag:g}i",
                    "equation"
                ))
            return
            
        else:
            # Try Rational Root Theorem
            root, p_facs, q_facs, candidates = find_rational_root_details(current_coeffs)
            if root is not None:
                a_n = current_coeffs[d]
                a_0 = current_coeffs.get(0, 0)
                
                if p_facs:
                    current_steps.append(MathStep(
                        "Rational Root Theorem: List factors",
                        rf"\text{{Factors of constant term }} {a_0:g} \text{{ (p): }} \{{ {', '.join(map(str, p_facs))} \}} \\ "
                        rf"\text{{Factors of leading coefficient }} {a_n:g} \text{{ (q): }} \{{ {', '.join(map(str, q_facs))} \}}",
                        "equation"
                    ))
                    cand_strs = [f"\pm {c:g}" if c > 0 else f"{c:g}" for c in sorted([x for x in candidates if x > 0])]
                    current_steps.append(MathStep(
                        "Possible rational roots (p/q)",
                        rf"\{{ {', '.join(cand_strs)} \}}",
                        "equation"
                    ))
                
                current_steps.append(MathStep(
                    "Test candidates",
                    f"We substitute the candidates into the polynomial to find a root where P({var_name}) = 0.",
                    "text"
                ))
                
                # Show up to 2 failed tests for brevity, then the success
                failed_count = 0
                for cand in candidates:
                    val = evaluate_poly(current_coeffs, cand)
                    if abs(val) > 1e-8:
                        if failed_count < 2:
                            current_steps.append(MathStep(
                                f"Test {var_name} = {cand:g}",
                                rf"P({cand:g}) = {val:g} \neq 0",
                                "equation"
                            ))
                            failed_count += 1
                    else:
                        eval_latex = generate_evaluation_latex(current_coeffs, cand, var_name)
                        current_steps.append(MathStep(
                            f"Test {var_name} = {cand:g} (Success!)",
                            rf"P({cand:g}) = {eval_latex}",
                            "equation"
                        ))
                        break

                all_roots.append(root)
                
                # Synthetic Division
                new_coeffs, division_results = synthetic_division(current_coeffs, root)
                table_latex = generate_synthetic_division_latex(current_coeffs, root, division_results)
                current_steps.append(MathStep("Synthetic Division Table", table_latex, "equation"))
                
                reduced_poly_latex = poly_to_latex(new_coeffs, var_name)
                current_steps.append(MathStep(
                    "Reduced Polynomial",
                    rf"({var_name} - {root:g})({reduced_poly_latex}) = 0",
                    "equation"
                ))
                solve_recursive(new_coeffs, current_steps)
            else:
                if d >= 5:
                    reasoning = f"According to the Abel-Ruffini theorem, there is no general algebraic solution (using radicals) for polynomials of degree 5 or higher. Since no rational roots were found, we must approximate the roots."
                else:
                    reasoning = f"While general algebraic formulas exist for degree {d}, they are highly complex. Since no rational roots were found, it is standard practice to approximate the roots."
                
                current_steps.append(MathStep(
                    "Why numerical approximation?", 
                    reasoning, 
                    "text"
                ))
                
                current_steps.append(MathStep(
                    "Numerical Fallback", 
                    "Using an iterative numerical algorithm (Durand-Kerner method) to simultaneously approximate all complex and real roots.", 
                    "text"
                ))
                
                current_steps.append(MathStep(
                    "Durand-Kerner Method Explanation",
                    rf"\text{{The method starts with initial complex guesses for all }} {d} \text{{ roots and iteratively updates them using:}} \\ "
                    rf"x_i^{{(k+1)}} = x_i^{{(k)}} - \frac{{P(x_i^{{(k)}})}}{{a_n \prod_{{j \neq i}} (x_i^{{(k)}} - x_j^{{(k)}})}} \\ "
                    rf"\text{{This process is repeated until the roots converge to stable values.}}",
                    "equation"
                ))
                
                roots = durand_kerner(current_coeffs)
                for r in roots:
                    if abs(r.imag) < 1e-8:
                        all_roots.append(r.real)
                    else:
                        all_roots.append((r.real, r.imag))
                
                roots_str = []
                for r in roots:
                    if abs(r.imag) < 1e-8: roots_str.append(f"{var_name} \\approx {r.real:.6g}")
                    else: roots_str.append(f"{var_name} \\approx {r.real:.6g} {'+' if r.imag > 0 else '-'} {abs(r.imag):.6g}i")
                
                current_steps.append(MathStep("Approximate Numerical Roots", ", \\quad ".join(roots_str), "equation"))
                return

    solve_recursive(coeffs, steps)
    
    # Remove duplicates and format final roots
    unique_roots = []
    seen = set()
    for r in all_roots:
        if isinstance(r, tuple):
            key = (round(r[0], 6), round(r[1], 6))
            if key not in seen:
                unique_roots.append(r)
                seen.add(key)
        else:
            key = round(r, 6)
            if key not in seen:
                unique_roots.append(r)
                seen.add(key)
                
    res_strs = []
    for r in unique_roots:
        if isinstance(r, tuple):
            res_strs.append(f"{r[0]:g} {'+' if r[1] > 0 else '-'} {abs(r[1]):g}i")
        else:
            res_strs.append(f"{r:g}")
            
    steps.append(MathStep("Final Solutions", ", ".join(res_strs), "text"))
    return unique_roots, steps
