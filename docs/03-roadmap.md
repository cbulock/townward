# 03 — Roadmap & Progress Tracker

Legend: ✅ done · 🚧 in progress · ⬜ not started

Each phase ends with a **Definition of Done (DoD)** that we verify before moving on.

---

## Phase 0 — Planning & Docs ✅

- [x] Vision, architecture, roadmap, UI and specs written
- [ ] User sign-off on open decisions (see [decisions.md](decisions.md), "Open")

---

## Phase 1 — Engine Foundation ⬜

Goal: an empty isometric world you can fly around smoothly.

- [ ] Vite + TS + React + Pixi project scaffold, ESLint/Prettier, Vitest
- [ ] `World` with typed-array layers (flat grass map for now)
- [ ] Iso math (`iso.ts`) with unit tests (tile ↔ screen round-trip)
- [ ] Procedural atlas v0: grass tile with variants plus grid line
- [ ] Chunked ground renderer + viewport culling
- [ ] Camera: drag-pan (middle/right mouse), WASD/arrow keys, edge-scroll, wheel zoom anchored at cursor, eased motion, zoom limits
- [ ] Tile hover highlight (accurate diamond picking)
- [ ] Fixed-timestep loop + debug overlay (FPS, draw calls, hovered tile) on `F3`

**DoD:** 256×256 flat map pans/zooms at 60 FPS and the hover highlight is pixel-accurate.

---

## Phase 2 — Terrain ⬜  → [specs/terrain.md](specs/terrain.md)

- [ ] Seeded RNG + noise utilities
- [ ] Terrain generator (height/moisture noise → terrain types, rivers, lakes, coast)
- [ ] Terrain presets: Plains, Coastal, Island, River Valley, Lakes, Forested
- [ ] Atlas: water (animated shimmer), shallow water, sand, grass, dry grass, dirt, rock; shoreline transition tiles
- [ ] Trees as objects (3 densities, seeded variety)
- [ ] **New Game screen:** preset cards, seed field + 🎲, map size, sliders (water, trees, …), live minimap preview, "Start" button
- [ ] Minimap component (reused in HUD later)

**DoD:** the player picks a preset, tweaks sliders, sees the preview update in under 100 ms and starts a game on that terrain. The same seed always gives the same map.

---

## Phase 3 — Roads ⬜  → [specs/roads.md](specs/roads.md)

- [ ] Toolbar shell + tool system (select/active tool, Esc to cancel)
- [ ] Road tool: click-drag with L-shaped path, ghost preview, cost label at cursor
- [ ] Validation (no roads on water yet, no overlap with buildings); invalid tiles tinted red
- [ ] 4-bit autotiling: straight, corner, T, cross, dead-end (16 masks)
- [ ] Bulldoze tool (drag rectangle) for roads and trees
- [ ] Money: starting funds, costs, "not enough money" feedback
- [ ] Placement juice: pop-in animation, dust puff, sound hook

**DoD:** drawing a road network feels instant and satisfying, pieces connect correctly in every configuration and bulldozing re-tiles the neighbours.

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
