import { useAtomValue } from 'jotai';
import type { ReactNode } from 'react';
import type { ToolId } from '../../game/tools';
import { BALANCE } from '../../shared/balance';
import { activeToolAtom, gameAtom } from '../atoms';

interface ToolDef {
  id: ToolId;
  label: string;
  key: string;
  hint: string;
  icon: ReactNode;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const TOOLS: readonly ToolDef[] = [
  {
    id: 'select',
    label: 'Select',
    key: 'Q',
    hint: 'Inspect and pan',
    icon: <path {...stroke} d="M6 3l12 7-5.5 1.5L10 17z" />,
  },
  {
    id: 'clear',
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
    id: 'road',
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
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tool-button ${active === t.id ? 'is-active' : ''}`}
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
      ))}
    </div>
  );
}
