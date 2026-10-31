# CLAUDE.md

Browser city-builder (original game in the city-sim genre). TypeScript + Vite + PixiJS v8 + React HUD + Jotai. Package manager: **pnpm** (never npm/yarn).

Commands: `pnpm dev` · `pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm build`

**Start every session by reading `docs/README.md`.** It holds the current phase, the index and the working agreement.

- Progress tracker: `docs/03-roadmap.md` (tick boxes as tasks land)
- Log each session in `docs/progress-log.md`; record non-obvious choices in `docs/decisions.md`
- `src/sim/` must stay free of Pixi/React/DOM imports
- All art is procedurally generated; never copy assets or designs from existing games
- 60 FPS on a 128×128 map is a hard requirement
