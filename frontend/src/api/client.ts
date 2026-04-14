/**
 * Typed API client — wraps the Express API with Bearer auth.
 * Falls back gracefully if the API is unavailable.
 */
import { supabase } from "../auth/supabase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Type definitions ──────────────────────────────────────────────────────────

export interface Company {
  ticker:     string;
  name:       string;
  sector:     string;
  market_cap: number | null;
  high_52w:   number | null;
  low_52w:    number | null;
}

export interface StockPrice {
  date:   string;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface Signal {
  id:           number;
  ticker:       string;
  signal:       "BUY" | "HOLD" | "SELL";
  confidence:   number;
  summary:      string;
  key_factors:  string[];
  risks:        string[];
  target_price: number | null;
  time_horizon: string | null;
  generated_at: string;
  companies?:   { name: string; sector: string };
}

export interface Allocation {
  id:         number;
  ticker:     string;
  weight:     number;
  rationale:  string | null;
  updated_at: string;
  companies?: { name: string; sector: string };
}

export interface MacroIndicator {
  indicator:   string;
  value:       number;
  period_date: string;
  source:      string;
  unit:        string | null;
  notes:       string | null;
}

export interface MarketEvent {
  id:          number;
  ticker:      string;
  event_type:  string;
  severity:    "low" | "medium" | "high" | "critical";
  description: string;
  detected_at: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const api = {
  stocks: {
    list: ()                      => apiFetch<Company[]>("/api/stocks"),
    detail: (ticker: string)      => apiFetch<{ company: Company; prices: StockPrice[]; latestSignal: Signal | null }>(`/api/stocks/${ticker}`),
    prices: (ticker: string, days = 90) => apiFetch<StockPrice[]>(`/api/stocks/${ticker}/prices?days=${days}`),
  },
  signals: {
    list:   (params?: Record<string, string>) => apiFetch<Signal[]>(`/api/signals?${new URLSearchParams(params)}`),
    latest: ()                                => apiFetch<Signal[]>("/api/signals/latest"),
  },
  portfolio: {
    list:   ()                                           => apiFetch<Allocation[]>("/api/portfolio"),
    upsert: (ticker: string, weight: number, rationale?: string) =>
      apiFetch<Allocation>("/api/portfolio", { method: "POST", body: JSON.stringify({ ticker, weight, rationale }) }),
    update: (ticker: string, weight: number)             =>
      apiFetch<Allocation>(`/api/portfolio/${ticker}`, { method: "PUT", body: JSON.stringify({ weight }) }),
    remove: async (ticker: string) => {
      const token = await getToken();
      return fetch(`${BASE}/api/portfolio/${ticker}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
  },
  watchlist: {
    list:   ()                   => apiFetch<string[]>("/api/watchlist"),
    add:    (ticker: string)     => apiFetch<{ ticker: string }>("/api/watchlist", { method: "POST", body: JSON.stringify({ ticker }) }),
    remove: async (ticker: string) => {
      const token = await getToken();
      return fetch(`${BASE}/api/watchlist/${ticker}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
  },
  events: {
    list: (params?: Record<string, string>) => apiFetch<MarketEvent[]>(`/api/events?${new URLSearchParams(params)}`),
  },
  macro: {
    list: () => apiFetch<MacroIndicator[]>("/api/macro"),
  },
};
