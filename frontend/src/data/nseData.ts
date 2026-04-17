export interface NSEStock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number; // in billions KES
  high52w: number;
  low52w: number;
  peRatio: number | null;
  dividendYield: number | null;
  history: PricePoint[];
}

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

// Deterministic pseudo-random using seed
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generatePriceHistory(basePrice: number, days: number, symbol: string): PricePoint[] {
  const history: PricePoint[] = [];
  let price = basePrice * (0.85 + seededRandom(symbol.charCodeAt(0)) * 0.3);
  const today = new Date("2026-04-10");

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const seed = symbol.charCodeAt(0) * 100 + i;
    const drift = (seededRandom(seed) - 0.48) * 0.03;
    price = Math.max(price * (1 + drift), 0.1);

    const open = price;
    const high = price * (1 + seededRandom(seed + 1) * 0.02);
    const low = price * (1 - seededRandom(seed + 2) * 0.02);
    const close = low + seededRandom(seed + 3) * (high - low);
    const volume = Math.round(100000 + seededRandom(seed + 4) * 5000000);

    history.push({
      date: date.toISOString().split("T")[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });

    price = close;
  }
  return history;
}

function makeStock(
  symbol: string,
  name: string,
  sector: string,
  price: number,
  change: number,
  volume: number,
  marketCap: number,
  high52w: number,
  low52w: number,
  peRatio: number | null,
  dividendYield: number | null
): NSEStock {
  return {
    symbol,
    name,
    sector,
    price,
    change,
    changePercent: +((change / (price - change)) * 100).toFixed(2),
    volume,
    marketCap,
    high52w,
    low52w,
    peRatio,
    dividendYield,
    history: generatePriceHistory(price, 90, symbol),
  };
}

export const NSE_STOCKS: NSEStock[] = [
  makeStock("SCOM", "Safaricom PLC", "Telecommunications", 29.85, 0.35, 12450000, 1192, 34.50, 22.00, 12.4, 8.2),
  makeStock("EQTY", "Equity Group Holdings", "Banking", 41.50, -0.25, 3820000, 156, 47.00, 35.50, 6.8, 5.5),
  makeStock("KCB", "KCB Group PLC", "Banking", 38.20, 0.75, 2640000, 122, 44.00, 30.00, 5.2, 6.1),
  makeStock("EABL", "East African Breweries Ltd", "Beverages", 155.00, -2.50, 480000, 123, 178.00, 120.00, 18.7, 4.3),
  makeStock("COOP", "Co-operative Bank of Kenya", "Banking", 12.35, 0.15, 5230000, 72, 15.90, 10.50, 5.9, 7.8),
  makeStock("SCBK", "Standard Chartered Bank Kenya", "Banking", 148.00, -1.00, 120000, 59, 162.00, 118.00, 11.3, 9.2),
  makeStock("ABSA", "ABSA Bank Kenya PLC", "Banking", 13.25, 0.20, 4180000, 72, 16.00, 10.80, 7.1, 6.4),
  makeStock("IMH", "I&M Group PLC", "Banking", 21.85, -0.15, 870000, 34, 26.00, 18.00, 6.3, 5.7),
  makeStock("DTK", "Diamond Trust Bank Kenya", "Banking", 53.50, 0.50, 210000, 16, 62.00, 42.00, 8.4, 4.9),
  makeStock("SBIC", "Stanbic Holdings PLC", "Banking", 104.00, -0.75, 98000, 41, 115.00, 85.00, 9.6, 5.3),
  makeStock("TOTL", "TotalEnergies Marketing Kenya", "Energy", 20.50, 0.25, 180000, 4, 24.00, 16.50, 10.1, 7.5),
  makeStock("KEGN", "KenGen PLC", "Energy", 4.35, -0.05, 2840000, 18, 5.50, 3.40, 22.1, 2.1),
  makeStock("KPLC", "Kenya Power & Lighting Co.", "Energy", 1.82, 0.03, 7650000, 3, 2.90, 1.40, null, null),
  makeStock("NMG", "Nation Media Group", "Media", 23.75, -0.25, 95000, 9, 30.00, 18.00, 15.3, 8.9),
  makeStock("KQ", "Kenya Airways PLC", "Aviation", 4.15, 0.10, 5120000, 6, 6.50, 3.20, null, null),
  makeStock("BOC", "BOC Kenya PLC", "Manufacturing", 87.50, 0.00, 8500, 3, 100.00, 74.00, 19.8, 3.1),
  makeStock("SASN", "Sasini PLC", "Agriculture", 18.40, 0.40, 145000, 3, 24.00, 14.50, 8.7, 5.2),
  makeStock("HFCK", "HF Group PLC", "Financial Services", 4.78, 0.08, 1240000, 3, 6.20, 3.80, null, null),
];

export const MARKET_INDICES: MarketIndex[] = [
  { name: "NSE 20 Share Index", value: 1742.85, change: 12.40, changePercent: 0.72 },
  { name: "NSE All Share (NASI)", value: 118.34, change: -0.68, changePercent: -0.57 },
  { name: "NSE 25 Share Index", value: 3821.50, change: 28.75, changePercent: 0.76 },
  { name: "NSE 10 Share Index", value: 1089.20, change: -5.30, changePercent: -0.48 },
];

export const SECTORS = [
  "All",
  "Banking",
  "Telecommunications",
  "Energy",
  "Beverages",
  "Agriculture",
  "Media",
  "Aviation",
  "Manufacturing",
  "Financial Services",
];

export function getTopGainers(n = 5): NSEStock[] {
  return [...NSE_STOCKS].sort((a, b) => b.changePercent - a.changePercent).slice(0, n);
}

export function getTopLosers(n = 5): NSEStock[] {
  return [...NSE_STOCKS].sort((a, b) => a.changePercent - b.changePercent).slice(0, n);
}

export function getMostActive(n = 5): NSEStock[] {
  return [...NSE_STOCKS].sort((a, b) => b.volume - a.volume).slice(0, n);
}

export function formatKES(value: number): string {
  if (value >= 1e9) return `KES ${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `KES ${(value / 1e6).toFixed(2)}M`;
  return `KES ${value.toLocaleString()}`;
}

export function formatVolume(volume: number): string {
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
  return volume.toString();
}
