import sys
import os

sys.path.append(os.path.abspath('c:/Users/meir/Documents/math-web/backend'))

from engine.eigenvalues_and_eigenvector import eigenvalue
from math_models import to_latex

A = [[4, 2], [1, 3]]
print(f"Testing eigenvalue function with matrix: {A}\n")
eq, steps = eigenvalue(A)

print("--- Characteristic Equation ---")
print(to_latex(eq))

print("\n--- Steps ---")
for idx, step in enumerate(steps, 1):
    print(f"Step {idx}: {step.description}")
    print(f"Latex:\n{step.latex}")
    print("-" * 40)
