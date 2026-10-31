# Decision Log

Format: **ID — Title** · Status · Date. Reason in one or two lines.

## Open (need your call)

- **D-001 — Product name.** Status: *Open.* We need an original name; the repo folder can stay `simcity-web`.

## Accepted

- **D-002 — Isometric 2:1 view.** 2026-10-31. Looks much richer than top-down and fits the "very cool UI" goal.
- **D-003 — Map rotation deferred until after Phase 5.** 2026-10-31. Rotation means every building needs 4 views, which doubles the art and sorting work. *Superseded by D-032: built early at the user's request, while the renderer is still small.*
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
- **D-024 — Seed 42 is the default map.** *(Superseded by D-038.)* 2026-10-31. Without `?seed=` the game opens the approved River Valley. `N` still rolls new maps.
- **D-025 — Bridges are automatic, straight and land-to-land.** 2026-10-31. Any road or highway path that crosses water becomes a bridge, with no extra tool. Straight spans of up to 12 tiles keep the art simple (two orientations per type). They also avoid nonsense like bridges that turn or stop mid-river. Bridges store their axis and connect only at their ends.
- **D-026 — Sound is synthesised (Web Audio), not sampled.** 2026-10-31. This matches the procedural-art approach: no asset files, tiny download, and easy to tune in code. The AudioContext starts on the first user gesture. Mute persists in localStorage.
- **D-027 — Phase 4 split into 4a catalog & art, 4b zoning & growth, 4c moving cars.** 2026-10-31. User priority: see all the essential building types first. Growth and traffic build on the same catalog.
- **D-028 — Building definitions in sim, building art in render.** 2026-10-31. `sim/buildings/catalog.ts` holds gameplay data (size, level, cost, capacity) and derives the `BuildingId` union. `render/atlas/buildingArt.ts` holds a recipe per id (floors, roof, facade, extras), turned into pixels by one shared iso-box painter. The same painter draws the picker thumbnails.
- **D-029 — Simple, readable economy first.** 2026-10-31. Homes fill toward a target set by job cover (45% with no jobs, 100% with full cover), and jobs take workers in proportion to capacity. Taxes per resident and worker, upkeep per road tile. It's easy to reason about and tune now; land value, happiness and services refine it in Phases 7–9.
- **D-030 — Agents are simulated in sim/, drawn in render/.** 2026-10-31. `Traffic` holds plain agent data (path, segment, progress) and `agentPose()` computes position and heading, including right-hand lane offsets. The renderer only maps poses to pooled sprites. Agents move per frame with dt × speed (smooth), while population and budget step daily on the fixed tick.
- **D-031 — Agents draw under the objects layer.** 2026-10-31. Agents are depth-sorted among themselves only. Buildings and trees in front of a road then correctly hide cars behind them, with no global sort of every sprite each frame.
- **D-032 — View rotation through a rotated view copy of the world.** 2026-10-31.
  - The simulation, tools and traffic always work in world tiles. `ViewTransform` maps world to view for 4 quarter turns: points, tiles, rectangles, headings, connection masks and bridge axes. `ViewWorld` is the world's tile layers re-laid out in view space, re-synced after each edit (typed-array copies, well under 1 ms).
  - The chunk, road, bridge and dual-grid renderers draw that copy unchanged.
  - Overlays, effects, agents and picking convert through a shared `viewRef`.
  - On rotation the terrain is rebuilt (about 20 ms on 128×128), the camera keeps the same world point centred, and the view fades in.
  - Trees and rocks hash their *world* tile, so they look the same from every side.
- **D-033 — Buildings painted in 4 orientations from one recipe.** 2026-10-31.
  - Recipes stay in local space (front = +v). The painter rotates the layout into the view and draws whatever walls face the camera, lit from the same side every time.
  - Front-only details (door, shopfront, sign, awning, porch, canopy, parking, garden path) appear only when the front faces the camera, so rotating shows real backs. Balconies go on every side so tall homes read the same from any angle.
  - The atlas now splits into ≤4096 px pages (`AtlasBuilder`) to fit the 204 building frames.
- **D-034 — Saving: Express + SQLite backend, email/password accounts, seed-plus-changes save format.** 2026-10-31. Agreed now, built later (after Phase 4b).
  - The server is Express 5 in TypeScript. Request bodies are validated with zod. Saves are stored as a JSON blob in one SQLite `saves` table that also has metadata columns. This gives atomic writes and a straightforward move to Postgres.
  - Accounts use email and password, chosen by the user over anonymous device ids.
  - A save holds only the seed, the generator version, `funds`/`day`, the `road`/`bridge`/`zone` layers plus a cleared mask for `tree`/`decor` (base64 run-length-encoded typed arrays), and buildings as `{ def, x, y, variant }`. Terrain is regenerated from the seed, and occupants, entrances and traffic are rebuilt on load. Every save carries a version number so old saves can be migrated.
  - Buildings also need `grown`, `construction` and `fullDays` (added in 4b) in the save.
  - Pure `serialize`/`deserialize` live in `sim/save.ts`. The client goes through a `SaveStore` interface: IndexedDB for autosave, HTTP for the server.
  - We rejected replaying a command log. Any change to the rules would silently alter old cities.
- **D-035 — Growth driven by capacity-based R/C/I demand.** 2026-10-31. Demand compares *built* capacity, construction sites included, with what the other zones imply: homes need jobs, jobs follow homes, plus a small seed so a new town starts. Counting sites stops growth overshooting. Using capacity rather than occupants avoids the stall where homes that aren't yet full hold back jobs. Land value, services and pollution refine this in Phases 7–9.
- **D-036 — Road access reaches 3 tiles.** 2026-10-31. Zones are usually painted 2–3 tiles deep. A touching-only rule would leave the back rows empty forever. One rule applies to grown and placed buildings alike, and traffic uses the nearest road tile as the entrance.
- **D-037 — The Build tool still places zoned buildings (sandbox).** *(Superseded by D-042.)* 2026-10-31. Placed buildings clear the zone under them and never level up, so they don't interfere with growth. We may restrict them to civic buildings later.
- **D-038 — The New Game screen is the entry point; game options live in the URL.** 2026-10-31. This replaces D-024. With no `?seed` the app opens the New Game screen, with River Valley seed 42 (the approved map) preselected. Once a city starts, its preset, seed, size, changed sliders and name go into the URL, so a reload reopens the same city until saves exist (D-034).
- **D-039 — A time-of-day clock separate from the calendar.** 2026-10-31. Calendar days are 2 s, which is right for the economy but would make day/night strobe. A clock day lasts 90 sim seconds and drives the night tint, rush hours and ambience. The tint is a multiply quad over the world: one draw call, no filter render-to-texture.
- **D-040 — Queuing by lane gaps and junction boxes, with patience.** 2026-10-31. Cars keep a gap within their lane (one direction of one segment) and to the tail of the next lane. A junction box is used by one movement at a time, except straight traffic on the same axis. Waiting 4 s overrides the box and waiting 25 s despawns, so the network can never deadlock. Traffic lights can come later on top of the boxes.
- **D-041 — Bus stops are automatic.** 2026-10-31. There's no stop tool yet. Stops go outside the busiest buildings on straight road, spaced 6 tiles apart. Buses run stop to stop and dwell 2 s. Shelters are drawn in the agent layer, so they depth-sort with the cars.
- **D-042 — The Build tool places civic buildings only.** 2026-10-31. User decision. Homes, shops and industry only appear through zoning, which keeps the growth rules meaningful. `PLACEABLE_IDS` in the catalog drives the picker and `Game.setBuilding`. Sim-level `planPlace` still accepts any building, since tests and future scenarios use it.
- **D-043 — Heights live on tile centres, slopes are capped at one level per tile, and a level is 8 px.** 2026-10-31.
  - Tile-centre heights fit the dual grid (D-019): each ground cell's corners are tile centres, so cells become sloped quads with no new data.
  - With an 8 px step, under `HALF_H`, the terrain can never hide anything behind it, so the layered drawing order (ground → roads → agents → objects) still holds with no depth buffer.
  - Water is pinned to level 0, which keeps shores and bridges gentle.
- **D-044 — Ground drawn as merged meshes with a small custom shader.** 2026-10-31.
  - Sprites can't bend to slopes. Each chunk now has one mesh per atlas page, built from the same atlas frames, with per-vertex colour (hill light, zone tint) and fog.
  - Water animates by rewriting its UVs in visible chunks.
  - Roads, zone lots, the grid, hover and previews use the same bent tile quads. Taller things (trees, buildings, bridges, agents) stay sprites, lifted by height.
  - Shaders are cached per atlas page and released before the pages are destroyed.
- **D-045 — Borderlands are render-only and replace the soil slab.** 2026-10-31. User choice. An extended world (map + ring, `sim/terrain/borderlands.ts`) copies the map into its middle, so the seam matches. It continues edge water outward and rises into hills and mountains with fog. Nothing in the sim reads it. Tree sprites only within 10 tiles; further out, forest is tinted ground, which keeps the sprite count low. It's rebuilt when the map edge is terraformed. The camera may pan a quarter of the ring past the edge.
