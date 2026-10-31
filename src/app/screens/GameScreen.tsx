import { useStore } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { Game } from '../../game/Game';
import { DEFAULT_MAP_SIZE, MAP_SIZES } from '../../shared/constants';
import { connectGameToStore } from '../bridge';
import { ControlsHint } from '../hud/ControlsHint';
import { DebugOverlay } from '../hud/DebugOverlay';

/** Phase 1: map size and seed come from the URL (`?size=256&seed=42`) until the New Game screen exists. */
function readOptions() {
  const q = new URLSearchParams(location.search);
  const size = Number(q.get('size'));
  const seed = Number(q.get('seed'));
  return {
    size: (MAP_SIZES as readonly number[]).includes(size) ? size : DEFAULT_MAP_SIZE,
    seed: Number.isFinite(seed) && q.has('seed') ? seed : 1337,
  };
}

export function GameScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const store = useStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current!;
    let game: Game | null = null;
    let disconnect: (() => void) | null = null;
    let cancelled = false;

    // Game.create is async; handle unmount-before-ready (React StrictMode mounts twice in dev).
    Game.create(host, readOptions()).then((g) => {
      if (cancelled) {
        g.destroy();
        return;
      }
      game = g;
      disconnect = connectGameToStore(g, store);
      setReady(true);
    });

    return () => {
      cancelled = true;
      disconnect?.();
      game?.destroy();
    };
  }, [store]);

  return (
    <div className="game-screen">
      <div ref={hostRef} className="game-canvas" />
      <div className={`fade-in ${ready ? 'is-ready' : ''}`} />
      <DebugOverlay />
      <ControlsHint />
    </div>
  );
}
