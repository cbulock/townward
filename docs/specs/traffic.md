# Spec: Traffic (Phase 8)

Status: **Implemented** (2026-11-01). It replaces the random-trip traffic of Phase 4c.

**Problem (user report, 2026-11-01):** cities gridlocked. Measured on a two-district test town of about 3,200 residents, 318 cars (the cap) were on the roads and **48% were stuck** at rush hour. Three causes:

- the number of cars followed population, not road capacity;
- trips went between random homes and destinations;
- junction boxes let only one movement through at a time.

## Two layers

1. **Commute model** (`sim/systems/commute.ts`, daily). It decides where people travel and how busy each road is. This is what the game rules use.
2. **Visible traffic** (`sim/systems/traffic.ts`, every frame): the cars you see are a *sample* of the commute model. Their number is limited by road capacity, so roads show how busy they are without locking up.

## Commute model

- **Who travels:** each home's workers (residents × 0.6) commute to job buildings.
- **Route network:** routes run over the road graph, with each road tile's travel time set by its type:
  - road: 1 minute;
  - highway: 0.45 minutes;
  - bridge: the same as its road type;
  - congestion slows a tile further: travel time ÷ `speedFactor(c)`.
- **Choosing destinations:** a home's commuters spread over reachable job buildings in proportion to `workers × e^(−time ÷ 25 min)`. Nearby jobs win, but big job centres draw from further away.
- **Volume:** commuters are routed along the fastest path. Each road tile's **volume** is the number of commuters a day crossing it.
- **Smoothing:** volumes are smoothed day to day (60% old, 40% new) so routes don't flip back and forth. Homes sharing an entrance tile are grouped, so the work stays small.
- **Capacity** (commuters a day): road 500, highway 1,500. **Congestion** `c = volume ÷ capacity`.
- **Speed factor:** `1 ÷ (1 + 0.6 × max(0, c − 0.5)²)`, never below 0.2.
  - At c = 1: 87% of free speed.
  - At c = 2: 43%.
- **Commute time:** each home records its commuters' average travel time in minutes, shown in the info panel. Phase 9 (needs) will make long commutes matter.
- **Recalculation:** once a day, and straight away when roads change.

## Visible traffic

- **Trips:** cars drive real commute trips, chosen in proportion to their flow. Morning trips go home → work, evening trips work → home (rush-hour curve as before). Buses and walkers are unchanged.
- **How many cars:** spawning follows the flow, but the total is capped at **0.35 cars per road tile** (and 320 overall). A car only spawns if its first lane has room.
- **Speed:** each car moves at its type's speed × the speed factor of the tile it's on, so jammed roads crawl but never freeze.
- **Following:** cars keep their lane gap, as before.
- **Traffic lights:** they replace the junction boxes (D-040).
  - Junctions with 3–4 links alternate green between the two axes every 5 s of sim time.
  - Cars stop before a red light. A car already in the junction always clears it.
  - A car enters only if there's room on the road beyond (it doesn't block the box).
  - Lights are drawn as small poles on the junction corners, red or green.
- **Patience:** a car that hasn't moved for 20 s fades out (despawns).

## Showing it

- **Traffic overlay:** `T`, or the car button in the top bar. Roads are tinted by congestion: green below 0.6, yellow, orange above 1, red above 1.5. A small legend shows while it's on.
- **Info panel:** homes show "Commute: N min".

## Result

On the test town (`tests/support/jamTown.ts`) at rush hour:

| | Before | After |
|---|---|---|
| Cars on the roads | 318 (the cap) | 37 (0.35 per road tile) |
| Stuck / stopped | 48% | 0–3% stopped (red lights) |
| Slow (under half speed) | — | 27–35%, all on the overloaded connector |

The commute model rates that connector as congested. Adding a highway on a second route cuts its load by more than 30% (`tests/commute.test.ts`). In the traffic view (`T`), buildings fade to 25% so the coloured roads show between them.

## Target

On the same test town at rush hour, under 15% of visible cars should be stuck, and the connector road should show orange or red in the overlay, so the player knows to add a second road or a highway.
