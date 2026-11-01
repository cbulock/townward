/**
 * Art tokens (D-066): the light every painter shades with, and the shared materials. Painters
 * read colours from here instead of scattering literals, so a theme is one object to swap.
 *
 * The sun is low in the front-left: SW walls (left) are lit and warm, SE walls (right) are in
 * shade and pick up cool sky light, and shadows fall to the right.
 */

export interface LightTokens {
  /** Warm colour the sun adds to lit faces, and how much. */
  readonly sun: string;
  readonly sunMix: number;
  /** Cool sky colour mixed into shaded faces, and how much. */
  readonly sky: string;
  readonly skyMix: number;
  /** Brightness at the top and the base of a lit wall (shade() factors). */
  readonly litTop: number;
  readonly litBase: number;
  /** The same for a shaded wall. */
  readonly shadedTop: number;
  readonly shadedBase: number;
  /** Brightness of a top (roof) face. */
  readonly top: number;
  /** Ambient occlusion where walls meet the ground: colour at full strength and its height (px). */
  readonly ao: string;
  readonly aoHeight: number;
  /** Highlight along the lit vertical corner and the top rim of a box. */
  readonly rim: string;
  /** Cast and contact shadows on the ground. */
  readonly shadow: string;
  readonly shadowSoft: string;
}

export interface GlassTokens {
  /** Daytime window glass: sky reflection at the top, deep tint at the bottom. */
  readonly reflect: string;
  readonly deep: string;
  /** Dark reveal inside the window frame, and the light sill under it. */
  readonly reveal: string;
  readonly sill: string;
  /** Interior blinds seen through some windows (variety without looking lit by day). */
  readonly blinds: readonly string[];
}

/** One foliage family: shadow, body and highlight greens (or autumn and blossom tones). */
export interface Foliage {
  readonly dark: string;
  readonly mid: string;
  readonly light: string;
}

export interface NatureTokens {
  /** Everyday greens, from deep to fresh. */
  readonly greens: readonly Foliage[];
  readonly conifers: readonly Foliage[];
  /** Occasional colour in mixed woods and parks. */
  readonly autumn: readonly Foliage[];
  readonly blossom: readonly Foliage[];
  readonly bark: string;
  readonly barkLight: string;
  readonly birchBark: string;
  readonly flowers: readonly string[];
  readonly lawn: string;
  readonly lawnLight: string;
  readonly hedge: Foliage;
  readonly path: string;
  readonly pathEdge: string;
  readonly water: string;
  readonly waterLight: string;
  readonly rock: Foliage;
}

export interface MaterialTokens {
  readonly paving: string;
  readonly pavingLight: string;
  readonly kerb: string;
  readonly asphalt: string;
  readonly gravel: string;
  readonly metal: string;
  readonly metalDark: string;
  readonly concrete: string;
  readonly wood: string;
  readonly woodLight: string;
  readonly solar: string;
  readonly solarCell: string;
  readonly poolWater: string;
  readonly carPaints: readonly string[];
  readonly beacon: string;
}

export interface ArtTheme {
  readonly name: string;
  readonly light: LightTokens;
  readonly glass: GlassTokens;
  readonly nature: NatureTokens;
  readonly material: MaterialTokens;
}

/** The default look: warm afternoon sun, soft cool shade, fresh greens. */
export const SUNNY_AFTERNOON: ArtTheme = {
  name: 'Sunny afternoon',
  light: {
    sun: '#fff1d6',
    sunMix: 0.08,
    sky: '#4f6a9a',
    skyMix: 0.14,
    litTop: 0.1,
    litBase: -0.06,
    shadedTop: -0.22,
    shadedBase: -0.36,
    top: 0.14,
    ao: 'rgba(18, 22, 38, 0.34)',
    aoHeight: 6,
    rim: 'rgba(255, 250, 236, 0.55)',
    shadow: 'rgba(22, 34, 58, 0.30)',
    shadowSoft: 'rgba(22, 34, 58, 0)',
  },
  glass: {
    reflect: '#d3e6f4',
    deep: '#2e4a66',
    reveal: 'rgba(14, 20, 32, 0.38)',
    sill: 'rgba(255, 255, 255, 0.55)',
    blinds: ['#efe6d2', '#e6ecef', '#f3dccb'],
  },
  nature: {
    greens: [
      { dark: '#2b6b34', mid: '#46a03f', light: '#8fd65e' },
      { dark: '#2f7041', mid: '#4ea84f', light: '#9ade70' },
      { dark: '#3a7428', mid: '#62ad35', light: '#b2e169' },
      { dark: '#285f3c', mid: '#3f8f52', light: '#7fc77a' },
      { dark: '#46752b', mid: '#77b03f', light: '#c4e57a' },
    ],
    conifers: [
      { dark: '#163f2d', mid: '#2a6a45', light: '#5ea56a' },
      { dark: '#1a4733', mid: '#2f7650', light: '#68b27a' },
      { dark: '#1d4a2a', mid: '#356f3c', light: '#76ad5f' },
    ],
    autumn: [
      { dark: '#8a3b1c', mid: '#d0662c', light: '#f5a95a' },
      { dark: '#8f6418', mid: '#d9a632', light: '#f6d66e' },
      { dark: '#7a2a2a', mid: '#b8433a', light: '#e9806a' },
    ],
    blossom: [
      { dark: '#b5577a', mid: '#e58fb0', light: '#ffd3e2' },
      { dark: '#a9a3c9', mid: '#d6d0ef', light: '#ffffff' },
    ],
    bark: '#6a4630',
    barkLight: '#94694a',
    birchBark: '#ece8df',
    flowers: ['#f6d044', '#fbf7ee', '#ef5f74', '#c486e0', '#ff9a4a', '#6fb7f2'],
    lawn: '#6dc14b',
    lawnLight: '#8fd765',
    hedge: { dark: '#2a6a2f', mid: '#3f8f3a', light: '#79c25a' },
    path: '#e6d9bc',
    pathEdge: '#c9b996',
    water: '#3f94d6',
    waterLight: '#8fd0f5',
    rock: { dark: '#68717c', mid: '#9aa3ad', light: '#d6dce2' },
  },
  material: {
    paving: '#d9d4c8',
    pavingLight: '#e9e4d8',
    kerb: '#b7b2a6',
    asphalt: '#5f646c',
    gravel: '#a8a59b',
    metal: '#c9cfd6',
    metalDark: '#6b737c',
    concrete: '#cfcac0',
    wood: '#8a5a34',
    woodLight: '#b07d4f',
    solar: '#22355e',
    solarCell: '#3d5f9e',
    poolWater: '#3cb6e3',
    carPaints: ['#d64545', '#3d7dd8', '#f0c43a', '#ececec', '#3a3f47', '#4bb36b', '#8a8f98', '#e07b39'],
    beacon: '#ff4a3d',
  },
};

/** The theme painters use. Swapping it (and rebuilding the atlas) restyles the whole city. */
export const THEME: ArtTheme = SUNNY_AFTERNOON;
export const LIGHT = THEME.light;
export const GLASS = THEME.glass;
export const NATURE = THEME.nature;
export const MATERIAL = THEME.material;
