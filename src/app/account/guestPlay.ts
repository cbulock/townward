/**
 * Guest trial, client side (D-083). The server keeps the clock; the device only keeps a copy of
 * the guest id (in case the cookie goes) and whether the reminder was closed.
 */
import { NATIVE_APP } from '../platform';

const ID_KEY = 'citybuilder.guestId';
const NUDGED_KEY = 'citybuilder.guestNudged';

/** On in production builds; `VITE_GUEST_TRIAL=on` turns it on in development. */
export const GUEST_TRIAL_ON: boolean = !NATIVE_APP && (import.meta.env.PROD || import.meta.env.VITE_GUEST_TRIAL === 'on');

/** The server counts the time between beats, so they go only while the tab is visible. */
export const HEARTBEAT_MS = 30_000;
/** Visible play without the server's say-so before play pauses (blocking the API doesn't skip the trial). */
export const OFFLINE_GRACE_MS = 5 * 60_000;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Blocked storage: the cookie and the server's fingerprint still carry the trial.
  }
}

export const readGuestId = () => read(ID_KEY);
export const writeGuestId = (id: string) => write(ID_KEY, id);
export const readNudged = () => read(NUDGED_KEY) === '1';
export const writeNudged = () => write(NUDGED_KEY, '1');
