import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { fundsAtom, gameAtom, mutedAtom } from '../atoms';

/** Floating top bar: city name and funds. Funds flash when they change. */
export function TopBar() {
  const funds = useAtomValue(fundsAtom);
  const muted = useAtomValue(mutedAtom);
  const game = useAtomValue(gameAtom);
  const prev = useRef(funds);
  const [flash, setFlash] = useState<'spend' | 'gain' | null>(null);

  useEffect(() => {
    if (funds === prev.current) return;
    setFlash(funds < prev.current ? 'spend' : 'gain');
    prev.current = funds;
    const t = setTimeout(() => setFlash(null), 450);
    return () => clearTimeout(t);
  }, [funds]);

  return (
    <div className="panel top-bar">
      <span className="city-name">River Valley</span>
      <span className="top-divider" />
      <span className={`funds ${flash ? `flash-${flash}` : ''}`}>
        <span className="funds-sign">$</span>
        {funds.toLocaleString()}
      </span>
      <span className="top-divider" />
      <button
        type="button"
        className="icon-button"
        aria-label={muted ? 'Unmute sound (M)' : 'Mute sound (M)'}
        title={muted ? 'Unmute (M)' : 'Mute (M)'}
        onClick={() => game?.setMuted(!muted)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {muted ? (
            <path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>
    </div>
  );
}
