# Progress Log

Newest first. One entry per work session.

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
