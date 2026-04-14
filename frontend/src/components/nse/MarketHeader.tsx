import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { MARKET_INDICES, type MarketIndex } from "../../data/nseData";

function IndexTile({ index, i }: { index: MarketIndex; i: number }) {
  const isUp = index.changePercent >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.07, duration: 0.4 }}
      className={`flex flex-col gap-1.5 px-5 py-4 rounded-xl border min-w-[180px] transition-all duration-200 hover:-translate-y-0.5 ${
        isUp
          ? "border-emerald-500/15 bg-emerald-500/5 hover:border-emerald-500/25"
          : "border-red-500/15    bg-red-500/5    hover:border-red-500/25"
      }`}
    >
      <span className="text-[10px] font-mono text-gray-500 truncate uppercase tracking-wide">{index.name}</span>
      <span className="text-xl font-bold text-white tabular-nums">
        {index.value.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
      </span>
      <span className={`flex items-center gap-1 text-xs font-mono font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
        {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {isUp ? "+" : ""}{index.changePercent.toFixed(2)}%
      </span>
    </motion.div>
  );
}

export default function MarketHeader() {
  return (
    <div className="w-full border-b border-white/8 glass sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center">
              <Activity size={15} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none">NSE AI Tracker</h1>
              <p className="text-[10px] text-gray-600 font-mono mt-0.5">
                Nairobi Securities Exchange · AI-Powered Analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-400">Live</span>
          </div>
        </div>

        {/* Index tiles */}
        <div className="flex gap-2.5 overflow-x-auto pb-0.5 no-scrollbar">
          {MARKET_INDICES.map((idx, i) => (
            <IndexTile key={idx.name} index={idx} i={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
