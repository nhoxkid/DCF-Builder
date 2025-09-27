import Decimal from "decimal.js";
import {
  BPS_DENOMINATOR,
  DcfInput,
  DcfOutput,
  Money,
  ValuationEngine,
  normalizeInput,
  validateInput,
} from "@dcf-builder/engine-contract";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

const MICROS = new Decimal(1_000_000);
const DAYS_PER_YEAR = new Decimal(365);
const MAX_RATE = new Decimal(10);
const MIN_RATE = new Decimal(-0.9999);
const TOLERANCE = new Decimal(1e-7);
const MAX_ITERATIONS = 128;

export class TsValuationEngine implements ValuationEngine {
  npv(input: DcfInput): Promise<DcfOutput> {
    validateInput(input);
    const normalized = normalizeInput(input);
    const rate = new Decimal(normalized.discountRateBps).div(BPS_DENOMINATOR);
    const npvDecimal = computeNpvDecimal(normalized, rate);
    const npv = decimalToMoney(npvDecimal);

    const irr = computeIrr(normalized);

    return Promise.resolve({
      npv,
      irrBps: irr ?? undefined,
    });
  }

  irr(input: DcfInput): Promise<number> {
    validateInput(input);
    const normalized = normalizeInput(input);
    const irr = computeIrr(normalized);
    if (irr === null) {
      return Promise.reject(new Error("IRR not found"));
    }
    return Promise.resolve(irr);
  }
}

export function createTsEngine(): ValuationEngine {
  return new TsValuationEngine();
}

function computeNpvDecimal(input: DcfInput, annualRate: Decimal): Decimal {
  const frequency = compoundingFrequency(input.compounding);
  return input.cashflows.reduce((acc, cashflow) => {
    const amount = moneyToDecimal(cashflow.amount);
    const periods = periodsBetween(input.asOfEpochDays, cashflow.dateEpochDays, frequency);
    const ratePerPeriod = annualRate.div(frequency);
    const discount = Decimal.pow(Decimal.add(1, ratePerPeriod), periods);
    return acc.plus(amount.div(discount));
  }, new Decimal(0));
}

function computeIrr(input: DcfInput): number | null {
  let low = MIN_RATE;
  let high = MAX_RATE;
  let npvLow = computeNpvDecimal(input, low);
  let npvHigh = computeNpvDecimal(input, high);

  if (npvLow.isZero()) {
    return low.times(BPS_DENOMINATOR).toNumber();
  }
  if (npvHigh.isZero()) {
    return high.times(BPS_DENOMINATOR).toNumber();
  }
  if (npvLow.isPositive() === npvHigh.isPositive()) {
    return null;
  }

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const mid = low.plus(high).div(2);
    const npvMid = computeNpvDecimal(input, mid);

    if (npvMid.abs().lessThan(TOLERANCE)) {
      return toBps(mid);
    }

    if (npvMid.isPositive() === npvLow.isPositive()) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
      npvHigh = npvMid;
    }
  }

  const midpoint = low.plus(high).div(2);
  return toBps(midpoint);
}

function toBps(rate: Decimal): number {
  return rate.times(BPS_DENOMINATOR).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber();
}

function moneyToDecimal(money: Money): Decimal {
  return new Decimal(money.micro).div(MICROS);
}

function decimalToMoney(value: Decimal): Money {
  const micros = value.times(MICROS).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
  return { micro: micros.toFixed(0) };
}

function compoundingFrequency(compounding: DcfInput["compounding"]): Decimal {
  switch (compounding) {
    case "annual":
      return new Decimal(1);
    case "monthly":
      return new Decimal(12);
    default:
      return new Decimal(1);
  }
}

function periodsBetween(asOf: number, target: number, frequency: Decimal): Decimal {
  const deltaDays = new Decimal(target - asOf);
  const daysPerPeriod = DAYS_PER_YEAR.div(frequency);
  return deltaDays.div(daysPerPeriod);
}
