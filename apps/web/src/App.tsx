import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CashflowEditor } from '@/components/CashflowEditor';
import { CashflowChart } from '@/components/CashflowChart';
import { EngineBadge } from '@/components/EngineBadge';
import { MetricCard } from '@/components/MetricCard';
import { useValuationEngine } from '@/hooks/useValuationEngine';
import {
  BuilderState,
  createDefaultState,
  formatCurrency,
  formatMillions,
  formatPercent,
  moneyToMillions,
  toDcfInput,
} from '@/lib/finance';

interface ValuationSnapshot {
  npvMillions: number;
  irrBps?: number;
  equityMillions: number;
  enterpriseValueMillions: number;
  perShare: number;
}

const initialState = createDefaultState();

function App() {
  const engineState = useValuationEngine();
  const [formState, setFormState] = useState<BuilderState>(initialState);
  const [valuation, setValuation] = useState<ValuationSnapshot | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  useEffect(() => {
    if (engineState.status !== 'ready') {
      return;
    }

    let cancelled = false;
    const engine = engineState.engine;
    const input = toDcfInput(formState);

    setIsCalculating(true);
    setCalcError(null);

    (async () => {
      try {
        const output = await engine.npv(input);
        const irrBps =
          typeof output.irrBps === 'number' ? output.irrBps : await engine.irr(input).catch(() => undefined);

        const npvMillions = moneyToMillions(output.npv);
        const enterpriseValueMillions = npvMillions;
        const equityMillions = enterpriseValueMillions - formState.netDebt;
        const perShareValue =
          formState.sharesOutstanding > 0 ? equityMillions / formState.sharesOutstanding : 0;

        if (!cancelled) {
          setValuation({
            npvMillions,
            irrBps,
            enterpriseValueMillions,
            equityMillions,
            perShare: perShareValue,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setCalcError(error instanceof Error ? error.message : 'Unable to compute valuation');
        }
      } finally {
        if (!cancelled) {
          setIsCalculating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [engineState, formState]);

  const chartData = useMemo(
    () =>
      formState.cashflows.map((cf) => ({
        date: new Date(cf.date + 'T00:00:00Z').getUTCFullYear().toString(),
        value: cf.amount,
      })),
    [formState.cashflows]
  );

  const irrPercent = valuation?.irrBps != null ? valuation.irrBps / 100 : null;

  return (
    <div className="flex min-h-screen flex-col gap-10 px-6 py-12 text-white md:px-12 lg:px-16">
      <header className="space-y-6">
        <div className="min-h-[2.5rem]">
          {engineState.status === 'ready' ? (
            <EngineBadge kind={engineState.kind} />
          ) : engineState.status === 'error' ? (
            <div className="inline-flex items-center rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-red-200">
              Engine load failed
            </div>
          ) : (
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-200/70">
              Initializing engine
            </div>
          )}
        </div>
        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Build a Precise Discounted Cashflow in Minutes
          </motion.h1>
          <p className="max-w-3xl text-lg text-slate-200/80">
            Model enterprise value, equity value, and per-share outcomes with a Rust-powered engine and
            Apple-inspired interface. Adjust cashflows, assumptions, and instantly see results.
          </p>
        </div>
      </header>

      <main className="grid gap-10 lg:grid-cols-[1.7fr_1fr]">
        <section className="space-y-6">
          <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glass">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="As-of Date"
                value={formState.asOf}
                onChange={(value) => setFormState((state) => ({ ...state, asOf: value }))}
                type="date"
              />
              <Field
                label="Discount Rate"
                value={formState.discountRate}
                suffix="%"
                step={0.1}
                onChange={(value) => setFormState((state) => ({ ...state, discountRate: value as number }))}
              />
              <label className="flex flex-col gap-2 text-sm text-slate-200/80">
                Compounding
                <select
                  value={formState.compounding}
                  onChange={(event) =>
                    setFormState((state) => ({
                      ...state,
                      compounding: event.target.value as BuilderState['compounding'],
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none focus:border-accent-blue"
                >
                  <option value="annual">Annual</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <Field
                label="Net Debt"
                value={formState.netDebt}
                suffix="M"
                onChange={(value) => setFormState((state) => ({ ...state, netDebt: value as number }))}
              />
              <Field
                label="Shares Outstanding"
                value={formState.sharesOutstanding}
                suffix="M"
                onChange={(value) =>
                  setFormState((state) => ({ ...state, sharesOutstanding: value as number }))
                }
              />
            </div>
          </div>

          <CashflowEditor
            cashflows={formState.cashflows}
            onChange={(cashflows) => setFormState((state) => ({ ...state, cashflows }))}
          />

          <CashflowChart data={chartData} />
        </section>

        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glass">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Valuation Summary</h2>
              <AnimatePresence mode="wait">
                {isCalculating ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="text-sm text-accent-blue"
                  >
                    Recomputing
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
            <p className="mt-2 text-sm text-slate-200/70">
              Outputs are shown in millions. Adjust your assumptions to explore valuation sensitivities.
            </p>
          </div>

          {calcError ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 shadow-glass">
              {calcError}
            </div>
          ) : null}

          <div className="grid gap-5">
            <MetricCard
              label="Enterprise Value"
              value={valuation ? formatMillions(valuation.enterpriseValueMillions) : '—'}
              accent="blue"
              sublabel="NPV of forecast cashflows"
            />
            <MetricCard
              label="Equity Value"
              value={valuation ? formatMillions(valuation.equityMillions) : '—'}
              accent="teal"
              sublabel={
                formState.netDebt
                  ? `Net debt: ${formatMillions(formState.netDebt)}`
                  : 'No net debt adjustments'
              }
            />
            <MetricCard
              label="Per Share"
              value={
                valuation
                  ? formatCurrency(valuation.perShare, {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    })
                  : '—'
              }
              accent="blue"
              sublabel={`Shares: ${formState.sharesOutstanding.toLocaleString()}M`}
            />
            <MetricCard
              label="Internal Rate of Return"
              value={irrPercent != null ? formatPercent(irrPercent) : '—'}
              accent="teal"
              sublabel="Computed over cashflow horizon"
            />
          </div>
        </aside>
      </main>

      <footer className="pb-6 text-xs uppercase tracking-[0.3em] text-slate-300/60">
        Made with Rust ? TypeScript · Designed for precision finance
      </footer>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: number | string;
  onChange: (value: number | string) => void;
  type?: 'number' | 'date';
  step?: number;
  suffix?: string;
}

function Field({ label, value, onChange, type = 'number', step = 1, suffix }: FieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-200/80">
      {label}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white focus-within:border-accent-blue">
        <input
          type={type}
          value={value}
          step={type === 'number' ? step : undefined}
          onChange={(event) => {
            if (type === 'number') {
              onChange(Number(event.target.value));
            } else {
              onChange(event.target.value);
            }
          }}
          className="w-full bg-transparent text-white outline-none"
        />
        {suffix ? <span className="text-sm text-slate-200/60">{suffix}</span> : null}
      </div>
    </label>
  );
}

export default App;
