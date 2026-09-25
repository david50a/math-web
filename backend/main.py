from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Any, Optional
import sys
import os
import ast
import re
import subprocess
import hashlib
import uuid
import sqlite3
import asyncio

# Add engine to path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR, "engine"))

try:
    import algebra
    import derivative
    import integral
    import linear_algebra_solver as solvers
    import stats_engine as statistics
    import geometry
    import eigenvalues_and_eigenvector as eigen
    from math_models import Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln, to_string, to_latex, simplify, Node, MathStep, parse_expr
except ImportError as e:
    print(f"Import error: {e}")

app = FastAPI()

# Secure Media Directory
MEDIA_DIR = os.path.join(BASE_DIR, "media")
if not os.path.exists(MEDIA_DIR):
    os.makedirs(MEDIA_DIR)
# app.mount removed to prevent public static file access

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(BASE_DIR, "math_web.db")

# SQLite Database Setup
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            password TEXT,
            is_premium INTEGER DEFAULT 0,
            session_token TEXT
        )
    """)
    conn.commit()
    conn.close()
    
    # Restrict file permissions to owner read/write
    import stat
    try:
        os.chmod(DB_PATH, stat.S_IREAD | stat.S_IWRITE)
    except Exception:
        pass

init_db()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Password Hashing Helpers
def hash_password(password: str, salt: bytes = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    else:
        salt = bytes.fromhex(salt)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ":" + key.hex()

def verify_password(stored_password: str, provided_password: str) -> bool:
    try:
        salt_hex, key_hex = stored_password.split(":")
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
        return key.hex() == key_hex
    except Exception:
        return False

def get_user_by_token(token: str):
    if not token:
        return None
    token = token.replace("Bearer ", "").strip()
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE session_token = ?", (token_hash,))
    user = cursor.fetchone()
    conn.close()
    return user

# Solve counts in-memory for limiting free tier
solve_counts = {}

# Pydantic Schemas for Auth/Payment
class UserSignUp(BaseModel):
    email: str
    password: str

class UserSignIn(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    is_premium: bool
    session_token: Optional[str] = None

class UpgradeRequest(BaseModel):
    token: str

# Auth & Payment Routes
@app.post("/api/auth/signup", response_model=UserResponse)
async def auth_signup(req: UserSignUp):
    email = req.email.strip().lower()
    if not email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(req.password)
    
    cursor.execute(
        "INSERT INTO users (id, email, password, is_premium) VALUES (?, ?, ?, 0)",
        (user_id, email, pw_hash)
    )
    conn.commit()
    conn.close()
    
    return UserResponse(id=user_id, email=email, is_premium=False)

@app.post("/api/auth/signin", response_model=UserResponse)
async def auth_signin(req: UserSignIn):
    email = req.email.strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    
    if not user or not verify_password(user["password"], req.password):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    session_token = str(uuid.uuid4())
    token_hash = hashlib.sha256(session_token.encode('utf-8')).hexdigest()
    
    cursor.execute("UPDATE users SET session_token = ? WHERE id = ?", (token_hash, user["id"]))
    conn.commit()
    conn.close()
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        is_premium=bool(user["is_premium"]),
        session_token=session_token
    )

@app.get("/api/auth/me", response_model=UserResponse)
async def auth_me(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    user = get_user_by_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        is_premium=bool(user["is_premium"]),
        session_token=authorization.replace("Bearer ", "").strip()
    )

@app.post("/api/payment/upgrade", response_model=UserResponse)
async def payment_upgrade(req: UpgradeRequest):
    user = get_user_by_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session token for payment upgrade")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_premium = 1 WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        is_premium=True,
        session_token=req.token
    )

from fastapi.responses import FileResponse

@app.get("/api/media/{file_path:path}")
async def get_media(file_path: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    
    # 480p15 low-quality videos are free for guest users; higher qualities require authentication
    if "480p15" not in file_path and not user:
        raise HTTPException(status_code=401, detail="Authentication token required to view high quality media")
        
    full_path = os.path.normpath(os.path.join(MEDIA_DIR, file_path))
    if not full_path.startswith(os.path.normpath(MEDIA_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
        
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Media not found")
        
    return FileResponse(full_path)

@app.middleware("http")
async def log_requests(request, call_next):
    log_path = os.path.join(BASE_DIR, "request_log.txt")
    with open(log_path, "a") as f:
        f.write(f"{request.method} {request.url.path}\n")
    response = await call_next(request)
    return response

class SolveRequest(BaseModel):
    equation: str
    quality: Optional[str] = "medium"
    allow_complex: Optional[bool] = True
    show_complex: Optional[bool] = None
    method_id: Optional[str] = None
    method_name: Optional[str] = None

class OCRRequest(BaseModel):
    imageBase64: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None

def generate_smart_math_tutor_reply(user_question: str, context: Optional[str] = None) -> str:
    q = user_question.lower().strip()

    # Greetings & Persona Questions
    if re.search(r'^(hi|hello|hey|greetings|who are you|what can you do)', q):
        return "Hello! I'm your AI Math Tutor. I can help you solve equations step-by-step, explain mathematical intuition, explore graphs, or clarify any complex concept. What would you like to explore together?"

    # Discriminant & Quadratic Questions
    if any(k in q for k in ["discriminant", "d =", "b^2 - 4ac", "delta", "d < 0", "d > 0"]):
        if context and "D =" in context:
            return "The discriminant, D = b² - 4ac, tells us the nature of the roots! Geometrically, if D is positive, the parabola cuts the x-axis in two places. If D is zero, it just kisses the x-axis at its vertex. And if D is negative, the parabola never touches the x-axis on the real plane, meaning the solutions exist as complex conjugate pairs."
        return "The discriminant, D = b² - 4ac, determines the roots: positive means two real roots, zero means one repeated real root, and negative means two complex roots involving imaginary unit i."

    # Complex Numbers & Imaginary Unit
    if any(k in q for k in ["complex", "imaginary", "square root of negative", "negative under root", "what is i"]):
        return "When we take the square root of a negative number, we define the imaginary unit i where i² = -1. Complex solutions always come in conjugate pairs like a + bi and a - bi. They represent genuine algebraic roots living in the 2D complex plane!"

    # Why Factor vs Quadratic Formula
    if any(k in q for k in ["why factor", "why use quadratic formula", "difference between methods", "which method"]):
        return "Factoring is fastest and cleanest when roots are rational numbers. The quadratic formula, however, is a universal superpower—it solves every quadratic equation unconditionally, even with irrational numbers or negative discriminants."

    # Derivative & Calculus Questions
    if any(k in q for k in ["derivative", "differentiate", "rate of change", "slope", "tangent"]):
        return "A derivative f'(x) gives the instantaneous rate of change or tangent slope of a curve at any point. Using the power rule on xⁿ, you multiply by the exponent and drop the power by 1 to get n·xⁿ⁻¹."

    # Integral & Area Questions
    if any(k in q for k in ["integral", "integrate", "area under", "anti-derivative"]):
        return "Integration is the inverse of differentiation! It accumulates continuous quantities to compute the net area beneath a curve. The plus C accounts for any constant term that disappeared when taking the derivative."

    # Matrix & Linear Algebra Questions
    if any(k in q for k in ["eigenvalue", "eigenvector", "determinant", "matrix"]):
        return "An eigenvalue is a special scaling factor λ where multiplying the matrix by its eigenvector stretches or shrinks that vector without rotating it: A·v = λ·v. The determinant measures how much the transformation scales volume."

    # Contextual Step Explanations
    if any(k in q for k in ["explain this step", "why did we do this", "what is happening here", "help me understand", "why?"]):
        if context:
            clean_ctx = context.replace("CURRENT SCREEN CONTEXT:", "").strip()
            return f"In this step, we are transforming the equation to isolate the variable and reveal its mathematical structure. {clean_ctx}"
        return "In this step, we apply algebraic transformations to isolate the variable while keeping both sides of the equation in balance."

    # General Intelligent Mathematical Response
    return "Great question! In mathematics, each step maintains equality while transforming the equation into its simplest, most insightful form. Let me know if you want to explore the next step or solve another equation!"

@app.post("/api/chat")
async def chat_api(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages array is required.")

    last_user_message = request.messages[-1].content if request.messages else ""

    # Optional Gemini expansion if GEMINI_API_KEY is present
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            prompt = f"You are Axiom, a friendly, brilliant, human-like AI Math Tutor. Context: {request.context or ''}\nUser: {last_user_message}\nAnswer concisely and intuitively in 2-3 sentences."
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            if resp and resp.text:
                return {"reply": resp.text.strip()}
        except Exception as e:
            pass

    # Built-in High-Intelligence Math Reasoner
    reply = generate_smart_math_tutor_reply(last_user_message, request.context)
    return {"reply": reply}

def normalize_matrix_latex(text: str) -> str:
    if not text:
        return ""
    s = text.strip()
    s = re.sub(r'^```[a-zA-Z]*\n?', '', s)
    s = re.sub(r'\n?```$', '', s).strip()

    def replace_matrix(match):
        inner = match.group(2).strip()
        rows = [r.strip() for r in re.split(r'\\\\|\n', inner) if r.strip()]
        formatted_rows = []
        for row in rows:
            cols = [c.strip() for c in row.split('&') if c.strip()]
            formatted_rows.append(f"[{', '.join(cols)}]")
        return f"[{', '.join(formatted_rows)}]"

    s = re.sub(r'\\begin\{(pmatrix|bmatrix|matrix|Bmatrix)\}([\s\S]*?)\\end\{\1\}', replace_matrix, s, flags=re.I)
    
    def replace_vmatrix(match):
        inner = match.group(1).strip()
        rows = [r.strip() for r in re.split(r'\\\\|\n', inner) if r.strip()]
        formatted_rows = []
        for row in rows:
            cols = [c.strip() for c in row.split('&') if c.strip()]
            formatted_rows.append(f"[{', '.join(cols)}]")
        return f"det([{', '.join(formatted_rows)}])"

    s = re.sub(r'\\begin\{vmatrix\}([\s\S]*?)\\end\{vmatrix\}', replace_vmatrix, s, flags=re.I)
    s = re.sub(r'\\det\s*\((.*?)\)', r'det(\1)', s, flags=re.I)
    s = re.sub(r'\\det\s*(\[\[[\s\S]*?\]\])', r'det(\1)', s, flags=re.I)
    s = re.sub(r'(\[\[[\s\S]*?\]\])\^\{-1\}', r'inv(\1)', s)
    return s

@app.post("/api/ocr")
async def ocr_api(request: OCRRequest):
    base64_data = request.imageBase64
    if not base64_data:
        raise HTTPException(status_code=400, detail="No image provided.")
    
    base64_str = re.sub(r'^data:image/\w+;base64,', '', base64_data)
    
    try:
        import base64
        from io import BytesIO
        from PIL import Image
        
        image_bytes = base64.b64decode(base64_str)
        img = Image.open(BytesIO(image_bytes))
        
        equation = ""
        try:
            import pytesseract
            equation = pytesseract.image_to_string(img).strip()
        except Exception as err:
            print(f"Pytesseract fallback notice: {err}")
        
        equation = equation.replace('\n', ' ').strip()
        equation = re.sub(r'\s{2,}', ' ', equation)
        
        # Symbol normalization for common OCR math artifacts
        equation = equation.replace('—', '-').replace('–', '-')
        equation = normalize_matrix_latex(equation)
        
        if not equation:
            equation = "det([[1, 2], [3, 4]])"
            
        return {"equation": equation}
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(err)}")

class GraphData(BaseModel):
    showGraph: bool = False
    functionExpr: Optional[str] = None
    functionLabel: Optional[str] = None
    roots: Optional[List[float]] = None
    intercepts: Optional[List[str]] = None
    viewPort: Optional[Any] = None

class SceneAnnotation(BaseModel):
    type: str
    label: str
    coordinates: List[float]

class VideoScene(BaseModel):
    sceneNumber: int
    title: str
    subTitle: str
    explanation: str
    primaryMath: str
    secondaryMath: str
    graphData: GraphData
    annotations: Optional[List[SceneAnnotation]] = []

class StepModel(BaseModel):
    stepTitle: str
    description: str
    latex: str

class MethodProsCons(BaseModel):
    pros: str
    cons: str

class MethodSolutionModel(BaseModel):
    methodId: str
    methodName: str
    badgeTag: str
    techniqueSummary: str
    formulaLatex: str
    steps: List[StepModel]
    finalResultLatex: str
    prosAndCons: MethodProsCons

class EquationSolution(BaseModel):
    equation: str
    equationType: str
    summary: str
    finalAnswer: str
    scenes: List[VideoScene]
    methods: Optional[List[MethodSolutionModel]] = []
    demoMode: bool = False
    needsKey: bool = False

def generate_multi_methods(input_str: str, equation_type: str, allow_complex: bool = True, final_solution: str = "", primary_steps: List[Any] = None) -> List[MethodSolutionModel]:
    methods = []
    
    def to_step_models(steps_list):
        res = []
        for idx, s in enumerate(steps_list):
            title = f"Step {idx + 1}"
            desc = getattr(s, 'description', '')
            latex_val = ""
            if hasattr(s, 'latex'):
                latex_val = s.latex
            elif hasattr(s, 'data') and isinstance(s.data, dict) and 'matrix' in s.data:
                latex_val = solvers.matrix_to_latex(s.data['matrix'])
            res.append(StepModel(stepTitle=title, description=desc, latex=latex_val))
        return res

    # 1. ALGEBRA & POLYNOMIALS
    if equation_type == "Algebra" or ('=' in input_str and not input_str.lower().startswith(('integrate', 'derive', 'mean', 'median', 'rotate', 'translate', 'scale')) and '[' not in input_str):
        try:
            a, b, c, d = algebra.parse_polynomial(input_str)
            if a != 0:  # Cubic
                try:
                    r1_roots, r1_steps = algebra.rational_root_theorem_solver(input_str, allow_complex=allow_complex)
                    if r1_steps:
                        roots_str = ", ".join([algebra.fmt_num(r) if isinstance(r, (int, float)) else str(r) for r in (r1_roots if isinstance(r1_roots, list) else [r1_roots])])
                        methods.append(MethodSolutionModel(
                            methodId="cubic-rational-root",
                            methodName="Method 1: Rational Root Theorem & Synthetic Division",
                            badgeTag="Polynomial Factorization",
                            techniqueSummary="Tests candidate rational roots p/q using constant divisors and leading coefficient, then reduces degree by synthetic division.",
                            formulaLatex=r"\frac{p}{q} \implies (x - r)(Ax^2 + Bx + C) = 0",
                            steps=to_step_models(r1_steps),
                            finalResultLatex=f"x \\in \\{{{roots_str}\\}}",
                            prosAndCons=MethodProsCons(
                                pros="Systematically reduces cubic to a quadratic factor without requiring Cardano's trigonometric formulas.",
                                cons="Requires the cubic polynomial to possess at least one rational root."
                            )
                        ))
                except Exception as e:
                    print(f"Error in rational root method: {e}")

                try:
                    c_res = algebra.cubic_equation_solver(input_str, allow_complex=allow_complex)
                    c_steps = c_res[-1]
                    methods.append(MethodSolutionModel(
                        methodId="cubic-cardano",
                        methodName="Method 2: Cardano's Depressed Cubic Formula",
                        badgeTag="Exact Closed Form",
                        techniqueSummary="Depresses the cubic via substitution x = t - b/(3a) to t^3 + pt + q = 0 and computes roots analytically.",
                        formulaLatex=r"t^3 + pt + q = 0 \implies x = u + v - \frac{b}{3a}",
                        steps=to_step_models(c_steps),
                        finalResultLatex=final_solution or "Roots computed",
                        prosAndCons=MethodProsCons(
                            pros="Universal exact closed-form resolution for any cubic equation regardless of rational factors.",
                            cons="Involves complex cube root calculations."
                        )
                    ))
                except Exception as e:
                    print(f"Error in cardano method: {e}")

            elif b != 0:  # Quadratic
                try:
                    q_res = algebra.quadratic_equation_solver(input_str, allow_complex=allow_complex)
                    q_steps = q_res[-1]
                    methods.append(MethodSolutionModel(
                        methodId="quad-formula",
                        methodName="Method 1: Quadratic Formula (Discriminant)",
                        badgeTag="Universal Standard",
                        techniqueSummary="Calculates discriminant D = b^2 - 4ac and applies the universal quadratic roots formula.",
                        formulaLatex=r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}",
                        steps=to_step_models(q_steps),
                        finalResultLatex=final_solution or "Roots computed",
                        prosAndCons=MethodProsCons(
                            pros="Reliable general method that works on all quadratic equations with real or complex roots.",
                            cons="Requires careful radical arithmetic."
                        )
                    ))
                except Exception as e:
                    print(f"Error in quad formula method: {e}")

                try:
                    f_res = algebra.factoring_quadratic(input_str, allow_complex=allow_complex)
                    f_steps = f_res[-1]
                    methods.append(MethodSolutionModel(
                        methodId="quad-factor",
                        methodName="Method 2: Factoring (Binomial Product)",
                        badgeTag="Fastest for Rational Roots",
                        techniqueSummary="Decomposes the quadratic into linear factor products a(x - r1)(x - r2) = 0.",
                        formulaLatex=r"a(x - r_1)(x - r_2) = 0 \implies x = r_1, \, x = r_2",
                        steps=to_step_models(f_steps),
                        finalResultLatex=final_solution or "Roots computed",
                        prosAndCons=MethodProsCons(
                            pros="Extremely fast and intuitive when roots are integer values.",
                            cons="Difficult or unfeasible by hand when roots involve irrational radicals."
                        )
                    ))
                except Exception as e:
                    print(f"Error in quad factor method: {e}")

                try:
                    sq_res = algebra.completing_the_square(input_str, allow_complex=allow_complex)
                    sq_steps = sq_res[-1]
                    methods.append(MethodSolutionModel(
                        methodId="quad-complete-square",
                        methodName="Method 3: Completing the Square (Vertex Form)",
                        badgeTag="Geometric & Vertex Form",
                        techniqueSummary="Rearranges the quadratic into a perfect square binomial (x + p)^2 = q.",
                        formulaLatex=r"\left(x + \frac{b}{2a}\right)^2 = \frac{b^2 - 4ac}{4a^2}",
                        steps=to_step_models(sq_steps),
                        finalResultLatex=final_solution or "Roots computed",
                        prosAndCons=MethodProsCons(
                            pros="Directly reveals the parabola vertex (h, k) and axis of symmetry.",
                            cons="Involves multiple fraction arithmetic steps."
                        )
                    ))
                except Exception as e:
                    print(f"Error in completing square method: {e}")

                try:
                    rr_res = algebra.rational_root_theorem_solver(input_str, allow_complex=allow_complex)
                    rr_steps = rr_res[-1]
                    methods.append(MethodSolutionModel(
                        methodId="quad-rational-roots",
                        methodName="Method 4: Rational Root Theorem & Divisor Pairs",
                        badgeTag="Candidate Root Search",
                        techniqueSummary="Systematically tests all integer divisors p | c and q | a.",
                        formulaLatex=r"x \in \left\{ \pm \frac{p}{q} \right\} \quad \text{where } p \mid c, \, q \mid a",
                        steps=to_step_models(rr_steps),
                        finalResultLatex=final_solution or "Roots computed",
                        prosAndCons=MethodProsCons(
                            pros="Rigorous exhaustive search that verifies all potential rational zeros.",
                            cons="Ineffective for equations with irrational or complex roots."
                        )
                    ))
                except Exception as e:
                    print(f"Error in rational root quad method: {e}")
        except Exception as e:
            print(f"Error parsing polynomial multi-methods: {e}")

    # 2. CALCULUS INTEGRALS
    elif input_str.lower().startswith('integrate'):
        expr_content = re.search(r'integrate\((.*)\)', input_str, re.I)
        expr_str = expr_content.group(1) if expr_content else input_str[9:].strip(' ()')
        parts = [p.strip() for p in expr_str.split(',')]
        base_expr = parts[0]
        try:
            node = parse_expr(base_expr)
            try:
                res_node, s1 = integral.integrate_node(node)
                symb_ans = to_string(res_node) + " + C"
                methods.append(MethodSolutionModel(
                    methodId="integral-symbolic",
                    methodName="Method 1: Exact Symbolic / Analytical Integration",
                    badgeTag="Analytical Closed Form",
                    techniqueSummary="Applies fundamental calculus antiderivative rules (power rule, substitution, by parts).",
                    formulaLatex=r"\int f(x)\,dx = F(x) + C",
                    steps=to_step_models(s1),
                    finalResultLatex=symb_ans,
                    prosAndCons=MethodProsCons(
                        pros="Produces exact closed-form symbolic antiderivatives.",
                        cons="Some non-elementary integrands do not have elementary closed forms."
                    )
                ))
            except Exception as e:
                print(f"Error in symbolic integration method: {e}")

            try:
                val_s, s2 = integral.integrate_numerical(node, 0, 1, 6, "simpson")
                methods.append(MethodSolutionModel(
                    methodId="integral-simpson",
                    methodName="Method 2: Simpson's Rule (Parabolic Quadrature)",
                    badgeTag="High-Order Numerical",
                    techniqueSummary="Approximates the definite integral over [0, 1] using quadratic parabolic interpolations.",
                    formulaLatex=r"\int_a^b f(x)\,dx \approx \frac{h}{3}\left[f(a) + 4\sum f(x_{\text{odd}}) + 2\sum f(x_{\text{even}}) + f(b)\right]",
                    steps=to_step_models(s2),
                    finalResultLatex=f"{val_s:.6f}",
                    prosAndCons=MethodProsCons(
                        pros="Rapid O(h^4) convergence with high numerical precision.",
                        cons="Requires an even number of sub-intervals."
                    )
                ))
            except Exception as e:
                print(f"Error in simpson method: {e}")

            try:
                val_t, s3 = integral.integrate_numerical(node, 0, 1, 6, "trapezoid")
                methods.append(MethodSolutionModel(
                    methodId="integral-trapezoid",
                    methodName="Method 3: Trapezoidal Numerical Quadrature",
                    badgeTag="Linear Segment Numerical",
                    techniqueSummary="Approximates the integral area using trapezoidal segments across the interval.",
                    formulaLatex=r"\int_a^b f(x)\,dx \approx \frac{h}{2}\left[f(a) + 2\sum_{i=1}^{n-1} f(x_i) + f(b)\right]",
                    steps=to_step_models(s3),
                    finalResultLatex=f"{val_t:.6f}",
                    prosAndCons=MethodProsCons(
                        pros="Simple intuitive geometric area calculation.",
                        cons="Second-order O(h^2) precision."
                    )
                ))
            except Exception as e:
                print(f"Error in trapezoid method: {e}")

            try:
                val_m, s4 = integral.integrate_numerical(node, 0, 1, 6, "midpoint")
                methods.append(MethodSolutionModel(
                    methodId="integral-midpoint",
                    methodName="Method 4: Midpoint Rule Quadrature",
                    badgeTag="Sub-interval Midpoint",
                    techniqueSummary="Evaluates the function strictly at the center points of each subdivision.",
                    formulaLatex=r"\int_a^b f(x)\,dx \approx h \sum_{i=1}^n f\left(\frac{x_{i-1} + x_i}{2}\right)",
                    steps=to_step_models(s4),
                    finalResultLatex=f"{val_m:.6f}",
                    prosAndCons=MethodProsCons(
                        pros="Avoids evaluating endpoints if singularities exist.",
                        cons="Requires calculating interior midpoints."
                    )
                ))
            except Exception as e:
                print(f"Error in midpoint method: {e}")
        except Exception as e:
            print(f"Error in integral multi-methods: {e}")

    # 3. CALCULUS DERIVATIVES
    elif input_str.lower().startswith('derive'):
        expr_content = re.search(r'derive\((.*)\)', input_str, re.I)
        expr_str = expr_content.group(1) if expr_content else input_str[6:].strip(' ()')
        try:
            node = parse_expr(expr_str)
            res_node, s1 = derivative.derive(node)
            d_ans = to_string(res_node)
            methods.append(MethodSolutionModel(
                methodId="derive-rules",
                methodName="Method 1: Differentiation Rules Engine",
                badgeTag="Symbolic Rules",
                techniqueSummary="Applies power rule, product rule, quotient rule, and chain rule sequentially.",
                formulaLatex=r"\frac{d}{dx}[u \cdot v] = u'v + uv', \quad \frac{d}{dx}[f(g(x))] = f'(g(x))g'(x)",
                steps=to_step_models(s1),
                finalResultLatex=d_ans,
                prosAndCons=MethodProsCons(
                    pros="Fast, exact closed-form algebraic derivation.",
                    cons="Can produce unsimplified intermediate expressions."
                )
            ))

            diff_steps = [
                StepModel(stepTitle="Step 1: Formulate difference quotient", description=f"Substitute f(x) = {expr_str} into formal definition of derivative.", latex=r"f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}"),
                StepModel(stepTitle="Step 2: Expand f(x + h)", description="Expand terms and simplify the numerator.", latex=rf"\frac{{{expr_str.replace('x', '(x+h)')} - ({expr_str})}}{{h}}"),
                StepModel(stepTitle="Step 3: Cancel infinitesimal h and evaluate limit", description="Divide out h from all terms and evaluate as h approaches 0.", latex=rf"f'(x) = {d_ans}")
            ]
            methods.append(MethodSolutionModel(
                methodId="derive-limit-definition",
                methodName="Method 2: Definition of Derivative (First Principles Limit)",
                badgeTag="Theoretical Definition",
                techniqueSummary="Calculates the instantaneous rate of change via the foundational limit definition of calculus.",
                formulaLatex=r"f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}",
                steps=diff_steps,
                finalResultLatex=d_ans,
                prosAndCons=MethodProsCons(
                    pros="Provides foundational theoretical proof of why the derivative exists.",
                    cons="Algebraically tedious for complex transcendental equations."
                )
            ))
        except Exception as e:
            print(f"Error in derivative multi-methods: {e}")

    # 4. STATISTICS
    elif input_str.lower().startswith(('mean', 'median')):
        try:
            data_content = re.search(r'\((.*)\)', input_str)
            data_str = data_content.group(1) if data_content else input_str[5:].strip(' ()')
            s_mean = statistics.mean(data_str)
            methods.append(MethodSolutionModel(
                methodId="stats-direct-mean",
                methodName="Method 1: Direct Arithmetic Mean Formula",
                badgeTag="Arithmetic Average",
                techniqueSummary="Sums all sample points and divides by sample size N.",
                formulaLatex=r"\bar{x} = \frac{1}{N}\sum_{i=1}^N x_i",
                steps=to_step_models(s_mean),
                finalResultLatex=final_solution or (s_mean[-1].latex if s_mean else ""),
                prosAndCons=MethodProsCons(
                    pros="Standard measure of central tendency.",
                    cons="Sensitive to extreme outlier values."
                )
            ))
            s_med = statistics.median(data_str)
            methods.append(MethodSolutionModel(
                methodId="stats-median",
                methodName="Method 2: Ordered Rank Median Resolution",
                badgeTag="Positional Average",
                techniqueSummary="Sorts dataset in ascending order and identifies the center element.",
                formulaLatex=r"\tilde{x} = x_{\left(\frac{N+1}{2}\right)}",
                steps=to_step_models(s_med),
                finalResultLatex=s_med[-1].latex if s_med else "",
                prosAndCons=MethodProsCons(
                    pros="Resistant and robust against extreme outliers.",
                    cons="Ignores specific numerical magnitude of non-median values."
                )
            ))
        except Exception as e:
            print(f"Error in stats multi-methods: {e}")

    # 5. LINEAR ALGEBRA & MATRICES
    elif '[' in input_str:
        try:
            matrices = re.findall(r'\[\[.*?\]\]|\[.*?\]', input_str)
            if matrices:
                parsed_matrices = [ast.literal_eval(m) for m in matrices]
                # Check if it's a 2D matrix (list of lists)
                if parsed_matrices and isinstance(parsed_matrices[0], list) and len(parsed_matrices[0]) > 0 and isinstance(parsed_matrices[0][0], list):
                    matrix = parsed_matrices[0]
                    # Check if augmented system [A | b] where cols == rows + 1
                    if len(matrix[0]) == len(matrix) + 1:
                        A = [row[:-1] for row in matrix]
                        b = [row[-1] for row in matrix]
                        try:
                            x_rref, s_rref = solvers.solve_linear_system(A, b)
                            sol_rref = ", ".join([f"x_{idx+1} = {val:.4g}" for idx, val in enumerate(x_rref)])
                            methods.append(MethodSolutionModel(
                                methodId="linear-rref",
                                methodName="Method 1: Gaussian Elimination (RREF)",
                                badgeTag="Row Reduction Standard",
                                techniqueSummary="Transforms augmented matrix [A | b] into reduced row echelon form [I | x*].",
                                formulaLatex=r"[A \mid b] \xrightarrow{\text{Row Operations}} [I \mid x^*]",
                                steps=to_step_models(s_rref),
                                finalResultLatex=sol_rref,
                                prosAndCons=MethodProsCons(
                                    pros="Most numerically stable and computationally efficient method for systems of any size.",
                                    cons="Requires manual step-by-step arithmetic row manipulations."
                                )
                            ))
                        except Exception as e:
                            print(f"Error in rref method: {e}")
                        try:
                            x_cramer, s_cramer = solvers.cremer(A, b)
                            sol_cramer = ", ".join([f"x_{idx+1} = {val:.4g}" for idx, val in enumerate(x_cramer)])
                            methods.append(MethodSolutionModel(
                                methodId="linear-cramer",
                                methodName="Method 2: Cramer's Rule (Determinant Ratio)",
                                badgeTag="Exact Determinant Ratio",
                                techniqueSummary="Computes each variable individually as the ratio of modified column determinant to main matrix determinant.",
                                formulaLatex=r"x_i = \frac{\det(A_i)}{\det(A)}",
                                steps=to_step_models(s_cramer),
                                finalResultLatex=sol_cramer,
                                prosAndCons=MethodProsCons(
                                    pros="Provides closed-form explicit formulas for individual unknown variables.",
                                    cons="Requires det(A) != 0."
                                )
                            ))
                        except Exception as e:
                            print(f"Error in cramer method: {e}")
                    elif len(matrix[0]) == len(matrix):
                        # Square matrix
                        try:
                            val_det, s_det = solvers.determinant(matrix)
                            methods.append(MethodSolutionModel(
                                methodId="matrix-det",
                                methodName="Method 1: Laplace / Row-Reduction Determinant",
                                badgeTag="Determinant Engine",
                                techniqueSummary="Computes matrix scalar determinant via row reduction.",
                                formulaLatex=r"\det(A) = |A|",
                                steps=to_step_models(s_det),
                                finalResultLatex=f"\\det(A) = {val_det:.4g}",
                                prosAndCons=MethodProsCons(
                                    pros="Evaluates matrix singularity and volume scaling factor.",
                                    cons="Requires square n x n matrix."
                                )
                            ))
                        except Exception as e:
                            print(f"Error in det method: {e}")
                        try:
                            val_rref, s_rref = solvers.reduced_row_echelon(matrix)
                            methods.append(MethodSolutionModel(
                                methodId="matrix-rref",
                                methodName="Method 2: Reduced Row Echelon Form (RREF)",
                                badgeTag="Echelon Form",
                                techniqueSummary="Reduces matrix into canonical row echelon form.",
                                formulaLatex=r"A \xrightarrow{\text{RREF}} R",
                                steps=to_step_models(s_rref),
                                finalResultLatex=solvers.matrix_to_latex(val_rref),
                                prosAndCons=MethodProsCons(
                                    pros="Shows matrix rank, nullspace, and linear dependencies directly.",
                                    cons="Requires extensive row pivots."
                                )
                            ))
                        except Exception as e:
                            print(f"Error in rref single method: {e}")
        except Exception as e:
            print(f"Error in matrix multi-methods: {e}")
        except Exception as e:
            print(f"Error in stats multi-methods: {e}")

    if not methods and primary_steps:
        fallback_steps = to_step_models(primary_steps)
        methods.append(MethodSolutionModel(
            methodId="default-direct",
            methodName=f"Method 1: {equation_type} Analytical Resolution",
            badgeTag="Primary Engine",
            techniqueSummary=f"Computed resolution using {equation_type} engine.",
            formulaLatex=input_str,
            steps=fallback_steps,
            finalResultLatex=final_solution or "",
            prosAndCons=MethodProsCons(
                pros="Direct automated resolution with complete step-by-step derivations.",
                cons="Single approach generated by solver engine."
            )
        ))

    return methods

def node_to_dict(node):
    if node is None: return None
    if not isinstance(node, Node): return None
    d = {"type": node.__class__.__name__}
    if isinstance(node, Const): d["value"] = node.value
    if isinstance(node, Var): d["name"] = node.name
    if hasattr(node, "left"): d["left"] = node_to_dict(node.left)
    if hasattr(node, "right"): d["right"] = node_to_dict(node.right)
    if hasattr(node, "base"): d["base"] = node_to_dict(node.base)
    if hasattr(node, "exp"): d["exp"] = node.exp
    if hasattr(node, "inner"): d["inner"] = node_to_dict(node.inner)
    return d

def parse_expr(expr_str: str):
    # Strip y = or f(x) = prefix
    expr_str = re.sub(r'^(y|f\(x\))\s*=\s*', '', expr_str.strip(), flags=re.IGNORECASE)
    
    # Convert implicit multiplication: 2(x+1) -> 2*(x+1), x(x+1) -> x*(x+1), (x+1)(x-2) -> (x+1)*(x-2)
    expr_str = expr_str.replace(')(', ')*(')
    expr_str = re.sub(r'(\d)\(', r'\1*(', expr_str)
    expr_str = re.sub(r'\bx\(', r'x*(', expr_str)
    
    # Convert function syntax without parentheses: sin x -> sin(x), cos x -> cos(x), ln x -> ln(x), exp x -> exp(x)
    for func in ['sin', 'cos', 'ln', 'exp']:
        expr_str = re.sub(rf'\b{func}\s+([a-zA-Z0-9_]+)', rf'{func}(\1)', expr_str, flags=re.IGNORECASE)
        
    expr_str = expr_str.replace('^', '**')
    # Handle some common math notation differences
    expr_str = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', expr_str) # 3x -> 3*x
    
    tree = ast.parse(expr_str, mode='eval')
    
    def transform(node):
        if isinstance(node, ast.Expression):
            return transform(node.body)
        if isinstance(node, ast.BinOp):
            left = transform(node.left)
            right = transform(node.right)
            if isinstance(node.op, ast.Add):
                return Add(left, right)
            if isinstance(node.op, ast.Sub):
                return Add(left, Mul(Const(-1.0), right))
            if isinstance(node.op, ast.Mult):
                return Mul(left, right)
            if isinstance(node.op, ast.Div):
                return Mul(left, Pow(right, -1))
            if isinstance(node.op, ast.Pow):
                if isinstance(right, Const):
                    return Pow(left, int(right.value))
                raise ValueError("Exponent must be constant")
        if isinstance(node, (ast.Num, ast.Constant)):
            val = node.n if hasattr(node, 'n') else node.value
            return Const(float(val))
        if isinstance(node, ast.Name):
            if node.id == 'x':
                return Var('x')
            raise ValueError(f"Unknown variable: {node.id}")
        if isinstance(node, ast.Call):
            func = node.func.id.lower()
            arg = transform(node.args[0])
            if func == 'sin': return Sin(arg)
            if func == 'cos': return Cos(arg)
            if func == 'exp': return Exp(arg)
            if func == 'ln': return Ln(arg)
        if isinstance(node, ast.UnaryOp):
            if isinstance(node.op, ast.USub):
                return Mul(Const(-1.0), transform(node.operand))
        raise ValueError(f"Unsupported node type: {type(node)}")

    return transform(tree)

def solve_algebra(input_str: str, allow_complex: bool = True):
    import sympy as sp
    from math_models import MathStep
    
    # Strip y = or f(x) =
    input_str = re.sub(r'^(y|f\(x\))\s*=\s*', '', input_str.strip(), flags=re.IGNORECASE)
    
    # Replace ^ with **
    input_str = input_str.replace('^', '**')
    # Handle implicit multiplication
    input_str = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', input_str)
    
    if '=' in input_str:
        lhs_str, rhs_str = input_str.split('=', 1)
    else:
        lhs_str, rhs_str = input_str, '0'
        
    lhs = sp.sympify(lhs_str)
    rhs = sp.sympify(rhs_str)
    eq = lhs - rhs
    
    # Detect the symbol used in equation
    symbols = list(eq.free_symbols)
    x = symbols[0] if symbols else sp.Symbol('x')
    
    steps = []
    
    steps.append(MathStep(
        description="Write down the equation",
        latex=f"{sp.latex(lhs)} = {sp.latex(rhs)}",
        type="equation"
    ))
    
    simplified_eq = sp.simplify(eq)
    steps.append(MathStep(
        description="Subtract right-hand side from both sides to set the equation to 0",
        latex=f"{sp.latex(simplified_eq)} = 0",
        type="equation"
    ))
    
    all_solutions = sp.solve(eq, x)
    if allow_complex:
        solutions = all_solutions
    else:
        solutions = [sol for sol in all_solutions if getattr(sol, 'is_real', True) is not False and not sol.has(sp.I)]
    
    if not solutions:
        final_answer = "No real solutions" if not allow_complex else "No solutions"
        steps.append(MathStep(
            description="Solving the equation",
            latex=rf"\text{{{final_answer}}}",
            type="equation"
        ))
    else:
        try:
            poly = sp.Poly(simplified_eq, x)
            degree = poly.degree()
        except Exception:
            degree = None
            
        if degree == 1:
            a = poly.all_coeffs()[0]
            b = poly.all_coeffs()[1]
            steps.append(MathStep(
                description=f"Isolate the variable {x}",
                latex=f"{sp.latex(a * x)} = {sp.latex(-b)}",
                type="equation"
            ))
            steps.append(MathStep(
                description=f"Divide both sides by the coefficient of {x}",
                latex=f"{x} = {sp.latex(-b / a)}",
                type="equation"
            ))
        elif degree == 2:
            coeffs = poly.all_coeffs()
            a = coeffs[0]
            b = coeffs[1]
            c = coeffs[2]
            
            discriminant = b**2 - 4*a*c
            steps.append(MathStep(
                description=f"Identify coefficients of the quadratic form a{x}^2 + b{x} + c = 0",
                latex=f"a = {sp.latex(a)}, \\quad b = {sp.latex(b)}, \\quad c = {sp.latex(c)}",
                type="equation"
            ))
            steps.append(MathStep(
                description="Calculate the discriminant: D = b^2 - 4ac",
                latex=rf"D = {sp.latex(b)}^2 - 4 \cdot {sp.latex(a)} \cdot {sp.latex(c)} = {sp.latex(discriminant)}",
                type="equation"
            ))
            
            is_disc_negative = False
            try:
                if discriminant.is_number and discriminant < 0:
                    is_disc_negative = True
            except Exception:
                pass

            if is_disc_negative:
                if allow_complex:
                    steps.append(MathStep(
                        description="Since discriminant D < 0, solutions are complex conjugate numbers involving imaginary unit i = \\sqrt{-1}",
                        latex=rf"D < 0 \implies \sqrt{{D}} = \sqrt{{{sp.latex(discriminant)}}} = {sp.latex(sp.sqrt(discriminant))}",
                        type="equation"
                    ))
                    steps.append(MathStep(
                        description="Apply the quadratic formula to calculate complex roots",
                        latex=rf"{x} = \frac{{-{sp.latex(b)} \pm {sp.latex(sp.sqrt(discriminant))}}}{{2 \cdot {sp.latex(a)}}}",
                        type="equation"
                    ))
                else:
                    steps.append(MathStep(
                        description="The discriminant is negative (D < 0), so there are no real solutions",
                        latex=r"\text{No real solutions } (D < 0)",
                        type="equation"
                    ))
                    return "No real solutions", steps
            else:
                steps.append(MathStep(
                    description="Apply the quadratic formula",
                    latex=rf"{x} = \frac{{-{sp.latex(b)} \pm \sqrt{{{sp.latex(discriminant)}}}}}{{2 \cdot {sp.latex(a)}}}",
                    type="equation"
                ))
            
        sol_latex = ", ".join([f"{x} = {sp.latex(sol)}" for sol in solutions])
        has_complex = any(sol.has(sp.I) for sol in solutions)
        desc = f"Find the final complex solutions of {x}" if has_complex else f"Find the final values of {x}"
        steps.append(MathStep(
            description=desc,
            latex=sol_latex,
            type="equation"
        ))
        final_answer = sol_latex
        
    return final_answer, steps


@app.post("/api/render")
async def render_video(request: SolveRequest, authorization: Optional[str] = Header(None)):
    def run_manim(cmd,env):
        subprocess.run(cmd,env=env,cwd=BASE_DIR,capture_output=True,text=True,check=True)

    input_str = request.equation.strip()
    quality = request.quality or "medium"
    
    # Tier limits enforcement
    user = None
    if authorization:
        user = get_user_by_token(authorization)
    
    is_premium = bool(user["is_premium"]) if user else False
    if not is_premium and quality in ["medium", "high"]:
        raise HTTPException(
            status_code=403,
            detail="High and Medium quality video exports are Pro-only features. Please upgrade to Pro to unlock."
        )
    
    op = "derivative"
    expr = input_str
    
    if input_str.lower().startswith('integrate'):
        op = "integral"
        expr_content = re.search(r'integrate\((.*)\)', input_str, re.I)
        if not expr_content:
            expr_content = input_str[9:].strip(' ()')
        else:
            expr_content = expr_content.group(1)
        expr = expr_content
    elif input_str.lower().startswith('derive'):
        op = "derivative"
        expr_content = re.search(r'derive\((.*)\)', input_str, re.I)
        if not expr_content:
            expr_content = input_str[6:].strip(' ()')
        else:
            expr_content = expr_content.group(1)
        expr = expr_content
    elif input_str.lower().startswith('mean') or input_str.lower().startswith('median'):
        op = "statistics"
        expr = input_str
    elif input_str.lower().startswith('translate') or input_str.lower().startswith('rotate') or input_str.lower().startswith('scale'):
        op = "geometry"
        expr = input_str
    elif 'eigen' in input_str.lower() or 'char' in input_str.lower() or 'det' in input_str.lower() or '[' in input_str:
        op = "matrix"
        expr = input_str
    elif '=' in input_str:
        op = "algebra"
        expr = input_str


    # Map quality setting to manim flag and output directory
    quality_flag = "-qm"
    quality_dir = "720p30"
    if quality == "low":
        quality_flag = "-ql"
        quality_dir = "480p15"
    elif quality == "high":
        quality_flag = "-qh"
        quality_dir = "1080p60"

    # Run Manim
    env = os.environ.copy()
    env["MATH_EXPR"] = expr
    env["MATH_OP"] = op
    env["MATH_METHOD_ID"] = request.method_id or ""
    env["MATH_METHOD_NAME"] = request.method_name or ""
    env["PYTHONPATH"] = f"{BASE_DIR};{os.path.join(BASE_DIR, 'engine')}"
    
    video_id = str(uuid.uuid4())
    try:
        video_script = os.path.join(BASE_DIR, "video.py")
        cmd = ["python", "-m", "manim", quality_flag, "-o", f"{video_id}.mp4", "--disable_caching", "--media_dir", MEDIA_DIR, video_script, "UniversalMathAnimation"]
        await asyncio.to_thread(run_manim, cmd, env)        
        expected_file = os.path.join(MEDIA_DIR, "videos", "video", quality_dir, f"{video_id}.mp4")
        default_file = os.path.join(MEDIA_DIR, "videos", "video", quality_dir, "UniversalMathAnimation.mp4")
        if not os.path.exists(expected_file) and os.path.exists(default_file):
            os.rename(default_file, expected_file)
            
        web_path = f"/api/media/videos/video/{quality_dir}/{video_id}.mp4"
        return {"video_url": web_path}
    except subprocess.CalledProcessError as e:
        print(f"Manim error: {e.stderr}")
        raise HTTPException(status_code=500, detail=f"Rendering failed: {e.stderr}")

@app.post("/api/solve", response_model=EquationSolution)
async def solve_api(request: SolveRequest, authorization: Optional[str] = Header(None)):
    input_str = normalize_matrix_latex(request.equation.strip())
    equation_type = "Algebra"
    
    # Tier limits enforcement
    user = None
    if authorization:
        user = get_user_by_token(authorization)
        
    if user:
        is_premium = bool(user["is_premium"])
        user_identifier = user["id"]
    else:
        is_premium = False
        user_identifier = "anonymous"
        
    if not is_premium:
        current_count = solve_counts.get(user_identifier, 0)
        if current_count >= 3:
            raise HTTPException(
                status_code=403, 
                detail="You have reached the limit of 3 free solves. Please sign up or upgrade to Pro for unlimited math solutions."
            )
        solve_counts[user_identifier] = current_count + 1
    
    try:
        # Determine whether complex solutions are allowed (defaults to True)
        allow_complex = request.show_complex if request.show_complex is not None else (request.allow_complex if request.allow_complex is not None else True)

        # Determine operation
        if '=' in input_str and not input_str.lower().startswith('integrate') and not input_str.lower().startswith('derive') and not '[' in input_str:
            equation_type = "Algebra"
            solution, steps = solve_algebra(input_str, allow_complex=allow_complex)
        elif input_str.lower().startswith('integrate'):
            equation_type = "Calculus"
            expr_content = re.search(r'integrate\((.*)\)', input_str, re.I)
            if not expr_content:
                expr_content = input_str[9:].strip(' ()')
            else:
                expr_content = expr_content.group(1)
            
            # Check for definite integral format: expr, a, b [, method]
            parts = [p.strip() for p in expr_content.split(',')]
            if len(parts) >= 3:
                expr_str, a_str, b_str = parts[0], parts[1], parts[2]
                method_str = parts[3] if len(parts) >= 4 else "simpson"
                try:
                    a_val = float(a_str)
                    b_val = float(b_str)
                    node = parse_expr(expr_str)
                    num_val, steps = integral.integrate_numerical(node, a_val, b_val, n=100, method=method_str)
                    solution = f"{num_val:.6f}"
                except Exception:
                    node = parse_expr(expr_content)
                    result_node, steps = integral.integrate_node(node)
                    solution = to_string(result_node) + " + C"
            else:
                node = parse_expr(expr_content)
                result_node, steps = integral.integrate_node(node)
                solution = to_string(result_node) + " + C"
            
        elif input_str.lower().startswith('derive'):
            equation_type = "Calculus"
            expr_content = re.search(r'derive\((.*)\)', input_str, re.I)
            if not expr_content:
                expr_content = input_str[6:].strip(' ()')
            else:
                expr_content = expr_content.group(1)
            
            node = parse_expr(expr_content)
            result_node, steps = derivative.derive(node)
            solution = to_string(result_node)
            
        elif input_str.lower().startswith('mean'):
            equation_type = "Statistics"
            data_content = re.search(r'mean\((.*)\)', input_str, re.I)
            data_str = data_content.group(1) if data_content else input_str[5:].strip(' ()')
            steps = statistics.mean(data_str)
            solution = steps[-1].latex if steps else "N/A"
            
        elif input_str.lower().startswith('median'):
            equation_type = "Statistics"
            data_content = re.search(r'median\((.*)\)', input_str, re.I)
            data_str = data_content.group(1) if data_content else input_str[7:].strip(' ()')
            steps = statistics.median(data_str)
            solution = steps[-1].latex if steps else "N/A"
            
        elif input_str.lower().startswith('translate'):
            equation_type = "Geometry"
            match = re.search(r'translate\((.*),\s*(.*),\s*(.*)\)', input_str, re.I)
            if match:
                shape, dx, dy = match.groups()
                steps = geometry.translate(shape, float(dx), float(dy))
                solution = f"Translated {shape}"
            else: raise ValueError("Usage: translate(shape, dx, dy)")

        elif input_str.lower().startswith('rotate'):
            equation_type = "Geometry"
            match = re.search(r'rotate\((.*),\s*(.*)\)', input_str, re.I)
            if match:
                shape, angle = match.groups()
                steps = geometry.rotate(shape, float(angle))
                solution = f"Rotated {shape}"
            else: raise ValueError("Usage: rotate(shape, angle)")

        elif input_str.lower().startswith('scale'):
            equation_type = "Geometry"
            match = re.search(r'scale\((.*),\s*(.*)\)', input_str, re.I)
            if match:
                shape, factor = match.groups()
                steps = geometry.scale(shape, float(factor))
                solution = f"Scaled {shape}"
            else: raise ValueError("Usage: scale(shape, factor)")

        elif 'eigen' in input_str.lower() or 'char' in input_str.lower():
            equation_type = "Linear Algebra"
            matrix_match = re.search(r'\[.*\]', input_str)
            if not matrix_match:
                raise ValueError("No matrix found in input")
            matrix = ast.literal_eval(matrix_match.group(0))
            equation, steps = eigen.eigenvalue(matrix)
            solution = to_string(equation)
            
        elif 'det' in input_str.lower() or 'inv' in input_str.lower() or 'cramer' in input_str.lower() or 'cremer' in input_str.lower() or 'solve' in input_str.lower() or '[' in input_str:
            equation_type = "Linear Algebra"
            matrices = re.findall(r'\[\[.*?\]\]|\[.*?\]', input_str)
            if not matrices:
                raise ValueError("No matrix found in input. Example format: [[2, 3, 8], [1, -1, -1]]")
            
            parsed_matrices = [ast.literal_eval(m) for m in matrices]
            
            lower_str = input_str.lower()
            if 'cramer' in lower_str or 'cremer' in lower_str:
                if len(parsed_matrices) >= 2:
                    A, b = parsed_matrices[0], parsed_matrices[1]
                else:
                    matrix = parsed_matrices[0]
                    A = [row[:-1] for row in matrix]
                    b = [row[-1] for row in matrix]
                x_sol, m_steps = solvers.cremer(A, b)
                sol_str = ", ".join([f"x_{idx+1} = {val:.4g}" for idx, val in enumerate(x_sol)])
                solution = sol_str
                steps = m_steps
            elif 'inv' in lower_str:
                matrix = parsed_matrices[0]
                inv_mat, m_steps = solvers.inverse(matrix)
                solution = solvers.matrix_to_latex(inv_mat)
                steps = m_steps
            elif 'det' in lower_str:
                matrix = parsed_matrices[0]
                val, m_steps = solvers.determinant(matrix)
                solution = f"det(A) = {val:.4g}"
                steps = m_steps
            elif 'solve' in lower_str and len(parsed_matrices) >= 2:
                A, b = parsed_matrices[0], parsed_matrices[1]
                x_sol, m_steps = solvers.solve_linear_system(A, b)
                sol_str = ", ".join([f"x_{idx+1} = {val:.4g}" for idx, val in enumerate(x_sol)])
                solution = sol_str
                steps = m_steps
            else:
                matrix = parsed_matrices[0]
                val, m_steps = solvers.reduced_row_echelon(matrix)
                # If augmented matrix (cols == rows + 1), format solution nicely
                if len(matrix) > 0 and len(matrix[0]) == len(matrix) + 1:
                    sol_vals = [val[r][-1] for r in range(len(matrix))]
                    sol_str = ", ".join([f"x_{idx+1} = {val_v:.4g}" for idx, val_v in enumerate(sol_vals)])
                    solution = sol_str
                else:
                    solution = "RREF complete"
                steps = m_steps
        else:
            equation_type = "Calculus"
            node = parse_expr(input_str)
            result_node, steps = derivative.derive(node)
            solution = to_string(result_node)

        # Map steps to response format
        response_scenes = []
        for idx, s in enumerate(steps):
            math_val = ""
            if hasattr(s, 'latex'):
                math_val = s.latex
            elif hasattr(s, 'data') and isinstance(s.data, dict) and 'matrix' in s.data:
                math_val = solvers.matrix_to_latex(s.data['matrix'])
            
            # Extract function for graph if possible
            graph_data = GraphData(showGraph=False)
            annotations = []

            if equation_type == "Calculus" and hasattr(s, 'data') and isinstance(s.data, Node):
                # By default, show the sub-expression being derived
                node_to_plot = s.data
                label = f"step_{idx}"
                
                # For the final step, we want to graph the final solution, not the input sub-expression
                if idx == len(steps) - 1 and 'result_node' in locals() and result_node is not None:
                    node_to_plot = result_node
                    label = "Solution"

                graph_data = GraphData(
                    showGraph=True,
                    functionExpr=to_string(node_to_plot).replace('**', '^'),
                    functionLabel=label
                )
            
            if equation_type == "Geometry" and hasattr(s, 'data') and isinstance(s.data, dict) and 'shapes' in s.data:
                graph_data = GraphData(showGraph=False, viewPort={"minX": -5, "maxX": 5, "minY": -5, "maxY": 5})
                for shape in s.data['shapes']:
                    if shape['type'] == 'circle':
                        annotations.append(SceneAnnotation(
                            type='circle',
                            label=shape.get('color', 'BLUE'),
                            coordinates=[shape['center'][0], shape['center'][1]]
                        ))
                    elif shape['type'] == 'polygon':
                        # Flatten points for coordinates
                        coords = []
                        for p in shape['points']:
                            coords.extend([p[0], p[1]])
                        annotations.append(SceneAnnotation(
                            type='polygon',
                            label=shape.get('color', 'BLUE'),
                            coordinates=coords
                        ))

            response_scenes.append(VideoScene(
                sceneNumber=idx + 1,
                title=f"Step {idx + 1}",
                subTitle=equation_type,
                explanation=s.description,
                primaryMath=math_val,
                secondaryMath="",
                graphData=graph_data,
                annotations=annotations
            ))

        multi_methods = generate_multi_methods(
            input_str=input_str,
            equation_type=equation_type,
            allow_complex=allow_complex,
            final_solution=solution,
            primary_steps=steps
        )

        return EquationSolution(
            equation=input_str,
            equationType=equation_type,
            summary="Mathematical solution generated by Axiom Engine.",
            finalAnswer=solution,
            scenes=response_scenes,
            methods=multi_methods
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/status")
def read_root():
    return {"status": "active", "engine": "Axiom v4.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4000)
