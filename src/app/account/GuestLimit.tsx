import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { authAtom, authDialogAtom, authProvidersAtom, cityAtom, fundsAtom, gameAtom } from '../atoms';
import { GithubMark, signInWithGithub } from './AuthDialog';
import { GUEST_LIMITS, guestPrompt, readGuestPlay, writeGuestPlay, type GuestPrompt } from './guestPlay';

/** How often play time is added up. */
const TICK_MS = 5000;

const PERKS = ['Saved online, safe if this browser is cleared', 'Carry on from any phone or computer', 'Free, no card, no ads'] as const;

/**
 * Guests may play a while, then are asked to make a free account: first a reminder they can
 * close, later a pause that stays until they sign up or log in. Their city moves into the
 * account when they do. Without a reachable server nobody can sign in, so nothing is asked.
 */
export function GuestLimit({ cityName }: { cityName: string }) {
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
      <div className="guest-nudge" role="status">
        <span className="gate-kicker">Only in this browser</span>
        <p>
          <strong>{cityName}</strong> isn't backed up yet. A free account keeps it safe and on all your devices.
        </p>
        <div className="guest-nudge-actions">
          <button type="button" className="gate-text" onClick={later}>
            Later
          </button>
          <button type="button" className="gate-small" onClick={() => openDialog('signup')}>
            Save my city
          </button>
        </div>
      </div>
    );
  }

  return <GuestGate cityName={cityName} />;
}

/** The pause card: the player's own city on the left (what they'd keep), the way in on the right. */
function GuestGate({ cityName }: { cityName: string }) {
  const openDialog = useSetAtom(authDialogAtom);
  const providers = useAtomValue(authProvidersAtom);
  const city = useAtomValue(cityAtom);
  const funds = useAtomValue(fundsAtom);
  const [leaving, setLeaving] = useState(false);
  const minutes = Math.max(GUEST_LIMITS.gateMinutes, Math.round(readGuestPlay().ms / 60_000));

  return (
    <div className="guest-gate">
      <div className="gate-card" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <section className="gate-permit" aria-label="Your city so far">
          <span className="gate-kicker">Your city so far</span>
          <strong className="gate-city">{cityName}</strong>
          <dl className="gate-stats">
            <div>
              <dt>Residents</dt>
              <dd>{(city?.population ?? 0).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Treasury</dt>
              <dd>${funds.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Planned for</dt>
              <dd>{minutes} min</dd>
            </div>
          </dl>
          <span className="gate-stamp">Not backed up</span>
        </section>

        <section className="gate-pitch">
          <h2 id="gate-title">Keep building {cityName}</h2>
          <p className="gate-lead">Guest time is up. Make a free account in a few seconds and this city comes with you, exactly as it is.</p>
          <ul className="gate-perks">
            {PERKS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="gate-buttons">
            <button type="button" className="auth-submit" autoFocus onClick={() => openDialog('signup')}>
              Create free account
            </button>
            {providers.github && (
              <button
                type="button"
                className="auth-provider"
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  signInWithGithub();
                }}
              >
                <GithubMark />
                {leaving ? 'Opening GitHub…' : 'Continue with GitHub'}
              </button>
            )}
          </div>
          <p className="gate-foot">
            Already have an account?{' '}
            <button type="button" className="gate-text" onClick={() => openDialog('login')}>
              Log in
            </button>
          </p>
        </section>
      </div>
    </div>
  );
}
