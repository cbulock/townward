import { useAtomValue } from 'jotai';
import { noticesAtom } from '../atoms';

/** Short-lived toasts above the toolbar. Errors never block the world (docs/04-ui-ux.md). */
export function Notices() {
  const notices = useAtomValue(noticesAtom);
  return (
    <div className="notices" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={`panel notice notice-${n.kind}`}>
          {n.message}
        </div>
      ))}
    </div>
  );
}
