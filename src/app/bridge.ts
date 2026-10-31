import type { createStore } from 'jotai';
import type { Game } from '../game/Game';
import {
  activeToolAtom,
  debugStatsAtom,
  fundsAtom,
  gameAtom,
  gridOnAtom,
  hoveredTileAtom,
  mutedAtom,
  noticesAtom,
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

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const offs = [
    game.events.on('stats', (s) => store.set(debugStatsAtom, s)),
    game.events.on('hover', (t) => store.set(hoveredTileAtom, t)),
    game.events.on('grid', (on) => store.set(gridOnAtom, on)),
    game.events.on('tool', (t) => store.set(activeToolAtom, t)),
    game.events.on('funds', (f) => store.set(fundsAtom, f)),
    game.events.on('muted', (m) => store.set(mutedAtom, m)),
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
  return () => {
    offs.forEach((off) => off());
    timers.forEach(clearTimeout);
    store.set(gameAtom, null);
    store.set(toolPreviewAtom, null);
  };
}
