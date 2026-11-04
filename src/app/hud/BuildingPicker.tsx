import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { buildingFrameSize, paintBuilding } from '../../render/atlas/buildings';
import { BUILDINGS, PLACEABLE_IDS, type BuildingDef, type BuildingId, type CivicGroup } from '../../sim/buildings/catalog';
import type { ZoneToolId } from '../../game/tools';
import { STAGES, unlockStage } from '../../sim/stages';
import { activeToolAtom, buildingChoiceAtom, cityAtom, fundsAtom, gameAtom } from '../atoms';

const THUMB = 64;

/** Paints the building with the same code as the in-game atlas, scaled to fit the card. */
function BuildingThumb({ id }: { id: BuildingId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const f = buildingFrameSize(id);
    const scale = Math.min(THUMB / f.w, THUMB / f.h);
    canvas.width = THUMB * dpr;
    canvas.height = THUMB * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, ((THUMB - f.w * scale) / 2) * dpr, (THUMB - f.h * scale) * dpr);
    paintBuilding(ctx, id, 0, 0, { stillParts: true });
  }, [id]);
  return <canvas ref={ref} className="building-thumb" style={{ width: THUMB, height: THUMB }} aria-hidden="true" />;
}

const GROUPS: readonly { id: CivicGroup; label: string; hint: string }[] = [
  { id: 'services', label: 'Services', hint: 'Cover the area around them. Covered buildings fill up, and all four let towers grow.' },
  { id: 'utilities', label: 'Utilities', hint: 'Power, water and garbage trucks reach every building on the same connected roads, up to their capacity.' },
  { id: 'parks', label: 'Parks & Places', hint: 'Beautiful parks, markets, shopping and the town hall.' },
];

const ZONE_LINKS: readonly { tool: ZoneToolId; label: string; key: string; tone: string }[] = [
  { tool: 'zone-r', label: 'Homes', key: '1', tone: 'tone-r' },
  { tool: 'zone-rh', label: 'Apartments', key: '2', tone: 'tone-rh' },
  { tool: 'zone-c', label: 'Shops', key: '3', tone: 'tone-c' },
  { tool: 'zone-ch', label: 'Offices', key: '4', tone: 'tone-ch' },
  { tool: 'zone-i', label: 'Industry', key: '5', tone: 'tone-i' },
];

/** The key number on a card: coverage radius, utility capacity, or footprint. */
function cardStat(d: BuildingDef): string {
  if (d.radius) return `${d.radius}-tile reach`;
  if (d.energy?.coverage) return `${d.energy.coverage}-tile reach`;
  if (d.substation) return `${d.substation.radius}-tile reach`;
  if (d.supplies?.power) return `${d.supplies.power} ⚡`;
  if (d.supplies?.water) return `${d.supplies.water} 💧`;
  return `${d.size.w}×${d.size.h}`;
}

/** Panel above the toolbar while the Civic tool is active: services, utilities, parks. */
export function BuildingPicker() {
  const game = useAtomValue(gameAtom);
  const tool = useAtomValue(activeToolAtom);
  const choice = useAtomValue(buildingChoiceAtom);
  const funds = useAtomValue(fundsAtom);
  const progress = useAtomValue(cityAtom)?.progress;
  const [tab, setTab] = useState<CivicGroup>('services');

  if (tool !== 'build') return null;
  // Locked buildings (D-086) come last, greyed, with the stage that unlocks them.
  const isLocked = (id: BuildingId) => progress !== undefined && progress.locked && unlockStage(id) > progress.stage;
  const ids = PLACEABLE_IDS.filter((id) => {
    const d: BuildingDef = BUILDINGS[id];
    return d.group === tab;
  }).sort((a, b) => Number(isLocked(a)) - Number(isLocked(b)) || unlockStage(a) - unlockStage(b));

  return (
    <div className="panel building-picker" role="dialog" aria-label="Choose a civic building">
      <div className="picker-tabs" role="tablist">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === tab}
            className={`picker-tab ${g.id === tab ? 'is-active' : ''}`}
            data-tour={`civic-${g.id}`}
            onClick={() => setTab(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <p className="picker-hint">{GROUPS.find((g) => g.id === tab)?.hint}</p>
      <div className="picker-grid">
        {ids.map((id) => {
          const d: BuildingDef = BUILDINGS[id];
          const affordable = d.cost <= funds;
          const locked = isLocked(id);
          const stage = STAGES[unlockStage(id)];
          return (
            <button
              key={id}
              type="button"
              className={`building-card ${id === choice ? 'is-active' : ''} ${affordable ? '' : 'is-unaffordable'} ${locked ? 'is-locked' : ''}`}
              title={locked ? `Unlocks when the city becomes a ${stage.name} (${stage.population.toLocaleString()} people and its basics)` : d.description}
              aria-disabled={locked}
              onClick={() => (locked ? undefined : game?.setBuilding(id))}
            >
              <BuildingThumb id={id} />
              <span className="card-name">{d.name}</span>
              <span className="card-meta">
                {locked ? (
                  <span className="card-lock">🔒 {stage.name}</span>
                ) : (
                  <>
                    <span className="card-cost">${d.cost.toLocaleString()}</span>
                    <span className="card-size">{cardStat(d)}</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="picker-note">
        <span>Houses, apartments, shops, offices and industry grow on zones next to roads.</span>
        <span className="picker-zone-links">
          {ZONE_LINKS.map((z) => (
            <button key={z.tool} type="button" className={`zone-link ${z.tone}`} onClick={() => game?.setTool(z.tool)}>
              {z.label} <kbd>{z.key}</kbd>
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
