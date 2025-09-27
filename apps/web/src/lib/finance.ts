import {
  moneyFromMicros,
  moneyToMicros,
  type Cashflow as EngineCashflow,
  type DcfInput,
} from '@dcf-builder/engine-contract';

import {
  computeValuation,
  runMonteCarlo,
  runSensitivity,
} from './calculators';
import type {
  EquityAdjustment,
  ForecastPeriod,
  MonteCarloConfig,
  MonteCarloResult,
  ScenarioDefinition,
  SensitivityConfig,
  SensitivityResult,
  ValuationContext,
  ValuationOutputs,
} from './model';

const MICROS_PER_DOLLAR = 1_000_000n;
const DOLLARS_PER_MILLION = 1_000_000;

export interface BuilderState {
  forecast: ForecastPeriod[];
  context: ValuationContext;
  activeScenarioId?: string;
}

export interface ValuationBundle {
  valuation: ValuationOutputs;
  scenario?: ScenarioDefinition;
}

export interface EnginePayload extends ValuationBundle {
  input: DcfInput;
}

export function createDefaultState(): BuilderState {
  const currentYear = new Date().getUTCFullYear();
  const forecast: ForecastPeriod[] = Array.from({ length: 6 }).map((_, index) => ({
    label: `FY${currentYear + index}`,
    yearOffset: index + 1,
    revenue: 500 + index * 60,
    ebitMargin: 18 + index * 0.5,
  }));

  const context: ValuationContext = {
    asOf: new Date(Date.UTC(currentYear, 0, 1)).toISOString().slice(0, 10),
    compounding: 'annual',
    midYearConvention: true,
    discountRate: 9,
    terminalValue: {
      gordon: {
        enabled: true,
        growthRate: 2.5,
        sanityCap: 4,
      },
      exitMultiple: {
        enabled: true,
        metric: 'ebitda',
        multiple: 11,
        referenceYear: forecast.length - 1,
      },
      applyBoth: true,
    },
    workingCapital: {
      openingNetWorkingCapital: 120,
      arDays: 45,
      apDays: 30,
      inventoryDays: 50,
      otherCurrentAssets: 35,
      otherCurrentLiabilities: 25,
    },
    capex: {
      openingNetPpe: 420,
      maintenanceCapexPctRevenue: 4.5,
      growthCapexPctRevenue: 3,
      depreciationPctRevenue: 4.2,
    },
    leases: {
      operatingLeaseLiability: 90,
      discountRate: 5,
      averageLeaseTermYears: 8,
      annualLeaseExpense: 18,
    },
    tax: {
      statutoryRate: 24,
      cashTaxRate: 20,
      nolOpening: 55,
      nolAnnualUsageCap: 30,
      deferredTaxRate: 10,
    },
    wacc: {
      riskFreeRate: 3.5,
      marketRiskPremium: 5,
      sizePremium: 1,
      countryRiskPremium: 0.5,
      betaLevered: 1.1,
      targetDebtToEquity: 0.6,
      costOfDebtPreTax: 5.2,
      taxRate: 24,
    },
    sensitivity: {
      waccValues: [7, 8, 9, 10, 11],
      terminalGrowthRates: [1.5, 2, 2.5, 3],
      exitMultiples: [9, 10, 11, 12],
    },
    monteCarlo: {
      iterations: 250,
      drivers: [
        { key: 'revenue', distribution: 'normal', mean: 3, stdDev: 2 },
        { key: 'margin', distribution: 'normal', mean: 0, stdDev: 1 },
        { key: 'workingCapital', distribution: 'triangular', mean: 0, min: -5, mode: 0, max: 5 },
      ],
      seed: 42,
    },
    scenarios: [
      {
        id: randomId(),
        label: 'Base',
        adjustments: {},
      },
      {
        id: randomId(),
        label: 'Bull',
        adjustments: {
          revenueGrowthDeltaPct: 2,
          marginDeltaPct: 1,
          exitMultipleDelta: 1,
          discountRateDeltaPct: -0.5,
        },
      },
      {
        id: randomId(),
        label: 'Bear',
        adjustments: {
          revenueGrowthDeltaPct: -2,
          marginDeltaPct: -1.5,
          exitMultipleDelta: -1,
          discountRateDeltaPct: 0.75,
        },
      },
    ],
    segments: [
      {
        id: randomId(),
        label: 'Core SaaS',
        revenue: 420,
        ebitdaMargin: 32,
        investedCapital: 310,
        exitMultiple: 14,
      },
      {
        id: randomId(),
        label: 'Payments',
        revenue: 180,
        ebitdaMargin: 25,
        investedCapital: 140,
        exitMultiple: 11,
      },
    ],
    peers: [],
    netDebt: 260,
    sharesOutstanding: 145,
    equityAdjustments: [
      { label: 'Non-operating Assets', amount: 45 },
      { label: 'Minority Interest', amount: -25 },
    ],
    metadata: {
      companyName: 'Example Co.',
      ticker: 'EXCO',
      currency: 'USD',
      gitCommit: typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_GIT_SHA as string | undefined) : undefined,
      configPath: 'configs/base.yaml',
    },
  };

  return {
    forecast,
    context,
    activeScenarioId: context.scenarios[0]?.id,
  };
}

export function resolveScenario(state: BuilderState, scenarioId?: string): ScenarioDefinition | undefined {
  const targetId = scenarioId ?? state.activeScenarioId;
  if (!targetId) {
    return undefined;
  }
  return state.context.scenarios.find((scenario) => scenario.id === targetId);
}

export function evaluateState(state: BuilderState, scenarioId?: string): ValuationBundle {
  const scenario = resolveScenario(state, scenarioId);
  const valuation = computeValuation(state.forecast, state.context, { scenario });
  return { valuation, scenario };
}

export function buildEnginePayload(state: BuilderState, scenarioId?: string): EnginePayload {
  const scenario = resolveScenario(state, scenarioId);
  const valuation = computeValuation(state.forecast, state.context, { scenario });
  const asOfEpochDays = dateToEpochDays(state.context.asOf);

  const engineCashflows: EngineCashflow[] = valuation.cashflows.map((cashflow) => {
    const epoch = shiftEpochDays(asOfEpochDays, cashflow.period.yearOffset, state.context.midYearConvention);
    return {
      dateEpochDays: epoch,
      amount: moneyFromMicros(millionsToMicros(cashflow.freeCashFlow)),
    };
  });

  if (valuation.terminalValues.length && engineCashflows.length) {
    const terminalValue = valuation.terminalValues[0]?.value ?? 0;
    const last = engineCashflows[engineCashflows.length - 1];
    const combined = moneyToMicros(last.amount) + millionsToMicros(terminalValue);
    engineCashflows[engineCashflows.length - 1] = {
      ...last,
      amount: moneyFromMicros(combined),
    };
  }

  const input: DcfInput = {
    cashflows: engineCashflows,
    discountRateBps: Math.round(valuation.discountRate * 100),
    compounding: state.context.compounding,
    asOfEpochDays,
  };

  return {
    input,
    valuation,
    scenario,
  };
}

export function runSensitivityAnalysis(state: BuilderState): SensitivityResult[] {
  return runSensitivity(state.forecast, state.context);
}

export function runMonteCarloAnalysis(state: BuilderState): MonteCarloResult {
  return runMonteCarlo(state.forecast, state.context);
}

export function millionsToMicros(value: number): bigint {
  const dollars = BigInt(Math.round(value * DOLLARS_PER_MILLION));
  return dollars * MICROS_PER_DOLLAR;
}

export function microsToMillions(value: bigint): number {
  const dollars = Number(value / MICROS_PER_DOLLAR);
  return dollars / DOLLARS_PER_MILLION;
}

export function moneyToMillions(money: { micro: string }): number {
  return microsToMillions(moneyToMicros(money));
}

export function dateToEpochDays(date: string): number {
  const value = new Date(`${date}T00:00:00Z`);
  return Math.floor(value.getTime() / 86_400_000);
}

export function epochDaysToDate(epochDays: number): string {
  const ms = epochDays * 86_400_000;
  const date = new Date(ms);
  return date.toISOString().slice(0, 10);
}

export function formatMillions(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value) + 'M';
}

export function formatCurrency(value: number, currency = 'USD', options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    ...options,
  }).format(value);
}

export function formatPercent(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    ...options,
  }).format(value / 100);
}

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function shiftEpochDays(asOfEpoch: number, yearOffset: number, midYear: boolean): number {
  const effectiveOffsetYears = Math.max(yearOffset - (midYear ? 0.5 : 0), 0);
  const shiftDays = Math.round(effectiveOffsetYears * 365);
  return asOfEpoch + shiftDays;
}

