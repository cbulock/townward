const HINTS: [string, string][] = [
  ['Right-drag', 'Pan'],
  ['Wheel', 'Zoom'],
  ['Shift', 'Straight'],
  ['Esc', 'Cancel'],
  ['G', 'Grid'],
  ['M', 'Mute'],
  ['N', 'New map'],
  ['F3', 'Debug'],
];

export function ControlsHint() {
  return (
    <div className="panel controls-hint">
      {HINTS.map(([key, label]) => (
        <span key={key} className="hint">
          <kbd>{key}</kbd>
          {label}
        </span>
      ))}
    </div>
  );
}
