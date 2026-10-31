import { useAtom, useAtomValue } from 'jotai';
import type { UtilityTotals } from '../../sim/services';
import { BALANCE } from '../../shared/balance';
import type { BudgetReport } from '../../sim/population';
import { budgetAtom, budgetOpenAtom, gameAtom } from '../atoms';

const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString()}`;

function Lines({ r }: { r: BudgetReport }) {
  const rows: [string, number][] = [
    ['Roads', r.breakdown.roads],
    ['Services', r.breakdown.services],
    ['Utilities', r.breakdown.utilities],
    ['Parks & civic', r.breakdown.parks],
  ];
  return (
    <div className="budget-lines">
      <div className="budget-line income">
        <span>Taxes</span>
        <strong>+{money(r.income)}</strong>
      </div>
      {rows.map(([label, v]) => (
        <div key={label} className="budget-line">
          <span>{label}</span>
          <span>−{money(v)}</span>
        </div>
      ))}
      <div className={`budget-line total ${r.net >= 0 ? 'gain' : 'loss'}`}>
        <span>Net per month</span>
        <strong>
          {r.net >= 0 ? '+' : ''}
          {money(r.net)}
        </strong>
      </div>
    </div>
  );
}

function Supply({ label, t }: { label: string; t: UtilityTotals }) {
  const pct = t.supply === 0 ? (t.demand > 0 ? 100 : 0) : Math.min(100, Math.round((t.demand / t.supply) * 100));
  const short = t.demand > t.supply;
  return (
    <div className="supply">
      <div className="budget-line">
        <span>{label}</span>
        <span className={short ? 'warn' : ''}>
          {t.demand.toLocaleString()} used of {t.supply.toLocaleString()}
          {t.short > 0 ? ` · ${t.short} without` : ''}
        </span>
      </div>
      <div className="meter">
        <div className={`meter-fill ${short ? 'is-short' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Opened from the funds in the top bar: tax rate, monthly budget and utility supply. */
export function BudgetPanel() {
  const [open, setOpen] = useAtom(budgetOpenAtom);
  const info = useAtomValue(budgetAtom);
  const game = useAtomValue(gameAtom);
  if (!open || !info) return null;

  return (
    <aside className="panel budget-panel" aria-label="City budget">
      <header className="info-header">
        <h2 className="info-title">Budget</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <label className="tax">
        <span className="budget-line">
          <span>Tax rate</span>
          <strong>{info.taxRate}%</strong>
        </span>
        <input
          type="range"
          min={0}
          max={BALANCE.maxTaxRate}
          step={1}
          value={info.taxRate}
          onChange={(e) => game?.setTaxRate(Number(e.target.value))}
        />
        <span className="tax-hint">Higher taxes earn more but slow the city's growth.</span>
      </label>

      <h3 className="budget-heading">Next month (forecast)</h3>
      <Lines r={info.forecast} />
      {info.last && (
        <p className="tax-hint">
          Last month: {info.last.net >= 0 ? '+' : ''}
          {money(info.last.net)}
        </p>
      )}

      <h3 className="budget-heading">Utilities</h3>
      <Supply label="⚡ Power" t={info.power} />
      <Supply label="💧 Water" t={info.water} />
    </aside>
  );
}
