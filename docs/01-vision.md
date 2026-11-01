# 01 — Vision

## One-liner

A browser-based, 2D isometric **city-building simulation** in the classic genre.
Players shape terrain, lay roads, zone land and watch a city grow. It should feel
buttery-smooth and look modern.

> **Name:** **Openpolis**, at [openpolis.space](https://openpolis.space) (D-001). The repo
> folder stays `simcity-web`.

## Originality Boundary

We are building an **original game in the city-builder genre**, not a copy of an
existing title.

- ✅ Genre mechanics are fair game: grid map, terrain, roads, R/C/I zoning, buildings that grow, power/water networks, budget, demand, traffic, disasters.
- ✅ All art is **our own**, generated procedurally in code (tile atlas built at runtime).
- ❌ No copied sprites, UI layouts, building designs, names, sounds or exact formulas from any existing game.

## Design Pillars

1. **Smooth above all.** 60 FPS pan/zoom and instant tool feedback. No hitching when the city grows.
2. **Cool, modern UI.** Glassy floating panels, crisp icons, micro-animations and satisfying placement feedback. See [04-ui-ux.md](04-ui-ux.md).
3. **Generated world.** Terrain and tile art come from code (seeded), so every map is unique and reproducible.
4. **Readable city.** At any zoom you can tell roads, zones and buildings apart at a glance.
5. **Step by step.** Each phase is shippable and playable.

## Scope: First Milestone ("Roads & Buildings")

The first playable build covers:

- A **new-game screen** where the player picks the terrain (preset + seed + sliders) and sees a live preview.
- An isometric map with smooth camera controls.
- **Road** building with drag-to-place, auto-connecting pieces and bulldozing.
- **Zoning** (Residential / Commercial / Industrial) with **buildings that grow** next to roads.
- A few **placeable buildings** (e.g. power plant, park).
- A basic money counter, because building costs money.

Out of scope for the first milestone: power/water networks, traffic simulation,
budgets/taxes, disasters, elevation/terraforming, save/load. These come in later
phases (see [03-roadmap.md](03-roadmap.md)).

## Target Platforms

- Desktop browsers first (Chrome, Firefox, Safari, Edge) with mouse + keyboard.
- Touch/trackpad gestures should work (pinch-zoom, two-finger pan), but the full mobile UI comes later.
