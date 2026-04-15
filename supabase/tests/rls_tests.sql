-- RLS Tests for NSE schema — runs via: supabase test db
-- Uses pgTAP. Install locally: supabase db test
-- CI: .github/workflows/supabase-tests.yml

BEGIN;

SELECT plan(20);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Create two test users in the auth.users table (local Supabase only).
-- In production these would be real accounts; here we insert synthetic rows.
DO $$
DECLARE
  viewer_a UUID := '00000000-0000-0000-0000-000000000001';
  viewer_b UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  INSERT INTO auth.users (id, email, role, aud, created_at, updated_at)
  VALUES
    (viewer_a, 'viewer-a@test.nse', 'authenticated', 'authenticated', now(), now()),
    (viewer_b, 'viewer-b@test.nse', 'authenticated', 'authenticated', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Seed one preference row for viewer_a
  INSERT INTO nse.user_preferences (user_id, watchlist)
  VALUES (viewer_a, ARRAY['SCOM','EQTY'])
  ON CONFLICT (user_id) DO NOTHING;

  -- Seed one preference row for viewer_b
  INSERT INTO nse.user_preferences (user_id, watchlist)
  VALUES (viewer_b, ARRAY['KCB'])
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Switch to viewer_a session
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- T1: viewer can SELECT from nse.stock_prices
SELECT ok(
  (SELECT count(*) >= 0 FROM nse.stock_prices),
  'T1: viewer can SELECT nse.stock_prices'
);

-- T2: viewer cannot INSERT into nse.stock_prices
SELECT throws_ok(
  $$ INSERT INTO nse.stock_prices (ticker, date, close) VALUES ('SCOM', current_date, 30.00) $$,
  '42501',
  NULL,
  'T2: viewer INSERT into nse.stock_prices is denied'
);

-- T3: viewer can SELECT from nse.analysis_results
SELECT ok(
  (SELECT count(*) >= 0 FROM nse.analysis_results),
  'T3: viewer can SELECT nse.analysis_results'
);

-- T4: viewer cannot INSERT into nse.analysis_results
SELECT throws_ok(
  $$ INSERT INTO nse.analysis_results (ticker, signal, confidence, summary, model_version)
     VALUES ('SCOM', 'BUY', 0.9, 'test', 'test-v1') $$,
  '42501',
  NULL,
  'T4: viewer INSERT into nse.analysis_results is denied'
);

-- T5: viewer can SELECT from nse.companies
SELECT ok(
  (SELECT count(*) >= 0 FROM nse.companies),
  'T5: viewer can SELECT nse.companies'
);

-- T6: viewer cannot INSERT into nse.companies
SELECT throws_ok(
  $$ INSERT INTO nse.companies (ticker, name, sector) VALUES ('FAKE', 'Fake Co', 'Test') $$,
  '42501',
  NULL,
  'T6: viewer INSERT into nse.companies is denied'
);

-- T7: viewer cannot INSERT into nse.detected_events
SELECT throws_ok(
  $$ INSERT INTO nse.detected_events (ticker, event_type, severity, description)
     VALUES ('SCOM', 'price_spike', 'high', 'test event') $$,
  '42501',
  NULL,
  'T7: viewer INSERT into nse.detected_events is denied'
);

-- T8: viewer_a sees own user_preferences
SELECT ok(
  (SELECT count(*) = 1 FROM nse.user_preferences
   WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid),
  'T8: viewer_a sees own user_preferences row'
);

-- T9: viewer_a cannot see viewer_b user_preferences (cross-user isolation)
SELECT ok(
  (SELECT count(*) = 0 FROM nse.user_preferences
   WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid),
  'T9: viewer_a cannot see viewer_b user_preferences (cross-user isolation)'
);

-- T10: viewer_a can update own preferences
SELECT lives_ok(
  $$ UPDATE nse.user_preferences
     SET watchlist = ARRAY['SCOM','EQTY','KCB']
     WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
  'T10: viewer_a can UPDATE own user_preferences'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Switch to viewer_b session
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- T11: viewer_b cannot see viewer_a preferences
SELECT ok(
  (SELECT count(*) = 0 FROM nse.user_preferences
   WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid),
  'T11: viewer_b cannot see viewer_a user_preferences (cross-user isolation)'
);

-- T12: viewer_b sees own preferences
SELECT ok(
  (SELECT count(*) = 1 FROM nse.user_preferences
   WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid),
  'T12: viewer_b sees own user_preferences row'
);

-- T13: viewer_b cannot UPDATE viewer_a preferences
SELECT ok(
  (SELECT count(*) = 0 FROM nse.user_preferences
   WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid),
  'T13: viewer_b sees 0 rows for viewer_a (UPDATE would affect 0 rows)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Switch to service_role — bypasses RLS
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role = service_role;
RESET request.jwt.claims;

-- T14: service_role can INSERT into nse.analysis_results
SELECT lives_ok(
  $$ INSERT INTO nse.analysis_results (ticker, signal, confidence, summary, model_version)
     VALUES ('SCOM', 'HOLD', 0.75, 'pgTAP test row', 'test-v1')
     ON CONFLICT DO NOTHING $$,
  'T14: service_role can INSERT into nse.analysis_results'
);

-- T15: service_role can INSERT into nse.detected_events
SELECT lives_ok(
  $$ INSERT INTO nse.detected_events (ticker, event_type, severity, description)
     VALUES ('EQTY', 'earnings', 'high', 'pgTAP test event')
     ON CONFLICT DO NOTHING $$,
  'T15: service_role can INSERT into nse.detected_events'
);

-- T16: service_role can INSERT into nse.stock_prices (seed new price)
SELECT lives_ok(
  $$ INSERT INTO nse.stock_prices (ticker, date, close)
     VALUES ('SCOM', '1900-01-01', 0.01)
     ON CONFLICT DO NOTHING $$,
  'T16: service_role can INSERT into nse.stock_prices'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log — append-only policy
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role = service_role;

-- T17: service_role can INSERT into audit_log
SELECT lives_ok(
  $$ INSERT INTO nse.audit_log (user_id, action, table_name, record_id, details)
     VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'SELECT', 'stock_prices', '1', '{}') $$,
  'T17: service_role can INSERT into nse.audit_log'
);

-- T18: service_role CANNOT UPDATE audit_log rows (append-only)
SELECT throws_ok(
  $$ UPDATE nse.audit_log SET action = 'TAMPERED' WHERE action = 'SELECT' $$,
  '42501',
  NULL,
  'T18: service_role UPDATE on nse.audit_log is denied (append-only)'
);

-- T19: service_role CANNOT DELETE from audit_log
SELECT throws_ok(
  $$ DELETE FROM nse.audit_log WHERE action = 'SELECT' $$,
  '42501',
  NULL,
  'T19: service_role DELETE from nse.audit_log is denied (append-only)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime publication check
-- ─────────────────────────────────────────────────────────────────────────────

-- T20: detected_events and analysis_results are in supabase_realtime publication
SELECT ok(
  (SELECT count(*) = 2
   FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
     AND schemaname = 'nse'
     AND tablename IN ('detected_events', 'analysis_results')),
  'T20: detected_events + analysis_results are in supabase_realtime publication'
);

SELECT * FROM finish();
ROLLBACK;
