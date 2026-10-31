import { useAtomValue } from 'jotai';
import { toolPreviewAtom } from '../atoms';

/** Follows the cursor during a drag: what the action costs and how many tiles it touches. */
export function CostLabel() {
  const p = useAtomValue(toolPreviewAtom);
  if (!p) return null;

  const verb = p.tool === 'clear' ? 'Clear' : p.tool === 'highway' ? 'Highway' : 'Road';
  const empty = p.count === 0;
  return (
    <div
      className={`cost-label ${p.affordable ? '' : 'is-unaffordable'}`}
      style={{ transform: `translate(${p.screen.x + 18}px, ${p.screen.y + 18}px)` }}
    >
      <span className="cost-verb">{verb}</span>
      {empty ? (
        <span className="cost-dim">nothing to {p.tool === 'clear' ? 'clear' : 'build'}</span>
      ) : (
        <>
          <span className="cost-value">${p.cost.toLocaleString()}</span>
          <span className="cost-dim">
            {p.count} tile{p.count === 1 ? '' : 's'}
          </span>
        </>
      )}
    </div>
  );
}
