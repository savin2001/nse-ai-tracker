# NSE AI Research Platform
## Master Technical Architecture & Engineering Specification

**Nairobi Securities Exchange | AI-Powered Financial Research Platform**

| Field | Value |
|---|---|
| Version | 2.0 — Full Engineering Specification |
| Target Exchange | Nairobi Securities Exchange (NSE) |
| Stack | Next.js 14 · Node.js 20 · Python 3.11 · PostgreSQL 15 (Supabase) |
| Hosting | Vercel + Supabase + Railway |
| Domains Covered | Systems Architecture · Visual System · Conversion Copy · Interaction Engineering · QA & Testing · Security |
| Date | March 2026 |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Data Collection Layer](#3-data-collection-layer)
4. [Event Detection Engine](#4-event-detection-engine)
5. [AI Analysis Layer](#5-ai-analysis-layer)
6. [Portfolio Strategy Engine](#6-portfolio-strategy-engine)
7. [Database Schema](#7-database-schema)
8. [Backend API Layer](#8-backend-api-layer)
9. [Frontend Dashboard](#9-frontend-dashboard)
10. [Notification System](#10-notification-system)
11. [Automation Pipeline](#11-automation-pipeline)
12. [Evaluation & Backtesting](#12-evaluation--backtesting)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [Cost Summary](#14-cost-summary)
15. [Appendices](#15-appendices)
16. [**Systems Architecture — Deep Specification**](#16-systems-architecture--deep-specification)
17. [**Visual System Architecture**](#17-visual-system-architecture)
18. [**Conversion Copy Architecture**](#18-conversion-copy-architecture)
19. [**Interaction Systems Engineering**](#19-interaction-systems-engineering)
20. [**QA & Testing Engineering**](#20-qa--testing-engineering)
21. [**Security Architecture — Deep Specification**](#21-security-architecture--deep-specification)

---

## 1. Executive Summary

The NSE AI Research Platform is a production-ready, AI-powered financial research system designed to monitor companies listed on the Nairobi Securities Exchange. It operates as a professional financial research desk — combining automated data collection, event detection, AI-driven analysis, and portfolio recommendations — deployable by a solo developer at minimal cost.

The system ingests market data, financial statements, news articles, and macroeconomic indicators. It applies fundamental analysis, sentiment analysis, and technical indicators to generate structured **BUY / HOLD / SELL** signals with confidence scores. A secure Next.js dashboard visualises all outputs, and an automated email system delivers daily reports.

### 1.1 Core Objectives

| Objective | Implementation Approach |
|---|---|
| Real-time & historical NSE price data | NSE public feeds, Yahoo Finance, scheduled Python scraper |
| Company financial fundamentals | Annual/quarterly reports via scraper + manual CSV upload |
| AI buy / hold / sell signals | Claude API with structured JSON output |
| Event detection engine | Rule-based + LLM pattern matching on news and price anomalies |
| Portfolio allocation engine | Risk-weighted signal scoring with diversification constraints |
| Secure dashboard | Next.js on Vercel, Supabase Auth, Row Level Security |
| Automated reporting | GitHub Actions cron + Resend email service |

---

## 2. System Architecture Overview

### 2.1 Architecture Layers

| Layer | Technology | Role | Hosting |
|---|---|---|---|
| Data Collection | Python 3.11 + HTTPX + Scrapy | Fetch prices, news, financials | Railway (cron) |
| Storage | PostgreSQL 15 via Supabase | Persist all raw and processed data | Supabase (managed) |
| Event Detection | Python — rule engine + LLM | Identify market-moving events | Railway |
| AI Analysis | Python + Anthropic API | Generate signals and analysis | Railway |
| Portfolio Engine | Python | Allocate capital, rebalance | Railway |
| Backend API | Node.js 20 + Fastify 4 | Serve data to frontend securely | Render / Railway |
| Frontend | Next.js 14 + Tailwind + shadcn/ui | Dashboard, charts, UX | Vercel |
| Notifications | Resend API + React Email | Send daily/event reports | Vercel Edge Functions |

### 2.2 Data Flow (End-to-End)

1. Python cron jobs fetch stock prices from Yahoo Finance (`yfinance`) every 15 minutes during NSE trading hours (09:00–15:30 EAT).
2. News scrapers collect articles from Business Daily, Reuters Africa, and NSE announcements every 30–60 minutes.
3. Financial statement ingestion runs nightly, parsing PDF/HTML annual reports and inserting structured rows.
4. All raw data lands in Supabase PostgreSQL via the Python Supabase client or direct psycopg2.
5. The event detection engine queries recent prices and news, applies Z-score thresholds and LLM classification, and inserts `detected_events` rows.
6. The AI analysis engine reads companies, financials, events, and news to generate `analysis_results` rows with signal, confidence, drivers, and risks.
7. The portfolio engine reads all active BUY signals and computes allocation percentages respecting diversification constraints.
8. The Node.js API layer serves data via REST endpoints to the Next.js dashboard, enforcing JWT authentication and RLS.
9. GitHub Actions cron triggers the daily email pipeline at 18:30 EAT via Resend.

---

## 3. Data Collection Layer

### 3.1 Stock Price Collection

**Primary: Yahoo Finance (yfinance)**

```python
import yfinance as yf

NSE_TICKERS = ['SCOM.NR', 'EQTY.NR', 'KCB.NR', 'EABL.NR', 'KGEN.NR']

def fetch_prices(tickers: list[str]) -> pd.DataFrame:
    df = yf.download(tickers, period='1d', interval='15m', group_by='ticker')
    return df
```

The collector runs as a Railway cron at `*/15 9-15 * * 1-5` (every 15 min, weekdays, NSE hours).

**Secondary: NSE Bourse Report Scraper**

Downloads the daily PDF/CSV bourse report from `nse.co.ke` each evening at 15:35 EAT as a cross-validation source.

### 3.2 Financial Statements

Pipeline: HTTPX download → `pdfplumber` text extraction → regex + LLM parsing → Pydantic validation → Supabase upsert.

Key financial line items captured per company per period:
- Revenue, EBITDA, Net Profit, EPS
- Total Assets, Total Debt, Equity, Free Cash Flow
- Dividend per share, Dividend yield

### 3.3 News Sources

| Source | Method | Frequency |
|---|---|---|
| Business Daily Africa | RSS feed parser | Every 30 min |
| Reuters Africa | RSS feed parser | Every 30 min |
| NSE Announcements | NSE portal scraper | Every 60 min |
| Capital FM Business | RSS feed parser | Every 60 min |
| Company IR pages | HTTP scraper | Daily |
| X/Twitter (optional) | Twitter API v2 free tier | Every 2 hours |

### 3.4 Macroeconomic Indicators

- CBK Base Rate (scraper, monthly)
- Kenya CPI / Inflation (KNBS API or scraper)
- USD/KES Exchange Rate (Open Exchange Rates, daily)
- Kenya GDP Growth (World Bank Data API, annual)
- Regional PMI (S&P Global, monthly)

### 3.5 Data Validation Pipeline

| Check | Method | On Failure |
|---|---|---|
| Price range | Assert within ±30% of 30-day average | Flag, do not insert |
| Schema validation | Pydantic v2 model validation | Reject with error log |
| Duplicate detection | Upsert on `(ticker, timestamp)` UNIQUE constraint | Update if newer |
| Stale data | News timestamp must be within 7 days | Skip, log warning |
| Text sanitisation | Strip HTML, decode entities, normalise Unicode | Auto-clean |
| Null on required fields | Pydantic `Field(...)` required enforcement | Reject row |

---

## 4. Event Detection Engine

### 4.1 Event Categories

| Event Type | Detection Method | Impact Score |
|---|---|---|
| Earnings announcement | NSE disclosure scraper + LLM classifier | 60–95 |
| Dividend change | Regex on NSE announcements | 50–85 |
| Abnormal price movement | Z-score > 2.5 vs 20-day rolling window | 40–80 |
| Regulatory update | LLM classifier on news corpus | 30–90 |
| Macro policy change | CBK/KNBS scraper + LLM | 50–95 |
| Unusual news volume | Count articles/ticker/hour vs baseline | 20–60 |
| CEO/leadership change | LLM NER on news | 40–75 |

### 4.2 Price Anomaly Detection

```python
z_score = (current_price - rolling_mean) / rolling_std
if abs(z_score) > 2.5:
    impact = 40 + min(40, int((abs(z_score) - 2.5) * 10))
    if volume_z_score > 2.0:
        impact = min(100, impact + 15)
    insert_event("PRICE_ANOMALY", impact)
```

### 4.3 LLM Event Classification Prompt

```
System: You are a financial event classifier for the Nairobi Securities Exchange.
Given a news article, output ONLY a JSON object:
{
  "event_type": "EARNINGS|DIVIDEND|REGULATORY|MACRO|LEADERSHIP|NEWS_SURGE|NONE",
  "ticker": "NSE ticker or null",
  "impact_direction": "POSITIVE|NEGATIVE|NEUTRAL|UNCERTAIN",
  "confidence": 0.0-1.0,
  "headline": "one-line event description"
}
```

Model: `claude-haiku-3-5` (cost-optimised). Temperature: 0.1.

---

## 5. AI Analysis Layer

### 5.1 Analysis Components

**A. Fundamental Analysis** — P/E, P/B, EV/EBITDA, ROE, ROA, Net Margin, D/E, Current Ratio, FCF Yield, Dividend Growth.

**B. News Sentiment** — Weighted average sentiment score across last 7 days of articles per ticker. Claude scores each article -1.0 to +1.0.

**C. Technical Indicators** (via `pandas-ta`) — RSI-14, MACD, 50/200 MA crossover, Bollinger Bands, OBV Volume trend.

**D. Macro Context** — Constructs a context paragraph from CBK rate, inflation, FX, GDP. Sector-adjusted ±10 points.

### 5.2 Signal Output Schema

| Field | Type |
|---|---|
| `ticker` | String |
| `signal` | `BUY\|HOLD\|SELL` |
| `confidence_score` | Float 0.0–1.0 |
| `price_target_kes` | Float (nullable) |
| `key_drivers` | String[] (max 3) |
| `major_risks` | String[] (max 3) |
| `triggering_events` | UUID[] |
| `fundamental_score` | Float 0–100 |
| `sentiment_score` | Float -1 to 1 |
| `technical_score` | Float 0–100 |
| `macro_context` | String |
| `evidence_summary` | String |
| `generated_at` | ISO timestamp |
| `model_version` | String |

### 5.3 Confidence Thresholds

| Range | Signal | Action |
|---|---|---|
| 0.80–1.00 | BUY or SELL | High conviction — include in email |
| 0.65–0.79 | BUY or SELL | Moderate — display on dashboard |
| 0.50–0.64 | HOLD | Low conviction — caution label |
| < 0.50 | No signal | Flag for manual review |

---

## 6. Portfolio Strategy Engine

### 6.1 Allocation Algorithm

1. Filter active BUY signals with `confidence >= 0.65`.
2. Raw weight = `confidence_score × (1 + fundamental_score / 100)`.
3. Sector cap: max 35% per sector.
4. Single-stock cap: max 20% per holding.
5. Normalise to 100%.
6. Reserve ≥ 10% cash buffer.
7. Output `[(ticker, weight_pct, rationale)]`.

### 6.2 Rebalancing Rules

- **Scheduled:** Every Sunday 20:00 EAT.
- **Event-driven:** `impact_score > 80` flips a signal.
- **Drift:** Any holding drifts > 5pp from target weight.

---

## 7. Database Schema

### 7.1 All Tables

```sql
-- Core reference
CREATE TABLE companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker       VARCHAR(10) UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  sector       TEXT NOT NULL,
  market_cap   BIGINT,
  description  TEXT,
  website      TEXT,
  listed_date  DATE,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Time-series price data
CREATE TABLE stock_prices (
  id         BIGSERIAL PRIMARY KEY,
  ticker     VARCHAR(10) REFERENCES companies(ticker),
  price_date TIMESTAMPTZ NOT NULL,
  open_kes   NUMERIC(12,4),
  high_kes   NUMERIC(12,4),
  low_kes    NUMERIC(12,4),
  close_kes  NUMERIC(12,4) NOT NULL,
  volume     BIGINT,
  source     TEXT DEFAULT 'yahoo_finance',
  UNIQUE(ticker, price_date)
);

-- Fundamental data
CREATE TABLE financials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker         VARCHAR(10) REFERENCES companies(ticker),
  period_end     DATE NOT NULL,
  period_type    VARCHAR(10) CHECK (period_type IN ('annual','interim')),
  revenue_kes    BIGINT, ebitda_kes BIGINT, net_profit_kes BIGINT,
  eps_kes        NUMERIC(10,4), total_assets BIGINT, total_debt BIGINT,
  equity_kes     BIGINT, free_cashflow BIGINT, dividend_kes NUMERIC(8,4),
  source_url     TEXT,
  UNIQUE(ticker, period_end, period_type)
);

-- News ingestion
CREATE TABLE news_articles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker          VARCHAR(10),
  headline        TEXT NOT NULL,
  body_excerpt    TEXT,
  source_name     TEXT,
  source_url      TEXT UNIQUE,
  published_at    TIMESTAMPTZ,
  sentiment_score NUMERIC(4,3),
  sentiment_label TEXT,
  is_processed    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Detected market events
CREATE TABLE detected_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker           VARCHAR(10),
  event_type       TEXT NOT NULL,
  impact_score     SMALLINT CHECK (impact_score BETWEEN 0 AND 100),
  impact_direction TEXT,
  headline         TEXT,
  source_url       TEXT,
  source_type      TEXT,
  raw_context      JSONB,
  detected_at      TIMESTAMPTZ DEFAULT now()
);

-- AI analysis outputs
CREATE TABLE analysis_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker            VARCHAR(10) REFERENCES companies(ticker),
  signal            TEXT CHECK (signal IN ('BUY','HOLD','SELL')),
  confidence_score  NUMERIC(4,3),
  price_target_kes  NUMERIC(10,2),
  key_drivers       TEXT[],
  major_risks       TEXT[],
  triggering_events UUID[],
  fundamental_score NUMERIC(5,2),
  sentiment_score   NUMERIC(4,3),
  technical_score   NUMERIC(5,2),
  macro_context     TEXT,
  evidence_summary  TEXT,
  model_version     TEXT,
  generated_at      TIMESTAMPTZ DEFAULT now()
);

-- Portfolio allocations
CREATE TABLE portfolio_allocations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_date   DATE NOT NULL,
  holdings          JSONB NOT NULL,
  cash_buffer_pct   NUMERIC(5,2),
  sector_breakdown  JSONB,
  expected_return   NUMERIC(5,2),
  risk_level        TEXT,
  rebalance_trigger TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Signal evaluation / backtesting
CREATE TABLE signal_evaluations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID REFERENCES analysis_results(id),
  ticker           VARCHAR(10),
  signal           TEXT,
  confidence_score NUMERIC(4,3),
  signal_date      DATE,
  outcome_30d      TEXT, price_change_30d NUMERIC(8,4),
  outcome_60d      TEXT, price_change_60d NUMERIC(8,4),
  outcome_90d      TEXT, price_change_90d NUMERIC(8,4),
  evaluated_at     TIMESTAMPTZ DEFAULT now()
);

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id),
  email      TEXT UNIQUE NOT NULL,
  role       TEXT DEFAULT 'viewer' CHECK (role IN ('admin','analyst','viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User preferences and watchlists
CREATE TABLE user_preferences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  watchlist     TEXT[],
  email_freq    TEXT DEFAULT 'daily' CHECK (email_freq IN ('daily','weekly','event_only')),
  alert_min_impact SMALLINT DEFAULT 70,
  theme         TEXT DEFAULT 'light',
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Email send log
CREATE TABLE email_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT,
  recipient   TEXT,
  subject     TEXT,
  status      TEXT,
  resend_id   TEXT,
  sent_at     TIMESTAMPTZ DEFAULT now()
);
```

### 7.2 Indexes

```sql
CREATE INDEX idx_sp_ticker_date    ON stock_prices(ticker, price_date DESC);
CREATE INDEX idx_analysis_ticker   ON analysis_results(ticker, generated_at DESC);
CREATE INDEX idx_analysis_signal   ON analysis_results(signal, confidence_score DESC);
CREATE INDEX idx_news_ticker_date  ON news_articles(ticker, published_at DESC);
CREATE INDEX idx_news_unprocessed  ON news_articles(is_processed) WHERE is_processed = FALSE;
CREATE INDEX idx_events_ticker     ON detected_events(ticker, detected_at DESC);
CREATE INDEX idx_events_impact     ON detected_events(impact_score DESC);
CREATE INDEX idx_eval_ticker_date  ON signal_evaluations(ticker, signal_date DESC);
CREATE INDEX idx_raw_context_gin   ON detected_events USING GIN(raw_context);
```

---

## 8. Backend API Layer

### 8.1 Endpoints

| Method + Route | Auth | Description |
|---|---|---|
| `GET /stocks` | JWT | List all active NSE companies |
| `GET /stocks/:ticker` | JWT | Company profile + latest price |
| `GET /stocks/:ticker/prices` | JWT | Historical OHLCV (`?from&to&interval`) |
| `GET /signals` | JWT | All latest signals (`?signal&min_confidence`) |
| `GET /signals/:ticker` | JWT | Signal history for one company |
| `GET /analysis/:ticker` | JWT | Full analysis with drivers + risks |
| `GET /events` | JWT | Detected events (`?ticker&type&min_impact`) |
| `GET /portfolio/latest` | JWT | Most recent portfolio allocation |
| `GET /portfolio/history` | JWT admin | All past allocations |
| `GET /news` | JWT | Curated news (`?ticker&limit`) |
| `GET /performance` | JWT | Backtesting results and accuracy metrics |
| `POST /users/preferences` | JWT | Save watchlist / alert preferences |
| `GET /health` | None | Service health check |

### 8.2 Middleware Stack

- **JWT Verification** — Supabase JWT validation on every protected route via `@supabase/supabase-js`.
- **Rate Limiting** — `@fastify/rate-limit`: 60 req/min unauthenticated, 200/min authenticated.
- **CORS** — Strict allowlist: Vercel deployment URL + `localhost:3000` in dev only.
- **Input Sanitisation** — Zod v3 schemas on all path params, query strings, and body fields.
- **Error Handling** — RFC 7807 `application/problem+json`. No internal stack traces in production.

---

## 9. Frontend Dashboard

### 9.1 Technology

| Concern | Library |
|---|---|
| Charts — price/indicators | `lightweight-charts` (TradingView, ~40kb) |
| Charts — bar/pie | Recharts |
| Styling | Tailwind CSS + shadcn/ui |
| Data fetching | SWR + Next.js Server Components |
| State | Zustand |
| Auth UI | Supabase Auth UI React |
| Tables | TanStack Table v8 |
| Icons | Lucide React |

### 9.2 Full Sitemap

| Route | Page | Auth? |
|---|---|---|
| `/` | Landing / Home | No |
| `/login` | Login | No |
| `/register` | Register | No |
| `/dashboard` | Market Overview | Yes |
| `/stocks` | Stocks List | Yes |
| `/stocks/[ticker]` | Stock Detail | Yes |
| `/signals` | AI Signals | Yes |
| `/events` | Events Feed | Yes |
| `/analysis/[ticker]` | AI Analysis Detail | Yes |
| `/portfolio` | Portfolio Recommendations | Yes |
| `/news` | News Monitor | Yes |
| `/performance` | Historical Performance | Yes |
| `/reports` | Email Reports Archive | Yes |
| `/settings` | Account Settings | Yes |
| `/admin` | Admin Panel | Yes (admin) |

---

## 10. Notification System

### 10.1 Email Types

| Type | Trigger | Content |
|---|---|---|
| Daily Market Digest | 18:30 EAT weekdays | Top BUY/SELL signals, major events, portfolio summary |
| High-Impact Alert | `impact_score > 85` | Event headline, ticker, signal change, action |
| Weekly Portfolio Review | Sunday 19:00 EAT | Full allocation, rebalance recs, 7-day performance |
| Signal Change Alert | Signal flips, `confidence > 0.75` | Sent within 30 min of detection |

Built with **React Email** + **Resend** (3,000 free emails/month).

---

## 11. Automation Pipeline

### 11.1 Daily Schedule (EAT)

| Time | Task | Script |
|---|---|---|
| 06:00 | Fetch macro indicators | `fetch_macro.py` |
| 09:05 | Start real-time price polling (every 15 min) | `poll_prices.py` |
| 09:00–15:30 | Collect news (every 30 min) | `fetch_news.py` |
| 15:35 | End-of-day NSE bourse report | `fetch_eod_prices.py` |
| 16:00 | Run event detection | `detect_events.py` |
| 16:30 | Run AI analysis | `run_analysis.py` |
| 17:00 | Compute portfolio allocation | `run_portfolio.py` |
| 17:30 | Run evaluation/backtesting | `evaluate_signals.py` |
| 18:30 | Send daily email digest | `send_digest.py` (GitHub Actions) |
| 23:00 | Nightly financial statement ingestion | `fetch_financials.py` |
| Sun 19:00 | Weekly portfolio review email | `send_weekly.py` |

---

## 12. Evaluation & Backtesting

### 12.1 Methodology

1. Retrieve all BUY/SELL signals older than 30 days.
2. Fetch actual price performance over 30/60/90 days.
3. BUY SUCCESS = price rose ≥ 5%; FAILURE = declined ≥ 5%.
4. Aggregate by signal type, sector, confidence band, horizon.
5. Store in `signal_evaluations`; expose via `/performance`.

### 12.2 Metrics

| Metric | Description |
|---|---|
| Overall Signal Accuracy | % signals in correct direction within 60 days |
| Accuracy by Confidence Band | Segmented: 0.65–0.75, 0.75–0.85, 0.85+ |
| Sector Accuracy | Per sector: Banking, Telco, Consumer, etc. |
| Sharpe Ratio (simulated) | Risk-adjusted return vs NSE 20 index |
| Maximum Drawdown | Largest peak-to-trough in simulated portfolio |
| Alpha vs NSE 20 | Excess return vs benchmark |
| BUY Hit Rate | % BUY signals that outperformed NSE index |
| SELL Hit Rate | % SELL signals that underperformed NSE index |

---

## 13. Infrastructure & Deployment

### 13.1 Infrastructure

| Component | Platform | Cost |
|---|---|---|
| PostgreSQL | Supabase | $0–$25/mo |
| Frontend | Vercel | $0–$20/mo |
| Python cron | Railway | $5–$15/mo |
| Node.js API | Railway / Render | $0–$7/mo |
| Email | Resend | $0/mo |
| AI API | Anthropic (PAYG) | $10–$40/mo |
| Domain + TLS | Namecheap + Vercel | $10/year |

### 13.2 Deployment Sequence

1. **Supabase** — Create project → run migrations → enable RLS → configure Auth.
2. **Railway (Python)** — Add Python service → set env vars → configure cron → backfill 1yr prices.
3. **Railway/Render (Node.js)** — Deploy API → set env vars → verify endpoints.
4. **Vercel (Next.js)** — Import repo → set env vars → deploy → configure custom domain.
5. **GitHub Actions** — Add secrets → create `daily-digest.yml` → verify first run.

---

## 14. Cost Summary

| Scenario | Monthly Total |
|---|---|
| MVP (5 tickers, dev) | $5–$15 |
| Production (20 tickers, 1 user) | $25–$65 |
| Growth (40+ tickers, 10 users) | $70–$100 |
| Scale (full NSE, 100 users) | $105–$175 |

---

## 15. Appendices

### Appendix A — NSE Tickers Reference

| Ticker | Company | Sector | Yahoo ID |
|---|---|---|---|
| SCOM | Safaricom PLC | Telecommunications | SCOM.NR |
| EQTY | Equity Group Holdings | Banking | EQTY.NR |
| KCB | KCB Group PLC | Banking | KCB.NR |
| EABL | East African Breweries | Consumer Staples | EABL.NR |
| KGEN | KenGen PLC | Energy & Utilities | KGEN.NR |
| COOP | Co-operative Bank Kenya | Banking | COOP.NR |
| ABSA | ABSA Bank Kenya PLC | Banking | ABSA.NR |
| BAMB | Bamburi Cement | Industrials | BAMB.NR |
| BAT | British American Tobacco Kenya | Consumer Staples | BAT.NR |
| NMG | Nation Media Group | Media | NMG.NR |
| NCBA | NCBA Group PLC | Banking | NCBA.NR |
| JUB | Jubilee Holdings | Insurance | JUB.NR |
| KENRE | Kenya Re Corporation | Insurance | KENRE.NR |
| TOTL | TotalEnergies EP Kenya | Energy | TOTL.NR |

### Appendix B — Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui, Zustand, SWR |
| Charts | Lightweight-charts, Recharts |
| Backend API | Node.js 20, Fastify 4, Zod, @supabase/supabase-js |
| Data Scripts | Python 3.11, pandas, pydantic v2, httpx, pandas-ta |
| AI | Anthropic Claude (claude-sonnet-4-5 / claude-haiku-3-5) |
| Database | PostgreSQL 15, Supabase (Auth + Realtime + RLS) |
| Email | Resend API, React Email |
| CI/CD | GitHub Actions |
| Hosting | Vercel (frontend), Railway (workers + API) |

---

---

# PART II — DEEP ENGINEERING SPECIFICATIONS

---

## 16. Systems Architecture — Deep Specification

### 16.1 Service Topology and Boundaries

The platform is decomposed into six logical services. Each service owns its domain, communicates via defined contracts, and can be independently deployed and scaled.

```
┌──────────────────────────────────────────────────────────────────────┐
│  SERVICE TOPOLOGY                                                      │
│                                                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐    │
│  │  Data Worker │    │  AI Worker   │    │  Portfolio Worker    │    │
│  │  (Python)    │    │  (Python)    │    │  (Python)            │    │
│  │              │    │              │    │                      │    │
│  │  - Prices    │    │  - Events    │    │  - Allocation        │    │
│  │  - News      │    │  - Analysis  │    │  - Rebalancing       │    │
│  │  - Financials│    │  - Sentiment │    │  - Evaluation        │    │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘    │
│         │                   │                        │                │
│         └───────────────────▼────────────────────────┘                │
│                      ┌──────────────┐                                 │
│                      │  Supabase    │                                 │
│                      │  PostgreSQL  │                                 │
│                      │  + Realtime  │                                 │
│                      │  + Auth      │                                 │
│                      └──────┬───────┘                                 │
│                             │                                         │
│                      ┌──────▼───────┐                                 │
│                      │  Node.js API │                                 │
│                      │  (Fastify)   │                                 │
│                      └──────┬───────┘                                 │
│                             │                                         │
│              ┌──────────────▼────────────────┐                        │
│              │      Next.js Frontend          │                        │
│              │      (Vercel)                  │                        │
│              └───────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 16.2 Service Contracts

Each inter-service communication uses strict typed contracts enforced at the boundary.

#### Contract: Data Worker → Supabase

All inserts use Pydantic v2 models. The upsert pattern is mandatory to prevent duplicates.

```python
from pydantic import BaseModel, field_validator
from datetime import datetime
from decimal import Decimal

class StockPriceRecord(BaseModel):
    ticker: str
    price_date: datetime
    open_kes: Decimal | None = None
    high_kes: Decimal | None = None
    low_kes: Decimal | None = None
    close_kes: Decimal
    volume: int | None = None
    source: str = "yahoo_finance"

    @field_validator('ticker')
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        if not v.isupper() or len(v) > 10:
            raise ValueError(f"Invalid NSE ticker: {v}")
        return v

    @field_validator('close_kes')
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Price must be positive")
        return v

class PriceIngestionService:
    def __init__(self, supabase_client):
        self.db = supabase_client

    def upsert_prices(self, records: list[StockPriceRecord]) -> dict:
        data = [r.model_dump() for r in records]
        result = (
            self.db.table("stock_prices")
            .upsert(data, on_conflict="ticker,price_date")
            .execute()
        )
        return {"inserted": len(result.data), "errors": []}
```

#### Contract: AI Worker → Supabase (Analysis Results)

```python
class AnalysisResult(BaseModel):
    ticker: str
    signal: Literal["BUY", "HOLD", "SELL"]
    confidence_score: float = Field(ge=0.0, le=1.0)
    price_target_kes: float | None = None
    key_drivers: list[str] = Field(max_length=3)
    major_risks: list[str] = Field(max_length=3)
    triggering_events: list[UUID] = Field(default_factory=list)
    fundamental_score: float = Field(ge=0.0, le=100.0)
    sentiment_score: float = Field(ge=-1.0, le=1.0)
    technical_score: float = Field(ge=0.0, le=100.0)
    macro_context: str
    evidence_summary: str
    model_version: str
```

#### Contract: Node.js API → Frontend (Response Envelope)

```typescript
// All API responses conform to this envelope
interface ApiResponse<T> {
  data: T;
  meta: {
    total: number;
    page: number;
    per_page: number;
    has_more: boolean;
  };
  generated_at: string; // ISO 8601
  request_id: string;   // UUID for tracing
}

// Error responses conform to RFC 7807
interface ProblemDetail {
  type: string;       // URI identifying the problem
  title: string;      // Human-readable summary
  status: number;     // HTTP status code
  detail: string;     // Human-readable explanation
  instance: string;   // URI of the specific occurrence
}
```

### 16.3 Database Connection Architecture

**Python Workers:** Use `psycopg2` with connection pooling via `psycopg2.pool.ThreadedConnectionPool` (min=2, max=10). PgBouncer-style pooling is handled by Supabase's built-in pgBouncer in transaction mode.

**Node.js API:** Uses `@supabase/supabase-js` v2 client. For raw SQL queries with complex joins, uses `postgres` npm package with prepared statements.

**Connection Limits:**
- Supabase Free: 60 direct connections
- Via pgBouncer (port 6543): up to 200 pooled connections
- Always use pgBouncer URL for Python workers

```python
# Use pgBouncer URL for Python (transaction mode)
DB_URL = "postgresql://postgres:[password]@[project].supabase.com:6543/postgres"

# Use direct URL only for migrations
DIRECT_URL = "postgresql://postgres:[password]@[project].supabase.com:5432/postgres"
```

### 16.4 Event Bus Architecture (Supabase Realtime)

The platform uses Supabase Realtime as a lightweight event bus for triggering event-driven actions. No external message queue (Kafka, RabbitMQ) is needed at this scale.

```typescript
// Frontend: Subscribe to new high-impact events
const channel = supabase
  .channel('high-impact-events')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'detected_events',
      filter: 'impact_score=gte.70'
    },
    (payload) => {
      // Update events feed without polling
      addEventToFeed(payload.new);
    }
  )
  .subscribe();

// Frontend: Subscribe to new analysis results for watched tickers
const analysisChannel = supabase
  .channel('analysis-updates')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'analysis_results'
    },
    (payload) => {
      if (watchlist.includes(payload.new.ticker)) {
        updateSignalCard(payload.new);
      }
    }
  )
  .subscribe();
```

```python
# Python worker: Publish event notification after insert
from supabase import create_client

def insert_event_and_notify(event: DetectedEvent):
    result = supabase.table("detected_events").insert(event.dict()).execute()
    # Supabase Realtime broadcasts automatically on INSERT
    # For immediate AI analysis trigger on high-impact events:
    if event.impact_score > 85:
        trigger_immediate_analysis(event.ticker)
```

### 16.5 Caching Architecture

Three-tier caching reduces API latency and Supabase query load:

**Tier 1: In-Process Cache (Node.js)**
- Library: `node-cache`
- TTL: 60 seconds for signals list, 5 minutes for company list
- Invalidation: On new `analysis_results` INSERT via Realtime

```typescript
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

async function getSignals(filter: SignalFilter): Promise<Signal[]> {
  const cacheKey = `signals:${JSON.stringify(filter)}`;
  const cached = cache.get<Signal[]>(cacheKey);
  if (cached) return cached;
  
  const data = await fetchSignalsFromDB(filter);
  cache.set(cacheKey, data);
  return data;
}
```

**Tier 2: HTTP Response Cache (Vercel Edge)**
- `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` on read-only endpoints
- Applied to: `/api/stocks`, `/api/signals`, `/api/events`
- Not applied to: user-specific endpoints, `/api/portfolio`

**Tier 3: SWR Client Cache (Browser)**
- `useSWR` with `refreshInterval: 30000` (30s) for live data endpoints
- `dedupingInterval: 5000` to prevent duplicate requests

```typescript
// Price chart data: longer TTL, no auto-refresh
const { data: prices } = useSWR(
  `/api/stocks/${ticker}/prices?from=${from}&to=${to}`,
  fetcher,
  { revalidateOnFocus: false, dedupingInterval: 60000 }
);

// Signals feed: short TTL, auto-refresh
const { data: signals } = useSWR(
  '/api/signals',
  fetcher,
  { refreshInterval: 30000 }
);
```

### 16.6 Error Handling and Resilience

**Python Workers — Retry Strategy:**

```python
import tenacity

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=4, max=60),
    retry=tenacity.retry_if_exception_type(httpx.HTTPError),
    before_sleep=tenacity.before_sleep_log(logger, logging.WARNING)
)
async def fetch_with_retry(url: str) -> httpx.Response:
    async with httpx.AsyncClient(timeout=30.0) as client:
        return await client.get(url)
```

**Circuit Breaker (AI API):**

```python
class AICircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=300):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED | OPEN | HALF_OPEN

    def call(self, func, *args, **kwargs):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
            else:
                raise CircuitOpenError("AI API circuit breaker is OPEN")
        try:
            result = func(*args, **kwargs)
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failure_count = 0
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
            raise
```

**Node.js API — Error Propagation:**

```typescript
// Global Fastify error handler
fastify.setErrorHandler((error, request, reply) => {
  const status = error.statusCode || 500;
  
  // Never leak internals in production
  const detail = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred. Contact support if this persists.'
    : error.message;

  reply.status(status).send({
    type: `https://nse-platform.example.com/errors/${error.code || 'internal'}`,
    title: getErrorTitle(status),
    status,
    detail,
    instance: request.url,
  });

  // Log full error internally
  fastify.log.error({ err: error, reqId: request.id });
});
```

### 16.7 Observability Architecture

**Structured Logging (Python):**

```python
import structlog

log = structlog.get_logger()

def run_analysis(ticker: str):
    log.info("analysis.start", ticker=ticker, ts=datetime.utcnow().isoformat())
    try:
        result = execute_analysis(ticker)
        log.info("analysis.complete",
                 ticker=ticker,
                 signal=result.signal,
                 confidence=result.confidence_score,
                 duration_ms=result.duration_ms)
    except Exception as e:
        log.error("analysis.failed", ticker=ticker, error=str(e), exc_info=True)
        raise
```

**Health Check Endpoints:**

```typescript
// Node.js API health check — verifies DB connectivity
fastify.get('/health', async (request, reply) => {
  const checks = await Promise.allSettled([
    supabase.from('companies').select('count').limit(1),
  ]);
  
  const healthy = checks.every(c => c.status === 'fulfilled');
  reply.status(healthy ? 200 : 503).send({
    status: healthy ? 'healthy' : 'degraded',
    checks: { database: checks[0].status },
    timestamp: new Date().toISOString(),
  });
});
```

**Metrics to Track (UptimeRobot free tier):**
- API health endpoint: every 5 minutes
- Frontend reachability: every 5 minutes
- Alerts: email + webhook on 2 consecutive failures

### 16.8 File and Directory Structure

```
nse-platform/
├── savepoints.json                    ← Granular project save points
├── README.md
├── .env.example
│
├── frontend/                          ← Next.js 14 app
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             ← Auth guard + sidebar
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── stocks/
│   │   │   │   ├── page.tsx           ← Stocks list
│   │   │   │   └── [ticker]/page.tsx  ← Stock detail
│   │   │   ├── signals/page.tsx
│   │   │   ├── events/page.tsx
│   │   │   ├── analysis/[ticker]/page.tsx
│   │   │   ├── portfolio/page.tsx
│   │   │   ├── news/page.tsx
│   │   │   ├── performance/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── admin/page.tsx
│   │   ├── api/                       ← Next.js route handlers (proxy to Node API)
│   │   └── page.tsx                   ← Landing page
│   ├── components/
│   │   ├── ui/                        ← shadcn/ui base components
│   │   ├── charts/
│   │   │   ├── PriceChart.tsx
│   │   │   ├── PortfolioPie.tsx
│   │   │   └── PerformanceChart.tsx
│   │   ├── signals/
│   │   │   ├── SignalCard.tsx
│   │   │   ├── SignalBadge.tsx
│   │   │   └── SignalHistory.tsx
│   │   ├── events/
│   │   │   ├── EventCard.tsx
│   │   │   └── EventsFeed.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── MobileNav.tsx
│   │   └── shared/
│   │       ├── LoadingState.tsx
│   │       ├── EmptyState.tsx
│   │       └── ErrorBoundary.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── api.ts                     ← Typed API client
│   │   ├── hooks/                     ← SWR data hooks
│   │   └── utils/
│   ├── store/                         ← Zustand stores
│   │   ├── useWatchlistStore.ts
│   │   └── useUIStore.ts
│   └── types/                         ← Shared TypeScript types
│
├── api/                               ← Node.js Fastify server
│   ├── src/
│   │   ├── server.ts
│   │   ├── plugins/
│   │   │   ├── auth.ts                ← JWT validation plugin
│   │   │   ├── rateLimit.ts
│   │   │   └── cors.ts
│   │   ├── routes/
│   │   │   ├── stocks.ts
│   │   │   ├── signals.ts
│   │   │   ├── events.ts
│   │   │   ├── analysis.ts
│   │   │   ├── portfolio.ts
│   │   │   ├── news.ts
│   │   │   ├── performance.ts
│   │   │   └── health.ts
│   │   ├── schemas/                   ← Zod schemas
│   │   ├── services/                  ← Business logic
│   │   └── types/
│   └── package.json
│
├── workers/                           ← Python data + AI workers
│   ├── data/
│   │   ├── fetch_prices.py
│   │   ├── fetch_news.py
│   │   ├── fetch_financials.py
│   │   ├── fetch_macro.py
│   │   └── fetch_eod_prices.py
│   ├── events/
│   │   └── detect_events.py
│   ├── analysis/
│   │   ├── run_analysis.py
│   │   ├── sentiment.py
│   │   ├── technicals.py
│   │   └── fundamentals.py
│   ├── portfolio/
│   │   └── run_portfolio.py
│   ├── evaluation/
│   │   └── evaluate_signals.py
│   ├── notifications/
│   │   ├── prepare_report.py
│   │   └── send_digest.py
│   ├── models/                        ← Pydantic models
│   ├── services/                      ← Shared services (DB, AI client)
│   ├── tests/
│   └── requirements.txt
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_tables.sql
│   │   ├── 002_create_indexes.sql
│   │   ├── 003_rls_policies.sql
│   │   └── 004_seed_companies.sql
│   └── config.toml
│
└── .github/
    └── workflows/
        ├── daily-digest.yml
        ├── weekly-review.yml
        └── test.yml
```

---

## 17. Visual System Architecture

### 17.1 Design Philosophy

The visual system is built on three principles:
1. **Data Clarity First** — financial data must be immediately legible without visual noise.
2. **Trust Signalling** — professional aesthetics build confidence in AI recommendations.
3. **Progressive Disclosure** — surface summaries first; full detail one click away.

### 17.2 Design Tokens

All visual properties are defined as design tokens. Components consume tokens, never raw values. This enables theming (dark/light) with a single variable swap.

#### Color Tokens

```typescript
// tokens/colors.ts
export const colors = {
  // Brand
  brand: {
    navy:    '#1B3A6B',
    accent:  '#2E75B6',
    light:   '#EBF3FB',
  },

  // Semantic — Signal Colors (critical: must be WCAG AA compliant)
  signal: {
    buy: {
      bg:     '#DCFCE7',  // green-100
      text:   '#15803D',  // green-700
      border: '#86EFAC',  // green-300
      icon:   '#16A34A',  // green-600
    },
    sell: {
      bg:     '#FEE2E2',  // red-100
      text:   '#B91C1C',  // red-700
      border: '#FCA5A5',  // red-300
      icon:   '#DC2626',  // red-600
    },
    hold: {
      bg:     '#FEF3C7',  // amber-100
      text:   '#B45309',  // amber-700
      border: '#FCD34D',  // amber-300
      icon:   '#D97706',  // amber-600
    },
  },

  // Semantic — Impact / Severity
  impact: {
    critical: '#DC2626', // 85–100
    high:     '#EA580C', // 65–84
    medium:   '#D97706', // 40–64
    low:      '#65A30D', // 0–39
  },

  // Sentiment
  sentiment: {
    positive: '#15803D',
    negative: '#B91C1C',
    neutral:  '#6B7280',
  },

  // Neutral scale
  neutral: {
    0:   '#FFFFFF',
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
  },

  // Chart palette (colorblind-friendly)
  chart: [
    '#2E75B6', '#16A34A', '#D97706', '#DC2626',
    '#7C3AED', '#0891B2', '#DB2777', '#65A30D',
  ],
} as const;

// Dark mode overrides
export const darkColors = {
  signal: {
    buy:  { bg: '#14532D', text: '#86EFAC', border: '#16A34A', icon: '#4ADE80' },
    sell: { bg: '#7F1D1D', text: '#FCA5A5', border: '#DC2626', icon: '#F87171' },
    hold: { bg: '#78350F', text: '#FCD34D', border: '#D97706', icon: '#FBBF24' },
  },
} as const;
```

#### Typography Tokens

```typescript
// tokens/typography.ts
export const typography = {
  fontFamily: {
    sans:  '"Inter", "Segoe UI", system-ui, sans-serif',
    mono:  '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    data:  '"Tabular Nums", "Inter", system-ui, sans-serif', // for prices
  },

  fontSize: {
    '2xs': ['0.625rem', { lineHeight: '0.875rem' }],  // 10px
    xs:    ['0.75rem',  { lineHeight: '1rem' }],       // 12px
    sm:    ['0.875rem', { lineHeight: '1.25rem' }],    // 14px
    base:  ['1rem',     { lineHeight: '1.5rem' }],     // 16px
    lg:    ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
    xl:    ['1.25rem',  { lineHeight: '1.75rem' }],    // 20px
    '2xl': ['1.5rem',   { lineHeight: '2rem' }],       // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],    // 30px
    '4xl': ['2.25rem',  { lineHeight: '2.5rem' }],     // 36px
  },

  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },

  // Special: tabular numbers for all price/percentage displays
  tabularNums: {
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.01em',
  },
} as const;
```

#### Spacing and Layout Tokens

```typescript
// tokens/layout.ts
export const layout = {
  // Base 4px grid
  spacing: {
    px:  '1px',
    0.5: '2px',
    1:   '4px',
    2:   '8px',
    3:   '12px',
    4:   '16px',
    5:   '20px',
    6:   '24px',
    8:   '32px',
    10:  '40px',
    12:  '48px',
    16:  '64px',
    20:  '80px',
    24:  '96px',
  },

  // Responsive breakpoints
  breakpoints: {
    sm:  '640px',
    md:  '768px',
    lg:  '1024px',
    xl:  '1280px',
    '2xl': '1536px',
  },

  // Dashboard grid
  sidebar: {
    width:        '240px',
    collapsedWidth: '64px',
    zIndex:       50,
  },

  topbar: {
    height: '56px',
    zIndex: 40,
  },

  // Content areas
  contentMaxWidth: '1280px',
  cardPadding:     '24px',
  sectionGap:      '24px',
} as const;
```

#### Elevation (Shadows)

```typescript
export const elevation = {
  none:   'none',
  xs:     '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm:     '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md:     '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg:     '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl:     '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;
```

### 17.3 Component Architecture

#### Atomic Design Hierarchy

```
Atoms           → Button, Badge, Input, Label, Icon, Spinner
Molecules       → SignalBadge, PriceDisplay, ConfidenceBar, TickerChip
Organisms       → SignalCard, EventCard, StockRow, PortfolioAllocationRow
Templates       → DashboardLayout, StockDetailLayout, FullWidthLayout
Pages           → /dashboard, /stocks/[ticker], /signals, etc.
```

#### Core Component Specifications

**`<SignalBadge />`**

```typescript
// components/signals/SignalBadge.tsx
interface SignalBadgeProps {
  signal: 'BUY' | 'HOLD' | 'SELL';
  confidence?: number;       // 0–1, shows confidence bar if provided
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;        // Pulse animation on new signals
}

// Visual rules:
// - BUY: green bg, upward arrow icon, "BUY" text
// - SELL: red bg, downward arrow icon, "SELL" text
// - HOLD: amber bg, horizontal arrows icon, "HOLD" text
// - Confidence bar: colored fill proportional to confidence_score
// - Accessibility: aria-label="Signal: BUY with 87% confidence"
// - High contrast: all color combinations pass WCAG AA (4.5:1 minimum)
```

**`<PriceDisplay />`**

```typescript
interface PriceDisplayProps {
  value: number;
  currency?: 'KES' | 'USD';
  change?: number;           // Absolute change
  changePct?: number;        // Percentage change
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showTrend?: boolean;       // Show up/down arrow
}

// Visual rules:
// - Always use tabular-nums font variant for alignment in lists
// - Positive change: green text + ▲ icon
// - Negative change: red text + ▼ icon
// - Neutral: gray text, no icon
// - Currency: "KES 24.50" format (space after currency code)
// - Decimals: Always 2dp for prices, 2dp for percentages with % suffix
```

**`<PriceChart />`**

```typescript
interface PriceChartProps {
  ticker: string;
  timeRange: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
  showVolume?: boolean;
  showIndicators?: Array<'RSI' | 'MACD' | 'BB' | 'MA50' | 'MA200'>;
  height?: number;           // Default: 320px
  interactive?: boolean;     // Crosshair, tooltip, zoom
}

// Implementation: lightweight-charts (TradingView)
// - Candlestick series by default, line chart option
// - Volume histogram in 30% of chart height
// - Signal markers: BUY (▲ green), SELL (▼ red) on signal dates
// - Current price line: dashed blue line
// - Responsive: fills container width
// - Dark mode: chart background follows theme
```

**`<ConfidenceBar />`**

```typescript
interface ConfidenceBarProps {
  score: number;             // 0–1
  showLabel?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md';
}

// Color thresholds:
// ≥0.80: green (high conviction)
// 0.65–0.79: blue (moderate)
// 0.50–0.64: amber (low)
// <0.50: gray (no signal)

// Animated fill on mount (transform: scaleX from 0 to score)
```

**`<EventCard />`**

```typescript
interface EventCardProps {
  event: DetectedEvent;
  expanded?: boolean;
  onExpand?: () => void;
  showSourceLink?: boolean;
}

// Layout:
// [Impact Badge] [Event Type Chip]  [Timestamp]
// [Headline — 2 lines max, ellipsis after]
// [Ticker Chip] [Direction Arrow]
// [Source: Business Daily ↗]   [Expand ▼]
// 
// Expanded state shows raw_context summary
// Impact badge colors follow impact scale (critical/high/medium/low)
```

### 17.4 Responsive Design Specification

#### Breakpoint Behaviour

| Component | Mobile (<768px) | Tablet (768–1024px) | Desktop (>1024px) |
|---|---|---|---|
| Sidebar | Hidden, bottom nav | Icon-only collapsed | Full with labels |
| Dashboard grid | Single column | 2 columns | 3–4 columns |
| Stock table | Card layout | Compact table | Full table |
| Price chart | 240px height | 280px height | 320px height |
| Portfolio pie | Full width | Half width | 40% width with table |
| Signals grid | 1 column | 2 columns | 3 columns |
| Topbar | Logo + hamburger | Logo + search + avatar | Full with search |

#### Mobile-First Layout

```typescript
// Dashboard page grid — mobile first
<div className="
  grid grid-cols-1 gap-4
  sm:grid-cols-2
  lg:grid-cols-3
  xl:grid-cols-4
">
  <StatsCard label="NSE 20 Index" />
  <StatsCard label="Top Signal" />
  <StatsCard label="Active Events" />
  <StatsCard label="Portfolio Return" />
</div>
```

### 17.5 Dark Mode Implementation

```typescript
// Next.js 14 with next-themes
// tailwind.config.ts
module.exports = {
  darkMode: 'class',  // Adds 'dark' class to <html>
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'hsl(var(--background))',
          secondary: 'hsl(var(--background-secondary))',
        },
        foreground: 'hsl(var(--foreground))',
        // ... CSS variable-driven tokens
      }
    }
  }
}

// globals.css
:root {
  --background: 0 0% 100%;
  --background-secondary: 210 40% 98%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --border: 214.3 31.8% 91.4%;
  --signal-buy-bg: 142 76% 95%;
  --signal-sell-bg: 0 72% 95%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --background-secondary: 217.2 32.6% 7%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 6%;
  --border: 217.2 32.6% 17.5%;
  --signal-buy-bg: 142 76% 8%;
  --signal-sell-bg: 0 72% 10%;
}
```

### 17.6 Accessibility Specification (WCAG 2.1 AA)

| Requirement | Implementation |
|---|---|
| Color contrast ≥ 4.5:1 (text) | All signal badge text/bg pairs validated. BUY: green-700/green-100 = 7.2:1 ✓ |
| Color contrast ≥ 3:1 (UI elements) | Chart lines, borders, icons verified |
| Keyboard navigation | All interactive elements reachable with Tab. Focus ring: 2px offset, brand-accent color |
| Screen reader | ARIA labels on all icon-only buttons. `role="status"` on live-updating price displays |
| Reduced motion | `@media (prefers-reduced-motion)` disables all transition animations |
| Touch targets | Minimum 44×44px on mobile |
| Focus trap | Modal dialogs use `focus-trap-react` |
| Skip links | "Skip to main content" visible on Tab focus |

```typescript
// Accessible price display example
<span
  aria-label={`${ticker} price: KES ${price.toFixed(2)}, ${changeDir} ${Math.abs(changePct).toFixed(2)} percent`}
  role="text"
>
  <span aria-hidden="true" className="font-tabular">
    KES {price.toFixed(2)}
  </span>
  <ChangeIndicator value={changePct} />
</span>
```

### 17.7 Animation and Motion Specification

All animations respect `prefers-reduced-motion`. When reduced motion is preferred, instant transitions replace all animations.

| Animation | Trigger | Duration | Easing | Implementation |
|---|---|---|---|---|
| Page enter | Route change | 200ms | `ease-out` | Framer Motion `AnimatePresence` |
| Signal badge appear | New signal | 300ms | spring | `motion.div` with scale from 0.8→1 |
| Price change flash | Price update | 800ms | ease | Background flash green/red then back |
| Sidebar expand | Toggle | 200ms | ease-in-out | CSS transition on `width` |
| Chart load | Data fetch | 400ms | ease | Lightweight-charts built-in animation |
| Card hover | Hover | 150ms | ease | `hover:shadow-md, hover:-translate-y-0.5` |
| Loading skeleton | While loading | Loop | ease-in-out | `animate-pulse` Tailwind class |
| Confidence bar fill | Mount | 600ms | ease-out | CSS `transform: scaleX()` with transition |

### 17.8 Icon System

- **Library:** Lucide React (tree-shakeable, consistent 24px grid)
- **Custom icons:** SVG for NSE logo, custom chart indicators
- **Usage rules:**
  - All icon-only buttons require `aria-label`
  - Decorative icons get `aria-hidden="true"`
  - Signal icons: `TrendingUp` (BUY), `TrendingDown` (SELL), `Minus` (HOLD)
  - Navigation icons: consistent 20px size, 1.5px stroke
  - Data icons: 16px inline with text

### 17.9 Loading and Empty States

#### Loading States

Every async data component has three states: **loading**, **data**, **error**.

```typescript
// Skeleton pattern for all card components
function SignalCardSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 animate-pulse">
      <div className="h-4 w-16 rounded bg-neutral-200 mb-3" />
      <div className="h-6 w-24 rounded bg-neutral-200 mb-2" />
      <div className="h-4 w-full rounded bg-neutral-200 mb-1" />
      <div className="h-4 w-3/4 rounded bg-neutral-200" />
    </div>
  );
}
```

#### Empty States

Every list/table has a designed empty state (not just blank space).

```typescript
// Standard empty state with contextual messaging
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

// Examples:
// Signals page (no signals): 
//   title: "No signals generated yet"
//   description: "Signals are generated daily at 16:30 EAT after market close. Check back after today's session."

// Events page (no recent events):
//   title: "No events detected today"
//   description: "The event engine monitors for earnings, dividends, and market anomalies. All quiet for now."

// Watchlist (empty):
//   title: "Your watchlist is empty"
//   description: "Add stocks to your watchlist from the Stocks page to track them here."
//   action: { label: "Browse stocks", onClick: () => router.push('/stocks') }
```

---

## 18. Conversion Copy Architecture

> "Copy" in a financial dashboard serves trust, orientation, and action. Every word either builds confidence or loses it.

### 18.1 Voice and Tone Framework

| Context | Voice | Example |
|---|---|---|
| Signals | Authoritative, evidence-based, never hyperbolic | "Based on strong Q3 earnings (+22% YoY) and rising RSI momentum, the model favours accumulation." |
| Events | Factual, neutral, no editorialising | "Safaricom announced a KES 0.67 interim dividend for H1 2026, in line with prior year." |
| Errors | Reassuring, specific, actionable | "We couldn't load price data for EABL. This is usually a brief data delay — try refreshing in 30 seconds." |
| Empty states | Helpful, contextual, not apologetic | "No BUY signals today — the market was quiet. Daily analysis runs at 16:30 EAT." |
| Onboarding | Guiding, brief, outcome-focused | "Add stocks to your watchlist for personalised signal alerts." |
| Email subject lines | Specific, data-forward, no clickbait | "NSE Daily: 3 BUY signals, KCB earnings event — 17 Mar 2026" |

### 18.2 Landing Page Copy Architecture

**Headline:** Primary value proposition in ≤ 8 words.

```
Primary:   "AI Research for the Nairobi Securities Exchange"
Sub:       "Evidence-based BUY · HOLD · SELL signals, portfolio 
            recommendations, and event alerts — powered by AI and 
            grounded in NSE fundamentals."
CTA:       "Get Started Free" (primary) | "See a Signal Example" (secondary)
```

**Trust Section Copy:**

```
"Built on real data."
→ Prices from Yahoo Finance and NSE official feeds
→ Financial statements from company filings
→ News from Business Daily, Reuters Africa, and NSE announcements
→ Macro data from CBK, KNBS, and the World Bank
```

**Feature Block Copy (3 blocks):**

```
Block 1: "Know before the market moves."
         The event detection engine scans for earnings releases, dividend
         changes, and unusual price activity — flagging what matters before
         you miss it.

Block 2: "Signals you can trace."
         Every BUY, HOLD, or SELL signal includes its evidence: which
         financials drove it, what the news sentiment shows, where the
         price sits technically.

Block 3: "Your portfolio, optimised."
         The portfolio engine allocates capital across the strongest signals
         while respecting diversification limits. Rebalance suggestions
         arrive before Monday's open.
```

### 18.3 Dashboard Microcopy Specification

#### Signal Cards

```
Signal BUY, high confidence (≥0.80):
  Title:    "SCOM · BUY"
  Badge:    "High Conviction"
  Summary:  "Strong free cash flow growth and positive network expansion 
              news offset macro FX headwinds."
  Drivers:  "↑ FCF yield 8.2%  ·  ↑ Revenue +14% YoY  ·  ↑ Sentiment +0.72"

Signal SELL, moderate confidence (0.65–0.79):
  Title:    "EABL · SELL"
  Badge:    "Moderate Conviction"
  Summary:  "Elevated debt load, weakening consumer sentiment, and rising
              input costs pressure margins heading into H2."

Signal HOLD, low confidence (0.50–0.64):
  Title:    "KCB · HOLD"
  Badge:    "Watch Closely"
  Summary:  "Mixed signals — solid loan book growth but regulatory review
              of digital lending adds near-term uncertainty."
```

#### Event Cards

```
High-impact event:
  Badge:    "85 · HIGH IMPACT"
  Headline: "Equity Group H1 2026 Pre-Tax Profit +18% YoY"
  Tag:      "EQTY · EARNINGS · Positive"
  Source:   "NSE Filing ↗"

Low-impact event:
  Badge:    "35 · LOW IMPACT"
  Headline: "Nation Media Group appoints new Group CEO"
  Tag:      "NMG · LEADERSHIP · Uncertain"
```

#### Error Messages — Copy Specification

| Error Scenario | User-Facing Copy | Technical Log |
|---|---|---|
| API timeout | "Data is taking longer than usual to load. Refresh to try again — if this keeps happening, try again after market close." | `API_TIMEOUT: /api/signals after 10000ms` |
| No price data | "Price data for [TICKER] is temporarily unavailable. NSE market data updates every 15 minutes during trading hours (9:00–15:30 EAT)." | `PRICE_FETCH_FAILED: ticker=SCOM source=yahoo_finance` |
| Auth session expired | "Your session has expired for security. Sign in again to continue." | `JWT_EXPIRED: user_id=... exp=...` |
| Invalid ticker | "We don't have data for that ticker symbol. Browse the full NSE stocks list." | `TICKER_NOT_FOUND: ticker=XYZ` |
| Analysis unavailable | "AI analysis for [TICKER] is being generated. It will appear here after today's 16:30 EAT analysis run." | `ANALYSIS_PENDING: ticker=KGEN last_run=null` |
| Rate limit hit | "You're making requests very quickly. Please wait 60 seconds." | `RATE_LIMIT_EXCEEDED: ip=... count=62 window=60s` |

#### Onboarding Copy — Step by Step

```
Step 1 — Welcome:
  Title:   "Welcome to the NSE AI Research Platform"
  Body:    "You're looking at live AI-generated analysis for companies 
            listed on the Nairobi Securities Exchange. Here's what to 
            explore first."
  CTA:     "Start with your watchlist →"

Step 2 — Watchlist setup:
  Title:   "Pick your stocks"
  Body:    "Your watchlist personalises signal alerts and email reports. 
            You can always change it in Settings."
  Helper:  "Most investors start with 5–10 companies across 2–3 sectors."

Step 3 — Understanding signals:
  Title:   "Reading a signal"
  Body:    "Each signal shows the AI's recommendation (BUY/HOLD/SELL), 
            a confidence score, the key reasons behind it, and the main 
            risks. Click any signal for the full analysis."
  CTA:     "See your first signal →"

Step 4 — Email reports:
  Title:   "Stay informed automatically"
  Body:    "Turn on daily email reports to receive today's top signals 
            and market events at 18:30 EAT."
  Toggle:  "Enable daily digest" (default: ON)
```

### 18.4 Email Copy Templates

#### Daily Digest Subject Line Formula

```
Formula: "NSE Daily: [N BUY signals], [N events] — [Short Date]"
Examples:
  "NSE Daily: 3 BUY signals, 1 earnings event — 17 Mar 2026"
  "NSE Daily: SELL signal on EABL, CBK rate decision — 18 Mar 2026"
  "NSE Daily: Market quiet, portfolio on track — 19 Mar 2026"
```

#### Event Alert Subject Line Formula

```
Formula: "NSE Alert: [Company] — [Event Type] ([Impact Level])"
Examples:
  "NSE Alert: Safaricom — Earnings Beat, +12% YoY (High Impact)"
  "NSE Alert: KCB Group — Signal Change: HOLD → BUY (Moderate)"
  "NSE Alert: CBK Rate Decision — Base Rate Unchanged (Market-Wide)"
```

### 18.5 Confidence Score Copy Standards

Confidence scores must never be presented as raw numbers to end users without a plain-language frame. Never say "confidence: 0.83". Always say:

| Score | Display Label | Tooltip |
|---|---|---|
| 0.85–1.00 | "High Conviction" | "The model sees strong, consistent evidence from fundamentals, technicals, and news." |
| 0.70–0.84 | "Moderate Conviction" | "Good evidence in most areas, but some factors are mixed or uncertain." |
| 0.60–0.69 | "Low Conviction" | "Limited or conflicting evidence. Treat as a watch signal, not an action signal." |
| < 0.60 | "Watch Only" | "Not enough data to make a confident call. Consider waiting for the next analysis run." |

---

## 19. Interaction Systems Engineering

### 19.1 Application State Architecture

The application has four distinct state layers that must never be conflated:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Server State (SWR)                            │
│  Remote data: signals, prices, events, portfolio        │
│  Managed by: useSWR hooks, auto-revalidation            │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Global UI State (Zustand)                     │
│  Persisted UX: watchlist, theme, sidebar open           │
│  Managed by: Zustand store, localStorage sync           │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Page/Feature State (React useState)           │
│  Ephemeral: active filters, expanded cards, modals      │
│  Managed by: useState, useReducer per component         │
├─────────────────────────────────────────────────────────┤
│  Layer 4: URL State (Next.js router)                    │
│  Shareable: active tab, filter params, selected ticker  │
│  Managed by: useSearchParams, router.push               │
└─────────────────────────────────────────────────────────┘
```

### 19.2 Zustand Store Specification

```typescript
// store/useWatchlistStore.ts
interface WatchlistStore {
  tickers: string[];
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
  isWatched: (ticker: string) => boolean;
  reorderTickers: (from: number, to: number) => void;
}

// Persists to localStorage via Zustand persist middleware
export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      tickers: [],
      addTicker: (ticker) =>
        set((s) => ({
          tickers: s.tickers.includes(ticker)
            ? s.tickers
            : [...s.tickers, ticker],
        })),
      removeTicker: (ticker) =>
        set((s) => ({ tickers: s.tickers.filter((t) => t !== ticker) })),
      isWatched: (ticker) => get().tickers.includes(ticker),
      reorderTickers: (from, to) =>
        set((s) => {
          const arr = [...s.tickers];
          const [item] = arr.splice(from, 1);
          arr.splice(to, 0, item);
          return { tickers: arr };
        }),
    }),
    { name: 'watchlist-storage' }
  )
);

// store/useUIStore.ts
interface UIStore {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  signalFilter: 'ALL' | 'BUY' | 'SELL' | 'HOLD';
  minConfidence: number;
  setTheme: (theme: UIStore['theme']) => void;
  setSidebarOpen: (open: boolean) => void;
  setSignalFilter: (filter: UIStore['signalFilter']) => void;
  setMinConfidence: (score: number) => void;
}
```

### 19.3 URL State Patterns

All filterable/sortable list views must persist their state in the URL to enable sharing and deep-linking.

```typescript
// /signals page — URL state management
// URL: /signals?signal=BUY&min_confidence=0.75&sector=Banking&sort=confidence_desc

export default function SignalsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const signal = searchParams.get('signal') as SignalType || 'ALL';
  const minConf = parseFloat(searchParams.get('min_confidence') || '0');
  const sector  = searchParams.get('sector') || 'ALL';
  const sort    = searchParams.get('sort') || 'confidence_desc';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'ALL' || value === '0') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/signals?${params.toString()}`, { scroll: false });
  };

  // SWR key changes when URL params change, triggering re-fetch
  const { data: signals } = useSWR(
    `/api/signals?${searchParams.toString()}`,
    fetcher
  );
  // ...
}
```

### 19.4 Form Interaction Patterns

#### Settings / Preferences Form

```typescript
// Controlled form with optimistic update
function PreferencesForm({ preferences }: { preferences: UserPreferences }) {
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState(preferences);
  const [saved, setSaved] = useState(false);

  // Debounced auto-save on watchlist changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      await savePreferences(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
    return () => clearTimeout(timer);
  }, [form.watchlist]);

  // Immediate save for toggle/select changes
  const handleToggleChange = async (key: string, value: boolean) => {
    const updated = { ...form, [key]: value };
    setForm(updated);                   // Optimistic update
    await savePreferences(updated);     // Persist
  };
}
```

#### Filter Controls — Interaction Model

```typescript
// All filter controls:
// 1. Change is reflected immediately (no "Apply" button for single filters)
// 2. URL updates on every filter change (router.push with scroll: false)
// 3. "Clear all filters" resets URL params
// 4. Filter state persists on browser back/forward
// 5. Active filter count badge on mobile filter button

function SignalFilters() {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterChip
        label="Signal Type"
        options={['ALL', 'BUY', 'HOLD', 'SELL']}
        value={signalFilter}
        onChange={(v) => updateFilter('signal', v)}
      />
      <ConfidenceSlider
        min={0}
        max={1}
        step={0.05}
        value={minConfidence}
        onChange={(v) => updateFilter('min_confidence', v.toString())}
        label="Min Confidence"
      />
      <SectorSelect
        value={sectorFilter}
        onChange={(v) => updateFilter('sector', v)}
      />
      {hasActiveFilters && (
        <button onClick={clearAllFilters} className="text-sm text-accent">
          Clear all ({activeFilterCount})
        </button>
      )}
    </div>
  );
}
```

### 19.5 Real-Time Update Interactions

```typescript
// Price change flash animation on real-time update
function PriceDisplay({ ticker }: { ticker: string }) {
  const [flashClass, setFlashClass] = useState('');
  const prevPrice = useRef<number | null>(null);

  // Subscribe to Supabase Realtime for live prices
  useEffect(() => {
    const channel = supabase
      .channel(`price:${ticker}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'stock_prices',
        filter: `ticker=eq.${ticker}`
      }, (payload) => {
        const newPrice = payload.new.close_kes;
        if (prevPrice.current !== null) {
          const dir = newPrice > prevPrice.current ? 'flash-green' : 'flash-red';
          setFlashClass(dir);
          setTimeout(() => setFlashClass(''), 800);
        }
        prevPrice.current = newPrice;
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [ticker]);

  return (
    <span className={`transition-colors duration-200 ${flashClass}`}>
      KES {price.toFixed(2)}
    </span>
  );
}
```

### 19.6 Keyboard Navigation Map

| Key | Context | Action |
|---|---|---|
| `Tab` / `Shift+Tab` | Global | Navigate between focusable elements |
| `Enter` / `Space` | Signal card | Expand card / navigate to analysis |
| `Escape` | Modal / expanded card | Dismiss / collapse |
| `↑` / `↓` | Stock table | Navigate rows |
| `Enter` | Stock table row | Navigate to stock detail |
| `/` | Global | Focus search bar |
| `Ctrl/Cmd + K` | Global | Open command palette (future) |
| `←` / `→` | Price chart time range | Shift time range backward/forward |
| `+` / `-` | Price chart | Zoom in / out |

### 19.7 Optimistic UI Patterns

```typescript
// Watchlist add/remove — instant feedback, rollback on error
function WatchButton({ ticker }: { ticker: string }) {
  const { isWatched, addTicker, removeTicker } = useWatchlistStore();
  const watched = isWatched(ticker);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    // 1. Optimistic update (instant)
    if (watched) removeTicker(ticker);
    else addTicker(ticker);

    // 2. Persist to server
    setSaving(true);
    try {
      await api.post('/users/preferences', {
        watchlist: useWatchlistStore.getState().tickers
      });
    } catch {
      // 3. Rollback on error
      if (watched) addTicker(ticker);
      else removeTicker(ticker);
      toast.error('Failed to update watchlist. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <button onClick={toggle} disabled={saving} aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}>
      {saving ? <Spinner size="sm" /> : watched ? <Star fill="current" /> : <Star />}
    </button>
  );
}
```

### 19.8 Loading State Hierarchy

The loading experience is tiered to minimise perceived wait time:

```
1. Instant (0ms):
   - Navigation to new page (route starts loading)
   - Filter changes (stale data shown while new data loads)
   - Optimistic UI actions (watchlist, preferences)

2. Skeleton (0–300ms):
   - API data fetch in progress
   - Show full page skeleton matching expected content shape
   - No spinners on skeletons (they look like dead UI)

3. Progress indicator (>300ms):
   - Long-running operations (export CSV, generate report)
   - Show progress bar at top of page
   - Estimated time if known

4. Full blocking (authentication only):
   - Auth check on protected routes
   - Minimal skeleton with top progress bar
```

---

## 20. QA & Testing Engineering

### 20.1 Testing Philosophy

**The Testing Pyramid:**
```
         /\
        /  \
       / E2E \        ← Playwright: 20–30 critical user journeys
      /────────\
     /Integration\    ← Supertest + Vitest: all API endpoints + DB
    /──────────────\
   /    Unit Tests  \  ← Vitest (JS) + Pytest (Python): all business logic
  /──────────────────\
```

- **Unit tests** are fast, isolated, and abundant. Every function with logic gets a unit test.
- **Integration tests** verify that components connect correctly with real (test) databases.
- **E2E tests** verify critical user journeys work end-to-end in a real browser.

### 20.2 Python Worker Testing (Pytest)

#### Directory Structure

```
workers/tests/
├── conftest.py                    ← Fixtures: test DB, mock API clients
├── unit/
│   ├── test_price_validation.py   ← StockPriceRecord Pydantic validation
│   ├── test_event_detection.py    ← Z-score anomaly detection logic
│   ├── test_technical_analysis.py ← RSI, MACD calculation correctness
│   ├── test_fundamental_scoring.py ← Fundamental score computation
│   ├── test_portfolio_allocation.py ← Allocation algorithm correctness
│   └── test_signal_evaluation.py  ← Backtesting outcome classification
├── integration/
│   ├── test_price_ingestion.py    ← Full price fetch → DB pipeline
│   ├── test_news_ingestion.py     ← News fetch → sentiment → DB
│   ├── test_analysis_pipeline.py  ← Analysis run → result insert
│   └── test_portfolio_pipeline.py ← Signal read → allocation output
└── fixtures/
    ├── sample_prices.json
    ├── sample_news.json
    └── sample_financials.json
```

#### Unit Test Examples

```python
# tests/unit/test_event_detection.py
import pytest
import pandas as pd
from workers.events.detect_events import calculate_price_z_score, classify_price_event

class TestPriceAnomalyDetection:
    def test_normal_price_returns_no_event(self):
        """Prices within 1 std dev should not trigger events."""
        prices = [100.0] * 20 + [102.0]  # Tiny move
        z = calculate_price_z_score(prices)
        assert abs(z) < 2.5

    def test_large_spike_triggers_event(self):
        """Price > 2.5 std devs above mean should trigger PRICE_ANOMALY."""
        prices = [100.0] * 20 + [125.0]  # Large spike
        z = calculate_price_z_score(prices)
        assert z > 2.5

    def test_large_drop_triggers_sell_event(self):
        """Price > 2.5 std devs below mean should trigger negative event."""
        prices = [100.0] * 20 + [75.0]   # Large drop
        z = calculate_price_z_score(prices)
        assert z < -2.5

    def test_volume_spike_elevates_impact_score(self):
        """Concurrent volume spike should increase impact score by 15."""
        base_impact = 45
        volume_z = 2.5
        final = classify_price_event(base_impact, volume_z_score=volume_z)
        assert final.impact_score == min(100, base_impact + 15)

    def test_impact_score_capped_at_100(self):
        """Impact score must never exceed 100."""
        base_impact = 95
        volume_z = 3.0
        final = classify_price_event(base_impact, volume_z_score=volume_z)
        assert final.impact_score <= 100

    @pytest.mark.parametrize("prices,expected_z_range", [
        ([100] * 19 + [100], (-0.5, 0.5)),      # No change
        ([100] * 19 + [105], (0.5, 2.5)),        # Small rise
        ([100] * 19 + [130], (2.5, float('inf'))), # Large rise
    ])
    def test_z_score_parametric(self, prices, expected_z_range):
        z = calculate_price_z_score(prices)
        assert expected_z_range[0] <= z <= expected_z_range[1]


# tests/unit/test_portfolio_allocation.py
class TestPortfolioAllocation:
    def test_sector_cap_enforced(self):
        """No sector should exceed 35% of portfolio."""
        signals = [
            Signal(ticker="EQTY", signal="BUY", confidence=0.90, sector="Banking"),
            Signal(ticker="KCB",  signal="BUY", confidence=0.88, sector="Banking"),
            Signal(ticker="COOP", signal="BUY", confidence=0.85, sector="Banking"),
            Signal(ticker="SCOM", signal="BUY", confidence=0.80, sector="Telco"),
        ]
        allocation = compute_allocation(signals)
        banking_total = sum(h.weight_pct for h in allocation.holdings if h.sector == "Banking")
        assert banking_total <= 35.0

    def test_single_stock_cap_enforced(self):
        """No single stock should exceed 20% of portfolio."""
        signals = [Signal(ticker="SCOM", signal="BUY", confidence=0.99, sector="Telco")]
        allocation = compute_allocation(signals)
        assert allocation.holdings[0].weight_pct <= 20.0

    def test_cash_buffer_minimum(self):
        """Cash buffer should be at least 10%."""
        signals = [Signal(ticker=f"T{i}", signal="BUY", confidence=0.9, sector="X")
                   for i in range(10)]
        allocation = compute_allocation(signals)
        assert allocation.cash_buffer_pct >= 10.0

    def test_weights_sum_to_100(self):
        """All weights including cash must sum to exactly 100%."""
        signals = [Signal(ticker="EQTY", signal="BUY", confidence=0.85, sector="Banking")]
        allocation = compute_allocation(signals)
        total = sum(h.weight_pct for h in allocation.holdings) + allocation.cash_buffer_pct
        assert abs(total - 100.0) < 0.01  # Float tolerance
```

#### Integration Test Example

```python
# tests/integration/test_price_ingestion.py
import pytest
from unittest.mock import patch, MagicMock
from workers.data.fetch_prices import PriceIngestionService

@pytest.fixture
def mock_supabase():
    """Returns a mock Supabase client that records upsert calls."""
    client = MagicMock()
    client.table.return_value.upsert.return_value.execute.return_value.data = [{}]
    return client

@pytest.fixture
def mock_yfinance_data():
    """Returns realistic yfinance DataFrame for SCOM.NR."""
    import pandas as pd
    return pd.DataFrame({
        'Open': [24.00], 'High': [24.50], 'Low': [23.80],
        'Close': [24.25], 'Volume': [1500000]
    }, index=pd.to_datetime(['2026-03-17 09:15:00+03:00']))

class TestPriceIngestion:
    def test_successful_ingestion(self, mock_supabase, mock_yfinance_data):
        with patch('yfinance.download', return_value=mock_yfinance_data):
            service = PriceIngestionService(mock_supabase)
            result = service.run(['SCOM.NR'])
            assert result['inserted'] == 1
            assert result['errors'] == []

    def test_invalid_price_rejected(self, mock_supabase):
        """Negative prices should be rejected and not inserted."""
        bad_data = MagicMock()
        bad_data.__iter__ = lambda s: iter([('SCOM.NR', pd.Series({'Close': -1.0}))])
        with patch('yfinance.download', return_value=bad_data):
            service = PriceIngestionService(mock_supabase)
            result = service.run(['SCOM.NR'])
            assert result['inserted'] == 0
            assert len(result['errors']) == 1

    def test_duplicate_handling(self, mock_supabase, mock_yfinance_data):
        """Duplicate prices should use upsert, not raise errors."""
        mock_supabase.table.return_value.upsert.return_value.execute.return_value.data = []
        with patch('yfinance.download', return_value=mock_yfinance_data):
            service = PriceIngestionService(mock_supabase)
            result = service.run(['SCOM.NR'])
            # Should complete without exception even on duplicate
            assert 'errors' in result
```

### 20.3 Node.js API Testing (Vitest + Supertest)

```typescript
// api/src/routes/__tests__/signals.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../server';

const app = buildApp({ testing: true });
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  await app.ready();
  request = supertest(app.server);
});

afterAll(() => app.close());

// Mock JWT validation for protected routes
vi.mock('../plugins/auth', () => ({
  validateJWT: vi.fn().mockResolvedValue({ id: 'test-user', role: 'analyst' })
}));

describe('GET /signals', () => {
  it('returns 200 with signals array', async () => {
    const res = await request
      .get('/signals')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filters by signal type', async () => {
    const res = await request
      .get('/signals?signal=BUY')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    res.body.data.forEach((s: any) => {
      expect(s.signal).toBe('BUY');
    });
  });

  it('rejects invalid signal filter', async () => {
    const res = await request
      .get('/signals?signal=INVALID')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('type');  // RFC 7807
  });

  it('returns 401 without auth token', async () => {
    const res = await request.get('/signals');
    expect(res.status).toBe(401);
  });

  it('rate limits after 60 requests', async () => {
    const requests = Array(61).fill(null).map(() =>
      request.get('/health')  // unauthenticated endpoint
    );
    const responses = await Promise.all(requests);
    const tooManyRequests = responses.filter(r => r.status === 429);
    expect(tooManyRequests.length).toBeGreaterThan(0);
  });
});

describe('GET /stocks/:ticker', () => {
  it('returns 200 for valid ticker', async () => {
    const res = await request
      .get('/stocks/SCOM')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('ticker', 'SCOM');
  });

  it('returns 404 for unknown ticker', async () => {
    const res = await request
      .get('/stocks/INVALID_TICKER')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(404);
  });

  it('sanitises ticker input', async () => {
    // SQL injection attempt
    const res = await request
      .get("/stocks/SCOM'; DROP TABLE companies;--")
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(400);
  });
});
```

### 20.4 Frontend Component Testing (Vitest + React Testing Library)

```typescript
// frontend/components/__tests__/SignalCard.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SignalCard } from '../signals/SignalCard';

const mockBuySignal = {
  ticker: 'SCOM',
  signal: 'BUY' as const,
  confidence_score: 0.87,
  price_target_kes: 28.50,
  key_drivers: ['Strong FCF', 'Revenue growth +14%', 'Positive sentiment'],
  major_risks: ['FX headwinds', 'Regulatory risk'],
  evidence_summary: 'Strong fundamentals support accumulation.',
  generated_at: '2026-03-17T16:30:00Z',
};

describe('SignalCard', () => {
  it('renders ticker and signal type', () => {
    render(<SignalCard signal={mockBuySignal} />);
    expect(screen.getByText('SCOM')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
  });

  it('shows confidence as readable label', () => {
    render(<SignalCard signal={mockBuySignal} />);
    expect(screen.getByText('High Conviction')).toBeInTheDocument();
    // Should NOT show raw "0.87" to users
    expect(screen.queryByText('0.87')).not.toBeInTheDocument();
  });

  it('is accessible with correct ARIA labels', () => {
    render(<SignalCard signal={mockBuySignal} />);
    const badge = screen.getByLabelText(/Signal: BUY with.*confidence/i);
    expect(badge).toBeInTheDocument();
  });

  it('expands to show drivers and risks on click', async () => {
    const user = userEvent.setup();
    render(<SignalCard signal={mockBuySignal} />);
    
    // Drivers not visible initially
    expect(screen.queryByText('Strong FCF')).not.toBeInTheDocument();
    
    await user.click(screen.getByRole('button', { name: /expand/i }));
    
    expect(screen.getByText('Strong FCF')).toBeInTheDocument();
    expect(screen.getByText('FX headwinds')).toBeInTheDocument();
  });

  it('renders SELL signal with correct color class', () => {
    const sellSignal = { ...mockBuySignal, signal: 'SELL' as const };
    render(<SignalCard signal={sellSignal} />);
    const badge = screen.getByTestId('signal-badge');
    expect(badge).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('calls onWatchToggle when watch button clicked', async () => {
    const onWatchToggle = vi.fn();
    const user = userEvent.setup();
    render(<SignalCard signal={mockBuySignal} onWatchToggle={onWatchToggle} />);
    
    await user.click(screen.getByRole('button', { name: /watchlist/i }));
    expect(onWatchToggle).toHaveBeenCalledWith('SCOM');
  });
});
```

### 20.5 E2E Testing (Playwright)

```typescript
// e2e/tests/signals.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Signals Page', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL!);
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD!);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('can filter signals by type', async ({ page }) => {
    await page.goto('/signals');
    await page.waitForSelector('[data-testid="signal-card"]');

    // Click BUY filter
    await page.click('[data-testid="filter-BUY"]');
    await page.waitForURL(/\?.*signal=BUY/);

    // All visible signal badges should be BUY
    const badges = await page.locator('[data-testid="signal-badge"]').all();
    for (const badge of badges) {
      await expect(badge).toHaveText('BUY');
    }
  });

  test('navigates to analysis detail on signal click', async ({ page }) => {
    await page.goto('/signals');
    await page.waitForSelector('[data-testid="signal-card"]');
    
    const firstCard = page.locator('[data-testid="signal-card"]').first();
    const ticker = await firstCard.getAttribute('data-ticker');
    
    await firstCard.click();
    await page.waitForURL(`/analysis/${ticker}`);
    await expect(page.locator('h1')).toContainText(ticker!);
  });

  test('shows empty state when no signals match filter', async ({ page }) => {
    // Use an extreme filter that should return no results
    await page.goto('/signals?signal=BUY&min_confidence=0.99');
    await page.waitForSelector('[data-testid="empty-state"]');
    await expect(page.locator('[data-testid="empty-state-title"]'))
      .toContainText('No signals');
  });
});

// e2e/tests/auth.spec.ts
test.describe('Authentication', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
  });

  test('logs out and redirects to landing', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL!);
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD!);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    // Log out
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL('/');
  });
});
```

### 20.6 Test Coverage Requirements

| Service | Target Coverage | Critical Paths (must be 100%) |
|---|---|---|
| Python workers (unit) | ≥ 80% | Price validation, Z-score detection, portfolio allocation caps |
| Python workers (integration) | ≥ 60% | Ingestion pipelines, analysis pipeline |
| Node.js API (unit) | ≥ 85% | Auth validation, input sanitisation, error handling |
| Node.js API (integration) | ≥ 70% | All REST endpoints |
| Frontend components (unit) | ≥ 70% | SignalCard, PriceChart, EventCard, AuthForm |
| E2E | 25 critical journeys | Login, view signals, filter, navigate to detail, logout |

### 20.7 CI/CD Testing Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  python-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: nse_test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r workers/requirements.txt
      - run: pip install pytest pytest-cov pytest-asyncio
      - run: |
          cd workers
          pytest tests/unit/ -v --cov=. --cov-report=xml
          pytest tests/integration/ -v
      - uses: codecov/codecov-action@v4

  node-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd api && npm ci
      - run: cd api && npm run test:coverage
      - run: cd frontend && npm ci
      - run: cd frontend && npm run test:coverage

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [python-tests, node-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci && npx playwright install --with-deps
      - run: |
          cd frontend
          npm run build
          npm run start &
          npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### 20.8 Performance Testing

```typescript
// k6 load test for API endpoints
// k6 run load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m',  target: 10 },   // Stay at 10 for 1 min
    { duration: '30s', target: 50 },   // Ramp to 50 users
    { duration: '1m',  target: 50 },   // Stay at 50 for 1 min
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests < 500ms
    http_req_failed:   ['rate<0.01'],   // < 1% failure rate
  },
};

export default function () {
  const res = http.get('https://api.nse-platform.example.com/signals', {
    headers: { Authorization: `Bearer ${__ENV.TEST_JWT}` }
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

**Performance Targets:**

| Endpoint | P95 Latency | P99 Latency | Max Throughput |
|---|---|---|---|
| `GET /signals` | < 300ms | < 500ms | 100 req/s |
| `GET /stocks/:ticker` | < 200ms | < 400ms | 150 req/s |
| `GET /stocks/:ticker/prices` | < 400ms | < 800ms | 50 req/s |
| `GET /events` | < 250ms | < 450ms | 100 req/s |
| `GET /portfolio/latest` | < 150ms | < 300ms | 100 req/s |
| `GET /health` | < 50ms | < 100ms | 500 req/s |

---

## 21. Security Architecture — Deep Specification

### 21.1 Threat Model

Using the STRIDE framework:

| Threat | Vector | Mitigation |
|---|---|---|
| **S**poofing | Forged JWTs, session hijack | RS256 JWT with short expiry; httpOnly cookies; token rotation |
| **T**ampering | SQL injection, request body manipulation | Parameterised queries; Zod validation; input length limits |
| **R**epudiation | Unauthenticated actions, no audit trail | All writes logged with `user_id`, `timestamp`, `action`; immutable audit log |
| **I**nformation Disclosure | Verbose error messages, sensitive data in logs | Generic prod errors; PII scrubbed from logs; no secrets in responses |
| **D**enial of Service | Rate-limit bypass, DB query flooding | Per-IP and per-user rate limits; query complexity limits; circuit breakers |
| **E**levation of Privilege | Role bypass, IDOR via ticker param | RLS on all tables; role checked server-side; no user-controlled role claim |

### 21.2 Authentication Architecture

#### JWT Flow

```
User Login
   │
   ▼
Supabase Auth validates credentials
   │
   ▼
Issues: access_token (1hr TTL, RS256)
        refresh_token (7-day TTL, rotated on use)
   │
   ▼
Frontend stores:
  - access_token → memory only (never localStorage)
  - refresh_token → httpOnly, Secure, SameSite=Strict cookie
   │
   ▼
API request: Authorization: Bearer {access_token}
   │
   ▼
Node.js API: validates JWT signature with Supabase public key
             checks exp claim
             extracts user_id and role
   │
   ▼
Supabase query: passes JWT in Authorization header
                RLS uses auth.uid() to filter rows
```

#### Token Security Rules

```typescript
// NEVER store access token in localStorage (XSS accessible)
// NEVER store refresh token in JS-accessible storage

// Correct: Store access token in memory only
let accessToken: string | null = null;

// Correct: Refresh token in httpOnly cookie (set by Supabase Auth)
// This happens automatically with Supabase SSR setup

// Token refresh: Use supabase-js auto-refresh (handles expiry transparently)
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
// supabase-js v2 automatically refreshes access tokens before expiry
```

### 21.3 API Security Controls — Implementation

#### Rate Limiting with User Context

```typescript
// Tiered rate limiting: unauthenticated < authenticated < admin
import rateLimit from '@fastify/rate-limit';

// Public endpoints (health check, etc.)
fastify.register(rateLimit, {
  max: 60,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
});

// Authenticated endpoints
fastify.addHook('preHandler', async (request, reply) => {
  if (request.user?.role === 'admin') return; // Admin: no rate limit
  
  const key = `rate:${request.user?.id || request.ip}`;
  const limit = request.user ? 200 : 60;
  
  const current = await redisIncr(key, 60); // 60s window
  if (current > limit) {
    reply.header('Retry-After', '60');
    reply.status(429).send({
      type: 'https://nse-platform/errors/rate-limit',
      title: 'Too Many Requests',
      status: 429,
      detail: `Rate limit of ${limit} requests per minute exceeded.`,
      instance: request.url,
    });
  }
});
```

#### Input Validation with Zod

```typescript
// All route schemas defined upfront — Fastify validates before handler runs
const signalsSchema = {
  querystring: z.object({
    signal: z.enum(['BUY', 'HOLD', 'SELL', 'ALL']).optional(),
    min_confidence: z.coerce.number().min(0).max(1).optional(),
    sector: z.string().max(50).regex(/^[a-zA-Z\s&]+$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    page: z.coerce.number().int().min(1).default(1),
  }),
};

// Ticker path parameter — strict whitelist validation
const tickerSchema = z.string()
  .min(2).max(10)
  .regex(/^[A-Z]+$/, 'Ticker must be uppercase letters only');
```

#### SQL Injection Prevention

```typescript
// ALWAYS use parameterised queries — never string interpolation
// Correct:
const { data } = await supabase
  .from('analysis_results')
  .select('*')
  .eq('ticker', ticker)       // Supabase-js parameterises automatically
  .eq('signal', signal)
  .gte('confidence_score', minConf)
  .order('generated_at', { ascending: false })
  .limit(limit)
  .range(offset, offset + limit - 1);

// For raw SQL (use postgres npm package with tagged template literals):
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!);

const results = await sql`
  SELECT * FROM analysis_results
  WHERE ticker = ${ticker}           -- Parameterised, safe
    AND confidence_score >= ${minConf}
  ORDER BY generated_at DESC
  LIMIT ${limit}
`;

// NEVER do this:
const DANGEROUS = `SELECT * FROM analysis_results WHERE ticker = '${ticker}'`;
```

### 21.4 Supabase Row Level Security Policies

```sql
-- ─── stock_prices: read-only for all authenticated users ───────────────────
ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_read_authenticated ON stock_prices
  FOR SELECT
  TO authenticated
  USING (true);   -- All authenticated users can read all price data

-- ─── analysis_results: read for authenticated, write only for service role ─
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY ar_read_authenticated ON analysis_results
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY ar_write_service_only ON analysis_results
  FOR INSERT
  TO service_role
  USING (true);

-- ─── user_preferences: users can only read/write their own rows ─────────────
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY up_own_user ON user_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── users: users can read their own record; admin can read all ─────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY u_own_read ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY u_admin_read ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── email_logs: admin only ─────────────────────────────────────────────────
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY el_admin_only ON email_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 21.5 HTTP Security Headers

```typescript
// Set via Vercel headers config (vercel.json) and Node.js API (Fastify hooks)

// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-DNS-Prefetch-Control", "value": "on" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'nonce-{nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
  ]
}
```

### 21.6 Secrets Management

```
Secret Lifecycle:
  Generation → Storage → Injection → Rotation → Revocation

Generation:
  - All secrets generated with cryptographically secure RNG
  - Minimum entropy: API keys 256 bits, DB passwords 128 bits
  - Never use human-memorable strings as secrets

Storage:
  - Vercel: Project environment variables (encrypted at rest)
  - Railway: Service variables (encrypted at rest)
  - GitHub: Repository secrets (never visible after setting)
  - Local dev: .env.local (in .gitignore, never committed)
  - NEVER: .env committed to git, secrets in code, secrets in logs

Injection:
  - Python workers: os.environ.get() with required validation
  - Node.js API: process.env with Zod validation at startup
  - Frontend: Only NEXT_PUBLIC_ prefixed vars (non-sensitive only)

Rotation schedule:
  - Anthropic API key: Every 90 days
  - Supabase service role key: Every 90 days
  - Resend API key: Every 180 days
  - JWT secrets: Every 30 days (via Supabase key rotation)

Revocation:
  - Immediately on suspected compromise
  - On team member departure (if credentials were shared)
  - Automated via Supabase dashboard or CLI
```

```python
# Python startup validation — fail fast if secrets missing
import os
from pydantic import BaseSettings, validator

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    ANTHROPIC_API_KEY: str
    DATABASE_URL: str

    @validator('ANTHROPIC_API_KEY')
    def validate_anthropic_key(cls, v):
        if not v.startswith('sk-ant-'):
            raise ValueError('Invalid Anthropic API key format')
        return v

    class Config:
        env_file = '.env'

try:
    settings = Settings()
except Exception as e:
    print(f"FATAL: Missing required environment variables: {e}")
    raise SystemExit(1)
```

### 21.7 Data Privacy and PII Handling

```
PII Inventory:
  - users.email: Required for auth. Not included in logs.
  - user_preferences: Watchlist is preferences only, not financial advice.

Data minimisation rules:
  - Never store full names (not required)
  - Never store IP addresses beyond access logs (7-day retention)
  - Never log email addresses (log user_id only)
  - Never include PII in error messages or Sentry traces

Log sanitisation:
  - Structured logs use user_id, never email
  - Access logs anonymised after 7 days
  - No PII in Supabase query logs

Data retention:
  - stock_prices: Indefinite (financial time series)
  - news_articles: 2 years
  - analysis_results: Indefinite (for backtesting)
  - email_logs: 90 days
  - user_preferences: Until account deletion
  - auth.users: Until account deletion + 30-day grace period

Account deletion:
  - Cascade delete on user_preferences, email_logs
  - Anonymise watchlist data (replace user_id with 'deleted')
  - Retain anonymised analysis data for aggregate statistics
```

### 21.8 Audit Logging

```sql
-- Immutable audit log table
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID,           -- nullable for system actions
  action      TEXT NOT NULL,  -- e.g. 'signals.view', 'portfolio.export'
  resource    TEXT,           -- e.g. 'signals', 'analysis:SCOM'
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB,          -- sanitised (no PII, no secrets)
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Append-only: revoke UPDATE and DELETE for all roles
REVOKE UPDATE, DELETE ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON audit_log FROM service_role;

-- Index for admin queries
CREATE INDEX idx_audit_user_date ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action, created_at DESC);
```

```typescript
// Node.js: Log all authenticated actions
async function logAction(req: FastifyRequest, action: string, resource?: string) {
  await supabaseAdmin.from('audit_log').insert({
    user_id: req.user?.id,
    action,
    resource,
    ip_address: req.ip,
    user_agent: req.headers['user-agent']?.substring(0, 200),
    metadata: { method: req.method, path: req.routerPath },
  });
}
```

### 21.9 Vulnerability Management

#### OWASP Top 10 Checklist

| # | Vulnerability | Status | Controls |
|---|---|---|---|
| A01 | Broken Access Control | ✓ Mitigated | RLS on all tables; role checked server-side; Zod validates all inputs |
| A02 | Cryptographic Failures | ✓ Mitigated | HTTPS enforced; JWT RS256; secrets not in code; httpOnly cookies |
| A03 | Injection | ✓ Mitigated | Parameterised queries; Zod input validation; Supabase-js safe query builder |
| A04 | Insecure Design | ✓ Mitigated | STRIDE threat model; defence-in-depth; RLS as last line of defence |
| A05 | Security Misconfiguration | ✓ Mitigated | CSP headers; secure defaults; no debug mode in prod; secrets validated at startup |
| A06 | Vulnerable Components | ⚠ Ongoing | `npm audit` in CI; `pip-audit` in CI; Dependabot on GitHub repo |
| A07 | Auth Failures | ✓ Mitigated | Supabase Auth; brute-force lockout; short JWT TTL; refresh token rotation |
| A08 | Software/Data Integrity | ✓ Mitigated | GitHub Actions signed commits; no untrusted third-party scripts |
| A09 | Security Logging | ✓ Mitigated | Audit log table; structured logs; no PII in logs |
| A10 | SSRF | ✓ Mitigated | No user-controlled URLs in server-side requests; allowlisted external domains |

#### Dependency Scanning in CI

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: '0 8 * * 1'  # Every Monday 8:00 UTC
  push:
    branches: [main]

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd api && npm audit --audit-level=high
      - run: cd frontend && npm audit --audit-level=high

  pip-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install pip-audit
      - run: cd workers && pip-audit -r requirements.txt

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
```

### 21.10 Incident Response Plan

| Severity | Definition | Response Time | Actions |
|---|---|---|---|
| P1 — Critical | Data breach, auth bypass, DB exposed | < 1 hour | Revoke all API keys immediately; notify users; audit access logs; patch and redeploy |
| P2 — High | API unavailable, mass auth failures, rate limit bypass | < 4 hours | Investigate; apply hotfix; communicate ETA to users |
| P3 — Medium | Elevated error rates, stale data, email failures | < 24 hours | Root cause analysis; fix in next deployment |
| P4 — Low | Single-user issue, minor UI bug | < 1 week | Add to backlog; fix in regular sprint |

```
Incident Response Contacts:
  Primary: Platform owner (solo dev) — immediate response
  Data breach escalation: Supabase support + Anthropic API revocation
  Domain incident: Namecheap support
  Hosting incident: Vercel/Railway status pages
```

---

*End of NSE AI Research Platform — Master Technical Architecture & Engineering Specification*
*v2.0 | March 2026 | CONFIDENTIAL*
