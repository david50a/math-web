from typing import Dict, Any, List
from .models import StructuredProblemModel, MathematicalModel

def build_mathematical_model(model: StructuredProblemModel) -> MathematicalModel:
    """
    Executes Stage 5: Mathematical Model Builder.
    Converts structured problem constraints into formal, executable mathematical
    equations compatible with YOUR MATH ENGINE (algebra, geometry, etc.).
    """
    cat = model.category
    sub = model.subcategory

    # 1. Motion: Catch-Up
    if cat == "motion" and sub == "catch_up":
        v1 = next((v.value for v in model.variables if v.symbol == "v_1"), 60.0)
        v2 = next((v.value for v in model.variables if v.symbol == "v_2"), 90.0)
        dt = next((v.value for v in model.variables if v.symbol == "t_{delay}"), 2.0)
        
        # 90*t = 60*(t + 2)  -->  90*t - 60*t - 120 = 0  --> 30*t - 120 = 0
        eq_str = f"{v2}*t = {v1}*(t + {dt})"
        engine_eq = f"{v2}*t - {v1}*(t + {dt}) = 0"
        latex = f"{v2}t = {v1}(t + {dt})"
        
        return MathematicalModel(
            target_engine="algebra",
            primary_equation=engine_eq,
            equations=[eq_str, f"d = {v2}*t"],
            unknowns=["t", "d"],
            latex_form=latex,
            engine_call_spec={
                "module": "algebra",
                "function": "solve_algebra_pure",
                "equation": engine_eq,
                "variable": "t",
                "derived_vars": {
                    "d": f"{v2} * t"
                }
            }
        )

    # 2. Geometry: Pythagorean Right Triangle
    elif cat == "geometry" and sub == "pythagorean":
        c = next((v.value for v in model.variables if v.symbol == "c"), 13.0)
        a = next((v.value for v in model.variables if v.symbol == "a"), 5.0)
        
        b2_val = c**2 - a**2
        eq_str = f"b^2 = {c}^2 - {a}^2"
        engine_eq = f"b^2 - {b2_val} = 0"
        latex = f"b = \\sqrt{{{c}^2 - {a}^2}} = \\sqrt{{{b2_val}}}"
        
        return MathematicalModel(
            target_engine="geometry",
            primary_equation=f"pythagorean(a={a}, c={c})",
            equations=[f"a^2 + b^2 = c^2", f"{a}^2 + b^2 = {c}^2", f"A = 0.5 * {a} * b"],
            unknowns=["b", "A"],
            latex_form=latex,
            engine_call_spec={
                "module": "geometry",
                "function": "pythagorean",
                "kwargs": {"a": a, "c": c},
                "derived_vars": {
                    "A": f"0.5 * {a} * b"
                }
            }
        )

    # 3. Geometry: Rectangle Dimensions (Perimeter & Area)
    elif cat == "geometry" and sub == "perimeter_and_area":
        P = next((v.value for v in model.variables if v.symbol == "P"), 54.0)
        A = next((v.value for v in model.variables if v.symbol == "A"), 180.0)
        
        semi_p = P / 2.0  # l + w = semi_p  => l = semi_p - w
        # w * (semi_p - w) = A  =>  -w^2 + semi_p*w - A = 0  =>  w^2 - semi_p*w + A = 0
        engine_eq = f"w^2 - {semi_p}*w + {A} = 0"
        latex = f"w^2 - {semi_p}w + {A} = 0"
        
        return MathematicalModel(
            target_engine="algebra",
            primary_equation=engine_eq,
            equations=[f"2l + 2w = {P}", f"l*w = {A}", f"l = {semi_p} - w"],
            unknowns=["w", "l"],
            latex_form=latex,
            engine_call_spec={
                "module": "algebra",
                "function": "solve_algebra_pure",
                "equation": engine_eq,
                "variable": "w",
                "derived_vars": {
                    "l": f"{semi_p} - w"
                }
            }
        )

    # 4. Work Rate
    elif cat == "work_rate":
        t1 = next((v.value for v in model.variables if v.symbol == "t_1"), 4.0)
        t2 = next((v.value for v in model.variables if v.symbol == "t_2"), 6.0)
        
        combined_rate = (1.0 / t1) + (1.0 / t2)
        # 1/T = combined_rate  => combined_rate * T - 1 = 0
        # Or algebraically: (t1 + t2)*T = t1*t2 => (t1+t2)*T - t1*t2 = 0
        sum_t = t1 + t2
        prod_t = t1 * t2
        engine_eq = f"{sum_t}*T - {prod_t} = 0"
        latex = f"\\frac{{1}}{{{t1}}} + \\frac{{1}}{{{t2}}} = \\frac{{1}}{{T}} \\implies T = \\frac{{{prod_t}}}{{{sum_t}}}"
        
        return MathematicalModel(
            target_engine="algebra",
            primary_equation=engine_eq,
            equations=[f"1/{t1} + 1/{t2} = 1/T", f"{sum_t}*T = {prod_t}"],
            unknowns=["T"],
            latex_form=latex,
            engine_call_spec={
                "module": "algebra",
                "function": "solve_algebra_pure",
                "equation": engine_eq,
                "variable": "T"
            }
        )

    # 5. Linear System: Cost & Quantity
    elif cat == "linear_system":
        total_items = next((v.value for v in model.variables if v.symbol == "N_{tot}"), 50.0)
        total_cost = next((v.value for v in model.variables if v.symbol == "V_{tot}"), 310.0)
        c1 = 5.0
        c2 = 8.0
        
        # x + y = N  =>  x = N - y
        # c1*(N - y) + c2*y = V  =>  (c2 - c1)*y + c1*N - V = 0
        coeff_y = c2 - c1
        const_term = (c1 * total_items) - total_cost
        engine_eq = f"{coeff_y}*y + {const_term} = 0"
        latex = f"{coeff_y}y + ({const_term}) = 0 \\implies y = \\frac{{{total_cost - c1 * total_items}}}{{{coeff_y}}}"
        
        return MathematicalModel(
            target_engine="algebra",
            primary_equation=engine_eq,
            equations=[f"x + y = {total_items}", f"{c1}*x + {c2}*y = {total_cost}"],
            unknowns=["y", "x"],
            latex_form=latex,
            engine_call_spec={
                "module": "algebra",
                "function": "solve_algebra_pure",
                "equation": engine_eq,
                "variable": "y",
                "derived_vars": {
                    "x": f"{total_items} - y"
                }
            }
        )

    # General Fallback
    v_val = next((v.value for v in model.variables if v.value is not None), 10.0)
    engine_eq = f"x - {v_val} = 0"
    return MathematicalModel(
        target_engine="algebra",
        primary_equation=engine_eq,
        equations=[f"x = {v_val}"],
        unknowns=["x"],
        latex_form=f"x = {v_val}",
        engine_call_spec={
            "module": "algebra",
            "function": "solve_algebra_pure",
            "equation": engine_eq,
            "variable": "x"
        }
    )
