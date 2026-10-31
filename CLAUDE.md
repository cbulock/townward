# CLAUDE.md

Browser city-builder (original game in the city-sim genre). TypeScript + Vite + PixiJS v8 + React HUD + Jotai. Package manager: **pnpm** (never npm/yarn).

Commands: `pnpm dev` · `pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm build`

**Start every session by reading `docs/README.md`.** It holds the current phase, the index and the working agreement.

- Progress tracker: `docs/03-roadmap.md` (tick boxes as tasks land)
- Log each session in `docs/progress-log.md`; record non-obvious choices in `docs/decisions.md`
- `src/sim/` must stay free of Pixi/React/DOM imports
- All art is procedurally generated; never copy assets or designs from existing games
- 60 FPS on a 128×128 map is a hard requirement

## Types (write them carefully)

TypeScript runs in `strict` mode, and types are part of the design, not an afterthought.

- **No `any`.** Use `unknown` and narrow it, use generics, or model the real shape. ESLint errors on explicit `any`.
- **No silencing the checker:** no `@ts-ignore` or `@ts-nocheck`. `@ts-expect-error` is allowed only with a description of why.
- **Casts are a last resort.** Prefer type guards, `satisfies` and narrowing over `as`. Never use `as unknown as X` without a comment explaining why it is safe. The non-null `!` is only for invariants that are truly guaranteed (e.g. `getElementById('root')`).
- **Model the domain precisely:**
  - Use `as const` objects plus derived union types for enums (see `sim/terrain/types.ts`).
  - Use discriminated unions for variants (tools, commands, events).
  - Use `readonly` for data that must not change.
- **Explicit types at boundaries.** Exported functions, class public APIs, event payloads (`game/events.ts`) and anything crossing sim ↔ render ↔ UI get named interfaces. Inference is fine for locals.
- **Type-only imports** use `import type` (enforced by `verbatimModuleSyntax`).
- `pnpm typecheck` and `pnpm lint` must pass with zero errors before a task counts as done.
