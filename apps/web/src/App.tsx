import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ForecastTable } from '@/components/ForecastTable';
import { StreamConsole, type StreamEntry } from '@/components/StreamConsole';
import { useBuilderState } from '@/hooks/useBuilderState';
import { useValuationEngine } from '@/hooks/useValuationEngine';
import { BuilderHeader } from '@/features/builder/BuilderHeader';
import { ControlPanel } from '@/features/builder/ControlPanel';
import { AnalyticsPanel } from '@/features/builder/AnalyticsPanel';
import {
  buildEnginePayload,
  formatMillions,
  moneyToMillions,
  randomId,
  runMonteCarloAnalysis,
  runSensitivityAnalysis,
  type BuilderState,
} from '@/lib/finance';
import { buildSensitivityGrid } from '@/lib/sensitivity';
import type { MonteCarloResult, SensitivityResult } from '@/lib/model';
import { loadBuilderStateFromFile, normalizeForecast } from '@/lib/csv';
import { fetchAlphaVantageOverview } from '@/lib/dataProviders';

const MAX_STREAM_ENTRIES = 60;

function App() {
  const engineState = useValuationEngine();
  const {
    state,
    activeScenarioId,
    setActiveScenarioId,
    setForecast,
    replaceState,
    setContextValue,
    mutateContext,
    updateWorkingCapital,
    updateCapex,
    updateLeases,
    updateTax,
    updateWacc,
    updateTerminal,
    updateGordon,
    updateExit,
  } = useBuilderState();

  const [valuationSummary, setValuationSummary] = useState<ReturnType<typeof buildEnginePayload> | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [engineMetrics, setEngineMetrics] = useState<{ npvMillions: number; irrBps?: number } | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityResult[]>([]);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);
  const [isRunningMonteCarlo, setIsRunningMonteCarlo] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
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
        return [...entries.slice(-MAX_STREAM_ENTRIES + 1), entry];
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
  const scenarioLabel = useMemo(() => valuationSummary?.scenario?.label ?? 'Base', [valuationSummary]);

  const gordonGrid = useMemo(
    () => buildSensitivityGrid(sensitivity, 'gordon', state.context),
    [sensitivity, state.context],
  );
  const exitGrid = useMemo(
    () => buildSensitivityGrid(sensitivity, 'exit', state.context),
    [sensitivity, state.context],
  );

  const cashflowSeries = useMemo(() => {
    if (!valuation) {
      return [] as Array<{ date: string; value: number }>;
    }
    return valuation.cashflows.map((cf) => ({
      date: cf.period.label,
      value: Number(cf.freeCashFlow.toFixed(2)),
    }));
  }, [valuation]);

  const handleScenarioChange = useCallback(
    (id: string) => {
      setActiveScenarioId(id);
      appendStream('Scenario switched', id, 'info');
    },
    [appendStream, setActiveScenarioId],
  );

  const handleMonteCarlo = useCallback(() => {
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
  }, [appendStream, state]);

  const handleForecastChange = useCallback(
    (periods: BuilderState['forecast']) => {
      setForecast(periods);
    },
    [setForecast],
  );

  const handleDataLoad = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      try {
        const result = await loadBuilderStateFromFile(file);
        const normalized = normalizeForecast(result.state);
        replaceState(normalized);
        setDataWarnings(result.warnings);
        setMonteCarlo(null);
        appendStream(
          'Dataset loaded',
          `Rows applied with ${result.warnings.length} warnings`,
          result.warnings.length ? 'warn' : 'success',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to import data';
        setCalcError(message);
        appendStream('Dataset import failed', message, 'error');
      }
    },
    [appendStream, replaceState],
  );

  const handlePublicFetch = useCallback(async () => {
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
      mutateContext((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          ticker: snapshot.ticker,
        },
        sharesOutstanding: snapshot.sharesOutstanding ?? prev.sharesOutstanding,
        netDebt: snapshot.netDebtMillions ?? prev.netDebt,
      }));
      appendStream('Public data pull', `Ticker ${snapshot.ticker} refreshed`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to pull public data';
      setPublicWarning(message);
      appendStream('Public data pull failed', message, 'error');
    } finally {
      setIsFetchingPublic(false);
    }
  }, [appendStream, mutateContext, publicApiKey, publicTicker]);

  const handleStreamToggle = useCallback((enabled: boolean) => {
    setStreamEnabled(enabled);
    if (enabled) {
      setStreamOpen(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-surface text-white">
      <BuilderHeader
        scenarios={state.context.scenarios}
        activeScenarioId={activeScenarioId}
        onScenarioChange={handleScenarioChange}
        compounding={state.context.compounding}
        onCompoundingChange={(value) => setContextValue('compounding', value)}
        midYearConvention={state.context.midYearConvention}
        onMidYearToggle={(value) => setContextValue('midYearConvention', value)}
        onDataImport={handleDataLoad}
        streamEnabled={streamEnabled}
        streamOpen={streamOpen}
        onStreamToggle={handleStreamToggle}
        onStreamVisibilityToggle={() => setStreamOpen((prev) => !prev)}
        dataWarnings={dataWarnings}
        calcError={calcError}
        publicTicker={publicTicker}
        publicApiKey={publicApiKey}
        onTickerChange={setPublicTicker}
        onApiKeyChange={setPublicApiKey}
        onPullPublic={handlePublicFetch}
        isFetchingPublic={isFetchingPublic}
        publicWarning={publicWarning}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-16 pt-8 lg:flex-row">
        <section className="flex-1 space-y-6">
          <ForecastTable periods={state.forecast} onChange={handleForecastChange} />
          <ControlPanel
            context={state.context}
            activeScenarioId={activeScenarioId}
            onScenarioChange={handleScenarioChange}
            updateWorkingCapital={updateWorkingCapital}
            updateCapex={updateCapex}
            updateLeases={updateLeases}
            updateTax={updateTax}
            updateWacc={updateWacc}
            updateTerminal={updateTerminal}
            updateGordon={updateGordon}
            updateExit={updateExit}
            gordonGrid={gordonGrid}
            exitGrid={exitGrid}
            onRunMonteCarlo={handleMonteCarlo}
            isRunningMonteCarlo={isRunningMonteCarlo}
            monteCarlo={monteCarlo}
          />
        </section>

        <AnalyticsPanel
          valuation={valuation}
          scenarioLabel={scenarioLabel}
          engineMetrics={engineMetrics}
          context={state.context}
          activeScenarioId={activeScenarioId}
          cashflowSeries={cashflowSeries}
          isCalculating={isCalculating}
        />
      </main>

      <footer className="pb-10 text-center text-xs uppercase tracking-[0.3em] text-slate-300/60">
        Built with Rust and TypeScript | Designed for precision finance
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

export default App;
