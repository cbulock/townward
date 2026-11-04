import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/shared/balance';
import { Lifestyle } from '../src/sim/buildings/catalog';
import { City } from '../src/sim/City';
import { applyPlace, applyRoad, planPlace, planRoad } from '../src/sim/commands';
import { refreshCity, Simulation } from '../src/sim/core/Simulation';
import { emptyOutcome } from '../src/sim/core/System';
import { roadPath, RoadType } from '../src/sim/roads';
import { deserialize, parseSave, serialize } from '../src/sim/save';
import { Stage, stageFor } from '../src/sim/stages';
import { monthlyBudget } from '../src/sim/systems/budget';
import { garbageDay, garbageScore } from '../src/sim/systems/garbage';
import { lifestyleDay } from '../src/sim/systems/lifestyle';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

/** A 40×40 town: one road along y = 20, with power and water at the east end. */
function town(locked = false) {
  const w = new World(40, 40, 3);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1e9);
  city.locked = locked;
  applyRoad(city, planRoad(w, roadPath({ x: 0, y: 20 }, { x: 39, y: 20 }, true), RoadType.Road), RoadType.Road);
  const place = (id: Parameters<typeof planPlace>[1], x: number, y: number) => applyPlace(city, planPlace(w, id, x, y), 0);
  place('power_plant', 36, 21);
  place('water_tower', 35, 21);
  return { w, city, place };
}

const only = (w: World, def: string) => [...w.buildings.values()].find((b) => b.def === def)!;

describe('city stages (docs/specs/evolution.md, E0)', () => {
  it('maps population to stages', () => {
    expect(stageFor(0)).toBe(Stage.Hamlet);
    expect(stageFor(499)).toBe(Stage.Hamlet);
    expect(stageFor(500)).toBe(Stage.Village);
    expect(stageFor(10_000)).toBe(Stage.City);
    expect(stageFor(1e6)).toBe(Stage.Metropolis);
  });

  it('a locked city refuses buildings above its stage, and allows them once it climbs', () => {
    const { w, city, place } = town(true);
    expect(place('hospital', 10, 22)).toMatchObject({ ok: false, reason: 'locked' });
    expect(place('park', 10, 22).ok).toBe(true);
    city.stage = Stage.Town;
    expect(place('hospital', 14, 23).ok).toBe(true);
    expect(only(w, 'hospital')).toBeDefined();
  });

  it('climbs with population on a new day and never drops back', () => {
    const { w, city, place } = town(true);
    for (let x = 0; x < 30; x++) place('walkup', x, 19);
    for (const b of w.buildings.values()) if (b.def === 'walkup') b.occupants = 24;
    const sim = new Simulation(city);
    sim.worldChanged({ roads: true });
    const out = sim.day();
    expect(city.stage).toBe(Stage.Village);
    expect(out.stage).toBe(Stage.Village);
    for (const b of w.buildings.values()) b.occupants = 0;
    sim.day();
    expect(city.stage).toBe(Stage.Village);
  });
});

describe('lifestyle (E1)', () => {
  it('a happy home in a Town becomes Comfortable after a month, then asks for a hospital', () => {
    const { w, city, place } = town();
    place('walkup', 4, 19);
    refreshCity(w);
    const home = only(w, 'walkup');
    home.occupants = 20;
    home.happiness = 0.9;
    // Not before the city is a Town.
    for (let d = 0; d < BALANCE.lifeDays + 2; d++) lifestyleDay(city);
    expect(home.lifestyle).toBe(Lifestyle.Basic);

    city.stage = Stage.Town;
    const out = emptyOutcome();
    for (let d = 0; d < BALANCE.lifeDays; d++) lifestyleDay(city, out);
    expect(home.lifestyle).toBe(Lifestyle.Comfortable);
    expect(out.lifestyle).toBe(Lifestyle.Comfortable);

    // A content neighbourhood (services, shops, jobs, parks): it isn't complaining, but it asks.
    place('police_station', 5, 21);
    place('fire_station', 6, 21);
    place('clinic', 7, 21);
    place('school', 8, 21);
    place('corner_shop', 10, 21);
    place('small_office', 11, 21);
    place('park', 3, 19);
    place('park', 2, 19);
    const sim = new Simulation(city);
    sim.worldChanged({ roads: true });
    for (let d = 0; d < 10; d++) sim.day();
    const needs = sim.needs.byBuilding.get(home.id);
    expect(needs?.scores.hospital).toBe(0);
    expect(needs?.happiness).toBeGreaterThan(BALANCE.complainLine);
    expect(needs?.complaint).toBe('hospital');
  });

  it('Comfortable homes pay more tax; a long unhappy spell moves them back down', () => {
    const { w, city, place } = town();
    place('walkup', 4, 19);
    refreshCity(w);
    const home = only(w, 'walkup');
    home.occupants = 20;
    const basic = monthlyBudget(w).income;
    home.lifestyle = Lifestyle.Comfortable;
    expect(monthlyBudget(w).income).toBeGreaterThan(basic);

    home.happiness = 0.2;
    for (let d = 0; d < BALANCE.lifeDays; d++) lifestyleDay(city);
    expect(home.lifestyle).toBe(Lifestyle.Basic);
  });

  it('a hospital also counts as a clinic', () => {
    const { w, place } = town();
    place('walkup', 4, 19);
    place('hospital', 8, 22);
    refreshCity(w);
    const home = only(w, 'walkup');
    const sim = new Simulation(new City(w));
    sim.worldChanged({ roads: false });
    expect(sim.needs.byBuilding.get(home.id)?.scores.health).toBe(1);
  });
});

describe('garbage (E2)', () => {
  it('piles up from the Village stage, and a landfill in reach collects it', () => {
    const { w, city, place } = town();
    place('walkup', 4, 19);
    refreshCity(w);
    const home = only(w, 'walkup');
    home.occupants = 24;

    garbageDay(city);
    expect(home.garbage).toBe(0); // a hamlet makes none

    city.stage = Stage.Village;
    for (let d = 0; d < BALANCE.garbageDays; d++) garbageDay(city);
    expect(home.garbage).toBeCloseTo(24 * BALANCE.garbagePerResident * BALANCE.garbageDays);
    expect(garbageScore(home)).toBeCloseTo(0);

    place('landfill', 10, 22);
    refreshCity(w);
    const r = garbageDay(city);
    expect(home.garbage).toBe(0);
    expect(r.collected).toBeGreaterThan(0);
    expect(only(w, 'landfill').filled).toBeCloseTo(r.collected);
    expect(garbageScore(home)).toBe(1);
  });

  it('a full landfill stops collecting', () => {
    const { w, city, place } = town();
    city.stage = Stage.Village;
    place('walkup', 4, 19);
    place('landfill', 10, 22);
    refreshCity(w);
    only(w, 'walkup').occupants = 24;
    only(w, 'landfill').filled = 8000;
    garbageDay(city);
    expect(only(w, 'walkup').garbage).toBeGreaterThan(0);
  });
});

describe('saving evolution state', () => {
  it('keeps stage, lock, lifestyle, streaks and garbage', () => {
    const { w, city, place } = town(true);
    city.stage = Stage.Town;
    place('walkup', 4, 19);
    place('landfill', 10, 22);
    const home = only(w, 'walkup');
    home.lifestyle = Lifestyle.Comfortable;
    home.lifeDays = -4;
    home.garbage = 1.3;
    only(w, 'landfill').filled = 420;
    const terrain = { preset: 'plains', seed: 3, size: 40, water: 0, trees: 0, rivers: 0, coastSides: 0 } as const;
    const loaded = deserialize(parseSave(JSON.parse(JSON.stringify(serialize(city, terrain, 'Evo')))));
    expect(loaded.stage).toBe(Stage.Town);
    expect(loaded.locked).toBe(true);
    const h = only(loaded.world, 'walkup');
    expect(h.lifestyle).toBe(Lifestyle.Comfortable);
    expect(h.lifeDays).toBe(-4);
    expect(h.garbage).toBeCloseTo(1.3);
    expect(only(loaded.world, 'landfill').filled).toBe(420);
  });
});
