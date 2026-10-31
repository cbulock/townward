import { useAtomValue } from 'jotai';
import { isZoneTool } from '../../game/tools';
import { toolPreviewAtom } from '../atoms';

const CURSOR_GAP = 18;
/** Space the label needs before it flips to the other side of the cursor. */
const LABEL_ROOM_X = 220;
const LABEL_ROOM_Y = 60;

/** Follows the cursor during a drag: what the action costs and how many tiles it touches. */
export function CostLabel() {
  const p = useAtomValue(toolPreviewAtom);
  if (!p) return null;

  const verb = p.label ?? (p.tool === 'clear' ? 'Clear' : p.tool === 'highway' ? 'Highway' : 'Road');
  const empty = p.count === 0;
  // Flip to the other side of the cursor near the right/bottom edges so the label never clips.
  const flipX = p.screen.x > window.innerWidth - LABEL_ROOM_X;
  const flipY = p.screen.y > window.innerHeight - LABEL_ROOM_Y;
  const dx = flipX ? `calc(${p.screen.x - CURSOR_GAP}px - 100%)` : `${p.screen.x + CURSOR_GAP}px`;
  const dy = flipY ? `calc(${p.screen.y - CURSOR_GAP}px - 100%)` : `${p.screen.y + CURSOR_GAP}px`;
  return (
    <div
      className={`cost-label ${p.affordable && !p.blocked ? '' : 'is-unaffordable'}`}
      style={{ transform: `translate(${dx}, ${dy})` }}
    >
      <span className="cost-verb">{verb}</span>
      {p.note && <span className="cost-note">{p.note}</span>}
      {p.blocked ? (
        <span className="cost-dim">can't build here</span>
      ) : empty ? (
        <span className="cost-dim">nothing to {p.tool === 'clear' ? 'clear' : isZoneTool(p.tool) ? 'zone' : 'build'}</span>
      ) : p.tool === 'build' ? (
        <span className="cost-value">${p.cost.toLocaleString()}</span>
      ) : (
        <>
          <span className="cost-value">{p.cost === 0 ? 'Free' : `$${p.cost.toLocaleString()}`}</span>
          <span className="cost-dim">
            {p.count} tile{p.count === 1 ? '' : 's'}
          </span>
        </>
      )}
    </div>
  );
}
