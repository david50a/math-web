import unittest
import time
from fastapi.testclient import TestClient
import main
from main import app
import db
from db import repository

client = TestClient(app)

class TestAuthSuite(unittest.TestCase):
    def setUp(self):
        self.test_email = f"scholar_test_{int(time.time()*1000)}@academy.edu"
        self.test_password = "SecurePassword123!"

    def test_full_auth_lifecycle(self):
        # 1. Sign Up
        res = client.post("/api/auth/signup", json={
            "email": self.test_email,
            "password": self.test_password,
            "display_name": "Isaac Newton"
        })
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["email"], self.test_email)
        self.assertEqual(data["display_name"], "Isaac Newton")
        self.assertTrue("session_token" in data and data["session_token"])
        self.assertTrue("refresh_token" in data and data["refresh_token"])
        access_token = data["session_token"]
        refresh_token = data["refresh_token"]

        # 2. Check /api/auth/me with Bearer token
        res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        self.assertEqual(res_me.status_code, 200)
        me_data = res_me.json()
        self.assertEqual(me_data["email"], self.test_email)
        self.assertEqual(me_data["display_name"], "Isaac Newton")

        # 3. Sign In
        res_signin = client.post("/api/auth/signin", json={
            "email": self.test_email,
            "password": self.test_password
        })
        self.assertEqual(res_signin.status_code, 200)
        signin_data = res_signin.json()
        new_access = signin_data["session_token"]
        new_refresh = signin_data["refresh_token"]

        # 4. Token Refresh
        res_refresh = client.post("/api/auth/refresh", json={
            "refresh_token": new_refresh
        })
        self.assertEqual(res_refresh.status_code, 200)
        refreshed_data = res_refresh.json()
        self.assertTrue(refreshed_data["session_token"])

        # 5. Profile Update
        res_prof = client.patch(
            "/api/auth/profile",
            json={"display_name": "Sir Isaac Newton", "avatar_url": "https://avatar.example.com/newton.png"},
            headers={"Authorization": f"Bearer {new_access}"}
        )
        self.assertEqual(res_prof.status_code, 200)
        self.assertEqual(res_prof.json()["display_name"], "Sir Isaac Newton")

        # 6. Change Password
        new_pw = "BrandNewCipher999#"
        res_change = client.post(
            "/api/auth/change-password",
            json={"current_password": self.test_password, "new_password": new_pw},
            headers={"Authorization": f"Bearer {new_access}"}
        )
        self.assertEqual(res_change.status_code, 200)

        # 7. Verify signin with old password fails, new password succeeds
        res_old_fail = client.post("/api/auth/signin", json={
            "email": self.test_email,
            "password": self.test_password
        })
        self.assertEqual(res_old_fail.status_code, 401)

        res_new_ok = client.post("/api/auth/signin", json={
            "email": self.test_email,
            "password": new_pw
        })
        self.assertEqual(res_new_ok.status_code, 200)

        # 8. Forgot Password & Reset Password
        res_forgot = client.post("/api/auth/forgot-password", json={"email": self.test_email})
        self.assertEqual(res_forgot.status_code, 200)
        reset_code = res_forgot.json().get("reset_code")
        self.assertTrue(reset_code)

        reset_pw = "ResetPasswordSuccessful456!"
        res_reset = client.post("/api/auth/reset-password", json={
            "email": self.test_email,
            "reset_code": reset_code,
            "new_password": reset_pw
        })
        self.assertEqual(res_reset.status_code, 200)

        # 9. Verify login with reset password
        res_after_reset = client.post("/api/auth/signin", json={
            "email": self.test_email,
            "password": reset_pw
        })
        self.assertEqual(res_after_reset.status_code, 200)

        # 10. Sign Out
        res_signout = client.post("/api/auth/signout", headers={"Authorization": f"Bearer {res_after_reset.json()['session_token']}"})
        self.assertEqual(res_signout.status_code, 200)

    def test_oauth_flow(self):
        # Test Google OAuth
        google_email = f"google_scholar_{int(time.time()*1000)}@gmail.com"
        res_google = client.post("/api/auth/oauth", json={
            "provider": "google",
            "email": google_email,
            "name": "Ada Lovelace",
            "avatar_url": "https://lh3.googleusercontent.com/a/ada"
        })
        self.assertEqual(res_google.status_code, 200)
        g_data = res_google.json()
        self.assertEqual(g_data["provider"], "google")
        self.assertEqual(g_data["display_name"], "Ada Lovelace")
        self.assertTrue(g_data["session_token"])

        # Test GitHub OAuth
        github_email = f"github_scholar_{int(time.time()*1000)}@github.com"
        res_github = client.post("/api/auth/oauth", json={
            "provider": "github",
            "email": github_email,
            "name": "Alan Turing",
            "avatar_url": "https://avatars.githubusercontent.com/u/turing"
        })
        self.assertEqual(res_github.status_code, 200)
        gh_data = res_github.json()
        self.assertEqual(gh_data["provider"], "github")
        self.assertEqual(gh_data["display_name"], "Alan Turing")
        self.assertTrue(gh_data["session_token"])

if __name__ == "__main__":
    unittest.main()
