import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrendingUp, TrendingDown, Zap, Sparkles } from "lucide-react";
import {
  getTopGainers,
  getTopLosers,
  getMostActive,
  MARKET_INDICES,
  type NSEStock,
} from "../../data/nseData";
import { getMarketSentiment, type MarketSentiment } from "../../services/claudeService";

function MoverRow({ stock, rank }: { stock: NSEStock; rank: number }) {
  const isUp = stock.changePercent >= 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="w-5 text-xs font-mono text-gray-600">{rank}</span>
        <div>
          <p className="text-sm font-semibold text-white">{stock.symbol}</p>
          <p className="text-xs text-gray-500 truncate max-w-[120px]">{stock.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm tabular-nums text-white">{stock.price.toFixed(2)}</p>
        <p
          className={`text-xs font-mono font-semibold ${
            isUp ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {isUp ? "+" : ""}
          {stock.changePercent.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

const SENTIMENT_CONFIG = {
  BULLISH: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", label: "BULLISH" },
  NEUTRAL: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", label: "NEUTRAL" },
  BEARISH: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "BEARISH" },
};

export default function MarketOverview() {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [tab, setTab] = useState<"gainers" | "losers" | "active">("gainers");

  const gainers = getTopGainers(5);
  const losers = getTopLosers(5);
  const active = getMostActive(5);

  const listMap = { gainers, losers, active };
  const current = listMap[tab];

  const loadSentiment = async () => {
    setSentimentLoading(true);
    try {
      const result = await getMarketSentiment(
        MARKET_INDICES,
        gainers.map((s) => ({ symbol: s.symbol, changePercent: s.changePercent })),
        losers.map((s) => ({ symbol: s.symbol, changePercent: s.changePercent }))
      );
      setSentiment(result);
    } catch {
      /* silently fail */
    } finally {
      setSentimentLoading(false);
    }
  };

  const sentConfig = sentiment ? SENTIMENT_CONFIG[sentiment.overall] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Movers panel */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="flex border-b border-white/10">
          {(["gainers", "losers", "active"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-mono uppercase tracking-widest transition-colors ${
                tab === t
                  ? "text-white border-b-2 border-emerald-400 bg-white/5"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t === "gainers" ? (
                <span className="flex items-center justify-center gap-1">
                  <TrendingUp size={10} /> Gainers
                </span>
              ) : t === "losers" ? (
                <span className="flex items-center justify-center gap-1">
                  <TrendingDown size={10} /> Losers
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1">
                  <Zap size={10} /> Active
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="px-4 py-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {current.map((stock, i) => (
                <MoverRow key={stock.symbol} stock={stock} rank={i + 1} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* AI Sentiment panel */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <span className="text-sm font-semibold text-white">Market Sentiment</span>
            <span className="text-xs text-gray-500 font-mono">· AI</span>
          </div>
          {!sentiment && (
            <button
              onClick={loadSentiment}
              disabled={sentimentLoading}
              className="text-xs font-mono px-3 py-1 rounded-lg border border-white/10 text-gray-300 hover:border-white/30 transition-all disabled:opacity-50"
            >
              {sentimentLoading ? "Loading…" : "Generate"}
            </button>
          )}
        </div>
        <div className="p-5">
          {!sentiment && !sentimentLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3">
                <Sparkles size={16} className="text-purple-400" />
              </div>
              <p className="text-sm text-gray-400 mb-1">No sentiment loaded</p>
              <p className="text-xs text-gray-600">Click Generate for an AI market overview</p>
            </div>
          )}
          {sentimentLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-7 h-7 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
            </div>
          )}
          {sentiment && sentConfig && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold ${sentConfig.bg} ${sentConfig.color}`}>
                {sentiment.overall}
                <span className="text-xs font-normal opacity-70">score: {sentiment.score}</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{sentiment.summary}</p>
              {sentiment.sectorOutlooks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Sector Outlooks</p>
                  {sentiment.sectorOutlooks.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-emerald-400 font-mono shrink-0">{s.sector}</span>
                      <span className="text-gray-400">{s.outlook}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
