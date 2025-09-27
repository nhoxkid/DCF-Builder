import { AnimatePresence, motion } from 'framer-motion';
import { CashflowChart } from '@/components/CashflowChart';
import { MetricCard } from '@/components/MetricCard';
import { SectionCard } from '@/components/SectionCard';
import { formatCurrency, formatMillions, formatPercent } from '@/lib/finance';
import type { BuilderState } from '@/lib/finance';
import type { ValuationOutputs } from '@/lib/model';

interface AnalyticsPanelProps {
  valuation: ValuationOutputs | null;
  scenarioLabel: string;
  engineMetrics: { npvMillions: number; irrBps?: number } | null;
  context: BuilderState['context'];
  activeScenarioId?: string;
  cashflowSeries: Array<{ date: string; value: number }>;
  isCalculating: boolean;
}

export function AnalyticsPanel({
  valuation,
  scenarioLabel,
  engineMetrics,
  context,
  activeScenarioId,
  cashflowSeries,
  isCalculating,
}: AnalyticsPanelProps) {
  const perShare = valuation
    ? formatCurrency(valuation.perShare, context.metadata.currency ?? 'USD', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })
    : '--';

  return (
    <aside className="w-full max-w-md space-y-6">
      <SectionCard title={`Valuation Summary (${scenarioLabel})`} subtitle="Values in millions">
        <div className="grid gap-4">
          <MetricCard
            label="Enterprise Value"
            value={valuation ? formatMillions(valuation.enterpriseValue) : '--'}
            accent="blue"
            sublabel={`Discount rate: ${valuation?.discountRate.toFixed(2) ?? '--'}%`}
          />
          <MetricCard
            label="Equity Value"
            value={valuation ? formatMillions(valuation.equityValue) : '--'}
            accent="teal"
            sublabel={`Net debt: ${formatMillions(context.netDebt)}`}
          />
          <MetricCard
            label="Per Share"
            value={perShare}
            accent="blue"
            sublabel={`Shares: ${context.sharesOutstanding.toLocaleString()}M`}
          />
          <MetricCard
            label="Internal Rate of Return"
            value={engineMetrics?.irrBps ? formatPercent(engineMetrics.irrBps / 100) : '--'}
            accent="teal"
            sublabel={`NPV (engine): ${engineMetrics ? formatMillions(engineMetrics.npvMillions) : '--'}`}
          />
        </div>
        <AnimatePresence>
          {isCalculating ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="mt-3 text-xs uppercase tracking-[0.4em] text-accent-blue"
            >
              Recomputing
            </motion.p>
          ) : null}
        </AnimatePresence>
      </SectionCard>

      {cashflowSeries.length ? (
        <SectionCard title="Cashflow Trajectory" subtitle="Free cash flow forecast">
          <CashflowChart data={cashflowSeries} />
        </SectionCard>
      ) : null}

      <SectionCard title="Validation Checks" subtitle="Balance sheet guard rails">
        {valuation?.validations.length ? (
          <ul className="space-y-2 text-sm text-slate-200/80">
            {valuation.validations.map((validation) => (
              <li key={validation} className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                {validation}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400/80">No validation warnings.</p>
        )}
      </SectionCard>

      <SectionCard title="EV Bridge" subtitle="From FCFF to equity value">
        {valuation ? (
          <ul className="space-y-2 text-sm text-slate-200/80">
            {valuation.evBridge.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <span>{item.label}</span>
                <span>{formatMillions(item.value)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400/80">Run a valuation to populate the bridge.</p>
        )}
      </SectionCard>

      <SectionCard title="Sum of the Parts" subtitle="Segment valuation">
        {valuation?.sotp && valuation.sotp.segments.length ? (
          <ul className="space-y-2 text-sm text-slate-200/80">
            {valuation.sotp.segments.map((segment) => (
              <li
                key={segment.segment.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-white">{segment.segment.label}</p>
                  <p className="text-xs text-slate-300/70">{(segment.weight * 100).toFixed(1)}% of total</p>
                </div>
                <span>{formatMillions(segment.value)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-3 py-2 font-medium text-white">
              <span>Total</span>
              <span>{formatMillions(valuation.sotp.totalValue)}</span>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-slate-400/80">Add segments to view SOTP output.</p>
        )}
      </SectionCard>

      <SectionCard title="Run Metadata" subtitle="Execution context">
        <ul className="space-y-2 text-xs uppercase tracking-[0.3em] text-slate-300/70">
          <li>Timestamp | {valuation?.runMetadata.timestampIso ?? '--'}</li>
          <li>Scenario | {valuation?.runMetadata.scenarioId ?? activeScenarioId ?? 'base'}</li>
          <li>Config | {valuation?.runMetadata.configPath ?? context.metadata.configPath ?? '--'}</li>
          <li>Git | {valuation?.runMetadata.gitCommit ?? context.metadata.gitCommit ?? '--'}</li>
        </ul>
      </SectionCard>
    </aside>
  );
}
