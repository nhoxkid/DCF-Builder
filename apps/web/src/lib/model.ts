export type TerminalValueMethod = 'gordon' | 'exit';

export interface TerminalValueSettings {
  gordon: {
    enabled: boolean;
    growthRate: number; // percent (e.g. 2.5 for 2.5%)
    sanityCap?: number; // optional cap to guard against > discount rate
  };
  exitMultiple: {
    enabled: boolean;
    metric: 'ebitda' | 'ebit' | 'revenue';
    multiple: number;
    referenceYear?: number; // index into forecast periods
  };
  applyBoth?: boolean; // when true compute both and surface comparison
}

export interface WorkingCapitalSettings {
  openingNetWorkingCapital: number; // millions
  arDays: number;
  apDays: number;
  inventoryDays: number;
  otherCurrentAssets: number; // millions
  otherCurrentLiabilities: number; // millions
}

export interface CapexSettings {
  openingNetPpe: number; // millions
  maintenanceCapexPctRevenue: number; // percent
  growthCapexPctRevenue: number; // percent
  depreciationPctRevenue: number; // percent
  maintenanceShare?: number; // optional share of total capex considered maintenance
}

export interface LeaseSettings {
  operatingLeaseLiability: number; // millions
  discountRate: number; // percent cost of leases.
  averageLeaseTermYears: number;
  annualLeaseExpense: number; // millions
}

export interface TaxSettings {
  statutoryRate: number; // percent
  cashTaxRate: number; // percent
  nolOpening: number; // millions
  nolAnnualUsageCap?: number; // millions per year
  deferredTaxRate?: number; // percent for book vs cash differences
}

export interface WaccInputs {
  riskFreeRate: number; // percent
  marketRiskPremium: number; // percent
  sizePremium: number; // percent
  countryRiskPremium: number; // percent
  betaLevered: number;
  betaUnlevered?: number;
  targetDebtToEquity: number; // ratio (D/E)
  costOfDebtPreTax: number; // percent
  taxRate: number; // percent
}

export interface ScenarioDefinition {
  id: string;
  label: string;
  adjustments: Partial<ScenarioAdjustments>;
}

export interface ScenarioAdjustments {
  revenueGrowthDeltaPct: number;
  marginDeltaPct: number;
  exitMultipleDelta: number;
  discountRateDeltaPct: number;
}

export interface SensitivityConfig {
  waccValues: number[];
  terminalGrowthRates: number[]; // percent
  exitMultiples: number[];
}

export interface MonteCarloDriver {
  key: 'revenue' | 'margin' | 'workingCapital' | 'capex' | 'discountRate';
  distribution: 'normal' | 'lognormal' | 'triangular';
  mean: number;
  stdDev?: number;
  min?: number;
  mode?: number;
  max?: number;
}

export interface MonteCarloConfig {
  iterations: number;
  drivers: MonteCarloDriver[];
  seed?: number;
}

export interface SegmentInput {
  id: string;
  label: string;
  revenue: number; // millions
  ebitdaMargin: number; // percent
  investedCapital: number; // millions
  exitMultiple?: number;
}

export interface CompsPeer {
  ticker: string;
  enterpriseValue: number; // millions
  ebitda: number; // millions
  revenue: number; // millions
}

export interface EquityAdjustment {
  label: string;
  amount: number; // millions (positive adds to equity value)
}

export interface ForecastPeriod {
  label: string;
  yearOffset: number; // 0 = current year, 1 = next, etc.
  revenue: number; // millions
  ebitMargin: number; // percent
  ebitdaMargin?: number; // percent fallback if ebitMargin absent
  otherOperatingIncome?: number; // millions
  workingCapitalOverride?: number; // direct change override in millions
  capexOverride?: number; // direct capex override in millions
  depreciationOverride?: number; // direct D&A override in millions
}

export interface ValuationContext {
  asOf: string;
  compounding: 'annual' | 'monthly';
  midYearConvention: boolean;
  discountRate: number; // percent
  terminalValue: TerminalValueSettings;
  workingCapital: WorkingCapitalSettings;
  capex: CapexSettings;
  leases: LeaseSettings;
  tax: TaxSettings;
  wacc: WaccInputs;
  sensitivity: SensitivityConfig;
  monteCarlo: MonteCarloConfig;
  scenarios: ScenarioDefinition[];
  segments: SegmentInput[];
  peers: CompsPeer[];
  netDebt: number; // millions
  sharesOutstanding: number; // millions
  equityAdjustments?: EquityAdjustment[];
  metadata: {
    companyName?: string;
    ticker?: string;
    analyst?: string;
    currency?: string;
    gitCommit?: string;
    configPath?: string;
  };
}

export interface DerivedCashflow {
  period: ForecastPeriod;
  freeCashFlow: number; // millions
  ebit: number; // millions
  nopat: number; // millions
  changeInNetWorkingCapital: number; // millions
  depreciation: number; // millions
  capex: number; // millions
  leaseInterest: number; // millions
  leaseAmortization: number; // millions
  taxPaid: number; // millions
  endingNetWorkingCapital: number; // millions
  endingNetPpe: number; // millions
  nolBalance: number; // millions
}

export interface TerminalValueOutput {
  method: TerminalValueMethod;
  value: number; // millions
  impliedMultiple?: number;
  warning?: string;
}

export interface SotpSegmentValue {
  segment: SegmentInput;
  value: number;
  weight: number;
}

export interface SotpOutput {
  totalValue: number;
  segments: SotpSegmentValue[];
}

export interface ValuationOutputs {
  cashflows: DerivedCashflow[];
  presentValue: number; // millions
  terminalValues: TerminalValueOutput[];
  enterpriseValue: number; // millions
  equityValue: number; // millions
  perShare: number; // per-share value in currency units
  discountRate: number; // percent
  waccBreakdown: {
    costOfEquity: number;
    costOfDebtAfterTax: number;
    weightOfEquity: number;
    weightOfDebt: number;
  };
  validations: string[];
  evBridge: EvBridgeItem[];
  compsCheck?: {
    medianEvEbitda?: number;
    medianEvSales?: number;
    impliedPremiumVsMedian?: number;
  };
  sotp?: SotpOutput;
  runMetadata: {
    timestampIso: string;
    scenarioId?: string;
    gitCommit?: string;
    configPath?: string;
  };
}

export interface EvBridgeItem {
  label: string;
  value: number;
  impact: number;
}

export interface MonteCarloResult {
  iterations: number;
  median: number;
  p10: number;
  p90: number;
  mean: number;
  stdDev: number;
  samples: number[];
}

export interface SensitivityResult {
  wacc: number;
  terminalGrowth: number;
  exitMultiple: number;
  enterpriseValue: number;
}
