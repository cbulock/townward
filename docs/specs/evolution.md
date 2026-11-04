# Spec: City Evolution (stages, lifestyle, garbage, hospitals, universities, trains)

Status: **E0 stages, E1 lifestyle and E2 garbage implemented** (2026-11-04). Trauma centre,
research centre and trains are planned steps (below). Decisions: D-085, D-086.
User direction (2026-11-03): "as the city grows, people need to upgrade their lifestyle if the
city is good; they must demand universities, better health care; add trains."
Starts from master plan §5 (people), §10 (services) and §9 (rail). It is a small first step
toward them: one lifestyle number per home instead of full resident groups.

## Why

Today a city at year 10 asks for the same things as a city at year 1. Evolution makes growth
create **new, visible demands**: a good city lifts its residents' lifestyle, and better-off
residents expect more (a hospital, then a university). Meeting those expectations pays back in
taxes and office demand. Neglecting them stalls the climb.

## E0: City stages (`sim/stages.ts`)

The city climbs stages as its population grows. A stage never goes back down, and each one
unlocks buildings and brings a new problem (D-086).

| Stage | Population | Unlocks | New problem |
|---|---|---|---|
| **Hamlet** | 0 | roads, zones, coal plant, wind turbine, water tower, substation, park, town hall | power, water, first jobs |
| **Village** | 500 | police, fire, clinic, school, **landfill**, riverside market, central park | **garbage** starts piling up |
| **Town** | 2,500 | **hospital**, **recycling centre**, gas plant, solar farm, battery bank, botanical garden, shopping complex | homes become *Comfortable* and want a hospital |
| **City** | 10,000 | **university**, **incinerator** (later: trauma centre, trains) | homes become *Prosperous* and want a university |
| **Metropolis** | 30,000 | (later: research centre, research tree) | — |

- **Locking** is a `City` setting (`locked`): on for new player cities, off for `/demo`, tests,
  the harness and **cities saved before stages existed** (user call: existing players aren't
  disturbed). `applyPlace` refuses a locked building (`reason: 'locked'`).

### Stage gates (`sim/progression.ts`)

A locked city climbs **one stage at a time**, and only when it meets every requirement of the
next one: the population, and the basics of where it is now. Growth alone isn't progress.

| To reach | Needs (share of occupied homes) |
|---|---|
| Village | 500 residents; power and water 90% |
| Town | 2,500; power and water 90%; police, fire, clinic and school 75% each; garbage collected 90% |
| City | 10,000; all of the above; hospital 75% |
| Metropolis | 30,000; all of the above; university 75% |

The top bar shows the next stage's checklist with progress bars, so the player always knows
what to build next. Unlocked cities follow their population only.
- **The build picker** shows locked buildings greyed out with "Unlocks at Town (2,500 people)".
- **Top bar:** the stage name next to the population, with progress to the next stage in its tooltip.
- **Stage up:** a celebration toast with what's new ("Village! New: police, fire, clinic,
  school, landfill. Garbage now needs collecting.").
- Saved as `city.stage` (absent in older saves: it catches up from the population on the first day).

## E1: Lifestyle (`sim/systems/lifestyle.ts`, daily)

Every home has a **lifestyle tier**:

| Tier | Name | New expectation | Tax per resident |
|---|---|---|---|
| 0 | Basic | (the Phase 9 needs) | × 1.0 |
| 1 | Comfortable | **Hospital** within reach | × 1.5 |
| 2 | Prosperous | **University** within reach | × 2.2 |

### Moving up and down

- **Up one tier** after **30 days in a row** with happiness ≥ **0.7**, power and water, and:
  - to Comfortable: the city is at least a **Town** (2,500 people, when the hospital unlocks);
  - to Prosperous: the city is at least a **City** (10,000, when the university unlocks), and both
    a **hospital** and a **school** reach the home.
- (Moving up needs happiness ≥ **0.7**, the same line as level 3, so the two rules agree.)
- **Down one tier** after **30 days in a row** with happiness < **0.45**.
- Streaks reset when the condition breaks. Abandoned and unconnected homes keep their tier and
  stop counting. New homes start Basic. When an upgrade merges homes, the new building takes the
  lowest tier among them (people bring their lifestyle; nobody gets a free upgrade).
- The 0.7 → 0.45 gap stops a home flipping back and forth when its new expectation drops its
  happiness by one weight's worth.

### Needs by tier

Each tier has its own weights (each column sums to 1). Garbage adds 0.08 for every home from
the Village on (E2), and happiness is the weighted average **over the needs a building has**,
so adding a need shrinks the others' share to fit.

| Need | Basic | Comfortable | Prosperous |
|---|---|---|---|
| jobs | 0.20 | 0.18 | 0.16 |
| safety | 0.15 | 0.14 | 0.13 |
| commute | 0.13 | 0.12 | 0.11 |
| shopping | 0.12 | 0.11 | 0.10 |
| clean air | 0.12 | 0.11 | 0.10 |
| health (clinic) | 0.10 | 0.08 | 0.06 |
| education (school) | 0.10 | 0.08 | 0.06 |
| parks | 0.08 | 0.08 | 0.08 |
| **hospital** | — | 0.10 | 0.10 |
| **university** | — | — | 0.10 |

A hospital also counts as clinic coverage.

### Requests ("We'd love a university")

The Phase 9 rule only complains below 0.6 happiness, but people who are doing well ask for
things too. A home that isn't complaining **asks for its tier's expectation** when that need
scores below 0.5. Requests go in the same "Citizens say…" panel and speech bubbles:

| Kind | Message |
|---|---|
| hospital | "Our families need a proper hospital" |
| university | "Our kids want to go to university" |

### New buildings (Civic → Services)

| Building | Size | Cost | Upkeep / month | Jobs | Reach | Notes |
|---|---|---|---|---|---|---|
| **Hospital** (Town) | 3×2 | $14,000 | $320 | 140 | 24 tiles | also counts as a clinic |
| **University** (City) | 3×3 | $22,000 | $420 | 160 | 32 tiles | campus with a quad and a clock tower |

Reach is a circle, like other services (core.md §4), until isochrones land (engine 11.5).

### What the university gives back

- **Graduates:** residents of Comfortable or Prosperous homes reached by a university, × 0.12.
- **Office demand** gains `graduates × 0.6` wanted office jobs. The demand tooltip says
  "Graduates want about N office jobs."

### Level 3 rule

Level 3 still needs police, fire, health and education. The new hospital and university
coverage bits are not part of the "all four services" check.

### Showing it

- **Info panel** (homes): lifestyle tier with a progress note ("Moving up: 12 / 30 days").
- **Top bar population tooltip / Budget panel:** residents by tier.
- **Toasts:** the first time any home reaches Comfortable or Prosperous ("Residents are
  moving up! Comfortable homes will want a hospital.").

### Saving

The building tuple gains optional trailing fields `lifestyle, lifeDays, garbage, filled` after
`stored, condition, repairDays`. `city` gains `stage` and `locked`. Older saves load as Basic,
with empty bins, unlocked (save version stays 1).

### Performance

One pass over the buildings per day (no searches), plus two more coverage bits. It costs well
under 0.5 ms a day on /demo.

## E2: Garbage (`sim/systems/garbage.ts`, daily, from Village)

- **Every active building makes garbage** each day: 0.02 per resident, 0.01 per shop or office
  worker, 0.03 per industrial worker (tons). It piles up on the building (`garbage`).
- **Collection:** each working garbage facility has a daily truck capacity and a reach (tiles,
  and the same road island as the building, like utilities). Each day it empties the buildings
  in reach, nearest first, until today's capacity runs out.

| Building | Stage | Size | Cost | Upkeep | Trucks / day | Reach | Notes |
|---|---|---|---|---|---|---|---|
| **Landfill** | Village | 3×3 | $3,000 | $60 | 120 t | 22 | fills up (60,000 t: about 18 months at full trucks); full landfills stop taking garbage; smells (pollution 0.5) |
| **Recycling centre** | Town | 2×2 | $9,000 | $200 | 150 t | 24 | never fills; 40% of what it takes back as income ($0.5/t) |
| **Incinerator** | City | 2×2 | $16,000 | $260 | 300 t | 28 | never fills; heavy smoke (pollution 0.8) |

- **Need "garbage"** (every zoned building, from Village): 1 with an empty bin, falling to 0 when
  the pile reaches 6 days of its output. A pile stops growing at 30 days of output. Weight 0.08 for homes, 0.1 for shops, offices and industry.
- Complaint: "Garbage is piling up on our street". The info panel shows a building's pile and,
  for facilities, the tons collected today and (landfills) how full it is.
- Budget: recycling income appears under income.
- Later: visible garbage bags at high zoom, garbage trucks sampled from collection, sickness.

## Planned steps (user requests, 2026-11-04)

Each gets its spec section before code.

- **E3 Incidents that work together:** fires, theft and illness arise from hazard (density,
  condition, unemployment, missing coverage). Fire stations, police and hospitals answer them
  over the roads, so traffic and reach matter, and one service's gap shows up as another's
  load (a fire with no ambulance nearby hurts people). On the map: burning buildings with
  flames and smoke, a theft marker over robbed shops and homes, and an ambulance or patrol car
  heading there. The trauma centre (City) joins here.
- **E4 Air quality index (AQI):** a coarse pollution field from industry, power plants,
  incinerators, landfills and traffic, shown as a 0–500 AQI per area and for the city, with a
  map view. Replaces the one-off clean-air radius check.
- **E5 Taxes collected at the Town Hall:** taxes build up in the Town Hall each month, and the
  player collects them by hand (a button on the Town Hall and in the budget panel).
- **E6 Industry makes construction materials:** industry produces materials; new buildings
  and upgrades consume them, so a city without industry (or imports) builds slowly.
- **Shops and industry ahead of workers:** to decide: whether zones may grow beyond demand,
  with businesses that can't find workers complaining and, in time, abandoning.
- **E7 Research centre** (Metropolis, needs a university in reach) and the research tree;
  **trains** (below).
- **Power made understandable:** a short "how power works" explainer and a power view on the map.
- **Server-run cities (D-085):** the server ticks each open city with `src/sim`; the browser
  sends commands and renders state. Its own spec and phase.

## Trains (planned, its own step)

Rail is the first mode that ignores road traffic. It needs a rail tile layer, a rail tool,
stations and visible trains, so it gets its own spec section and session:

- **Rail track** tool (1 tile, $60/tile; bridges over water like roads, no junctions with roads
  except level crossings with barriers).
- **Train station** (3×2) on a track. Homes and jobs within 8 tiles of a station can commute by train.
- **Mode choice (first version):** a commute whose home and job both have a station on the same
  rail network takes the train when it's faster. Train time = walk to station + rail distance ÷ 4 + 3 min wait.
  Those trips leave the road volume.
- **Outside connection:** track reaching the map edge brings migrants (+ residential demand).
- Visible trains: 3–5 carriage sprites sampled from riders, on the agent renderer.

Done when a line between a suburb and downtown takes 15%+ of car commutes off the roads.
