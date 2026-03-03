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
def rank_of_matrix(x)->int:
    rows,cols=len(x),len(x[0])
    rank=rows
    for i in range(0,rows,-1):
        for j in range(0,cols,-1):
            if x[i][j]!=0:
                return rank
        rank-=1
    return rank

def determinant(A:[[int]])->int:
    if len(A) != len(A[0]):
        raise ValueError("Invalid dimensions")
    if len(A) == 1:
        return A[0][0]
    if len(A) == 2:
        return A[0][0] * A[1][1] - A[0][1] * A[1][0]
    if len(A) == 3:
        return (A[0][0]*A[1][1]*A[2][2] + A[0][1]*A[1][2]*A[2][0] + A[0][2]*A[1][0]*A[2][1] -
                A[0][2]*A[1][1]*A[2][0] - A[0][1]*A[1][0]*A[2][2] - A[0][0]*A[1][2]*A[2][1])
    
    det = 0
    for c in range(len(A)):
        minor = [row[:c] + row[c+1:] for row in A[1:]]
        det += ((-1)**c) * A[0][c] * determinant(minor)
    return det

def linear_systems_gauss(A:[[int]], x:[int]):
    if len(A) != len(A[0]):
        raise ValueError("Invalid dimensions")
    A=matrix_rank(A)
    rank=rank_of_matrix(A)
    if rank<x:
        return 'infinity solutions'

