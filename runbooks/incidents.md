# Incident Runbooks — NSE AI Research Platform

Severity definitions: **P1** = complete outage · **P2** = degraded/partial · **P3** = minor/cosmetic

---

## INC-01 · API unreachable (P1)

**Detection:** `health-check.yml` workflow fails · UptimeRobot alert · users report blank dashboard

**Steps:**
1. Check Railway dashboard — is the `api` service running?
2. Check recent deploys: `git log origin/main --oneline -5`
3. SSH to VPS (fallback): `ssh deploy@<VPS_IP>`
4. View live logs: `railway logs --service api -f` or `journalctl -u nse-api -f`
5. Look for startup crash: missing env var (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
6. Rollback if needed: `railway rollback --service api`

**Resolution target:** < 15 minutes

---

## INC-02 · Database unreachable (P1)

**Detection:** `GET /health/detailed` returns `db.status = "error"` · Supabase dashboard alerts

**Steps:**
1. Open Supabase dashboard → Project → Database
2. Check connection pool usage (max 60 for free tier)
3. Check for long-running queries: `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';`
4. Kill blocking queries if needed: `SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction';`
5. Verify RLS isn't blocking: temporarily check with service_role key via REST
6. Check Supabase status page for platform incidents

**Resolution target:** < 30 minutes

---

## INC-03 · Workers not running / stale signals (P2)

**Detection:** `analysis_results` count unchanged for > 24h · `/health/detailed` shows low `analysis_results` count

**Steps:**
1. Check GitHub Actions → `daily-digest.yml` recent runs for failures
2. Check Railway worker logs: `railway logs --service workers -f`
3. Verify Anthropic API key is valid: `curl https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY"`
4. Check circuit breaker state: look for `circuit_open` in worker logs
5. Re-run manually: `python workers/ai_worker.py` with env vars set
6. Check `nse.model_usage` table for daily token budget exhaustion

**Resolution target:** < 1 hour

---

## INC-04 · Email digest not delivered (P2)

**Detection:** No digest received at 18:30 EAT · GitHub Actions `daily-digest.yml` run shows failure

**Steps:**
1. Check `daily-digest.yml` run logs in GitHub Actions
2. Check Resend dashboard for delivery status / bounce / spam flag
3. Verify `RESEND_API_KEY` is set in Railway env vars
4. Check `nse.email_logs` for the failed send: `SELECT * FROM nse.email_logs ORDER BY created_at DESC LIMIT 5;`
5. Re-trigger manually: `workflow_dispatch` on `daily-digest.yml`

**Resolution target:** < 2 hours (next business day delivery)

---

## INC-05 · Frontend 404 / blank page (P2)

**Detection:** Users report blank screen · Netlify deploy preview shows build error

**Steps:**
1. Netlify dashboard → Deploys → check latest build log for errors
2. Common causes:
   - Missing env var `VITE_API_URL` or `VITE_SUPABASE_ANON_KEY` in Netlify site settings
   - Build failure (TypeScript error) — check `npm run build` locally
   - Supabase CORS not updated with Netlify production domain
3. Fix CORS: Supabase dashboard → API → CORS origins → add production URL
4. Fix env vars: Netlify → Site settings → Environment variables
5. Trigger redeploy: Netlify dashboard → Deploys → Trigger deploy

**Resolution target:** < 30 minutes

---

## INC-06 · High AI token spend (P3)

**Detection:** Anthropic usage dashboard shows > $10/day · `nse.model_usage` daily_cost spikes

**Steps:**
1. Check `nse.model_usage`: `SELECT date, SUM(cost_usd) FROM nse.model_usage GROUP BY date ORDER BY date DESC LIMIT 7;`
2. Look for runaway re-analysis loop in `ai_worker.py` logs
3. Check circuit breaker: if breaker is open, it's already protecting you
4. Temporarily raise `DAILY_TOKEN_BUDGET` env var threshold or disable the worker

**Resolution target:** Monitor; adjust budget if needed

---

## Contacts & Tools

| Resource | URL / Command |
|---|---|
| Railway (API + Workers) | railway.app → nse-ai-tracker project |
| Netlify (Frontend) | app.netlify.com → nse-ai-tracker |
| Supabase (DB + Auth) | app.supabase.com → uryyfzzfkbcbkftnzzix |
| Anthropic usage | console.anthropic.com → Usage |
| GitHub Actions | github.com/savin2001/nse-ai-tracker/actions |
| Health detailed | `curl $API_BASE_URL/health/detailed` |
| DB query | Supabase dashboard → SQL Editor |
