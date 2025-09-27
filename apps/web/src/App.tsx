import { ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ForecastTable } from '@/components/ForecastTable';
import { CashflowChart } from '@/components/CashflowChart';
import { EngineBadge } from '@/components/EngineBadge';
import { MetricCard } from '@/components/MetricCard';
import { StreamConsole, type StreamEntry } from '@/components/StreamConsole';
import { useValuationEngine } from '@/hooks/useValuationEngine';
import {
  buildEnginePayload,
  BuilderState,
  createDefaultState,
  formatCurrency,
  formatMillions,
  formatPercent,
  moneyToMillions,
  randomId,
  runMonteCarloAnalysis,
  runSensitivityAnalysis,
} from '@/lib/finance';
import type { MonteCarloResult, SensitivityResult } from '@/lib/model';
import { loadBuilderStateFromFile, normalizeForecast } from '@/lib/csv';
import { fetchAlphaVantageOverview } from '@/lib/dataProviders';

const MAX_STREAM_ENTRIES = 60;
const initialBuilderState = createDefaultState();

function App() {
  const engineState = useValuationEngine();
  const [state, setState] = useState<BuilderState>(initialBuilderState);
  const [activeScenarioId, setActiveScenarioId] = useState<string | undefined>(initialBuilderState.activeScenarioId);
  const [valuationSummary, setValuationSummary] = useState<ReturnType<typeof buildEnginePayload> | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [engineMetrics, setEngineMetrics] = useState<{ npvMillions: number; irrBps?: number } | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityResult[]>([]);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);
  const [isRunningMonteCarlo, setIsRunningMonteCarlo] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(false);
  const [streamEntries, setStreamEntries] = useState<StreamEntry[]>([]);
  const [dataWarnings, setDataWarnings] = useState<string[]>([]);
  const [publicTicker, setPublicTicker] = useState('');
  const [publicApiKey, setPublicApiKey] = useState('');
  const [publicWarning, setPublicWarning] = useState<string | null>(null);
  const [isFetchingPublic, setIsFetchingPublic] = useState(false);
  const appendStream = useCallback(
    (label: string, detail?: string, tone: StreamEntry['tone'] = 'info') => {
      if (!streamEnabled) {
        return;
      }
      setStreamEntries((entries) => {
        const entry: StreamEntry = {
          id: randomId(),
          label,
          detail,
          tone,
          timestamp: new Date().toLocaleTimeString(),
        };
        const next = [...entries.slice(-MAX_STREAM_ENTRIES + 1), entry];
        return next;
      });
    },
    [streamEnabled],
  );

  useEffect(() => {
    if (engineState.status === 'ready') {
      appendStream(`Engine ready (${engineState.kind.toUpperCase()})`, 'Rust core initialised', 'success');
    }
    if (engineState.status === 'error') {
      appendStream('Engine failed to load', engineState.error.message, 'error');
    }
  }, [engineState, appendStream]);

  useEffect(() => {
    if (engineState.status !== 'ready') {
      return;
    }

    let cancelled = false;

    const execute = async () => {
      try {
        setIsCalculating(true);
        const payload = buildEnginePayload(state, activeScenarioId);
        if (cancelled) {
          return;
        }
        setValuationSummary(payload);
        setSensitivity(runSensitivityAnalysis(state));
        appendStream(
          'Valuation run',
          `Scenario: ${payload.scenario?.label ?? 'Base'}, Discount: ${payload.valuation.discountRate.toFixed(2)}%`,
          'info',
        );
        const output = await engineState.engine.npv(payload.input);
        if (cancelled) {
          return;
        }
        const irrValue =
          typeof output.irrBps === 'number'
            ? output.irrBps
            : await engineState.engine.irr(payload.input).catch(() => undefined);
        setEngineMetrics({ npvMillions: moneyToMillions(output.npv), irrBps: irrValue ?? undefined });
        setCalcError(null);
        appendStream(
          'Valuation complete',
          `EV ${formatMillions(payload.valuation.enterpriseValue)}, Equity ${formatMillions(payload.valuation.equityValue)}`,
          'success',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Valuation failed';
        setCalcError(message);
        appendStream('Valuation failed', message, 'error');
      } finally {
        if (!cancelled) {
          setIsCalculating(false);
        }
      }
    };

    execute();

    return () => {
      cancelled = true;
    };
  }, [state, activeScenarioId, engineState, appendStream]);

  const valuation = valuationSummary?.valuation ?? null;
  const scenarioLabel = useMemo(() => {
    if (!valuationSummary?.scenario) {
      return 'Base';
    }
    return valuationSummary.scenario.label;
  }, [valuationSummary]);

  const gordonGrid = useMemo(
    () => buildSensitivityGrid(sensitivity, 'gordon', state.context),
    [sensitivity, state.context],
  );
  const exitGrid = useMemo(
    () => buildSensitivityGrid(sensitivity, 'exit', state.context),
    [sensitivity, state.context],
  );

  const chartData = useMemo(() => {
    if (!valuation) {
      return [];
    }
    return valuation.cashflows.map((cf) => ({
      date: cf.period.label,
      value: Number(cf.freeCashFlow.toFixed(2)),
    }));
  }, [valuation]);

  const handleScenarioChange = (id: string) => {
    setActiveScenarioId(id);
    appendStream('Scenario switched', id, 'info');
  };

  const handleMonteCarlo = async () => {
    try {
      setIsRunningMonteCarlo(true);
      appendStream('Monte Carlo', 'Sampling valuation distribution', 'info');
      const result = runMonteCarloAnalysis(state);
      setMonteCarlo(result);
      appendStream(
        'Monte Carlo complete',
        `Median ${formatMillions(result.median)}, P10 ${formatMillions(result.p10)}, P90 ${formatMillions(result.p90)}`,
        'success',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Monte Carlo failed';
      appendStream('Monte Carlo failed', message, 'error');
    } finally {
      setIsRunningMonteCarlo(false);
    }
  };
  const handleForecastChange = (periods: BuilderState['forecast']) => {
    setState((prev) => ({
      ...prev,
      forecast: periods,
    }));
  };

  const updateContext = <K extends keyof BuilderState['context']>(key: K, value: BuilderState['context'][K]) => {
    setState((prev) => ({
      ...prev,
      context: {
        ...prev.context,
        [key]: value,
      },
    }));
  };

  const updateWorkingCapital = <K extends keyof BuilderState['context']['workingCapital']>(
    key: K,
    value: BuilderState['context']['workingCapital'][K],
  ) => {
    updateContext('workingCapital', {
      ...state.context.workingCapital,
      [key]: value,
    });
  };

  const updateCapex = <K extends keyof BuilderState['context']['capex']>(
    key: K,
    value: BuilderState['context']['capex'][K],
  ) => {
    updateContext('capex', {
      ...state.context.capex,
      [key]: value,
    });
  };

  const updateLeases = <K extends keyof BuilderState['context']['leases']>(
    key: K,
    value: BuilderState['context']['leases'][K],
  ) => {
    updateContext('leases', {
      ...state.context.leases,
      [key]: value,
    });
  };

  const updateTax = <K extends keyof BuilderState['context']['tax']>(
    key: K,
    value: BuilderState['context']['tax'][K],
  ) => {
    updateContext('tax', {
      ...state.context.tax,
      [key]: value,
    });
  };

  const updateWacc = <K extends keyof BuilderState['context']['wacc']>(
    key: K,
    value: BuilderState['context']['wacc'][K],
  ) => {
    updateContext('wacc', {
      ...state.context.wacc,
      [key]: value,
    });
  };

  const updateTerminal = <K extends keyof BuilderState['context']['terminalValue']>(
    key: K,
    value: BuilderState['context']['terminalValue'][K],
  ) => {
    updateContext('terminalValue', {
      ...state.context.terminalValue,
      [key]: value,
    });
  };

  const updateGordon = <K extends keyof BuilderState['context']['terminalValue']['gordon']>(
    key: K,
    value: BuilderState['context']['terminalValue']['gordon'][K],
  ) => {
    updateTerminal('gordon', {
      ...state.context.terminalValue.gordon,
      [key]: value,
    });
  };

  const updateExit = <K extends keyof BuilderState['context']['terminalValue']['exitMultiple']>(
    key: K,
    value: BuilderState['context']['terminalValue']['exitMultiple'][K],
  ) => {
    updateTerminal('exitMultiple', {
      ...state.context.terminalValue.exitMultiple,
      [key]: value,
    });
  };

  const handleDataLoad = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const result = await loadBuilderStateFromFile(file);
      const normalized = normalizeForecast(result.state);
      setState(normalized);
      setActiveScenarioId(normalized.activeScenarioId ?? normalized.context.scenarios[0]?.id ?? activeScenarioId);
      setDataWarnings(result.warnings);
      appendStream('Dataset loaded', `Rows applied with ${result.warnings.length} warnings`, result.warnings.length ? 'warn' : 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to Import Data';
      setCalcError(message);
      appendStream('Dataset import failed', message, 'error');
    }
  };

  const handlePublicFetch = async () => {
    if (!publicTicker || !publicApiKey) {
      setPublicWarning('Ticker and API key required');
      return;
    }
    try {
      setIsFetchingPublic(true);
      setPublicWarning(null);
      const snapshot = await fetchAlphaVantageOverview(publicTicker, publicApiKey);
      if (snapshot.warning) {
        setPublicWarning(snapshot.warning);
      }
      setState((prev) => ({
        ...prev,
        context: {
          ...prev.context,
          metadata: {
            ...prev.context.metadata,
            ticker: snapshot.ticker,
          },
          sharesOutstanding: snapshot.sharesOutstanding ?? prev.context.sharesOutstanding,
          netDebt: snapshot.netDebtMillions ?? prev.context.netDebt,
        },
      }));
      appendStream('Public data pull', `Ticker ${snapshot.ticker} refreshed`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to pull public data';
      setPublicWarning(message);
      appendStream('Public data pull failed', message, 'error');
    } finally {
      setIsFetchingPublic(false);
    }
  };
  return (
    <div className="min-h-screen bg-surface text-white">
      <header className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-300/70">DCF Model Builder</p>
            <h1 className="text-4xl font-semibold text-white">Apple-grade valuation workspace</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {engineState.status === 'ready' ? <EngineBadge kind={engineState.kind} /> : null}
            <label className="flex items-center gap-2 text-xs text-slate-200/70">
              <input
                type="checkbox"
                checked={streamEnabled}
                onChange={(event) => {
                  setStreamEnabled(event.target.checked);
                  if (event.target.checked) {
                    setStreamOpen(true);
                  }
                }}
                className="h-4 w-4 rounded border-white/30 bg-transparent"
              />
              Stream Mode
            </label>
            <button
              type="button"
              onClick={() => setStreamOpen((prev) => !prev)}
              className="rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-200/80 transition hover:bg-white/20"
            >
              {streamOpen ? 'Hide Stream' : 'Show Stream'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-200/70">
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-[0.3em] text-slate-300/70">Scenario</span>
            <select
              value={activeScenarioId ?? ''}
              onChange={(event) => handleScenarioChange(event.target.value)}
              className="select-glass rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white outline-none"
            >
              {state.context.scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-[0.3em] text-slate-300/70">Compounding</span>
            <select
              value={state.context.compounding}
              onChange={(event) => updateContext('compounding', event.target.value as BuilderState['context']['compounding'])}
              className="select-glass rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white outline-none"
            >
              <option value="annual">Annual</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.context.midYearConvention}
              onChange={(event) => updateContext('midYearConvention', event.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-transparent"
            />
            <span className="uppercase tracking-[0.3em] text-slate-300/70">Mid-year convention</span>
          </label>
          <div className="flex items-center gap-2">
            <input type="file" accept=".csv,.parquet" onChange={handleDataLoad} className="hidden" id="csv-input" />
            <label
              htmlFor="csv-input"
              className="cursor-pointer rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-200/80 transition hover:bg-white/20"
            >
              Import Data
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={publicTicker}
              onChange={(event) => setPublicTicker(event.target.value.toUpperCase())}
              placeholder="Ticker"
              className="w-24 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
            />
            <input
              type="password"
              value={publicApiKey}
              onChange={(event) => setPublicApiKey(event.target.value)}
              placeholder="Alpha V API"
              className="w-40 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
            />
            <button
              type="button"
              onClick={handlePublicFetch}
              disabled={isFetchingPublic}
              className="rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-200/80 transition hover:bg-white/20 disabled:opacity-50"
            >
              {isFetchingPublic ? 'Fetching...' : 'Auto-fill'}
            </button>
          </div>
        </div>
        {dataWarnings.length || publicWarning ? (
          <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            {[...dataWarnings, publicWarning].filter(Boolean).map((warning) => (
              <p key={warning as string}>{warning}</p>
            ))}
          </div>
        ) : null}
        {calcError ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {calcError}
          </div>
        ) : null}
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-16 pt-8 lg:flex-row">
        <section className="flex-1 space-y-6">
          <ForecastTable periods={state.forecast} onChange={handleForecastChange} />

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Working Capital" subtitle="Control AR/AP days and side accounts">
              <div className="grid grid-cols-2 gap-4">
                <NumberField label="AR Days" value={state.context.workingCapital.arDays} onChange={(value) => updateWorkingCapital('arDays', value)} />
                <NumberField label="AP Days" value={state.context.workingCapital.apDays} onChange={(value) => updateWorkingCapital('apDays', value)} />
                <NumberField label="Inventory Days" value={state.context.workingCapital.inventoryDays} onChange={(value) => updateWorkingCapital('inventoryDays', value)} />
                <NumberField label="Opening NWC (M)" value={state.context.workingCapital.openingNetWorkingCapital} onChange={(value) => updateWorkingCapital('openingNetWorkingCapital', value)} />
                <NumberField label="Other Current Assets (M)" value={state.context.workingCapital.otherCurrentAssets} onChange={(value) => updateWorkingCapital('otherCurrentAssets', value)} />
                <NumberField label="Other Current Liabilities (M)" value={state.context.workingCapital.otherCurrentLiabilities} onChange={(value) => updateWorkingCapital('otherCurrentLiabilities', value)} />
              </div>
            </SectionCard>

            <SectionCard title="Capex & D&A" subtitle="Maintenance vs growth split">
              <div className="grid grid-cols-2 gap-4">
                <NumberField label="Opening PP&E (M)" value={state.context.capex.openingNetPpe} onChange={(value) => updateCapex('openingNetPpe', value)} />
                <NumberField label="Maintenance Capex (% Rev)" value={state.context.capex.maintenanceCapexPctRevenue} onChange={(value) => updateCapex('maintenanceCapexPctRevenue', value)} />
                <NumberField label="Growth Capex (% Rev)" value={state.context.capex.growthCapexPctRevenue} onChange={(value) => updateCapex('growthCapexPctRevenue', value)} />
                <NumberField label="Depreciation (% Rev)" value={state.context.capex.depreciationPctRevenue} onChange={(value) => updateCapex('depreciationPctRevenue', value)} />
              </div>
            </SectionCard>
            <SectionCard title="Leases" subtitle="IFRS 16 / ASC 842 adjustments">
              <div className="grid grid-cols-2 gap-4">
                <NumberField label="Lease Liability (M)" value={state.context.leases.operatingLeaseLiability} onChange={(value) => updateLeases('operatingLeaseLiability', value)} />
                <NumberField label="Lease Discount Rate (%)" value={state.context.leases.discountRate} onChange={(value) => updateLeases('discountRate', value)} />
                <NumberField label="Average Term (yrs)" value={state.context.leases.averageLeaseTermYears} onChange={(value) => updateLeases('averageLeaseTermYears', value)} />
                <NumberField label="Annual Lease Expense (M)" value={state.context.leases.annualLeaseExpense} onChange={(value) => updateLeases('annualLeaseExpense', value)} />
              </div>
            </SectionCard>

            <SectionCard title="Tax & NOL" subtitle="Cash vs. book tax dynamics">
              <div className="grid grid-cols-2 gap-4">
                <NumberField label="Statutory Rate (%)" value={state.context.tax.statutoryRate} onChange={(value) => updateTax('statutoryRate', value)} />
                <NumberField label="Cash Tax Rate (%)" value={state.context.tax.cashTaxRate} onChange={(value) => updateTax('cashTaxRate', value)} />
                <NumberField label="Opening NOL (M)" value={state.context.tax.nolOpening} onChange={(value) => updateTax('nolOpening', value)} />
                <NumberField label="NOL Usage Cap (M)" value={state.context.tax.nolAnnualUsageCap ?? 0} onChange={(value) => updateTax('nolAnnualUsageCap', value)} />
              </div>
            </SectionCard>

            <SectionCard title="WACC & Beta" subtitle="Re/Un-lever utilities">
              <div className="grid grid-cols-2 gap-4">
                <NumberField label="Risk-free Rate (%)" value={state.context.wacc.riskFreeRate} onChange={(value) => updateWacc('riskFreeRate', value)} />
                <NumberField label="Market Premium (%)" value={state.context.wacc.marketRiskPremium} onChange={(value) => updateWacc('marketRiskPremium', value)} />
                <NumberField label="Size Premium (%)" value={state.context.wacc.sizePremium} onChange={(value) => updateWacc('sizePremium', value)} />
                <NumberField label="Country Premium (%)" value={state.context.wacc.countryRiskPremium} onChange={(value) => updateWacc('countryRiskPremium', value)} />
                <NumberField label="Levered Beta" value={state.context.wacc.betaLevered} onChange={(value) => updateWacc('betaLevered', value)} />
                <NumberField label="Target D/E" value={state.context.wacc.targetDebtToEquity} onChange={(value) => updateWacc('targetDebtToEquity', value)} />
                <NumberField label="Cost of Debt (%)" value={state.context.wacc.costOfDebtPreTax} onChange={(value) => updateWacc('costOfDebtPreTax', value)} />
                <NumberField label="Tax Rate (%)" value={state.context.wacc.taxRate} onChange={(value) => updateWacc('taxRate', value)} />
              </div>
            </SectionCard>

            <SectionCard title="Terminal Value" subtitle="Gordon vs Exit multiple">
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-200/80">
                  <input
                    type="checkbox"
                    checked={state.context.terminalValue.applyBoth ?? false}
                    onChange={(event) => updateTerminal('applyBoth', event.target.checked)}
                    className="h-4 w-4 rounded border-white/30 bg-transparent"
                  />
                  Compute both methods
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <NumberField label="Gordon Enabled (1/0)" value={state.context.terminalValue.gordon.enabled ? 1 : 0} onChange={(value) => updateGordon('enabled', value >= 0.5)} />
                  <NumberField label="Growth (%)" value={state.context.terminalValue.gordon.growthRate} onChange={(value) => updateGordon('growthRate', value)} />
                  <NumberField label="Sanity Cap (%)" value={state.context.terminalValue.gordon.sanityCap ?? 0} onChange={(value) => updateGordon('sanityCap', value)} />
                  <NumberField label="Exit Enabled (1/0)" value={state.context.terminalValue.exitMultiple.enabled ? 1 : 0} onChange={(value) => updateExit('enabled', value >= 0.5)} />
                  <NumberField label="Exit Multiple" value={state.context.terminalValue.exitMultiple.multiple} onChange={(value) => updateExit('multiple', value)} />
                  <select
                    value={state.context.terminalValue.exitMultiple.metric}
                    onChange={(event) => updateExit('metric', event.target.value as BuilderState['context']['terminalValue']['exitMultiple']['metric'])}
                    className="select-glass rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="ebitda">EBITDA</option>
                    <option value="ebit">EBIT</option>
                    <option value="revenue">Revenue</option>
                  </select>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Scenario Manager" subtitle="Base / Bear / Bull adjustments">
            <div className="flex flex-wrap gap-4">
              {state.context.scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 transition ${scenario.id === activeScenarioId ? 'border-accent-blue bg-accent-blue/10' : 'border-white/10 bg-white/5'}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-white">{scenario.label}</p>
                    <button
                      type="button"
                      onClick={() => handleScenarioChange(scenario.id)}
                      className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-200/80 transition hover:bg-white/20"
                    >
                      Activate
                    </button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-200/70">
                    <DescriptionItem label="Growth">{scenario.adjustments.revenueGrowthDeltaPct ?? 0}%</DescriptionItem>
                    <DescriptionItem label="Margin">{scenario.adjustments.marginDeltaPct ?? 0}%</DescriptionItem>
                    <DescriptionItem label="Exit Multiple">{scenario.adjustments.exitMultipleDelta ?? 0}</DescriptionItem>
                    <DescriptionItem label="Discount">{scenario.adjustments.discountRateDeltaPct ?? 0}%</DescriptionItem>
                  </dl>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Sensitivity Grid" subtitle="WACC x Growth / Exit multiple">
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
            </div>
          </SectionCard>

          <SectionCard title="Monte Carlo" subtitle="Distribution of enterprise value">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleMonteCarlo}
                  disabled={isRunningMonteCarlo}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-200/80 transition hover:bg-white/20 disabled:opacity-50"
                >
                  {isRunningMonteCarlo ? 'Running...' : 'Run Simulation'}
                </button>
                {monteCarlo ? (
                  <p className="text-sm text-slate-200/80">
                    Median {formatMillions(monteCarlo.median)} · P10 {formatMillions(monteCarlo.p10)} · P90 {formatMillions(monteCarlo.p90)}
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
        </section>

        <aside className="w-full max-w-md space-y-6">
          <SectionCard title={`Valuation Summary (${scenarioLabel})`} subtitle="All values in millions">
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
                sublabel={`Net debt: ${formatMillions(state.context.netDebt)}`}
              />
              <MetricCard
                label="Per Share"
                value={
                  valuation
                    ? formatCurrency(valuation.perShare, state.context.metadata.currency ?? 'USD', {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      })
                    : '--'
                }
                accent="blue"
                sublabel={`Shares: ${state.context.sharesOutstanding.toLocaleString()}M`}
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

          <SectionCard title="Validation & Checks" subtitle="Balance sheet sanity">
            {valuation?.validations.length ? (
              <ul className="space-y-2 text-sm text-slate-200/80">
                {valuation.validations.map((validation) => (
                  <li key={validation} className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                    {validation}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400/80">No validation warnings</p>
            )}
          </SectionCard>
          <SectionCard title="EV Bridge" subtitle="From FCFF to equity">
            {valuation ? (
              <ul className="space-y-2 text-sm text-slate-200/80">
                {valuation.evBridge.map((item) => (
                  <li key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span>{item.label}</span>
                    <span>{formatMillions(item.value)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400/80">Run a valuation to populate bridge</p>
            )}
          </SectionCard>

          <SectionCard title="SOTP" subtitle="Segment valuation">
            {valuation?.sotp && valuation.sotp.segments.length ? (
              <ul className="space-y-2 text-sm text-slate-200/80">
                {valuation.sotp.segments.map((segment) => (
                  <li key={segment.segment.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
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
              <p className="text-sm text-slate-400/80">Add segments to view SOTP output</p>
            )}
          </SectionCard>

          <SectionCard title="Run Metadata" subtitle="Change logging">
            <ul className="space-y-2 text-xs uppercase tracking-[0.3em] text-slate-300/70">
              <li>Timestamp · {valuation?.runMetadata.timestampIso ?? '--'}</li>
              <li>Scenario · {valuation?.runMetadata.scenarioId ?? activeScenarioId ?? 'base'}</li>
              <li>Config · {valuation?.runMetadata.configPath ?? state.context.metadata.configPath ?? '--'}</li>
              <li>Git · {valuation?.runMetadata.gitCommit ?? state.context.metadata.gitCommit ?? '--'}</li>
            </ul>
          </SectionCard>
        </aside>
      </main>

      <footer className="pb-10 text-center text-xs uppercase tracking-[0.3em] text-slate-300/60">
        Built with Rust x TypeScript · Designed for precision finance
      </footer>

      <StreamConsole
        entries={streamEntries}
        isOpen={streamOpen}
        onClose={() => setStreamOpen(false)}
        headerExtras={
          <button
            type="button"
            onClick={() => setStreamEntries([])}
            className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200/70 transition hover:bg-white/20"
          >
            Clear
          </button>
        }
      />
    </div>
  );
}
interface SensitivityGrid {
  columns: number[];
  rows: Array<{ key: number; values: Record<number, number> }>;
  labelFormatter: (column: number) => string;
}

function buildSensitivityGrid(
  results: SensitivityResult[],
  mode: 'gordon' | 'exit',
  context: BuilderState['context'],
): SensitivityGrid | null {
  if (!results.length) {
    return null;
  }

  const baseGrowth = context.terminalValue.gordon.growthRate;
  const baseExit = context.terminalValue.exitMultiple.multiple;

  const filtered = results.filter((result) =>
    mode === 'gordon'
      ? result.terminalGrowth !== baseGrowth
      : result.exitMultiple !== baseExit,
  );

  if (!filtered.length) {
    return null;
  }

  const columns = Array.from(new Set(filtered.map((entry) => (mode === 'gordon' ? entry.terminalGrowth : entry.exitMultiple)))).sort((a, b) => a - b);
  const rowsMap = new Map<number, Record<number, number>>();

  for (const entry of filtered) {
    if (!rowsMap.has(entry.wacc)) {
      rowsMap.set(entry.wacc, {});
    }
    const columnKey = mode === 'gordon' ? entry.terminalGrowth : entry.exitMultiple;
    rowsMap.get(entry.wacc)![columnKey] = entry.enterpriseValue;
  }

  const rows = Array.from(rowsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([key, values]) => ({ key, values }));

  const labelFormatter = (value: number) => (mode === 'gordon' ? `${value.toFixed(1)}%` : `${value.toFixed(1)}x`);

  return { columns, rows, labelFormatter };
}

interface SensitivityTableProps {
  grid: SensitivityGrid;
  formatValue(value: number): string;
}

function SensitivityTable({ grid, formatValue }: SensitivityTableProps) {
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
              {grid.columns.map((column) => (
                <td key={column} className="px-3 py-2">
                  {row.values[column] ? formatValue(row.values[column]) : '--'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
}

function NumberField({ label, value, onChange }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-200/80">
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-accent-blue"
      />
    </label>
  );
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glass">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-300/80">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

interface DescriptionItemProps {
  label: string;
  children: ReactNode;
}

function DescriptionItem({ label, children }: DescriptionItemProps) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default App;




















