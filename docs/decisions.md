# Decision Log

Format: **ID — Title** · Status · Date. Reason in one or two lines.

## Open (need your call)

- **D-001 — Product name.** Status: *Open.* We need an original name; the repo folder can stay `simcity-web`.

## Accepted

- **D-002 — Isometric 2:1 view.** 2026-10-31. Looks much richer than top-down and fits the "very cool UI" goal.
- **D-003 — Map rotation deferred until after Phase 5.** 2026-10-31. Rotation means every building needs 4 views, which doubles the art and sorting work.
- **D-010 — TypeScript + Vite + PixiJS v8 + React HUD.** 2026-10-31. Pixi gives batched WebGL sprite rendering for smooth large maps, and React suits a rich, animated HUD. They are kept in separate layers.
- **D-011 — All art generated procedurally in code.** 2026-10-31. Original, deterministic assets with no licensing issues and a tiny download. We can swap in hand-drawn art later if we want.
- **D-012 — Struct-of-arrays world state (typed arrays).** 2026-10-31. Fast, cache-friendly, trivially serializable, and Worker-ready.
- **D-013 — Flat terrain first, elevation in Phase 6.** 2026-10-31. Slopes need many extra tile shapes and complicate roads and buildings, so we get the core loop right first.
- **D-014 — All mutations through commands.** 2026-10-31. One path for validation and cost, and it enables undo/redo later.
- **D-015 — Jotai for UI state (instead of Zustand).** 2026-10-31. User preference. Atomic state means a HUD widget only re-renders when its own atom changes. The game never imports Jotai directly: it emits events, and `app/bridge.ts` writes them into atoms.
- **D-016 — WebGL renderer for now.** 2026-10-31. Pixi's WebGPU backend is still less battle-tested, and WebGL lets the debug overlay count draw calls. We can revisit in Phase 12.
- **D-017 — Ground tiles as plain sprites in per-chunk render groups (no bake-to-texture).** 2026-10-31. Baking chunks into textures costs too much GPU memory at high zoom (≈2 MB per chunk at 1×, so hundreds of MB on large maps). One atlas texture plus Pixi v8 render groups gives near-zero per-frame cost for static chunks.
- **D-018 — One terrain first: River Valley.** 2026-10-31. User call: perfect one terrain before adding presets or the New Game screen. River Valley covers every ground type (water, shore, sand, grass, trees), so the art and transition systems get fully exercised.
- **D-019 — Dual-grid terrain rendering.** 2026-10-31. Ground is drawn on a half-tile-offset grid. Each cell's corners are 4 tile centres, and transitions use rounded marching-squares masks (14 cases × 3 wobble variants per terrain). The first try, priority overlays per tile, couldn't round the higher terrain's corners, so edges stayed staircase-shaped. Bases and overlays are drawn in two passes so overdraw never shows as seams.
- **D-020 — Pixel-art style from the user's reference image.** 2026-10-31. Bright saturated palette, crisp 1px marks, dark outlines, chunky pines, a surf band on shores. Kept in our isometric view. Reference map: `?seed=42`.
- **D-021 — Decorations as a world layer (`World.decor`).** 2026-10-31. Rocks, boulders, flowers and tall grass are visual only and get cleared when something is built. Rocks are placed where they look natural: rocky meadows, forest edges and riverbanks.
- **D-022 — Roads auto-clear trees and rocks on their path.** 2026-10-31. The clearing cost is added to the road price, and the Clear tool handles bulk clearing. It's a one-line switch in `sim/commands.ts` (`planRoad`) if we'd rather require manual clearing first.
- **D-023 — Commands live in `sim/commands.ts` as pure plan/apply pairs.** 2026-10-31. Moved from the planned `game/commands.ts` so the rules are unit-testable without the renderer. The same `plan*` function drives the tool preview and the actual build, so the preview never lies.
- **D-024 — Seed 42 is the default map.** 2026-10-31. Without `?seed=` the game opens the approved River Valley. `N` still rolls new maps.
- **D-025 — Bridges are automatic, straight and land-to-land.** 2026-10-31. Any road or highway path that crosses water becomes a bridge, with no extra tool. Straight spans of up to 12 tiles keep the art simple (two orientations per type). They also avoid nonsense like bridges that turn or stop mid-river. Bridges store their axis and connect only at their ends.
- **D-026 — Sound is synthesised (Web Audio), not sampled.** 2026-10-31. This matches the procedural-art approach: no asset files, tiny download, and easy to tune in code. The AudioContext starts on the first user gesture. Mute persists in localStorage.
