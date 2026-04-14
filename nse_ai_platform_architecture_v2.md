# NSE AI Research Platform — Complete Technical Specification

> **Stack update:** This document supersedes the Next.js/Fastify version.  
> Frontend → **React 19 + Vite 6** | API → **Node.js 22 + Express 4** | Deploy → **Netlify (frontend) + Vultr VPS (API/workers)**

---

## 1. Platform Overview

An AI-powered financial research system for the **Nairobi Securities Exchange (NSE)** that automatically collects stock prices, financial statements, and news; generates BUY/HOLD/SELL signals via Claude AI; detects market events through pattern matching; and recommends portfolio allocations with diversification constraints.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│         React 19 + Vite 6  (Netlify CDN)                │
│   React Router v6 · Tailwind CSS v4 · Recharts          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / REST + SSE
┌──────────────────────▼──────────────────────────────────┐
│                    API LAYER                             │
│         Node.js 22 + Express 4  (Vultr VPS / Nginx)     │
│   JWT Auth · Zod validation · Rate limiting             │
└──────┬────────────────────────────┬─────────────────────┘
       │                            │
┌──────▼──────┐            ┌────────▼────────┐
│  Supabase   │            │  Python Workers │
│ PostgreSQL  │◄───────────│  (systemd timer) │
│ + RLS       │            │  yfinance · AI  │
└─────────────┘            └─────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend | React | 19 | Replaces Next.js 14 |
| Build tool | Vite | 6 | Replaces Next.js compiler |
| Routing | React Router | 6 | Client-side SPA routing |
| Styling | Tailwind CSS | 4 | Via `@tailwindcss/vite` plugin |
| Animation | Motion (Framer) | 12 | Page transitions & charts |
| Charts | Recharts | 2.x | Financial chart components |
| API framework | Express | 4 | Replaces Fastify |
| Runtime | Node.js | 20 LTS | API + workers runtime |
| Language | TypeScript | 5.x | Full-stack |
| Data workers | Python | 3.11 | yfinance, pandas, anthropic |
| Database | PostgreSQL 15 | via Supabase | RLS enforced |
| AI model | Claude | claude-sonnet-4-6 | Signal generation (cached system prompt) |
| AI (fast) | Claude | claude-haiku-4-5-20251001 | Event classification (4× cheaper) |
| AI (powerful) | Claude | claude-opus-4-6 | Reserved for complex reasoning |
| Auth | Supabase Auth | 2.x | JWT + refresh tokens |
| Frontend host | Netlify | — | CDN + edge functions |
| API host | Vultr VPS | Ubuntu 24.04 | Nginx + PM2, 127.0.0.1 bind |
| Workers host | Vultr VPS | Ubuntu 24.04 | systemd timers (EAT schedule) |

---

## 4. Repository Structure

```
nse-ai-platform/
├── frontend/                    # React + Vite app
│   ├── src/
│   │   ├── components/          # Atomic UI components
│   │   ├── pages/               # Route-level page components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API client, auth helpers
│   │   ├── store/               # Zustand state management
│   │   ├── tokens/              # Design tokens (colors, type, spacing)
│   │   └── styles/              # globals.css, tailwind base
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── api/                         # Express API
│   ├── src/
│   │   ├── routes/              # Express routers
│   │   ├── middleware/          # auth, rateLimit, errorHandler
│   │   ├── services/            # supabaseAdmin, claudeClient
│   │   ├── schemas/             # Zod validation schemas
│   │   └── index.ts             # Express app entry
│   ├── tsconfig.json
│   └── package.json
├── workers/                     # Python data workers
│   ├── price_collector.py
│   ├── news_collector.py
│   ├── ai_worker.py
│   ├── portfolio_worker.py
│   ├── send_digest.py
│   ├── services/
│   │   ├── db.py
│   │   └── ai.py
│   ├── models/
│   ├── tests/
│   └── requirements.txt
├── supabase/
│   ├── migrations/
│   └── config.toml
├── .github/workflows/
├── .env.example
├── savepoints.json
└── README.md
```

---

## 5. Environment Variables

### Root `.env.example`

```bash
# ── Supabase ─────────────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co          # PUBLIC
SUPABASE_ANON_KEY=eyJ...                                # PUBLIC (safe for browser)
SUPABASE_SERVICE_ROLE_KEY=eyJ...                        # PRIVATE — server only

# ── Database ─────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:password@db.supabase.co:5432/postgres
POOLER_URL=postgresql://postgres:password@db.supabase.co:6543/postgres

# ── AI ───────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...                            # PRIVATE — server only

# ── Email ────────────────────────────────────────────────
RESEND_API_KEY=re_...                                   # PRIVATE

# ── Auth ─────────────────────────────────────────────────
JWT_SECRET=minimum-32-character-random-string           # PRIVATE

# ── API URL (consumed by Vite frontend) ──────────────────
VITE_API_URL=http://localhost:4000                      # PUBLIC — replaces NEXT_PUBLIC_API_URL
```

> **Migration note:** All `NEXT_PUBLIC_*` variables are renamed `VITE_*`. Access in React via `import.meta.env.VITE_API_URL`.

### `api/.env.example`

```bash
PORT=4000
NODE_ENV=development
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
JWT_SECRET=
RESEND_API_KEY=
```

### `frontend/.env.example`

```bash
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## 6. Frontend Architecture (React + Vite)

### 6.1 Vite Configuration

```typescript
// frontend/vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: { port: 3000, proxy: { '/api': env.VITE_API_URL } },
    build: {
      outDir: 'dist',           // replaces .next/
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  };
});
```

### 6.2 Routing (React Router v6)

```typescript
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import DashboardPage   from './pages/DashboardPage';
import SignalsPage     from './pages/SignalsPage';
import StockPage       from './pages/StockPage';
import PortfolioPage   from './pages/PortfolioPage';
import SettingsPage    from './pages/SettingsPage';
import LoginPage       from './pages/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard />}>
          <Route path="/"           element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"  element={<DashboardPage />} />
          <Route path="/signals"    element={<SignalsPage />} />
          <Route path="/stocks/:ticker" element={<StockPage />} />
          <Route path="/portfolio"  element={<PortfolioPage />} />
          <Route path="/settings"   element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### 6.3 Auth Guard (replaces Next.js middleware)

```typescript
// frontend/src/components/AuthGuard.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AuthGuard() {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

### 6.4 API Client

```typescript
// frontend/src/services/api.ts
const BASE = import.meta.env.VITE_API_URL;   // was process.env.NEXT_PUBLIC_API_URL

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}

export const api = {
  signals:    () => request<Signal[]>('/api/signals'),
  stock:      (ticker: string) => request<StockDetail>(`/api/stocks/${ticker}`),
  portfolio:  () => request<Allocation[]>('/api/portfolio'),
  watchlist:  () => request<string[]>('/api/watchlist'),
};
```

---

## 7. API Layer (Express)

### 7.1 App Entry

```typescript
// api/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { signalsRouter }   from './routes/signals';
import { stocksRouter }    from './routes/stocks';
import { portfolioRouter } from './routes/portfolio';
import { watchlistRouter } from './routes/watchlist';
import { authMiddleware }  from './middleware/auth';
import { errorHandler }    from './middleware/errorHandler';

const app = express();

// ── Security middleware ───────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", process.env.SUPABASE_URL!],
    },
  },
}));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*' }));
app.use(express.json({ limit: '10kb' }));

// ── Rate limiting ─────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs: 60_000, max: 60 }));
app.use('/api/signals', rateLimit({ windowMs: 60_000, max: 20 }));

// ── Routes ────────────────────────────────────────────────
app.use('/api/signals',   authMiddleware, signalsRouter);
app.use('/api/stocks',    authMiddleware, stocksRouter);
app.use('/api/portfolio', authMiddleware, portfolioRouter);
app.use('/api/watchlist', authMiddleware, watchlistRouter);

// ── Error handler ─────────────────────────────────────────
app.use(errorHandler);

app.listen(process.env.PORT ?? 4000, () =>
  console.log(`API running on port ${process.env.PORT ?? 4000}`)
);
```

### 7.2 Auth Middleware (replaces Fastify hooks)

```typescript
// api/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  (req as any).user = user;
  next();
}
```

### 7.3 Error Handler (RFC 7807 problem details)

```typescript
// api/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      type:   'https://nse-platform.dev/errors/validation',
      title:  'Validation Error',
      status: 400,
      errors: err.flatten().fieldErrors,
    });
  }
  console.error(err);
  res.status(500).json({
    type:   'https://nse-platform.dev/errors/internal',
    title:  'Internal Server Error',
    status: 500,
  });
}
```

### 7.4 Signals Route

```typescript
// api/src/routes/signals.ts
import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../services/supabase';

const router = Router();

const querySchema = z.object({
  ticker:     z.string().length(2, 6).optional(),
  signal:     z.enum(['BUY', 'HOLD', 'SELL']).optional(),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  offset:     z.coerce.number().int().min(0).default(0),
});

router.get('/', async (req, res, next) => {
  try {
    const { ticker, signal, limit, offset } = querySchema.parse(req.query);
    let query = supabaseAdmin
      .from('analysis_results')
      .select('*, companies(name, sector)')
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ticker) query = query.eq('ticker', ticker.toUpperCase());
    if (signal) query = query.eq('signal', signal);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export { router as signalsRouter };
```

---

## 8. Design Tokens

```typescript
// frontend/src/tokens/colors.ts
export const colors = {
  signal: {
    buy:  { bg: '#dcfce7', text: '#15803d', border: '#86efac' },  // green-100/700/300
    hold: { bg: '#fef9c3', text: '#a16207', border: '#fde047' },  // yellow-100/700/300
    sell: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },  // red-100/700/300
  },
  brand: { primary: '#1e40af', accent: '#0ea5e9' },
  neutral: { 50:'#f8fafc', 100:'#f1f5f9', 800:'#1e293b', 900:'#0f172a' },
  chart: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'],
};

// frontend/src/tokens/typography.ts
export const typography = {
  sans:  ['Inter', 'system-ui', 'sans-serif'],
  mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
  data:  ['Tabular', 'Inter', 'monospace'],     // tabular-nums for prices
};
```

---

## 9. MCP Integration for UI Development

Model Context Protocol (MCP) servers accelerate UI development by giving Claude Code live access to documentation, design assets, and browser state.

### 9.1 Recommended MCP Servers

| MCP Server | Purpose | Config key |
|-----------|---------|-----------|
| **Context7** | Live Tailwind CSS 4, React 19, Recharts docs — prevents hallucinated APIs | `context7` |
| **Playwright** | Headless browser for visual regression + E2E tests | `playwright` |
| **Figma** | Import design tokens and component specs directly from Figma files | `figma` |
| **Sequential Thinking** | Complex UI/UX decision trees (layout, a11y audits) | `sequential-thinking` |
| **Filesystem** | Read/write design token files and Tailwind config | `filesystem` |

### 9.2 Claude Code MCP Configuration

```json
// .claude/settings.json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": { "PLAYWRIGHT_BROWSERS_PATH": "0" }
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-mcp"],
      "env": { "FIGMA_ACCESS_TOKEN": "${FIGMA_ACCESS_TOKEN}" }
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./frontend/src"]
    }
  }
}
```

### 9.3 MCP-Driven UI Workflow

**Design → Code (Figma MCP)**
```
1. Designer exports component specs to Figma
2. Claude Code reads Figma file via MCP: get_file_nodes(fileKey, nodeIds)
3. Design tokens extracted and written to frontend/src/tokens/
4. Components generated matching exact Figma dimensions + colours
```

**Live Docs (Context7 MCP)**
```
# During development, Claude Code resolves library docs in real-time:
use context7
→ resolve_library_id("tailwindcss")
→ get_library_docs("/tailwindcss/utility-classes/colors")
# Prevents generating deprecated or non-existent class names
```

**Visual Testing (Playwright MCP)**
```
# After each component build:
playwright → navigate("http://localhost:3000/dashboard")
playwright → screenshot({ fullPage: true })
playwright → assert_no_visual_regressions(baseline)
# Catches layout breaks before commit
```

### 9.4 UI Design Principles

- **WCAG 2.1 AA** colour contrast on all signal badges (≥ 4.5:1)
- **Colorblind-safe** chart palette (no red/green only — use shape + label)
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) for all prices
- **Skeleton loaders** on every async data surface (no layout shift)
- **Reduced motion** via `prefers-reduced-motion` media query on all animations
- **Keyboard navigation** for all interactive elements (focus-visible rings)

---

## 10. Database Schema (unchanged from v1)

> See Section 7 of the original specification. All table names, column definitions, RLS policies, and indexes are preserved. No schema changes required for the React/Express migration.

---

## 11. CI/CD Pipelines

### 11.1 Test Workflow

```yaml
# .github/workflows/test.yml
name: Tests
on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci && npm run build   # Vite build
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run test              # Vitest

  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd api && npm ci && npm run build
      - run: cd api && npm test                       # Vitest + Supertest

  workers:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: cd workers && pip install -r requirements.txt
      - run: cd workers && pytest --cov=. --cov-report=xml

  e2e:
    runs-on: ubuntu-latest
    needs: [frontend, api]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npx playwright install --with-deps
      - run: npx playwright test
```

### 11.2 Deploy Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npm run build
      - uses: netlify/actions/cli@master         # replaces Vercel action
        with:
          args: deploy --prod --dir=frontend/dist
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID:    ${{ secrets.NETLIFY_SITE_ID }}

  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vultr VPS via SSH
        run: |
          rsync -az --delete api/dist/ deploy@${{ secrets.VPS_HOST }}:/opt/nse-ai-tracker/api/dist/
          ssh deploy@${{ secrets.VPS_HOST }} "cd /opt/nse-ai-tracker/api && npm ci --omit=dev && pm2 restart nse-api"
        env:
          SSH_PRIVATE_KEY: ${{ secrets.VPS_SSH_KEY }}
```

### 11.3 Netlify Configuration (`netlify.toml`)

```toml
[build]
  base    = "frontend"
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200            # SPA fallback — critical for React Router

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options        = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy        = "strict-origin-when-cross-origin"
    Permissions-Policy     = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

---

## 12. Testing Strategy

| Layer | Tool | Target Coverage |
|-------|------|----------------|
| Frontend unit | Vitest + React Testing Library | 70% |
| Frontend E2E | Playwright (via MCP in dev) | Critical paths |
| API unit | Vitest | 75% |
| API integration | Supertest | All endpoints |
| Workers unit | Pytest | 80% |
| Workers integration | Pytest + VCR.py | External APIs |

---

## 13. Security Checklist

| # | OWASP | Control |
|---|-------|---------|
| A01 | Broken Access Control | Supabase RLS on all tables; role checked in Express middleware |
| A02 | Cryptographic Failures | HTTPS enforced; JWT RS256; secrets via env vars only |
| A03 | Injection | Parameterised queries via supabase-js; Zod on all inputs |
| A04 | Insecure Design | Defence-in-depth; RLS as last line |
| A05 | Security Misconfiguration | Helmet.js headers; no debug in prod |
| A06 | Vulnerable Components | `npm audit` + `pip-audit` in CI weekly |
| A07 | Auth Failures | Supabase Auth; rate limiting on login; short JWT TTL |
| A08 | Data Integrity | Immutable audit_log; signed GitHub Actions commits |
| A09 | Security Logging | Structured logs with user_id (never email); audit table |
| A10 | SSRF | No user-controlled URLs server-side; allowlisted domains only |

---

## 14. Migration Guide: Next.js → React + Vite

| Next.js concept | React + Express equivalent |
|----------------|--------------------------|
| `pages/` directory | `src/pages/` + React Router `<Route>` |
| `app/layout.tsx` | `src/App.tsx` wrapping `<Outlet>` |
| `getServerSideProps` | `useEffect` + Express API endpoint |
| `getStaticProps` | `useEffect` + cached Express endpoint |
| Next.js API routes (`pages/api/`) | Express routers in `api/src/routes/` |
| `next/image` | Standard `<img>` + Vite image optimisation |
| `next/link` | `react-router-dom` `<Link>` |
| `next/navigation` `useRouter` | `react-router-dom` `useNavigate` |
| `NEXT_PUBLIC_*` env vars | `VITE_*` env vars via `import.meta.env` |
| `.next/` build output | `dist/` build output |
| `next.config.js` | `vite.config.ts` |
| Vercel deployment | Netlify (frontend) + Vultr VPS (API/workers) |
| Next.js middleware | Express middleware in `api/src/middleware/` |
| `next-auth` | Supabase Auth + custom `AuthGuard` component |

---

*End of NSE AI Research Platform — Technical Specification v2 (React + Express)*
