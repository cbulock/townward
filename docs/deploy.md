# Deploying Openpolis

The game is one Node process: the save server (`server/`) serves the API under `/api` and the
built client for every other path. It needs Postgres. Decisions: D-062 (Postgres), D-073 (limits).

## On a VPS (recommended)

What runs in Docker: `postgres` and `app` (the game and API), both reachable only from the server
itself (`127.0.0.1:8787` for the app). HTTPS comes from your own reverse proxy on the host.
1 GB RAM is enough.

1. **Point your domain** (`openpolis.space`) at the server's IP with an `A` record.
2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # then log out and back in
   ```
3. **Open the firewall** for SSH and the web only:
   ```bash
   sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
   ```
4. **Get the code** and configure it:
   ```bash
   git clone <your-repo-url> openpolis && cd openpolis
   cp .env.example .env
   nano .env   # POSTGRES_PASSWORD=<output of: openssl rand -hex 24>
   ```
   If ports 5432 or 8787 are already in use on the server (`ss -ltn`), set `POSTGRES_PORT` and
   `APP_PORT` in `.env` to free ones, and point your proxy at `127.0.0.1:$APP_PORT`.
5. **Start the app:**
   ```bash
   docker compose --profile app up -d --build
   curl -s http://127.0.0.1:8787/api/health   # {"ok":true}
   ```
6. **Put your HTTPS reverse proxy in front** of `http://127.0.0.1:8787`, forwarding `X-Forwarded-For` (the app trusts one proxy hop) and allowing request bodies of about 10 MB (city saves).

**Update** to a new version: `git pull && docker compose --profile app up -d --build`.

**Back up** the database (accounts and cloud saves), e.g. nightly with cron:
```bash
docker compose exec -T postgres pg_dump -U citybuilder citybuilder | gzip > backup-$(date +%F).sql.gz
```
Restore: `gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U citybuilder citybuilder`.

Keep `POSTGRES_PASSWORD` the same once the database exists (Postgres only reads it on first start).

## With Docker, behind your own proxy

```bash
docker build -t openpolis .
docker run -d -p 8787:8787 \
  -e DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/citybuilder \
  -e TRUST_PROXY=1 \
  openpolis
```

Migrations run at startup. The image has a health check on `/api/health`.

## Without Docker

```bash
bun install --frozen-lockfile
bun run build
NODE_ENV=production DATABASE_URL=… TRUST_PROXY=1 bun run start
```

Bun 1.4 (it runs the server's TypeScript directly).

## Settings

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | local Docker Postgres | Required in production. |
| `PORT` | `8787` | |
| `NODE_ENV` | `development` | `production` turns on `Secure` cookies, HSTS and serving `dist/`. |
| `TRUST_PROXY` | `loopback` | How many proxies sit in front: `1` behind one load balancer or HTTPS proxy (Render, Fly, Railway, nginx). Wrong here means every player shares the proxy's address for login limits. |
| `GUEST_SECRET` | — | **Required in production** (the server won't start without it). Key for guest fingerprints (D-083), 32+ random characters: `openssl rand -base64 48`. Changing it starts every guest's trial over. |
| `GUEST_NUDGE_MINUTES` | `10` | Guest play before the "back up your city" reminder. |
| `GUEST_LIMIT_MINUTES` | `30` | Guest play before play pauses until sign-up or log-in. |

## Checklist

- **HTTPS is required in production:** session cookies are `Secure` and HSTS is sent. Put the app behind a TLS-terminating proxy and set `TRUST_PROXY` to match.
- Set `GUEST_SECRET` and keep it stable. `TRUST_PROXY` must be right too: guest fingerprints use the client address.
- Run **one instance** (login-limit counters are in memory), or move them to Postgres/Redis before scaling out.
- Point uptime checks at `GET /api/health` (200 = up, 503 = no database).
- Back up the Postgres volume: it holds accounts and cloud saves.

## Sign in with GitHub

Off until configured; the GitHub button only appears when the server has its keys.

1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Application name: `Openpolis`
   - Homepage URL: `https://openpolis.space`
   - Authorization callback URL: `https://openpolis.space/api/auth/github/callback`
2. Copy the **Client ID**, then **Generate a new client secret** and copy it.
3. Add to `.env` on the server (never to the repo):
   ```
   PUBLIC_URL=https://openpolis.space
   GITHUB_CLIENT_ID=…
   GITHUB_CLIENT_SECRET=…
   ```
4. `docker compose --profile app up -d` and check the logs say `GitHub sign-in on`.

For local development, make a second OAuth App with callback
`http://localhost:5173/api/auth/github/callback` and run the server with
`PUBLIC_URL=http://localhost:5173` plus that app's ID and secret.

## Usage numbers

Anonymous usage events (visits and cities started, guests included) are in the `events` table
([specs/analytics.md](specs/analytics.md)). The quick way: from the project folder on the VPS, run
`./scripts/stats.sh` (last 7 days) or `./scripts/stats.sh 30` for a full report.

For your own questions, open the database
with `docker compose exec postgres psql -U citybuilder citybuilder`, then:

```sql
-- Visitors and players per day (bots excluded)
SELECT date(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
       count(DISTINCT visitor) FILTER (WHERE kind = 'visit')      AS visitors,
       count(DISTINCT visitor) FILTER (WHERE kind = 'city_start') AS players
FROM events WHERE device <> 'bot' GROUP BY day ORDER BY day DESC;

-- Where visitors come from
SELECT coalesce(utm_source, referrer, 'direct') AS source, count(DISTINCT visitor) AS visitors
FROM events WHERE kind = 'visit' AND device <> 'bot' GROUP BY source ORDER BY visitors DESC;

-- Countries (by timezone) and languages
SELECT timezone, count(DISTINCT visitor) AS visitors FROM events WHERE device <> 'bot'
GROUP BY timezone ORDER BY visitors DESC LIMIT 20;

-- Browsers, systems and devices
SELECT browser, os, device, count(DISTINCT visitor) AS visitors FROM events WHERE device <> 'bot'
GROUP BY browser, os, device ORDER BY visitors DESC;

-- What people start: new cities, saved ones, the demo, and "unlimited money" games
SELECT props::json->>'kind' AS kind, (props::json->>'customFunds')::boolean AS custom_funds, count(*)
FROM events WHERE kind = 'city_start' GROUP BY 1, 2 ORDER BY count DESC;
```

Tip: share links with tags to see which post worked, e.g.
`https://openpolis.space/?utm_source=reddit&utm_campaign=webgames`.

