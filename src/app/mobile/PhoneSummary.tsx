import { useAtomValue } from 'jotai';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  airViewAtom,
  cityAtom,
  dayNightAtom,
  fundsAtom,
  gameAtom,
  happinessViewAtom,
  mutedAtom,
  rotationAtom,
  trafficViewAtom,
} from '../atoms';
import { AlertsButton } from '../hud/AlertsButton';
import { useBackDismiss } from './useBackDismiss';
import {
  HUD_STATS,
  HUD_ITEMS,
  readHudPreferences,
  writeHudPreferences,
  type HudItemId,
  type HudRow,
} from './hudPreferences';
import { HudStat, compactNumber } from './HudStat';
import { HudCustomize } from './HudCustomize';

const DASHBOARD_STATS = [
  ...HUD_STATS.filter(([id]) => id !== 'demand'),
  ...HUD_STATS.filter(([id]) => id === 'demand'),
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function PhoneSummary({
  cityName,
  panelOpen,
  menuOpen,
  onClosePanel,
  onBudget,
  onMenu,
}: {
  cityName: string;
  panelOpen: boolean;
  menuOpen: boolean;
  onClosePanel: () => void;
  onBudget: () => void;
  onMenu: () => void;
}) {
  const game = useAtomValue(gameAtom);
  const city = useAtomValue(cityAtom);
  const funds = useAtomValue(fundsAtom);
  const rotation = useAtomValue(rotationAtom);
  const traffic = useAtomValue(trafficViewAtom);
  const happiness = useAtomValue(happinessViewAtom);
  const air = useAtomValue(airViewAtom);
  const dayNight = useAtomValue(dayNightAtom);
  const muted = useAtomValue(mutedAtom);
  const [selected, setSelected] = useState(readHudPreferences);
  const [expanded, setExpanded] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  const dashboardRef = useRef<HTMLElement>(null);
  const customizeRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const closeDashboard = () => {
    setExpanded(false);
    setEditing(false);
    setAlertsOpen(false);
  };
  const finishEditing = () => {
    setEditing(false);
    requestAnimationFrame(() => customizeRef.current?.focus());
  };
  // A newly opened sheet supersedes the dashboard in the same render.
  if (panelOpen && (expanded || alertsOpen)) {
    setExpanded(false);
    setEditing(false);
    setAlertsOpen(false);
  }
  useBackDismiss(expanded, () => {
    if (editing) finishEditing();
    else {
      closeDashboard();
      expandRef.current?.focus();
    }
  });
  useLayoutEffect(() => {
    const host = summaryRef.current?.closest<HTMLElement>('.game-screen');
    const dock = host?.querySelector<HTMLElement>('.phone-dock');
    if (!host || !dock) return;
    const measure = () => {
      const bottom = summaryRef.current?.getBoundingClientRect().bottom ?? 0;
      const dockTop = dock.getBoundingClientRect().top;
      const confirmation = host.querySelector<HTMLElement>('.draft-confirm');
      const freeBottom = Math.min(
        dockTop - 56,
        confirmation ? confirmation.getBoundingClientRect().top - 8 : dockTop,
      );
      host.style.setProperty('--phone-summary-bottom', `${bottom}px`);
      host.style.setProperty('--phone-dock-top', `${dockTop}px`);
      host.style.setProperty(
        '--phone-dashboard-max-height',
        `${Math.max(48, freeBottom - bottom - 8)}px`,
      );
      host.style.setProperty(
        '--phone-overlay-top',
        `${Math.max(bottom, dashboardRef.current?.getBoundingClientRect().bottom ?? 0)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(summaryRef.current!);
    observer.observe(dock);
    if (dashboardRef.current) observer.observe(dashboardRef.current);
    const watchConfirmation = () => {
      const confirmation = host.querySelector('.draft-confirm');
      if (confirmation) observer.observe(confirmation);
      measure();
    };
    const mutations = new MutationObserver(watchConfirmation);
    mutations.observe(host, { childList: true, subtree: true });
    watchConfirmation();
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', measure);
      for (const key of [
        '--phone-summary-bottom',
        '--phone-dock-top',
        '--phone-overlay-top',
        '--phone-dashboard-max-height',
      ])
        host.style.removeProperty(key);
    };
  }, [expanded, editing]);
  const openDashboard = () => {
    onClosePanel();
    setAlertsOpen(false);
    setExpanded(true);
  };
  const toggleDashboard = () => {
    if (expanded) closeDashboard();
    else openDashboard();
  };

  const renderItem = (id: HudItemId, row: HudRow): ReactNode => {
    switch (id) {
      case 'funds':
        return (
          <button
            type="button"
            className="phone-funds"
            aria-describedby={`phone-full-funds-${row}`}
            aria-label="Budget and taxes"
            title={`Treasury $${funds.toLocaleString()}`}
            onClick={() => {
              closeDashboard();
              onBudget();
            }}
          >
            <span className="phone-stat-label">Treasury</span>
            <strong>${compactNumber(funds)}</strong>
            <span id={`phone-full-funds-${row}`} className="sr-only">
              ${funds.toLocaleString()}
            </span>
          </button>
        );
      case 'population':
        return (
          <button
            type="button"
            onClick={openDashboard}
            className="phone-population"
            aria-label={`Population ${(city?.population ?? 0).toLocaleString()}`}
            title={`Population ${(city?.population ?? 0).toLocaleString()}`}
          >
            <Icon>
              <circle cx="9" cy="8" r="3" />
              <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              <circle cx="17" cy="9" r="2.4" />
              <path d="M16 14.2c2.8.2 5 2.6 5 5.8" />
            </Icon>
            <strong>{compactNumber(city?.population ?? 0)}</strong>
          </button>
        );
      case 'speed':
        return (
          <button
            type="button"
            className="phone-pause"
            aria-label={city?.speed === 0 ? 'Resume simulation' : 'Pause simulation'}
            onClick={() => game?.togglePause()}
          >
            <Icon>
              {city?.speed === 0 ? (
                <path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none" />
              ) : (
                <path d="M8 5v14M16 5v14" />
              )}
            </Icon>
            <span>{city?.speed === 0 ? 'Paused' : `${city?.speed ?? 1}×`}</span>
          </button>
        );
      case 'alerts':
        return (
          <AlertsButton
            portalToGame
            open={alertsOpen}
            onOpenChange={setAlertsOpen}
            onOpen={() => {
              closeDashboard();
              onClosePanel();
            }}
          />
        );
      default:
        return (
          <button
            type="button"
            className="phone-pinned-stat"
            title={`Show ${HUD_ITEMS.find(([key]) => key === id)?.[1]} details`}
            aria-expanded={expanded}
            aria-controls="phone-dashboard"
            onClick={openDashboard}
          >
            <HudStat id={id} />
          </button>
        );
    }
  };

  return (
    <>
      <header ref={summaryRef} className="panel phone-summary" aria-label="City summary">
        <div className="phone-summary-main">
          <div className="phone-pinned-strip" role="group" aria-label="First row items">
            {selected.first.map((id) => (
              <div key={id} className={`phone-hud-slot hud-slot-${id}`}>
                {renderItem(id, 'first')}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="phone-menu-toggle"
            aria-expanded={menuOpen}
            onClick={() => {
              closeDashboard();
              onMenu();
            }}
          >
            <Icon>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </Icon>
            <span>Menu</span>
          </button>
        </div>
        <div className="phone-summary-stats">
          <div className="phone-pinned-strip" role="group" aria-label="Second row items">
            {selected.second.map((id) => (
              <div key={id} className={`phone-hud-slot hud-slot-${id}`}>
                {renderItem(id, 'second')}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="phone-rotate"
            aria-label={`Rotate clockwise 90 degrees; current orientation ${rotation * 90} degrees`}
            title="Rotate clockwise 90°"
            onClick={() => game?.rotate(1)}
          >
            <Icon>
              <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" />
            </Icon>
            <span>Rotate</span>
          </button>
          <button
            ref={expandRef}
            type="button"
            className="phone-expand"
            aria-label={expanded ? 'Collapse city dashboard' : 'Expand city dashboard'}
            aria-expanded={expanded}
            aria-controls="phone-dashboard"
            onClick={toggleDashboard}
          >
            <Icon>
              <path d={expanded ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} />
            </Icon>
            <span>{expanded ? 'Less' : 'More'}</span>
          </button>
        </div>
      </header>
      {expanded && (
        <section
          ref={dashboardRef}
          id="phone-dashboard"
          className="panel phone-dashboard"
          role="region"
          aria-label="City dashboard"
        >
          {editing ? (
            <HudCustomize
              selected={selected}
              onCancel={finishEditing}
              onApply={(stats) => {
                setSelected(stats);
                setStorageFailed(!writeHudPreferences(stats));
                finishEditing();
              }}
            />
          ) : (
            <>
              <div className="phone-dashboard-heading">
                <div>
                  <span className="phone-stat-label">City overview</span>
                  <h2>{cityName}</h2>
                </div>
                <button ref={customizeRef} type="button" onClick={() => setEditing(true)}>
                  Customize
                </button>
              </div>
              <p className="phone-dashboard-totals">
                ${funds.toLocaleString()} · {(city?.population ?? 0).toLocaleString()} residents
              </p>
              {storageFailed && (
                <p role="status">
                  Your choices work for this session. Device storage is unavailable.
                </p>
              )}

              <fieldset>
                <legend>Simulation speed</legend>
                <div className="phone-control-group">
                  {[0, 1, 2, 3].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      aria-pressed={city?.speed === speed}
                      onClick={() => game?.setSpeed(speed)}
                    >
                      {speed === 0 ? 'Pause' : `${speed}×`}
                    </button>
                  ))}
                </div>
              </fieldset>
              <details className="phone-view-controls">
                <summary>Map, lighting &amp; sound</summary>
                <fieldset>
                  <legend>Map overlays</legend>
                  <div className="phone-control-group">
                    <button
                      type="button"
                      aria-pressed={traffic}
                      onClick={() => game?.setTrafficView(!traffic)}
                    >
                      Traffic
                    </button>
                    <button
                      type="button"
                      aria-pressed={happiness}
                      onClick={() => game?.setHappinessView(!happiness)}
                    >
                      Happiness
                    </button>
                    <button type="button" aria-pressed={air} onClick={() => game?.setAirView(!air)}>
                      Air quality
                    </button>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Day and night</legend>
                  <div className="phone-control-group">
                    {(['cycle', 'day', 'night'] as const).map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        aria-pressed={dayNight === mode}
                        onClick={() => game?.setDayNight(mode)}
                      >
                        {mode === 'cycle'
                          ? 'Cycle'
                          : mode === 'day'
                            ? 'Always day'
                            : 'Always night'}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <button type="button" aria-pressed={!muted} onClick={() => game?.setMuted(!muted)}>
                  {muted ? 'Enable sound' : 'Mute sound'}
                </button>
              </details>
              <div className="phone-dashboard-cards">
                {DASHBOARD_STATS.map(([id]) => (
                  <article key={id} className={`phone-dashboard-card stat-${id}`}>
                    <HudStat id={id} detailed />
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
