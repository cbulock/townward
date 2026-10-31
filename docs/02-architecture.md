# 02 — Architecture

## Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Large codebase, so we want types everywhere |
| Package manager | **pnpm** | Fast, strict dependency resolution |
| Build/dev | **Vite** | Fast HMR, simple config |
| World rendering | **PixiJS v8** (WebGL2, WebGPU when available) | Batched sprite rendering handles 10k+ tiles at 60 FPS |
| UI / HUD | **React 18** + **Jotai** (atomic state) | Rich, animated panels; fine-grained atoms mean only the widget that changed re-renders |
| Styling | CSS with design tokens (CSS variables) | Themeable and fast, with no runtime CSS-in-JS |
| Noise | `simplex-noise` + seeded PRNG | Deterministic terrain generation |
| Tests | **Vitest** | Unit tests for pure logic (generators, autotiling, growth rules) |
| Lint/format | ESLint + Prettier | Consistency |

## High-Level Layers

```
┌────────────────────────────────────────────────────────────┐
│  UI (React)       toolbar, panels, new-game screen, HUD    │
│        ▲ reads store            │ dispatches commands      │
├────────┼────────────────────────▼──────────────────────────┤
│  Game Controller   tools, input → commands, event bus      │
├────────────────────────────────────────────────────────────┤
│  Simulation (pure TS, no DOM)   World state + tick systems │
├────────────────────────────────────────────────────────────┤
│  Renderer (Pixi)   reads World, draws chunks, overlays     │
└────────────────────────────────────────────────────────────┘
```

**Rule:** the simulation never imports Pixi or React. It is pure data plus
functions, which keeps it testable and lets it move into a Web Worker later.

## Folder Layout (planned)

```
src/
  main.tsx                 app bootstrap
  app/                     React UI
    screens/               NewGameScreen, GameScreen
    hud/                   Toolbar, TopBar, Minimap, InfoPanel, Toasts
    atoms.ts               Jotai atoms (UI state only)
    bridge.ts              game events → atoms
  game/
    Game.ts                owns World + Renderer + loop
    loop.ts                fixed-timestep sim + rAF render
    input/                 pointer/keyboard, camera controls, picking
    tools/                 RoadTool, ZoneTool, BulldozeTool, PlaceTool…
    commands.ts            all world mutations go through commands (undo later)
    events.ts              typed event bus (world → UI/renderer)
  sim/
    World.ts               map dimensions + layers
    layers.ts              typed-array layers
    terrain/               generator, presets
    roads/                 autotile mask logic
    zones/                 zoning + growth
    buildings/             building defs, footprints, registry
  render/
    Renderer.ts            Pixi app, stage, layers
    iso.ts                 iso <-> screen math
    Camera.ts              smooth pan/zoom
    ChunkRenderer.ts       chunked static tile rendering
    atlas/                 procedural tile art → texture atlas
    overlays/              cursor, ghost preview, zone tint, grid
  shared/                  constants, rng, math utils
tests/
docs/
```

## Data Model

The map is a `W × H` grid (default 128×128; options 64, 128, 256). Tile index is
`i = y * W + x`.

Per-tile data lives in **typed arrays** (struct-of-arrays) for speed and cheap
serialization:

| Layer | Type | Meaning |
|---|---|---|
| `terrain` | `Uint8Array` | Terrain type enum (water, sand, grass, …) |
| `height` | `Uint8Array` | Elevation level (all 0 until Phase 6) |
| `variant` | `Uint8Array` | Random visual variant per tile (seeded) |
| `tree` | `Uint8Array` | Tree density 0–3 (0 = none) |
| `road` | `Uint8Array` | 0 = none, else road type; connection mask is computed |
| `zone` | `Uint8Array` | 0 none, 1 R, 2 C, 3 I (with density bits later) |
| `building` | `Int32Array` | Building instance id covering this tile, −1 if none |

Buildings are entities in a `Map<id, BuildingInstance>`:
`{ id, defId, x, y, w, h, level, builtAt }`. The **origin** tile is the top
(north) corner of the footprint.

## Isometric Projection

- Classic 2:1 diamond tiles: **TILE_W = 64px, TILE_H = 32px** at zoom 1.
- `screenX = (x − y) * TILE_W/2`, `screenY = (x + y) * TILE_H/2`.
- Picking uses the inverse transform, then a per-pixel diamond check for accuracy.
- **Draw order** = `(x + y)` depth, then `x`. Multi-tile buildings sort by their **front-most** tile, which avoids the classic overlap bug.

## Rendering & Performance Strategy

1. **Procedural atlas.** At boot we draw every tile and building variant into one or more offscreen canvases and upload them as a texture atlas. One texture means sprites batch into very few draw calls.
2. **Chunking.** The map is split into 16×16 chunks. Ground tiles of each chunk are cached (`cacheAsTexture`) and only re-rendered when a tile in the chunk changes (dirty flag).
3. **Culling.** Only chunks that intersect the viewport are visible.
4. **Separate layers:** `ground` (cached chunks), `objects` (trees/buildings, depth-sorted per chunk), `overlay` (cursor, ghost, zone tint) and `fx` (placement puffs, particles).
5. **Zoom LOD.** When zoomed far out, hide small details (tree sprites become ground tint, building detail is simplified).
6. **Smooth camera.** Pan and zoom target values are eased with a frame-rate-independent lerp, and zoom anchors at the cursor.
7. **Fixed-timestep sim** (e.g. 10 ticks/s at 1× speed) decoupled from `requestAnimationFrame` rendering.
8. **Budgets:** 60 FPS on 128×128 with a full city on a mid-range laptop. An FPS/draw-call overlay (toggle with `F3`) is built in Phase 1.

## Commands & Events

- Every world change (place road, zone, bulldoze) is a **command**. This gives one code path for validation, cost and (later) undo/redo and multiplayer/replay.
- The world emits typed **events** (`tilesChanged`, `buildingAdded`, `moneyChanged`, …). The renderer marks chunks dirty and the UI store updates. Nothing polls.
