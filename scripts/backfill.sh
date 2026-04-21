#!/usr/bin/env bash
# Production data backfill — run once after initial deployment (SP-08-03).
# Requires: TV_USERNAME, TV_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
set -euo pipefail

WORKERS_DIR="$(cd "$(dirname "$0")/../workers" && pwd)"
cd "$WORKERS_DIR"

required_vars=(TV_USERNAME TV_PASSWORD SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY)
for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set" >&2
    exit 1
  fi
done

echo "==> [1/5] Backfilling 365 days of prices..."
python price_collector.py --backfill

echo "==> [2/5] Fetching last 30 days of news..."
python news_fetcher.py

echo "==> [3/5] Running event detection on fresh news..."
python event_detector.py

echo "==> [4/5] Generating AI signals for all tickers..."
python ai_worker.py

echo "==> [5/5] Evaluating historical signals (may be empty on first run)..."
python signal_evaluator.py

echo ""
echo "Backfill complete. Verify in Supabase:"
echo "  SELECT ticker, COUNT(*) FROM nse.stock_prices GROUP BY ticker;"
echo "  SELECT ticker, signal FROM nse.analysis_results ORDER BY generated_at DESC LIMIT 20;"
