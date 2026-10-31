# Spec — Roads

Status: **Draft** (implemented in Phase 3)

## Player Experience

1. Select the **Road** tool (`R`).
2. Hover: a ghost road piece follows the cursor.
3. Press and drag: a ghost path shows from start to cursor, along with **total cost** and **tile count** at the cursor.
4. Release: road placed with a pop animation; money deducted.
5. Right-click or `Esc` while dragging cancels.

## Path Shape

- Drag produces an **L-shaped path**: first along the dominant axis, then the other.
- Holding `Shift` keeps the path in a **straight line** (locks to the dominant axis).
- Tiles that already have a road are free and are kept (they don't count toward cost).

## Validation

A tile is valid for a road if:
- terrain is buildable for roads (not water or rock; see terrain spec)
- no building covers it

Trees are auto-cleared (adds tree-clearing cost). Zoned-but-empty tiles get dezoned.

If **any** tile in the path is invalid, the invalid tiles show red. On release,
only the valid **contiguous run from the start** is built (a simple, predictable
rule). This can be revisited.

## Auto-Tiling

Road connection mask per tile, computed from 4 iso neighbours:

```
bit 0 = N (x, y−1)   bit 1 = E (x+1, y)
bit 2 = S (x, y+1)   bit 3 = W (x−1, y)
```

16 masks map to sprite pieces:

| Mask count | Piece |
|---|---|
| 0 | isolated (small square) |
| 1 | dead-end (4 rotations) |
| 2 opposite | straight (2 rotations) |
| 2 adjacent | corner (4 rotations) |
| 3 | T-junction (4 rotations) |
| 4 | crossroads |

When a road is placed or removed, recompute the mask for that tile **and its 4
neighbours** and mark the affected chunks dirty.

Road art: asphalt with dashed centre lines and light kerbs, generated
procedurally for all 16 masks at atlas build time.

## Costs (tunable, in `shared/balance.ts`)

| Item | Cost |
|---|---|
| Road per tile | $10 |
| Clear tree | $3 |
| Bulldoze road (refund) | $0 for now |
| Starting funds | $20,000 |

## Bulldoze Tool

- `B`, then click or drag a **rectangle**. It shows the area and cost and removes roads, trees and (Phase 4) buildings and zones.
- Re-autotiles neighbours.

## Later

Road types (street, avenue, highway), bridges, tunnels, one-way roads, rail.
