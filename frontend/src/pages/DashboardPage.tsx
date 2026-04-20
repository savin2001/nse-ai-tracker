import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw,
  AlertCircle, Target, Clock, Zap, ArrowRight,
} from "lucide-react";
import { api, type Signal } from "../api/client";
import { NSE_STOCKS, type NSEStock } from "../data/nseData";
import StockCard from "../components/nse/StockCard";
import StockDetail from "../components/nse/StockDetail";

const SIG_CFG = {
  BUY:  { bg: "bg-emerald-500/[0.13]", border: "border-emerald-500/40", text: "text-emerald-400", pill: "bg-emerald-500/20 text-emerald-300", glow: "rgba(16,185,129,0.18)",  Icon: TrendingUp  },
  HOLD: { bg: "bg-amber-500/[0.11]",   border: "border-amber-500/35",   text: "text-amber-400",   pill: "bg-amber-500/20 text-amber-300",   glow: "rgba(245,158,11,0.15)",  Icon: Minus       },
  SELL: { bg: "bg-red-500/[0.13]",     border: "border-red-500/40",     text: "text-red-400",     pill: "bg-red-500/20 text-red-300",     glow: "rgba(239,68,68,0.18)",   Icon: TrendingDown},
} as const;
type SigKey = keyof typeof SIG_CFG;

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({ sig, rank }: { sig: Signal; rank?: number }) {
  const c = SIG_CFG[sig.signal as SigKey] ?? SIG_CFG.HOLD;
  const color = sig.confidence >= 70 ? "bg-emerald-500" : sig.confidence >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex flex-col gap-3 p-4 rounded-xl border ${c.bg} ${c.border} transition-all`}
      style={{ boxShadow: `0 0 20px ${c.glow}` }}
    >
      {rank !== undefined && (
        <span className="absolute top-3 right-3 text-[10px] font-mono text-gray-600">#{rank + 1}</span>
      )}

      {/* Ticker + signal */}
      <div className="flex items-center gap-2">
        <div>
          <span className="text-sm font-bold font-mono text-white">{sig.ticker}</span>
          {sig.companies?.name && (
            <p className="text-[10px] text-gray-500 leading-none mt-0.5 truncate max-w-[120px]">{sig.companies.name}</p>
          )}
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${c.pill}`}>
          <c.Icon size={9} />{sig.signal}
        </span>
        <span className={`ml-auto text-xl font-bold tabular-nums ${c.text}`}>{sig.confidence}%</span>
      </div>

      {/* Confidence bar */}
      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${sig.confidence}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>

      {/* Summary */}
      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{sig.summary}</p>

      {/* Meta */}
      {(sig.target_price || sig.time_horizon) && (
        <div className="flex items-center gap-4 pt-1 border-t border-white/5">
          {sig.target_price && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Target size={9} /><span className="text-white font-mono">KES {sig.target_price.toFixed(2)}</span>
            </span>
          )}
          {sig.time_horizon && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Clock size={9} />{sig.time_horizon}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Filter = "top" | SigKey;

function useHoldingsStocks() {
  const [stocks, setStocks] = useState<NSEStock[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.portfolio.list(), api.watchlist.list()])
      .then(([allocs, watchlist]) => {
        if (cancelled) return;
        const tickers = [
          ...allocs.map(a => a.ticker),
          ...watchlist.filter(t => !allocs.some(a => a.ticker === t)),
        ];
        const matched = tickers
          .map(t => NSE_STOCKS.find(s => s.symbol === t))
          .filter((s): s is NSEStock => s !== undefined)
          .slice(0, 6);
        setStocks(matched);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return stocks;
}

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<Filter>("top");
  const [selected, setSelected] = useState<NSEStock | null>(null);
  const holdingsStocks = useHoldingsStocks();

  async function fetchSignals() {
    setLoading(true); setError(null);
    try { setSignals(await api.signals.latest()); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load signals"); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchSignals(); }, []);

  const counts = signals.reduce((acc, s) => {
    acc[s.signal as SigKey] = (acc[s.signal as SigKey] ?? 0) + 1;
    return acc;
  }, {} as Record<SigKey, number>);

  const displayed = filter === "top"
    ? [...signals].sort((a, b) => b.confidence - a.confidence).slice(0, 5)
    : signals.filter(s => s.signal === filter).sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="p-4 sm:p-6 space-y-10">

      {/* ── AI Signals ────────────────────────────────────────────────────── */}
      <section>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-emerald-400" />
              <h2 className="text-base font-semibold text-white">AI Signals</h2>
            </div>
            <p className="text-xs text-gray-600 mt-0.5 ml-[23px]">
              {filter === "top" ? "Top 5 by confidence" : `All ${filter} signals`} · Claude-generated
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex items-center rounded-lg border border-white/10 overflow-hidden text-[11px] font-mono">
              <button
                onClick={() => setFilter("top")}
                className={`px-3 py-1.5 transition-colors ${filter === "top" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                Top 5
              </button>
              {(["BUY", "HOLD", "SELL"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(f => f === s ? "top" : s)}
                  className={`px-3 py-1.5 transition-colors border-l border-white/10 ${
                    filter === s
                      ? `${SIG_CFG[s].bg} ${SIG_CFG[s].text} font-semibold`
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {s} {counts[s] ?? 0}
                </button>
              ))}
            </div>

            <button
              onClick={fetchSignals}
              disabled={loading}
              className="text-gray-500 hover:text-white transition-colors disabled:opacity-40 p-1.5 rounded-lg border border-white/10 hover:border-white/20"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/18 text-red-400 text-xs mb-4">
            <AlertCircle size={13} className="shrink-0" />
            {error}
            <button onClick={fetchSignals} className="ml-auto text-red-400 hover:text-red-300 underline">Retry</button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-white/[0.025] border border-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Signal grid */}
        {!loading && displayed.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {displayed.map((sig, i) => (
                <SignalCard
                  key={`${sig.ticker}-${sig.generated_at}`}
                  sig={sig}
                  rank={filter === "top" ? i : undefined}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {!loading && signals.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-white/8 rounded-2xl">
            <Zap size={20} className="text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">No signals yet</p>
            <p className="text-xs text-gray-700 mt-1">Run the AI worker to generate recommendations.</p>
          </div>
        )}

        {!loading && signals.length > 0 && displayed.length === 0 && (
          <div className="py-10 text-center text-gray-600 text-sm">
            No {filter} signals at the moment.
          </div>
        )}
      </section>

      <div className="border-t border-white/5" />

      {/* ── My Holdings ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">My Holdings</h2>
            <p className="text-xs text-gray-600 mt-0.5">Portfolio &amp; watchlist · click a card to view detail</p>
          </div>
          <Link
            to="/trends"
            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-mono"
          >
            All equities <ArrowRight size={11} />
          </Link>
        </div>

        {holdingsStocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/8 rounded-2xl">
            <p className="text-sm text-gray-500">No holdings yet</p>
            <p className="text-xs text-gray-700 mt-1">
              Add stocks to your{" "}
              <Link to="/portfolio" className="text-emerald-500 hover:underline">portfolio</Link>
              {" "}or watchlist to see them here.
            </p>
          </div>
        ) : (
          <div className={`flex flex-col md:flex-row gap-5 ${selected ? "md:items-start" : ""}`}>
            <div className={`flex-1 min-w-0 transition-all duration-300 ${selected ? "md:max-w-[55%]" : "w-full"}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {holdingsStocks.map((stock, i) => (
                  <StockCard
                    key={stock.symbol}
                    stock={stock}
                    index={i}
                    days={30}
                    selected={selected?.symbol === stock.symbol}
                    onClick={() => setSelected(prev => prev?.symbol === stock.symbol ? null : stock)}
                  />
                ))}
              </div>
            </div>
            <AnimatePresence>
              {selected && (
                <div className="w-full md:w-[42%] md:shrink-0 md:sticky md:top-[56px] md:max-h-[calc(100vh-72px)] md:overflow-y-auto no-scrollbar">
                  <StockDetail
                    stock={selected}
                    onClose={() => setSelected(null)}
                    days={90}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
