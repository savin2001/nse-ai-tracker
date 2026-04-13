# NSE AI Research Platform

An AI-powered financial research dashboard for the **Nairobi Securities Exchange (NSE)** — automatically tracking stock prices, detecting market events, and generating Claude-powered BUY/HOLD/SELL signals.

[![Tests](https://github.com/savin2001/nse-ai-tracker/actions/workflows/test.yml/badge.svg)](https://github.com/savin2001/nse-ai-tracker/actions)
[![Deploy](https://github.com/savin2001/nse-ai-tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/savin2001/nse-ai-tracker/actions)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 |
| Routing | React Router v6 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| API | Node.js 20 + Express 4 |
| AI | Claude (Anthropic) |
| Database | PostgreSQL via Supabase |
| Workers | Python 3.11 |
| Frontend host | Netlify |
| API/Workers host | Railway |

---

## Project Structure

```
nse-ai-platform/
├── frontend/        # React + Vite SPA
├── api/             # Node.js + Express REST API
├── workers/         # Python data collection + AI workers
├── supabase/        # DB migrations + RLS policies
├── docs/            # Architecture + specs
└── .github/         # CI/CD workflows
```

---

## Prerequisites

- Node.js 20+
- Python 3.11+
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)

---

## Environment Setup

Copy and fill in all three env files:

```bash
cp .env.example .env
cp api/.env.example api/.env
cp frontend/.env.example frontend/.env
```

| Variable | Where | Description |
|----------|-------|-------------|
| `SUPABASE_URL` | root, frontend | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | root, frontend | Safe for browser — Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | root, api | **PRIVATE** — server only |
| `DATABASE_URL` | root, workers | Direct Postgres connection string |
| `ANTHROPIC_API_KEY` | root, api, workers | **PRIVATE** — Claude API key |
| `JWT_SECRET` | api | **PRIVATE** — min 32 chars random string |
| `RESEND_API_KEY` | api, workers | **PRIVATE** — email delivery |
| `VITE_API_URL` | frontend | URL of the running Express API |

> **Note:** Variables previously named `NEXT_PUBLIC_*` are now `VITE_*` and accessed via `import.meta.env.VITE_*` in React.

---

## Local Development

### 1. Database

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### 2. API (Express)

```bash
cd api
npm install
npm run dev        # starts on http://localhost:4000
```

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev        # starts on http://localhost:3000
```

### 4. Python Workers

```bash
cd workers
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python price_collector.py     # manual run
```

---

## MCP Setup for Development

This project uses [Claude Code](https://claude.ai/code) with MCP servers for accelerated UI development.

### Install MCP servers

```bash
# Context7 — live library docs (Tailwind, React, Recharts)
npx -y @upstash/context7-mcp

# Playwright — visual testing + E2E
npx -y @playwright/mcp@latest

# Sequential Thinking — complex UI/UX decisions
npx -y @modelcontextprotocol/server-sequential-thinking
```

### Configure (`.claude/settings.json`)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

See [`docs/nse_ai_platform_architecture_v2.md`](./nse_ai_platform_architecture_v2.md) — Section 9 for full MCP workflow details.

---

## Running Tests

```bash
# Frontend
cd frontend && npm test

# API
cd api && npm test

# Workers
cd workers && pytest --cov=.

# E2E (Playwright)
npx playwright test
```

---

## Deployment

| Target | Platform | Trigger |
|--------|----------|---------|
| Frontend (`frontend/dist`) | Netlify | Push to `main` |
| API | Railway | Push to `main` |
| Workers (cron) | Railway | Scheduled (EAT timezone) |

See `.github/workflows/deploy.yml` for the full pipeline.

---

## Worker Schedule (East Africa Time)

| Worker | Time (EAT) | Days |
|--------|-----------|------|
| Price collector | 09:00, 12:00, 15:00, 17:30 | Mon–Fri |
| News collector | 08:00, 14:00, 20:00 | Daily |
| AI analysis | 18:00 | Mon–Fri |
| Portfolio rebalance | 18:30 | Mon–Fri |
| Daily digest email | 18:30 | Mon–Fri |
| Weekly review email | 19:00 | Sunday |

---

## Architecture

See [`docs/nse_ai_platform_architecture_v2.md`](./nse_ai_platform_architecture_v2.md) for the complete technical specification including:

- Full database schema and RLS policies
- Express API route definitions
- React component architecture
- Design token system
- Security checklist (OWASP Top 10)
- Migration guide from Next.js → React + Vite

---

## License

MIT
