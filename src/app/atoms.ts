import { atom } from 'jotai';
import type { CityInfo, DebugStats, InspectInfo, Notice, ToolPreviewInfo } from '../game/events';
import type { Game } from '../game/Game';
import type { ToolId } from '../game/tools';
import type { BuildingId } from '../sim/buildings/catalog';

/** UI state only. Game state lives in the City/World; these atoms mirror what the HUD shows. */
export const debugVisibleAtom = atom(false);
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
export const buildingChoiceAtom = atom<BuildingId>('cottage');
export const cityAtom = atom<CityInfo | null>(null);
export const inspectAtom = atom<InspectInfo | null>(null);
/** Hour of day on the clock (0–24). */
export const clockAtom = atom(7);
/** Bumped when the world changes; the minimap repaints on it. */
export const worldVersionAtom = atom(0);
/** View rotation in quarter turns (0–3). */
export const rotationAtom = atom(0);
