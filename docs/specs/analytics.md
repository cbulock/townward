# Spec: Usage Analytics

Status: **Implemented** (2026-11-02, D-076). User request: know that people are playing, from
which browsers and countries, and where they came from (Twitter, Reddit …), guests included.

## What is recorded

One row per event in the `events` table:

| Event | When |
|---|---|
| `visit` | The app loads (once per page load) |
| `city_start` | A player founds a new city, opens a saved one, or opens the demo |

Each row holds:

- **visitor:** a random ID made in the browser and kept in localStorage (`openpolis.visitor`). It counts unique visitors without cookies or accounts. Clearing site data gives a new one.
- **user_id:** the account, if signed in (from the session; never sent by the client).
- **path**, **referrer host** (e.g. `t.co`, `www.reddit.com`), and **utm_source / utm_medium / utm_campaign** from the URL.
- **browser, os, device** (`desktop` / `mobile` / `tablet` / `bot`), parsed on the server from the User-Agent. The raw User-Agent is not stored.
- **timezone** (e.g. `Asia/Kolkata`) and **language** (e.g. `en-IN`): together they give the country without using the IP address.
- **screen** size (`1440x900`).
- **props:** small event details, e.g. `{ "preset": "coastal", "size": 128, "kind": "new" }`.

## Privacy

- No IP addresses, cookies, names or emails are stored with events. Without the IP, the data isn't tied to a person, so no consent banner is needed.
- Browsers with Do Not Track on send nothing.
- Guests' cities are still never uploaded; only these small events are.

## Safety

- `POST /api/events` returns 204 and never blocks the game; failures are ignored by the client.
- Validated with zod (short strings, known event kinds). At most 120 events per address per 10 minutes, then 429.
- Bots (crawler User-Agents) are stored with `device = 'bot'` so queries can exclude them.

## Reading it

Queries for the VPS are in [deploy.md](../deploy.md), "Usage numbers".
