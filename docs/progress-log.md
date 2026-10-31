# Progress Log

Newest first. One entry per work session.

## 2026-10-31: Bridges, build effects and sound (Phase 3 complete)
- **Bridges:** a new `World.bridge` layer. Paths crossing water become straight, land-to-land bridges (max 12 tiles) at $60 or $160 per tile. They connect only at their ends, and clearing removes them. 8 new tests (50 total).
- Bridge art: deck markings, rails and posts, a dark side face, pillars, and a shadow on the water. The first version looked too much like road, so it was made more distinct.
- **Effects:** a rippling additive pop flash and pooled particles (dust, splash, leaves and chips, rock grit) with a 1,500 cap and capped ripple time.
- **Sound:** procedural Web Audio (build thunk and ticks, bridge ping, clear crunch, error buzz, tool click). `M` and a speaker button mute it; the setting persists.
- Verified in the browser: bridge preview and pricing, build pop and dust, leaf burst on clear, no console errors. (Sound can't be checked headless.)

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
