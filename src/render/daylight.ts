/**
 * Day/night colour for the multiply layer over the world (docs/04-ui-ux.md, "Time of Day").
 * Keyframes are [hour, colour]; colours between keyframes are blended per channel.
 */
const KEYS: readonly (readonly [number, number])[] = [
  [0, 0x6e7bbb],
  [4.5, 0x7480bb],
  [6, 0xd9a3a0],
  [7.5, 0xffffff],
  [17, 0xffffff],
  [18.5, 0xffc391],
  [20, 0x8186c0],
  [21.5, 0x6e7bbb],
  [24, 0x6e7bbb],
];

function lerpColor(a: number, b: number, k: number): number {
  const ch = (s: number) => {
    const x = (a >> s) & 255;
    const y = (b >> s) & 255;
    return Math.round(x + (y - x) * k) << s;
  };
  return ch(16) | ch(8) | ch(0);
}

/** Tint for an hour of day (0–24). White means no change. */
export function daylightTint(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  for (let k = 1; k < KEYS.length; k++) {
    const [h1, c1] = KEYS[k];
    if (h <= h1) {
      const [h0, c0] = KEYS[k - 1];
      return lerpColor(c0, c1, (h - h0) / (h1 - h0));
    }
  }
  return KEYS[0][1];
}

/** 0 at full daylight, 1 at deepest night (for ambience and lights). */
export function nightness(hour: number): number {
  const c = daylightTint(hour);
  const g = (c >> 8) & 255;
  return Math.min(1, Math.max(0, (255 - g) / (255 - 0x7b)));
}
