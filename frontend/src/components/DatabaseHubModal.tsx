import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Database,
  History,
  BookOpen,
  Bookmark,
  Video,
  Search,
  Trash2,
  Plus,
  Pin,
  Star,
  Play,
  ArrowRight,
  RefreshCw,
  Check,
  AlertCircle,
  FileText,
  Lock,
  Tag,
  Copy,
  ExternalLink
} from "lucide-react";
import { KatexMath } from "./Whiteboard";

interface HistoryItem {
  id: string;
  equation: string;
  problem_type?: string;
  result_latex?: string;
  created_at?: string;
}

interface NotebookItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  is_pinned: boolean;
  created_at?: string;
  updated_at?: string;
}

interface FormulaItem {
  id: string;
  name: string;
  category: string;
  latex: string;
  expression: string;
  description: string;
  variables: string[];
  is_favorite: boolean;
  created_at?: string;
}

interface VideoItem {
  id: string;
  equation: string;
  video_filename?: string;
  video_url?: string;
  resolution: string;
  fps: number;
  status: string;
  created_at?: string;
}

interface DatabaseHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToken: string | null;
  userEmail: string | null;
  onOpenAuth: () => void;
  onSelectEquation: (equation: string) => void;
}

export default function DatabaseHubModal({
  isOpen,
  onClose,
  userToken,
  userEmail,
  onOpenAuth,
  onSelectEquation
}: DatabaseHubModalProps) {
  const [activeTab, setActiveTab] = useState<"history" | "notebooks" | "formulas" | "videos">("history");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);
  const [formulas, setFormulas] = useState<FormulaItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);

  // Create/Edit states
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [newNotebookContent, setNewNotebookContent] = useState("");
  const [newNotebookTags, setNewNotebookTags] = useState("");
  const [newNotebookPinned, setNewNotebookPinned] = useState(false);

  const [isCreatingFormula, setIsCreatingFormula] = useState(false);
  const [newFormulaName, setNewFormulaName] = useState("");
  const [newFormulaCategory, setNewFormulaCategory] = useState("general");
  const [newFormulaLatex, setNewFormulaLatex] = useState("");
  const [newFormulaExpr, setNewFormulaExpr] = useState("");
  const [newFormulaDesc, setNewFormulaDesc] = useState("");
  const [formulaFilterCategory, setFormulaFilterCategory] = useState<string>("all");

  // Active preview video
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // Fetch data on tab change or token presence
  useEffect(() => {
    if (!isOpen || !userToken) return;
    fetchTabData();
  }, [isOpen, userToken, activeTab]);

  const fetchTabData = async () => {
    if (!userToken) return;
    setLoading(true);
    setErrorMsg(null);

    const headers = {
      "Authorization": `Bearer ${userToken}`,
      "Content-Type": "application/json"
    };

    try {
      if (activeTab === "history") {
        const res = await fetch("/api/history", { headers });
        if (res.ok) {
          const data = await res.json();
          setHistoryItems(data.items || []);
        }
      } else if (activeTab === "notebooks") {
        const res = await fetch("/api/notebooks", { headers });
        if (res.ok) {
          const data = await res.json();
          setNotebooks(data.notebooks || []);
        }
      } else if (activeTab === "formulas") {
        const res = await fetch("/api/formulas", { headers });
        if (res.ok) {
          const data = await res.json();
          setFormulas(data.formulas || []);
        }
      } else if (activeTab === "videos") {
        const res = await fetch("/api/videos/history", { headers });
        if (res.ok) {
          const data = await res.json();
          setVideos(data.videos || []);
        }
      }
    } catch (err: any) {
      console.error("Database fetch error:", err);
      setErrorMsg("Failed to synchronize with database.");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // --- History Handlers ---
  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userToken) return;
    try {
      const res = await fetch(`/api/history/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${userToken}` }
      });
      if (res.ok) {
        setHistoryItems(prev => prev.filter(item => item.id !== id));
        showNotification("Calculation removed from database.");
      }
    } catch (err) {
      setErrorMsg("Failed to delete calculation.");
    }
  };

  const handleClearHistory = async () => {
    if (!userToken || !confirm("Clear all calculation history from the database?")) return;
    try {
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${userToken}` }
      });
      if (res.ok) {
        setHistoryItems([]);
        showNotification("All history cleared.");
      }
    } catch (err) {
      setErrorMsg("Failed to clear history.");
    }
  };

  // --- Notebook Handlers ---
  const handleSaveNotebook = async () => {
    if (!userToken || !newNotebookTitle.trim()) {
      setErrorMsg("Please enter a notebook title.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${userToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: newNotebookTitle,
          content: newNotebookContent,
          tags: newNotebookTags,
          is_pinned: newNotebookPinned
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNotebooks(prev => [data.notebook, ...prev]);
        setIsCreatingNotebook(false);
        setNewNotebookTitle("");
        setNewNotebookContent("");
        setNewNotebookTags("");
        setNewNotebookPinned(false);
        showNotification("Notebook successfully saved to database!");
      }
    } catch (err) {
      setErrorMsg("Failed to save notebook.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotebook = async (id: string) => {
    if (!userToken || !confirm("Delete this notebook?")) return;
    try {
      const res = await fetch(`/api/notebooks/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${userToken}` }
      });
      if (res.ok) {
        setNotebooks(prev => prev.filter(nb => nb.id !== id));
        showNotification("Notebook deleted.");
      }
    } catch (err) {
      setErrorMsg("Failed to delete notebook.");
    }
  };

  // --- Formula Handlers ---
  const handleSaveFormula = async () => {
    if (!userToken || !newFormulaName.trim() || !newFormulaLatex.trim()) {
      setErrorMsg("Formula name and LaTeX are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/formulas", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${userToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newFormulaName,
          category: newFormulaCategory,
          latex: newFormulaLatex,
          expression: newFormulaExpr || newFormulaLatex,
          description: newFormulaDesc,
          is_favorite: false
        })
      });
      if (res.ok) {
        const data = await res.json();
        setFormulas(prev => [data.formula, ...prev]);
        setIsCreatingFormula(false);
        setNewFormulaName("");
        setNewFormulaLatex("");
        setNewFormulaExpr("");
        setNewFormulaDesc("");
        showNotification("Custom formula saved!");
      }
    } catch (err) {
      setErrorMsg("Failed to save formula.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userToken) return;
    try {
      const res = await fetch(`/api/formulas/${id}/favorite`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${userToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFormulas(prev => prev.map(f => f.id === id ? data.formula : f));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFormula = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userToken || !confirm("Delete this custom formula?")) return;
    try {
      const res = await fetch(`/api/formulas/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${userToken}` }
      });
      if (res.ok) {
        setFormulas(prev => prev.filter(f => f.id !== id));
        showNotification("Formula deleted.");
      }
    } catch (err) {
      setErrorMsg("Failed to delete formula.");
    }
  };

  // Filtered views
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historyItems;
    const q = searchQuery.toLowerCase();
    return historyItems.filter(h =>
      h.equation.toLowerCase().includes(q) ||
      (h.problem_type && h.problem_type.toLowerCase().includes(q))
    );
  }, [historyItems, searchQuery]);

  const filteredNotebooks = useMemo(() => {
    if (!searchQuery.trim()) return notebooks;
    const q = searchQuery.toLowerCase();
    return notebooks.filter(nb =>
      nb.title.toLowerCase().includes(q) ||
      nb.content.toLowerCase().includes(q) ||
      nb.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [notebooks, searchQuery]);

  const filteredFormulas = useMemo(() => {
    return formulas.filter(f => {
      const matchesCategory = formulaFilterCategory === "all" || f.category.toLowerCase() === formulaFilterCategory.toLowerCase();
      const matchesSearch = !searchQuery.trim() ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.latex.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [formulas, formulaFilterCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0b101b] border border-blue-500/30 rounded-2xl shadow-2xl shadow-blue-950/60 overflow-hidden text-white">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono tracking-tight flex items-center gap-2">
                Scholar Database Hub
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  PostgreSQL & SQLite Active
                </span>
              </h2>
              <p className="text-xs text-white/50">
                {userEmail ? `Connected account: ${userEmail}` : "Guest Mode — calculations are temporary"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTabData}
              disabled={loading || !userToken}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Hub"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Guest Lock Banner if not logged in */}
        {!userToken && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-white">Sign In for Cloud Persistence: </span>
                <span className="text-white/70">Connect your account to synchronize problem history, custom presets, and research notebooks permanently across devices.</span>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/30 shrink-0 cursor-pointer"
            >
              Sign In / Register
            </button>
          </div>
        )}

        {/* Notifications */}
        {successMsg && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Navigation Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-blue-600 text-white font-bold shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              History ({historyItems.length})
            </button>
            <button
              onClick={() => setActiveTab("notebooks")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === "notebooks"
                  ? "bg-blue-600 text-white font-bold shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Notebooks ({notebooks.length})
            </button>
            <button
              onClick={() => setActiveTab("formulas")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === "formulas"
                  ? "bg-blue-600 text-white font-bold shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Formulas ({formulas.length})
            </button>
            <button
              onClick={() => setActiveTab("videos")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === "videos"
                  ? "bg-blue-600 text-white font-bold shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Videos ({videos.length})
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">

          {/* TAB 1: HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50 uppercase tracking-wider font-mono">
                  Saved Calculations ({filteredHistory.length})
                </span>
                {historyItems.length > 0 && userToken && (
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear History
                  </button>
                )}
              </div>

              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                  <History className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/60">No calculations recorded in database yet.</p>
                  <p className="text-[11px] text-white/40 mt-1">
                    When you solve equations or proofs while logged in, they are saved automatically.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectEquation(item.equation);
                        onClose();
                      }}
                      className="group p-4 bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 hover:border-blue-500/40 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 uppercase">
                            {item.problem_type || "General"}
                          </span>
                          {item.created_at && (
                            <span className="text-[10px] font-mono text-white/40">
                              {new Date(item.created_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-sm font-bold text-white truncate">
                          <KatexMath math={item.equation} block={false} />
                        </div>
                        {item.result_latex && (
                          <div className="text-xs text-emerald-400 font-mono mt-1 truncate">
                            Result: <KatexMath math={item.result_latex} block={false} />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            onSelectEquation(item.equation);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/30 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <span>Solve</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        {userToken && (
                          <button
                            onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                            className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NOTEBOOKS */}
          {activeTab === "notebooks" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50 uppercase tracking-wider font-mono">
                  Personal Research Notebooks ({filteredNotebooks.length})
                </span>
                {userToken && !isCreatingNotebook && (
                  <button
                    onClick={() => setIsCreatingNotebook(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Notebook
                  </button>
                )}
              </div>

              {/* In-line Notebook Creator */}
              {isCreatingNotebook && (
                <div className="p-4 bg-white/[0.04] border border-blue-500/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-300 font-mono">
                      Create Math Notebook
                    </h3>
                    <button
                      onClick={() => setIsCreatingNotebook(false)}
                      className="text-white/40 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newNotebookTitle}
                    onChange={(e) => setNewNotebookTitle(e.target.value)}
                    placeholder="Notebook Title (e.g. Calculus II - Multivariable Notes)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <textarea
                    value={newNotebookContent}
                    onChange={(e) => setNewNotebookContent(e.target.value)}
                    placeholder="Enter your mathematical derivations, notes, theorems, or LaTeX snippets..."
                    rows={5}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <input
                      type="text"
                      value={newNotebookTags}
                      onChange={(e) => setNewNotebookTags(e.target.value)}
                      placeholder="Tags comma-separated (e.g. calculus, derivatives, proofs)"
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newNotebookPinned}
                        onChange={(e) => setNewNotebookPinned(e.target.checked)}
                        className="rounded"
                      />
                      <Pin className="w-3 h-3 text-amber-400" />
                      Pin to Top
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsCreatingNotebook(false)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-xs rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotebook}
                      disabled={loading}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer"
                    >
                      {loading ? "Saving..." : "Save Notebook"}
                    </button>
                  </div>
                </div>
              )}

              {filteredNotebooks.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                  <BookOpen className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/60">No notebooks saved yet.</p>
                  <p className="text-[11px] text-white/40 mt-1">
                    Click "New Notebook" to create study guides, equation journals, and proofs.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredNotebooks.map((nb) => (
                    <div
                      key={nb.id}
                      className={`p-4 border rounded-xl transition-all ${
                        nb.is_pinned
                          ? "bg-amber-500/[0.04] border-amber-500/30"
                          : "bg-white/[0.02] hover:bg-white/[0.04] border-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {nb.is_pinned && (
                              <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <h3 className="text-sm font-bold text-white font-mono">{nb.title}</h3>
                          </div>
                          {nb.updated_at && (
                            <span className="text-[10px] text-white/40 font-mono">
                              Last updated: {new Date(nb.updated_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {userToken && (
                          <button
                            onClick={() => handleDeleteNotebook(nb.id)}
                            className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete notebook"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-3 text-xs text-white/80 whitespace-pre-wrap font-sans bg-black/30 p-3 rounded-lg border border-white/5 max-h-48 overflow-y-auto">
                        {nb.content}
                      </div>

                      {nb.tags && nb.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {nb.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 flex items-center gap-1"
                            >
                              <Tag className="w-2.5 h-2.5 opacity-60" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOM FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Category filters */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {["all", "calculus", "algebra", "geometry", "statistics", "physics", "general"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFormulaFilterCategory(cat)}
                      className={`text-[10px] uppercase font-mono px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                        formulaFilterCategory === cat
                          ? "bg-blue-600 text-white border-blue-500 font-bold"
                          : "border-white/10 text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {userToken && !isCreatingFormula && (
                  <button
                    onClick={() => setIsCreatingFormula(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Save Formula
                  </button>
                )}
              </div>

              {/* In-line Formula Creator */}
              {isCreatingFormula && (
                <div className="p-4 bg-white/[0.04] border border-blue-500/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-300 font-mono">
                      Save Custom Formula
                    </h3>
                    <button onClick={() => setIsCreatingFormula(false)} className="text-white/40 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newFormulaName}
                      onChange={(e) => setNewFormulaName(e.target.value)}
                      placeholder="Formula Name (e.g. Wave Function PDE)"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                    <select
                      value={newFormulaCategory}
                      onChange={(e) => setNewFormulaCategory(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="calculus">Calculus</option>
                      <option value="algebra">Algebra</option>
                      <option value="geometry">Geometry</option>
                      <option value="statistics">Statistics</option>
                      <option value="physics">Physics</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={newFormulaLatex}
                    onChange={(e) => setNewFormulaLatex(e.target.value)}
                    placeholder="LaTeX format (e.g. \\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={newFormulaDesc}
                    onChange={(e) => setNewFormulaDesc(e.target.value)}
                    placeholder="Description or notes about this formula"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsCreatingFormula(false)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-xs rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveFormula}
                      disabled={loading}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer"
                    >
                      {loading ? "Saving..." : "Save Formula"}
                    </button>
                  </div>
                </div>
              )}

              {filteredFormulas.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                  <Bookmark className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/60">No custom formulas found.</p>
                  <p className="text-[11px] text-white/40 mt-1">
                    Store equations, scientific constants, and proofs for quick access.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredFormulas.map((f) => (
                    <div
                      key={f.id}
                      className="p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 rounded-xl transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300">
                            {f.category}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleToggleFavorite(f.id, e)}
                              className="p-1 hover:text-amber-400 transition-colors"
                              title="Toggle Favorite"
                            >
                              <Star className={`w-3.5 h-3.5 ${f.is_favorite ? "text-amber-400 fill-amber-400" : "text-white/40"}`} />
                            </button>
                            {userToken && (
                              <button
                                onClick={(e) => handleDeleteFormula(f.id, e)}
                                className="p-1 text-white/40 hover:text-red-400 transition-colors"
                                title="Delete formula"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-white mb-2">{f.name}</h4>
                        <div className="py-2 px-3 rounded-lg bg-black/30 border border-white/5 font-mono text-sm text-center overflow-x-auto">
                          <KatexMath math={f.latex} block={false} />
                        </div>
                        {f.description && (
                          <p className="text-[11px] text-white/60 mt-2 line-clamp-2">{f.description}</p>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                        <button
                          onClick={() => {
                            onSelectEquation(f.expression || f.latex);
                            onClose();
                          }}
                          className="w-full py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <span>Load to Studio</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VIDEOS */}
          {activeTab === "videos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50 uppercase tracking-wider font-mono">
                  Rendered Manim Animations ({videos.length})
                </span>
              </div>

              {/* Inline video player preview */}
              {previewVideoUrl && (
                <div className="p-4 bg-black/60 border border-blue-500/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-blue-300">Video Player</span>
                    <button
                      onClick={() => setPreviewVideoUrl(null)}
                      className="text-white/40 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <video
                    src={previewVideoUrl}
                    controls
                    autoPlay
                    className="w-full rounded-lg max-h-72 bg-black"
                  />
                </div>
              )}

              {videos.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                  <Video className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/60">No Manim videos recorded in database yet.</p>
                  <p className="text-[11px] text-white/40 mt-1">
                    Export a video animation from the studio to store it in your library.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {videos.map((vid) => (
                    <div
                      key={vid.id}
                      className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 uppercase">
                          {vid.resolution} @ {vid.fps}fps
                        </span>
                        {vid.created_at && (
                          <span className="text-[10px] text-white/40 font-mono">
                            {new Date(vid.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="font-mono text-xs text-white font-bold truncate">
                        <KatexMath math={vid.equation} block={false} />
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        {vid.video_url && (
                          <button
                            onClick={() => setPreviewVideoUrl(vid.video_url || null)}
                            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Watch Video
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-white/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px]">Database Engine: SQLite & PostgreSQL Synchronized</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
