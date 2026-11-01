/**
 * Colour tokens for the energy buildings, in one place so a theme can restyle them all
 * (D-066). Painters use these names, never raw colours.
 */
export const TONE = {
  gravel: '#b8b4aa',
  gravelEdge: '#a29e94',
  concrete: '#cfcbc2',
  concreteTop: '#e1ded7',
  steel: '#9aa3ad',
  steelDark: '#6f7882',
  white: '#eef1f4',
  whiteShade: '#c9d0d8',
  turbineBlade: '#f6f8fa',
  turbineEdge: '#bcc5cf',
  panel: '#22436b',
  panelGrid: 'rgba(140, 180, 225, 0.55)',
  panelGlint: 'rgba(255, 255, 255, 0.28)',
  panelFrame: '#d7dde4',
  battery: '#eef0f2',
  batteryShade: '#c6ccd3',
  batteryTop: '#dfe3e7',
  charge: '#36d27c',
  vent: '#5d6670',
  gasHall: '#b9c3cc',
  gasBand: '#2f7fd6',
  tank: '#dfe5ea',
  tankTop: '#f1f4f6',
  pipe: '#e0b53a',
  warning: '#d6a514',
  beacon: '#ff4b3e',
  ink: '#2a2f36',
} as const;
