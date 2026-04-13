# RLS Test Plan — NSE Schema

Run these tests after applying migrations to verify isolation.

## Setup
Create two test users in Supabase Auth dashboard:
- `test-viewer@example.com` (viewer role)
- `test-analyst@example.com` (viewer role)

## Test Cases

| # | Test | Expected |
|---|------|----------|
| T1 | Viewer SELECT from `nse.stock_prices` | ✅ Rows returned |
| T2 | Viewer INSERT into `nse.stock_prices` | ❌ Permission denied |
| T3 | Viewer SELECT from `nse.analysis_results` | ✅ Rows returned |
| T4 | Viewer INSERT into `nse.analysis_results` | ❌ Permission denied |
| T5 | Viewer A SELECT `nse.user_preferences` where user = Viewer B | ✅ 0 rows (isolated) |
| T6 | Viewer SELECT own `nse.user_preferences` | ✅ Own row returned |
| T7 | service_role INSERT into `nse.analysis_results` | ✅ Success |
| T8 | service_role INSERT into `nse.audit_log` | ✅ Success |
| T9 | service_role UPDATE `nse.audit_log` row | ❌ Permission denied (append-only) |
| T10 | Viewer SELECT `nse.audit_log` for own user_id | ✅ Own rows only |

## Running via Supabase SQL Editor

```sql
-- T2: should fail
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"test-viewer-uuid","role":"authenticated"}';
INSERT INTO nse.stock_prices (ticker, date, close) VALUES ('SCOM', now()::date, 30.00);

-- T5: cross-user isolation
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"viewer-a-uuid","role":"authenticated"}';
SELECT * FROM nse.user_preferences WHERE user_id = 'viewer-b-uuid';
-- Expected: 0 rows
```
