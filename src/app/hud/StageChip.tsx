import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { cityAtom } from '../atoms';
import { useBackDismiss } from '../mobile/useBackDismiss';

/**
 * The city's stage in the top bar (docs/specs/evolution.md, E0): its name and a ring for
 * progress toward the next stage. Click it for the checklist of what the next stage needs,
 * so the player always knows what to build next, and residents by lifestyle.
 */
export function StageChip() {
  const city = useAtomValue(cityAtom);
  const [open, setOpen] = useState(false);
  useBackDismiss(open, () => setOpen(false));
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !wrap.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);
  if (!city) return null;
  const p = city.progress;
  const reqs = p.next?.requirements ?? [];
  // Progress is the weakest requirement: the city is only as far as its slowest gate.
  const progress = reqs.length === 0 ? 1 : Math.min(...reqs.map((r) => r.have));
  const r = 7;
  const circumference = 2 * Math.PI * r;
  const [basic, comfortable, prosperous] = p.residents;
  const residents = basic + comfortable + prosperous;
  const share = (n: number) => (residents === 0 ? 0 : Math.round((n / residents) * 100));

  return (
    <span className="stage-wrap" ref={wrap}>
      <button
        type="button"
        className={`stage-chip ${open ? 'is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={p.next ? `${p.stageName} · next: ${p.next.name}` : p.stageName}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
          <circle
            cx="9"
            cy="9"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeWidth="2.4"
          />
          <circle
            cx="9"
            cy="9"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            transform="rotate(-90 9 9)"
          />
        </svg>
        <span className="stat-value">{p.stageName}</span>
      </button>
      {open && (
        <span className="panel stage-menu" role="dialog" aria-label="City stage">
          <strong className="stage-menu-title">{p.stageName}</strong>
          {p.next ? (
            <>
              <span className="stage-menu-sub">
                {p.locked
                  ? `To become a ${p.next.name}, the city needs:`
                  : `Next: ${p.next.name} (this city has every building unlocked)`}
              </span>
              <ul className="stage-reqs">
                {(p.locked ? reqs : reqs.slice(0, 1)).map((q) => (
                  <li key={q.label} className={q.met ? 'is-met' : ''}>
                    <span className="stage-req-label">
                      <span aria-hidden="true">{q.met ? '✓' : '○'}</span> {q.label}
                    </span>
                    <span className="stage-req-detail">{q.detail}</span>
                    <span className="meter">
                      <span
                        className="meter-fill"
                        style={{ width: `${Math.round(q.have * 100)}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <span className="stage-menu-sub">The highest stage. Congratulations, mayor!</span>
          )}
          {p.research && (
            <span className="stage-life">
              <span>Research · {p.research.rate.toFixed(1)} points a day</span>
              {p.research.current ? (
                <>
                  <span className="stage-req-label">
                    {p.research.current.name}: {p.research.current.points} /{' '}
                    {p.research.current.needed}
                  </span>
                  <span className="meter">
                    <span
                      className="meter-fill"
                      style={{
                        width: `${Math.round((p.research.current.points / p.research.current.needed) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="stage-life-legend">{p.research.current.effect}</span>
                </>
              ) : (
                <span className="stage-life-legend">Every project is finished.</span>
              )}
              {p.research.done.length > 0 && (
                <span className="stage-life-legend">Done: {p.research.done.join(' · ')}</span>
              )}
            </span>
          )}
          {residents > 0 && (
            <span className="stage-life">
              <span>Lifestyle</span>
              <span
                className="stage-life-bar"
                aria-label={`Basic ${share(basic)}%, Comfortable ${share(comfortable)}%, Prosperous ${share(prosperous)}%`}
              >
                <i className="tier-0" style={{ width: `${share(basic)}%` }} />
                <i className="tier-1" style={{ width: `${share(comfortable)}%` }} />
                <i className="tier-2" style={{ width: `${share(prosperous)}%` }} />
              </span>
              <span className="stage-life-legend">
                Basic {share(basic)}% · Comfortable {share(comfortable)}% · Prosperous{' '}
                {share(prosperous)}%
              </span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
