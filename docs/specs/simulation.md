# Spec: Simulation — Time, Population, Jobs, Budget, Traffic

Status: **Implemented (first version).** Tuning numbers live in `src/shared/balance.ts` and `TRAFFIC` in `src/sim/traffic.ts`.

## Time

- Fixed-step sim at 10 ticks/s × speed. **1 day = 2 sim seconds**, **1 month = 30 days**.
- Speeds: **Pause / 1× / 2× / 3×** (the fastest step is a 4× multiplier). Controls: top-bar buttons, `Space` (pause/resume), `[` `]` (slower/faster).
- Cars and people move every frame, scaled by speed, so motion stays smooth at any speed.

## Road Access

- A building has access if any tile around its footprint is a land road (bridges don't count). The first one found, front edges first, is its **entrance**: where its cars and people join the network.
- Without access, a building stays empty, shows a bobbing **orange road badge**, and its info panel says why.
- Rechecked after every build, clear or demolish.

## Population & Jobs (`sim/population.ts`, once per day)

1. **Workforce** = 60% of residents.
2. **Job cover** = jobs ÷ workforce, capped at 1. With no residents yet, any jobs count as full cover.
3. Homes fill toward **target = capacity × (45% + 55% × job cover)**, closing 12% of the gap each day (at least 1 person). With no jobs, homes stop at about 45% full. Building shops, offices and industry lets them fill completely.
4. Job buildings with access take workers from the workforce in proportion to their capacity.
5. Top bar: **population** (tooltip shows housing capacity) and **workers/jobs** (tooltip shows unemployed).

## Budget (monthly)

- Income: **$3 per resident + $2 per worker**.
- Upkeep: road $0.4, highway $1.2, bridge $2 per tile; civic buildings 1% of their cost.
- On the last day of each month the net amount is added to funds, with a toast ("Jan budget: +$1,689 (taxes …, upkeep …)"). It's red if the month made a loss.

## Traffic (`sim/traffic.ts`)

- **Routing:** breadth-first search over connected road pieces (it uses `roadMask`, so bridges only connect at their ends). Routes are cached (up to 400 entries) and the cache is cleared when roads change. Agents whose path loses a road tile are removed.
- **Cars:**
  - Trips run between homes with residents and job or civic buildings, in either direction.
  - Spawn rate is about 1 trip per 140 residents per sim second, capped at **320** cars.
  - Mix: car, taxi, truck, and buses once the population is over 150.
  - Speed is 1.7 tiles/s, and 1.9× faster on highways.
  - **Right-hand traffic** with a 0.17-tile lane offset, easing from the old lane to the new one through turns.
- **People:** short strolls (3–8 tiles) along pavements near homes and shops, a 0.37-tile offset from the centre line, with a 2-frame walk cycle. Up to 1 person per 45 residents, capped at **180**.
- **Rendering** (`render/agents/AgentRenderer.ts`):
  - Pooled sprites; only on-screen agents are drawn.
  - Depth-sorted by x + y.
  - The layer sits under trees and buildings, so anything in front of a road correctly covers the cars behind it.
  - LOD: people are hidden below 0.6× zoom and all agents below 0.32×.
- **Art** (`render/atlas/agentArt.ts`): car, taxi (roof sign), bus and truck in 6 colours × 4 headings. Headlights or taillights show depending on which end faces the camera. Pedestrians come in 8 skin and shirt combinations.

## Inspect

- With the **Select** tool, click a building to open its info panel:
  - name, category and level stars, description;
  - residents or workers with a fill bar;
  - road status, footprint, and a **Demolish** button.
- The building's footprint is outlined while the panel is open. `Esc` or × closes it.

## Performance Notes

- Boot (measured in a software-rendered headless browser): **atlas ≈ 200 ms, map ≈ 20 ms**. Shown in the debug overlay (`F3`), which is now hidden by default.
- Per frame:
  - agent update is O(agents) with a hard cap of about 500;
  - the route search runs only on a cache miss;
  - the daily simulation is O(buildings).
- Draw calls stay at about 4 per visible chunk.

## Later

- Zoning and growth (Phase 4b): the same `simulateDay` loop will spawn and upgrade buildings.
- Commute timing (rush hours), car queuing at junctions, parking, buses with stops.
- Happiness, land value, services and pollution (Phases 7–9).
