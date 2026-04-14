"""
Anthropic client factory + cost-tracked call helper.

Model selection policy
──────────────────────
  claude-haiku-4-5-20251001   Fast, cheap  — event classification, simple scoring
  claude-sonnet-4-6           Balanced     — signal generation, market analysis
  claude-opus-4-6             Powerful     — reserved for future complex reasoning

Prompt caching
──────────────
Use `cache_control: {"type": "ephemeral"}` on the last static block of any
large system prompt. Anthropic charges 25 % of input price for cache reads
(vs 100 % for fresh tokens), so caching the 600-token signal system prompt
saves ~75 % on the dominant cost centre.

Pricing (USD per million tokens, 2025 list prices — update as Anthropic revises)
──────────────────────────────────────────────────────────────────────────────────
Model                         Input   Cache-write  Cache-read  Output
claude-haiku-4-5-20251001     0.80        1.00        0.08      4.00
claude-sonnet-4-6             3.00        3.75        0.30     15.00
claude-opus-4-6              15.00       18.75        1.50     75.00
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import anthropic

# ── Public model constants ────────────────────────────────────────────────────

HAIKU  = "claude-haiku-4-5-20251001"   # fast + cheap  → classification tasks
SONNET = "claude-sonnet-4-6"           # balanced      → signal generation
OPUS   = "claude-opus-4-6"             # most capable  → future complex reasoning

# ── Pricing table (USD per token) ─────────────────────────────────────────────

_PRICE: dict[str, dict[str, float]] = {
    HAIKU: {
        "input":        0.80  / 1_000_000,
        "cache_write":  1.00  / 1_000_000,
        "cache_read":   0.08  / 1_000_000,
        "output":       4.00  / 1_000_000,
    },
    SONNET: {
        "input":        3.00  / 1_000_000,
        "cache_write":  3.75  / 1_000_000,
        "cache_read":   0.30  / 1_000_000,
        "output":      15.00  / 1_000_000,
    },
    OPUS: {
        "input":       15.00  / 1_000_000,
        "cache_write": 18.75  / 1_000_000,
        "cache_read":   1.50  / 1_000_000,
        "output":      75.00  / 1_000_000,
    },
}


@dataclass
class UsageRecord:
    model:              str
    input_tokens:       int
    output_tokens:      int
    cache_read_tokens:  int
    cache_write_tokens: int
    cost_usd:           float


def calculate_cost(model: str, usage: Any) -> UsageRecord:
    """Compute USD cost from an Anthropic Message usage object."""
    p = _PRICE.get(model, _PRICE[SONNET])   # default to Sonnet pricing if unknown

    inp   = getattr(usage, "input_tokens",                  0)
    out   = getattr(usage, "output_tokens",                 0)
    cr    = getattr(usage, "cache_read_input_tokens",       0)
    cw    = getattr(usage, "cache_creation_input_tokens",   0)

    # Cache reads replace input tokens — adjust accordingly
    billable_input = max(inp - cr, 0)
    cost = (
        billable_input * p["input"]
        + cw           * p["cache_write"]
        + cr           * p["cache_read"]
        + out          * p["output"]
    )
    return UsageRecord(
        model=model,
        input_tokens=inp,
        output_tokens=out,
        cache_read_tokens=cr,
        cache_write_tokens=cw,
        cost_usd=round(cost, 8),
    )


def get_ai() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError("Missing required env var: ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=key)


def log_usage(
    db_schema: Any,
    record: UsageRecord,
    *,
    worker: str,
    task: str,
    ticker: str | None = None,
    succeeded: bool = True,
    error_message: str | None = None,
) -> None:
    """Persist a UsageRecord to nse.model_usage (best-effort, never raises)."""
    try:
        db_schema.table("model_usage").insert({
            "worker":              worker,
            "task":                task,
            "model":               record.model,
            "ticker":              ticker,
            "input_tokens":        record.input_tokens,
            "output_tokens":       record.output_tokens,
            "cache_read_tokens":   record.cache_read_tokens,
            "cache_write_tokens":  record.cache_write_tokens,
            "cost_usd":            str(record.cost_usd),
            "succeeded":           succeeded,
            "error_message":       error_message,
        }).execute()
    except Exception:
        pass  # usage logging must never block the main worker
