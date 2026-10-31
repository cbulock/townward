# 03 — Roadmap & Progress Tracker

Legend: ✅ done · 🚧 in progress · ⬜ not started

Each phase ends with a **Definition of Done (DoD)** that we verify before moving on.

---

## Phase 0 — Planning & Docs ✅

- [x] Vision, architecture, roadmap, UI and specs written
- [x] User sign-off: isometric view, rotation deferred, Jotai instead of Zustand, pnpm (name still open)

---

## Phase 1 — Engine Foundation 🚧 (built; awaiting 60 FPS check on real hardware)

Goal: an empty isometric world you can fly around smoothly.

- [x] Vite + TS + React + Pixi project scaffold, ESLint/Prettier, Vitest
- [x] `World` with typed-array layers (flat grass map for now)
- [x] Iso math (`iso.ts`) with unit tests (tile ↔ screen round-trip)
- [x] Procedural atlas v0: grass tile with variants plus grid line
- [x] Chunked ground renderer + viewport culling
- [x] Camera: drag-pan (middle/right mouse), WASD/arrow keys, edge-scroll, wheel zoom anchored at cursor, eased motion, zoom limits
- [x] Tile hover highlight (accurate diamond picking)
- [x] Fixed-timestep loop + debug overlay (FPS, draw calls, hovered tile) on `F3`

**DoD:** 256×256 flat map pans/zooms at 60 FPS and the hover highlight is pixel-accurate.

> Test it with `pnpm dev`, then open `http://localhost:5173/?size=256`. Hover picking is covered by unit tests and was checked in a headless browser. FPS must be checked on a real GPU, because headless Chrome renders in software.

---

## Phase 2a — River Valley terrain, done perfectly 🚧 (looks approved on seed 42; awaiting 60 FPS check)  → [specs/terrain.md](specs/terrain.md)

We focus on **one** terrain and make it look great before adding presets or menus.

- [x] Seeded simplex noise + fBm utilities (no dependency)
- [x] River Valley generator: winding narrow river, tributary, lakes, cleanup, sand rims, forest clumps
- [x] Generator tests: deterministic, river crosses the map, no 1-tile specks, speed budget
- [x] Pixel-art ground for all 7 terrain types (bright palette from the user's reference)
- [x] Dual-grid terrain transitions: rounded marching-squares contours, no staircase edges, no seams
- [x] Shoreline surf band and animated water shimmer
- [x] Chunky outlined pines (cluster sprites, 3 densities × 6 variants), depth-sorted, with shadows
- [x] Decorations: rocks (meadows, forest edges, riverbanks), boulders, flowers, tall grass
- [x] Diorama soil slab along the map edge
- [x] Grid as a separate layer (works over every terrain)
- [x] `N` key: new random seed (seed shown in debug overlay and kept in the URL)
- [ ] 60 FPS confirmed on real hardware at 128×128

**DoD:** any seed produces a natural-looking river valley with no visual seams or hard tile edges, and it holds 60 FPS on 128×128.

## Phase 2b — More terrains + New Game screen ⬜

- [ ] Presets: Plains, Coastal, Island, Lakes, Forested
- [ ] **New Game screen:** preset cards, seed field + 🎲, map size, sliders (water, trees, …), live minimap preview, "Start" button
- [ ] Minimap component (reused in HUD later)

**DoD:** the player picks a preset, tweaks sliders, sees the preview update in under 100 ms and starts a game on that terrain.

---

## Phase 3 — Roads, Highways & Clearing ✅ (pending 60 FPS check)  → [specs/roads.md](specs/roads.md)

- [x] Toolbar + tool system (Select/Clear/Road/Highway, hotkeys, Esc/right-click cancel)
- [x] Road tool: click-drag L-shaped path (Shift = straight), ghost preview, cost label at cursor
- [x] Highway tool (wider, median, lane markings); roads and highways connect
- [x] Validation (no roads on water/rock; contiguous run from start); invalid tiles tinted red
- [x] Trees/rocks on a road path are auto-cleared at their clearing cost
- [x] 4-bit autotiling for both types: straight, corner, T, cross, dead end (16 masks each)
- [x] Clear tool: drag a rectangle to remove trees, rocks and roads, with live cost
- [x] Money: starting funds, costs, top-bar funds with flash, "not enough money" toast
- [x] Sim tests: paths, pricing, water cut-off, upgrades, insufficient funds, clearing
- [x] Bridges over water: straight, land to land, max 12 tiles, connect only at their ends
- [x] Placement juice: rippling pop flash, dust/leaf/grit/splash particles
- [x] Procedural sound effects (build, bridge, clear, error, tool) + mute (`M`, persisted)

**DoD:** drawing a road network feels instant and satisfying, pieces connect correctly in every configuration and clearing re-tiles the neighbours.

---

## Phase 4 — Zoning & Buildings ⬜  → [specs/buildings.md](specs/buildings.md)

- [ ] Zone tool: R / C / I paint by drag-rectangle (only on buildable land)
- [ ] Zone tint overlay plus a toggleable zone view
- [ ] Building definitions registry (size, zone, level, art generator)
- [ ] Procedural building art: 1×1, 2×2 and 3×3 for R/C/I at 3 levels
- [ ] Growth system: zoned tiles within reach of a road develop over time; small lots merge into bigger ones
- [ ] Construction animation (scaffold → building)
- [ ] Placeable buildings: Power Plant (3×3), Park (1×1), Town Hall (2×2)
- [ ] Bulldoze buildings; dezone
- [ ] Info panel: click a tile or building to see details
- [ ] Population counter in the top bar

**DoD:** zone next to roads, press play and watch a small town grow without frame drops.

---

## Phase 5 — HUD & Polish ⬜  → [04-ui-ux.md](04-ui-ux.md)

- [ ] Final toolbar with icons, tooltips and hotkeys
- [ ] Top bar: city name, date, money, population, speed controls (pause/1×/2×/3×)
- [ ] Minimap in HUD with click-to-jump and a viewport rectangle
- [ ] Toast notifications
- [ ] Sound effects + ambient audio, with a mute toggle
- [ ] Day/night tint (cosmetic)

---

## Later Phases (to be specced when we get there)

| Phase | Theme |
|---|---|
| 6 | Elevation & terraforming (slopes, raise/lower, bridges) |
| 7 | Core simulation: power grid, water, RCI demand, budget & taxes |
| 8 | Services: police, fire, health, education, coverage overlays |
| 9 | Traffic & pollution, data map overlays |
| 10 | Save/Load (IndexedDB), settings, multiple cities |
| 11 | Disasters, events, achievements |
| 12 | Performance pass: sim in a Web Worker, 256×256+ maps |
