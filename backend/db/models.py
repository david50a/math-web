import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)
    session_token = Column(String(255), index=True, nullable=True)
    session_expires_at = Column(Float, default=0.0, nullable=False)
    provider = Column(String(32), default="email", nullable=True)
    display_name = Column(String(128), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    reset_token = Column(String(255), index=True, nullable=True)
    reset_token_expires_at = Column(Float, default=0.0, nullable=True)
    subscription_tier = Column(String(32), default="free", nullable=True)
    subscription_cycle = Column(String(32), default="monthly", nullable=True)
    subscription_status = Column(String(32), default="none", nullable=True)
    subscription_renews_at = Column(DateTime, nullable=True)
    payment_method_last4 = Column(String(8), nullable=True)
    payment_method_brand = Column(String(32), nullable=True)
    stripe_customer_id = Column(String(255), index=True, nullable=True)
    stripe_subscription_id = Column(String(255), index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    history = relationship(
        "ProblemHistory",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(ProblemHistory.created_at)"
    )
    videos = relationship(
        "VideoGeneration",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(VideoGeneration.created_at)"
    )
    notebooks = relationship(
        "Notebook",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(Notebook.updated_at)"
    )
    custom_formulas = relationship(
        "CustomFormula",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(CustomFormula.created_at)"
    )
    chat_sessions = relationship(
        "ChatSession",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(ChatSession.updated_at)"
    )
    invoices = relationship(
        "PaymentInvoice",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(PaymentInvoice.created_at)"
    )

    def __getitem__(self, item):
        return getattr(self, item)

    def keys(self):
        return [
            "id", "email", "password", "is_premium", "provider",
            "display_name", "avatar_url", "session_token",
            "subscription_tier", "subscription_cycle", "subscription_status",
            "subscription_renews_at", "payment_method_last4", "payment_method_brand",
            "session_expires_at", "created_at", "updated_at"
        ]

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "display_name": self.display_name or (self.email.split("@")[0] if self.email else "Scholar"),
            "avatar_url": self.avatar_url,
            "provider": self.provider or "email",
            "is_premium": bool(self.is_premium),
            "subscription_tier": self.subscription_tier or ("fellow" if self.is_premium else "free"),
            "subscription_cycle": self.subscription_cycle or "monthly",
            "subscription_status": self.subscription_status or ("active" if self.is_premium else "none"),
            "subscription_renews_at": self.subscription_renews_at.isoformat() if self.subscription_renews_at else None,
            "payment_method_last4": self.payment_method_last4,
            "payment_method_brand": self.payment_method_brand,
            "session_token": self.session_token,
            "session_expires_at": self.session_expires_at,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class PaymentInvoice(Base):
    __tablename__ = "payment_invoices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    invoice_number = Column(String(64), unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), default="USD", nullable=False)
    plan_name = Column(String(64), nullable=False)
    billing_cycle = Column(String(32), default="monthly", nullable=False)
    status = Column(String(32), default="paid", nullable=False)
    payment_method = Column(String(64), nullable=False)
    card_last4 = Column(String(8), nullable=True)
    card_brand = Column(String(32), nullable=True)
    discount_applied = Column(Float, default=0.0, nullable=False)
    coupon_code = Column(String(64), nullable=True)
    stripe_payment_intent_id = Column(String(255), nullable=True)
    stripe_invoice_id = Column(String(255), nullable=True)
    receipt_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)

    user = relationship("User", back_populates="invoices")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "invoice_number": self.invoice_number,
            "amount": self.amount,
            "currency": self.currency,
            "plan_name": self.plan_name,
            "billing_cycle": self.billing_cycle,
            "status": self.status,
            "payment_method": self.payment_method,
            "card_last4": self.card_last4,
            "card_brand": self.card_brand,
            "discount_applied": self.discount_applied,
            "coupon_code": self.coupon_code,
            "stripe_payment_intent_id": self.stripe_payment_intent_id,
            "stripe_invoice_id": self.stripe_invoice_id,
            "receipt_url": self.receipt_url,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ProblemHistory(Base):
    __tablename__ = "problem_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    equation = Column(Text, nullable=False)
    problem_type = Column(String(64), nullable=True, default="general")
    result_latex = Column(Text, nullable=True)
    steps = Column(Text, nullable=True)  # JSON-encoded array or string representation
    completed = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)

    user = relationship("User", back_populates="history")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "equation": self.equation,
            "problem_type": self.problem_type,
            "result_latex": self.result_latex,
            "steps": self.steps,
            "completed": self.completed,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class VideoGeneration(Base):
    __tablename__ = "video_generations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    equation = Column(Text, nullable=False)
    video_filename = Column(String(255), nullable=True)
    video_url = Column(String(512), nullable=True)
    resolution = Column(String(32), default="720p", nullable=False)
    fps = Column(Integer, default=30, nullable=False)
    status = Column(String(32), default="completed", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)

    user = relationship("User", back_populates="videos")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "equation": self.equation,
            "video_filename": self.video_filename,
            "video_url": self.video_url,
            "resolution": self.resolution,
            "fps": self.fps,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Notebook(Base):
    __tablename__ = "notebooks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(255), default="Untitled Notebook", nullable=False)
    content = Column(Text, default="", nullable=False)
    tags = Column(String(255), default="", nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="notebooks")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "content": self.content,
            "tags": [t.strip() for t in self.tags.split(",") if t.strip()] if self.tags else [],
            "is_pinned": bool(self.is_pinned),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class CustomFormula(Base):
    __tablename__ = "custom_formulas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(64), default="general", nullable=False)
    latex = Column(Text, nullable=False)
    expression = Column(Text, default="", nullable=False)
    description = Column(Text, default="", nullable=False)
    variables = Column(Text, default="", nullable=False)
    is_favorite = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)

    user = relationship("User", back_populates="custom_formulas")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "category": self.category,
            "latex": self.latex,
            "expression": self.expression,
            "description": self.description,
            "variables": [v.strip() for v in self.variables.split(",") if v.strip()] if self.variables else [],
            "is_favorite": bool(self.is_favorite),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(255), default="Math Discussion", nullable=False)
    subject = Column(String(64), default="General", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at"
    )

    def to_dict(self, include_messages=False):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "subject": self.subject,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if include_messages and self.messages is not None:
            data["messages"] = [m.to_dict() for m in self.messages]
        return data


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True, nullable=False)
    role = Column(String(32), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    latex = Column(Text, default="", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)

    session = relationship("ChatSession", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "latex": self.latex,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

