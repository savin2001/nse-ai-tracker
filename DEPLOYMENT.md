# NSE AI Tracker — Deployment Guide

## Deployment Strategy

| Environment | API host | Workers | Frontend |
|-------------|----------|---------|----------|
| **Staging / Testing** | [Render](https://render.com) free tier | Not deployed | Netlify |
| **Production** | Vultr VPS (Ubuntu 24.04) | Vultr VPS (systemd timers) | Netlify |

- **Staging on Render** — every push to `main` triggers an automatic redeploy via a Render deploy hook (see `.github/workflows/deploy.yml`). Free-tier instances spin down after 15 minutes of inactivity; the first request takes ~30 s to cold-start. Sufficient for integration testing, not for live traffic.
- **Production on Vultr** — always-on Node.js process managed by PM2 behind Nginx with TLS. Workers run as systemd timers on the same VPS. Follow Part B below for the full setup.

---

## Part A — Staging Environment (Render)

### A.1 Prerequisites

- A [Render](https://render.com) account (free tier is fine for staging)
- The `render.yaml` blueprint at the repo root

### A.2 First-time setup via Render Blueprint

1. Go to **Render dashboard → New → Blueprint**
2. Connect the GitHub repo `savin2001/nse-ai-tracker`
3. Render detects `render.yaml` and proposes the `nse-ai-tracker-api` web service
4. Click **Apply** — Render creates the service and runs the first build

### A.3 Set environment variables in Render dashboard

Navigate to **nse-ai-tracker-api → Environment** and add the following secrets (these are marked `sync: false` in `render.yaml` so Render won't try to read them from a file):

| Key | Description |
|-----|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (**private**) |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `ANTHROPIC_API_KEY` | Claude API key (**private**) |
| `RESEND_API_KEY` | Email delivery key (**private**) |
| `NOTIFY_SECRET` | Random hex string — `openssl rand -hex 32` |
| `JWT_SECRET` | Random hex string — min 32 chars |
| `ALLOWED_ORIGINS` | `https://nse-ai-tracker.netlify.app` |

### A.4 Wire up the CI deploy hook

1. In Render dashboard: **nse-ai-tracker-api → Settings → Deploy Hook** → copy the URL
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Value: the URL you copied

Every push to `main` will now trigger a Render redeploy automatically.

### A.5 Verify staging

```bash
curl https://nse-ai-tracker-api.onrender.com/health
# Expected: {"status":"ok","ts":"..."}

curl https://nse-ai-tracker-api.onrender.com/health/detailed
# Expected: {"status":"ok","checks":{"db":{"status":"ok",...},...}}
```

---

## Part B — Production Environment (Vultr VPS)

> **Security first.** Complete every step in Section 2 (Server Hardening) before
> exposing any port to the internet.

---

## B.1 Infrastructure Overview

```
Browser / Netlify (React 19)
         │
         │  HTTPS (443)
         ▼
    Nginx reverse proxy  ←── Let's Encrypt TLS (certbot)
         │
         │  127.0.0.1:4000
         ▼
    Express API (Node.js 22, PM2)
         │
         ├── Supabase (PostgreSQL, Auth, RLS)
         └── Anthropic Claude API

    Cron jobs (systemd timers)
         ├── price_collector.py      07:00 + 13:00 EAT Mon-Fri
         ├── news_fetcher.py         08:00 + 14:00 EAT Mon-Fri
         ├── financials_fetcher.py   09:00 Mon (weekly)
         ├── macro_fetcher.py        09:30 Mon (weekly)
         ├── event_detector.py       every hour Mon-Fri
         ├── ai_worker.py            18:00 EAT Mon-Fri
         └── email_worker.py         18:30 EAT Mon-Fri
```

### Recommended Vultr plan

| Component | Spec |
|-----------|------|
| Instance  | Cloud Compute — Regular Performance |
| vCPU      | 2 |
| RAM       | 4 GB |
| Storage   | 80 GB NVMe SSD |
| Region    | Johannesburg (JNB) — lowest latency to NSE |
| OS        | Ubuntu 24.04 LTS |

---

## B.2 Server Hardening (complete before anything else)

### B.2.1 Initial SSH setup

```bash
# On your LOCAL machine — generate an ED25519 key if you don't have one
ssh-keygen -t ed25519 -C "nse-tracker-vultr"

# Upload to Vultr during instance creation, or copy manually:
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@YOUR_SERVER_IP
```

### B.2.2 First login — create non-root user

```bash
ssh root@YOUR_SERVER_IP

# Create deploy user
adduser deploy
usermod -aG sudo deploy

# Copy SSH key to deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

### B.2.3 Harden SSH daemon

```bash
nano /etc/ssh/sshd_config
```

Set these values (add if missing):

```
Port 2222                        # Non-default SSH port
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowUsers deploy
```

```bash
systemctl restart sshd
# Open a NEW terminal and test before closing the current session
ssh -p 2222 deploy@YOUR_SERVER_IP
```

### B.2.4 UFW firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp    # SSH (non-default port)
ufw allow 80/tcp      # HTTP (Let's Encrypt challenge + redirect to HTTPS)
ufw allow 443/tcp     # HTTPS
ufw enable
ufw status verbose
```

### B.2.5 Fail2ban

```bash
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
port     = 2222
logpath  = %(sshd_log)s

[nginx-http-auth]
enabled  = true

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
logpath  = /var/log/nginx/error.log
maxretry = 10
EOF

systemctl enable --now fail2ban
fail2ban-client status
```

### B.2.6 Automatic security updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
# Select "Yes" to enable automatic updates
```

---

## B.3 Software Installation

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential python3 python3-pip python3-venv nginx certbot python3-certbot-nginx
```

### B.3.1 Node.js 22 (via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v22.x.x
```

### B.3.2 PM2

```bash
sudo npm install -g pm2
pm2 startup systemd -u deploy --hp /home/deploy
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
```

---

## B.4 Application Deployment

### B.4.1 Clone repository

```bash
sudo mkdir -p /opt/nse-ai-tracker
sudo chown deploy:deploy /opt/nse-ai-tracker
git clone https://github.com/savin2001/nse-ai-tracker.git /opt/nse-ai-tracker
```

### B.4.2 Environment variables

```bash
# API
cp /opt/nse-ai-tracker/.env.example /opt/nse-ai-tracker/api/.env
nano /opt/nse-ai-tracker/api/.env
```

Fill in every variable — minimum required:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=nse@yourdomain.com
ALERT_EMAIL=osukaexperiments@gmail.com
NOTIFY_SECRET=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://your-netlify-app.netlify.app
PORT=4000
NODE_ENV=production
```

```bash
# Workers
cp /opt/nse-ai-tracker/.env.example /opt/nse-ai-tracker/workers/.env
nano /opt/nse-ai-tracker/workers/.env
# Same SUPABASE_* and ANTHROPIC_API_KEY, RESEND_* values
```

Lock file permissions:

```bash
chmod 600 /opt/nse-ai-tracker/api/.env
chmod 600 /opt/nse-ai-tracker/workers/.env
```

### B.4.3 Build Express API

```bash
cd /opt/nse-ai-tracker/api
npm ci --production=false
npm run build
```

### B.4.4 Start API with PM2

```bash
cd /opt/nse-ai-tracker/api
pm2 start dist/index.js --name nse-api --max-memory-restart 512M
pm2 save
```

Verify:

```bash
pm2 status
curl http://127.0.0.1:4000/health
# Expected: {"status":"ok","db":"connected"}
```

### B.4.5 Python workers virtual environment

```bash
cd /opt/nse-ai-tracker/workers
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

---

## B.5 Nginx Configuration

```bash
nano /etc/nginx/sites-available/nse-api
```

```nginx
# /etc/nginx/sites-available/nse-api

# Redirect all HTTP → HTTPS
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # TLS — filled in by certbot
    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers (complement Helmet)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options    "nosniff"      always;
    add_header X-Frame-Options           "DENY"         always;
    add_header Referrer-Policy           "no-referrer"  always;

    # Nginx rate limiting (outer layer before Express)
    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
    limit_req zone=api burst=20 nodelay;
    limit_req_status 429;

    # Max request body (matches Express 10kb limit)
    client_max_body_size 10k;

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
    }

    # Block common attack paths
    location ~* \.(env|git|sql|log|bak)$ { return 404; }
    location ~ /\. { return 404; }
}
```

```bash
ln -s /etc/nginx/sites-available/nse-api /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### B.5.1 TLS via Let's Encrypt

```bash
certbot --nginx -d api.yourdomain.com --email osukaexperiments@gmail.com --agree-tos --no-eff-email
# certbot auto-renews via its own systemd timer
systemctl status certbot.timer
```

---

## B.6 Python Worker Cron (systemd timers)

Create a shared service template, then individual timer units.

### B.6.1 Shared worker service template

```bash
nano /etc/systemd/system/nse-worker@.service
```

```ini
[Unit]
Description=NSE AI Tracker worker: %i
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=deploy
WorkingDirectory=/opt/nse-ai-tracker/workers
Environment=PYTHONPATH=/opt/nse-ai-tracker/workers
ExecStart=/opt/nse-ai-tracker/workers/.venv/bin/python %i.py
EnvironmentFile=/opt/nse-ai-tracker/workers/.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nse-%i
# Hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/opt/nse-ai-tracker/workers

[Install]
WantedBy=multi-user.target
```

### B.6.2 Timer units

```bash
# Helper function — creates a timer file
create_timer() {
  local name=$1 oncal=$2
  cat > /etc/systemd/system/nse-${name}.timer << EOF
[Unit]
Description=NSE timer: ${name}
[Timer]
OnCalendar=${oncal}
Persistent=true
[Install]
WantedBy=timers.target
EOF
  # Point timer at the template service
  cat > /etc/systemd/system/nse-${name}.service << EOF
[Unit]
Description=NSE worker trigger: ${name}
[Service]
Type=oneshot
ExecStart=/bin/systemctl start nse-worker@${name}.service
EOF
}

create_timer "price_collector"    "Mon-Fri *-*-* 07,13:00:00 Africa/Nairobi"
create_timer "news_fetcher"       "Mon-Fri *-*-* 08,14:00:00 Africa/Nairobi"
create_timer "financials_fetcher" "Mon     *-*-* 09:00:00    Africa/Nairobi"
create_timer "macro_fetcher"      "Mon     *-*-* 09:30:00    Africa/Nairobi"
create_timer "event_detector"     "Mon-Fri *-*-* *:00:00     Africa/Nairobi"
create_timer "ai_worker"          "Mon-Fri *-*-* 18:00:00    Africa/Nairobi"
create_timer "email_digest"       "Mon-Fri *-*-* 18:30:00    Africa/Nairobi"

systemctl daemon-reload

for t in price_collector news_fetcher financials_fetcher macro_fetcher \
          event_detector ai_worker email_digest; do
  systemctl enable --now nse-${t}.timer
done

systemctl list-timers | grep nse
```

### B.6.3 Email digest timer (calls email_worker.py digest)

```bash
# Override ExecStart for email_digest specifically
mkdir -p /etc/systemd/system/nse-worker@email_digest.service.d/
cat > /etc/systemd/system/nse-worker@email_digest.service.d/override.conf << 'EOF'
[Service]
ExecStart=
ExecStart=/opt/nse-ai-tracker/workers/.venv/bin/python email_worker.py digest
EOF
systemctl daemon-reload
```

---

## B.7 Database Migrations

Run all migrations against your Supabase project from the SQL Editor
(Settings → SQL Editor in the Supabase dashboard):

```
supabase/migrations/001_create_tables.sql
supabase/migrations/002_create_indexes.sql
supabase/migrations/003_rls_policies.sql
supabase/migrations/004_seed_companies.sql
supabase/migrations/005_audit_log.sql
supabase/migrations/006_functions_triggers.sql
supabase/migrations/007_model_usage.sql
```

Execute each file in order. Check for errors after each one.

---

## B.8 Monitoring & Maintenance

### B.8.1 View live logs

```bash
# API logs
pm2 logs nse-api --lines 100

# Worker logs (journald)
journalctl -u nse-worker@ai_worker -f
journalctl -u nse-worker@price_collector --since today
```

### B.8.2 Restart API

```bash
pm2 restart nse-api
pm2 status
```

### B.8.3 Manual worker run

```bash
cd /opt/nse-ai-tracker/workers
source .venv/bin/activate
python price_collector.py
python ai_worker.py
python email_worker.py digest
```

### B.8.4 Deploy updates

```bash
cd /opt/nse-ai-tracker
git pull origin main

# Rebuild API
cd api && npm ci --production=false && npm run build
pm2 restart nse-api

# Update Python deps if requirements.txt changed
cd ../workers && source .venv/bin/activate && pip install -r requirements.txt
```

### B.8.5 AI cost monitoring

```sql
-- Run in Supabase SQL Editor
SELECT * FROM nse.daily_ai_cost ORDER BY day DESC LIMIT 30;
```

---

## B.9 Vultr-Specific Tips

- **Snapshots**: Take a Vultr snapshot after completing Section 2 (hardened base) and again after Section 4 (fully deployed). Snapshots cost ~$0.05/GB/month.
- **Firewall Groups**: You can also enforce port rules in Vultr's web console under "Firewall" — this is an additional layer before UFW.
- **Backups**: Enable Vultr automated backups ($0.50/month for the 4GB plan) for point-in-time recovery.
- **Block Storage**: If you need more than 80 GB for logs/data, attach a Vultr Block Storage volume rather than upgrading the instance.
- **IPv6**: Enable it during instance creation — it's free and future-proofs the setup.

---

## B.10 Environment Variable Checklist

| Variable | Where set | Required |
|----------|-----------|----------|
| `SUPABASE_URL` | api/.env + workers/.env | ✅ |
| `SUPABASE_ANON_KEY` | api/.env | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | api/.env + workers/.env | ✅ |
| `ANTHROPIC_API_KEY` | workers/.env | ✅ |
| `RESEND_API_KEY` | api/.env + workers/.env | ✅ |
| `RESEND_FROM_EMAIL` | api/.env + workers/.env | ✅ |
| `ALERT_EMAIL` | api/.env + workers/.env | ✅ (osukaexperiments@gmail.com) |
| `NOTIFY_SECRET` | api/.env | recommended |
| `ALLOWED_ORIGINS` | api/.env | ✅ |
| `JWT_SECRET` | api/.env | ✅ |
| `PORT` | api/.env | default 4000 |
| `NODE_ENV` | api/.env | set to `production` |

---

*NSE AI Tracker · Not financial advice*
