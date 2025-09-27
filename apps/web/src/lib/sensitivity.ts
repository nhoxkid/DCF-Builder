import type { BuilderState } from './finance';
import type { SensitivityResult } from './model';

export interface SensitivityGrid {
  columns: number[];
  rows: Array<{ key: number; values: Record<number, number> }>;
  labelFormatter(value: number): string;
}

export function buildSensitivityGrid(
  results: SensitivityResult[],
  mode: 'gordon' | 'exit',
  context: BuilderState['context'],
): SensitivityGrid | null {
  if (!results.length) {
    return null;
  }

  const baseGrowth = context.terminalValue.gordon.growthRate;
  const baseExit = context.terminalValue.exitMultiple.multiple;

  const filtered = results.filter((entry) =>
    mode === 'gordon' ? entry.terminalGrowth !== baseGrowth : entry.exitMultiple !== baseExit,
  );

  if (!filtered.length) {
    return null;
  }

  const columns = Array.from(
    new Set(
      filtered.map((entry) => (mode === 'gordon' ? entry.terminalGrowth : entry.exitMultiple)),
    ),
  ).sort((a, b) => a - b);

  const rowsMap = new Map<number, Record<number, number>>();

  for (const entry of filtered) {
    if (!rowsMap.has(entry.wacc)) {
      rowsMap.set(entry.wacc, {});
    }
    const columnKey = mode === 'gordon' ? entry.terminalGrowth : entry.exitMultiple;
    rowsMap.get(entry.wacc)![columnKey] = entry.enterpriseValue;
  }

  const rows = Array.from(rowsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([key, values]) => ({ key, values }));

  const labelFormatter = (value: number) =>
    mode === 'gordon' ? `${value.toFixed(1)}%` : `${value.toFixed(1)}x`;

  return { columns, rows, labelFormatter };
}
