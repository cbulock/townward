import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { activeToolAtom, authAtom, cityAtom, fundsAtom, gameAtom, worldVersionAtom } from '../atoms';
import { COMPACT, TOUCH, useMedia } from '../mobile/useMedia';
import { TOUR_STEPS, type TourSnapshot } from './steps';
import { loadTourProgress, saveTourProgress, tourStepAtom } from './tourState';

type Store = ReturnType<typeof useStore>;

/** Pause after a goal is met, so the player sees the tick before the next step. */
const CLEARED_MS = 900;
/** Space between the card and the control it points at. */
const GAP = 14;
const CARD_W = 320;
const GUTTER = 16;

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function readSnapshot(store: Store): TourSnapshot {
  return { tool: store.get(activeToolAtom), funds: store.get(fundsAtom), worldVersion: store.get(worldVersionAtom), city: store.get(cityAtom) };
}

/**
 * Where the `data-tour` control is on screen, followed every frame (panels animate and the
 * compact toolbar scrolls). A hidden or missing control gives null. Brings it into view once.
 */
function useTargetRect(name: string | undefined): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    let frame = 0;
    let last = '';
    let scrolled = false;
    const tick = () => {
      const el = name ? document.querySelector<HTMLElement>(`[data-tour="${name}"]`) : null;
      const r = el?.getBoundingClientRect();
      const shown = r !== undefined && r.width > 0 && r.height > 0;
      if (el && shown && !scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
      const key = shown ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : '';
      if (key !== last) {
        last = key;
        setRect(shown ? { left: r.left, top: r.top, width: r.width, height: r.height } : null);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [name]);
  return rect;
}

/** Opening by itself: on a new city from the start, on an opened one only to carry on a tour left midway. */
export type TourAutoStart = 'start' | 'resume' | 'never';

const signedIn = (store: Store) => store.get(authAtom).status === 'user';

/**
 * First-play tour: one card at a time that points at a control and waits for the player to use
 * it. Progress is kept (device, and account when signed in); the ? button in the top bar replays it.
 */
export function Tour({ autoStart }: { autoStart: TourAutoStart }) {
  const [step, setStep] = useAtom(tourStepAtom);
  const game = useAtomValue(gameAtom);
  const authChecked = useAtomValue(authAtom).status !== 'checking';
  const store = useStore();
  const offered = useRef(false);

  useEffect(() => {
    if (autoStart === 'never' || !game || !authChecked || offered.current) return;
    offered.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void loadTourProgress(signedIn(store)).then((p) => {
      if (cancelled || p?.done) return;
      const at = p ? TOUR_STEPS.findIndex((s) => s.id === p.step) : -1;
      if (at < 0 && autoStart === 'resume') return;
      // A moment after the city fades in, so the first thing seen is the map.
      timer = setTimeout(() => setStep(Math.max(0, at)), 800);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      offered.current = false;
    };
  }, [autoStart, game, authChecked, store, setStep]);
  // Leaving the city closes it.
  useEffect(() => () => setStep(null), [setStep]);

  return step === null || !game ? null : <TourCard index={step} />;
}

function TourCard({ index }: { index: number }) {
  const store = useStore();
  const setStep = useSetAtom(tourStepAtom);
  const touch = useMedia(TOUCH);
  const compact = useMedia(COMPACT);
  const [minimized, setMinimized] = useState(false);

  const tool = useAtomValue(activeToolAtom);
  const funds = useAtomValue(fundsAtom);
  const worldVersion = useAtomValue(worldVersionAtom);
  const city = useAtomValue(cityAtom);
  const now = useMemo<TourSnapshot>(() => ({ tool, funds, worldVersion, city }), [tool, funds, worldVersion, city]);
  const [start, setStart] = useState(() => readSnapshot(store));

  const step = TOUR_STEPS[index];
  const met = step.done?.(now, start) ?? false;
  const last = index === TOUR_STEPS.length - 1;

  const stepId = step.id;
  const end = useCallback(() => {
    saveTourProgress({ step: stepId, done: true }, signedIn(store));
    setStep(null);
  }, [stepId, store, setStep]);
  const go = useCallback(
    (next: number) => {
      if (next >= TOUR_STEPS.length) return end();
      saveTourProgress({ step: TOUR_STEPS[next].id, done: false }, signedIn(store));
      setStart(readSnapshot(store));
      setStep(next);
    },
    [store, setStep, end],
  );

  useEffect(() => {
    if (!met) return;
    const t = setTimeout(() => go(index + 1), CLEARED_MS);
    return () => clearTimeout(t);
  }, [met, go, index]);

  const rect = useTargetRect(step.modal ? undefined : step.target);
  const body = touch ? step.body.touch : step.body.mouse;
  // Progress counts the steps between the welcome and the goodbye.
  const total = TOUR_STEPS.length - 2;

  if (step.modal) {
    return (
      <div className="tour-backdrop">
        <div className="panel tour-card is-modal" role="dialog" aria-modal="true" aria-labelledby="tour-title">
          <h2 id="tour-title" className="tour-title">
            {step.title}
          </h2>
          <p className="tour-body">{body}</p>
          <div className="tour-actions">
            {index === 0 && (
              <button type="button" className="tour-link" onClick={end}>
                Skip tour
              </button>
            )}
            <button type="button" className="tour-primary" autoFocus onClick={() => go(index + 1)}>
              {last ? 'Start building' : 'Show me around'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ring = rect && (
    <div
      className="tour-ring"
      aria-hidden="true"
      style={{ left: rect.left - 5, top: rect.top - 5, width: rect.width + 10, height: rect.height + 10 }}
    />
  );

  // Landscape phones: the card docks to the right edge and can fold into a pill to free the map.
  if (compact && minimized) {
    return (
      <>
        {ring}
        <button type="button" className="panel tour-pill" onClick={() => setMinimized(false)} aria-label={`Show tour step: ${step.title}`}>
          <span className="tour-count">
            {index}/{total}
          </span>
          {step.title}
        </button>
      </>
    );
  }

  // Elsewhere it sits above or below its control, arrow pointing at it; free steps go top centre.
  let placement: CSSProperties | undefined;
  let arrow: CSSProperties | undefined;
  let side: 'above' | 'below' | 'free' = 'free';
  if (!compact && rect) {
    const width = Math.min(CARD_W, window.innerWidth - GUTTER * 2);
    const centre = rect.left + rect.width / 2;
    const left = Math.max(GUTTER, Math.min(window.innerWidth - width - GUTTER, centre - width / 2));
    side = rect.top + rect.height / 2 > window.innerHeight / 2 ? 'above' : 'below';
    placement = side === 'above' ? { left, width, bottom: window.innerHeight - rect.top + GAP } : { left, width, top: rect.top + rect.height + GAP };
    arrow = { left: Math.max(18, Math.min(width - 18, centre - left)) };
  }

  return (
    <>
      {ring}
      <div
        key={step.id}
        className={`panel tour-card ${compact ? 'is-docked' : `is-${side}`} ${met ? 'is-cleared' : ''}`}
        style={placement}
        role="dialog"
        aria-labelledby="tour-title"
      >
        {arrow && <span className="tour-arrow" style={arrow} aria-hidden="true" />}
        <div className="tour-head">
          <span className="tour-count">
            {index} of {total}
          </span>
          {compact && (
            <button type="button" className="tour-icon" onClick={() => setMinimized(true)} aria-label="Fold the tour away">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button type="button" className="tour-icon" onClick={end} aria-label="End the tour">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <h2 id="tour-title" className="tour-title">
          {met && (
            <span className="tour-tick" aria-label="Done">
              ✓
            </span>
          )}
          {step.title}
        </h2>
        <p className="tour-body">{body}</p>
        <div className="tour-progress" aria-hidden="true">
          {Array.from({ length: total }, (_, k) => (
            <span key={k} className={`tour-dot ${k + 1 < index ? 'is-done' : k + 1 === index ? 'is-now' : ''}`} />
          ))}
        </div>
        <div className="tour-actions">
          {index > 1 && (
            <button type="button" className="tour-link" onClick={() => go(index - 1)}>
              Back
            </button>
          )}
          {step.done ? (
            <button type="button" className="tour-link" onClick={() => go(index + 1)}>
              Skip step
            </button>
          ) : (
            <button type="button" className="tour-primary" onClick={() => go(index + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </>
  );
}
