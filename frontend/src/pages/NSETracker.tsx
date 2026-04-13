import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { NSE_STOCKS, SECTORS, type NSEStock } from "../data/nseData";
import MarketHeader from "../components/nse/MarketHeader";
import MarketOverview from "../components/nse/MarketOverview";
import StockCard from "../components/nse/StockCard";
import StockDetail from "../components/nse/StockDetail";

type View = "grid" | "list";

function StockRow({ stock, onClick, selected }: { stock: NSEStock; onClick: () => void; selected: boolean }) {
  const isUp = stock.changePercent >= 0;
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ x: 4 }}
      className={`flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors ${
        selected ? "bg-emerald-500/5 border border-emerald-500/20" : "hover:bg-white/5 border border-transparent"
      }`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className="text-xs font-mono font-bold text-emerald-400 w-14 shrink-0">{stock.symbol}</span>
        <span className="text-sm text-white truncate hidden sm:block">{stock.name}</span>
        <span className="text-xs text-gray-500 font-mono hidden lg:block">{stock.sector}</span>
      </div>
      <div className="flex items-center gap-8 shrink-0">
        <span className="text-sm tabular-nums text-white w-20 text-right">{stock.price.toFixed(2)}</span>
        <span
          className={`text-xs font-mono font-semibold w-16 text-right ${
            isUp ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {isUp ? "+" : ""}
          {stock.changePercent.toFixed(2)}%
        </span>
        <span className="text-xs font-mono text-gray-500 w-20 text-right hidden md:block">
          {stock.marketCap}B
        </span>
      </div>
    </motion.div>
  );
}

export default function NSETracker() {
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All");
  const [view, setView] = useState<View>("grid");
  const [selected, setSelected] = useState<NSEStock | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return NSE_STOCKS.filter((s) => {
      const matchSector = sector === "All" || s.sector === sector;
      const q = search.toLowerCase();
      const matchSearch = !q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      return matchSector && matchSearch;
    });
  }, [search, sector]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MarketHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Market Overview */}
        <section>
          <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">
            Market Overview
          </h2>
          <MarketOverview />
        </section>

        {/* Stock list section */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">
              Equities &mdash; {filtered.length} stocks
            </h2>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 text-xs font-mono bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white/30 w-40"
                />
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`p-2 rounded-lg border text-gray-400 hover:text-white transition-colors ${
                  showFilters ? "border-white/20 bg-white/5" : "border-white/10"
                }`}
              >
                <SlidersHorizontal size={14} />
              </button>

              {/* View toggle */}
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => setView("grid")}
                  className={`p-2 transition-colors ${
                    view === "grid" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`p-2 transition-colors ${
                    view === "list" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Sector filter */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="flex flex-wrap gap-2 py-1">
                  {SECTORS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSector(s)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                        sector === s
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Two-column layout: stock list + detail panel */}
          <div className={`flex gap-5 ${selected ? "items-start" : ""}`}>
            {/* Stock list */}
            <div className={`flex-1 min-w-0 transition-all duration-300 ${selected ? "max-w-[55%]" : "w-full"}`}>
              {view === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filtered.map((stock, i) => (
                    <StockCard
                      key={stock.symbol}
                      stock={stock}
                      index={i}
                      selected={selected?.symbol === stock.symbol}
                      onClick={() =>
                        setSelected((prev) =>
                          prev?.symbol === stock.symbol ? null : stock
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 text-xs font-mono text-gray-500">
                    <span className="w-14">Symbol</span>
                    <span className="flex-1 hidden sm:block">Name</span>
                    <div className="flex gap-8 shrink-0">
                      <span className="w-20 text-right">Price (KES)</span>
                      <span className="w-16 text-right">Chg%</span>
                      <span className="w-20 text-right hidden md:block">Mkt Cap</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {filtered.map((stock) => (
                      <StockRow
                        key={stock.symbol}
                        stock={stock}
                        selected={selected?.symbol === stock.symbol}
                        onClick={() =>
                          setSelected((prev) =>
                            prev?.symbol === stock.symbol ? null : stock
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-gray-500 mb-1">No stocks match your filters</p>
                  <button
                    onClick={() => { setSearch(""); setSector("All"); }}
                    className="text-xs font-mono text-emerald-400 hover:underline mt-2"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {/* Detail panel */}
            <AnimatePresence>
              {selected && (
                <div className="w-[42%] shrink-0 sticky top-[110px] max-h-[calc(100vh-130px)] overflow-y-auto no-scrollbar">
                  <StockDetail
                    stock={selected}
                    onClose={() => setSelected(null)}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  );
}
