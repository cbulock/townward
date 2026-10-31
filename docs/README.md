# Project Docs — Start Here

This folder is the single source of truth for the project. Before starting any
work session, read **Current Status** below, then the relevant spec.

## Current Status

| | |
|---|---|
| **Current phase** | Phases 0–7 built ✅ (latest: 7, core city: density, services, utilities, budget) plus the `/demo` city. Open: the 60 FPS check on real hardware |
| **Next phase** | Phase 8 — traffic overhaul (plan: foundation ✅ → traffic → needs → backend, D-057) |
| **Last updated** | 2026-10-31 |

## Run It

```bash
pnpm install
pnpm dev          # http://localhost:5173 opens the New Game screen; /demo opens a grown city
                  # (?seed=N&size=64|128|256&preset=coastal&funds=N skips it)
pnpm test         # unit tests
pnpm typecheck && pnpm lint
```

## Index

| Doc | What it covers |
|---|---|
| [01-vision.md](01-vision.md) | What we're building, design pillars, scope boundaries |
| [02-architecture.md](02-architecture.md) | Tech stack, folder layout, data model, rendering & performance strategy |
| [03-roadmap.md](03-roadmap.md) | All phases with task checklists — **the progress tracker** |
| [04-ui-ux.md](04-ui-ux.md) | Visual language, HUD layout, controls, "feel" rules |
| [specs/terrain.md](specs/terrain.md) | Terrain types, generator, new-game terrain picker |
| [specs/roads.md](specs/roads.md) | Road tool, auto-tiling, bulldozing, costs |
| [specs/buildings.md](specs/buildings.md) | Building catalog, footprints, placement; zoning and growth (planned) |
| [specs/simulation.md](specs/simulation.md) | Time, population, jobs, budget, traffic and pedestrians |
| [specs/elevation.md](specs/elevation.md) | Heights, sloped rendering, terraforming, borderlands |
| [specs/core.md](specs/core.md) | Time, density, services, utilities, budget (Phase 7) |
| [specs/demo.md](specs/demo.md) | The `/demo` showcase city |
| [decisions.md](decisions.md) | Decision log (why we chose X over Y) |
| [progress-log.md](progress-log.md) | Dated log of what got done each session |

## Working Agreement

1. **Docs first.** A feature gets a spec (or a spec update) before code.
2. **One phase at a time.** We finish and verify a phase before starting the next.
3. **Tick the boxes.** When a task lands, check it off in `03-roadmap.md` and add a line to `progress-log.md`.
4. **Record decisions.** Any non-obvious choice goes in `decisions.md` with the reason.
5. **Performance is a feature.** 60 FPS on a 128×128 map is a requirement in every phase, not a later polish step.
