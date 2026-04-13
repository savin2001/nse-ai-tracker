import React from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { MARKET_INDICES, type MarketIndex } from "../../data/nseData";

function IndexTile({ index }: { index: MarketIndex }) {
  const isUp = index.changePercent >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-1 px-5 py-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm min-w-[180px]"
    >
      <span className="text-xs font-mono text-gray-400 truncate">{index.name}</span>
      <span className="text-xl font-bold text-white tabular-nums">
        {index.value.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
      </span>
      <span
        className={`flex items-center gap-1 text-xs font-mono font-semibold ${
          isUp ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {isUp ? "+" : ""}
        {index.changePercent.toFixed(2)}%
      </span>
    </motion.div>
  );
}

export default function MarketHeader() {
  return (
    <div className="w-full border-b border-white/10 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Activity size={16} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">NSE AI Tracker</h1>
              <p className="text-xs text-gray-500 font-mono">Nairobi Securities Exchange · AI-Powered Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-gray-400">Live</span>
          </div>
        </div>

        {/* Index tiles */}
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {MARKET_INDICES.map((idx) => (
            <IndexTile key={idx.name} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}
