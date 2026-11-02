import { useAtomValue } from 'jotai';
import { Fragment, type ReactNode } from 'react';
import { isRoadTool, type ToolId } from '../../game/tools';
import { BALANCE } from '../../shared/balance';
import { activeToolAtom, gameAtom } from '../atoms';

interface ToolDef {
  id: ToolId;
  label: string;
  key: string;
  hint: string;
  icon: ReactNode;
  /** Extra class for the button (zone colours). */
  tone?: string;
  /** Buttons are grouped (select/build, zones, roads), with a divider between groups. */
  group: 'edit' | 'zone' | 'road';
}

/** A lot diamond with the zone's letter. */
function zoneIcon(letter: string): ReactNode {
  return (
    <g>
      <path d="M12 3l9 5v8l-9 5-9-5V8z" fill="currentColor" opacity="0.22" />
      <path d="M12 3l9 5v8l-9 5-9-5V8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <text x="12" y="16.2" textAnchor="middle" fontSize={letter.length > 1 ? 8 : 10} fontWeight="800" fill="currentColor">
        {letter}
      </text>
    </g>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const TOOLS: readonly ToolDef[] = [
  {
    id: 'select',
    group: 'edit',
    label: 'Select',
    key: 'Q',
    hint: 'Inspect and pan',
    icon: <path {...stroke} d="M6 3l12 7-5.5 1.5L10 17z" />,
  },
  {
    id: 'clear',
    group: 'edit',
    label: 'Clear',
    key: 'B',
    hint: `Drag an area to remove trees, rocks, roads, buildings and zones · $${BALANCE.treeClearCost}/tree`,
    icon: (
      <g {...stroke}>
        <path d="M3 17h11v-5H8l-2 3H3z" />
        <path d="M14 14h3l3-5M20 9v8" />
        <circle cx="6" cy="19" r="1.4" />
        <circle cx="11" cy="19" r="1.4" />
      </g>
    ),
  },
  {
    id: 'build',
    group: 'edit',
    label: 'Civic',
    key: 'E',
    hint: 'Police, fire, clinics, schools, power, water, parks and shopping',
    icon: (
      <g {...stroke}>
        <path d="M3 11l7-6 7 6" />
        <path d="M5 10v10h10V10" />
        <path d="M9 20v-5h3v5" />
        <path d="M17 20h4V7h-4" />
        <path d="M18.5 10h1M18.5 13h1M18.5 16h1" />
      </g>
    ),
  },
  {
    id: 'zone-r',
    group: 'zone',
    label: 'Homes',
    key: '1',
    hint: `Drag to zone houses · $${BALANCE.zoneCost}/tile · grows within ${BALANCE.roadAccessRange} tiles of a road`,
    icon: zoneIcon('R'),
    tone: 'tone-r',
  },
  {
    id: 'zone-rh',
    group: 'zone',
    label: 'Apartments',
    key: '2',
    hint: `Drag to zone apartments: walk-ups, then blocks and towers · $${BALANCE.zoneCost}/tile`,
    icon: zoneIcon('R+'),
    tone: 'tone-rh',
  },
  {
    id: 'zone-c',
    group: 'zone',
    label: 'Shops',
    key: '3',
    hint: `Drag to zone shops and cafés · $${BALANCE.zoneCost}/tile · grows within ${BALANCE.roadAccessRange} tiles of a road`,
    icon: zoneIcon('C'),
    tone: 'tone-c',
  },
  {
    id: 'zone-ch',
    group: 'zone',
    label: 'Offices',
    key: '4',
    hint: `Drag to zone offices: small offices, then hotels and towers · $${BALANCE.zoneCost}/tile`,
    icon: zoneIcon('C+'),
    tone: 'tone-ch',
  },
  {
    id: 'zone-i',
    group: 'zone',
    label: 'Industry',
    key: '5',
    hint: `Drag to zone industry · $${BALANCE.zoneCost}/tile · grows within ${BALANCE.roadAccessRange} tiles of a road`,
    icon: zoneIcon('I'),
    tone: 'tone-i',
  },
  {
    id: 'move',
    group: 'edit',
    label: 'Move',
    key: 'P',
    hint: 'Click a building to pick it up, then click where it should go · costs 20% of its price',
    icon: (
      <g {...stroke}>
        <path d="M12 3v18M3 12h18" />
        <path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
      </g>
    ),
  },
  {
    id: 'road',
    group: 'road',
    label: 'Roads',
    key: 'R',
    hint: 'Streets, avenues, boulevards, expressways and more · pick a type above',
    icon: (
      <g {...stroke}>
        <path d="M8 3L5 21M16 3l3 18" />
        <path d="M12 4v3M12 10.5v3M12 17v3" />
      </g>
    ),
  },
];

export function Toolbar() {
  const game = useAtomValue(gameAtom);
  const active = useAtomValue(activeToolAtom);
  // Every road type lives behind the one Roads button.
  const isActive = (id: ToolId) => (id === 'road' ? isRoadTool(active) : active === id);

  return (
    <div className="panel toolbar" role="toolbar" aria-label="Build tools">
      {TOOLS.map((t, k) => (
        <Fragment key={t.id}>
        {k > 0 && TOOLS[k - 1].group !== t.group && <span className="toolbar-divider" aria-hidden="true" />}
        <button
          type="button"
          className={`tool-button ${t.tone ?? ''} ${isActive(t.id) ? 'is-active' : ''}`}
          data-tour={`tool-${t.id}`}
          aria-pressed={isActive(t.id)}
          disabled={!game}
          onClick={() => {
            if (!game) return;
            if (isActive(t.id) && t.id !== 'select') game.setTool('select');
            // The Roads button returns to the road type used last (the picker chooses others).
            else game.setTool(t.id === 'road' ? game.lastRoadTool : t.id);
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            {t.icon}
          </svg>
          <span className="tool-label">{t.label}</span>
          <kbd className="tool-key">{t.key}</kbd>
          <span className="tool-tip" role="tooltip">
            <strong>{t.label}</strong> {t.hint}
          </span>
        </button>
        </Fragment>
      ))}
    </div>
  );
}
