# Deploying

The game is one Node process: the save server (`server/`) serves the API under `/api` and the
built client for every other path. It needs Postgres. Decisions: D-062 (Postgres), D-073 (limits).

## With Docker (recommended)

```bash
docker build -t citybuilder .
docker run -d -p 8787:8787 \
  -e DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/citybuilder \
  -e TRUST_PROXY=1 \
  citybuilder
```

Or the app and Postgres together on one machine:

```bash
POSTGRES_PASSWORD=change-me docker compose --profile app up -d --build
```

Migrations run at startup. The image has a health check on `/api/health`.

## Without Docker

```bash
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production DATABASE_URL=… TRUST_PROXY=1 pnpm start
```

Node 26 (it runs the server's TypeScript directly).

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
