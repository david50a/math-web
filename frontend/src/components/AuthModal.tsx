import React, { useState, useMemo } from "react";
import {
  X,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Check,
  AlertCircle,
  KeyRound,
  User as UserIcon,
  CheckCircle2,
  RotateCw,
  Github
} from "lucide-react";

export interface AuthSuccessPayload {
  token: string;
  refreshToken?: string;
  email: string;
  isPremium: boolean;
  displayName?: string;
  avatarUrl?: string;
  provider?: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: "signin" | "signup" | "forgot";
  onAuthSuccess: (
    token: string,
    email: string,
    isPremium: boolean,
    extra?: { refreshToken?: string; displayName?: string; avatarUrl?: string; provider?: string }
  ) => void;
  guestLimitMessage?: string | null;
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode,
  onAuthSuccess,
  guestLimitMessage
}: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode || "signin");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  // Sync mode when initialMode prop changes
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode || "signin");
      setError(null);
      setSuccessNotice(null);
      setResetStep("request");
    }
  }, [isOpen, initialMode]);

  // Real-time password security evaluation
  const activePassword = mode === "forgot" ? newPassword : password;
  const passwordSecurity = useMemo(() => {
    const hasMinLength = activePassword.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(activePassword);
    const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(activePassword);
    const isVeryLong = activePassword.length >= 12;

    let score = 0;
    if (hasMinLength) score += 1;
    if (hasLetter) score += 1;
    if (hasNumberOrSymbol) score += 1;
    if (isVeryLong) score += 1;

    let label = "Unprotected";
    let color = "bg-red-500";
    let textColor = "text-red-400";

    if (score === 1 || score === 2) {
      label = "Moderate";
      color = "bg-amber-500";
      textColor = "text-amber-400";
    } else if (score >= 3) {
      label = "Strong Shield";
      color = "bg-emerald-500";
      textColor = "text-emerald-400";
    }

    const isValid = hasMinLength && hasLetter && hasNumberOrSymbol;

    return {
      hasMinLength,
      hasLetter,
      hasNumberOrSymbol,
      score,
      label,
      color,
      textColor,
      isValid,
    };
  }, [activePassword]);

  if (!isOpen) return null;

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    setError(null);
    try {
      // Generate realistic OAuth scholar details or allow user selection
      let oauthEmail = email;
      let oauthName = displayName;
      let oauthAvatar = "";

      if (!oauthEmail || !oauthEmail.includes("@")) {
        // Fallback to provider-styled scholar handle
        const randomId = Math.floor(1000 + Math.random() * 9000);
        if (provider === "google") {
          oauthEmail = `scholar.${randomId}@gmail.com`;
          oauthName = oauthName || `Scholar ${randomId}`;
          oauthAvatar = `https://lh3.googleusercontent.com/a/scholar-${randomId}`;
        } else {
          oauthEmail = `axiom-coder-${randomId}@github.com`;
          oauthName = oauthName || `Coder ${randomId}`;
          oauthAvatar = `https://avatars.githubusercontent.com/u/${randomId}`;
        }
      }

      const res = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          email: oauthEmail,
          name: oauthName,
          avatar_url: oauthAvatar,
          credential: `oauth_token_${provider}_${Date.now()}`
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `OAuth sign-in with ${provider} failed.`);
      }

      onAuthSuccess(data.session_token, data.email, data.is_premium, {
        refreshToken: data.refresh_token,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        provider: data.provider
      });
      onClose();
    } catch (err: any) {
      setError(err.message || `Could not sign in with ${provider}`);
    } finally {
      setOauthLoading(null);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (resetStep === "request") {
      if (!email) {
        setError("Please enter your scholar email to receive a reset code.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Failed to initiate password reset.");
        }
        setSuccessNotice(`Reset code generated! ${data.reset_code ? `Your code is: ${data.reset_code}` : "Check your inbox."}`);
        if (data.reset_code) {
          setResetCode(data.reset_code);
        }
        setResetStep("verify");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Step 2: verify and reset password
      if (!resetCode || !newPassword) {
        setError("Please enter the 6-digit code and your new password.");
        return;
      }
      if (!passwordSecurity.isValid) {
        setError("New password must be at least 8 characters long and contain letters and numbers/symbols.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            reset_code: resetCode,
            new_password: newPassword
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Failed to reset password.");
        }
        setSuccessNotice("Password successfully updated! Please sign in with your new credentials.");
        setMode("signin");
        setPassword(newPassword);
        setResetStep("request");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") {
      return handleForgotPassword(e);
    }

    setError(null);
    setSuccessNotice(null);

    if (!email || !password) {
      setError("Please fill in all required credentials.");
      return;
    }

    if (mode === "signup" && !passwordSecurity.isValid) {
      setError("Password must be at least 8 characters long and contain both letters and numbers/symbols.");
      return;
    }

    setLoading(true);
    const endpoint = mode === "signin" ? "/api/auth/signin" : "/api/auth/signup";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          display_name: mode === "signup" ? displayName : undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed. Please verify your credentials.");
      }

      onAuthSuccess(data.session_token, data.email, data.is_premium, {
        refreshToken: data.refresh_token,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        provider: data.provider || "email"
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isRateLimited = error && (
    error.toLowerCase().includes("too many") ||
    error.toLowerCase().includes("locked") ||
    error.toLowerCase().includes("rate limit")
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#0c1813]/95 border border-amber-900/40 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden academic-frame">
        {/* Subtle decorative glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-amber-200/40 hover:text-amber-200 hover:bg-white/5 p-1.5 rounded-full transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title & Header */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-11 h-11 bg-[#14261d] border border-amber-500/40 rounded-xl flex items-center justify-center font-bold text-lg mb-3 shadow-md">
            {mode === "signin" ? (
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            ) : mode === "signup" ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <KeyRound className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <h2 className="text-2xl font-scholar-title font-bold tracking-tight text-amber-100">
            {mode === "signin" ? "Scholar Sign In" : mode === "signup" ? "Academy Registry" : "Password Recovery"}
          </h2>
          <p className="text-xs text-amber-200/60 font-academic italic mt-1 text-center">
            {mode === "signin" 
              ? "Welcome back to the Axiom Scholar's Studio" 
              : mode === "signup" 
              ? "Register for unlimited Manim animations, JWT session sync & notebooks" 
              : "Recover your cipher with a secure verification code"}
          </p>
        </div>

        {/* Guest Limit Prompt Banner if triggered by solve threshold */}
        {guestLimitMessage && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">Unlock Scholar Access: </span>
              {guestLimitMessage}
            </div>
          </div>
        )}

        {/* Social Authentication Providers (Google & GitHub) */}
        {mode !== "forgot" && (
          <div className="space-y-2 mb-4">
            <div className="grid grid-cols-2 gap-2.5">
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={() => handleOAuthLogin("google")}
                disabled={Boolean(oauthLoading)}
                className="flex items-center justify-center gap-2 bg-[#12221a] hover:bg-[#182f23] border border-amber-900/40 hover:border-amber-500/40 text-amber-100 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {oauthLoading === "google" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Google</span>
              </button>

              {/* GitHub OAuth Button */}
              <button
                type="button"
                onClick={() => handleOAuthLogin("github")}
                disabled={Boolean(oauthLoading)}
                className="flex items-center justify-center gap-2 bg-[#12221a] hover:bg-[#182f23] border border-amber-900/40 hover:border-amber-500/40 text-amber-100 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {oauthLoading === "github" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                ) : (
                  <Github className="w-4 h-4 text-amber-200" />
                )}
                <span>GitHub</span>
              </button>
            </div>

            {/* Elegant hairline divider */}
            <div className="relative flex items-center justify-center py-2">
              <div className="grow border-t border-amber-900/40" />
              <span className="shrink-0 px-2.5 text-[10px] uppercase tracking-wider text-amber-200/40 font-scholar-title">
                or email cipher
              </span>
              <div className="grow border-t border-amber-900/40" />
            </div>
          </div>
        )}

        {/* Notices */}
        {error && (
          <div className={`mb-4 border text-xs px-3.5 py-2.5 rounded-lg flex items-start gap-2.5 ${
            isRateLimited 
              ? "bg-amber-500/10 border-amber-500/40 text-amber-300" 
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}>
            {isRateLimited ? (
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            )}
            <div>
              <span className="font-bold">{isRateLimited ? "Security Throttling: " : "Notice: "}</span>
              {error}
            </div>
          </div>
        )}

        {successNotice && (
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-2.5 rounded-lg flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div>{successNotice}</div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Display Name Input (Only on Sign Up) */}
          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title" htmlFor="auth-name">
                Scholar Title / Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-amber-200/40 pointer-events-none">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Isaac Newton"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 focus:bg-[#14261d] transition-all"
                />
              </div>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title" htmlFor="auth-email">
              Scholar Email
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-amber-200/40 pointer-events-none">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="auth-email"
                type="email"
                required
                placeholder="scholar@academy.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 focus:bg-[#14261d] transition-all"
              />
            </div>
          </div>

          {/* Password Input for Sign In / Sign Up */}
          {mode !== "forgot" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title" htmlFor="auth-password">
                  Password Cipher
                </label>
                {mode === "signin" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setSuccessNotice(null);
                    }}
                    className="text-[10px] text-amber-400/80 hover:text-amber-300 underline cursor-pointer"
                  >
                    Forgot cipher?
                  </button>
                ) : (
                  password.length > 0 && (
                    <span className={`text-[10px] font-mono font-medium ${passwordSecurity.textColor}`}>
                      {passwordSecurity.label}
                    </span>
                  )
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-amber-200/40 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="auth-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 focus:bg-[#14261d] transition-all"
                />
              </div>

              {/* Password Strength Meter & Requirement Checklist for Signup */}
              {mode === "signup" && (
                <div className="pt-1.5 space-y-1.5">
                  <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
                    <div className={`rounded-full transition-all duration-300 ${passwordSecurity.score >= 1 ? passwordSecurity.color : "bg-white/10"}`} />
                    <div className={`rounded-full transition-all duration-300 ${passwordSecurity.score >= 2 ? passwordSecurity.color : "bg-white/10"}`} />
                    <div className={`rounded-full transition-all duration-300 ${passwordSecurity.score >= 3 ? passwordSecurity.color : "bg-white/10"}`} />
                  </div>
                  <div className="flex flex-col gap-0.5 text-[11px] text-amber-200/60">
                    <div className="flex items-center gap-1.5">
                      <Check className={`w-3.5 h-3.5 ${passwordSecurity.hasMinLength ? "text-emerald-400" : "text-white/20"}`} />
                      <span className={passwordSecurity.hasMinLength ? "text-amber-200/90" : ""}>At least 8 characters</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className={`w-3.5 h-3.5 ${passwordSecurity.hasLetter && passwordSecurity.hasNumberOrSymbol ? "text-emerald-400" : "text-white/20"}`} />
                      <span className={passwordSecurity.hasLetter && passwordSecurity.hasNumberOrSymbol ? "text-amber-200/90" : ""}>Includes letters and numbers or symbols</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Forgot Password Mode: Step 2 Inputs */}
          {mode === "forgot" && resetStep === "verify" && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title" htmlFor="auth-reset-code">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-amber-200/40 pointer-events-none">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    id="auth-reset-code"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.trim())}
                    className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg pl-10 pr-4 py-2.5 text-sm font-mono tracking-widest text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 focus:bg-[#14261d] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title" htmlFor="auth-new-password">
                  New Password Cipher
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-amber-200/40 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="auth-new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 focus:bg-[#14261d] transition-all"
                  />
                </div>
                <div className="pt-1 text-[11px] text-amber-200/60 flex items-center gap-1.5">
                  <Check className={`w-3.5 h-3.5 ${passwordSecurity.isValid ? "text-emerald-400" : "text-white/20"}`} />
                  <span className={passwordSecurity.isValid ? "text-emerald-400 font-semibold" : ""}>
                    {passwordSecurity.isValid ? "Cipher meets strength policy" : "Minimum 8 chars with letters & numbers/symbols"}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={
              loading ||
              (mode === "signup" && password.length > 0 && !passwordSecurity.isValid) ||
              (mode === "forgot" && resetStep === "verify" && (!resetCode || !passwordSecurity.isValid))
            }
            className="w-full bg-[#193626] hover:bg-[#234d37] border border-amber-500/40 disabled:opacity-40 text-amber-200 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg active:scale-[0.98] transform font-scholar-title mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Request...
              </>
            ) : mode === "signin" ? (
              <>
                Enter the Academy
                <ArrowRight className="w-4 h-4" />
              </>
            ) : mode === "signup" ? (
              <>
                Register Credentials
                <ArrowRight className="w-4 h-4" />
              </>
            ) : resetStep === "request" ? (
              <>
                Request Reset Code
                <RotateCw className="w-4 h-4" />
              </>
            ) : (
              <>
                Confirm New Password
                <Check className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Tab Toggle & Footer */}
        <div className="mt-5 pt-3.5 border-t border-amber-900/30 text-center text-xs text-amber-200/60 flex flex-col gap-1.5">
          {mode === "signin" ? (
            <div>
              Not yet registered with the Academy?{" "}
              <button 
                onClick={() => { setMode("signup"); setError(null); setSuccessNotice(null); }}
                className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer font-scholar-title ml-1"
              >
                Sign Up
              </button>
            </div>
          ) : mode === "signup" ? (
            <div>
              Already hold an Academy seat?{" "}
              <button 
                onClick={() => { setMode("signin"); setError(null); setSuccessNotice(null); }}
                className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer font-scholar-title ml-1"
              >
                Sign In
              </button>
            </div>
          ) : (
            <div>
              Remember your cipher?{" "}
              <button 
                onClick={() => { setMode("signin"); setError(null); setSuccessNotice(null); }}
                className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer font-scholar-title ml-1"
              >
                Return to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
