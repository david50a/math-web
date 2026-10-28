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
                if "provider" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN provider VARCHAR(32) DEFAULT 'email'"))
                if "display_name" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN display_name VARCHAR(128) DEFAULT NULL"))
                if "avatar_url" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) DEFAULT NULL"))
                if "reset_token" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL"))
                if "reset_token_expires_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN reset_token_expires_at FLOAT DEFAULT 0.0"))
                if "subscription_tier" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(32) DEFAULT 'free'"))
                if "subscription_cycle" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN subscription_cycle VARCHAR(32) DEFAULT 'monthly'"))
                if "subscription_status" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN subscription_status VARCHAR(32) DEFAULT 'none'"))
                if "subscription_renews_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN subscription_renews_at TIMESTAMP DEFAULT NULL"))
                if "payment_method_last4" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN payment_method_last4 VARCHAR(8) DEFAULT NULL"))
                if "payment_method_brand" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN payment_method_brand VARCHAR(32) DEFAULT NULL"))
                if "stripe_customer_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) DEFAULT NULL"))
                if "stripe_subscription_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255) DEFAULT NULL"))
                conn.commit()

            if "payment_invoices" in inspector.get_table_names():
                inv_cols = {c["name"] for c in inspector.get_columns("payment_invoices")}
                if "stripe_payment_intent_id" not in inv_cols:
                    conn.execute(text("ALTER TABLE payment_invoices ADD COLUMN stripe_payment_intent_id VARCHAR(255) DEFAULT NULL"))
                if "stripe_invoice_id" not in inv_cols:
                    conn.execute(text("ALTER TABLE payment_invoices ADD COLUMN stripe_invoice_id VARCHAR(255) DEFAULT NULL"))
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
