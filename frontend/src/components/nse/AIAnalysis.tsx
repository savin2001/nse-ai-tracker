import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Clock } from "lucide-react";
import type { NSEStock } from "../../data/nseData";
import { analyseStock, type StockAnalysis } from "../../services/geminiService";

interface Props {
  stock: NSEStock;
}

const SIGNAL_CONFIG = {
  BUY: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: TrendingUp, label: "BUY" },
  HOLD: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: Minus, label: "HOLD" },
  SELL: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: TrendingDown, label: "SELL" },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-xs font-mono text-gray-400 w-8 text-right">{value}%</span>
    </div>
  );
}

export default function AIAnalysis({ stock }: Props) {
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyseStock(stock);
      setAnalysis(result);
    } catch (e) {
      setError("Analysis failed. Check your Gemini API key.");
    } finally {
      setLoading(false);
    }
  };

  const config = analysis ? SIGNAL_CONFIG[analysis.signal] : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">AI Analysis</span>
          <span className="text-xs text-gray-500 font-mono">· Gemini 2.0</span>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-white/30 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {loading ? "Analysing…" : analysis ? "Re-run" : "Analyse"}
        </button>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">
          {!analysis && !loading && !error && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-10 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3">
                <Sparkles size={20} className="text-purple-400" />
              </div>
              <p className="text-sm text-gray-400 mb-1">No analysis yet</p>
              <p className="text-xs text-gray-600">Click Analyse to generate a BUY / HOLD / SELL signal</p>
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-10"
            >
              <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin mb-3" />
              <p className="text-xs text-gray-500 font-mono">Asking Gemini…</p>
            </motion.div>
          )}

          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20"
            >
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </motion.div>
          )}

          {analysis && config && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Signal badge + confidence */}
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-lg ${config.bg} ${config.color}`}>
                  <config.icon size={18} />
                  {config.label}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Confidence</p>
                  <ConfidenceBar value={analysis.confidence} />
                </div>
              </div>

              {/* Summary */}
              <p className="text-sm text-gray-300 leading-relaxed">{analysis.summary}</p>

              {/* Target + horizon */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target size={12} className="text-gray-500" />
                    <span className="text-xs text-gray-500">Target Price</span>
                  </div>
                  <p className="text-base font-bold text-white tabular-nums">
                    KES {analysis.targetPrice.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock size={12} className="text-gray-500" />
                    <span className="text-xs text-gray-500">Time Horizon</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{analysis.timeHorizon}</p>
                </div>
              </div>

              {/* Key factors */}
              <div>
                <p className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-widest">Key Factors</p>
                <ul className="space-y-1.5">
                  {analysis.keyFactors.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risks */}
              <div>
                <p className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-widest">Risks</p>
                <ul className="space-y-1.5">
                  {analysis.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
