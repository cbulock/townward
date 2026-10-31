# Spec: Terrain

Status: **Phase 2a (River Valley) and Phase 2b (presets, New Game screen) implemented.**

## Art Direction

Bright, saturated pixel-art look. The user-approved reference is a top-down pixel map with:
- narrow winding rivers with a light surf edge and a thin sand rim
- dense clumps of chunky outlined pines with open meadows between them
- grey rock clusters and flower patches in the grass

We render it in our isometric view (D-002). **Reference map: `?seed=42`** (approved by the user on 2026-10-31). Check every terrain change against it.

## Terrain Types

| Id | Type | Buildable | Roads | Used by River Valley |
|---|---|---|---|---|
| 0 | Deep water | ❌ | ❌ (bridges later) | middle of lakes |
| 1 | Shallow water | ❌ | ❌ (bridges later) | rivers, lake edges |
| 2 | Sand | ✅ | ✅ | thin rim on almost every shore |
| 3 | Grass | ✅ | ✅ | everything else |
| 4 | Dry grass | ✅ | ✅ | (other presets) |
| 5 | Dirt | ✅ | ✅ | (other presets) |
| 6 | Rock | ❌ | ❌ | (other presets) |

**Trees** (`World.tree`, density 0–3) and **decorations** (`World.decor`) are separate layers. Both are buildable: placing something clears them (trees for a small cost).

| Decor | Where it appears |
|---|---|
| Rocks (stone cluster) | rocky meadow patches, forest edges, and on sand along rivers |
| Boulder (big pile, sometimes mossy) | rocky meadow patches, occasionally at forest edges |
| Flowers (white / yellow) | grouped patches in open grass |
| Tall grass | scattered |

Elevation is not part of Phase 2. Hills and slopes come in Phase 6.

## River Valley Generator (`src/sim/terrain/riverValley.ts`)

Deterministic: the same `seed + size` gives a byte-identical world. 128×128 generates in well under 100 ms.

1. **Main river:** a meandering walk across the map along a random axis. The heading eases toward a noise-driven target, capped below 90° so it never doubles back, and it stays out of the outer 15% of the map. It's stamped 2–3 tiles wide.
2. **Tributary (60%):** a narrower river from the far side that stops when it reaches the main river.
3. **Lakes:** 1–3 noisy blobs, half of them hugging the river like oxbow lakes.
4. **Cleanup:** cellular passes remove 1-tile water specks and land notches.
5. **Depth:** water ≥ 3 tiles from land is deep, so rivers stay one bright blue.
6. **Sand rim:** shore tiles (distance 1) are sand unless a noise field opts out. Occasional 2-wide beaches.
7. **Forests:** low-frequency noise, slightly wetter near water. Thresholds give density 1–3 trees per tile. Lone trees appear at 1.5%.
8. **Decorations:** a second pass after trees, so it can find forest edges (see table above).

All tuning knobs are constants at the top of the file (`RIVER`, `LAKES`). Each feature has its own random stream (`SALT`), so changing one doesn't reshuffle the others.

## Rendering

- **Dual grid (D-019).** Ground is drawn on a grid offset by half a tile. Each cell's 4 corners sit on 4 tile centres. A cell draws the lowest terrain among its corners as a base, then an overlay for each higher terrain, masked by a rounded marching-squares contour. This gives smooth diagonals and rounded corners, with no staircase edges.
- **Two passes.** All bases are drawn first, then all overlays, so overlays cover each base's seam-hiding over-draw.
- **Shores.** A solid light-cyan surf band hugs the land contour (same wobble as the land mask). Grass edges get a darker green rim.
- **Water animation.** 8 shimmer frames are swapped every 0.16 s, only in visible chunks.
- **Objects.** Trees (one cluster sprite per tile, 6 variants × 3 densities) and decorations are depth-sorted per chunk.
- **Map edge.** A soil slab sits under the front edges, with blue where water meets the edge. The ground is masked to the map diamond.
- All art is painted in code at boot into one atlas texture (`src/render/atlas/`).

## Tests

- `tests/riverValley.test.ts`: determinism, a river crossing the map, no 1-tile specks, terrain mix, decor placement, speed budget.
- `tests/transitions.test.ts`: dual-cell corner bits, base and overlay ordering, shore masks, border clamping.

## Presets & Sliders (Phase 2b, `src/sim/terrain/presets.ts`)

`generateTerrain(settings)` in `src/sim/terrain/generate.ts` runs the River Valley pipeline with knobs. River Valley at its default sliders is **byte-identical** to the approved map (hash test in `tests/presets.test.ts`). Features added for the presets draw from their own random streams (salts ≥ 30) so they can't disturb it.

| Preset | Water | Trees | Rivers | Coast | Extra knobs |
|---|---|---|---|---|---|
| River Valley | 0.5 | 0.5 | 1 | 0 | — |
| Plains | 0.3 | 0.2 | 1 | 0 | dry grass and dirt (0.7), rock outcrops (0.35) |
| Coastal | 0.5 | 0.45 | 1 | 1 side | wide sea beaches |
| Island | 0.5 | 0.5 | 0 | 4 = island | island radius shrinks as water rises |
| Lakes | 0.7 | 0.55 | 0 | 0 | 6× lakes, with a minimum count |
| Forested | 0.4 | 0.85 | 1 | 0 | rocky ridges (0.5) |

- **Water:** lake count and size, sea depth, island size.
- **Trees:** shifts the forest threshold and the number of lone trees.
- **Rivers:** 0 none; 1 main river (60% chance of a tributary); 2 main + tributary; 3 adds a second river parallel to the main one.
- **Coast:** sea along 1–3 randomly chosen edges, with a noisy coastline. 4 makes an island.
- Every preset generates 128×128 in under 10 ms (256×256 in about 30 ms) and always leaves more than 35% buildable land.

## New Game Screen (Phase 2b)

- **Fields:** city name, six preset cards (thumbnails painted from 64×64 maps of the current seed), map size, seed with 🎲, an "Advanced" section with the four sliders, and a live preview drawn by the minimap painter (debounced 120 ms). Choosing a preset resets the sliders to its defaults.
- **Backdrop:** the preview map, scaled up, dimmed and drifting slowly.
- **Start building** writes the options to the URL, so reloading reopens the same city. The top bar's New city button goes back to this screen. `N` in-game rolls a new seed with the same preset and sliders.
