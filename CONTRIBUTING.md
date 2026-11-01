# Contributing to Openpolis

Thanks for helping build Openpolis! This guide covers setup, how the project is organised, and what a pull request needs to get merged.

## Ways to help

- **Play and report bugs.** Open an issue with what you did, what you expected and what happened. Include your browser, and a screenshot or the city's seed (top bar) if you can.
- **Suggest features.** Open an issue describing what a player would do and why it would be fun. Check [docs/03-roadmap.md](docs/03-roadmap.md) and [docs/05-master-plan.md](docs/05-master-plan.md) first: it may already be planned.
- **Send code, art or docs.** Pick an issue (or open one first for anything large) and send a pull request.

## Setup

You need [Bun](https://bun.sh) 1.4+. Docker is optional (for accounts and cloud saves).

```bash
git clone https://github.com/subediaakash/sim.git openpolis
cd openpolis
bun install
docker compose up -d   # optional: Postgres
bun run dev            # http://localhost:5173  (/demo opens a grown city)
```

Use **bun** for everything; don't add npm, yarn or pnpm lockfiles.

## Before you write code

1. **Read [docs/README.md](docs/README.md).** It's the index of the design docs and has the current phase.
2. **Docs first.** A new feature gets a spec, or a change to an existing spec in `docs/specs/`, in the same pull request.
3. **Record non-obvious choices** in [docs/decisions.md](docs/decisions.md) as a new `D-0xx` entry: what was decided and why.
4. **Tick the roadmap** box in [docs/03-roadmap.md](docs/03-roadmap.md) when a task lands, and add a line to [docs/progress-log.md](docs/progress-log.md).

## Ground rules

- **The simulation is pure.** Nothing in `src/sim/` may import PixiJS, React, the DOM or `src/render|app|game` (lint enforces it). It must run headless and deterministically: same seed, same city.
- **60 FPS on a 128×128 map is a requirement**, not a polish step. If your change adds per-frame work, measure it (`F3` shows timings and draw calls; `bun run bench` checks the sim's budgets).
- **All art is procedural and original.** Buildings, trees, roads and effects are painted in code (`src/render/atlas/`). Never copy assets, sprites, names or designs from existing games.
- **Art is componentised.** One small module per family or part: `buildings/facades/`, `buildings/roofs/`, `nature/trees/`, `civic/parks/layouts/` and so on. Colours come from `theme/tokens.ts`, light from `core/light.ts`. Review art at `/src/dev/art.html` (`?rot=1` for all rotations).
- **The backend is layered.** `server/modules/<feature>/` holds `*.schemas` (zod), thin `*.routes`, `*.service` (rules, throws `HttpError`) and `*.repository` (SQL). Schema changes are new migrations appended in `server/db/migrations.ts`; never edit a released one.

## TypeScript

The code is strict, and types are part of the design:

- No `any` (use `unknown` and narrow), no `@ts-ignore`, and `@ts-expect-error` only with a reason.
- Avoid casts; prefer type guards, `satisfies` and narrowing. A rare `as unknown as X` needs a comment saying why it's safe.
- Enums are `as const` objects with a derived union type; variants are discriminated unions; shared data is `readonly`.
- Exported functions and anything crossing sim ↔ render ↔ UI get named types. Use `import type` for type-only imports.
- Code under `src/sim`, `src/shared`, `scripts` and `server` keeps to erasable syntax (no parameter properties, no enums), so it runs as plain TypeScript.

## Pull request checklist

- [ ] `bun run typecheck` and `bun run lint` pass with zero errors
- [ ] `bun run test` passes, with tests for new rules (sim tests in `tests/`, server tests next to their module)
- [ ] The spec, decision log, roadmap and progress log are updated where relevant
- [ ] Visual changes include a before/after screenshot in the PR description
- [ ] Performance-sensitive changes say how they were measured

Commit messages follow the style already in the history: `feat: …`, `fix: …`, `refactor: …`, `docs: …`.

## License

Openpolis is [MIT licensed](LICENSE). By sending a pull request, you agree that your contribution is released under the same license.

## Writing style

Docs, comments and in-game text are plain and direct: short sentences, everyday words, one idea per sentence. Explain *why* in comments, not *what*.
