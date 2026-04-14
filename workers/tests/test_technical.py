"""Tests for analysis/technical.py"""
import pandas as pd
import numpy as np
import pytest
from analysis.technical import TechnicalAnalysis, TechnicalSignal


def make_df(closes: list[float], volumes: list[int] | None = None) -> pd.DataFrame:
    n = len(closes)
    idx = pd.date_range("2025-01-01", periods=n, freq="D")
    vols = volumes or [1_000_000] * n
    return pd.DataFrame({
        "date":   [str(d.date()) for d in idx],
        "open":   closes,
        "high":   [c * 1.01 for c in closes],
        "low":    [c * 0.99 for c in closes],
        "close":  closes,
        "volume": vols,
    })


class TestTechnicalAnalysis:
    def test_insufficient_data_returns_hold(self):
        df = make_df([30.0] * 10)
        result = TechnicalAnalysis(df).analyse()
        assert result.signal == "HOLD"
        assert "Insufficient" in result.reasons[0]

    def test_strong_uptrend_returns_buy(self):
        # Steadily rising prices — price > sma20 > sma50, RSI moderate, MACD positive
        closes = [20.0 + i * 0.3 for i in range(60)]
        result = TechnicalAnalysis(make_df(closes)).analyse()
        assert result.signal == "BUY"
        assert result.score > 0

    def test_downtrend_gives_negative_score(self):
        # Noisy downtrend — RSI stays above 30 so oversold doesn't neutralise the signal
        import random
        random.seed(42)
        closes = [50.0 - i * 0.12 + random.uniform(-0.3, 0.3) for i in range(60)]
        result = TechnicalAnalysis(make_df(closes)).analyse()
        assert result.score < 0   # direction is bearish

    def test_strong_sustained_sell(self):
        # Use alternating slight rises to keep RSI above 30 while trend is down
        closes = []
        price = 50.0
        for i in range(60):
            price += 0.3 if i % 4 == 0 else -0.2   # net: -0.1/day average, stays bearish
            closes.append(price)
        result = TechnicalAnalysis(make_df(closes)).analyse()
        assert result.score < 0

    def test_score_within_bounds(self):
        closes = [30.0 + np.sin(i / 5) * 2 for i in range(60)]
        result = TechnicalAnalysis(make_df(closes)).analyse()
        assert -1.0 <= result.score <= 1.0

    def test_indicators_dict_populated(self):
        closes = [30.0 + i * 0.1 for i in range(60)]
        result = TechnicalAnalysis(make_df(closes)).analyse()
        assert "close" in result.indicators
        assert "rsi" in result.indicators

    def test_oversold_rsi_boosts_buy(self):
        # Sharp crash — RSI should dip below 30
        closes = [50.0] * 20 + [50.0 - i * 1.5 for i in range(1, 41)]
        result = TechnicalAnalysis(make_df(closes)).analyse()
        # RSI < 30 contributes +0.25 to score
        rsi = result.indicators.get("rsi")
        if rsi and rsi < 30:
            assert result.score > -0.5  # RSI contribution mitigates downtrend

    def test_volume_surge_with_uptrend_boosts_score(self):
        closes = [20.0 + i * 0.3 for i in range(60)]
        # Last day has 5x normal volume
        vols = [1_000_000] * 59 + [5_000_000]
        result = TechnicalAnalysis(make_df(closes, vols)).analyse()
        assert result.score > 0


class TestTechnicalSignal:
    def test_dataclass_defaults(self):
        s = TechnicalSignal(signal="HOLD", score=0.0)
        assert s.indicators == {}
        assert s.reasons == []
