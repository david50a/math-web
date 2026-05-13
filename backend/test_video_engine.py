import os
import sys

# Ensure math_models and engine modules are discoverable
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engine.video_engine import generate_solver_video
from engine.equetions import linear_equation, solve_polynomial_equation

def test_linear_equation():
    equations = ["2x + y = 3", "x - y = 0"]
    print(f"Testing linear equation: {equations}")
    solution, steps = linear_equation(equations)
    
    if steps:
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media", "linear_test.mp4")
        generate_solver_video(steps, "Solving Linear System", output_path)
        print(f"Generated video at: {output_path}")

def test_polynomial():
    equation = "x^2 - 4 = 0"
    print(f"Testing polynomial equation: {equation}")
    solution, steps = solve_polynomial_equation(equation)
    
    if steps:
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media", "poly_test.mp4")
        generate_solver_video(steps, "Solving Polynomial", output_path)
        print(f"Generated video at: {output_path}")

if __name__ == "__main__":
    test_linear_equation()
    test_polynomial()
    print("Done testing.")
