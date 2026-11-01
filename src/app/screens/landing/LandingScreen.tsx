import { useAtomValue, useSetAtom } from 'jotai';
import { authAtom, authDialogAtom } from '../../atoms';
import { HeroCity } from './HeroCity';

interface LandingScreenProps {
  /** Continue as a guest (cities are saved on this device). */
  onPlay: () => void;
  /** Open the demo city. */
  onDemo: () => void;
}

interface Feature {
  readonly title: string;
  readonly text: string;
  readonly icon: string;
}

const FEATURES: readonly Feature[] = [
  { icon: '🏙️', title: 'Grow a living city', text: 'Zone homes, shops and industry and watch streets fill with traffic, people and new towers.' },
  { icon: '🌗', title: 'Day turns to night', text: 'Windows light up at dusk, trees sway in the wind and parks fill with fountains and birdsong.' },
  { icon: '⚡', title: 'Run it like a mayor', text: 'Power, water, services, budgets and citizens who tell you exactly what they need.' },
  { icon: '☁️', title: 'Saved as you play', text: 'Play as a guest on this device, or sign in to keep your cities on every browser.' },
];

/**
 * The first screen for visitors who aren't signed in: what the game is, a city drawn with its
 * own art, and three ways in — sign up, log in, or play straight away as a guest.
 */
export function LandingScreen({ onPlay, onDemo }: LandingScreenProps) {
  const auth = useAtomValue(authAtom);
  const openDialog = useSetAtom(authDialogAtom);
  const online = auth.status !== 'guest' || auth.online;

  return (
    <div className="landing">
      <div className="landing-glow" aria-hidden="true" />
      <header className="landing-nav">
        <span className="landing-brand">
          <span className="landing-logo" aria-hidden="true" />
          City Builder
        </span>
        {online && (
          <nav className="landing-nav-actions" aria-label="Account">
            <button type="button" className="landing-link" onClick={() => openDialog('login')}>
              Log in
            </button>
            <button type="button" className="landing-pill" onClick={() => openDialog('signup')}>
              Sign up free
            </button>
          </nav>
        )}
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="landing-kicker">Free city builder · plays in your browser</span>
            <h1>
              Build the city
              <br />
              <em>you’ve always imagined.</em>
            </h1>
            <p className="landing-lead">
              Lay roads, zone neighbourhoods and grow a skyline that lives and breathes: traffic at rush hour, lights after dark, and citizens with opinions.
            </p>
            <div className="landing-ctas">
              {online ? (
                <>
                  <button type="button" className="landing-primary" onClick={() => openDialog('signup')}>
                    Create a free account
                  </button>
                  <button type="button" className="landing-secondary" onClick={onPlay}>
                    Play as guest
                  </button>
                </>
              ) : (
                <button type="button" className="landing-primary" onClick={onPlay}>
                  Start playing
                </button>
              )}
            </div>
            <p className="landing-fine">
              {online ? (
                <>
                  Already a mayor?{' '}
                  <button type="button" className="landing-inline" onClick={() => openDialog('login')}>
                    Log in
                  </button>
                  {' · '}
                </>
              ) : (
                'Accounts are offline right now; your cities will be saved on this device. · '
              )}
              <button type="button" className="landing-inline" onClick={onDemo}>
                Tour a finished city
              </button>
            </p>
          </div>
          <div className="landing-art">
            <HeroCity className="landing-city" />
          </div>
        </section>

        <section className="landing-features" aria-label="Features">
          {FEATURES.map((f) => (
            <article key={f.title} className="landing-feature">
              <span className="landing-feature-icon" aria-hidden="true">
                {f.icon}
              </span>
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="landing-footer">All art is drawn by code, live in your browser. No downloads, no installs.</footer>
    </div>
  );
}
