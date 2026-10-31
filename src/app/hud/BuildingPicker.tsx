import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { buildingFrameSize, paintBuilding } from '../../render/atlas/buildingArt';
import {
  BUILDING_IDS,
  BUILDINGS,
  CATEGORY_ORDER,
  type BuildingCategory,
  type BuildingId,
} from '../../sim/buildings/catalog';
import { activeToolAtom, buildingChoiceAtom, fundsAtom, gameAtom } from '../atoms';

const CATEGORY_LABEL: Readonly<Record<BuildingCategory, string>> = {
  residential: 'Homes',
  commercial: 'Shops & Offices',
  industrial: 'Industry',
  civic: 'Civic',
};

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
    paintBuilding(ctx, id, 0);
  }, [id]);
  return <canvas ref={ref} className="building-thumb" style={{ width: THUMB, height: THUMB }} aria-hidden="true" />;
}

/** Panel above the toolbar while the Build tool is active. */
export function BuildingPicker() {
  const game = useAtomValue(gameAtom);
  const tool = useAtomValue(activeToolAtom);
  const choice = useAtomValue(buildingChoiceAtom);
  const funds = useAtomValue(fundsAtom);
  const [category, setCategory] = useState<BuildingCategory>(BUILDINGS[choice].category);

  if (tool !== 'build') return null;
  const ids = BUILDING_IDS.filter((id) => BUILDINGS[id].category === category);

  return (
    <div className="panel building-picker" role="dialog" aria-label="Choose a building">
      <div className="picker-tabs" role="tablist">
        {CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === category}
            className={`picker-tab ${c === category ? 'is-active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="picker-grid">
        {ids.map((id) => {
          const d = BUILDINGS[id];
          const affordable = d.cost <= funds;
          return (
            <button
              key={id}
              type="button"
              className={`building-card ${id === choice ? 'is-active' : ''} ${affordable ? '' : 'is-unaffordable'}`}
              title={d.description}
              onClick={() => game?.setBuilding(id)}
            >
              <BuildingThumb id={id} />
              <span className="card-name">{d.name}</span>
              <span className="card-meta">
                <span className="card-cost">${d.cost.toLocaleString()}</span>
                <span className="card-size">
                  {d.size.w}×{d.size.h}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
