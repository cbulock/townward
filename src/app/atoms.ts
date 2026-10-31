import { atom } from 'jotai';
import type { DebugStats } from '../game/events';

/** UI state only. Game state lives in the World; these atoms mirror what the HUD shows. */
export const debugVisibleAtom = atom(true);
export const debugStatsAtom = atom<DebugStats | null>(null);
export const hoveredTileAtom = atom<{ x: number; y: number } | null>(null);
export const gridOnAtom = atom(false);
