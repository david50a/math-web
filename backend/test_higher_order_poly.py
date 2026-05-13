from engine.equetions import solve_polynomial_equation

def print_steps(steps, title):
    print(f"\n{'='*60}\n{title}\n{'='*60}")
    for idx, step in enumerate(steps, 1):
        print(f"Step {idx}: {step.description}")
        if step.type == "equation":
            print(f"LaTeX: {step.latex}")
        else:
            print(f"Text: {step.latex}")
        print("-" * 40)

def test_solver(equation):
    sol, steps = solve_polynomial_equation(equation)
    print_steps(steps, "Solving: " + equation)
    print(f"Final Solution: {sol}")

def main():
    print("Testing Higher-Order Polynomial Solver")
    
    # Test 1: Cubic with rational roots (x-1)(x-2)(x-3) = x^3 - 6x^2 + 11x - 6
    test_solver("x^3 - 6x^2 + 11x - 6 = 0")
    
    # Test 2: Cubic with complex roots (x-1)(x^2+1) = x^3 - x^2 + x - 1
    test_solver("x^3 - x^2 + x - 1 = 0")
    
    # Test 3: Quartic with rational roots (x-1)(x-2)(x-3)(x-4) = x^4 - 10x^3 + 35x^2 - 50x + 24
    test_solver("x^4 - 10x^3 + 35x^2 - 50x + 24 = 0")
    
    # Test 4: Degree 5 (Numerical)
    test_solver("x^5 - x + 1 = 0")

if __name__ == "__main__":
    main()
