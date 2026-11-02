import { useAtomValue, useStore } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type GameOptions } from '../../game/Game';
import { CitySaver } from '../../save/CitySaver';
import type { CityRef } from '../../save/SaveStore';
import { authAtom, saveStatusAtom } from '../atoms';
import { connectGameToStore } from '../bridge';
import { randomSeed } from '../options';
import { BuildingPicker } from '../hud/BuildingPicker';
import { RoadPicker } from '../hud/RoadPicker';
import { ControlsHint } from '../hud/ControlsHint';
import { RotatePrompt } from '../mobile/RotatePrompt';
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
import { Tour } from '../tour/Tour';
import { GuestLimit } from '../account/GuestLimit';

interface GameScreenProps {
  options: GameOptions;
  /** The save this city was loaded from (null: a new city, or the demo). */
  cityRef: CityRef | null;
  /** The city was saved somewhere new (first save, or moved into the account). */
  onSaved: (ref: CityRef) => void;
  /** Same settings, new seed (the `N` key). */
  onReroll: (o: GameOptions) => void;
  /** Back to the New Game screen. */
  onNewCity: () => void;
}

export function GameScreen({ options, cityRef, onSaved, onReroll, onNewCity }: GameScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const store = useStore();
  const [ready, setReady] = useState(false);
  const saverRef = useRef<CitySaver | null>(null);
  // Read through refs so the game isn't recreated when these change.
  const initialRef = useRef(cityRef);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const save = useCallback(() => void saverRef.current?.saveNow(), []);
  /** Save anything unsaved first (leaving the city, logging out). */
  const flush = useCallback(async () => {
    await saverRef.current?.autosave();
  }, []);
  const leave = useCallback(async () => {
    await flush();
    onNewCity();
  }, [flush, onNewCity]);

  // Logged out while playing a city from the account: it can't be saved any more, so leave it.
  const auth = useAtomValue(authAtom);
  useEffect(() => {
    if (auth.status === 'guest' && saverRef.current?.cityRef?.store === 'cloud') onNewCity();
  }, [auth.status, onNewCity]);

  // Ctrl/⌘ S saves now instead of opening the browser's "Save page".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyS' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

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
      // The demo is a showcase, never saved.
      if (!options.demo) {
        saverRef.current = new CitySaver(g, {
          ref: initialRef.current,
          preferredStore: () => (store.get(authAtom).status === 'user' ? 'cloud' : 'local'),
          onStatus: (s) => store.set(saveStatusAtom, s),
          onRef: (ref) => onSavedRef.current(ref),
        });
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
      // Last chance for unsaved changes (rerolls, unmount): the snapshot is taken before the game goes.
      const saver = saverRef.current;
      saverRef.current = null;
      saver?.journalNow();
      void saver?.autosave();
      saver?.dispose();
      store.set(saveStatusAtom, null);
      disconnect?.();
      game?.destroy();
    };
  }, [store, options]);

  return (
    <div className="game-screen">
      <div ref={hostRef} className="game-canvas" />
      <div className={`fade-in ${ready ? 'is-ready' : ''}`} />
      <TopBar cityName={options.name} onNewCity={() => void leave()} onSave={save} beforeLogout={flush} />
      <DebugOverlay />
      <InfoPanel />
      <BudgetPanel />
      <BuildingPicker />
      <RoadPicker />
      <Toolbar />
      <Minimap />
      <TrafficLegend />
      <CitizensPanel />
      <Notices />
      <CostLabel />
      <ControlsHint />
      {/* Starts on a new city until finished; an opened city only carries on a tour left midway. */}
      <Tour autoStart={options.demo ? 'never' : options.save ? 'resume' : 'start'} />
      <GuestLimit />
      <RotatePrompt />
    </div>
  );
}
