import { useStore } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { Game, type GameOptions } from '../../game/Game';
import { DEFAULT_MAP_SIZE, MAP_SIZES } from '../../shared/constants';
import { connectGameToStore } from '../bridge';
import { BuildingPicker } from '../hud/BuildingPicker';
import { ControlsHint } from '../hud/ControlsHint';
import { CostLabel } from '../hud/CostLabel';
import { DebugOverlay } from '../hud/DebugOverlay';
import { InfoPanel } from '../hud/InfoPanel';
import { Notices } from '../hud/Notices';
import { Toolbar } from '../hud/Toolbar';
import { TopBar } from '../hud/TopBar';

/** The approved River Valley map (docs/specs/terrain.md). Used when the URL has no seed. */
const DEFAULT_SEED = 42;

/**
 * Until the New Game screen exists, options live in the URL:
 * `?size=256&seed=42&funds=100000` (funds is handy for testing expensive buildings).
 */
function readOptions(): GameOptions {
  const q = new URLSearchParams(location.search);
  const size = Number(q.get('size'));
  const seed = Number(q.get('seed'));
  const funds = Number(q.get('funds'));
  return {
    size: (MAP_SIZES as readonly number[]).includes(size) ? size : DEFAULT_MAP_SIZE,
    seed: q.has('seed') && Number.isInteger(seed) ? seed : DEFAULT_SEED,
    funds: q.has('funds') && Number.isFinite(funds) && funds >= 0 ? funds : undefined,
  };
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

function writeSeedToUrl(seed: number) {
  const url = new URL(location.href);
  url.searchParams.set('seed', String(seed));
  history.replaceState(null, '', url);
}

export function GameScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const store = useStore();
  const [options, setOptions] = useState(readOptions);
  const [ready, setReady] = useState(false);

  // N: roll a new map.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyN' || e.repeat || e.metaKey || e.ctrlKey) return;
      setReady(false);
      setOptions((o) => ({ ...o, seed: randomSeed() }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    writeSeedToUrl(options.seed);
    const host = hostRef.current!;
    let game: Game | null = null;
    let disconnect: (() => void) | null = null;
    let cancelled = false;

    // Game.create is async; handle unmount-before-ready (React StrictMode mounts twice in dev).
    Game.create(host, options).then((g) => {
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
  }, [store, options]);

  return (
    <div className="game-screen">
      <div ref={hostRef} className="game-canvas" />
      <div className={`fade-in ${ready ? 'is-ready' : ''}`} />
      <TopBar />
      <DebugOverlay />
      <InfoPanel />
      <BuildingPicker />
      <Toolbar />
      <Notices />
      <CostLabel />
      <ControlsHint />
    </div>
  );
}
