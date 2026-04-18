/**
 * CompanySearch — autocomplete input that searches NSE companies by name or
 * ticker. Resolves to a ticker string on selection.
 *
 * Usage:
 *   <CompanySearch onSelect={(ticker) => setTicker(ticker)} placeholder="Search company…" />
 */
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { api, type Company } from "../../api/client";
import { NSE_STOCKS } from "../../data/nseData";

// Static fallback — always available, used when the API is unreachable.
const STATIC_COMPANIES: Company[] = NSE_STOCKS.map(s => ({
  ticker:     s.symbol,
  name:       s.name,
  sector:     s.sector,
  market_cap: s.marketCap,
  high_52w:   s.high52w,
  low_52w:    s.low52w,
}));

// Module-level cache so the company list is only fetched once per session.
let _cache: Company[] | null = null;
let _inflight: Promise<Company[]> | null = null;

async function fetchCompanies(): Promise<Company[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = api.stocks.list()
    .then(data => {
      _cache = data.length ? data : STATIC_COMPANIES;
      _inflight = null;
      return _cache;
    })
    .catch(() => {
      _cache = STATIC_COMPANIES;
      _inflight = null;
      return STATIC_COMPANIES;
    });
  return _inflight;
}

interface Props {
  onSelect:    (ticker: string) => void;
  placeholder?: string;
  className?:  string;
  /** Pre-select a ticker to show as initial value */
  value?:      string;
  /** Called when the field is cleared */
  onClear?:    () => void;
}

export default function CompanySearch({
  onSelect,
  placeholder = "Search company or ticker…",
  className   = "",
  value,
  onClear,
}: Props) {
  const [query,     setQuery]     = useState(value ?? "");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filtered,  setFiltered]  = useState<Company[]>([]);
  const [open,      setOpen]      = useState(false);
  const [active,    setActive]    = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Fetch companies on first focus (lazy)
  async function ensureLoaded() {
    if (companies.length) return;
    try {
      const data = await fetchCompanies();
      setCompanies(data);
    } catch {
      // silently fail — user can still type ticker manually
    }
  }

  // Filter whenever query or company list changes
  useEffect(() => {
    const q = query.trim().toUpperCase();
    if (!q) { setFiltered(companies.slice(0, 8)); return; }
    const results = companies.filter(c =>
      c.ticker.startsWith(q) ||
      c.name.toUpperCase().includes(q)
    ).slice(0, 8);
    setFiltered(results);
    setActive(-1);
  }, [query, companies]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(company: Company) {
    setQuery(`${company.ticker} – ${company.name}`);
    setOpen(false);
    onSelect(company.ticker);
  }

  function clear() {
    setQuery("");
    setOpen(false);
    onClear?.();
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === "ArrowDown") setOpen(true); return; }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive(a => Math.min(a + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive(a => Math.max(a - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (active >= 0 && filtered[active]) select(filtered[active]);
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  const showClear = query.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={async () => { await ensureLoaded(); setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-8 py-2 text-sm bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40"
          autoComplete="off"
          spellCheck={false}
        />
        {showClear && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden">
          {filtered.map((c, i) => (
            <li key={c.ticker}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); select(c); }}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  i === active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-xs font-bold font-mono text-emerald-400 w-12 shrink-0">
                  {c.ticker}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm text-white truncate block">{c.name}</span>
                  {c.sector && (
                    <span className="text-[10px] text-gray-600">{c.sector}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
