import { useAtomValue, useStore } from 'jotai';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  activeToolAtom,
  budgetOpenAtom,
  cityAtom,
  gameAtom,
  inspectAtom,
  mutedAtom,
} from '../atoms';
import { isRoadTool, isZoneTool, type ToolId } from '../../game/tools';
import { BuildingPicker } from '../hud/BuildingPicker';
import { RoadPicker } from '../hud/RoadPicker';
import { BudgetPanel } from '../hud/BudgetPanel';
import { InfoPanel } from '../hud/InfoPanel';
import { CitizensPanel } from '../hud/CitizensPanel';
import { SaveStatus } from '../hud/SaveStatus';
import { StageChip } from '../hud/StageChip';
import { PhoneSummary } from './PhoneSummary';
import { AccountButton } from '../account/AccountButton';
import { HUD_TOOLS } from '../hud/Toolbar';
import { tourStepAtom } from '../tour/tourState';

type Sheet = 'city' | 'roads' | 'zones' | 'civic' | 'budget' | 'info' | 'citizens' | null;
const ZONES = HUD_TOOLS.filter((tool) => isZoneTool(tool.id));
const TOOL_LABELS: Readonly<Partial<Record<ToolId, string>>> = {
  move: 'Move building',
  rail: 'Rail',
  pedestrian: 'Pedestrian path',
  avenue: 'Avenue',
  boulevard: 'Boulevard',
  ramp: 'Ramp',
  highway: 'Highway',
  expressway: 'Expressway',
};
const SHEET_LABELS = {
  city: 'City menu',
  roads: 'Roads & transport',
  zones: 'Zone your city',
  civic: 'Civic buildings',
  budget: 'Budget & taxes',
  info: 'Building details',
  citizens: 'Citizens say',
};
function HudIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
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
function ToolIcon({ id }: { id: ToolId }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {HUD_TOOLS.find((tool) => tool.id === id)?.icon}
    </svg>
  );
}

interface MobileHudProps {
  readonly cityName: string;
  readonly onSave: () => void;
  readonly onNewCity: () => void;
  readonly beforeLogout: () => Promise<void>;
}

/** One sheet at a time, with a permanent map dock in both phone orientations. */
export function MobileHud({ cityName, onSave, onNewCity, beforeLogout }: MobileHudProps) {
  const game = useAtomValue(gameAtom);
  const city = useAtomValue(cityAtom);
  const active = useAtomValue(activeToolAtom);
  const muted = useAtomValue(mutedAtom);
  const inspected = useAtomValue(inspectAtom);
  const store = useStore();
  const [sheet, setSheet] = useState<Sheet>(() => (store.get(inspectAtom) ? 'info' : null));
  const sheetPointer = useRef<Sheet>(null);
  useEffect(() => {
    sheetPointer.current = null;
  }, [sheet]);

  const activeLabel =
    HUD_TOOLS.find((tool) => tool.id === active)?.label ?? TOOL_LABELS[active] ?? 'Construction';

  const close = () => {
    game?.inspect(null);
    setSheet(null);
    store.set(budgetOpenAtom, false);
  };
  useEffect(() => {
    return game?.events.on('inspect', (info) =>
      setSheet((current) => (info ? 'info' : current === 'info' ? null : current)),
    );
  }, [game]);
  useEffect(() => {
    const back = (event: Event) => {
      if (!sheet || event.defaultPrevented) return;
      event.preventDefault();
      setSheet(null);
      store.set(budgetOpenAtom, false);
      if (sheet === 'info') game?.inspect(null);
    };
    window.addEventListener('openpolis-dismiss', back);
    return () => window.removeEventListener('openpolis-dismiss', back);
  }, [sheet, store, game]);

  const open = (next: Sheet) => {
    if (next !== 'info') game?.inspect(null);
    store.set(budgetOpenAtom, next === 'budget');
    setSheet((current) => (current === next ? null : next));
  };
  return (
    <>
      <PhoneSummary
        cityName={cityName}
        panelOpen={sheet !== null}
        menuOpen={sheet === 'city'}
        onClosePanel={close}
        onBudget={() => open('budget')}
        onMenu={() => open('city')}
      />
      <nav className="panel phone-dock" aria-label="Build tools">
        <button
          type="button"
          aria-pressed={active === 'select'}
          onClick={() => {
            game?.setTool('select');
            close();
          }}
        >
          <ToolIcon id="select" />
          <span>Pan</span>
        </button>
        <button
          type="button"
          aria-pressed={isRoadTool(active) || active === 'rail'}
          onClick={() => {
            game?.setTool(game.lastRoadTool);
            open('roads');
          }}
        >
          <ToolIcon id="road" />
          <span>Roads</span>
        </button>
        <button type="button" aria-pressed={isZoneTool(active)} onClick={() => open('zones')}>
          <HudIcon>
            <path d="M12 4l10 8-10 8L2 12zM7 8l10 8M7 16l10-8" />
          </HudIcon>
          <span>Zones</span>
        </button>
        <button
          type="button"
          aria-pressed={active === 'build'}
          onClick={() => {
            game?.setTool('build');
            open('civic');
          }}
        >
          <ToolIcon id="build" />
          <span>Civic</span>
        </button>
        <button
          type="button"
          aria-pressed={active === 'clear'}
          onClick={() => {
            game?.setTool('clear');
            close();
          }}
        >
          <ToolIcon id="clear" />
          <span>Clear</span>
        </button>
      </nav>
      {active !== 'select' && !sheet && (
        <button
          type="button"
          className="panel phone-tool-exit"
          onClick={() => game?.setTool('select')}
        >
          <HudIcon>
            <path d="M5 12l4 4L19 6" />
          </HudIcon>{' '}
          Done · {activeLabel}
        </button>
      )}
      {sheet && (
        <section
          className="panel phone-sheet"
          role="dialog"
          aria-label={`${sheet} panel`}
          onPointerDownCapture={() => {
            sheetPointer.current = sheet;
          }}
          onClickCapture={(event) => {
            // A map tap can open the inspector under the finger before its click fires.
            // Sheet actions require a fresh press inside the sheet; keyboard activation is allowed.
            if (event.detail > 0 && sheetPointer.current !== sheet) {
              event.preventDefault();
              event.stopPropagation();
            }
            sheetPointer.current = null;
          }}
        >
          <header className="phone-sheet-header">
            <div>
              <span className="phone-stat-label">{sheet === 'city' ? 'Openpolis' : cityName}</span>
              <strong>
                {sheet === 'city'
                  ? cityName
                  : sheet === 'info'
                    ? (inspected?.name ?? SHEET_LABELS.info)
                    : SHEET_LABELS[sheet]}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => {
                if (sheet === 'info') game?.inspect(null);
                close();
              }}
              aria-label="Close panel"
            >
              <HudIcon>
                <path d="M6 6l12 12M18 6L6 18" />
              </HudIcon>
            </button>
          </header>
          <div
            className="phone-sheet-body"
            onClick={(e) => {
              if (
                e.target instanceof Element &&
                e.target.closest('.building-card, .road-card:not(:disabled)')
              )
                close();
            }}
          >
            {sheet === 'roads' && <RoadPicker />}
            {sheet === 'civic' && <BuildingPicker />}
            {sheet === 'zones' && (
              <div className="phone-zone-options">
                {ZONES.map((zone) => (
                  <button
                    type="button"
                    key={zone.id}
                    className={`tool-button phone-zone ${zone.tone ?? ''} ${active === zone.id ? 'is-active' : ''}`}
                    aria-pressed={active === zone.id}
                    onClick={() => {
                      game?.setTool(zone.id);
                      close();
                    }}
                  >
                    <ToolIcon id={zone.id} />
                    <span>{zone.label}</span>
                  </button>
                ))}
              </div>
            )}
            {sheet === 'budget' && <BudgetPanel />}
            {sheet === 'info' && <InfoPanel />}
            {sheet === 'citizens' && <CitizensPanel />}
            {sheet === 'city' && (
              <div className="phone-options">
                <AccountButton beforeLogout={beforeLogout} />
                <div className="phone-status">
                  <StageChip />
                </div>
                <p>
                  Population {(city?.population ?? 0).toLocaleString()} · Happiness{' '}
                  {Math.round((city?.needs.happiness ?? 0) * 100)}%
                </p>
                <p>
                  Year {city?.date.year}, month {(city?.date.month ?? 0) + 1}, day{' '}
                  {city?.date.dayOfMonth} · {city?.progress.stageName}
                </p>
                <SaveStatus onSave={onSave} />
                <div className="phone-speeds" role="group" aria-label="Simulation speed">
                  {[0, 1, 2, 3].map((speed) => (
                    <button
                      type="button"
                      key={speed}
                      aria-pressed={city?.speed === speed}
                      onClick={() => game?.setSpeed(speed)}
                    >
                      {speed === 0 ? 'Pause' : `${speed}×`}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => open('budget')}>
                  Budget and taxes
                </button>
                <button type="button" onClick={() => open('citizens')}>
                  Citizens say
                </button>
                <button type="button" onClick={() => game?.rotate(1)}>
                  Rotate map
                </button>
                <button type="button" onClick={() => game?.setTrafficView(true)}>
                  Traffic view
                </button>
                <button type="button" onClick={() => game?.setTrafficView(false)}>
                  Normal map
                </button>
                <button type="button" onClick={() => game?.setHappinessView(true)}>
                  Happiness view
                </button>
                <button type="button" onClick={() => game?.setHappinessView(false)}>
                  Hide happiness view
                </button>
                <button type="button" onClick={() => game?.setAirView(true)}>
                  Air quality view
                </button>
                <button type="button" onClick={() => game?.setAirView(false)}>
                  Hide air quality view
                </button>
                <button type="button" onClick={() => game?.setDayNight('day')}>
                  Always day
                </button>
                <button type="button" onClick={() => game?.setDayNight('night')}>
                  Always night
                </button>
                <button type="button" onClick={() => game?.setDayNight('cycle')}>
                  Day and night
                </button>
                <button type="button" onClick={() => game?.setMuted(!muted)}>
                  {muted ? 'Enable sound' : 'Mute sound'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    store.set(tourStepAtom, 0);
                  }}
                >
                  Tour the basics
                </button>
                <button type="button" onClick={onNewCity}>
                  Save and return to your cities
                </button>
                <small>Openpolis · MIT license</small>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
