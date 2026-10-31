# Spec: Elevation, Terraforming & Borderlands (Phase 6)

Status: **Implemented** (Phase 6).

## Height Model

- `World.elevation[i]` is the height of **tile i's centre**, in whole levels `0 … MAX_LEVEL` (16). One level is **8 px** on screen (`HEIGHT_STEP`).
- **Smoothness rule:** 4-neighbours differ by at most 1 level. This gives rolling hills, not cliffs.
- **Water** sits at level 0, so land next to water is at level 0 or 1. Shores stay gentle and bridges stay low.
- **Why tile centres:** the dual-grid ground (D-019) already puts a cell's corners on tile centres. Each ground cell becomes a sloped quad whose corners sit at the 4 tile heights, with no new data per corner. Where a surface height is needed between tile centres, it's interpolated bilinearly (`surfaceHeight(world, x, y)`).
- **No terrain self-occlusion:**
  - A slope rises at most 8 px per tile.
  - Stepping one tile toward the camera moves the screen down 16 px (`HALF_H`).
  - So the ground never covers anything behind it, even with the camera rotated.
  - That keeps the layered drawing order (ground → roads → agents → objects) correct, with no depth buffer.

## Rendering

- **Ground as meshes.** Each chunk's ground is one merged mesh per atlas page instead of thousands of sprites.
  - Every dual cell is a quad over its padded frame diamond. The UVs come from the same atlas frames as before, and the positions are raised by the corner heights.
  - A small custom shader adds per-vertex **shade** (hill lighting) and **fog** (for the borderlands).
  - Water quads keep their animation by rewriting their UVs every 0.16 s, in visible chunks only.
- **Hill lighting:**
  - Slopes facing the camera's lower-left are lit; slopes facing lower-right are shaded, the same light as the buildings.
  - Formula: `1 − 0.07·∂h/∂y + 0.07·∂h/∂x` in view space, clamped to 0.78–1.18.
- **Tile-shaped layers** (roads, bridges' approaches, zone lots, the grid) use the same tile-quad mesh, bent to the 4 tile-corner heights. A corner's height is the average of the 4 tiles around it.
- **Objects:**
  - Trees, decorations and buildings are lifted by their tile's height.
  - Agents are lifted by the interpolated surface height.
  - Overlays (hover, previews, badges, effects) are lifted the same way.
  - Hover and previews become small bent meshes.
- **Bridges:** the deck sits at the higher of its two end tiles. Over water the ends are at level 0 or 1.
- **Map edge:** the soil slab follows the edge heights.
- **Minimap:** hill-shaded by height.

## Picking

A screen point maps to a tile by fixed-point iteration: start at h = 0, project to a tile point at that height, read the surface height there, and repeat 6 times. It converges because slopes are less than half a tile's screen height (the same reason the terrain never self-occludes).

## Building Rules

- **Buildings** (placed and grown) need a **flat footprint**: all footprint tiles at the same level. Growth skips lots that aren't flat; the Level tool fixes them.
- **Roads** can run on any slope (up to 1 level per tile, so every slope is a gentle ramp).
- **Zoning** is allowed on slopes. Lots grow once they're flat.

## Terraform Tools (`T` group)

| Tool | Key | Action | Cost |
|---|---|---|---|
| Raise | `5` | Drag a rectangle: +1 level | $15 per tile-level changed |
| Lower | `6` | Drag a rectangle: −1 level (not below 0) | same |
| Level | `7` | Drag from a tile: flatten the rectangle to the start tile's level | same |

- The neighbours are adjusted automatically to keep the smoothness rule; that ripple is priced and previewed too.
- **Locked tiles:** water, roads and buildings can't change height. An edit that would need to move one is refused for that tile (shown red).
- Trees and decorations on changed tiles are cleared at their usual clearing cost.

## Generator

- A new slider, **Hills** (0–1), adds rolling hills from low-frequency noise. Heights are kept low near water and smoothed to the rule.
- Preset defaults:

| Preset | Hills |
|---|---|
| River Valley | 0.35 |
| Plains | 0.15 |
| Coastal | 0.3 |
| Island | 0.45 (rising toward the middle) |
| Lakes | 0.3 |
| Forested | 0.6 |

- Heights use their own random stream. River Valley's terrain, trees and decorations stay byte-identical; only the new height layer is added.

## Borderlands (render-only)

- **Ring:** a band of decorative land, 40 tiles wide at 128×128 (scales with map size), drawn all round the map. It isn't part of the sim and nothing can be built there.
- **Generated from the map's edges:**
  - Rivers and sea that touch the edge continue outward. Edge terrain blends into noise terrain.
  - Height rises with distance from the map into forested hills and then mountains (bare rock on the peaks). It still follows the 1-level-per-tile rule, so it never hides the map.
  - The same seed always gives the same ring.
- **Drawing:**
  - The ground uses the same mesh path, with fog that grows with distance: colours desaturate and fade into the background.
  - Tree sprites are drawn only in the inner 10 tiles. Further out, forest shows as dark-green tinted ground, which keeps the sprite count low.
  - A faint dashed line marks the map border.
- **Camera:** you can pan up to a quarter of the ring past the edge, and zoom out until the ring fills the screen.
