import os
import re
import time
import json
import secrets
import hashlib
import sqlite3
from typing import Optional, Tuple, Dict, List, Any
from fastapi import HTTPException, Request

# Security Configuration Constants
SESSION_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days
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
        "recent_audit_events": list(reversed(_recent_security_events[-15:]))
    }
