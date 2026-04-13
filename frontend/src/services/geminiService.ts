import { GoogleGenAI } from "@google/genai";
import type { NSEStock } from "../data/nseData";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface StockAnalysis {
  signal: "BUY" | "HOLD" | "SELL";
  confidence: number; // 0–100
  summary: string;
  keyFactors: string[];
  risks: string[];
  targetPrice: number;
  timeHorizon: string;
}

export interface MarketSentiment {
  overall: "BULLISH" | "NEUTRAL" | "BEARISH";
  score: number; // -100 to +100
  summary: string;
  sectorOutlooks: { sector: string; outlook: string }[];
}

function buildStockPrompt(stock: NSEStock): string {
  const recentHistory = stock.history.slice(-10);
  const priceChange30d =
    recentHistory.length > 0
      ? (
          ((stock.price - recentHistory[0].close) / recentHistory[0].close) *
          100
        ).toFixed(2)
      : "N/A";

  return `You are a financial analyst specialising in Nairobi Securities Exchange (NSE) stocks. Analyse the following stock and provide a structured investment signal.

STOCK: ${stock.name} (${stock.symbol})
Sector: ${stock.sector}
Current Price: KES ${stock.price}
Today's Change: ${stock.change >= 0 ? "+" : ""}${stock.change} (${stock.changePercent}%)
30-day Price Change: ${priceChange30d}%
52-Week High: KES ${stock.high52w}
52-Week Low: KES ${stock.low52w}
Volume Today: ${stock.volume.toLocaleString()}
Market Cap: KES ${stock.marketCap}B
P/E Ratio: ${stock.peRatio ?? "N/A"}
Dividend Yield: ${stock.dividendYield ? stock.dividendYield + "%" : "N/A"}

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "signal": "BUY" | "HOLD" | "SELL",
  "confidence": <integer 0-100>,
  "summary": "<2-3 sentence analysis>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "targetPrice": <number>,
  "timeHorizon": "<e.g. 3-6 months>"
}`;
}

function buildMarketPrompt(
  indices: { name: string; value: number; changePercent: number }[],
  topGainers: { symbol: string; changePercent: number }[],
  topLosers: { symbol: string; changePercent: number }[]
): string {
  return `You are a senior NSE market analyst. Provide a brief market sentiment assessment based on the following data.

INDICES:
${indices.map((i) => `- ${i.name}: ${i.value} (${i.changePercent >= 0 ? "+" : ""}${i.changePercent}%)`).join("\n")}

TOP GAINERS: ${topGainers.map((s) => `${s.symbol} +${s.changePercent}%`).join(", ")}
TOP LOSERS: ${topLosers.map((s) => `${s.symbol} ${s.changePercent}%`).join(", ")}

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "overall": "BULLISH" | "NEUTRAL" | "BEARISH",
  "score": <integer -100 to 100>,
  "summary": "<2-3 sentence market overview>",
  "sectorOutlooks": [
    { "sector": "<sector name>", "outlook": "<one sentence>" }
  ]
}`;
}

export async function analyseStock(stock: NSEStock): Promise<StockAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: buildStockPrompt(stock),
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Gemini response");

  return JSON.parse(jsonMatch[0]) as StockAnalysis;
}

export async function getMarketSentiment(
  indices: { name: string; value: number; changePercent: number }[],
  topGainers: { symbol: string; changePercent: number }[],
  topLosers: { symbol: string; changePercent: number }[]
): Promise<MarketSentiment> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: buildMarketPrompt(indices, topGainers, topLosers),
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Gemini response");

  return JSON.parse(jsonMatch[0]) as MarketSentiment;
}
