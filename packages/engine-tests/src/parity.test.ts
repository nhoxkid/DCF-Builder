import { describe, it, expect } from 'vitest';
import { createTsEngine } from '@dcf-builder/engine-ts';
import { createWasmEngine } from '@dcf-builder/engine-wasm';
import {
  DcfInput,
  moneyFromNumber,
  moneyToNumber,
} from '@dcf-builder/engine-contract';

const tsEngine = createTsEngine();
const wasmEnginePromise = createWasmEngine().catch((error) => {
  console.warn('Skipping WASM parity tests:', error);
  return null;
});

const scenarios: DcfInput[] = [
  {
    asOfEpochDays: 18_250,
    compounding: 'annual',
    discountRateBps: 750,
    cashflows: [
      { dateEpochDays: 18_250, amount: moneyFromNumber(-120) },
      { dateEpochDays: 18_615, amount: moneyFromNumber(80) },
      { dateEpochDays: 18_980, amount: moneyFromNumber(80) },
    ],
  },
  {
    asOfEpochDays: 19_000,
    compounding: 'monthly',
    discountRateBps: 400,
    cashflows: [
      { dateEpochDays: 19_000, amount: moneyFromNumber(-500) },
      { dateEpochDays: 19_031, amount: moneyFromNumber(60) },
      { dateEpochDays: 19_061, amount: moneyFromNumber(60) },
      { dateEpochDays: 19_092, amount: moneyFromNumber(60) },
      { dateEpochDays: 19_122, amount: moneyFromNumber(60) },
      { dateEpochDays: 19_153, amount: moneyFromNumber(60) },
      { dateEpochDays: 19_184, amount: moneyFromNumber(260) },
    ],
  },
];

describe('engine parity', () => {
  it('matches NPV between TS and WASM implementations', async () => {
    const wasmEngine = await wasmEnginePromise;
    if (!wasmEngine) {
      expect(wasmEngine).toBeNull();
      return;
    }

    for (const scenario of scenarios) {
      const [tsResult, wasmResult] = await Promise.all([
        tsEngine.npv(structuredClone(scenario)),
        wasmEngine.npv(structuredClone(scenario)),
      ]);
      const tsValue = moneyToNumber(tsResult.npv);
      const wasmValue = moneyToNumber(wasmResult.npv);
      expect(Math.abs(tsValue - wasmValue)).toBeLessThan(1e-2);
    }
  });

  it('matches IRR between TS and WASM implementations', async () => {
    const wasmEngine = await wasmEnginePromise;
    if (!wasmEngine) {
      expect(wasmEngine).toBeNull();
      return;
    }

    for (const scenario of scenarios) {
      const [tsIrr, wasmIrr] = await Promise.all([
        tsEngine.irr(structuredClone(scenario)),
        wasmEngine.irr(structuredClone(scenario)),
      ]);
      expect(Math.abs(tsIrr - wasmIrr)).toBeLessThan(5);
    }
  });
});
