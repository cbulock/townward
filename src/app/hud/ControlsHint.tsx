import { useEffect, useState } from 'react';
import { TOUCH, useMedia } from '../mobile/useMedia';

const HINTS: [string, string][] = [
  ['Right-drag', 'Pan'],
  ['Wheel', 'Zoom'],
  ['Shift', 'Straight'],
  ['Esc', 'Cancel'],
  ['Space', 'Pause'],
  ['[ ]', 'Speed'],
  [', .', 'Rotate'],
  ['G', 'Grid'],
  ['M', 'Mute'],
  ['L', 'Day/night'],
  ['T', 'Traffic'],
  ['Y', 'Happiness'],
  ['O', 'Air quality'],
  ['N', 'New map'],
  ['F3', 'Debug'],
];

const TOUCH_HINTS: [string, string][] = [
  ['Drag', 'Move, or draw then tap Build'],
  ['Pinch', 'Zoom'],
  ['Two fingers', 'Pan while building'],
  ['Tap', 'Inspect'],
];

/** Seconds the touch hint stays before fading (it's a reminder, not a fixture). */
const TOUCH_HINT_SECONDS = 9;

export function ControlsHint() {
  const touch = useMedia(TOUCH);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (!touch) return;
    const t = setTimeout(() => setShown(false), TOUCH_HINT_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [touch]);
  if (touch && !shown) return null;
  return (
    <div className={`panel controls-hint ${touch ? 'is-touch' : ''}`}>
      {(touch ? TOUCH_HINTS : HINTS).map(([key, label]) => (
        <span key={key} className="hint">
          <kbd>{key}</kbd>
          {label}
        </span>
      ))}
    </div>
  );
}
