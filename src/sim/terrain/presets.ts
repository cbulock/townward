/**
 * Terrain presets and the New Game sliders (docs/specs/terrain.md, "Presets").
 * Each preset is a set of slider defaults plus a few shape knobs the sliders don't expose.
 */

export const PRESET_IDS = ['riverValley', 'plains', 'coastal', 'island', 'lakes', 'forested'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

/** What the player can tune on the New Game screen. */
export interface TerrainSliders {
  /** 0..1: lake size and count, sea depth, island size (more water = smaller island). */
  water: number;
  /** 0..1: forest cover. */
  trees: number;
  /** 0..3: 0 none, 1 main river (sometimes a tributary), 2 main + tributary, 3 plus a second river. */
  rivers: number;
  /** 0..4: sea along this many map edges; 4 makes an island. */
  coastSides: number;
}

export interface TerrainSettings extends TerrainSliders {
  preset: PresetId;
  seed: number;
  size: number;
}

export interface PresetDef {
  name: string;
  description: string;
  sliders: Readonly<TerrainSliders>;
  /** Lake count multiplier. */
  lakes: number;
  /** 0..1: dry grass and dirt patches. */
  dryness: number;
  /** 0..1: rock outcrops (unbuildable). */
  rocks: number;
}

export const PRESETS: Readonly<Record<PresetId, PresetDef>> = {
  riverValley: {
    name: 'River Valley',
    description: 'Green meadows cut by a winding river, with forests and a few lakes.',
    sliders: { water: 0.5, trees: 0.5, rivers: 1, coastSides: 0 },
    lakes: 1,
    dryness: 0,
    rocks: 0,
  },
  plains: {
    name: 'Plains',
    description: 'Wide open grassland, dry patches, scattered trees and a lazy stream.',
    sliders: { water: 0.3, trees: 0.2, rivers: 1, coastSides: 0 },
    lakes: 0.5,
    dryness: 0.7,
    rocks: 0.35,
  },
  coastal: {
    name: 'Coastal',
    description: 'A long sandy coastline with a river running out to sea.',
    sliders: { water: 0.5, trees: 0.45, rivers: 1, coastSides: 1 },
    lakes: 0.5,
    dryness: 0.15,
    rocks: 0.15,
  },
  island: {
    name: 'Island',
    description: 'One big island ringed by beaches, surrounded by open water.',
    sliders: { water: 0.5, trees: 0.5, rivers: 0, coastSides: 4 },
    lakes: 0.5,
    dryness: 0.1,
    rocks: 0.2,
  },
  lakes: {
    name: 'Lakes',
    description: 'Lake country: many lakes and ponds between the woods.',
    sliders: { water: 0.7, trees: 0.55, rivers: 0, coastSides: 0 },
    lakes: 6,
    dryness: 0,
    rocks: 0.15,
  },
  forested: {
    name: 'Forested',
    description: 'Deep forest with rocky ridges and small clearings to build in.',
    sliders: { water: 0.4, trees: 0.85, rivers: 1, coastSides: 0 },
    lakes: 0.7,
    dryness: 0.05,
    rocks: 0.5,
  },
};

export function presetSettings(preset: PresetId, seed: number, size: number): TerrainSettings {
  return { preset, seed, size, ...PRESETS[preset].sliders };
}
