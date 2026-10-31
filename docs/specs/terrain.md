# Spec — Terrain

Status: **Draft** (implemented in Phase 2)

## Goals

- The player chooses the terrain for a new city through **presets plus tweakable parameters**.
- Generation is **deterministic** (`seed + params → identical map`) and **fast** (<100 ms for 128×128, so the preview can update live).
- Terrain looks natural: coastlines, rivers, lakes, forests and beaches.

## Terrain Types (Phase 2)

| Id | Type | Buildable | Roads | Notes |
|---|---|---|---|---|
| 0 | Deep water | ❌ | ❌ (bridges later) | Animated shimmer |
| 1 | Shallow water | ❌ | ❌ (bridges later) | Lighter, near shore |
| 2 | Sand / beach | ✅ | ✅ | Between water and land |
| 3 | Grass | ✅ | ✅ | Default land |
| 4 | Dry grass | ✅ | ✅ | Low-moisture areas, visual variety |
| 5 | Dirt | ✅ | ✅ | Patches, visual variety |
| 6 | Rock | ❌ | ❌ | Outcrops (until terraforming exists) |

**Trees** are a separate layer (density 0–3) on grass and dry grass. They are
buildable: placing something on a tree clears it for a small cost.

**Elevation** is not part of Phase 2. Every tile has height 0. Hills and slopes
arrive in Phase 6 and need slope tiles, so we keep the `height` layer ready but
unused.

## Generation Pipeline

1. **RNG:** seeded `mulberry32(seed)` gives every noise field its own sub-seed.
2. **Elevation field `e`:** fractal simplex noise (4–5 octaves), then a **preset mask** is applied:
   - *Island:* radial falloff toward the edges
   - *Coastal:* gradient falling toward 1–2 chosen edges
   - *Plains:* almost no water
   - *Lakes:* extra low-frequency "dips"
3. **Water:** `e < waterLevel`. Deep water is `e < waterLevel − δ`.
4. **Rivers** (River Valley preset, or `riverCount > 0`): pick an edge source, run a noise-perturbed walk downhill toward water or the opposite edge, then carve a width of 1–3 tiles.
5. **Moisture field `m`:** independent noise, boosted near water.
6. **Classify land:** sand within 1–2 tiles of water; rock on the highest `e` peaks (rare); dry grass where `m` is low; dirt patches from a high-freq noise threshold; otherwise grass.
7. **Trees:** density from `m` plus a forest noise field, scaled by the `treeDensity` slider. No trees on sand or rock.
8. **Cleanup:** remove single-tile water specks and single-tile islands (cellular smoothing pass).
9. **Visual variant:** `variant[i] = rng() * N` so tiles don't look repeated.

## Presets

| Preset | Water level | Mask | Rivers | Trees |
|---|---|---|---|---|
| Plains | very low | none | 0 | low |
| Coastal | medium | 1–2 edges | 0–1 | medium |
| Island | medium-high | radial | 0 | medium |
| River Valley | low | none | 1–2 | medium |
| Lakes | medium | dips | 0 | medium |
| Forested | low | none | 0–1 | high |

## Parameters (exposed in New Game screen)

```ts
interface TerrainParams {
  seed: number;
  size: 64 | 128 | 256;
  preset: 'plains' | 'coastal' | 'island' | 'river' | 'lakes' | 'forested';
  waterLevel: number;   // 0..1 slider, overrides preset default
  treeDensity: number;  // 0..1
  riverCount: number;   // 0..3
  coastSides: number;   // 1..2 (Coastal only)
}
```

## Rendering Notes

- **Shorelines:** land tiles next to water get an edge overlay picked by a neighbour mask (foam or sand edge), so water isn't drawn as hard diamonds.
- **Water animation:** a subtle shimmer done with UV offset or palette cycling on water tiles only. It must not invalidate cached ground chunks, so water lives on its own layer or uses a shader.
- **Trees:** sprites in the `objects` layer, depth-sorted, with 3–4 seeded shapes and colour jitter.

## Tests

- Same seed and params give byte-identical layers.
- Island preset: all edge tiles are water.
- No isolated 1-tile water or land after cleanup.
- 128×128 generation stays under the 100 ms budget (perf test, warning only).
