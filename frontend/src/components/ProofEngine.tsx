import React, { useState, useEffect, useRef } from "react";
import {
  GraduationCap,
  Sparkles,
  Search,
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Scale,
  Scroll,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Share2,
  Lightbulb,
  Cpu,
  Table as TableIcon,
  Play,
  RotateCcw
} from "lucide-react";
import { KatexMath } from "./Whiteboard";
import { ThemeType, ProofResult, ProofStep, ProofPreset, StepVerificationResult } from "../types";
import { BOARD_THEMES } from "./boards/themePalette";


interface ProofEngineProps {
  theme: ThemeType;
  initialStatement?: string;
  onSendToStudio?: (formula: string) => void;
}

export default function ProofEngine({
  theme,
  initialStatement = "sum(i, 1, n) = n*(n+1)/2",
  onSendToStudio
}: ProofEngineProps) {
  const [statementInput, setStatementInput] = useState<string>(initialStatement);
  const [activeStatement, setActiveStatement] = useState<string>(initialStatement);
  const [selectedMethod, setSelectedMethod] = useState<string>("auto");
  const [proof, setProof] = useState<ProofResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active view tab: "formal" | "induction" | "truthtable" | "verifier" | "alternates"
  const [activeTab, setActiveTab] = useState<"formal" | "induction" | "truthtable" | "verifier" | "alternates">("formal");

  // Proof Library Presets
  const [presets, setPresets] = useState<ProofPreset[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [libraryFilter, setLibraryFilter] = useState<string>("All");
  const [librarySearch, setLibrarySearch] = useState<string>("");

  // Interactive Verifier State
  const [verifyCurrent, setVerifyCurrent] = useState<string>("(x + 1)^2");
  const [verifyNext, setVerifyNext] = useState<string>("x^2 + 2*x + 1");
  const [verifyTarget, setVerifyTarget] = useState<string>("x^2 + 2*x + 1");
  const [verifyResult, setVerifyResult] = useState<StepVerificationResult | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);

  // Copied alert
  const [copiedType, setCopiedType] = useState<"latex" | "markdown" | null>(null);

  const rawColors = BOARD_THEMES[theme] || BOARD_THEMES.darkAI;
  const colors = {
    ...rawColors,
    border: rawColors.cardBorder,
    canvasBg: rawColors.cardBg
  };
  const isLight = theme === "lightAcademic" || theme === "notebook";
  const isChalkboard = theme === "chalkboard";


  // Fetch proof library presets on mount
  useEffect(() => {
    fetchPresets();
  }, []);

  // Solve initial statement on mount
  useEffect(() => {
    handleProve(initialStatement, "auto");
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/proof/library");
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (err) {
      console.warn("Could not load proof library:", err);
    }
  };

  const handleProve = async (stmt: string = statementInput, method: string = selectedMethod) => {
    if (!stmt.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("http://localhost:4000/api/proof/prove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: stmt.trim(),
          method: method
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Proof generation error." }));
        throw new Error(errData.detail || "Failed to generate mathematical proof.");
      }

      const data: ProofResult = await res.json();
      setProof(data);
      setActiveStatement(stmt.trim());

      // Smart tab selection based on proof type
      if (data.proof_type === "induction" && data.induction_data) {
        setActiveTab("induction");
      } else if (data.proof_type === "logic" && data.truth_table) {
        setActiveTab("truthtable");
      } else {
        setActiveTab("formal");
      }

      // Initialize interactive verifier with theorem steps
      if (data.formal_steps && data.formal_steps.length >= 2) {
        setVerifyCurrent(data.formal_steps[0].latex.replace(/\\text\{LHS\}\s*=\s*/, ""));
        setVerifyNext(data.formal_steps[1].latex.replace(/^=\s*/, ""));
        setVerifyTarget(data.formal_steps[data.formal_steps.length - 1].latex.replace(/=\s*\\text\{RHS\}/, ""));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while computing the proof.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyStep = async () => {
    if (!verifyCurrent.trim() || !verifyNext.trim()) return;
    setVerifying(true);
    try {
      const res = await fetch("http://localhost:4000/api/proof/verify-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_expr: verifyCurrent.trim(),
          next_step: verifyNext.trim(),
          target_expr: verifyTarget.trim() || undefined
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Verification error." }));
        throw new Error(err.detail);
      }
      const data: StepVerificationResult = await res.json();
      setVerifyResult(data);
    } catch (err: any) {
      setVerifyResult({
        is_valid: false,
        rule_name: "Error",
        feedback: err.message || "Could not verify derivation step."
      });
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string, type: "latex" | "markdown") => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const generateMarkdownProof = (): string => {
    if (!proof) return "";
    let md = `# Mathematical Proof: ${proof.statement}\n\n`;
    md += `**Technique:** ${proof.proof_type_label}\n`;
    md += `**Status:** ${proof.is_valid ? "Formally Verified (Q.E.D.)" : "Refuted"}\n\n`;
    md += `## Statement\n$$${proof.latex_statement}$$\n\n`;
    md += `## Summary\n${proof.summary}\n\n`;
    md += `## Formal Proof Steps\n\n`;
    proof.formal_steps.forEach((s) => {
      md += `### Step ${s.step_number}: ${s.title}\n`;
      md += `$$${s.latex}$$\n`;
      md += `*Justification:* ${s.justification} (${s.rule_name || "Deductive Rule"})\n\n`;
    });
    md += `$$\\blacksquare \\quad \\text{Q.E.D.}$$\n`;
    return md;
  };

  const generateLatexProof = (): string => {
    if (!proof) return "";
    let tex = `\\begin{theorem}\n${proof.latex_statement}\n\\end{theorem}\n\n\\begin{proof}\n`;
    proof.formal_steps.forEach((s) => {
      tex += `\\paragraph{Step ${s.step_number}: ${s.title}}\n`;
      tex += `\\[ ${s.latex} \\]\n`;
      tex += `${s.justification} \\textit{(${s.rule_name || "Axiom"})}\n\n`;
    });
    tex += `\\qed\n\\end{proof}`;
    return tex;
  };

  const insertSymbol = (sym: string) => {
    setStatementInput((prev) => prev + sym);
  };

  const filteredPresets = presets.filter((p) => {
    const matchesCat = libraryFilter === "All" || p.category.toLowerCase().includes(libraryFilter.toLowerCase());
    const matchesSearch =
      librarySearch === "" ||
      p.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
      p.statement.toLowerCase().includes(librarySearch.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(librarySearch.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden transition-colors"
      style={{
        backgroundColor: colors.bg,
        color: colors.text
      }}
    >
      {/* Top Banner Toolbar */}
      <header
        className="px-5 sm:px-8 py-3.5 border-b flex flex-wrap items-center justify-between gap-4 backdrop-blur-xl shrink-0"
        style={{ borderColor: colors.border, backgroundColor: `${colors.bg}dd` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg"
            style={{
              backgroundColor: isChalkboard ? "#16281e" : "#0d1b2a",
              color: isChalkboard ? "#fde047" : "#38bdf8",
              border: `1px solid ${colors.border}`
            }}
          >
            <GraduationCap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight">Proof Engine</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Axiomatic v5.0
              </span>
            </div>
            <p className="text-xs opacity-60">
              Automated theorem prover, induction validator, identity resolver & formal derivations
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLibraryOpen(true)}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer hover:bg-white/10 active:scale-95"
            style={{ borderColor: colors.border }}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Theorems Library</span>
            <span className="text-[10px] opacity-60 font-mono">({presets.length || 20})</span>
          </button>

          <button
            onClick={() => setActiveTab("verifier")}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer hover:bg-white/10 active:scale-95 ${
              activeTab === "verifier" ? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold" : ""
            }`}
            style={{ borderColor: colors.border }}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Interactive Verifier</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Theorem Proposition Input Bar */}
        <div
          className="p-5 sm:p-6 rounded-2xl border backdrop-blur-md shadow-xl transition-all"
          style={{ backgroundColor: `${colors.canvasBg}99`, borderColor: colors.border }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-mono font-semibold uppercase tracking-wider opacity-75 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Mathematical Proposition / Statement to Prove
              </label>

              {/* Method Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] opacity-60">Strategy:</span>
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border text-xs font-medium bg-black/40 text-white cursor-pointer focus:outline-hidden"
                  style={{ borderColor: colors.border }}
                >
                  <option value="auto">Auto-Detect Strategy</option>
                  <option value="induction">Mathematical Induction</option>
                  <option value="identity">Algebraic / Trig Identity</option>
                  <option value="contradiction">Proof by Contradiction</option>
                  <option value="calculus">Calculus / Limit Theorem</option>
                  <option value="logic">Propositional Logic</option>
                </select>
              </div>
            </div>

            {/* Input Form with Action Button */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleProve();
              }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={statementInput}
                  onChange={(e) => setStatementInput(e.target.value)}
                  placeholder="e.g. sum(i, 1, n) = n*(n+1)/2, sin(x)^2 + cos(x)^2 = 1, sqrt(2) is irrational"
                  className="w-full px-4 py-3 rounded-xl border text-sm sm:text-base font-mono-math focus:outline-hidden transition-all shadow-inner bg-black/30 text-white"
                  style={{ borderColor: colors.border }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: isChalkboard ? "#22c55e" : "#0284c7",
                  color: "#ffffff"
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Proving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Generate Proof</span>
                  </>
                )}
              </button>
            </form>

            {/* Live KaTeX Preview of Input */}
            {statementInput.trim() && (
              <div
                className="px-3.5 py-2 rounded-lg border text-xs flex items-center gap-2 overflow-x-auto"
                style={{ borderColor: `${colors.border}66`, backgroundColor: `${colors.bg}66` }}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-50 shrink-0">Live Preview:</span>
                <KatexMath math={statementInput} block={false} />
              </div>
            )}

            {/* Quick Math Symbols Strip */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-mono opacity-50 mr-1">Insert:</span>
              {[
                { label: "∑", val: "sum(i, 1, n) = " },
                { label: "⟹", val: " => " },
                { label: "⟺", val: " <=> " },
                { label: "¬", val: "!" },
                { label: "∧", val: " && " },
                { label: "∨", val: " || " },
                { label: "√x", val: "sqrt(" },
                { label: "x²", val: "^2" },
                { label: "sin²(x)", val: "sin(x)^2" },
                { label: "cos²(x)", val: "cos(x)^2" },
                { label: "∫", val: "integral " },
                { label: "n ≥ 1", val: " for all n >= 1" },
                { label: "divisible by", val: " is divisible by " }
              ].map((sym, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => insertSymbol(sym.val)}
                  className="px-2 py-1 rounded-md border text-xs font-mono transition-all hover:bg-white/10 active:scale-90"
                  style={{ borderColor: colors.border }}
                >
                  {sym.label}
                </button>
              ))}
            </div>

            {/* Famous Theorem Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
              <span className="text-[10px] font-mono opacity-50">Landmark Proofs:</span>
              {[
                { name: "Gauss Sum (n(n+1)/2)", stmt: "sum(i, 1, n) = n*(n+1)/2" },
                { name: "Sum of Squares", stmt: "sum(i^2, 1, n) = n*(n+1)*(2*n+1)/6" },
                { name: "√2 is Irrational", stmt: "sqrt(2) is irrational" },
                { name: "sin²(x) + cos²(x) = 1", stmt: "sin(x)^2 + cos(x)^2 = 1" },
                { name: "Power Rule (d/dx x^n)", stmt: "derivative of x^n = n*x^(n-1)" },
                { name: "De Morgan's Law", stmt: "!(P && Q) <=> !P || !Q" }
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setStatementInput(item.stmt);
                    handleProve(item.stmt, "auto");
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:bg-white/10 cursor-pointer text-cyan-300"
                  style={{ borderColor: `${colors.border}88` }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-sm flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">Proof Formulation Error</p>
              <p className="text-xs opacity-90">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Proof Result Overview */}
        {proof && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Proposition Card */}
            <div
              className="p-6 rounded-2xl border backdrop-blur-md shadow-2xl relative overflow-hidden transition-all"
              style={{
                backgroundColor: `${colors.canvasBg}cc`,
                borderColor: colors.border
              }}
            >
              {/* Status Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                      proof.is_valid
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    }`}
                  >
                    {proof.is_valid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Formally Proven (Q.E.D.)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Refuted / Not Proven</span>
                      </>
                    )}
                  </span>

                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{ borderColor: colors.border }}
                  >
                    {proof.proof_type_label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono opacity-60">Verified in {proof.execution_time_ms} ms</span>

                  {/* Export Buttons */}
                  <button
                    onClick={() => copyToClipboard(generateMarkdownProof(), "markdown")}
                    className="px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1 hover:bg-white/10 cursor-pointer"
                    style={{ borderColor: colors.border }}
                    title="Copy Markdown Proof"
                  >
                    {copiedType === "markdown" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Markdown</span>
                  </button>

                  <button
                    onClick={() => copyToClipboard(generateLatexProof(), "latex")}
                    className="px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1 hover:bg-white/10 cursor-pointer"
                    style={{ borderColor: colors.border }}
                    title="Copy LaTeX Proof Code"
                  >
                    {copiedType === "latex" ? <Check className="w-3 h-3 text-emerald-400" /> : <Scroll className="w-3 h-3" />}
                    <span>LaTeX</span>
                  </button>

                  {onSendToStudio && (
                    <button
                      onClick={() => onSendToStudio(proof.statement)}
                      className="px-2.5 py-1 rounded-lg border text-xs font-medium text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                      style={{ borderColor: `${colors.border}` }}
                      title="Send Theorem to Studio Board"
                    >
                      <span>Send to Studio</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Theorem LaTeX Display */}
              <div
                className="p-5 rounded-xl border text-center my-4 overflow-x-auto"
                style={{
                  backgroundColor: isChalkboard ? "#08130e" : "#050b14",
                  borderColor: colors.border
                }}
              >
                <div className="text-lg sm:text-xl md:text-2xl font-academic tracking-wide">
                  <KatexMath math={proof.latex_statement} block={true} />
                </div>
              </div>

              {/* Theorem Summary */}
              <div className="text-xs sm:text-sm opacity-85 leading-relaxed mt-3 flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>{proof.summary}</p>
              </div>

              {/* Assumptions & Lemmas */}
              {proof.lemmas_used && proof.lemmas_used.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-[10px] opacity-60 uppercase tracking-wider">Axioms & Lemmas:</span>
                  {proof.lemmas_used.map((lemma, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] bg-white/5 border"
                      style={{ borderColor: colors.border }}
                    >
                      {lemma}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Segmented View Tabs */}
            <div
              className="flex items-center gap-2 p-1.5 rounded-xl border text-xs font-medium backdrop-blur-md"
              style={{ backgroundColor: `${colors.bg}cc`, borderColor: colors.border }}
            >
              <button
                onClick={() => setActiveTab("formal")}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "formal" ? "bg-white/15 text-white font-bold shadow-xs" : "hover:bg-white/5 opacity-70"
                }`}
              >
                <FileCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Formal Proof ({proof.formal_steps.length} Steps)</span>
              </button>

              {proof.induction_data && (
                <button
                  onClick={() => setActiveTab("induction")}
                  className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "induction" ? "bg-emerald-500/20 text-emerald-300 font-bold shadow-xs" : "hover:bg-white/5 opacity-70"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Induction Structure</span>
                </button>
              )}

              {proof.truth_table && (
                <button
                  onClick={() => setActiveTab("truthtable")}
                  className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "truthtable" ? "bg-purple-500/20 text-purple-300 font-bold shadow-xs" : "hover:bg-white/5 opacity-70"
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5 text-purple-400" />
                  <span>Truth Table ({proof.truth_table.rows.length} Valuations)</span>
                </button>
              )}

              {proof.alternate_proofs && proof.alternate_proofs.length > 0 && (
                <button
                  onClick={() => setActiveTab("alternates")}
                  className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "alternates" ? "bg-amber-500/20 text-amber-300 font-bold shadow-xs" : "hover:bg-white/5 opacity-70"
                  }`}
                >
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  <span>Alternate Strategies ({proof.alternate_proofs.length})</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab("verifier")}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "verifier" ? "bg-cyan-500/20 text-cyan-300 font-bold shadow-xs" : "hover:bg-white/5 opacity-70"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Step Verifier Workspace</span>
              </button>
            </div>

            {/* TAB 1: Formal Proof Steps */}
            {activeTab === "formal" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs opacity-75 px-1">
                  <span className="font-mono uppercase tracking-wider">Axiomatic Step-by-Step Derivation</span>
                  <span>{proof.formal_steps.length} verified transitions</span>
                </div>

                <div className="space-y-4">
                  {proof.formal_steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border transition-all hover:scale-[1.005] shadow-lg backdrop-blur-md"
                      style={{
                        backgroundColor: `${colors.canvasBg}bb`,
                        borderColor: step.status === "conclusion" ? "#22c55e66" : colors.border
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold"
                            style={{
                              backgroundColor: step.status === "conclusion" ? "#22c55e" : "#0284c7",
                              color: "#ffffff"
                            }}
                          >
                            {step.step_number}
                          </span>
                          <h2 className="text-sm sm:text-base font-bold tracking-tight">{step.title}</h2>
                        </div>

                        {step.rule_name && (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border"
                            style={{
                              backgroundColor: `${colors.bg}88`,
                              borderColor: colors.border,
                              color: isChalkboard ? "#fde047" : "#38bdf8"
                            }}
                          >
                            {step.rule_name}
                          </span>
                        )}
                      </div>

                      {/* Mathematical Equation Display */}
                      <div
                        className="p-4 rounded-xl border text-center my-3 overflow-x-auto shadow-inner"
                        style={{
                          backgroundColor: isChalkboard ? "#0b1612" : "#080e1a",
                          borderColor: `${colors.border}88`
                        }}
                      >
                        <KatexMath math={step.latex} block={true} />
                      </div>

                      {/* Explanation & Justification */}
                      <p className="text-xs sm:text-sm opacity-80 leading-relaxed pl-1">
                        {step.justification}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Formal Q.E.D. Sign-Off */}
                <div
                  className="p-4 rounded-xl border text-center font-bold tracking-widest text-sm sm:text-base shadow-md font-academic"
                  style={{
                    backgroundColor: `${colors.canvasBg}dd`,
                    borderColor: colors.border,
                    color: isChalkboard ? "#6ee7b7" : "#38bdf8"
                  }}
                >
                  <KatexMath math={proof.qed_symbol} block={false} />
                </div>
              </div>
            )}

            {/* TAB 2: Mathematical Induction Breakdown */}
            {activeTab === "induction" && proof.induction_data && (
              <div className="space-y-6">
                {/* 1. Base Case */}
                <div
                  className="p-5 rounded-2xl border backdrop-blur-md shadow-lg"
                  style={{ backgroundColor: `${colors.canvasBg}cc`, borderColor: colors.border }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-mono font-bold">
                        1
                      </span>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                        Base Case: Verification for n = {proof.induction_data.base_case.n_val}
                      </h2>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      Verified True
                    </span>
                  </div>

                  <div
                    className="p-4 rounded-xl border text-center my-2 overflow-x-auto"
                    style={{ backgroundColor: isChalkboard ? "#08130e" : "#050b14", borderColor: colors.border }}
                  >
                    <KatexMath
                      math={`\\text{LHS} = ${proof.induction_data.base_case.lhs_latex} = ${proof.induction_data.base_case.lhs_val}, \\quad \\text{RHS} = ${proof.induction_data.base_case.rhs_latex} = ${proof.induction_data.base_case.rhs_val}`}
                      block={true}
                    />
                  </div>
                  <p className="text-xs opacity-80 mt-2">{proof.induction_data.base_case.explanation}</p>
                </div>

                {/* 2. Inductive Hypothesis */}
                <div
                  className="p-5 rounded-2xl border backdrop-blur-md shadow-lg"
                  style={{ backgroundColor: `${colors.canvasBg}cc`, borderColor: colors.border }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-mono font-bold">
                        2
                      </span>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">
                        Inductive Hypothesis: Assume True for n = k
                      </h2>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      Hypothesis Assumption
                    </span>
                  </div>

                  <div
                    className="p-4 rounded-xl border text-center my-2 overflow-x-auto"
                    style={{ backgroundColor: isChalkboard ? "#08130e" : "#050b14", borderColor: colors.border }}
                  >
                    <KatexMath math={proof.induction_data.hypothesis.k_latex} block={true} />
                  </div>
                  <p className="text-xs opacity-80 mt-2">{proof.induction_data.hypothesis.explanation}</p>
                </div>

                {/* 3. Inductive Step */}
                <div
                  className="p-5 rounded-2xl border backdrop-blur-md shadow-lg"
                  style={{ backgroundColor: `${colors.canvasBg}cc`, borderColor: colors.border }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xs font-mono font-bold">
                        3
                      </span>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400">
                        Inductive Step: Prove for n = k + 1
                      </h2>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      P(k) ⟹ P(k+1)
                    </span>
                  </div>

                  <div className="space-y-3 mt-3">
                    {proof.induction_data.inductive_step.steps.map((st, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl border"
                        style={{ backgroundColor: `${colors.bg}99`, borderColor: colors.border }}
                      >
                        <p className="text-xs font-bold mb-1 opacity-90">{st.title}</p>
                        <div className="text-center py-2 overflow-x-auto">
                          <KatexMath math={st.latex} block={true} />
                        </div>
                        <p className="text-xs opacity-70 mt-1">{st.justification}</p>
                      </div>
                    ))}
                  </div>

                  <div
                    className="p-3.5 rounded-xl border text-center mt-4 bg-emerald-500/10 border-emerald-500/20 text-emerald-300 font-bold"
                  >
                    <KatexMath math={proof.induction_data.inductive_step.conclusion_latex} block={false} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Truth Table */}
            {activeTab === "truthtable" && proof.truth_table && (
              <div
                className="p-6 rounded-2xl border backdrop-blur-md shadow-xl overflow-x-auto"
                style={{ backgroundColor: `${colors.canvasBg}cc`, borderColor: colors.border }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Exhaustive Propositional Truth Table</h2>
                    <p className="text-xs opacity-60">
                      Evaluates truth valuations across all possible model interpretations.
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                      proof.truth_table.isTautology
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    }`}
                  >
                    {proof.truth_table.isTautology ? "Tautology (Logically Equivalent)" : "Not Equivalent"}
                  </span>
                </div>

                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: colors.border }}>
                      <th className="py-2.5 px-3 text-left opacity-60">Row #</th>
                      {proof.truth_table.headers.map((h, i) => (
                        <th key={i} className="py-2.5 px-3 text-center opacity-80">
                          {h}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-center opacity-80">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proof.truth_table.rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b transition-colors hover:bg-white/5"
                        style={{ borderColor: `${colors.border}44` }}
                      >
                        <td className="py-2.5 px-3 opacity-50">{idx + 1}</td>
                        {Object.entries(row.variables).map(([k, v], vIdx) => (
                          <td key={vIdx} className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                v ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                              }`}
                            >
                              {v ? "T" : "F"}
                            </span>
                          </td>
                        ))}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              row.lhs ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {row.lhs ? "T" : "F"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              row.rhs ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {row.rhs ? "T" : "F"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              row.equivalent
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {row.equivalent ? "Equivalent" : "Mismatch"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 4: Alternate Proof Strategies */}
            {activeTab === "alternates" && proof.alternate_proofs && (
              <div className="space-y-4">
                {proof.alternate_proofs.map((alt, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border backdrop-blur-md shadow-lg"
                    style={{ backgroundColor: `${colors.canvasBg}cc`, borderColor: colors.border }}
                  >
                    <h2 className="text-sm sm:text-base font-bold text-amber-300 mb-1">{alt.name}</h2>
                    <p className="text-xs opacity-75 mb-4">{alt.description}</p>

                    <div className="space-y-3">
                      {alt.steps.map((st, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-3.5 rounded-xl border"
                          style={{ backgroundColor: `${colors.bg}88`, borderColor: colors.border }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">{st.title}</span>
                            <span className="text-[10px] font-mono opacity-60">{st.rule_name}</span>
                          </div>
                          <div className="text-center py-2 overflow-x-auto">
                            <KatexMath math={st.latex} block={true} />
                          </div>
                          <p className="text-xs opacity-75 mt-1">{st.justification}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 5: Interactive Step Verifier Workspace */}
            {activeTab === "verifier" && (
              <div
                className="p-6 rounded-2xl border backdrop-blur-md shadow-2xl space-y-5"
                style={{ backgroundColor: `${colors.canvasBg}cc`, borderColor: colors.border }}
              >
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    Interactive Proof Step Verifier
                  </h2>
                  <p className="text-xs opacity-70 mt-1">
                    Test your mathematical reasoning in real-time. Enter your starting expression and proposed next step.
                    The engine checks equivalence, identifies the algebraic rule applied, and alerts you to any errors.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Current Step */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono opacity-80 uppercase tracking-wider">
                      Current Derivation Line:
                    </label>
                    <input
                      type="text"
                      value={verifyCurrent}
                      onChange={(e) => setVerifyCurrent(e.target.value)}
                      placeholder="e.g. (x + 1)^2"
                      className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono-math bg-black/40 text-white focus:outline-hidden"
                      style={{ borderColor: colors.border }}
                    />
                    {verifyCurrent && (
                      <div className="text-xs px-2 py-1 opacity-70">
                        <KatexMath math={verifyCurrent} block={false} />
                      </div>
                    )}
                  </div>

                  {/* Proposed Next Step */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono opacity-80 uppercase tracking-wider">
                      Your Proposed Next Step:
                    </label>
                    <input
                      type="text"
                      value={verifyNext}
                      onChange={(e) => setVerifyNext(e.target.value)}
                      placeholder="e.g. x^2 + 2*x + 1"
                      className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono-math bg-black/40 text-white focus:outline-hidden"
                      style={{ borderColor: colors.border }}
                    />
                    {verifyNext && (
                      <div className="text-xs px-2 py-1 opacity-70">
                        <KatexMath math={verifyNext} block={false} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Target Expression (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono opacity-60 uppercase tracking-wider">
                    Target Expression to Reach (Optional):
                  </label>
                  <input
                    type="text"
                    value={verifyTarget}
                    onChange={(e) => setVerifyTarget(e.target.value)}
                    placeholder="e.g. x^2 + 2*x + 1"
                    className="w-full px-3.5 py-2 rounded-lg border text-xs font-mono-math bg-black/30 text-white focus:outline-hidden"
                    style={{ borderColor: colors.border }}
                  />
                </div>

                <button
                  onClick={handleVerifyStep}
                  disabled={verifying}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 disabled:opacity-50"
                  style={{
                    backgroundColor: isChalkboard ? "#10b981" : "#0284c7",
                    color: "#ffffff"
                  }}
                >
                  {verifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Verify Step Equivalence</span>
                </button>

                {/* Verification Feedback Result */}
                {verifyResult && (
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      verifyResult.is_valid
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {verifyResult.is_valid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="font-bold text-sm">
                          {verifyResult.is_valid ? "Mathematically Sound Step" : "Invalid / Non-equivalent Step"}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/10">
                        {verifyResult.rule_name}
                      </span>
                    </div>

                    <p className="text-xs opacity-90">{verifyResult.feedback}</p>

                    {verifyResult.target_reached && (
                      <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Target Goal Reached! The proof derivation is complete.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preset Theorems Library Modal */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div
            className="w-full max-w-4xl max-h-[85vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
            style={{ backgroundColor: colors.canvasBg, borderColor: colors.border }}
          >
            {/* Modal Header */}
            <div
              className="px-6 py-4 border-b flex items-center justify-between"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h2 className="text-base sm:text-lg font-bold">Curated Theorem & Proof Library</h2>
              </div>
              <button
                onClick={() => setIsLibraryOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div
              className="p-4 border-b flex flex-col sm:flex-row gap-3 items-center justify-between"
              style={{ borderColor: colors.border }}
            >
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {["All", "Induction", "Contradiction", "Identities", "Calculus", "Logic"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setLibraryFilter(cat)}
                    className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                      libraryFilter === cat ? "bg-white/20 text-white font-bold" : "opacity-60 hover:opacity-100"
                    }`}
                    style={{ borderColor: colors.border }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="w-full sm:w-64 relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 opacity-40" />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search theorem or formula..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs bg-black/30 text-white focus:outline-hidden"
                  style={{ borderColor: colors.border }}
                />
              </div>
            </div>

            {/* Presets Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="p-4 rounded-xl border transition-all hover:scale-[1.01] hover:border-cyan-400/50 flex flex-col justify-between shadow-md"
                  style={{ backgroundColor: `${colors.bg}aa`, borderColor: colors.border }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-cyan-400">
                        {preset.category}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-white/5 opacity-75">
                        {preset.difficulty}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold tracking-tight mb-2">{preset.title}</h3>

                    {/* Statement formula badge */}
                    <div
                      className="p-2 rounded-lg border text-center font-mono-math text-xs mb-2 overflow-x-auto"
                      style={{ backgroundColor: isChalkboard ? "#08130e" : "#050b14", borderColor: colors.border }}
                    >
                      <KatexMath math={preset.statement} block={false} />
                    </div>

                    <p className="text-xs opacity-75 leading-relaxed line-clamp-2">{preset.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {preset.tags.slice(0, 2).map((t, i) => (
                        <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 opacity-60">
                          #{t}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setStatementInput(preset.statement);
                        setIsLibraryOpen(false);
                        handleProve(preset.statement, "auto");
                      }}
                      className="px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer transition-all active:scale-95"
                    >
                      <span>Load & Prove</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
