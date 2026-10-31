# Spec — Zoning & Buildings

Status: **Draft** (implemented in Phase 4)

## Two Kinds of Buildings

1. **Zoned (grown) buildings.** The player paints zones and buildings appear on their own over time.
2. **Placed (plopped) buildings.** The player places them directly (power plant, park, town hall…).

## Zoning

- Zone tool with three sub-tools: **R** (Residential), **C** (Commercial), **I** (Industrial). Hotkeys `1` `2` `3`.
- Drag a rectangle. Only buildable, empty, road-free tiles get zoned.
- Cost: $5 per tile (tunable).
- Zoned-but-empty tiles show a light tint plus a dotted border in the zone colour (see tokens in [04-ui-ux.md](../04-ui-ux.md)).
- Dezone: bulldoze tool over empty zoned tiles.

## Growth Rules (Phase 4, simple version)

Runs every N sim ticks:

1. Pick K random zoned, empty tiles (K scales with map size, so growth is spread out and cheap).
2. A tile can develop if a **road is within 3 tiles** (Manhattan distance).
3. With probability `p` (tunable), spawn a **level-1, 1×1** building of that zone, starting in a "construction" state for a few seconds.
4. **Upgrades:** existing buildings randomly level up (1 → 2 → 3) over time.
5. **Merging:** if a 2×2 or 3×3 block of same-zone level-2+ buildings exists, it can be replaced by a bigger building.

In Phase 7 this is replaced by RCI demand, power and land value. The interface
(`canDevelop`, `chooseBuilding`) stays the same so the swap is clean.

## Building Definitions

```ts
interface BuildingDef {
  id: string;            // 'res_small_house_a'
  kind: 'zoned' | 'placed';
  zone?: 'R' | 'C' | 'I';
  level?: 1 | 2 | 3;
  size: { w: number; h: number };  // 1x1, 2x2, 3x3
  cost?: number;          // placed only
  population?: number;    // residents or jobs
  art: BuildingArtSpec;   // params for the procedural art generator
}
```

## Procedural Building Art

Every building is drawn in code at atlas build time:
- An isometric box (left face, right face, roof) with per-zone palettes.
  - R: warm walls, red/brown pitched or flat roofs, small windows.
  - C: glassy blues, taller, signage stripes.
  - I: grey/yellow, sawtooth roofs, chimneys (smoke particles at runtime).
- Height grows with level. Window grids, roof details and colour jitter come from a seed, so neighbours don't look identical.
- 3–5 variants per (zone × level × size).

## Placed Buildings (first set)

| Building | Size | Cost | Notes |
|---|---|---|---|
| Park | 1×1 | $100 | Trees, bench, path |
| Town Hall | 2×2 | $5,000 | One per city |
| Power Plant (coal) | 3×3 | $3,000 | Smokestack particles; no power sim yet |

Placement: a ghost footprint follows the cursor, snaps to the grid and is
tinted valid or invalid. Needs all footprint tiles buildable and empty. Trees
are cleared automatically.

## Rendering

- Multi-tile buildings are **one sprite** anchored at the footprint's bottom (south) corner.
- Depth-sort by the footprint's front-most tile `(x + w − 1) + (y + h − 1)`.
- The `building` layer stores the instance id on every covered tile, which is used for picking and bulldozing.

## Info Panel

Clicking a building shows its name, zone, level, residents/jobs and (later)
power, land value and happiness.
