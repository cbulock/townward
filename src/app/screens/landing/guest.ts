import { atom } from 'jotai';

/**
 * Whether this browser chose to play as a guest from the landing page, so returning guests go
 * straight to their cities. Logging out clears it, so the landing page greets them again.
 */
const KEY = 'citybuilder.guest';

export function choseGuest(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setChoseGuest(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the landing page simply shows again next time.
  }
}

/** Live copy of the flag, so logging out brings the landing page back without a reload. */
export const guestAtom = atom(choseGuest());
