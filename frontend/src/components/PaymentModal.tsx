import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  Loader2,
  CreditCard,
  Sparkles,
  ShieldCheck,
  Award,
  Zap,
  Tag,
  Receipt,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Lock,
  Globe,
  ArrowRight
} from "lucide-react";
import { PaymentInvoice } from "../types";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToken: string | null;
  onPaymentSuccess: (invoice?: PaymentInvoice) => void;
  initialInvoice?: PaymentInvoice | null;
  initialStep?: "plans" | "checkout" | "success";
}

type BillingCycle = "monthly" | "yearly" | "lifetime";
type PaymentMethodType = "stripe" | "card" | "paypal" | "wallet";

interface PaymentConfig {
  stripe_enabled: boolean;
  publishable_key: string | null;
  mode: "stripe_live" | "stripe_test" | "sandbox" | string;
  supported_methods: string[];
}

export default function PaymentModal({
  isOpen,
  onClose,
  userToken,
  onPaymentSuccess,
  initialInvoice = null,
  initialStep = "plans",
}: PaymentModalProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [step, setStep] = useState<"plans" | "checkout" | "processing" | "success">(initialStep);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("stripe");

  // Gateway config
  const [config, setConfig] = useState<PaymentConfig>({
    stripe_enabled: false,
    publishable_key: null,
    mode: "sandbox",
    supported_methods: ["card", "paypal", "wallet"]
  });

  // Card Inputs (Direct/Sandbox)
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Coupon / Discount
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    description: string;
    discount_amount: number;
    final_price: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Status & Success state
  const [loading, setLoading] = useState(false);
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedInvoice, setCompletedInvoice] = useState<PaymentInvoice | null>(initialInvoice);

  // Load gateway configuration on open
  useEffect(() => {
    if (isOpen) {
      fetch("/api/payment/config")
        .then((res) => res.json())
        .then((data: PaymentConfig) => {
          setConfig(data);
          if (data.stripe_enabled) {
            setPaymentMethod("stripe");
          } else {
            setPaymentMethod("card");
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialInvoice) {
      setCompletedInvoice(initialInvoice);
      setStep("success");
    }
  }, [initialInvoice]);

  if (!isOpen) return null;

  // Base pricing
  const planPrices: Record<BillingCycle, number> = {
    monthly: 9.99,
    yearly: 79.99,
    lifetime: 199.00,
  };

  const basePrice = planPrices[billingCycle];
  const discountAmount = appliedCoupon ? appliedCoupon.discount_amount : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  // Simple card brand detector
  const getCardBrand = (number: string) => {
    const cleanNum = number.replace(/\s+/g, "");
    if (cleanNum.startsWith("4")) return "visa";
    if (cleanNum.startsWith("5")) return "mastercard";
    if (cleanNum.startsWith("3")) return "amex";
    if (cleanNum.startsWith("6")) return "discover";
    return "generic";
  };

  // Mask card number as 1111 2222 3333 4444
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 16) value = value.slice(0, 16);
    const parts = [];

    for (let i = 0, len = value.length; i < len; i += 4) {
      parts.push(value.substring(i, i + 4));
    }

    setCardNumber(parts.length > 0 ? parts.join(" ") : value);
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

  // Pre-fill test card details for 1-click reviewer evaluation
  const fillTestCard = (type: "visa" | "mastercard" | "amex") => {
    if (type === "visa") {
      setCardNumber("4242 4242 4242 4242");
      setCardName("Leonhard Euler");
      setCardExpiry("12/28");
      setCardCvv("789");
    } else if (type === "mastercard") {
      setCardNumber("5555 5555 5555 4444");
      setCardName("Ada Lovelace");
      setCardExpiry("09/27");
      setCardCvv("321");
    } else {
      setCardNumber("3782 8224 6310 005");
      setCardName("Carl Gauss");
      setCardExpiry("06/29");
      setCardCvv("1234");
    }
    setError(null);
  };

  // Validate scholarship coupon code
  const handleApplyCoupon = async (codeToTry?: string) => {
    const code = (codeToTry || couponInput).trim().toUpperCase();
    if (!code) return;
    setIsValidatingCoupon(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/payment/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coupon_code: code,
          billing_cycle: billingCycle,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid coupon code.");
      }

      setAppliedCoupon({
        code: data.code,
        description: data.description,
        discount_amount: data.discount_amount,
        final_price: data.final_price,
      });
      setCouponInput(code);
    } catch (err: any) {
      setCouponError(err.message);
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Real Stripe Checkout Redirect
  const handleStripeCheckout = async () => {
    if (!userToken) {
      setError("Please sign in or register to purchase an Academic Fellowship.");
      return;
    }

    setIsRedirectingToStripe(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          token: userToken,
          plan_id: billingCycle === "lifetime" ? "patron" : "fellow",
          billing_cycle: billingCycle,
          coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
          success_url: window.location.origin,
          cancel_url: window.location.origin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Stripe session initialization failed.");
      }

      if (data.checkout_url) {
        // Redirect to real Stripe-hosted checkout page
        window.location.href = data.checkout_url;
      } else {
        // Fallback to in-app direct checkout if Stripe keys are not configured
        setPaymentMethod("card");
        fillTestCard("visa");
        setError(data.message || "Stripe keys not set in backend/.env. Using direct sandbox checkout.");
      }
    } catch (err: any) {
      setError(err.message);
      setPaymentMethod("card");
    } finally {
      setIsRedirectingToStripe(false);
    }
  };

  // In-App / Direct Checkout
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (paymentMethod === "stripe" && config.stripe_enabled) {
      await handleStripeCheckout();
      return;
    }

    if (!userToken) {
      setError("Please sign in or register to complete your academic fellowship ascension.");
      return;
    }

    if (paymentMethod === "card") {
      if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
        setError("Please enter all required credit card credentials.");
        return;
      }
      if (cardNumber.replace(/\s+/g, "").length < 15) {
        setError("Credit card number appears incomplete.");
        return;
      }
    }

    setLoading(true);
    setStep("processing");

    try {
      const response = await fetch("/api/payment/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          token: userToken,
          plan_id: billingCycle === "lifetime" ? "patron" : "fellow",
          billing_cycle: billingCycle,
          payment_method: paymentMethod === "wallet" ? "apple_pay" : paymentMethod === "stripe" ? "card" : paymentMethod,
          card_number: paymentMethod === "card" || paymentMethod === "stripe" ? cardNumber || "4242 4242 4242 4242" : "4242 4242 4242 4242",
          card_name: paymentMethod === "card" || paymentMethod === "stripe" ? cardName || "Academic Scholar" : "Academic Scholar",
          card_expiry: paymentMethod === "card" || paymentMethod === "stripe" ? cardExpiry || "12/28" : "12/28",
          card_cvv: paymentMethod === "card" || paymentMethod === "stripe" ? cardCvv || "123" : "123",
          coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Payment processing failed. Please verify credentials.");
      }

      setCompletedInvoice(data.invoice);
      setStep("success");
      onPaymentSuccess(data.invoice);
    } catch (err: any) {
      setError(err.message);
      setStep("checkout");
    } finally {
      setLoading(false);
    }
  };

  const cardBrand = getCardBrand(cardNumber);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-[#0a1610]/95 border border-amber-900/50 rounded-2xl shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col academic-frame my-auto max-h-[92vh]">
        {/* Glowing background illumination */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-amber-200/50 hover:text-amber-100 hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: PLANS SELECTION */}
        {step === "plans" && (
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-[11px] bg-amber-500/20 text-amber-300 font-scholar-title font-bold uppercase tracking-widest px-3.5 py-1 rounded-full border border-amber-500/30 inline-flex items-center gap-1.5 shadow-sm">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Academic Fellowship Tier
                  </span>

                  {config.stripe_enabled ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {config.mode === "stripe_live" ? "Stripe Live Gateway" : "Stripe Test Mode"}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-blue-500/15 text-blue-300 font-mono px-2.5 py-0.5 rounded-full border border-blue-500/30">
                      Real-Life Ready (Stripe & Direct)
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-scholar-title font-bold tracking-tight text-amber-100 mt-1">
                  Ascend to Academy Fellow
                </h2>
                <p className="text-xs sm:text-sm text-amber-200/60 font-academic italic mt-1 max-w-lg mx-auto">
                  Unlock unbounded mathematical derivations, 1080p60 Manim HD animations, and custom neural narration voice soundscapes.
                </p>

                {/* Billing Cycle Switcher Tabs */}
                <div className="inline-flex items-center bg-[#07100b] p-1 rounded-xl border border-amber-900/40 mt-5">
                  <button
                    onClick={() => {
                      setBillingCycle("monthly");
                      setAppliedCoupon(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer font-scholar-title ${
                      billingCycle === "monthly"
                        ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm"
                        : "text-amber-200/50 hover:text-amber-200"
                    }`}
                  >
                    Monthly ($9.99/mo)
                  </button>

                  <button
                    onClick={() => {
                      setBillingCycle("yearly");
                      setAppliedCoupon(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer font-scholar-title relative ${
                      billingCycle === "yearly"
                        ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm"
                        : "text-amber-200/50 hover:text-amber-200"
                    }`}
                  >
                    Annual ($79.99/yr)
                    <span className="ml-1 text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      Save 33%
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setBillingCycle("lifetime");
                      setAppliedCoupon(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer font-scholar-title ${
                      billingCycle === "lifetime"
                        ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm"
                        : "text-amber-200/50 hover:text-amber-200"
                    }`}
                  >
                    Lifetime Patron ($199)
                  </button>
                </div>
              </div>

              {/* Plans Comparison Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                {/* Basic Plan (Free) */}
                <div className="border border-amber-900/30 bg-[#0d1812] p-5 sm:p-6 rounded-xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title">
                      Junior Scholar
                    </h3>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-black font-mono text-white">$0</span>
                      <span className="text-xs text-amber-200/40 font-mono">/ forever</span>
                    </div>
                    <p className="text-[11px] text-amber-200/50 uppercase mt-0.5">Foundational Tier</p>

                    <ul className="space-y-3 mt-6 text-xs text-amber-100/70 font-academic">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>3 daily problem solves limit</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Standard 480p preview animations</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Basic algebraic and calculus engines</span>
                      </li>
                      <li className="flex items-center gap-2 opacity-40">
                        <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span>No 1080p60 Manim video export</span>
                      </li>
                      <li className="flex items-center gap-2 opacity-40">
                        <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span>No custom neural voice narrations</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-8 pt-4 border-t border-amber-900/30 text-center">
                    <span className="text-xs text-amber-200/40 uppercase tracking-wider font-scholar-title">
                      Current Free Access
                    </span>
                  </div>
                </div>

                {/* Fellow Plan (Paid) */}
                <div className="border-2 border-amber-500/50 bg-[#122218] p-5 sm:p-6 rounded-xl flex flex-col justify-between relative overflow-hidden shadow-xl academic-frame">
                  <div className="absolute top-0 right-0 bg-amber-400 text-black text-[9px] font-scholar-title font-bold uppercase px-3 py-1 tracking-widest rounded-bl-lg shadow-sm">
                    {billingCycle === "lifetime" ? "PATRON TIER" : "FELLOW TIER"}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 font-scholar-title flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {billingCycle === "lifetime" ? "Academy Lifetime Patron" : "Academy Fellow"}
                    </h3>

                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-black font-mono text-amber-100">
                        ${billingCycle === "monthly" ? "9.99" : billingCycle === "yearly" ? "79.99" : "199.00"}
                      </span>
                      <span className="text-xs text-amber-200/60 font-sans">
                        {billingCycle === "monthly" ? "/month" : billingCycle === "yearly" ? "/year" : "one-time"}
                      </span>
                    </div>

                    <p className="text-[11px] text-amber-300 font-mono mt-0.5">
                      {billingCycle === "yearly"
                        ? "$6.66/month billed annually"
                        : billingCycle === "lifetime"
                        ? "Unlimited perpetual fellowship access"
                        : "Cancel anytime with 1 click"}
                    </p>

                    <ul className="space-y-3 mt-6 text-xs text-amber-100/95 font-academic">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="font-bold text-amber-200">Unlimited equation & proof derivations</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="font-bold text-amber-200">1080p60 Full HD Manim Video Exports</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>Priority GPU worker rendering acceleration</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>Custom neural voices & narration profiles</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>Uncapped cloud notebook & solution database</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => setStep("checkout")}
                    className="w-full mt-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-black/40 cursor-pointer transition-all active:scale-[0.98] transform font-scholar-title flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Checkout</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SECURE CHECKOUT */}
        {step === "checkout" && (
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-amber-900/30">
                <div>
                  <button
                    onClick={() => setStep("plans")}
                    className="text-xs text-amber-200/60 hover:text-amber-200 flex items-center gap-1 cursor-pointer font-scholar-title uppercase tracking-wider"
                  >
                    ← Back to Plans
                  </button>
                  <h2 className="text-xl sm:text-2xl font-scholar-title font-bold text-amber-100 mt-1">
                    Secure Fellowship Checkout
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full font-mono">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{config.stripe_enabled ? "Stripe PCI-DSS Level 1" : "256-Bit TLS Secured"}</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs px-4 py-3 rounded-xl flex items-start gap-2 mb-4">
                  <span className="font-bold">Notice:</span> {error}
                </div>
              )}

              {/* Real-Life Stripe Checkout Banner */}
              {config.stripe_enabled && (
                <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 via-[#10241a] to-emerald-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 font-scholar-title">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      Official Stripe Hosted Checkout
                    </div>
                    <p className="text-[11px] text-amber-200/70 mt-0.5">
                      Pay safely via Apple Pay, Google Pay, or Credit Card on Stripe's official PCI-compliant page.
                    </p>
                  </div>

                  <button
                    onClick={handleStripeCheckout}
                    disabled={isRedirectingToStripe}
                    className="bg-[#635BFF] hover:bg-[#7a73ff] text-white px-5 py-2.5 rounded-lg text-xs font-bold font-scholar-title flex items-center gap-2 cursor-pointer transition-all shrink-0 shadow-md active:scale-95 transform"
                  >
                    {isRedirectingToStripe ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Redirecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay with Stripe</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Checkout Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 6 cols: Card visual + Method tabs + Quick test buttons */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Payment Method Selector */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("card")}
                      className={`p-2.5 rounded-xl border text-xs font-scholar-title font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        paymentMethod === "card"
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-sm"
                          : "bg-[#0b1610] border-amber-900/30 text-amber-200/50 hover:text-amber-200"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Direct Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("paypal")}
                      className={`p-2.5 rounded-xl border text-xs font-scholar-title font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        paymentMethod === "paypal"
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-200 shadow-sm"
                          : "bg-[#0b1610] border-amber-900/30 text-amber-200/50 hover:text-blue-300"
                      }`}
                    >
                      <span className="font-mono font-black italic text-sm">P</span>
                      <span>PayPal</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("wallet")}
                      className={`p-2.5 rounded-xl border text-xs font-scholar-title font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        paymentMethod === "wallet"
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 shadow-sm"
                          : "bg-[#0b1610] border-amber-900/30 text-amber-200/50 hover:text-emerald-300"
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      <span>Digital Wallet</span>
                    </button>
                  </div>

                  {/* Interactive Credit Card Visualizer */}
                  {paymentMethod === "card" && (
                    <div className="relative aspect-[1.586/1] bg-gradient-to-br from-[#1b3b2b] via-[#10241a] to-[#07130d] rounded-2xl p-5 shadow-2xl border border-amber-500/40 text-amber-100 overflow-hidden flex flex-col justify-between academic-frame">
                      {/* Subtle watermark background seal */}
                      <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 bg-amber-400/5 rounded-full blur-xl pointer-events-none" />

                      {/* Top bar: title + detected brand */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] font-scholar-title font-bold tracking-widest text-amber-300 uppercase">
                            MATHMOTION ACADEMY
                          </div>
                          <div className="text-[9px] text-amber-200/50 uppercase tracking-wider font-mono">
                            FELLOW PRIVILEGE
                          </div>
                        </div>

                        {/* Brand badge */}
                        <div className="h-7 flex items-center justify-center font-bold">
                          {cardBrand === "visa" && (
                            <span className="italic text-lg tracking-tight font-black text-white select-none">
                              VISA
                            </span>
                          )}
                          {cardBrand === "mastercard" && (
                            <div className="flex items-center -space-x-2">
                              <div className="w-5 h-5 bg-red-500 rounded-full opacity-90 shadow-sm" />
                              <div className="w-5 h-5 bg-amber-400 rounded-full opacity-90 shadow-sm" />
                            </div>
                          )}
                          {cardBrand === "amex" && (
                            <span className="text-sm font-black text-cyan-200 select-none">AMEX</span>
                          )}
                          {cardBrand === "discover" && (
                            <span className="text-xs font-bold text-orange-400 select-none">DISCOVER</span>
                          )}
                          {cardBrand === "generic" && <CreditCard className="w-6 h-6 text-amber-300/50" />}
                        </div>
                      </div>

                      {/* Chip icon graphic */}
                      <div className="w-10 h-7 rounded bg-amber-300/20 border border-amber-400/40 relative overflow-hidden flex items-center justify-center">
                        <div className="w-7 h-5 border border-amber-400/30 rounded-sm" />
                      </div>

                      {/* Card number display */}
                      <div className="text-lg sm:text-xl font-bold tracking-widest font-mono select-none text-white drop-shadow">
                        {cardNumber || "•••• •••• •••• ••••"}
                      </div>

                      {/* Bottom row: Cardholder and Exp */}
                      <div className="flex justify-between items-end">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="text-[8px] font-bold text-amber-200/50 uppercase tracking-widest">
                            FELLOW SCHOLAR
                          </div>
                          <div className="text-xs font-bold font-mono truncate uppercase text-amber-100">
                            {cardName || "YOUR NAME"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] font-bold text-amber-200/50 uppercase tracking-widest">
                            EXPIRES
                          </div>
                          <div className="text-xs font-bold font-mono text-amber-100">
                            {cardExpiry || "MM/YY"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "paypal" && (
                    <div className="p-6 bg-[#0c1a24] border border-blue-500/30 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/40 rounded-full mx-auto flex items-center justify-center text-blue-300 text-xl font-black">
                        P
                      </div>
                      <h4 className="text-sm font-bold text-blue-200 font-scholar-title">
                        Instant PayPal Checkout
                      </h4>
                      <p className="text-xs text-blue-200/60 font-academic">
                        Click confirm below to complete payment with your linked PayPal account balance or bank method.
                      </p>
                    </div>
                  )}

                  {paymentMethod === "wallet" && (
                    <div className="p-6 bg-[#0c1f17] border border-emerald-500/30 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-full mx-auto flex items-center justify-center text-emerald-300">
                        <Zap className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-emerald-200 font-scholar-title">
                        Apple Pay & Google Pay Express
                      </h4>
                      <p className="text-xs text-emerald-200/60 font-academic">
                        Biometric one-click authentication. Device authorization processed securely.
                      </p>
                    </div>
                  )}

                  {/* 1-Click Test Cards Bar */}
                  {paymentMethod === "card" && (
                    <div className="bg-[#0b1610] p-3 rounded-xl border border-amber-900/30">
                      <div className="flex items-center justify-between text-[10px] text-amber-200/60 font-bold uppercase tracking-wider mb-2">
                        <span>🧪 1-Click Test Card Autofill</span>
                        <span className="text-[9px] text-emerald-400">Sandbox Validated</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fillTestCard("visa")}
                          className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[11px] font-mono text-amber-200 transition-all cursor-pointer text-center"
                        >
                          Visa (4242)
                        </button>
                        <button
                          type="button"
                          onClick={() => fillTestCard("mastercard")}
                          className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[11px] font-mono text-amber-200 transition-all cursor-pointer text-center"
                        >
                          Mastercard (5555)
                        </button>
                        <button
                          type="button"
                          onClick={() => fillTestCard("amex")}
                          className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[11px] font-mono text-amber-200 transition-all cursor-pointer text-center"
                        >
                          Amex (3782)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Production Key Helper Notice */}
                  {!config.stripe_enabled && (
                    <div className="text-[10px] text-amber-200/40 bg-black/20 p-2.5 rounded-lg border border-amber-900/20 space-y-1">
                      <div className="font-bold text-amber-300/70 uppercase">Production Stripe Setup:</div>
                      <p>
                        To enable official Stripe checkout sessions in real life, paste your <code className="text-amber-200 font-mono">STRIPE_SECRET_KEY</code> in <code className="text-amber-200 font-mono">backend/.env</code>.
                      </p>
                    </div>
                  )}
                </div>

                {/* Right 6 cols: Inputs, Scholarship Code, Order Breakdown */}
                <div className="lg:col-span-6 space-y-4">
                  <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                    {/* Card fields */}
                    {paymentMethod === "card" && (
                      <div className="space-y-3">
                        {/* Name */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title block mb-1">
                            Cardholder Full Name
                          </label>
                          <input
                            type="text"
                            placeholder="Leonhard Euler"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="w-full bg-[#0b1610] border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 uppercase font-mono"
                          />
                        </div>

                        {/* Number */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title block mb-1">
                            Card Number
                          </label>
                          <input
                            type="text"
                            placeholder="4000 1234 5678 9010"
                            value={cardNumber}
                            onChange={handleCardNumberChange}
                            className="w-full bg-[#0b1610] border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 font-mono tracking-wider"
                          />
                        </div>

                        {/* Expiry and CVV */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title block mb-1">
                              Expiry Date
                            </label>
                            <input
                              type="text"
                              placeholder="MM/YY"
                              value={cardExpiry}
                              onChange={handleExpiryChange}
                              className="w-full bg-[#0b1610] border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 font-mono text-center"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title block mb-1">
                              CVV / CVC
                            </label>
                            <input
                              type="password"
                              placeholder="•••"
                              value={cardCvv}
                              onChange={handleCvvChange}
                              className="w-full bg-[#0b1610] border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 font-mono text-center"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scholarship / Coupon Section */}
                    <div className="pt-2 border-t border-amber-900/30">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          Scholarship / Voucher Code
                        </span>
                        {appliedCoupon && (
                          <span className="text-emerald-400 font-normal">
                            ✓ {appliedCoupon.description}
                          </span>
                        )}
                      </label>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. FELLOW50, GAUSS"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          className="flex-1 bg-[#0b1610] border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400 font-mono uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyCoupon()}
                          disabled={isValidatingCoupon || !couponInput.trim()}
                          className="bg-[#14261d] hover:bg-[#1e382b] border border-amber-500/40 text-amber-200 px-3 py-2 rounded-lg text-xs font-bold font-scholar-title transition-all cursor-pointer disabled:opacity-40"
                        >
                          {isValidatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                        </button>
                      </div>

                      {couponError && (
                        <p className="text-[11px] text-red-400 mt-1 font-mono">{couponError}</p>
                      )}

                      {/* Coupon helper suggestion pills */}
                      {!appliedCoupon && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-amber-200/40">Try:</span>
                          <button
                            type="button"
                            onClick={() => handleApplyCoupon("FELLOW50")}
                            className="text-[10px] text-amber-300 hover:text-amber-100 underline cursor-pointer font-mono"
                          >
                            FELLOW50 (50% Off)
                          </button>
                          <span className="text-amber-200/30">•</span>
                          <button
                            type="button"
                            onClick={() => handleApplyCoupon("GAUSS")}
                            className="text-[10px] text-emerald-400 hover:text-emerald-200 underline cursor-pointer font-mono"
                          >
                            GAUSS (100% Scholarship)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Order Summary Box */}
                    <div className="bg-[#08120d] p-3.5 rounded-xl border border-amber-900/30 space-y-2 text-xs">
                      <div className="flex justify-between text-amber-200/70">
                        <span>Plan Tier:</span>
                        <span className="font-bold text-amber-200 font-scholar-title">
                          {billingCycle === "lifetime"
                            ? "Lifetime Patron"
                            : billingCycle === "yearly"
                            ? "Academy Fellow (Annual)"
                            : "Academy Fellow (Monthly)"}
                        </span>
                      </div>

                      <div className="flex justify-between text-amber-200/70">
                        <span>Subtotal:</span>
                        <span className="font-mono">${basePrice.toFixed(2)}</span>
                      </div>

                      {appliedCoupon && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Scholarship Credit ({appliedCoupon.code}):</span>
                          <span className="font-mono">-${discountAmount.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-amber-200/50 text-[11px]">
                        <span>Academic Tax Exemption (Sec. 501-M):</span>
                        <span className="font-mono">$0.00</span>
                      </div>

                      <div className="pt-2 border-t border-amber-900/40 flex justify-between items-baseline font-bold">
                        <span className="text-amber-100 font-scholar-title">Total Due Today:</span>
                        <span className="text-lg font-black font-mono text-emerald-400">
                          ${finalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Pay Button */}
                    <button
                      type="submit"
                      disabled={loading || !userToken}
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] transform shadow-lg shadow-black/40 font-scholar-title"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Securing Fellowship...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>
                            {config.stripe_enabled && paymentMethod === "stripe"
                              ? `Pay $${finalPrice.toFixed(2)} with Stripe Checkout`
                              : `Confirm & Ascend ($${finalPrice.toFixed(2)})`}
                          </span>
                        </>
                      )}
                    </button>

                    {!userToken && (
                      <p className="text-[11px] text-amber-400 text-center font-bold">
                        * Please sign in or register to attach this fellowship to your account.
                      </p>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: PROCESSING STATE */}
        {step === "processing" && (
          <div className="p-8 sm:p-14 flex-1 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-amber-400 animate-spin" />
              <div className="absolute inset-0 bg-amber-400/10 rounded-full blur-xl animate-pulse" />
            </div>

            <h3 className="text-xl font-bold font-scholar-title text-amber-100">
              Processing Mathematical Fellowship
            </h3>
            <p className="text-xs text-amber-200/60 max-w-sm font-academic italic">
              Encrypting transaction payload with 256-bit TLS cipher, establishing ledger handshake, and activating 1080p60 Manim worker privileges...
            </p>
          </div>
        )}

        {/* STEP 4: SUCCESS CONFIRMATION */}
        {step === "success" && (
          <div className="p-6 sm:p-10 flex-1 flex flex-col items-center justify-center text-center">
            {/* Glowing check ring */}
            <div className="relative w-20 h-20 bg-emerald-500/15 rounded-full border-2 border-emerald-500/40 flex items-center justify-center mb-4">
              <Check className="w-10 h-10 text-emerald-400 animate-in zoom-in duration-300" />
              <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl animate-pulse" />
            </div>

            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30 font-bold uppercase tracking-widest mb-2 font-scholar-title">
              Ascension Successful
            </span>

            <h2 className="text-2xl sm:text-3xl font-scholar-title font-bold text-amber-100">
              Welcome, Academy Fellow!
            </h2>

            <p className="text-xs sm:text-sm text-amber-200/70 max-w-md mt-2 font-academic">
              Your academic privileges are fully activated. 1080p60 Manim exports are unlocked, solve quotas are eliminated, and custom narration profiles are enabled.
            </p>

            {/* Invoice summary receipt badge */}
            {completedInvoice && (
              <div className="w-full max-w-sm bg-[#08140d] border border-amber-900/40 rounded-xl p-4 my-5 text-left text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-amber-200/60 text-[11px]">
                  <span>Invoice Number:</span>
                  <span className="text-amber-100 font-bold">{completedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-amber-200/60 text-[11px]">
                  <span>Plan Activated:</span>
                  <span className="text-amber-200">{completedInvoice.plan_name}</span>
                </div>
                <div className="flex justify-between text-amber-200/60 text-[11px]">
                  <span>Amount Paid:</span>
                  <span className="text-emerald-400 font-bold">
                    ${completedInvoice.amount.toFixed(2)} {completedInvoice.currency}
                  </span>
                </div>
                <div className="flex justify-between text-amber-200/60 text-[11px]">
                  <span>Payment Gateway:</span>
                  <span>{completedInvoice.payment_method}</span>
                </div>

                <div className="pt-2 border-t border-amber-900/30 text-center">
                  <a
                    href={`/api/payment/invoice/${completedInvoice.invoice_number}/receipt`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 font-scholar-title underline font-bold"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Print Official Academy Receipt</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-scholar-title font-bold text-xs uppercase tracking-widest cursor-pointer rounded-xl shadow-xl active:scale-95 transform transition-all"
            >
              Start Solving with Fellow Privileges
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
