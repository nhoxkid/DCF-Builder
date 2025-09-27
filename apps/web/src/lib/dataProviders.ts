interface AlphaVantageOverview {
  Symbol?: string;
  Beta?: string;
  MarketCapitalization?: string;
  SharesOutstanding?: string;
  EBITDA?: string;
  EVToEBITDA?: string;
  EVToRevenue?: string;
  TotalRevenueTTM?: string;
  FreeCashFlowTTM?: string;
  DebtToEquity?: string;
}

export interface PublicCompanySnapshot {
  ticker: string;
  sharesOutstanding?: number;
  freeCashFlowMillions?: number;
  netDebtMillions?: number;
  beta?: number;
  evToEbitda?: number;
  evToRevenue?: number;
  warning?: string;
}

export async function fetchAlphaVantageOverview(
  ticker: string,
  apiKey: string,
): Promise<PublicCompanySnapshot> {
  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', 'OVERVIEW');
  url.searchParams.set('symbol', ticker);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as AlphaVantageOverview | Record<string, string>;
  if ('Note' in json) {
    return {
      ticker,
      warning: 'API limit reached; please try again later.',
    };
  }
  if (!json.Symbol) {
    return {
      ticker,
      warning: 'No overview data returned for ticker.',
    };
  }

  const parseNumber = (value?: string) => {
    if (!value) return undefined;
    const numeric = Number(value.replace(/[$,]/g, ''));
    return Number.isFinite(numeric) ? numeric : undefined;
  };

  return {
    ticker,
    sharesOutstanding: parseNumber(json.SharesOutstanding) ?? undefined,
    freeCashFlowMillions: normaliseToMillions(parseNumber(json.FreeCashFlowTTM)),
    netDebtMillions: inferNetDebt(parseNumber(json.MarketCapitalization), parseNumber(json.EVToEBITDA), parseNumber(json.EBITDA)),
    beta: parseNumber(json.Beta) ?? undefined,
    evToEbitda: parseNumber(json.EVToEBITDA) ?? undefined,
    evToRevenue: parseNumber(json.EVToRevenue) ?? undefined,
  };
}

function normaliseToMillions(value?: number) {
  if (typeof value !== 'number') return undefined;
  return value / 1_000_000;
}

function inferNetDebt(marketCap?: number, evEbitda?: number, ebitda?: number) {
  if (!marketCap || !evEbitda || !ebitda) return undefined;
  const enterpriseValue = evEbitda * ebitda;
  return normaliseToMillions(enterpriseValue - marketCap);
}
