import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CityInfo, DayNightMode } from '../../game/events';
import { cityAtom, clockAtom, dayNightAtom, fundsAtom, gameAtom, mutedAtom, rotationAtom } from '../atoms';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const icon = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Number that briefly flashes when it changes (green up, red down). */
function useFlash(value: number) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (value === prev.current) return;
    setFlash(value > prev.current ? 'up' : 'down');
    prev.current = value;
    const t = setTimeout(() => setFlash(null), 450);
    return () => clearTimeout(t);
  }, [value]);
  return flash;
}

function Stat({ title, glyph, children, flash }: { title: string; glyph: ReactNode; children: ReactNode; flash?: 'up' | 'down' | null }) {
  return (
    <span className={`stat ${flash ? `flash-${flash}` : ''}`} title={title}>
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        {glyph}
      </svg>
      {children}
    </span>
  );
}

const SPEED_LABELS = ['Pause', '1×', '2×', '3×'] as const;

const DAY_NIGHT_OPTIONS: readonly { mode: DayNightMode; label: string; hint: string }[] = [
  { mode: 'cycle', label: 'Day & night', hint: 'Follows the clock' },
  { mode: 'day', label: 'Always day', hint: 'No night tint' },
  { mode: 'night', label: 'Always night', hint: 'City lights' },
];

const sun = (
  <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </g>
);
const moon = <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="currentColor" />;

/**
 * hh:mm on the time-of-day clock (rounded to 10 minutes so it doesn't flicker). Click it to
 * choose how day and night look: follow the clock, always day, or always night (`L` steps through).
 */
function Clock() {
  const hour = useAtomValue(clockAtom);
  const mode = useAtomValue(dayNightAtom);
  const game = useAtomValue(gameAtom);
  const [open, setOpen] = useState(false);
  const h = Math.floor(hour);
  const m = Math.floor(((hour - h) * 60) / 10) * 10;
  const day = mode === 'day' || (mode === 'cycle' && hour >= 6.5 && hour < 19);
  return (
    <span className="clock-wrap">
      <button
        type="button"
        className={`clock ${open ? 'is-open' : ''}`}
        title="Day & night (L)"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          {day ? sun : moon}
        </svg>
        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
        <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <span className="panel clock-menu" role="menu">
          {DAY_NIGHT_OPTIONS.map((o) => (
            <button
              key={o.mode}
              type="button"
              role="menuitemradio"
              aria-checked={mode === o.mode}
              className={`clock-option ${mode === o.mode ? 'is-active' : ''}`}
              onClick={() => {
                game?.setDayNight(o.mode);
                setOpen(false);
              }}
            >
              <strong>{o.label}</strong>
              <span>{o.hint}</span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

const DEMAND_BARS = [
  ['r', 'R', 'Residential'],
  ['c', 'C', 'Commercial'],
  ['i', 'I', 'Industrial'],
] as const;

function demandWord(d: number): string {
  return d > 0.5 ? 'high' : d > 0.1 ? 'some' : d > -0.1 ? 'balanced' : 'oversupplied';
}

/** R/C/I demand: bars grow up from the midline when the city wants more, down when it has too much. */
function DemandMeter({ demand }: { demand: CityInfo['demand'] | undefined }) {
  const title = demand
    ? DEMAND_BARS.map(([k, , name]) => `${name}: ${demandWord(demand[k])}`).join(' · ')
    : 'Zone demand';
  return (
    <span className="demand" title={title} aria-label={title}>
      {DEMAND_BARS.map(([k, letter]) => {
        const d = demand?.[k] ?? 0;
        const h = Math.round(Math.abs(d) * 100) / 2;
        return (
          <span key={k} className={`demand-col tone-${k}`}>
            <span className="demand-track">
              <span className={`demand-bar ${d < 0 ? 'is-neg' : ''}`} style={{ height: `${h}%` }} />
            </span>
            <span className="demand-letter">{letter}</span>
          </span>
        );
      })}
    </span>
  );
}

interface TopBarProps {
  cityName: string;
  onNewCity: () => void;
}

/** Floating top bar: city, date, population, jobs, funds, speed and sound. */
export function TopBar({ cityName, onNewCity }: TopBarProps) {
  const funds = useAtomValue(fundsAtom);
  const city = useAtomValue(cityAtom);
  const muted = useAtomValue(mutedAtom);
  const game = useAtomValue(gameAtom);
  const rotation = useAtomValue(rotationAtom);
  const fundsFlash = useFlash(funds);
  const popFlash = useFlash(city?.population ?? 0);

  const date = city ? `${MONTHS[city.date.month]} ${city.date.dayOfMonth}, Y${city.date.year}` : '—';

  return (
    <div className="panel top-bar">
      <button type="button" className="icon-button" title="New city" aria-label="New city" onClick={onNewCity}>
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <g {...icon}>
            <path d="M4 20V10l5-4 5 4v10M14 20v-7h6v7M2 20h20" />
            <path d="M18 3v6M15 6h6" />
          </g>
        </svg>
      </button>
      <span className="city-name">{cityName}</span>
      <span className="top-divider" />
      <Stat title="Date" glyph={<g {...icon}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></g>}>
        <span className="stat-value date">{date}</span>
        <Clock />
      </Stat>
      <Stat
        title={city ? `Population ${city.population.toLocaleString()} of ${city.housing.toLocaleString()} homes` : 'Population'}
        flash={popFlash}
        glyph={<g {...icon}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.8.2 5 2.6 5 5.8" /></g>}
      >
        <span className="stat-value">{(city?.population ?? 0).toLocaleString()}</span>
      </Stat>
      <Stat
        title={city ? `${city.workers.toLocaleString()} workers in ${city.jobs.toLocaleString()} jobs · ${city.unemployed.toLocaleString()} unemployed` : 'Jobs'}
        glyph={<g {...icon}><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M9 8V5h6v3M3 13h18" /></g>}
      >
        <span className="stat-value">
          {(city?.workers ?? 0).toLocaleString()}
          <span className="stat-dim">/{(city?.jobs ?? 0).toLocaleString()}</span>
        </span>
      </Stat>
      <DemandMeter demand={city?.demand} />
      <span className={`funds ${fundsFlash ? `flash-${fundsFlash === 'down' ? 'spend' : 'gain'}` : ''}`} title="Funds">
        <span className="funds-sign">$</span>
        {funds.toLocaleString()}
      </span>
      <span className="top-divider" />
      <div className="speed-group" role="group" aria-label="Game speed">
        {SPEED_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`speed-button ${city?.speed === i ? 'is-active' : ''}`}
            aria-pressed={city?.speed === i}
            title={i === 0 ? 'Pause (Space)' : `${label} speed ([ / ])`}
            onClick={() => game?.setSpeed(i)}
          >
            {i === 0 ? (
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width={10 + i * 4} height="13" aria-hidden="true" preserveAspectRatio="none">
                {Array.from({ length: i }, (_, k) => (
                  <path key={k} d={`M${4 + k * (16 / i)} 5l${14 / i} 7-${14 / i} 7z`} fill="currentColor" />
                ))}
              </svg>
            )}
          </button>
        ))}
      </div>
      <span className="top-divider" />
      <div className="rotate-group" role="group" aria-label="Rotate view">
        <button type="button" className="icon-button" title="Rotate left (,)" aria-label="Rotate view left" onClick={() => game?.rotate(-1)}>
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <g {...icon}>
              <path d="M4 12a8 8 0 1 0 2.4-5.7" />
              <path d="M4 4v4h4" />
            </g>
          </svg>
        </button>
        {/* Compass: the arrow points to the map's north as seen from this side. */}
        <span className="compass" title="North" style={{ transform: `rotate(${45 + rotation * 90}deg)` }} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M12 3l4 9h-8z" fill="#f87171" />
            <path d="M12 21l-4-9h8z" fill="currentColor" opacity="0.55" />
          </svg>
        </span>
        <button type="button" className="icon-button" title="Rotate right (.)" aria-label="Rotate view right" onClick={() => game?.rotate(1)}>
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <g {...icon}>
              <path d="M20 12a8 8 0 1 1-2.4-5.7" />
              <path d="M20 4v4h-4" />
            </g>
          </svg>
        </button>
      </div>
      <span className="top-divider" />
      <button
        type="button"
        className="icon-button"
        aria-label={muted ? 'Unmute sound (M)' : 'Mute sound (M)'}
        title={muted ? 'Unmute (M)' : 'Mute (M)'}
        onClick={() => game?.setMuted(!muted)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {muted ? (
            <path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>
    </div>
  );
}
