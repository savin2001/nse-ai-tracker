# NSE AI Platform — Launch Checklist

Track every step required before tagging v1.0.0.
Legend: ✅ done · ⬜ pending · 🔧 requires external dashboard action

---

## SP-08-01 · Frontend Deployed ✅

- [x] Netlify deployment succeeds — green build status
- [x] Production URL loads landing page: https://nse-ai-tracker.netlify.app/
- [x] Login flow redirects correctly to /dashboard
- [x] No CORS errors in browser console
- [x] Supabase Auth redirect URL updated to production domain

---

## SP-08-02 · Monitoring & Alerting

- [x] `runbooks/incidents.md` committed — P1–P4 response plans documented
- [ ] 🔧 UptimeRobot: create monitor for `$API_BASE_URL/health` (every 5 min)
- [ ] 🔧 UptimeRobot: create monitor for `https://nse-ai-tracker.netlify.app/` (every 5 min)
- [ ] 🔧 UptimeRobot: configure email alert on 2 consecutive failures
- [ ] 🔧 Supabase Auth: enable alert for >10 failed logins in 1 hour
- [ ] 🔧 Railway: add webhook notification on worker job failure

**UptimeRobot setup:** https://uptimerobot.com → Add New Monitor → HTTP(s)
- URL: `https://<railway-api-url>/health`
- Interval: 5 minutes
- Alert contact: admin email

---

## SP-08-03 · Production Data Backfill

Run these commands once with production env vars active (requires `TV_USERNAME`, `TV_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):

```bash
# 1. Backfill 365 days of prices for all 18 NSE tickers
cd workers && python price_collector.py --backfill

# 2. Run news fetcher to populate last 30 days
python news_fetcher.py

# 3. Run event detector on fresh news
python event_detector.py

# 4. Generate initial AI signals for all tickers
python ai_worker.py

# 5. Evaluate any signals old enough (>30 days) — may be empty on first run
python signal_evaluator.py
```

Verify in Supabase SQL Editor:
```sql
-- Expect >= 200 rows per ticker
SELECT ticker, COUNT(*) FROM nse.stock_prices GROUP BY ticker ORDER BY ticker;

-- Expect at least one result per active ticker
SELECT ticker, signal, confidence, generated_at
FROM nse.analysis_results
ORDER BY generated_at DESC LIMIT 20;
```

- [ ] `stock_prices` has ≥ 200 rows per ticker
- [ ] `analysis_results` has at least one row per active ticker
- [ ] `portfolio_allocations` has a current allocation row
- [ ] Dashboard /signals page shows at least 3 BUY or SELL signals
- [ ] Dashboard loads with real data (no empty states)

See `scripts/backfill.sh` for a convenience wrapper.

---

## SP-08-04 · Launch Checklist (blocked until SP-08-02 + SP-08-03 done)

### Security
- [ ] Run `securityheaders.com` scan on production frontend URL — target grade A
- [ ] Run `securityheaders.com` scan on production API URL
- [ ] Verify `npm audit` on `api/` — 0 high/critical
- [ ] Verify `npm audit` on `frontend/` — 0 high/critical
- [ ] Verify `pip-audit` on `workers/` — 0 high/critical
- [ ] 🔧 Set `ALLOWED_ORIGINS` on Railway to Netlify production URL only

### Accessibility
- [ ] Run axe-core on production `/dashboard` — 0 violations
- [ ] All pages pass Lighthouse accessibility score ≥ 90

### Performance
- [ ] All 15 pages load < 3s (Lighthouse LCP)
- [ ] `GET /signals` P95 < 300ms at 10 concurrent users
- [ ] `GET /stocks/:ticker` P95 < 200ms

### Automation
- [ ] Verify daily digest email fires at 15:30 UTC (18:30 EAT) — check GitHub Actions
- [ ] Verify NSE cron jobs running on schedule — check Railway logs
- [ ] Verify `email_logs` table records successful digest send

### Release
- [ ] Update README with production URL and architecture diagram link
- [ ] Create GitHub release: `git tag v1.0.0 && git push origin v1.0.0`
- [ ] Commit this completed checklist to repository

---

## Quick commands

```bash
# Check API health
curl https://<railway-api-url>/health

# Check latest signals (requires valid JWT)
curl https://<railway-api-url>/api/signals \
  -H "Authorization: Bearer <token>"

# Trigger daily digest manually (GitHub Actions)
gh workflow run daily-digest.yml

# Check email logs
# Supabase SQL: SELECT * FROM nse.email_logs ORDER BY created_at DESC LIMIT 5;
```
