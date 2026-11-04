import { BALANCE } from '../shared/balance';
import { BUILDINGS, buildingDef, Lifestyle, LIFESTYLE_NAMES, SERVICE_KINDS, type BuildingDef, type BuildingInstance } from '../sim/buildings/catalog';
import type { Simulation } from '../sim/core/Simulation';
import { Stage } from '../sim/stages';
import { serviceBit } from '../sim/systems/coverage';
import { riseBlocker } from '../sim/systems/lifestyle';
import { COMPLAINT_TEXT, NEED_KINDS } from '../sim/systems/needs';
import { isWorking, needsUtilities } from '../sim/systems/utilities';
import { platformOf } from '../sim/rail';
import type { InspectInfo } from './events';

/**
 * What the info panel shows for a building (app/hud/InfoPanel.tsx), read from the simulation.
 * Pure: the Game only decides which building is selected and when to send it.
 */
export function inspectInfo(sim: Simulation, b: BuildingInstance): InspectInfo {
  const d: BuildingDef = BUILDINGS[b.def];
  return {
    id: b.id,
    name: d.name,
    category: d.category,
    level: d.level,
    wealth: d.wealth ?? 'everyday',
    investorValue: d.investorValue ?? 0,
    description: d.description,
    occupants: b.occupants,
    capacity: d.capacity,
    occupantLabel: d.category === 'residential' ? 'Residents' : 'Workers',
    hasRoad: b.entrance !== -1,
    size: d.size,
    grown: b.grown,
    constructionDays: b.construction,
    needsUtilities: needsUtilities(d),
    powered: b.powered,
    watered: b.watered,
    services: d.category === 'civic' ? [] : SERVICE_KINDS.filter((k) => b.services & serviceBit(k)),
    provides: d.service
      ? { kind: 'service', service: d.service, radius: d.radius ?? 0 }
      : d.supplies || d.energy || d.substation
        ? {
            kind: 'utility',
            ...d.supplies,
            coverage: d.energy?.coverage ?? d.substation?.radius,
            condition: d.energy && d.energy.source !== 'battery' ? b.condition : undefined,
            repairCost: d.energy?.repairCost,
          }
        : null,
    powerIssue: powerIssue(sim, b),
    condition: d.energy && d.energy.source !== 'battery' ? b.condition : null,
    repairDays: b.repairDays,
    repairCost: d.energy?.repairCost ?? 0,
    upkeep: d.upkeep ?? 0,
    commuteMinutes: d.category === 'residential' ? (sim.commute.commuteMinutes.get(b.id) ?? null) : null,
    needs: needsInfo(sim, b.id),
    abandoned: b.abandoned,
    lifestyle: d.category === 'residential' ? lifestyleInfo(b, sim.city.stage) : null,
    garbage: d.category !== 'civic' && sim.city.stage >= Stage.Village ? b.garbage : null,
    facility: d.garbage
      ? {
          collectedToday: sim.garbage.collectedToday.get(b.id) ?? 0,
          trucks: d.garbage.trucks,
          filled: d.garbage.holds === undefined ? null : b.filled,
          holds: d.garbage.holds ?? null,
        }
      : null,
    aqi: Math.round(sim.air.aqiOf(b)),
    taxesWaiting: b.def === 'town_hall' && sim.city.collectsTaxes ? Math.round(sim.city.uncollected) : null,
    station: d.railStation ? { riders: Math.round(sim.commute.stationRiders.get(b.id) ?? 0), onTrack: platformOf(sim.world, b) !== -1 } : null,
  };
}

/** A home's lifestyle tier and, in plain words, what moves it next. */
function lifestyleInfo(b: BuildingInstance, stage: Stage): InspectInfo['lifestyle'] {
  const tier = LIFESTYLE_NAMES[b.lifestyle];
  const days = BALANCE.lifeDays;
  if (b.lifeDays > 0) return { tier, note: `Moving up: ${b.lifeDays} / ${days} good days` };
  if (b.lifeDays < 0) return { tier, note: `Slipping: ${-b.lifeDays} / ${days} unhappy days` };
  if (b.lifestyle === Lifestyle.Prosperous) return { tier, note: 'The best lifestyle in the city' };
  const blocker = riseBlocker(b, stage);
  if (blocker) return { tier, note: `To move up it needs ${blocker}` };
  return { tier, note: `Moves up after ${days} days at ${Math.round(BALANCE.lifeUpLine * 100)}% happiness or more` };
}

function needsInfo(sim: Simulation, id: number): InspectInfo['needs'] {
  const n = sim.needs.byBuilding.get(id);
  if (!n) return null;
  return {
    happiness: n.happiness,
    scores: NEED_KINDS.flatMap((kind) => {
      const score = n.scores[kind];
      return score === undefined ? [] : [{ kind, score }];
    }),
    complaint: n.complaint ? COMPLAINT_TEXT[n.complaint] : null,
  };
}

/** Why a building has no power, with the numbers behind it. */
function powerIssue(sim: Simulation, b: BuildingInstance): InspectInfo['powerIssue'] {
  const d: BuildingDef = buildingDef(b.def);
  if (d.category === 'civic' || b.powered) return null;
  if (b.entrance === -1) return { reason: 'No road access', stats: [{ label: 'Required', value: 'A connected road within 3 tiles' }] };
  const report = sim.utilities.report.power;
  const substations = [...sim.world.buildings.values()].filter((s) => buildingDef(s.def).substation && isWorking(s));
  if (substations.length > 0) {
    const connected = substations.some((s) => {
      const sd = buildingDef(s.def).substation;
      const cx = b.x + d.size.w / 2;
      const cy = b.y + d.size.h / 2;
      return sd !== undefined && Math.hypot(s.x + 0.5 - cx, s.y + 0.5 - cy) <= sd.radius;
    });
    if (!connected) {
      return {
        reason: 'Outside substation coverage',
        stats: [{ label: 'Coverage', value: 'Move closer to a connected GRID substation' }],
      };
    }
  }
  return {
    reason: report.supply < report.demand ? 'Not enough generation' : 'Power already taken by other buildings',
    stats: [
      { label: 'Demand', value: report.demand.toLocaleString() },
      { label: 'Available', value: report.supply.toLocaleString() },
      { label: 'Short', value: report.short.toLocaleString() },
    ],
  };
}
