# RLS Test Results — NSE Schema

> **Automated tests live in `rls_tests.sql`** and run in CI via `.github/workflows/supabase-tests.yml`.
> This document records results from the last **manual production verification** run against the live Supabase project.
>
> For local runs: `supabase test db`  
> For CI: push any file under `supabase/` to trigger the `Supabase DB Tests` workflow.

---

## Last Verified

| Field | Value |
|---|---|
| Date | _fill in after production run_ |
| Supabase project | `uryyfzzfkbcbkftnzzix` |
| Migration version | 008 (realtime) |
| Tester | _fill in_ |
| Result | _PASS / FAIL_ |

---

## Test Suite Summary (20 tests)

| # | Test | Expected | Status |
|---|---|---|---|
| T1 | `viewer_a` SELECT from `nse.stock_prices` | ✅ Rows returned | _pending_ |
| T2 | `viewer_a` INSERT into `nse.stock_prices` | ❌ 42501 permission denied | _pending_ |
| T3 | `viewer_a` SELECT from `nse.analysis_results` | ✅ Rows returned | _pending_ |
| T4 | `viewer_a` INSERT into `nse.analysis_results` | ❌ 42501 permission denied | _pending_ |
| T5 | `viewer_a` SELECT from `nse.companies` | ✅ Rows returned | _pending_ |
| T6 | `viewer_a` INSERT into `nse.companies` | ❌ 42501 permission denied | _pending_ |
| T7 | `viewer_a` INSERT into `nse.detected_events` | ❌ 42501 permission denied | _pending_ |
| T8 | `viewer_a` sees own `user_preferences` | ✅ 1 row | _pending_ |
| T9 | `viewer_a` sees viewer_b `user_preferences` | ✅ 0 rows (isolated) | _pending_ |
| T10 | `viewer_a` UPDATE own `user_preferences` | ✅ Success | _pending_ |
| T11 | `viewer_b` sees viewer_a `user_preferences` | ✅ 0 rows (isolated) | _pending_ |
| T12 | `viewer_b` sees own `user_preferences` | ✅ 1 row | _pending_ |
| T13 | `viewer_b` UPDATE viewer_a `user_preferences` | ✅ 0 rows affected | _pending_ |
| T14 | `service_role` INSERT into `nse.analysis_results` | ✅ Success | _pending_ |
| T15 | `service_role` INSERT into `nse.detected_events` | ✅ Success | _pending_ |
| T16 | `service_role` INSERT into `nse.stock_prices` | ✅ Success | _pending_ |
| T17 | `service_role` INSERT into `nse.audit_log` | ✅ Success | _pending_ |
| T18 | `service_role` UPDATE `nse.audit_log` | ❌ 42501 permission denied (append-only) | _pending_ |
| T19 | `service_role` DELETE from `nse.audit_log` | ❌ 42501 permission denied (append-only) | _pending_ |
| T20 | `detected_events` + `analysis_results` in Realtime publication | ✅ 2 rows in `pg_publication_tables` | _pending_ |

---

## How to run locally

```bash
# Start local Supabase stack
supabase start

# Apply all migrations
supabase db push --local

# Run pgTAP tests
supabase test db

# Expected output:
# ok 1 - T1: viewer can SELECT nse.stock_prices
# ok 2 - T2: viewer INSERT into nse.stock_prices is denied
# ...
# ok 20 - T20: detected_events + analysis_results are in supabase_realtime publication
# 1..20
```

## How to run against production

> Production RLS tests should be run in a **separate staging/shadow database** — never against live data.

```bash
# Point to shadow DB
supabase db push --db-url "$SHADOW_DATABASE_URL"

# Then run tests against shadow
supabase test db --db-url "$SHADOW_DATABASE_URL"
```

---

## Notes

- Tests are wrapped in `BEGIN ... ROLLBACK` — no data is persisted after the run.
- `service_role` bypass is implicit in Supabase (no explicit policy needed); the tests verify that writes succeed, not that a policy allows them.
- If T18/T19 fail, check `005_audit_log.sql` — the append-only policy must deny UPDATE and DELETE to `service_role`.
