import { useAtomValue } from 'jotai';
import { budgetAtom, cityAtom, clockAtom } from '../atoms';
import { DemandMeter } from '../hud/TopBar';
import { HUD_STATS, type HudStatId } from './hudPreferences';

export const compactNumber = (value: number): string =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const SHORT_LABELS: Readonly<Partial<Record<HudStatId, string>>> = {
  demand: 'Demand',
  air: 'Air quality',
  balance: 'Balance',
  stage: 'Stage',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Both the pinned row and dashboard consume the same event-backed values. */
export function HudStat({ id, detailed = false }: { id: HudStatId; detailed?: boolean }) {
  const city = useAtomValue(cityAtom);
  const budget = useAtomValue(budgetAtom);
  const clock = useAtomValue(clockAtom);
  const fullName = HUD_STATS.find(([key]) => key === id)?.[1];
  const name = detailed ? fullName : (SHORT_LABELS[id] ?? fullName);
  let value = '—';
  let detail = '';
  switch (id) {
    case 'happiness':
      value = city ? `${Math.round(city.needs.happiness * 100)}%` : '—';
      detail = 'How residents feel about your city';
      break;
    case 'date':
      value = city ? `${MONTHS[city.date.month]} ${city.date.dayOfMonth}` : '—';
      detail = city ? `Year ${city.date.year}` : '';
      break;
    case 'clock': {
      const minutes = Math.floor(clock * 6) * 10;
      value = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      detail = 'Time of day';
      break;
    }
    case 'jobs':
      value = city ? `${compactNumber(city.workers)}/${compactNumber(city.jobs)}` : '—';
      detail = city
        ? `${city.workers.toLocaleString()} workers · ${city.jobs.toLocaleString()} jobs · ${city.unemployed.toLocaleString()} unemployed`
        : '';
      break;
    case 'air':
      value = city ? `AQI ${Math.round(city.air.cityAqi)}` : '—';
      detail = 'Average air quality where residents live';
      break;
    case 'power':
    case 'water': {
      const report = city?.[id];
      value = report ? (report.short ? `${report.short} short` : 'Supplied') : '—';
      detail = report
        ? `${report.supply.toLocaleString()} supply · ${report.demand.toLocaleString()} demand · ${report.short} buildings without ${id}`
        : '';
      break;
    }
    case 'balance':
      value = budget
        ? `${budget.forecast.net < 0 ? '−' : '+'}$${compactNumber(Math.abs(budget.forecast.net))}`
        : '—';
      detail = budget
        ? `Projected monthly balance: ${budget.forecast.net.toLocaleString()} · income ${budget.forecast.income.toLocaleString()} · expenses ${budget.forecast.expenses.toLocaleString()}`
        : '';
      break;
    case 'stage':
      value = city?.progress.stageName ?? '—';
      detail = city?.progress.next ? `Next: ${city.progress.next.name}` : 'Current city stage';
      break;
  }
  return (
    <>
      <span className="phone-stat-label">{name}</span>
      {id === 'demand' ? (
        <DemandMeter demand={city?.demand} why={city?.demandWhy} />
      ) : (
        <strong title={`${value}${detail ? ` · ${detail}` : ''}`}>{value}</strong>
      )}
      {detailed &&
        (id === 'demand' ? (
          <div className="phone-demand-details">
            {city &&
              (['r', 'c', 'o', 'i'] as const).map((key, i) => (
                <p key={key}>
                  <b>
                    {['Homes', 'Shops', 'Offices', 'Industry'][i]}{' '}
                    {Math.round(city.demand[key] * 100)}%
                  </b>{' '}
                  · {city.demandWhy[key]}
                </p>
              ))}
          </div>
        ) : (
          <span className="phone-stat-detail">{detail}</span>
        ))}
    </>
  );
}
