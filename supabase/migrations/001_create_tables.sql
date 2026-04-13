-- Migration 001: Create nse schema and all core tables
-- All NSE AI Tracker tables are isolated under the `nse` schema
-- to avoid conflicts with existing tables in this Supabase project.

CREATE SCHEMA IF NOT EXISTS nse;

-- ── companies ─────────────────────────────────────────────────────────────
CREATE TABLE nse.companies (
  ticker          TEXT        PRIMARY KEY,                 -- e.g. 'SCOM'
  name            TEXT        NOT NULL,
  sector          TEXT        NOT NULL,
  market_cap_b    NUMERIC(10,2),                           -- KES billions
  high_52w        NUMERIC(10,2),
  low_52w         NUMERIC(10,2),
  listing_date    DATE,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── stock_prices ──────────────────────────────────────────────────────────
CREATE TABLE nse.stock_prices (
  id          BIGSERIAL   PRIMARY KEY,
  ticker      TEXT        NOT NULL REFERENCES nse.companies(ticker) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  open        NUMERIC(10,2),
  high        NUMERIC(10,2),
  low         NUMERIC(10,2),
  close       NUMERIC(10,2) NOT NULL,
  volume      BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticker, date)
);

-- ── financials ────────────────────────────────────────────────────────────
CREATE TABLE nse.financials (
  id              BIGSERIAL   PRIMARY KEY,
  ticker          TEXT        NOT NULL REFERENCES nse.companies(ticker) ON DELETE CASCADE,
  period          TEXT        NOT NULL,                    -- e.g. 'Q1-2026', 'FY-2025'
  period_type     TEXT        NOT NULL CHECK (period_type IN ('quarterly','annual')),
  revenue         BIGINT,                                  -- KES thousands
  net_income      BIGINT,
  total_assets    BIGINT,
  total_equity    BIGINT,
  eps             NUMERIC(10,4),
  pe_ratio        NUMERIC(10,2),
  dividend_yield  NUMERIC(6,4),
  source_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticker, period, period_type)
);

-- ── news_articles ─────────────────────────────────────────────────────────
CREATE TABLE nse.news_articles (
  id              BIGSERIAL   PRIMARY KEY,
  ticker          TEXT        REFERENCES nse.companies(ticker) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  content         TEXT,
  summary         TEXT,
  source          TEXT,
  url             TEXT        UNIQUE,
  published_at    TIMESTAMPTZ,
  sentiment_score NUMERIC(4,3) CHECK (sentiment_score BETWEEN -1 AND 1),
  is_processed    BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── detected_events ───────────────────────────────────────────────────────
CREATE TABLE nse.detected_events (
  id              BIGSERIAL   PRIMARY KEY,
  ticker          TEXT        NOT NULL REFERENCES nse.companies(ticker) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,                    -- e.g. 'price_spike','volume_surge'
  severity        TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  description     TEXT        NOT NULL,
  metadata        JSONB,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

-- ── analysis_results ──────────────────────────────────────────────────────
CREATE TABLE nse.analysis_results (
  id              BIGSERIAL   PRIMARY KEY,
  ticker          TEXT        NOT NULL REFERENCES nse.companies(ticker) ON DELETE CASCADE,
  signal          TEXT        NOT NULL CHECK (signal IN ('BUY','HOLD','SELL')),
  confidence      INTEGER     NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  summary         TEXT        NOT NULL,
  key_factors     TEXT[]      NOT NULL DEFAULT '{}',
  risks           TEXT[]      NOT NULL DEFAULT '{}',
  target_price    NUMERIC(10,2),
  time_horizon    TEXT,
  raw_context     JSONB,
  model_used      TEXT        NOT NULL DEFAULT 'claude-sonnet-4-5',
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── portfolio_allocations ─────────────────────────────────────────────────
CREATE TABLE nse.portfolio_allocations (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker      TEXT        NOT NULL REFERENCES nse.companies(ticker) ON DELETE CASCADE,
  weight      NUMERIC(5,4) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  rationale   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticker)
);

-- ── signal_evaluations ────────────────────────────────────────────────────
CREATE TABLE nse.signal_evaluations (
  id              BIGSERIAL   PRIMARY KEY,
  analysis_id     BIGINT      NOT NULL REFERENCES nse.analysis_results(id) ON DELETE CASCADE,
  ticker          TEXT        NOT NULL REFERENCES nse.companies(ticker) ON DELETE CASCADE,
  price_at_signal NUMERIC(10,2) NOT NULL,
  price_at_eval   NUMERIC(10,2),
  evaluated_at    TIMESTAMPTZ,
  outcome         TEXT        CHECK (outcome IN ('correct','incorrect','partial')),
  pct_change      NUMERIC(8,4),
  notes           TEXT
);

-- ── users (mirrors auth.users, stores app-level profile) ─────────────────
CREATE TABLE nse.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','analyst','admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── user_preferences ──────────────────────────────────────────────────────
CREATE TABLE nse.user_preferences (
  user_id         UUID    PRIMARY KEY REFERENCES nse.users(id) ON DELETE CASCADE,
  watchlist       TEXT[]  NOT NULL DEFAULT '{}',
  email_digest    BOOLEAN NOT NULL DEFAULT true,
  email_alerts    BOOLEAN NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── email_logs ────────────────────────────────────────────────────────────
CREATE TABLE nse.email_logs (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        REFERENCES nse.users(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL,                        -- 'daily_digest','weekly_review','alert'
  subject     TEXT        NOT NULL,
  status      TEXT        NOT NULL CHECK (status IN ('sent','failed','queued')),
  resend_id   TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── macro_indicators ──────────────────────────────────────────────────────
CREATE TABLE nse.macro_indicators (
  id              BIGSERIAL   PRIMARY KEY,
  indicator       TEXT        NOT NULL,                    -- e.g. 'CBK_RATE','USD_KES','CPI'
  value           NUMERIC(12,4) NOT NULL,
  unit            TEXT,
  recorded_at     DATE        NOT NULL,
  source          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (indicator, recorded_at)
);
