<div align="center">

# ◆ Openpolis

**Build the city. Then let it live.**

A free, open-world city simulation that runs in your browser. No download, no install.

### [▶ Play now at openpolis.space](https://openpolis.space)

[![MIT License](https://img.shields.io/badge/license-MIT-f0b23e.svg)](LICENSE)

![An Openpolis city by day: glass towers, apartment blocks, parks and busy streets](docs/images/day.jpg)

</div>

## What it is

Openpolis is a browser-based open-world city simulation where players build and govern cities inhabited by autonomous AI agents. Unlike traditional city builders, where most systems follow predetermined rules, Openpolis aims to create a world that evolves through independent decisions made by AI-driven governments, citizens, workers and economic systems.

Players shape cities, establish governments, manage resources, influence economies, form trade relationships, and eventually face political conflicts and wars. But they won't have complete control over what happens: the world has its own dynamics, and the decisions of its inhabitants can create unexpected consequences. You don't just build a city, you become part of a living world.

**Where it is today.** The foundation is a full city builder, playable now. The autonomous agents, governments, trade and politics are being built in the open and land in updates, one system at a time.

### Playable now

- **Grow a city that runs itself.** Paint residential, commercial and industrial zones along your roads. Homes, shops, offices and factories grow when there's demand, and upgrade from cottages to towers as land value rises.
- **Be the mayor.** Power plants, water towers, substations and batteries; schools, clinics, police and fire stations; taxes, upkeep and a budget that has to balance.
- **Citizens with opinions.** People tell you what their street is missing ("we need a clinic nearby", "too much smoke and noise"), and unhappy neighbourhoods empty out.
- **Real traffic.** Commuters drive the roads you build, jams form at rush hour, and streets, avenues, boulevards and expressways each carry a different load.
- **A city that's alive.** Trees sway in the wind, fountains spray, birds cross the sky, smoke drifts from chimneys, and at dusk the windows light up one by one.
- **Shape the land.** Rivers, coasts, islands and hills, with a new map every time, or pick your seed.
- **Your cities are saved.** As a guest they save on your device; with a free account they save to the cloud and open in any browser.

![The same city at night, with lit windows and blinking beacons](docs/images/night.jpg)

Every building, tree and street is drawn by code at load time: there are no image assets, and the art is original.

## Run it locally

You need [Bun](https://bun.sh) 1.4+ and, for accounts and cloud saves, Docker.

```bash
git clone https://github.com/subediaakash/openpolis.git
cd openpolis
bun install
docker compose up -d     # Postgres for accounts and cloud saves (optional)
bun run dev              # http://localhost:5173
```

Without Postgres the game still runs and saves on your device. Open `http://localhost:5173/demo` for a fully grown city.

| Command | What it does |
|---|---|
| `bun run dev` | The game (Vite) and the save server, together |
| `bun run test` | Unit tests (the server's use an in-process Postgres, no Docker needed) |
| `bun run typecheck` · `bun run lint` | Strict TypeScript and ESLint, both must pass |
| `bun run build` | Production build into `dist/` |
| `bun run sim:run --scenario demo --years 1` | Run the simulation headless and print per-system timings |

## How it's built

TypeScript throughout: **PixiJS 8** draws the world, **React** and **Jotai** the interface, and a small **Express + Postgres** server keeps accounts and saves. Bun runs the tooling and the server.

```
src/sim/       the simulation: pure TypeScript, no rendering or DOM (runs headless too)
src/render/    PixiJS renderer: chunked terrain, procedural art atlas, ambient life
src/app/       React interface: landing page, HUD, panels, account flow
src/game/      glue between input, simulation and rendering
server/        save server: auth, cloud saves, rate limits (config → db → http → modules)
docs/          design docs, specs, decision log, roadmap
```

The design docs start at [docs/README.md](docs/README.md): vision, architecture, every system's spec, and a log of why things are the way they are.

## Deploy your own

One Docker image serves the game and the API; it needs Postgres. See [docs/deploy.md](docs/deploy.md) for a step-by-step VPS guide.

## Contributing

Bug reports, ideas and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) to get set up and to see how the project works.

## License

The code is released under the [MIT License](LICENSE): use it, change it, build on it.

The name **Openpolis** and its logo aren't covered by the license. If you run your own fork publicly, please give it a different name so players can tell it apart from openpolis.space.

## Credits

Openpolis is an original game inspired by the classic city builders of the 90s and 2000s. It is not affiliated with, endorsed by or connected to Electronic Arts, Maxis or any other publisher; it uses none of their code, art or assets.
