import {
  moneyFromMicros,
  moneyToMicros,
  type Cashflow,
  type DcfInput,
} from '@dcf-builder/engine-contract';

const MICROS_PER_DOLLAR = 1_000_000n;
const DOLLARS_PER_MILLION = 1_000_000;

export type UiCashflow = {
  id: string;
  date: string; // ISO date string
  amount: number; // value in millions of currency units
};

export type BuilderState = {
  cashflows: UiCashflow[];
  discountRate: number;
  compounding: 'annual' | 'monthly';
  asOf: string;
  netDebt: number; // millions
  sharesOutstanding: number; // millions of shares
};

export function createDefaultState(): BuilderState {
  const today = new Date();
  const year = today.getUTCFullYear();
  return {
    asOf: isoFromParts(year, 0, 1),
    compounding: 'annual',
    discountRate: 8.5,
    netDebt: 250,
    sharesOutstanding: 120,
    cashflows: [
      { id: randomId(), date: isoFromParts(year, 0, 1), amount: -300 },
      { id: randomId(), date: isoFromParts(year + 1, 0, 1), amount: 120 },
      { id: randomId(), date: isoFromParts(year + 2, 0, 1), amount: 160 },
      { id: randomId(), date: isoFromParts(year + 3, 0, 1), amount: 210 },
      { id: randomId(), date: isoFromParts(year + 4, 0, 1), amount: 260 },
    ],
  };
}

export function toDcfInput(state: BuilderState): DcfInput {
  const asOfEpoch = dateToEpochDays(state.asOf);
  const cashflows: Cashflow[] = state.cashflows
    .map((cf) => ({
      dateEpochDays: dateToEpochDays(cf.date),
      amount: moneyFromMicros(millionsToMicros(cf.amount)),
    }))
    .sort((a, b) => a.dateEpochDays - b.dateEpochDays);

  return {
    cashflows,
    discountRateBps: Math.round(state.discountRate * 100),
    compounding: state.compounding,
    asOfEpochDays: asOfEpoch,
  };
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
  const value = new Date(date + 'T00:00:00Z');
  return Math.floor(value.getTime() / 86_400_000);
}

export function epochDaysToDate(epochDays: number): string {
  const ms = epochDays * 86_400_000;
  const date = new Date(ms);
  return date.toISOString().slice(0, 10);
}

export function formatMillions(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value) + 'M';
}

export function formatCurrency(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
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

function isoFromParts(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month, day));
  return date.toISOString().slice(0, 10);
}
