from math_models import MathStep
import re
import math
from typing import List, Tuple, Dict, Any, Optional, Union

try:
    import scipy.stats as stats_dist
    HAVE_SCIPY = True
except ImportError:
    HAVE_SCIPY = False

def fmt_num(val: Union[int, float]) -> str:
    """Format numeric values nicely without trailing zeros."""
    if abs(val - round(val)) < 1e-9:
        return str(int(round(val)))
    return f"{val:.4g}"

def parse_data(data_str: str) -> List[float]:
    # Expects comma/space separated numbers, e.g., "1, 2, 3, 4" or "[1, 2, 3]" or "mean([1, 2, 3])"
    s = str(data_str).strip()
    # If wrapped in function parentheses e.g. mean(...)
    m = re.search(r'\((.*)\)', s)
    if m and not re.search(r'\(\s*\d+\s*-\s*\d+', s):  # ensure not range like (0-10-5)
        s = m.group(1).strip()
    s = s.strip("[]{}() ")
    try:
        if ',' in s:
            tokens = [x.strip() for x in s.split(',') if x.strip()]
        else:
            tokens = s.split()
        nums = [float(x) for x in tokens if x]
        if not nums:
            raise ValueError("No numbers detected.")
        return nums
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
        latex=rf"\sigma = \sqrt{{{sum_sq_diff/n:g}}} = {math.sqrt(sum_sq_diff/n):g}",
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

    steps.append(MathStep(
        description="The density of the modal class is",
        latex=rf"\text{{Density of Modal Class}} = {h}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="The density of the preceding class is",
        latex=rf"\text{{Density of Preceding Class}} = {h_prev}",
        type="equation"
    ))
    
    steps.append(MathStep(
        description="The density of the succeeding class is",
        latex=rf"\text{{Density of Succeeding Class}} = {h_next}",
        type="equation"
    ))

    total_freq = sum(f for s, e, f in data)
    steps.append(MathStep(
        description="The total frequency is",
        latex=rf"\text{{Total Frequency}} = {total_freq}",
        type="equation"
    ))

    denom_mode = 2 * h - h_prev - h_next
    mode_val = L + (length * (h - h_prev)) / denom_mode if abs(denom_mode) > 1e-9 else float(L)

    steps.append(MathStep(
        description="The formula for the mode of classes is",
        latex=r"\text{Mode} = L + \frac{c \cdot (h_m - h_{m-1})}{2h_m - h_{m-1} - h_{m+1}}",
        type="equation"
    ))
    steps.append(MathStep(
        description="Plugging in the values, we get",
        latex=rf"\text{{Mode}} = {L} + \frac{{{length} \cdot ({fmt_num(h)} - {fmt_num(h_prev)})}}{{2({fmt_num(h)}) - {fmt_num(h_prev)} - {fmt_num(h_next)}}} = {fmt_num(mode_val)}",
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
        description="Mean",
        latex=rf"\mu = {mean_of_classes(data_str)[-1].latex}",
        type="equation"
    ))
    mean=mean_of_classes(data_str)
    steps.extend(mean)
    steps.append(MathStep(
        description="Standard Deviation",
        latex=rf"\sigma = {std_dev_of_classes(data_str)[-1].latex}",
        type="equation"
    ))
    std_dev=std_dev_of_classes(data_str)
    steps.extend(std_dev)
    steps.append(MathStep(
        description="Standard Score",
        latex=rf"Z = \frac{{{value} - {mean[-1].latex}}}{{{std_dev[-1].latex}}}",
        type="equation"
    ))
    
    return steps


# ─────────────────────────────────────────────────────────────────────────────
# ADVANCED EXTENSIONS: SUMMARY, REGRESSION, PROBABILITY, HYPOTHESIS TESTING
# ─────────────────────────────────────────────────────────────────────────────

def iqr_raw(data_str: str) -> Tuple[str, List[MathStep]]:
    """Calculates Quartiles Q1, Q3, and IQR on raw numerical datasets."""
    steps = []
    data = sorted(parse_data(data_str))
    n = len(data)
    if n < 4:
        raise ValueError("Dataset must contain at least 4 observations to compute quartiles.")

    data_latex = r"\{ " + ", ".join(f"{x:g}" for x in data) + r" \}"
    steps.append(MathStep("Sorted Dataset", data_latex, "equation"))

    mid = n // 2
    lower_half = data[:mid]
    upper_half = data[mid:] if n % 2 == 0 else data[mid + 1:]

    def get_median(arr):
        k = len(arr)
        if k % 2 == 1:
            return arr[k // 2]
        return (arr[k // 2 - 1] + arr[k // 2]) / 2.0

    q1 = get_median(lower_half)
    q2 = get_median(data)
    q3 = get_median(upper_half)
    iqr_val = q3 - q1

    steps.append(MathStep(
        "First Quartile (Q1 - 25th Percentile)",
        rf"Q_1 = {fmt_num(q1)}",
        "equation"
    ))
    steps.append(MathStep(
        "Second Quartile / Median (Q2 - 50th Percentile)",
        rf"Q_2 = \text{{Median}} = {fmt_num(q2)}",
        "equation"
    ))
    steps.append(MathStep(
        "Third Quartile (Q3 - 75th Percentile)",
        rf"Q_3 = {fmt_num(q3)}",
        "equation"
    ))
    steps.append(MathStep(
        "Interquartile Range Formula",
        rf"\text{{IQR}} = Q_3 - Q_1 = {fmt_num(q3)} - {fmt_num(q1)} = {fmt_num(iqr_val)}",
        "equation"
    ))

    # Outlier detection via Tukey's fences
    lower_fence = q1 - 1.5 * iqr_val
    upper_fence = q3 + 1.5 * iqr_val
    outliers = [x for x in data if x < lower_fence or x > upper_fence]
    outliers_str = ", ".join(fmt_num(x) for x in outliers) if outliers else r"\text{None}"

    fence_latex = rf"\text{{Inner Fences}} = [{fmt_num(lower_fence)}, {fmt_num(upper_fence)}], \quad \text{{Outliers}} = " + r"\{ " + outliers_str + r" \}"
    steps.append(MathStep(
        "Tukey's Outlier Fences [Q1 - 1.5*IQR, Q3 + 1.5*IQR]",
        fence_latex,
        "equation"
    ))

    return f"IQR = {fmt_num(iqr_val)} (Q1={fmt_num(q1)}, Q3={fmt_num(q3)})", steps


def five_number_summary(data_str: str) -> Tuple[str, List[MathStep]]:
    """Generates the comprehensive 5-Number Summary, sample/population variance, and moments."""
    steps = []
    data = sorted(parse_data(data_str))
    n = len(data)
    if not data:
        raise ValueError("Dataset is empty.")

    data_latex = r"\{ " + ", ".join(f"{x:g}" for x in data) + r" \}"
    steps.append(MathStep(f"Ordered Sample (n = {n})", data_latex, "equation"))

    min_val = data[0]
    max_val = data[-1]
    range_val = max_val - min_val
    sum_val = sum(data)
    mean_val = sum_val / n

    mid = n // 2
    lower_half = data[:mid]
    upper_half = data[mid:] if n % 2 == 0 else data[mid + 1:]

    def get_med(arr):
        k = len(arr)
        if k % 2 == 1:
            return arr[k // 2]
        return (arr[k // 2 - 1] + arr[k // 2]) / 2.0

    q1 = get_med(lower_half) if lower_half else min_val
    med_val = get_med(data)
    q3 = get_med(upper_half) if upper_half else max_val
    iqr_val = q3 - q1

    # Variances and Standard Deviations
    sum_sq_diff = sum((x - mean_val) ** 2 for x in data)
    pop_var = sum_sq_diff / n
    pop_sd = math.sqrt(pop_var)
    sample_var = sum_sq_diff / (n - 1) if n > 1 else 0.0
    sample_sd = math.sqrt(sample_var)

    # Mode
    freq: Dict[float, int] = {}
    for x in data:
        freq[x] = freq.get(x, 0) + 1
    max_f = max(freq.values())
    modes = [k for k, v in freq.items() if v == max_f]
    mode_str = ", ".join(fmt_num(m) for m in modes) if max_f > 1 else "No unique mode"

    steps.append(MathStep(
        "Five-Number Summary",
        rf"\text{{Min}} = {fmt_num(min_val)}, \quad Q_1 = {fmt_num(q1)}, \quad \text{{Median}} = {fmt_num(med_val)}, \quad Q_3 = {fmt_num(q3)}, \quad \text{{Max}} = {fmt_num(max_val)}",
        "equation"
    ))

    steps.append(MathStep(
        "Central Tendency (Mean, Median, Mode)",
        rf"\bar{{x}} = \frac{{{fmt_num(sum_val)}}}{{{n}}} = {fmt_num(mean_val)}, \quad \tilde{{x}} = {fmt_num(med_val)}, \quad \text{{Mode}} = {mode_str}",
        "equation"
    ))

    steps.append(MathStep(
        "Dispersion: Sample vs Population Variances",
        rf"s^2 = \frac{{\sum (x_i - \bar{{x}})^2}}{{n - 1}} = {fmt_num(sample_var)}, \quad \sigma^2 = \frac{{\sum (x_i - \mu)^2}}{{n}} = {fmt_num(pop_var)}",
        "equation"
    ))

    steps.append(MathStep(
        "Standard Deviations (s, sigma) & Spread",
        rf"s = \sqrt{{s^2}} = {fmt_num(sample_sd)}, \quad \sigma = {fmt_num(pop_sd)}, \quad \text{{IQR}} = {fmt_num(iqr_val)}, \quad \text{{Range}} = {fmt_num(range_val)}",
        "equation"
    ))

    sol = f"Mean={fmt_num(mean_val)}, Median={fmt_num(med_val)}, s={fmt_num(sample_sd)}, IQR={fmt_num(iqr_val)}"
    return sol, steps


def parse_paired_data(data_str: str) -> List[Tuple[float, float]]:
    """Parses paired (x, y) coordinates for regression analysis."""
    s = str(data_str).strip()
    # Remove outer function wrapper e.g. regression(...)
    m = re.search(r'^\w+\((.*)\)$', s)
    if m:
        s = m.group(1).strip()

    pairs: List[Tuple[float, float]] = []

    # 1. Format: [(1, 2), (2, 3)] or ((1, 2), (2, 3))
    paren_matches = re.findall(r'[\(\[]\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*[\)\]]', s)
    if paren_matches and len(paren_matches) >= 2:
        return [(float(x), float(y)) for x, y in paren_matches]

    # 2. Format: [1, 2, 3], [2, 4, 6]
    lists_match = re.findall(r'\[(.*?)\]', s)
    if len(lists_match) >= 2:
        xs = [float(n.strip()) for n in lists_match[0].split(',') if n.strip()]
        ys = [float(n.strip()) for n in lists_match[1].split(',') if n.strip()]
        if len(xs) == len(ys):
            return list(zip(xs, ys))

    # 3. Fallback: flat list of numbers alternating x1, y1, x2, y2
    flat_nums = [float(x) for x in re.findall(r'[-+]?\d*\.?\d+', s)]
    if len(flat_nums) >= 4 and len(flat_nums) % 2 == 0:
        return [(flat_nums[i], flat_nums[i+1]) for i in range(0, len(flat_nums), 2)]

    raise ValueError("Invalid paired data format. Expected points like: [(1, 2), (2, 3), (3, 5)] or [1, 2, 3], [2, 4, 6]")


def linear_regression(data_str: str, predict_x: Optional[float] = None) -> Tuple[str, List[MathStep]]:
    """
    Computes Ordinary Least Squares (OLS) Linear Regression:
    Pearson correlation r, R^2, slope m, intercept b, line equation,
    slope significance hypothesis test, and optional prediction.
    """
    steps = []
    pred_m = re.search(r'(?:predict|x_val|target)\s*[:=]\s*([-+]?\d*\.?\d+)', data_str, re.I)
    if pred_m and predict_x is None:
        predict_x = float(pred_m.group(1))

    pairs = parse_paired_data(data_str)
    n = len(pairs)
    if n < 2:
        raise ValueError("Regression requires at least 2 coordinate pairs (x, y).")

    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]

    pts_latex = r"\{ " + ", ".join(f"({fmt_num(x)}, {fmt_num(y)})" for x, y in pairs) + r" \}"
    steps.append(MathStep(f"Paired Sample Data (N = {n})", pts_latex, "equation"))

    sum_x = sum(xs)
    sum_y = sum(ys)
    sum_x2 = sum(x * x for x in xs)
    sum_y2 = sum(y * y for y in ys)
    sum_xy = sum(x * y for x, y in pairs)

    mean_x = sum_x / n
    mean_y = sum_y / n

    steps.append(MathStep(
        "Summary Sums & Sample Means",
        rf"\sum x = {fmt_num(sum_x)}, \quad \sum y = {fmt_num(sum_y)}, \quad \bar{{x}} = {fmt_num(mean_x)}, \quad \bar{{y}} = {fmt_num(mean_y)}",
        "equation"
    ))

    # Sum of Squares
    ss_xx = sum_x2 - (sum_x ** 2) / n
    ss_yy = sum_y2 - (sum_y ** 2) / n
    ss_xy = sum_xy - (sum_x * sum_y) / n

    steps.append(MathStep(
        "Sum of Squared Deviations (SSxx, SSyy, SSxy)",
        rf"SS_{{xx}} = \sum x^2 - \frac{{(\sum x)^2}}{{N}} = {fmt_num(ss_xx)}, \quad SS_{{yy}} = {fmt_num(ss_yy)}, \quad SS_{{xy}} = {fmt_num(ss_xy)}",
        "equation"
    ))

    # Pearson Correlation r
    denom = math.sqrt(ss_xx * ss_yy) if ss_xx * ss_yy > 0 else 1e-9
    r_val = ss_xy / denom
    r2_val = r_val ** 2

    # Slope m and Intercept b
    slope_m = ss_xy / ss_xx if abs(ss_xx) > 1e-9 else 0.0
    intercept_b = mean_y - slope_m * mean_x

    sign_b = f"+ {fmt_num(abs(intercept_b))}" if intercept_b >= 0 else f"- {fmt_num(abs(intercept_b))}"
    line_eq = rf"\hat{{y}} = {fmt_num(slope_m)}x {sign_b}"

    steps.append(MathStep(
        "Slope (m) and Y-Intercept (b) Equations",
        rf"m = \frac{{SS_{{xy}}}}{{SS_{{xx}}}} = \frac{{{fmt_num(ss_xy)}}}{{{fmt_num(ss_xx)}}} = {fmt_num(slope_m)}, \quad b = \bar{{y}} - m\bar{{x}} = {fmt_num(intercept_b)}",
        "equation"
    ))

    steps.append(MathStep(
        "Least Squares Line of Best Fit",
        line_eq,
        "equation"
    ))

    steps.append(MathStep(
        "Pearson Correlation (r) & Determination (R^2)",
        rf"r = \frac{{SS_{{xy}}}}{{\sqrt{{SS_{{xx}} \cdot SS_{{yy}}}}}} = {r_val:.4f}, \quad R^2 = {r2_val:.4f} \quad ({r2_val*100:.1f}\% \text{{ variance explained}})",
        "equation"
    ))

    # Standard error of regression and slope hypothesis testing
    if n > 2 and ss_xx > 1e-9:
        ss_res = max(0.0, ss_yy - slope_m * ss_xy)
        se_est = math.sqrt(ss_res / (n - 2))
        se_slope = se_est / math.sqrt(ss_xx)
        t_slope = slope_m / se_slope if se_slope > 1e-9 else 0.0
        df = n - 2
        p_val = 2.0 * (1.0 - stats_dist.t.cdf(abs(t_slope), df)) if HAVE_SCIPY else 0.05
        steps.append(MathStep(
            "Inference on Slope (Standard Error & t-test H0: beta_1 = 0)",
            rf"s_e = \sqrt{{\frac{{SS_{{res}}}}{{n - 2}}}} = {fmt_num(se_est)}, \quad SE(m) = \frac{{s_e}}{{\sqrt{{SS_{{xx}}}}}} = {fmt_num(se_slope)}, \quad t = \frac{{m}}{{SE(m)}} = {t_slope:.3f} \quad (p = {p_val:.4g})",
            "equation"
        ))

    corr_desc = "Strong positive" if r_val > 0.7 else ("Moderate positive" if r_val > 0.3 else ("Strong negative" if r_val < -0.7 else ("Moderate negative" if r_val < -0.3 else "Weak / uncorrelated")))
    steps.append(MathStep(
        f"Statistical Interpretation: {corr_desc} linear association",
        rf"\text{{Relationship: }} {corr_desc} \quad (r = {r_val:.4f})",
        "equation"
    ))

    if predict_x is not None:
        y_pred = slope_m * predict_x + intercept_b
        steps.append(MathStep(
            f"Prediction for x = {fmt_num(predict_x)}",
            rf"\hat{{y}}({fmt_num(predict_x)}) = {fmt_num(slope_m)}({fmt_num(predict_x)}) {sign_b} = {fmt_num(y_pred)}",
            "equation"
        ))

    sol = f"y = {fmt_num(slope_m)}x {sign_b} (r = {r_val:.4f}, R^2 = {r2_val:.4f})"
    if predict_x is not None:
        sol += f", y_pred({fmt_num(predict_x)}) = {fmt_num(slope_m * predict_x + intercept_b)}"
    return sol, steps


def z_score_raw(data_str: str, value: float) -> Tuple[str, List[MathStep]]:
    """Calculates Z-score and cumulative standard normal probability on a dataset."""
    steps = []
    data = parse_data(data_str)
    n = len(data)
    if n == 0:
        raise ValueError("Dataset is empty.")

    mean_val = sum(data) / n
    variance_val = sum((x - mean_val) ** 2 for x in data) / n
    sd_val = math.sqrt(variance_val)

    if sd_val < 1e-9:
        raise ValueError("Standard deviation is zero; all data points are identical.")

    z_val = (value - mean_val) / sd_val
    prob_less = 0.5 * (1.0 + math.erf(z_val / math.sqrt(2.0)))

    steps.append(MathStep(
        "Dataset Parameters",
        rf"\mu = {fmt_num(mean_val)}, \quad \sigma = {fmt_num(sd_val)}, \quad \text{{Query value }} x = {fmt_num(value)}",
        "equation"
    ))

    steps.append(MathStep(
        "Standard Score Formula",
        rf"Z = \frac{{x - \mu}}{{\sigma}} = \frac{{{fmt_num(value)} - {fmt_num(mean_val)}}}{{{fmt_num(sd_val)}}} = {z_val:.4f}",
        "equation"
    ))

    steps.append(MathStep(
        "Standard Normal Cumulative Probability",
        rf"P(Z \le {z_val:.2f}) = \Phi({z_val:.2f}) = {prob_less:.4f} \quad ({prob_less * 100:.2f}\text{{th percentile}})",
        "equation"
    ))

    sol = f"Z = {z_val:.4f}, P(X <= {fmt_num(value)}) = {prob_less:.4f}"
    return sol, steps


def normal_distribution_cdf(x: float, mu: float = 0.0, sigma: float = 1.0) -> Tuple[str, List[MathStep]]:
    """Evaluates standard/normal distribution probabilities P(X <= x) and two-tailed p-values."""
    steps = []
    if sigma <= 0:
        raise ValueError("Standard deviation sigma must be strictly positive.")

    z = (x - mu) / sigma
    p_cum = 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))
    p_tail = 1.0 - p_cum
    p_two_tailed = 2.0 * (1.0 - 0.5 * (1.0 + math.erf(abs(z) / math.sqrt(2.0))))

    steps.append(MathStep(
        "Distribution Parameters",
        rf"X \sim \mathcal{{N}}(\mu = {fmt_num(mu)}, \sigma^2 = {fmt_num(sigma**2)}), \quad x = {fmt_num(x)}",
        "equation"
    ))

    steps.append(MathStep(
        "Standardization to Z-score",
        rf"Z = \frac{{x - \mu}}{{\sigma}} = \frac{{{fmt_num(x)} - {fmt_num(mu)}}}{{{fmt_num(sigma)}}} = {z:.4f}",
        "equation"
    ))

    steps.append(MathStep(
        "Cumulative Probability (Left Tail)",
        rf"P(X \le {fmt_num(x)}) = \Phi({z:.4f}) = {p_cum:.4f}",
        "equation"
    ))

    steps.append(MathStep(
        "Upper Tail & Two-Tailed Significance",
        rf"P(X > {fmt_num(x)}) = {p_tail:.4f}, \quad P(|Z| \ge |{z:.2f}|) = {p_two_tailed:.4f}",
        "equation"
    ))

    sol = f"P(X <= {fmt_num(x)}) = {p_cum:.4f} (Z = {z:.4f})"
    return sol, steps


def one_sample_t_test(data_str: str, mu0: float = 0.0) -> Tuple[str, List[MathStep]]:
    """Calculates 1-Sample Student's t-test statistic and standard error."""
    steps = []
    data = parse_data(data_str)
    n = len(data)
    if n < 2:
        raise ValueError("Student's t-test requires at least 2 sample observations.")

    mean_val = sum(data) / n
    var_sample = sum((x - mean_val) ** 2 for x in data) / (n - 1)
    s_val = math.sqrt(var_sample)
    se = s_val / math.sqrt(n)
    t_stat = (mean_val - mu0) / se if se > 1e-9 else 0.0
    df = n - 1

    steps.append(MathStep(
        "Null and Alternative Hypotheses",
        rf"H_0: \mu = {fmt_num(mu0)} \quad \text{{vs}} \quad H_a: \mu \neq {fmt_num(mu0)}",
        "equation"
    ))

    steps.append(MathStep(
        "Sample Statistics",
        rf"n = {n}, \quad \bar{{x}} = {fmt_num(mean_val)}, \quad s = {fmt_num(s_val)}, \quad \text{{SE}} = \frac{{s}}{{\sqrt{{n}}}} = {se:.4f}",
        "equation"
    ))

    steps.append(MathStep(
        "T-Statistic Formula",
        rf"t = \frac{{\bar{{x}} - \mu_0}}{{SE}} = \frac{{{fmt_num(mean_val)} - {fmt_num(mu0)}}}{{{se:.4f}}} = {t_stat:.4f}",
        "equation"
    ))

    steps.append(MathStep(
        "Degrees of Freedom",
        rf"\text{{df}} = n - 1 = {df}, \quad t = {t_stat:.4f}",
        "equation"
    ))

    sol = f"t = {t_stat:.4f} (df={df}, sample mean={fmt_num(mean_val)})"
    return sol, steps


def combinatorics(n: int, k: int) -> Tuple[str, List[MathStep]]:
    """Calculates Permutations P(n, k) and Combinations C(n, k)."""
    steps = []
    if n < 0 or k < 0:
        raise ValueError("n and k must be non-negative integers.")
    if k > n:
        raise ValueError(f"k ({k}) cannot be greater than n ({n}).")

    perm = math.perm(n, k)
    comb = math.comb(n, k)

    steps.append(MathStep(
        "Parameters",
        rf"n = {n}, \quad k = {k}",
        "equation"
    ))

    steps.append(MathStep(
        "Permutations Formula P(n, k) - Order Matters",
        rf"P({n}, {k}) = \frac{{{n}!}}{{({n}-{k})!}} = {perm}",
        "equation"
    ))

    steps.append(MathStep(
        "Combinations Formula C(n, k) - Order Does Not Matter",
        rf"\binom{{{n}}}{{{k}}} = \frac{{{n}!}}{{{k}!({n}-{k})!}} = {comb}",
        "equation"
    ))

    sol = f"C({n}, {k}) = {comb}, P({n}, {k}) = {perm}"
    return sol, steps


def binomial_distribution(n: int, k: int, p: float) -> Tuple[str, List[MathStep]]:
    """Evaluates Binomial Probability Mass Function P(X = k), Expected Value, and Variance."""
    steps = []
    if n < 0 or k < 0 or k > n:
        raise ValueError("Binomial requires 0 <= k <= n.")
    if not (0.0 <= p <= 1.0):
        raise ValueError("Probability p must satisfy 0 <= p <= 1.")

    q = 1.0 - p
    comb = math.comb(n, k)
    prob = comb * (p ** k) * (q ** (n - k))
    expected = n * p
    variance_val = n * p * q
    sd_val = math.sqrt(variance_val)

    steps.append(MathStep(
        "Binomial Model: X ~ Binomial(n, p)",
        rf"n = {n}, \quad k = {k}, \quad p = {fmt_num(p)}, \quad q = 1 - p = {fmt_num(q)}",
        "equation"
    ))

    steps.append(MathStep(
        "Probability Mass Function Formula",
        rf"P(X = k) = \binom{{n}}{{k}} p^k (1 - p)^{{n - k}}",
        "equation"
    ))

    steps.append(MathStep(
        "Exact Evaluation",
        rf"P(X = {k}) = \binom{{{n}}}{{{k}}} ({fmt_num(p)})^{{{k}}} ({fmt_num(q)})^{{{n - k}}} = {comb} \times {p**k:.6g} \times {q**(n-k):.6g} = {prob:.6f}",
        "equation"
    ))

    steps.append(MathStep(
        "Expected Value (Mean) and Standard Deviation",
        rf"\mu = E[X] = n \cdot p = {fmt_num(expected)}, \quad \sigma = \sqrt{{n \cdot p \cdot q}} = {fmt_num(sd_val)}",
        "equation"
    ))

    sol = f"P(X = {k}) = {prob:.6f} (Mean={fmt_num(expected)}, SD={fmt_num(sd_val)})"
    return sol, steps


def poisson_distribution(lam: float, k: int) -> Tuple[str, List[MathStep]]:
    """Evaluates Poisson distribution P(X = k) given rate parameter lambda."""
    steps = []
    if lam <= 0:
        raise ValueError("Rate parameter lambda must be positive.")
    if k < 0:
        raise ValueError("Number of occurrences k must be non-negative.")

    prob = (math.pow(lam, k) * math.exp(-lam)) / math.factorial(k)

    steps.append(MathStep(
        "Poisson Model: X ~ Poisson(lambda)",
        rf"\lambda = {fmt_num(lam)}, \quad k = {k}",
        "equation"
    ))

    steps.append(MathStep(
        "Poisson PMF Formula",
        rf"P(X = k) = \frac{{\lambda^k e^{{-\lambda}}}}{{k!}} = \frac{{{fmt_num(lam)}^{{{k}}} e^{{-{fmt_num(lam)}}}}}{{{k}!}} = {prob:.6f}",
        "equation"
    ))

    sol = f"P(X = {k}) = {prob:.6f} (Mean = Var = {fmt_num(lam)})"
    return sol, steps


# ─────────────────────────────────────────────────────────────────────────────
# 1. COMPREHENSIVE STANDARD DEVIATION
# ─────────────────────────────────────────────────────────────────────────────
def std_dev_comprehensive(data_str: str, is_sample: Optional[bool] = True) -> Tuple[str, List[MathStep]]:
    """
    Computes sample and population standard deviation, sum of squares,
    variance, standard error of the mean, and coefficient of variation.
    """
    steps = []
    data = parse_data(data_str)
    n = len(data)
    if n < 1:
        raise ValueError("Dataset cannot be empty.")
    if is_sample and n < 2:
        raise ValueError("Sample standard deviation requires at least 2 data points.")

    data_latex = r"\{ " + ", ".join(f"{x:g}" for x in data) + r" \}"
    steps.append(MathStep(f"Sample Dataset (N = {n})", data_latex, "equation"))

    mean_val = sum(data) / n
    steps.append(MathStep(
        "Mean Calculation",
        rf"\bar{{x}} = \frac{{\sum x_i}}{{n}} = \frac{{{fmt_num(sum(data))}}}{{{n}}} = {fmt_num(mean_val)}",
        "equation"
    ))

    sum_sq_diff = sum((x - mean_val) ** 2 for x in data)
    diff_table_rows = [rf"({fmt_num(x)} - {fmt_num(mean_val)})^2 = {fmt_num((x - mean_val)**2)}" for x in data[:6]]
    if len(data) > 6:
        diff_table_rows.append(r"\dots")

    steps.append(MathStep(
        "Sum of Squared Deviations (SS)",
        rf"SS = \sum (x_i - \bar{{x}})^2 = " + " + ".join(diff_table_rows[:4]) + rf" = {fmt_num(sum_sq_diff)}",
        "equation"
    ))

    pop_var = sum_sq_diff / n
    pop_sd = math.sqrt(pop_var)
    sample_var = sum_sq_diff / (n - 1) if n > 1 else pop_var
    sample_sd = math.sqrt(sample_var)
    se = sample_sd / math.sqrt(n)
    cv = (sample_sd / abs(mean_val) * 100.0) if abs(mean_val) > 1e-9 else 0.0

    steps.append(MathStep(
        "Sample Variance & Standard Deviation (Degrees of Freedom df = n - 1)",
        rf"s^2 = \frac{{SS}}{{n - 1}} = \frac{{{fmt_num(sum_sq_diff)}}}{{{n - 1}}} = {fmt_num(sample_var)}, \quad s = \sqrt{{s^2}} = {fmt_num(sample_sd)}",
        "equation"
    ))

    steps.append(MathStep(
        "Population Variance & Standard Deviation (N)",
        rf"\sigma^2 = \frac{{SS}}{{N}} = \frac{{{fmt_num(sum_sq_diff)}}}{{{n}}} = {fmt_num(pop_var)}, \quad \sigma = \sqrt{{\sigma^2}} = {fmt_num(pop_sd)}",
        "equation"
    ))

    steps.append(MathStep(
        "Standard Error (SE) and Coefficient of Variation (CV)",
        rf"SE = \frac{{s}}{{\sqrt{{n}}}} = \frac{{{fmt_num(sample_sd)}}}{{\sqrt{{{n}}}}} = {fmt_num(se)}, \quad CV = \frac{{s}}{{\bar{{x}}}} \times 100\% = {fmt_num(cv)}\%",
        "equation"
    ))

    sol = f"s = {fmt_num(sample_sd)} (sample), sigma = {fmt_num(pop_sd)} (population), SE = {fmt_num(se)}"
    return sol, steps


# ─────────────────────────────────────────────────────────────────────────────
# 2. PERCENTILE & PERCENTILE RANK
# ─────────────────────────────────────────────────────────────────────────────
def percentile_raw(data_str: str, p: float = 50.0) -> Tuple[str, List[MathStep]]:
    """
    Computes the p-th percentile of a numerical dataset using standard linear interpolation
    (NIST method 7) and nearest-rank method.
    """
    steps = []
    data = sorted(parse_data(data_str))
    n = len(data)
    if n == 0:
        raise ValueError("Dataset is empty.")
    if not (0.0 <= p <= 100.0):
        raise ValueError("Percentile p must be between 0 and 100.")

    data_latex = r"\{ " + ", ".join(f"{x:g}" for x in data) + r" \}"
    steps.append(MathStep(f"Ordered Dataset (n = {n})", data_latex, "equation"))

    rank = (p / 100.0) * (n - 1) + 1
    k = int(math.floor(rank))
    d = rank - k

    steps.append(MathStep(
        f"Percentile Rank Position for P_{{{fmt_num(p)}}}",
        rf"R = \frac{{P}}{{100}}(n - 1) + 1 = \frac{{{fmt_num(p)}}}{{100}}({n} - 1) + 1 = {rank:.3f}",
        "equation"
    ))

    if k >= n:
        p_val = data[-1]
    elif k <= 1:
        p_val = data[0]
    else:
        x_k = data[k - 1]
        x_k1 = data[k]
        p_val = x_k + d * (x_k1 - x_k)
        steps.append(MathStep(
            "Linear Interpolation Between Adjacent Ordered Values",
            rf"P_{{{fmt_num(p)}}} = x_{{({k})}} + (R - {k})(x_{{({k+1})}} - x_{{({k})}}) = {fmt_num(x_k)} + {d:.3f}({fmt_num(x_k1)} - {fmt_num(x_k)}) = {fmt_num(p_val)}",
            "equation"
        ))

    nr_idx = max(1, min(n, int(math.ceil((p / 100.0) * n))))
    nr_val = data[nr_idx - 1]
    steps.append(MathStep(
        "Nearest-Rank Method Comparison",
        rf"\text{{Rank}} = \lceil \frac{{{fmt_num(p)}}}{{100}} \times {n} \rceil = {nr_idx} \implies P_{{{fmt_num(p)}}}^{{\text{{NR}}}} = {fmt_num(nr_val)}",
        "equation"
    ))

    sol = f"P_{{{fmt_num(p)}}} = {fmt_num(p_val)}"
    return sol, steps


def percentile_rank_raw(data_str: str, value: float) -> Tuple[str, List[MathStep]]:
    """Calculates the percentile rank PR(x) of a given value in a dataset."""
    steps = []
    data = sorted(parse_data(data_str))
    n = len(data)
    if n == 0:
        raise ValueError("Dataset is empty.")

    below = sum(1 for x in data if x < value)
    equal = sum(1 for x in data if abs(x - value) < 1e-9)
    pr = ((below + 0.5 * equal) / n) * 100.0

    steps.append(MathStep(f"Ordered Sample (n = {n})", r"\{ " + ", ".join(f"{x:g}" for x in data) + r" \}", "equation"))
    steps.append(MathStep(
        "Percentile Rank Formula",
        rf"\text{{PR}}(x) = \frac{{B + 0.5E}}{{n}} \times 100\%",
        "equation"
    ))
    steps.append(MathStep(
        f"Evaluation for x = {fmt_num(value)}",
        rf"B = {below} \text{{ (values }} < {fmt_num(value)}), \quad E = {equal} \text{{ (values }} = {fmt_num(value)}), \quad \text{{PR}} = \frac{{{below} + 0.5({equal})}}{{{n}}} \times 100\% = {pr:.2f}\%",
        "equation"
    ))

    sol = f"PR({fmt_num(value)}) = {pr:.2f}%"
    return sol, steps


# ─────────────────────────────────────────────────────────────────────────────
# 4. SET THEORY OPERATIONS
# ─────────────────────────────────────────────────────────────────────────────
def parse_set(s: str) -> List[Any]:
    """Extracts elements from a set string e.g. {1, 2, 3} or [1, 2, 3]."""
    content = re.sub(r'^[A-Za-z0-9_]+\s*=\s*', '', s.strip())
    content = content.strip('{}[]() ')
    if not content:
        return []
    items = [x.strip() for x in content.split(',') if x.strip()]
    res = []
    for item in items:
        try:
            val = float(item)
            res.append(int(val) if val.is_integer() else val)
        except ValueError:
            res.append(item.strip("'\""))
    return res


def set_theory_operations(input_str: str) -> Tuple[str, List[MathStep]]:
    """
    Computes Set Union, Intersection, Difference, Symmetric Difference,
    Cartesian Product, Power Set size, Inclusion-Exclusion, and Jaccard Similarity.
    """
    steps = []
    matches = re.findall(r'[\{\[]([^\{\}\[\]]*)[\}\]]', input_str)
    if len(matches) < 2:
        raise ValueError("Set theory operations require at least two sets, e.g. union({1, 2, 3}, {3, 4, 5})")

    set_a = list(dict.fromkeys(parse_set(matches[0])))
    set_b = list(dict.fromkeys(parse_set(matches[1])))
    sa, sb = set(set_a), set(set_b)

    def set_to_latex(s_iter):
        elems = sorted(list(s_iter), key=lambda x: str(x))
        if not elems:
            return r"\emptyset"
        return r"\{ " + ", ".join(str(x) for x in elems) + r" \}"

    steps.append(MathStep("Input Sets", rf"A = {set_to_latex(sa)}, \quad B = {set_to_latex(sb)}", "equation"))
    steps.append(MathStep("Cardinalities", rf"|A| = {len(sa)}, \quad |B| = {len(sb)}", "equation"))

    # Union
    union_set = sa.union(sb)
    steps.append(MathStep(
        "Set Union (A U B)",
        rf"A \cup B = \{{ x \mid x \in A \lor x \in B \}} = {set_to_latex(union_set)} \quad (|A \cup B| = {len(union_set)})",
        "equation"
    ))

    # Intersection
    intersect_set = sa.intersection(sb)
    steps.append(MathStep(
        "Set Intersection (A ∩ B)",
        rf"A \cap B = \{{ x \mid x \in A \land x \in B \}} = {set_to_latex(intersect_set)} \quad (|A \cap B| = {len(intersect_set)})",
        "equation"
    ))

    # Inclusion-Exclusion
    steps.append(MathStep(
        "Principle of Inclusion-Exclusion",
        rf"|A \cup B| = |A| + |B| - |A \cap B| = {len(sa)} + {len(sb)} - {len(intersect_set)} = {len(sa) + len(sb) - len(intersect_set)}",
        "equation"
    ))

    # Relative Differences
    diff_a_b = sa.difference(sb)
    diff_b_a = sb.difference(sa)
    steps.append(MathStep(
        "Set Differences (A \\ B and B \\ A)",
        rf"A \setminus B = {set_to_latex(diff_a_b)}, \quad B \setminus A = {set_to_latex(diff_b_a)}",
        "equation"
    ))

    # Symmetric Difference
    sym_diff = sa.symmetric_difference(sb)
    steps.append(MathStep(
        "Symmetric Difference (A Delta B)",
        rf"A \Delta B = (A \setminus B) \cup (B \setminus A) = {set_to_latex(sym_diff)} \quad (|A \Delta B| = {len(sym_diff)})",
        "equation"
    ))

    # Cartesian Product
    cartesian_size = len(sa) * len(sb)
    steps.append(MathStep(
        "Cartesian Product (A x B)",
        rf"A \times B = \{{ (a, b) \mid a \in A, b \in B \}}, \quad |A \times B| = |A| \cdot |B| = {cartesian_size}",
        "equation"
    ))

    # Power Set
    steps.append(MathStep(
        "Power Set Cardinality |P(A)| and |P(B)|",
        rf"|\mathcal{{P}}(A)| = 2^{{|A|}} = 2^{{{len(sa)}}} = {2**len(sa)}, \quad |\mathcal{{P}}(B)| = 2^{{|B|}} = 2^{{{len(sb)}}} = {2**len(sb)}",
        "equation"
    ))

    # Jaccard similarity & Subsets
    jaccard = len(intersect_set) / len(union_set) if len(union_set) > 0 else 1.0
    is_sub_ab = sa.issubset(sb)
    is_sub_ba = sb.issubset(sa)
    is_disjoint = sa.isdisjoint(sb)

    rel_desc = "Disjoint" if is_disjoint else ("A is subset of B" if is_sub_ab else ("B is subset of A" if is_sub_ba else "Overlapping sets"))
    steps.append(MathStep(
        "Relationship and Jaccard Similarity",
        rf"\text{{Relationship: }} {rel_desc}, \quad J(A, B) = \frac{{|A \cap B|}}{{|A \cup B|}} = \frac{{{len(intersect_set)}}}{{{len(union_set)}}} = {jaccard:.4f}",
        "equation"
    ))

    sol = f"A U B = {set_to_latex(union_set)}, A intersect B = {set_to_latex(intersect_set)}, |A U B| = {len(union_set)}"
    return sol, steps


# ─────────────────────────────────────────────────────────────────────────────
# 5. ADVANCED COMBINATORICS
# ─────────────────────────────────────────────────────────────────────────────
def advanced_combinatorics(input_str: str) -> Tuple[str, List[MathStep]]:
    """
    Computes Permutations, Combinations, Multinomial coefficients,
    Combinations with repetition (stars & bars), Circular permutations, and Derangements.
    """
    steps = []
    s_lower = input_str.lower()

    if 'multinomial' in s_lower:
        arr_m = re.search(r'\[(.*?)\]', input_str)
        if arr_m:
            counts = [int(n.strip()) for n in arr_m.group(1).split(',') if n.strip()]
            n = sum(counts)
            denom_fact = 1
            denom_str = []
            for c in counts:
                denom_fact *= math.factorial(c)
                denom_str.append(f"{c}!")
            multi_val = math.factorial(n) // denom_fact
            steps.append(MathStep(
                "Multinomial Coefficient Formula",
                rf"\binom{{{n}}}{{{', '.join(str(c) for c in counts)}}} = \frac{{{n}!}}{{{r' \cdot '.join(denom_str)}}} = \frac{{{math.factorial(n)}}}{{{denom_fact}}} = {multi_val}",
                "equation"
            ))
            return f"Multinomial = {multi_val}", steps

    if 'derange' in s_lower or 'subfactorial' in s_lower:
        nums = [int(n) for n in re.findall(r'\d+', input_str)]
        n = nums[0] if nums else 4
        d_val = sum((-1)**i * (math.factorial(n) // math.factorial(i)) for i in range(n + 1))
        steps.append(MathStep(
            f"Derangements !{n} (Subfactorial - Permutations with No Fixed Point)",
            rf"!{n} = {n}! \sum_{{i=0}}^{{{n}}} \frac{{(-1)^i}}{{i!}} = {d_val}",
            "equation"
        ))
        return f"!{n} = {d_val}", steps

    if 'repeat' in s_lower or 'replacement' in s_lower or 'stars_and_bars' in s_lower:
        nums = [int(n) for n in re.findall(r'\d+', input_str)]
        if len(nums) >= 2:
            n, k = nums[0], nums[1]
            comb_rep = math.comb(n + k - 1, k)
            steps.append(MathStep(
                f"Combinations with Repetition (Stars & Bars): n = {n}, k = {k}",
                rf"\binom{{n + k - 1}}{{k}} = \binom{{{n} + {k} - 1}}{{{k}}} = \binom{{{n + k - 1}}}{{{k}}} = {comb_rep}",
                "equation"
            ))
            return f"C_rep({n}, {k}) = {comb_rep}", steps

    nums = [int(n) for n in re.findall(r'\d+', input_str)]
    if len(nums) < 2:
        raise ValueError("Combinatorics requires parameters n and k, e.g. combinations(10, 3) or nCr(10, 3)")

    n, k = nums[0], nums[1]
    if k > n:
        raise ValueError(f"k ({k}) cannot be greater than n ({n}).")

    perm = math.perm(n, k)
    comb = math.comb(n, k)
    circ_perm = math.factorial(n - 1) if n >= 1 else 1

    steps.append(MathStep("Input Parameters", rf"n = {n}, \quad k = {k}", "equation"))
    steps.append(MathStep(
        "Permutations Formula P(n, k) [Order Matters]",
        rf"P({n}, {k}) = \frac{{{n}!}}{{({n} - {k})!}} = \frac{{{n}!}}{{{n - k}!}} = {perm}",
        "equation"
    ))
    steps.append(MathStep(
        "Combinations Formula C(n, k) [Order Does Not Matter]",
        rf"\binom{{{n}}}{{{k}}} = \frac{{{n}!}}{{{k}! ({n} - {k})!}} = \frac{{{perm}}}{{{math.factorial(k)}}} = {comb}",
        "equation"
    ))
    steps.append(MathStep(
        "Circular Permutations of n Objects (n - 1)!",
        rf"(n - 1)! = ({n} - 1)! = {n - 1}! = {circ_perm}",
        "equation"
    ))

    sol = f"C({n}, {k}) = {comb}, P({n}, {k}) = {perm}"
    return sol, steps


# ─────────────────────────────────────────────────────────────────────────────
# 6. PROBABILITIES (PROPAILITIES)
# ─────────────────────────────────────────────────────────────────────────────
def probability_solver(input_str: str) -> Tuple[str, List[MathStep]]:
    """
    Evaluates probability rules: Bayes' theorem, conditional probability,
    addition rule, odds conversions, and classical probability.
    """
    steps = []
    s_lower = input_str.lower()

    if 'bayes' in s_lower:
        nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', input_str)]
        if len(nums) >= 3:
            p_a, p_b_given_a, p_b_given_nota = nums[0], nums[1], nums[2]
            p_nota = 1.0 - p_a
            p_b = p_b_given_a * p_a + p_b_given_nota * p_nota
            p_a_given_b = (p_b_given_a * p_a) / p_b if p_b > 0 else 0.0

            steps.append(MathStep(
                "Prior & Likelihood Probabilities",
                rf"P(A) = {fmt_num(p_a)}, \quad P(A') = {fmt_num(p_nota)}, \quad P(B \mid A) = {fmt_num(p_b_given_a)}, \quad P(B \mid A') = {fmt_num(p_b_given_nota)}",
                "equation"
            ))
            steps.append(MathStep(
                "Law of Total Probability P(B)",
                rf"P(B) = P(B \mid A)P(A) + P(B \mid A')P(A') = ({fmt_num(p_b_given_a)})({fmt_num(p_a)}) + ({fmt_num(p_b_given_nota)})({fmt_num(p_nota)}) = {p_b:.6f}",
                "equation"
            ))
            steps.append(MathStep(
                "Bayes' Theorem Posterior Probability P(A | B)",
                rf"P(A \mid B) = \frac{{P(B \mid A) P(A)}}{{P(B)}} = \frac{{{p_b_given_a * p_a:.6f}}}{{{p_b:.6f}}} = {p_a_given_b:.6f} \quad ({p_a_given_b * 100:.2f}\%)",
                "equation"
            ))
            return f"P(A|B) = {p_a_given_b:.6f}", steps

    if 'conditional' in s_lower:
        nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', input_str)]
        if len(nums) >= 2:
            p_ab, p_b = nums[0], nums[1]
            p_a_given_b = p_ab / p_b if p_b > 0 else 0.0
            steps.append(MathStep(
                "Conditional Probability Formula",
                rf"P(A \mid B) = \frac{{P(A \cap B)}}{{P(B)}} = \frac{{{fmt_num(p_ab)}}}{{{fmt_num(p_b)}}} = {p_a_given_b:.6f}",
                "equation"
            ))
            return f"P(A|B) = {p_a_given_b:.6f}", steps

    if 'addition' in s_lower or 'union' in s_lower:
        nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', input_str)]
        if len(nums) >= 2:
            p_a = nums[0]
            p_b = nums[1]
            p_ab = nums[2] if len(nums) >= 3 else 0.0
            p_union = p_a + p_b - p_ab
            steps.append(MathStep(
                "Probability Addition Rule Formula",
                rf"P(A \cup B) = P(A) + P(B) - P(A \cap B) = {fmt_num(p_a)} + {fmt_num(p_b)} - {fmt_num(p_ab)} = {p_union:.4f}",
                "equation"
            ))
            return f"P(A U B) = {p_union:.4f}", steps

    if 'odd' in s_lower:
        nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', input_str)]
        if len(nums) == 1:
            p = nums[0]
            if 0 < p < 1:
                odds_for = p / (1.0 - p)
                steps.append(MathStep(
                    "Odds in Favor from Probability P",
                    rf"\text{{Odds in Favor}} = \frac{{P}}{{1 - P}} = \frac{{{fmt_num(p)}}}{{{fmt_num(1.0 - p)}}} = {odds_for:.4f} : 1",
                    "equation"
                ))
                return f"Odds = {odds_for:.4f} : 1", steps
        elif len(nums) >= 2:
            a, b = nums[0], nums[1]
            p = a / (a + b)
            steps.append(MathStep(
                f"Probability from Odds {a}:{b}",
                rf"P = \frac{{a}}{{a + b}} = \frac{{{fmt_num(a)}}}{{{fmt_num(a)} + {fmt_num(b)}}} = {p:.4f} \quad ({p*100:.2f}\%)",
                "equation"
            ))
            return f"P = {p:.4f}", steps

    nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', input_str)]
    if len(nums) >= 2:
        fav, total = nums[0], nums[1]
        p = fav / total if total > 0 else 0.0
        steps.append(MathStep(
            "Classical Probability Definition",
            rf"P(E) = \frac{{n(E)}}{{n(S)}} = \frac{{{fmt_num(fav)}}}{{{fmt_num(total)}}} = {p:.4f} \quad ({p*100:.2f}\%)",
            "equation"
        ))
        steps.append(MathStep(
            "Complement Probability P(E')",
            rf"P(E') = 1 - P(E) = 1 - {p:.4f} = {1.0 - p:.4f}",
            "equation"
        ))
        return f"P = {p:.4f}", steps

    raise ValueError("Invalid probability parameters. Example: bayes(0.01, 0.95, 0.05) or probability(3, 10)")


# ─────────────────────────────────────────────────────────────────────────────
# 7. SPECIAL & SPATIAL DISTRIBUTIONS (SPACIAL DISTRIBUTIONS)
# ─────────────────────────────────────────────────────────────────────────────
def special_distributions_solver(input_str: str) -> Tuple[str, List[MathStep]]:
    """Evaluates Geometric, Hypergeometric, Exponential, and Uniform distributions."""
    steps = []
    s_lower = input_str.lower()
    nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', input_str)]

    if 'hyper' in s_lower:
        if len(nums) >= 4:
            N, K, n_draws, k_succ = int(nums[0]), int(nums[1]), int(nums[2]), int(nums[3])
            prob = (math.comb(K, k_succ) * math.comb(N - K, n_draws - k_succ)) / math.comb(N, n_draws)
            mean_val = n_draws * (K / N)
            steps.append(MathStep(
                "Hypergeometric Model: X ~ Hyper(N, K, n)",
                rf"N = {N} \text{{ (population)}}, \quad K = {K} \text{{ (successes)}}, \quad n = {n_draws} \text{{ (sample)}}, \quad k = {k_succ}",
                "equation"
            ))
            steps.append(MathStep(
                "Hypergeometric PMF Formula",
                rf"P(X = k) = \frac{{\binom{{K}}{{k}} \binom{{N - K}}{{n - k}}}}{{\binom{{N}}{{n}}}} = \frac{{\binom{{{K}}}{{{k_succ}}} \binom{{{N - K}}}{{{n_draws - k_succ}}}}}{{\binom{{{N}}}{{{n_draws}}}}} = {prob:.6f}",
                "equation"
            ))
            steps.append(MathStep("Expected Value (Mean)", rf"E[X] = n \frac{{K}}{{N}} = {n_draws} \cdot \frac{{{K}}}{{{N}}} = {mean_val:.4f}", "equation"))
            return f"P(X = {k_succ}) = {prob:.6f} (Mean = {mean_val:.4f})", steps

    if 'geom' in s_lower:
        if len(nums) >= 2:
            p, k = nums[0], int(nums[1])
            if not (0 < p <= 1) or k < 1:
                raise ValueError("Geometric requires 0 < p <= 1 and k >= 1.")
            prob = ((1.0 - p) ** (k - 1)) * p
            cum_prob = 1.0 - ((1.0 - p) ** k)
            mean_val = 1.0 / p
            var_val = (1.0 - p) / (p ** 2)
            steps.append(MathStep("Geometric Model: X ~ Geom(p)", rf"p = {fmt_num(p)}, \quad k = {k}", "equation"))
            steps.append(MathStep(
                "Probability Mass Function P(X = k)",
                rf"P(X = {k}) = (1 - p)^{{k - 1}} p = (1 - {fmt_num(p)})^{{{k - 1}}} ({fmt_num(p)}) = {prob:.6f}",
                "equation"
            ))
            steps.append(MathStep(
                "Cumulative CDF P(X <= k), Mean, and Variance",
                rf"P(X \le {k}) = 1 - (1 - p)^k = {cum_prob:.6f}, \quad E[X] = \frac{{1}}{{p}} = {fmt_num(mean_val)}, \quad \text{{Var}}(X) = \frac{{1 - p}}{{p^2}} = {fmt_num(var_val)}",
                "equation"
            ))
            return f"P(X = {k}) = {prob:.6f} (Mean = {fmt_num(mean_val)})", steps

    if 'expon' in s_lower:
        if len(nums) >= 2:
            lam, x_val = nums[0], nums[1]
            pdf = lam * math.exp(-lam * x_val)
            cdf = 1.0 - math.exp(-lam * x_val)
            mean_val = 1.0 / lam
            steps.append(MathStep("Exponential Model: X ~ Exp(lambda)", rf"\lambda = {fmt_num(lam)}, \quad x = {fmt_num(x_val)}", "equation"))
            steps.append(MathStep("Probability Density Function f(x)", rf"f({fmt_num(x_val)}) = \lambda e^{{-\lambda x}} = {pdf:.6f}", "equation"))
            steps.append(MathStep("Cumulative Probability P(X <= x) & Mean", rf"P(X \le {fmt_num(x_val)}) = 1 - e^{{-\lambda x}} = {cdf:.6f}, \quad E[X] = \frac{{1}}{{\lambda}} = {fmt_num(mean_val)}", "equation"))
            return f"P(X <= {fmt_num(x_val)}) = {cdf:.6f}", steps

    if 'uniform' in s_lower:
        if len(nums) >= 2:
            a, b = nums[0], nums[1]
            x_val = nums[2] if len(nums) >= 3 else (a + b) / 2.0
            span = b - a
            pdf = 1.0 / span
            cdf = min(1.0, max(0.0, (x_val - a) / span))
            mean_val = (a + b) / 2.0
            var_val = (span ** 2) / 12.0
            steps.append(MathStep("Continuous Uniform Model: X ~ U(a, b)", rf"a = {fmt_num(a)}, \quad b = {fmt_num(b)}, \quad \text{{Range}} = {fmt_num(span)}", "equation"))
            steps.append(MathStep("PDF and Cumulative Probability P(X <= x)", rf"f(x) = \frac{{1}}{{b - a}} = {pdf:.4f}, \quad P(X \le {fmt_num(x_val)}) = \frac{{{fmt_num(x_val)} - {fmt_num(a)}}}{{{fmt_num(span)}}} = {cdf:.4f}", "equation"))
            steps.append(MathStep("Mean and Variance", rf"E[X] = \frac{{a + b}}{{2}} = {fmt_num(mean_val)}, \quad \text{{Var}}(X) = \frac{{(b - a)^2}}{{12}} = {fmt_num(var_val)}", "equation"))
            return f"P(X <= {fmt_num(x_val)}) = {cdf:.4f} (Mean = {fmt_num(mean_val)})", steps

    raise ValueError("Invalid special distribution query. Examples: geometric(0.2, 3), hypergeometric(50, 10, 5, 2), exponential(0.5, 3), uniform(0, 10, 4)")


def spatial_distribution_solver(input_str: str) -> Tuple[str, List[MathStep]]:
    """Calculates spatial statistics: 2D Mean Center (Centroid) and Standard Distance dispersion."""
    steps = []
    pairs = parse_paired_data(input_str)
    n = len(pairs)
    if n < 2:
        raise ValueError("Spatial distribution requires at least 2 coordinate points (x, y).")

    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]

    steps.append(MathStep(f"Spatial Point Pattern (N = {n})", r"\{ " + ", ".join(f"({fmt_num(x)}, {fmt_num(y)})" for x, y in pairs) + r" \}", "equation"))

    mean_x = sum(xs) / n
    mean_y = sum(ys) / n

    steps.append(MathStep(
        "Spatial Mean Center (Centroid)",
        rf"\bar{{X}} = \frac{{\sum x_i}}{{N}} = {fmt_num(mean_x)}, \quad \bar{{Y}} = \frac{{\sum y_i}}{{N}} = {fmt_num(mean_y)} \implies \text{{Centroid}} = ({fmt_num(mean_x)}, {fmt_num(mean_y)})",
        "equation"
    ))

    sq_dist_sum = sum((x - mean_x)**2 + (y - mean_y)**2 for x, y in pairs)
    std_distance = math.sqrt(sq_dist_sum / n)

    steps.append(MathStep(
        "Standard Distance (Spatial Standard Deviation / Dispersion)",
        rf"SD = \sqrt{{\frac{{\sum (x_i - \bar{{X}})^2 + \sum (y_i - \bar{{Y}})^2}}{{N}}}} = \sqrt{{\frac{{{fmt_num(sq_dist_sum)}}}{{{n}}}}} = {fmt_num(std_distance)}",
        "equation"
    ))

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    steps.append(MathStep(
        "Spatial Bounding Extent",
        rf"X \in [{fmt_num(min_x)}, {fmt_num(max_x)}] \quad (\text{{width}} = {fmt_num(max_x - min_x)}), \quad Y \in [{fmt_num(min_y)}, {fmt_num(max_y)}] \quad (\text{{height}} = {fmt_num(max_y - min_y)})",
        "equation"
    ))

    sol = f"Centroid = ({fmt_num(mean_x)}, {fmt_num(mean_y)}), Standard Distance = {fmt_num(std_distance)}"
    return sol, steps


# ─────────────────────────────────────────────────────────────────────────────
# 8. INFERENTIAL STATISTICS (CONFIDENCE INTERVALS & SAMPLE SIZE)
# ─────────────────────────────────────────────────────────────────────────────
def confidence_interval_solver(input_str: str) -> Tuple[str, List[MathStep]]:
    """Calculates confidence intervals for population means and proportions."""
    steps = []
    s_lower = input_str.lower()

    if 'proportion' in s_lower:
        nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', input_str)]
        if len(nums) >= 2:
            x_succ = nums[0]
            n_tot = nums[1]
            conf = nums[2] if len(nums) >= 3 else 0.95
            if conf > 1.0:
                conf /= 100.0
            p_hat = x_succ / n_tot
            z_crit = stats_dist.norm.ppf(1.0 - (1.0 - conf) / 2.0) if HAVE_SCIPY else 1.96
            se = math.sqrt((p_hat * (1.0 - p_hat)) / n_tot)
            me = z_crit * se
            low, high = max(0.0, p_hat - me), min(1.0, p_hat + me)

            steps.append(MathStep("Sample Proportion", rf"\hat{{p}} = \frac{{x}}{{n}} = \frac{{{fmt_num(x_succ)}}}{{{fmt_num(n_tot)}}} = {p_hat:.4f}, \quad n = {fmt_num(n_tot)}", "equation"))
            steps.append(MathStep("Standard Error (SE) and Critical Value z*", rf"SE = \sqrt{{\frac{{\hat{{p}}(1 - \hat{{p}})}}{{n}}}} = {se:.4f}, \quad z^* = {z_crit:.3f} \quad (\text{{Confidence}} = {conf*100:.1f}\%)", "equation"))
            steps.append(MathStep("Margin of Error (ME)", rf"ME = z^* \cdot SE = {z_crit:.3f} \times {se:.4f} = {me:.4f}", "equation"))
            steps.append(MathStep("Confidence Interval for Population Proportion p", rf"[{low:.4f}, {high:.4f}] \quad \text{{or}} \quad {p_hat*100:.2f}\% \pm {me*100:.2f}\%", "equation"))
            return f"CI: [{low:.4f}, {high:.4f}] ({conf*100:.0f}%)", steps

    arr_m = re.search(r'\[(.*?)\]', input_str)
    if arr_m:
        data = parse_data(arr_m.group(1))
        conf_match = re.search(r'\]\s*,\s*([-+]?\d*\.?\d+)', input_str)
        conf = float(conf_match.group(1)) if conf_match else 0.95
        if conf > 1.0:
            conf /= 100.0

        n = len(data)
        mean_val = sum(data) / n
        var_sample = sum((x - mean_val)**2 for x in data) / (n - 1)
        s_val = math.sqrt(var_sample)
        se = s_val / math.sqrt(n)
        df = n - 1
        t_crit = stats_dist.t.ppf(1.0 - (1.0 - conf) / 2.0, df) if HAVE_SCIPY else 2.228
        me = t_crit * se
        low, high = mean_val - me, mean_val + me

        steps.append(MathStep(f"Sample Statistics (n = {n})", rf"\bar{{x}} = {fmt_num(mean_val)}, \quad s = {fmt_num(s_val)}, \quad df = n - 1 = {df}", "equation"))
        steps.append(MathStep("Standard Error (SE)", rf"SE = \frac{{s}}{{\sqrt{{n}}}} = \frac{{{fmt_num(s_val)}}}{{\sqrt{{{n}}}}} = {se:.4f}", "equation"))
        steps.append(MathStep("Critical Value t* & Margin of Error (ME)", rf"t^*_{{{df}, {conf}}} = {t_crit:.3f}, \quad ME = t^* \cdot SE = {me:.4f}", "equation"))
        steps.append(MathStep(
            f"{conf*100:.0f}% Confidence Interval for Population Mean mu",
            rf"\bar{{x}} \pm ME = {fmt_num(mean_val)} \pm {me:.4f} \implies [{low:.4f}, {high:.4f}]",
            "equation"
        ))
        return f"[{low:.4f}, {high:.4f}] (mean={fmt_num(mean_val)}, t*={t_crit:.3f})", steps

    nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', input_str)]
    if len(nums) >= 3:
        mean_val, s_val, n = nums[0], nums[1], int(nums[2])
        conf = nums[3] if len(nums) >= 4 else 0.95
        if conf > 1.0:
            conf /= 100.0
        se = s_val / math.sqrt(n)
        df = n - 1
        t_crit = stats_dist.t.ppf(1.0 - (1.0 - conf) / 2.0, df) if HAVE_SCIPY else 1.96
        me = t_crit * se
        low, high = mean_val - me, mean_val + me
        steps.append(MathStep("Summary Parameters", rf"\bar{{x}} = {fmt_num(mean_val)}, \quad s = {fmt_num(s_val)}, \quad n = {n}, \quad SE = {se:.4f}", "equation"))
        steps.append(MathStep(f"Confidence Interval ({conf*100:.0f}%)", rf"[{low:.4f}, {high:.4f}]", "equation"))
        return f"[{low:.4f}, {high:.4f}]", steps

    raise ValueError("Invalid confidence interval parameters. Example: confidence_interval([10, 12, 14, 15, 16], 0.95)")


# ─────────────────────────────────────────────────────────────────────────────
# 9. HYPOTHESIS TESTING (HYPOTHEESES TESTINGS)
# ─────────────────────────────────────────────────────────────────────────────
def hypothesis_testing_solver(input_str: str) -> Tuple[str, List[MathStep]]:
    """Conducts 1-sample t-test, 2-sample independent t-test, and proportion z-tests."""
    steps = []
    s_lower = input_str.lower()

    # Two-sample t-test
    arr_matches = re.findall(r'\[(.*?)\]', input_str)
    if len(arr_matches) >= 2:
        d1 = parse_data(arr_matches[0])
        d2 = parse_data(arr_matches[1])
        n1, n2 = len(d1), len(d2)
        m1 = sum(d1) / n1
        m2 = sum(d2) / n2
        v1 = sum((x - m1)**2 for x in d1) / (n1 - 1)
        v2 = sum((x - m2)**2 for x in d2) / (n2 - 1)
        s1 = math.sqrt(v1)
        s2 = math.sqrt(v2)

        df = n1 + n2 - 2
        sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / df
        se = math.sqrt(sp2 * (1.0 / n1 + 1.0 / n2))
        t_stat = (m1 - m2) / se if se > 1e-9 else 0.0
        p_val = 2.0 * (1.0 - stats_dist.t.cdf(abs(t_stat), df)) if HAVE_SCIPY else 0.05
        t_crit = stats_dist.t.ppf(0.975, df) if HAVE_SCIPY else 2.0

        steps.append(MathStep("Hypotheses Setup", rf"H_0: \mu_1 = \mu_2 \quad \text{{vs}} \quad H_a: \mu_1 \neq \mu_2 \quad (\alpha = 0.05)", "equation"))
        steps.append(MathStep("Sample 1 & Sample 2 Statistics", rf"\bar{{x}}_1 = {fmt_num(m1)}, s_1 = {fmt_num(s1)}, n_1 = {n1} \quad | \quad \bar{{x}}_2 = {fmt_num(m2)}, s_2 = {fmt_num(s2)}, n_2 = {n2}", "equation"))
        steps.append(MathStep("Pooled Variance and Standard Error", rf"s_p^2 = \frac{{(n_1-1)s_1^2 + (n_2-1)s_2^2}}{{n_1+n_2-2}} = {fmt_num(sp2)}, \quad SE = \sqrt{{s_p^2(\frac{{1}}{{n_1}} + \frac{{1}}{{n_2}})}} = {se:.4f}", "equation"))
        steps.append(MathStep("Independent Two-Sample T-Statistic", rf"t = \frac{{\bar{{x}}_1 - \bar{{x}}_2}}{{SE}} = \frac{{{fmt_num(m1)} - {fmt_num(m2)}}}{{{se:.4f}}} = {t_stat:.4f} \quad (df = {df})", "equation"))

        decision = "Reject H0 (Statistically Significant difference)" if abs(t_stat) > t_crit else "Fail to Reject H0 (No significant difference)"
        steps.append(MathStep(f"Decision Rule (|t| > {t_crit:.3f} or p < 0.05)", rf"p\text{{-value}} = {p_val:.4f}, \quad \text{{Result: }} \mathbf{{{decision}}}", "equation"))
        return f"t = {t_stat:.4f}, p = {p_val:.4f} ({decision})", steps

    # One-sample t-test
    if 't_test' in s_lower or 'ttest' in s_lower:
        arr_m = re.search(r'\[(.*?)\]', input_str)
        if arr_m:
            data = parse_data(arr_m.group(1))
            mu_m = re.search(r'(?:mu0|mu|target)\s*[:=]\s*([-+]?\d*\.?\d+)', input_str, re.I)
            if mu_m:
                mu0 = float(mu_m.group(1))
            else:
                rest = input_str.replace(arr_m.group(0), '')
                val_m = re.search(r'[-+]?\d*\.?\d+', rest)
                mu0 = float(val_m.group(0)) if val_m else 0.0

            n = len(data)
            m = sum(data) / n
            var_sample = sum((x - m)**2 for x in data) / (n - 1)
            s_val = math.sqrt(var_sample)
            se = s_val / math.sqrt(n)
            t_stat = (m - mu0) / se if se > 1e-9 else 0.0
            df = n - 1
            p_val = 2.0 * (1.0 - stats_dist.t.cdf(abs(t_stat), df)) if HAVE_SCIPY else 0.05
            t_crit = stats_dist.t.ppf(0.975, df) if HAVE_SCIPY else 2.0

            steps.append(MathStep("Hypotheses Setup", rf"H_0: \mu = {fmt_num(mu0)} \quad \text{{vs}} \quad H_a: \mu \neq {fmt_num(mu0)}", "equation"))
            steps.append(MathStep("Sample Statistics", rf"n = {n}, \quad \bar{{x}} = {fmt_num(m)}, \quad s = {fmt_num(s_val)}, \quad SE = \frac{{s}}{{\sqrt{{n}}}} = {se:.4f}", "equation"))
            steps.append(MathStep("One-Sample T-Statistic", rf"t = \frac{{\bar{{x}} - \mu_0}}{{SE}} = \frac{{{fmt_num(m)} - {fmt_num(mu0)}}}{{{se:.4f}}} = {t_stat:.4f} \quad (df = {df})", "equation"))
            decision = "Reject H0" if abs(t_stat) > t_crit else "Fail to Reject H0"
            steps.append(MathStep(f"Decision (Critical t* = {t_crit:.3f})", rf"p\text{{-value}} = {p_val:.4f} \implies \mathbf{{{decision}}}", "equation"))
            return f"t = {t_stat:.4f}, p = {p_val:.4f} ({decision})", steps

    # Proportion z-test
    if 'proportion' in s_lower:
        nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', input_str)]
        if len(nums) >= 3:
            x_succ, n_tot, p0 = nums[0], nums[1], nums[2]
            p_hat = x_succ / n_tot
            se0 = math.sqrt((p0 * (1.0 - p0)) / n_tot)
            z_stat = (p_hat - p0) / se0 if se0 > 1e-9 else 0.0
            p_val = 2.0 * (1.0 - stats_dist.norm.cdf(abs(z_stat))) if HAVE_SCIPY else 0.05
            decision = "Reject H0" if abs(z_stat) > 1.96 else "Fail to Reject H0"

            steps.append(MathStep("Hypotheses Setup", rf"H_0: p = {fmt_num(p0)} \quad \text{{vs}} \quad H_a: p \neq {fmt_num(p0)}", "equation"))
            steps.append(MathStep("Sample Proportion & Null Standard Error", rf"\hat{{p}} = \frac{{{fmt_num(x_succ)}}}{{{fmt_num(n_tot)}}} = {p_hat:.4f}, \quad SE_0 = \sqrt{{\frac{{{fmt_num(p0)}(1 - {fmt_num(p0)})}}{{{fmt_num(n_tot)}}}}} = {se0:.4f}", "equation"))
            steps.append(MathStep("Z-Test Statistic", rf"Z = \frac{{\hat{{p}} - p_0}}{{SE_0}} = \frac{{{p_hat:.4f} - {fmt_num(p0)}}}{{{se0:.4f}}} = {z_stat:.4f}", "equation"))
            steps.append(MathStep("Decision Rule (Two-tailed alpha = 0.05)", rf"p\text{{-value}} = {p_val:.4f} \implies \mathbf{{{decision}}}", "equation"))
            return f"Z = {z_stat:.4f}, p = {p_val:.4f} ({decision})", steps

    raise ValueError("Invalid hypothesis test query. Example: t_test([10, 12, 14, 15], mu0=11) or two_sample_t_test([10, 12], [8, 9])")


# ─────────────────────────────────────────────────────────────────────────────
# 10. GOODNESS OF FIT & CONTINGENCY
# ─────────────────────────────────────────────────────────────────────────────
def chi_square_goodness_of_fit(input_str: str) -> Tuple[str, List[MathStep]]:
    """Calculates Chi-Square Goodness-of-Fit test for observed vs expected frequencies."""
    steps = []
    lists = re.findall(r'\[(.*?)\]', input_str)
    if not lists:
        raise ValueError("Goodness of fit requires observed counts [O1, O2, ...], e.g. goodness_of_fit([20, 30, 50])")

    observed = parse_data(lists[0])
    k = len(observed)
    if k < 2:
        raise ValueError("Chi-square goodness of fit requires at least 2 categories.")

    total_obs = sum(observed)
    if len(lists) >= 2:
        expected = parse_data(lists[1])
        if abs(sum(expected) - 1.0) < 1e-4:
            expected = [p * total_obs for p in expected]
    else:
        expected = [total_obs / k] * k

    steps.append(MathStep(
        "Hypotheses for Goodness of Fit",
        rf"H_0: \text{{Observed distribution matches expected distribution}} \quad \text{{vs}} \quad H_a: \text{{Distribution differs}}",
        "equation"
    ))

    table_rows = []
    chi2_val = 0.0
    for i, (obs, exp) in enumerate(zip(observed, expected), 1):
        diff = obs - exp
        term = (diff ** 2) / exp if exp > 0 else 0.0
        chi2_val += term
        table_rows.append(rf"\text{{Cat }}{i}: O = {fmt_num(obs)}, E = {fmt_num(exp)}, \frac{{(O - E)^2}}{{E}} = {fmt_num(term)}")

    steps.append(MathStep(
        "Observed (O) vs Expected (E) Categories Table",
        r"\begin{aligned} " + r" \\ ".join(table_rows) + r" \end{aligned}",
        "equation"
    ))

    df = k - 1
    steps.append(MathStep(
        "Chi-Square Test Statistic Formula",
        rf"\chi^2 = \sum_{{i=1}}^{{k}} \frac{{(O_i - E_i)^2}}{{E_i}} = " + " + ".join(fmt_num((o-e)**2/e) for o, e in zip(observed, expected)) + rf" = {chi2_val:.4f}",
        "equation"
    ))

    crit_val = stats_dist.chi2.ppf(0.95, df) if HAVE_SCIPY else (3.841 if df == 1 else 5.991)
    p_val = 1.0 - stats_dist.chi2.cdf(chi2_val, df) if HAVE_SCIPY else 0.05
    decision = "Reject H0 (Data significantly deviates from expected)" if chi2_val > crit_val else "Fail to Reject H0 (Data conforms to expected distribution)"

    steps.append(MathStep(
        f"Degrees of Freedom (df = k - 1 = {df}) & Critical Value",
        rf"\text{{Critical }} \chi^2_{{0.05, {df}}} = {crit_val:.4f}, \quad p\text{{-value}} = {p_val:.4f}",
        "equation"
    ))
    steps.append(MathStep("Hypothesis Decision", rf"\mathbf{{{decision}}}", "equation"))

    sol = f"chi^2 = {chi2_val:.4f} (df={df}, p={p_val:.4f}, {decision})"
    return sol, steps


def chi_square_contingency(input_str: str) -> Tuple[str, List[MathStep]]:
    """Calculates Chi-Square test of independence on a 2D contingency table."""
    steps = []
    import ast
    try:
        matrix_match = re.search(r'\[\[.*\]\]', input_str)
        if not matrix_match:
            raise ValueError("Contingency table must be a 2D matrix like [[10, 20], [30, 40]]")
        table = ast.literal_eval(matrix_match.group(0))
    except Exception as e:
        raise ValueError(f"Invalid contingency table format: {e}")

    r = len(table)
    c = len(table[0])
    row_sums = [sum(row) for row in table]
    col_sums = [sum(table[i][j] for i in range(r)) for j in range(c)]
    grand_total = sum(row_sums)

    steps.append(MathStep(f"Contingency Table Dimensions ({r}x{c})", rf"R = {r}, \quad C = {c}, \quad N = {grand_total}", "equation"))

    chi2_val = 0.0
    for i in range(r):
        for j in range(c):
            obs = table[i][j]
            exp = (row_sums[i] * col_sums[j]) / grand_total
            chi2_val += ((obs - exp) ** 2) / exp if exp > 0 else 0.0

    df = (r - 1) * (c - 1)
    crit_val = stats_dist.chi2.ppf(0.95, df) if HAVE_SCIPY else 3.84
    p_val = 1.0 - stats_dist.chi2.cdf(chi2_val, df) if HAVE_SCIPY else 0.05
    cramer_v = math.sqrt(chi2_val / (grand_total * min(r - 1, c - 1))) if grand_total > 0 and min(r - 1, c - 1) > 0 else 0.0

    steps.append(MathStep(
        "Chi-Square Test of Independence Formula",
        rf"\chi^2 = \sum \frac{{(O_{{ij}} - E_{{ij}})^2}}{{E_{{ij}}}} = {chi2_val:.4f}, \quad df = (r-1)(c-1) = {df}",
        "equation"
    ))
    decision = "Reject H0 (Variables are dependent/associated)" if chi2_val > crit_val else "Fail to Reject H0 (Variables are independent)"
    steps.append(MathStep(
        "Statistical Association & Cramer's V",
        rf"\text{{Cramer's V}} = \sqrt{{\frac{{\chi^2}}{{N \cdot \min(r-1, c-1)}}}} = {cramer_v:.4f}, \quad p = {p_val:.4f} \implies \mathbf{{{decision}}}",
        "equation"
    ))

    sol = f"chi^2 = {chi2_val:.4f} (df={df}, p={p_val:.4f}, Cramer's V={cramer_v:.4f})"
    return sol, steps


# ─────────────────────────────────────────────────────────────────────────────
# 11. ANALYSIS OF VARIANCE (ANOVA)
# ─────────────────────────────────────────────────────────────────────────────
def one_way_anova(input_str: str) -> Tuple[str, List[MathStep]]:
    """Calculates One-Way Analysis of Variance (ANOVA) for multiple independent groups."""
    steps = []
    groups_match = re.findall(r'\[(.*?)\]', input_str)
    if len(groups_match) < 2:
        raise ValueError("ANOVA requires at least 2 distinct sample groups, e.g. anova([[10, 12, 14], [15, 16, 17], [20, 21, 22]])")

    groups = []
    for g_str in groups_match:
        if '[' in g_str or ']' in g_str:
            continue
        parsed = parse_data(g_str)
        if parsed:
            groups.append(parsed)

    k = len(groups)
    if k < 2:
        raise ValueError("ANOVA requires at least 2 groups.")

    group_sizes = [len(g) for g in groups]
    group_means = [sum(g) / len(g) for g in groups]
    group_vars = [sum((x - m)**2 for x in g) / (len(g) - 1) if len(g) > 1 else 0.0 for g, m in zip(groups, group_means)]

    total_n = sum(group_sizes)
    all_values = [x for g in groups for x in g]
    grand_mean = sum(all_values) / total_n

    steps.append(MathStep(
        "Hypotheses Setup for One-Way ANOVA",
        rf"H_0: \mu_1 = \mu_2 = \dots = \mu_k \quad \text{{vs}} \quad H_a: \text{{At least one group mean is different}}",
        "equation"
    ))

    grp_summary = [rf"\text{{Group }}{i+1}: n_{{{i+1}}} = {len(g)}, \bar{{x}}_{{{i+1}}} = {fmt_num(m)}, s_{{{i+1}}}^2 = {fmt_num(v)}" for i, (g, m, v) in enumerate(zip(groups, group_means, group_vars))]
    steps.append(MathStep("Group Summaries & Grand Mean", r"\begin{aligned} " + r" \\ ".join(grp_summary) + rf" \\ \bar{{X}}_{{\text{{grand}}}} = {fmt_num(grand_mean)}, \quad N = {total_n} " + r"\end{aligned}", "equation"))

    ssb = sum(n_j * (m_j - grand_mean)**2 for n_j, m_j in zip(group_sizes, group_means))
    df_between = k - 1
    msb = ssb / df_between if df_between > 0 else 0.0

    ssw = sum(sum((x - m_j)**2 for x in g) for g, m_j in zip(groups, group_means))
    df_within = total_n - k
    msw = ssw / df_within if df_within > 0 else 1.0

    sst = ssb + ssw
    df_total = total_n - 1

    f_stat = msb / msw if msw > 1e-9 else 0.0
    f_crit = stats_dist.f.ppf(0.95, df_between, df_within) if HAVE_SCIPY else 3.5
    p_val = 1.0 - stats_dist.f.cdf(f_stat, df_between, df_within) if HAVE_SCIPY else 0.05
    decision = "Reject H0 (Statistically significant difference between groups)" if f_stat > f_crit else "Fail to Reject H0 (No significant difference between groups)"

    steps.append(MathStep(
        "Sums of Squares (SSB, SSW, SST)",
        rf"SSB = \sum n_j (\bar{{x}}_j - \bar{{X}})^2 = {fmt_num(ssb)}, \quad SSW = \sum \sum (x_{{ij}} - \bar{{x}}_j)^2 = {fmt_num(ssw)}, \quad SST = {fmt_num(sst)}",
        "equation"
    ))

    steps.append(MathStep(
        "Mean Squares (MSB, MSW)",
        rf"MSB = \frac{{SSB}}{{k - 1}} = \frac{{{fmt_num(ssb)}}}{{{df_between}}} = {fmt_num(msb)}, \quad MSW = \frac{{SSW}}{{N - k}} = \frac{{{fmt_num(ssw)}}}{{{df_within}}} = {fmt_num(msw)}",
        "equation"
    ))

    anova_table = (
        r"\begin{array}{|l|c|c|c|c|c|} \hline "
        r"\text{Source} & \text{SS} & \text{df} & \text{MS} & \text{F-Ratio} & \text{p-value} \\ \hline "
        rf"\text{{Between (Treatment)}} & {fmt_num(ssb)} & {df_between} & {fmt_num(msb)} & {f_stat:.4f} & {p_val:.4f} \\ "
        rf"\text{{Within (Error)}} & {fmt_num(ssw)} & {df_within} & {fmt_num(msw)} & - & - \\ "
        rf"\text{{Total}} & {fmt_num(sst)} & {df_total} & - & - & - \\ \hline "
        r"\end{array}"
    )
    steps.append(MathStep("Complete One-Way ANOVA Summary Table", anova_table, "equation"))
    steps.append(MathStep(f"F-Test Significance (F_crit = {f_crit:.3f})", rf"F = {f_stat:.4f}, \quad p\text{{-value}} = {p_val:.4f} \implies \mathbf{{{decision}}}", "equation"))

    sol = f"F = {f_stat:.4f} (df=({df_between}, {df_within}), p={p_val:.4f}, {decision})"
    return sol, steps


# ─────────────────────────────────────────────────────────────────────────────
# 12. RANDOM VARIABLE (DISCRETE & CONTINUOUS)
# ─────────────────────────────────────────────────────────────────────────────
def random_variable_solver(input_str: str) -> Tuple[str, List[MathStep]]:
    """Calculates Expected Value, Second Moment, Variance, SD, Linear Transformations, and CDF for a random variable."""
    steps = []
    pairs = re.findall(r'[\(\[]\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*[\)\]]', input_str)
    if pairs and len(pairs) >= 2:
        xs = [float(x) for x, _ in pairs]
        ps = [float(p) for _, p in pairs]
    else:
        lists = re.findall(r'\[(.*?)\]', input_str)
        if len(lists) >= 2:
            xs = parse_data(lists[0])
            ps = parse_data(lists[1])
        else:
            raise ValueError("Random variable requires values X and probabilities P(X), e.g. random_variable(X=[0, 1, 2], P=[0.2, 0.5, 0.3])")

    if len(xs) != len(ps):
        raise ValueError("Number of X values must equal number of probabilities P(X).")

    sum_p = sum(ps)
    steps.append(MathStep("Probability Mass Function PMF Table", r"\begin{array}{|c|" + "c|"*len(xs) + r"} \hline X & " + " & ".join(fmt_num(x) for x in xs) + r" \\ \hline P(X) & " + " & ".join(fmt_num(p) for p in ps) + r" \\ \hline \end{array}", "equation"))

    if abs(sum_p - 1.0) > 1e-4:
        steps.append(MathStep("PMF Normalization Note", rf"\sum P(x_i) = {fmt_num(sum_p)} \neq 1 \implies \text{{Normalizing probabilities by }} \frac{{P(x_i)}}{{\sum P}}", "equation"))
        ps = [p / sum_p for p in ps]
    else:
        steps.append(MathStep("PMF Axiom Check", rf"\sum_{{i=1}}^{{n}} P(X = x_i) = {fmt_num(sum(ps))} = 1.0 \quad \checkmark", "equation"))

    ev_terms = [f"({fmt_num(x)})({fmt_num(p)})" for x, p in zip(xs, ps)]
    ev = sum(x * p for x, p in zip(xs, ps))
    steps.append(MathStep(
        "Expected Value (Mean / First Moment)",
        rf"\mu = E[X] = \sum x_i P(x_i) = " + " + ".join(ev_terms) + rf" = {fmt_num(ev)}",
        "equation"
    ))

    ev2_terms = [f"({fmt_num(x)})^2({fmt_num(p)})" for x, p in zip(xs, ps)]
    ev2 = sum((x**2) * p for x, p in zip(xs, ps))
    steps.append(MathStep(
        "Second Moment E[X^2]",
        rf"E[X^2] = \sum x_i^2 P(x_i) = " + " + ".join(ev2_terms) + rf" = {fmt_num(ev2)}",
        "equation"
    ))

    var_val = max(0.0, ev2 - ev**2)
    sd_val = math.sqrt(var_val)
    steps.append(MathStep(
        "Variance & Standard Deviation",
        rf"\text{{Var}}(X) = \sigma^2 = E[X^2] - (E[X])^2 = {fmt_num(ev2)} - ({fmt_num(ev)})^2 = {fmt_num(var_val)}, \quad \sigma = \sqrt{{\text{{Var}}(X)}} = {fmt_num(sd_val)}",
        "equation"
    ))

    steps.append(MathStep(
        "Linear Transformation Rules for Constants a, b",
        rf"E[aX + b] = a E[X] + b = a({fmt_num(ev)}) + b, \quad \text{{Var}}(aX + b) = a^2 \text{{Var}}(X) = a^2({fmt_num(var_val)})",
        "equation"
    ))

    cum_p = 0.0
    cdf_row = []
    for p in ps:
        cum_p += p
        cdf_row.append(fmt_num(cum_p))
    steps.append(MathStep(
        "Cumulative Distribution Function F(x) = P(X <= x)",
        r"\begin{array}{|c|" + "c|"*len(xs) + r"} \hline x & " + " & ".join(fmt_num(x) for x in xs) + r" \\ \hline F(x) & " + " & ".join(cdf_row) + r" \\ \hline \end{array}",
        "equation"
    ))

    sol = f"E[X] = {fmt_num(ev)}, Var(X) = {fmt_num(var_val)}, SD(X) = {fmt_num(sd_val)}"
    return sol, steps


# ─────────────────────────────────────────────────────────────────────────────
# UNIFIED STATISTICS DISPATCHER: solve_statistics
# ─────────────────────────────────────────────────────────────────────────────
def solve_statistics(input_str: str) -> Tuple[str, List[MathStep]]:
    """
    Intelligent unified parser & dispatcher for all statistical queries.
    Handles:
    - Standard deviation (sample/population, SE, CV)
    - Percentiles, Quantiles, and Percentile Rank
    - Linear regression, Pearson correlation, slope inference, prediction
    - Set theory (union, intersection, differences, Cartesian product, power set)
    - Combinatorics (permutations, combinations, stars & bars, multinomial, derangements)
    - Probabilities (classical, addition, multiplication, conditional, Bayes' theorem, odds)
    - Special distributions (Geometric, Hypergeometric, Exponential, Uniform, Normal, Binomial, Poisson)
    - Spatial distributions (2D Centroid, Standard Distance dispersion)
    - Inferential statistics (Confidence intervals for mean and proportion, sample size)
    - Hypothesis testing (1-sample t, 2-sample independent t, proportion test, z-test)
    - Goodness of fit (Chi-Square goodness of fit & contingency table test)
    - Analysis of Variance (One-Way ANOVA with summary table)
    - Random variables (Discrete PMF, Expected value, Variance, SD, CDF)
    - Legacy functions: mean, median, mode, variance, iqr, summary, class frequency solvers
    """
    s = input_str.strip()
    s_lower = s.lower()

    # 1. Summary / Describe / 5-Number
    if any(s_lower.startswith(w) for w in ['summary', 'describe', 'fivenum', 'five_number']):
        data_part = re.sub(r'^(?:summary|describe|fivenum|five_number)\s*\(?', '', s, flags=re.I).rstrip(')')
        return five_number_summary(data_part)

    # 2. Linear Regression & Correlation
    if any(s_lower.startswith(w) for w in ['regression', 'linreg', 'linear_regression', 'correlation', 'least_squares', 'ols']):
        return linear_regression(s)

    # 3. Percentiles & Quantiles & Percentile Rank
    if any(s_lower.startswith(w) for w in ['percentile_rank', 'pr(']):
        m = re.search(r'\((.*)\)', s)
        inner = m.group(1) if m else s
        arr_m = re.search(r'\[(.*?)\]', inner)
        if arr_m:
            arr_str = arr_m.group(1)
            rest = inner.replace(arr_m.group(0), '')
            val_m = re.search(r'[-+]?\d*\.?\d+', rest)
            val = float(val_m.group(0)) if val_m else 0.0
            return percentile_rank_raw(arr_str, val)
        else:
            parts = [p.strip() for p in inner.split(',') if p.strip()]
            return percentile_rank_raw(", ".join(parts[:-1]), float(parts[-1]))
    if any(s_lower.startswith(w) for w in ['percentile', 'centile', 'quantile']):
        # If grouped frequency class
        if re.search(r'\(\s*\d+\s*-\s*\d+\s*-\s*\d+\s*\)', s):
            m = re.search(r'centile_of_classes\((.*),\s*(\d+)\)', s, re.I)
            if m:
                steps = centile_of_classes(m.group(1), int(m.group(2)))
                return steps[-1].latex, steps
        m = re.search(r'\((.*)\)', s)
        inner = m.group(1) if m else s
        arr_m = re.search(r'\[(.*?)\]', inner)
        if arr_m:
            arr_str = arr_m.group(1)
            rest = inner.replace(arr_m.group(0), '')
            p_m = re.search(r'[-+]?\d*\.?\d+', rest)
            p_val = float(p_m.group(0)) if p_m else 50.0
            return percentile_raw(arr_str, p_val)
        else:
            parts = [p.strip() for p in inner.split(',') if p.strip()]
            if len(parts) >= 2:
                try:
                    last_val = float(parts[-1])
                    return percentile_raw(", ".join(parts[:-1]), last_val)
                except ValueError:
                    first_val = float(parts[0])
                    return percentile_raw(", ".join(parts[1:]), first_val)
            return percentile_raw(inner, 50.0)

    # 4. Set Theory Operations
    if any(s_lower.startswith(w) for w in ['set_theory', 'set_operation', 'set_op', 'union', 'intersection', 'set_difference', 'cartesian', 'power_set', 'venn']):
        return set_theory_operations(s)

    # 5. Combinations & Permutations
    if any(s_lower.startswith(w) for w in ['combination', 'permutation', 'ncr', 'npr', 'multinomial', 'derangement', 'stars_and_bars']):
        return advanced_combinatorics(s)

    # 6. Probabilities & Bayes
    if any(s_lower.startswith(w) for w in ['prob', 'bayes', 'conditional_prob', 'addition_rule', 'odds']):
        return probability_solver(s)

    # 7. Special & Spatial Distributions
    if any(s_lower.startswith(w) for w in ['spatial', 'centroid', 'standard_distance']):
        return spatial_distribution_solver(s)
    if any(s_lower.startswith(w) for w in ['geometric', 'hypergeometric', 'exponential', 'uniform']):
        return special_distributions_solver(s)
    if any(s_lower.startswith(w) for w in ['normal_cdf', 'normal_dist', 'p_norm', 'pnorm']):
        nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', s)]
        if len(nums) == 1:
            return normal_distribution_cdf(nums[0], 0.0, 1.0)
        elif len(nums) >= 3:
            return normal_distribution_cdf(nums[0], nums[1], nums[2])
        elif len(nums) == 2:
            return normal_distribution_cdf(nums[0], nums[1], 1.0)
    if s_lower.startswith('binomial'):
        nums = re.findall(r'[-+]?\d*\.?\d+', s)
        if len(nums) >= 3:
            return binomial_distribution(int(nums[0]), int(nums[1]), float(nums[2]))
    if s_lower.startswith('poisson'):
        nums = re.findall(r'[-+]?\d*\.?\d+', s)
        if len(nums) >= 2:
            return poisson_distribution(float(nums[0]), int(nums[1]))

    # 8. Inferential Statistics (Confidence Intervals, Sample Size)
    if any(s_lower.startswith(w) for w in ['confidence', 'ci(', 'proportion_ci', 'inferential', 'margin_of_error']):
        return confidence_interval_solver(s)

    # 9. Hypothesis Testing
    if any(s_lower.startswith(w) for w in ['hypothesis', 't_test', 'ttest', 'two_sample', 'z_test', 'ztest', 'proportion_test', 'student_t']):
        return hypothesis_testing_solver(s)

    # 10. Goodness of Fit & Chi-Square
    if any(s_lower.startswith(w) for w in ['contingency', 'chi_square_contingency']):
        return chi_square_contingency(s)
    if any(s_lower.startswith(w) for w in ['goodness_of_fit', 'goodness', 'chi_square', 'chisq']):
        return chi_square_goodness_of_fit(s)

    # 11. ANOVA
    if any(s_lower.startswith(w) for w in ['anova', 'one_way_anova', 'f_test', 'variance_analysis']):
        return one_way_anova(s)

    # 12. Random Variables
    if any(s_lower.startswith(w) for w in ['random_variable', 'random_var', 'discrete_rv', 'expected_value', 'expectation', 'variance_rv']):
        return random_variable_solver(s)

    # 13. Comprehensive Standard Deviation
    if any(s_lower.startswith(w) for w in ['standard_deviation', 'std_dev_comprehensive', 'sample_sd', 'stdev', 'std_dev', 'stddev']):
        # If grouped frequency class
        if re.search(r'\(\s*\d+\s*-\s*\d+\s*-\s*\d+\s*\)', s):
            d = re.search(r'std_dev_of_classes\((.*)\)', s, re.I)
            raw_c = d.group(1) if d else s
            steps = std_dev_of_classes(raw_c)
            return steps[-1].latex, steps
        m = re.search(r'\((.*)\)', s)
        inner = m.group(1) if m else s
        return std_dev_comprehensive(inner)

    # 14. IQR
    if s_lower.startswith('iqr'):
        data_part = re.search(r'iqr\((.*)\)', s, re.I)
        raw_d = data_part.group(1) if data_part else s[3:].strip(' ()')
        return iqr_raw(raw_d)

    # 15. Z-Score / Standard Score
    if any(s_lower.startswith(w) for w in ['z_score', 'zscore', 'std_score']):
        if re.search(r'\(\s*\d+\s*-\s*\d+\s*-\s*\d+\s*\)', s):
            m = re.search(r'\((.*),\s*(-?\d+\.?\d*)\)', s)
            if m:
                steps = std_score(m.group(1), float(m.group(2)))
                return steps[-1].latex, steps
        m = re.search(r'\((.*)\)', s)
        inner = m.group(1) if m else s
        arr_m = re.search(r'\[(.*?)\]', inner)
        if arr_m:
            arr_str = arr_m.group(1)
            rest = inner.replace(arr_m.group(0), '')
            val_m = re.search(r'[-+]?\d*\.?\d+', rest)
            val = float(val_m.group(0)) if val_m else 0.0
            return z_score_raw(arr_str, val)
        else:
            parts = [p.strip() for p in inner.split(',') if p.strip()]
            if len(parts) >= 2:
                val = float(parts[-1])
                dataset_str = ", ".join(parts[:-1])
                return z_score_raw(dataset_str, val)

    # 16. Grouped Class Frequency Functions
    if 'inter_quarterly_range' in s_lower:
        d = re.search(r'inter_quarterly_range\((.*)\)', s, re.I).group(1)
        steps = inter_quarterly_range(d)
        return steps[-1].latex, steps
    if 'centile_of_classes' in s_lower:
        m = re.search(r'centile_of_classes\((.*),\s*(\d+)\)', s, re.I)
        steps = centile_of_classes(m.group(1), int(m.group(2)))
        return steps[-1].latex, steps
    if 'mean_of_classes' in s_lower:
        d = re.search(r'mean_of_classes\((.*)\)', s, re.I).group(1)
        steps = mean_of_classes(d)
        return steps[-1].latex, steps
    if 'variance_of_classes' in s_lower:
        d = re.search(r'variance_of_classes\((.*)\)', s, re.I).group(1)
        steps = variance_of_classes(d)
        return steps[-1].latex, steps
    if 'std_dev_of_classes' in s_lower:
        d = re.search(r'std_dev_of_classes\((.*)\)', s, re.I).group(1)
        steps = std_dev_of_classes(d)
        return steps[-1].latex, steps
    if 'mode_of_classes' in s_lower:
        d = re.search(r'mode_of_classes\((.*)\)', s, re.I).group(1)
        steps = mode_of_classes(d)
        return steps[-1].latex, steps

    # 17. Core Elementary Solvers
    if s_lower.startswith('mean'):
        steps = mean(s)
        return steps[-1].latex if steps else "N/A", steps

    if s_lower.startswith('median'):
        steps = median(s)
        return steps[-1].latex if steps else "N/A", steps

    if s_lower.startswith(('mode',)):
        steps = mode(s)
        return steps[-1].latex if steps else "N/A", steps

    if s_lower.startswith(('variance', 'var(')):
        steps = variance(s)
        return steps[-1].latex if steps else "N/A", steps

    # Fallback to Five-Number Summary if array is provided
    try:
        return five_number_summary(s)
    except Exception:
        steps = mean(s)
        return steps[-1].latex if steps else "N/A", steps
