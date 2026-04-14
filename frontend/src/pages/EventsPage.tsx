import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bell, AlertCircle, RefreshCw, Filter } from "lucide-react";
import { api, type MarketEvent } from "../api/client";

const SEVERITY_CONFIG = {
  critical: { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-400",    dot: "bg-red-500"    },
  high:     { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", dot: "bg-orange-500" },
  medium:   { bg: "bg-amber-500/10",  border: "border-amber-500/30",  text: "text-amber-400",  dot: "bg-amber-500"  },
  low:      { bg: "bg-blue-500/10",   border: "border-blue-500/20",   text: "text-blue-400",   dot: "bg-blue-400"   },
} as const;

const EVENT_TYPE_LABELS: Record<string, string> = {
  earnings:       "Earnings",
  dividend:       "Dividend",
  rights_issue:   "Rights Issue",
  ma:             "M&A",
  regulatory:     "Regulatory",
  leadership:     "Leadership",
  credit_rating:  "Credit Rating",
  price_spike:    "Price Spike",
  volume_surge:   "Volume Surge",
};

function EventCard({ event }: { event: MarketEvent }) {
  const cfg = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.low;
  const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type.replace(/_/g, " ");
  const dt = new Date(event.detected_at);
  const relTime = formatRelative(dt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${cfg.bg} ${cfg.border} transition-colors`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${cfg.dot} mt-0.5`} />
          <span className={`text-xs font-semibold font-mono ${cfg.text}`}>{event.ticker}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
            {event.severity.toUpperCase()}
          </span>
          <span className="text-[10px] text-gray-500 font-mono px-2 py-0.5 rounded bg-white/5">
            {label}
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-300 mt-2 leading-relaxed">{event.description}</p>
      <p className="text-[10px] text-gray-600 font-mono mt-2">{relTime} · {dt.toLocaleString()}</p>
    </motion.div>
  );
}

function formatRelative(dt: Date): string {
  const diff = (Date.now() - dt.getTime()) / 1000;
  if (diff < 60)   return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

const SEVERITIES: Array<MarketEvent["severity"] | "all"> = ["all", "critical", "high", "medium", "low"];

export default function EventsPage() {
  const [events, setEvents]     = useState<MarketEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [severity, setSeverity] = useState<MarketEvent["severity"] | "all">("all");
  const [ticker, setTicker]     = useState("");

  async function load() {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = { limit: "50" };
      if (severity !== "all") params.severity = severity;
      if (ticker.trim()) params.ticker = ticker.trim().toUpperCase();
      setEvents(await api.events.list(params));
    } catch (err: any) {
      setError(err.message ?? "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [severity, ticker]);

  const counts = events.reduce(
    (acc, e) => { acc[e.severity] = (acc[e.severity] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h1 className="text-lg font-semibold text-white">Market Events</h1>
          </div>
          <p className="text-sm text-gray-400">Auto-detected earnings, dividends, price spikes, and more</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-gray-500 hover:text-white transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Severity summary */}
      {events.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {(["critical", "high", "medium", "low"] as const).map(s => {
            const cfg = SEVERITY_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setSeverity(prev => prev === s ? "all" : s)}
                className={`text-center py-2 rounded-lg border transition-colors ${
                  severity === s
                    ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                    : "bg-zinc-900 border-white/5 text-gray-500 hover:border-white/10"
                }`}
              >
                <div className="text-lg font-bold tabular-nums">{counts[s] ?? 0}</div>
                <div className="text-[10px] capitalize">{s}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/5 rounded-lg px-1 py-1">
          <Filter className="w-3 h-3 text-gray-500 ml-1.5" />
          {SEVERITIES.map(s => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors capitalize ${
                severity === s
                  ? "bg-white/10 text-white font-medium"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <input
          placeholder="Filter by ticker…"
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-zinc-900 border border-white/5 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 font-mono uppercase"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-900 border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          {error ? "Events unavailable" : "No events detected yet — run the event detection worker to populate this feed."}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(e => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
