import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { NSEStock, PricePoint } from "../../data/nseData";
import { formatVolume } from "../../data/nseData";
import StockChart from "./StockChart";
import { api } from "../../api/client";

interface Props {
  stock: NSEStock;
  onClick: () => void;
  selected?: boolean;
  index: number;
  days?: number;
}

export default function StockCard({ stock, onClick, selected, index, days = 30 }: Props) {
  const [sparkHistory, setSparkHistory] = useState<PricePoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.stocks.prices(stock.symbol, days)
      .then(prices => {
        if (cancelled || !prices.length) return;
        setSparkHistory([...prices].reverse() as PricePoint[]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [stock.symbol, days]);

  // Derive live price + change from fetched history; fall back to static data
  const livePrice      = sparkHistory ? sparkHistory[sparkHistory.length - 1]?.close : null;
  const livePrevClose  = sparkHistory && sparkHistory.length >= 2
    ? sparkHistory[sparkHistory.length - 2]?.close : null;
  const liveChangePct  = livePrice && livePrevClose && livePrevClose > 0
    ? ((livePrice - livePrevClose) / livePrevClose) * 100 : null;

  const displayPrice  = livePrice  ?? stock.price;
  const displayChange = liveChangePct ?? stock.changePercent;
  const isUp = displayChange >= 0;

  const tickerClass = isUp
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : "text-red-400 bg-red-500/10 border-red-500/20";
  const changeClass = isUp ? "text-emerald-400" : "text-red-400";
  const borderSel   = isUp ? "border-emerald-500/40" : "border-red-500/40";
  const bgSel       = isUp ? "bg-emerald-500/5"      : "bg-red-500/5";
  const glowColor   = isUp ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.14)";
  const hoverGlow   = isUp
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
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: hoverGlow }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${tickerClass}`}>
            {stock.symbol}
          </span>
          <div className="text-right">
            <p className="text-base font-bold text-white tabular-nums leading-none">
              {displayPrice.toFixed(2)}
            </p>
            <p className={`flex items-center justify-end gap-0.5 text-[10px] font-mono font-semibold mt-0.5 ${changeClass}`}>
              {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {isUp ? "+" : ""}{displayChange.toFixed(2)}%
            </p>
          </div>
        </div>

        <p className="text-[10px] text-gray-600 font-mono mb-1 truncate">{stock.sector}</p>
        <p className="text-sm font-semibold text-white leading-tight truncate mb-3">{stock.name}</p>

        {/* Sparkline — aspect-ratio makes height scale with card width */}
        <div className="w-full mb-3 opacity-60 group-hover:opacity-95 transition-opacity duration-200" style={{ aspectRatio: "5 / 1" }}>
          <StockChart history={sparkHistory ?? stock.history} height={80} id={stock.symbol} />
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
