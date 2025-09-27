import type { SensitivityGrid } from '@/lib/sensitivity';

interface SensitivityTableProps {
  grid: SensitivityGrid;
  formatValue(value: number): string;
}

export function SensitivityTable({ grid, formatValue }: SensitivityTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs text-slate-200/80">
        <thead className="uppercase tracking-[0.3em] text-slate-300/60">
          <tr>
            <th className="px-3 py-2">WACC</th>
            {grid.columns.map((column) => (
              <th key={column} className="px-3 py-2">
                {grid.labelFormatter(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.key} className="border-t border-white/5">
              <td className="px-3 py-2 text-slate-200/90">{row.key.toFixed(1)}%</td>
              {grid.columns.map((column) => {
                const value = row.values[column];
                return (
                  <td key={column} className="px-3 py-2">
                    {value !== undefined ? formatValue(value) : '--'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
