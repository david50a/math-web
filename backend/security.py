import os
import re
import time
import json
import secrets
import hashlib
import sqlite3
import jwt
from typing import Optional, Tuple, Dict, List, Any
from fastapi import HTTPException, Request

# Security Configuration Constants
SESSION_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "scholar-axiom-mathematical-jwt-secure-secret-key-32bytes-hex-99221144")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 3600 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_SECONDS = 3600 * 24 * 30  # 30 days
RESET_CODE_EXPIRE_SECONDS = 900  # 15 minutes
MAX_PASSWORD_LENGTH = 128
MIN_PASSWORD_LENGTH = 8
MAX_EQUATION_LENGTH = 2000
MAX_TEXT_PAYLOAD_LENGTH = 50000
MAX_IMAGE_BASE64_BYTES = 15 * 1024 * 1024  # 15 MB

ALLOWED_MEDIA_EXTENSIONS = {".mp4", ".png", ".jpg", ".jpeg", ".svg", ".webm", ".gif"}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIT_LOG_PATH = os.path.join(BASE_DIR, "security_audit.log")

# In-memory circular buffer for recent security events (for live telemetry)
_recent_security_events: List[Dict[str, Any]] = []
_MAX_BUFFERED_EVENTS = 50


def log_security_event(event_type: str, severity: str, client_ip: str, endpoint: str, details: Optional[Dict[str, Any]] = None):
    """
    Appends a structured JSON security audit record and updates in-memory telemetry buffer.
    Severity: 'INFO', 'WARNING', 'ALERT', 'CRITICAL'
    """
    event = {
        "timestamp": time.time(),
        "iso_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "event_type": event_type,
        "severity": severity,
        "client_ip": client_ip,
        "endpoint": endpoint,
        "details": details or {}
    }

    # Add to in-memory telemetry buffer
    _recent_security_events.append(event)
    if len(_recent_security_events) > _MAX_BUFFERED_EVENTS:
        _recent_security_events.pop(0)

    # Persist asynchronously / safely to disk
    try:
        log_line = json.dumps(event) + "\n"
        with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        print(f"Failed to write security audit log: {e}")


class RateLimiter:
    """
    Sliding-window in-memory rate limiter with brute-force protection,
    automatic expired entry pruning, and telemetry tracking.
    """
    def __init__(self):
        self._requests: Dict[str, List[float]] = {}
        self._failed_attempts: Dict[str, List[float]] = {}
        self._last_cleanup = time.time()

    def _cleanup_old_entries(self):
        now = time.time()
        # Clean every 5 minutes to prevent memory growth
        if now - self._last_cleanup < 300:
            return
        self._last_cleanup = now
        cutoff = now - 3600  # keep at most 1 hour history

        for k in list(self._requests.keys()):
            self._requests[k] = [t for t in self._requests[k] if t > cutoff]
            if not self._requests[k]:
                del self._requests[k]

        for k in list(self._failed_attempts.keys()):
            self._failed_attempts[k] = [t for t in self._failed_attempts[k] if t > cutoff]
            if not self._failed_attempts[k]:
                del self._failed_attempts[k]

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Returns (is_limited, retry_after_seconds).
        """
        self._cleanup_old_entries()
        now = time.time()
        cutoff = now - window_seconds
        
        timestamps = [t for t in self._requests.get(key, []) if t > cutoff]
        if len(timestamps) >= max_requests:
            retry_after = int(timestamps[0] + window_seconds - now) + 1
            return True, max(1, retry_after)
            
        timestamps.append(now)
        self._requests[key] = timestamps
        return False, 0

    def record_failure(self, key: str):
        now = time.time()
        cutoff = now - 1800  # 30 min window for failures
        attempts = [t for t in self._failed_attempts.get(key, []) if t > cutoff]
        attempts.append(now)
        self._failed_attempts[key] = attempts

    def is_locked_out(self, key: str, max_failures: int = 5, lock_duration: int = 600) -> Tuple[bool, int]:
        """
        Check if key has reached maximum failed attempts and is locked out.
        Returns (is_locked, remaining_lock_seconds).
        """
        now = time.time()
        cutoff = now - lock_duration
        attempts = [t for t in self._failed_attempts.get(key, []) if t > cutoff]
        self._failed_attempts[key] = attempts
        
        if len(attempts) >= max_failures:
            remaining = int(attempts[-1] + lock_duration - now) + 1
            return True, max(1, remaining)
        return False, 0

    def reset_failures(self, key: str):
        if key in self._failed_attempts:
            del self._failed_attempts[key]

    def get_stats(self) -> Dict[str, Any]:
        now = time.time()
        active_lockouts = 0
        for attempts in self._failed_attempts.values():
            recent = [t for t in attempts if t > now - 600]
            if len(recent) >= 5:
                active_lockouts += 1
        return {
            "tracked_rate_keys": len(self._requests),
            "tracked_failure_keys": len(self._failed_attempts),
            "active_lockouts": active_lockouts
        }


# Global rate limiter instance
limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    """Extract client IP safely from forwarded headers or direct connection."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def constant_time_verify(stored_password: str, provided_password: str) -> bool:
    """
    Prevents side-channel timing attacks by verifying password hashes
    in constant time using secrets.compare_digest.
    """
    try:
        salt_hex, key_hex = stored_password.split(":")
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


def validate_email_format(email: str) -> Tuple[bool, str]:
    if not email:
        return False, "Email address is required."
    clean = email.strip()
    if len(clean) > 254:
        return False, "Email address exceeds maximum length (254 characters)."
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(pattern, clean):
        return False, "Please provide a valid email address format."
    return True, ""


def validate_password_strength(password: str) -> Tuple[bool, str]:
    if not password:
        return False, "Password is required."
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
    if len(password) > MAX_PASSWORD_LENGTH:
        return False, f"Password cannot exceed {MAX_PASSWORD_LENGTH} characters."
    if not re.search(r"[A-Za-z]", password):
        return False, "Password must contain at least one alphabetical letter."
    if not re.search(r"[0-9!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one digit or special character."
    return True, ""


# --- JWT Token Management & Authentication Helpers ---

def create_access_token(user_id: str, email: str, is_premium: bool = False, custom_claims: Optional[Dict[str, Any]] = None) -> str:
    """
    Creates a signed JWT Access Token with 24h validity.
    """
    now = time.time()
    payload = {
        "sub": user_id,
        "email": email.strip().lower(),
        "is_premium": bool(is_premium),
        "type": "access",
        "iat": int(now),
        "exp": int(now + ACCESS_TOKEN_EXPIRE_SECONDS)
    }
    if custom_claims:
        payload.update(custom_claims)
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, email: str) -> str:
    """
    Creates a signed JWT Refresh Token with 30-day validity.
    """
    now = time.time()
    payload = {
        "sub": user_id,
        "email": email.strip().lower(),
        "type": "refresh",
        "iat": int(now),
        "exp": int(now + REFRESH_TOKEN_EXPIRE_SECONDS)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes and verifies a JWT token. Returns payload dict or None if invalid or expired.
    """
    if not token:
        return None
    clean = token.replace("Bearer ", "").strip()
    try:
        return jwt.decode(clean, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None


# --- Ephemeral Password Reset Verification Code Store ---
_password_reset_codes: Dict[str, Dict[str, Any]] = {}

def create_password_reset_code(email: str) -> str:
    """
    Generates a secure 6-digit verification code with 15-minute expiration.
    """
    code = f"{secrets.randbelow(900000) + 100000:06d}"
    now = time.time()
    _password_reset_codes[email.strip().lower()] = {
        "code": code,
        "expires_at": now + RESET_CODE_EXPIRE_SECONDS
    }
    return code


def verify_password_reset_code(email: str, code: str) -> bool:
    """
    Verifies that a reset code matches and has not expired.
    """
    clean_email = email.strip().lower()
    entry = _password_reset_codes.get(clean_email)
    if not entry:
        return False
    if entry["expires_at"] < time.time():
        del _password_reset_codes[clean_email]
        return False
    return secrets.compare_digest(str(entry["code"]), str(code).strip())


def consume_password_reset_code(email: str):
    """
    Invalidates a used password reset code.
    """
    clean_email = email.strip().lower()
    if clean_email in _password_reset_codes:
        del _password_reset_codes[clean_email]


def sanitize_input_text(text: Optional[str], max_len: int = MAX_EQUATION_LENGTH, field_name: str = "Input") -> str:
    if text is None:
        return ""
    if "\x00" in text:
        raise HTTPException(status_code=400, detail=f"Null bytes are disallowed in {field_name}.")
    clean = text.strip()
    if len(clean) > max_len:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} length ({len(clean)}) exceeds the safety limit of {max_len} characters."
        )
    return clean


def sanitize_base64_image(b64_str: Optional[str], max_bytes: int = MAX_IMAGE_BASE64_BYTES) -> str:
    if not b64_str:
        raise HTTPException(status_code=400, detail="No image payload provided.")
    clean = b64_str.strip()
    if len(clean) * 3 / 4 > max_bytes:
        raise HTTPException(status_code=413, detail=f"Image payload exceeds maximum allowed size ({max_bytes // (1024*1024)}MB).")
    return clean


def verify_media_path(media_dir: str, relative_file_path: str) -> str:
    """
    Prevents directory traversal, verifies path strictly resides within media_dir,
    and validates permitted file extensions.
    """
    if "\x00" in relative_file_path:
        raise HTTPException(status_code=400, detail="Invalid character in path.")

    norm_media_dir = os.path.abspath(media_dir)
    full_path = os.path.abspath(os.path.join(norm_media_dir, relative_file_path))

    try:
        if os.path.commonpath([norm_media_dir, full_path]) != norm_media_dir:
            raise HTTPException(status_code=403, detail="Access denied: Directory traversal detected.")
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied: Invalid path.")

    _, ext = os.path.splitext(full_path)
    if ext.lower() not in ALLOWED_MEDIA_EXTENSIONS:
        raise HTTPException(status_code=403, detail="Access denied: File type not permitted.")

    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Requested media file not found.")

    return full_path


def sanitize_env_for_manim(math_expr: str, math_op: str, method_id: str = "", method_name: str = "") -> Dict[str, str]:
    """
    Cleanses parameters passed to Manim subprocesses, removing control characters,
    newlines, and null bytes to avoid environment variable injection.
    """
    def clean(val: str, max_chars: int = 1500) -> str:
        if not val:
            return ""
        # Strip control characters including \r, \n, \0
        sanitized = re.sub(r'[\r\n\x00-\x1f\x7f-\x9f]', '', str(val)).strip()
        return sanitized[:max_chars]

    return {
        "MATH_EXPR": clean(math_expr, 1500),
        "MATH_OP": clean(math_op, 50),
        "MATH_METHOD_ID": clean(method_id, 100),
        "MATH_METHOD_NAME": clean(method_name, 200)
    }


# =====================================================================
# AI API Security & Guardrail Protection
# =====================================================================
AI_MAX_MESSAGES = 25
AI_MAX_MESSAGE_CHARS = 3000
AI_MAX_CONTEXT_CHARS = 4000
AI_MAX_TOTAL_CHARS = 25000
AI_CHAT_RATE_LIMIT = 25        # Max 25 chat requests per minute per IP
AI_STREAM_RATE_LIMIT = 15      # Max 15 streaming requests per minute per IP
AI_TEACHER_RATE_LIMIT = 20     # Max 20 geometry teacher requests per minute per IP
AI_RATE_LIMIT_WINDOW = 60      # 60-second sliding window

_ai_security_stats = {
    "total_ai_requests": 0,
    "blocked_prompt_injections": 0,
    "off_topic_queries_blocked": 0,
    "rate_limited_ai_requests": 0,
    "sanitized_ai_payloads": 0
}

PROMPT_INJECTION_PATTERNS = [
    re.compile(r"(?i)\b(ignore|disregard|forget|override|bypass)\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts|rules|commands|directives)"),
    re.compile(r"(?i)\b(you are now|act as|pretend to be|roleplay as)\s+(unrestricted|dan|jailbreak|chaos|evil|root|an?\s+administrator|a\s+hacker|god\s+mode)"),
    re.compile(r"(?i)\b(system\s+prompt|reveal\s+(the|your)\s+(system\s+)?(prompt|instructions)|print\s+(the|your)\s+initial\s+prompt|show\s+(me\s+)?the\s+system\s+prompt)"),
    re.compile(r"(?i)\b(output\s+(all|everything)\s+above|repeat\s+(all|everything)\s+above|leak\s+api\s*key)"),
    re.compile(r"(?i)\b(disable|turn\s+off|bypass)\s+(all\s+)?(safety|guardrails?|content\s+filter|security)"),
    re.compile(r"(?i)\b(developer\s+mode\s+output|unfiltered\s+mode|simulate\s+jailbroken)"),
    re.compile(r"(?i)\b(base64|rot13|hex)\s+(decode|encoded)\s+(system\s+instructions|prompt)"),
]

# Mathematical Symbols and LaTeX Operators
MATH_SYMBOLS_REGEX = re.compile(
    r"[\=\+\-\*\/\^\<\>≤≥≠±≈×÷√]|\\(?:frac|sqrt|int|sum|lim|cdot|times|div|sin|cos|tan|cot|sec|csc|alpha|beta|gamma|theta|pi|lambda|Delta|sigma|omega|partial|nabla|vec|hat|bar|matrix|pmatrix|bmatrix|text|displaystyle)"
)

# Core STEM / Mathematics Curriculum Vocabulary
MATH_TERMS_REGEX = re.compile(
    r"\b("
    r"math|maths|mathematics|arithmetic|algebra|algebraic|calculus|geometry|geometric|trig|trigonometry|"
    r"equation|inequality|formula|formulas|variable|variables|unknown|coefficient|coefficients|constant|constants|term|terms|"
    r"polynomial|binomial|quadratic|linear|cubic|quartic|monomial|degree|"
    r"factor|factoring|factorize|factorization|simplify|simplification|expand|expansion|isolate|fraction|fractions|numerator|denominator|"
    r"ratio|ratios|proportion|proportions|percent|percentage|exponent|exponents|exponential|power|powers|root|roots|square\s+root|cube\s+root|radical|radicals|"
    r"log|logarithm|logarithms|ln|modulus|modulo|prime|primes|gcd|lcm|integer|integers|rational|irrational|complex\s+numbers?|imaginary|"
    r"matrix|matrices|determinant|determinants|eigen|eigenvalue|eigenvalues|eigenvector|eigenvectors|vector|vectors|dot\s+product|cross\s+product|magnitude|transpose|inverse|"
    r"shape|shapes|polygon|polygons|triangle|triangles|quadrilateral|quadrilaterals|rectangle|rectangles|square|squares|parallelogram|rhombus|trapezoid|trapezium|"
    r"pentagon|hexagon|octagon|circle|circles|ellipse|ellipses|parabola|parabolas|hyperbola|hyperbolas|"
    r"sphere|cylinder|cone|pyramid|prism|polyhedron|angle|angles|degree|degrees|radian|radians|vertex|vertices|edge|edges|side|sides|diagonal|diagonals|"
    r"perimeter|area|volume|surface\s+area|circumference|radius|radii|diameter|chord|chords|arc|arcs|sector|sectors|segment|segments|tangent|secant|inradius|circumradius|"
    r"altitude|altitudes|median|medians|bisector|bisectors|perpendicular|parallel|hypotenuse|pythagoras|pythagorean|similar|similarity|congruent|congruence|"
    r"sin|sine|cos|cosine|tan|tangent|cot|cotangent|sec|secant|csc|cosecant|arcsin|arccos|arctan|unit\s+circle|"
    r"theorem|theorems|proof|proofs|prove|proving|axiom|axioms|postulate|lemma|corollary|q\.e\.d|"
    r"limit|limits|continuity|continuous|derivative|derivatives|differentiation|differentiate|differentiating|derive|deriving|slope|slopes|tangent\s+line|normal\s+line|"
    r"inflection|extrema|maximum|maxima|minimum|minima|concave|convex|integral|integrals|integration|integrate|integrating|antiderivative|antiderivatives|"
    r"riemann|chain\s+rule|product\s+rule|quotient\s+rule|l'?hopital|by\s+parts|partial\s+fraction|series|sequence|sequences|convergence|divergence|taylor|maclaurin|"
    r"statistics|statistical|probability|mean|median|mode|average|standard\s+deviation|variance|distribution|normal\s+distribution|binomial|sample|hypothesis|combinatorics|permutation|combination|factorial|"
    r"solve|solving|solution|solutions|solver|calculate|calculating|calculation|compute|computing|computation|evaluate|evaluating|evaluation|"
    r"graph|graphing|graphs|plot|plotting|intercept|intercepts|asymptote|asymptotes|domain|range|function|functions|"
    r"speed|velocity|acceleration|distance|kinematics|motion|"
    r"mph|km\/?h|km|miles|meters?|cm|mm|inches|feet|yards|hours?|minutes?|seconds?|days?|weeks?|years?|"
    r"train|trains|car|cars|vehicle|vehicles|travel|travels|traveling|traveled|depart|departs|arrive|arrives|station|direction|catch\s*up|"
    r"work|worker|workers|job|jobs|task|together|alone|pipe|pipes|tank|tanks|drain|drains|fill|fills|empty|empties|pool|pump|rate|rates|"
    r"cost|costs|price|prices|sell|sells|sold|buy|buys|bought|dollar|dollars|\$|cents?|discount|tax|interest|invest|investment|profit|loss|total|amount|"
    r"ratio|ratios|proportion|proportions|mixture|solution|concentration|acid|water|alloy|liters?|gallons?|ounces?|grams?|kg|pounds?"
    r")\b",
    re.IGNORECASE
)

# Tutoring and educational interactions that are on-topic
TUTORING_INTERACTION_REGEX = re.compile(
    r"\b("
    r"why|how|what\s+does|what\s+is|what\s+are|explain|explanation|intuition|understand|help|hint|steps?|show\s+me|"
    r"correct|wrong|check|verify|practice|exercise|example|problem|next\s+step|"
    r"hello|hi|hey|greetings|who\s+are\s+you|what\s+can\s+you\s+do|introduce\s+yourself"
    r")\b",
    re.IGNORECASE
)

# Explicit off-topic subjects (sports, politics, cooking, pop culture, entertainment)
OFF_TOPIC_DOMAINS_REGEX = re.compile(
    r"\b("
    r"president|presidential|election|prime\s+minister|senator|congress|democrat|republican|parliament|geopolitics|military|warfare|"
    r"celebrity|celebrities|hollywood|kardashian|taylor\s+swift|actor|actress|pop\s+star|gossip|grammy|oscar|box\s+office|"
    r"recipe|recipes|bake|baking|cook|cooking|ingredient|ingredients|pasta|soup|pizza|burger|delicious|kitchen|cuisine|"
    r"football|soccer|basketball|nba|nfl|fifa|champions\s+league|world\s+cup|messi|ronaldo|baseball|tennis|olympics|"
    r"movie|movies|film|cinema|netflix|anime|manga|superhero|marvel|batman|avengers|disney|"
    r"horoscope|zodiac|astrology|tarot|psychic|fortune\s+telling|"
    r"dating|romance|tinder|boyfriend|girlfriend|crush|love\s+poem|"
    r"crypto|cryptocurrency|bitcoin|ethereum|forex|stock\s+tips|day\s+trading"
    r")\b",
    re.IGNORECASE
)

NUMERIC_PATTERN = re.compile(r"\b\d+([.,]\d+)?\b")


def is_query_on_subject(query: Optional[str], context: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """
    Evaluates whether the user's inquiry strictly pertains to the mathematical, geometric,
    algebraic, or pedagogical tutoring scope of the Axiom Engine.
    Returns (is_on_subject, reason_or_category).
    """
    if not query:
        return True, "empty"

    clean_q = query.strip()
    if not clean_q:
        return True, "empty"

    has_context = bool(context and len(context.strip()) > 5)

    has_off_topic_term = bool(OFF_TOPIC_DOMAINS_REGEX.search(clean_q))
    has_math_symbol = bool(MATH_SYMBOLS_REGEX.search(clean_q))
    has_math_term = bool(MATH_TERMS_REGEX.search(clean_q))
    has_tutoring = bool(TUTORING_INTERACTION_REGEX.search(clean_q))
    has_numbers = bool(NUMERIC_PATTERN.search(clean_q))

    # 1. Immediate rejection if explicit off-topic domain keyword is matched without strong math formula
    if has_off_topic_term and not (has_math_symbol or (has_math_term and has_numbers)):
        return False, "off_topic_domain"

    # 2. Check for explicit mathematical vocabulary or symbols/operators
    if has_math_term or has_math_symbol:
        return True, "math_terms"

    # 3. Arithmetic or numeric expressions (e.g. "what is 45 * 12", "solve 5 + 3", "20 / 4")
    if has_numbers and (has_math_symbol or any(op in clean_q.lower() for op in ["plus", "minus", "times", "divided", "over", "mod", "percent", "squared", "cubed"])):
        return True, "arithmetic_expression"

    # 4. Word problem quantitative scenarios (numbers + physical units or inquiry triggers)
    if has_numbers and (
        re.search(
            r"\b(how\s+many|how\s+much|how\s+long|when\s+will|where\s+will|find|calculate|determine|"
            r"total|rate|together|alone|cost|price|each|per|mph|km|hours?|mins?|minutes?|seconds?|"
            r"miles|meters?|liters?|gallons?|dollars?|catch\s*up|reach|fill|empty|pipe|train|worker)\b",
            clean_q,
            re.IGNORECASE
        )
        or len(re.findall(r"\b\d+([.,]\d+)?\b", clean_q)) >= 2
    ):
        return True, "word_problem"

    # 5. Tutoring interactions with active problem context (e.g. "why?", "explain this step", "is this right?")
    if has_context and (has_tutoring or has_numbers):
        return True, "contextual_tutoring"

    # 6. Generic tutor greetings / onboarding (e.g. "hello", "who are you")
    if re.search(r'^(hi|hello|hey|greetings|who are you|what can you do|how does this work)\b', clean_q, re.IGNORECASE):
        return True, "tutor_greeting"

    # If query has none of the above, it's outside the math curriculum scope
    return False, "outside_math_curriculum"


def detect_prompt_injection(text: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    Scans text for adversarial prompt injection, jailbreak attempts, or system prompt leaks.
    Returns (is_injection, matched_snippet).
    """
    if not text:
        return False, None
    for pattern in PROMPT_INJECTION_PATTERNS:
        match = pattern.search(text)
        if match:
            return True, match.group(0)
    return False, None


def sanitize_ai_api_key(api_key: Optional[str]) -> Optional[str]:
    """
    Validates and cleanses user-supplied API keys, preventing header injection or malformed data.
    """
    if not api_key:
        return None
    clean = api_key.strip()
    if "\x00" in clean or "\r" in clean or "\n" in clean:
        raise HTTPException(status_code=400, detail="Invalid characters in API key.")
    if len(clean) < 10 or len(clean) > 256:
        raise HTTPException(status_code=400, detail="API key length is invalid.")
    if not re.match(r"^[A-Za-z0-9_\-\.]+$", clean):
        raise HTTPException(status_code=400, detail="API key contains invalid characters.")
    return clean


def mask_api_key(api_key: Optional[str]) -> str:
    """Safely masks an API key for logs and security audits."""
    if not api_key:
        return "none"
    clean = api_key.strip()
    if len(clean) <= 8:
        return "****"
    return clean[:6] + "..." + clean[-4:]


def record_off_topic_blocked():
    """Increments the telemetry counter for blocked off-topic queries."""
    _ai_security_stats["off_topic_queries_blocked"] += 1


def check_ai_rate_limit(client_ip: str, endpoint: str = "/api/chat", is_stream: bool = False):
    """
    Enforces strict rate limiting and brute-force lockout on AI endpoints to protect API quotas and compute.
    """
    _ai_security_stats["total_ai_requests"] += 1

    # Check if client IP is currently locked out from AI endpoints due to repeat violations
    is_locked, remaining = limiter.is_locked_out(f"lock:ai:{client_ip}", max_failures=6, lock_duration=600)
    if is_locked:
        log_security_event("AI_ACCOUNT_LOCKED", "ALERT", client_ip, endpoint, {
            "reason": "AI rate abuse lockout",
            "retry_in": remaining
        })
        raise HTTPException(
            status_code=429,
            detail=f"Too many repeated requests to AI engine. Temporary cooldown active. Please wait {remaining} seconds.",
            headers={"Retry-After": str(remaining)}
        )

    max_reqs = AI_STREAM_RATE_LIMIT if is_stream else AI_CHAT_RATE_LIMIT
    key = f"ai:{'stream' if is_stream else 'chat'}:{client_ip}"
    is_limited, retry_after = limiter.check_rate_limit(key, max_requests=max_reqs, window_seconds=AI_RATE_LIMIT_WINDOW)

    if is_limited:
        limiter.record_failure(f"lock:ai:{client_ip}")
        _ai_security_stats["rate_limited_ai_requests"] += 1
        log_security_event("AI_RATE_LIMIT_EXCEEDED", "WARNING", client_ip, endpoint, {
            "retry_after": retry_after,
            "stream_mode": is_stream
        })
        raise HTTPException(
            status_code=429,
            detail=f"AI query rate limit reached ({max_reqs} requests/min). Please wait {retry_after} seconds before asking another question.",
            headers={"Retry-After": str(retry_after)}
        )


def validate_and_sanitize_ai_messages(
    messages: List[Any],
    context: Optional[str] = None,
    client_ip: str = "127.0.0.1",
    endpoint: str = "/api/chat"
) -> Tuple[List[Dict[str, str]], Optional[str], Optional[str]]:
    """
    Validates and cleanses message history, context, and checks for prompt injection.
    Returns: (sanitized_messages_list, sanitized_context_str, optional_safe_refusal_reply)
    If optional_safe_refusal_reply is not None, prompt injection was detected and the safe reply
    should be returned immediately without invoking external LLMs.
    """
    if not messages:
        raise HTTPException(status_code=400, detail="Messages array cannot be empty.")

    if len(messages) > AI_MAX_MESSAGES:
        # Keep the latest messages within window
        messages = messages[-AI_MAX_MESSAGES:]
        _ai_security_stats["sanitized_ai_payloads"] += 1

    sanitized_messages: List[Dict[str, str]] = []
    total_chars = 0

    for m in messages:
        if isinstance(m, dict):
            role = m.get("role", "user")
            content = m.get("content", "")
        else:
            role = getattr(m, "role", "user")
            content = getattr(m, "content", "")

        role = str(role).strip().lower()
        if role not in ("user", "assistant", "system"):
            role = "user"

        content = str(content)
        if "\x00" in content:
            raise HTTPException(status_code=400, detail="Null bytes are disallowed in messages.")

        # Truncate overly long individual messages
        if len(content) > AI_MAX_MESSAGE_CHARS:
            content = content[:AI_MAX_MESSAGE_CHARS]
            _ai_security_stats["sanitized_ai_payloads"] += 1

        total_chars += len(content)
        if total_chars > AI_MAX_TOTAL_CHARS:
            raise HTTPException(
                status_code=400,
                detail=f"Total conversation payload exceeds safety limit ({AI_MAX_TOTAL_CHARS} characters)."
            )

        sanitized_messages.append({"role": role, "content": content})

    # Validate Context
    clean_context: Optional[str] = None
    if context:
        if "\x00" in context:
            raise HTTPException(status_code=400, detail="Null bytes are disallowed in context.")
        clean_context = context.strip()
        if len(clean_context) > AI_MAX_CONTEXT_CHARS:
            clean_context = clean_context[:AI_MAX_CONTEXT_CHARS]
            _ai_security_stats["sanitized_ai_payloads"] += 1

    # Check for Prompt Injection on the latest user message & context
    last_user_message = ""
    for m in reversed(sanitized_messages):
        if m["role"] == "user":
            last_user_message = m["content"]
            break

    is_inj_user, pattern_user = detect_prompt_injection(last_user_message)
    is_inj_ctx, pattern_ctx = detect_prompt_injection(clean_context)

    if is_inj_user or is_inj_ctx:
        matched = pattern_user or pattern_ctx or "injection_signature"
        _ai_security_stats["blocked_prompt_injections"] += 1
        limiter.record_failure(f"lock:ai:{client_ip}")
        log_security_event("AI_PROMPT_INJECTION_BLOCKED", "ALERT", client_ip, endpoint, {
            "matched_pattern": matched,
            "snippet": (last_user_message or clean_context or "")[:120]
        })
        safe_reply = (
            "I am Axiom, your dedicated AI Math Tutor. I focus exclusively on mathematics, geometry, calculus, "
            "and scientific problem solving. I cannot process directives that attempt to override my tutoring role "
            "or safety guidelines. How can I help you with your math problem today?"
        )
        return sanitized_messages, clean_context, safe_reply

    # Check for Off-Topic / Non-Subject query
    is_on_subject, subject_reason = is_query_on_subject(last_user_message, clean_context)
    if not is_on_subject:
        _ai_security_stats["off_topic_queries_blocked"] += 1
        log_security_event("AI_OFF_TOPIC_BLOCKED", "INFO", client_ip, endpoint, {
            "reason": subject_reason,
            "snippet": (last_user_message or "")[:120]
        })
        safe_reply = (
            "I am Axiom, your AI Math Tutor! I specialize exclusively in mathematics, geometry, algebra, "
            "calculus, trigonometry, and scientific STEM problem-solving. Please ask a question related to "
            "math, equations, formulas, or this problem!"
        )
        return sanitized_messages, clean_context, safe_reply

    return sanitized_messages, clean_context, None


def sanitize_ai_response(text: Optional[str]) -> str:
    """
    Guards outgoing AI response to prevent accidental leakage of server secrets or environment variables.
    """
    if not text:
        return ""
    scrubbed = text
    # Mask active server keys if they accidentally appear in model output
    for key_env in ["GEMINI_API_KEY", "NVIDIA_API_KEY", "OPENAI_API_KEY"]:
        val = os.environ.get(key_env)
        if val and len(val) > 8 and val in scrubbed:
            scrubbed = scrubbed.replace(val, "[REDACTED_API_KEY]")
    return scrubbed


def get_security_telemetry() -> Dict[str, Any]:
    """
    Returns real-time cybersecurity telemetry metrics and system protection status.
    """
    stats = limiter.get_stats()
    return {
        "status": "operational_hardened",
        "cipher_mode": "PBKDF2-HMAC-SHA256 (100k rounds) + Constant-Time Digestion",
        "session_ttl_days": SESSION_EXPIRY_SECONDS // 86400,
        "active_lockouts": stats["active_lockouts"],
        "monitored_keys": stats["tracked_rate_keys"],
        "media_whitelist": sorted(list(ALLOWED_MEDIA_EXTENSIONS)),
        "headers_enforced": [
            "X-Content-Type-Options: nosniff",
            "X-Frame-Options: SAMEORIGIN",
            "X-XSS-Protection: 1; mode=block",
            "Referrer-Policy: strict-origin-when-cross-origin",
            "Content-Security-Policy"
        ],
        "ai_protection": {
            "active": True,
            "guardrail_version": "2.1-subject-restricted",
            "subject_enforced": True,
            "curriculum_scope": "Mathematics, Geometry, Algebra, Calculus, Trigonometry, STEM",
            "chat_rate_limit_per_min": AI_CHAT_RATE_LIMIT,
            "stream_rate_limit_per_min": AI_STREAM_RATE_LIMIT,
            "teacher_rate_limit_per_min": AI_TEACHER_RATE_LIMIT,
            "max_messages_history": AI_MAX_MESSAGES,
            "max_message_chars": AI_MAX_MESSAGE_CHARS,
            "stats": _ai_security_stats
        },
        "recent_audit_events": list(reversed(_recent_security_events[-15:]))
    }

