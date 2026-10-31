import type { createStore } from 'jotai';
import type { Game } from '../game/Game';
import {
  activeToolAtom,
  buildingChoiceAtom,
  cityAtom,
  debugStatsAtom,
  fundsAtom,
  gameAtom,
  gridOnAtom,
  hoveredTileAtom,
  inspectAtom,
  mutedAtom,
  noticesAtom,
  rotationAtom,
  clockAtom,
  dayNightAtom,
  budgetAtom,
  worldVersionAtom,
  toolPreviewAtom,
} from './atoms';

type Store = ReturnType<typeof createStore>;

/** How long a notice toast stays on screen. */
const NOTICE_MS = 2600;

/** Pipe game events into Jotai atoms. Returns an unsubscribe function. */
export function connectGameToStore(game: Game, store: Store): () => void {
  // Seed atoms with current state; events only carry changes.
  store.set(gameAtom, game);
  store.set(fundsAtom, game.city.funds);
  store.set(activeToolAtom, game.tool);
  store.set(mutedAtom, game.muted);
  store.set(buildingChoiceAtom, game.building);
  store.set(rotationAtom, game.rotation);
  store.set(dayNightAtom, game.dayNight);

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const offs = [
    game.events.on('stats', (s) => store.set(debugStatsAtom, s)),
    game.events.on('hover', (t) => store.set(hoveredTileAtom, t)),
    game.events.on('grid', (on) => store.set(gridOnAtom, on)),
    game.events.on('tool', (t) => store.set(activeToolAtom, t)),
    game.events.on('building', (b) => store.set(buildingChoiceAtom, b)),
    game.events.on('funds', (f) => store.set(fundsAtom, f)),
    game.events.on('muted', (m) => store.set(mutedAtom, m)),
    game.events.on('rotation', (r) => store.set(rotationAtom, r)),
    game.events.on('clock', (h) => store.set(clockAtom, h)),
    game.events.on('dayNight', (m) => store.set(dayNightAtom, m)),
    game.events.on('budget', (b) => store.set(budgetAtom, b)),
    game.events.on('worldChanged', (v) => store.set(worldVersionAtom, v)),
    game.events.on('city', (c) => store.set(cityAtom, c)),
    game.events.on('inspect', (i) => store.set(inspectAtom, i)),
    game.events.on('toolPreview', (p) => store.set(toolPreviewAtom, p)),
    game.events.on('notice', (n) => {
      store.set(noticesAtom, (list) => [...list.slice(-2), n]);
      const timer = setTimeout(() => {
        timers.delete(timer);
        store.set(noticesAtom, (list) => list.filter((x) => x.id !== n.id));
      }, NOTICE_MS);
      timers.add(timer);
    }),
  ];
  game.emitCity();
  game.emitBudget();
  return () => {
    offs.forEach((off) => off());
    timers.forEach(clearTimeout);
    store.set(gameAtom, null);
    store.set(toolPreviewAtom, null);
    store.set(inspectAtom, null);
  };
}
