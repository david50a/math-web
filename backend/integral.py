from typing import List, Tuple
from math_models import MathStep, Node, Const, Var, Add, Mul, Pow, to_string, to_latex, simplify

def integrate_node(node: Node) -> Tuple[Node, List[MathStep]]:
    steps = []

    # Constant rule
    if isinstance(node, Const):
        res = Mul(Const(node.value), Var())
        steps.append(MathStep(f"Apply constant rule to {to_string(node)}", to_latex(res), "equation", data=node))
        return res, steps

    # Variable rule
    if isinstance(node, Var):
        res = Mul(Const(0.5), Pow(Var(), 2))
        steps.append(MathStep("Apply variable rule to x", to_latex(res), "equation", data=node))
        return res, steps

    # Sum rule
    if isinstance(node, Add):
        left_i, left_steps = integrate_node(node.left)
        right_i, right_steps = integrate_node(node.right)
        steps.extend(left_steps)
        steps.extend(right_steps)
        res = simplify(Add(left_i, right_i))
        steps.append(MathStep(f"Apply sum rule to {to_string(node)}", to_latex(res), "equation", data=node))
        return res, steps

    # Constant multiple rule
    if isinstance(node, Mul):
        if isinstance(node.left, Const):
            c = node.left.value
            inner_i, inner_steps = integrate_node(node.right)
            steps.extend(inner_steps)
            res = simplify(Mul(Const(c), inner_i))
            steps.append(MathStep(f"Pull out constant {c}", to_latex(res), "equation", data=node))
            return res, steps

    # Power rule (x^n)
    if isinstance(node, Pow) and isinstance(node.base, Var):
        n = node.exp
        if n == -1:
            raise Exception("Use ln(x) rule for x^-1")

        res = Mul(Const(1 / (n + 1)), Pow(Var(), n + 1))
        steps.append(MathStep(f"Apply power rule to {to_string(node)}", to_latex(res), "equation", data=node))
        return res, steps

    raise Exception("Unsupported expression")

if __name__ == "__main__":
    expr = Add(
        Pow(Var(), 2),
        Mul(Const(3), Var())
    )

    result, steps = integrate_node(expr)

    print("Steps:")
    for step in steps:
        print(f"- {step.description}: {step.latex}")

    print("\nResult:")
    print(to_string(result) + " + C")
