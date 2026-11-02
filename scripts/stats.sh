#!/bin/sh
# Openpolis usage report (docs/specs/analytics.md). Run on the server from the project folder:
#   ./scripts/stats.sh        last 7 days
#   ./scripts/stats.sh 30     last 30 days
set -e
DAYS="${1:-7}"
case "$DAYS" in *[!0-9]*|'') echo "usage: $0 [days]" >&2; exit 1 ;; esac

docker compose exec -T postgres psql -U citybuilder citybuilder -q -P pager=off <<SQL
\echo
\echo '== Totals, last $DAYS days (bots excluded) =='
SELECT count(DISTINCT visitor) FILTER (WHERE kind = 'visit')      AS visitors,
       count(DISTINCT visitor) FILTER (WHERE kind = 'city_start') AS players,
       count(*) FILTER (WHERE kind = 'city_start')                AS cities_started,
       (SELECT count(*) FROM users WHERE created_at > now() - interval '$DAYS days') AS new_accounts
FROM events WHERE device <> 'bot' AND created_at > now() - interval '$DAYS days';

\echo '== Per day =='
SELECT date(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
       count(DISTINCT visitor) FILTER (WHERE kind = 'visit')      AS visitors,
       count(DISTINCT visitor) FILTER (WHERE kind = 'city_start') AS players
FROM events WHERE device <> 'bot' AND created_at > now() - interval '$DAYS days'
GROUP BY day ORDER BY day DESC;

\echo '== Where they came from =='
SELECT coalesce(utm_source, referrer, 'direct') AS source, count(DISTINCT visitor) AS visitors
FROM events WHERE kind = 'visit' AND device <> 'bot' AND created_at > now() - interval '$DAYS days'
GROUP BY source ORDER BY visitors DESC LIMIT 15;

\echo '== Countries (by timezone) =='
SELECT coalesce(timezone, 'unknown') AS timezone, count(DISTINCT visitor) AS visitors
FROM events WHERE device <> 'bot' AND created_at > now() - interval '$DAYS days'
GROUP BY timezone ORDER BY visitors DESC LIMIT 15;

\echo '== Browsers and devices =='
SELECT browser, os, device, count(DISTINCT visitor) AS visitors
FROM events WHERE device <> 'bot' AND created_at > now() - interval '$DAYS days'
GROUP BY browser, os, device ORDER BY visitors DESC LIMIT 15;

\echo '== Cities started =='
SELECT props::json->>'kind' AS kind,
       coalesce((props::json->>'customFunds')::boolean, false) AS unlimited_money,
       count(*) AS starts
FROM events WHERE kind = 'city_start' AND device <> 'bot' AND created_at > now() - interval '$DAYS days'
GROUP BY 1, 2 ORDER BY starts DESC;
SQL
