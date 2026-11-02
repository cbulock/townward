import { useSyncExternalStore } from 'react';

/** Live result of a CSS media query (re-renders when it flips, e.g. on rotation). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** A phone held upright: the game asks to be turned sideways. */
export const PORTRAIT_PHONE = '(orientation: portrait) and (max-width: 760px)';
/** A short landscape screen (phones on their side): the HUD goes compact. Mirrors app.css. */
export const COMPACT = '(max-height: 520px)';
/** No hover and a coarse pointer: a touch screen. */
export const TOUCH = '(hover: none) and (pointer: coarse)';
