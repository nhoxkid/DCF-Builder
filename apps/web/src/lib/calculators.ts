import type {
  CapexSettings,
  CompsPeer,
  DerivedCashflow,
  EvBridgeItem,
  ForecastPeriod,
  LeaseSettings,
  MonteCarloConfig,
  MonteCarloDriver,
  MonteCarloResult,
  ScenarioAdjustments,
  ScenarioDefinition,
  SegmentInput,
  SensitivityConfig,
  SensitivityResult,
  SotpOutput,
  SotpSegmentValue,
  TaxSettings,
  TerminalValueMethod,
  TerminalValueOutput,
  ValuationContext,
  ValuationOutputs,
  WorkingCapitalSettings,
  WaccInputs,
} from './model';

const DAYS_PER_YEAR = 365;

export interface ComputeOptions {
  scenario?: ScenarioDefinition | null;
  overrideDiscountRate?: number;
  exitMultipleOverride?: number;
}

export function unleverBeta(betaLevered: number, debtToEquity: number, taxRatePct: number): number {
  const tax = taxRatePct / 100;
  return betaLevered / (1 + (1 - tax) * debtToEquity);
}

export function releverBeta(betaUnlevered: number, debtToEquity: number, taxRatePct: number): number {
  const tax = taxRatePct / 100;
  return betaUnlevered * (1 + (1 - tax) * debtToEquity);
}

export function calculateWacc(inputs: WaccInputs): {
  costOfEquity: number;
  costOfDebtAfterTax: number;
  weightOfEquity: number;
  weightOfDebt: number;
  wacc: number;
} {
  const taxRate = inputs.taxRate / 100;
  const beta =
    typeof inputs.betaUnlevered === 'number'
      ? releverBeta(inputs.betaUnlevered, inputs.targetDebtToEquity, inputs.taxRate)
      : inputs.betaLevered;

  const marketPremium = inputs.marketRiskPremium + inputs.countryRiskPremium;
  const costOfEquity =
    inputs.riskFreeRate + beta * marketPremium + inputs.sizePremium;

  const costOfDebtAfterTax = inputs.costOfDebtPreTax * (1 - taxRate);
  const debtWeight = inputs.targetDebtToEquity / (1 + inputs.targetDebtToEquity);
  const equityWeight = 1 - debtWeight;
  const wacc = costOfEquity * equityWeight + costOfDebtAfterTax * debtWeight;

  return {
    costOfEquity,
    costOfDebtAfterTax,
    weightOfDebt: debtWeight,
    weightOfEquity: equityWeight,
    wacc,
  };
}

export function applyScenario(
  forecast: ForecastPeriod[],
  context: ValuationContext,
  scenario?: ScenarioDefinition | null,
): { forecast: ForecastPeriod[]; context: ValuationContext } {
  if (!scenario) {
    return { forecast, context };
  }

  const adjustments: ScenarioAdjustments = {
    revenueGrowthDeltaPct: 0,
    marginDeltaPct: 0,
    exitMultipleDelta: 0,
    discountRateDeltaPct: 0,
    ...scenario.adjustments,
  };

  const adjustedForecast = forecast.map((period, index) => {
    const previous = index === 0 ? null : forecast[index - 1];
    const baseGrowth = previous ? percentageChange(previous.revenue, period.revenue) : 0;
    const adjustedGrowth = baseGrowth + adjustments.revenueGrowthDeltaPct;
    const newRevenue = previous ? previous.revenue * (1 + adjustedGrowth / 100) : period.revenue;
    return {
      ...period,
      revenue: Number.isFinite(newRevenue) ? newRevenue : period.revenue,
      ebitMargin: period.ebitMargin + adjustments.marginDeltaPct,
    };
  });

  const adjustedContext: ValuationContext = {
    ...context,
    discountRate: context.discountRate + adjustments.discountRateDeltaPct,
    terminalValue: {
      ...context.terminalValue,
      exitMultiple: {
        ...context.terminalValue.exitMultiple,
        multiple:
          context.terminalValue.exitMultiple.multiple + adjustments.exitMultipleDelta,
      },
    },
  };

  return { forecast: adjustedForecast, context: adjustedContext };
}

function percentageChange(previous: number, current: number): number {
  if (previous === 0) {
    return 0;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}
interface CashflowState {
  netWorkingCapital: number;
  netPpe: number;
  leaseLiability: number;
  nolBalance: number;
}

export function deriveCashflows(
  forecast: ForecastPeriod[],
  context: ValuationContext,
): DerivedCashflow[] {
  const results: DerivedCashflow[] = [];
  const state: CashflowState = {
    netWorkingCapital: context.workingCapital.openingNetWorkingCapital,
    netPpe: context.capex.openingNetPpe,
    leaseLiability: context.leases.operatingLeaseLiability,
    nolBalance: context.tax.nolOpening,
  };

  for (const period of forecast) {
    const ebit = computeEbit(period);
    const depreciation = resolveDepreciation(period, context.capex);
    const capex = resolveCapex(period, context.capex);

    const workingCapital = resolveWorkingCapital(period, context.workingCapital, state);
    const changeInNwc = workingCapital - state.netWorkingCapital;

    const leaseInterest = state.leaseLiability * (context.leases.discountRate / 100);
    const leaseAmortization = Math.min(
      Math.max(context.leases.annualLeaseExpense - leaseInterest, 0),
      state.leaseLiability,
    );

    const taxableIncome = ebit - leaseInterest;
    const taxOutcome = applyTaxRules(taxableIncome, context.tax, state.nolBalance);
    state.nolBalance = taxOutcome.updatedNol;

    const nopat = ebit - taxOutcome.bookTaxes;
    const freeCashFlow =
      nopat + depreciation - capex - changeInNwc - leaseAmortization;

    state.netWorkingCapital = workingCapital;
    state.netPpe = Math.max(state.netPpe + capex - depreciation, 0);
    state.leaseLiability = Math.max(state.leaseLiability - leaseAmortization, 0);

    results.push({
      period,
      freeCashFlow,
      ebit,
      nopat,
      changeInNetWorkingCapital: changeInNwc,
      depreciation,
      capex,
      leaseInterest,
      leaseAmortization,
      taxPaid: taxOutcome.cashTaxes,
      endingNetWorkingCapital: state.netWorkingCapital,
      endingNetPpe: state.netPpe,
      nolBalance: state.nolBalance,
    });
  }

  return results;
}

function computeEbit(period: ForecastPeriod): number {
  const ebitMargin = period.ebitMargin / 100;
  const base = period.revenue * ebitMargin;
  return base + (period.otherOperatingIncome ?? 0);
}

function resolveDepreciation(period: ForecastPeriod, capex: CapexSettings): number {
  if (typeof period.depreciationOverride === 'number') {
    return period.depreciationOverride;
  }
  return period.revenue * (capex.depreciationPctRevenue / 100);
}

function resolveCapex(period: ForecastPeriod, capex: CapexSettings): number {
  if (typeof period.capexOverride === 'number') {
    return period.capexOverride;
  }
  const maintenance = period.revenue * (capex.maintenanceCapexPctRevenue / 100);
  const growth = period.revenue * (capex.growthCapexPctRevenue / 100);
  return maintenance + growth;
}

function resolveWorkingCapital(
  period: ForecastPeriod,
  workingCapital: WorkingCapitalSettings,
  state: CashflowState,
): number {
  if (typeof period.workingCapitalOverride === 'number') {
    return period.workingCapitalOverride + workingCapital.otherCurrentAssets - workingCapital.otherCurrentLiabilities;
  }

  const revenue = Math.max(period.revenue, 0);
  const cogs = revenue * (1 - period.ebitMargin / 100);
  const dailyRevenue = revenue / DAYS_PER_YEAR;
  const dailyCogs = cogs / DAYS_PER_YEAR;

  const ar = dailyRevenue * workingCapital.arDays;
  const inventory = dailyCogs * workingCapital.inventoryDays;
  const ap = dailyCogs * workingCapital.apDays;

  return ar + inventory + workingCapital.otherCurrentAssets - ap - workingCapital.otherCurrentLiabilities;
}

interface TaxOutcome {
  bookTaxes: number;
  cashTaxes: number;
  updatedNol: number;
}

function applyTaxRules(
  taxableIncome: number,
  tax: TaxSettings,
  nolBalance: number,
): TaxOutcome {
  const statutory = tax.statutoryRate / 100;
  const cashRate = tax.cashTaxRate / 100;
  let remainingTaxable = taxableIncome;
  let updatedNol = nolBalance;
  let nolUsed = 0;

  if (remainingTaxable > 0 && updatedNol > 0) {
    const cap = typeof tax.nolAnnualUsageCap === 'number' ? Math.min(tax.nolAnnualUsageCap, updatedNol) : updatedNol;
    const offset = Math.min(cap, remainingTaxable);
    remainingTaxable -= offset;
    updatedNol -= offset;
    nolUsed = offset;
  }

  if (remainingTaxable < 0) {
    updatedNol += Math.abs(remainingTaxable);
    remainingTaxable = 0;
  }

  const bookTaxes = Math.max(remainingTaxable * statutory, 0);
  const cashTaxes = Math.max((remainingTaxable + nolUsed * (tax.deferredTaxRate ? tax.deferredTaxRate / 100 : 0)) * cashRate, 0);

  return {
    bookTaxes,
    cashTaxes,
    updatedNol,
  };
}
export function computeTerminalValues(
  cashflows: DerivedCashflow[],
  context: ValuationContext,
  discountRatePct: number,
  exitMultipleOverride?: number,
): TerminalValueOutput[] {
  if (cashflows.length === 0) {
    return [];
  }

  const last = cashflows[cashflows.length - 1];
  const gordon: TerminalValueOutput[] = [];
  const exit: TerminalValueOutput[] = [];
  const discountRate = discountRatePct;

  if (context.terminalValue.gordon.enabled) {
    const growth = context.terminalValue.gordon.growthRate;
    const discount = discountRate;
    let warning: string | undefined;
    if (growth >= discount) {
      warning = 'Terminal growth >= discount rate; check assumptions.';
    } else if (
      typeof context.terminalValue.gordon.sanityCap === 'number' &&
      growth > context.terminalValue.gordon.sanityCap
    ) {
      warning = 'Growth exceeds sanity cap.';
    }
    const terminalValue = last.freeCashFlow * (1 + growth / 100) / ((discount - growth) / 100);
    gordon.push({ method: 'gordon', value: terminalValue, warning });
  }

  if (context.terminalValue.exitMultiple.enabled) {
    const multiple = exitMultipleOverride ?? context.terminalValue.exitMultiple.multiple;
    const metric = context.terminalValue.exitMultiple.metric;
    const referenceIndex = context.terminalValue.exitMultiple.referenceYear ?? cashflows.length - 1;
    const reference = cashflows[Math.min(Math.max(referenceIndex, 0), cashflows.length - 1)];
    const metricValue = resolveExitMetric(reference, metric);
    let warning: string | undefined;
    if (metricValue <= 0) {
      warning = 'Exit metric non-positive; check margins.';
    }
    const terminalValue = metricValue * multiple;
    exit.push({ method: 'exit', value: terminalValue, impliedMultiple: multiple, warning });
  }

  if (context.terminalValue.applyBoth) {
    return [...gordon, ...exit];
  }

  return gordon.length ? gordon : exit;
}

function resolveExitMetric(cashflow: DerivedCashflow, metric: 'ebitda' | 'ebit' | 'revenue'): number {
  switch (metric) {
    case 'ebitda':
      return cashflow.ebit + cashflow.depreciation;
    case 'ebit':
      return cashflow.ebit;
    case 'revenue':
    default:
      return cashflow.period.revenue;
  }
}

export function discountCashflows(
  cashflows: DerivedCashflow[],
  terminalValues: TerminalValueOutput[],
  context: ValuationContext,
  discountRatePct: number,
): { presentValue: number; terminalPresentValue: number } {
  const compounding = context.compounding === 'monthly' ? 12 : 1;
  const rate = discountRatePct / 100;
  const perPeriodRate = rate / compounding;

  let presentValue = 0;
  const offsets = cashflows.map((cf) => effectiveYearOffset(cf.period.yearOffset, context.midYearConvention));

  cashflows.forEach((cashflow, index) => {
    const periods = offsets[index] * compounding;
    const discountFactor = Math.pow(1 + perPeriodRate, periods);
    const pv = cashflow.freeCashFlow / discountFactor;
    presentValue += pv;
  });

  const lastOffset = offsets[offsets.length - 1] ?? 0;
  const terminalPresentValue = terminalValues.reduce((acc, tv) => {
    const exponent = (lastOffset + (context.midYearConvention ? 0.5 : 0)) * compounding;
    const discountFactor = Math.pow(1 + perPeriodRate, exponent);
    return acc + tv.value / discountFactor;
  }, 0);

  return { presentValue, terminalPresentValue };
}

function effectiveYearOffset(yearOffset: number, midYear: boolean): number {
  return Math.max(yearOffset - (midYear ? 0.5 : 0), 0);
}
export function computeValuation(
  forecast: ForecastPeriod[],
  baseContext: ValuationContext,
  options: ComputeOptions = {},
): ValuationOutputs {
  const { forecast: adjustedForecast, context } = applyScenario(
    forecast,
    baseContext,
    options.scenario ?? null,
  );

  const cashflows = deriveCashflows(adjustedForecast, context);
  const waccDetails = calculateWacc(context.wacc);
  const discountRate = options.overrideDiscountRate ?? context.discountRate ?? waccDetails.wacc;
  const terminalValues = computeTerminalValues(
    cashflows,
    context,
    discountRate,
    options.exitMultipleOverride,
  );

  const { presentValue, terminalPresentValue } = discountCashflows(
    cashflows,
    terminalValues,
    context,
    discountRate,
  );

  const enterpriseValue = presentValue + terminalPresentValue;
  const equityAdjustments = (context.equityAdjustments ?? []).reduce((acc, item) => acc + item.amount, 0);
  const equityValue = enterpriseValue - context.netDebt + equityAdjustments;
  const shares = Math.max(context.sharesOutstanding, 1);
  const perShare = equityValue / shares;

  const validations = collectValidations(cashflows, terminalValues, context, discountRate);
  const evBridge = buildEvBridge(presentValue, terminalPresentValue, enterpriseValue, context);
  const compsCheck = computeCompsCheck(context.peers, enterpriseValue);
  const sotp = computeSotp(context);
  const runMetadata = {
    timestampIso: new Date().toISOString(),
    scenarioId: options.scenario?.id,
    gitCommit: context.metadata.gitCommit,
    configPath: context.metadata.configPath,
  };

  return {
    cashflows,
    presentValue,
    terminalValues,
    enterpriseValue,
    equityValue,
    perShare,
    discountRate,
    waccBreakdown: {
      costOfEquity: waccDetails.costOfEquity,
      costOfDebtAfterTax: waccDetails.costOfDebtAfterTax,
      weightOfEquity: waccDetails.weightOfEquity,
      weightOfDebt: waccDetails.weightOfDebt,
    },
    validations,
    evBridge,
    compsCheck,
    sotp,
    runMetadata,
  };
}

function collectValidations(
  cashflows: DerivedCashflow[],
  terminalValues: TerminalValueOutput[],
  context: ValuationContext,
  discountRate: number,
): string[] {
  const validations: string[] = [];

  if (!cashflows.length) {
    validations.push('No cashflows generated.');
  }

  const negatives = cashflows.filter((cf) => cf.freeCashFlow < 0).length;
  if (negatives === cashflows.length) {
    validations.push('All forecast free cash flows are negative.');
  }

  if (terminalValues.length === 0) {
    validations.push('Terminal value not computed.');
  }

  const offsetsMonotonic = cashflows.every((cf, index) => {
    if (index === 0) {
      return true;
    }
    return cf.period.yearOffset > cashflows[index - 1].period.yearOffset;
  });
  if (!offsetsMonotonic) {
    validations.push('Forecast period offsets are not strictly increasing.');
  }

  const invalidNumbers = cashflows.some((cf) => !Number.isFinite(cf.freeCashFlow));
  if (invalidNumbers) {
    validations.push('Non-finite values encountered in cashflow projection.');
  }

  const growth = context.terminalValue.gordon.growthRate;

  if (context.terminalValue.gordon.enabled && growth >= discountRate) {
    validations.push('Terminal growth >= discount rate.');
  }

  const nwcTrend = cashflows.map((cf) => cf.changeInNetWorkingCapital);
  const signChanges = nwcTrend.filter((value, index, arr) => index > 0 && Math.sign(value) !== Math.sign(arr[index - 1])).length;
  if (signChanges > cashflows.length / 2) {
    validations.push('Working capital swings between sources and uses frequently.');
  }

  if (cashflows.some((cf) => cf.nolBalance > 0) && context.tax.nolAnnualUsageCap === 0) {
    validations.push('NOL balance persists due to zero usage cap.');
  }

  if (context.midYearConvention && context.compounding !== 'annual') {
    validations.push('Mid-year convention currently assumes annual periods; review compounding setting.');
  }

  return validations;
}

function buildEvBridge(
  presentValue: number,
  terminalPresent: number,
  enterpriseValue: number,
  context: ValuationContext,
): EvBridgeItem[] {
  return [
    {
      label: 'PV of Forecast',
      value: presentValue,
      impact: presentValue / enterpriseValue,
    },
    {
      label: 'PV of Terminal Value',
      value: terminalPresent,
      impact: terminalPresent / enterpriseValue,
    },
    {
      label: 'Net Debt',
      value: -context.workingCapital.otherCurrentLiabilities,
      impact: -context.workingCapital.otherCurrentLiabilities / enterpriseValue,
    },
  ];
}

function computeCompsCheck(peers: CompsPeer[], enterpriseValue: number) {
  if (!peers.length) {
    return undefined;
  }
  const evEbitdaValues = peers
    .map((peer) => peer.enterpriseValue / Math.max(peer.ebitda, 1))
    .filter((value) => Number.isFinite(value));
  const evSalesValues = peers
    .map((peer) => peer.enterpriseValue / Math.max(peer.revenue, 1))
    .filter((value) => Number.isFinite(value));
  return {
    medianEvEbitda: median(evEbitdaValues),
    medianEvSales: median(evSalesValues),
    impliedPremiumVsMedian:
      evEbitdaValues.length && enterpriseValue
        ? enterpriseValue / Math.max(median(evEbitdaValues) ?? enterpriseValue, 1) - 1
        : undefined,
  };
}

function median(values: number[]): number | undefined {
  if (!values.length) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}


export function runSensitivity(
  forecast: ForecastPeriod[],
  context: ValuationContext,
): SensitivityResult[] {
  const results: SensitivityResult[] = [];
  const baseGrowth = context.terminalValue.gordon.growthRate;

  for (const waccValue of context.sensitivity.waccValues) {
    if (context.terminalValue.gordon.enabled) {
      for (const growth of context.sensitivity.terminalGrowthRates) {
        const contextOverride: ValuationContext = {
          ...context,
          terminalValue: {
            ...context.terminalValue,
            gordon: {
              ...context.terminalValue.gordon,
              growthRate: growth,
            },
          },
        };
        const valuation = computeValuation(forecast, contextOverride, {
          overrideDiscountRate: waccValue,
        });
        results.push({
          wacc: waccValue,
          terminalGrowth: growth,
          exitMultiple: context.terminalValue.exitMultiple.multiple,
          enterpriseValue: valuation.enterpriseValue,
        });
      }
    }

    if (context.terminalValue.exitMultiple.enabled) {
      for (const exitMultiple of context.sensitivity.exitMultiples) {
        const valuation = computeValuation(forecast, context, {
          overrideDiscountRate: waccValue,
          exitMultipleOverride: exitMultiple,
        });
        results.push({
          wacc: waccValue,
          terminalGrowth: baseGrowth,
          exitMultiple,
          enterpriseValue: valuation.enterpriseValue,
        });
      }
    }
  }

  return results;
}

export function runMonteCarlo(
  forecast: ForecastPeriod[],
  context: ValuationContext,
): MonteCarloResult {
  const config = context.monteCarlo;
  const rng = createRng(config.seed ?? 1_234_567);
  const samples: number[] = [];

  for (let i = 0; i < config.iterations; i += 1) {
    const adjustments = config.drivers.map((driver) => ({
      driver,
      value: sampleDistribution(driver, rng),
    }));

    const adjustedForecast = forecast.map((period) => ({ ...period }));
    const adjustedContext: ValuationContext = {
      ...context,
      workingCapital: { ...context.workingCapital },
      capex: { ...context.capex },
      terminalValue: {
        ...context.terminalValue,
        gordon: { ...context.terminalValue.gordon },
        exitMultiple: { ...context.terminalValue.exitMultiple },
      },
    };

    for (const adjustment of adjustments) {
      applyMonteCarloAdjustment(adjustment.driver.key, adjustment.value, adjustedForecast, adjustedContext);
    }

    const valuation = computeValuation(adjustedForecast, adjustedContext);
    samples.push(valuation.enterpriseValue);
  }

  samples.sort((a, b) => a - b);
  const medianValue = percentile(samples, 0.5);
  const p10 = percentile(samples, 0.1);
  const p90 = percentile(samples, 0.9);
  const mean = samples.reduce((acc, value) => acc + value, 0) / samples.length;
  const variance =
    samples.reduce((acc, value) => acc + (value - mean) ** 2, 0) / Math.max(samples.length - 1, 1);

  return {
    iterations: samples.length,
    median: medianValue,
    p10,
    p90,
    mean,
    stdDev: Math.sqrt(variance),
    samples,
  };
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleDistribution(driver: MonteCarloDriver, rng: () => number): number {
  switch (driver.distribution) {
    case 'normal':
      return gaussian(driver.mean, driver.stdDev ?? driver.mean * 0.1, rng);
    case 'lognormal':
      return Math.exp(gaussian(Math.log(Math.max(driver.mean, 1e-6)), driver.stdDev ?? 0.1, rng));
    case 'triangular':
      return triangularSample(driver.min ?? driver.mean * 0.5, driver.mode ?? driver.mean, driver.max ?? driver.mean * 1.5, rng);
    default:
      return driver.mean;
  }
}

function gaussian(mean: number, stdDev: number, rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }
  const mag = Math.sqrt(-2.0 * Math.log(u));
  const z0 = mag * Math.cos(2.0 * Math.PI * v);
  return mean + z0 * stdDev;
}

function triangularSample(min: number, mode: number, max: number, rng: () => number): number {
  const u = rng();
  const c = (mode - min) / (max - min);
  if (u < c) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function applyMonteCarloAdjustment(
  key: MonteCarloDriver['key'],
  value: number,
  forecast: ForecastPeriod[],
  context: ValuationContext,
): void {
  switch (key) {
    case 'revenue':
      forecast.forEach((period) => {
        period.revenue *= 1 + value / 100;
      });
      break;
    case 'margin':
      forecast.forEach((period) => {
        period.ebitMargin += value;
      });
      break;
    case 'workingCapital':
      context.workingCapital = {
        ...context.workingCapital,
        arDays: context.workingCapital.arDays * (1 + value / 100),
        apDays: context.workingCapital.apDays * (1 - value / 100),
        inventoryDays: context.workingCapital.inventoryDays * (1 + value / 100),
      };
      break;
    case 'capex':
      context.capex = {
        ...context.capex,
        maintenanceCapexPctRevenue: context.capex.maintenanceCapexPctRevenue * (1 + value / 100),
        growthCapexPctRevenue: context.capex.growthCapexPctRevenue * (1 + value / 100),
      };
      break;
    case 'discountRate':
      context.discountRate += value;
      break;
    default:
      break;
  }
}

function percentile(values: number[], percentileRank: number): number {
  if (!values.length) {
    return 0;
  }
  const index = (values.length - 1) * percentileRank;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return values[lower];
  }
  const weight = index - lower;
  return values[lower] * (1 - weight) + values[upper] * weight;
}

function computeSotp(context: ValuationContext): SotpOutput | undefined {
  if (!context.segments.length) {
    return undefined;
  }

  const segments: SotpSegmentValue[] = context.segments.map((segment) => {
    const ebitda = segment.revenue * (segment.ebitdaMargin / 100);
    const multiple = segment.exitMultiple ?? context.terminalValue.exitMultiple.multiple;
    const value = ebitda * multiple;
    return {
      segment,
      value,
      weight: 0,
    };
  });

  const totalValue = segments.reduce((acc, item) => acc + item.value, 0);
  if (totalValue <= 0) {
    return {
      totalValue: 0,
      segments,
    };
  }

  return {
    totalValue,
    segments: segments.map((item) => ({
      ...item,
      weight: item.value / totalValue,
    })),
  };
}




