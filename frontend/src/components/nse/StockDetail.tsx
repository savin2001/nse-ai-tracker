import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import type { NSEStock, PricePoint } from "../../data/nseData";
import { formatVolume } from "../../data/nseData";
import StockChart from "./StockChart";
import AIAnalysis from "./AIAnalysis";
import { api } from "../../api/client";

interface Props {
  stock: NSEStock;
  onClose: () => void;
  days?: number;
}

type Range = "1M" | "2M" | "3M" | "6M" | "9M" | "12M";

const RANGE_DAYS: Record<Range, number> = {
  "1M": 22, "2M": 44, "3M": 66, "6M": 130, "9M": 195, "12M": 252,
};
const SHORT_RANGES: Range[] = ["1M", "2M", "3M"];
const LONG_RANGES:  Range[] = ["3M", "6M", "9M", "12M"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-mono text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-white tabular-nums">{value}</span>
    </div>
  );
}

export default function StockDetail({ stock, onClose, days = 90 }: Props) {
  const extended = days >= 300;
  const ranges   = extended ? LONG_RANGES : SHORT_RANGES;
  const [range, setRange] = useState<Range>(extended ? "12M" : "3M");
  const [liveHistory, setLiveHistory] = useState<PricePoint[] | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const isUp = stock.changePercent >= 0;

  useEffect(() => {
    let cancelled = false;
    setLiveHistory(null);
    setLivePrice(null);
    setRange(extended ? "12M" : "3M");
    api.stocks.prices(stock.symbol, days)
      .then(prices => {
        if (cancelled || !prices.length) return;
        // API returns newest-first; reverse to ascending for the chart
        const asc = [...prices].reverse() as PricePoint[];
        setLiveHistory(asc);
        setLivePrice(asc[asc.length - 1].close);
      })
      .catch(() => {}); // silently fall back to static history
    return () => { cancelled = true; };
  }, [stock.symbol]);

  const history = liveHistory ?? stock.history;
  const displayHistory = history.slice(-RANGE_DAYS[range]);
  const displayPrice = livePrice ?? stock.price;

  const rangeReturn =
    displayHistory.length > 1
      ? (
          ((displayHistory[displayHistory.length - 1].close - displayHistory[0].close) /
            displayHistory[0].close) *
          100
        ).toFixed(2)
      : "0.00";

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 h-full overflow-y-auto no-scrollbar"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
              isUp
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : "text-red-400 bg-red-500/10 border-red-500/20"
            }`}>
              {stock.symbol}
            </span>
            <span className="text-[10px] text-gray-600 font-mono">{stock.sector}</span>
          </div>
          <h2 className="text-lg font-bold text-white leading-tight">{stock.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/8 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Price hero */}
      <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
        <div className="flex items-end justify-between mb-1">
          <span className="text-3xl font-bold text-white tabular-nums">
            KES {displayPrice.toFixed(2)}
            {liveHistory && (
              <span className="ml-2 text-xs font-mono text-emerald-500/70 font-normal">live</span>
            )}
          </span>
          <span
            className={`flex items-center gap-1 text-sm font-mono font-semibold ${
              isUp ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isUp ? "+" : ""}
            {stock.change.toFixed(2)} ({isUp ? "+" : ""}
            {stock.changePercent.toFixed(2)}%)
          </span>
        </div>
        <p className="text-xs text-gray-500 font-mono mb-4">
          {range} return:{" "}
          <span className={Number(rangeReturn) >= 0 ? "text-emerald-400" : "text-red-400"}>
            {Number(rangeReturn) >= 0 ? "+" : ""}
            {rangeReturn}%
          </span>
        </p>

        {/* Range selector */}
        <div className="flex gap-2 mb-3">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs font-mono px-3 py-1 rounded-lg transition-all ${
                range === r
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="w-full" style={{ height: 140 }}>
          <StockChart history={displayHistory} height={140} showAxes id={`detail-${stock.symbol}`} />
        </div>
      </div>

      {/* Key stats grid */}
      <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={14} className="text-gray-500" />
          <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Key Statistics</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-6 gap-y-4">
          <Stat label="Market Cap" value={`KES ${stock.marketCap}B`} />
          <Stat label="Volume" value={formatVolume(stock.volume)} />
          <Stat label="52W High" value={`KES ${stock.high52w}`} />
          <Stat label="52W Low" value={`KES ${stock.low52w}`} />
          <Stat label="P/E Ratio" value={stock.peRatio?.toFixed(1) ?? "—"} />
          <Stat label="Div. Yield" value={stock.dividendYield ? `${stock.dividendYield}%` : "—"} />
        </div>
      </div>

      {/* AI Analysis */}
      <AIAnalysis stock={stock} />
    </motion.div>
  );
}
