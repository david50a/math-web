from typing import List, Tuple
from math_models import MathStep, Node, Const, Var, Add, Mul, Pow, to_string, to_latex, simplify

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
    raise TypeError(f"Unknown node type: {type(node)}")

if __name__ == "__main__":
    expr = Add(
        Pow(Var(), 2),
        Mul(Const(3), Var())
    )

    solution, steps = derive(expr)

    print("Steps:")
    for step in steps:
        print(f"- {step.description}: {step.latex}")

    print("\nResult:")
    print(to_string(solution))
