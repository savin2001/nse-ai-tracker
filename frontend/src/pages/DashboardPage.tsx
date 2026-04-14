import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from "lucide-react";
import { api, type Signal } from "../api/client";
import NSETracker from "./NSETracker";

const SIGNAL_COLOR = {
  BUY:  { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
  HOLD: { bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-400"   },
  SELL: { bg: "bg-red-500/10",     border: "border-red-500/20",     text: "text-red-400"     },
};

const SIGNAL_ICON = {
  BUY:  TrendingUp,
  HOLD: Minus,
  SELL: TrendingDown,
};

function SignalBadge({ signal }: { signal: "BUY" | "HOLD" | "SELL" }) {
  const c = SIGNAL_COLOR[signal];
  const Icon = SIGNAL_ICON[signal];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${c.bg} ${c.border} border ${c.text}`}>
      <Icon className="w-3 h-3" />
      {signal}
    </span>
  );
}

function SignalCard({ sig }: { sig: Signal }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start justify-between gap-3 p-4 rounded-xl bg-zinc-900 border border-white/5 hover:border-white/10 transition-colors"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-white font-mono">{sig.ticker}</span>
          <SignalBadge signal={sig.signal} />
        </div>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{sig.summary}</p>
        {sig.target_price && (
          <p className="text-xs text-gray-500 mt-1">
            Target: <span className="text-white font-mono">KES {sig.target_price.toFixed(2)}</span>
            {sig.time_horizon && <span className="ml-1">· {sig.time_horizon}</span>}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-bold text-white tabular-nums">{sig.confidence}%</div>
        <div className="text-[10px] text-gray-500">confidence</div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  async function fetchSignals() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.signals.latest();
      setSignals(data);
    } catch (err: any) {
      setError(err.message ?? "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSignals(); }, []);

  const counts = signals.reduce(
    (acc, s) => { acc[s.signal] = (acc[s.signal] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  return (
    <div className="p-6 space-y-6">
      {/* AI Signals panel */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">AI Signals</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Latest Claude-generated recommendations
            </p>
          </div>
          <button
            onClick={fetchSignals}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Summary counts */}
        {signals.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(["BUY", "HOLD", "SELL"] as const).map(s => {
              const c = SIGNAL_COLOR[s];
              const Icon = SIGNAL_ICON[s];
              return (
                <div key={s} className={`flex items-center gap-2 px-4 py-3 rounded-xl ${c.bg} border ${c.border}`}>
                  <Icon className={`w-4 h-4 ${c.text}`} />
                  <div>
                    <div className={`text-xl font-bold ${c.text} tabular-nums`}>{counts[s] ?? 0}</div>
                    <div className="text-[10px] text-gray-400">{s}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error} — showing static market data below.</span>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-zinc-900 border border-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && signals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {signals.slice(0, 12).map(sig => (
              <SignalCard key={`${sig.ticker}-${sig.generated_at}`} sig={sig} />
            ))}
          </div>
        )}

        {!loading && signals.length === 0 && !error && (
          <p className="text-sm text-gray-500 text-center py-8">
            No signals yet — run the Python analysis workers to generate them.
          </p>
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Full market tracker (existing component with static data) */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Market Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">All NSE-listed companies with technical data</p>
        </div>
        <NSETracker embedded />
      </section>
    </div>
  );
}
