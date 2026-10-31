import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';
import { buildingFrameSize, paintBuilding } from '../../render/atlas/buildingArt';
import { BUILDINGS, PLACEABLE_IDS, type BuildingId } from '../../sim/buildings/catalog';
import { activeToolAtom, buildingChoiceAtom, fundsAtom, gameAtom } from '../atoms';

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

/** Panel above the toolbar while the Build tool is active: civic buildings only. */
export function BuildingPicker() {
  const game = useAtomValue(gameAtom);
  const tool = useAtomValue(activeToolAtom);
  const choice = useAtomValue(buildingChoiceAtom);
  const funds = useAtomValue(fundsAtom);

  if (tool !== 'build') return null;

  return (
    <div className="panel building-picker" role="dialog" aria-label="Choose a building">
      <div className="picker-note">
        <span>Looking for houses? Homes, shops and industry grow on zones next to roads.</span>
        <span className="picker-zone-links">
          <button type="button" className="zone-link tone-r" onClick={() => game?.setTool('zone-r')}>
            Zone homes <kbd>1</kbd>
          </button>
          <button type="button" className="zone-link tone-c" onClick={() => game?.setTool('zone-c')}>
            Shops <kbd>2</kbd>
          </button>
          <button type="button" className="zone-link tone-i" onClick={() => game?.setTool('zone-i')}>
            Industry <kbd>3</kbd>
          </button>
        </span>
      </div>
      <div className="picker-grid">
        {PLACEABLE_IDS.map((id) => {
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
