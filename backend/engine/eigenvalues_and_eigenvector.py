from linear_algebra_solver import add,sub,multiply_by_constant,determinant,_zeros
from ..math_models import Add 

def eigenvalue(A):
    n=len(A)
    unit_matrix=_zeros(n,n)
    for i in range(n):unit_matrix[i][i]='x'


    