"""
Technical analysis engine — pure pandas, no external TA library.

Computes SMA, EMA, RSI, MACD, Bollinger Bands, volume ratio and
combines them into a single scored signal.
"""
from dataclasses import dataclass, field
from typing import Literal

import pandas as pd


@dataclass
class TechnicalSignal:
    signal: Literal["BUY", "HOLD", "SELL"]
    score: float                     # -1.0 (strong sell) → +1.0 (strong buy)
    indicators: dict = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)


class TechnicalAnalysis:
    """Compute technical indicators from a DataFrame of daily OHLCV rows."""

    MIN_ROWS = 20  # need at least 20 days for SMA-20

    def __init__(self, df: pd.DataFrame):
        """
        df must have columns: date, open, high, low, close, volume
        and be sorted oldest → newest.
        """
        self.df = df.copy().reset_index(drop=True)
        self._compute()

    # ── private helpers ──────────────────────────────────────────────────

    def _compute(self):
        df = self.df
        df["sma_20"] = df["close"].rolling(20).mean()
        df["sma_50"] = df["close"].rolling(50).mean()
        df["ema_20"] = df["close"].ewm(span=20, adjust=False).mean()

        # RSI-14
        delta = df["close"].diff()
        gain  = delta.clip(lower=0).rolling(14).mean()
        loss  = (-delta.clip(upper=0)).rolling(14).mean()
        rs    = gain / loss.replace(0, float("nan"))
        df["rsi"] = 100 - (100 / (1 + rs))

        # MACD (12, 26, 9)
        ema12 = df["close"].ewm(span=12, adjust=False).mean()
        ema26 = df["close"].ewm(span=26, adjust=False).mean()
        df["macd"]        = ema12 - ema26
        df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
        df["macd_hist"]   = df["macd"] - df["macd_signal"]

        # Bollinger Bands (20, 2σ)
        roll = df["close"].rolling(20)
        df["bb_mid"]   = roll.mean()
        df["bb_upper"] = df["bb_mid"] + 2 * roll.std()
        df["bb_lower"] = df["bb_mid"] - 2 * roll.std()

        # Volume ratio: current vs 20-day average
        df["vol_avg_20"]  = df["volume"].rolling(20).mean()
        df["vol_ratio"]   = df["volume"] / df["vol_avg_20"].replace(0, float("nan"))

        self.df = df

    # ── public API ───────────────────────────────────────────────────────

    def analyse(self) -> TechnicalSignal:
        if len(self.df) < self.MIN_ROWS:
            return TechnicalSignal(signal="HOLD", score=0.0,
                                   reasons=["Insufficient data for technical analysis"])

        last = self.df.iloc[-1]
        score = 0.0
        reasons: list[str] = []
        indicators: dict = {}

        close   = last["close"]
        sma20   = last["sma_20"]
        sma50   = last["sma_50"]
        ema20   = last["ema_20"]
        rsi     = last["rsi"]
        macd_h  = last["macd_hist"]
        bb_u    = last["bb_upper"]
        bb_l    = last["bb_lower"]
        vol_r   = last["vol_ratio"]

        indicators = {
            "close": round(close, 2),
            "sma_20": round(sma20, 2) if pd.notna(sma20) else None,
            "sma_50": round(sma50, 2) if pd.notna(sma50) else None,
            "rsi": round(rsi, 1) if pd.notna(rsi) else None,
            "macd_hist": round(macd_h, 4) if pd.notna(macd_h) else None,
            "bb_upper": round(bb_u, 2) if pd.notna(bb_u) else None,
            "bb_lower": round(bb_l, 2) if pd.notna(bb_l) else None,
            "vol_ratio": round(vol_r, 2) if pd.notna(vol_r) else None,
        }

        # ── SMA trend ────────────────────────────────────────────────────
        if pd.notna(sma20) and pd.notna(sma50):
            if close > sma20 > sma50:
                score += 0.3
                reasons.append("Price above SMA20 and SMA50 — uptrend")
            elif close < sma20 < sma50:
                score -= 0.3
                reasons.append("Price below SMA20 and SMA50 — downtrend")

        # ── RSI ──────────────────────────────────────────────────────────
        if pd.notna(rsi):
            if rsi < 30:
                score += 0.25
                reasons.append(f"RSI {rsi:.0f} — oversold, potential reversal")
            elif rsi > 70:
                score -= 0.25
                reasons.append(f"RSI {rsi:.0f} — overbought, potential pullback")
            elif 40 <= rsi <= 60:
                reasons.append(f"RSI {rsi:.0f} — neutral momentum")

        # ── MACD histogram ───────────────────────────────────────────────
        if pd.notna(macd_h):
            if macd_h > 0:
                score += 0.2
                reasons.append("MACD histogram positive — bullish momentum")
            else:
                score -= 0.2
                reasons.append("MACD histogram negative — bearish momentum")

        # ── Bollinger Bands ──────────────────────────────────────────────
        if pd.notna(bb_l) and pd.notna(bb_u):
            if close < bb_l:
                score += 0.15
                reasons.append("Price below lower Bollinger Band — oversold")
            elif close > bb_u:
                score -= 0.15
                reasons.append("Price above upper Bollinger Band — overbought")

        # ── Volume confirmation ──────────────────────────────────────────
        if pd.notna(vol_r) and vol_r > 1.5 and score > 0:
            score += 0.1
            reasons.append(f"Volume {vol_r:.1f}x average — confirms upward move")
        elif pd.notna(vol_r) and vol_r > 1.5 and score < 0:
            score -= 0.1
            reasons.append(f"Volume {vol_r:.1f}x average — confirms downward move")

        score = max(-1.0, min(1.0, score))

        if score >= 0.35:
            signal = "BUY"
        elif score <= -0.35:
            signal = "SELL"
        else:
            signal = "HOLD"

        return TechnicalSignal(signal=signal, score=round(score, 3),
                               indicators=indicators, reasons=reasons)

    @property
    def summary_dict(self) -> dict:
        last = self.df.iloc[-1]
        return {
            "close":    round(last["close"], 2),
            "sma_20":   round(last["sma_20"], 2) if pd.notna(last["sma_20"]) else None,
            "sma_50":   round(last["sma_50"], 2) if pd.notna(last["sma_50"]) else None,
            "rsi":      round(last["rsi"], 1)    if pd.notna(last["rsi"])    else None,
            "macd_h":   round(last["macd_hist"], 4) if pd.notna(last["macd_hist"]) else None,
        }
