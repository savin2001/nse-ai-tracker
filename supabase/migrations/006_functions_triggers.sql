-- Migration 006: Helper functions and triggers

-- ── Auto-create nse.users row on auth signup ──────────────────────────────
CREATE OR REPLACE FUNCTION nse.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = nse, public
AS $$
BEGIN
  INSERT INTO nse.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'viewer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO nse.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION nse.handle_new_user();

-- ── Auto-update updated_at on user_preferences ────────────────────────────
CREATE OR REPLACE FUNCTION nse.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nse_preferences_updated_at ON nse.user_preferences;
CREATE TRIGGER nse_preferences_updated_at
  BEFORE UPDATE ON nse.user_preferences
  FOR EACH ROW EXECUTE FUNCTION nse.set_updated_at();

DROP TRIGGER IF EXISTS nse_portfolio_updated_at ON nse.portfolio_allocations;
CREATE TRIGGER nse_portfolio_updated_at
  BEFORE UPDATE ON nse.portfolio_allocations
  FOR EACH ROW EXECUTE FUNCTION nse.set_updated_at();

-- ── Latest signal per ticker (convenience view) ───────────────────────────
CREATE OR REPLACE VIEW nse.latest_signals AS
SELECT DISTINCT ON (ticker)
  ar.id,
  ar.ticker,
  c.name,
  c.sector,
  ar.signal,
  ar.confidence,
  ar.summary,
  ar.target_price,
  ar.time_horizon,
  ar.generated_at
FROM nse.analysis_results ar
JOIN nse.companies c ON c.ticker = ar.ticker
ORDER BY ar.ticker, ar.generated_at DESC;

-- ── Latest price per ticker (convenience view) ────────────────────────────
CREATE OR REPLACE VIEW nse.latest_prices AS
SELECT DISTINCT ON (ticker)
  ticker, date, open, high, low, close, volume
FROM nse.stock_prices
ORDER BY ticker, date DESC;
