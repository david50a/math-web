from typing import List, Tuple
from math_models import MathStep, Node, Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln, to_string, to_latex, simplify

def derive(node: Node) -> Tuple[Node, List[MathStep]]:
    steps = []

    if isinstance(node, Const):
        res = Const(0)
        steps.append(MathStep(f"The derivative of {to_string(node)} is 0", to_latex(res), "equation", data=node))
        return res, steps
    if isinstance(node, Var):
        res = Const(1)
        steps.append(MathStep(f"The derivative of {to_string(node)} is 1", to_latex(res), "equation", data=node))
        return res, steps
    if isinstance(node, Add):
        left_derive, left_steps = derive(node.left)
        right_derive, right_steps = derive(node.right)
        steps.extend(left_steps)
        steps.extend(right_steps)
        res = Add(left_derive, right_derive)
        simplified = simplify(res)
        steps.append(MathStep(f"Deriving {to_string(node)} with Sum Rule", to_latex(simplified), "equation", data=node))
        return simplified, steps
    if isinstance(node, Mul):
        left_derive, left_steps = derive(node.left)
        right_derive, right_steps = derive(node.right)
        steps.extend(left_steps)
        steps.extend(right_steps)
        res = Add(Mul(left_derive, node.right), Mul(node.left, right_derive))
        simplified = simplify(res)
        steps.append(MathStep(f"Deriving {to_string(node)} with Product Rule", to_latex(simplified), "equation", data=node))
        return simplified, steps
    if isinstance(node, Pow):
        base_derive, base_steps = derive(node.base)
        steps.extend(base_steps)
        
        # Power Rule: (u^n)' = n * u^(n-1) * u'
        res = Mul(Mul(Const(float(node.exp)), Pow(node.base, node.exp - 1)), base_derive)
        simplified = simplify(res)
        
        steps.append(MathStep(f"Deriving {to_string(node)} with Power Rule", to_latex(simplified), "equation", data=node))
        return simplified, steps
    if isinstance(node, Sin):
        inner_derive, inner_steps = derive(node.inner)
        steps.extend(inner_steps)
        res = Mul(Cos(node.inner), inner_derive)
        simplified = simplify(res)
        steps.append(MathStep(f"Deriving {to_string(node)} with Chain Rule", to_latex(simplified), "equation", data=node))
        return simplified, steps
    if isinstance(node, Cos):
        inner_derive, inner_steps = derive(node.inner)
        steps.extend(inner_steps)
        res = Mul(Mul(Const(-1.0), Sin(node.inner)), inner_derive)
        simplified = simplify(res)
        steps.append(MathStep(f"Deriving {to_string(node)} with Chain Rule", to_latex(simplified), "equation", data=node))
        return simplified, steps
    if isinstance(node, Exp):
        inner_derive, inner_steps = derive(node.inner)
        steps.extend(inner_steps)
        res = Mul(Exp(node.inner), inner_derive)
        simplified = simplify(res)
        steps.append(MathStep(f"Deriving {to_string(node)} with Chain Rule", to_latex(simplified), "equation", data=node))
        return simplified, steps
    if isinstance(node, Ln):
        inner_derive, inner_steps = derive(node.inner)
        steps.extend(inner_steps)
        res = Mul(Pow(node.inner, -1), inner_derive)
        simplified = simplify(res)
        steps.append(MathStep(f"Deriving {to_string(node)} with Chain Rule", to_latex(simplified), "equation", data=node))
        return simplified, steps

    raise TypeError(f"Unknown node type: {type(node)}")

def power_rule(node: Node)-> Tuple[Node, List[MathStep]]:
    steps = []
    steps.append(MathStep(f"Original Expression: {to_string(node)}", to_latex(node), "equation"))
    steps.append(MathStep(f"Applying power rule", to_latex(node), "equation", data=node))
    steps.append(MathStep(f"$$(x^n)'=nx^{{n-1}}$$", to_latex(node), "equation", data=node))
    while isinstance(node.base, Node):
        base_derive, base_steps = derive(node.base)
        steps.extend(base_steps)
        steps.append(MathStep(f"Where the derivative of the base is {to_string(node.base)}", to_latex(node.base), "equation", data=node.base))
    
    # Power Rule: (u^n)' = n * u^(n-1) * u'
    res = Mul(Mul(Const(float(node.exp)), Pow(node.base, node.exp - 1)), base_derive)
    simplified = simplify(res)
    
    steps.append(MathStep(f"Deriving {to_string(node)} with Power Rule", to_latex(simplified), "equation", data=node))
    return simplified, steps
    
def product_rule(node: Node)-> Tuple[Node, List[MathStep]]:
    
    left_derive, left_steps = derive(node.left)
    right_derive, right_steps = derive(node.right)
    steps.extend(left_steps)
    steps.extend(right_steps)
    res = Add(Mul(left_derive, node.right), Mul(node.left, right_derive))
    simplified = simplify(res)
    steps.append(MathStep(f"Deriving {to_string(node)} with Product Rule", to_latex(simplified), "equation", data=node))
    return simplified, steps
    
def chain_rule(node: Node)-> Tuple[Node, List[MathStep]]:
    
    inner_derive, inner_steps = derive(node.inner)
    steps.extend(inner_steps)
    res = Mul(Cos(node.inner), inner_derive)
    simplified = simplify(res)
    steps.append(MathStep(f"Deriving {to_string(node)} with Chain Rule", to_latex(simplified), "equation", data=node))
    return simplified, steps

def quotient_rule(node: Node)-> Tuple[Node, List[MathStep]]:
    
    left_derive, left_steps = derive(node.left)
    right_derive, right_steps = derive(node.right)
    steps.extend(left_steps)
    steps.extend(right_steps)
    res = Add(Mul(left_derive, node.right), Mul(node.left, right_derive))
    simplified = simplify(res)
    steps.append(MathStep(f"Deriving {to_string(node)} with Product Rule", to_latex(simplified), "equation", data=node))
    return simplified, steps
    

if __name__ == "__main__":
    # Test derivative of x^2 + 3*x + sin(x)
    expr = Add(
        Add(Pow(Var(), 2), Mul(Const(3), Var())),
        Sin(Var())
    )

    solution, steps = derive(expr)

    print("Steps:")
    for step in steps:
        print(f"- {step.description}: {step.latex}")

    print("\nResult:")
    print(to_string(solution))
