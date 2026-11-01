# Transport (feature track D + E, rebuilt as one layer)

User direction (2026-11-01): fix the transport layer once and for all. Roads that grow from
lanes to 6- and 8-lane boulevards and expressways, overhead bridges and huge crossings, public
transport, varied pavements, and a good UI. Master plan §4.4, §8, §9 are the starting point;
this spec supersedes them where they differ (D-069).

## Principles

1. **One table describes every road type** (`sim/roadTypes.ts`). Lanes, capacity, speed, cost,
   upkeep, noise, sidewalks, frontage and art all come from it. No system checks
   `=== RoadType.Highway`. A new road type is a table entry plus its own art file.
2. **Roads evolve in place.** Dragging a bigger type over a road upgrades it, and you pay the
   difference. Small streets become avenues as the city grows, without bulldozing.
3. **Wide roads are 2 tiles wide.** A tile is about 64 px across: enough for 4 lanes, not 8.
   Boulevards (6 lanes) and expressways (8 lanes) are dual carriageways: two parallel one-way
   tiles with a median between them, laid by one drag.
4. **Grade separation is how big cities move.** Flyovers carry a road over another without a
   junction; interchanges are prefabs.
5. **Transit wins on merit.** People choose walk, bike, bus, tram, metro, train or car by
   generalised cost (time + waiting × 2 + walking × 1.5 + fare). Better transit means fewer
   cars, less congestion, less noise, and higher land value.
6. **Deterministic and fast.** Everything runs on the tick clock (D-068) and the road segment
   graph; visible vehicles stay a sample (D-059).

## The road hierarchy

| Type | Width | Lanes | Capacity / day | Speed | Frontage | Cost / tile | Notes |
|---|---|---|---|---|---|---|---|
| Street | 1 | 2 | 500 | 1× | yes | $10 | footpaths, street trees, lamps (current road) |
| **Avenue** | 1 | 4 | 1,100 | 1.25× | yes | $35 | tree-lined median, wide footpaths, bus-friendly |
| **Boulevard** | 2 | 6 | 2,600 | 1.4× | yes | $90 | dual carriageway, planted median, tram-ready |
| Highway | 1 | 4 | 1,500 | 2.2× | no | $25 | barriers, no buildings fronting it (current) |
| **Expressway** | 2 | 8 | 4,000 | 2.6× | no | $160 | dual carriageway, central barrier, ramps |
| **Pedestrian street** | 1 | 0 | walkers | — | yes | $20 | paved plaza street: no cars; boosts walking, shops and land value |

- **Pavement styles** (cosmetic, per road, chosen in the road tool): concrete footpath,
  brick paving, granite setts (old town), tree-lined promenade. Streets and avenues only.
- **Upgrade in place:** Street → Avenue → Boulevard; Highway → Expressway. Cost = difference.
  Downgrading is allowed with the bulldozer only.
- **Frontage:** buildings can take access from streets, avenues, boulevards and pedestrian
  streets, never from highways or expressways (today highways still give access; old saves keep it).

## Bridges, flyovers and tunnels

| Structure | Rule | Span |
|---|---|---|
| Beam bridge (current) | straight, land to land | ≤ 6 tiles |
| Truss bridge | streets, avenues | 7–12 tiles |
| **Cable-stayed bridge** | avenue, boulevard, highway | 13–20 tiles; a landmark |
| **Suspension bridge** | boulevard, expressway | 21–32 tiles; a landmark, raises land value nearby |
| **Flyover** | carries a road over another road or rail with no junction | ramps 2 tiles each side |
| **Interchanges** | prefabs: diamond, cloverleaf, trumpet | stamped as one command |
| **Tunnel** | under water or blocks; portals only on the surface | ≤ 16 tiles |

Height is drawn by the renderer (maps stay flat, D-051). A `level` layer (0 ground, 1 flyover)
lets two roads share a tile without connecting.

## Junctions

Chosen automatically by load and overridable by clicking: none, stop signs, traffic lights
(current, D-059), adaptive lights (green time follows queues), roundabout (3×3).

## Public transport

| Mode | Runs on | Stop | Capacity / vehicle | Speed | Unlock |
|---|---|---|---|---|---|
| Bus | streets and up (shares traffic; bus lanes on avenues) | bus stop (on a road tile) | 60 | road | Village |
| Tram | avenues and boulevards (own track) | tram stop | 180 | 1.2× road, ignores jams | Town |
| Metro | underground; stations are the only surface footprint | station 2×2 | 900 | 3×, ignores traffic | City |
| Train | rail tiles, crossing the map edge | station 3×2 | 1,200 | 4× | City |
| Ferry | water, between piers | pier | 150 | 1.5× | coastal maps |

- **Line tool:** click stops in order; loop or out-and-back; colour and number; vehicles per line set the frequency.
- **Depots:** each mode needs a depot reachable from its lines.
- **Line panel:** riders per day, crowding, income versus cost, a sparkline; **Transit view** shows lines and ridership.
- **Fares and policy:** fare per mode; "Free transit" policy later.
- **Mode choice** per commuter group, by generalised cost. Shares feed back into road volume.

## Visible traffic

Cars, buses, trams, trucks and service vehicles are sampled from the flows (D-059). Vehicles
use the lane offsets of their road type (from the table), and multi-lane roads keep slow
vehicles to the outer lanes.

## Build steps

| Step | Content | Done when |
|---|---|---|
| **T1** | Road type table + refactor of every system to it; **Avenue**; upgrade in place; road art in one file per type | an avenue carries more traffic than a street, faster, in the commute model and on screen |
| T2 | 2-tile dual carriageways: **Boulevard (6)** and **Expressway (8)**, ramps; pedestrian street; pavement styles | an 8-lane expressway carries 4,000 a day with no jams |
| T3 | Flyovers (`level` layer), interchange prefabs, truss, cable-stayed and suspension bridges, tunnels | a cloverleaf removes the traffic lights where two expressways meet |
| T4 | Road segment graph + Dijkstra + isochrones; junction control and adaptive lights | `commute.day` under 25 ms on /demo |
| T5 | Buses: stops, line tool, depots, line panel, mode choice (walk/bike/car/bus), transit view | a good bus line takes 15%+ of cars off a corridor |
| T6 | Trams, metro, rail and train stations, ferries; transfers | a metro line cuts average commute in a 30k city by 20%+ |
| T7 | Parks and leisure variety (see below) | — |

## Parks and leisure (T7, requested alongside)

Small (1×1): pocket park, playground, plaza. Medium (2×2): sports field, community garden,
skate park. Large: **Central Park** (3×3, lake and paths), **Water park** (3×2, pools and
slides), **Botanical garden** (3×3), **Wonderland** amusement park (4×4, rides, ferris wheel
and coaster), **Stadium** (4×4). Bigger parks reach further, add land value and happiness,
and the big ones draw visitors (trips over the transport network). Each park is its own art module.
