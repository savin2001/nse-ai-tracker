import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bell, AlertCircle, RefreshCw, Filter, Newspaper, ExternalLink } from "lucide-react";
import { api, type MarketEvent, type NewsArticle } from "../api/client";
import CompanySearch from "../components/nse/CompanySearch";
import { NSE_STOCKS } from "../data/nseData";

function companyName(ticker: string): string | undefined {
  return NSE_STOCKS.find(s => s.symbol === ticker)?.name;
}

const SEVERITY_CONFIG = {
  critical: { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-400",    dot: "bg-red-500"    },
  high:     { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", dot: "bg-orange-500" },
  medium:   { bg: "bg-amber-500/10",  border: "border-amber-500/30",  text: "text-amber-400",  dot: "bg-amber-500"  },
  low:      { bg: "bg-blue-500/10",   border: "border-blue-500/20",   text: "text-blue-400",   dot: "bg-blue-400"   },
} as const;

const EVENT_TYPE_LABELS: Record<string, string> = {
  earnings_release:   "Earnings",
  dividend_declared:  "Dividend",
  rights_issue:       "Rights Issue",
  merger_acquisition: "M&A",
  regulatory_action:  "Regulatory",
  leadership_change:  "Leadership",
  credit_rating:      "Credit Rating",
  price_surge:        "Price Surge",
  price_drop:         "Price Drop",
  volume_surge:       "Volume Surge",
  other:              "Other",
};

function EventCard({ event }: { event: MarketEvent }) {
  const cfg = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.low;
  const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type.replace(/_/g, " ");
  const dt = new Date(event.detected_at);
  const relTime = formatRelative(dt);
  const name = companyName(event.ticker);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${cfg.bg} ${cfg.border} transition-colors`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${cfg.dot} mt-0.5`} />
          <div>
            <span className={`text-xs font-semibold font-mono ${cfg.text}`}>{event.ticker}</span>
            {name && <p className="text-[10px] text-gray-500 leading-none mt-0.5">{name}</p>}
          </div>
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

const SENTIMENT_LABEL: Record<string, { text: string; cls: string }> = {
  positive: { text: "Positive", cls: "text-emerald-400" },
  negative: { text: "Negative", cls: "text-red-400"     },
  neutral:  { text: "Neutral",  cls: "text-gray-500"    },
};

function sentimentKey(score: number | null): string {
  if (score === null) return "neutral";
  if (score > 0.1)   return "positive";
  if (score < -0.1)  return "negative";
  return "neutral";
}

function NewsCard({ article }: { article: NewsArticle }) {
  const snt  = SENTIMENT_LABEL[sentimentKey(article.sentiment_score)];
  const dt   = new Date(article.published_at);
  const name = companyName(article.ticker);
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/14 transition-colors group">
      <Newspaper size={13} className="text-gray-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 leading-snug group-hover:text-white transition-colors line-clamp-2">
          {article.title}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="shrink-0">
            <span className="text-[10px] font-mono font-bold text-emerald-400">{article.ticker}</span>
            {name && <span className="text-[10px] text-gray-500 ml-1.5">{name}</span>}
          </div>
          {article.source && (
            <span className="text-[10px] text-gray-600 truncate">{article.source}</span>
          )}
          <span className={`text-[10px] font-mono ml-auto ${snt.cls}`}>{snt.text}</span>
          <span className="text-[10px] text-gray-700 font-mono">{formatRelative(dt)}</span>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 mt-1.5 text-[10px] font-mono text-gray-600 hover:text-emerald-400 transition-colors truncate"
        >
          <ExternalLink size={9} className="shrink-0" />
          {article.url}
        </a>
      </div>
    </div>
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

type Tab = "events" | "news";

export default function EventsPage() {
  const [events, setEvents]     = useState<MarketEvent[]>([]);
  const [news, setNews]         = useState<NewsArticle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [severity, setSeverity] = useState<MarketEvent["severity"] | "all">("all");
  const [ticker, setTicker]     = useState("");
  const [tab, setTab]           = useState<Tab>("events");

  async function load() {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = { limit: "50" };
      if (severity !== "all") params.severity = severity;
      if (ticker.trim()) params.ticker = ticker.trim().toUpperCase();

      const newsParams: Record<string, string> = { limit: "30", days: "7" };
      if (ticker.trim()) newsParams.ticker = ticker.trim().toUpperCase();

      const [eventsData, newsData] = await Promise.all([
        api.events.list(params),
        api.news.list(newsParams).catch(() => [] as NewsArticle[]),
      ]);
      setEvents(eventsData);
      setNews(newsData);
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
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h1 className="text-lg font-semibold text-white">Market Events</h1>
          </div>
          <p className="text-sm text-gray-400">Auto-detected earnings, dividends, price spikes, and news</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-gray-500 hover:text-white transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Severity summary tiles — events tab only */}
      {tab === "events" && events.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["critical", "high", "medium", "low"] as const).map(s => {
            const cfg = SEVERITY_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setSeverity(prev => prev === s ? "all" : s)}
                className={`text-center py-2 rounded-lg border transition-colors ${
                  severity === s
                    ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                    : "bg-white/[0.025] border-white/8 text-gray-500 hover:border-white/10"
                }`}
              >
                <div className="text-lg font-bold tabular-nums">{counts[s] ?? 0}</div>
                <div className="text-[10px] capitalize">{s}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/8">
        <button
          onClick={() => setTab("events")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "events"
              ? "border-emerald-400 text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <Bell size={13} />
          Events
          {events.length > 0 && (
            <span className="text-[10px] font-mono bg-white/8 px-1.5 py-0.5 rounded-full">{events.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab("news")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "news"
              ? "border-emerald-400 text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <Newspaper size={13} />
          News
          {news.length > 0 && (
            <span className="text-[10px] font-mono bg-white/8 px-1.5 py-0.5 rounded-full">{news.length}</span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {tab === "events" && (
          <div className="flex flex-wrap items-center gap-1.5 bg-white/[0.025] border border-white/8 rounded-lg px-1 py-1 w-full sm:w-auto">
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
        )}

        <CompanySearch
          onSelect={t => setTicker(t)}
          onClear={() => setTicker("")}
          placeholder="Filter by company or ticker…"
          className="flex-1"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Events tab ─────────────────────────────────────────────────────── */}
      {tab === "events" && (
        loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-white/[0.025] border border-white/8 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            {error ? "Events unavailable" : "No events detected yet — run the event detection worker to populate this feed."}
          </div>
        ) : (
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
          >
            {events.map(e => <EventCard key={e.id} event={e} />)}
          </motion.div>
        )
      )}

      {/* ── News tab ───────────────────────────────────────────────────────── */}
      {tab === "news" && (
        loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-white/[0.025] border border-white/8 animate-pulse" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            No news articles found{ticker ? ` for ${ticker}` : ""} in the last 7 days.
          </div>
        ) : (
          <div className="space-y-2">
            {news.map(a => <NewsCard key={a.id} article={a} />)}
          </div>
        )
      )}
    </div>
  );
}
