import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BriefcaseBusiness, Plus, Trash2, TrendingUp, TrendingDown,
  Minus, AlertCircle, RefreshCw, ChevronDown,
} from "lucide-react";
import { api, type Allocation } from "../api/client";
import CompanySearch from "../components/nse/CompanySearch";

function WeightBar({ weight }: { weight: number }) {
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5">
      <div
        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(weight * 100, 100)}%` }}
      />
    </div>
  );
}

function AllocationRow({
  alloc,
  onRemove,
  onWeightChange,
}: {
  alloc: Allocation;
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, w: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String((alloc.weight * 100).toFixed(1)));
  const pct = (alloc.weight * 100).toFixed(1);

  function commit() {
    const v = parseFloat(draft);
    if (!isNaN(v) && v >= 0 && v <= 100) {
      onWeightChange(alloc.ticker, v / 100);
    } else {
      setDraft(pct);
    }
    setEditing(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.025] border border-white/8 hover:border-white/10 transition-colors"
    >
      {/* Ticker + name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold font-mono text-white">{alloc.ticker}</span>
          {alloc.companies && (
            <span className="text-xs text-gray-500 truncate hidden sm:block">{alloc.companies.name}</span>
          )}
        </div>
        {alloc.companies?.sector && (
          <span className="text-[10px] text-gray-600 font-mono">{alloc.companies.sector}</span>
        )}
      </div>

      {/* Weight bar */}
      <div className="w-24 hidden sm:block">
        <WeightBar weight={alloc.weight} />
      </div>

      {/* Weight edit */}
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(pct); setEditing(false); } }}
            className="w-16 text-sm text-right font-mono bg-black border border-emerald-500/40 rounded px-2 py-0.5 text-white focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-mono text-white hover:text-emerald-400 transition-colors w-16 text-right"
          >
            {pct}%
          </button>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(alloc.ticker)}
        className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function AddPositionForm({ onAdd }: { onAdd: (ticker: string, weight: number) => Promise<void> }) {
  const [open,    setOpen]   = useState(false);
  const [ticker,  setTicker] = useState("");
  const [weight,  setWeight] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(weight);
    if (!ticker || isNaN(w) || w <= 0 || w > 100) return;
    setLoading(true);
    await onAdd(ticker, w / 100);
    setTicker(""); setWeight(""); setOpen(false);
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add position
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={submit}
            className="overflow-hidden"
          >
            <div className="flex gap-2 mt-3">
              <CompanySearch
                onSelect={setTicker}
                onClear={() => setTicker("")}
                placeholder="Search company or ticker…"
                className="flex-1"
              />
              <input
                type="number"
                placeholder="Weight %"
                min="0.1"
                max="100"
                step="0.1"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="w-28 px-3 py-2 text-sm bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40"
                required
              />
              <button
                type="submit"
                disabled={loading || !ticker}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-semibold transition-colors"
              >
                {loading ? "Adding…" : "Add"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PortfolioPage() {
  const [allocs, setAllocs] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setAllocs(await api.portfolio.list()); }
    catch (err: any) { setError(err.message ?? "Failed to load portfolio"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(ticker: string, weight: number) {
    try {
      const a = await api.portfolio.upsert(ticker, weight);
      setAllocs(prev => {
        const exists = prev.findIndex(x => x.ticker === ticker);
        return exists >= 0
          ? prev.map((x, i) => i === exists ? a : x)
          : [...prev, a];
      });
    } catch (err: any) { setError(err.message); }
  }

  async function handleRemove(ticker: string) {
    try {
      await api.portfolio.remove(ticker);
      setAllocs(prev => prev.filter(a => a.ticker !== ticker));
    } catch (err: any) { setError(err.message); }
  }

  async function handleWeightChange(ticker: string, weight: number) {
    try {
      const a = await api.portfolio.update(ticker, weight);
      setAllocs(prev => prev.map(x => x.ticker === ticker ? a : x));
    } catch (err: any) { setError(err.message); }
  }

  const totalWeight = allocs.reduce((s, a) => s + a.weight, 0);
  const isOver = totalWeight > 1.005;
  const isUnder = totalWeight < 0.995 && allocs.length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BriefcaseBusiness className="w-5 h-5 text-emerald-400" />
            <h1 className="text-lg font-semibold text-white">Portfolio</h1>
          </div>
          <p className="text-sm text-gray-400">Manage your NSE allocations</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-gray-500 hover:text-white transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Total weight indicator */}
      {allocs.length > 0 && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
          isOver
            ? "bg-red-500/10 border-red-500/20 text-red-400"
            : isUnder
            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        }`}>
          {isOver ? <TrendingUp className="w-4 h-4" /> : isUnder ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          Total allocation: <span className="font-semibold font-mono">{(totalWeight * 100).toFixed(1)}%</span>
          {isOver && " — reduce positions to rebalance"}
          {isUnder && " — remaining cash not allocated"}
          {!isOver && !isUnder && " — fully allocated"}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Add form */}
      <AddPositionForm onAdd={handleAdd} />

      {/* Allocations list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/[0.025] border border-white/8 animate-pulse" />
          ))}
        </div>
      ) : allocs.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          No positions yet — add your first allocation above.
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {allocs.map(a => (
              <AllocationRow
                key={a.ticker}
                alloc={a}
                onRemove={handleRemove}
                onWeightChange={handleWeightChange}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
