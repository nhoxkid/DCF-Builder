import { Fragment } from 'react';
import type { ForecastPeriod } from '@/lib/model';

interface ForecastTableProps {
  periods: ForecastPeriod[];
  onChange(next: ForecastPeriod[]): void;
}

export function ForecastTable({ periods, onChange }: ForecastTableProps) {
  const update = (index: number, patch: Partial<ForecastPeriod>) => {
    onChange(
      periods.map((period, i) => (i === index ? { ...period, ...patch } : period)),
    );
  };

  const addRow = () => {
    const last = periods[periods.length - 1];
    const nextYear = last ? last.yearOffset + 1 : 1;
    const label = last ? incrementLabel(last.label) : 'FY+1';
    onChange([
      ...periods,
      {
        label,
        yearOffset: nextYear,
        revenue: last ? last.revenue * 1.05 : 100,
        ebitMargin: last ? last.ebitMargin : 20,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (periods.length <= 1) {
      return;
    }
    onChange(periods.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glass">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Forecast Periods</h3>
          <p className="text-sm text-slate-300/80">Edit revenue and margin assumptions per period</p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          Add Period
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-200/80">
          <thead className="text-xs uppercase tracking-[0.3em] text-slate-300/60">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Year Offset</th>
              <th className="px-3 py-2">Revenue (M)</th>
              <th className="px-3 py-2">EBIT Margin (%)</th>
              <th className="px-3 py-2">Other Op. Income (M)</th>
              <th className="px-3 py-2">Capex Override (M)</th>
              <th className="px-3 py-2">D&A Override (M)</th>
              <th className="px-3 py-2">WC Override (M)</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period, index) => (
              <Fragment key={`${period.label}-${index}`}>
                <tr className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2">
                    <input
                      value={period.label}
                      onChange={(event) => update(index, { label: event.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-accent-blue"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={period.yearOffset}
                      min={0}
                      step={0.5}
                      onChange={(event) => update(index, { yearOffset: Number(event.target.value) })}
                      className="w-24 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-accent-blue"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={period.revenue}
                      onChange={(event) => update(index, { revenue: Number(event.target.value) })}
                      className="w-28 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-accent-blue"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={period.ebitMargin}
                      onChange={(event) => update(index, { ebitMargin: Number(event.target.value) })}
                      className="w-24 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-accent-blue"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={period.otherOperatingIncome ?? 0}
                      onChange={(event) => update(index, { otherOperatingIncome: Number(event.target.value) })}
                      className="w-28 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-accent-blue"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={period.capexOverride ?? ''}
                      placeholder="auto"
                      onChange={(event) => update(index, { capexOverride: event.target.value === '' ? undefined : Number(event.target.value) })}
                      className="w-28 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-accent-blue"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={period.depreciationOverride ?? ''}
                      placeholder="auto"
                      onChange={(event) => update(index, { depreciationOverride: event.target.value === '' ? undefined : Number(event.target.value) })}
                      className="w-28 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-accent-blue"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={period.workingCapitalOverride ?? ''}
                      placeholder="auto"
                      onChange={(event) => update(index, { workingCapitalOverride: event.target.value === '' ? undefined : Number(event.target.value) })}
                      className="w-28 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-accent-blue"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="rounded-full bg-white/10 px-3 py-1 text-xs text-white transition hover:bg-white/20"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function incrementLabel(label: string): string {
  const match = label.match(/(\d+)/);
  if (!match) {
    return `${label} +1`;
  }
  const next = Number(match[1]) + 1;
  return label.replace(match[1], String(next));
}
