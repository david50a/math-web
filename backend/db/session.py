import os
import logging
from contextlib import contextmanager
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError

logger = logging.getLogger("math_web.db")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQLITE_DB_PATH = os.path.join(BASE_DIR, "math_web.db")
SQLITE_URL = f"sqlite:///{SQLITE_DB_PATH}"

# Retrieve DATABASE_URL from environment or default to local PostgreSQL
raw_db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/math_web")

# Fix Heroku/Render/AWS legacy postgres:// scheme to postgresql://
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

DATABASE_URL = raw_db_url

Base = declarative_base()

def create_db_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=False
        )
    return create_engine(
        url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False
    )

# Try connecting with configured URL; fallback to SQLite if PostgreSQL service is unavailable locally
try:
    engine = create_db_engine(DATABASE_URL)
    # Test connection
    with engine.connect() as conn:
        logger.info(f"Connected to database engine: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
except (OperationalError, Exception) as e:
    logger.warning(
        f"Unable to connect to primary database at {DATABASE_URL}: {e}. "
        f"Falling back to local SQLite at {SQLITE_URL} for resilience."
    )
    DATABASE_URL = SQLITE_URL
    engine = create_db_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)

def init_db():
    """Create all registered database tables and apply backward-compatible schema updates."""
    from . import models  # Ensure all model declarations are registered
    Base.metadata.create_all(bind=engine)

    # Auto-migration for existing tables (e.g. legacy SQLite math_web.db)
    with engine.connect() as conn:
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(engine)
            if "users" in inspector.get_table_names():
                existing_cols = {c["name"] for c in inspector.get_columns("users")}
                if "created_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NULL"))
                if "updated_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NULL"))
                conn.commit()
        except Exception as e:
            logger.warning(f"Schema auto-migration check notice: {e}")

    logger.info(f"Database initialized with tables: {list(Base.metadata.tables.keys())}")

def get_db() -> Generator:
    """FastAPI dependency to provide a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context():
    """Context manager for standalone database queries."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
