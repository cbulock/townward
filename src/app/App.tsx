import { useState } from 'react';
import type { GameOptions } from '../game/Game';
import { clearUrlOptions, readUrlOptions, writeUrlOptions } from './options';
import { GameScreen } from './screens/GameScreen';
import { NewGameScreen } from './screens/NewGameScreen';

/** New Game screen until a city is chosen (or the URL already names one), then the game. */
export function App() {
  const [options, setOptions] = useState<GameOptions | null>(readUrlOptions);

  const start = (o: GameOptions) => {
    writeUrlOptions(o);
    setOptions(o);
  };

  if (!options) return <NewGameScreen onStart={start} />;
  return (
    <GameScreen
      options={options}
      onReroll={start}
      onNewCity={() => {
        clearUrlOptions();
        setOptions(null);
      }}
    />
  );
}
