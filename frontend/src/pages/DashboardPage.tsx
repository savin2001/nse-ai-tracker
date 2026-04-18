import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw,
  AlertCircle, Target, Clock, ChevronRight,
} from "lucide-react";
import { api, type Signal } from "../api/client";
import NSETracker from "./NSETracker";

// ── Config ─────────────────────────────────────────────────────────────────────
const SIG_CFG = {
  BUY:  { bg: "bg-emerald-500/8",  border: "border-emerald-500/20", text: "text-emerald-400", glow: "rgba(16,185,129,0.12)",  Icon: TrendingUp  },
  HOLD: { bg: "bg-amber-500/8",    border: "border-amber-500/20",   text: "text-amber-400",   glow: "rgba(245,158,11,0.12)",  Icon: Minus       },
  SELL: { bg: "bg-red-500/8",      border: "border-red-500/20",     text: "text-red-400",     glow: "rgba(239,68,68,0.12)",   Icon: TrendingDown},
} as const;

type SigKey = keyof typeof SIG_CFG;

// ── Subcomponents ──────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: SigKey }) {
  const c = SIG_CFG[signal];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${c.bg} border ${c.border} ${c.text}`}>
      <c.Icon size={9} />
      {signal}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-[10px] font-mono text-gray-500 w-7 text-right shrink-0">{value}%</span>
    </div>
  );
}

function SignalCard({ sig }: { sig: Signal }) {
  const c = SIG_CFG[sig.signal as SigKey] ?? SIG_CFG.HOLD;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex flex-col justify-between p-4 rounded-xl border border-white/7 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.035] transition-all duration-200 hover:-translate-y-0.5"
      style={{ minHeight: 130 }}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white font-mono">{sig.ticker}</span>
            <SignalBadge signal={sig.signal as SigKey} />
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold tabular-nums ${c.text}`}>{sig.confidence}%</div>
            <div className="text-[9px] text-gray-600">confidence</div>
          </div>
        </div>
        <ConfidenceBar value={sig.confidence} />
        <p className="text-[11px] text-gray-400 leading-relaxed mt-3 line-clamp-2">{sig.summary}</p>
      </div>

      {/* Footer */}
      {(sig.target_price || sig.time_horizon) && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
          {sig.target_price && (
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Target size={9} />
              <span className="text-white font-mono">KES {sig.target_price.toFixed(2)}</span>
            </div>
          )}
          {sig.time_horizon && (
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Clock size={9} />
              <span>{sig.time_horizon}</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function SummaryTile({ label, count, cfg, i }: { label: SigKey; count: number; cfg: typeof SIG_CFG[SigKey]; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06, duration: 0.4 }}
      className={`flex items-center gap-3 px-5 py-4 rounded-xl ${cfg.bg} border ${cfg.border}`}
      style={{ boxShadow: count > 0 ? `0 0 20px ${cfg.glow}` : undefined }}
    >
      <cfg.Icon className={`w-5 h-5 ${cfg.text} shrink-0`} />
      <div>
        <div className={`text-2xl font-bold tabular-nums leading-none ${cfg.text}`}>{count}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  async function fetchSignals() {
    setLoading(true);
    setError(null);
    try {
      setSignals(await api.signals.latest());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSignals(); }, []);

  const counts = signals.reduce((acc, s) => {
    acc[s.signal as SigKey] = (acc[s.signal as SigKey] ?? 0) + 1;
    return acc;
  }, {} as Record<SigKey, number>);

  return (
    <div className="p-4 sm:p-6 space-y-8">

      {/* ── AI Signals ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">AI Signals</h2>
            <p className="text-xs text-gray-600 mt-0.5">Latest Claude-generated recommendations</p>
          </div>
          <button
            onClick={fetchSignals}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-40 px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/16"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Summary tiles */}
        {signals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {(["BUY", "HOLD", "SELL"] as const).map((s, i) => (
              <SummaryTile key={s} label={s} count={counts[s] ?? 0} cfg={SIG_CFG[s]} i={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/18 text-red-400 text-sm mb-5">
            <AlertCircle size={14} className="shrink-0" />
            <span className="text-xs">{error} — showing static market data below.</span>
            <button onClick={fetchSignals} className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-300 shrink-0">
              Retry <ChevronRight size={10} />
            </button>
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-white/[0.025] border border-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Signal grid */}
        {!loading && signals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {signals.slice(0, 12).map(sig => (
              <SignalCard key={`${sig.ticker}-${sig.generated_at}`} sig={sig} />
            ))}
          </div>
        )}

        {!loading && signals.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/8 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <TrendingUp size={18} className="text-gray-600" />
            </div>
            <p className="text-sm text-gray-500">No signals yet</p>
            <p className="text-xs text-gray-700 mt-1">Run the Python analysis workers to generate them.</p>
          </div>
        )}
      </section>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="border-t border-white/5" />

      {/* ── Full market tracker ───────────────────────────────────────────── */}
      <section>
        <div className="mb-5">
          <h2 className="text-base font-semibold text-white">Market Overview</h2>
          <p className="text-xs text-gray-600 mt-0.5">All NSE-listed companies with technical data</p>
        </div>
        <NSETracker embedded />
      </section>
    </div>
  );
}
