export type Money = { micro: string };
export type Cashflow = { dateEpochDays: number; amount: Money };
export type Compounding = 'annual' | 'monthly';

export type DcfInput = {
  cashflows: Cashflow[];
  discountRateBps: number;
  compounding: Compounding;
  asOfEpochDays: number;
};

export type DcfOutput = {
  npv: Money;
  irrBps?: number;
};

export interface ValuationEngine {
  npv(input: DcfInput): Promise<DcfOutput>;
  irr(input: DcfInput): Promise<number>;
}

export const MICROS_PER_UNIT = 1_000_000n;
export const BPS_DENOMINATOR = 10_000;

export function moneyFromMicros(micro: bigint | number | string): Money {
  let value: bigint;
  if (typeof micro === 'bigint') {
    value = micro;
  } else if (typeof micro === 'number') {
    value = BigInt(Math.round(micro));
  } else {
    value = BigInt(micro);
  }
  return { micro: value.toString() };
}

export function moneyToMicros(money: Money): bigint {
  return BigInt(money.micro);
}

export function moneyToNumber(money: Money): number {
  const micros = Number(moneyToMicros(money));
  return micros / Number(MICROS_PER_UNIT);
}

export function moneyFromNumber(value: number): Money {
  const scaled = BigInt(Math.round(value * Number(MICROS_PER_UNIT)));
  return { micro: scaled.toString() };
}

export function normalizeInput(input: DcfInput): DcfInput {
  const cashflows = [...input.cashflows].sort((a, b) => a.dateEpochDays - b.dateEpochDays);
  return { ...input, cashflows };
}

export class ValidationError extends Error {}

export function validateInput(input: DcfInput): void {
  if (!Array.isArray(input.cashflows) || input.cashflows.length === 0) {
    throw new ValidationError('cashflows must contain at least one entry');
  }

  if (!Number.isFinite(input.discountRateBps)) {
    throw new ValidationError('discountRateBps must be finite');
  }

  if (!Number.isInteger(input.asOfEpochDays)) {
    throw new ValidationError('asOfEpochDays must be an integer epoch-day');
  }

  for (const cashflow of input.cashflows) {
    if (!Number.isInteger(cashflow.dateEpochDays)) {
      throw new ValidationError('cashflow dateEpochDays must be an integer epoch-day');
    }

    try {
      moneyToMicros(cashflow.amount);
    } catch (error) {
      throw new ValidationError(`invalid cashflow amount: ${(error as Error).message}`);
    }
  }
}
