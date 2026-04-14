"""
Circuit Breaker for Anthropic API calls
────────────────────────────────────────
Prevents runaway spend and cascading failures when Claude is unavailable.

States
------
CLOSED   (normal)  — requests flow through
OPEN     (tripped) — requests fail immediately for `recovery_seconds`
HALF_OPEN          — one probe request allowed; if it succeeds → CLOSED,
                     if it fails → OPEN again

Usage
-----
    cb = CircuitBreaker(name="claude-sonnet", failure_threshold=3,
                        recovery_seconds=120, cost_cap_usd=5.0)

    @cb.call
    def make_claude_request():
        return ai.messages.create(...)

Or imperatively:
    with cb:
        msg = ai.messages.create(...)
"""
from __future__ import annotations

import time
import threading
import functools
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Callable, TypeVar

import structlog

log = structlog.get_logger()

T = TypeVar("T")


class State(Enum):
    CLOSED    = auto()
    OPEN      = auto()
    HALF_OPEN = auto()


@dataclass
class CircuitBreaker:
    name:               str
    failure_threshold:  int   = 3        # consecutive failures → OPEN
    recovery_seconds:   float = 120.0    # seconds in OPEN before HALF_OPEN probe
    cost_cap_usd:       float = 5.0      # cumulative spend cap; 0 = disabled

    # Runtime state (not constructor args)
    _state:           State = field(default=State.CLOSED, init=False, repr=False)
    _failure_count:   int   = field(default=0,            init=False, repr=False)
    _last_failure_at: float = field(default=0.0,          init=False, repr=False)
    _cumulative_cost: float = field(default=0.0,          init=False, repr=False)
    _lock:            threading.Lock = field(
        default_factory=threading.Lock, init=False, repr=False
    )

    # ── Public properties ──────────────────────────────────────────────────────

    @property
    def state(self) -> State:
        with self._lock:
            return self._effective_state()

    def _effective_state(self) -> State:
        """Transition OPEN → HALF_OPEN when recovery window has elapsed."""
        if self._state is State.OPEN:
            if time.monotonic() - self._last_failure_at >= self.recovery_seconds:
                self._state = State.HALF_OPEN
                log.info("circuit_half_open", breaker=self.name)
        return self._state

    # ── Context manager ────────────────────────────────────────────────────────

    def __enter__(self) -> "CircuitBreaker":
        with self._lock:
            state = self._effective_state()
            if state is State.OPEN:
                raise CircuitOpenError(
                    f"Circuit '{self.name}' is OPEN — "
                    f"backing off for {self.recovery_seconds}s"
                )
        return self

    def __exit__(self, exc_type, exc_val, _tb):
        if exc_type is None:
            self._on_success()
        else:
            self._on_failure(str(exc_val))
        return False  # don't suppress the exception

    # ── Decorator ─────────────────────────────────────────────────────────────

    def call(self, fn: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            with self:
                return fn(*args, **kwargs)
        return wrapper

    # ── Outcome handlers ───────────────────────────────────────────────────────

    def _on_success(self) -> None:
        with self._lock:
            if self._state is not State.CLOSED:
                log.info("circuit_closed", breaker=self.name)
            self._state         = State.CLOSED
            self._failure_count = 0

    def _on_failure(self, reason: str) -> None:
        with self._lock:
            self._failure_count  += 1
            self._last_failure_at = time.monotonic()
            log.warning("circuit_failure", breaker=self.name,
                        failures=self._failure_count, reason=reason[:200])
            if self._failure_count >= self.failure_threshold:
                self._state = State.OPEN
                log.error("circuit_opened", breaker=self.name,
                          recovery_seconds=self.recovery_seconds)

    # ── Cost tracking ──────────────────────────────────────────────────────────

    def record_cost(self, cost_usd: float) -> None:
        """Call after each successful AI call to accumulate spend."""
        with self._lock:
            self._cumulative_cost += cost_usd
            if self.cost_cap_usd > 0 and self._cumulative_cost >= self.cost_cap_usd:
                self._state         = State.OPEN
                self._last_failure_at = time.monotonic()
                log.error("circuit_cost_cap_reached", breaker=self.name,
                          cumulative_usd=round(self._cumulative_cost, 4),
                          cap_usd=self.cost_cap_usd)

    def reset_cost(self) -> None:
        """Call at the start of each worker run to reset the per-run cost counter."""
        with self._lock:
            self._cumulative_cost = 0.0
            if self._state is State.OPEN:
                # Re-open guard: only reset state if failure-triggered, not cost-triggered
                pass


class CircuitOpenError(Exception):
    """Raised when a call is attempted while the circuit is OPEN."""


# ── Module-level singleton breakers (one per model tier) ─────────────────────

# Daily cost cap: Sonnet at ~$0.015/signal × 20 stocks = $0.30/day typical;
# cap at $5 to allow some headroom but block runaway loops.
sonnet_breaker = CircuitBreaker(
    name="claude-sonnet",
    failure_threshold=3,
    recovery_seconds=120,
    cost_cap_usd=5.0,
)

haiku_breaker = CircuitBreaker(
    name="claude-haiku",
    failure_threshold=5,   # more tolerant — haiku calls are cheap
    recovery_seconds=60,
    cost_cap_usd=1.0,
)
