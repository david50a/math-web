import React, { useState } from "react";
import {
  X,
  User,
  Shield,
  KeyRound,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  LogOut,
  Database,
  Crown,
  CheckCircle2,
  Github,
  Receipt,
  Calendar,
  CreditCard,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToken: string | null;
  userEmail: string | null;
  userName: string | null;
  isPremium: boolean;
  authProvider: string | null;
  onSignOut: () => void;
  onOpenUpgrade: () => void;
  onOpenDatabaseHub: () => void;
  onProfileUpdated: (newName: string) => void;
  onSubscriptionStatusChange?: () => void;
}

export default function AccountSettingsModal({
  isOpen,
  onClose,
  userToken,
  userEmail,
  userName,
  isPremium,
  authProvider,
  onSignOut,
  onOpenUpgrade,
  onOpenDatabaseHub,
  onProfileUpdated,
  onSubscriptionStatusChange
}: AccountSettingsModalProps) {
  const [displayName, setDisplayName] = useState(userName || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameNotice, setNameNotice] = useState<string | null>(null);

  // Subscription & Invoices states
  const [subInfo, setSubInfo] = useState<any>(null);
  const [isLoadingSub, setIsLoadingSub] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);
  const [subMessage, setSubMessage] = useState<string | null>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Load subscription information
  const fetchSubscriptionInfo = async () => {
    if (!userToken) return;
    setIsLoadingSub(true);
    try {
      const res = await fetch("/api/payment/subscription", {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubInfo(data);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingSub(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && userToken) {
      fetchSubscriptionInfo();
    }
  }, [isOpen, userToken, isPremium]);

  // Keep displayName synced with prop
  React.useEffect(() => {
    if (userName) setDisplayName(userName);
  }, [userName]);

  if (!isOpen) return null;

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !userToken) return;

    setIsUpdatingName(true);
    setNameNotice(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${userToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ display_name: displayName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update profile name.");
      setNameNotice("Profile title updated successfully.");
      onProfileUpdated(displayName.trim());
    } catch (err: any) {
      setNameNotice(`Error: ${err.message}`);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 8) {
      setPasswordError("New password cipher must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password ciphers do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${userToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Password change rejected.");
      
      setPasswordSuccess("Password cipher successfully renewed!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const initial = (userName || userEmail || "S").slice(0, 1).toUpperCase();

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-[#0c1813]/95 border border-amber-900/40 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden academic-frame max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-amber-200/40 hover:text-amber-200 hover:bg-white/5 p-1.5 rounded-full transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Profile Identity */}
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-amber-900/40">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 border-2 border-amber-400/40 flex items-center justify-center font-scholar-title font-bold text-2xl text-amber-100 shadow-lg">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-scholar-title font-bold text-amber-100 truncate">
                {userName || "Scholar Fellow"}
              </h2>
              {isPremium ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Crown className="w-3 h-3 text-amber-300" />
                  Premium Fellow
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  Free Scholar
                </span>
              )}
            </div>
            <p className="text-xs text-amber-200/60 font-mono truncate mt-0.5">
              {userEmail}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-amber-200/50">
              <span className="flex items-center gap-1">
                {authProvider === "github" ? (
                  <Github className="w-3 h-3 text-amber-300" />
                ) : (
                  <Shield className="w-3 h-3 text-emerald-400" />
                )}
                Provider: {authProvider ? authProvider.toUpperCase() : "EMAIL CIPHER"}
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-mono">JWT Session Hardened</span>
            </div>
          </div>
        </div>

        {/* Section 1: Scholar Name Profile */}
        <form onSubmit={handleUpdateName} className="mb-6 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title flex items-center justify-between">
            <span>Scholar Display Title</span>
            {nameNotice && (
              <span className={nameNotice.startsWith("Error") ? "text-red-400" : "text-emerald-400 font-normal"}>
                {nameNotice}
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-amber-200/40 pointer-events-none">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg pl-10 pr-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 transition-all"
                placeholder="Scholar title or full name"
              />
            </div>
            <button
              type="submit"
              disabled={isUpdatingName || !displayName.trim()}
              className="bg-[#193626] hover:bg-[#234d37] border border-amber-500/40 text-amber-200 px-3 py-2 rounded-lg text-xs font-bold font-scholar-title transition-all cursor-pointer disabled:opacity-40"
            >
              {isUpdatingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </button>
          </div>
        </form>

        {/* Section 2: Membership Tier Action & Subscription Management */}
        {!isPremium ? (
          <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-[#182a20] to-amber-500/5 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200 font-scholar-title">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Upgrade to Premium Fellow
              </div>
              <p className="text-[11px] text-amber-200/60 mt-0.5">
                Unlock 1080p60 Manim video exports, unlimited cloud calculation archive, and neural narration voices.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenUpgrade();
              }}
              className="bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider font-scholar-title cursor-pointer transition-all shrink-0 shadow-md active:scale-95 transform"
            >
              Upgrade
            </button>
          </div>
        ) : (
          <div className="mb-6 bg-[#0e1d16] border border-amber-500/40 rounded-xl p-4 space-y-3.5 academic-frame">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-100 font-scholar-title uppercase tracking-wider">
                    {subInfo?.tier === "patron" ? "Academy Lifetime Patron" : "Academy Fellow Active"}
                  </h4>
                  <p className="text-[10px] text-amber-200/50 font-mono">
                    {subInfo?.cycle === "lifetime"
                      ? "Perpetual Access"
                      : subInfo?.cycle === "yearly"
                      ? "Annual Fellowship ($79.99/yr)"
                      : "Monthly Fellowship ($9.99/mo)"}
                  </p>
                </div>
              </div>

              {subInfo?.status === "canceled" ? (
                <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                  Cancels at period end
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              )}
            </div>

            {/* Renewal & Payment Details */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-[#08120d] p-2.5 rounded-lg border border-amber-900/30">
              <div>
                <div className="text-[9px] uppercase font-bold text-amber-200/40 tracking-wider">
                  {subInfo?.status === "canceled" ? "Expires On" : "Next Renewal"}
                </div>
                <div className="text-[11px] font-mono text-amber-100 mt-0.5">
                  {subInfo?.cycle === "lifetime"
                    ? "Lifetime Access"
                    : subInfo?.renews_at
                    ? new Date(subInfo.renews_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Active"}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-amber-200/40 tracking-wider">
                  Payment Method
                </div>
                <div className="text-[11px] font-mono text-amber-100 mt-0.5 flex items-center gap-1 truncate">
                  <CreditCard className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {subInfo?.payment_method_last4
                      ? `${(subInfo.payment_method_brand || "Card").toUpperCase()} •••• ${subInfo.payment_method_last4}`
                      : "Direct Fellowship"}
                  </span>
                </div>
              </div>
            </div>

            {subMessage && (
              <p className="text-[11px] text-amber-300 font-mono bg-amber-500/10 p-2 rounded border border-amber-500/20">
                {subMessage}
              </p>
            )}

            {/* Stripe Billing Portal Button (if Stripe Customer exists) */}
            {subInfo?.stripe_customer_id && (
              <div className="pt-2 border-t border-amber-900/30 flex items-center justify-between">
                <span className="text-[10px] text-amber-200/50 font-mono">Stripe Customer ID: {subInfo.stripe_customer_id.slice(0, 14)}...</span>
                <button
                  type="button"
                  disabled={isSubmittingSub}
                  onClick={async () => {
                    setIsSubmittingSub(true);
                    setSubMessage(null);
                    try {
                      const res = await fetch("/api/payment/customer-portal", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${userToken}` }
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.detail || "Unable to open billing portal.");
                      if (data.url) {
                        window.open(data.url, "_blank");
                      }
                    } catch (err: any) {
                      setSubMessage(`Stripe Portal: ${err.message}`);
                    } finally {
                      setIsSubmittingSub(false);
                    }
                  }}
                  className="bg-[#152e21] hover:bg-[#1d3f2d] border border-amber-500/40 text-amber-200 px-2.5 py-1 rounded text-[10px] font-scholar-title font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <CreditCard className="w-3 h-3 text-amber-400" />
                  <span>Stripe Billing Portal</span>
                  <ExternalLink className="w-2.5 h-2.5 text-amber-300" />
                </button>
              </div>
            )}

            {/* Invoices Toggle & Subscription Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-amber-900/30 text-xs">
              <button
                type="button"
                onClick={() => setShowInvoices(!showInvoices)}
                className="text-amber-300 hover:text-amber-100 flex items-center gap-1 font-scholar-title font-bold text-[11px] cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>{showInvoices ? "Hide Invoices" : "Billing History & Invoices"}</span>
                {showInvoices ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {subInfo?.cycle !== "lifetime" && (
                subInfo?.status === "canceled" ? (
                  <button
                    type="button"
                    disabled={isSubmittingSub}
                    onClick={async () => {
                      setIsSubmittingSub(true);
                      setSubMessage(null);
                      try {
                        const res = await fetch("/api/payment/reactivate-subscription", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${userToken}` }
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.detail || "Reactivation failed.");
                        setSubMessage("Fellowship successfully reactivated!");
                        fetchSubscriptionInfo();
                        onSubscriptionStatusChange?.();
                      } catch (err: any) {
                        setSubMessage(`Error: ${err.message}`);
                      } finally {
                        setIsSubmittingSub(false);
                      }
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold font-scholar-title underline cursor-pointer"
                  >
                    {isSubmittingSub ? "Reactivating..." : "Reactivate Renewal"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmittingSub}
                    onClick={async () => {
                      if (!window.confirm("Cancel fellowship renewal? You will retain all privileges until the end of your billing cycle.")) return;
                      setIsSubmittingSub(true);
                      setSubMessage(null);
                      try {
                        const res = await fetch("/api/payment/cancel-subscription", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${userToken}` }
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.detail || "Cancellation failed.");
                        setSubMessage("Subscription scheduled to cancel at period end.");
                        fetchSubscriptionInfo();
                        onSubscriptionStatusChange?.();
                      } catch (err: any) {
                        setSubMessage(`Error: ${err.message}`);
                      } finally {
                        setIsSubmittingSub(false);
                      }
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 font-bold font-scholar-title underline cursor-pointer"
                  >
                    {isSubmittingSub ? "Canceling..." : "Cancel Renewal"}
                  </button>
                )
              )}
            </div>

            {/* Invoices Dropdown Table */}
            {showInvoices && (
              <div className="mt-3 pt-2 border-t border-amber-900/30 space-y-2">
                <div className="text-[10px] uppercase font-bold text-amber-200/50 font-scholar-title tracking-wider">
                  Past Transactions & Receipts
                </div>
                {subInfo?.recent_invoices && subInfo.recent_invoices.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {subInfo.recent_invoices.map((inv: any) => (
                      <div
                        key={inv.id}
                        className="bg-[#08120d] border border-amber-900/30 rounded p-2 flex items-center justify-between text-[11px] font-mono"
                      >
                        <div>
                          <div className="font-bold text-amber-100">{inv.invoice_number}</div>
                          <div className="text-[9px] text-amber-200/50">
                            {new Date(inv.created_at).toLocaleDateString()} • {inv.plan_name}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400">
                            ${inv.amount.toFixed(2)}
                          </span>
                          <a
                            href={`/api/payment/invoice/${inv.invoice_number}/receipt`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded text-[10px] font-scholar-title flex items-center gap-1 border border-amber-500/30"
                          >
                            <span>Receipt</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-200/40 italic">
                    No billing invoice records found.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 3: Password Cipher Management */}
        <div className="mb-6 border-t border-amber-900/40 pt-5">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold font-scholar-title text-amber-100">
              Change Password Cipher
            </h3>
          </div>

          {passwordError && (
            <div className="mb-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="mb-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-2.5">
            <div>
              <input
                type="password"
                placeholder="Current Password Cipher"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="password"
                placeholder="New Password (8+ chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 transition-all"
              />
              <input
                type="password"
                placeholder="Confirm New Cipher"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#111f18] border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              className="w-full bg-[#15281e] hover:bg-[#1d392a] border border-amber-900/40 text-amber-200 py-2 rounded-lg text-xs font-bold uppercase tracking-wider font-scholar-title transition-all cursor-pointer disabled:opacity-40"
            >
              {isChangingPassword ? "Renewing Cipher..." : "Renew Password Cipher"}
            </button>
          </form>
        </div>

        {/* Section 4: Hub Navigation & Sign Out */}
        <div className="pt-4 border-t border-amber-900/40 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              onClose();
              onOpenDatabaseHub();
            }}
            className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-2 rounded-lg font-bold font-scholar-title cursor-pointer transition-all"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            Open Database Hub
          </button>

          <button
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3.5 py-2 rounded-lg font-bold font-scholar-title cursor-pointer transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
