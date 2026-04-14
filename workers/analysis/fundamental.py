"""
Fundamental analysis engine.

Scores a company's financial health from income statement and
balance sheet data stored in nse.financials.
"""
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class FundamentalScore:
    signal: Literal["BUY", "HOLD", "SELL"]
    score: float          # -1.0 → +1.0
    metrics: dict = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)


class FundamentalAnalysis:
    """
    Evaluate fundamentals from a list of financial statement dicts
    (as returned from nse.financials, sorted newest → oldest).
    """

    # Rough sector-agnostic thresholds for NSE
    PE_BUY_MAX   = 15.0
    PE_SELL_MIN  = 30.0
    DE_SELL_MIN  = 2.0      # debt-to-equity above this → bearish
    MARGIN_BUY   = 0.10     # net income / revenue > 10% → positive
    GROWTH_BUY   = 0.05     # 5% YoY revenue growth → positive

    def __init__(self, statements: list[dict], current_price: float | None = None):
        self.stmts = statements
        self.price = current_price

    def analyse(self) -> FundamentalScore:
        annual = [s for s in self.stmts if s.get("period_type") == "annual"]

        if not annual:
            return FundamentalScore(signal="HOLD", score=0.0,
                                    reasons=["No annual statements available"])

        latest = annual[0]
        score = 0.0
        reasons: list[str] = []
        metrics: dict = {}

        # ── P/E ratio ────────────────────────────────────────────────────
        eps = latest.get("eps")
        if eps and self.price and eps > 0:
            pe = round(self.price / eps, 2)
            metrics["pe_ratio"] = pe
            if pe < self.PE_BUY_MAX:
                score += 0.3
                reasons.append(f"P/E {pe:.1f} — attractively valued")
            elif pe > self.PE_SELL_MIN:
                score -= 0.3
                reasons.append(f"P/E {pe:.1f} — stretched valuation")
            else:
                reasons.append(f"P/E {pe:.1f} — fair value")

        # ── Net income margin ─────────────────────────────────────────────
        revenue    = latest.get("revenue")
        net_income = latest.get("net_income")
        if revenue and net_income and revenue > 0:
            margin = net_income / revenue
            metrics["net_margin"] = round(margin, 4)
            if margin >= self.MARGIN_BUY:
                score += 0.25
                reasons.append(f"Net margin {margin*100:.1f}% — healthy profitability")
            elif margin < 0:
                score -= 0.3
                reasons.append(f"Net margin {margin*100:.1f}% — company is loss-making")

        # ── Revenue growth (YoY) ─────────────────────────────────────────
        if len(annual) >= 2:
            prev_rev = annual[1].get("revenue")
            if revenue and prev_rev and prev_rev > 0:
                growth = (revenue - prev_rev) / prev_rev
                metrics["revenue_growth_yoy"] = round(growth, 4)
                if growth >= self.GROWTH_BUY:
                    score += 0.2
                    reasons.append(f"Revenue grew {growth*100:.1f}% YoY")
                elif growth < 0:
                    score -= 0.2
                    reasons.append(f"Revenue declined {abs(growth)*100:.1f}% YoY")

        # ── Debt-to-equity ────────────────────────────────────────────────
        de = latest.get("debt_to_equity")
        if de is not None:
            metrics["debt_to_equity"] = de
            if de > self.DE_SELL_MIN:
                score -= 0.25
                reasons.append(f"Debt/equity {de:.2f} — high leverage")
            elif 0 <= de <= 1.0:
                score += 0.1
                reasons.append(f"Debt/equity {de:.2f} — conservative balance sheet")

        # ── EPS trend ─────────────────────────────────────────────────────
        if len(annual) >= 2:
            prev_eps = annual[1].get("eps")
            if eps and prev_eps and prev_eps > 0:
                eps_growth = (eps - prev_eps) / abs(prev_eps)
                metrics["eps_growth_yoy"] = round(eps_growth, 4)
                if eps_growth > 0.1:
                    score += 0.15
                    reasons.append(f"EPS grew {eps_growth*100:.1f}% YoY")
                elif eps_growth < -0.1:
                    score -= 0.15
                    reasons.append(f"EPS fell {abs(eps_growth)*100:.1f}% YoY")

        score = max(-1.0, min(1.0, score))

        if score >= 0.3:
            signal = "BUY"
        elif score <= -0.3:
            signal = "SELL"
        else:
            signal = "HOLD"

        return FundamentalScore(signal=signal, score=round(score, 3),
                                metrics=metrics, reasons=reasons)
