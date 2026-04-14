import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings, Bookmark, Plus, X, AlertCircle, RefreshCw, Check } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

function WatchlistItem({ ticker, onRemove }: { ticker: string; onRemove: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: -10 }}
      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border border-white/5"
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

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [watchlist, setWatchlist]   = useState<string[]>([]);
  const [wlLoading, setWlLoading]   = useState(true);
  const [wlError, setWlError]       = useState<string | null>(null);
  const [newTicker, setNewTicker]   = useState("");
  const [adding, setAdding]         = useState(false);
  const [saved, setSaved]           = useState(false);

  async function loadWatchlist() {
    setWlLoading(true); setWlError(null);
    try { setWatchlist(await api.watchlist.list()); }
    catch (err: any) { setWlError(err.message ?? "Failed to load watchlist"); }
    finally { setWlLoading(false); }
  }

  useEffect(() => { loadWatchlist(); }, []);

  async function addTicker(e: React.FormEvent) {
    e.preventDefault();
    const t = newTicker.trim().toUpperCase();
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
        <div className="p-4 rounded-xl bg-zinc-900 border border-white/5 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <p className="text-sm text-white font-mono">{user?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">User ID</p>
            <p className="text-xs text-gray-600 font-mono truncate">{user?.id ?? "—"}</p>
          </div>
          <div className="pt-2 border-t border-white/5">
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
          <div className="relative flex-1">
            <Bookmark className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              placeholder="Add ticker (e.g. SCOM)"
              value={newTicker}
              onChange={e => setNewTicker(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 font-mono uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newTicker.trim()}
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
              <div key={i} className="h-10 rounded-lg bg-zinc-900 border border-white/5 animate-pulse" />
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

      {/* About */}
      <section className="space-y-4">
        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">About</h2>
        <div className="p-4 rounded-xl bg-zinc-900 border border-white/5 space-y-2 text-sm text-gray-400">
          <p><span className="text-gray-600">Platform</span> NSE AI Tracker v1.0</p>
          <p><span className="text-gray-600">Stack</span> React 19 · Vite 6 · Supabase · Claude AI</p>
          <p><span className="text-gray-600">Exchange</span> Nairobi Securities Exchange (NSE)</p>
          <p className="text-xs text-gray-600 pt-2 border-t border-white/5">
            Not financial advice. AI-generated signals are for informational purposes only.
          </p>
        </div>
      </section>
    </div>
  );
}
