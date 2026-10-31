import { atom } from 'jotai';
import type { DebugStats, Notice, ToolPreviewInfo } from '../game/events';
import type { Game } from '../game/Game';
import type { ToolId } from '../game/tools';

/** UI state only. Game state lives in the City/World; these atoms mirror what the HUD shows. */
export const debugVisibleAtom = atom(true);
export const debugStatsAtom = atom<DebugStats | null>(null);
export const hoveredTileAtom = atom<{ x: number; y: number } | null>(null);
export const gridOnAtom = atom(false);

/** The running game, so HUD buttons can call into it (setTool etc). */
export const gameAtom = atom<Game | null>(null);
export const fundsAtom = atom(0);
export const activeToolAtom = atom<ToolId>('select');
export const toolPreviewAtom = atom<ToolPreviewInfo | null>(null);
export const noticesAtom = atom<readonly Notice[]>([]);
export const mutedAtom = atom(false);
