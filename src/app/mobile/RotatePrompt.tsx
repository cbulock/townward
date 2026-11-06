import { useState } from 'react';
import { PORTRAIT_PHONE, useMedia } from './useMedia';

const DISMISS_KEY = 'openpolis.portraitOk';

interface Lockable {
  lock(orientation: 'landscape'): Promise<void>;
}

function canLock(o: unknown): o is Lockable {
  return typeof o === 'object' && o !== null && 'lock' in o && typeof o.lock === 'function';
}

/**
 * Go full screen and, where the browser allows it (Android Chrome; not iOS Safari), lock the
 * screen to landscape. Failures are fine: turning the phone by hand still works.
 */
async function fullscreenLandscape() {
  try {
    if (document.fullscreenEnabled && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    if (canLock(screen.orientation)) await screen.orientation.lock('landscape');
  } catch {
    // Not allowed here; the prompt stays until the phone is turned.
  }
}

/**
 * "Turn your phone sideways" over the game when a phone is held upright. Turning the phone hides
 * it at once; "Continue in portrait" hides it for the rest of the visit.
 */
export function RotatePrompt() {
  const portrait = useMedia(PORTRAIT_PHONE);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (import.meta.env.MODE === 'native' || !portrait || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage blocked: dismissed for this page only.
    }
    setDismissed(true);
  };

  return (
    <div className="rotate-prompt" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
      <svg className="rotate-phone" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="20" y="8" width="24" height="44" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="32" cy="46" r="1.6" fill="currentColor" />
        <path d="M50 22a18 18 0 0 1 2 16" fill="none" stroke="var(--sign)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M48.5 36.5l3.5 2 1.5-3.8" fill="none" stroke="var(--sign)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 id="rotate-title">Turn your phone sideways</h2>
      <p>Openpolis is built for landscape: more city on screen, and room for every tool.</p>
      {document.fullscreenEnabled && (
        <button type="button" className="rotate-primary" onClick={() => void fullscreenLandscape()}>
          Play in full screen
        </button>
      )}
      <button type="button" className="rotate-skip" onClick={dismiss}>
        Continue in portrait
      </button>
    </div>
  );
}
