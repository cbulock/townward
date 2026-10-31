import { useAtomValue } from 'jotai';
import { SERVICE_KINDS as ALL_SERVICES, type ServiceKind } from '../../sim/buildings/catalog';
import { gameAtom, inspectAtom } from '../atoms';

const SERVICE_LABEL: Readonly<Record<ServiceKind, string>> = {
  police: 'Police',
  fire: 'Fire',
  health: 'Clinic',
  education: 'School',
};

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  residential: 'Home',
  commercial: 'Shops & Offices',
  industrial: 'Industry',
  civic: 'Civic',
};

/** Slides in from the right when a building is clicked with the Select tool. */
export function InfoPanel() {
  const info = useAtomValue(inspectAtom);
  const game = useAtomValue(gameAtom);
  if (!info) return null;
  const pct = info.capacity === 0 ? 0 : Math.round((info.occupants / info.capacity) * 100);

  return (
    <aside className="panel info-panel" aria-label={`${info.name} details`}>
      <header className="info-header">
        <div>
          <h2 className="info-title">{info.name}</h2>
          <span className={`info-chip chip-${info.category}`}>{CATEGORY_LABEL[info.category] ?? info.category}</span>
          {info.level > 0 && <span className="info-level">{'★'.repeat(info.level)}</span>}
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={() => game?.inspect(null)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <p className="info-desc">{info.description}</p>

      {info.capacity > 0 && (
        <div className="info-occupancy">
          <div className="info-row">
            <span>{info.occupantLabel}</span>
            <strong>
              {info.occupants.toLocaleString()} / {info.capacity.toLocaleString()}
            </strong>
          </div>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={info.capacity} aria-valuenow={info.occupants}>
            <div className="meter-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {info.constructionDays > 0 && (
        <div className="info-status building">
          Under construction · {info.constructionDays} day{info.constructionDays === 1 ? '' : 's'} left
        </div>
      )}
      {info.provides?.kind === 'service' && (
        <div className="info-row">
          <span>{SERVICE_LABEL[info.provides.service]} coverage</span>
          <strong>{info.provides.radius} tiles around</strong>
        </div>
      )}
      {info.provides?.kind === 'utility' && (
        <div className="info-row">
          <span>Supplies</span>
          <strong>
            {info.provides.power ? `${info.provides.power.toLocaleString()} power` : ''}
            {info.provides.water ? `${info.provides.water.toLocaleString()} water` : ''}
          </strong>
        </div>
      )}
      {info.commuteMinutes !== null && (
        <div className="info-row">
          <span>Commute</span>
          <strong>{Math.round(info.commuteMinutes)} min</strong>
        </div>
      )}
      {info.needsUtilities && info.constructionDays === 0 && (
        <div className="info-utilities">
          <span className={`info-pill ${info.powered ? 'ok' : 'warn'}`}>{info.powered ? '⚡ Power' : '⚡ No power'}</span>
          <span className={`info-pill ${info.watered ? 'ok' : 'warn'}`}>{info.watered ? '💧 Water' : '💧 No water'}</span>
        </div>
      )}
      {info.needsUtilities && (
        <div className="info-services">
          <span className="info-services-label">Services nearby</span>
          <span className="info-services-list">
            {ALL_SERVICES.map((k) => (
              <span key={k} className={`info-pill ${info.services.includes(k) ? 'ok' : 'off'}`}>
                {SERVICE_LABEL[k]}
              </span>
            ))}
          </span>
        </div>
      )}
      <div className={`info-status ${info.hasRoad ? 'ok' : 'warn'}`}>
        {info.hasRoad ? 'Connected to the road network' : 'No road access: build a road within 3 tiles'}
      </div>
      {info.upkeep > 0 && (
        <div className="info-row dim">
          <span>Upkeep</span>
          <span>${info.upkeep.toLocaleString()}/month</span>
        </div>
      )}
      <div className="info-row dim">
        <span>Origin</span>
        <span>{info.grown ? 'Grew on a zone' : 'Placed'}</span>
      </div>
      <div className="info-row dim">
        <span>Footprint</span>
        <span>
          {info.size.w}×{info.size.h}
        </span>
      </div>

      <button type="button" className="danger-button" onClick={() => game?.demolish(info.id)}>
        Demolish
      </button>
    </aside>
  );
}
