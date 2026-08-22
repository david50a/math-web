import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from math_models import MathStep, Node, parse_expr, to_latex, Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln
import math
from typing import List, Tuple
from derivative import derive
def function_value(equation:str,x_val:float)->Tuple[float,List[MathStep]]:
    function=parse_expr(equation)
    steps=[]
    def indoor_solver(function:Node,value:float)->float:
        if isinstance(function, Add):
            left = indoor_solver(function.left, value)
            right = indoor_solver(function.right, value)
            steps.append(MathStep(f"Adding {left} and {right}", to_latex(Add(Const(left), Const(right))), "equation"))
            return left + right
        elif isinstance(function, Mul):
            left = indoor_solver(function.left, value)
            right = indoor_solver(function.right, value)
            steps.append(MathStep(f"Multiplying {left} and {right}", to_latex(Mul(Const(left), Const(right))), "equation"))
            return left * right
        elif isinstance(function, Pow):
            base = indoor_solver(function.base, value)
            steps.append(MathStep(f"Raising {base} to the power of {function.exp}", to_latex(Pow(Const(base), function.exp)), "equation"))
            return base ** function.exp
        elif isinstance(function, Sin):
            inner = indoor_solver(function.inner, value)
            steps.append(MathStep(f"Taking the sine of {inner}", to_latex(Sin(Const(inner))), "equation"))
            return math.sin(inner)
        elif isinstance(function, Cos):
            inner = indoor_solver(function.inner, value)
            steps.append(MathStep(f"Taking the cosine of {inner}", to_latex(Cos(Const(inner))), "equation"))
            return math.cos(inner)
        elif isinstance(function, Exp):
            inner = indoor_solver(function.inner, value)
            steps.append(MathStep(f"Taking the exponential of {inner}", to_latex(Exp(Const(inner))), "equation"))
            return math.exp(inner)
        elif isinstance(function, Ln):
            inner = indoor_solver(function.inner, value)
            steps.append(MathStep(f"Taking the natural logarithm of {inner}", to_latex(Ln(Const(inner))), "equation"))
            return math.log(inner)
        elif isinstance(function, Var):
            steps.append(MathStep(f"Substituting {function.name} with {value}", to_latex(Const(value)), "equation"))
            return value
        elif isinstance(function, Const):
            return function.value
        else:
            return 0.0
    
    return indoor_solver(function,x_val),steps
    
def derivative_value(equation:str,x_val:float)->Tuple[float,List[MathStep]]:
    x=parse_expr(equation)
    dx,steps=derive(x)
    steps.append(MathStep(f"Substituting x with {x_val} for get the value for the derivative", to_latex(Const(x_val)), "equation"))
    def indoor_solver(function:Node,value:float)->float:
        if isinstance(function, Add):
            left = indoor_solver(function.left, value)
            right = indoor_solver(function.right, value)
            steps.append(MathStep(f"Adding {left} and {right}", to_latex(Add(Const(left), Const(right))), "equation"))
            return left + right
        elif isinstance(function, Mul):
            left = indoor_solver(function.left, value)
            right = indoor_solver(function.right, value)
            steps.append(MathStep(f"Multiplying {left} and {right}", to_latex(Mul(Const(left), Const(right))), "equation"))
            return left * right
        elif isinstance(function, Pow):
            base = indoor_solver(function.base, value)
            steps.append(MathStep(f"Raising {base} to the power of {function.exp}", to_latex(Pow(Const(base), function.exp)), "equation"))
            return base ** function.exp
        elif isinstance(function, Sin):
            inner = indoor_solver(function.inner, value)
            steps.append(MathStep(f"Taking the sine of {inner}", to_latex(Sin(Const(inner))), "equation"))
            return math.sin(inner)
        elif isinstance(function, Cos):
            inner = indoor_solver(function.inner, value)
            steps.append(MathStep(f"Taking the cosine of {inner}", to_latex(Cos(Const(inner))), "equation"))
            return math.cos(inner)
        elif isinstance(function, Exp):
            inner = indoor_solver(function.inner, value)
            steps.append(MathStep(f"Taking the exponential of {inner}", to_latex(Exp(Const(inner))), "equation"))
            return math.exp(inner)
        elif isinstance(function, Ln):
            inner = indoor_solver(function.inner, value)
            steps.append(MathStep(f"Taking the natural logarithm of {inner}", to_latex(Ln(Const(inner))), "equation"))
            return math.log(inner)
        elif isinstance(function, Var):
            steps.append(MathStep(f"Substituting {function.name} with {value}", to_latex(Const(value)), "equation"))
            return value
        elif isinstance(function, Const):
            return function.value
        else:
            return 0.0
    
    return indoor_solver(dx,x_val),steps

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

def solve_equation(equation: str, type_of_equation: str = 'one_variable') -> Tuple[float, List[MathStep]]:
    steps = []
    
    if '=' in equation:
        lhs_str, rhs_str = equation.split('=', 1)
    else:
        lhs_str, rhs_str = equation, '0'
        
    lhs_node = parse_expr(lhs_str)
    rhs_node = parse_expr(rhs_str)
    
    combined_node = Add(lhs_node, Mul(Const(-1.0), rhs_node))
    
    steps.append(MathStep(f"Original Equation: {equation}", f"{to_latex(lhs_node)} = {to_latex(rhs_node)}", "equation"))
    
    if type_of_equation == 'one_variable':
        var_coeff, const_term = get_linear_coeffs(combined_node)
        
        v_str = f"{int(var_coeff)}" if var_coeff == int(var_coeff) else f"{var_coeff:.4g}"
        c_str = f"{int(const_term)}" if const_term == int(const_term) else f"{const_term:.4g}"
        
        sign = "+" if const_term >= 0 else ""
        print(f"{v_str}x{sign}{c_str}=0")
        
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
        sol_str = f"{int(sol)}" if sol == int(sol) else f"{sol:.4g}"
        
        steps.append(MathStep(f"Isolate variable term", f"{v_str}x = {-const_term:.4g}", "equation"))
        steps.append(MathStep(f"Solve for x", f"x = {sol_str}", "equation"))
        
        return sol, steps
    else:
        raise Exception('Invalid equation type')

def quadratic_equation_solver(equation:str):
    steps = []
    steps.append(MathStep(f"Original Equation: {equation}", f"{equation}", "equation"))
    steps.append(MathStep(f"Every Quadratic Equation must have the form of ax^2+bx+c=0 so first we move all the terms to the left side", f"{equation}", "equation"))
    steps.append(MathStep(f"We will find a,b,c", f"{equation}", "equation"))
    length=len(equation)
    for i in range(length):
        if equation[i]=='=':break
        elif equation[i]=='x':
            if length>i+2 and equation[i+1]=='^' and equation[i+2]=='2':
                j=i-1
                while equation[j].isdigit() and j>=0:
                    j-=1
                if i==j+1:
                    a=1.0
                else:
                    a_str=equation[j+1:i]
                    a=float(a_str)
                if j>0 and equation[j-1]=='-':
                    a=-a
            else:
                j=i-1
                while equation[j].isdigit() and j>=0:
                    j-=1
                if i==j:
                    b=1.0
                else:
                    b_str=equation[j:i]
                    b=float(b_str)
                if j>0 and equation[j-1]=='-':
                    b=-b
        elif equation[i].isdigit(): 
            j=i
            while j<length and equation[j].isdigit():
                j+=1
            if i==j:
                c=1.0
            else:
                c_str=equation[i:j]
                c=float(c_str)
            if j>0 and equation[j-1]=='-':
                c=-c
    print(a,b,c)
    steps.append(MathStep(f"The coefficients are a={a}, b={b}, c={c}", f"{a}x^2+{b}x+{c}=0", "equation"))
    steps.append(MathStep(f"We will use the quadratic formula to solve for x: x = (-b ± sqrt(b^2 - 4ac)) / 2a", f"{a}x^2+{b}x+{c}=0", "equation"))
    delta = b**2 - 4*a*c
    steps.append(MathStep(f"The discriminant is delta = b^2 - 4ac = {delta}", f"{a}x^2+{b}x+{c}=0", "equation"))
    if delta < 0:
        steps.append(MathStep(f"The discriminant is negative, so there are no real solutions", f"{a}x^2+{b}x+{c}=0", "equation"))
        return None, steps
    elif delta == 0:
        steps.append(MathStep(f"The discriminant is zero, so there is one real solution", f"{a}x^2+{b}x+{c}=0", "equation"))
        steps.append(MathStep(f"The solution is x = -b / 2a", f"{a}x^2+{b}x+{c}=0", "equation"))
        steps.append(MathStep(f"The solution is x = {-b / (2*a)}", f"{a}x^2+{b}x+{c}=0", "equation"))
        return -b / (2*a), steps
    else:
        steps.append(MathStep(f"The discriminant is positive, so there are two real solutions", f"{a}x^2+{b}x+{c}=0", "equation"))
        steps.append(MathStep(f"The solutions are x = (-b ± sqrt(delta)) / 2a", f"{a}x^2+{b}x+{c}=0", "equation"))
        steps.append(MathStep(f"The solutions are x = ({-b + delta**0.5}) / {2*a} and x = ({-b - delta**0.5}) / {2*a}", f"{a}x^2+{b}x+{c}=0", "equation"))
        return (-b + delta**0.5) / (2*a), (-b - delta**0.5) / (2*a), steps
    
if __name__ == '__main__':
    expression = 'x^2-16x-9=0'
    print(quadratic_equation_solver(expression))

