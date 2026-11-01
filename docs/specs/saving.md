# Saving & Accounts (Phase 10)

Players keep their cities. Guests save on their device; signing up keeps cities in an
account so they follow the player to any browser. Design decisions: D-034, D-062.

## Player Experience

- **Never lose a city.** Every city autosaves. A reload reopens the city you were playing.
- **Start screen** lists *Your cities* (newest first) with population, date and last-saved
  time. Click one to continue, or the bin icon to delete it (asks first). Founding a new
  city is still the main card.
- **Account button** (start screen header and top bar): *Log in* / *Sign up* dialog with
  email and password (8+ characters). Once logged in it shows the email and *Log out*.
- **Guest → account:** a guest's cities live on this device. After logging in, the open
  city moves into the account on its next save, and the list offers *Upload* for the
  others. Nothing is lost by signing up later.
- **Save status** in the top bar: *Saved*, *Saving…*, *Unsaved changes* or *Save failed,
  retrying*. Click it (or press `Ctrl/⌘ S`) to save now.
- The `/demo` city is never saved.

## When It Saves

- Autosave every **45 real seconds** if anything changed (an edit, or a new in-game day).
- When the tab is hidden or closed (page `visibilitychange`), and when leaving to the start screen.
- On `Ctrl/⌘ S` or the status button.
- A failed cloud save keeps the city marked dirty and retries at the next autosave.

## Save Format (`sim/save.ts`, version 1)

Only what can't be recomputed (D-034). Terrain is regenerated from its settings; road
access, utilities, coverage, commutes, needs and traffic are rebuilt on load.

```ts
interface SaveData {
  v: 1;                      // format version; migrate older ones on load
  gen: number;               // GENERATOR_VERSION the terrain came from
  name: string;
  terrain: TerrainSettings;  // preset, seed, size and sliders
  city: { funds; day; clock; taxRate };
  layers: { road; bridge; zone; cleared };   // RLE + base64, one byte per tile
  buildings: SavedBuilding[];  // [def, x, y, variant, flags, construction, fullDays, occupants, happiness %, moodDays]
}
```

- **Layers** are run-length encoded as `(value, run length as varint)` pairs, then base64.
  A 128×128 city's four layers come to a few KB.
- **cleared** is 1 where the tile has neither tree nor decor; on load those tiles are cleared
  after the terrain is regenerated (the generator is deterministic, so the rest matches).
- **flags**: bit 0 = grown, bit 1 = abandoned.
- Buildings with an unknown `def`, out-of-bounds footprint or overlapping tiles are skipped,
  so a catalog change can't make a save unloadable.
- The growth and fire random streams are reseeded with the day on load, so a reloaded
  city doesn't replay the same events.

Typical size: ~3 KB of layers plus ~45 bytes per building (a 2,000-building city ≈ 100 KB).

## Server (`server/`)

Express 5 on Node's built-in `node:sqlite` (no native build), run with Node's TypeScript
support. `pnpm dev` starts it alongside Vite, which proxies `/api` to it.

| Route | Body / result |
|---|---|
| `POST /api/auth/signup` | `{ email, password }` → `{ user }` + session cookie |
| `POST /api/auth/login` | `{ email, password }` → `{ user }` + session cookie |
| `POST /api/auth/logout` | clears the session |
| `GET /api/auth/me` | `{ user }` or `{ user: null }` |
| `GET /api/saves` | `{ saves: SaveMeta[] }` (no data) |
| `GET /api/saves/:id` | `{ meta, data }` |
| `POST /api/saves` | `{ meta, data }` → `{ meta }` (new city) |
| `PUT /api/saves/:id` | `{ meta, data }` → `{ meta }` |
| `DELETE /api/saves/:id` | `204` |

- Passwords: `scrypt` with a per-user salt, compared in constant time.
- Sessions: random 32-byte token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in
  production); only its SHA-256 is stored. 30-day expiry.
- Login and signup are limited to 10 attempts per IP per 15 minutes.
- Bodies are validated with zod; save data must be an object with a numeric `v`. Request
  bodies up to 8 MB; at most 30 cities per account.
- Tables: `users`, `sessions`, `saves` (JSON text plus `name`, `population`, `funds`,
  `day`, `size`, `preset`, `seed` columns for the list). One row per city; a save
  overwrites it (last write wins).
- In production the server also serves `dist/`, so one process runs the whole game.
  `PORT` and `DB_PATH` come from the environment.

## Client

- `SaveStore` interface (`list`, `load`, `create`, `update`, `remove`) with two
  implementations: `LocalSaveStore` (IndexedDB) and `CloudSaveStore` (the HTTP API).
- `CitySaver` owns autosave for the open city: which store and id it saves to, dirty
  tracking, and moving a local city into the account after login.
- The URL holds the open city as `?city=local:<id>` or `?city=cloud:<id>`.
