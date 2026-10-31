import { useStore } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { Game, type GameOptions } from '../../game/Game';
import { connectGameToStore } from '../bridge';
import { randomSeed } from '../options';
import { BuildingPicker } from '../hud/BuildingPicker';
import { ControlsHint } from '../hud/ControlsHint';
import { CostLabel } from '../hud/CostLabel';
import { DebugOverlay } from '../hud/DebugOverlay';
import { InfoPanel } from '../hud/InfoPanel';
import { BudgetPanel } from '../hud/BudgetPanel';
import { TrafficLegend } from '../hud/TrafficLegend';
import { CitizensPanel } from '../hud/CitizensPanel';
import { Minimap } from '../hud/Minimap';
import { Notices } from '../hud/Notices';
import { Toolbar } from '../hud/Toolbar';
import { TopBar } from '../hud/TopBar';

interface GameScreenProps {
  options: GameOptions;
  /** Same settings, new seed (the `N` key). */
  onReroll: (o: GameOptions) => void;
  /** Back to the New Game screen. */
  onNewCity: () => void;
}

export function GameScreen({ options, onReroll, onNewCity }: GameScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const store = useStore();
  const [ready, setReady] = useState(false);

  // N: roll a new map with the same preset and sliders.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyN' || e.repeat || e.metaKey || e.ctrlKey) return;
      if (e.target instanceof HTMLInputElement) return;
      setReady(false);
      onReroll({ ...options, terrain: { ...options.terrain, seed: randomSeed() } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onReroll]);

  useEffect(() => {
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
      <TopBar cityName={options.name} onNewCity={onNewCity} />
      <DebugOverlay />
      <InfoPanel />
      <BudgetPanel />
      <BuildingPicker />
      <Toolbar />
      <Minimap />
      <TrafficLegend />
      <CitizensPanel />
      <Notices />
      <CostLabel />
      <ControlsHint />
    </div>
  );
}
