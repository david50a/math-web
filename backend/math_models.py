from dataclasses import dataclass
from typing import List, Union, Tuple, Any, Optional
import re
import ast

@dataclass
class MathStep:
    description: str
    latex: str
    type: str  # 'matrix', 'equation', 'text'
    data: Any = None

class Node:
    pass

@dataclass
class Const(Node):
    value: float

@dataclass
class Var(Node):
    name: str = 'x'

@dataclass
class Add(Node):
    left: Node
    right: Node

@dataclass
class Mul(Node):
    left: Node
    right: Node

@dataclass
class Pow(Node):
    base: Node
    exp: Union[int, float]

@dataclass
class Sin(Node):
    inner: Node

@dataclass
class Cos(Node):
    inner: Node

@dataclass
class Tan(Node):
    inner: Node

@dataclass
class Sec(Node):
    inner: Node

@dataclass
class Exp(Node):
    inner: Node

@dataclass
class Ln(Node):
    inner: Node

@dataclass
class Arcsin(Node):
    inner: Node

@dataclass
class Arctan(Node):
    inner: Node

def to_string(node: Node) -> str:
    if isinstance(node, Const):
        val = node.value
        if abs(val - int(val)) < 1e-9:
            return str(int(val))
        return f"{val:.2f}"
    if isinstance(node, Var):
        return node.name
    if isinstance(node, Add):
        return f"({to_string(node.left)} + {to_string(node.right)})"
    if isinstance(node, Mul):
        return f"({to_string(node.left)} * {to_string(node.right)})"
    if isinstance(node, Pow):
        exp_val = node.exp
        if isinstance(exp_val, float) and abs(exp_val - int(exp_val)) < 1e-9:
            exp_val = int(exp_val)
        return f"({to_string(node.base)}^{exp_val})"
    if isinstance(node, Sin):
        return f"sin({to_string(node.inner)})"
    if isinstance(node, Cos):
        return f"cos({to_string(node.inner)})"
    if isinstance(node, Tan):
        return f"tan({to_string(node.inner)})"
    if isinstance(node, Sec):
        return f"sec({to_string(node.inner)})"
    if isinstance(node, Exp):
        return f"e^({to_string(node.inner)})"
    if isinstance(node, Ln):
        return f"ln({to_string(node.inner)})"
    if isinstance(node, Arcsin):
        return f"arcsin({to_string(node.inner)})"
    if isinstance(node, Arctan):
        return f"arctan({to_string(node.inner)})"
    raise TypeError(f"Unknown node type: {type(node)}")

def to_latex(node: Node, prec: int = 0) -> str:
    # Operator precedence: Add: 1, Mul: 2, Pow: 3, Atoms: 4
    if isinstance(node, Const):
        val = node.value
        if abs(val - int(val)) < 1e-9:
            return str(int(val))
        return f"{val:.2f}"
    if isinstance(node, Var):
        return node.name
    if isinstance(node, Add):
        # Handle subtraction formatting: A + (-1 * B) -> A - B
        if isinstance(node.right, Mul) and isinstance(node.right.left, Const) and node.right.left.value < 0:
            pos_const = Const(-node.right.left.value)
            pos_right = node.right.right if pos_const.value == 1 else Mul(pos_const, node.right.right)
            res = f"{to_latex(node.left, 1)} - {to_latex(pos_right, 1)}"
            return f"({res})" if prec > 1 else res
        elif isinstance(node.right, Const) and node.right.value < 0:
            res = f"{to_latex(node.left, 1)} - {to_latex(Const(-node.right.value), 1)}"
            return f"({res})" if prec > 1 else res
        else:
            res = f"{to_latex(node.left, 1)} + {to_latex(node.right, 1)}"
            return f"({res})" if prec > 1 else res
    if isinstance(node, Mul):
        # Handle fraction format A / B when right term is Pow(B, -1)
        if isinstance(node.right, Pow) and node.right.exp == -1:
            return rf"\frac{{{to_latex(node.left, 0)}}}{{{to_latex(node.right.base, 0)}}}"
        # Handle -1 * X -> -X
        if isinstance(node.left, Const) and node.left.value == -1:
            r_str = to_latex(node.right, 2)
            return f"-{r_str}"
        l_str = to_latex(node.left, 2)
        r_str = to_latex(node.right, 2)
        # Omission of \cdot only if left is Const and right doesn't start with a digit, dot, or minus
        if isinstance(node.left, Const) and r_str and not (r_str[0].isdigit() or r_str[0] in ['.', '-']):
            res = f"{l_str}{r_str}"
        else:
            res = rf"{l_str} \cdot {r_str}"
        return f"({res})" if prec > 2 else res
    if isinstance(node, Pow):
        if node.exp == -1:
            return rf"\frac{{1}}{{{to_latex(node.base, 0)}}}"
        exp_val = node.exp
        if isinstance(exp_val, float) and abs(exp_val - int(exp_val)) < 1e-9:
            exp_val = int(exp_val)
        base_str = to_latex(node.base, 3)
        return rf"{base_str}^{{{exp_val}}}"
    if isinstance(node, Sin):
        return rf"\sin\left({to_latex(node.inner, 0)}\right)"
    if isinstance(node, Cos):
        return rf"\cos\left({to_latex(node.inner, 0)}\right)"
    if isinstance(node, Tan):
        return rf"\tan\left({to_latex(node.inner, 0)}\right)"
    if isinstance(node, Sec):
        return rf"\sec\left({to_latex(node.inner, 0)}\right)"
    if isinstance(node, Exp):
        return rf"e^{{{to_latex(node.inner, 0)}}}"
    if isinstance(node, Ln):
        return rf"\ln\left({to_latex(node.inner, 0)}\right)"
    if isinstance(node, Arcsin):
        return rf"\arcsin\left({to_latex(node.inner, 0)}\right)"
    if isinstance(node, Arctan):
        return rf"\arctan\left({to_latex(node.inner, 0)}\right)"
    raise TypeError(f"Unknown node type: {type(node)}")

def simplify(node: Node) -> Node:
    if isinstance(node, Add):
        l, r = simplify(node.left), simplify(node.right)
        if isinstance(l, Const) and l.value == 0: return r
        if isinstance(r, Const) and r.value == 0: return l
        if isinstance(l, Const) and isinstance(r, Const): return Const(l.value + r.value)
        return Add(l, r)
    if isinstance(node, Mul):
        l, r = simplify(node.left), simplify(node.right)
        if (isinstance(l, Const) and l.value == 0) or (isinstance(r, Const) and r.value == 0): return Const(0)
        if isinstance(l, Const) and l.value == 1: return r
        if isinstance(r, Const) and r.value == 1: return l
        if isinstance(l, Const) and isinstance(r, Const): return Const(l.value * r.value)
        # Fold nested constants: c1 * (c2 * x) -> (c1 * c2) * x
        if isinstance(l, Const) and isinstance(r, Mul) and isinstance(r.left, Const):
            return simplify(Mul(Const(l.value * r.left.value), r.right))
        return Mul(l, r)
    if isinstance(node, Pow):
        b = simplify(node.base)
        if node.exp == 0: return Const(1)
        if node.exp == 1: return b
        return Pow(b, node.exp)
    if isinstance(node, Sin): return Sin(simplify(node.inner))
    if isinstance(node, Cos): return Cos(simplify(node.inner))
    if isinstance(node, Tan): return Tan(simplify(node.inner))
    if isinstance(node, Sec): return Sec(simplify(node.inner))
    if isinstance(node, Exp): return Exp(simplify(node.inner))
    if isinstance(node, Ln): return Ln(simplify(node.inner))
    if isinstance(node, Arcsin): return Arcsin(simplify(node.inner))
    if isinstance(node, Arctan): return Arctan(simplify(node.inner))
    return node

def parse_expr(expr_str: str):
    # Strip y = or f(x) = prefix
    expr_str = re.sub(r'^(y|f\(x\))\s*=\s*', '', expr_str.strip(), flags=re.IGNORECASE)
    
    # Convert implicit multiplication: 2(x+1) -> 2*(x+1), x(x+1) -> x*(x+1), (x+1)(x-2) -> (x+1)*(x-2)
    expr_str = expr_str.replace(')(', ')*(')
    expr_str = re.sub(r'(\d)\(', r'\1*(', expr_str)
    expr_str = re.sub(r'\bx\(', r'x*(', expr_str)

    # Convert e^(...) or e^x -> exp(...)
    expr_str = re.sub(r'\be\^\((.*?)\)', r'exp(\1)', expr_str)
    expr_str = re.sub(r'\be\^([a-zA-Z0-9_]+)', r'exp(\1)', expr_str)
    
    # Convert function syntax without parentheses
    for func in ['sin', 'cos', 'tan', 'sec', 'ln', 'exp', 'arcsin', 'arctan', 'sqrt']:
        expr_str = re.sub(rf'\b{func}\s+([a-zA-Z0-9_]+)', rf'{func}(\1)', expr_str, flags=re.IGNORECASE)
        
    expr_str = expr_str.replace('^', '**')
    # Handle some common math notation differences
    expr_str = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', expr_str) # 3x -> 3*x
    
    tree = ast.parse(expr_str, mode='eval')
    
    def transform(node):
        if isinstance(node, ast.Expression):
            return transform(node.body)
        if isinstance(node, ast.BinOp):
            if isinstance(node.op, ast.Pow) and isinstance(node.left, ast.Name) and node.left.id == 'e':
                return Exp(transform(node.right))
            left = transform(node.left)
            right = transform(node.right)
            if isinstance(node.op, ast.Add):
                return Add(left, right)
            if isinstance(node.op, ast.Sub):
                return Add(left, Mul(Const(-1.0), right))
            if isinstance(node.op, ast.Mult):
                return Mul(left, right)
            if isinstance(node.op, ast.Div):
                return Mul(left, Pow(right, -1))
            if isinstance(node.op, ast.Pow):
                if isinstance(right, Const):
                    return Pow(left, right.value)
                raise ValueError("Exponent must be constant")
        if isinstance(node, (ast.Num, ast.Constant)):
            val = node.n if hasattr(node, 'n') else node.value
            return Const(float(val))
        if isinstance(node, ast.Name):
            if node.id == 'x':
                return Var('x')
            if node.id == 'e':
                return Exp(Var())
            raise ValueError(f"Unknown variable: {node.id}")
        if isinstance(node, ast.Call):
            func = node.func.id.lower()
            arg = transform(node.args[0])
            if func == 'sin': return Sin(arg)
            if func == 'cos': return Cos(arg)
            if func == 'tan': return Tan(arg)
            if func == 'sec': return Sec(arg)
            if func == 'exp': return Exp(arg)
            if func == 'ln': return Ln(arg)
            if func == 'arcsin': return Arcsin(arg)
            if func == 'arctan': return Arctan(arg)
            if func == 'sqrt': return Pow(arg, 0.5)
        if isinstance(node, ast.UnaryOp):
            if isinstance(node.op, ast.USub):
                return Mul(Const(-1.0), transform(node.operand))
        raise ValueError(f"Unsupported node type: {type(node)}")

    return transform(tree)

        