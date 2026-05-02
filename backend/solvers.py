from math_models import MathStep

def matrix_to_latex(matrix):
    if not matrix:
        return ""
    latex = r"\begin{pmatrix} "
    for row in matrix:
        latex += " & ".join([f"{val:.2f}" if isinstance(val, float) and abs(val - int(val)) > 1e-9 else str(int(val)) for val in row])
        latex += r" \\ "
    latex += r" \end{pmatrix}"
    return latex

def matrix_multiplication_fast_python(A, B):
    if len(A[0]) != len(B):
        raise ValueError("Invalid dimensions")
    B_T = list(zip(*B))
    result = [
        [sum(a * b for a, b in zip(row_a, col_b)) for col_b in B_T]
        for row_a in A
    ]
    return result
def matrix_rank(A:[[int]])->[[int]]:
    if len(A) != len(A[0]):
        raise ValueError("Invalid dimensions")
    rows,cols=len(A),len(A[0])
    for i in range(rows):
        for j in range(i+1,cols):
            x,y=A[i][i],A[j][i]
            if x==0 and y==0:
                continue
            A[j]=[y*A[i][k]-x*A[j][k] for k in range(cols)]
    return A

def rank_of_matrix(A):
    echelon, _ = gaussian_elimination(A)
    rank = 0

    for row in echelon:
        if any(abs(x) > 1e-9 for x in row):
            rank += 1

    return rank

def determinant(A:[[int]])->int:
    A=[row[:] for row in A]
    n=len(A)
    det=1
    if n!=len(A[0]):
        raise ValueError("Invalid dimensions")
    for i in range(n):
        pivot=i
        while pivot<n and A[pivot][i]==0:
            pivot+=1
        if pivot==n:
            return 0
        if pivot!=i:
            A[i],A[pivot]=A[pivot],A[i]
            det*=-1
        pivot_val=A[i][i]
        det*=pivot_val
        for j in range(i+1,n):
            factor=A[j][i]/pivot_val
            for k in range(i,n):
                A[j][k]-=factor*A[i][k]
    return det
  
def gaussian_elimination(A:[[int]])->[[int]]:
    A=[row[:] for row in A]
    rows,cols=len(A),len(A[0])
    steps=[]
    row=0
    for col in range(cols):
        if row>=rows:
            break
        pivot=row
        while pivot<rows and A[pivot][col]==0:
            pivot+=1
        if pivot==rows:
            continue
        A[row],A[pivot]=A[pivot],A[row]
        steps.append(MathStep(f"Swap row {row+1} and row {pivot+1}", matrix_to_latex(A), "matrix", [r[:] for r in A]))
        pivot_val=A[row][col]

        A[row] = [x / pivot_val for x in A[row]]
        steps.append(MathStep(f"Normalize row {row+1}", matrix_to_latex(A), "matrix", [r[:] for r in A]))

        for r in range(row+1,rows):
            factor=A[r][col]
            A[r]=[A[r][j]-factor*A[row][j] for j in range(cols)]
            steps.append(MathStep(f"Row {r+1} = Row {r+1} - {factor:.2f} * Row {row+1}", matrix_to_latex(A), "matrix", [r[:] for r in A]))
        row+=1

    return A,steps

def solve_linear_system(A:[[int]],b:[int])->[[int]]:
    n=len(A)
    aug=[A[i]+[b[i]] for i in range(n)]
    # Initial state
    steps = [MathStep("Initial augmented matrix", matrix_to_latex(aug), "matrix", [r[:] for r in aug])]
    epsilon, elimination_steps = gaussian_elimination(aug)
    steps.extend(elimination_steps)
    x=[0]*n
    for i in range(n-1,-1,-1):
        s= epsilon[i][-1]
        for j in range(i+1,n):
            s-=epsilon[i][j]*x[j]
        if abs(epsilon[i][i])<1e-9:
            raise ValueError("No unique solution")
        x[i]=s/epsilon[i][i]
    return x,steps


if __name__ == "__main__":
    A = [
        [2, 1],
        [4, 5]
    ]

    b = [5, 6]

    solution, steps = solve_linear_system(A, b)

    print("Solution:", solution)
    for step in steps:
        print(f"{step.description}: {step.latex}")
        print("------")