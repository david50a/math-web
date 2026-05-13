from engine.equetions import linear_equation, solve_polynomial_equation

def print_steps(steps, title):
    print(f"\n{'='*50}\n{title}\n{'='*50}")
    for idx, step in enumerate(steps, 1):
        print(f"Step {idx}: {step.description}")
        print(f"LaTeX:\n{step.latex}")
        print("-" * 40)

def main():
    print("\n--- TEST 1: Polynomial Equation (Quadratic) ---")
    equation = "2x^2 - 4x - 6 = 0"
    sol, steps = solve_polynomial_equation(equation)
    print_steps(steps, "Solving: " + equation)
    print(f"Final Solution: {sol}")

    print("\n--- TEST 2: System of Linear Equations (Algebraic Method) ---")
    system = ["2x + 3y = 5", "4x - y = 3"]
    sol, steps = linear_equation(system)
    print_steps(steps, "Solving System: 2x + 3y = 5, 4x - y = 3")
    print(f"Final Solution: {sol}")

if __name__ == "__main__":
    main()
