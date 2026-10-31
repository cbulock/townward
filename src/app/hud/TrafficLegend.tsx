import { useAtomValue } from 'jotai';
import { cityAtom, trafficViewAtom } from '../atoms';

const STEPS: readonly [string, string][] = [
  ['#4ade80', 'Free'],
  ['#facc15', 'Busy'],
  ['#fb923c', 'Jammed'],
  ['#ef4444', 'Gridlock'],
];

/** Legend and commute summary while the traffic overlay is on. */
export function TrafficLegend() {
  const on = useAtomValue(trafficViewAtom);
  const city = useAtomValue(cityAtom);
  if (!on) return null;
  const t = city?.traffic;
  return (
    <div className="panel traffic-legend" aria-label="Traffic legend">
      <strong className="traffic-title">Traffic</strong>
      <div className="traffic-steps">
        {STEPS.map(([color, label]) => (
          <span key={label} className="traffic-step">
            <i style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
      {t && (
        <p className="traffic-summary">
          {t.commuters.toLocaleString()} commuters · avg {Math.round(t.avgMinutes)} min
          {t.jammedTiles > 0 ? ` · ${t.jammedTiles} jammed road tiles` : ' · no jams'}
        </p>
      )}
      <p className="traffic-hint">Add a second route or a highway where roads turn orange or red.</p>
    </div>
  );
}
