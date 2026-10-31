import type { createStore } from 'jotai';
import type { Game } from '../game/Game';
import { debugStatsAtom, gridOnAtom, hoveredTileAtom } from './atoms';

type Store = ReturnType<typeof createStore>;

/** Pipe game events into Jotai atoms. Returns an unsubscribe function. */
export function connectGameToStore(game: Game, store: Store): () => void {
  const offs = [
    game.events.on('stats', (s) => store.set(debugStatsAtom, s)),
    game.events.on('hover', (t) => store.set(hoveredTileAtom, t)),
    game.events.on('grid', (on) => store.set(gridOnAtom, on)),
  ];
  return () => offs.forEach((off) => off());
}
