/**
 * Headless simulation harness (docs/specs/engine.md, "Harness"): runs a city without rendering,
 * writes its monthly history as CSV and prints how long each system took.
 *
 *   bun run sim:run --scenario demo --years 2 --out history.csv
 *   bun run bench                    (demo, 1 year, budget check)
 *
 * Options: --scenario demo|blank  --preset <id>  --seed <n>  --size 64|128|256  --years <n>
 *          --out <file.csv>  --budget (report budgets)  --strict (exit 1 when over 1.5× budget)
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { BALANCE } from '../src/shared/balance';
import { City } from '../src/sim/City';
import { Simulation } from '../src/sim/core/Simulation';
import { SYSTEM_BUDGETS_MS, type SystemTiming } from '../src/sim/core/timings';
import { buildDemoCity } from '../src/sim/demo';
import { SAMPLE_COLUMNS, sampleCity, type CitySample } from '../src/sim/history';
import { isStage, Stage, STAGES } from '../src/sim/stages';
import { generateTerrain } from '../src/sim/terrain/generate';
import { PRESET_IDS, presetSettings, type PresetId } from '../src/sim/terrain/presets';

const SCENARIOS = ['demo', 'blank'] as const;
type Scenario = (typeof SCENARIOS)[number];

const { values: args } = parseArgs({
  options: {
    scenario: { type: 'string', default: 'demo' },
    preset: { type: 'string', default: 'riverValley' },
    seed: { type: 'string', default: '42' },
    size: { type: 'string', default: '128' },
    years: { type: 'string', default: '1' },
    out: { type: 'string' },
    budget: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
  },
});

function oneOf<T extends string>(value: string, allowed: readonly T[], what: string): T {
  const found = allowed.find((a) => a === value);
  if (!found) throw new Error(`unknown ${what} "${value}" (one of: ${allowed.join(', ')})`);
  return found;
}

const scenario: Scenario = oneOf(args.scenario, SCENARIOS, 'scenario');
const preset: PresetId = oneOf(args.preset, PRESET_IDS, 'preset');
const seed = Number(args.seed);
const size = Number(args.size);
const days = Math.round(Number(args.years) * 12 * BALANCE.daysPerMonth);

// ---------------------------------------------------------------- build

const t0 = performance.now();
const city = new City(generateTerrain(presetSettings(preset, seed, size)), scenario === 'demo' ? 1e9 : BALANCE.startingFunds);
if (scenario === 'demo') buildDemoCity(city, seed);
const sim = new Simulation(city);
sim.worldChanged({ roads: true });
const buildMs = performance.now() - t0;
sim.timings.reset();

// ---------------------------------------------------------------- run

const samples: CitySample[] = [sampleCity(sim)];
const t1 = performance.now();
// Through tick(), as the game runs it: the clock, hourly power, then whole days (D-068).
for (let d = 0; d < days; d++) {
  sim.runDays(1);
  if (sim.city.day % BALANCE.daysPerMonth === 0) samples.push(sampleCity(sim));
}
const runMs = performance.now() - t1;

// ---------------------------------------------------------------- report

if (args.out) {
  const rows = samples.map((s) => SAMPLE_COLUMNS.map((c) => (Number.isInteger(s[c]) ? s[c] : s[c].toFixed(4))).join(','));
  writeFileSync(args.out, [SAMPLE_COLUMNS.join(','), ...rows].join('\n') + '\n');
}

const last = samples[samples.length - 1];
const fmt = (n: number, d = 2) => n.toFixed(d).padStart(8);
console.log(`\n${scenario} · ${preset} seed ${seed} · ${size}×${size} · ${days} days`);
console.log(`build ${buildMs.toFixed(0)} ms · run ${(runMs / 1000).toFixed(1)} s · ${(runMs / Math.max(1, days)).toFixed(1)} ms/day`);
console.log(
  `end: day ${last.day} · population ${last.population.toLocaleString()} · ${last.buildings.toLocaleString()} buildings · ` +
    `happiness ${(last.happiness * 100).toFixed(0)}% · funds $${Math.round(last.funds).toLocaleString()}`,
);
console.log(
  `evolution: ${STAGES[isStage(last.stage) ? last.stage : Stage.Hamlet].name} · comfortable ${last.comfortable.toLocaleString()} · ` +
    `prosperous ${last.prosperous.toLocaleString()} residents · uncollected garbage ${last.garbage.toLocaleString()} t`,
);
if (args.out) console.log(`history: ${samples.length} monthly samples → ${args.out}`);

const timings: SystemTiming[] = sim.timings.snapshot();
let over = 0;
console.log(`\n${'system.hook'.padEnd(18)}${'avg ms'.padStart(8)}${'max ms'.padStart(8)}${'share'.padStart(8)}${args.budget || args.strict ? '  budget' : ''}`);
const total = timings.reduce((sum, t) => sum + t.totalMs, 0);
for (const t of timings) {
  const budget = SYSTEM_BUDGETS_MS[t.name];
  let status = '';
  if ((args.budget || args.strict) && budget !== undefined) {
    const ratio = t.avgMs / budget;
    status = ratio > 1.5 ? `  OVER ${budget} ms (${ratio.toFixed(1)}×)` : ratio > 1 ? `  near ${budget} ms` : `  ok (${budget} ms)`;
    if (ratio > 1.5) over++;
  }
  console.log(`${t.name.padEnd(18)}${fmt(t.avgMs)}${fmt(t.maxMs, 1)}${fmt((t.totalMs / total) * 100, 0)}%${status}`);
}
if (args.strict && over > 0) {
  console.error(`\n${over} system${over === 1 ? '' : 's'} over budget`);
  process.exit(1);
}
