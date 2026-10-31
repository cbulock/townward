/** Tunable game-economy numbers. See docs/specs/roads.md. */
export const BALANCE = {
  startingFunds: 20_000,
  /** Cost per tile, by road type. */
  roadCost: 10,
  highwayCost: 40,
  /** Bridges replace the per-tile road cost while over water. */
  bridgeCost: 60,
  highwayBridgeCost: 160,
  /** Longest water crossing, in tiles. */
  maxBridgeSpan: 12,
  /** Clearing cost per tree (a tile holds 1–3). */
  treeClearCost: 3,
  rocksClearCost: 6,
  boulderClearCost: 15,
  /** Small decorations (flowers, tall grass) clear for free. */
  minorDecorClearCost: 0,

  // --- Simulation (sim/population.ts) ---
  /** Sim seconds per in-game day at 1× speed. */
  secondsPerDay: 2,
  daysPerMonth: 30,
  /** Share of the empty space in a home that fills each day (with road access). */
  moveInRate: 0.12,
  /** Share of residents who work. */
  workforceShare: 0.6,
  /** Homes only fill to this share of capacity while there are no jobs; jobs lift it to 100%. */
  minHousingFill: 0.45,
  /** Monthly tax per resident and per worker. */
  taxPerResident: 3,
  taxPerWorker: 2,
  /** Monthly upkeep. */
  roadUpkeep: 0.4,
  highwayUpkeep: 1.2,
  bridgeUpkeep: 2,
  civicUpkeepShare: 0.01,
  /** A land road within this many tiles of a footprint gives road access. */
  roadAccessRange: 3,

  // --- Zoning & growth (sim/growth.ts, docs/specs/buildings.md) ---
  /** Cost per tile to zone (dezoning is free). */
  zoneCost: 5,
  /** Days a construction site takes; the first half is the foundation, the second the scaffold. */
  constructionDays: 4,
  /** New lots per zone per day at full demand. */
  growthPerDay: 2,
  /** Upgrades per zone per day at full demand. */
  upgradesPerDay: 1,
  /** A building must be at least this full ... */
  upgradeOccupancy: 0.8,
  /** ... for this many days in a row before it can level up. */
  upgradeAfterDays: 20,
  /** City population needed before buildings can reach each level (index = level). */
  levelPopulation: [0, 0, 150, 1000],
  /** Demand model: share of the workforce that works in shops and offices (the rest in industry). */
  commercialJobShare: 0.3,
  /** Housing wanted per resident the jobs could employ (> 1 so the city keeps growing). */
  housingSlack: 1.15,
  /** Demand that a new town starts with: residents, shop jobs and industrial jobs. */
  seedHousing: 40,
  seedCommercialJobs: 6,
  seedIndustrialJobs: 20,
} as const;
