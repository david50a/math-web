import json
import logging
from typing import Optional, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .models import User, ProblemHistory, VideoGeneration, Notebook, CustomFormula, ChatSession, ChatMessage, PaymentInvoice

logger = logging.getLogger("math_web.repository")

# --- User Repository ---

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.strip().lower()).first()

def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_token_hash(db: Session, token_hash: str) -> Optional[User]:
    if not token_hash:
        return None
    return db.query(User).filter(User.session_token == token_hash).first()

def create_user(
    db: Session,
    user_id: str,
    email: str,
    password_hash: str,
    session_token_hash: Optional[str] = None,
    session_expires_at: float = 0.0
) -> User:
    user = User(
        id=user_id,
        email=email.strip().lower(),
        password=password_hash,
        is_premium=False,
        session_token=session_token_hash,
        session_expires_at=session_expires_at
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def update_session(db: Session, user: User, token_hash: Optional[str], expires_at: float):
    user.session_token = token_hash
    user.session_expires_at = expires_at
    db.commit()
    db.refresh(user)
    return user

def revoke_session(db: Session, token_hash: str) -> bool:
    if not token_hash:
        return False
    user = db.query(User).filter(User.session_token == token_hash).first()
    if user:
        user.session_token = None
        user.session_expires_at = 0.0
        db.commit()
        return True
    return False

def set_premium_status(db: Session, user: User, is_premium: bool = True) -> User:
    user.is_premium = is_premium
    db.commit()
    db.refresh(user)
    return user

def create_oauth_user(
    db: Session,
    user_id: str,
    email: str,
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    provider: str = "google",
    session_token_hash: Optional[str] = None,
    session_expires_at: float = 0.0
) -> User:
    user = User(
        id=user_id,
        email=email.strip().lower(),
        password=f"oauth:{provider}:{user_id}",
        display_name=display_name,
        avatar_url=avatar_url,
        provider=provider,
        is_premium=False,
        session_token=session_token_hash,
        session_expires_at=session_expires_at
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def update_user_password(db: Session, user: User, new_password_hash: str) -> User:
    user.password = new_password_hash
    user.session_token = None
    user.session_expires_at = 0.0
    user.reset_token = None
    user.reset_token_expires_at = 0.0
    db.commit()
    db.refresh(user)
    return user

def update_user_profile(
    db: Session,
    user: User,
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None
) -> User:
    if display_name is not None:
        user.display_name = display_name.strip()
    if avatar_url is not None:
        user.avatar_url = avatar_url.strip()
    db.commit()
    db.refresh(user)
    return user

def set_reset_token(db: Session, user: User, token_hash: str, expires_at: float) -> User:
    user.reset_token = token_hash
    user.reset_token_expires_at = expires_at
    db.commit()
    db.refresh(user)
    return user

def get_user_by_reset_token(db: Session, token_hash: str) -> Optional[User]:
    if not token_hash:
        return None
    return db.query(User).filter(User.reset_token == token_hash).first()


# --- Problem History Repository ---

def add_problem_history(
    db: Session,
    equation: str,
    problem_type: Optional[str] = "general",
    result_latex: Optional[str] = None,
    steps: Optional[Any] = None,
    user_id: Optional[str] = None,
    completed: bool = True
) -> ProblemHistory:
    steps_str = json.dumps(steps) if isinstance(steps, (list, dict)) else (str(steps) if steps else None)
    record = ProblemHistory(
        user_id=user_id,
        equation=equation,
        problem_type=problem_type,
        result_latex=result_latex,
        steps=steps_str,
        completed=completed
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

def get_user_history(db: Session, user_id: str, limit: int = 50) -> List[ProblemHistory]:
    return (
        db.query(ProblemHistory)
        .filter(ProblemHistory.user_id == user_id)
        .order_by(desc(ProblemHistory.created_at))
        .limit(limit)
        .all()
    )

def delete_history_item(db: Session, user_id: str, history_id: str) -> bool:
    item = (
        db.query(ProblemHistory)
        .filter(ProblemHistory.id == history_id, ProblemHistory.user_id == user_id)
        .first()
    )
    if item:
        db.delete(item)
        db.commit()
        return True
    return False

def clear_user_history(db: Session, user_id: str) -> int:
    deleted = (
        db.query(ProblemHistory)
        .filter(ProblemHistory.user_id == user_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


# --- Video Generation Repository ---

def add_video_generation(
    db: Session,
    equation: str,
    video_filename: Optional[str] = None,
    video_url: Optional[str] = None,
    resolution: str = "720p",
    fps: int = 30,
    status: str = "completed",
    user_id: Optional[str] = None
) -> VideoGeneration:
    video = VideoGeneration(
        user_id=user_id,
        equation=equation,
        video_filename=video_filename,
        video_url=video_url,
        resolution=resolution,
        fps=fps,
        status=status
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return video

def get_user_videos(db: Session, user_id: str, limit: int = 50) -> List[VideoGeneration]:
    return (
        db.query(VideoGeneration)
        .filter(VideoGeneration.user_id == user_id)
        .order_by(desc(VideoGeneration.created_at))
        .limit(limit)
        .all()
    )


# --- Notebook Repository ---

def create_notebook(
    db: Session,
    user_id: str,
    title: str = "Untitled Notebook",
    content: str = "",
    tags: str = "",
    is_pinned: bool = False
) -> Notebook:
    notebook = Notebook(
        user_id=user_id,
        title=title.strip() if title else "Untitled Notebook",
        content=content,
        tags=tags,
        is_pinned=is_pinned
    )
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    return notebook

def get_notebook(db: Session, user_id: str, notebook_id: str) -> Optional[Notebook]:
    return (
        db.query(Notebook)
        .filter(Notebook.id == notebook_id, Notebook.user_id == user_id)
        .first()
    )

def list_notebooks(db: Session, user_id: str, limit: int = 50) -> List[Notebook]:
    return (
        db.query(Notebook)
        .filter(Notebook.user_id == user_id)
        .order_by(desc(Notebook.is_pinned), desc(Notebook.updated_at))
        .limit(limit)
        .all()
    )

def update_notebook(
    db: Session,
    user_id: str,
    notebook_id: str,
    title: Optional[str] = None,
    content: Optional[str] = None,
    tags: Optional[str] = None,
    is_pinned: Optional[bool] = None
) -> Optional[Notebook]:
    notebook = get_notebook(db, user_id, notebook_id)
    if not notebook:
        return None
    if title is not None:
        notebook.title = title.strip()
    if content is not None:
        notebook.content = content
    if tags is not None:
        notebook.tags = tags
    if is_pinned is not None:
        notebook.is_pinned = is_pinned
    db.commit()
    db.refresh(notebook)
    return notebook

def delete_notebook(db: Session, user_id: str, notebook_id: str) -> bool:
    notebook = get_notebook(db, user_id, notebook_id)
    if notebook:
        db.delete(notebook)
        db.commit()
        return True
    return False


# --- Custom Formulas Repository ---

def create_custom_formula(
    db: Session,
    user_id: str,
    name: str,
    latex: str,
    category: str = "general",
    expression: str = "",
    description: str = "",
    variables: str = "",
    is_favorite: bool = False
) -> CustomFormula:
    formula = CustomFormula(
        user_id=user_id,
        name=name.strip(),
        category=category.strip().lower(),
        latex=latex.strip(),
        expression=expression.strip(),
        description=description.strip(),
        variables=variables.strip(),
        is_favorite=is_favorite
    )
    db.add(formula)
    db.commit()
    db.refresh(formula)
    return formula

def get_custom_formula(db: Session, user_id: str, formula_id: str) -> Optional[CustomFormula]:
    return (
        db.query(CustomFormula)
        .filter(CustomFormula.id == formula_id, CustomFormula.user_id == user_id)
        .first()
    )

def list_custom_formulas(
    db: Session,
    user_id: str,
    category: Optional[str] = None,
    limit: int = 100
) -> List[CustomFormula]:
    query = db.query(CustomFormula).filter(CustomFormula.user_id == user_id)
    if category:
        query = query.filter(CustomFormula.category == category.strip().lower())
    return query.order_by(desc(CustomFormula.is_favorite), desc(CustomFormula.created_at)).limit(limit).all()

def toggle_formula_favorite(db: Session, user_id: str, formula_id: str) -> Optional[CustomFormula]:
    formula = get_custom_formula(db, user_id, formula_id)
    if not formula:
        return None
    formula.is_favorite = not formula.is_favorite
    db.commit()
    db.refresh(formula)
    return formula

def delete_custom_formula(db: Session, user_id: str, formula_id: str) -> bool:
    formula = get_custom_formula(db, user_id, formula_id)
    if formula:
        db.delete(formula)
        db.commit()
        return True
    return False


# --- AI Chat Sessions Repository ---

def create_chat_session(
    db: Session,
    user_id: str,
    title: str = "Math Discussion",
    subject: str = "General"
) -> ChatSession:
    session = ChatSession(
        user_id=user_id,
        title=title.strip() if title else "Math Discussion",
        subject=subject.strip() if subject else "General"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def get_chat_session(db: Session, user_id: str, session_id: str) -> Optional[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
        .first()
    )

def list_chat_sessions(db: Session, user_id: str, limit: int = 50) -> List[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id)
        .order_by(desc(ChatSession.updated_at))
        .limit(limit)
        .all()
    )

def add_chat_message(
    db: Session,
    session_id: str,
    role: str,
    content: str,
    latex: str = ""
) -> ChatMessage:
    msg = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        latex=latex
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def get_session_messages(db: Session, session_id: str) -> List[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
        .all()
    )

def delete_chat_session(db: Session, user_id: str, session_id: str) -> bool:
    session = get_chat_session(db, user_id, session_id)
    if session:
        db.delete(session)
        db.commit()
        return True
    return False

# --- Payment & Invoice Repository ---

def create_payment_invoice(
    db: Session,
    user_id: str,
    invoice_number: str,
    amount: float,
    currency: str = "USD",
    plan_name: str = "Academy Fellow",
    billing_cycle: str = "monthly",
    status: str = "paid",
    payment_method: str = "Credit Card",
    card_last4: Optional[str] = None,
    card_brand: Optional[str] = None,
    discount_applied: float = 0.0,
    coupon_code: Optional[str] = None,
    receipt_url: Optional[str] = None,
    stripe_payment_intent_id: Optional[str] = None,
    stripe_invoice_id: Optional[str] = None
) -> PaymentInvoice:
    invoice = PaymentInvoice(
        user_id=user_id,
        invoice_number=invoice_number,
        amount=amount,
        currency=currency,
        plan_name=plan_name,
        billing_cycle=billing_cycle,
        status=status,
        payment_method=payment_method,
        card_last4=card_last4,
        card_brand=card_brand,
        discount_applied=discount_applied,
        coupon_code=coupon_code,
        receipt_url=receipt_url,
        stripe_payment_intent_id=stripe_payment_intent_id,
        stripe_invoice_id=stripe_invoice_id
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice

def get_user_invoices(db: Session, user_id: str, limit: int = 50) -> List[PaymentInvoice]:
    return (
        db.query(PaymentInvoice)
        .filter(PaymentInvoice.user_id == user_id)
        .order_by(desc(PaymentInvoice.created_at))
        .limit(limit)
        .all()
    )

def get_invoice_by_number(db: Session, invoice_number: str) -> Optional[PaymentInvoice]:
    return db.query(PaymentInvoice).filter(PaymentInvoice.invoice_number == invoice_number).first()

def get_user_by_stripe_customer_id(db: Session, stripe_customer_id: str) -> Optional[User]:
    if not stripe_customer_id:
        return None
    return db.query(User).filter(User.stripe_customer_id == stripe_customer_id).first()

def update_user_subscription(
    db: Session,
    user: User,
    is_premium: bool = True,
    subscription_tier: str = "fellow",
    subscription_cycle: str = "monthly",
    subscription_status: str = "active",
    subscription_renews_at = None,
    payment_method_last4: Optional[str] = None,
    payment_method_brand: Optional[str] = None,
    stripe_customer_id: Optional[str] = None,
    stripe_subscription_id: Optional[str] = None
) -> User:
    user.is_premium = is_premium
    user.subscription_tier = subscription_tier
    user.subscription_cycle = subscription_cycle
    user.subscription_status = subscription_status
    if subscription_renews_at is not None:
        user.subscription_renews_at = subscription_renews_at
    if payment_method_last4:
        user.payment_method_last4 = payment_method_last4
    if payment_method_brand:
        user.payment_method_brand = payment_method_brand
    if stripe_customer_id:
        user.stripe_customer_id = stripe_customer_id
    if stripe_subscription_id:
        user.stripe_subscription_id = stripe_subscription_id
    db.commit()
    db.refresh(user)
    return user

def cancel_user_subscription(db: Session, user: User) -> User:
    user.subscription_status = "canceled"
    db.commit()
    db.refresh(user)
    return user

def reactivate_user_subscription(db: Session, user: User) -> User:
    user.subscription_status = "active"
    user.is_premium = True
    db.commit()
    db.refresh(user)
    return user

