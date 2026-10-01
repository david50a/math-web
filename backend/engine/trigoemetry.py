import sys
import os
import re
import math
from typing import List, Tuple, Union, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from math_models import MathStep, Node, parse_expr, to_latex, Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln
from derivative import derive

def 