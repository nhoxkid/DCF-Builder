import { describe, expect, it } from 'vitest';
import { loadBuilderStateFromCsv, normalizeForecast } from '@/lib/csv';

describe('data adapters', () => {
  it('parses csv forecast rows', async () => {
    const csv = `label,yearOffset,revenue,ebitMargin\nFY1,1,100,20\nFY2,2,120,22`;
    const file = new File([csv], 'model.csv', { type: 'text/csv' });
    const result = await loadBuilderStateFromCsv(file);
    const normalized = normalizeForecast(result.state);
    expect(normalized.forecast).toHaveLength(2);
    expect(normalized.forecast[0].revenue).toBe(100);
    expect(result.warnings).toMatchInlineSnapshot('[]');
  });
});
