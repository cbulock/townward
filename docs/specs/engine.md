# Engine for Depth (Phase 11)

The foundation every later phase builds on ([05-master-plan.md](../05-master-plan.md) §4, §13).
It's built in six steps, each measured by the one before it.

| Step | What | Status |
|---|---|---|
| **11.1** | Headless harness, per-system timings, exact save → load continuation | ✅ |
| 11.2 | City history (ring buffer, saved) + Graphs panel | next |
| 11.3 | Cadence tiers + time-slicing (`SlicedSystem`) | |
| 11.4 | Fields engine (coarse grids: diffuse, decay, wind) | |
| 11.5 | Road segment graph + Dijkstra + isochrones | |
| 11.6 | Simulation in a Web Worker | |

**Why this order:** measure first (11.1), so every later step proves its gain and proves it
didn't change the game. The Worker (11.6) comes last, because it moves everything the other
steps build, and it hands the city over in the same serialized form that 11.1 made exact.

---

## 11.1 Harness, Timings and Determinism ✅

### Timings (`sim/core/timings.ts`)

`Simulation` runs every hook through `SystemTimings.run('system.hook', fn)`, which records
calls, total, average and max ms. That's two clock reads per call, so it's always on.

- **F3 overlay:** the five slowest hooks, average and max ms, in amber over budget and red over 1.5× budget.
- **Budgets** (`SYSTEM_BUDGETS_MS`) follow master plan §13. Day work is budgeted as if it ran in one tick until 11.3 spreads it out.

### Harness (`bun run sim:run`, `scripts/sim-run.ts`)

```
bun run sim:run --scenario demo|blank --preset riverValley --seed 42 --size 128 --years 2 --out history.csv
bun run bench          # demo, 1 year, with the budget report
bun run sim:run ... --strict   # exits 1 if any hook averages over 1.5× its budget
```

It runs the real sim on Node with no rendering and no build step: `scripts/resolve-ts.mjs`
resolves Vite-style extensionless imports, and Node strips the types. Output: monthly
`CitySample` rows (`sim/history.ts`) as CSV, plus the timing table.

This is why `src/sim`, `src/shared`, `scripts` and `server` are **erasable TypeScript only**
(no constructor parameter properties, no enums), enforced by ESLint (D-065).

### Baseline (2026-11-01, `/demo` seed 42, 128×128, 1 year, M-series laptop)

| Hook | Avg ms | Budget | Share |
|---|---|---|---|
| `commute.day` | 72.5 | 25 | 79% |
| `needs.day` | 12.2 | 4 | 13% |
| `needs.change` | 6.0 | 4 | 7% |
| everything else | < 0.5 each | — | ~1% |

A demo day costs **~92 ms in one tick**: 5–6 dropped frames every in-game day. Routing is
the whole problem. 11.3 spreads the work over ticks (no hitch), and 11.5 makes routing
itself cheap (segment graph instead of tile Dijkstra). A year of the demo runs headless in
~33 s; the Phase 11 goal is 10 years in under a minute.

### Determinism: save → load continues exactly

A loaded city must play out exactly like the one that kept running. Players expect it, the
harness relies on it, and the Worker (11.6) receives the city this way.

What carries over from day to day without being in the world layers is now saved in the
optional `sim` block of the save (`SavedSimState`):

| State | Why it matters | Stored as |
|---|---|---|
| Growth and fire random streams (`RandomStream`) | which lots grow, which buildings burn | one uint32 each |
| Smoothed commute volume | congestion is a running blend (40% new, 60% old) | float32 per road tile, base64 |
| Commute minutes per home | needs and happiness read them before the next compute | float64 per building, base64 |

`loadSimulation(data)` rebuilds the city, brings every system up to date, puts the saved
state back and re-scores needs from it. `Game` no longer re-runs `worldChanged` on a loaded
city (that extra commute pass is what made reloads drift). Saves without the block load as
before: fresh streams and a cold commute model.

Tests (`tests/determinism.test.ts`): a growing 64×64 town run 40 days straight equals one run
10 days, saved to JSON, loaded and run 30 more. Every building field (exact happiness),
roads, zones, money, commute volume and stream states must match. Loading without the `sim`
block makes it fail, so the test has teeth.

---

## 11.2–11.6 (to detail when each starts)

- **11.2 History:** ring buffer of `CitySample` (90 days daily + 10 years monthly), saved, and a Graphs panel.
- **11.3 Time-slicing:** `SlicedSystem.step(budgetMs)` processes 1/N of the buildings per tick, so day work spreads over the ticks between days. The definition of done is no frame over 16 ms from the sim on `/demo`.
- **11.4 Fields:** `Float32Array` at one cell per 2×2 tiles; sources → 3×3 diffuse → decay → clamp; one field per tick, round-robin.
- **11.5 Road graph:** nodes at junctions, entrances and stops; edges are segments with length, capacity and travel time; binary-heap Dijkstra; cached isochrones. Target: `commute.day` under 25 ms on `/demo`.
  - **First part done (2026-11-04):** the tile graph is built once per day (CSR adjacency with the one-way and median rules applied, entry minutes at today's congestion), Dijkstra runs on typed arrays, jobs are flat arrays, and the visible-car trips take the top 4 without sorting. `commute.day` on /demo: 64.8 → **15.3 ms** (a sim day 81.8 → 32.1 ms), with byte-identical history. Segment compression was measured as not worth it yet: homes front almost every road tile (494 origin and 466 job entrances on 1,096 road tiles), so nearly every tile would stay a node. Isochrones are still to do (they come with travel-time service reach).
- **11.6 Worker:** the worker owns World, City and Simulation; the main thread sends commands and gets day snapshots plus a transferred agent buffer. The harness's determinism check proves the move changed nothing.
