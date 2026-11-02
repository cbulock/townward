/**
 * How long this browser has played as a guest, so it can be asked to make an account (D-082).
 * Kept on the device: a guest has nothing else to count against. Clearing site data resets it,
 * which is acceptable: the goal is a nudge, not a lock.
 */
const KEY = 'citybuilder.guestPlay';

export const GUEST_LIMITS = {
  /** A dismissible reminder that the city is only on this device. */
  nudgeMinutes: 10,
  /** Past this, play pauses until the player signs up or logs in. */
  gateMinutes: 30,
} as const;

interface GuestPlay {
  /** Milliseconds of play with the tab visible. */
  readonly ms: number;
  readonly nudged: boolean;
}

function isGuestPlay(v: unknown): v is GuestPlay {
  return typeof v === 'object' && v !== null && 'ms' in v && typeof v.ms === 'number' && 'nudged' in v && typeof v.nudged === 'boolean';
}

export function readGuestPlay(): GuestPlay {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return isGuestPlay(v) ? v : { ms: 0, nudged: false };
  } catch {
    return { ms: 0, nudged: false };
  }
}

export function writeGuestPlay(p: GuestPlay) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Blocked storage: the count starts over each visit.
  }
}

export type GuestPrompt = 'none' | 'nudge' | 'gate';

export function guestPrompt(p: GuestPlay): GuestPrompt {
  if (p.ms >= GUEST_LIMITS.gateMinutes * 60_000) return 'gate';
  if (p.ms >= GUEST_LIMITS.nudgeMinutes * 60_000 && !p.nudged) return 'nudge';
  return 'none';
}
