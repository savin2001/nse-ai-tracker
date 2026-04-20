import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings, Plus, X, AlertCircle, RefreshCw, Check, Cpu } from "lucide-react";
import { api, type DailyUsage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import CompanySearch from "../components/nse/CompanySearch";

function WatchlistItem({ ticker, onRemove }: { ticker: string; onRemove: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: -10 }}
      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.025] border border-white/8"
    >
      <span className="text-sm font-mono font-semibold text-white">{ticker}</span>
      <button
        onClick={onRemove}
        className="text-gray-600 hover:text-red-400 transition-colors ml-3"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

const WORKER_LABELS: Record<string, string> = {
  ai_worker:      "AI Signals",
  event_detector: "Event Detector",
  news_fetcher:   "News Fetcher",
};

const MODEL_SHORT: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku",
  "claude-sonnet-4-6":         "Sonnet",
  "claude-opus-4-6":           "Opus",
};

function UsageBar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [watchlist, setWatchlist]   = useState<string[]>([]);
  const [wlLoading, setWlLoading]   = useState(true);
  const [wlError, setWlError]       = useState<string | null>(null);
  const [newTicker, setNewTicker]   = useState<string>("");
  const [adding, setAdding]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [usage, setUsage]           = useState<DailyUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageDays, setUsageDays]   = useState(30);

  async function loadWatchlist() {
    setWlLoading(true); setWlError(null);
    try { setWatchlist(await api.watchlist.list()); }
    catch (err: any) { setWlError(err.message ?? "Failed to load watchlist"); }
    finally { setWlLoading(false); }
  }

  useEffect(() => { loadWatchlist(); }, []);

  useEffect(() => {
    setUsageLoading(true);
    api.usage.daily(usageDays)
      .then(setUsage)
      .catch(() => setUsage([]))
      .finally(() => setUsageLoading(false));
  }, [usageDays]);

  // Roll up by day for the sparkline and totals
  const byDay = useMemo(() => {
    const map = new Map<string, { cost: number; tokens: number; calls: number }>();
    for (const r of usage) {
      const prev = map.get(r.day) ?? { cost: 0, tokens: 0, calls: 0 };
      map.set(r.day, {
        cost:   prev.cost   + Number(r.total_cost_usd),
        tokens: prev.tokens + r.total_input_tokens + r.total_output_tokens,
        calls:  prev.calls  + r.calls,
      });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, ...v }));
  }, [usage]);

  const totalCost   = byDay.reduce((s, d) => s + d.cost, 0);
  const totalTokens = byDay.reduce((s, d) => s + d.tokens, 0);
  const totalCalls  = byDay.reduce((s, d) => s + d.calls, 0);
  const maxDayCost  = Math.max(...byDay.map(d => d.cost), 0.0001);

  async function addTicker(e: React.FormEvent) {
    e.preventDefault();
    const t = newTicker.trim();
    if (!t || watchlist.includes(t)) return;
    setAdding(true);
    try {
      await api.watchlist.add(t);
      setWatchlist(prev => [...prev, t]);
      setNewTicker("");
      flash();
    } catch (err: any) { setWlError(err.message); }
    finally { setAdding(false); }
  }

  async function removeTicker(ticker: string) {
    try {
      await api.watchlist.remove(ticker);
      setWatchlist(prev => prev.filter(t => t !== ticker));
    } catch (err: any) { setWlError(err.message); }
  }

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-emerald-400" />
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </div>

      {/* Account */}
      <section className="space-y-4">
        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Account</h2>
        <div className="p-4 rounded-xl bg-white/[0.025] border border-white/8 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <p className="text-sm text-white font-mono">{user?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">User ID</p>
            <p className="text-xs text-gray-600 font-mono truncate">{user?.id ?? "—"}</p>
          </div>
          <div className="pt-2 border-t border-white/8">
            <button
              onClick={signOut}
              className="text-sm text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </section>

      {/* Watchlist */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Watchlist</h2>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-emerald-400 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Saved
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={loadWatchlist}
              disabled={wlLoading}
              className="text-gray-600 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${wlLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {wlError && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {wlError}
          </div>
        )}

        {/* Add ticker */}
        <form onSubmit={addTicker} className="flex gap-2">
          <CompanySearch
            onSelect={setNewTicker}
            onClear={() => setNewTicker("")}
            placeholder="Search company or ticker…"
            className="flex-1"
          />
          <button
            type="submit"
            disabled={adding || !newTicker}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            {adding ? "Adding…" : "Add"}
          </button>
        </form>

        {/* Watchlist items */}
        {wlLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-white/[0.025] border border-white/8 animate-pulse" />
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No stocks in your watchlist yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <AnimatePresence>
              {watchlist.map(ticker => (
                <WatchlistItem
                  key={ticker}
                  ticker={ticker}
                  onRemove={() => removeTicker(ticker)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* AI Token Usage */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">AI Token Usage</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Day range selector */}
            <div className="flex items-center rounded-lg border border-white/10 overflow-hidden text-[11px] font-mono">
              {([7, 14, 30] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setUsageDays(d)}
                  className={`px-2.5 py-1 transition-colors border-l border-white/10 first:border-l-0 ${
                    usageDays === d ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >{d}d</button>
              ))}
            </div>
            <button
              onClick={() => { setUsageLoading(true); api.usage.daily(usageDays).then(setUsage).catch(() => setUsage([])).finally(() => setUsageLoading(false)); }}
              disabled={usageLoading}
              className="text-gray-600 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${usageLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {usageLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-white/[0.025] border border-white/8 animate-pulse" />
            ))}
          </div>
        ) : usage.length === 0 ? (
          <div className="p-6 rounded-xl bg-white/[0.025] border border-white/8 text-center">
            <Cpu className="w-6 h-6 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No AI usage recorded yet.</p>
            <p className="text-xs text-gray-700 mt-1">Usage is logged each time a worker calls Claude.</p>
          </div>
        ) : (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Cost",   value: `$${totalCost.toFixed(4)}`, sub: `last ${usageDays}d`, warn: totalCost > 1 },
                { label: "Total Tokens", value: totalTokens >= 1000 ? `${(totalTokens/1000).toFixed(1)}K` : String(totalTokens), sub: "input + output", warn: false },
                { label: "API Calls",    value: String(totalCalls), sub: "Claude calls", warn: false },
              ].map(({ label, value, sub, warn }) => (
                <div key={label} className={`p-3 rounded-xl border ${warn ? "bg-amber-500/8 border-amber-500/20" : "bg-white/[0.025] border-white/8"}`}>
                  <div className={`text-lg font-bold tabular-nums ${warn ? "text-amber-400" : "text-white"}`}>{value}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                  <div className="text-[10px] text-gray-700">{sub}</div>
                </div>
              ))}
            </div>

            {/* Daily cost bars */}
            <div className="p-4 rounded-xl bg-white/[0.025] border border-white/8 space-y-2.5">
              <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-3">Daily breakdown</p>
              {byDay.slice().reverse().map(d => (
                <div key={d.day} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-gray-500">{d.day}</span>
                    <div className="flex items-center gap-3 text-gray-400">
                      <span className="font-mono text-[10px] text-gray-600">{(d.tokens/1000).toFixed(1)}K tok</span>
                      <span className="font-mono font-semibold text-emerald-400">${d.cost.toFixed(4)}</span>
                    </div>
                  </div>
                  <UsageBar value={d.cost} max={maxDayCost} className="bg-emerald-500" />
                </div>
              ))}
            </div>

            {/* Per-worker breakdown */}
            <div className="p-4 rounded-xl bg-white/[0.025] border border-white/8">
              <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-3">By worker · model</p>
              <div className="space-y-2">
                {Array.from(
                  usage.reduce((map, r) => {
                    const key = `${r.worker}::${r.model}`;
                    const prev = map.get(key) ?? { worker: r.worker, model: r.model, cost: 0, calls: 0, tokens: 0 };
                    map.set(key, {
                      ...prev,
                      cost:   prev.cost   + Number(r.total_cost_usd),
                      calls:  prev.calls  + r.calls,
                      tokens: prev.tokens + r.total_input_tokens + r.total_output_tokens,
                    });
                    return map;
                  }, new Map<string, { worker: string; model: string; cost: number; calls: number; tokens: number }>())
                  .values()
                ).sort((a, b) => b.cost - a.cost).map(row => (
                  <div key={`${row.worker}::${row.model}`} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div>
                      <span className="text-xs text-white font-medium">{WORKER_LABELS[row.worker] ?? row.worker}</span>
                      <span className="ml-2 text-[10px] font-mono text-gray-600">{MODEL_SHORT[row.model] ?? row.model}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] font-mono">
                      <span className="text-gray-600">{row.calls} calls</span>
                      <span className="text-gray-500">{(row.tokens/1000).toFixed(1)}K tok</span>
                      <span className="text-emerald-400 font-semibold">${row.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* About */}
      <section className="space-y-4">
        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">About</h2>
        <div className="p-4 rounded-xl bg-white/[0.025] border border-white/8 space-y-2 text-sm text-gray-400">
          <p><span className="text-gray-600">Platform</span> NSE AI Tracker v1.0</p>
          <p><span className="text-gray-600">Stack</span> React 19 · Vite 6 · Supabase · Claude AI</p>
          <p><span className="text-gray-600">Exchange</span> Nairobi Securities Exchange (NSE)</p>
          <p className="text-xs text-gray-600 pt-2 border-t border-white/8">
            Not financial advice. AI-generated signals are for informational purposes only.
          </p>
        </div>
      </section>
    </div>
  );
}
