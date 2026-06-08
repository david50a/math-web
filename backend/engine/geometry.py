import math
from math_models import MathStep

def parse_shape(shape_str: str):
    shape_str = shape_str.lower().strip()
    if shape_str == "triangle":
        return [{"type": "polygon", "points": [[0, 0, 0], [2, 0, 0], [0, 2, 0]], "color": "BLUE", "fill_opacity": 0.5}]
    elif shape_str == "square":
        return [{"type": "polygon", "points": [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]], "color": "BLUE", "fill_opacity": 0.5}]
    elif shape_str == "circle":
        return [{"type": "circle", "radius": 1.0, "center": [0, 0, 0], "color": "BLUE"}]
    else:
        # Default fallback is a simple triangle
        return [{"type": "polygon", "points": [[0, 0, 0], [1, 0, 0], [0, 1, 0]], "color": "BLUE", "fill_opacity": 0.5}]

def translate(shape_str: str, dx: float, dy: float):
    steps = []
    shapes = parse_shape(shape_str)
    
    steps.append(MathStep(
        description=f"Initial {shape_str}",
        latex="",
        type="geometry",
        data={"shapes": shapes}
    ))
    
    new_shapes = []
    for s in shapes:
        ns = dict(s)
        if ns["type"] == "polygon":
            ns["points"] = [[p[0]+dx, p[1]+dy, p[2]] for p in ns["points"]]
            ns["color"] = "GREEN"
        elif ns["type"] == "circle":
            ns["center"] = [ns["center"][0]+dx, ns["center"][1]+dy, ns["center"][2]]
            ns["color"] = "GREEN"
        new_shapes.append(ns)
        
    steps.append(MathStep(
        description=f"Translate by dx = {dx}, dy = {dy}",
        latex="",
        type="geometry",
        data={"shapes": new_shapes}
    ))
    
    return steps

def rotate(shape_str: str, angle_degrees: float):
    steps = []
    shapes = parse_shape(shape_str)
    
    steps.append(MathStep(
        description=f"Initial {shape_str}",
        latex="",
        type="geometry",
        data={"shapes": shapes}
    ))
    
    rad = math.radians(angle_degrees)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    
    new_shapes = []
    for s in shapes:
        ns = dict(s)
        if ns["type"] == "polygon":
            ns["points"] = [[p[0]*cos_a - p[1]*sin_a, p[0]*sin_a + p[1]*cos_a, p[2]] for p in ns["points"]]
            ns["color"] = "GREEN"
        elif ns["type"] == "circle":
            ns["center"] = [ns["center"][0]*cos_a - ns["center"][1]*sin_a, ns["center"][0]*sin_a + ns["center"][1]*cos_a, ns["center"][2]]
            ns["color"] = "GREEN"
        new_shapes.append(ns)
        
    steps.append(MathStep(
        description=f"Rotate by {angle_degrees} degrees around origin",
        latex="",
        type="geometry",
        data={"shapes": new_shapes}
    ))
    
    return steps

def scale(shape_str: str, factor: float):
    steps = []
    shapes = parse_shape(shape_str)
    
    steps.append(MathStep(
        description=f"Initial {shape_str}",
        latex="",
        type="geometry",
        data={"shapes": shapes}
    ))
    
    new_shapes = []
    for s in shapes:
        ns = dict(s)
        if ns["type"] == "polygon":
            ns["points"] = [[p[0]*factor, p[1]*factor, p[2]] for p in ns["points"]]
            ns["color"] = "GREEN"
        elif ns["type"] == "circle":
            ns["center"] = [ns["center"][0]*factor, ns["center"][1]*factor, ns["center"][2]]
            ns["radius"] = ns.get("radius", 1.0) * factor
            ns["color"] = "GREEN"
        new_shapes.append(ns)
        
    steps.append(MathStep(
        description=f"Scale by factor {factor} from origin",
        latex="",
        type="geometry",
        data={"shapes": new_shapes}
    ))
    
    return steps