import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Calculator,
  Layers,
  HelpCircle as QuestionIcon,
  Compass,
  LayoutGrid,
  ListFilter,
  Type,
  Edit3,
  Columns,
  Loader2,
  AlertCircle,
  Play,
  Video,
  Download,
  X
} from "lucide-react";
import { KatexMath } from "./Whiteboard";
import { EquationSolution, ThemeType } from "../types";
import PaymentModal from "./PaymentModal";


export interface MethodSolution {
  methodId: string;
  methodName: string;
  badgeTag: string;
  techniqueSummary: string;
  formulaLatex: string;
  steps: {
    stepTitle: string;
    description: string;
    latex: string;
  }[];
  finalResultLatex: string;
  prosAndCons: {
    pros: string;
    cons: string;
  };
}

export interface QuestionMultiMethodData {
  id?: string;
  questionInput: string;
  questionTitle: string;
  category: "Algebra & Equations" | "Calculus & Integrals" | "Derivatives" | "Linear Algebra" | "Statistics" | "Geometry";
  latexQuestion: string;
  defaultMethodIndex: number;
  methods: MethodSolution[];
}

const THEME_STYLES: Record<ThemeType, { bg: string, card: string, header: string }> = {
  chalkboard: {
    bg: "bg-[#0c1813]",
    card: "bg-[#14231b] border-emerald-800/40",
    header: "bg-[#0f2119]/90 border-emerald-800/30"
  },
  blueprint: {
    bg: "bg-[#05172e]",
    card: "bg-[#0a2347] border-cyan-800/40",
    header: "bg-[#071d3b]/90 border-cyan-800/30"
  },
  glassmorphic: {
    bg: "bg-[#120826]",
    card: "bg-[#1d0d3d]/60 border-purple-500/30 backdrop-blur-md",
    header: "bg-[#170a30]/90 border-purple-500/30"
  },
  darkroom: {
    bg: "bg-[#09090b]",
    card: "bg-[#141417] border-zinc-800",
    header: "bg-[#0f0f12]/90 border-zinc-800/50"
  },
  cyberpunk: {
    bg: "bg-[#0d0914]",
    card: "bg-[#191029] border-purple-500/30",
    header: "bg-[#140b1f]/90 border-purple-500/20"
  },
  sunset: {
    bg: "bg-[#1c0f0a]",
    card: "bg-[#2b1a10] border-orange-800/40",
    header: "bg-[#22140d]/90 border-orange-800/30"
  },
  synthwave: {
    bg: "bg-[#14061f]",
    card: "bg-[#27103c] border-pink-500/30",
    header: "bg-[#1d0a2c]/90 border-pink-500/20"
  },
  nordic: {
    bg: "bg-[#0b1219]",
    card: "bg-[#1a2634] border-slate-700/50",
    header: "bg-[#141e27]/90 border-slate-700/40"
  },
  matrix: {
    bg: "bg-[#020603]",
    card: "bg-[#091a11] border-green-500/30",
    header: "bg-[#051008]/90 border-green-500/20"
  },
  royal: {
    bg: "bg-[#0a041c]",
    card: "bg-[#1c1033] border-purple-500/40",
    header: "bg-[#140a24]/90 border-purple-500/30"
  }
};

const MATH_SYMBOL_BUTTONS = [
  { label: "x²", insertText: "x^2" },
  { label: "xⁿ", insertText: "x^" },
  { label: "√x", insertText: "sqrt(x)" },
  { label: "∫ dx", insertText: "integrate(" },
  { label: "d/dx", insertText: "derive(" },
  { label: "sin", insertText: "sin(" },
  { label: "cos", insertText: "cos(" },
  { label: "ln", insertText: "ln(" },
  { label: "eˣ", insertText: "e^(" },
  { label: "det([ ])", insertText: "det([[1, 2], [3, 4]])" },
  { label: "eigen([ ])", insertText: "eigen([[1, 2], [2, 1]])" },
  { label: "mean([ ])", insertText: "mean([10, 20, 30, 40, 50])" },
  { label: "translate", insertText: "translate(circle, 2, -1)" },
  { label: "+", insertText: " + " },
  { label: "-", insertText: " - " },
  { label: "=", insertText: " = 0" },
  { label: "( )", insertText: "()" }
];

// Comprehensive database covering EVERY engine capability in backend
const COMPREHENSIVE_ENGINE_DATABASE: QuestionMultiMethodData[] = [

  // ALGEBRA & POLYNOMIAL SOLVER ENGINE
  {
    questionInput: "x^2 - 5x + 6 = 0",
    questionTitle: "Solve Quadratic: x² - 5x + 6 = 0",
    category: "Algebra & Equations",
    latexQuestion: "x^2 - 5x + 6 = 0",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "quad-factor",
        methodName: "Method 1: Factoring (Binomial Product)",
        badgeTag: "Fastest for Rational Roots",
        techniqueSummary: "Find two integers r1 and r2 whose product equals c (6) and whose sum equals b (-5).",
        formulaLatex: "(x - r_1)(x - r_2) = 0 \\implies x = r_1, \\, x = r_2",
        steps: [
          {
            stepTitle: "Step 1: Find factor pair of 6",
            description: "Look for numbers that multiply to 6 and add up to -5: (-2) * (-3) = 6, (-2) + (-3) = -5.",
            latex: "(-2) \\cdot (-3) = 6, \\quad (-2) + (-3) = -5"
          },
          {
            stepTitle: "Step 2: Rewrite in factored form",
            description: "Express as linear factor product.",
            latex: "(x - 2)(x - 3) = 0"
          },
          {
            stepTitle: "Step 3: Zero Product Property",
            description: "Set each factor equal to zero.",
            latex: "x - 2 = 0 \\implies x = 2, \\quad \\text{or} \\quad x - 3 = 0 \\implies x = 3"
          }
        ],
        finalResultLatex: "x = 2, \\quad x = 3",
        prosAndCons: {
          pros: "Fastest method when integer factor pairs are obvious.",
          cons: "Only works when roots are rational."
        }
      },
      {
        methodId: "quad-formula",
        methodName: "Method 2: Standard Quadratic Formula",
        badgeTag: "Universal Algorithm",
        techniqueSummary: "Applies the algebraic quadratic formula using coefficients a=1, b=-5, c=6.",
        formulaLatex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
        steps: [
          {
            stepTitle: "Step 1: Extract coefficients",
            description: "Identify coefficients from standard form ax² + bx + c = 0.",
            latex: "a = 1, \\quad b = -5, \\quad c = 6"
          },
          {
            stepTitle: "Step 2: Calculate Discriminant D",
            description: "D = b² - 4ac.",
            latex: "D = (-5)^2 - 4(1)(6) = 25 - 24 = 1 \\quad (D > 0 \\implies \\text{2 real roots})"
          },
          {
            stepTitle: "Step 3: Substitute into quadratic formula",
            description: "Plug values into the formula.",
            latex: "x = \\frac{-(-5) \\pm \\sqrt{1}}{2(1)} = \\frac{5 \\pm 1}{2} \\implies x = 3, \\, x = 2"
          }
        ],
        finalResultLatex: "x = 2, \\quad x = 3",
        prosAndCons: {
          pros: "Guaranteed to solve ANY quadratic equation, including irrational and complex roots.",
          cons: "Involves square root calculations."
        }
      },
      {
        methodId: "quad-cts",
        methodName: "Method 3: Completing the Square",
        badgeTag: "Vertex & Geometric Shift",
        techniqueSummary: "Transforms equation into perfect square form (x - h)² = k.",
        formulaLatex: "\\left(x + \\frac{b}{2a}\\right)^2 = \\frac{b^2 - 4ac}{4a^2}",
        steps: [
          {
            stepTitle: "Step 1: Move constant to RHS",
            description: "x² - 5x = -6.",
            latex: "x^2 - 5x = -6"
          },
          {
            stepTitle: "Step 2: Add (b/2)² = 6.25 to both sides",
            description: "Add half-coefficient square.",
            latex: "x^2 - 5x + 6.25 = -6 + 6.25 \\implies (x - 2.5)^2 = 0.25"
          },
          {
            stepTitle: "Step 3: Take square root and solve",
            description: "x - 2.5 = ±0.5.",
            latex: "x = 2.5 \\pm 0.5 \\implies x = 3, \\, x = 2"
          }
        ],
        finalResultLatex: "x = 2, \\quad x = 3",
        prosAndCons: {
          pros: "Directly reveals the parabola vertex (2.5, -0.25).",
          cons: "Can involve tedious fraction arithmetic when b is odd."
        }
      },
      {
        methodId: "quad-graph",
        methodName: "Method 4: Graphical Intercept Method",
        badgeTag: "Visual Geometry",
        techniqueSummary: "Plots function y = x² - 5x + 6 and identifies x-intercepts where y = 0.",
        formulaLatex: "y = (x - 2.5)^2 - 0.25 = 0 \\implies (x, y) = (2, 0), \\, (3, 0)",
        steps: [
          {
            stepTitle: "Step 1: Compute Vertex (h, k)",
            description: "h = -b/(2a) = 2.5, k = f(2.5) = -0.25.",
            latex: "(h, k) = (2.5, -0.25)"
          },
          {
            stepTitle: "Step 2: Find x-intercepts",
            description: "Identify where curve crosses line y = 0.",
            latex: "y = 0 \\implies x = 2 \\quad \\text{and} \\quad x = 3"
          }
        ],
        finalResultLatex: "x = 2, \\quad x = 3",
        prosAndCons: {
          pros: "Visual intuitive representation.",
          cons: "Less precise for irrational decimal roots."
        }
      }
    ]
  },
  {
    questionInput: "x^3 - 6x^2 + 11x - 6 = 0",
    questionTitle: "Solve Cubic: x³ - 6x² + 11x - 6 = 0",
    category: "Algebra & Equations",
    latexQuestion: "x^3 - 6x^2 + 11x - 6 = 0",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "cubic-rrt",
        methodName: "Method 1: Rational Root Theorem & Synthetic Division",
        badgeTag: "Standard Polynomial Solver",
        techniqueSummary: "Tests integer factors of constant term (-6) and uses synthetic division to depress cubic to quadratic.",
        formulaLatex: "\\text{Candidates: } \\pm 1, \\pm 2, \\pm 3, \\pm 6 \\implies (x-1)(x^2 - 5x + 6) = 0",
        steps: [
          {
            stepTitle: "Step 1: Test candidates by Rational Root Theorem",
            description: "Test x = 1: 1³ - 6(1)² + 11(1) - 6 = 0. Thus, (x - 1) is a factor.",
            latex: "P(1) = 1 - 6 + 11 - 6 = 0 \\implies (x - 1) \\text{ is a factor}"
          },
          {
            stepTitle: "Step 2: Synthetic division by (x - 1)",
            description: "Depress degree 3 to quadratic degree 2.",
            latex: "\\frac{x^3 - 6x^2 + 11x - 6}{x - 1} = x^2 - 5x + 6"
          },
          {
            stepTitle: "Step 3: Factor remaining quadratic",
            description: "Factor x² - 5x + 6 into (x - 2)(x - 3).",
            latex: "(x - 1)(x - 2)(x - 3) = 0 \\implies x = 1, \\, 2, \\, 3"
          }
        ],
        finalResultLatex: "x = 1, \\quad x = 2, \\quad x = 3",
        prosAndCons: {
          pros: "Reliable method for integer-rooted polynomials.",
          cons: "Requires testing candidate roots."
        }
      },
      {
        methodId: "cubic-grouping",
        methodName: "Method 2: Algebraic Grouping & Factorization",
        badgeTag: "Algebraic Pattern",
        techniqueSummary: "Splits middle coefficients into symmetric groups to factor directly.",
        formulaLatex: "(x^3 - x^2) - (5x^2 - 5x) + (6x - 6) = 0",
        steps: [
          {
            stepTitle: "Step 1: Split terms into groups",
            description: "Group adjacent terms sharing common factors.",
            latex: "x^2(x - 1) - 5x(x - 1) + 6(x - 1) = 0"
          },
          {
            stepTitle: "Step 2: Factor out (x - 1)",
            description: "Extract common binomial term (x - 1).",
            latex: "(x - 1)(x^2 - 5x + 6) = 0"
          },
          {
            stepTitle: "Step 3: Extract roots",
            description: "Set each factor equal to zero.",
            latex: "x = 1, \\quad x = 2, \\quad x = 3"
          }
        ],
        finalResultLatex: "x = 1, \\quad x = 2, \\quad x = 3",
        prosAndCons: {
          pros: "Direct factoring without division.",
          cons: "Requires noticing non-obvious term splittings."
        }
      }
    ]
  },

  // CALCULUS INTEGRALS ENGINE
  {
    questionInput: "integrate(x * e^x)",
    questionTitle: "Integrate Product: ∫ x eˣ dx",
    category: "Calculus & Integrals",
    latexQuestion: "\\int x e^x dx",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "ibp-standard",
        methodName: "Method 1: Integration by Parts (LIATE Rule)",
        badgeTag: "Standard Analytical",
        techniqueSummary: "Applies ∫ u dv = uv - ∫ v du using LIATE rule (Algebraic u = x, Exponential dv = e^x dx).",
        formulaLatex: "\\int u \\, dv = u v - \\int v \\, du",
        steps: [
          {
            stepTitle: "Step 1: Assign u and dv using LIATE",
            description: "u = x (algebraic), dv = e^x dx (exponential).",
            latex: "u = x \\implies du = dx, \\quad dv = e^x dx \\implies v = e^x"
          },
          {
            stepTitle: "Step 2: Apply Integration by Parts formula",
            description: "uv - integral(v du).",
            latex: "\\int x e^x dx = x e^x - \\int e^x dx"
          },
          {
            stepTitle: "Step 3: Integrate remaining term",
            description: "The integral of e^x is e^x.",
            latex: "x e^x - e^x + C = (x - 1)e^x + C"
          }
        ],
        finalResultLatex: "x e^x - e^x + C",
        prosAndCons: {
          pros: "Standard calculus technique.",
          cons: "Can become recursive for higher powers x^n e^x."
        }
      },
      {
        methodId: "ibp-tabular",
        methodName: "Method 2: Tabular Integration (D-I Method)",
        badgeTag: "Fast Shortcut",
        techniqueSummary: "Constructs a Differentiate-Integrate (D-I) table with alternating signs (+/-).",
        formulaLatex: "\\begin{matrix} \\text{Sign} & \\text{D} & \\text{I} \\\\ + & x & e^x \\\\ - & 1 & e^x \\\\ + & 0 & e^x \\end{matrix}",
        steps: [
          {
            stepTitle: "Step 1: Differentiate x until zero",
            description: "D: x → 1 → 0.",
            latex: "D: \\quad x \\longrightarrow 1 \\longrightarrow 0"
          },
          {
            stepTitle: "Step 2: Integrate e^x repeatedly",
            description: "I: e^x → e^x → e^x.",
            latex: "I: \\quad e^x \\longrightarrow e^x \\longrightarrow e^x"
          },
          {
            stepTitle: "Step 3: Multiply diagonals with alternating signs",
            description: "(+1)(x)(e^x) + (-1)(1)(e^x).",
            latex: "(+1) \\cdot x \\cdot e^x + (-1) \\cdot 1 \\cdot e^x = x e^x - e^x + C"
          }
        ],
        finalResultLatex: "x e^x - e^x + C",
        prosAndCons: {
          pros: "Blazing fast for x^n multiplied by e^x, sin(x), or cos(x).",
          cons: "Only works when one term eventually differentiates to 0."
        }
      },
      {
        methodId: "ibp-undetermined",
        methodName: "Method 3: Method of Undetermined Coefficients",
        badgeTag: "Ansatz Method",
        techniqueSummary: "Assumes antiderivative form Y(x) = (Ax + B)e^x and solves for coefficients A and B.",
        formulaLatex: "\\frac{d}{dx}\\left[(Ax + B)e^x\\right] = x e^x",
        steps: [
          {
            stepTitle: "Step 1: Propose trial antiderivative ansatz",
            description: "F(x) = (Ax + B)e^x.",
            latex: "F(x) = (Ax + B)e^x"
          },
          {
            stepTitle: "Step 2: Differentiate trial function",
            description: "F'(x) = A e^x + (Ax + B)e^x = (Ax + A + B)e^x.",
            latex: "(Ax + A + B)e^x = x e^x"
          },
          {
            stepTitle: "Step 3: Equate matching coefficients",
            description: "A = 1, A + B = 0 → B = -1.",
            latex: "A = 1, \\quad B = -1 \\implies (x - 1)e^x + C"
          }
        ],
        finalResultLatex: "x e^x - e^x + C",
        prosAndCons: {
          pros: "Requires no integration—only basic differentiation and linear algebra.",
          cons: "Requires knowing trial form beforehand."
        }
      }
    ]
  },
  {
    questionInput: "integrate(1 / (x^2 - 1))",
    questionTitle: "Integrate Rational Function: ∫ 1 / (x² - 1) dx",
    category: "Calculus & Integrals",
    latexQuestion: "\\int \\frac{1}{x^2 - 1} dx",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "rat-partial",
        methodName: "Method 1: Partial Fractions Decomposition",
        badgeTag: "Algebraic Decomposition",
        techniqueSummary: "Factors denominator into (x-1)(x+1) and splits into linear partial fractions.",
        formulaLatex: "\\frac{1}{(x-1)(x+1)} = \\frac{A}{x-1} + \\frac{B}{x+1}",
        steps: [
          {
            stepTitle: "Step 1: Factor denominator",
            description: "Difference of squares x² - 1 = (x-1)(x+1).",
            latex: "\\frac{1}{x^2 - 1} = \\frac{1}{(x-1)(x+1)}"
          },
          {
            stepTitle: "Step 2: Solve constants A and B",
            description: "A = 1/2, B = -1/2.",
            latex: "A = \\frac{1}{2}, \\quad B = -\\frac{1}{2}"
          },
          {
            stepTitle: "Step 3: Integrate log terms",
            description: "1/2 ln|x-1| - 1/2 ln|x+1|.",
            latex: "\\frac{1}{2}\\ln\\left|\\frac{x-1}{x+1}\\right| + C"
          }
        ],
        finalResultLatex: "0.5 \\ln\\left|\\frac{x-1}{x+1}\\right| + C",
        prosAndCons: {
          pros: "Fundamental technique for rational expressions.",
          cons: "Requires solving system of equations."
        }
      },
      {
        methodId: "rat-identity",
        methodName: "Method 2: Standard Logarithmic Integral Identity",
        badgeTag: "Direct Identity",
        techniqueSummary: "Applies standard integral identity ∫ 1/(x² - a²) dx = (1/2a) ln|(x-a)/(x+a)|.",
        formulaLatex: "\\int \\frac{1}{x^2 - a^2} dx = \\frac{1}{2a} \\ln\\left|\\frac{x-a}{x+a}\\right| + C",
        steps: [
          {
            stepTitle: "Step 1: Identify constant a = 1",
            description: "a² = 1 → a = 1.",
            latex: "a = 1"
          },
          {
            stepTitle: "Step 2: Substitute into identity formula",
            description: "Plug a = 1 into formula.",
            latex: "\\frac{1}{2(1)} \\ln\\left|\\frac{x-1}{x+1}\\right| + C"
          }
        ],
        finalResultLatex: "0.5 \\ln\\left|\\frac{x-1}{x+1}\\right| + C",
        prosAndCons: {
          pros: "Instant 1-step lookup identity.",
          cons: "Requires memorizing integral table."
        }
      }
    ]
  },
  {
    questionInput: "integrate(x^2, 0, 1, simpson)",
    questionTitle: "Definite Numerical Integration: ∫₀¹ x² dx",
    category: "Calculus & Integrals",
    latexQuestion: "\\int_{0}^{1} x^2 dx \\quad (n = 10)",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "num-simpson",
        methodName: "Method 1: Simpson's 1/3 Rule",
        badgeTag: "Parabolic Quadrature",
        techniqueSummary: "Approximates definite integral using parabolic arcs over pairs of subintervals.",
        formulaLatex: "I \\approx \\frac{h}{3}\\left[f(a) + 4\\sum_{\\text{odd}} f(x_i) + 2\\sum_{\\text{even}} f(x_i) + f(b)\\right]",
        steps: [
          {
            stepTitle: "Step 1: Compute interval width h",
            description: "h = (1 - 0) / 10 = 0.10.",
            latex: "h = \\frac{1 - 0}{10} = 0.10"
          },
          {
            stepTitle: "Step 2: Compute weighted odd and even node sums",
            description: "S_odd = 1.6500, S_even = 1.2000.",
            latex: "S_{\\text{odd}} = 1.6500, \\quad S_{\\text{even}} = 1.2000"
          },
          {
            stepTitle: "Step 3: Apply Simpson's formula",
            description: "I = (0.10 / 3) * (0 + 4(1.65) + 2(1.20) + 1) = 0.333333.",
            latex: "I = \\frac{0.10}{3}(0 + 6.60 + 2.40 + 1) = 0.333333"
          }
        ],
        finalResultLatex: "0.333333",
        prosAndCons: {
          pros: "Exact result for polynomials up to degree 3!",
          cons: "Requires even number of subintervals."
        }
      },
      {
        methodId: "num-trapezoidal",
        methodName: "Method 2: Trapezoidal Rule",
        badgeTag: "Linear Interpolation",
        techniqueSummary: "Approximates area under curve using trapezoids.",
        formulaLatex: "I \\approx \\frac{h}{2}\\left[f(a) + 2\\sum_{i=1}^{n-1} f(x_i) + f(b)\\right]",
        steps: [
          {
            stepTitle: "Step 1: Compute interior sum",
            description: "Sum interior evaluations S_int = 2.8500.",
            latex: "S_{\\text{int}} = 2.8500"
          },
          {
            stepTitle: "Step 2: Apply Trapezoidal formula",
            description: "I = (0.10 / 2) * (0 + 2(2.85) + 1) = 0.335000.",
            latex: "I = \\frac{0.10}{2}(0 + 5.70 + 1) = 0.335000"
          }
        ],
        finalResultLatex: "0.335000",
        prosAndCons: {
          pros: "Simple linear geometry formula.",
          cons: "Slightly less precise than Simpson's rule for curved functions."
        }
      },
      {
        methodId: "num-midpoint",
        methodName: "Method 3: Midpoint Rule",
        badgeTag: "Centered Rectangle",
        techniqueSummary: "Evaluates function at subinterval midpoints.",
        formulaLatex: "I \\approx h \\sum_{i=1}^n f(x_i^*)",
        steps: [
          {
            stepTitle: "Step 1: Evaluate midpoints x_i* = a + (i - 0.5)h",
            description: "Sum midpoint values S_mid = 3.3250.",
            latex: "S_{\\text{mid}} = 3.3250"
          },
          {
            stepTitle: "Step 2: Multiply by interval width h",
            description: "I = 0.10 * 3.3250 = 0.332500.",
            latex: "I = 0.10 \\times 3.3250 = 0.332500"
          }
        ],
        finalResultLatex: "0.332500",
        prosAndCons: {
          pros: "Avoids evaluating singular boundary endpoints.",
          cons: "Requires computing half-step grid points."
        }
      }
    ]
  },

  // CALCULUS DERIVATIVES ENGINE
  {
    questionInput: "derive(x * sin(x))",
    questionTitle: "Derive Product: d/dx [ x sin(x) ]",
    category: "Derivatives",
    latexQuestion: "\\frac{d}{dx} \\left[ x \\sin(x) \\right]",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "der-prod",
        methodName: "Method 1: Product Rule (u·v)' = u'v + uv'",
        badgeTag: "Standard Differential",
        techniqueSummary: "Differentiates product of u = x and v = sin(x).",
        formulaLatex: "\\frac{d}{dx}[u \\cdot v] = u' v + u v'",
        steps: [
          {
            stepTitle: "Step 1: Identify terms u and v",
            description: "u = x, v = sin(x).",
            latex: "u = x \\implies u' = 1, \\quad v = \\sin(x) \\implies v' = \\cos(x)"
          },
          {
            stepTitle: "Step 2: Apply product rule formula",
            description: "Combine u'v + uv'.",
            latex: "(1)\\sin(x) + x(\\cos x) = \\sin(x) + x \\cos(x)"
          }
        ],
        finalResultLatex: "\\sin(x) + x \\cos(x)",
        prosAndCons: {
          pros: "Direct 2-step solution.",
          cons: "None."
        }
      },
      {
        methodId: "der-log",
        methodName: "Method 2: Logarithmic Differentiation",
        badgeTag: "Advanced Differential",
        techniqueSummary: "Takes natural log of y = x sin(x) before differentiating.",
        formulaLatex: "\\ln(y) = \\ln(x) + \\ln(\\sin x) \\implies \\frac{y'}{y} = \\frac{1}{x} + \\cot(x)",
        steps: [
          {
            stepTitle: "Step 1: Take ln of both sides",
            description: "Convert product into sum using log properties.",
            latex: "y = x \\sin(x) \\implies \\ln(y) = \\ln(x) + \\ln(\\sin x)"
          },
          {
            stepTitle: "Step 2: Implicitly differentiate with respect to x",
            description: "d/dx [ln y] = y'/y.",
            latex: "\\frac{y'}{y} = \\frac{1}{x} + \\frac{\\cos(x)}{\\sin(x)} = \\frac{1}{x} + \\cot(x)"
          },
          {
            stepTitle: "Step 3: Multiply by y = x sin(x)",
            description: "y' = x sin(x) [ 1/x + cos(x)/sin(x) ].",
            latex: "y' = \\sin(x) + x \\cos(x)"
          }
        ],
        finalResultLatex: "\\sin(x) + x \\cos(x)",
        prosAndCons: {
          pros: "Extremely powerful for complex multi-term products/quotients with exponents.",
          cons: "Extra algebra for simple 2-term products."
        }
      }
    ]
  },

  // LINEAR ALGEBRA & MATRICES ENGINE
  {
    questionInput: "cramer([[2, 3, 8], [1, -1, -1]])",
    questionTitle: "Solve System: 2x + 3y = 8,  x - y = -1",
    category: "Linear Algebra",
    latexQuestion: "\\begin{pmatrix} 2 & 3 \\\\ 1 & -1 \\end{pmatrix} \\begin{pmatrix} x \\\\ y \\end{pmatrix} = \\begin{pmatrix} 8 \\\\ -1 \\end{pmatrix}",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "sys-cramer",
        methodName: "Method 1: Cramer's Rule via Determinants",
        badgeTag: "Determinant Ratio",
        techniqueSummary: "Computes x_i = det(A_i) / det(A) using determinant ratios.",
        formulaLatex: "x = \\frac{\\det(A_x)}{\\det(A)}, \\quad y = \\frac{\\det(A_y)}{\\det(A)}",
        steps: [
          {
            stepTitle: "Step 1: Compute main determinant det(A)",
            description: "det([[2, 3], [1, -1]]) = (2)(-1) - (3)(1) = -5.",
            latex: "\\det(A) = (2)(-1) - (3)(1) = -5"
          },
          {
            stepTitle: "Step 2: Replace x column with b to find det(Ax)",
            description: "det([[8, 3], [-1, -1]]) = (8)(-1) - (3)(-1) = -5.",
            latex: "\\det(A_x) = (8)(-1) - (3)(-1) = -5 \\implies x = \\frac{-5}{-5} = 1"
          },
          {
            stepTitle: "Step 3: Replace y column with b to find det(Ay)",
            description: "det([[2, 8], [1, -1]]) = (2)(-1) - (8)(1) = -10.",
            latex: "\\det(A_y) = (2)(-1) - (8)(1) = -10 \\implies y = \\frac{-10}{-5} = 2"
          }
        ],
        finalResultLatex: "x = 1, \\quad y = 2",
        prosAndCons: {
          pros: "Direct explicit formulas for individual unknown variables.",
          cons: "Requires computing n+1 determinants."
        }
      },
      {
        methodId: "sys-gauss",
        methodName: "Method 2: Gaussian Elimination & RREF",
        badgeTag: "Augmented Matrix Operations",
        techniqueSummary: "Performs elementary row operations on augmented matrix [A | b] to reach Reduced Row Echelon Form.",
        formulaLatex: "\\begin{pmatrix} 2 & 3 & 8 \\\\ 1 & -1 & -1 \\end{pmatrix} \\xrightarrow{\\text{RREF}} \\begin{pmatrix} 1 & 0 & 1 \\\\ 0 & 1 & 2 \\end{pmatrix}",
        steps: [
          {
            stepTitle: "Step 1: Swap rows R1 and R2 for pivot",
            description: "Put 1 in top left position.",
            latex: "\\begin{pmatrix} 1 & -1 & -1 \\\\ 2 & 3 & 8 \\end{pmatrix}"
          },
          {
            stepTitle: "Step 2: Eliminate x entry in row 2",
            description: "R2 ← R2 - 2*R1.",
            latex: "\\begin{pmatrix} 1 & -1 & -1 \\\\ 0 & 5 & 10 \\end{pmatrix} \\implies R_2 \\leftarrow \\frac{R_2}{5} \\implies \\begin{pmatrix} 1 & -1 & -1 \\\\ 0 & 1 & 2 \\end{pmatrix}"
          },
          {
            stepTitle: "Step 3: Back-substitute to reach RREF",
            description: "R1 ← R1 + R2.",
            latex: "\\begin{pmatrix} 1 & 0 & 1 \\\\ 0 & 1 & 2 \\end{pmatrix} \\implies x = 1, \\, y = 2"
          }
        ],
        finalResultLatex: "x = 1, \\quad y = 2",
        prosAndCons: {
          pros: "Universal O(n³) algorithm used in professional linear algebra libraries.",
          cons: "Requires multiple row arithmetic operations."
        }
      },
      {
        methodId: "sys-inverse",
        methodName: "Method 3: Matrix Inversion Method (x = A⁻¹b)",
        badgeTag: "Matrix Algebra",
        techniqueSummary: "Computes matrix inverse A⁻¹ and multiplies by vector b.",
        formulaLatex: "\\mathbf{x} = A^{-1}\\mathbf{b}, \\quad A^{-1} = \\frac{1}{\\det(A)}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}",
        steps: [
          {
            stepTitle: "Step 1: Compute inverse matrix A⁻¹",
            description: "A⁻¹ = (-1/5) [[-1, -3], [-1, 2]] = [[0.2, 0.6], [0.2, -0.4]].",
            latex: "A^{-1} = \\begin{pmatrix} 0.2 & 0.6 \\\\ 0.2 & -0.4 \\end{pmatrix}"
          },
          {
            stepTitle: "Step 2: Multiply A⁻¹ by b",
            description: "x = 0.2(8) + 0.6(-1) = 1, y = 0.2(8) - 0.4(-1) = 2.",
            latex: "\\begin{pmatrix} 0.2 & 0.6 \\\\ 0.2 & -0.4 \\end{pmatrix} \\begin{pmatrix} 8 \\\\ -1 \\end{pmatrix} = \\begin{pmatrix} 1 \\\\ 2 \\end{pmatrix}"
          }
        ],
        finalResultLatex: "x = 1, \\quad y = 2",
        prosAndCons: {
          pros: "Allows solving for multiple different RHS vectors b instantaneously.",
          cons: "Requires computing full matrix inverse."
        }
      }
    ]
  },
  {
    questionInput: "det([[1, 2], [3, 4]])",
    questionTitle: "Determinant of Matrix: det([[1, 2], [3, 4]])",
    category: "Linear Algebra",
    latexQuestion: "\\det \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "det-2x2",
        methodName: "Method 1: Standard 2x2 Diagonal Formula (ad - bc)",
        badgeTag: "Direct Formula",
        techniqueSummary: "Multiplies main diagonal elements and subtracts anti-diagonal elements.",
        formulaLatex: "\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc",
        steps: [
          {
            stepTitle: "Step 1: Identify matrix elements",
            description: "a=1, b=2, c=3, d=4.",
            latex: "a = 1, \\quad b = 2, \\quad c = 3, \\quad d = 4"
          },
          {
            stepTitle: "Step 2: Compute diagonal product minus anti-diagonal product",
            description: "Compute (1)(4) - (2)(3).",
            latex: "(1)(4) - (2)(3) = 4 - 6 = -2"
          }
        ],
        finalResultLatex: "\\det(A) = -2",
        prosAndCons: {
          pros: "Instant evaluation for 2x2 matrices.",
          cons: "Only works for 2x2 matrices."
        }
      },
      {
        methodId: "det-rowop",
        methodName: "Method 2: Row Elimination (Gaussian Triangular Reduction)",
        badgeTag: "Universal Algorithm",
        techniqueSummary: "Uses elementary row operations to reduce matrix to upper triangular form.",
        formulaLatex: "\\det(A) = \\det(U) = \\prod_{i=1}^n u_{ii}",
        steps: [
          {
            stepTitle: "Step 1: Eliminate row 2 column 1 entry",
            description: "Perform row operation R2 ← R2 - 3*R1.",
            latex: "R_2 \\leftarrow R_2 - 3R_1 \\implies \\begin{pmatrix} 1 & 2 \\\\ 0 & -2 \\end{pmatrix}"
          },
          {
            stepTitle: "Step 2: Multiply diagonal entries of triangular matrix",
            description: "Determinant of upper triangular matrix equals product of diagonal entries.",
            latex: "\\det = (1) \\cdot (-2) = -2"
          }
        ],
        finalResultLatex: "\\det(A) = -2",
        prosAndCons: {
          pros: "Scales efficiently O(n³) to huge N x N matrices.",
          cons: "Slightly more work for tiny 2x2 matrices."
        }
      }
    ]
  },
  {
    questionInput: "eigen([[1, 2], [2, 1]])",
    questionTitle: "Eigenvalues of Matrix: eigen([[1, 2], [2, 1]])",
    category: "Linear Algebra",
    latexQuestion: "\\det \\begin{pmatrix} 1-\\lambda & 2 \\\\ 2 & 1-\\lambda \\end{pmatrix} = 0",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "eigen-char",
        methodName: "Method 1: Characteristic Polynomial det(A - λI) = 0",
        badgeTag: "Characteristic Roots",
        techniqueSummary: "Solves characteristic polynomial equation det(A - λI) = 0.",
        formulaLatex: "\\det(A - \\lambda I) = 0",
        steps: [
          {
            stepTitle: "Step 1: Form characteristic determinant",
            description: "Subtract λ from diagonal entries.",
            latex: "\\det \\begin{pmatrix} 1-\\lambda & 2 \\\\ 2 & 1-\\lambda \\end{pmatrix} = (1-\\lambda)^2 - 4 = 0"
          },
          {
            stepTitle: "Step 2: Expand and solve polynomial",
            description: "λ² - 2λ - 3 = (λ - 3)(λ + 1) = 0.",
            latex: "\\lambda_1 = 3, \\quad \\lambda_2 = -1"
          }
        ],
        finalResultLatex: "\\lambda_1 = 3, \\quad \\lambda_2 = -1",
        prosAndCons: {
          pros: "Exact analytical solution for eigenvalues.",
          cons: "Requires solving n-th degree polynomial."
        }
      },
      {
        methodId: "eigen-invariants",
        methodName: "Method 2: Matrix Trace & Determinant Invariants",
        badgeTag: "Invariant Properties",
        techniqueSummary: "Uses trace(A) = λ1 + λ2 and det(A) = λ1 · λ2.",
        formulaLatex: "\\text{trace}(A) = \\sum \\lambda_i, \\quad \\det(A) = \\prod \\lambda_i",
        steps: [
          {
            stepTitle: "Step 1: Compute trace(A) and det(A)",
            description: "trace(A) = 1 + 1 = 2, det(A) = 1 - 4 = -3.",
            latex: "\\lambda_1 + \\lambda_2 = 2, \\quad \\lambda_1 \\lambda_2 = -3"
          },
          {
            stepTitle: "Step 2: Solve system for λ1 and λ2",
            description: "Numbers that sum to 2 and multiply to -3 are 3 and -1.",
            latex: "\\lambda_1 = 3, \\quad \\lambda_2 = -1"
          }
        ],
        finalResultLatex: "\\lambda_1 = 3, \\quad \\lambda_2 = -1",
        prosAndCons: {
          pros: "Lightning fast 2-step calculation for 2x2 matrices.",
          cons: "Requires solving system of equations for larger matrices."
        }
      }
    ]
  },

  // STATISTICS ENGINE
  {
    questionInput: "mean([10, 20, 30, 40, 50])",
    questionTitle: "Dataset Mean: mean([10, 20, 30, 40, 50])",
    category: "Statistics",
    latexQuestion: "\\text{Mean}([10, 20, 30, 40, 50])",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "stat-def",
        methodName: "Method 1: Definition Formula (Σx / n)",
        badgeTag: "Direct Definition",
        techniqueSummary: "Sums all dataset elements and divides by sample size n.",
        formulaLatex: "\\bar{x} = \\frac{1}{n} \\sum_{i=1}^n x_i",
        steps: [
          {
            stepTitle: "Step 1: Sum all data values",
            description: "10 + 20 + 30 + 40 + 50 = 150.",
            latex: "\\sum x_i = 150"
          },
          {
            stepTitle: "Step 2: Divide by dataset size n = 5",
            description: "150 / 5 = 30.",
            latex: "\\bar{x} = \\frac{150}{5} = 30"
          }
        ],
        finalResultLatex: "\\bar{x} = 30",
        prosAndCons: {
          pros: "Universal direct calculation.",
          cons: "Can involve large numbers without calculator."
        }
      },
      {
        methodId: "stat-assumed",
        methodName: "Method 2: Assumed Mean / Deviation Method",
        badgeTag: "Deviation Shift",
        techniqueSummary: "Picks assumed mean A = 30 and computes average of deviations d_i = x_i - A.",
        formulaLatex: "\\bar{x} = A + \\frac{\\sum d_i}{n}",
        steps: [
          {
            stepTitle: "Step 1: Pick assumed mean A = 30",
            description: "Deviations: -20, -10, 0, +10, +20.",
            latex: "d_i = [-20, -10, 0, 10, 20]"
          },
          {
            stepTitle: "Step 2: Compute average deviation",
            description: "Sum of deviations = 0.",
            latex: "\\sum d_i = 0 \\implies \\bar{x} = 30 + \\frac{0}{5} = 30"
          }
        ],
        finalResultLatex: "\\bar{x} = 30",
        prosAndCons: {
          pros: "Reduces large numbers to small mental math deviations.",
          cons: "Requires picking initial assumed mean."
        }
      }
    ]
  },

  // GEOMETRY ENGINE
  {
    questionInput: "translate(circle, 2, -1)",
    questionTitle: "Geometric Translation: translate(circle, 2, -1)",
    category: "Geometry",
    latexQuestion: "\\text{Translate } (x, y) \\longrightarrow (x + 2, \\, y - 1)",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "geom-vector",
        methodName: "Method 1: Coordinate Vector Addition",
        badgeTag: "Vector Shift",
        techniqueSummary: "Adds displacement vector (dx, dy) = (2, -1) to shape center coordinates.",
        formulaLatex: "\\begin{pmatrix} x' \\\\ y' \\end{pmatrix} = \\begin{pmatrix} x \\\\ y \\end{pmatrix} + \\begin{pmatrix} 2 \\\\ -1 \\end{pmatrix}",
        steps: [
          {
            stepTitle: "Step 1: Extract shape center (x0, y0)",
            description: "Assume initial unit circle centered at origin (0, 0).",
            latex: "(x_0, y_0) = (0, 0)"
          },
          {
            stepTitle: "Step 2: Add translation vector (2, -1)",
            description: "Compute new center position.",
            latex: "(x', y') = (0 + 2, 0 - 1) = (2, -1)"
          }
        ],
        finalResultLatex: "(x - 2)^2 + (y + 1)^2 = r^2 \\quad \\text{at } (2, -1)",
        prosAndCons: {
          pros: "Direct 2D vector addition.",
          cons: "None."
        }
      },
      {
        methodId: "geom-matrix",
        methodName: "Method 2: Homogeneous Transformation Matrix",
        badgeTag: "Affine Transformation Matrix",
        techniqueSummary: "Multiplies homogeneous coordinate vector [x, y, 1]^T by 3x3 translation matrix.",
        formulaLatex: "\\begin{pmatrix} x' \\\\ y' \\\\ 1 \\end{pmatrix} = \\begin{pmatrix} 1 & 0 & dx \\\\ 0 & 1 & dy \\\\ 0 & 0 & 1 \\end{pmatrix} \\begin{pmatrix} x \\\\ y \\\\ 1 \\end{pmatrix}",
        steps: [
          {
            stepTitle: "Step 1: Construct 3x3 Translation Matrix",
            description: "Plug dx = 2, dy = -1 into matrix.",
            latex: "T = \\begin{pmatrix} 1 & 0 & 2 \\\\ 0 & 1 & -1 \\\\ 0 & 0 & 1 \\end{pmatrix}"
          },
          {
            stepTitle: "Step 2: Multiply by homogeneous vector",
            description: "Multiply matrix by [0, 0, 1]^T.",
            latex: "T \\cdot \\begin{pmatrix} 0 \\\\ 0 \\\\ 1 \\end{pmatrix} = \\begin{pmatrix} 2 \\\\ -1 \\\\ 1 \\end{pmatrix}"
          }
        ],
        finalResultLatex: "(2, -1)",
        prosAndCons: {
          pros: "Combines translation, rotation, and scaling into single unified matrix operation in computer graphics.",
          cons: "Requires 3x3 matrix multiplication."
        }
      }
    ]
  }
];

interface ExplanationPageProps {
  onTryExample: (expression: string) => void;
  onClose: () => void;
  initialEquation: string;
  theme: ThemeType;
  currentSolution?: EquationSolution | null;
}

function formatInputToLatex(input: string): string {
  if (!input) return "";
  let result = input.trim();
  result = result.replace(/integrate\((.*?)\)/gi, "\\int $1 dx");
  result = result.replace(/derive\((.*?)\)/gi, "\\frac{d}{dx}\\left[$1\\right]");
  result = result.replace(/sqrt\((.*?)\)/gi, "\\sqrt{$1}");
  result = result.replace(/det\(\[\[(.*?), (.*?)\], \[(.*?), (.*?)\]\]\)/gi, "\\det\\begin{pmatrix}$1 & $2\\\\$3 & $4\\end{pmatrix}");
  result = result.replace(/\*/g, " \\cdot ");
  return result;
}

function convertSolutionToQuestionData(data: EquationSolution, fallbackEquation?: string): QuestionMultiMethodData {
  const eq = data.equation || fallbackEquation || "";
  const methodSteps = (data.scenes && data.scenes.length > 0)
    ? data.scenes.map((s: any, idx: number) => ({
      stepTitle: s.title || `Step ${idx + 1}`,
      description: s.explanation || s.subTitle || "",
      latex: s.primaryMath || s.secondaryMath || s.latex || s.formula || ""
    }))
    : [
      {
        stepTitle: "Step 1: Compute analytical solution",
        description: data.summary || "Parsed equation and solved directly via engine.",
        latex: data.finalAnswer || (data as any).finalResult || formatInputToLatex(eq)
      }
    ];

  const finalRes = data.finalAnswer || (data as any).finalResult || (methodSteps[methodSteps.length - 1]?.latex || formatInputToLatex(eq));

  const apiMethod: MethodSolution = {
    methodId: `api-solve-${Date.now()}`,
    methodName: `Method 1: Backend ${data.equationType || "Engine"} Resolution`,
    badgeTag: "AI Engine Solver",
    techniqueSummary: data.summary || `Parsed with ${data.equationType || "AI Mathematical"} engine.`,
    formulaLatex: formatInputToLatex(eq),
    steps: methodSteps,
    finalResultLatex: finalRes,
    prosAndCons: {
      pros: "Direct automated resolution with complete step-by-step derivations.",
      cons: "Generated dynamically by backend solver."
    }
  };

  const categoryType: QuestionMultiMethodData["category"] =
    data.equationType?.toLowerCase().includes("calculus") || data.equationType?.toLowerCase().includes("integral")
      ? "Calculus & Integrals"
      : data.equationType?.toLowerCase().includes("derivative")
        ? "Derivatives"
        : data.equationType?.toLowerCase().includes("linear") || data.equationType?.toLowerCase().includes("matrix")
          ? "Linear Algebra"
          : data.equationType?.toLowerCase().includes("stat")
            ? "Statistics"
            : data.equationType?.toLowerCase().includes("geo")
              ? "Geometry"
              : "Algebra & Equations";

  const methodsList = (data.methods && data.methods.length > 0)
    ? data.methods
    : [apiMethod];

  return {
    id: `api-solve-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    questionInput: eq,
    questionTitle: `${data.equationType || "Solved Problem"}: ${eq}`,
    category: categoryType,
    latexQuestion: formatInputToLatex(eq),
    defaultMethodIndex: 0,
    methods: methodsList
  };
}

const INITIAL_DATABASE: QuestionMultiMethodData[] = COMPREHENSIVE_ENGINE_DATABASE.map((item, idx) => ({
  id: `preset-${idx}-${item.questionInput.replace(/\s+/g, '_')}`,
  ...item
}));

export default function Explanation({ onTryExample, onClose, initialEquation, theme = 'chalkboard', currentSolution }: ExplanationPageProps) {
  const [questionsDatabase, setQuestionsDatabase] = useState<QuestionMultiMethodData[]>(INITIAL_DATABASE);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [activeMethodIndex, setActiveMethodIndex] = useState<number>(0);
  const [userToken, setUserToken] = useState<string | null>(localStorage.getItem("math_token"));
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState<Array<{ equation: string, type: string, completed: boolean, date: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [solution, setSolution] = useState<EquationSolution | null>(currentSolution || null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"single" | "sideBySide">("single");
  const [customWriterInput, setCustomWriterInput] = useState<string>(initialEquation || currentSolution?.equation || 'x^2+2x=15');
  const writerInputRef = useRef<HTMLInputElement>(null);
  const categories = ["All", "Algebra & Equations", "Calculus & Integrals", "Derivatives", "Linear Algebra", "Statistics", "Geometry"];
  const [renderingVideo, setRenderingVideo] = useState<boolean>(false);
  const [renderingMethodId, setRenderingMethodId] = useState<string | null>(null);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [videoModalTitle, setVideoModalTitle] = useState<string>("");

  const renderVideoForMethod = async (method: MethodSolution, questionInput: string) => {
    setRenderingVideo(true);
    setRenderingMethodId(method.methodId);
    setStatusMessage(`Compiling Manim video animation for ${method.methodName.split(':')[0]}...`);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (userToken) {
        headers["Authorization"] = `Bearer ${userToken}`;
      }

      const response = await fetch("/api/render", {
        method: "POST",
        headers,
        body: JSON.stringify({
          equation: questionInput,
          method_id: method.methodId,
          method_name: method.methodName,
          quality: "low"
        })
      });

      if (response.status === 403) {
        const errData = await response.json().catch(() => ({}));
        setIsPaymentModalOpen(true);
        throw new Error(errData.detail || "Pro subscription required for high quality video rendering.");
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Video rendering service failed.");
      }

      const data = await response.json();
      setStatusMessage("Streaming generated solution video...");

      const videoResponse = await fetch(data.video_url, {
        headers: userToken ? { "Authorization": `Bearer ${userToken}` } : {}
      });
      if (!videoResponse.ok) throw new Error("Failed to load video stream.");

      const blob = await videoResponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      setVideoModalUrl(blobUrl);
      setVideoModalTitle(`${method.methodName} — ${questionInput}`);
      setStatusMessage("Video animation ready!");
      setTimeout(() => setStatusMessage(""), 4000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message || "Failed to render video.");
    } finally {
      setRenderingVideo(false);
      setRenderingMethodId(null);
    }
  };

  // Load current solution or initial equation when entering Explanation page
  useEffect(() => {
    if (currentSolution && currentSolution.scenes && currentSolution.scenes.length > 0) {
      setSolution(currentSolution);
      const newQ = convertSolutionToQuestionData(currentSolution, initialEquation);
      setQuestionsDatabase((prev) => [
        newQ,
        ...prev.filter(q => q.questionInput.toLowerCase().trim() !== newQ.questionInput.toLowerCase().trim())
      ]);
      setActiveQuestionIndex(0);
      setActiveMethodIndex(0);
      setCustomWriterInput(currentSolution.equation || initialEquation);
    } else if (initialEquation && initialEquation.trim()) {
      solve(initialEquation);
    }
  }, [currentSolution, initialEquation]);

  const insertSymbolIntoWriter = (symbolText: string) => {
    setCustomWriterInput((prev) => {
      if (!prev) return symbolText;
      return prev + symbolText;
    });
    if (writerInputRef.current) { writerInputRef.current.focus() }
  };
  const solve = async (equation: string) => {
    if (!equation || !equation.trim()) return;
    setLoading(true);
    setStatusMessage("Solving equation... please wait...");
    stopSpeech();
    setIsPlaying(false);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (userToken) {
        headers["Authorization"] = `Bearer ${userToken}`;
      }
      const res = await fetch("/api/solve", { method: "POST", headers, body: JSON.stringify({ equation: equation }) });
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        setIsPaymentModalOpen(true);
        throw new Error(errData.detail || "You have reached the free solve limit. Please upgrade to Pro.");
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Mathematical parsing service returned an error status.");
      }
      const data: EquationSolution = await res.json();
      setSolution(data);

      const newQuestion = convertSolutionToQuestionData(data, equation);

      setQuestionsDatabase((prev) => [newQuestion, ...prev.filter(q => q.questionInput.toLowerCase() !== equation.toLowerCase().trim())]);
      setActiveQuestionIndex(0);
      setActiveMethodIndex(0);
      setViewMode("single");

      const filtered = historyList.filter((item) => item.equation.toLowerCase() !== equation.toLowerCase().trim());
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setHistoryList([
        { equation: equation, type: data.equationType || "Parsed Equation", completed: true, date: timeStr },
        ...filtered.slice(0, 5)
      ]);
      setStatusMessage("");
    } catch (e: any) {
      setStatusMessage(e.message || "Failed to solve equation.");
    }
    finally {
      setLoading(false);
    }
  };

  const stopSpeech = () => {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) { window.speechSynthesis.cancel(); }
    } catch (e) { }
  };




  const activeQuestion = questionsDatabase[activeQuestionIndex] || questionsDatabase[0];
  const currentQuestion = activeQuestion || {
    questionInput: "",
    questionTitle: "No problem selected",
    category: "Algebra & Equations" as const,
    latexQuestion: "",
    defaultMethodIndex: 0,
    methods: [
      {
        methodId: "default",
        methodName: "Method 1: Direct Solution",
        badgeTag: "Standard",
        techniqueSummary: "No steps available.",
        formulaLatex: "",
        steps: [],
        finalResultLatex: "",
        prosAndCons: { pros: "", cons: "" }
      }
    ]
  };
  const currentMethod = currentQuestion.methods[activeMethodIndex] || currentQuestion.methods[0] || {
    methodId: "default",
    methodName: "Method 1: Direct Solution",
    badgeTag: "Standard",
    techniqueSummary: "No steps available.",
    formulaLatex: "",
    steps: [],
    finalResultLatex: "",
    prosAndCons: { pros: "", cons: "" }
  };

  // Filter questions by category and search query
  const filteredQuestions = questionsDatabase.filter((q) => {
    const matchesCategory = selectedCategory === "All" || q.category === selectedCategory;
    const matchesSearch =
      q.questionInput.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.questionTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeTheme = THEME_STYLES[theme] || THEME_STYLES.chalkboard;

  return (
    <div className={`w-full min-h-screen ${activeTheme.bg} text-white flex flex-col font-sans antialiased selection:bg-blue-600/30`}>

      {/* Top Header Bar */}
      <header className={`border-b ${activeTheme.header} bg-[#0F0F14]/90 backdrop-blur-md sticky top-0 z-40 px-6 sm:px-10 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              All Engine Multi-Method Resolution Explorer
            </h1>
            <span className="text-[10px] font-bold bg-blue-600/30 border border-blue-500/40 text-blue-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              All Backend Engine Options Included
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1 max-w-2xl font-mono">
            Full coverage of Algebra, Calculus Integrals, Derivatives, Linear Algebra, Statistics, and Geometry engines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle Button */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("single")}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === "single" ? "bg-blue-600 text-white" : "text-white/60 hover:text-white"
                }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Tabbed Steps
            </button>
            <button
              onClick={() => setViewMode("sideBySide")}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === "sideBySide" ? "bg-blue-600 text-white" : "text-white/60 hover:text-white"
                }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Side-by-Side
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
            >
              ← Back to App
            </button>
          )}
        </div>
      </header>

      {/* Interactive Custom Equation Writer Header Section */}
      <div className="w-full bg-[#0F0F14] border-b border-white/10 px-6 sm:px-10 py-5">
        <div className="max-w-7xl mx-auto space-y-4">

          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-400" />
              Write / Type Custom Equation or Problem
            </label>
            <span className="text-[10px] font-mono text-white/40">
              Type any math equation to generate & compare all engine solving options
            </span>
          </div>

          {/* Writer Input Field & Action Button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                ref={writerInputRef}
                type="text"
                value={customWriterInput}
                onChange={(e) => setCustomWriterInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    solve(customWriterInput);
                  }
                }}
                placeholder="Write equation here (e.g. x^2 - 5x + 6 = 0, integrate(x*e^x), derive(x*sin(x)), det([[1,2],[3,4]]))..."
                className="w-full bg-white/5 border border-white/20 focus:border-blue-500 rounded-xl px-4 py-3 text-sm font-mono text-blue-300 placeholder-white/40 focus:outline-none transition-all shadow-inner"
              />
              {customWriterInput && (
                <button
                  onClick={() => setCustomWriterInput("")}
                  className="absolute right-3 top-3 text-white/40 hover:text-white text-xs font-mono px-1.5 py-0.5 rounded bg-white/5 cursor-pointer"
                >
                  Clear [×]
                </button>
              )}
            </div>

            <button
              onClick={() => solve(customWriterInput)}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all transform active:scale-95 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Solving..." : "Analyze All Engine Options"}
            </button>
          </div>

          {/* Status Message / Error Banner */}
          {statusMessage && (
            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-mono ${loading
                ? "bg-blue-950/40 border border-blue-500/30 text-blue-300"
                : "bg-red-950/40 border border-red-500/30 text-red-300"
              }`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Quick-Insert Symbol Palette */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 mr-1 flex items-center gap-1">
              <Type className="w-3 h-3 text-blue-400" />
              Quick Insert:
            </span>
            {MATH_SYMBOL_BUTTONS.map((btn) => (
              <button
                key={btn.label}
                onClick={() => insertSymbolIntoWriter(btn.insertText)}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 text-xs font-mono font-bold text-blue-300 rounded-lg transition-all cursor-pointer transform active:scale-95"
                title={`Insert ${btn.insertText}`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Live KaTeX Render Preview */}
          {customWriterInput && (
            <div className="p-3 bg-black/50 border border-blue-500/30 rounded-xl flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Formatted LaTeX Preview:</span>
              <div className="text-base text-blue-200 font-mono">
                <KatexMath math={formatInputToLatex(customWriterInput)} block={false} />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="w-full border-b border-white/10 bg-[#0A0A0E] px-6 sm:px-10 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 mr-2 flex items-center gap-1">
            <ListFilter className="w-3.5 h-3.5 text-blue-400" />
            Engine Modules:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${selectedCategory === cat
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Sidebar: Questions Index (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-6">

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search equations (e.g. 'x^2', 'integrate', 'matrix', 'eigen')..."
              className="w-full bg-white/5 border border-white/15 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none transition-all font-mono"
            />
          </div>

          {/* Question Selector Deck */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2 px-1">
              <QuestionIcon className="w-3.5 h-3.5 text-blue-400" />
              Engine Math Problems Deck ({filteredQuestions.length})
            </h3>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredQuestions.map((qData, filterIdx) => {
                const globalIndex = questionsDatabase.indexOf(qData);
                const isSelected = globalIndex >= 0 ? globalIndex === activeQuestionIndex : false;

                return (
                  <div
                    key={qData.id || `deck-q-${qData.questionInput}-${globalIndex >= 0 ? globalIndex : filterIdx}`}
                    onClick={() => {
                      if (globalIndex >= 0) {
                        setActiveQuestionIndex(globalIndex);
                      }
                      setActiveMethodIndex(0);
                      setCustomWriterInput(qData.questionInput);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${isSelected
                      ? "bg-blue-600/15 border-blue-500/60 text-white shadow-lg shadow-blue-950/40"
                      : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-blue-300 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-500/30">
                        {qData.category}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded">
                        {qData.methods.length} Ways to Solve
                      </span>
                    </div>

                    <div className="text-sm font-bold tracking-tight text-white font-mono flex items-center justify-between">
                      <KatexMath math={qData.latexQuestion} block={false} />
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "text-blue-400 translate-x-1" : "text-white/30"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Area: Selected Question & Multiple Solving Methods (8 cols) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Active Question Banner */}
          <div className="bg-[#0F0F14] border border-white/15 rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-1">
                Active Problem Under Engine Analysis
              </span>
              <h2 className="text-xl font-black text-white font-mono flex items-center gap-3">
                <KatexMath math={currentQuestion.latexQuestion} block={false} />
              </h2>
            </div>

            {onTryExample && (
              <button
                onClick={() => onTryExample(currentQuestion.questionInput)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer transform active:scale-95 shrink-0"
              >
                <Calculator className="w-4 h-4" />
                Solve in Interactive Board
              </button>
            )}
          </div>

          {/* Method Selection Bar / Tabs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                Engine Solution Options ({currentQuestion.methods.length} Available)
              </h3>
            </div>

            {/* Method Tabs Navigation */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
              {currentQuestion.methods.map((m, idx) => {
                const isMethodSelected = idx === activeMethodIndex;
                return (
                  <button
                    key={m.methodId}
                    onClick={() => setActiveMethodIndex(idx)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${isMethodSelected
                      ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30"
                      : "bg-white/5 hover:bg-white/10 border-white/10 text-white/60 hover:text-white"
                      }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isMethodSelected ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
                      }`}>
                      {idx + 1}
                    </span>
                    <span>{m.methodName.split(":")[0]}</span>
                    <span className="text-[9px] opacity-75 font-mono px-1.5 py-0.5 rounded bg-black/20">
                      {m.badgeTag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* View Mode 1: Single Method Detailed View */}
          {viewMode === "single" ? (
            <div className="bg-[#0F0F14] border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-8">

              {/* Method Title Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-4 gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/30">
                      {currentMethod.badgeTag}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">
                    {currentMethod.methodName}
                  </h3>
                </div>

                <button
                  onClick={() => renderVideoForMethod(currentMethod, currentQuestion.questionInput)}
                  disabled={renderingVideo}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer transform active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {renderingVideo && renderingMethodId === currentMethod.methodId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Video className="w-4 h-4" />
                  )}
                  <span>
                    {renderingVideo && renderingMethodId === currentMethod.methodId
                      ? "Compiling Animation..."
                      : "Create Video (This Method)"}
                  </span>
                </button>
              </div>

              {/* Technique Summary */}
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">Approach Summary</h4>
                <p className="text-sm text-white/80 leading-relaxed">
                  {currentMethod.techniqueSummary}
                </p>
              </div>

              {/* Core Formula Box */}
              <div className="p-5 bg-black/60 border border-blue-500/30 rounded-xl space-y-2 relative overflow-hidden">
                <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">
                  Core Formula / Method Identity
                </div>
                <div className="py-2 text-center text-lg text-blue-300">
                  <KatexMath math={currentMethod.formulaLatex} block={true} />
                </div>
              </div>

              {/* Step-by-Step Resolution */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  Step-by-Step Resolution Walkthrough
                </h4>

                <div className="space-y-3">
                  {currentMethod.steps.map((step, idx) => (
                    <div key={idx} className="p-4 bg-black/40 border border-white/10 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-400 text-xs uppercase tracking-wider flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          {step.stepTitle}
                        </span>
                      </div>
                      <p className="text-xs text-white/70">{step.description}</p>
                      <div className="py-2 px-3 bg-white/5 rounded-lg text-sm text-white font-mono flex items-center justify-center">
                        <KatexMath math={step.latex} block={true} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Final Result Verification Box */}
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Method Result:
                </span>
                <div className="text-base font-bold text-emerald-200 font-mono">
                  <KatexMath math={currentMethod.finalResultLatex} block={false} />
                </div>
              </div>

              {/* Pros & Cons Comparison Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 block">Advantages</span>
                  <p className="text-xs text-emerald-200/80">{currentMethod.prosAndCons.pros}</p>
                </div>
                <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block">Trade-offs</span>
                  <p className="text-xs text-amber-200/80">{currentMethod.prosAndCons.cons}</p>
                </div>
              </div>

            </div>
          ) : (
            /* View Mode 2: Side-by-Side Comparison of All Methods for this question */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentQuestion.methods.map((method, idx) => (
                <div key={method.methodId} className="bg-[#0F0F14] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-6 flex flex-col justify-between">

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-black text-blue-400 uppercase tracking-wider truncate">
                          {method.methodName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => renderVideoForMethod(method, currentQuestion.questionInput)}
                          disabled={renderingVideo}
                          className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                          title="Generate animation video for this method"
                        >
                          {renderingVideo && renderingMethodId === method.methodId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 fill-purple-300" />
                          )}
                          <span>Video</span>
                        </button>
                        <span className="text-[9px] font-mono bg-blue-950/50 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded">
                          {method.badgeTag}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-white/70 leading-relaxed">
                      {method.techniqueSummary}
                    </p>

                    <div className="p-3 bg-black/60 border border-blue-500/30 rounded-lg text-center text-sm text-blue-300">
                      <KatexMath math={method.formulaLatex} block={true} />
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 block">Key Resolution Steps</span>
                      {method.steps.map((s, sIdx) => (
                        <div key={sIdx} className="p-2.5 bg-black/40 border border-white/10 rounded-lg space-y-1">
                          <span className="text-[10px] font-bold text-white/60 block">{s.stepTitle}</span>
                          <div className="text-xs font-mono text-white">
                            <KatexMath math={s.latex} block={false} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10">
                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-lg flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-emerald-400">Result:</span>
                      <div className="text-sm font-bold text-emerald-200 font-mono">
                        <KatexMath math={method.finalResultLatex} block={false} />
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* Video Solution Modal */}
      {videoModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12141F] border border-white/20 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Solution Video Animation</h3>
                  <p className="text-[11px] font-mono text-white/50 truncate max-w-md">{videoModalTitle}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  URL.revokeObjectURL(videoModalUrl);
                  setVideoModalUrl(null);
                }}
                className="text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
              <video
                src={videoModalUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={videoModalUrl}
                download={`math-solution-${Date.now()}.mp4`}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download MP4
              </a>
              <button
                onClick={() => {
                  URL.revokeObjectURL(videoModalUrl);
                  setVideoModalUrl(null);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        userToken={userToken}
        onPaymentSuccess={() => setIsPaymentModalOpen(false)}
      />

    </div>
  );
}
