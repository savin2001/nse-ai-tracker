#!/usr/bin/env python3
"""
Apply Supabase migrations via the Management API.
Reads SQL files from supabase/migrations/ in alphabetical order
and POSTs each to the Supabase database query endpoint.

Usage:
  SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=xxx python3 scripts/migrate.py
"""
import os
import sys
import glob
import json
import urllib.request
import urllib.error

TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
REF   = os.environ.get("SUPABASE_PROJECT_REF", "")

if not TOKEN or not REF:
    print("❌ Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF")
    sys.exit(1)

API_URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"


def run_query(sql: str) -> dict:
    body = json.dumps({"query": sql}).encode()
    req  = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type":  "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return {"status": resp.status, "body": json.loads(resp.read())}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return {"status": e.code, "body": raw}
    except Exception as exc:
        return {"status": 0, "body": str(exc)}


# ── Connection test ───────────────────────────────────────────────────────────
print("🔌 Testing connection...")
result = run_query("SELECT current_database(), current_user, version();")
if result["status"] != 200:
    print(f"❌ Connection failed [{result['status']}]: {result['body']}")
    sys.exit(1)
print(f"✅ Connected: {result['body']}\n")

# ── Apply migrations ──────────────────────────────────────────────────────────
migration_files = sorted(glob.glob("supabase/migrations/*.sql"))
if not migration_files:
    print("⚠️  No migration files found in supabase/migrations/")
    sys.exit(0)

failed = False
for filepath in migration_files:
    print(f"▶  Applying {filepath} ...")
    with open(filepath, "r") as f:
        sql = f.read().strip()

    if not sql:
        print(f"   ⚠️  Empty file, skipping.")
        continue

    result = run_query(sql)
    if result["status"] == 200:
        print(f"   ✅ Done\n")
    else:
        print(f"   ❌ Failed [{result['status']}]: {result['body']}\n")
        failed = True
        break

if failed:
    sys.exit(1)

# ── Verify ────────────────────────────────────────────────────────────────────
print("📋 Verifying nse schema tables...")
result = run_query(
    "SELECT table_name FROM information_schema.tables "
    "WHERE table_schema = 'nse' ORDER BY table_name;"
)
if result["status"] == 200:
    rows = result["body"]
    tables = [r["table_name"] for r in rows] if isinstance(rows, list) else rows
    print(f"✅ Tables in nse schema: {tables}")
else:
    print(f"❌ Verification failed: {result['body']}")
    sys.exit(1)

print("\n🎉 All migrations applied successfully.")
