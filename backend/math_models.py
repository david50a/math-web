from dataclasses import dataclass
from typing import List, Union, Tuple, Any, Optional

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
    exp: int

def to_string(node: Node) -> str:
    if isinstance(node, Const):
        return str(node.value)
    if isinstance(node, Var):
        return node.name
    if isinstance(node, Add):
        return f"({to_string(node.left)} + {to_string(node.right)})"
    if isinstance(node, Mul):
        return f"({to_string(node.left)} * {to_string(node.right)})"
    if isinstance(node, Pow):
        return f"({to_string(node.base)}^{node.exp})"
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
        res = f"{to_latex(node.left, 1)} + {to_latex(node.right, 1)}"
        return f"({res})" if prec > 1 else res
    if isinstance(node, Mul):
        l_str = to_latex(node.left, 2)
        r_str = to_latex(node.right, 2)
        # Omission of \cdot only if right side doesn't start with a digit or dot
        if isinstance(node.left, Const) and not (r_str[0].isdigit() or r_str[0] == '.'):
            res = f"{l_str}{r_str}"
        else:
            res = rf"{l_str} \cdot {r_str}"
        return f"({res})" if prec > 2 else res
    if isinstance(node, Pow):
        base_str = to_latex(node.base, 3)
        return rf"{base_str}^{{{node.exp}}}"
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
    return node
