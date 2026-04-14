import { motion } from "motion/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { NSEStock } from "../../data/nseData";
import { formatVolume } from "../../data/nseData";
import StockChart from "./StockChart";

interface Props {
  stock: NSEStock;
  onClick: () => void;
  selected?: boolean;
  index: number;
}

export default function StockCard({ stock, onClick, selected, index }: Props) {
  const isUp = stock.changePercent >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      onClick={onClick}
      className={`group relative cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
        selected
          ? "border-emerald-500/50 bg-emerald-500/5"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/5"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              {stock.symbol}
            </span>
            <span className="text-xs text-gray-500 font-mono">{stock.sector}</span>
          </div>
          <p className="text-sm font-semibold text-white leading-tight truncate max-w-[160px]">
            {stock.name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-white tabular-nums">
            {stock.price.toFixed(2)}
          </p>
          <p
            className={`flex items-center justify-end gap-1 text-xs font-mono font-semibold ${
              isUp ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isUp ? "+" : ""}
            {stock.changePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Mini sparkline */}
      <div className="h-10 mb-3 opacity-80">
        <StockChart history={stock.history} height={40} />
      </div>

      <div className="flex justify-between text-xs font-mono text-gray-500">
        <span>Vol {formatVolume(stock.volume)}</span>
        <span>KES {stock.marketCap}B</span>
      </div>
    </motion.div>
  );
}
