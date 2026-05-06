from .linear_algebra_solver import add, sub, multiply_by_constant, determinant, _zeros, matrix_to_latex
from math_models import Add, Const, Var, Pow, MathStep, to_latex, Node, simplify, Mul

def node_matrix_to_latex(matrix):
    if not matrix:
        return ""
    latex = r"\begin{pmatrix} "
    for row in matrix:
        latex += " & ".join([to_latex(val) if isinstance(val, Node) else str(val) for val in row])
        latex += r" \\ "
    latex += r" \end{pmatrix}"
    return latex

def sub_nodes(a: Node, b: Node) -> Node:
    return simplify(Add(a, Mul(Const(-1), b)))

def sympolic_determinat(matrix, steps: list[MathStep]) -> Node:
    n = len(matrix)
    if n == 1: return matrix[0][0]
    if n == 2:
        ad = Mul(matrix[0][0], matrix[1][1])
        steps.append(MathStep("Multiply the diagonal elements", to_latex(ad), "equation"))
        bc = Mul(matrix[0][1], matrix[1][0])
        steps.append(MathStep("Multiply the anti-diagonal elements", to_latex(bc), "equation"))
        result = simplify(sub_nodes(ad, bc))
        steps.append(MathStep("Subtract the anti-diagonal product from the diagonal product", to_latex(result), "equation"))
        return result
    det = Const(0)
    for c in range(n):
        minor_matrix = [row[:c] + row[c+1:] for row in matrix[1:]]
        sign = Const((-1)**c)
        term = Mul(Mul(sign, matrix[0][c]), sympolic_determinat(minor_matrix, steps))
        steps.append(MathStep(f"Multiply the element matrix[0][{c}] by its minor", to_latex(term), "equation"))
        det = Add(det, term)
        steps.append(MathStep("Add the term to running sum", to_latex(det), "equation"))
    return simplify(det)

def eigenvalue(A):
    n = len(A)
    steps = []
    if n != len(A[0]): raise ValueError("Matrix must be square")
    
    identity_matrix = _zeros(n, n)
    steps.append(MathStep("Create identity matrix", matrix_to_latex(identity_matrix), "matrix"))
    
    for i in range(n):
        identity_matrix[i][i] = Var('x')
        
    steps.append(MathStep("Multiply identity matrix by X", node_matrix_to_latex(identity_matrix), "matrix"))
    
    matrix = [[sub_nodes(Const(A[i][j]), Var('x')) if i == j else Const(A[i][j]) for j in range(n)] for i in range(n)]
    steps.append(MathStep("Create matrix A - XI", node_matrix_to_latex(matrix), "matrix"))
    
    equation = sympolic_determinat(matrix, steps)
    steps.append(MathStep("Calculate the determinant of A - XI", to_latex(equation), "equation"))
    
    equation = simplify(equation)
    steps.append(MathStep("Set the characteristic equation to 0", to_latex(equation), "equation"))
    
    return equation, steps