/**
 * A coarse read of a User-Agent: browser, OS and device class. Enough for "how many play on
 * Safari on iPhone"; the raw string is never stored (docs/specs/analytics.md).
 */
export interface Client {
  readonly browser: string;
  readonly os: string;
  readonly device: 'desktop' | 'mobile' | 'tablet' | 'bot';
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python|axios|node-fetch/i;

/** First match wins, so more specific names come first (Edge and Opera say "Chrome" too). */
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Firefox|FxiOS/, 'Firefox'],
  [/Chrome|CriOS/, 'Chrome'],
  [/Safari/, 'Safari'],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

export function readUserAgent(ua: string | undefined): Client {
  const s = ua ?? '';
  const pick = (table: readonly (readonly [RegExp, string])[]) => table.find(([re]) => re.test(s))?.[1] ?? 'Other';
  const device = BOT.test(s) || !s ? 'bot' : /iPad|Tablet/.test(s) ? 'tablet' : /Mobi|iPhone|Android/.test(s) ? 'mobile' : 'desktop';
  return { browser: pick(BROWSERS), os: pick(SYSTEMS), device };
}
