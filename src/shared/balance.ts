/** Tunable game-economy numbers. See docs/specs/roads.md. */
export const BALANCE = {
  startingFunds: 20_000,
  /** Cost per tile, by road type. */
  roadCost: 10,
  highwayCost: 40,
  /** Clearing cost per tree (a tile holds 1–3). */
  treeClearCost: 3,
  rocksClearCost: 6,
  boulderClearCost: 15,
  /** Small decorations (flowers, tall grass) clear for free. */
  minorDecorClearCost: 0,
} as const;
