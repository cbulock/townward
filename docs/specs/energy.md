# Energy v2 (step A of the utilities and services track)

## Plant coverage, wear and repairs

Power plants show a type-specific coverage preview while placing them. The preview is a
planning aid: buildings still need to share a connected road island with the plant, and
coverage differs by technology (gas reaches furthest; wind reaches the least).

Generating plants have a condition value. When hourly demand pushes the grid beyond a plant's
safe operating threshold, condition wears down and output is derated. A failed plant enters a
short repair period and is shown in the power panel and inspection panel. The player can pay
the plant's repair cost from its inspection panel to restore full output immediately. Condition
and repair state are saved, so a reload does not silently heal a damaged plant. v2 (step A of the utilities and services track)

Master plan §12.1, brought forward by the user (2026-11-01): the city's power should feel like
a real grid, with plants that differ, demand that follows the day, and storage that matters.
Delivery stays over road islands (D-052), with no lines or pipes.

## Player Experience

- **Five ways to make power**, each with a clear trade-off (Civic → Utilities):

| Building | Size | Cost | Upkeep / mo | Output | Character |
|---|---|---|---|---|---|
| Coal Power Plant (current `power_plant`) | 2×2 | $4,000 | $150 | 4,000 steady | cheap, steady, the dirtiest air |
| Gas Power Plant | 2×2 | $6,500 | $260 | 5,000 steady | steady, pricier to run, half the smoke |
| Wind Turbine | 1×1 | $900 | $15 | 0–450, with the wind | clean; the wind changes over days |
| Solar Farm | 2×2 | $3,200 | $30 | 0–1,000, with the sun | clean; nothing at night |
| Battery Bank | 1×1 | $2,500 | $25 | stores 2,400, moves 800 an hour | charges on surplus, covers shortfalls |

- **Demand follows the clock.** Each building's need is its capacity × the hour's demand:
  night 55%, morning 80–85%, day 80%, **evening peak 100%** (18:00–21:00), late 70%. A grid
  sized for the evening peak is always fine; a solar-only grid browns out every night.
- **Brownouts** serve buildings in order until the power runs out, as shortages do now. Unpowered
  buildings lose occupancy and complain. A notice explains the first brownout of each clock
  day and what fixes it: batteries, or steady plants.
- **Budget panel → Power** shows output now by source, demand now, and battery charge.

## Rules

- Hourly balance per road island (`sim/systems/energy.ts`), on each clock-hour boundary:
  1. Production: steady plants give their output; wind gives `output × wind(day)`; solar gives `output × sun(hour)`.
  2. Demand: the sum of `capacity × demand(hour)` of the buildings that need power.
  3. Surplus charges the island's batteries (each up to its rate and storage); a shortfall draws from them.
  4. The result is handed out in building order (as now).
- `wind(day)` is smooth seeded noise of the day (0.15–1.0), and `sun(hour)` is a half-sine from
  06:00 to 18:00. **Both are pure functions of seed, day and hour, with no state**, so they're deterministic for free.
- After an edit or a day, the grid is re-balanced **at the current hour without moving battery
  charge**; only the hourly step charges and drains batteries. (A clock hour is 100 ticks and a
  day 60, so days come more often than hours.) With no clock at all (tests, the demo builder)
  the peak is used: 100% demand and nominal wind and sun.
- Battery charge is saved per building (an 11th field in the save's building tuple, optional; old saves load with empty batteries).

## Deterministic Clock (needed by this step)

The time of day used to move with frame time, so a fast and a slow machine played
differently. Now:

- `City.ticks` (integer) counts fixed sim ticks (10 per sim second); `clock = ticks / 10`.
- `Simulation.tick()` advances it, fires `onHour` at each clock-hour boundary, and runs `day()` every 60 ticks.
- The game, the harness and the tests all drive the sim through `tick()`. Rendering only reads the clock.
- Saves keep storing `clock`; loading rounds it back to ticks, so it's exact.

## Not in this step

Hydro dams (with rivers, step B), nuclear (research, step F), air pollution as a field
(Phase 12 fields: until then gas plants count as half a polluter in the clean-air need).
