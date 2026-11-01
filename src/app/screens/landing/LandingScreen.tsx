import { useAtomValue, useSetAtom } from 'jotai';
import { authAtom, authDialogAtom } from '../../atoms';
import { heroAnchor, HeroCity } from './HeroCity';

interface LandingScreenProps {
  /** Continue as a guest (cities are saved on this device). */
  onPlay: () => void;
  /** Open the demo city. */
  onDemo: () => void;
}

/** Labels pinned onto the diorama like a planning map: a ground point (tiles), a height (px), and which side the tag sits. */
const PINS: readonly { label: string; x: number; y: number; z: number; side: 'left' | 'right' }[] = [
  { label: 'Downtown', x: 1, y: 1, z: 150, side: 'left' },
  { label: 'Corner shops', x: 8.5, y: 2.6, z: 24, side: 'right' },
  { label: 'Central park', x: 1.4, y: 6.4, z: 6, side: 'left' },
  { label: 'Main street', x: 4.5, y: 8.6, z: 0, side: 'right' },
];

const STEPS: readonly { title: string; text: string }[] = [
  { title: 'Zone', text: 'Lay roads, then paint homes, shops and industry along them. Lots fill up when people want to live and work there.' },
  { title: 'Serve', text: 'Run power and water, open schools, clinics and stations. Citizens tell you exactly what their street is missing.' },
  { title: 'Grow', text: 'Land value rises, cottages give way to apartments and towers, and the city keeps moving long after dark.' },
];

/**
 * The first screen for visitors who aren't signed in: the game drawn with its own art, labelled
 * like a planning map, and three ways in: sign up, log in, or play straight away as a guest.
 */
export function LandingScreen({ onPlay, onDemo }: LandingScreenProps) {
  const auth = useAtomValue(authAtom);
  const openDialog = useSetAtom(authDialogAtom);
  const online = auth.status !== 'guest' || auth.online;

  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="landing-wordmark">City Builder</span>
        {online && (
          <nav className="landing-nav-actions" aria-label="Account">
            <button type="button" className="landing-text-button" onClick={() => openDialog('login')}>
              Log in
            </button>
            <button type="button" className="landing-button is-small" onClick={() => openDialog('signup')}>
              Sign up
            </button>
          </nav>
        )}
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="landing-eyebrow">A city-building game for the browser</p>
            <h1>
              Lay a road.
              <br />A city moves in.
            </h1>
            <p className="landing-lead">
              Zone the streets, keep the power on and balance the budget. Homes, shops and towers grow on their own, traffic finds its way, and the windows light up at night.
            </p>
            <div className="landing-ctas">
              {online ? (
                <>
                  <button type="button" className="landing-button" onClick={() => openDialog('signup')}>
                    Create an account
                  </button>
                  <button type="button" className="landing-button is-ghost" onClick={onPlay}>
                    Play without one
                  </button>
                </>
              ) : (
                <button type="button" className="landing-button" onClick={onPlay}>
                  Start playing
                </button>
              )}
            </div>
            <p className="landing-aside">
              {online && (
                <>
                  Have an account?{' '}
                  <button type="button" className="landing-link" onClick={() => openDialog('login')}>
                    Log in
                  </button>
                  <span className="landing-sep" aria-hidden="true">
                    /
                  </span>
                </>
              )}
              <button type="button" className="landing-link" onClick={onDemo}>
                Walk around a finished city
              </button>
            </p>
          </div>

          <figure className="landing-map">
            <div className="landing-map-frame">
              <HeroCity className="landing-city" />
              {PINS.map((p) => (
                <span key={p.label} className={`landing-pin is-${p.side}`} style={heroAnchor(p.x, p.y, p.z)}>
                  <span className="landing-pin-tag">{p.label}</span>
                </span>
              ))}
            </div>
            <figcaption>Every building, tree and street here is drawn by the game, live in your browser.</figcaption>
          </figure>
        </section>

        <section className="landing-steps" aria-labelledby="landing-steps-title">
          <h2 id="landing-steps-title" className="landing-section-title">
            How a city grows
          </h2>
          <ol>
            {STEPS.map((s, k) => (
              <li key={s.title}>
                <span className="landing-step-no">{String(k + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-saves">
          <div>
            <h2 className="landing-section-title">Your cities stay yours</h2>
            <p>Start without signing up: your cities save on this device as you play. Make an account whenever you like and move them across, then open them from any browser.</p>
          </div>
          <dl className="landing-compare">
            <div>
              <dt>As a guest</dt>
              <dd>Saved on this device</dd>
            </div>
            <div>
              <dt>With an account</dt>
              <dd>Saved to the cloud, open anywhere</dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="landing-footer">
        <span className="landing-wordmark is-small">City Builder</span>
        <span>Free to play. Runs in any modern browser, nothing to install.</span>
      </footer>
    </div>
  );
}
