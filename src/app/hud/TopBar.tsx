import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CityInfo, DayNightMode } from '../../game/events';
import { budgetOpenAtom, happinessViewAtom, trafficViewAtom, cityAtom, clockAtom, dayNightAtom, fundsAtom, gameAtom, mutedAtom, rotationAtom } from '../atoms';
import { AccountButton } from '../account/AccountButton';
import { tourStepAtom } from '../tour/tourState';
import { SaveStatus } from './SaveStatus';
import { StageChip } from './StageChip';

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
  const wrap = useRef<HTMLSpanElement>(null);
  // Close the menu on any click outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !wrap.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);
  const h = Math.floor(hour);
  const m = Math.floor(((hour - h) * 60) / 10) * 10;
  const day = mode === 'day' || (mode === 'cycle' && hour >= 6.5 && hour < 19);
  return (
    <span className="clock-wrap" ref={wrap}>
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
  ['r', 'R', 'Homes'],
  ['c', 'C', 'Shops'],
  ['o', 'O', 'Offices'],
  ['i', 'I', 'Industry'],
] as const;

function demandWord(d: number): string {
  return d > 0.5 ? 'high' : d > 0.1 ? 'some' : d > -0.1 ? 'balanced' : 'oversupplied';
}

/** R/C/I demand: bars grow up from the midline when the city wants more, down when it has too much. */
function DemandMeter({ demand, why }: { demand: CityInfo['demand'] | undefined; why: CityInfo['demandWhy'] | undefined }) {
  // One line per bar: how strong it is and why (master plan §6.4).
  const title = demand
    ? DEMAND_BARS.map(([k, , name]) => `${name}: ${demandWord(demand[k])} (${Math.round(demand[k] * 100)}%)${why ? `. ${why[k]}` : ''}`).join('\n')
    : 'Zone demand';
  return (
    <span className="demand" title={title} aria-label={title} data-tour="demand">
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

const CALENDAR = (
  <g {...icon}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </g>
);
const EYE = (
  <g {...icon}>
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </g>
);

type FoldId = 'city' | 'view';
/** Screens where even one open group is a squeeze: start with both folded. Mirrors app.css. */
const FOLD_SHUT = '(max-width: 960px), (max-height: 520px)';

interface FoldProps {
  id: FoldId;
  /** The group that's open, if any; the others fold to their toggle. */
  open: FoldId | null;
  /** Only the first part of a group carries the toggle. */
  onOpen?: (id: FoldId | null) => void;
  label?: string;
  glyph?: ReactNode;
  children: ReactNode;
}

/**
 * A group of top-bar items that folds away on narrow windows and phones, so the bar fits: its
 * toggle opens it and folds the other, or folds it again. Wide windows show everything and never
 * see the toggles.
 */
function Fold({ id, open, onOpen, label, glyph, children }: FoldProps) {
  return (
    <span className={`top-fold ${open === id ? 'is-open' : ''}`}>
      {onOpen && (
        <button
          type="button"
          className={`icon-button top-fold-toggle ${open === id ? 'is-on' : ''}`}
          title={label}
          aria-label={label}
          aria-expanded={open === id}
          onClick={() => onOpen(open === id ? null : id)}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            {glyph}
          </svg>
        </button>
      )}
      {children}
    </span>
  );
}

interface TopBarProps {
  cityName: string;
  onNewCity: () => void;
  /** Save now (the save status button). */
  onSave: () => void;
  /** Runs before logging out, so the city is saved while the session still works. */
  beforeLogout: () => Promise<void>;
}

/** Floating top bar: city, date, population, jobs, funds, speed and sound. */
export function TopBar({ cityName, onNewCity, onSave, beforeLogout }: TopBarProps) {
  const funds = useAtomValue(fundsAtom);
  const city = useAtomValue(cityAtom);
  const muted = useAtomValue(mutedAtom);
  const game = useAtomValue(gameAtom);
  const rotation = useAtomValue(rotationAtom);
  const setBudgetOpen = useSetAtom(budgetOpenAtom);
  const setTourStep = useSetAtom(tourStepAtom);
  const trafficView = useAtomValue(trafficViewAtom);
  const happinessView = useAtomValue(happinessViewAtom);
  const happy = city?.needs.happiness ?? 1;
  const fundsFlash = useFlash(funds);
  const popFlash = useFlash(city?.population ?? 0);

  const date = city ? `${MONTHS[city.date.month]} ${city.date.dayOfMonth}, Y${city.date.year}` : '—';
  // Narrow windows and phones show at most one of these (CSS decides when folding applies);
  // small screens start with both folded so the bar fits.
  const [fold, setFold] = useState<FoldId | null>(() => (window.matchMedia(FOLD_SHUT).matches ? null : 'city'));

  return (
    <div className="panel top-bar">
      <button type="button" className="icon-button" title="Your cities" aria-label="Your cities" onClick={onNewCity}>
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <g {...icon}>
            <path d="M4 20V10l5-4 5 4v10M14 20v-7h6v7M2 20h20" />
            <path d="M18 3v6M15 6h6" />
          </g>
        </svg>
      </button>
      <span className="city-name">{cityName}</span>
      <SaveStatus onSave={onSave} />
      <span className="top-divider" />
      <Fold id="city" open={fold} onOpen={setFold} label="Show the date, clock and jobs" glyph={CALENDAR}>
        <Stat title="Date" glyph={CALENDAR}>
          <span className="stat-value date">{date}</span>
          <Clock />
        </Stat>
      </Fold>
      <Stat
        title={city ? `Population ${city.population.toLocaleString()} of ${city.housing.toLocaleString()} homes` : 'Population'}
        flash={popFlash}
        glyph={<g {...icon}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.8.2 5 2.6 5 5.8" /></g>}
      >
        <span className="stat-value">{(city?.population ?? 0).toLocaleString()}</span>
      </Stat>
      <StageChip />
      {/* Jobs folds with the date: one toggle, shown in the date's place. */}
      <Fold id="city" open={fold}>
        <Stat
          title={city ? `${city.workers.toLocaleString()} workers in ${city.jobs.toLocaleString()} jobs · ${city.unemployed.toLocaleString()} unemployed` : 'Jobs'}
          glyph={<g {...icon}><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M9 8V5h6v3M3 13h18" /></g>}
        >
          <span className="stat-value">
            {(city?.workers ?? 0).toLocaleString()}
            <span className="stat-dim">/{(city?.jobs ?? 0).toLocaleString()}</span>
          </span>
        </Stat>
      </Fold>
      <button
        type="button"
        className={`happy-stat ${happinessView ? 'is-on' : ''}`}
        title={`City happiness · click for the happiness view (Y)${city?.needs.abandoned ? ` · ${city.needs.abandoned} abandoned` : ''}`}
        aria-pressed={happinessView}
        onClick={() => game?.setHappinessView(!happinessView)}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <g {...icon}>
            <circle cx="12" cy="12" r="8.5" />
            {happy >= 0.6 ? <path d="M8.5 14c1 1.5 2.2 2.2 3.5 2.2s2.5-.7 3.5-2.2" /> : happy >= 0.45 ? <path d="M8.5 15h7" /> : <path d="M8.5 16.2c1-1.5 2.2-2.2 3.5-2.2s2.5.7 3.5 2.2" />}
            <path d="M9.3 9.8h.01M14.7 9.8h.01" strokeWidth="2.6" />
          </g>
        </svg>
        <span className="stat-value">{Math.round(happy * 100)}%</span>
      </button>
      <DemandMeter demand={city?.demand} why={city?.demandWhy} />
      <button
        type="button"
        className={`funds ${fundsFlash ? `flash-${fundsFlash === 'down' ? 'spend' : 'gain'}` : ''}`}
        title="Budget & taxes"
        onClick={() => setBudgetOpen((o) => !o)}
      >
        <span className="funds-sign">$</span>
        {funds.toLocaleString()}
      </button>
      <span className="top-divider" />
      <div className="speed-group" role="group" aria-label="Game speed" data-tour="speed">
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
      <Fold id="view" open={fold} onOpen={setFold} label="Show rotate, traffic view and sound" glyph={EYE}>
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
          className={`icon-button ${trafficView ? 'is-on' : ''}`}
          aria-pressed={trafficView}
          title="Traffic view (T)"
          aria-label="Traffic view"
          onClick={() => game?.setTrafficView(!trafficView)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <g {...icon}>
              <path d="M5 16V11l2-5h10l2 5v5" />
              <path d="M3 16h18v3H3z" />
              <circle cx="7.5" cy="13.5" r="0.6" />
              <circle cx="16.5" cy="13.5" r="0.6" />
            </g>
          </svg>
        </button>
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
      </Fold>
      <button type="button" className="icon-button" title="Tour the basics" aria-label="Tour the basics" onClick={() => setTourStep(0)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <g {...icon}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M9.6 9.5a2.5 2.5 0 014.8.9c0 1.7-2.4 2-2.4 3.6" />
            <path d="M12 17h.01" strokeWidth="2.6" />
          </g>
        </svg>
      </button>
      <AccountButton compact beforeLogout={beforeLogout} />
    </div>
  );
}
