import { CashflowChart } from '@/components/CashflowChart';
import { NumberField } from '@/components/NumberField';
import { SectionCard } from '@/components/SectionCard';
import { SensitivityTable } from '@/components/SensitivityTable';
import type { UseBuilderStateResult } from '@/hooks/useBuilderState';
import { formatMillions } from '@/lib/finance';
import type { SensitivityGrid } from '@/lib/sensitivity';
import type { MonteCarloResult } from '@/lib/model';
import type { BuilderState } from '@/lib/finance';

interface ControlPanelProps {
  context: BuilderState['context'];
  activeScenarioId?: string;
  onScenarioChange(id: string): void;
  updateWorkingCapital: UseBuilderStateResult['updateWorkingCapital'];
  updateCapex: UseBuilderStateResult['updateCapex'];
  updateLeases: UseBuilderStateResult['updateLeases'];
  updateTax: UseBuilderStateResult['updateTax'];
  updateWacc: UseBuilderStateResult['updateWacc'];
  updateTerminal: UseBuilderStateResult['updateTerminal'];
  updateGordon: UseBuilderStateResult['updateGordon'];
  updateExit: UseBuilderStateResult['updateExit'];
  gordonGrid: SensitivityGrid | null;
  exitGrid: SensitivityGrid | null;
  onRunMonteCarlo(): void;
  isRunningMonteCarlo: boolean;
  monteCarlo: MonteCarloResult | null;
}

export function ControlPanel({
  context,
  activeScenarioId,
  onScenarioChange,
  updateWorkingCapital,
  updateCapex,
  updateLeases,
  updateTax,
  updateWacc,
  updateTerminal,
  updateGordon,
  updateExit,
  gordonGrid,
  exitGrid,
  onRunMonteCarlo,
  isRunningMonteCarlo,
  monteCarlo,
}: ControlPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard title="Working Capital" subtitle="Control AR/AP days and side accounts">
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="AR Days"
              value={context.workingCapital.arDays}
              onChange={(value) => updateWorkingCapital('arDays', value)}
            />
            <NumberField
              label="AP Days"
              value={context.workingCapital.apDays}
              onChange={(value) => updateWorkingCapital('apDays', value)}
            />
            <NumberField
              label="Inventory Days"
              value={context.workingCapital.inventoryDays}
              onChange={(value) => updateWorkingCapital('inventoryDays', value)}
            />
            <NumberField
              label="Opening Net Working Capital (M)"
              value={context.workingCapital.openingNetWorkingCapital}
              onChange={(value) => updateWorkingCapital('openingNetWorkingCapital', value)}
            />
            <NumberField
              label="Other Current Assets (M)"
              value={context.workingCapital.otherCurrentAssets}
              onChange={(value) => updateWorkingCapital('otherCurrentAssets', value)}
            />
            <NumberField
              label="Other Current Liabilities (M)"
              value={context.workingCapital.otherCurrentLiabilities}
              onChange={(value) => updateWorkingCapital('otherCurrentLiabilities', value)}
            />
          </div>
        </SectionCard>

        <SectionCard title="Capex and D&A" subtitle="Maintenance versus growth composition">
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Opening PP&E (M)"
              value={context.capex.openingNetPpe}
              onChange={(value) => updateCapex('openingNetPpe', value)}
            />
            <NumberField
              label="Maintenance Capex (% Rev)"
              value={context.capex.maintenanceCapexPctRevenue}
              onChange={(value) => updateCapex('maintenanceCapexPctRevenue', value)}
            />
            <NumberField
              label="Growth Capex (% Rev)"
              value={context.capex.growthCapexPctRevenue}
              onChange={(value) => updateCapex('growthCapexPctRevenue', value)}
            />
            <NumberField
              label="Depreciation (% Rev)"
              value={context.capex.depreciationPctRevenue}
              onChange={(value) => updateCapex('depreciationPctRevenue', value)}
            />
          </div>
        </SectionCard>

        <SectionCard title="Leases" subtitle="IFRS 16 and ASC 842 adjustments">
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Lease Liability (M)"
              value={context.leases.operatingLeaseLiability}
              onChange={(value) => updateLeases('operatingLeaseLiability', value)}
            />
            <NumberField
              label="Lease Discount Rate (%)"
              value={context.leases.discountRate}
              onChange={(value) => updateLeases('discountRate', value)}
            />
            <NumberField
              label="Average Term (yrs)"
              value={context.leases.averageLeaseTermYears}
              onChange={(value) => updateLeases('averageLeaseTermYears', value)}
            />
            <NumberField
              label="Annual Lease Expense (M)"
              value={context.leases.annualLeaseExpense}
              onChange={(value) => updateLeases('annualLeaseExpense', value)}
            />
          </div>
        </SectionCard>

        <SectionCard title="Tax and NOL" subtitle="Cash versus book tax dynamics">
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Statutory Rate (%)"
              value={context.tax.statutoryRate}
              onChange={(value) => updateTax('statutoryRate', value)}
            />
            <NumberField
              label="Cash Tax Rate (%)"
              value={context.tax.cashTaxRate}
              onChange={(value) => updateTax('cashTaxRate', value)}
            />
            <NumberField
              label="Opening NOL (M)"
              value={context.tax.nolOpening}
              onChange={(value) => updateTax('nolOpening', value)}
            />
            <NumberField
              label="NOL Usage Cap (M)"
              value={context.tax.nolAnnualUsageCap ?? 0}
              onChange={(value) => updateTax('nolAnnualUsageCap', value)}
            />
            <NumberField
              label="Deferred Tax Rate (%)"
              value={context.tax.deferredTaxRate ?? 0}
              onChange={(value) => updateTax('deferredTaxRate', value)}
            />
          </div>
        </SectionCard>

        <SectionCard title="WACC Inputs" subtitle="Capital structure and beta levers">
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Risk-free Rate (%)"
              value={context.wacc.riskFreeRate}
              onChange={(value) => updateWacc('riskFreeRate', value)}
            />
            <NumberField
              label="Market Premium (%)"
              value={context.wacc.marketRiskPremium}
              onChange={(value) => updateWacc('marketRiskPremium', value)}
            />
            <NumberField
              label="Size Premium (%)"
              value={context.wacc.sizePremium}
              onChange={(value) => updateWacc('sizePremium', value)}
            />
            <NumberField
              label="Country Premium (%)"
              value={context.wacc.countryRiskPremium}
              onChange={(value) => updateWacc('countryRiskPremium', value)}
            />
            <NumberField
              label="Levered Beta"
              value={context.wacc.betaLevered}
              onChange={(value) => updateWacc('betaLevered', value)}
            />
            <NumberField
              label="Target Debt to Equity"
              value={context.wacc.targetDebtToEquity}
              onChange={(value) => updateWacc('targetDebtToEquity', value)}
            />
            <NumberField
              label="Cost of Debt (%)"
              value={context.wacc.costOfDebtPreTax}
              onChange={(value) => updateWacc('costOfDebtPreTax', value)}
            />
            <NumberField
              label="Tax Rate (%)"
              value={context.wacc.taxRate}
              onChange={(value) => updateWacc('taxRate', value)}
            />
          </div>
        </SectionCard>

        <SectionCard title="Terminal Value" subtitle="Compare Gordon and Exit multiple">
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-200/80">
              <input
                type="checkbox"
                checked={context.terminalValue.applyBoth ?? false}
                onChange={(event) => updateTerminal('applyBoth', event.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent"
              />
              Compute both methods
            </label>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-200/80">
                  <h4 className="font-semibold text-white">Gordon Growth</h4>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={context.terminalValue.gordon.enabled}
                      onChange={(event) => updateGordon('enabled', event.target.checked)}
                      className="h-4 w-4 rounded border-white/30 bg-transparent"
                    />
                    Enabled
                  </label>
                </div>
                <NumberField
                  label="Growth (%)"
                  value={context.terminalValue.gordon.growthRate}
                  onChange={(value) => updateGordon('growthRate', value)}
                />
                <NumberField
                  label="Sanity Cap (%)"
                  value={context.terminalValue.gordon.sanityCap ?? 0}
                  onChange={(value) => updateGordon('sanityCap', value)}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-200/80">
                  <h4 className="font-semibold text-white">Exit Multiple</h4>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={context.terminalValue.exitMultiple.enabled}
                      onChange={(event) => updateExit('enabled', event.target.checked)}
                      className="h-4 w-4 rounded border-white/30 bg-transparent"
                    />
                    Enabled
                  </label>
                </div>
                <NumberField
                  label="Multiple"
                  value={context.terminalValue.exitMultiple.multiple}
                  onChange={(value) => updateExit('multiple', value)}
                />
                <div className="flex flex-col gap-2 text-sm text-slate-200/80">
                  <span>Reference Metric</span>
                  <select
                    value={context.terminalValue.exitMultiple.metric}
                    onChange={(event) =>
                      updateExit(
                        'metric',
                        event.target.value as BuilderState['context']['terminalValue']['exitMultiple']['metric'],
                      )
                    }
                    className="select-glass rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="ebitda">EBITDA</option>
                    <option value="ebit">EBIT</option>
                    <option value="revenue">Revenue</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Scenario Manager" subtitle="Base, bull, and bear adjustments">
        <div className="flex flex-wrap gap-4">
          {context.scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 transition ${
                scenario.id === activeScenarioId
                  ? 'border-accent-blue bg-accent-blue/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-white">{scenario.label}</p>
                <button
                  type="button"
                  onClick={() => onScenarioChange(scenario.id)}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-200/80 transition hover:bg-white/20"
                >
                  Activate
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-200/70">
                <ScenarioDetail label="Growth" value={formatDelta(scenario.adjustments.revenueGrowthDeltaPct)} suffix="%" />
                <ScenarioDetail label="Margin" value={formatDelta(scenario.adjustments.marginDeltaPct)} suffix="%" />
                <ScenarioDetail label="Exit Multiple" value={formatDelta(scenario.adjustments.exitMultipleDelta)} />
                <ScenarioDetail label="Discount" value={formatDelta(scenario.adjustments.discountRateDeltaPct)} suffix="%" />
              </dl>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Sensitivity Grid" subtitle="WACC versus growth or exit multiple">
        <div className="space-y-6">
          {gordonGrid ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-200/80">Gordon Growth</h4>
              <SensitivityTable grid={gordonGrid} formatValue={formatMillions} />
            </div>
          ) : null}
          {exitGrid ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-200/80">Exit Multiple</h4>
              <SensitivityTable grid={exitGrid} formatValue={formatMillions} />
            </div>
          ) : null}
          {!gordonGrid && !exitGrid ? (
            <p className="text-sm text-slate-400/80">Adjust sensitivity inputs to populate the grid.</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Monte Carlo" subtitle="Enterprise value distribution">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onRunMonteCarlo}
              disabled={isRunningMonteCarlo}
              className="rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-200/80 transition hover:bg-white/20 disabled:opacity-50"
            >
              {isRunningMonteCarlo ? 'Running...' : 'Run Simulation'}
            </button>
            {monteCarlo ? (
              <p className="text-sm text-slate-200/80">
                Median {formatMillions(monteCarlo.median)} | P10 {formatMillions(monteCarlo.p10)} | P90 {formatMillions(monteCarlo.p90)}
              </p>
            ) : (
              <p className="text-sm text-slate-500/80">No simulation yet</p>
            )}
          </div>
          {monteCarlo ? (
            <CashflowChart
              data={monteCarlo.samples.map((value, index) => ({
                date: index.toString(),
                value: Number(value.toFixed(2)),
              }))}
            />
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

interface ScenarioDetailProps {
  label: string;
  value: string;
  suffix?: string;
}

function ScenarioDetail({ label, value, suffix }: ScenarioDetailProps) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span>
        {value}
        {suffix}
      </span>
    </div>
  );
}

function formatDelta(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0';
  }
  if (value > 0) {
    return `+${value}`;
  }
  return value.toString();
}
