import { useAtomValue } from 'jotai';
import { SERVICE_KINDS as ALL_SERVICES, type ServiceKind } from '../../sim/buildings/catalog';
import type { NeedKind } from '../../sim/systems/needs';
import { gameAtom, inspectAtom } from '../atoms';

const NEED_LABEL: Readonly<Record<NeedKind, string>> = {
  jobs: 'Jobs',
  shopping: 'Shopping',
  safety: 'Safety',
  health: 'Health',
  education: 'Education',
  hospital: 'Hospital',
  university: 'University',
  garbage: 'Garbage',
  commute: 'Commute',
  traffic: 'Traffic',
  air: 'Clean air',
  parks: 'Parks',
  workers: 'Workers',
  customers: 'Customers',
};

const SERVICE_LABEL: Readonly<Record<ServiceKind, string>> = {
  police: 'Police',
  fire: 'Fire',
  health: 'Clinic',
  education: 'School',
  hospital: 'Hospital',
  university: 'University',
};

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  residential: 'Home',
  commercial: 'Shops & Offices',
  industrial: 'Industry',
  civic: 'Civic',
};

const WEALTH_LABEL = { everyday: 'Everyday', comfortable: 'Comfortable', luxury: 'Luxury' } as const;

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
          {info.category === 'residential' && <span className={`info-chip wealth-${info.wealth}`}>{WEALTH_LABEL[info.wealth]}</span>}
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={() => game?.inspect(null)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <p className="info-desc">{info.description}</p>
      {info.investorValue > 0 && <div className="info-row"><span>Investor appeal</span><strong>+{info.investorValue}</strong></div>}

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
      {info.powerIssue && (
        <div className="info-status warn">
          <strong>Power issue: {info.powerIssue.reason}</strong>
          {info.powerIssue.stats.map((stat) => (
            <div className="info-row" key={stat.label}>
              <span>{stat.label}</span>
              <span>{stat.value}</span>
            </div>
          ))}
        </div>
      )}
      {info.condition !== null && (
        <div className="info-power-status">
          <div className="info-row">
            <span>Plant condition</span>
            <strong className={info.condition < 0.4 || info.repairDays > 0 ? 'warn' : ''}>
              {info.repairDays > 0 ? `Failed · repair in ${info.repairDays}d` : `${Math.round(info.condition * 100)}%`}
            </strong>
          </div>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(info.condition * 100)}>
            <div className={`meter-fill ${info.condition < 0.4 ? 'is-short' : ''}`} style={{ width: `${Math.round(info.condition * 100)}%` }} />
          </div>
          {info.repairDays > 0 || info.condition < 1 ? (
            <button type="button" className="secondary-button" onClick={() => game?.repairBuilding(info.id)} disabled={info.repairCost <= 0}>
              Repair · ${info.repairCost.toLocaleString()}
            </button>
          ) : null}
        </div>
      )}
      {info.abandoned && <div className="info-status warn">Abandoned: fix what its people need and they'll come back</div>}
      {info.needs && (
        <div className="info-needs">
          <div className="info-row">
            <span>Happiness</span>
            <strong>{Math.round(info.needs.happiness * 100)}%</strong>
          </div>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(info.needs.happiness * 100)}>
            <div className={`meter-fill ${info.needs.happiness < 0.45 ? 'is-short' : ''}`} style={{ width: `${Math.round(info.needs.happiness * 100)}%` }} />
          </div>
          <div className="info-services-list">
            {info.needs.scores.map((s) => (
              <span key={s.kind} className={`info-pill ${s.score >= 0.7 ? 'ok' : s.score >= 0.4 ? '' : 'warn'}`} title={`${Math.round(s.score * 100)}%`}>
                {NEED_LABEL[s.kind]}
              </span>
            ))}
          </div>
          {info.needs.complaint && <p className="info-complaint">“{info.needs.complaint}”</p>}
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

      <div className="info-actions">
        <button type="button" className="secondary-button" onClick={() => game?.startMove(info.id)} title="Pick it up and set it down somewhere else (P)">
          Move
        </button>
        <button type="button" className="danger-button" onClick={() => game?.demolish(info.id)}>
          Demolish
        </button>
      </div>
    </aside>
  );
}
