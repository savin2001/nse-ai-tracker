-- Migration 002: Indexes for query performance

-- stock_prices — time-series lookups by ticker
CREATE INDEX idx_nse_prices_ticker_date
  ON nse.stock_prices (ticker, date DESC);

-- analysis_results — latest signals per ticker
CREATE INDEX idx_nse_analysis_ticker_date
  ON nse.analysis_results (ticker, generated_at DESC);

-- analysis_results — filter by signal type
CREATE INDEX idx_nse_analysis_signal
  ON nse.analysis_results (signal, generated_at DESC);

-- news_articles — unprocessed news queue
CREATE INDEX idx_nse_news_unprocessed
  ON nse.news_articles (is_processed, published_at DESC)
  WHERE is_processed = false;

-- news_articles — per-ticker news feed
CREATE INDEX idx_nse_news_ticker_date
  ON nse.news_articles (ticker, published_at DESC);

-- detected_events — unresolved events
CREATE INDEX idx_nse_events_ticker_date
  ON nse.detected_events (ticker, detected_at DESC);

CREATE INDEX idx_nse_events_unresolved
  ON nse.detected_events (severity, detected_at DESC)
  WHERE resolved_at IS NULL;

-- portfolio_allocations — per-user portfolio
CREATE INDEX idx_nse_portfolio_user
  ON nse.portfolio_allocations (user_id);

-- macro_indicators — time-series lookups
CREATE INDEX idx_nse_macro_indicator_date
  ON nse.macro_indicators (indicator, recorded_at DESC);

-- analysis_results — full-text search on raw_context
CREATE INDEX idx_nse_analysis_raw_context
  ON nse.analysis_results USING GIN (raw_context);
