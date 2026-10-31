const HINTS: [string, string][] = [
  ['Drag', 'Pan'],
  ['WASD', 'Pan'],
  ['Wheel', 'Zoom'],
  ['G', 'Grid'],
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
