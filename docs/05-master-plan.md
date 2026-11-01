# 05 — Master Plan: From Growing Town to Living City

Status: **Accepted (2026-11-01).** The user answered every question in §16 (D-063).
Scope: every system after Phase 10 (saving). It covers people, land, roads and bridges,
transport, services, utilities, the economy, government and events, how they connect, and
the order we build them in.

Each later phase still gets its own spec under `docs/specs/` before any code (working
agreement, rule 1). This document is the map those specs follow.

---

## 1. Where We Are, and What's Missing

**Built (Phases 0–9):** terrain, roads, highways and bridges, R/C/I zoning in two densities,
growth and level-ups, power and water over road islands, four coverage-circle services,
taxes and upkeep, a daily commute model with congestion, visible cars sampled from it, and
needs → happiness → occupancy and abandonment.

**Missing:** the city doesn't *evolve*. Every building is one number (occupants), and
every rule reads city-wide totals or fixed circles:

| Today | Problem |
|---|---|
| People are a count per building | No one ages, studies, gets richer, moves away or arrives. A city at year 10 behaves like a city at year 1. |
| Services are radius circles | A hospital across a river with no bridge still "covers" you. Traffic has no effect on emergency response. |
| Demand compares capacities | It never asks *who* wants to live here or *what kind* of jobs exist. |
| No land value | Nothing makes one block richer than another, so towers grow anywhere and neighbourhoods never change character. |
| Pollution is a one-off radius check | Nothing builds up or spreads, and the river doesn't carry it anywhere. |
| Cars are the only way to travel | Buses are decoration. There is no reason to build transit. |
| Industry makes nothing | Industry is "jobs with smoke"; shops don't need goods. |
| The city has no outside world | People appear from nowhere. Nothing gets imported or exported. |

## 2. What "Great" Means: Design Pillars for the Simulation

1. **Cause and effect you can read.** Every number in the game can answer "why?": the info panel, the data views and the complaints all trace back to a cause the player can fix. A deep simulation the player can't read is just noise.
2. **The city changes with time.** Neighbourhoods rise, gentrify, decline and get redeveloped. The problems a city has at 50,000 people are different from the ones it had at 500.
3. **Everything travels over networks.** Roads (and later rail and transit) carry commuters, goods, garbage, fire trucks and ambulances. Jams have real consequences: a fire burns longer when the fire truck is stuck.
4. **Groups, not individuals.** We simulate households as **groups of residents** (counts by age, education and wealth) per building, and *show* individuals sampled from those groups (D-059 already does this for cars). It scales to 100k+ residents at 60 FPS, and it's what makes the city feel alive.
5. **Smooth above all (still).** The simulation moves to a Web Worker, heavy work is spread across ticks, and every system has a time budget (§13).
6. **Simple at the surface.** No pipes, no power lines (D-052), flat maps (D-051). Depth comes from how systems interact, not from extra building steps.
7. **Original.** The genre's mechanics are fair game. The formulas, names, numbers and art are our own (01-vision.md).

---

## 3. The Big Picture: How the Systems Connect

```
                     ┌──────────── OUTSIDE WORLD ─────────────┐
                     │ migrants · tourists · imports · exports │
                     └───────┬───────────────────────▲─────────┘
                    highway / rail / port connections│
                             ▼                       │
   ┌───────────┐   attract  ┌──────────────┐  goods  ┌──────────────┐
   │ LAND VALUE│──────────▶│  HOUSEHOLDS   │◀───────│   ECONOMY     │
   │  (field)  │◀──┐       │ age·edu·wealth│  wages │ jobs · goods  │
   └─────▲─────┘   │       └──┬─────┬──────┘───────▶│ trade · taxes │
         │         │   needs  │     │ trips          └──────┬───────┘
   pollution,      │          ▼     ▼                        │ budget
   crime, noise,   │   ┌──────────┐ ┌───────────────────┐    ▼
   parks, transit  └───│HAPPINESS │ │ TRANSPORT NETWORK │ ┌──────────────┐
         ▲             │  & needs │ │ roads·transit·rail│ │  GOVERNMENT  │
         │             └────┬─────┘ └─────────┬─────────┘ │ policy·taxes │
   ┌─────┴──────┐           │ growth,         │ response  │ districts    │
   │   FIELDS   │           │ decline,        ▼ times     └──────┬───────┘
   │ air·noise· │      ┌────▼──────┐  ┌──────────────────┐       │ funding
   │ ground·    │◀─────│ BUILDINGS │◀─│ SERVICES & UTILS │◀──────┘
   │ water·crime│ emit │ lifecycle │  │ isochrone reach, │
   └────────────┘      └───────────┘  │ capacity, dispatch│
                                      └──────────────────┘
```

Three kinds of state hold all of it:

| Kind | What | Storage |
|---|---|---|
| **Tile layers** | terrain, roads, zones, districts, rail, transit stops | `Uint8Array` per tile (as now) |
| **Fields** | land value, air, noise, ground and water pollution, crime, health | `Float32Array` on a coarse grid (one cell = 2×2 tiles), diffused and decayed |
| **Entities** | buildings (with their resident groups), transit lines, incidents | struct-of-arrays stores keyed by building slot |

---

## 4. Simulation Engine Upgrades (the foundation for everything else)

### 4.1 Cadence tiers

| Tier | Real time at 1× | Who runs |
|---|---|---|
| **Frame** | every frame | visible agents, the clock, dispatched vehicles |
| **Tick** | 10/s | time-sliced work (a slice of buildings, a slice of a field) |
| **Day** | 6 s | growth, incidents, trips, needs, history sample |
| **Month** | 3 min | budget, life stages, migration, education, policies |
| **Year** | 36 min | elections and approval, the yearly report, inflation of costs (optional) |

### 4.2 Time-slicing

Day work must not cause a frame hitch. A system that touches every building (needs, land
value, life stages) processes **1/N of them per tick**, so the day's work spreads over the
60 ticks between days. Each system declares a budget (§13), and a debug panel (`F3`)
shows the actual times.

```ts
interface SlicedSystem extends SimSystem {
  /** Process the next slice; return true when this pass is complete. */
  step(budgetMs: number): boolean;
}
```

### 4.3 The simulation moves into a Web Worker (pulled forward from Phase 12)

- The worker owns `World`, `City` and the `Simulation`. The main thread owns rendering and the UI.
- **Main thread → worker:** commands (`placeRoad`, `zone`, `setPolicy` …), the same plan/apply pairs as now (D-023). Tool *previews* still run `plan*` on the main thread against a read-only mirror.
- **Worker → main thread:** a `SimSnapshot` per day with changed tile ranges, changed buildings and the HUD numbers, plus a per-frame agent buffer (`Float32Array` of x, y, heading and sprite, transferred, not copied).
- Fields are sent at their coarse resolution (64×64 floats = 16 KB) only when a data view is open.

### 4.4 A faster road graph

BFS over tiles won't survive transit, dispatch and mode choice. The new graph:

- **Nodes** = junctions, dead ends, entrances and stops. **Edges** = road segments between them, with length, type, capacity and current travel time.
- Rebuilt incrementally on road edits (only the touched segments).
- **Dijkstra with a binary heap** for routes. **Isochrones** (everything within T minutes of a building) for service reach, cached per service and invalidated by road edits or big congestion changes.
- The same graph shape is used for rail and transit lines (separate layers, with transfer edges at stations).

### 4.5 Fields

```ts
interface Field {
  readonly name: FieldName;            // 'landValue' | 'air' | 'noise' | ...
  readonly cell: 2;                     // tiles per cell side
  readonly data: Float32Array;          // (W/2) × (H/2)
  readonly decay: number;               // fraction lost per update
  readonly spread: number;              // diffusion to neighbours per update
}
```

Each update: add sources, diffuse (a 3×3 blur), decay, then clamp. One field updates per
tick in round-robin order, so a 64×64 field costs well under 1 ms. Wind (a slowly turning
direction) pushes air pollution downwind, which makes sitings like "industry downwind of
homes" a real decision.

### 4.6 City history

A ring buffer of daily samples (population, funds, happiness, jobs, unemployment by education,
traffic, crime, pollution, approval, and so on): 10 years at month resolution plus the last
90 days at day resolution. It powers the **Graphs** panel and the yearly report, and it's saved.

### 4.7 Determinism and the headless harness

- Every system keeps its own seeded random stream (as growth and fire do now).
- **`bun run sim:run --seed 42 --preset demo --years 10`** runs the sim without rendering and writes a CSV of the history. It's our balancing tool (§14) and catches regressions in CI.

---

## 5. People: Households That Live, Learn, Earn and Move

### 5.1 Resident groups per home

Each home stores small counts instead of one `occupants` number:

```ts
const LifeStage = { Child: 0, Student: 1, Adult: 2, Senior: 3 } as const;
const Education = { None: 0, Basic: 1, High: 2, University: 3 } as const;
const Wealth = { Low: 0, Mid: 1, High: 2 } as const;

/** One home's residents (SoA in ResidentStore; this is the logical shape). */
interface ResidentGroup {
  readonly stage: readonly [child: number, student: number, adult: number, senior: number];
  /** Adults and seniors by education. */
  readonly education: readonly [none: number, basic: number, high: number, uni: number];
  readonly wealth: WealthTier;          // the building's tier, set by its land value (§6)
  employed: number;                     // adults with a job
}
```

Storage: one `Uint16Array` of 10 counts per building slot. A 3,000-home city is 60 KB.

### 5.2 Life stages (monthly)

Real years would be far too slow (a game year is 36 minutes), so **people move through
stages faster than the calendar**. Starting monthly rates, to tune:

| Transition | Base rate / month | Changed by |
|---|---|---|
| Births (new children) | 0.4% of adults | happiness, housing space, health |
| Child → Student | 1/24 of children | — |
| Student → Adult | 1/24 of students | gains the education level they could get a seat for (§5.4) |
| Adult → Senior | 1/150 of adults | — |
| Senior deaths | 1/60 of seniors | health access, air pollution (×0.6 … ×1.6) |

A young town is full of families, schools fill up a few years later, and an old city needs
more healthcare. **The demographic wave is the first "evolution" the player feels.**

### 5.3 Migration (monthly, plus daily trickle)

- **Move-in:** the city's **attractiveness** for each wealth tier is

  `job openings for that tier + housing vacancy + city happiness + (policies, landmarks) − taxes`.

  Migrants arrive through an **outside connection** (§8.1) in groups shaped by the tier: young adults for offices, families for suburban homes, and so on. With no connection, only births grow the city.
- **Move-out** replaces instant abandonment as the normal response to unhappiness. Unhappy homes lose residents each month (up to 5% at happiness 0). The current abandonment rule (D-061) stays as the end state when a building empties completely.
- **Unemployment** pushes adults out after 3 months, with educated adults leaving first: the "brain drain" a player has to answer with offices.

### 5.4 Education

| Building | Serves | Seats | Effect |
|---|---|---|---|
| Elementary School (1×2) | children | 300 | children → **Basic** when they become students |
| High School (2×2) | students | 600 | students → **High** when they become adults |
| University (3×3 campus) | young adults (part of the adults) | 1,500 | adults → **University** over 24 months; boosts office and tech demand |
| Library (1×1) | everyone in reach | — | +10% graduation rates; small happiness boost |

- **Seats matter:** if 900 children share a 300-seat school, two thirds of them only reach `None`. The info panel shows seats used / seats.
- Reach is **travel time over roads** (§9.1), not a radius.
- Education changes which jobs people can take (§7.2) and how much tax they pay.

### 5.5 Making individuals visible (cheap and charming)

- **Citizen spotlight:** click any pedestrian, car or home to see "Maya Okoro, 34, University, works at Harbour Office Tower, 22 min commute by bus, unhappy about noise". It's **derived deterministically** from (building id, slot), not stored, so it costs nothing. Names come from our own syllable generator.
- **Follow mode:** the camera follows that citizen's commute car or bus.
- Speech bubbles (Phase 9) gain a speaker name from the same generator.

---

## 6. Land Value and Desirability: What Drives Evolution

### 6.1 The land value field

Recomputed in slices from these inputs (starting weights, to tune):

| + raises | − lowers |
|---|---|
| waterfront (within 3 tiles of clean water) +0.15 | air pollution −0.30 |
| parks and plazas nearby +0.20 | noise −0.15 |
| service reach (school, health, police) up to +0.20 | crime −0.25 |
| transit stop within 5 min walk +0.15 | ground pollution −0.40 (and blocks homes above 0.5) |
| shops reachable on foot +0.10 | heavy traffic on the street −0.10 |
| landmarks and university +0.10 | abandoned buildings nearby −0.10 each |
| neighbouring land value (diffusion) | garbage left uncollected −0.15 |

Land value is 0–1 per cell. The **data view** shows it as a heat map, and the info panel
breaks it down for the selected tile ("+0.18 park, −0.22 factory smoke").

### 6.2 Desirability per zone type

Each zone type wants different things, so the same tile can be good for one and bad for another:

| Zone | Wants | Avoids |
|---|---|---|
| Residential | land value, quiet, schools, parks, short commute | pollution, noise, crime, heavy traffic |
| Commercial: shops | **footfall** (residents within a walk, passing traffic), customers' spending | crime, ground pollution |
| Commercial: offices | educated workers within commute, transit, land value | pollution |
| Industry | highway or rail freight access, cheap land, workers | — (it *produces* the pollution) |

### 6.3 The building lifecycle

```
 zoned ──▶ construction ──▶ occupied ──▶ upgraded ──▶ redeveloped (merged, denser)
                              │   ▲
                              ▼   │ recovers
                           declining ──▶ abandoned ──▶ cleared or regrown
```

- **Level and wealth come from land value.** A lot builds the highest level its **desirability** allows *and* that demand supports. Its **wealth tier** (low/mid/high) is set by land value at build time, and its variant art follows (bigger gardens and glass for high wealth; denser and plainer for low).
- **Condition** (0–1) falls slowly with age and faster under pollution, crime or low funding. It rises with high land value (owners renovate). Low condition darkens the art and lowers occupancy; it's the "declining" state before abandonment.
- **Redevelopment:** when demand is strong and land value has risen well past what a building's level needs, adjacent low buildings merge into a 2×2 (later 3×3) lot and rebuild denser. **Suburbs turn into a downtown over time without the player bulldozing anything.**
- **Gentrification:** when a low-wealth home's land value rises past its tier, it upgrades to mid wealth. Low-income residents are displaced and need affordable housing elsewhere. A **"Affordable housing" policy** (§11.3) holds a district's tier.

### 6.4 Demand v2 (replaces the capacity demand of D-035)

| Bar | Driven by |
|---|---|
| **R** (split by wealth tier) | job openings per education level + attractiveness − vacancy |
| **C: shops** | residents' spending (by wealth) − existing shop capacity; also unmet "shopping" needs |
| **C: offices** | unemployed High/University adults + university graduates − office jobs |
| **I** | goods demand from shops + export orders − production (§7) |

The demand meter gets a **"why" tooltip**: "Offices: 420 graduates without matching jobs".

---

## 7. Economy: Jobs, Goods and Money

### 7.1 Jobs by education

Each job building splits its jobs by education level:

| Building type | None | Basic | High | Uni |
|---|---|---|---|---|
| Farm, forestry, workshop | 50% | 40% | 10% | — |
| Factory, warehouse | 20% | 50% | 25% | 5% |
| Shops, café, supermarket | 10% | 50% | 35% | 5% |
| Offices | — | 10% | 50% | 40% |
| Tech park (new, late) | — | — | 30% | 70% |
| Services (schools, clinic …) | — | 20% | 40% | 40% |

**Job matching (daily, per commute-reachable area):** fill the highest-requirement jobs
first, letting over-qualified workers take lower jobs. They work, but with a happiness
penalty ("I'm over-qualified for this job"). Jobs left unfilled lower the job building's
happiness ("We can't find skilled workers").

### 7.2 Wages and wealth

- Each education level has a wage. A home's income is the sum of its employed adults' wages.
- **Taxes become real:** residential tax is a share of income, and commercial and industrial tax a share of profit. That replaces the flat $3/resident (D-029).
- Educated, employed cities are richer. That's the economic reason to build schools, beyond happiness.

### 7.3 Goods (a light production chain)

```
 raw:  farms (fertile grass) · forestry (forest tiles, finally a use for trees) · ore (rocky ground)
          │ trucks
          ▼
 industry: factories turn raw → goods      ◀── imports when local raw runs short
          │ trucks
          ▼
 commerce: shops sell goods to residents   ──▶ exports of surplus via connections
```

- Quantities are daily **flows**. Freight trips join the commute model as a second flow (trucks count ×2 towards congestion).
- A shop without goods slowly loses customers and complains "Our shelves are empty".
- **Specialised industry** comes from painting Industry over farmland, forest or ore: each terrain picks a type with its own art.
- Export income needs an outside connection with capacity: a highway at first, then rail and a seaport (§8).

### 7.4 City finances

- **Separate tax rates:** R, C and I (and, later, per district). The demand response per point stays readable.
- **Service funding:** each department (police, fire, health, education, transport, utilities, garbage) has a slider from 50% to 150%. Effectiveness and upkeep scale together: underfunding lowers capacity and slows response, overfunding boosts them with diminishing returns.
- **Loans:** up to 3 at a time, with fixed monthly repayments and interest set by city size.
- **Bankruptcy:** negative funds for 3 months freezes construction and halves service funding until repaid. The game warns at −1 month.
- **Budget panel v2:** income by source, expenses by department, a 12-month graph, and a forecast.

---

## 8. Roads, Bridges and the Outside World

### 8.1 Outside connections

- **Every new map starts with a regional highway** (seeded, part of terrain generation). The first road joins it. This is where migrants, trade and tourists come from. How it arrives depends on the preset:
  - **Plains, Forested, River Valley, Lakes:** in from one land edge, crossing rivers on pre-built bridges.
  - **Coastal:** along the land side, parallel to the coast.
  - **Island:** a long **causeway bridge** from the map edge to the shore (pre-built, so it ignores the 12-tile limit). Islands also start with a small ferry pier as a second link.
- Later connections: **rail line** (map edge), **seaport** (coastal maps), **airport** (late, large, noisy). Each has a capacity for people and goods, shown in a Connections panel.

### 8.2 The road hierarchy

| Type | Lanes | Capacity (commuters/day) | Speed | Noise | Unlocks |
|---|---|---|---|---|---|
| Street (current road) | 2 | 500 | 1× | low | start |
| **Avenue** (median trees) | 4 | 1,200 | 1.2× | medium | Town |
| **One-way street** | 2 | 700 | 1.1× | low | Town |
| Highway (current) | 4 + barrier | 1,500 | 2.2× | high | start |
| **Highway ramps** | — | — | — | — | City |
| **Boulevard with tram** | 4 + tracks | 1,200 + tram | 1.1× | medium | City |

- Dragging a road type over an existing road **upgrades it in place** (cost = difference).
- Highways stop connecting directly to streets. They need a **ramp**, a 1×3 piece placed where a road meets a highway, which keeps highways fast. Existing saves keep their direct links (marked "legacy" in the save).
- Upkeep and capacity per type feed the commute model automatically, since it already prices tiles by type.

### 8.3 Junctions

- Junction control chosen automatically by load, and overridable by clicking a junction: **none** (quiet T-junctions), **stop signs**, **traffic lights** (current, D-059) or a **roundabout** (needs a 3×3 square of road).
- **Adaptive lights:** green time per axis follows queue length (each axis gets at least 3 s, at most 12 s).

### 8.4 Bridges, overpasses and tunnels on a flat map

Maps stay flat (D-051). Height is drawn by the renderer, which can already lift sprites (D-043/D-044).

| Structure | Rule | Span |
|---|---|---|
| Beam bridge (current) | straight, land to land | ≤ 6 tiles |
| Truss bridge | straight; streets and avenues | 7–12 tiles |
| Suspension bridge | straight; avenue or highway; a landmark (+land value nearby) | 13–24 tiles, costly |
| **Overpass** | a highway or rail line crosses over a road without a junction (grade separation) | over 1–3 tiles |
| **Tunnel** | under water or under existing blocks, entry and exit portals only | ≤ 16 tiles, very costly |

Overpasses and interchanges are the big traffic tool of the mid game. A **cloverleaf**
and a **diamond interchange** are offered as prefabs (stamped as one command).

### 8.5 Road condition (optional, off by default)

Roads lose condition with heavy-vehicle traffic. Below 30%, speed drops 20% and the
traffic view shows cracks. Transport funding repairs them. It's off by default and turned on
as a "hard mode" option on the New Game screen (§16, question 6).

---

## 9. Transportation: Moving People Without Only Cars

### 9.1 Mode choice: why transit matters

Each commuter group picks a mode by **generalised cost**:

`cost = travel time + waiting time × 2 + walking time × 1.5 + fare ÷ value of time`

| Mode | When it wins |
|---|---|
| **Walk** | trips under ~10 minutes, typical in mixed-use areas |
| **Bike** (with bike lanes, later) | trips under ~20 minutes on quiet streets |
| **Bus / tram / metro** | a stop within a 5-minute walk at both ends, frequent service, a congested road route |
| **Car** | everything else; low-wealth households own fewer cars |

Mode shares feed back into **road volume** (fewer cars → less congestion → less noise and
air pollution → higher land value). That loop is the core of the transport game.

### 9.2 Transit lines the player designs

- **Stop tool** (replaces automatic stops from D-041; automatic stops stay until the player builds a first line): place stops on roads.
- **Line tool:** click stops in order to make a loop or out-and-back line. Each line has a colour and number, and a **frequency** set by the number of vehicles.
- **Line panel:** riders a day, crowding, cost, fare income, and a sparkline.
- **Vehicles:** buses (roads, share traffic), trams (avenues and boulevards, their own lane), metro (underground: stations are the only surface footprint, which suits the flat map), trains (rail tiles, stations, connect to the outside).
- **Transfers:** riders change lines at shared stops (transfer edges in the graph, with a waiting-time cost).
- **Depots:** each mode needs a depot reachable from its lines.

### 9.3 Freight and service vehicles

- **Freight trucks** carry goods flows (§7.3), sampled into visible trucks as commute cars are.
- **Service vehicles** are dispatched to real incidents and drive the road graph with lights flashing: **fire trucks, ambulances, police cars, garbage trucks, hearses (optional)**. Other cars move aside (slow down and shift lanes) for vehicles with sirens.

### 9.4 Visible traffic scale

Visible agents stay a *sample* (D-059): a cap of about 0.35 per road tile, plus caps per
mode. Rendering moves to one instanced batch per atlas page if the counts need it.

---

## 10. Services: Reach, Capacity and Response

### 10.1 From circles to travel time

Every service gets three numbers:

- **Reach:** an isochrone, the area within N minutes of travel over roads from its entrance (police 8, fire 6, clinic 10, hospital 15, schools 12 minutes walk or bus). Rivers without bridges, and jams, cut it.
- **Capacity:** seats, beds, officers or trucks.
- **Quality:** funding × staffing (it needs educated workers, §7.1) × (1 − overcrowding).

Coverage shows as a heat map while placing a building and in each service's data view. The
current circle rule (core.md §4) stays as the fallback until isochrones land.

### 10.2 The service catalogue (complete)

| Group | Buildings (★ = new) | What it does |
|---|---|---|
| **Safety: police** | Police Station, ★Police HQ (2×2), ★Prison (3×3) | lowers the crime field; dispatches to incidents; a prison raises police capacity citywide |
| **Safety: fire** | Fire Station, ★Fire HQ (2×2) | dispatches to fires; lower fire hazard in reach |
| **Health** | Clinic, ★Hospital (3×2), ★Cemetery (2×2) | treats illness (beds); sets the death and sickness rates; ambulances |
| **Education** | ★Elementary, High School (current School becomes this), ★University (3×3), ★Library | see §5.4 |
| **Recreation** | Parks (current six), ★Plaza, ★Sports field, ★Stadium (4×4), ★Museum | land value; happiness; tourism |
| **Government** | Town Hall (current), ★City Hall upgrades, ★Post office | §11 |

### 10.3 Incidents and dispatch (where traffic gets teeth)

```
 hazard field ──▶ incident (fire, crime, illness) ──▶ nearest station with a free unit
       ▲                                                   │ route over roads (with congestion)
       │                                                   ▼
 funding, coverage,                      arrival time ──▶ outcome
 density, condition                       ≤ target   : resolved, small damage
                                          late       : fire spreads to neighbours / crime raises
                                                       the crime field / patient health worse
```

- **Fires** (replaces the flat 0.03% chance): hazard depends on density, industry, condition and funding. A fire has intensity that grows each in-game hour and **spreads to neighbours** at high intensity. Trucks put it out. The player sees the truck racing through traffic.
- **Crime:** a crime field from unemployment, low land value, density and missing police. Crime incidents happen in proportion to it. A police visit lowers the local field. High crime lowers land value and makes people move away.
- **Illness:** sickness rate from the health field (pollution, dirty water, garbage, missing healthcare). Sick residents need a hospital bed. Overflow raises deaths and lowers happiness.

---

## 11. Government: Growth Stages, Districts and Policy

### 11.1 City stages and unlocks

| Stage | Population | Unlocks | Problems that appear (by design) |
|---|---|---|---|
| **Hamlet** | 0 | streets, highway connection, R/C/I low, power plant (coal), water tower, park | power, water, first jobs |
| **Village** | 500 | apartments, shops, police, fire, clinic, elementary school, garbage (landfill) | services, garbage, first pollution |
| **Town** | 2,500 | offices, avenue, one-way, high school, library, bus lines, wind/solar, districts, policies | commute, education mismatch, noise |
| **City** | 10,000 | towers, ramps and overpasses, hospital, university, trams, metro, sewage plant, recycling, loans | traffic, crime, land value and gentrification |
| **Metropolis** | 50,000 | tech park, stadium, museum, suspension bridge, rail and seaport, airport, nuclear, prison | trade, tourism, disasters at scale |

Each stage gets a short celebration (fireworks over City Hall, a toast, a cash grant) and a
"What's new" card. The game stays sandbox-friendly: a **Sandbox** mode unlocks everything
and allows unlimited money (§16, question 5).

### 11.2 Districts

- **District tool:** paint named areas (a `district` tile layer, up to 32 districts). Names are generated ("Riverside", "Old Mill") and editable.
- Districts get their own **policies**, **tax adjustments** (±3 points) and **statistics** (population, happiness, land value, top complaint).
- District names are drawn on the map at mid-zoom.

### 11.3 Policies (city-wide or per district)

Each policy is a data entry with a monthly cost and **modifiers** applied through one
central modifier table, so systems never special-case them:

```ts
interface PolicyDef {
  readonly id: PolicyId;
  readonly name: string;
  readonly scope: 'city' | 'district' | 'both';
  readonly costPerResident: number;        // monthly
  readonly modifiers: readonly Modifier[]; // e.g. { target: 'fireHazard', op: 'mul', value: 0.7 }
  readonly unlock: CityStage;
}
```

Initial set: smoke detectors, free public transit, recycling, heavy-traffic ban,
high-rise ban, affordable housing, tourism promotion, education boost, green energy
subsidy, parking fees, small-business support, industrial filters, curfew for industry
noise, park maintenance.

### 11.4 Approval and requests

- **Mayor approval** (0–100%) = happiness (60%) + budget health (20%) + recent events (20%). Low approval shrinks tax tolerance (higher taxes lower demand faster). High approval unlocks a small yearly bonus.
- **Citizen requests:** every few months, the "Citizens say…" panel (Phase 9) turns its top complaint into a **request** with a deadline and a reward: "Riverside asks for a hospital within 6 months (+$5,000, +5% approval)".
- **Advisors:** short, specific tips from the city's actual data ("Industry in Old Mill is upwind of Riverside; 1,200 residents breathe its smoke"), each with a **Show me** button.

### 11.5 Disasters: real hazards that come from the land

User direction (D-063): disasters must feel real and **fit the map**. An island gets
tsunamis, a river valley floods, a forest burns. Every disaster follows the same five-step
shape, so each one is learnable and fair:

```
 RISK (always visible)  →  WARNING (lead time)  →  EVENT (simulated spread)
        ▲                                                │
        │                                                ▼
 MITIGATION (buildings, policies, layout)  ◀──  AFTERMATH (damage, recovery, lessons)
```

- **Risk** is a field the player can see before anything happens (a "Hazards" data view). Nothing comes from nowhere.
- **Warning:** a detection building (or nothing, for a shorter warning) gives in-game hours of notice. The game auto-pauses on the warning, and the HUD shows a countdown, the affected area and suggested actions.
- **Event:** a physical model on the tile grid, not a random "building destroyed".
- **Aftermath:** damaged buildings become **ruins** (with their own art) that need clearing or rebuilding. Roads can be cut. People displaced from ruined homes need housing or they leave. Unhappiness fades over a few months.
- **Mitigation:** every hazard has buildings, policies and layout choices that measurably shrink it.

#### Hazards by terrain preset

| Preset | Main hazards | Also possible |
|---|---|---|
| **Island** | tsunami, tropical cyclone | coastal erosion, drought (limited fresh water) |
| **Coastal** | storm surge, tsunami (rarer), tropical cyclone | coastal erosion |
| **River Valley** | river flood (seasonal) | landslide-free; fires, storms |
| **Lakes** | lake flood after heavy rain, thunderstorms with lightning fires | ice storm in winter |
| **Forested** | wildfire (spreads through the tree layer) | windstorm (falls trees onto roads) |
| **Plains** | tornado, drought and heat wave | hail, blizzard |
| **All maps** | building fires (§10.3), earthquake (rare, mild), power-grid failure, epidemic | — |

#### How each one works

**Tsunami** (Island, Coastal)
- *Cause:* an offshore earthquake, shown as a brief shake and a ring on the sea beyond the map edge.
- *Warning:* 10 in-game minutes with nothing; 2 in-game hours with a **Tsunami Warning Buoy** (placed on deep water) or a **Warning Centre**. Sirens play and citizens evacuate along roads to tiles marked **safe** (more than N tiles from the coast); evacuees show as crowds of pedestrians.
- *Event:* the sea first **draws back** (shore tiles shown as wet sand), then a wave front advances inland from the open sea. Its strength (run-up) starts at a seeded magnitude and drops with every tile it crosses: by 1 per open tile, 3 per tree tile (coastal forest is a real barrier), 5 per building, and it is stopped completely by a **sea wall**. Bays and river mouths funnel it further inland. Then it recedes over a few hours, leaving standing water that drains away.
- *Damage:* by local wave strength: low buildings first, towers last; cars on flooded roads are swept away (removed); bridges in the wave path may collapse above a set strength.
- *Mitigation:* sea walls and breakwaters, keeping a coastal forest strip, the "No building in the coastal zone" district policy, vertical evacuation towers (Metropolis), warning buoys.

**Tropical cyclone / storm surge** (Island, Coastal)
- *Warning:* days ahead. A storm track appears on the minimap, with a probability cone that narrows as it approaches.
- *Event:* wind strength over the map for 1–2 days; trees fall onto roads (blocking them until cleared by road maintenance), weak buildings (low condition) lose roofs, power plants and wind turbines trip off, and a **storm surge** floods low coastal tiles (the same flood model as river floods, fed from the sea).
- *Mitigation:* building condition (funded maintenance), the "Storm-proof building codes" policy (cost per new building), sea walls, underground power links.

**River and lake floods** (River Valley, Lakes)
- *Risk:* a flood-plain field, from distance to the river and how far downstream the tile is. It's shown in the Hazards view from the start, so players can choose not to build there.
- *Season:* spring snowmelt and heavy-rain weather raise the water level for days. The river's flow direction (§12.2) carries the rise downstream.
- *Event:* water spreads tile by tile from the river into flood-plain tiles whose level is below the flood level (a flood fill with a water-depth value per tile). Levees and dams stop it. Water drains back over days.
- *Damage:* flooded buildings close (no residents or jobs) for the duration, and lose condition by depth. Flooded roads are impassable, so routes and service reach (isochrones) change live. Sewage plants in floods spill pollution downstream.
- *Mitigation:* **levees** (drawn like roads along the bank), the hydro dam (which also holds water back), flood-plain parks (parks take no damage), the "No building in the flood plain" policy.

**Wildfire** (Forested; also dry Plains)
- *Risk:* a dryness value per tree tile from season, drought weather and tree density, plus lightning in thunderstorms.
- *Event:* a cellular fire spread over the `tree` layer: each burning tile ignites neighbours with a probability set by density, dryness and **wind direction** (strongly downwind). Fire jumps to buildings next to burning trees and then follows the building-fire rules (§10.3). Burned tiles become ash ground that regrows over years.
- *Mitigation:* **firebreaks** (any cleared strip, roads, and rivers stop it), fire lookout towers (earlier warning), fire stations near the forest edge, water bombers (a fire HQ upgrade), the "Controlled burns" policy (costs a little forest each year, cuts dryness).

**Tornado** (Plains)
- *Warning:* 15–30 in-game minutes with a **Weather Radar**; almost none without one.
- *Event:* a funnel travels a seeded, wobbling path for 10–40 tiles. Damage is heavy along a 1–3 tile band and light beside it.
- *Mitigation:* the radar, storm shelters (small civic buildings that cut deaths), building codes.

**Drought and heat wave** (Plains, Island)
- *Event:* weeks of high temperature: water supply from pumps drops (river and lake levels fall), power demand rises (cooling), seniors' health worsens, wildfire dryness rises.
- *Mitigation:* water storage, the "Water restrictions" policy, parks and street trees (cooler blocks), hospitals.

**Earthquake** (all maps, rare)
- Magnitude falls with distance from a seeded epicentre. Damage depends on building condition and age. Bridges and tall buildings are most at risk; the "Seismic building codes" policy reduces it. On Island and Coastal maps, a large offshore one triggers a tsunami.

**Epidemic and grid failure** (all maps)
- An epidemic grows from the health field (dirty water, garbage, pollution, missing hospitals) and spreads between nearby homes and along busy transit lines.
- A grid failure happens when demand exceeds supply at peak or a plant is damaged, and cascades across a road island unless batteries cover it.

#### Rules that keep disasters fair

- **Frequency** follows the hazard and the stage: nothing in the Hamlet stage, then rare (roughly one notable disaster every 2–4 game years), never two big ones at once.
- **Settings** on the New Game screen and in options: *Off / Mild / Realistic*. Mild caps magnitude and damage. **Realistic is the default for Career mode.** A "Trigger disaster" menu is available in Sandbox mode.
- **Never city-ending:** damage caps at a share of the city, and a recovery grant arrives after any disaster above a threshold.
- **Seeded:** each disaster draws from its own random stream, so saves and the harness reproduce them.
- **Readable:** a post-disaster report shows what was hit, why (no sea wall, in the flood plain, low condition) and what would have helped.

#### What it needs in the simulation

| Need | Where |
|---|---|
| Weather and seasons (temperature, rain, wind) | a `Weather` system, daily, seeded |
| Water depth per tile (floods, surge, tsunami) | a `flood` field at **full tile resolution** (`Uint8Array` depth), only active during an event |
| Fire state per tree tile | a sparse active-fire set, so idle cost is zero |
| Hazard risk maps (flood plain, coast distance, dryness) | precomputed fields, refreshed when terrain-like layers change |
| Ruins and damage | building `condition` (§6.3) plus a `ruined` flag |
| Levees, sea walls, breakwaters | new structure tile layer (`barrier`), drawn like roads |

---

## 12. Utilities v2 (still no pipes)

Delivery stays over road islands (D-052). What grows is what's produced and its side effects.

### 12.1 Power

| Plant | Output | Cost | Running cost | Pollution | Notes |
|---|---|---|---|---|---|
| Coal (current) | 4,000 | low | fuel | high air | Hamlet |
| Gas | 5,000 | mid | fuel (imported) | medium | Town |
| Wind farm (per turbine 1×1) | 400, varies with wind | mid | none | noise | open land |
| Solar field (2×2) | 600, daytime only | mid | none | none | needs battery or night backup |
| Hydro dam | 8,000 | high | none | none | on a river crossing, raises the water upstream (render only) |
| Nuclear | 20,000 | very high | low | none | Metropolis; a tiny incident risk if underfunded |

- **Day and night demand:** demand follows the clock (higher in the evening). With solar and no storage, **brownouts at night** are possible: buildings in a brownout lose occupancy, as unpowered ones do now.
- **Battery storage** (2×2) evens out the curve.

### 12.2 Water and sewage

- **Water pump** (on a shore tile) replaces the tower as the main source. The tower remains as small storage.
- **Water quality:** a pump drawing from polluted water delivers dirty water, which raises the health field's sickness rate.
- **Sewage:** every building makes sewage equal to its water use. Without a **sewage outlet** or **treatment plant** it backs up (a complaint, then health damage). An outlet dumps it into water.
- **Rivers flow:** each water tile knows its downstream direction (computed once from the generator's river paths). **Water pollution travels downstream**, so an outlet upstream of your pump poisons your own city. Treatment plants remove most of it. This uses the River Valley terrain the game started with.

### 12.2b Drainage (user request, 2026-11-01)

- **Rain** (from the Weather system) falls on every tile. Grass, parks and trees soak most of it up; roads, roofs and paved lots shed it as **runoff**.
- **Storm drains** come with every road: each road tile drains a little. **Drainage capacity** grows with storm-drain upgrades (a road upgrade, like avenues) and **retention ponds** (2×2 parks that hold water).
- Runoff that the drains can't take **pools on low streets**: flooded road tiles slow traffic, then close. It ties into the river-flood model (§11.5), which uses the same water-depth field.
- **Combined sewers:** in older districts, storm water and sewage share pipes. Heavy rain overflows them into the river unless a treatment plant has spare capacity. That's a reason to build separate drains.

### 12.3 Garbage

- Every building makes garbage daily (more for commerce and density, less with the recycling policy).
- **Garbage trucks** run rounds from a **landfill** (fills up and pollutes the ground), an **incinerator** (makes power and air pollution) or a **recycling centre** (cuts landfill use, sells materials).
- Uncollected garbage piles up on the building (visible bags at high zoom), lowers land value and raises sickness.

---

## 12.4 Research (user request, 2026-11-01)

- **Research points** come from universities and **research centres** (new, 2×2, Town stage), scaled by educated workers and funding.
- Points go into a **research tree** the player picks from, with three branches:
  - *Energy:* gas turbine efficiency, better batteries, then nuclear and other advanced plants.
  - *Mobility:* adaptive signals, trams, metro, electric buses (less noise and air).
  - *City:* better water treatment, drainage materials, recycling, medical upgrades (hospital capacity, ambulance speed).
- Each upgrade is a **modifier** in the same central table as policies (§11.3), so systems never special-case research. The tree, the progress and the unlocks are saved.

---

## 13. Performance Plan (60 FPS at 128×128 with a full city)

| Area | Budget per frame / per tick | How |
|---|---|---|
| Main thread rendering | ≤ 10 ms | chunks, culling, LOD (as now) |
| Agents (render) | ≤ 2 ms | pooled sprites, then instancing past ~800 |
| Worker: one tick | ≤ 8 ms (worker thread) | time-slicing |
| Field update | ≤ 1 ms per field | 64×64 coarse grid, one field per tick |
| Routing (commute and mode choice) | ≤ 25 ms a day, sliced | segment graph, grouped origins (as now), Dijkstra, per-tick slices |
| Isochrones | ≤ 2 ms each | cached, rebuilt only on road edits |
| Snapshot to main thread | ≤ 0.5 ms | transfer typed arrays, send diffs |

- **Scale target:** 256×256 maps, 150,000 residents, 15,000 buildings, 1,200 visible agents.
- **Benchmarks in CI:** `tests/bench/` runs a 10-year demo city and fails if any system goes over its budget by more than 50%.

### Save format v2 (Phase 10 is building v1)

v2 adds what can't be recomputed: resident groups (the 10 counts per home), building
condition and wealth tier, districts layer, policies, transit lines and vehicles, the rail
layer, loans, history ring buffer, landfill fill levels, accumulated ground pollution,
unlock stage and approval. Fields that rebuild within a few days (air, noise, crime) are
not saved. A v1 save loads with defaults: residents split by a standard age profile,
condition 1, wealth from land value.

---

## 14. Balancing and Testing

- **The harness** (§4.7) runs scripted cities: the `/demo` layout, the jam town, a "no services" town, an "industry next to homes" town and a "transit city". Each has **target curves**, for example "demo reaches 10k residents in 4–6 years at 80%+ happiness" and "the no-services town stalls below 1,500".
- **Invariants** (unit tests): residents ≤ capacity, employed ≤ adults ≤ residents, money in = money out each month, fields stay within 0–1, every route ends at a reachable node, a loaded save produces the same next 30 days as the running city.
- **All tuning numbers live in `shared/balance.ts`**, grouped by system, so balancing never touches logic.
- **A playtest checklist per phase:** "Can a new player tell why their city stopped growing within 30 seconds?"

---

## 15. Phased Roadmap (after Phase 10)

**Current order (user direction, 2026-11-01, D-067):** features first, in this order:
**A** energy v2 (§12.1) → **B** water, sewage and drainage (§12.2, §12.2b) → **C** health and
education, with hospitals, universities and research centres (§5.4, §10, §12.4) → **D** proper
traffic: the road segment graph, avenues and junctions (§4.4, §8) → **E** public transport
(§9) → **F** the research tree (§12.4). Each step brings the engine pieces it needs (the
deterministic tick clock arrives with A, the segment graph with D, and so on). The table below
is the original grouping, kept for reference.


Each phase is shippable and keeps 60 FPS. Order follows the dependencies: the engine first,
then the drivers of evolution (land value and people), then networks that act on them,
then economy, government and events.

| Phase | Theme | Key content | Definition of done |
|---|---|---|---|
| **11** | **Engine for depth** | Web Worker sim, segment graph + Dijkstra, fields, time-slicing, history and Graphs panel, `sim:run` harness, benchmarks | /demo is unchanged; the main thread's sim cost per frame is under 1 ms; the harness runs 10 years in under a minute |
| **12** | **Land value and pollution** | land value field, air/noise/ground fields with wind, desirability per zone, wealth tiers, condition and decline, redevelopment, demand v2 with "why", data views | a factory placed next to homes visibly lowers their value, and they decline in months |
| **13** | **People** | resident groups, life stages, births and deaths, migration and move-out, regional highway connection, citizen spotlight | the demo's population pyramid shifts over 10 years; unhappy areas lose people before they're abandoned |
| **14** | **Education and jobs** | elementary, high school, university, library; job education mix; wages and income tax; brain drain | building a university raises office demand within a year; unemployment by education shows in the Graphs panel |
| **15** | **Services v2** | isochrone reach, capacity, funding sliders, dispatch (fire, police, ambulance), fire spread, crime field, hospital | a jammed road measurably slows a fire truck, and the fire spreads further |
| **16** | **Utilities v2** | power plant types and day/night demand, batteries, water pump, sewage, river flow pollution, garbage and trucks | an upstream sewage outlet raises sickness downstream; solar alone causes night brownouts |
| **17** | **Transport I** | avenue, one-way, ramps, overpasses, interchange prefabs, junction control, adaptive lights, mode choice (walk/car/bus), player bus lines | a good bus line takes 15%+ of commuters off a congested corridor |
| **18** | **Transport II** | trams, metro, rail and train stations, outside rail connection, freight trucks, tunnels and long-span bridges | a metro line cuts average commute time in a 30k city by 20%+ |
| **19** | **Economy** | goods chain, specialised industry (farm, forestry, ore), shops needing goods, imports and exports, separate R/C/I taxes, loans, budget panel v2 | cutting the highway connection causes an export loss and empty shelves |
| **20** | **Government** | stages and unlocks, districts, policies, approval, citizen requests, advisors | a new player progresses from Hamlet to Town guided only by the in-game requests |
| **21a** | **Weather and disasters** | weather and seasons, the Hazards view, terrain-based disasters (§11.5): tsunami, cyclone and surge, floods, wildfire, tornado, drought, earthquake, epidemic, grid failure; levees, sea walls, warning buildings; ruins and recovery | on an Island map a sea wall plus a coastal forest strip measurably shortens a tsunami's run-up; Off/Mild/Realistic all work |
| **21b** | **Living city** | events and festivals, tourism, landmarks, seaport, airport | a stadium event creates visible traffic |
| **22** | **Polish and modes** | Sandbox vs Career, achievements, timelapse and photo mode, yearly report, tutorial, balance pass | the harness targets hold on all presets |

**Dependencies:** 11 → everything. 12 → 13 → 14. 15 and 16 need 11 (graph and fields) and
use 12. 17 → 18. 19 needs 14 (wages) and 17 (freight). 20 can start after 15. 21a needs 15
(fire spread, dispatch) and 16 (river flow); 21b last.

---

## 16. Decisions (answered by the user, 2026-11-01, D-063)

| # | Question | Decision |
|---|---|---|
| 1 | Groups or individual citizens? | **Groups**, with individuals sampled for display (§5.5) |
| 2 | Regional highway on every new map? | **Yes**, shaped by the preset; islands get a causeway (§8.1). Bumps `GENERATOR_VERSION`. |
| 3 | Highways need ramps? | **Yes** for new links; old saves keep their direct links |
| 4 | Unlock stages? | **Yes**: stages in Career, everything open in Sandbox |
| 5 | Buy map land in regions? | **No**, not for now |
| 6 | Road wear? | **Yes**, as an option, off by default ("hard mode") |
| 7 | Web Worker first (Phase 11)? | **Yes** |
| 8 | Disasters? | **Yes, and realistic**: tied to the terrain (tsunami on islands, floods in river valleys, wildfire in forests …), with warnings, mitigation and an Off/Mild/Realistic setting (§11.5) |
