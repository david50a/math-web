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

    def __getitem__(self, item):
        return getattr(self, item)

    def keys(self):
        return ["id", "email", "password", "is_premium", "session_token", "session_expires_at", "created_at", "updated_at"]

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "is_premium": bool(self.is_premium),
            "session_token": self.session_token,
            "session_expires_at": self.session_expires_at,
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

