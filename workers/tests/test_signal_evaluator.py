"""Tests for signal_evaluator.py"""
import sys
from unittest.mock import MagicMock

for mod in ("supabase", "structlog"):
    sys.modules.setdefault(mod, MagicMock())

import pytest
from signal_evaluator import determine_outcome


class TestDetermineOutcome:
    # BUY signal
    def test_buy_price_rose_is_correct(self):
        assert determine_outcome("BUY", 5.0) == "correct"

    def test_buy_price_fell_is_incorrect(self):
        assert determine_outcome("BUY", -3.0) == "incorrect"

    def test_buy_flat_is_partial(self):
        assert determine_outcome("BUY", 0.5) == "partial"

    # SELL signal
    def test_sell_price_fell_is_correct(self):
        assert determine_outcome("SELL", -4.0) == "correct"

    def test_sell_price_rose_is_incorrect(self):
        assert determine_outcome("SELL", 3.0) == "incorrect"

    def test_sell_flat_is_partial(self):
        assert determine_outcome("SELL", -0.5) == "partial"

    # HOLD signal
    def test_hold_within_3pct_is_correct(self):
        assert determine_outcome("HOLD", 2.0) == "correct"
        assert determine_outcome("HOLD", -2.5) == "correct"

    def test_hold_large_move_is_incorrect(self):
        assert determine_outcome("HOLD", 4.0) == "incorrect"
        assert determine_outcome("HOLD", -5.0) == "incorrect"

    # Edge cases
    def test_buy_exactly_at_threshold(self):
        assert determine_outcome("BUY", 1.0) == "partial"   # not > 1.0
        assert determine_outcome("BUY", 1.01) == "correct"

    def test_sell_exactly_at_threshold(self):
        assert determine_outcome("SELL", -1.0) == "partial"
        assert determine_outcome("SELL", -1.01) == "correct"
