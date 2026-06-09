from math_models import MathStep
import re

def parse_data(data_str: str):
    # Expects a comma separated string of numbers, e.g., "1, 2, 3, 4" or "[1, 2, 3]"
    data_str = data_str.strip("[]() ")
    try:
        return [float(x.strip()) for x in data_str.split(',')]
    except Exception as e:
        raise ValueError(f"Invalid data format. Please provide comma separated numbers. Error: {str(e)}")


def parse_range(data_str: str):
    try:
        matches = re.findall(r'\(\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*\)', data_str)
        if not matches:
            raise ValueError("No valid ranges found")
        return [(int(s), int(e), int(f)) for s, e, f in matches]
    except Exception as e:
        raise ValueError(f"Invalid data format. Please provide comma separated ranges like (0-10-5). Error: {str(e)}")


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
    
    steps.append(MathStep(
        description="Formula for Mean",
        latex=r"\text{Mean} = \frac{\sum_{i=1}^{n} x_i}{n}",
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

    steps.append(MathStep(
        description="Formula for Median",
        latex=r"\text{Median} = \begin{cases} x_{\frac{n+1}{2}} & \text{if } n \text{ is odd} \\ \frac{x_{\frac{n}{2}} + x_{\frac{n}{2} + 1}}{2} & \text{if } n \text{ is even} \end{cases}",
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

def variance(data_str: str):
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
    
    steps.append(MathStep(
        description="Formula for Variance",
        latex=r"\sigma^2 = \frac{\sum_{i=1}^{n} (x_i - \mu)^2}{n}",
        type="equation"
    ))
    
    total = sum(data)
    n = len(data)
    mean_val = total / n
    
    steps.append(MathStep(
        description=f"First, calculate the mean:",
        latex=rf"\text{{Mean}} = \frac{{{total:g}}}{{{n}}} = {mean_val:g}",
        type="equation"
    ))
    
    # Calculate squared differences
    squared_diffs = []
    sum_sq_diff = 0
    diff_steps = []
    
    for x in data:
        diff = x - mean_val
        sq_diff = diff ** 2
        squared_diffs.append(sq_diff)
        sum_sq_diff += sq_diff
        diff_steps.append(MathStep(
            description=f"Square the difference for x = {x:g}",
            latex=rf"({x:g} - {mean_val:g})^2 = ({diff:g})^2 = {sq_diff:g}",
            type="equation"
        ))
    
    steps.extend(diff_steps)
    
    steps.append(MathStep(
        description="Sum of the squared differences",
        latex=r"\sum(x_i - \mu)^2 = " + " + ".join(f"{sd:g}" for sd in squared_diffs) + f" = {sum_sq_diff:g}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Divide by n to get the variance",
        latex=rf"\sigma^2 = \frac{{{sum_sq_diff:g}}}{{{n}}} = {sum_sq_diff/n:g}",
        type="equation"
    ))
    
    return steps

def std_dev(data_str: str):
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

    steps.append(MathStep(
        description="Formula for Standard Deviation",
        latex=r"\sigma = \sqrt{\frac{\sum_{i=1}^{n} (x_i - \mu)^2}{n}}",
        type="equation"
    ))
    
    total = sum(data)
    n = len(data)
    mean_val = total / n
    
    steps.append(MathStep(
        description=f"First, calculate the mean:",
        latex=rf"\text{{Mean}} = \frac{{{total:g}}}{{{n}}} = {mean_val:g}",
        type="equation"
    ))
    
    # Calculate squared differences
    squared_diffs = []
    sum_sq_diff = 0
    diff_steps = []
    
    for x in data:
        diff = x - mean_val
        sq_diff = diff ** 2
        squared_diffs.append(sq_diff)
        sum_sq_diff += sq_diff
        diff_steps.append(MathStep(
            description=f"Square the difference for x = {x:g}",
            latex=rf"({x:g} - {mean_val:g})^2 = ({diff:g})^2 = {sq_diff:g}",
            type="equation"
        ))
    
    steps.extend(diff_steps)
    
    steps.append(MathStep(
        description="Sum of the squared differences",
        latex=r"\sum(x_i - \mu)^2 = " + " + ".join(f"{sd:g}" for sd in squared_diffs) + f" = {sum_sq_diff:g}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Divide by n to get the variance",
        latex=rf"\sigma^2 = \frac{{{sum_sq_diff:g}}}{{{n}}} = {sum_sq_diff/n:g}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Take the square root to get the standard deviation",
        latex=rf"\sigma = \sqrt{{{sum_sq_diff/n:g}}} = {sum_sq_diff/n**0.5:g}",
        type="equation"
    ))
    
    return steps

def mode(data_str: str):
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
    
    steps.append(MathStep(
        description="Formula for Mode",
        latex=r"\text{Mode} = \text{value(s) that appear most frequently}",
        type="equation"
    ))
    
    freq = {}
    for x in data:
        freq[x] = freq.get(x, 0) + 1
    
    max_freq = max(freq.values())
    modes = [x for x, f in freq.items() if f == max_freq]
    
    steps.append(MathStep(
        description="Count the frequency of each value",
        latex=r"\text{Frequencies: } " + ", ".join(f"{x:g}: {f}" for x, f in freq.items()),
        type="equation"
    ))
    
    steps.append(MathStep(
        description="The value(s) with the highest frequency are the mode(s)",
        latex=rf"\text{{Mode}} = {modes[0]:g}",
        type="equation"
    ))
    
    return steps

def density(x:tuple):
    return x[2]/(x[1]-x[0])

def mode_of_classes(data_str: str):
    steps = []
    try:
        data = parse_range(data_str)
    except Exception as e:
        steps.append(MathStep("Error", str(e), "text"))
        return steps
        
    if not data:
        steps.append(MathStep("Error", "Dataset is empty", "text"))
        return steps
        
    # Show initial data
    data_latex = r"\{ " + ", ".join(f"({s}-{e}] : {f}" for s, e, f in data) + r" \}"
    steps.append(MathStep(
        description="Dataset",
        latex=data_latex,
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Formula for Mode of grouped data",
        latex=r"\text{Mode} = L + \frac{h_m - h_{m-1}}{2h_m - h_{m-1} - h_{m+1}} \times c",
        type="equation"
    ))
    
    most_frequent_class = max(data, key=lambda x: x[2])
    index_of_most_frequent_class = data.index(most_frequent_class)
    steps.append(MathStep(
        description="The class with the highest frequency is the modal class",
        latex=rf"\text{{Modal Class}} = {most_frequent_class[0]}-{most_frequent_class[1]} : {most_frequent_class[2]}",
        type="equation"
    ))
    
    L = most_frequent_class[0]
    length=most_frequent_class[1] - most_frequent_class[0]
    h =density(most_frequent_class)
    h_prev=density(data[index_of_most_frequent_class - 1])
    h_next=density(data[index_of_most_frequent_class + 1])
    f_modal = most_frequent_class[2]
    f_prev = data[index_of_most_frequent_class - 1][2]
    f_next = data[index_of_most_frequent_class + 1][2]
    
    steps.append(MathStep(
        description="The lower boundary of the modal class is",
        latex=rf"\text{{Lower Boundary}} = {L}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="The frequency of the modal class is",
        latex=rf"\text{{Frequency of Modal Class}} = {f_modal}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="The frequency of the class preceding the modal class is",
        latex=rf"\text{{Frequency of Preceding Class}} = {f_prev}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="The frequency of the class succeeding the modal class is",
        latex=rf"\text{{Frequency of Succeeding Class}} = {f_next}",
        type="equation"
    ))

    step.append(MathStep(
        description="The density of the modal class is",
        latex=rf"\text{{Density of Modal Class}} = {h}",
        type="equation"
    ))
    
    step.append(MathStep(
        description="The density of the preceding class is",
        latex=rf"\text{{Density of Preceding Class}} = {h_prev}",
        type="equation"
    ))
    
    step.append(MathStep(
        description="The density of the succeeding class is",
        latex=rf"\text{{Density of Succeeding Class}} = {h_next}",
        type="equation"
    ))


    
    steps.append(MathStep(
        description="The total frequency is",
        latex=rf"\text{{Total Frequency}} = {n}",
        type="equation"
    ))
    steps.append(MathStep(
        description="The formula for the mode of classes is",
        latex=rf"\text{{Mode}} = L + \frac{{length*(h-h_prev)}} \(2*h-h_prev-h_next\)",
        type="equation"
    ))
    steps.append(MathStep(
        description="Plugging in the values, we get",
        latex=rf"\text{{Mode}} = {L} + \frac{{{length}*({h}-{h_prev})}} \({2*h}-{h_prev}-{h_next}\)",
        type="equation"
    ))    
    
    return steps

def mean_of_classes(data_str: str):
    steps = []
    try:
        data = parse_range(data_str)
    except Exception as e:
        steps.append(MathStep("Error", str(e), "text"))
        return steps
        
    if not data:
        steps.append(MathStep("Error", "Dataset is empty", "text"))
        return steps
        
    # Show initial data
    data_latex = r"\{ " + ", ".join(f"({s}-{e}] : {f}" for s, e, f in data) + r" \}"
    steps.append(MathStep(
        description="Dataset",
        latex=data_latex,
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Formula for Mean of Classes",
        latex=r"\text{Mean of Classes} = \frac{\sum_{i=1}^{n} \frac{s_i+e_i}{2} \times f_i}{\sum_{i=1}^{n} f_i}",
        type="equation"
    ))

    total_frequency = 0
    sum_fx = 0
    for s, e, f in data:
        total_frequency += f
        sum_fx += ((s + e) / 2) * f
        
    steps.append(MathStep(
        description="Total Frequency",
        latex=rf"\text{{Total Frequency}} = {total_frequency}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Sum of (midpoint * frequency)",
        latex=rf"\sum{{\left(\frac{{s+e}}{{2}}\right) \times f}} = {sum_fx}",
        type="equation"
    ))
    
    mean_val = sum_fx / total_frequency
    steps.append(MathStep(
        description="Mean of Classes",
        latex=rf"\text{{Mean of Classes}} = \frac{{{sum_fx}}}{{{total_frequency}}} = {mean_val}",
        type="equation"
    ))
    
    return steps

def variance_of_classes(data_str: str):
    steps = []
    try:
        data = parse_range(data_str)
    except Exception as e:
        steps.append(MathStep("Error", str(e), "text"))
        return steps
        
    if not data:
        steps.append(MathStep("Error", "Dataset is empty", "text"))
        return steps
        
    # Show initial data
    data_latex = r"\{ " + ", ".join(f"({s}-{e}] : {f}" for s, e, f in data) + r" \}"
    steps.append(MathStep(
        description="Dataset",
        latex=data_latex,
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Formula for Variance of Classes",
        latex=r"\text{Variance of Classes} = \frac{\sum_{i=1}^{n} \left(\frac{s_i+e_i}{2} - \mu\right)^2 \times f_i}{\sum_{i=1}^{n} f_i}",
        type="equation"
    ))

    total_frequency = 0
    sum_fx = 0
    sum_fx2 = 0
    for s, e, f in data:
        mid = (s + e) / 2
        total_frequency += f
        sum_fx += mid * f
        sum_fx2 += (mid ** 2) * f

    steps.append(MathStep(
        description="Total Frequency",
        latex=rf"\text{{Total Frequency}} = {total_frequency}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Sum of ((midpoint)^2 * frequency)",
        latex=rf"\sum{{\left(\frac{{s+e}}{{2}}\right)^2 \times f}} = {sum_fx2}",
        type="equation"
    ))
    
    mean_val = sum_fx / total_frequency
    steps.append(MathStep(
        description="Mean of Classes",
        latex=rf"\mu = \frac{{{sum_fx}}}{{{total_frequency}}} = {mean_val}",
        type="equation"
    ))

    variance_val = (sum_fx2 / total_frequency) - (mean_val ** 2)
    steps.append(MathStep(
        description="Variance of Classes",
        latex=rf"\text{{Variance of Classes}} = \frac{{{sum_fx2}}}{{{total_frequency}}} - ({mean_val})^2 = {variance_val}",
        type="equation"
    ))
    
    return steps

def std_dev_of_classes(data_str: str):
    steps = []
    try:
        data = parse_range(data_str)
    except Exception as e:
        steps.append(MathStep("Error", str(e), "text"))
        return steps
        
    if not data:
        steps.append(MathStep("Error", "Dataset is empty", "text"))
        return steps
        
    # Show initial data
    data_latex = r"\{ " + ", ".join(f"({s}-{e}] : {f}" for s, e, f in data) + r" \}"
    steps.append(MathStep(
        description="Dataset",
        latex=data_latex,
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Formula for Standard Deviation of Classes",
        latex=r"\text{Standard Deviation of Classes} = \sqrt{\frac{\sum_{i=1}^{n} \left(\frac{s_i+e_i}{2} - \mu\right)^2 \times f_i}{\sum_{i=1}^{n} f_i}}",
        type="equation"
    ))

    total_frequency = 0
    sum_fx = 0
    sum_fx2 = 0
    for s, e, f in data:
        mid = (s + e) / 2
        total_frequency += f
        sum_fx += mid * f
        sum_fx2 += (mid ** 2) * f

    steps.append(MathStep(
        description="Total Frequency",
        latex=rf"\text{{Total Frequency}} = {total_frequency}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="Sum of ((midpoint)^2 * frequency)",
        latex=rf"\sum{{\left(\frac{{s+e}}{{2}}\right)^2 \times f}} = {sum_fx2}",
        type="equation"
    ))
    
    mean_val = sum_fx / total_frequency
    steps.append(MathStep(
        description="Mean of Classes",
        latex=rf"\mu = \frac{{{sum_fx}}}{{{total_frequency}}} = {mean_val}",
        type="equation"
    ))

    variance_val = (sum_fx2 / total_frequency) - (mean_val ** 2)
    steps.append(MathStep(
        description="Variance of Classes",
        latex=rf"\text{{Variance}} = \frac{{{sum_fx2}}}{{{total_frequency}}} - ({mean_val})^2 = {variance_val}",
        type="equation"
    ))

    std_dev_val = variance_val**0.5
    steps.append(MathStep(
        description="Standard Deviation of Classes",
        latex=rf"\text{{Standard Deviation of Classes}} = \sqrt{{{variance_val}}} = {std_dev_val}",
        type="equation"
    ))
    
    return steps

def centile_of_classes(data_str: str, centile: int):
    steps = []
    try:
        data = parse_range(data_str)
    except Exception as e:
        steps.append(MathStep("Error", str(e), "text"))
        return steps
        
    if not data:
        steps.append(MathStep("Error", "Dataset is empty", "text"))
        return steps
        
    # Show initial data
    data_latex = r"\{ " + ", ".join(f"({s}-{e}] : {f}" for s, e, f in data) + r" \}"
    steps.append(MathStep(
        description="Dataset",
        latex=data_latex,
        type="equation"
    ))
    
    steps.append(MathStep(
        description=f"Formula for the {centile}th Centile (Percentile)",
        latex=r"P_{k} = L + \left( \frac{\frac{k}{100}N - CF_b}{f_c} \right) \times h",
        type="equation"
    ))
    n=sum(f for s, e, f in data)
    steps.append(MathStep(
        description="Total Frequency",
        latex=rf"\text{{Total Frequency}} = {n}",
        type="equation"
    ))
    
    k = (centile / 100) * n
    steps.append(MathStep(
        description="Position of the Centile",
        latex=rf"\frac{{{centile}}}{{100}} \times {n} = {k}",
        type="equation"
    ))
    F=0
    L=0
    f_c=0
    length=0
    for s, e, f in data:
        if F + f >= k:
            L=s
            f_c=f
            length = e - s
            break
        F+=f
        
    value=L + (k - F)*length/f_c
    
    steps.append(MathStep(
        description="Lower boundary of the",
        latex=rf"\text{{Lower boundary of the }} {centile}\text{{th Centile (Percentile)}} = {L}",
        type="equation"
    ))   
    steps.append(MathStep(
        description="Length of the class interval",
        latex=rf"\text{{Length of the class interval}} = {length}",
        type="equation"
    ))
    steps.append(MathStep(
        description="Frequency of the",
        latex=rf"\text{{Frequency of the }} {centile}\text{{th Centile (Percentile)}} = {f_c}",
        type="equation"
    ))   
    steps.append(MathStep(
        description="Cumulative frequency before the",
        latex=rf"\text{{Cumulative frequency before the }} {centile}\text{{th Centile (Percentile)}} = {F}",
        type="equation"
    ))   
    steps.append(MathStep(
        description=f"Centile {centile}th of Classes",
        latex=rf"P_{{{centile}}} = {L} + \left( \frac{{{k} - {F}}}{{{f_c}}} \right) \times {length}",
        type="equation"
    ))
    steps.append(MathStep(
        description=f"{centile}th Centile (Percentile) of Classes",
        latex=rf"P_{{{centile}}} = {value}",
        type="equation"
    ))    
    
    return steps

def inter_quarterly_range(data_str: str):
    steps = []
    try:
        data = parse_range(data_str)
    except Exception as e:
        steps.append(MathStep("Error", str(e), "text"))
        return steps
        
    if not data:
        steps.append(MathStep("Error", "Dataset is empty", "text"))
        return steps
        
    # Show initial data
    data_latex = r"\{ " + ", ".join(f"({s}-{e}] : {f}" for s, e, f in data) + r" \}"
    steps.append(MathStep(
        description="Dataset",
        latex=data_latex,
        type="equation"
    ))
    
    steps.append(MathStep(
        description=f"Formula for the Inter-quarterly Range",
        latex=r"\text{Inter-quarterly Range} = Q_3 - Q_1",
        type="equation"
    ))
    
    steps.append(MathStep(
        description=f"Q1 (25th Percentile) of Classes",
        latex=f"Q_1 = {centile_of_classes(data_str, 25)[-1].latex}",
        type="equation"
    ))
    Q_1=centile_of_classes(data_str,25)
    steps.extend(Q_1)
    steps.append(MathStep(
        description=f"Q3 (75th Percentile) of Classes",
        latex=f"Q_3 = {centile_of_classes(data_str, 75)[-1].latex}",
        type="equation"
    ))
    Q_3=centile_of_classes(data_str,75)
    steps.extend(Q_3)
    
    steps.append(MathStep(
        description=f"Inter-quarterly Range of Classes",
        latex=f"\text{{Inter-quarterly Range}} = {Q_3[-1].latex} - {Q_1[-1].latex}",
        type="equation"
    ))    
    
    return steps

def std_score(data_str: str, value: int):
    steps = []
    try:
        data = parse_range(data_str)
    except Exception as e:
        steps.append(MathStep("Error", str(e), "text"))
        return steps
        
    if not data:
        steps.append(MathStep("Error", "Dataset is empty", "text"))
        return steps
        
    # Show initial data
    data_latex = r"\{ " + ", ".join(f"({s}-{e}] : {f}" for s, e, f in data) + r" \}"
    steps.append(MathStep(
        description="Dataset",
        latex=data_latex,
        type="equation"
    ))
    
    steps.append(MathStep(
        description=f"Formula for the Standard Score",
        latex=r"Z = \frac{{x - \mu}}{{\sigma}}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description=f"Mean",
        latex=f"\mu = {mean_of_classes(data_str)[-1].latex}",
        type="equation"
    ))
    mean=mean_of_classes(data_str)
    steps.extend(mean)
    steps.append(MathStep(
        description=f"Standard Deviation",
        latex=f"\sigma = {std_dev_of_classes(data_str)[-1].latex}",
        type="equation"
    ))
    std_dev=std_dev_of_classes(data_str)
    steps.extend(std_dev)
    steps.append(MathStep(
        description=f"Standard Score",
        latex=f"Z = \frac{{{value} - {mean[-1].latex}}}{{{std_dev[-1].latex}}}",
        type="equation"
    ))
    
    return steps