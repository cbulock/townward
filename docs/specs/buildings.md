# Spec: Buildings, Zoning & Growth

Status: **4a done** (catalog, art, Build tool). 4b zoning/growth and 4c cars follow.

Try every building with plenty of money: `http://localhost:5173/?funds=100000`.

## Two Ways Buildings Appear

1. **Grown (zoned).** The player paints R/C/I zones and matching buildings appear and level up over time (Phase 4b).
2. **Placed.** The player puts a building down directly with the **Build** tool. In 4a every catalog building can be placed, so we can see and tune them all. Once growth exists, zoned types may become growth-only.

## Catalog (`src/sim/buildings/catalog.ts`)

All art is original and generated in code (`src/render/atlas/buildingArt.ts`), with 3 colour variants each.

### Residential

| Id | Name | Size | Level | Floors | Residents | Look |
|---|---|---|---|---|---|---|
| `cottage` | Cottage | 1×1 | 1 | 1 | 3 | small gable-roof house, chimney, picket garden |
| `family_house` | Family House | 1×1 | 1 | 2 | 5 | two storeys, hip roof, porch |
| `townhouses` | Townhouses | 1×1 | 2 | 3 | 12 | narrow row of 3, coloured doors, flat roof |
| `walkup` | Walk-up Apartments | 1×1 | 2 | 4 | 24 | brick, balconies, roof parapet |
| `apartment_block` | Apartment Block | 2×2 | 3 | 8 | 120 | balconies, rooftop water tank |
| `condo_tower` | Condo Tower | 2×2 | 3 | 15 | 260 | glass tower, terraces, rooftop crown |

### Commercial

| Id | Name | Size | Level | Floors | Jobs | Look |
|---|---|---|---|---|---|---|
| `corner_shop` | Corner Shop | 1×1 | 1 | 2 | 6 | striped awning, shop sign |
| `cafe` | Café | 1×1 | 1 | 1 | 8 | awning, outdoor tables |
| `small_office` | Small Office | 1×1 | 2 | 5 | 40 | glass window bands |
| `supermarket` | Supermarket | 2×2 | 2 | 1 | 60 | wide low box, big sign, parking lot |
| `hotel` | Hotel | 2×2 | 3 | 11 | 90 | tower, rooftop HOTEL sign, entrance canopy |
| `office_tower` | Office Tower | 2×2 | 3 | 18 | 400 | glass curtain wall, lit crown |

### Industrial

| Id | Name | Size | Level | Floors | Jobs | Look |
|---|---|---|---|---|---|---|
| `workshop` | Workshop | 1×1 | 1 | 1 | 10 | garage door, sawtooth roof |
| `warehouse` | Warehouse | 2×2 | 2 | 2 | 40 | big box, loading docks, crates |
| `factory` | Factory | 2×2 | 3 | 3 | 120 | sawtooth roof, smokestack |

### Civic

| Id | Name | Size | Look |
|---|---|---|---|
| `park` | Park | 1×1 | lawn, trees, path, bench, fountain |
| `town_hall` | Town Hall | 2×2 | columns, pediment, clock dome, plaza |

More civic buildings (police, fire, school, hospital, power, water) come with services in Phases 7–8.

## Placement Rules (`planPlace` / `applyPlace` in `sim/commands.ts`)

- The footprint must be fully on the map and on land (no water or rock), with no road and no other building.
- Trees and decorations in the footprint are cleared automatically at their clearing cost.
- Cost = building cost + clearing.
- The cursor sits on the footprint's centre tile (for 2×2, the tile above-left of centre).
- The **Clear** tool removes the whole building if any of its tiles is selected (free for now).

## Data

- `World.building[i]` holds the building instance id covering tile `i` (−1 if none).
- `World.buildings: Map<id, { id, def, x, y }>`, where `(x, y)` is the footprint's top (north) tile.

## Rendering

- A building is **one sprite**, in a frame tall enough for its floors and roof.
- It's drawn in the chunk that owns its **front tile** `(x + w − 1, y + h − 1)` and sorted with trees by that tile's diagonal, so buildings and trees overlap correctly.
- Painter (`buildingArt.ts`): an iso box with a lit south-west face and a shaded south-east face, then:
  - roof: gable, hip, flat with parapet, sawtooth, or glass;
  - facade: punched windows, window bands or a curtain wall, with a few lit windows;
  - extras: chimney, awning, sign, balconies, water tank, AC units, loading dock, smokestack, canopy, crown, parking, garden.

## Growth (Phase 4b, planned)

Same as before: zoned tiles within 3 of a road develop at level 1, upgrade over time and merge into 2×2 buildings. Later the RCI demand, power and land value from Phase 7 drive it. `chooseBuilding(zone, level, size)` picks from this catalog.
