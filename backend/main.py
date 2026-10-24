from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Any, Optional, Dict, Tuple
import sys
import os
import ast
import re
import json
import subprocess
import hashlib
import uuid
import db
from db import repository
import asyncio
import httpx
import base64
import requests
from PIL import Image
from io import BytesIO
import pytesseract
import time
import secrets
from openai import OpenAI
import dotenv

import security
from security import (
    limiter,
    get_client_ip,
    validate_email_format,
    validate_password_strength,
    sanitize_input_text,
    sanitize_base64_image,
    verify_media_path,
    sanitize_env_for_manim,
    log_security_event,
    get_security_telemetry,
    constant_time_verify,
    SESSION_EXPIRY_SECONDS,
    detect_prompt_injection,
    sanitize_ai_api_key,
    mask_api_key,
    check_ai_rate_limit,
    validate_and_sanitize_ai_messages,
    sanitize_ai_response,
    is_query_on_subject,
    record_off_topic_blocked,
    AI_MAX_MESSAGE_CHARS,
    AI_MAX_CONTEXT_CHARS,
    AI_RATE_LIMIT_WINDOW,
)

# Load environment variables (.env)
dotenv.load_dotenv()

# Add engine to path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR, "engine"))
dotenv.load_dotenv(os.path.join(BASE_DIR, ".env"))

try:
    import algebra
    import derivative
    import integral
    import linear_algebra_solver as solvers
    import stats_engine as statistics
    import geometry
    import trigonometry
    import trigoemetry
    import eigenvalues_and_eigenvector as eigen
    import function_analyzer
    import proof_engine
    from math_models import Const, Var, Add, Mul, Pow, Sin, Cos, Exp, Ln, to_string, to_latex, simplify, Node, MathStep, parse_expr
except ImportError as e:
    print(f"Import error: {e}")


app = FastAPI()

# Secure Media Directory
MEDIA_DIR = os.path.join(BASE_DIR, "media")
if not os.path.exists(MEDIA_DIR):
    os.makedirs(MEDIA_DIR)
# app.mount removed to prevent public static file access

# Secure CORS origins
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
]
if os.environ.get("ALLOWED_ORIGINS"):
    ALLOWED_ORIGINS.extend([origin.strip() for origin in os.environ.get("ALLOWED_ORIGINS").split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Initialization
db.init_db()

# Password Hashing Helpers
def hash_password(password: str, salt: bytes = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    else:
        salt = bytes.fromhex(salt)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ":" + key.hex()

def verify_password(stored_password: str, provided_password: str) -> bool:
    return constant_time_verify(stored_password, provided_password)

def get_user_by_token(token: str):
    if not token:
        return None
    clean_token = token.replace("Bearer ", "").strip()
    if not clean_token:
        return None
    token_hash = hashlib.sha256(clean_token.encode('utf-8')).hexdigest()
    
    with db.get_db_context() as session:
        user = repository.get_user_by_token_hash(session, token_hash)
        if not user:
            return None
        
        # Check session expiration
        now = time.time()
        expires_at = user.session_expires_at or 0.0
        if expires_at and expires_at < now:
            repository.revoke_session(session, token_hash)
            return None
            
        return user

# Solve counts in-memory for limiting free tier
solve_counts = {}

# Pydantic Schemas for Auth/Payment & Database
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

class QuestionRequest(BaseModel):
    messages: list
    token: str
    context: Optional[str] = None

class UpgradeRequest(BaseModel):
    token: str

class HistoryItemCreate(BaseModel):
    equation: str
    problem_type: Optional[str] = "general"
    result_latex: Optional[str] = None
    steps: Optional[Any] = None

class NotebookCreate(BaseModel):
    title: Optional[str] = "Untitled Notebook"
    content: Optional[str] = ""
    tags: Optional[str] = ""
    is_pinned: Optional[bool] = False

class NotebookUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None
    is_pinned: Optional[bool] = None

class FormulaCreate(BaseModel):
    name: str
    latex: str
    category: Optional[str] = "general"
    expression: Optional[str] = ""
    description: Optional[str] = ""
    variables: Optional[str] = ""
    is_favorite: Optional[bool] = False

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "Math Discussion"
    subject: Optional[str] = "General"

class ChatMessageCreate(BaseModel):
    role: str
    content: str
    latex: Optional[str] = ""

@app.get('/')
async def root():
    return 'Hello World'

# Auth & Payment Routes with Security Hardening & Database Repository
@app.post("/api/auth/signup", response_model=UserResponse)
async def auth_signup(req: UserSignUp, raw_req: Request):
    client_ip = get_client_ip(raw_req)
    
    # Rate limit signups: max 10 per minute per IP
    is_limited, retry_after = limiter.check_rate_limit(f"signup:{client_ip}", max_requests=10, window_seconds=60)
    if is_limited:
        log_security_event("RATE_LIMIT_EXCEEDED", "WARNING", client_ip, "/api/auth/signup", {"retry_after": retry_after})
        raise HTTPException(status_code=429, detail=f"Too many signup requests. Please wait {retry_after} seconds.")

    email = req.email.strip().lower()
    valid_email, email_err = validate_email_format(email)
    if not valid_email:
        raise HTTPException(status_code=400, detail=email_err)

    valid_pw, pw_err = validate_password_strength(req.password)
    if not valid_pw:
        raise HTTPException(status_code=400, detail=pw_err)
    
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(req.password)
    session_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(session_token.encode('utf-8')).hexdigest()
    expires_at = time.time() + SESSION_EXPIRY_SECONDS
    
    with db.get_db_context() as session:
        existing = repository.get_user_by_email(session, email)
        if existing:
            log_security_event("SIGNUP_FAILED", "WARNING", client_ip, "/api/auth/signup", {"reason": "Duplicate email", "email": email})
            raise HTTPException(status_code=400, detail="A user with this email already exists.")
        
        repository.create_user(
            db=session,
            user_id=user_id,
            email=email,
            password_hash=pw_hash,
            session_token_hash=token_hash,
            session_expires_at=expires_at
        )
    
    log_security_event("USER_REGISTERED", "INFO", client_ip, "/api/auth/signup", {"email": email, "user_id": user_id})
    return UserResponse(id=user_id, email=email, is_premium=False, session_token=session_token)

@app.post("/api/auth/signin", response_model=UserResponse)
async def auth_signin(req: UserSignIn, raw_req: Request):
    client_ip = get_client_ip(raw_req)
    email = req.email.strip().lower()
    
    # Check brute force lockouts on IP and Email
    is_locked_ip, retry_ip = limiter.is_locked_out(f"lock:ip:{client_ip}", max_failures=5, lock_duration=600)
    if is_locked_ip:
        log_security_event("ACCOUNT_LOCKED", "ALERT", client_ip, "/api/auth/signin", {"reason": "IP locked out", "retry_in": retry_ip})
        raise HTTPException(status_code=429, detail=f"Too many failed login attempts from this address. Try again in {retry_ip} seconds.")

    is_locked_user, retry_user = limiter.is_locked_out(f"lock:email:{email}", max_failures=5, lock_duration=600)
    if is_locked_user:
        log_security_event("ACCOUNT_LOCKED", "ALERT", client_ip, "/api/auth/signin", {"reason": "Email locked out", "email": email, "retry_in": retry_user})
        raise HTTPException(status_code=429, detail=f"Account temporarily locked due to repeated failed logins. Try again in {retry_user} seconds.")

    # General rate limit for signin requests: 20 per minute
    is_limited, retry_after = limiter.check_rate_limit(f"signin:{client_ip}", max_requests=20, window_seconds=60)
    if is_limited:
        log_security_event("RATE_LIMIT_EXCEEDED", "WARNING", client_ip, "/api/auth/signin", {"retry_after": retry_after})
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Please wait {retry_after} seconds.")

    session_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(session_token.encode('utf-8')).hexdigest()
    expires_at = time.time() + SESSION_EXPIRY_SECONDS

    with db.get_db_context() as session:
        user = repository.get_user_by_email(session, email)
        if not user or not verify_password(user.password, req.password):
            limiter.record_failure(f"lock:ip:{client_ip}")
            limiter.record_failure(f"lock:email:{email}")
            log_security_event("AUTH_FAILED", "WARNING", client_ip, "/api/auth/signin", {"email": email})
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        
        # Reset failure counters on successful signin
        limiter.reset_failures(f"lock:ip:{client_ip}")
        limiter.reset_failures(f"lock:email:{email}")

        repository.update_session(session, user, token_hash, expires_at)
        user_id = user.id
        user_email = user.email
        is_premium = bool(user.is_premium)
    
    log_security_event("AUTH_SUCCESS", "INFO", client_ip, "/api/auth/signin", {"email": email, "user_id": user_id})
    return UserResponse(
        id=user_id,
        email=user_email,
        is_premium=is_premium,
        session_token=session_token
    )

@app.post("/api/auth/signout")
async def auth_signout(raw_req: Request, authorization: Optional[str] = Header(None)):
    client_ip = get_client_ip(raw_req)
    if authorization:
        clean_token = authorization.replace("Bearer ", "").strip()
        if clean_token:
            token_hash = hashlib.sha256(clean_token.encode('utf-8')).hexdigest()
            with db.get_db_context() as session:
                repository.revoke_session(session, token_hash)
            log_security_event("AUTH_SIGNOUT", "INFO", client_ip, "/api/auth/signout", {"status": "token_revoked"})
    return {"success": True, "detail": "Session token successfully revoked."}

@app.get("/api/auth/me", response_model=UserResponse)
async def auth_me(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    user = get_user_by_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    
    return UserResponse(
        id=user.id,
        email=user.email,
        is_premium=bool(user.is_premium),
        session_token=authorization.replace("Bearer ", "").strip()
    )

@app.post("/api/payment/upgrade", response_model=UserResponse)
async def payment_upgrade(req: UpgradeRequest):
    user = get_user_by_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session token for payment upgrade")
    
    with db.get_db_context() as session:
        db_user = repository.get_user_by_id(session, user.id)
        if db_user:
            repository.set_premium_status(session, db_user, is_premium=True)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        is_premium=True,
        session_token=req.token
    )

# --- Problem History & Video Database Endpoints ---
@app.get("/api/history")
async def get_history_api(authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        return {"items": []}
    
    with db.get_db_context() as session:
        items = repository.get_user_history(session, user.id, limit=50)
        return {"items": [item.to_dict() for item in items]}

@app.post("/api/history")
async def save_history_api(req: HistoryItemCreate, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        return {"success": False, "detail": "Guest calculation not persisted to account"}
    
    with db.get_db_context() as session:
        item = repository.add_problem_history(
            session,
            equation=req.equation,
            problem_type=req.problem_type,
            result_latex=req.result_latex,
            steps=req.steps,
            user_id=user.id,
            completed=True
        )
        return {"success": True, "item": item.to_dict()}

@app.delete("/api/history/{history_id}")
async def delete_history_api(history_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    with db.get_db_context() as session:
        success = repository.delete_history_item(session, user.id, history_id)
        if not success:
            raise HTTPException(status_code=404, detail="History entry not found")
        return {"success": True}

@app.delete("/api/history")
async def clear_history_api(authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    with db.get_db_context() as session:
        count = repository.clear_user_history(session, user.id)
        return {"success": True, "deleted_count": count}

@app.get("/api/videos/history")
async def get_video_history_api(authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        return {"videos": []}
    
    with db.get_db_context() as session:
        videos = repository.get_user_videos(session, user.id, limit=50)
        return {"videos": [v.to_dict() for v in videos]}


# --- Notebooks Database Endpoints ---
@app.get("/api/notebooks")
async def list_notebooks_api(authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        return {"notebooks": []}
    with db.get_db_context() as session:
        notebooks = repository.list_notebooks(session, user.id)
        return {"notebooks": [nb.to_dict() for nb in notebooks]}

@app.post("/api/notebooks")
async def create_notebook_api(req: NotebookCreate, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required to create a notebook")
    with db.get_db_context() as session:
        notebook = repository.create_notebook(
            session,
            user_id=user.id,
            title=req.title or "Untitled Notebook",
            content=req.content or "",
            tags=req.tags or "",
            is_pinned=bool(req.is_pinned)
        )
        return {"success": True, "notebook": notebook.to_dict()}

@app.get("/api/notebooks/{notebook_id}")
async def get_notebook_api(notebook_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        notebook = repository.get_notebook(session, user.id, notebook_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        return {"success": True, "notebook": notebook.to_dict()}

@app.put("/api/notebooks/{notebook_id}")
async def update_notebook_api(notebook_id: str, req: NotebookUpdate, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        updated = repository.update_notebook(
            session,
            user_id=user.id,
            notebook_id=notebook_id,
            title=req.title,
            content=req.content,
            tags=req.tags,
            is_pinned=req.is_pinned
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Notebook not found")
        return {"success": True, "notebook": updated.to_dict()}

@app.delete("/api/notebooks/{notebook_id}")
async def delete_notebook_api(notebook_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        success = repository.delete_notebook(session, user.id, notebook_id)
        if not success:
            raise HTTPException(status_code=404, detail="Notebook not found")
        return {"success": True}


# --- Custom Formulas Database Endpoints ---
@app.get("/api/formulas")
async def list_formulas_api(category: Optional[str] = None, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        return {"formulas": []}
    with db.get_db_context() as session:
        formulas = repository.list_custom_formulas(session, user.id, category=category)
        return {"formulas": [f.to_dict() for f in formulas]}

@app.post("/api/formulas")
async def create_formula_api(req: FormulaCreate, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required to save formulas")
    with db.get_db_context() as session:
        formula = repository.create_custom_formula(
            session,
            user_id=user.id,
            name=req.name,
            latex=req.latex,
            category=req.category or "general",
            expression=req.expression or "",
            description=req.description or "",
            variables=req.variables or "",
            is_favorite=bool(req.is_favorite)
        )
        return {"success": True, "formula": formula.to_dict()}

@app.get("/api/formulas/{formula_id}")
async def get_formula_api(formula_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        formula = repository.get_custom_formula(session, user.id, formula_id)
        if not formula:
            raise HTTPException(status_code=404, detail="Formula not found")
        return {"success": True, "formula": formula.to_dict()}

@app.post("/api/formulas/{formula_id}/favorite")
async def toggle_formula_favorite_api(formula_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        formula = repository.toggle_formula_favorite(session, user.id, formula_id)
        if not formula:
            raise HTTPException(status_code=404, detail="Formula not found")
        return {"success": True, "formula": formula.to_dict()}

@app.delete("/api/formulas/{formula_id}")
async def delete_formula_api(formula_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        success = repository.delete_custom_formula(session, user.id, formula_id)
        if not success:
            raise HTTPException(status_code=404, detail="Formula not found")
        return {"success": True}


# --- Chat Sessions Database Endpoints ---
@app.get("/api/chat/sessions")
async def list_chat_sessions_api(authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        return {"sessions": []}
    with db.get_db_context() as session:
        sessions = repository.list_chat_sessions(session, user.id)
        return {"sessions": [s.to_dict() for s in sessions]}

@app.post("/api/chat/sessions")
async def create_chat_session_api(req: ChatSessionCreate, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        new_session = repository.create_chat_session(
            session,
            user_id=user.id,
            title=req.title or "Math Discussion",
            subject=req.subject or "General"
        )
        return {"success": True, "session": new_session.to_dict()}

@app.get("/api/chat/sessions/{session_id}")
async def get_chat_session_api(session_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        chat_sess = repository.get_chat_session(session, user.id, session_id)
        if not chat_sess:
            raise HTTPException(status_code=404, detail="Chat session not found")
        return {"success": True, "session": chat_sess.to_dict(include_messages=True)}

@app.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session_api(session_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        success = repository.delete_chat_session(session, user.id, session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Chat session not found")
        return {"success": True}

@app.get("/api/chat/sessions/{session_id}/messages")
async def get_chat_messages_api(session_id: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        chat_sess = repository.get_chat_session(session, user.id, session_id)
        if not chat_sess:
            raise HTTPException(status_code=404, detail="Chat session not found")
        msgs = repository.get_session_messages(session, session_id)
        return {"messages": [m.to_dict() for m in msgs]}

@app.post("/api/chat/sessions/{session_id}/messages")
async def add_chat_message_api(session_id: str, req: ChatMessageCreate, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    with db.get_db_context() as session:
        chat_sess = repository.get_chat_session(session, user.id, session_id)
        if not chat_sess:
            raise HTTPException(status_code=404, detail="Chat session not found")
        msg = repository.add_chat_message(
            session,
            session_id=session_id,
            role=req.role,
            content=req.content,
            latex=req.latex or ""
        )
        return {"success": True, "message": msg.to_dict()}



@app.get("/api/security/telemetry")
async def security_telemetry_api(raw_req: Request):
    client_ip = get_client_ip(raw_req)
    is_limited, _ = limiter.check_rate_limit(f"telemetry:{client_ip}", max_requests=60, window_seconds=60)
    if is_limited:
        raise HTTPException(status_code=429, detail="Telemetry rate limit exceeded")
    return get_security_telemetry()

from fastapi.responses import FileResponse

@app.get("/api/media/{file_path:path}")
async def get_media(file_path: str, authorization: Optional[str] = Header(None)):
    user = get_user_by_token(authorization) if authorization else None
    
    # Secure canonical path traversal check and extension validation
    full_path = verify_media_path(MEDIA_DIR, file_path)
    
    # Inspect canonical relative path components for quality tier
    norm_media_dir = os.path.abspath(MEDIA_DIR)
    rel_path = os.path.relpath(full_path, norm_media_dir)
    path_parts = rel_path.split(os.sep)
    is_low_quality = any(part == "480p15" for part in path_parts)
    is_image = any(full_path.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".svg"])
    
    # Low quality (480p15) and static image previews are accessible to guests; higher qualities require authentication
    if not is_low_quality and not is_image and not user:
        raise HTTPException(status_code=401, detail="Authentication token required to view high quality media")
        
    return FileResponse(full_path)

@app.middleware("http")
async def security_and_logging_middleware(request: Request, call_next):
    try:
        log_path = os.path.join(BASE_DIR, "request_log.txt")
        log_entry = f"{request.method} {request.url.path}\n"
        await asyncio.to_thread(lambda: open(log_path, "a", encoding="utf-8").write(log_entry))
    except Exception:
        pass
    
    response = await call_next(request)
    
    # Standard HTTP Security Headers & Content-Security-Policy
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; "
        "img-src 'self' data: blob: https:; "
        "media-src 'self' blob: data: http: https:; "
        "frame-ancestors 'self';"
    )
    
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

class ShapeOCRRequest(BaseModel):
    imageBase64: str

class ShapeSolveRequest(BaseModel):
    shapeType: Optional[str] = "triangle"
    a: Optional[float] = None
    b: Optional[float] = None
    c: Optional[float] = None
    A: Optional[float] = None
    B: Optional[float] = None
    C: Optional[float] = None
    isRight: Optional[bool] = False
    radius: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None
    api_key: Optional[str] = None
    apiKey: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    reasoning: Optional[str] = None

NVIDIA_MATH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "describe_harry_potter_character",
            "description": "Returns information and images of Harry Potter characters.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "enum": [
                            "Harry James Potter", "Hermione Jean Granger", "Ron Weasley",
                            "Fred Weasley", "George Weasley", "Bill Weasley", "Percy Weasley",
                            "Charlie Weasley", "Ginny Weasley", "Molly Weasley", "Arthur Weasley",
                            "Neville Longbottom", "Luna Lovegood", "Draco Malfoy",
                            "Albus Percival Wulfric Brian Dumbledore", "Minerva McGonagall",
                            "Remus Lupin", "Rubeus Hagrid", "Sirius Black", "Severus Snape",
                            "Bellatrix Lestrange", "Lord Voldemort", "Cedric Diggory",
                            "Nymphadora Tonks", "James Potter"
                        ],
                        "description": "Name of the Harry Potter character"
                    }
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "name_a_color",
            "description": "A tool that returns a bunch of color names for a given color_hex.",
            "parameters": {
                "type": "object",
                "properties": {
                    "color_hex": {
                        "type": "string",
                        "description": "A hexadecimal color value which must be represented as a string."
                    }
                },
                "required": ["color_hex"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "solve_equation",
            "description": "Solves an algebraic, calculus, or equation problem step-by-step using Axiom math engine.",
            "parameters": {
                "type": "object",
                "properties": {
                    "equation": {"type": "string", "description": "Equation to solve, e.g. x^2 - 5x + 6 = 0 or integrate(x*e^x)"}
                },
                "required": ["equation"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "solve_geometry",
            "description": "Solves geometric properties of triangles, circles, polygons, Pythagoras theorem, hypotenuse, distance, midpoint, area, and perimeter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Geometric query, e.g. triangle(3, 4, 5), pythagorean(3, 4), hypotenuse of 6 and 8, or circle radius 5"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "solve_trigonometry",
            "description": "Solves trigonometric queries, unit circle coordinates, trigonometric equations, identities, and angle evaluations.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Trigonometric query, e.g. sin(pi/6), sin(x) = 0.5, unit_circle(pi/4), or sin(x)^2 + cos(x)^2"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_statistics",
            "description": "Calculates statistical metrics (summary, regression, z-score, t-test).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Statistics query, e.g. summary([1, 2, 3, 4, 5]) or regression([(1, 2), (2, 3)])"}
                },
                "required": ["query"]
            }
        }
    }
]

def handle_harry_potter_tool(name: str) -> str:
    hp_data = {
        "Harry James Potter": "The Boy Who Lived, Gryffindor Seeker, Gryffindor sword wielder, defeated Voldemort. Patronus: Stag. Wand: 11-inch holly with phoenix feather.",
        "Hermione Jean Granger": "Brightest witch of her age, Gryffindor, Minister for Magic, advocate for magical creatures. Patronus: Otter. Wand: 10¾-inch vine wood with dragon heartstring.",
        "Ron Weasley": "Loyal Gryffindor, chess master, Gryffindor Keeper, Auror. Patronus: Jack Russell Terrier. Wand: 14-inch willow with unicorn hair.",
        "Albus Percival Wulfric Brian Dumbledore": "Headmaster of Hogwarts, founder of the Order of the Phoenix, Supreme Mugwump. Patronus: Phoenix. Wand: Elder Wand (15-inch elder with thestral tail hair).",
        "Severus Snape": "Potions Master, Defense Against the Dark Arts professor, Headmaster of Hogwarts, double agent. Patronus: Doe. Wand: 13-inch birch.",
        "Lord Voldemort": "Tom Marvolo Riddle, Dark Lord, heir of Slytherin, creator of Horcruxes. Wand: 13½-inch yew with phoenix feather.",
        "Luna Lovegood": "Ravenclaw, naturalist, editor of The Quibbler, believer in Nargles and Wrackspurts. Patronus: Hare.",
        "Draco Malfoy": "Slytherin Seeker and prefect, seeker of redemption. Patronus: None. Wand: 10-inch hawthorn with unicorn hair.",
        "Minerva McGonagall": "Transfiguration Professor, Head of Gryffindor, Headmistress of Hogwarts. Animagus: Silver tabby cat. Patronus: Cat.",
        "Sirius Black": "Padfoot, Harry's godfather, Gryffindor Marauder. Animagus: Large black bear-like dog.",
        "Remus Lupin": "Moony, Marauder, werewolf, beloved Defense Against the Dark Arts professor. Patronus: Wolf.",
        "Rubeus Hagrid": "Keeper of Keys and Grounds at Hogwarts, Care of Magical Creatures teacher, half-giant with a pink umbrella.",
        "Bellatrix Lestrange": "Fiercest Death Eater, Death Eater lieutenant, dark arts duelist. Wand: 12¾-inch walnut with dragon heartstring.",
        "Cedric Diggory": "Hufflepuff Captain, Triwizard Tournament champion. Wand: 12¼-inch ash with unicorn hair.",
        "Nymphadora Tonks": "Metamorphmagus, Auror, Order of the Phoenix member. Patronus: Jackal / Wolf.",
        "James Potter": "Prongs, Harry's father, Gryffindor Marauder, Head Boy. Animagus: Stag. Patronus: Stag."
    }
    return hp_data.get(name, f"{name}: Renowned wizard/witch in the wizarding world of Hogwarts.")

def handle_color_tool(color_hex: str) -> str:
    cleaned = color_hex.strip().lstrip('#').upper()
    exact_colors = {
        "FF0000": ["Crimson", "Scarlet", "Ruby Red", "Vermilion"],
        "00FF00": ["Lime Green", "Electric Emerald", "Chartreuse", "Neon Spring"],
        "0000FF": ["Royal Blue", "Sapphire", "Cobalt", "Ultramarine", "Azure"],
        "FFFF00": ["Canary Yellow", "Lemon", "Cyber Yellow", "Electric Gold"],
        "FFA500": ["Tangerine", "Marigold", "Sunset Orange", "Carrot"],
        "800080": ["Purple", "Amethyst", "Imperial Violet", "Tyrian Purple"],
        "00FFFF": ["Cyan", "Aqua", "Electric Turquoise", "Bright Cerulean"],
        "FF00FF": ["Magenta", "Hot Fuchsia", "Neon Pink"],
        "FFFFFF": ["Pure Alabaster White", "Snow", "Ivory"],
        "000000": ["Obsidian Black", "Onyx", "Midnight Jet"]
    }
    if cleaned in exact_colors:
        return f"Color names for #{cleaned}: {', '.join(exact_colors[cleaned])}"
    try:
        r = int(cleaned[0:2], 16)
        g = int(cleaned[2:4], 16)
        b = int(cleaned[4:6], 16)
        names = []
        if r > 180 and g < 100 and b < 100:
            names = ["Vivid Ruby", "Crimson Hue", "Fiery Scarlet"]
        elif g > 180 and r < 100 and b < 100:
            names = ["Lush Meadow Green", "Emerald Glow", "Electric Lime"]
        elif b > 180 and r < 100 and g < 100:
            names = ["Ocean Depths Blue", "Celestial Azure", "Deep Sapphire"]
        elif r > 180 and g > 180 and b < 100:
            names = ["Solar Gold", "Sunburst Amber", "Honey Mustard"]
        elif r > 150 and b > 150 and g < 100:
            names = ["Royal Orchid", "Deep Violet", "Mystic Mauve"]
        elif r > 200 and g > 200 and b > 200:
            names = ["Platinum Mist", "Ghost Pearl", "Frost Silver"]
        elif r < 50 and g < 50 and b < 50:
            names = ["Deep Charcoal", "Midnight Abyss", "Dark Graphite"]
        else:
            names = [f"Bespoke Hex #{cleaned}", "Harmonic Tone", "Spectral Gradient"]
        return f"Color names for #{cleaned}: {', '.join(names)}"
    except Exception:
        return f"Color #{cleaned}"

def call_nvidia_nemotron(
    messages: List[Dict[str, str]],
    enable_thinking: bool = True,
    reasoning_budget: int = 2048,
    temperature: float = 1.0,
    top_p: float = 0.95,
    max_tokens: int = 4096,
    tools: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None
) -> Tuple[str, Optional[str], Optional[List[Any]]]:
    """
    Executes NVIDIA Nemotron reasoning with thinking budget and tool calling via integrate.api.nvidia.com/v1.
    Streams chunks, extracts reasoning_content and content, aggregates tool calls.
    """
    effective_api_key = api_key or os.environ.get("NVIDIA_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not effective_api_key:
        raise ValueError("NVIDIA_API_KEY is not configured.")

    base_url = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    model_name = os.environ.get("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")

    client = OpenAI(
        base_url=base_url,
        api_key=effective_api_key
    )

    extra_body: Dict[str, Any] = {}
    if enable_thinking:
        extra_body = {
            "chat_template_kwargs": {"enable_thinking": True},
            "reasoning_budget": reasoning_budget
        }

    kwargs: Dict[str, Any] = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "top_p": top_p,
        "max_tokens": max_tokens,
        "stream": True
    }
    if extra_body:
        kwargs["extra_body"] = extra_body
    if tools is not None:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    elif NVIDIA_MATH_TOOLS:
        kwargs["tools"] = NVIDIA_MATH_TOOLS
        kwargs["tool_choice"] = "auto"

    completion = client.chat.completions.create(**kwargs)

    reasoning_chunks: List[str] = []
    content_chunks: List[str] = []
    tool_calls_acc: List[Dict[str, str]] = []

    for chunk in completion:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        
        # 1. Capture Reasoning / Thinking tokens
        reasoning_delta = getattr(delta, "reasoning_content", None)
        if reasoning_delta:
            reasoning_chunks.append(reasoning_delta)
            
        # 2. Capture Content tokens
        if delta.content is not None:
            content_chunks.append(delta.content)
            
        # 3. Stream & assemble Tool Calls
        if getattr(delta, "tool_calls", None):
            for tc in delta.tool_calls:
                idx = getattr(tc, "index", 0)
                while len(tool_calls_acc) <= idx:
                    tool_calls_acc.append({"name": "", "arguments": ""})
                if getattr(tc, "function", None):
                    if getattr(tc.function, "name", None):
                        tool_calls_acc[idx]["name"] += tc.function.name
                    if getattr(tc.function, "arguments", None):
                        tool_calls_acc[idx]["arguments"] += tc.function.arguments

    reply_text = "".join(content_chunks).strip()
    reasoning_text = "".join(reasoning_chunks).strip() if reasoning_chunks else None

    # Execute and incorporate any tool calls
    if tool_calls_acc:
        tool_results: List[str] = []
        for tc_data in tool_calls_acc:
            fn_name = tc_data.get("name", "")
            fn_args = tc_data.get("arguments", "{}")
            if not fn_name:
                continue
            try:
                args = json.loads(fn_args) if isinstance(fn_args, str) and fn_args.strip() else {}
                if fn_name == "solve_equation":
                    eq = args.get("equation", "")
                    sol, _ = solve_algebra(eq)
                    tool_results.append(f"• Algebraic Verification ({eq}): {sol}")
                elif fn_name == "solve_geometry":
                    q = args.get("query", "")
                    sol, _ = geometry.solve_geometry(q)
                    tool_results.append(f"• Geometric Verification ({q}): {sol}")
                elif fn_name == "solve_trigonometry":
                    q = args.get("query", "")
                    sol, _ = trigonometry.solve_trigonometry(q)
                    tool_results.append(f"• Trigonometric Verification ({q}): {sol}")
                elif fn_name == "calculate_statistics":
                    q = args.get("query", "")
                    sol, _ = statistics.solve_statistics(q)
                    tool_results.append(f"• Statistical Verification ({q}): {sol}")
                elif fn_name == "describe_harry_potter_character":
                    char_name = args.get("name", "")
                    res = handle_harry_potter_tool(char_name)
                    tool_results.append(f"• Harry Potter Character Info: {res}")
                elif fn_name == "name_a_color":
                    c_hex = args.get("color_hex", "")
                    res = handle_color_tool(c_hex)
                    tool_results.append(f"• Color Palette Info: {res}")
            except Exception as e:
                print(f"Tool call execution error ({fn_name}): {e}")

        if tool_results:
            reply_text = (reply_text + "\n\n" + "\n".join(tool_results)).strip()

    return reply_text, reasoning_text, tool_calls_acc if tool_calls_acc else None

def stream_nvidia_nemotron_generator(
    messages: List[Dict[str, str]],
    enable_thinking: bool = True,
    reasoning_budget: int = 16384,
    tools: Optional[List[Dict[str, Any]]] = None
):
    """
    Generator yielding Server-Sent Events (SSE) streaming reasoning, content, and tool executions.
    """
    api_key = os.environ.get("NVIDIA_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        yield f"data: {json.dumps({'type': 'error', 'error': 'NVIDIA_API_KEY is not configured.'})}\n\n"
        return

    base_url = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    model_name = os.environ.get("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")

    client = OpenAI(base_url=base_url, api_key=api_key)

    extra_body: Dict[str, Any] = {}
    if enable_thinking:
        extra_body = {
            "chat_template_kwargs": {"enable_thinking": True},
            "reasoning_budget": reasoning_budget
        }

    kwargs: Dict[str, Any] = {
        "model": model_name,
        "messages": messages,
        "temperature": 1.0,
        "top_p": 0.95,
        "max_tokens": 16384,
        "stream": True,
        "tools": tools or NVIDIA_MATH_TOOLS,
        "tool_choice": "auto"
    }
    if extra_body:
        kwargs["extra_body"] = extra_body

    completion = client.chat.completions.create(**kwargs)

    tool_calls_acc: List[Dict[str, str]] = []

    for chunk in completion:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta

        reasoning_delta = getattr(delta, "reasoning_content", None)
        if reasoning_delta:
            yield f"data: {json.dumps({'type': 'reasoning', 'content': sanitize_ai_response(reasoning_delta)})}\n\n"

        if delta.content is not None:
            yield f"data: {json.dumps({'type': 'content', 'content': sanitize_ai_response(delta.content)})}\n\n"

        if getattr(delta, "tool_calls", None):
            for tc in delta.tool_calls:
                idx = getattr(tc, "index", 0)
                while len(tool_calls_acc) <= idx:
                    tool_calls_acc.append({"name": "", "arguments": ""})
                if getattr(tc, "function", None):
                    if getattr(tc.function, "name", None):
                        tool_calls_acc[idx]["name"] += tc.function.name
                    if getattr(tc.function, "arguments", None):
                        tool_calls_acc[idx]["arguments"] += tc.function.arguments

    if tool_calls_acc:
        for tc_data in tool_calls_acc:
            fn_name = tc_data.get("name", "")
            fn_args = tc_data.get("arguments", "{}")
            if not fn_name:
                continue
            try:
                args = json.loads(fn_args) if isinstance(fn_args, str) and fn_args.strip() else {}
                tool_msg = ""
                if fn_name == "solve_equation":
                    eq = args.get("equation", "")
                    sol, _ = solve_algebra(eq)
                    tool_msg = f"• Algebraic Verification ({eq}): {sol}"
                elif fn_name == "solve_geometry":
                    q = args.get("query", "")
                    sol, _ = geometry.solve_geometry(q)
                    tool_msg = f"• Geometric Verification ({q}): {sol}"
                elif fn_name == "solve_trigonometry":
                    q = args.get("query", "")
                    sol, _ = trigonometry.solve_trigonometry(q)
                    tool_msg = f"• Trigonometric Verification ({q}): {sol}"
                elif fn_name == "calculate_statistics":
                    q = args.get("query", "")
                    sol, _ = statistics.solve_statistics(q)
                    tool_msg = f"• Statistical Verification ({q}): {sol}"
                elif fn_name == "describe_harry_potter_character":
                    char_name = args.get("name", "")
                    tool_msg = f"• Harry Potter Character Info: {handle_harry_potter_tool(char_name)}"
                elif fn_name == "name_a_color":
                    c_hex = args.get("color_hex", "")
                    tool_msg = f"• Color Palette Info: {handle_color_tool(c_hex)}"
                if tool_msg:
                    yield f"data: {json.dumps({'type': 'content', 'content': chr(10) + chr(10) + tool_msg})}\n\n"
            except Exception as e:
                print(f"Tool streaming error: {e}")

    yield f"data: {json.dumps({'type': 'done'})}\n\n"

def generate_smart_math_tutor_reply(user_question: str, context: Optional[str] = None) -> str:
    # Strict Subject Boundary Check: Only answer mathematics / STEM inquiries
    is_on_subject, _ = is_query_on_subject(user_question, context)
    if not is_on_subject:
        return (
            "I am Axiom, your AI Math Tutor! I specialize exclusively in mathematics, geometry, algebra, "
            "calculus, trigonometry, and scientific STEM problem-solving. Please ask a question related to "
            "math, equations, formulas, or this problem!"
        )

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

    # Trigonometry Concepts & Questions
    if any(k in q for k in ["trigonometry", "trig", "soh cah toa", "sohcahtoa", "unit circle", "sine", "cosine", "tangent", "secant", "cosecant", "cotangent"]):
        # Try direct solve if question contains numbers or solvable pattern
        try:
            trig_sol, trig_steps = trigonometry.solve_trigonometry(user_question)
            step_summary = "\n".join([f"• {s.description}: ${s.latex}$" for s in trig_steps[:3]])
            return f"**Trigonometric Solution:**\nResult: ${trig_sol}$\n\n{step_summary}"
        except Exception:
            return (
                "Trigonometry connects triangle ratios with circular periodic functions! "
                "Remember SOH-CAH-TOA: $\\sin(\\theta) = \\frac{\\text{Opp}}{\\text{Hyp}}$, "
                "$\\cos(\\theta) = \\frac{\\text{Adj}}{\\text{Hyp}}$, "
                "$\\tan(\\theta) = \\frac{\\text{Opp}}{\\text{Adj}}$. "
                "On the unit circle ($x^2 + y^2 = 1$), any angle $\\theta$ corresponds to coordinates $(x, y) = (\\cos\\theta, \\sin\\theta)$."
            )

    # Geometry Concepts & Questions
    if any(k in q for k in ["geometry", "triangle", "pythagor", "hypotenuse", "circle", "radius", "diameter", "rectangle", "perimeter", "heron", "sphere", "cylinder", "cone", "distance between", "midpoint"]):
        # Try direct solve if question contains numbers or solvable pattern
        try:
            geo_sol, geo_steps = geometry.solve_geometry(user_question)
            step_summary = "\n".join([f"• {s.description}: ${s.latex}$" for s in geo_steps[:3]])
            return f"**Geometric Solution:**\nResult: {geo_sol}\n\n{step_summary}"
        except Exception:
            return (
                "Geometry studies shapes, spatial dimensions, and transformations! "
                "For right triangles, the Pythagorean Theorem states $a^2 + b^2 = c^2$. "
                "For circles, Area $A = \\pi r^2$ and Circumference $C = 2\\pi r$. "
                "For any triangle with base and height, Area $A = \\frac{1}{2} b h$."
            )

    # Check for direct trig query in general questions (e.g. "sin(pi/6)", "cos 45", "tan(pi/4)")
    if bool(re.search(r'\b(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan)\b', q)):
        try:
            trig_sol, trig_steps = trigonometry.solve_trigonometry(user_question)
            step_summary = "\n".join([f"• {s.description}: ${s.latex}$" for s in trig_steps[:3]])
            return f"**Trigonometric Result:** ${trig_sol}$\n\n{step_summary}"
        except Exception:
            pass

    # Check for direct geometry query in general questions (e.g. "pythagorean 3 4", "hypotenuse 6 8", "distance between")
    if any(k in q for k in ["hypotenuse", "distance", "midpoint", "radius", "diameter"]):
        try:
            geo_sol, geo_steps = geometry.solve_geometry(user_question)
            step_summary = "\n".join([f"• {s.description}: ${s.latex}$" for s in geo_steps[:3]])
            return f"**Geometric Result:** {geo_sol}\n\n{step_summary}"
        except Exception:
            pass

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

@app.post("/api/chat", response_model=ChatResponse)
async def chat_api(request: ChatRequest, raw_req: Request):
    client_ip = get_client_ip(raw_req)

    # 1. Strict AI Rate Limiting & Abuse Lockout
    check_ai_rate_limit(client_ip=client_ip, endpoint="/api/chat", is_stream=False)

    # 2. Extract and sanitize custom API key (if provided)
    custom_key = request.api_key or request.apiKey or raw_req.headers.get("x-api-key")
    if custom_key:
        custom_key = sanitize_ai_api_key(custom_key)

    # 3. Validate messages, payload length, and check for adversarial prompt injections
    sanitized_messages, sanitized_context, safe_refusal = validate_and_sanitize_ai_messages(
        messages=request.messages,
        context=request.context,
        client_ip=client_ip,
        endpoint="/api/chat"
    )

    if safe_refusal:
        return ChatResponse(reply=safe_refusal)

    last_user_message = ""
    for m in reversed(sanitized_messages):
        if m["role"] == "user":
            last_user_message = m["content"]
            break

    messages_payload = []
    system_content = (
        "You are Axiom, an expert, encouraging, brilliant AI Math Tutor. "
        "Explain mathematical steps, intuition, and concepts clearly and concisely. "
        "Use standard LaTeX notation ($...$ or $$...$$) where appropriate for math formulas. Keep answers focused (2-4 sentences)."
    )
    if sanitized_context:
        system_content += f"\nCurrent Problem / Screen Context:\n{sanitized_context}"

    messages_payload.append({"role": "system", "content": system_content})

    for m in sanitized_messages:
        messages_payload.append({"role": m["role"], "content": m["content"]})

    # 0. Check for Gemini Key directly if supplied or configured
    gemini_key = (custom_key if (custom_key and custom_key.startswith("AIzaSy")) else None) or os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            prompt = (
                f"You are Axiom, a friendly, brilliant, human-like AI Math Tutor.\n"
                f"Context: {sanitized_context or ''}\n"
                f"User: {last_user_message}\n"
                f"Answer concisely and intuitively in 2-3 sentences using LaTeX where helpful."
            )
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            if resp and resp.text:
                return ChatResponse(reply=sanitize_ai_response(resp.text.strip()))
        except Exception as e:
            print(f"Gemini notice: {e}")

    # 1. Primary Engine: NVIDIA Nemotron (with Thinking / Reasoning and Math Tools)
    nvidia_key = (custom_key if (custom_key and not custom_key.startswith("AIzaSy")) else None) or os.environ.get("NVIDIA_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if nvidia_key:
        try:
            # Only use math tools for chat, avoiding unrelated tools
            math_tools = [
                t for t in (NVIDIA_MATH_TOOLS or [])
                if t.get("function", {}).get("name", "").startswith("solve_")
            ]
            reply_text, reasoning_text, _ = call_nvidia_nemotron(
                messages=messages_payload,
                enable_thinking=True,
                reasoning_budget=2048,
                tools=math_tools if math_tools else None,
                api_key=nvidia_key
            )
            if reply_text or reasoning_text:
                return ChatResponse(
                    reply=sanitize_ai_response(reply_text or "Analysis complete."),
                    reasoning=sanitize_ai_response(reasoning_text) if reasoning_text else None
                )
        except Exception as e:
            print(f"NVIDIA Nemotron notice: {e}")

    # 2. Secondary Engine: Local Ollama with Llama 3
    if os.environ.get("OLLAMA_ENABLED") == "true":
        try:
            ollama_model = os.environ.get("OLLAMA_MODEL", "llama3")
            payload = {
                "model": ollama_model,
                "messages": messages_payload,
                "stream": False,
            }

            async with httpx.AsyncClient() as client:
                chat_response = await client.post(
                    "http://localhost:11434/api/chat",
                    json=payload,
                    timeout=5.0
                )
                if chat_response.status_code == 200:
                    res_json = chat_response.json()
                    msg = res_json.get("message", {}).get("content", "")
                    if msg:
                        return ChatResponse(reply=sanitize_ai_response(msg))
        except Exception as e:
            print(f"Ollama (llama3) notice: {e}")

    # 3. Fallback Engine: Built-in High-Intelligence Math Reasoner
    reply = generate_smart_math_tutor_reply(last_user_message, sanitized_context)
    return ChatResponse(reply=sanitize_ai_response(reply))

@app.get("/api/chat/status")
async def chat_status_api():
    nvidia_key = os.environ.get("NVIDIA_API_KEY") or os.environ.get("OPENAI_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    return {
        "connected": bool(nvidia_key or gemini_key),
        "engine": "NVIDIA Nemotron 3.5" if nvidia_key else "Google Gemini" if gemini_key else "Built-in Math Engine",
        "model": os.environ.get("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b"),
        "has_key": bool(nvidia_key or gemini_key),
        "protected": True
    }

@app.post("/api/chat/stream")
async def chat_stream_api(request: ChatRequest, raw_req: Request):
    client_ip = get_client_ip(raw_req)

    # 1. Strict AI Stream Rate Limiting & Abuse Lockout
    check_ai_rate_limit(client_ip=client_ip, endpoint="/api/chat/stream", is_stream=True)

    # 2. Extract and sanitize custom API key (if provided)
    custom_key = request.api_key or request.apiKey or raw_req.headers.get("x-api-key")
    if custom_key:
        custom_key = sanitize_ai_api_key(custom_key)

    # 3. Validate messages, payload length, and check for adversarial prompt injections
    sanitized_messages, sanitized_context, safe_refusal = validate_and_sanitize_ai_messages(
        messages=request.messages,
        context=request.context,
        client_ip=client_ip,
        endpoint="/api/chat/stream"
    )

    if safe_refusal:
        async def refusal_generator():
            yield f"data: {json.dumps({'type': 'content', 'content': safe_refusal})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return StreamingResponse(refusal_generator(), media_type="text/event-stream")

    system_content = (
        "You are Axiom, an expert, encouraging, brilliant AI Math Tutor powered by NVIDIA Nemotron. "
        "Explain mathematical steps, intuition, and concepts clearly and concisely. "
        "Use standard LaTeX notation ($...$ or $$...$$) where appropriate for math formulas. Keep answers focused (2-4 sentences)."
    )
    if sanitized_context:
        system_content += f"\nCurrent Problem / Screen Context:\n{sanitized_context}"

    messages_payload = [{"role": "system", "content": system_content}]
    for m in sanitized_messages:
        messages_payload.append({"role": m["role"], "content": m["content"]})

    return StreamingResponse(
        stream_nvidia_nemotron_generator(
            messages=messages_payload,
            enable_thinking=True,
            reasoning_budget=16384,
            tools=NVIDIA_MATH_TOOLS
        ),
        media_type="text/event-stream"
    )

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
async def ocr_api(request: OCRRequest, raw_req: Request):
    client_ip = get_client_ip(raw_req)
    is_limited, retry_after = limiter.check_rate_limit(f"ocr:{client_ip}", max_requests=20, window_seconds=60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"OCR rate limit reached. Please wait {retry_after} seconds.")

    request.imageBase64 = sanitize_base64_image(request.imageBase64)
    try:
        base64_str = re.sub(r'^data:image/\w+;base64,', '', request.imageBase64)
        img_data = base64.b64decode(base64_str)

        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            try:
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=gemini_key)
                prompt = (
                    "You are an expert mathematical, geometric, and trigonometric visual reasoning engine.\n"
                    "Analyze this image and extract or formulate the exact mathematical query needed to solve it in the Axiom Engine.\n"
                    "OUTPUT ONLY the final plain text math string or function call without markdown or backticks.\n"
                    "Rules:\n"
                    "- Right Triangle: pythagorean(a, b) (e.g. pythagorean(3, 4))\n"
                    "- General Triangle: triangle(a, b, c) (e.g. triangle(5, 7, 8))\n"
                    "- Circle: circle(r) (e.g. circle(5))\n"
                    "- Rectangle/Square: rectangle(w, h) or square(s)\n"
                    "- Distance: distance([x1, y1], [x2, y2])\n"
                    "- Unit Circle: unit_circle(angle) (e.g. unit_circle(pi/3), unit_circle(45))\n"
                    "- Trig Equations: sin(x) = 0.5, 2*sin(x) - 1 = 0, sin(2*x) = 1, sin(x) = cos(x)\n"
                    "- Trig Values: sin(pi/6), cos(45), tan(pi/4)\n"
                    "- Matrices: [[row1], [row2]], det([[...]]), inv([[...]]), eigen([[...]])\n"
                    "- Calculus: integrate(expr), derive(expr)\n"
                    "- Algebra: x^2 - 5x + 6 = 0\n"
                    "- Word Problems: Formulate the equation to solve directly."
                )
                resp = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[
                        types.Part.from_bytes(data=img_data, mime_type="image/jpeg"),
                        prompt
                    ]
                )
                if resp and resp.text:
                    eq_text = resp.text.strip()
                    eq_text = re.sub(r'^```[a-zA-Z]*\n?', '', eq_text)
                    eq_text = re.sub(r'\n?```$', '', eq_text).strip(' "\'')
                    eq_text = normalize_matrix_latex(eq_text)
                    if eq_text:
                        return {'equation': eq_text, 'format': 'latex'}
            except Exception as e:
                print(f"Backend Gemini OCR fallback: {e}")

        img = Image.open(BytesIO(img_data)).convert('RGB')

        equation = ''
        try:
            equation = pytesseract.image_to_string(img, config='--psm 6').strip()
        except Exception as e:
            print(f'OCR failed: {e}')
        
        equation = equation.replace('\n', ' ')
        equation = re.sub(r'\s+', ' ', equation).strip()
        equation = equation.replace("—", "-").replace("–", "-").replace("−", "-").strip()
        # Normalize degree/superscripts to powers (e.g. 6x° -> 6x^2, x² -> x^2)
        equation = re.sub(r'([a-zA-Z0-9\)])[°º]', r'\1^2', equation)
        equation = re.sub(r'([a-zA-Z0-9\)])²', r'\1^2', equation)
        equation = re.sub(r'([a-zA-Z0-9\)])³', r'\1^3', equation)
        equation = re.sub(r'([a-zA-Z])\s*([2-9])(?=\s*[-+=*/]|$)', r'\1^\2', equation)
        equation = re.sub(r'=\s*[Oo]\b', '= 0', equation)
        equation = re.sub(r'([0-9a-zA-Z\)])\s*([+\-=])\s*([0-9a-zA-Z\(])', r'\1 \2 \3', equation).strip()

        if not equation:
            raise HTTPException(status_code=422, detail="No equation detected")
        
        return {'equation': equation, 'format': 'latex'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/shape-ocr")
async def shape_ocr_api(request: ShapeOCRRequest, raw_req: Request):
    client_ip = get_client_ip(raw_req)
    is_limited, retry_after = limiter.check_rate_limit(f"ocr:{client_ip}", max_requests=20, window_seconds=60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Shape OCR rate limit reached. Please wait {retry_after} seconds.")

    request.imageBase64 = sanitize_base64_image(request.imageBase64)
    try:
        base64_str = re.sub(r'^data:image/\w+;base64,', '', request.imageBase64)
        img_data = base64.b64decode(base64_str)
        result = geometry.detect_shape_from_image(img_data)
        
        # Format MathStep objects into serializable dicts
        if "steps" in result and isinstance(result["steps"], list):
            formatted_steps = []
            for s in result["steps"]:
                if hasattr(s, "description"):
                    formatted_steps.append({
                        "description": s.description,
                        "latex": s.latex,
                        "type": getattr(s, "type", "geometry"),
                        "data": getattr(s, "data", {})
                    })
                elif isinstance(s, dict):
                    formatted_steps.append(s)
            result["steps"] = formatted_steps
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/solve-shape")
async def solve_shape_api(request: ShapeSolveRequest):
    try:
        st = (request.shapeType or "triangle").lower()
        if st == "triangle":
            res = geometry.solve_triangle_properties(
                a=request.a,
                b=request.b,
                c=request.c,
                A=request.A,
                B=request.B,
                C=request.C,
                is_right=bool(request.isRight)
            )
        elif st == "circle":
            r = request.radius if request.radius is not None else 5.0
            data, steps = geometry.circle_solve(r)
            res = {
                "type": "circle",
                "subtype": "Circle",
                "radius": r,
                "diameter": data["diameter"],
                "area": data["area"],
                "circumference": data["circumference"],
                "steps": steps
            }
        elif st in ["rectangle", "square"]:
            w = request.width if request.width is not None else 6.0
            h = request.height if request.height is not None else 4.0
            data, steps = geometry.rectangle_solve(w, h)
            res = {
                "type": "rectangle",
                "subtype": "Square" if abs(w - h) < 0.001 else "Rectangle",
                "width": w,
                "height": h,
                "area": data["area"],
                "perimeter": data["perimeter"],
                "diagonal": data["diagonal"],
                "steps": steps
            }
        else:
            raise ValueError(f"Unsupported shape type: {st}")

        # Format MathStep objects
        if "steps" in res and isinstance(res["steps"], list):
            formatted_steps = []
            for s in res["steps"]:
                if hasattr(s, "description"):
                    formatted_steps.append({
                        "description": s.description,
                        "latex": s.latex,
                        "type": getattr(s, "type", "geometry"),
                        "data": getattr(s, "data", {})
                    })
                elif isinstance(s, dict):
                    formatted_steps.append(s)
            res["steps"] = formatted_steps

        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
        
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
    if equation_type == "Algebra" and not any(t in input_str.lower() for t in ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan']):
        try:
            poly_obj, var_x, _, _ = algebra.parse_equation_to_poly(input_str)
            deg_val = poly_obj.degree
            powers_list = list(poly_obj.coeffs.keys())
            is_biquad = (deg_val == 4 and all(p % 2 == 0 for p in powers_list))
            a, b, c, d = algebra.parse_polynomial(input_str)

            if deg_val is not None and deg_val >= 4:
                # Method 1: Factoring & Zero Product Property
                factored_latex, factors, rem_poly = algebra.factor_poly(poly_obj)
                f_steps = []
                min_p = min(powers_list) if powers_list else 0
                if min_p > 0:
                    gcf_latex = f"{var_x}^{{{min_p}}}" if min_p > 1 else var_x
                    f_steps.append(MathStep(
                        f"Factor out common factor {gcf_latex}",
                        rf"{gcf_latex}\left({rem_poly.to_latex()}\right) = 0",
                        "equation"
                    ))
                f_steps.append(MathStep(
                    "Factor completely into algebraic factors",
                    rf"{factored_latex} = 0",
                    "equation"
                ))
                f_steps.append(MathStep(
                    "Apply the Zero Product Property",
                    r"A \cdot B = 0 \implies A = 0 \text{ or } B = 0",
                    "equation"
                ))
                for f_term_latex, root_val, mult in factors:
                    mult_txt = f" (multiplicity {mult})" if mult > 1 else ""
                    f_steps.append(MathStep(
                        f"Solve factor {f_term_latex} = 0{mult_txt}",
                        rf"{f_term_latex} = 0 \implies {var_x} = {algebra.fmt_fraction_latex(root_val)}",
                        "equation"
                    ))
                methods.append(MethodSolutionModel(
                    methodId="poly-factor",
                    methodName="Method 1: Factorization & Zero Product Property",
                    badgeTag="Polynomial Factoring",
                    techniqueSummary="Factors the higher-degree polynomial into simpler irreducible factors and sets each factor to zero.",
                    formulaLatex=r"P(x) = A(x) \cdot B(x) = 0 \implies A(x) = 0 \text{ or } B(x) = 0",
                    steps=to_step_models(f_steps),
                    finalResultLatex=final_solution or "Roots computed",
                    prosAndCons=MethodProsCons(
                        pros="Direct and algebraically intuitive without requiring complex polynomial root formulas.",
                        cons="Only applies when the polynomial factors nicely over rational numbers."
                    )
                ))

                if is_biquad:
                    # Method 2: Bi-quadratic substitution u = x^2
                    _, bi_steps = algebra.solve_biquadratic(poly_obj, allow_complex=allow_complex)
                    methods.append(MethodSolutionModel(
                        methodId="biquadratic-sub",
                        methodName="Method 2: Bi-quadratic Substitution (u = x^2)",
                        badgeTag="Variable Substitution",
                        techniqueSummary="Substitutes u = x^2 to reduce the degree 4 equation into a standard degree 2 quadratic equation in u.",
                        formulaLatex=r"u = x^2 \implies Au^2 + Bu + C = 0 \implies x = \pm\sqrt{u}",
                        steps=to_step_models(bi_steps),
                        finalResultLatex=final_solution or "Roots computed",
                        prosAndCons=MethodProsCons(
                            pros="Directly leverages quadratic formulas for fourth-degree polynomials with even powers.",
                            cons="Strictly requires all powers of x to be even multiples."
                        )
                    ))

            elif deg_val == 3 or (deg_val is None and a != 0):  # Cubic
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

            elif deg_val == 2 or (deg_val is None and b != 0):  # Quadratic
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
    elif equation_type == "Statistics" or any(input_str.lower().startswith(s) for s in ['mean', 'median', 'mode', 'variance', 'stddev', 'std_dev', 'standard_deviation', 'percentile', 'set_theory', 'union', 'intersection', 'iqr', 'z_score', 'zscore', 'summary', 'stats', 'describe', 'regression', 'linreg', 'linear_regression', 'correlation', 'normal', 'binomial', 'poisson', 'geometric', 'hypergeometric', 'exponential', 'uniform', 'spatial', 'centroid', 't_test', 'ttest', 'two_sample', 'hypothesis', 'confidence', 'proportion', 'chi_square', 'chisq', 'goodness', 'contingency', 'anova', 'random_var', 'expected_value', 'combination', 'permutation', 'bayes', 'prob']):
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
    elif '[' in input_str and equation_type not in ["Geometry", "Statistics"]:
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

    # 6. TRIGONOMETRY
    elif equation_type == "Trigonometry" or (equation_type != "Geometry" and any(re.search(rf'\b{t}\b', input_str.lower()) for t in ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan', 'unit_circle'])):
        try:
            # Method 1: Unit Circle & Reference Angle Method
            if 'unit_circle' in input_str.lower():
                m = re.search(r'unit_?circle\((.*?)\)', input_str, re.I)
                arg = m.group(1).strip() if m else "pi/4"
                _, uc_steps = trigonometry.unit_circle(arg)
            else:
                _, uc_steps = trigonometry.solve_trigonometry(input_str)
                
            methods.append(MethodSolutionModel(
                methodId="trig-unit-circle",
                methodName="Method 1: Unit Circle & Reference Angle Resolution",
                badgeTag="Geometric Unit Circle",
                techniqueSummary="Analyzes periodicity on the unit circle x^2 + y^2 = 1, finding acute reference angles and matching quadrant signs.",
                formulaLatex=r"(x, y) = (\cos\theta, \sin\theta), \quad \theta_{\text{ref}} = |\arcsin(y)|",
                steps=to_step_models(uc_steps),
                finalResultLatex=final_solution or "",
                prosAndCons=MethodProsCons(
                    pros="Provides intuitive geometric visualization of sine and cosine projections on the coordinate plane.",
                    cons="Requires quadrant-by-quadrant sign verification (ASTC rule)."
                )
            ))
            
            # Method 2: Analytical Inversion / Algebraic Substitution Method
            alt_steps = []
            if '=' in input_str:
                alt_steps.append(MathStep(
                    description="Isolate the trigonometric function to form standard relation f(x) = c",
                    latex=r"f(kx) = c \implies kx = \arcsin(c) + 2k\pi \quad \text{or} \quad \pi - \arcsin(c) + 2k\pi",
                    type="equation"
                ))
                alt_steps.append(MathStep(
                    description="Apply inverse trigonometric mapping across principal range",
                    latex=rf"x \in \text{{Roots}} \implies {final_solution or 'x = \text{solutions}'}",
                    type="equation"
                ))
            else:
                alt_steps.append(MathStep(
                    description="Convert trigonometric expression into exact algebraic radicals",
                    latex=r"\text{Substitute standard values from 30°-60°-90° and 45°-45°-90° special triangles}",
                    type="equation"
                ))
                alt_steps.append(MathStep(
                    description="Simplify radical fraction",
                    latex=rf"= {final_solution or ''}",
                    type="equation"
                ))
            methods.append(MethodSolutionModel(
                methodId="trig-algebraic-inversion",
                methodName="Method 2: Analytical Inversion & Algebraic Substitution",
                badgeTag="Algebraic Inversion",
                techniqueSummary="Uses inverse trigonometric operators and algebraic identities for exact analytical closed-form representation.",
                formulaLatex=r"\theta = f^{-1}(c) + \text{Periodicity}",
                steps=to_step_models(alt_steps),
                finalResultLatex=final_solution or "",
                prosAndCons=MethodProsCons(
                    pros="Directly computes exact roots and closed-form values without drawing circles.",
                    cons="Requires careful handling of multivalued inverse trigonometric branches."
                )
            ))
        except Exception as e:
            print(f"Error in trig multi-methods: {e}")

    # 7. GEOMETRY
    elif equation_type == "Geometry" or any(input_str.lower().startswith(g) for g in ['translate', 'rotate', 'scale', 'reflect', 'distance', 'midpoint', 'slope', 'line', 'circle', 'triangle', 'pythagor', 'rectangle', 'square', 'sphere', 'cylinder', 'cone']):
        try:
            _, geo_steps = geometry.solve_geometry(input_str)
            methods.append(MethodSolutionModel(
                methodId="geom-vector-coordinate",
                methodName="Method 1: Coordinate & Vector Formulation",
                badgeTag="Vector Geometry",
                techniqueSummary="Applies Cartesian coordinate formulas and vector displacement arithmetic.",
                formulaLatex=r"\vec{P}' = \vec{P} + \vec{T} \quad \text{or} \quad d = \|\vec{P}_2 - \vec{P}_1\|",
                steps=to_step_models(geo_steps),
                finalResultLatex=final_solution or "",
                prosAndCons=MethodProsCons(
                    pros="Systematic coordinate calculations easily computed in 2D/3D space.",
                    cons="Relies heavily on accurate coordinate component arithmetic."
                )
            ))
            
            # Method 2: Classical Euclidean / Transformation Matrix
            alt_geo_steps = []
            if 'translate' in input_str.lower() or 'rotate' in input_str.lower() or 'scale' in input_str.lower():
                alt_geo_steps.append(MathStep(
                    description="Construct 3x3 Homogeneous Affine Transformation Matrix",
                    latex=r"\begin{pmatrix} x' \\ y' \\ 1 \end{pmatrix} = \begin{pmatrix} a & b & t_x \\ c & d & t_y \\ 0 & 0 & 1 \end{pmatrix} \begin{pmatrix} x \\ y \\ 1 \end{pmatrix}",
                    type="equation"
                ))
                alt_geo_steps.append(MathStep(
                    description="Multiply homogeneous vector by transformation matrix",
                    latex=rf"\text{{Resulting state: }} {final_solution or ''}",
                    type="equation"
                ))
            elif 'dist' in input_str.lower() or 'pythagor' in input_str.lower():
                alt_geo_steps.append(MathStep(
                    description="Construct right triangle on Cartesian grid with legs Delta x and Delta y",
                    latex=r"c^2 = a^2 + b^2 \implies c = \sqrt{a^2 + b^2}",
                    type="equation"
                ))
                alt_geo_steps.append(MathStep(
                    description="Evaluate hypotenuse length",
                    latex=rf"c = {final_solution or ''}",
                    type="equation"
                ))
            else:
                alt_geo_steps.append(MathStep(
                    description="Apply classical geometric area & volume integration theorems",
                    latex=r"A = \iint_{\mathcal{D}} dA, \quad V = \iiint_{\mathcal{V}} dV",
                    type="equation"
                ))
                alt_geo_steps.append(MathStep(
                    description="Final geometric invariant evaluated",
                    latex=rf"{final_solution or ''}",
                    type="equation"
                ))
            methods.append(MethodSolutionModel(
                methodId="geom-matrix-affine",
                methodName="Method 2: Affine Transformation Matrix / Classical Synthetic",
                badgeTag="Affine & Synthetic",
                techniqueSummary="Employs linear algebraic transformation matrices and synthetic geometric properties.",
                formulaLatex=r"M_{\text{transform}} \mathbf{v} = \mathbf{v}'",
                steps=to_step_models(alt_geo_steps),
                finalResultLatex=final_solution or "",
                prosAndCons=MethodProsCons(
                    pros="Unified approach powering modern computer graphics pipelines and CAD engines.",
                    cons="Requires matrix multiplications and projective coordinate setup."
                )
            ))
        except Exception as e:
            print(f"Error in geometry multi-methods: {e}")

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
    """
    Solves algebraic equations using the 100% scratch pure-Python engine.
    Zero external dependencies (zero SymPy).
    """
    return algebra.solve_algebra_pure(input_str, allow_complex=allow_complex)


@app.post("/api/render")
async def render_video(request: SolveRequest, raw_req: Request, authorization: Optional[str] = Header(None)):
    client_ip = get_client_ip(raw_req)
    
    # Rate limit video rendering: max 6 requests per minute
    is_limited, retry_after = limiter.check_rate_limit(f"render:{client_ip}", max_requests=6, window_seconds=60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Rendering rate limit reached. Please wait {retry_after} seconds.")

    def run_manim(cmd,env):
        subprocess.run(cmd,env=env,cwd=BASE_DIR,capture_output=True,text=True,check=True)

    input_str = sanitize_input_text(request.equation, max_len=1500, field_name="Equation")
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
    elif any(g in input_str.lower() for g in ['translate', 'rotate', 'scale', 'reflect', 'distance', 'midpoint', 'slope', 'circle', 'triangle', 'pythagor', 'hypotenuse', 'rectangle', 'square', 'sphere', 'cylinder', 'cone', 'radius', 'diameter']):
        op = "geometry"
        expr = input_str
    elif bool(re.search(r'\b(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|unit_circle|unitcircle)\b', input_str.lower())):
        op = "trigonometry"
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

    # Run Manim with sanitized environment and strict process sandbox
    env = os.environ.copy()
    sanitized_params = sanitize_env_for_manim(
        math_expr=expr,
        math_op=op,
        method_id=request.method_id or "",
        method_name=request.method_name or ""
    )
    env.update(sanitized_params)
    env["PYTHONPATH"] = f"{BASE_DIR};{os.path.join(BASE_DIR, 'engine')}"
    
    video_id = str(uuid.uuid4())
    try:
        video_script = os.path.join(BASE_DIR, "video.py")
        cmd = ["python", "-m", "manim", quality_flag, "-o", f"{video_id}.mp4", "--disable_caching", "--media_dir", MEDIA_DIR, video_script, "UniversalMathAnimation"]
        def run_manim_safe(cmd, env):
            subprocess.run(cmd, env=env, cwd=BASE_DIR, capture_output=True, text=True, check=True, timeout=120, shell=False)
        await asyncio.to_thread(run_manim_safe, cmd, env)        
        expected_file = os.path.join(MEDIA_DIR, "videos", "video", quality_dir, f"{video_id}.mp4")
        if not os.path.exists(expected_file) and os.path.exists(default_file):
            os.rename(default_file, expected_file)
            
        web_path = f"/api/media/videos/video/{quality_dir}/{video_id}.mp4"
        if user:
            try:
                with db.get_db_context() as session:
                    repository.add_video_generation(
                        db=session,
                        equation=input_str,
                        video_filename=f"{video_id}.mp4",
                        video_url=web_path,
                        resolution=quality,
                        status="completed",
                        user_id=user["id"]
                    )
            except Exception:
                pass
        return {"video_url": web_path}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Rendering timed out. Please try a simpler expression.")
    except subprocess.CalledProcessError as e:
        print(f"Manim error: {e.stderr}")
        raise HTTPException(status_code=500, detail="Video rendering failed. Please check the mathematical syntax and try again.")

@app.post("/api/solve", response_model=EquationSolution)
async def solve_api(request: SolveRequest, raw_req: Request, authorization: Optional[str] = Header(None)):
    client_ip = get_client_ip(raw_req)
    
    # Rate limit solves: max 40 requests per minute
    is_limited, retry_after = limiter.check_rate_limit(f"solve:{client_ip}", max_requests=40, window_seconds=60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Too many solve requests. Please wait {retry_after} seconds.")

    clean_eq = sanitize_input_text(request.equation, max_len=2000, field_name="Equation")
    input_str = normalize_matrix_latex(clean_eq)
    equation_type = "Algebra"
    
    # Tier limits enforcement
    user = None
    if authorization:
        user = get_user_by_token(authorization)
        
    if user:
        is_premium = bool(user["is_premium"])
        user_identifier = f"user:{user['id']}"
    else:
        is_premium = False
        client_ip = raw_req.client.host if raw_req.client else "anonymous"
        user_identifier = f"ip:{client_ip}"
        
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
        geo_keywords = ['translate', 'rotate', 'scale', 'reflect', 'distance', 'midpoint', 'slope', 'circle', 'triangle', 'pythagor', 'hypotenuse', 'rectangle', 'square', 'sphere', 'cylinder', 'cone', 'radius', 'diameter', 'perimeter']
        trig_pattern = r'\b(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|unit_circle|unitcircle)\b'
        
        is_geom = any(g in input_str.lower() for g in geo_keywords) or ('dist(' in input_str.lower()) or ('mid(' in input_str.lower())
        is_trig = bool(re.search(trig_pattern, input_str.lower())) and not input_str.lower().startswith('derive') and not input_str.lower().startswith('integrate')

        # 1. Geometry Engine (Check if explicitly geometric)
        if is_geom and not is_trig:
            equation_type = "Geometry"
            solution, steps = geometry.solve_geometry(input_str)
            
        # 2. Trigonometry Engine
        elif is_trig:
            equation_type = "Trigonometry"
            solution, steps = trigonometry.solve_trigonometry(input_str)

        elif is_geom:
            equation_type = "Geometry"
            solution, steps = geometry.solve_geometry(input_str)

        elif '=' in input_str and not input_str.lower().startswith('integrate') and not input_str.lower().startswith('derive') and not '[' in input_str:
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
            
        elif any(input_str.lower().startswith(s) for s in ['mean', 'median', 'mode', 'variance', 'var(', 'stddev', 'std_dev', 'stdev', 'standard_deviation', 'percentile', 'set_theory', 'union', 'intersection', 'set_op', 'iqr', 'z_score', 'zscore', 'std_score', 'summary', 'stats', 'describe', 'regression', 'linreg', 'linear_regression', 'correlation', 'normal_cdf', 'normal_dist', 't_test', 'ttest', 'two_sample', 'hypothesis', 'z_test', 'confidence', 'proportion', 'chi_square', 'chisq', 'goodness', 'contingency', 'anova', 'random_var', 'expected_value', 'combination', 'permutation', 'multinomial', 'derange', 'binomial', 'poisson', 'geometric', 'hypergeometric', 'exponential', 'uniform', 'spatial', 'centroid', 'centile', 'inter_quarterly', 'bayes', 'prob', 'odds']):
            equation_type = "Statistics"
            solution, steps = statistics.solve_statistics(input_str)
            
        elif 'eigen' in input_str.lower() or 'char' in input_str.lower():
            equation_type = "Linear Algebra"
            matrix_match = re.search(r'\[.*\]', input_str)
            if not matrix_match:
                raise ValueError("No matrix found in input")
            matrix = ast.literal_eval(matrix_match.group(0))
            equation, steps = eigen.eigenvalue(matrix)
            solution = to_string(equation)

        elif any(vk in input_str.lower() for vk in ['dot(', 'cross(', 'proj(', 'angle(', 'triple(', 'vector(']):
            equation_type = "Vectors"
            from engine.vector_engine import solve_vector_operation
            lower_s = input_str.lower()
            if 'cross' in lower_s:
                v_op = 'cross'
            elif 'proj' in lower_s:
                v_op = 'projection'
            elif 'angle' in lower_s:
                v_op = 'angle'
            elif 'triple' in lower_s:
                v_op = 'triple_product'
            else:
                v_op = 'dot'

            inner = re.sub(r'^(?:dot|cross|proj|projection|angle|triple)\s*\((.*)\)\s*$', r'\1', input_str, flags=re.I)
            vecs = re.findall(r'\[.*?\]', inner)
            if not vecs:
                vecs = re.findall(r'\(.*?\)', inner)
            if not vecs:
                vecs = [p.strip() for p in inner.split(',') if p.strip()]

            u_arg = vecs[0] if len(vecs) > 0 else "[1, 0]"
            v_arg = vecs[1] if len(vecs) > 1 else "[0, 1]"
            w_arg = vecs[2] if len(vecs) > 2 else None

            vec_res = solve_vector_operation(v_op, u_arg, v_arg, w_arg)
            solution = vec_res['final_answer']
            steps = [MathStep(description=st['description'], latex=st['latex'], type='equation') for st in vec_res['steps']]

        elif any(ck in input_str.lower() for ck in ['polar(', 'cis(', 'roots(']):
            equation_type = "Complex Numbers"
            from engine.complex_engine import solve_complex_operation
            if 'roots' in input_str.lower():
                m_root = re.search(r'roots\(([^,]+),\s*(\d+)\)', input_str, re.I)
                if m_root:
                    z_val, n_val = m_root.group(1), int(m_root.group(2))
                else:
                    z_val, n_val = input_str.replace("roots(", "").rstrip(")"), 3
                c_res = solve_complex_operation('roots', z_val, n_val=n_val)
            elif 'polar' in input_str.lower():
                z_val = re.sub(r'^polar\s*\((.*)\)\s*$', r'\1', input_str, flags=re.I)
                c_res = solve_complex_operation('details', z_val)
            else:
                c_res = solve_complex_operation('details', input_str)
            solution = c_res['final_answer']
            steps = [MathStep(description=st['description'], latex=st['latex'], type='equation') for st in c_res['steps']]
            
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
                graph_data = GraphData(showGraph=False, viewPort={"minX": -6, "maxX": 6, "minY": -6, "maxY": 6})
                for shape in s.data['shapes']:
                    if shape['type'] == 'circle':
                        annotations.append(SceneAnnotation(
                            type='circle',
                            label=shape.get('color', 'BLUE'),
                            coordinates=[shape['center'][0], shape['center'][1], shape.get('radius', 1.5)]
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
                    elif shape['type'] == 'line':
                        p1 = shape.get('p1', [0, 0])
                        p2 = shape.get('p2', [0, 0])
                        annotations.append(SceneAnnotation(
                            type='line',
                            label=shape.get('label', 'Segment'),
                            coordinates=[p1[0], p1[1], p2[0], p2[1]]
                        ))

            elif equation_type == "Trigonometry":
                if hasattr(s, 'data') and isinstance(s.data, dict) and 'shapes' in s.data:
                    graph_data = GraphData(showGraph=False, viewPort={"minX": -2.2, "maxX": 2.2, "minY": -2.2, "maxY": 2.2})
                    for shape in s.data['shapes']:
                        if shape['type'] == 'circle':
                            annotations.append(SceneAnnotation(
                                type='circle',
                                label=shape.get('color', 'BLUE'),
                                coordinates=[shape['center'][0], shape['center'][1], shape.get('radius', 1.0)]
                            ))
                        elif shape['type'] == 'line':
                            p1 = shape.get('p1', [0, 0])
                            p2 = shape.get('p2', [0, 0])
                            annotations.append(SceneAnnotation(
                                type='line',
                                label=shape.get('label', ''),
                                coordinates=[p1[0], p1[1], p2[0], p2[1]]
                            ))
                else:
                    plot_fn = "sin(x)"
                    if 'cos' in input_str.lower():
                        plot_fn = "cos(x)"
                    elif 'tan' in input_str.lower():
                        plot_fn = "tan(x)"
                    graph_data = GraphData(
                        showGraph=True,
                        functionExpr=plot_fn,
                        functionLabel=f"f(x) = {plot_fn}",
                        viewPort={"minX": -7, "maxX": 7, "minY": -2.5, "maxY": 2.5}
                    )

            elif equation_type == "Algebra":
                clean_fn = input_str.split('=')[0].strip() if '=' in input_str else input_str
                roots_found = None
                vertex_found = None
                try:
                    poly_obj, var_x, _, _ = algebra.parse_equation_to_poly(input_str)
                    clean_fn = to_string(poly_obj.to_node()).replace('**', '^') if hasattr(poly_obj, 'to_node') else input_str
                    if poly_obj.degree == 2:
                        a_c = poly_obj.coeffs.get(2, 0)
                        b_c = poly_obj.coeffs.get(1, 0)
                        c_c = poly_obj.coeffs.get(0, 0)
                        if a_c != 0:
                            vx = -b_c / (2 * a_c)
                            vy = a_c * vx * vx + b_c * vx + c_c
                            vertex_found = {"x": round(vx, 2), "y": round(vy, 2)}
                            disc = b_c * b_c - 4 * a_c * c_c
                            if disc >= 0:
                                roots_found = [round((-b_c - disc**0.5) / (2 * a_c), 2), round((-b_c + disc**0.5) / (2 * a_c), 2)]
                    elif poly_obj.degree == 1:
                        a_c = poly_obj.coeffs.get(1, 0)
                        c_c = poly_obj.coeffs.get(0, 0)
                        if a_c != 0:
                            roots_found = [round(-c_c / a_c, 2)]
                except Exception:
                    clean_fn = input_str.split('=')[0].strip() if '=' in input_str else input_str

                graph_data = GraphData(
                    showGraph=True,
                    functionExpr=clean_fn,
                    functionLabel=f"f(x) = {clean_fn}",
                    roots=roots_found,
                    vertex=vertex_found
                )

            elif equation_type == "Calculus" and not graph_data.showGraph:
                # For integrals or other calculus expressions without node
                calc_fn = input_str
                if input_str.lower().startswith('integrate'):
                    calc_match = re.search(r'integrate\((.*?)(?:,|$|\))', input_str, re.I)
                    calc_fn = calc_match.group(1).strip() if calc_match else input_str[9:].strip(' ()')
                graph_data = GraphData(
                    showGraph=True,
                    functionExpr=calc_fn,
                    functionLabel=f"f(x) = {calc_fn}"
                )


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
        if user:
            try:
                with db.get_db_context() as session:
                    repository.add_problem_history(
                        db=session,
                        equation=input_str,
                        problem_type=equation_type,
                        result_latex=solution,
                        steps=steps,
                        user_id=user["id"],
                        completed=True
                    )
            except Exception:
                pass

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
        err_msg = str(e)
        if any(term in err_msg.lower() for term in ["traceback", "file ", "line ", "c:\\", "/usr/"]):
            err_msg = "Invalid mathematical expression or unsupported equation format."
        raise HTTPException(status_code=400, detail=err_msg)

@app.get("/api/status")
def read_root():
    return {"status": "active", "engine": "Axiom v4.0"}

class FunctionAnalysisRequest(BaseModel):
    function: str
    domain_min: Optional[float] = -10.0
    domain_max: Optional[float] = 10.0

@app.post("/api/function/analyze")
async def analyze_function_api(request: FunctionAnalysisRequest):
    if not request.function or not request.function.strip():
        raise HTTPException(status_code=400, detail="Function expression cannot be empty.")
    try:
        domain_min = request.domain_min if request.domain_min is not None else -10.0
        domain_max = request.domain_max if request.domain_max is not None else 10.0
        res = function_analyzer.analyze_function(request.function.strip(), domain_min=domain_min, domain_max=domain_max)
        return res
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Function analysis error: {str(e)}")


class ProofRequest(BaseModel):
    statement: str
    method: Optional[str] = "auto"
    domain: Optional[str] = None

@app.post("/api/proof/prove")
def prove_statement_api(request: ProofRequest):
    if not request.statement or not request.statement.strip():
        raise HTTPException(status_code=400, detail="Proof statement cannot be empty.")
    try:
        res = proof_engine.prove_statement(
            statement=request.statement.strip(),
            method=request.method or "auto",
            domain=request.domain
        )
        return res
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Proof Engine error: {str(e)}")

@app.get("/api/proof/library")
def get_proof_library_api():
    try:
        return proof_engine.get_proof_library()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class VerifyProofStepRequest(BaseModel):
    current_expr: str
    next_step: str
    target_expr: Optional[str] = None

@app.post("/api/proof/verify-step")
def verify_proof_step_api(request: VerifyProofStepRequest):
    if not request.current_expr or not request.next_step:
        raise HTTPException(status_code=400, detail="Expressions cannot be empty.")
    try:
        return proof_engine.verify_proof_step(
            current_expr=request.current_expr.strip(),
            user_next_step=request.next_step.strip(),
            target_expr=request.target_expr.strip() if request.target_expr else None
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class WordProblemRequest(BaseModel):

    question: str

@app.post("/api/word-problem/solve")
async def solve_word_problem_api(request: WordProblemRequest, raw_req: Request):
    client_ip = get_client_ip(raw_req)
    is_limited, retry_after = limiter.check_rate_limit(f"wp_solve:{client_ip}", max_requests=25, window_seconds=60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Word problem rate limit reached. Please wait {retry_after} seconds.")
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    clean_q = sanitize_input_text(request.question, max_len=3000, field_name="Word problem question")
    is_inj, pattern = detect_prompt_injection(clean_q)
    if is_inj:
        log_security_event("AI_PROMPT_INJECTION_BLOCKED", "ALERT", client_ip, "/api/word-problem/solve", {"matched_pattern": pattern})
        raise HTTPException(status_code=400, detail="Adversarial prompt injection pattern detected in input.")

    is_on_subject, subject_reason = is_query_on_subject(clean_q)
    if not is_on_subject:
        record_off_topic_blocked()
        log_security_event("AI_OFF_TOPIC_BLOCKED", "INFO", client_ip, "/api/word-problem/solve", {"reason": subject_reason})
        raise HTTPException(status_code=400, detail="Word problem solver only accepts mathematical, geometric, algebraic, or STEM word problems.")
    try:
        from word_problem import run_word_problem_pipeline
        response = await run_word_problem_pipeline(clean_q)
        return response
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Word problem solver encountered an error: {str(e)}")

@app.get("/api/word-problem/presets")
def get_word_problem_presets():
    return [
        {
            "id": "motion_catchup",
            "category": "Motion & Kinematics",
            "title": "Two Trains Catch-Up",
            "question": "A train leaves Chicago traveling at 60 mph. Two hours later another train leaves from the same station traveling at 90 mph in the same direction. When will the second train catch up?",
            "difficulty": "Intermediate",
            "tag": "d1 = d2"
        },
        {
            "id": "geometry_pythagorean",
            "category": "Geometry & Triangles",
            "title": "Right Triangle Hypotenuse & Leg",
            "question": "The hypotenuse of a right triangle is 13 cm and one leg is 5 cm. What is the length of the other leg and the triangle area?",
            "difficulty": "Basic",
            "tag": "a^2 + b^2 = c^2"
        },
        {
            "id": "geometry_rectangle",
            "category": "Geometry & Optimization",
            "title": "Rectangular Garden Dimensions",
            "question": "A rectangular garden has a perimeter of 54 meters and an area of 180 square meters. Find its length and width.",
            "difficulty": "Intermediate",
            "tag": "Quadratic / Dimensions"
        },
        {
            "id": "work_rate_pipes",
            "category": "Work & Rates",
            "title": "Combined Work Rate",
            "question": "Worker A can complete a job alone in 4 hours, and Worker B can complete the same job alone in 6 hours. How long will it take if they work together?",
            "difficulty": "Intermediate",
            "tag": "1/t1 + 1/t2 = 1/T"
        },
        {
            "id": "linear_system_tickets",
            "category": "Systems of Equations",
            "title": "Event Ticket Sales System",
            "question": "A school theater sold 50 tickets for a total of $310. Student tickets cost $5 each and adult tickets cost $8 each. How many of each ticket were sold?",
            "difficulty": "Intermediate",
            "tag": "2x2 Linear System"
        }
    ]

class WordProblemVideoRenderRequest(BaseModel):
    title: str
    scenes: List[Dict[str, Any]]

@app.post("/api/word-problem/video/render-manim")
async def render_word_problem_manim_api(request: WordProblemVideoRenderRequest, raw_req: Request):
    client_ip = get_client_ip(raw_req)
    is_limited, retry_after = limiter.check_rate_limit(f"wp_render:{client_ip}", max_requests=6, window_seconds=60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Word problem rendering rate limit reached. Please wait {retry_after} seconds.")
    
    request.title = sanitize_input_text(request.title, max_len=200, field_name="Title")
    if len(request.scenes) > 25:
        raise HTTPException(status_code=400, detail="Maximum 25 scenes allowed per render.")

    try:
        from video import render_word_problem_manim
        filename = f"word_problem_{uuid.uuid4().hex[:8]}.mp4"
        output_path = os.path.join(MEDIA_DIR, "videos", "1080p60", filename)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, render_word_problem_manim, request.scenes, request.title, output_path)
        
        return {
            "success": True,
            "filename": filename,
            "video_url": f"/api/media/videos/1080p60/{filename}"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Manim render error: {str(e)}")

# =============================================================================
# GEOMETRY SOLVER & AI TEACHER PIPELINE
# =============================================================================

class GeometrySolveApiRequest(BaseModel):
    question: str
    api_key: Optional[str] = None

class GeometryAskTeacherApiRequest(BaseModel):
    question: Optional[str] = ""
    context_problem: str
    student_query: str
    part_id: Optional[str] = None
    api_key: Optional[str] = None

@app.post("/api/geometry/solve")
async def solve_geometry_api(request: GeometrySolveApiRequest):
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Geometry question cannot be empty.")
    try:
        from engine.geometry_pipeline import run_geometry_pipeline
        response = await run_geometry_pipeline(request.question.strip(), api_key=request.api_key)
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Geometry pipeline error: {str(e)}")

@app.get("/api/geometry/presets")
def get_geometry_presets():
    return [
        {
            "id": "bagrut_trapezoid_incircle",
            "category": "Advanced Matriculation (Bagrut 5-Units)",
            "title": "Trapezoid ABCD with Incircle & Similarity",
            "question": (
                "Trapezoid ABCD (AB parallel DC).\n"
                "It is given that the length of base AB is equal to the length of side BC.\n"
                "Let AB = BC = k and angle ABC = alpha (where 0^circ < alpha < 90^circ).\n"
                "a. Show that AC = 2k cos(90^circ - alpha/2) = 2k sin(alpha/2).\n"
                "It is given that AD = sqrt(3)k and DC = 2k.\n"
                "b. Find the value of alpha.\n"
                "c. Find the measure of angle ADC.\n"
                "The extensions of sides DA and CB intersect at point E.\n"
                "It is given that the radius of the incircle of triangle EDC is 14.\n"
                "d. Find the value of k."
            ),
            "difficulty": "Advanced",
            "tags": ["Trapezoid", "Trigonometry", "Law of Cosines", "Incircle", "Similarity"]
        },
        {
            "id": "right_triangle_incircle",
            "category": "Euclidean Geometry",
            "title": "Right Triangle Hypotenuse & Inradius",
            "question": (
                "In right triangle ABC with right angle at C, leg AC = 12 and leg BC = 5.\n"
                "a. Find the hypotenuse AB.\n"
                "b. Find the radius of the incircle of triangle ABC.\n"
                "c. Find the area of the incircle and the ratio of incircle area to triangle area."
            ),
            "difficulty": "Intermediate",
            "tags": ["Right Triangle", "Pythagorean", "Inradius"]
        },
        {
            "id": "cyclic_quadrilateral_ptolemy",
            "category": "Olympiad Geometry",
            "title": "Cyclic Quadrilateral with Inscribed Angles",
            "question": (
                "Quadrilateral ABCD is inscribed in a circle with diameter AC = 10.\n"
                "Given AB = 6, BC = 8, and angle ADC = 90^circ.\n"
                "a. Prove that AC is a diameter of the circumcircle.\n"
                "b. Find the perimeter and area of quadrilateral ABCD."
            ),
            "difficulty": "Advanced",
            "tags": ["Circle", "Cyclic Quadrilateral", "Inscribed Angle"]
        },
        {
            "id": "bagrut_582_vectors_pyramid",
            "category": "Bagrut 582 (3D Vectors)",
            "title": "Triangular Pyramid Vector Concurrency & Face Orthogonality",
            "question": (
                "In triangular pyramid SABC, let SA = u, SB = v, and SC = w.\n"
                "Given that |u| = |v| = |w| = 6 and u · v = v · w = w · u = 18.\n"
                "a. Find the angle between each pair of lateral edges.\n"
                "b. Let M be the centroid of the base ABC. Express SM in terms of u, v, w.\n"
                "c. Prove that the altitude from S passes through centroid M."
            ),
            "difficulty": "Advanced",
            "tags": ["Vectors", "3D Geometry", "Pyramid", "Centroid", "Dot Product"]
        },
        {
            "id": "bagrut_582_complex_square",
            "category": "Bagrut 582 (Complex Geometry)",
            "title": "Square in the Argand Plane & Roots Equation",
            "question": (
                "In the complex Argand plane, points A, B, C, D represent the vertices of a square.\n"
                "The vertices are the solutions to the complex equation (z - 2)^4 = -16.\n"
                "a. Find the four roots of the equation in rectangular and polar form.\n"
                "b. Plot the vertices on the complex plane and show they form a square.\n"
                "c. Find the center and area of the square."
            ),
            "difficulty": "Advanced",
            "tags": ["Complex Numbers", "Argand Plane", "Roots of Unity", "Square"]
        }
    ]

@app.post("/api/geometry/ask-teacher")
async def ask_geometry_teacher_api(request: GeometryAskTeacherApiRequest, raw_req: Request):
    client_ip = get_client_ip(raw_req)

    # 1. AI Rate Limiting
    check_ai_rate_limit(client_ip=client_ip, endpoint="/api/geometry/ask-teacher", is_stream=False)

    if not request.student_query or not request.student_query.strip():
        raise HTTPException(status_code=400, detail="Student query cannot be empty.")

    # 2. Input Sanitization
    request.student_query = sanitize_input_text(request.student_query, max_len=AI_MAX_MESSAGE_CHARS, field_name="Student query")
    if request.context_problem:
        request.context_problem = sanitize_input_text(request.context_problem, max_len=AI_MAX_CONTEXT_CHARS, field_name="Problem context")
    if request.api_key:
        request.api_key = sanitize_ai_api_key(request.api_key)

    # 3. Prompt Injection Defense
    is_inj, pattern = detect_prompt_injection(request.student_query)
    if is_inj:
        log_security_event("AI_PROMPT_INJECTION_BLOCKED", "ALERT", client_ip, "/api/geometry/ask-teacher", {"matched_pattern": pattern})
        return {
            "reply": "I am Axiom, your AI Geometry Teacher. Let's focus on geometric proofs, theorems, and angle relationships for this problem! What geometric step can I help clarify?",
            "hints": ["Review angle relationships and parallel transversal theorems."],
            "suggested_next_steps": ["Examine step-by-step geometric proof"]
        }

    # 4. Subject Boundary Check (Mathematics & Geometry Only)
    is_on_subject, subject_reason = is_query_on_subject(request.student_query, request.context_problem)
    if not is_on_subject:
        record_off_topic_blocked()
        log_security_event("AI_OFF_TOPIC_BLOCKED", "INFO", client_ip, "/api/geometry/ask-teacher", {"reason": subject_reason})
        return {
            "reply": "I am Axiom, your AI Geometry Teacher! I can only answer questions strictly related to geometry, theorems, and mathematical problems. Please ask a geometry question about this problem!",
            "hints": ["Review the geometric diagram and theorem relations."],
            "suggested_next_steps": ["Ask about this geometry step"]
        }

    try:
        # Utilize existing LLM (NVIDIA / Gemini / Heuristic)
        nvidia_key = request.api_key or os.environ.get("NVIDIA_API_KEY")
        gemini_key = os.environ.get("GEMINI_API_KEY")

        prompt = (
            f"You are Axiom, an expert, encouraging geometry teacher for high school & competition math.\n"
            f"Problem context:\n{request.context_problem}\n"
            f"Current sub-part: {request.part_id or 'General'}\n"
            f"Student Question: {request.student_query}\n"
            f"Explain clearly and concisely in 2-4 sentences using LaTeX ($...$) for math formulas. Give an intuitive geometric or trigonometric reason."
        )

        reply_text = ""
        if gemini_key:
            try:
                from google import genai
                client = genai.Client(api_key=gemini_key)
                resp = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt
                )
                if resp and resp.text:
                    reply_text = resp.text.strip()
            except Exception:
                pass

        if not reply_text and nvidia_key:
            try:
                reply_text, _, _ = call_nvidia_nemotron(
                    messages=[
                        {"role": "system", "content": "You are Axiom, a world-class AI Geometry Teacher."},
                        {"role": "user", "content": prompt}
                    ],
                    enable_thinking=False,
                    api_key=nvidia_key
                )
            except Exception:
                pass

        if not reply_text:
            # Heuristic high-quality response
            q_lower = request.student_query.lower()
            if "similarity" in q_lower or "similar" in q_lower or "eab" in q_lower:
                reply_text = (
                    "Triangles $EAB$ and $EDC$ are similar by the **AA (Angle-Angle) Similarity Theorem**! "
                    "Because $AB \\parallel DC$, line $ED$ acts as a transversal making $\\angle EAB = \\angle EDC$ (corresponding angles), "
                    "and line $EC$ makes $\\angle EBA = \\angle ECD$. Since two pairs of angles are equal, the triangles are similar with ratio $AB/DC = 1/2$."
                )
            elif "part a" in q_lower or "cos" in q_lower or "sin" in q_lower or "ac" in q_lower:
                reply_text = (
                    "In isosceles triangle $ABC$, the two legs are $AB = BC = k$. By drawing an altitude from vertex $B$ perpendicular to $AC$, "
                    "it bisects base $AC$ into two halves of length $k \\sin(\\alpha/2)$ (or $k \\cos(90^\\circ - \\alpha/2)$). "
                    "Multiplying by 2 yields $AC = 2k \\sin(\\alpha/2)$!"
                )
            elif "incircle" in q_lower or "radius" in q_lower or "14" in q_lower or "k" in q_lower:
                reply_text = (
                    "For any triangle, the inradius formula is $r = \\frac{\\text{Area}}{s}$, where $s = \\frac{a+b+c}{2}$ is the semiperimeter. "
                    "Because all side lengths of $\\triangle EDC$ are linear in $k$, the area is proportional to $k^2$ and the semiperimeter is proportional to $k$. "
                    "Dividing them gives $r = c_r \\cdot k = 14$, allowing us to solve directly for $k$!"
                )
            else:
                reply_text = (
                    f"Great question! Remember that in trapezoids with parallel bases ($AB \\parallel DC$), "
                    f"alternate interior angles are equal ($\\angle DCA = \\angle CAB$) and extending the legs yields similar triangles $\\triangle EAB \\sim \\triangle EDC$. "
                    f"Use this geometric symmetry to relate each part back to the parameter $k$!"
                )

        return {
            "reply": sanitize_ai_response(reply_text),
            "hints": [
                "Notice that AB ∥ DC gives alternate interior angles ∠DCA = ∠CAB.",
                "△EAB ∼ △EDC with ratio 1:2 means A and B are midpoints of ED and EC.",
                "Incircle radius r = Area / semiperimeter connects area to side lengths."
            ],
            "suggested_next_steps": [
                "Examine Part a derivation in the Proof column",
                "Toggle the extensions and incircle in the diagram",
                "Verify the 30°-60°-90° right triangle property of △ADC"
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        log_security_event("AI_TEACHER_ERROR", "WARNING", client_ip, "/api/geometry/ask-teacher", {"error": str(e)})
        raise HTTPException(status_code=500, detail="The AI Geometry Teacher encountered a processing error. Please try again.")

# =========================================================================
# COMPLEX NUMBERS AND VECTOR API ENDPOINTS
# =========================================================================

class ComplexSolveApiRequest(BaseModel):
    operation: str
    z1: str
    z2: Optional[str] = None
    n: Optional[int] = None

@app.post("/api/complex/solve")
async def solve_complex_api(request: ComplexSolveApiRequest):
    if not request.z1 or not request.z1.strip():
        raise HTTPException(status_code=400, detail="Complex number z1 cannot be empty.")
    try:
        from engine.complex_engine import solve_complex_operation
        res = solve_complex_operation(
            op=request.operation,
            z1_str=request.z1,
            z2_str=request.z2,
            n_val=request.n
        )
        return res
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Complex engine error: {str(e)}")

@app.get("/api/complex/presets")
def get_complex_presets_api():
    from engine.complex_engine import get_complex_presets
    return get_complex_presets()

class VectorSolveApiRequest(BaseModel):
    operation: str
    u: str
    v: Optional[str] = None
    w: Optional[str] = None
    scalar_c: Optional[float] = None

@app.post("/api/vector/solve")
async def solve_vector_api(request: VectorSolveApiRequest):
    if not request.u or not request.u.strip():
        raise HTTPException(status_code=400, detail="Vector u cannot be empty.")
    try:
        from engine.vector_engine import solve_vector_operation
        res = solve_vector_operation(
            op=request.operation,
            u_str=request.u,
            v_str=request.v,
            w_str=request.w,
            scalar_c=request.scalar_c
        )
        return res
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Vector engine error: {str(e)}")

@app.get("/api/vector/presets")
def get_vector_presets_api():
    from engine.vector_engine import get_vector_presets
    return get_vector_presets()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=4000, reload=True)



