import Papa from 'papaparse';
import type { BuilderState } from './finance';
import { createDefaultState, randomId } from './finance';

export interface DataLoadResult {
  state: BuilderState;
  warnings: string[];
}

type CsvRow = Record<string, string | undefined>;

const REQUIRED_COLUMNS = ['label', 'yearoffset', 'revenue', 'ebitmargin'];

export async function loadBuilderStateFromFile(file: File): Promise<DataLoadResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'parquet') {    throw new Error('Parquet ingestion requires the desktop CLI.');
  }
  return loadBuilderStateFromCsv(file);
}

export async function loadBuilderStateFromCsv(file: File): Promise<DataLoadResult> {
  const text = await file.text();
  const { data, errors, meta } = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  const warnings: string[] = errors.map((error) => `Row ${error.row}: ${error.message}`);
  const fields = (meta.fields ?? []).map((field) => field.toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((column) => !fields.includes(column));
  if (missing.length) {
    warnings.push(`CSV missing required column(s): ${missing.join(', ')}`);
  }

  return buildStateFromRecords(data, warnings);
}

function buildStateFromRecords(records: CsvRow[], warnings: string[]): DataLoadResult {
  const baseState = createDefaultState();
  const forecast: BuilderState['forecast'] = [];

  records.forEach((row, index) => {
    const revenue = parseNumber(row.revenue);
    const ebitMargin = parseNumber(row.ebitmargin);
    const yearOffset = parseNumber(row.yearoffset, index + 1);
    if (!Number.isFinite(revenue) || !Number.isFinite(ebitMargin)) {
      warnings.push(`Row ${index + 1}: invalid revenue or ebit margin`);
      return;
    }

    const period = {
      label: row.label ?? `P${index + 1}`,
      yearOffset,
      revenue,
      ebitMargin,
      otherOperatingIncome: parseOptionalNumber(row.otheroperatingincome),
      capexOverride: parseOptionalNumber(row.capexoverride),
      depreciationOverride: parseOptionalNumber(row.depreciationoverride),
      workingCapitalOverride: parseOptionalNumber(row.workingcapitaloverride),
    };
    forecast.push(period);

    applyRowSettings(baseState, row, warnings);
  });

  if (forecast.length) {
    baseState.forecast = forecast;
  }

  return { state: baseState, warnings };
}

function applyRowSettings(state: BuilderState, row: CsvRow, warnings: string[]): void {
  for (const [key, rawValue] of Object.entries(row)) {
    if (rawValue == null || rawValue === '') {
      continue;
    }
    if (REQUIRED_COLUMNS.includes(key)) {
      continue;
    }

    const path = key.split('.');
    if (path[0] === 'context') {
      updateContextPath(state, path.slice(1), rawValue, warnings);
    } else if (path[0] === 'scenario') {
      applyScenarioAdjustment(state, path.slice(1), rawValue, warnings);
    } else if (key === 'netdebt') {
      state.context.netDebt = parseNumber(rawValue, state.context.netDebt);
    } else if (key === 'shares') {
      state.context.sharesOutstanding = parseNumber(rawValue, state.context.sharesOutstanding);
    } else if (key === 'discount') {
      state.context.discountRate = parseNumber(rawValue, state.context.discountRate);
    }
  }
}

function updateContextPath(
  state: BuilderState,
  segments: string[],
  rawValue: string,
  warnings: string[],
): void {
  let target: any = state.context;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!(segment in target)) {
      warnings.push(`Unknown context path segment: ${segments.join('.')}`);
      return;
    }
    target = target[segment];
  }

  const finalKey = segments[segments.length - 1];
  if (!(finalKey in target)) {
    warnings.push(`Unknown context key: ${segments.join('.')}`);
    return;
  }

  const existing = target[finalKey];
  if (typeof existing === 'number') {
    target[finalKey] = parseNumber(rawValue, existing);
  } else if (typeof existing === 'boolean') {
    target[finalKey] = rawValue.trim() === '1' || rawValue.trim().toLowerCase() === 'true';
  } else {
    target[finalKey] = rawValue;
  }
}

function applyScenarioAdjustment(
  state: BuilderState,
  segments: string[],
  rawValue: string,
  warnings: string[],
): void {
  const [scenarioLabel, adjustmentKey] = segments;
  const scenario = state.context.scenarios.find((item) => item.label.toLowerCase() === scenarioLabel.toLowerCase());
  if (!scenario) {
    warnings.push(`Scenario ${scenarioLabel} not found for adjustment`);
    return;
  }
  if (!adjustmentKey) {
    warnings.push('Scenario adjustment missing key');
    return;
  }
  scenario.adjustments = {
    ...scenario.adjustments,
    [adjustmentKey as keyof typeof scenario.adjustments]: parseNumber(rawValue, 0),
  };
}

function parseNumber(value?: string, fallback = 0): number {
  if (value == null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalNumber(value?: string): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeForecast(state: BuilderState): BuilderState {
  const next = { ...state, forecast: state.forecast.map((period) => ({ ...period })) };
  next.forecast.sort((a, b) => a.yearOffset - b.yearOffset);
  if (!next.context.scenarios.length) {
    next.context.scenarios = [
      {
        id: randomId(),
        label: 'Base',
        adjustments: {},
      },
    ];
  }
  return next;
}







