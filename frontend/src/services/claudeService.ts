/**
 * claudeService.ts — AI analysis powered by Claude (via Express API).
 *
 * All AI inference runs server-side in the Python workers using the
 * Anthropic Claude API. This service retrieves the pre-computed results
 * through the Express API rather than calling Anthropic directly from
 * the browser, keeping the API key secure on the server.
 */
import { api } from "../api/client";
import type { NSEStock } from "../data/nseData";

export interface StockAnalysis {
  signal:      "BUY" | "HOLD" | "SELL";
  confidence:  number;          // 0–100
  summary:     string;
  keyFactors:  string[];
  risks:       string[];
  targetPrice: number | null;
  timeHorizon: string | null;
}

export interface MarketSentiment {
  overall:        "BULLISH" | "NEUTRAL" | "BEARISH";
  score:          number;       // -100 to +100
  summary:        string;
  sectorOutlooks: { sector: string; outlook: string }[];
}

/**
 * Fetch the latest Claude-generated signal for a stock from the Express API.
 * Falls back to a HOLD with the stock's price data if no signal exists yet.
 */
export async function analyseStock(stock: NSEStock): Promise<StockAnalysis> {
  const detail = await api.stocks.detail(stock.symbol);
  const s = detail.latestSignal;

  if (!s) {
    // No signal generated yet — return a neutral placeholder
    return {
      signal:      "HOLD",
      confidence:  50,
      summary:     `No Claude signal has been generated for ${stock.symbol} yet. Run the analysis workers to produce a signal.`,
      keyFactors:  ["Awaiting AI analysis from workers"],
      risks:       ["Signal data not yet available"],
      targetPrice: stock.price,
      timeHorizon: null,
    };
  }

  return {
    signal:      s.signal,
    confidence:  s.confidence,
    summary:     s.summary,
    keyFactors:  s.key_factors,
    risks:       s.risks,
    targetPrice: s.target_price,
    timeHorizon: s.time_horizon,
  };
}

/**
 * Derive market sentiment from the aggregated latest Claude signals.
 * BUY-heavy → BULLISH, SELL-heavy → BEARISH, balanced → NEUTRAL.
 */
export async function getMarketSentiment(
  _indices:    { name: string; value: number; changePercent: number }[],
  _topGainers: { symbol: string; changePercent: number }[],
  _topLosers:  { symbol: string; changePercent: number }[],
): Promise<MarketSentiment> {
  const signals = await api.signals.latest();

  const counts = signals.reduce(
    (acc, s) => { acc[s.signal] = (acc[s.signal] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  const buy  = counts["BUY"]  ?? 0;
  const sell = counts["SELL"] ?? 0;
  const hold = counts["HOLD"] ?? 0;
  const total = buy + sell + hold || 1;

  // Score: +100 if all BUY, -100 if all SELL
  const score = Math.round(((buy - sell) / total) * 100);

  let overall: "BULLISH" | "NEUTRAL" | "BEARISH";
  if (score >= 25)       overall = "BULLISH";
  else if (score <= -25) overall = "BEARISH";
  else                   overall = "NEUTRAL";

  const summary =
    overall === "BULLISH"
      ? `Claude signals lean bullish: ${buy} BUY, ${hold} HOLD, ${sell} SELL across ${total} NSE stocks. Broad positive momentum detected.`
      : overall === "BEARISH"
      ? `Claude signals lean bearish: ${sell} SELL, ${hold} HOLD, ${buy} BUY across ${total} NSE stocks. Caution advised.`
      : `Mixed signals from Claude: ${buy} BUY, ${hold} HOLD, ${sell} SELL across ${total} NSE stocks. Market appears range-bound.`;

  // Derive sector outlooks from sector breakdown of signals
  const sectorMap: Record<string, { buy: number; sell: number; hold: number }> = {};
  for (const s of signals) {
    const sector = s.companies?.sector ?? "Unknown";
    if (!sectorMap[sector]) sectorMap[sector] = { buy: 0, sell: 0, hold: 0 };
    if (s.signal === "BUY")  sectorMap[sector].buy++;
    if (s.signal === "SELL") sectorMap[sector].sell++;
    if (s.signal === "HOLD") sectorMap[sector].hold++;
  }

  const sectorOutlooks = Object.entries(sectorMap).map(([sector, c]) => {
    const net = c.buy - c.sell;
    const outlook =
      net > 0  ? `Positive — ${c.buy} BUY vs ${c.sell} SELL` :
      net < 0  ? `Negative — ${c.sell} SELL vs ${c.buy} BUY` :
                 `Neutral — ${c.hold} HOLD, balanced signals`;
    return { sector, outlook };
  });

  return { overall, score, summary, sectorOutlooks };
}
