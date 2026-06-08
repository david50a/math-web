from math_models import MathStep

def parse_data(data_str: str):
    # Expects a comma separated string of numbers, e.g., "1, 2, 3, 4" or "[1, 2, 3]"
    data_str = data_str.strip("[]() ")
    try:
        return [float(x.strip()) for x in data_str.split(',')]
    except Exception as e:
        raise ValueError(f"Invalid data format. Please provide comma separated numbers. Error: {str(e)}")

def mean(data_str: str):
    steps = []
    try:
        data = parse_data(data_str)
    except Exception as e:
        steps.append(MathStep("Error", str(e), "text"))
        return steps
        
    if not data:
        steps.append(MathStep("Error", "Dataset is empty", "text"))
        return steps
        
    # Show initial data
    data_latex = r"\{ " + ", ".join(f"{x:g}" for x in data) + r" \}"
    steps.append(MathStep(
        description="Dataset",
        latex=data_latex,
        type="equation"
    ))
    
    total = sum(data)
    n = len(data)
    mean_val = total / n
    
    steps.append(MathStep(
        description="Sum all values",
        latex=r"\text{Sum} = " + " + ".join(f"{x:g}" for x in data) + f" = {total:g}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description=f"Divide the sum by the number of elements (n={n})",
        latex=rf"\text{{Mean}} = \frac{{{total:g}}}{{{n}}} = {mean_val:g}",
        type="equation"
    ))
    
    return steps

def median(data_str: str):
    steps = []
    try:
        data = parse_data(data_str)
    except Exception as e:
        steps.append(MathStep("Error", str(e), "text"))
        return steps
        
    if not data:
        steps.append(MathStep("Error", "Dataset is empty", "text"))
        return steps
        
    data_latex = r"\{ " + ", ".join(f"{x:g}" for x in data) + r" \}"
    steps.append(MathStep(
        description="Original Dataset",
        latex=data_latex,
        type="equation"
    ))
    
    sorted_data = sorted(data)
    sorted_latex = r"\{ " + ", ".join(f"{x:g}" for x in sorted_data) + r" \}"
    steps.append(MathStep(
        description="Sort the Data",
        latex=sorted_latex,
        type="equation"
    ))
    
    n = len(sorted_data)
    if n % 2 == 1:
        med = sorted_data[n//2]
        steps.append(MathStep(
            description=f"Since n={n} is odd, the median is the middle value",
            latex=rf"\text{{Median}} = {med:g}",
            type="equation"
        ))
    else:
        mid1 = sorted_data[n//2 - 1]
        mid2 = sorted_data[n//2]
        med = (mid1 + mid2) / 2
        steps.append(MathStep(
            description=f"Since n={n} is even, the median is the average of the two middle values",
            latex=rf"\text{{Median}} = \frac{{{mid1:g} + {mid2:g}}}{{2}} = {med:g}",
            type="equation"
        ))
        
    return steps