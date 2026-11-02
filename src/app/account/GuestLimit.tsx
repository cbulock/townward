import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { authAtom, authDialogAtom, cityAtom, gameAtom } from '../atoms';
import { GUEST_LIMITS, guestPrompt, readGuestPlay, writeGuestPlay, type GuestPrompt } from './guestPlay';

/** How often play time is added up. */
const TICK_MS = 5000;

/**
 * Guests may play a while, then are asked to make a free account: first a reminder they can
 * close, later a pause that stays until they sign up or log in. Their city moves into the
 * account when they do. Without a reachable server nobody can sign in, so nothing is asked.
 */
export function GuestLimit() {
  const auth = useAtomValue(authAtom);
  const game = useAtomValue(gameAtom);
  const openDialog = useSetAtom(authDialogAtom);
  const speed = useAtomValue(cityAtom)?.speed ?? 0;
  const [prompt, setPrompt] = useState<GuestPrompt>(() => guestPrompt(readGuestPlay()));
  const counting = auth.status === 'guest' && auth.online && !!game;

  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const p = readGuestPlay();
      const next = { ...p, ms: p.ms + TICK_MS };
      writeGuestPlay(next);
      setPrompt(guestPrompt(next));
    }, TICK_MS);
    return () => clearInterval(t);
  }, [counting]);

  // The gate holds the clock still (Space and [ ] included), so nothing happens to the city meanwhile.
  const gated = counting && prompt === 'gate';
  useEffect(() => {
    if (gated && speed > 0) game?.setSpeed(0);
  }, [gated, game, speed]);

  if (!counting || prompt === 'none') return null;

  if (prompt === 'nudge') {
    const later = () => {
      writeGuestPlay({ ...readGuestPlay(), nudged: true });
      setPrompt('none');
    };
    return (
      <div className="panel guest-nudge" role="status">
        <p>
          <strong>Keep this city safe.</strong> It lives only in this browser. A free account saves it online and on all your devices.
        </p>
        <div className="guest-actions">
          <button type="button" className="tour-link" onClick={later}>
            Later
          </button>
          <button type="button" className="tour-primary" onClick={() => openDialog('signup')}>
            Create account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-gate">
      <div className="panel guest-gate-card" role="dialog" aria-modal="true" aria-labelledby="guest-gate-title">
        <h2 id="guest-gate-title">Make a free account to keep building</h2>
        <p>
          You've played {GUEST_LIMITS.gateMinutes} minutes as a guest. Sign up to carry on: this city comes with you, saved online and on every device.
        </p>
        <div className="guest-actions">
          <button type="button" className="tour-link" onClick={() => openDialog('login')}>
            Log in
          </button>
          <button type="button" className="tour-primary" autoFocus onClick={() => openDialog('signup')}>
            Create free account
          </button>
        </div>
      </div>
    </div>
  );
}
