import { useAtomValue } from 'jotai';
import { Fragment, type ReactNode } from 'react';
import type { ToolId } from '../../game/tools';
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
      <text x="12" y="16.2" textAnchor="middle" fontSize="10" fontWeight="800" fill="currentColor">
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
    hint: `Drag an area to clear trees, rocks and roads · $${BALANCE.treeClearCost}/tree`,
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
    label: 'Build',
    key: 'E',
    hint: 'Place parks and civic buildings',
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
    hint: `Drag to zone residential · $${BALANCE.zoneCost}/tile · grows near roads`,
    icon: zoneIcon('R'),
    tone: 'tone-r',
  },
  {
    id: 'zone-c',
    group: 'zone',
    label: 'Shops',
    key: '2',
    hint: `Drag to zone commercial · $${BALANCE.zoneCost}/tile · grows near roads`,
    icon: zoneIcon('C'),
    tone: 'tone-c',
  },
  {
    id: 'zone-i',
    group: 'zone',
    label: 'Industry',
    key: '3',
    hint: `Drag to zone industrial · $${BALANCE.zoneCost}/tile · grows near roads`,
    icon: zoneIcon('I'),
    tone: 'tone-i',
  },
  {
    id: 'dezone',
    group: 'zone',
    label: 'Dezone',
    key: '4',
    hint: 'Drag to remove zoning (and anything grown on it) · free',
    icon: (
      <g {...stroke}>
        <path d="M12 3l9 5v8l-9 5-9-5V8z" />
        <path d="M9 9.5l6 5M15 9.5l-6 5" />
      </g>
    ),
  },
  {
    id: 'road',
    group: 'road',
    label: 'Road',
    key: 'R',
    hint: `Drag to build · $${BALANCE.roadCost}/tile · Shift for straight`,
    icon: (
      <g {...stroke}>
        <path d="M8 3L5 21M16 3l3 18" />
        <path d="M12 4v3M12 10.5v3M12 17v3" />
      </g>
    ),
  },
  {
    id: 'highway',
    group: 'road',
    label: 'Highway',
    key: 'H',
    hint: `Drag to build · $${BALANCE.highwayCost}/tile · Shift for straight`,
    icon: (
      <g {...stroke}>
        <path d="M5 3L2 21M19 3l3 18" />
        <path d="M11 3l-.5 18M13 3l.5 18" />
        <path d="M7.5 5v2.5M7 11v2.5M6.5 17v2.5M16.5 5v2.5M17 11v2.5M17.5 17v2.5" />
      </g>
    ),
  },
];

export function Toolbar() {
  const game = useAtomValue(gameAtom);
  const active = useAtomValue(activeToolAtom);

  return (
    <div className="panel toolbar" role="toolbar" aria-label="Build tools">
      {TOOLS.map((t, k) => (
        <Fragment key={t.id}>
        {k > 0 && TOOLS[k - 1].group !== t.group && <span className="toolbar-divider" aria-hidden="true" />}
        <button
          type="button"
          className={`tool-button ${t.tone ?? ''} ${active === t.id ? 'is-active' : ''}`}
          aria-pressed={active === t.id}
          disabled={!game}
          onClick={() => game?.setTool(active === t.id && t.id !== 'select' ? 'select' : t.id)}
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
