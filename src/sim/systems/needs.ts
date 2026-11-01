import { BALANCE } from '../../shared/balance';
import { BUILDINGS, type BuildingDef, type BuildingInstance } from '../buildings/catalog';
import type { DayOutcome, SimSystem } from '../core/System';
import { RoadType } from '../roads';
import type { World } from '../World';
import { isActive } from './access';
import type { CommuteSystem } from './commute';
import { serviceBit } from './coverage';
import { cityStats } from './population';

/**
 * Needs system (docs/specs/needs.md): every finished, connected zoned building scores its
 * needs (jobs, shopping, safety, health, education, commute, clean air, parks; workers and
 * customers for businesses). Their weighted average is its happiness, which sets how full
 * it gets, gates levelling up and, after a long unhappy spell, abandons it. Unhappy buildings
 * complain about their worst need.
 */

export type NeedKind = 'jobs' | 'shopping' | 'safety' | 'health' | 'education' | 'commute' | 'air' | 'parks' | 'workers' | 'customers';

export const NEED_KINDS: readonly NeedKind[] = ['jobs', 'shopping', 'safety', 'health', 'education', 'commute', 'air', 'parks', 'workers', 'customers'];

/** Complaint shown for a need, plus one for abandoned buildings. */
export type ComplaintKind = NeedKind | 'abandoned';

export const COMPLAINT_TEXT: Readonly<Record<ComplaintKind, string>> = {
  jobs: 'There are no jobs for us',
  shopping: 'Nowhere to shop around here',
  safety: "We don't feel safe: build police and fire stations",
  health: 'We need a clinic nearby',
  education: 'We need a school nearby',
  commute: 'The commute is terrible',
  air: 'Too much smoke and noise',
  parks: 'No parks to enjoy',
  workers: "We can't find workers",
  customers: 'Not enough customers',
  abandoned: 'This place is abandoned',
};

/** Need weights per kind of building (they sum to 1). */
const WEIGHTS = {
  residential: { jobs: 0.2, safety: 0.15, commute: 0.13, shopping: 0.12, air: 0.12, health: 0.1, education: 0.1, parks: 0.08 },
  commercial: { workers: 0.35, safety: 0.25, customers: 0.25, air: 0.15 },
  industrial: { workers: 0.6, safety: 0.4 },
} as const satisfies Record<string, Partial<Record<NeedKind, number>>>;

const RADIUS = { shopping: 12, customers: 12, pollution: 6, parks: 6, highway: 2 } as const;
/** Pollution weight per source at distance 0 (it falls off linearly to the radius). */
const POLLUTERS: Readonly<Record<string, number>> = { workshop: 0.25, warehouse: 0.35, factory: 0.7, power_plant: 0.8 };

/** One building's needs (only the ones it has) and the result. */
export interface BuildingNeeds {
  scores: Partial<Record<NeedKind, number>>;
  happiness: number;
  /** Worst need when unhappy enough to complain, or 'abandoned'. */
  complaint: ComplaintKind | null;
}

export interface Complaint {
  kind: ComplaintKind;
  text: string;
  /** Buildings sharing this complaint. */
  count: number;
  /** The unhappiest of them (for "Show me"). */
  building: number;
  x: number;
  y: number;
}

export interface NeedsReport {
  /** Resident-weighted average happiness of homes (0..1); 1 with no residents. */
  happiness: number;
  abandoned: number;
  /** Most common complaints first, at most 4. */
  complaints: Complaint[];
}

function needWeights(def: BuildingDef): Partial<Record<NeedKind, number>> | null {
  if (def.category === 'residential') return WEIGHTS.residential;
  if (def.category === 'commercial') return WEIGHTS.commercial;
  if (def.category === 'industrial') return WEIGHTS.industrial;
  return null;
}

const centre = (b: BuildingInstance) => {
  const s = BUILDINGS[b.def].size;
  return { x: b.x + s.w / 2, y: b.y + s.h / 2 };
};

export class NeedsSystem implements SimSystem {
  readonly name = 'needs';
  /** Per building id: its scores, happiness and complaint. */
  readonly byBuilding = new Map<number, BuildingNeeds>();
  report: NeedsReport = { happiness: 1, abandoned: 0, complaints: [] };

  private readonly world: World;
  private readonly commute: CommuteSystem | null;

  constructor(world: World, commute: CommuteSystem | null = null) {
    this.world = world;
    this.commute = commute;
  }

  /** Re-score after edits (so placing a clinic shows up straight away). */
  onWorldChanged() {
    this.score();
  }

  /** Daily: re-score, then move the abandonment streaks on by one day. Buildings that flip are redrawn. */
  onDay(out?: DayOutcome) {
    this.score();
    for (const b of this.world.buildings.values()) {
      if (!this.byBuilding.has(b.id)) continue;
      const was = b.abandoned;
      if (!b.abandoned) {
        b.moodDays = b.happiness < BALANCE.abandonLine ? b.moodDays + 1 : 0;
        if (b.moodDays >= BALANCE.abandonDays) {
          b.abandoned = true;
          b.moodDays = 0;
          b.occupants = 0;
        }
      } else {
        b.moodDays = b.happiness >= BALANCE.recoverLine ? b.moodDays + 1 : 0;
        if (b.moodDays >= BALANCE.recoverDays) {
          b.abandoned = false;
          b.moodDays = 0;
        }
      }
      if (b.abandoned !== was && out) {
        const { w, h } = BUILDINGS[b.def].size;
        out.changed.push({ x: b.x, y: b.y, w, h });
        (b.abandoned ? out.abandoned : out.recovered).push(b.id);
      }
    }
    this.score();
  }

  /** Score every working zoned building's needs and set its happiness. */
  score() {
    const w = this.world;
    const all = [...w.buildings.values()];
    const stats = cityStats(w);
    const workforce = stats.population * BALANCE.workforceShare;
    const jobCover = workforce === 0 ? 1 : Math.min(1, stats.jobs / workforce);
    const workerShare = stats.jobs === 0 ? 1 : Math.min(1, stats.workers / stats.jobs);
    const police = serviceBit('police');
    const fire = serviceBit('fire');
    const health = serviceBit('health');
    const education = serviceBit('education');

    // Places that matter to neighbours, with their centres.
    const shops: { x: number; y: number; jobs: number }[] = [];
    const homes: { x: number; y: number; people: number }[] = [];
    const polluters: { x: number; y: number; weight: number }[] = [];
    const parks: { x: number; y: number }[] = [];
    for (const b of all) {
      const d: BuildingDef = BUILDINGS[b.def];
      const c = centre(b);
      if (POLLUTERS[b.def] && b.construction === 0) polluters.push({ ...c, weight: POLLUTERS[b.def] });
      if (!isActive(b) || b.abandoned) continue;
      if (d.category === 'commercial') shops.push({ ...c, jobs: d.capacity });
      if (d.category === 'residential') homes.push({ ...c, people: b.occupants });
      if (d.group === 'parks') parks.push(c);
    }
    const near = (c: { x: number; y: number }, p: { x: number; y: number }, r: number) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= r * r;

    this.byBuilding.clear();
    for (const b of all) {
      const d: BuildingDef = BUILDINGS[b.def];
      const weights = needWeights(d);
      if (!weights || !isActive(b)) continue;
      const c = centre(b);
      const scores: Partial<Record<NeedKind, number>> = {};
      const kinds = NEED_KINDS.filter((k) => weights[k] !== undefined);
      for (const kind of kinds) {
        scores[kind] = this.needScore(kind, b, {
          jobCover,
          workerShare,
          safety: (b.services & police ? 0.6 : 0) + (b.services & fire ? 0.4 : 0),
          health: b.services & health ? 1 : 0,
          education: b.services & education ? 1 : 0,
          shops: () => shops.filter((s) => near(c, s, RADIUS.shopping)).reduce((n, s) => n + s.jobs, 0),
          residents: () => homes.filter((h) => near(c, h, RADIUS.customers)).reduce((n, h) => n + h.people, 0),
          parks: () => parks.filter((p) => near(c, p, RADIUS.parks)).length,
          pollution: () => {
            let p = 0;
            for (const s of polluters) {
              const dist = Math.hypot(s.x - c.x, s.y - c.y);
              if (dist < RADIUS.pollution) p += s.weight * (1 - dist / RADIUS.pollution);
            }
            return p + this.highwayNoise(b);
          },
        });
      }
      let happiness = 0;
      let worst: NeedKind | null = null;
      let worstShortfall = 0;
      for (const kind of kinds) {
        const weight = weights[kind] ?? 0;
        const s = scores[kind] ?? 1;
        happiness += weight * s;
        const shortfall = weight * (1 - s);
        if (shortfall > worstShortfall) {
          worstShortfall = shortfall;
          worst = kind;
        }
      }
      b.happiness = happiness;
      const complaint: ComplaintKind | null = b.abandoned ? 'abandoned' : happiness < BALANCE.complainLine ? worst : null;
      this.byBuilding.set(b.id, { scores, happiness, complaint });
    }
    this.summarise();
  }

  private needScore(
    kind: NeedKind,
    b: BuildingInstance,
    ctx: {
      jobCover: number;
      workerShare: number;
      safety: number;
      health: number;
      education: number;
      shops: () => number;
      residents: () => number;
      parks: () => number;
      pollution: () => number;
    },
  ): number {
    switch (kind) {
      case 'jobs': {
        // No reachable job at all (no commute route) means no jobs, whatever the city has.
        const reachable = !this.commute || this.commute.commuteMinutes.has(b.id) || b.occupants === 0;
        return reachable ? ctx.jobCover : 0;
      }
      case 'shopping':
        return Math.min(1, ctx.shops() / 20);
      case 'safety':
        return ctx.safety;
      case 'health':
        return ctx.health;
      case 'education':
        return ctx.education;
      case 'commute': {
        const m = this.commute?.commuteMinutes.get(b.id);
        if (m === undefined) return 0.5;
        return Math.max(0, Math.min(1, 1 - (m - 15) / 45));
      }
      case 'air':
        return Math.max(0, 1 - ctx.pollution());
      case 'parks':
        return Math.min(1, ctx.parks() / 2);
      case 'workers':
        return ctx.workerShare;
      case 'customers':
        return Math.min(1, ctx.residents() / 200);
    }
  }

  /** Noise from highway tiles within RADIUS.highway of the footprint (0.05 each, at most 0.4). */
  private highwayNoise(b: BuildingInstance): number {
    const w = this.world;
    const { w: bw, h: bh } = BUILDINGS[b.def].size;
    const r = RADIUS.highway;
    let n = 0;
    for (let y = b.y - r; y < b.y + bh + r; y++) {
      for (let x = b.x - r; x < b.x + bw + r; x++) {
        if (w.inBounds(x, y) && w.road[w.index(x, y)] === RoadType.Highway) n++;
      }
    }
    return Math.min(0.4, n * 0.05);
  }

  /** City happiness and the top complaints. */
  private summarise() {
    let people = 0;
    let weighted = 0;
    let abandoned = 0;
    const groups = new Map<ComplaintKind, { count: number; worst: BuildingInstance | null }>();
    for (const b of this.world.buildings.values()) {
      if (b.abandoned) abandoned++;
      const n = this.byBuilding.get(b.id);
      if (!n) continue;
      if (BUILDINGS[b.def].category === 'residential' && b.occupants > 0) {
        people += b.occupants;
        weighted += b.occupants * n.happiness;
      }
      if (!n.complaint) continue;
      const g = groups.get(n.complaint) ?? { count: 0, worst: null };
      g.count++;
      if (!g.worst || b.happiness < g.worst.happiness) g.worst = b;
      groups.set(n.complaint, g);
    }
    const complaints: Complaint[] = [];
    for (const [kind, g] of groups) {
      if (!g.worst) continue;
      const c = centre(g.worst);
      complaints.push({ kind, text: COMPLAINT_TEXT[kind], count: g.count, building: g.worst.id, x: c.x, y: c.y });
    }
    complaints.sort((a, b) => b.count - a.count);
    this.report = { happiness: people === 0 ? 1 : weighted / people, abandoned, complaints: complaints.slice(0, 4) };
  }
}
