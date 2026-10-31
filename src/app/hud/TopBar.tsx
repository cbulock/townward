import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { fundsAtom } from '../atoms';

/** Floating top bar: city name and funds. Funds flash when they change. */
export function TopBar() {
  const funds = useAtomValue(fundsAtom);
  const prev = useRef(funds);
  const [flash, setFlash] = useState<'spend' | 'gain' | null>(null);

  useEffect(() => {
    if (funds === prev.current) return;
    setFlash(funds < prev.current ? 'spend' : 'gain');
    prev.current = funds;
    const t = setTimeout(() => setFlash(null), 450);
    return () => clearTimeout(t);
  }, [funds]);

  return (
    <div className="panel top-bar">
      <span className="city-name">River Valley</span>
      <span className="top-divider" />
      <span className={`funds ${flash ? `flash-${flash}` : ''}`}>
        <span className="funds-sign">$</span>
        {funds.toLocaleString()}
      </span>
    </div>
  );
}
