# Spec: The /demo City

Status: **Implemented** (2026-11-01).

`http://localhost:5173/demo` opens a planned, fully grown city right away. `/demo?seed=N` gives another one, and the same seed always gives the same city. `N` in the demo rolls a new seed. **New city** returns to the New Game screen.

## How it's built (`src/sim/demo.ts`, pure sim, tested in `tests/demo.test.ts`)

1. **Map:** River Valley, 128×128, with the given seed.
2. **Street grid:** a 10×10 grid of 5×5 blocks round the map centre (streets every 6 tiles). The two central avenues are highways. Each block edge is built as its own segment, so a crossing the river can't bridge only loses that segment. Bridges appear automatically.
3. **Blocks by ring:**
   - centre: the town hall in a park;
   - inner rings: offices and apartment towers;
   - then apartments and shops, then houses with some shops;
   - one corner: industry plus two utility blocks.
   - About 7% of blocks are parks, and every third block (in both directions) is a service block (police, fire, clinic, school, with apartments around them).
4. **Growth:** 640 days of normal growth at 3 growth steps a day. Every 5 days, any road island short of power or water gets a plant or tower: in a utility-block slot if one is free on that island, otherwise on free land by its roads (islands cut off by the river get their own).
5. **Build-out:** every lot growth hasn't reached is built out to its zone. Free 2×2 squares mostly become top-level buildings (towers, hotels, factories); the rest become the zone's 1×1 buildings. Utilities are topped up until everyone is supplied, then 40 more days are simulated so people move in.

Result for seed 42: about 26,000 residents, all powered and watered, ready in about 1.9 s in the browser.
