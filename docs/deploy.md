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

## Checklist

- **HTTPS is required in production:** session cookies are `Secure` and HSTS is sent. Put the app behind a TLS-terminating proxy and set `TRUST_PROXY` to match.
- Run **one instance** (login-limit counters are in memory), or move them to Postgres/Redis before scaling out.
- Point uptime checks at `GET /api/health` (200 = up, 503 = no database).
- Back up the Postgres volume: it holds accounts and cloud saves.
