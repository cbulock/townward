import { api } from '../save/api';
import type { EventKind, EventProps, TrackRequest } from '../shared/api';

/**
 * Anonymous usage events (docs/specs/analytics.md): page visits and cities started, with a random
 * per-browser visitor ID. Fire and forget: tracking never slows or breaks the game, and
 * browsers with Do Not Track on send nothing.
 */

const VISITOR_KEY = 'openpolis.visitor';

function doNotTrack(): boolean {
  return navigator.doNotTrack === '1' || (window as Window & { doNotTrack?: string }).doNotTrack === '1';
}

/** This browser's random visitor ID, made on first use. */
function visitorId(): string {
  try {
    const stored = localStorage.getItem(VISITOR_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    // Storage blocked: a one-off ID still counts the visit.
    return crypto.randomUUID().replace(/-/g, '');
  }
}

/** Host of the referring page, unless it's this site. */
function referrerHost(): string | undefined {
  try {
    const host = document.referrer ? new URL(document.referrer).host : '';
    return host && host !== location.host ? host : undefined;
  } catch {
    return undefined;
  }
}

export function track(kind: EventKind, props?: EventProps) {
  if (doNotTrack()) return;
  const q = new URLSearchParams(location.search);
  const body: TrackRequest = {
    kind,
    visitor: visitorId(),
    path: location.pathname.slice(0, 200),
    referrer: referrerHost(),
    utmSource: q.get('utm_source') ?? undefined,
    utmMedium: q.get('utm_medium') ?? undefined,
    utmCampaign: q.get('utm_campaign') ?? undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    props,
  };
  api.track(body).catch(() => undefined);
}

let visited = false;

/** One "visit" per page load (React's dev double-mount calls this twice). */
export function trackVisit() {
  if (visited) return;
  visited = true;
  track('visit');
}
