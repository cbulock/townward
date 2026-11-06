import { useAtomValue, useStore } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type GameOptions } from '../../game/Game';
import { CitySaver } from '../../save/CitySaver';
import type { CityRef } from '../../save/SaveStore';
import {
  authAtom,
  authDialogAtom,
  saveStatusAtom,
  gameAtom,
  budgetOpenAtom,
  inspectAtom,
} from '../atoms';
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
import { NATIVE_APP } from '../platform';
import { App as AndroidApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AppLifecycle } from '../mobile/AppLifecycle';
import { MobileHud } from '../mobile/MobileHud';
import { useMedia } from '../mobile/useMedia';
import { tourStepAtom } from '../tour/tourState';

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
  /** The map couldn't start (no WebGL or WebGPU in this browser). */
  const [failed, setFailed] = useState(false);
  const saverRef = useRef<CitySaver | null>(null);
  const phone = useMedia('(max-width: 760px), (max-height: 520px)');
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

  useEffect(() => {
    const back = (event: Event) => {
      event.preventDefault();
      if (store.get(authDialogAtom) !== null) {
        store.set(authDialogAtom, null);
        return;
      }
      if (store.get(tourStepAtom) !== null) {
        store.set(tourStepAtom, null);
        return;
      }
      const dismiss = new Event('openpolis-dismiss', { cancelable: true });
      window.dispatchEvent(dismiss);
      if (dismiss.defaultPrevented) return;
      const game = store.get(gameAtom);
      if (store.get(budgetOpenAtom)) {
        store.set(budgetOpenAtom, false);
        return;
      }
      if (store.get(inspectAtom)) {
        game?.inspect(null);
        return;
      }
      if (game?.hasConstructionAction) {
        const hadDraft = game.hasDraft;
        game.cancelInteraction();
        if (!hadDraft) game.setTool('select');
        return;
      }
      if (window.confirm('Save this city and return to your cities?')) void leave();
    };
    window.addEventListener('openpolis-back', back);
    return () => window.removeEventListener('openpolis-back', back);
  }, [store, leave]);

  // Logged out while playing a city from the account: it can't be saved any more, so leave it.
  const auth = useAtomValue(authAtom);
  useEffect(() => {
    if (
      auth.status === 'guest' &&
      (!NATIVE_APP || auth.online) &&
      saverRef.current?.cityRef?.store === 'cloud'
    )
      onNewCity();
  }, [auth, onNewCity]);

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
    let detachLifecycle: (() => void) | null = null;

    // Game.create is async; handle unmount-before-ready (React StrictMode mounts twice in dev).
    Game.create(host, options)
      .then((g) => {
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
        if (NATIVE_APP) {
          const lifecycle = new AppLifecycle({
            get speed() {
              return g.speed;
            },
            get muted() {
              return g.muted;
            },
            setSpeed: (speed) => g.setSpeed(speed),
            setMuted: (muted) => g.setMuted(muted, false),
            cancelInteraction: () => g.cancelInteraction(),
            save: () => {
              saverRef.current?.journalNow();
              void saverRef.current?.autosave();
            },
          });
          const visibility = () => lifecycle.setActive(document.visibilityState !== 'hidden');
          document.addEventListener('visibilitychange', visibility);
          const handles = Capacitor.isNativePlatform()
            ? [
                AndroidApp.addListener('appStateChange', ({ isActive }) =>
                  lifecycle.setActive(isActive),
                ),
              ]
            : [];
          detachLifecycle = () => {
            document.removeEventListener('visibilitychange', visibility);
            handles.forEach((handle) => void handle.then((h) => h.remove()));
          };
          visibility();
        }
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Could not start the map renderer', err);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      detachLifecycle?.();
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
      {phone ? (
        <MobileHud
          cityName={options.name}
          onNewCity={() => void leave()}
          onSave={save}
          beforeLogout={flush}
        />
      ) : (
        <TopBar
          cityName={options.name}
          onNewCity={() => void leave()}
          onSave={save}
          beforeLogout={flush}
        />
      )}
      <DebugOverlay />
      {!phone && (
        <>
          <InfoPanel />
          <BudgetPanel />
          <BuildingPicker />
          <RoadPicker />
          <Toolbar />
          <Minimap />
          <TrafficLegend />
          <CitizensPanel />
        </>
      )}
      <Notices />
      <CostLabel />
      <ControlsHint />
      {/* Starts on a new city until finished; an opened city only carries on a tour left midway. */}
      <Tour autoStart={NATIVE_APP || options.demo ? 'never' : options.save ? 'resume' : 'start'} />
      <GuestLimit cityName={options.name} />
      <RotatePrompt />
      {failed && (
        <div className="render-failed" role="alert">
          <h2>Cannot draw the city</h2>
          <p>
            {NATIVE_APP
              ? 'Openpolis needs hardware graphics support. Update Android System WebView and restart the app.'
              : 'Openpolis needs WebGL. Enable hardware acceleration or try an up-to-date browser.'}
          </p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
