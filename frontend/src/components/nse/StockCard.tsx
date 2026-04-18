import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { NSEStock } from "../../data/nseData";
import { formatVolume } from "../../data/nseData";
import StockChart from "./StockChart";
import { api } from "../../api/client";
import type { PricePoint } from "../../data/nseData";

interface Props {
  stock: NSEStock;
  onClick: () => void;
  selected?: boolean;
  index: number;
}

export default function StockCard({ stock, onClick, selected, index }: Props) {
  const [sparkHistory, setSparkHistory] = useState<PricePoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.stocks.prices(stock.symbol, 30)
      .then(prices => {
        if (cancelled || !prices.length) return;
        setSparkHistory([...prices].reverse() as PricePoint[]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [stock.symbol]);

  const isUp = stock.changePercent >= 0;

  // Directional colours
  const tickerClass   = isUp
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : "text-red-400    bg-red-500/10    border-red-500/20";
  const changeClass   = isUp ? "text-emerald-400" : "text-red-400";
  const borderSel     = isUp ? "border-emerald-500/40" : "border-red-500/40";
  const bgSel         = isUp ? "bg-emerald-500/5"      : "bg-red-500/5";
  const glowColor     = isUp ? "rgba(16,185,129,0.14)"  : "rgba(239,68,68,0.14)";
  const hoverGlow     = isUp
    ? "radial-gradient(circle at 50% 0%, rgba(16,185,129,0.10) 0%, transparent 70%)"
    : "radial-gradient(circle at 50% 0%, rgba(239,68,68,0.10) 0%, transparent 70%)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.03 }}
      whileHover={{ y: -3, transition: { duration: 0.15, ease: "easeOut" } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group relative cursor-pointer rounded-xl border p-4 transition-all duration-200 overflow-hidden ${
        selected
          ? `${borderSel} ${bgSel}`
          : "border-white/8 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.035]"
      }`}
      style={selected ? { boxShadow: `0 0 28px ${glowColor}` } : undefined}
    >
      {/* Hover glow overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: hoverGlow }}
      />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-start justify-between mb-1">
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${tickerClass}`}>
            {stock.symbol}
          </span>
          <div className="text-right">
            <p className="text-base font-bold text-white tabular-nums leading-none">
              {stock.price.toFixed(2)}
            </p>
            <p className={`flex items-center justify-end gap-0.5 text-[10px] font-mono font-semibold mt-0.5 ${changeClass}`}>
              {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {isUp ? "+" : ""}{stock.changePercent.toFixed(2)}%
            </p>
          </div>
        </div>

        <p className="text-[10px] text-gray-600 font-mono mb-1 truncate">{stock.sector}</p>
        <p className="text-sm font-semibold text-white leading-tight truncate mb-3">{stock.name}</p>

        {/* Sparkline */}
        <div className="h-10 mb-3 opacity-60 group-hover:opacity-95 transition-opacity duration-200">
          <StockChart history={sparkHistory ?? stock.history} height={40} />
        </div>

        {/* Footer */}
        <div className="flex justify-between text-[10px] font-mono text-gray-600">
          <span>Vol {formatVolume(stock.volume)}</span>
          <span>KES {stock.marketCap}B</span>
        </div>
      </div>
    </motion.div>
  );
}
