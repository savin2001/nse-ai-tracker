/** Shared domain types used across API services. */

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
}

export interface MarketEvent {
  id:          number;
  ticker:      string;
  event_type:  string;
  severity:    "low" | "medium" | "high" | "critical";
  description: string;
  detected_at: string;
}
