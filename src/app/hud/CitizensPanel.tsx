import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { COMPACT } from '../mobile/useMedia';
import type { ComplaintKind } from '../../sim/systems/needs';
import { cityAtom, gameAtom } from '../atoms';

/** A colour per complaint, matching the speech-bubble icons. */
const TONE: Readonly<Record<ComplaintKind, string>> = {
  jobs: '#c08a4f',
  shopping: '#e2574c',
  safety: '#3b6fd8',
  health: '#e23b3b',
  education: '#2f8f5b',
  hospital: '#d23b5a',
  university: '#5b4fc4',
  garbage: '#7d8a3a',
  commute: '#f08a24',
  traffic: '#ef6c43',
  air: '#8b9097',
  parks: '#3fa34d',
  workers: '#3b6fd8',
  customers: '#e0a514',
  abandoned: '#6f665c',
};

/** "Citizens say…": the city's top complaints, each with a button that shows where. */
export function CitizensPanel() {
  const city = useAtomValue(cityAtom);
  const game = useAtomValue(gameAtom);
  // Folded on short (landscape phone) screens, where it would cover the city.
  const [open, setOpen] = useState(() => !window.matchMedia(COMPACT).matches);
  const complaints = city?.needs.complaints ?? [];
  if (complaints.length === 0) return null;
  return (
    <aside className="panel citizens" aria-label="Citizens say">
      <button type="button" className="citizens-header" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>Citizens say…</span>
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" style={{ transform: open ? 'none' : 'rotate(-90deg)' }}>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul className="citizens-list">
          {complaints.map((c) => (
            <li key={c.kind} className="citizens-item">
              <i style={{ background: TONE[c.kind] }} />
              <span className="citizens-text">
                “{c.text}”<span className="citizens-count">{c.count}</span>
                <span className="citizens-stats">
                  {c.stats.map((stat) => <span key={stat.label}>{stat.label}: {stat.value}</span>)}
                </span>
              </span>
              <button type="button" className="citizens-show" onClick={() => game?.focusBuilding(c.building)}>
                Show me
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
