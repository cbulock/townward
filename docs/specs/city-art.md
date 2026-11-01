# Spec: City Art Pass (buildings, streets, people)

Status: **Implemented** (2026-11-01). User request: make buildings, parks, utilities, roads and highways look much richer, with real variety between buildings, footpaths that pedestrians stay on, and overhead bridges.

All art stays procedural (D-011) and original. Nothing here changes the simulation's rules. The only sim changes are where agents are drawn: lane and footpath offsets and the pedestrian route.

## Building variants

- Every zoned building has **6 variants** (`ART_VARIANTS`). A variant changes **form**, not just colour:
  - **massing:** a stack of boxes (`masses`). These give podiums under towers, setbacks, stepped tops and garage annexes;
  - **height:** towers and offices vary by several floors;
  - **roof:** flat, gable (either ridge direction), hip/pyramid or sawtooth;
  - **facade:** punched windows, brick, timber siding, window bands, ribbon windows, a concrete grid, a curtain wall (with or without fins), a shopfront, a glass lobby, townhouse units or industrial;
  - **rooftop:** helipad, spire, antenna mast, lit crown, solar panels, roof garden, pool, water tank or AC units;
  - **lot:** garden with trees, paved plaza, parking, or a school playing field.
- Shops and cafés get different **names** per variant (Bakery, Books, Deli, Florist, Pharmacy; Diner, Pizza, Noodles…) and different awnings. Hotels, supermarkets and industry vary their signs, colours and equipment (silos, tanks, extra stacks).
- Civic buildings have their own art:
  - **Power plant:** a cooling-tower plant, a gas plant with storage tanks, or a twin-tower plant. Each has a turbine hall, stack and transformer yard.
  - **Water tower:** a globe tank on legs, a classic tank with a cone roof, or a ground reservoir with a pump house.
  - **Park:** a fountain plaza, playground, duck pond, sports court, flower garden with a gazebo, or picnic grove.
  - **Police:** patrol cars. **Fire station:** red bay doors and a hose tower. **Clinic:** a red cross. **School:** a playing field.
- Variant count is per building: civic buildings have 3–6. The renderer uses `variant % count`, so saved variants stay valid.
- Frame height is per variant (`buildingHeadroom(id, variant)`), because towers vary in height.

## Streets and footpaths

- A street is a **26%-wide carriageway** with kerbs, then a **paved footpath** out to the tile edge on both sides. The footpath has paving joints. Junction corners are footpath too, so the footpaths join all the way round a block.
- Junctions: zebra crossings sit **on the footpath line** (where pedestrians cross), with stop lines before them on the incoming lane.
- **Street furniture** is drawn as one sprite per road tile in the objects layer, so it sorts with buildings:
  - straight streets: street trees on the near footpath and lamp posts, chosen per tile with a stable hash;
  - junctions: no furniture. The traffic lights are the live ones the traffic sim drives (Phase 8, drawn by AgentRenderer); static poles would show the wrong colours;
  - corners: a lamp on the outer corner.
- Highways have concrete barriers on both edges and a central jersey barrier, two lanes each way, and lamps on the near shoulder. They have **no footpath**.
  - **Foot overbridges** cross straight highway tiles every 8 tiles (on a stable world-coordinate rule): a deck with railings and a stair tower at each end. Cars pass underneath.
  - **Sign gantries** carry green direction boards over the highway, offset 4 tiles from the overbridges.

## Smoke and steam

- `render/fx/Smoke.ts`: pooled puffs (cap 900) using the shared puff texture, in a layer above the objects.
- Sources come from the art itself (`smokeSources(id, variant, rotation)` in `render/atlas/buildings/index.ts`), so plumes leave the painted stack tops in every rotation:
  - factory smokestacks: grey smoke;
  - power-plant chimneys and gas-plant exhaust stacks: grey smoke;
  - cooling towers: white steam (bigger and softer).
- Only finished buildings emit; zoned industry also needs someone at work. Only stacks on screen emit, and nothing below zoom 0.3. The list of stacks is rebuilt every second and right after a rotation.
- Puffs rise, slow, spread and drift with a light wind, then fade out. They are tinted by day/night like everything else.
- The painted plumes on the power plants were removed so the smoke isn't doubled.

## People and cars

- **Pedestrians only walk on streets**, never on highways or bridges. Their route is the road path **offset onto the right-hand footpath**. At a turn, the offset lines meet at the footpath corner (a mitre), so:
  - a right turn stays on the inside corner;
  - going straight or turning left crosses the side road **on the zebra crossing**.
  
  Speed is per distance, so corners aren't faster or slower.
- Cars keep to the right on the narrower carriageway (offset 0.13). On highways, cars use the inner lane and trucks and buses the outer lane (0.12 / 0.32). Lane changes blend over the first part of a tile.

## Budget

The extra frames add about one atlas page (from 2 to about 3–4). 60 FPS on 128×128 still holds, because furniture sprites live in the static per-chunk render groups.

## Art pass 2: near-3D look and ambient life (D-072)

Implemented 2026-11-01. User request: buildings, parks and trees looked dated and static; make every tile read as close to 3D, with variation everywhere and constant gentle motion.

### Where the art lives

| Folder (`src/render/atlas/`) | Holds |
|---|---|
| `theme/` | `palette.ts` (ground, zone tints) and `tokens.ts`: light, glass, foliage, materials as one `ArtTheme` |
| `core/` | projection (`IsoFrame`, frame marks), `Orient`, faces, colour maths, the light model |
| `nature/trees/`, `nature/decor/` | tree species, lit canopy, forest tiles; rocks, flowers, grass |
| `buildings/` | `recipes/` (by category), `massing`, `facades/`, `roofs/`, `rooftop/`, `attachments/`, `lot/`, entry `index.ts` |
| `civic/` | `parks/` (one file per park layout), `commerce/`, `townHall`, `utilities/`, the `CivicArt` contract (`lot.ts`) |
| `energy/`, `roads/` | unchanged; they use `core/` |
| `ambient/` | frames for animated details: window glow, beacon, droplet, bird, cloud |

Runtime motion is in `src/render/ambient/`.

### Light model

- Sun from the front-left: SW walls lit and warm, SE walls in cool shade; walls graded top to bottom; occlusion at every wall foot; a rim of light on the near edges; soft cast shadows clipped to the lot.
- Glass reflects the sky (light at the top, deep at the bottom), with a shadowed reveal and a sill; some windows show blinds. No window is lit by day.
- Roofs: flat roofs have a graded membrane, parapets with inner faces and the shadow they cast; pitched roofs have gradients, tile courses, a ridge cap and an eave shadow on the walls.

### Ambient life

- **Trees sway:** tree and tall-plant sprites pivot on their ground point and skew with a gust front rolling across the map. Visible chunks only, 30 Hz, zoom ≥ 0.75.
- **Night windows:** painters record every window as a mark. At night, a stable share of windows lights up (warm, some cool), more as the evening deepens, with occasional flicker. Lights sit straight after their building in the chunk, so nearer buildings hide them. Unpowered, abandoned and unfinished buildings stay dark. Objects take the night colour as a per-sprite tint (quantised), and the multiply layer covers only ground and traffic, so the lights stay bright.
- **Beacons** on masts and spires blink red, brighter at night. **Fountains** spray droplets from the jet in the art. **Birds** cross by day in loose flocks with ground shadows. **Cloud shadows** drift with the wind and fade at night.

### Review pages (dev only)

`/src/dev/art.html` shows every tile family (`?rot=1` for all rotations, `?only=<id>`); `/src/dev/night.html` opens the demo at night; `/src/dev/atlas.html` reports atlas pages and paint time.
