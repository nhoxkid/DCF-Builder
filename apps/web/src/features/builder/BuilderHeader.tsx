import type { ChangeEvent } from 'react';
import type { BuilderState } from '@/lib/finance';
import type { ScenarioDefinition } from '@/lib/model';

interface BuilderHeaderProps {
  scenarios: ScenarioDefinition[];
  activeScenarioId?: string;
  onScenarioChange(id: string): void;
  compounding: BuilderState['context']['compounding'];
  onCompoundingChange(value: BuilderState['context']['compounding']): void;
  midYearConvention: boolean;
  onMidYearToggle(value: boolean): void;
  onDataImport(event: ChangeEvent<HTMLInputElement>): void;
  streamEnabled: boolean;
  streamOpen: boolean;
  onStreamToggle(enabled: boolean): void;
  onStreamVisibilityToggle(): void;
  dataWarnings: string[];
  calcError: string | null;
  publicTicker: string;
  publicApiKey: string;
  onTickerChange(value: string): void;
  onApiKeyChange(value: string): void;
  onPullPublic(): void;
  isFetchingPublic: boolean;
  publicWarning: string | null;
}

export function BuilderHeader({
  scenarios,
  activeScenarioId,
  onScenarioChange,
  compounding,
  onCompoundingChange,
  midYearConvention,
  onMidYearToggle,
  onDataImport,
  streamEnabled,
  streamOpen,
  onStreamToggle,
  onStreamVisibilityToggle,
  dataWarnings,
  calcError,
  publicTicker,
  publicApiKey,
  onTickerChange,
  onApiKeyChange,
  onPullPublic,
  isFetchingPublic,
  publicWarning,
}: BuilderHeaderProps) {
  const alerts = [...dataWarnings, publicWarning, calcError].filter(Boolean) as string[];

  return (
    <header className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-300/70">DCF Model Builder</p>
          <h1 className="text-4xl font-semibold text-white">DCF Model Builder</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-200/70">
            <input
              type="checkbox"
              checked={streamEnabled}
              onChange={(event) => onStreamToggle(event.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-transparent"
            />
            Stream Mode
          </label>
          <button
            type="button"
            onClick={onStreamVisibilityToggle}
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
            onChange={(event) => onScenarioChange(event.target.value)}
            className="select-glass rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white outline-none"
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-[0.3em] text-slate-300/70">Compounding</span>
          <select
            value={compounding}
            onChange={(event) =>
              onCompoundingChange(event.target.value as BuilderState['context']['compounding'])
            }
            className="select-glass rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white outline-none"
          >
            <option value="annual">Annual</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={midYearConvention}
            onChange={(event) => onMidYearToggle(event.target.checked)}
            className="h-4 w-4 rounded border-white/30 bg-transparent"
          />
          <span className="uppercase tracking-[0.3em] text-slate-300/70">Mid-year convention</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv,.parquet"
            onChange={onDataImport}
            className="hidden"
            id="csv-input"
          />
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
            onChange={(event) => onTickerChange(event.target.value.toUpperCase())}
            placeholder="Ticker"
            className="w-24 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            type="password"
            value={publicApiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            placeholder="Alpha V API"
            className="w-40 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={onPullPublic}
            disabled={isFetchingPublic}
            className="rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-200/80 transition hover:bg-white/20 disabled:opacity-50"
          >
            {isFetchingPublic ? 'Fetching...' : 'Auto-fill'}
          </button>
        </div>
      </div>
      {alerts.length ? (
        <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          {alerts.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </header>
  );
}
