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

## Phase 2b — More terrains + New Game screen ✅  → [specs/terrain.md](specs/terrain.md)

- [x] Presets: Plains, Coastal, Island, Lakes, Forested (River Valley unchanged, byte-identical)
- [x] **New Game screen:** preset cards, seed field + 🎲, map size, sliders (water, trees, rivers, coast), live minimap preview (< 10 ms at 128), "Start building"; options kept in the URL; "New city" in the top bar
- [x] Minimap painter (`render/minimap.ts`), shared by the HUD and the preview
- [x] Preset tests (4 new)

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

## Phase 4a — Building Catalog & Art ✅  → [specs/buildings.md](specs/buildings.md)

- [x] Building catalog (sim): 17 essential types across residential, commercial, industrial and civic, each with size, level, cost and capacity
- [x] Procedural building painter: iso boxes with lit and shaded faces; gable, hip, flat and sawtooth roofs; windows, balconies, awnings, signs, chimneys, water tanks, loading docks
- [x] 3 colour variants per building so neighbours don't match
- [x] World building layer + instances; footprint validation (land, no roads, no other buildings; trees auto-cleared)
- [x] Build tool (`E`) with a building picker (categories, live thumbnails, cost); ghost footprint preview
- [x] Clear tool removes whole buildings
- [x] Pop, dust and sound on placement; tests (59 total)

## View Rotation ✅  (D-032, D-033)

- [x] `ViewTransform` + `ViewWorld`: draw the map from any of 4 sides; sim stays in world space
- [x] Buildings in 4 orientations from one recipe (front details only when the front faces you)
- [x] Roads, bridges, terrain, trees, cars, people, previews, effects, badges and picking all rotation-aware
- [x] Controls: `,` / `.` and top-bar ⟲ ⟳ with a compass; camera keeps its centre; fade transition
- [x] Atlas pages (≤4096 px) for the bigger atlas; tests for transforms and view sync (85 total)

## Phase 4b — Zoning & Growth ✅  → [specs/buildings.md](specs/buildings.md)

- [x] Zone tools: R / C / I / Dezone (`1`–`4`), drag-rectangle, $5/tile; zone tint, full-strength zone view while zoning
- [x] Growth: zoned tiles within 3 tiles of a road develop and level up (house → walk-up → tower); 2×2 lots merge
- [x] Construction animation (foundation → scaffold, crane on 2×2 → building pops in)
- [x] Info panel (construction status, grown vs placed); R/C/I demand meter in the top bar
- [x] Growth tests (9 new, 94 total)

## Phase 4c — Simulation, Moving Cars & People ✅  → [specs/simulation.md](specs/simulation.md)

- [x] Calendar + speed controls (pause/1×/2×/3×, Space, [ ])
- [x] Road access per building, with warning badges
- [x] Population: homes fill over time, faster when jobs exist; jobs take workers from the workforce
- [x] Monthly budget: taxes vs road and civic upkeep, with a toast report
- [x] Road graph routing (BFS, cached, bridge-aware)
- [x] Cars (car, taxi, bus, truck), right-hand lanes, smooth turns, faster on highways
- [x] Pedestrians on pavements with a walk cycle
- [x] Agent renderer: pooled, culled, depth-sorted, zoom LOD
- [x] Top bar: date, population, workers/jobs, funds, speed; building info panel with Demolish
- [x] Sim tests (11 new, 70 total)
- [x] Car queuing (lane gaps, junction boxes), rush hours on the time-of-day clock, bus stops with shelters and dwelling buses (4 new tests)

**DoD (4a–4c):** zone next to roads, watch a small town grow, and see cars driving around it, all at 60 FPS.

---

## Phase 5 — HUD & Polish ✅  → [04-ui-ux.md](04-ui-ux.md)

- [x] Final toolbar with icons, tooltips and hotkeys, in three groups
- [x] Top bar: city name, date + clock, money, population, demand, speed controls, rotate, mute, New city
- [x] Minimap in HUD with click/drag-to-jump and a viewport quad
- [x] Toast notifications
- [x] Sound effects + ambient audio (wind, city hum, birds), with a mute toggle
- [x] Day/night tint on a time-of-day clock (`L` toggles)

---

## Phase 6 — Map Edge (Borderlands) ✅  → [specs/elevation.md](specs/elevation.md)

- [x] Borderlands: flat decorative land round the map (rivers and sea carried on), fading into fog, with a dashed border line (replaces the soil slab)
- [x] Zoom-out limited to keep the screen inside the map
- [x] ~~Hills, Raise/Lower/Level tools~~: built, then removed at the user's request to keep the game simple (D-051). Maps are flat; the renderer can still draw heights.

## Phase 7 — Core City ✅  → [specs/core.md](specs/core.md)

- [x] Slower time (6 s days), true 1×/2×/3×, day/night control (cycle / day / night) in the top bar
- [x] Density zones: Apartments and Offices (tools 1–5)
- [x] Utilities: power plant and water tower over the road network; ⚡/💧 badges and first-time hints
- [x] Services: police, fire, clinic, school with coverage; occupancy and level-ups depend on it; fires
- [x] Budget panel (click the funds): tax rate, forecast, utility supply; civic upkeep
- [x] Civic panel tabs (Services / Utilities / Parks & Civic), coverage preview while placing
- [x] Tests (107) and docs

## Later Phases (to be specced when we get there)

| Phase | Theme |
|---|---|
| 8 | More services: hospitals, universities, coverage map overlays |
| 9 | Traffic & pollution, data map overlays |
| 10 | Save/Load: Express + SQLite backend with email/password accounts, IndexedDB autosave, multiple cities (D-034) |
| 11 | Disasters, events, achievements |
| 12 | Performance pass: sim in a Web Worker, 256×256+ maps |
