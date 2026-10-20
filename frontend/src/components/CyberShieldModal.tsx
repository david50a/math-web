import React, { useState, useEffect } from "react";
import { X, ShieldCheck, ShieldAlert, Lock, Activity, Server, FileCode, RefreshCw, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";

interface AuditEvent {
  timestamp: number;
  iso_time: string;
  event_type: string;
  severity: "INFO" | "WARNING" | "ALERT" | "CRITICAL";
  client_ip: string;
  endpoint: string;
  details: Record<string, any>;
}

interface TelemetryData {
  status: string;
  cipher_mode: string;
  session_ttl_days: number;
  active_lockouts: number;
  monitored_keys: number;
  media_whitelist: string[];
  headers_enforced: string[];
  recent_audit_events: AuditEvent[];
}

interface CyberShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CyberShieldModal({ isOpen, onClose }: CyberShieldModalProps) {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/security/telemetry");
      if (!res.ok) throw new Error("Failed to load telemetry");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to contact security engine");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Main Modal Card */}
      <div className="relative w-full max-w-2xl bg-[#0a1510]/95 border border-emerald-500/30 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden academic-frame max-h-[90vh] flex flex-col">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-emerald-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldCheck className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-scholar-title text-amber-100 tracking-tight">
                  Cyber Defense Matrix
                </h2>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Hardened
                </span>
              </div>
              <p className="text-xs text-amber-200/60 font-academic italic">
                Active security posture, cryptographic controls, and telemetry feed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTelemetry}
              disabled={loading}
              title="Refresh Telemetry"
              className="text-amber-200/60 hover:text-amber-200 p-2 rounded-lg hover:bg-white/5 transition-all cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="text-amber-200/60 hover:text-amber-200 p-2 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1 custom-scrollbar">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#11241b] border border-amber-900/30 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-200/60 tracking-wider">Session TTL</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-amber-100 font-mono">{data?.session_ttl_days ?? 7}</span>
                <span className="text-xs text-amber-200/40">days</span>
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Auto-Expiring
              </span>
            </div>

            <div className="bg-[#11241b] border border-amber-900/30 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-200/60 tracking-wider">Lockouts</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold font-mono text-emerald-400">{data?.active_lockouts ?? 0}</span>
                <span className="text-xs text-amber-200/40">active</span>
              </div>
              <span className="text-[10px] text-amber-200/60 mt-1">5 failed max / 10m</span>
            </div>

            <div className="bg-[#11241b] border border-amber-900/30 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-200/60 tracking-wider">Monitored Keys</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold font-mono text-amber-100">{data?.monitored_keys ?? 0}</span>
                <span className="text-xs text-amber-200/40">IPs/endpoints</span>
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-1">Sliding-window</span>
            </div>

            <div className="bg-[#11241b] border border-amber-900/30 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-200/60 tracking-wider">Anti-Timing</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold font-mono text-emerald-400">Active</span>
              </div>
              <span className="text-[10px] text-amber-200/60 mt-1">Constant-time digest</span>
            </div>
          </div>

          {/* Active Shields Checklist */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Active Defensive Modules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-[#0f1f17] border border-emerald-900/30 rounded-lg p-2.5 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-100">Cryptographic Cipher</span>
                  <p className="text-[11px] text-amber-200/60 mt-0.5">PBKDF2-HMAC-SHA256 (100,000 iterations) with salt & timing attack mitigation.</p>
                </div>
              </div>

              <div className="bg-[#0f1f17] border border-emerald-900/30 rounded-lg p-2.5 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-100">Media Sandbox & Traversal Shield</span>
                  <p className="text-[11px] text-amber-200/60 mt-0.5">Canonical path verification (<code className="text-emerald-300">commonpath</code>) & strict file type whitelist.</p>
                </div>
              </div>

              <div className="bg-[#0f1f17] border border-emerald-900/30 rounded-lg p-2.5 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-100">Manim Subprocess Isolation</span>
                  <p className="text-[11px] text-amber-200/60 mt-0.5">Control-character stripped parameters, strict process timeouts, shell=False.</p>
                </div>
              </div>

              <div className="bg-[#0f1f17] border border-emerald-900/30 rounded-lg p-2.5 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-100">HTTP Security Headers & CSP</span>
                  <p className="text-[11px] text-amber-200/60 mt-0.5">Content-Security-Policy, SAMEORIGIN, nosniff, strict-origin referrer policy.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Event Stream */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200/60 font-scholar-title flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Security Audit Trail (Live)
              </h3>
              <span className="text-[10px] text-amber-200/40 font-mono">security_audit.log</span>
            </div>

            <div className="bg-[#0b1611] border border-amber-900/30 rounded-xl overflow-hidden">
              {(!data?.recent_audit_events || data.recent_audit_events.length === 0) ? (
                <div className="p-6 text-center text-xs text-amber-200/40 italic">
                  No security alerts or violations recorded. System nominal.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-emerald-950/50 text-xs">
                  {data.recent_audit_events.map((evt, idx) => {
                    const isAlert = evt.severity === "ALERT" || evt.severity === "CRITICAL";
                    const isWarn = evt.severity === "WARNING";
                    return (
                      <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${
                            isAlert ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                            isWarn ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}>
                            {evt.event_type}
                          </span>
                          <span className="font-mono text-[11px] text-amber-100/90 truncate">
                            {evt.endpoint}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-[10px] text-amber-200/50 font-mono">
                          <span>{evt.client_ip}</span>
                          <span>{evt.iso_time ? evt.iso_time.split("T")[1].replace("Z", "") : ""}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-emerald-950/60 bg-[#08120e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400/80">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-medium">Active Defense Guard Running</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#14261d] hover:bg-[#1b3528] border border-amber-500/30 text-amber-200 rounded-lg text-xs font-bold font-scholar-title uppercase tracking-wider transition-colors cursor-pointer"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
