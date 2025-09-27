import { describe, expect, it } from 'vitest';
import { buildEnginePayload, createDefaultState } from '@/lib/finance';
import { computeValuation, runMonteCarlo, runSensitivity } from '@/lib/calculators';

describe('valuation calculators', () => {
  it('produces positive enterprise value', () => {
    const state = createDefaultState();
    const valuation = computeValuation(state.forecast, state.context);
    expect(valuation.enterpriseValue).toBeGreaterThan(0);
    expect(valuation.cashflows).toHaveLength(state.forecast.length);
  });

  it('mid-year convention increases present value', () => {
    const state = createDefaultState();
    const baseValuation = computeValuation(state.forecast, { ...state.context, midYearConvention: false });
    const midYearValuation = computeValuation(state.forecast, { ...state.context, midYearConvention: true });
    expect(midYearValuation.enterpriseValue).toBeGreaterThan(baseValuation.enterpriseValue);
  });

  it('buildEnginePayload includes terminal value in final cashflow', () => {
    const state = createDefaultState();
    const payload = buildEnginePayload(state);
    const lastCashflow = payload.input.cashflows[payload.input.cashflows.length - 1];
    expect(Number(lastCashflow.amount.micro)).toBeGreaterThan(0);
  });

  it('sensitivity grid returns entries for configured ranges', () => {
    const state = createDefaultState();
    const sensitivity = runSensitivity(state.forecast, state.context);
    expect(sensitivity.length).toBeGreaterThan(0);
  });

  it('monte carlo sampling delivers statistics', () => {
    const state = createDefaultState();
    const result = runMonteCarlo(state.forecast, state.context);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.samples.length).toBe(result.iterations);
  });
});
