from fractions import Fraction
import math


class Step:
    def __init__(self, matrix=[], description: str = "", extra=None):
        """
        matrix      – snapshot of the working matrix at this point
        description – human-readable explanation of what happened
        extra       – optional dict for side data (e.g. L, P in LU; det so far)
        """
        self.matrix = [row[:] for row in matrix] if matrix else []
        self.description = description
        self.extra = extra or {}

    def __repr__(self):
        return self.description


# ──────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────

def _copy(A):
    return [row[:] for row in A]

def _identity(n):
    return [[1 if i == j else 0 for j in range(n)] for i in range(n)]

def _zeros(rows, cols):
    return [[0] * cols for _ in range(rows)]

def pretty_print(A, title=""):
    if title:
        print(f"\n{title}")
    col_widths = [max(len(f"{A[r][c]:.4g}") for r in range(len(A))) for c in range(len(A[0]))]
    for row in A:
        print("  [ " + "  ".join(f"{v:{w}.4g}" for v, w in zip(row, col_widths)) + " ]")

def print_steps(steps):
    for i, s in enumerate(steps, 1):
        print(f"  Step {i}: {s.description}")
        if s.matrix:
            pretty_print(s.matrix)
        if s.extra:
            for k, v in s.extra.items():
                print(f"    {k}: {v}")
        print()


# ──────────────────────────────────────────────
#  Matrix Multiplication (with steps)
# ──────────────────────────────────────────────

def matrix_multiplication(A, B):
    """Standard A x B without step tracking (used internally)."""
    if len(A[0]) != len(B):
        raise ValueError("Invalid dimensions")
    B_T = list(zip(*B))
    return [[sum(a * b for a, b in zip(row_a, col_b)) for col_b in B_T] for row_a in A]


def matrix_multiplication_steps(A, B):
    """
    Multiply A (m x k) by B (k x n) with full per-cell dot-product steps.
    Returns (result, steps).
    """
    if len(A[0]) != len(B):
        raise ValueError("Invalid dimensions")
    m, k, n = len(A), len(B), len(B[0])
    result = _zeros(m, n)
    steps = []
    steps.append(Step([], f"Start: A is {m}x{k}, B is {k}x{n} -> result will be {m}x{n}"))
    for i in range(m):
        for j in range(n):
            terms = [f"{A[i][c]:.4g}x{B[c][j]:.4g}" for c in range(k)]
            val = sum(A[i][c] * B[c][j] for c in range(k))
            result[i][j] = val
            steps.append(Step(
                _copy(result),
                f"result[{i+1}][{j+1}] = {' + '.join(terms)} = {val:.4g}"
            ))
    steps.append(Step(result, "Multiplication complete"))
    return result, steps


# ──────────────────────────────────────────────
#  Determinant
# ──────────────────────────────────────────────

def determinant(A):
    """
    Compute det(A) via partial-pivot Gaussian elimination.
    Returns (det, steps).
    """
    A = _copy(A)
    n = len(A)
    if n != len(A[0]):
        raise ValueError("Matrix must be square")
    det = 1
    steps = []
    steps.append(Step(_copy(A), f"Start: {n}x{n} matrix, running det = 1"))
    for i in range(n):
        pivot = i
        while pivot < n and A[pivot][i] == 0:
            pivot += 1
        if pivot == n:
            steps.append(Step(_copy(A), f"Column {i+1} is all zeros -> det = 0"))
            return 0, steps
        if pivot != i:
            A[i], A[pivot] = A[pivot], A[i]
            det *= -1
            steps.append(Step(_copy(A), f"Swap row {i+1} <-> row {pivot+1}: sign flips, det = {det:.4g}"))
        pivot_val = A[i][i]
        det *= pivot_val
        steps.append(Step(_copy(A), f"Pivot A[{i+1}][{i+1}] = {pivot_val:.4g}: multiply into det -> det = {det:.4g}"))
        for j in range(i + 1, n):
            factor = A[j][i] / pivot_val
            for k in range(i, n):
                A[j][k] -= factor * A[i][k]
            steps.append(Step(_copy(A), f"Eliminate: Row {j+1} = Row {j+1} - {factor:.4g} x Row {i+1}"))
    steps.append(Step(_copy(A), f"Upper-triangular form reached -> det = {det:.4g}"))
    return det, steps


# ──────────────────────────────────────────────
#  Gaussian Elimination (forward -> REF)
# ──────────────────────────────────────────────

def gaussian_elimination(A):
    """
    Forward elimination -> row echelon form.
    Returns (echelon, steps).
    """
    A = _copy(A)
    rows, cols = len(A), len(A[0])
    steps = []
    steps.append(Step(_copy(A), f"Start Gaussian elimination on {rows}x{cols} matrix"))
    row = 0
    for col in range(cols):
        if row >= rows:
            break
        pivot = row
        while pivot < rows and abs(A[pivot][col]) < 1e-9:
            pivot += 1
        if pivot == rows:
            steps.append(Step(_copy(A), f"Column {col+1}: no pivot found, skip"))
            continue
        if pivot != row:
            A[row], A[pivot] = A[pivot], A[row]
            steps.append(Step(_copy(A), f"Swap row {row+1} <-> row {pivot+1} to bring pivot to front"))
        pivot_val = A[row][col]
        A[row] = [x / pivot_val for x in A[row]]
        steps.append(Step(_copy(A), f"Normalize row {row+1}: divide every element by pivot {pivot_val:.4g}"))
        for r in range(row + 1, rows):
            factor = A[r][col]
            if abs(factor) < 1e-9:
                continue
            A[r] = [A[r][j] - factor * A[row][j] for j in range(cols)]
            steps.append(Step(_copy(A), f"Eliminate: Row {r+1} = Row {r+1} - {factor:.4g} x Row {row+1}"))
        row += 1
    steps.append(Step(_copy(A), "Row echelon form reached"))
    return A, steps


# ──────────────────────────────────────────────
#  Reduced Row Echelon Form (RREF)
# ──────────────────────────────────────────────

def reduced_row_echelon(A):
    """
    Full Gauss-Jordan elimination -> RREF.
    Returns (rref, steps).
    """
    A = _copy(A)
    rows, cols = len(A), len(A[0])
    steps = []
    steps.append(Step(_copy(A), f"Start RREF (Gauss-Jordan) on {rows}x{cols} matrix"))
    pivot_row = 0
    for col in range(cols):
        if pivot_row >= rows:
            break
        pivot = pivot_row
        while pivot < rows and abs(A[pivot][col]) < 1e-9:
            pivot += 1
        if pivot == rows:
            steps.append(Step(_copy(A), f"Column {col+1}: no pivot, skip"))
            continue
        if pivot != pivot_row:
            A[pivot_row], A[pivot] = A[pivot], A[pivot_row]
            steps.append(Step(_copy(A), f"Swap row {pivot_row+1} <-> row {pivot+1}"))
        pv = A[pivot_row][col]
        A[pivot_row] = [x / pv for x in A[pivot_row]]
        steps.append(Step(_copy(A), f"Normalize row {pivot_row+1}: divide by {pv:.4g}"))
        for r in range(rows):
            if r == pivot_row:
                continue
            factor = A[r][col]
            if abs(factor) < 1e-9:
                continue
            A[r] = [A[r][j] - factor * A[pivot_row][j] for j in range(cols)]
            steps.append(Step(_copy(A), f"Eliminate: Row {r+1} = Row {r+1} - {factor:.4g} x Row {pivot_row+1}"))
        pivot_row += 1
    steps.append(Step(_copy(A), "RREF complete"))
    return A, steps


# ──────────────────────────────────────────────
#  Solve Linear System  Ax = b
# ──────────────────────────────────────────────

def solve_linear_system(A, b):
    """
    Solve Ax = b via augmented Gaussian elimination + back-substitution.
    Returns (x, steps).
    """
    n = len(A)
    aug = [A[i][:] + [b[i]] for i in range(n)]
    steps = []
    steps.append(Step(_copy(aug), "Build augmented matrix [A | b]"))
    echelon, elim_steps = gaussian_elimination(aug)
    steps.extend(elim_steps)
    x = [0.0] * n
    steps.append(Step(_copy(echelon), "Begin back-substitution (bottom to top)"))
    for i in range(n - 1, -1, -1):
        s = echelon[i][-1]
        for j in range(i + 1, n):
            s -= echelon[i][j] * x[j]
        if abs(echelon[i][i]) < 1e-9:
            raise ValueError("No unique solution")
        x[i] = s / echelon[i][i]
        steps.append(Step(_copy(echelon),
            f"x[{i+1}] = ({echelon[i][-1]:.4g} - sum of known terms) / {echelon[i][i]:.4g} = {x[i]:.6g}"))
    steps.append(Step([], f"Solution: x = {[round(v, 6) for v in x]}"))
    return x, steps


def rank_of_matrix(A):
    echelon, _ = gaussian_elimination(A)
    return sum(1 for row in echelon if any(abs(x) > 1e-9 for x in row))


# ──────────────────────────────────────────────
#  Inverse (Gauss-Jordan on [A | I])
# ──────────────────────────────────────────────

def inverse(A):
    """
    Compute A^-1 via Gauss-Jordan on [A | I].
    Returns (inv, steps).
    """
    n = len(A)
    if n != len(A[0]):
        raise ValueError("Matrix must be square")
    aug = [A[i][:] + [1 if i == j else 0 for j in range(n)] for i in range(n)]
    steps = []
    steps.append(Step(_copy(aug), "Build augmented matrix [A | I] for Gauss-Jordan inversion"))
    for col in range(n):
        pivot = col
        while pivot < n and abs(aug[pivot][col]) < 1e-9:
            pivot += 1
        if pivot == n:
            raise ValueError("Matrix is singular - inverse does not exist")
        if pivot != col:
            aug[col], aug[pivot] = aug[pivot], aug[col]
            steps.append(Step(_copy(aug), f"Swap row {col+1} <-> row {pivot+1} to bring pivot"))
        pv = aug[col][col]
        aug[col] = [x / pv for x in aug[col]]
        steps.append(Step(_copy(aug), f"Normalize row {col+1}: divide by pivot {pv:.4g}"))
        for r in range(n):
            if r == col:
                continue
            factor = aug[r][col]
            if abs(factor) < 1e-9:
                continue
            aug[r] = [aug[r][j] - factor * aug[col][j] for j in range(2 * n)]
            steps.append(Step(_copy(aug), f"Eliminate: Row {r+1} = Row {r+1} - {factor:.4g} x Row {col+1}"))
    inv = [row[n:] for row in aug]
    steps.append(Step(_copy(inv), "Left half became I; right half is A^-1"))
    return inv, steps


# ──────────────────────────────────────────────
#  LU Decomposition (Doolittle + partial pivoting)
# ──────────────────────────────────────────────

def lu_decomposition(A):
    """
    Decompose A into P, L, U so that P @ A = L @ U.
    Returns (P, L, U, steps).
    """
    n = len(A)
    if n != len(A[0]):
        raise ValueError("Matrix must be square")
    A = _copy(A)
    L = _identity(n)
    P = _identity(n)
    steps = []
    steps.append(Step(_copy(A), "Start LU decomposition. L = I, P = I",
                       {"L": _copy(L), "P": _copy(P)}))
    for i in range(n):
        max_row = max(range(i, n), key=lambda r: abs(A[r][i]))
        if max_row != i:
            A[i], A[max_row] = A[max_row], A[i]
            P[i], P[max_row] = P[max_row], P[i]
            for k in range(i):
                L[i][k], L[max_row][k] = L[max_row][k], L[i][k]
            steps.append(Step(_copy(A),
                f"Partial pivot: swap row {i+1} <-> row {max_row+1} in A and P",
                {"P": _copy(P), "L (so far)": _copy(L)}))
        for j in range(i + 1, n):
            if abs(A[i][i]) < 1e-9:
                continue
            factor = A[j][i] / A[i][i]
            L[j][i] = factor
            for k in range(i, n):
                A[j][k] -= factor * A[i][k]
            steps.append(Step(_copy(A),
                f"Eliminate col {i+1}: Row {j+1} = Row {j+1} - {factor:.4g} x Row {i+1}; "
                f"store multiplier L[{j+1}][{i+1}] = {factor:.4g}",
                {"L (so far)": _copy(L)}))
    steps.append(Step(_copy(A), "LU complete. Matrix above is U.",
                       {"L": _copy(L), "P": _copy(P)}))
    return P, L, A, steps


# ──────────────────────────────────────────────
#  QR Decomposition (Gram-Schmidt)
# ──────────────────────────────────────────────

def qr_decomposition(A):
    """
    Decompose A into Q (orthonormal columns) and R (upper triangular) via Gram-Schmidt.
    Returns (Q, R, steps).
    """
    m, n = len(A), len(A[0])
    Q_cols = []
    R = _zeros(n, n)
    steps = []
    steps.append(Step([], f"Start Gram-Schmidt QR on {m}x{n} matrix"))
    for j in range(n):
        col = [A[i][j] for i in range(m)]
        steps.append(Step([], f"Column {j+1} of A: {[round(x, 4) for x in col]}"))
        for k in range(len(Q_cols)):
            dot = sum(Q_cols[k][i] * col[i] for i in range(m))
            R[k][j] = dot
            col = [col[i] - dot * Q_cols[k][i] for i in range(m)]
            steps.append(Step([],
                f"  Project onto q{k+1}: R[{k+1}][{j+1}] = {dot:.4g}; "
                f"subtract projection -> residual = {[round(x, 4) for x in col]}"))
        norm = math.sqrt(sum(x ** 2 for x in col))
        if norm < 1e-9:
            raise ValueError("Columns are linearly dependent - QR failed")
        R[j][j] = norm
        q_new = [x / norm for x in col]
        Q_cols.append(q_new)
        steps.append(Step([],
            f"  Normalize residual: ||residual|| = {norm:.4g} -> "
            f"q{j+1} = {[round(x, 4) for x in q_new]}; R[{j+1}][{j+1}] = {norm:.4g}"))
    Q_matrix = [[Q_cols[j][i] for j in range(n)] for i in range(m)]
    steps.append(Step(Q_matrix, "QR complete: Q has orthonormal columns, R is upper triangular",
                       {"R": R}))
    return Q_matrix, R, steps


# ──────────────────────────────────────────────
#  Eigenvalues via QR Algorithm
# ──────────────────────────────────────────────

def eigenvalues_qr(A, iterations=200):
    """
    Approximate eigenvalues of a symmetric matrix using the QR algorithm.
    Returns (eigenvalues, steps).
    """
    n = len(A)
    Ak = _copy(A)
    steps = []
    steps.append(Step(_copy(Ak), "Start QR eigenvalue algorithm (iterate: Ak = R @ Q)"))
    for it in range(iterations):
        Q, R, _ = qr_decomposition(Ak)
        Ak = matrix_multiplication(R, Q)
        diag = [Ak[i][i] for i in range(n)]
        if it % 50 == 0 or it == iterations - 1:
            steps.append(Step(_copy(Ak),
                f"Iteration {it+1}: diagonal (eigenvalue estimates) = {[round(d, 6) for d in diag]}"))
    eigenvals = [Ak[i][i] for i in range(n)]
    steps.append(Step(_copy(Ak), f"Converged. Eigenvalues = {[round(e, 6) for e in eigenvals]}"))
    return eigenvals, steps


# ──────────────────────────────────────────────
#  Null Space (Kernel)
# ──────────────────────────────────────────────

def null_space(A):
    """
    Find null space basis of A (all x such that Ax = 0).
    Returns (basis_vectors, steps).
    """
    steps = []
    steps.append(Step(_copy(A), "Step 1: Compute RREF to identify pivot and free columns"))
    rref, rref_steps = reduced_row_echelon(A)
    steps.extend(rref_steps)
    rows, cols = len(rref), len(rref[0])
    pivot_cols = []
    for r in range(rows):
        for c in range(cols):
            if (abs(rref[r][c] - 1) < 1e-9 and
                    all(abs(rref[rr][c]) < 1e-9 for rr in range(rows) if rr != r)):
                pivot_cols.append(c)
                break
    free_cols = [c for c in range(cols) if c not in pivot_cols]
    steps.append(Step(_copy(rref),
        f"Pivot columns: {[c+1 for c in pivot_cols]}  |  Free columns: {[c+1 for c in free_cols]}"))
    basis = []
    for fc in free_cols:
        vec = [0.0] * cols
        vec[fc] = 1.0
        for r, pc in enumerate(pivot_cols):
            if r < rows:
                vec[pc] = -rref[r][fc]
        basis.append(vec)
        steps.append(Step([],
            f"Set free var x{fc+1} = 1, solve for pivot vars -> "
            f"basis vector: {[round(v, 4) for v in vec]}"))
    if not basis:
        steps.append(Step([], "Null space is trivial {0} - matrix has full column rank"))
    else:
        steps.append(Step([],
            f"Null space has {len(basis)} basis vector(s): "
            f"{[[round(v, 4) for v in bv] for bv in basis]}"))
    return basis, steps


# ──────────────────────────────────────────────
#  Least Squares
# ──────────────────────────────────────────────

def least_squares(A, b):
    """
    Solve overdetermined Ax ~= b via normal equations A^T A x = A^T b.
    Returns (x_hat, steps).
    """
    steps = []
    steps.append(Step(_copy(A),
        f"Overdetermined system: A is {len(A)}x{len(A[0])}, b has {len(b)} entries"))
    At = transpose(A)
    AtA = matrix_multiplication(At, A)
    Atb = [sum(At[i][k] * b[k] for k in range(len(b))) for i in range(len(At))]
    steps.append(Step(_copy(AtA),
        "Formed normal equations: A^T A x = A^T b", {"A^T b": Atb}))
    x, solve_steps = solve_linear_system(AtA, Atb)
    steps.extend(solve_steps)
    residual = [sum(A[i][j] * x[j] for j in range(len(x))) - b[i] for i in range(len(b))]
    res_norm = math.sqrt(sum(r ** 2 for r in residual))
    steps.append(Step([], f"Least-squares solution x_hat = {[round(v, 6) for v in x]}"))
    steps.append(Step([], f"Residual ||Ax_hat - b|| = {res_norm:.6g}"))
    return x, steps


# ──────────────────────────────────────────────
#  Cholesky Decomposition
# ──────────────────────────────────────────────

def cholesky(A):
    """
    Decompose symmetric positive-definite A into L @ L^T.
    Returns (L, steps).
    """
    if not is_symmetric(A):
        raise ValueError("Matrix must be symmetric")
    n = len(A)
    L = _zeros(n, n)
    steps = []
    steps.append(Step(_copy(A), "Start Cholesky: A must be symmetric positive-definite"))
    for i in range(n):
        for j in range(i + 1):
            s = sum(L[i][k] * L[j][k] for k in range(j))
            if i == j:
                val = A[i][i] - s
                if val < 0:
                    raise ValueError("Matrix is not positive-definite")
                L[i][j] = math.sqrt(val)
                steps.append(Step(_copy(L),
                    f"L[{i+1}][{j+1}] = sqrt(A[{i+1}][{i+1}] - sum) "
                    f"= sqrt({A[i][i]:.4g} - {s:.4g}) = {L[i][j]:.4g}"))
            else:
                if abs(L[j][j]) < 1e-9:
                    raise ValueError("Zero pivot in Cholesky")
                L[i][j] = (A[i][j] - s) / L[j][j]
                steps.append(Step(_copy(L),
                    f"L[{i+1}][{j+1}] = (A[{i+1}][{j+1}] - sum) / L[{j+1}][{j+1}] "
                    f"= ({A[i][j]:.4g} - {s:.4g}) / {L[j][j]:.4g} = {L[i][j]:.4g}"))
    steps.append(Step(_copy(L), "Cholesky complete: A = L * L^T"))
    return L, steps


# ──────────────────────────────────────────────
#  Power Iteration
# ──────────────────────────────────────────────

def power_iteration(A, iterations=1000, tol=1e-10):
    """
    Find the dominant eigenvalue and its eigenvector.
    Returns (eigenvalue, eigenvector, steps).
    """
    n = len(A)
    b = [1.0 / math.sqrt(n)] * n
    eigenvalue = 0.0
    steps = []
    steps.append(Step(_copy(A),
        f"Start power iteration with unit vector b = {[round(x, 4) for x in b]}"))
    for it in range(iterations):
        Ab = [sum(A[i][j] * b[j] for j in range(n)) for i in range(n)]
        norm = vector_norm(Ab)
        if norm < 1e-12:
            break
        b_new = [x / norm for x in Ab]
        new_eigenvalue = sum(Ab[i] * b[i] for i in range(n))
        if it < 5 or it % 100 == 0:
            steps.append(Step([],
                f"Iteration {it+1}: Ab = {[round(x, 4) for x in Ab]}, "
                f"||Ab|| = {norm:.4g}, lambda_estimate = {new_eigenvalue:.6g}"))
        if abs(new_eigenvalue - eigenvalue) < tol:
            eigenvalue = new_eigenvalue
            b = b_new
            steps.append(Step([],
                f"Converged at iteration {it+1}: "
                f"lambda = {eigenvalue:.6g}, v = {[round(x, 4) for x in b]}"))
            break
        eigenvalue = new_eigenvalue
        b = b_new
    steps.append(Step([],
        f"Dominant eigenvalue = {eigenvalue:.6g}, "
        f"eigenvector = {[round(x, 4) for x in b]}"))
    return eigenvalue, b, steps


# ──────────────────────────────────────────────
#  Condition Number
# ──────────────────────────────────────────────

def condition_number(A):
    """
    Compute condition number k(A) = ||A||_F * ||A^-1||_F.
    Returns (kappa, steps).
    """
    steps = []
    normA = frobenius_norm(A)
    steps.append(Step(_copy(A), f"Frobenius norm of A: ||A||_F = {normA:.6g}"))
    inv_A, inv_steps = inverse(A)
    steps.extend(inv_steps)
    normInv = frobenius_norm(inv_A)
    steps.append(Step(_copy(inv_A), f"Frobenius norm of A^-1: ||A^-1||_F = {normInv:.6g}"))
    kappa = normA * normInv
    steps.append(Step([],
        f"k(A) = ||A||_F * ||A^-1||_F = {normA:.4g} * {normInv:.4g} = {kappa:.6g}"))
    if kappa > 1e6:
        steps.append(Step([], f"WARNING: k = {kappa:.2e} is very large - system is ill-conditioned"))
    return kappa, steps


# ──────────────────────────────────────────────
#  Exact Gaussian Elimination (Fraction arithmetic)
# ──────────────────────────────────────────────

def gaussian_elimination_exact(A):
    """
    Gaussian elimination using Python Fraction for zero floating-point drift.
    Returns (echelon, steps).
    """
    A = [[Fraction(x) for x in row] for row in A]
    rows, cols = len(A), len(A[0])
    steps = []
    steps.append(Step([], f"Start exact Gaussian elimination ({rows}x{cols}) using Fraction arithmetic"))
    row = 0
    for col in range(cols):
        if row >= rows:
            break
        pivot = row
        while pivot < rows and A[pivot][col] == 0:
            pivot += 1
        if pivot == rows:
            steps.append(Step([], f"Column {col+1}: no pivot, skip"))
            continue
        if pivot != row:
            A[row], A[pivot] = A[pivot], A[row]
            steps.append(Step([], f"Swap row {row+1} <-> row {pivot+1}  -> {[str(x) for x in A[row]]}"))
        pv = A[row][col]
        A[row] = [x / pv for x in A[row]]
        steps.append(Step([], f"Normalize row {row+1}: divide by {pv}  -> {[str(x) for x in A[row]]}"))
        for r in range(row + 1, rows):
            factor = A[r][col]
            if factor == 0:
                continue
            A[r] = [A[r][j] - factor * A[row][j] for j in range(cols)]
            steps.append(Step([],
                f"Row {r+1} = Row {r+1} - {factor} x Row {row+1}  -> {[str(x) for x in A[r]]}"))
        row += 1
    steps.append(Step([], "Exact echelon form complete"))
    return A, steps


# ──────────────────────────────────────────────
#  Diagonalization  A = P D P^-1
# ──────────────────────────────────────────────

def diagonalize(A, iterations=200):
    """
    Diagonalize symmetric A: returns (P, D, steps).
    D is diagonal (eigenvalues); P has eigenvectors as columns.
    """
    steps = []
    steps.append(Step(_copy(A), "Step 1: Find eigenvalues via QR algorithm"))
    eigenvals, eig_steps = eigenvalues_qr(A, iterations)
    steps.extend(eig_steps)
    steps.append(Step([], f"Eigenvalues found: {[round(e, 6) for e in eigenvals]}"))
    n = len(A)
    P = []
    for idx, lam in enumerate(eigenvals):
        steps.append(Step([], f"Step 2.{idx+1}: Find eigenvector for lambda = {lam:.6g}"))
        shifted = [[A[i][j] - (lam if i == j else 0) for j in range(n)] for i in range(n)]
        kern, null_steps = null_space(shifted)
        steps.extend(null_steps)
        ev = kern[0] if kern else ([1.0] + [0.0] * (n - 1))
        nrm = vector_norm(ev)
        ev = [x / nrm if nrm > 1e-9 else x for x in ev]
        P.append(ev)
        steps.append(Step([], f"  Normalized eigenvector: {[round(x, 4) for x in ev]}"))
    P = transpose(P)
    D = [[eigenvals[i] if i == j else 0.0 for j in range(n)] for i in range(n)]
    steps.append(Step(_copy(P), "Diagonalization complete: A = P D P^-1",
                       {"D (diagonal eigenvalue matrix)": D}))
    return P, D, steps


# ──────────────────────────────────────────────
#  Matrix Power  A^k
# ──────────────────────────────────────────────

def matrix_power(A, k):
    """
    Compute A^k via repeated squaring.
    Returns (result, steps).
    """
    if k < 0:
        raise ValueError("Use inverse() first for negative powers")
    n = len(A)
    result = _identity(n)
    base = _copy(A)
    steps = []
    original_k = k
    steps.append(Step(_copy(result), f"Compute A^{original_k} via binary repeated squaring. result = I"))
    bit = 0
    while k > 0:
        if k % 2 == 1:
            result = matrix_multiplication(result, base)
            steps.append(Step(_copy(result),
                f"Bit {bit} is 1: result = result x base (base = A^{2**bit})"))
        k //= 2
        if k > 0:
            base = matrix_multiplication(base, base)
            steps.append(Step(_copy(base), f"Square base: base = A^{2**(bit+1)}"))
        bit += 1
    steps.append(Step(_copy(result), f"A^{original_k} computed"))
    return result, steps


# ──────────────────────────────────────────────
#  Hadamard Product (element-wise)
# ──────────────────────────────────────────────

def hadamard_product(A, B):
    """
    Element-wise product of A and B.
    Returns (result, steps).
    """
    if len(A) != len(B) or len(A[0]) != len(B[0]):
        raise ValueError("Matrices must have the same dimensions")
    rows, cols = len(A), len(A[0])
    result = _zeros(rows, cols)
    steps = []
    steps.append(Step(_copy(A),
        f"Start Hadamard (element-wise) product of two {rows}x{cols} matrices"))
    for i in range(rows):
        for j in range(cols):
            result[i][j] = A[i][j] * B[i][j]
            steps.append(Step(_copy(result),
                f"result[{i+1}][{j+1}] = {A[i][j]:.4g} x {B[i][j]:.4g} = {result[i][j]:.4g}"))
    steps.append(Step(_copy(result), "Hadamard product complete"))
    return result, steps


# ──────────────────────────────────────────────
#  Kronecker Product
# ──────────────────────────────────────────────

def kronecker_product(A, B):
    """
    Kronecker (tensor) product: A (m x n) * B (p x q) -> (mp x nq).
    Returns (result, steps).
    """
    rows_A, cols_A = len(A), len(A[0])
    rows_B, cols_B = len(B), len(B[0])
    result = _zeros(rows_A * rows_B, cols_A * cols_B)
    steps = []
    steps.append(Step([],
        f"Kronecker product: A is {rows_A}x{cols_A}, B is {rows_B}x{cols_B} "
        f"-> result is {rows_A*rows_B}x{cols_A*cols_B}"))
    for i in range(rows_A):
        for j in range(cols_A):
            for p in range(rows_B):
                for q in range(cols_B):
                    result[i * rows_B + p][j * cols_B + q] = A[i][j] * B[p][q]
            steps.append(Step(_copy(result),
                f"Block ({i+1},{j+1}): scale B by A[{i+1}][{j+1}] = {A[i][j]:.4g}, "
                f"place at rows {i*rows_B+1}-{(i+1)*rows_B}, "
                f"cols {j*cols_B+1}-{(j+1)*cols_B}"))
    steps.append(Step(_copy(result), "Kronecker product complete"))
    return result, steps


# ──────────────────────────────────────────────
#  Transpose / Trace / Norms / Properties
# ──────────────────────────────────────────────

def transpose(A):
    return [[A[i][j] for i in range(len(A))] for j in range(len(A[0]))]

def trace(A):
    if len(A) != len(A[0]):
        raise ValueError("Matrix must be square")
    return sum(A[i][i] for i in range(len(A)))

def frobenius_norm(A):
    return math.sqrt(sum(A[i][j] ** 2 for i in range(len(A)) for j in range(len(A[0]))))

def vector_norm(v, p=2):
    if p == math.inf:
        return max(abs(x) for x in v)
    return sum(abs(x) ** p for x in v) ** (1 / p)

def is_symmetric(A, tol=1e-9):
    if len(A) != len(A[0]):
        return False
    n = len(A)
    return all(abs(A[i][j] - A[j][i]) < tol for i in range(n) for j in range(n))

def is_positive_definite(A):
    if not is_symmetric(A):
        return False
    n = len(A)
    for k in range(1, n + 1):
        sub = [A[i][:k] for i in range(k)]
        d, _ = determinant(sub)
        if d <= 0:
            return False
    return True

def is_orthogonal(A, tol=1e-6):
    prod = matrix_multiplication(A, transpose(A))
    I = _identity(len(A))
    return all(abs(prod[i][j] - I[i][j]) < tol for i in range(len(A)) for j in range(len(A)))

def is_diagonally_dominant(A):
    n = len(A)
    return all(abs(A[i][i]) >= sum(abs(A[i][j]) for j in range(n) if j != i) for i in range(n))


# ──────────────────────────────────────────────
#  Demo
# ──────────────────────────────────────────────

if __name__ == "__main__":
    A = [[4, 3], [6, 3]]
    sym = [[4, 2], [2, 3]]
    b = [10, 12]

    print("=" * 60)
    print("DETERMINANT")
    det, steps = determinant(A)
    print_steps(steps)
    print(f"  -> det = {det}")

    print("=" * 60)
    print("SOLVE LINEAR SYSTEM  Ax = b")
    x, steps = solve_linear_system(A, b)
    print_steps(steps)

    print("=" * 60)
    print("INVERSE")
    inv, steps = inverse(A)
    print_steps(steps)

    print("=" * 60)
    print("LU DECOMPOSITION")
    P, L, U, steps = lu_decomposition(A)
    print_steps(steps)

    print("=" * 60)
    print("QR DECOMPOSITION")
    Q, R, steps = qr_decomposition(A)
    print_steps(steps)

    print("=" * 60)
    print("CHOLESKY")
    L_chol, steps = cholesky(sym)
    print_steps(steps)

    print("=" * 60)
    print("EIGENVALUES (QR algorithm)")
    eigs, steps = eigenvalues_qr(sym, iterations=100)
    print_steps(steps)

    print("=" * 60)
    print("POWER ITERATION")
    lam, vec, steps = power_iteration(sym)
    print_steps(steps)

    print("=" * 60)
    print("NULL SPACE")
    M = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    basis, steps = null_space(M)
    print_steps(steps)

    print("=" * 60)
    print("LEAST SQUARES")
    A_over = [[1, 1], [1, 2], [1, 3]]
    b_over = [6, 5, 7]
    x_ls, steps = least_squares(A_over, b_over)
    print_steps(steps)

    print("=" * 60)
    print("CONDITION NUMBER")
    kappa, steps = condition_number(A)
    print_steps(steps)

    print("=" * 60)
    print("MATRIX POWER  A^4")
    Ak, steps = matrix_power(A, 4)
    print_steps(steps)

    print("=" * 60)
    print("HADAMARD PRODUCT")
    B2 = [[1, 2], [3, 4]]
    H, steps = hadamard_product(A, B2)
    print_steps(steps)

    print("=" * 60)
    print("KRONECKER PRODUCT")
    K, steps = kronecker_product([[1, 0], [0, 1]], [[1, 2], [3, 4]])
    print_steps(steps)

    print("=" * 60)
    print("EXACT GAUSSIAN ELIMINATION (Fractions)")
    aug_exact = [[2, 1, -1, 8], [-3, -1, 2, -11], [-2, 1, 2, -3]]
    _, steps = gaussian_elimination_exact(aug_exact)
    print_steps(steps)

    print("=" * 60)
    print("MATRIX MULTIPLICATION (with steps)")
    C = [[1, 2], [3, 4]]
    D = [[5, 6], [7, 8]]
    res, steps = matrix_multiplication_steps(C, D)
    print_steps(steps)
