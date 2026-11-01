/** Tunable game-economy numbers. See docs/specs/roads.md. */
export const BALANCE = {
  /**
   * DEVELOPMENT VALUE: 700 million so building and testing never runs out of money.
   * Set back to a real starting budget (e.g. 20_000) before release.
   */
  startingFunds: 700_000_000,
  /** Cost per tile, by road type. */
  roadCost: 10,
  highwayCost: 40,
  avenueCost: 35,
  avenueBridgeCost: 110,
  /** Wide roads are priced per tile; one drag lays two tiles per step. */
  boulevardCost: 45,
  boulevardBridgeCost: 130,
  expresswayCost: 80,
  expresswayBridgeCost: 200,
  rampCost: 30,
  rampBridgeCost: 120,
  pedestrianCost: 20,
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
  secondsPerDay: 6,
  /** Sim seconds per day on the time-of-day clock (day/night, rush hours). */
  secondsPerClockDay: 240,
  clockStartHour: 7,
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
  avenueUpkeep: 0.9,
  boulevardUpkeep: 1,
  expresswayUpkeep: 1.6,
  rampUpkeep: 0.8,
  pedestrianUpkeep: 0.3,
  bridgeUpkeep: 2,
  /** A land road within this many tiles of a footprint gives road access. */
  roadAccessRange: 3,

  // --- Zoning & growth (sim/growth.ts, docs/specs/buildings.md) ---
  // --- Services & utilities (sim/services.ts, docs/specs/core.md) ---
  /** Daily chance that a finished building outside fire coverage burns down (once the city is this big). */
  fireChance: 0.0003,
  firePopulation: 200,
  /** Default tax rate in percent; income scales with rate ÷ this. Each point away shifts demand by taxDemandStep. */
  baseTaxRate: 9,
  maxTaxRate: 20,
  taxDemandStep: 0.04,
  // --- Needs & happiness (sim/systems/needs.ts, docs/specs/needs.md) ---
  /** Occupancy multiplier = happinessBase + happinessRange × happiness. */
  happinessBase: 0.55,
  happinessRange: 0.45,
  /** Happiness needed to level up to level 2 and level 3. */
  happyLevel2: 0.5,
  happyLevel3: 0.7,
  /** Below this for abandonDays in a row: abandoned. At recoverLine or above for recoverDays: recovers. */
  abandonLine: 0.3,
  abandonDays: 30,
  recoverLine: 0.45,
  recoverDays: 15,
  /** Buildings below this happiness complain. */
  complainLine: 0.6,
  /** Cost per tile to zone. */
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
  /**
   * Demand model (master plan §6.4, Demand v2). Shops follow residents; offices and industry
   * share whatever jobs the workforce could still fill, so no zone builds jobs nobody can staff.
   */
  shopJobsPerResident: 0.08,
  /** Share of new non-shop jobs that go to offices (the rest to industry). */
  officeJobShare: 0.35,
  /** Jobs wanted per worker (a little over 1, so there are always a few openings). */
  jobSlack: 1.05,
  /** Housing wanted per resident the jobs could employ (> 1 so the city keeps growing). */
  housingSlack: 1.15,
  /** Demand that a new town starts with: residents, shop jobs and industrial jobs. */
  seedHousing: 40,
  seedCommercialJobs: 6,
  seedIndustrialJobs: 20,
} as const;
