-- Migration 003: Row Level Security policies
-- All tables in nse schema have RLS enabled.
-- Authenticated users can read market data; only service_role can write.

-- ── Enable RLS on all tables ──────────────────────────────────────────────
ALTER TABLE nse.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.stock_prices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.financials           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.news_articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.detected_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.analysis_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.portfolio_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.signal_evaluations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.email_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nse.macro_indicators     ENABLE ROW LEVEL SECURITY;

-- ── Public market data: any authenticated user can read ───────────────────
CREATE POLICY "nse_companies_read"
  ON nse.companies FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "nse_stock_prices_read"
  ON nse.stock_prices FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "nse_financials_read"
  ON nse.financials FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "nse_news_read"
  ON nse.news_articles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "nse_events_read"
  ON nse.detected_events FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "nse_analysis_read"
  ON nse.analysis_results FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "nse_signal_eval_read"
  ON nse.signal_evaluations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "nse_macro_read"
  ON nse.macro_indicators FOR SELECT
  TO authenticated USING (true);

-- ── User data: users can only access their own rows ───────────────────────
CREATE POLICY "nse_users_read_own"
  ON nse.users FOR SELECT
  TO authenticated USING (id = auth.uid());

CREATE POLICY "nse_users_insert_own"
  ON nse.users FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "nse_preferences_read_own"
  ON nse.user_preferences FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "nse_preferences_write_own"
  ON nse.user_preferences FOR ALL
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "nse_portfolio_read_own"
  ON nse.portfolio_allocations FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "nse_email_logs_read_own"
  ON nse.email_logs FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- ── service_role bypass: workers and API write via service_role ───────────
-- (service_role implicitly bypasses RLS in Supabase — no explicit policy needed)
-- The following grants ensure the anon/authenticated roles cannot write
-- to shared market tables directly:

REVOKE INSERT, UPDATE, DELETE
  ON nse.companies, nse.stock_prices, nse.financials,
     nse.news_articles, nse.detected_events, nse.analysis_results,
     nse.signal_evaluations, nse.macro_indicators
  FROM authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON nse.companies, nse.stock_prices, nse.financials,
     nse.news_articles, nse.detected_events, nse.analysis_results,
     nse.signal_evaluations, nse.macro_indicators
  FROM anon;
