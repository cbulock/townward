# Progress Log

Newest first. One entry per work session.

## 2026-10-31: Zoning & growth (Phase 4b)
- Agreed the save/backend plan before starting, to build later: Express + SQLite, email/password accounts, saves hold the seed plus what changed (D-034).
- **Zoning:** `sim/zones.ts`; `planZone`/`applyZone` (rezoning or dezoning removes grown buildings; roads and placed buildings clear the zone). Four tools on `1`–`4`, with zone-coloured previews and a "Residential $150 · 30 tiles" cost label.
- **Growth** (`sim/growth.ts`, daily, seeded RNG):
  - R/C/I demand from built capacity: homes need jobs, jobs follow homes.
  - New level-1 lots on empty zoned tiles with road access.
  - A 4-day construction stage.
  - Level-ups in place or as 2×2 merges, gated by occupancy, days and city size.
  - `chooseBuilding()` picks from the catalog.
- **Road access** now reaches 3 tiles (`findEntrance`: nearest ring first, then fewest straight steps, front first), so 3-deep zones develop.
- **Rendering:** zoned-lot layer per chunk (soft, full strength in zone view); procedural foundation and scaffold sites with a tower crane on 2×2 (`constructionArt.ts`); multi-rect `refreshWorld` so a day's changes rebuild each chunk once.
- **UI:** zone buttons in their colours, R/C/I demand meter, info panel shows construction days left and grown vs placed.
- **Tuning:** first try grew about 100 buildings in the first minute. Halved lot and upgrade rates and raised the level gates to 150 and 1,000 residents.
- Verified in headless Chromium: zoned both sides of two roads on seed 42; sites, then houses, then walk-ups and merged warehouses; 584 residents by June Y1 at 3×; rotation fine; no console errors.

## 2026-10-31: View rotation
- The user asked to see the other side of the map. Built 4-way rotation (D-032, D-033), replacing deferral D-003.
- `ViewTransform` (world ↔ view math) and `ViewWorld` (rotated copy of the tile layers, re-synced after edits). The existing chunk, road, bridge and terrain renderers work on it unchanged.
- The building painter is now rotation-aware: recipes in local space, rotated layout, camera-facing walls only, front details only when the front faces you, view-depth ordering for ground props. All 17 buildings were checked on a 4-rotation contact sheet.
- Overlays, effects, agents, previews (rotated road masks, swapped bridge axes, rotated ghosts) and picking all convert through `viewRef`.
- Controls: `,` / `.` plus top-bar rotate buttons with a compass. The camera keeps its centre and the view fades in.
- `AtlasBuilder` now emits pages of up to 4096 px. Boot is atlas ≈ 286 ms, map ≈ 18 ms.
- Tests: 15 new for transforms and view sync (85 total).
- Verified in the browser: built a town, rotated through all 4 sides with traffic running, and placed a building in a rotated view (it landed under the cursor).
- Gotcha: the first scripted test failed because the input started before a cold dev-server load finished. It was not a game bug.

## 2026-10-31: Simulation, cars and people (Phase 4c)
- **Dynamics:** calendar (1 day = 2 s), speed controls, road access per building, population that grows toward a job-dependent target, jobs filling from the workforce, and a monthly budget (taxes vs upkeep) with a toast.
- **Traffic:** cached, bridge-aware BFS routing. Cars, taxis, buses and trucks drive on the right with smooth lane changes through turns and run faster on highways. Pedestrians stroll the pavements with a walk cycle. Density follows population (caps: 320 cars, 180 people).
- **Rendering:** pooled, screen-culled, depth-sorted agent layer with zoom LOD. Procedural vehicle art (4 kinds × 6 colours × 4 headings, head and tail lights) and people (8 variants × 2 frames).
- **UI:** top bar (date, population, workers/jobs, funds, speed, mute); click-to-inspect info panel with occupancy bar, road status and Demolish; orange "no road" badges; debug overlay hidden by default with boot timings and agent counts.
- **Optimisation:** measured boot (atlas ≈ 200 ms, map ≈ 20 ms) and found no hotspot worth restructuring. Agents are capped, culled and LOD'd; routes are cached; the daily sim is O(buildings).
- Verified in the browser: built a street, ran at 3× for a month (population 419, 247/524 jobs, January budget +$1,689), saw cars, buses and pedestrians, inspected buildings, and saw the no-road badge. 70 tests.
- Fixed: city name wrapping in the top bar.

## 2026-10-31: Phase 4a building catalog and art
- Plan agreed: 4a catalog and art → 4b zoning and growth → 4c moving cars.
- **17 buildings**:
  - Homes: Cottage, Family House, Townhouses, Walk-up, Apartment Block, Condo Tower
  - Shops & Offices: Corner Shop, Café, Small Office, Supermarket, Hotel, Office Tower
  - Industry: Workshop, Warehouse, Factory
  - Civic: Park, Town Hall
- Procedural painter: lit and shaded walls; gable, hip, flat and sawtooth roofs; punched, band, curtain-wall, shopfront, townhouse and industrial facades; awnings, signs (sheared text), balconies, water tank, AC units, canopy, lit crown, loading docks, smokestack, parking lot with cars. 3 colour variants each.
- `World.building` and `World.buildings`. `planPlace`/`applyPlace` with footprint checks and auto-clearing. Clear removes whole buildings, and roads can't pass through buildings. 9 new tests (59 total).
- Build tool (`E`) with a picker (category tabs, live thumbnails painted by the same code, cost and size), a ghost preview, a cost or "can't build here" label, plus pop, dust and sound.
- Added `?funds=` URL option for testing. Gave parks a hedge and paved edge (they blended into the grass).
- Verified in the browser: placed all 17 types, no console errors.

## 2026-10-31: Bridges, build effects and sound (Phase 3 complete)
- **Bridges:** a new `World.bridge` layer. Paths crossing water become straight, land-to-land bridges (max 12 tiles) at $60 or $160 per tile. They connect only at their ends, and clearing removes them. 8 new tests (50 total).
- Bridge art: deck markings, rails and posts, a dark side face, pillars, and a shadow on the water. The first version looked too much like road, so it was made more distinct.
- **Effects:** a rippling additive pop flash and pooled particles (dust, splash, leaves and chips, rock grit) with a 1,500 cap and capped ripple time.
- **Sound:** procedural Web Audio (build thunk and ticks, bridge ping, clear crunch, error buzz, tool click). `M` and a speaker button mute it; the setting persists.
- Verified in the browser: bridge preview and pricing, build pop and dust, leaf burst on clear, no console errors. (Sound can't be checked headless.)
- The user asked for more realistic bridges. Rebuilt them in taller frames with piers and ripples, a girder, parapet walls, lamp posts and a soft shadow. Toned down the first pass's shadow (it read as a slab on the sand) and the ripples (they looked like white squares).

## 2026-10-31: Phase 3 roads, highways and clearing
- Seed 42 (the approved River Valley) is now the default map.
- Sim: `RoadType` (road/highway), `roadMask`, L-path (`Shift` = straight), rectangle selection, `City` funds, and pure `planRoad`/`applyRoad`/`planClear`/`applyClear`. 14 new tests, 42 total.
- Art: 16 auto-tiled pieces each for street (sidewalks, dashed centre line, zebra crossings at junctions) and highway (guard rails, lanes, median).
- Game: tool system (`Q` select, `B` clear, `R` road, `H` highway, `Esc`/right-click cancel). Left-drag uses the tool, right-drag pans. Live ghost preview and cost label. Chunk refresh rebuilds only roads and objects.
- UI: toolbar with icons, tooltips and hotkeys; top bar with funds (flashes on spend); cost label that flips near screen edges; error toasts.
- Verified in the browser: build road, highway and L-paths; clear a forest (preview plus cost); funds update; no console errors.
- **Open:** placement juice and bridges (Phase 3 leftovers), 60 FPS check on real hardware, product name.

## 2026-10-31: Phase 2a River Valley terrain
- Narrowed Phase 2 to **one terrain done perfectly** (River Valley), as the user asked. Presets and the New Game screen moved to 2b.
- Generator: own simplex noise, winding river plus tributary, lakes, cleanup, sand rims, forest clumps, decorations. 28 tests pass.
- The user shared a reference image (pixel-art map). We matched its style: bright palette, narrow winding river with a surf edge, chunky outlined pines, rocks and flowers. Dropped the dirt and rock ground patches for this terrain.
- Rendering switched to a **dual grid**, because the first overlay approach left staircase edges. Fixed hairline seams with two-pass drawing (bases, then overlays).
- Added a soil slab along the map edge, the `N` key for a new seed (kept in the URL), and the seed in the debug overlay.
- The user approved **seed 42** ("looks perfect"). It's now the reference map.
- Added rocks where natural (rocky meadows, forest edges, riverbanks) plus a mossy boulder pile. Decor uses its own random stream, so seed 42's layout is unchanged.
- **Open:** 60 FPS check on real hardware. Product name (D-001). Whether to switch to a top-down camera like the reference (currently isometric).

## 2026-10-31: Phase 1 engine foundation
- Scaffolded Vite + TS + React 18 + PixiJS 8 + Jotai 3, with ESLint (rule: `src/sim` can't import render/UI/game), Prettier, Vitest. Switched to **pnpm**.
- Built the `World` (typed-array layers), iso math plus tests, the procedural atlas (`AtlasBuilder`, drawn at 2× with mipmaps), the chunked ground renderer (16×16 render groups plus culling), the eased camera (cursor-anchored zoom, 1:1 drag, WASD, edge scroll, trackpad pinch/pan), the hover highlight, the fixed-timestep loop, the F3 debug overlay and the G grid toggle.
- Verified in headless Chrome: renders, hover, zoom, grid, drag, culling (draw calls ≈ visible chunks), no console errors.
- Fixes found while testing: grass variants differed too much (checkerboard look), so base colours were evened out. Zoomed far out, a diamond seam pattern showed through, so a map-shaped grass layer now sits under the tiles.
- Gotcha: adding `packageManager` to package.json made pnpm 12 try to download a native binary and fail, so it is not pinned.
- **Open:** confirm 60 FPS at `?size=256` on real hardware. Product name (D-001).
- **Next:** Phase 2, terrain generator and New Game screen.

## 2026-10-31 — Phase 0: Planning
- Created docs: vision, architecture, roadmap, UI/UX, specs (terrain, roads, buildings), decision log.
- Open decisions D-001 (name), D-002 (iso vs top-down) and D-003 (rotation) need sign-off.
- **Next:** Phase 1, engine foundation (scaffold, iso grid, camera, picking, debug overlay).
