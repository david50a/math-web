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
    import derivative
    import integral
    import linear_algebra_solver as solvers
    import stats_engine as statistics
    import geometry
    import eigenvalues_and_eigenvector as eigen
    from math_models import Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln, to_string, to_latex, simplify, Node
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
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token required to view media")
        
    user = get_user_by_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session token")
        
    full_path = os.path.join(MEDIA_DIR, file_path)
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

class EquationSolution(BaseModel):
    equation: str
    equationType: str
    summary: str
    finalAnswer: str
    scenes: List[VideoScene]
    demoMode: bool = False
    needsKey: bool = False

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

def solve_algebra(input_str: str):
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
    
    solutions = sp.solve(eq, x)
    
    if not solutions:
        final_answer = "No solutions"
        steps.append(MathStep(
            description="Solving the equation",
            latex=r"\text{No solutions found}",
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
            steps.append(MathStep(
                description="Apply the quadratic formula",
                latex=rf"{x} = \frac{{-{sp.latex(b)} \pm \sqrt{{{sp.latex(discriminant)}}}}}{{2 \cdot {sp.latex(a)}}}",
                type="equation"
            ))
            
        sol_latex = ", ".join([f"{x} = {sp.latex(sol)}" for sol in solutions])
        steps.append(MathStep(
            description=f"Find the final values of {x}",
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
    input_str = request.equation.strip()
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
        # Determine operation
        if '=' in input_str and not input_str.lower().startswith('integrate') and not input_str.lower().startswith('derive') and not '[' in input_str:
            equation_type = "Algebra"
            solution, steps = solve_algebra(input_str)
        elif input_str.lower().startswith('integrate'):

            equation_type = "Calculus"
            expr_content = re.search(r'integrate\((.*)\)', input_str, re.I)
            if not expr_content:
                expr_content = input_str[9:].strip(' ()')
            else:
                expr_content = expr_content.group(1)
            
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
            
        elif 'det' in input_str.lower() or '[' in input_str:
            equation_type = "Linear Algebra"
            matrix_match = re.search(r'\[.*\]', input_str)
            if not matrix_match:
                raise ValueError("No matrix found in input")
            
            matrix = ast.literal_eval(matrix_match.group(0))
            if 'det' in input_str.lower():
                val, m_steps = solvers.determinant(matrix)
                solution = str(val)
                steps = m_steps
            else:
                val, m_steps = solvers.reduced_row_echelon(matrix)
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

        return EquationSolution(
            equation=input_str,
            equationType=equation_type,
            summary="Mathematical solution generated by Axiom Engine.",
            finalAnswer=solution,
            scenes=response_scenes
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
