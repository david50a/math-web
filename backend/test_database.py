import unittest
import uuid
import time
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from db import init_db, get_db_context, repository
from db.models import User, ProblemHistory, VideoGeneration

class TestDatabaseLayer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_user_lifecycle(self):
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user_id = str(uuid.uuid4())
        pw_hash = "salt:hash123"
        token_hash = "sample_session_token_hash"
        expires_at = time.time() + 3600

        # 1. Create user
        with get_db_context() as session:
            user = repository.create_user(
                session,
                user_id=user_id,
                email=unique_email,
                password_hash=pw_hash,
                session_token_hash=token_hash,
                session_expires_at=expires_at
            )
            self.assertEqual(user.id, user_id)
            self.assertEqual(user.email, unique_email)
            self.assertFalse(user.is_premium)
            # Verify dict access compatibility
            self.assertEqual(user["id"], user_id)
            self.assertEqual(user["email"], unique_email)

        # 2. Lookup by email
        with get_db_context() as session:
            found = repository.get_user_by_email(session, unique_email)
            self.assertIsNotNone(found)
            self.assertEqual(found.id, user_id)

        # 3. Lookup by token hash
        with get_db_context() as session:
            found = repository.get_user_by_token_hash(session, token_hash)
            self.assertIsNotNone(found)
            self.assertEqual(found.id, user_id)

        # 4. Upgrade premium status
        with get_db_context() as session:
            user = repository.get_user_by_id(session, user_id)
            repository.set_premium_status(session, user, is_premium=True)
            self.assertTrue(user.is_premium)

        # 5. Revoke session
        with get_db_context() as session:
            success = repository.revoke_session(session, token_hash)
            self.assertTrue(success)
            self.assertIsNone(repository.get_user_by_token_hash(session, token_hash))

    def test_problem_history(self):
        unique_email = f"history_{uuid.uuid4().hex[:8]}@example.com"
        user_id = str(uuid.uuid4())

        with get_db_context() as session:
            user = repository.create_user(
                session,
                user_id=user_id,
                email=unique_email,
                password_hash="pw",
                session_token_hash="tok",
                session_expires_at=time.time() + 1000
            )

            # Add problem history
            item1 = repository.add_problem_history(
                session,
                equation="2*x + 5 = 15",
                problem_type="Algebra",
                result_latex="x = 5",
                steps=[{"step": 1, "desc": "Subtract 5"}, {"step": 2, "desc": "Divide by 2"}],
                user_id=user_id
            )
            item2 = repository.add_problem_history(
                session,
                equation="derive(x^3)",
                problem_type="Calculus",
                result_latex="3*x^2",
                steps=[{"step": 1, "desc": "Power rule"}],
                user_id=user_id
            )

        # Query user history
        with get_db_context() as session:
            history = repository.get_user_history(session, user_id)
            self.assertEqual(len(history), 2)
            self.assertEqual(history[0].equation, "derive(x^3)")  # newest first
            self.assertEqual(history[1].equation, "2*x + 5 = 15")

            # Delete single item
            del_success = repository.delete_history_item(session, user_id, item1.id)
            self.assertTrue(del_success)
            remaining = repository.get_user_history(session, user_id)
            self.assertEqual(len(remaining), 1)

            # Clear all history
            cleared_count = repository.clear_user_history(session, user_id)
            self.assertEqual(cleared_count, 1)
            self.assertEqual(len(repository.get_user_history(session, user_id)), 0)

    def test_video_generation(self):
        unique_email = f"video_{uuid.uuid4().hex[:8]}@example.com"
        user_id = str(uuid.uuid4())

        with get_db_context() as session:
            repository.create_user(
                session,
                user_id=user_id,
                email=unique_email,
                password_hash="pw",
                session_token_hash="tok",
                session_expires_at=time.time() + 1000
            )

            video = repository.add_video_generation(
                session,
                equation="sin(x) = 0",
                video_filename="anim123.mp4",
                video_url="/api/media/videos/video/720p30/anim123.mp4",
                resolution="720p",
                fps=30,
                status="completed",
                user_id=user_id
            )
            self.assertIsNotNone(video.id)

            videos = repository.get_user_videos(session, user_id)
            self.assertEqual(len(videos), 1)
            self.assertEqual(videos[0].video_filename, "anim123.mp4")

    def test_notebook_lifecycle(self):
        unique_email = f"notebook_{uuid.uuid4().hex[:8]}@example.com"
        user_id = str(uuid.uuid4())

        with get_db_context() as session:
            repository.create_user(
                session,
                user_id=user_id,
                email=unique_email,
                password_hash="pw",
                session_token_hash="tok",
                session_expires_at=time.time() + 1000
            )

            # 1. Create Notebook
            nb = repository.create_notebook(
                session,
                user_id=user_id,
                title="Calculus Notes",
                content="# Derivatives\nPower rule: $(x^n)' = n x^{n-1}$",
                tags="calculus,derivatives",
                is_pinned=True
            )
            self.assertIsNotNone(nb.id)
            self.assertEqual(nb.title, "Calculus Notes")
            self.assertTrue(nb.is_pinned)
            nb_id = nb.id

        # 2. List Notebooks
        with get_db_context() as session:
            notebooks = repository.list_notebooks(session, user_id)
            self.assertEqual(len(notebooks), 1)
            self.assertEqual(notebooks[0].id, nb_id)
            dict_rep = notebooks[0].to_dict()
            self.assertEqual(dict_rep["tags"], ["calculus", "derivatives"])

        # 3. Update Notebook
        with get_db_context() as session:
            updated = repository.update_notebook(
                session,
                user_id=user_id,
                notebook_id=nb_id,
                title="Advanced Calculus Notes",
                is_pinned=False
            )
            self.assertIsNotNone(updated)
            self.assertEqual(updated.title, "Advanced Calculus Notes")
            self.assertFalse(updated.is_pinned)

        # 4. Delete Notebook
        with get_db_context() as session:
            deleted = repository.delete_notebook(session, user_id, nb_id)
            self.assertTrue(deleted)
            remaining = repository.list_notebooks(session, user_id)
            self.assertEqual(len(remaining), 0)

    def test_custom_formula_lifecycle(self):
        unique_email = f"formula_{uuid.uuid4().hex[:8]}@example.com"
        user_id = str(uuid.uuid4())

        with get_db_context() as session:
            repository.create_user(
                session,
                user_id=user_id,
                email=unique_email,
                password_hash="pw",
                session_token_hash="tok",
                session_expires_at=time.time() + 1000
            )

            # 1. Create Formula
            formula = repository.create_custom_formula(
                session,
                user_id=user_id,
                name="Gaussian Normal Distribution",
                category="statistics",
                latex=r"\frac{1}{\sigma \sqrt{2\pi}} e^{-\frac{1}{2}\left(\frac{x-\mu}{\sigma}\right)^2}",
                expression="1/(s*sqrt(2*pi))*exp(-0.5*((x-m)/s)^2)",
                description="Probability density function of normal distribution",
                variables="x,mu,sigma",
                is_favorite=True
            )
            self.assertIsNotNone(formula.id)
            f_id = formula.id

        # 2. List Formulas with category filter
        with get_db_context() as session:
            formulas = repository.list_custom_formulas(session, user_id, category="statistics")
            self.assertEqual(len(formulas), 1)
            self.assertEqual(formulas[0].name, "Gaussian Normal Distribution")
            self.assertTrue(formulas[0].is_favorite)

            empty = repository.list_custom_formulas(session, user_id, category="geometry")
            self.assertEqual(len(empty), 0)

        # 3. Toggle Favorite
        with get_db_context() as session:
            toggled = repository.toggle_formula_favorite(session, user_id, f_id)
            self.assertFalse(toggled.is_favorite)

        # 4. Delete Formula
        with get_db_context() as session:
            deleted = repository.delete_custom_formula(session, user_id, f_id)
            self.assertTrue(deleted)
            self.assertEqual(len(repository.list_custom_formulas(session, user_id)), 0)

    def test_chat_session_and_messages(self):
        unique_email = f"chat_{uuid.uuid4().hex[:8]}@example.com"
        user_id = str(uuid.uuid4())

        with get_db_context() as session:
            repository.create_user(
                session,
                user_id=user_id,
                email=unique_email,
                password_hash="pw",
                session_token_hash="tok",
                session_expires_at=time.time() + 1000
            )

            # 1. Create Chat Session
            chat_session = repository.create_chat_session(
                session,
                user_id=user_id,
                title="Trig substitution questions",
                subject="Calculus"
            )
            self.assertIsNotNone(chat_session.id)
            s_id = chat_session.id

            # 2. Add Messages
            msg1 = repository.add_chat_message(
                session,
                session_id=s_id,
                role="user",
                content="How do I integrate sqrt(a^2 - x^2)?",
                latex=r"\int \sqrt{a^2 - x^2} \, dx"
            )
            self.assertIsNotNone(msg1.id)

            msg2 = repository.add_chat_message(
                session,
                session_id=s_id,
                role="assistant",
                content="Use the trigonometric substitution $x = a \\sin(\\theta)$.",
                latex=r"x = a \sin(\theta), \quad dx = a \cos(\theta) d\theta"
            )
            self.assertIsNotNone(msg2.id)

        # 3. Retrieve Session with Messages
        with get_db_context() as session:
            found_session = repository.get_chat_session(session, user_id, s_id)
            self.assertIsNotNone(found_session)
            session_dict = found_session.to_dict(include_messages=True)
            self.assertEqual(len(session_dict["messages"]), 2)
            self.assertEqual(session_dict["messages"][0]["role"], "user")
            self.assertEqual(session_dict["messages"][1]["role"], "assistant")

        # 4. Cascade delete session removes messages
        with get_db_context() as session:
            deleted = repository.delete_chat_session(session, user_id, s_id)
            self.assertTrue(deleted)
            msgs = repository.get_session_messages(session, s_id)
            self.assertEqual(len(msgs), 0)

if __name__ == "__main__":
    unittest.main()

