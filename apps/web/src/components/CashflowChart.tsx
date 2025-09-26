import { memo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface CashflowChartDatum {
  date: string;
  value: number;
}

interface CashflowChartProps {
  data: CashflowChartDatum[];
}

export const CashflowChart = memo(function CashflowChart({ data }: CashflowChartProps) {
  return (
    <div className="h-64 w-full rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glass">
      <h3 className="mb-2 text-sm font-medium uppercase tracking-[0.3em] text-slate-200/70">
        Cashflow Profile
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 8, left: -16 }}>
          <defs>
            <linearGradient id="cfGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5ac8fa" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="#64748b" tickLine={false} axisLine={false} width={0} domain={[dataMin => dataMin * 1.1, dataMax => dataMax * 1.1]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: 'rgba(148,163,184,0.4)' }}
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}
            formatter={(value: number) => `$${value.toFixed(1)}M`}
          />
          <Area type="monotone" dataKey="value" stroke="#5ac8fa" fill="url(#cfGradient)" strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
