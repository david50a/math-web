import React, { useState } from "react";
import { X, Lock, Mail, ArrowRight, Loader2, Sparkles } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: "signin" | "signup";
  onAuthSuccess: (token: string, email: string, isPremium: boolean) => void;
}

export default function AuthModal({ isOpen, onClose, initialMode, onAuthSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    const endpoint = mode === "signin" ? "/api/auth/signin" : "/api/auth/signup";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed. Please check your credentials.");
      }

      if (mode === "signin") {
        onAuthSuccess(data.session_token, data.email, data.is_premium);
        onClose();
      } else {
        // Automatically sign in after signup
        const signinRes = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const signinData = await signinRes.json();
        if (signinRes.ok) {
          onAuthSuccess(signinData.session_token, signinData.email, signinData.is_premium);
          onClose();
        } else {
          setMode("signin");
          setError("Account created! Please sign in.");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 bg-[#14261d] border border-amber-500/40 rounded-lg flex items-center justify-center font-bold text-lg mb-3 shadow-md">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <h2 className="text-2xl font-scholar-title font-bold tracking-tight text-amber-100">
            {mode === "signin" ? "Scholar Sign In" : "Academy Registry"}
          </h2>
          <p className="text-xs text-amber-200/60 font-academic italic mt-1">
            {mode === "signin" ? "Welcome back to the Scholar's Studio" : "Begin rendering rigorous math animations"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg flex items-start gap-2">
              <span className="font-bold">Error:</span> {error}
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
                placeholder="scholar@academy.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 focus:bg-[#14261d] transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title" htmlFor="auth-password">
              Password Cipher
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-amber-200/40 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="auth-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 focus:bg-[#14261d] transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#193626] hover:bg-[#234d37] border border-amber-500/40 disabled:opacity-40 text-amber-200 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg active:scale-[0.98] transform font-scholar-title"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying Credentials...
              </>
            ) : (
              <>
                {mode === "signin" ? "Enter the Academy" : "Register Credentials"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Tab Toggle */}
        <div className="mt-6 pt-4 border-t border-amber-900/30 text-center text-xs text-amber-200/60">
          {mode === "signin" ? (
            <>
              Not yet registered with the Academy?{" "}
              <button 
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer font-scholar-title ml-1"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already hold an Academy seat?{" "}
              <button 
                onClick={() => { setMode("signin"); setError(null); }}
                className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer font-scholar-title ml-1"
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
