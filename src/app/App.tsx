import { useState } from 'react';
import type { GameOptions } from '../game/Game';
import { clearUrlOptions, demoOptions, isDemoRoute, readUrlOptions, writeDemoUrl, writeUrlOptions } from './options';
import { GameScreen } from './screens/GameScreen';
import { NewGameScreen } from './screens/NewGameScreen';

/**
 * New Game screen until a city is chosen (or the URL already names one), then the game.
 * `/demo` opens a planned, fully grown city straight away.
 */
export function App() {
  const [options, setOptions] = useState<GameOptions | null>(() => (isDemoRoute() ? demoOptions() : readUrlOptions()));

  const start = (o: GameOptions) => {
    if (o.demo) writeDemoUrl(o.terrain.seed);
    else writeUrlOptions(o);
    setOptions(o);
  };

  if (!options) return <NewGameScreen onStart={start} />;
  return (
    <GameScreen
      options={options}
      onReroll={(o) => start(o.demo ? demoOptions(o.terrain.seed) : o)}
      onNewCity={() => {
        if (isDemoRoute()) history.replaceState(null, '', '/');
        else clearUrlOptions();
        setOptions(null);
      }}
    />
  );
}
