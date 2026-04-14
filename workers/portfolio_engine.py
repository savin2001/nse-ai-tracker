"""
NSE Portfolio Engine
Reads latest AI signals and a user's portfolio allocations,
then generates rebalancing recommendations.

This is a server-side utility called by the API — not a cron worker.
"""
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class Recommendation:
    ticker: str
    current_weight: float
    target_weight: float
    action: Literal["INCREASE", "DECREASE", "HOLD", "EXIT", "ENTER"]
    signal: str
    confidence: int
    rationale: str


@dataclass
class RebalanceReport:
    user_id: str
    recommendations: list[Recommendation] = field(default_factory=list)
    total_drift: float = 0.0   # sum of |current - target| weights

    def summary(self) -> dict:
        return {
            "user_id": self.user_id,
            "total_drift": round(self.total_drift, 4),
            "actions": {
                r.action: [rec.ticker for rec in self.recommendations if rec.action == r.action]
                for r in self.recommendations
            },
            "recommendations": [
                {
                    "ticker": r.ticker,
                    "current_weight": r.current_weight,
                    "target_weight": r.target_weight,
                    "action": r.action,
                    "signal": r.signal,
                    "confidence": r.confidence,
                    "rationale": r.rationale,
                }
                for r in self.recommendations
            ],
        }


def _decide_action(
    signal: str,
    confidence: int,
    current_weight: float,
) -> tuple[Literal["INCREASE", "DECREASE", "HOLD", "EXIT", "ENTER"], float, str]:
    """
    Map an AI signal + confidence to a portfolio action and suggested weight.
    Returns (action, suggested_weight, rationale).
    """
    high_conf = confidence >= 70

    if signal == "BUY" and high_conf:
        if current_weight == 0:
            return "ENTER", 0.05, f"Strong BUY signal ({confidence}% confidence) — initiate position"
        return "INCREASE", min(current_weight * 1.5, 0.15), f"Strong BUY signal ({confidence}% confidence) — add to position"

    if signal == "BUY" and not high_conf:
        return "HOLD", current_weight, f"Moderate BUY signal ({confidence}% confidence) — hold existing position"

    if signal == "SELL" and high_conf:
        if current_weight > 0:
            return "EXIT", 0.0, f"Strong SELL signal ({confidence}% confidence) — exit position"
        return "HOLD", 0.0, f"Strong SELL signal ({confidence}% confidence) — no position to exit"

    if signal == "SELL" and not high_conf:
        return "DECREASE", max(current_weight * 0.5, 0.0), f"Moderate SELL signal ({confidence}% confidence) — trim position"

    # HOLD
    return "HOLD", current_weight, f"HOLD signal ({confidence}% confidence) — maintain allocation"


def generate_report(
    user_id: str,
    allocations: list[dict],
    signals: list[dict],
) -> RebalanceReport:
    """
    allocations: rows from nse.portfolio_allocations [{ticker, weight}, ...]
    signals:     rows from nse.latest_signals        [{ticker, signal, confidence}, ...]
    """
    alloc_map  = {a["ticker"]: float(a["weight"]) for a in allocations}
    signal_map = {s["ticker"]: s for s in signals}

    report = RebalanceReport(user_id=user_id)

    # Tickers with existing allocation
    for ticker, current_weight in alloc_map.items():
        sig_row = signal_map.get(ticker)
        if not sig_row:
            report.recommendations.append(Recommendation(
                ticker=ticker,
                current_weight=current_weight,
                target_weight=current_weight,
                action="HOLD",
                signal="N/A",
                confidence=0,
                rationale="No recent signal available",
            ))
            continue

        action, target, rationale = _decide_action(
            sig_row["signal"], sig_row["confidence"], current_weight
        )
        report.recommendations.append(Recommendation(
            ticker=ticker,
            current_weight=current_weight,
            target_weight=round(target, 4),
            action=action,
            signal=sig_row["signal"],
            confidence=sig_row["confidence"],
            rationale=rationale,
        ))
        report.total_drift += abs(current_weight - target)

    # BUY signals for tickers not yet in portfolio
    for ticker, sig_row in signal_map.items():
        if ticker not in alloc_map and sig_row.get("signal") == "BUY" and sig_row.get("confidence", 0) >= 70:
            report.recommendations.append(Recommendation(
                ticker=ticker,
                current_weight=0.0,
                target_weight=0.05,
                action="ENTER",
                signal="BUY",
                confidence=sig_row["confidence"],
                rationale=f"Strong BUY signal ({sig_row['confidence']}% confidence) — not yet in portfolio",
            ))

    report.total_drift = round(report.total_drift, 4)
    return report
