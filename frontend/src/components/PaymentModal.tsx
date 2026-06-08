import React, { useState } from "react";
import { X, Check, Loader2, CreditCard, Sparkles } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToken: string | null;
  onPaymentSuccess: () => void;
}

export default function PaymentModal({ isOpen, onClose, userToken, onPaymentSuccess }: PaymentModalProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [step, setStep] = useState<"plans" | "checkout" | "success">("plans");
  
  // Card Inputs
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Simple card brand detector
  const getCardBrand = (number: string) => {
    const cleanNum = number.replace(/\s+/g, "");
    if (cleanNum.startsWith("4")) return "visa";
    if (cleanNum.startsWith("5")) return "mastercard";
    if (cleanNum.startsWith("3")) return "amex";
    return "generic";
  };

  // Mask card number as 1111 2222 3333 4444
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 16) value = value.slice(0, 16);
    const matches = value.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      setCardNumber(parts.join(" "));
    } else {
      setCardNumber(value);
    }
  };

  // Mask expiry date as MM/YY
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length > 2) {
      setCardExpiry(`${value.slice(0, 2)}/${value.slice(2)}`);
    } else {
      setCardExpiry(value);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardCvv(value);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
      setError("Please fill out all billing information.");
      setLoading(false);
      return;
    }

    if (cardNumber.replace(/\s+/g, "").length < 15) {
      setError("Invalid credit card number.");
      setLoading(false);
      return;
    }

    if (!userToken) {
      setError("Please sign in or register to complete the payment.");
      setLoading(false);
      return;
    }

    // Call Mock upgrade endpoint on FastAPI backend
    try {
      const response = await fetch("/api/payment/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: userToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upgrade request failed. Please try again.");
      }

      setStep("success");
      onPaymentSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cardBrand = getCardBrand(cardNumber);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-zinc-950/70 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden min-h-[450px] flex flex-col">
        {/* Glowing aura background decoration */}
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white hover:bg-white/5 p-1.5 rounded-full transition-all cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step 1: Subscription pricing cards */}
        {step === "plans" && (
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
            <div>
              <div className="text-center mb-8">
                <span className="text-[10px] bg-blue-600/20 text-blue-400 font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-blue-500/20">
                  Premium Tier Plans
                </span>
                <h2 className="text-3xl font-black uppercase tracking-tighter mt-3">Upgrade to MathMotion Pro</h2>
                <p className="text-sm text-white/50 mt-1">Unlock high-quality animations and unlimited math solves.</p>

                {/* Billing Cycle Toggle */}
                <div className="flex items-center justify-center gap-3 mt-6">
                  <span className={`text-xs font-bold uppercase tracking-wider ${billingCycle === "monthly" ? "text-white" : "text-white/40"}`}>Monthly</span>
                  <button 
                    onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
                    className="relative w-12 h-6 bg-zinc-800 rounded-full p-1 transition-colors cursor-pointer border border-white/10"
                  >
                    <div className={`w-4 h-4 bg-blue-600 rounded-full transition-transform ${billingCycle === "yearly" ? "translate-x-6" : ""}`} />
                  </button>
                  <span className={`text-xs font-bold uppercase tracking-wider ${billingCycle === "yearly" ? "text-white" : "text-white/40"}`}>
                    Yearly <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded ml-1 border border-emerald-500/20">Save 33%</span>
                  </span>
                </div>
              </div>

              {/* Plans Comparison Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Plan (Free) */}
                <div className="border border-white/5 bg-white/[0.02] p-6 rounded-xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/40">Free Plan</h3>
                    <p className="text-3xl font-black mt-2 font-mono">$0</p>
                    <p className="text-[10px] text-white/30 uppercase mt-1">Forever Free Tier</p>
                    
                    <ul className="space-y-3 mt-6 text-xs text-white/70">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span>3 Solves limit</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span>Low quality video (480p)</span>
                      </li>
                      <li className="flex items-center gap-2 opacity-40">
                        <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span>No High Resolution rendering</span>
                      </li>
                    </ul>
                  </div>
                  <button 
                    disabled 
                    className="w-full mt-8 py-2.5 border border-white/10 text-white/40 rounded-lg text-xs font-bold uppercase tracking-wider"
                  >
                    Current Plan
                  </button>
                </div>

                {/* Pro Plan (Paid) */}
                <div className="border border-blue-500/30 bg-blue-600/5 p-6 rounded-xl flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-bold uppercase px-3 py-1 tracking-widest rounded-bl-lg">
                    Popular
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400">Pro Plan</h3>
                    <p className="text-3xl font-black mt-2 font-mono">
                      {billingCycle === "monthly" ? "$9.99" : "$79.99"}
                      <span className="text-xs font-normal text-white/40 font-sans">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                    </p>
                    <p className="text-[10px] text-blue-400 uppercase mt-1">
                      {billingCycle === "yearly" ? "$6.66/month billed annually" : "Cancel anytime"}
                    </p>
                    
                    <ul className="space-y-3 mt-6 text-xs text-white/80">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="font-bold text-white">Unlimited equations solves</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="font-bold text-white">High Resolution MP4s (1080p60)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Instant rendering priority</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Custom narration profiles</span>
                      </li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => setStep(userToken ? "checkout" : "checkout")}
                    className="w-full mt-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-600/30 cursor-pointer transition-colors active:scale-[0.98] transform"
                  >
                    {userToken ? "Upgrade to Pro" : "Sign In to Upgrade"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Checkout Drawer & Credit Card Graphic Form */}
        {step === "checkout" && (
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <button 
                  onClick={() => setStep("plans")}
                  className="text-xs text-white/50 hover:text-white flex items-center gap-1 cursor-pointer font-bold uppercase tracking-wider"
                >
                  ← Back to Plans
                </button>
                <h2 className="text-2xl font-black uppercase tracking-tighter mt-2">Secure Checkout</h2>
                <p className="text-xs text-white/50">Payments are safely secured & encrypted.</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg flex items-start gap-2 mb-4">
                  <span className="font-bold">Error:</span> {error}
                </div>
              )}

              {/* Grid layout for Credit Card Visualization & Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Credit Card Graphic */}
                <div className="relative aspect-[1.586/1] bg-gradient-to-br from-blue-700 via-indigo-900 to-zinc-900 rounded-xl p-5 shadow-2xl border border-white/10 text-white overflow-hidden flex flex-col justify-between">
                  {/* Glowing background highlights inside card */}
                  <div className="absolute top-[-30px] right-[-30px] w-32 h-32 bg-cyan-400/20 rounded-full blur-2xl" />
                  
                  {/* Card Brand Header */}
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] tracking-widest uppercase font-black font-mono">MATHMOTION PRO</div>
                    {/* Brand indicator logos */}
                    <div className="h-8 flex items-center justify-center font-bold">
                      {cardBrand === "visa" && <span className="italic text-lg tracking-tight font-black text-white select-none">VISA</span>}
                      {cardBrand === "mastercard" && (
                        <div className="flex items-center -space-x-2">
                          <div className="w-5 h-5 bg-red-500 rounded-full opacity-90" />
                          <div className="w-5 h-5 bg-amber-500 rounded-full opacity-90" />
                        </div>
                      )}
                      {cardBrand === "amex" && <span className="text-sm font-black text-cyan-200 select-none">AMEX</span>}
                      {cardBrand === "generic" && <CreditCard className="w-6 h-6 text-white/50" />}
                    </div>
                  </div>

                  {/* Card Number display */}
                  <div className="text-xl font-bold tracking-widest font-mono select-none my-4">
                    {cardNumber || "•••• •••• •••• ••••"}
                  </div>

                  {/* Card footer details */}
                  <div className="flex justify-between items-end mt-4">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Cardholder Name</div>
                      <div className="text-xs font-bold font-mono truncate uppercase">
                        {cardName || "YOUR FULL NAME"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Expires</div>
                      <div className="text-xs font-bold font-mono">
                        {cardExpiry || "MM/YY"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  {/* Card Name */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-white/50" htmlFor="card-name-input">
                      Cardholder Name
                    </label>
                    <input
                      id="card-name-input"
                      type="text"
                      placeholder="Jane Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors uppercase font-mono"
                    />
                  </div>

                  {/* Card Number */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-white/50" htmlFor="card-num-input">
                      Card Number
                    </label>
                    <input
                      id="card-num-input"
                      type="text"
                      placeholder="4000 1234 5678 9010"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>

                  {/* Expiry and CVV */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-white/50" htmlFor="card-exp-input">
                        Expiry Date
                      </label>
                      <input
                        id="card-exp-input"
                        type="text"
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-white/50" htmlFor="card-cvv-input">
                        CVV / CVC
                      </label>
                      <input
                        id="card-cvv-input"
                        type="password"
                        placeholder="•••"
                        value={cardCvv}
                        onChange={handleCvvChange}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono text-center"
                      />
                    </div>
                  </div>

                  {/* Pay button */}
                  <button
                    type="submit"
                    disabled={loading || !userToken}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98] transform"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Confirm and Pay {billingCycle === "monthly" ? "$9.99" : "$79.99"}
                      </>
                    )}
                  </button>
                  
                  {!userToken && (
                    <p className="text-[10px] text-amber-400 text-center font-bold">
                      * You must be signed in to purchase a subscription.
                    </p>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Success Confirmation Screen */}
        {step === "success" && (
          <div className="p-6 sm:p-12 flex-1 flex flex-col items-center justify-center text-center">
            {/* Animated glowing check ring */}
            <div className="relative w-20 h-20 bg-emerald-500/10 rounded-full border-2 border-emerald-500/30 flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-emerald-400 animate-bounce" />
              <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-lg animate-pulse" />
            </div>

            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded border border-emerald-500/25 font-bold uppercase tracking-widest mb-3">
              Upgrade Successful!
            </span>
            <h2 className="text-3xl font-black uppercase tracking-tighter">You are now Pro!</h2>
            <p className="text-sm text-white/50 max-w-sm mt-2">
              Welcome to the premium math visualization experience. Your solve limit is lifted, and HD video render exports are unlocked.
            </p>

            <button 
              onClick={onClose}
              className="mt-8 px-8 py-3 bg-white text-black hover:bg-blue-600 hover:text-white transition-all text-xs font-black uppercase tracking-widest cursor-pointer rounded-lg shadow-lg active:scale-95 transform"
            >
              Start Solving in Pro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
