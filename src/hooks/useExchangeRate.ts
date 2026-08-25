import { useQuery } from '@tanstack/react-query';

export type ExchangeRateSource = 'PTAX (Bacen)' | 'AwesomeAPI' | 'ExchangeRate-API' | 'Open ER-API';

interface ExchangeRates {
  usdBrl: number | null;
  eurBrl: number | null;
  source: ExchangeRateSource | null;
  loading: boolean;
  refetch: () => Promise<any>;
}

function formatDateBcb(d: Date): string {
  // Formato exigido pela API Olinda do Bacen: MM-DD-YYYY
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

async function fetchPtaxDolarDia(d: Date): Promise<number | null> {
  const dateStr = formatDateBcb(d);
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dateStr}'&$format=json&$select=cotacaoVenda`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Bacen PTAX (USD) request failed');
  const data = await res.json();
  const value = data?.value?.[0]?.cotacaoVenda;
  return typeof value === 'number' && value > 0 ? value : null;
}

async function fetchPtaxMoedaDia(moeda: string, d: Date): Promise<number | null> {
  const dateStr = formatDateBcb(d);
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${moeda}'&@dataCotacao='${dateStr}'&$format=json&$select=cotacaoVenda`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bacen PTAX (${moeda}) request failed`);
  const data = await res.json();
  const value = data?.value?.[0]?.cotacaoVenda;
  return typeof value === 'number' && value > 0 ? value : null;
}

// Busca o PTAX do último dia útil com cotação disponível, andando pra trás a partir
// de "startDate" (por padrão, ontem — já que o PTAX de hoje só fecha à tarde e o
// uso em comex é sempre "dia útil imediatamente anterior"). Cobre fins de semana e
// feriados automaticamente, tentando até 10 dias corridos pra trás.
async function fetchPtaxWithBackoff(
  fetchFn: (d: Date) => Promise<number | null>,
  startDate: Date
): Promise<number> {
  const cursor = new Date(startDate);
  for (let i = 0; i < 10; i++) {
    const value = await fetchFn(cursor);
    if (value !== null) return value;
    cursor.setDate(cursor.getDate() - 1);
  }
  throw new Error('Nenhuma cotação PTAX encontrada nos últimos 10 dias');
}

async function fetchFromPtax(referenceDate?: string): Promise<{ usdBrl: number; eurBrl: number; source: ExchangeRateSource }> {
  // Ponto de partida: dia útil ANTERIOR à data de referência (ou a hoje, se não informada).
  // Esse é o padrão usado em comex — PTAX do dia útil imediatamente anterior.
  const base = referenceDate ? new Date(`${referenceDate}T00:00:00`) : new Date();
  const startDate = new Date(base);
  startDate.setDate(startDate.getDate() - 1);

  const [usdBrl, eurBrl] = await Promise.all([
    fetchPtaxWithBackoff(fetchPtaxDolarDia, startDate),
    fetchPtaxWithBackoff((d) => fetchPtaxMoedaDia('EUR', d), startDate),
  ]);

  return { usdBrl, eurBrl, source: 'PTAX (Bacen)' };
}

async function fetchFromFallback(): Promise<{ usdBrl: number; eurBrl: number; source: ExchangeRateSource }> {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
    if (!res.ok) throw new Error('AwesomeAPI Failed');
    const data = await res.json();
    const usdBrl = parseFloat(data.USDBRL?.bid);
    const eurBrl = parseFloat(data.EURBRL?.bid);
    if (!usdBrl || !eurBrl) throw new Error('Invalid AwesomeAPI data');
    return { usdBrl, eurBrl, source: 'AwesomeAPI' };
  } catch (e) {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) throw new Error('ExchangeRate-API Failed');
      const data = await res.json();
      const usdBrl = data.rates.BRL;
      const eurBrl = usdBrl / data.rates.EUR; // Cross rate triangulation
      return { usdBrl, eurBrl, source: 'ExchangeRate-API' };
    } catch (e2) {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('Open ER-API Failed');
      const data = await res.json();
      const usdBrl = data.rates.BRL;
      const eurBrl = usdBrl / data.rates.EUR;
      return { usdBrl, eurBrl, source: 'Open ER-API' };
    }
  }
}

async function fetchRates(date?: string): Promise<{ usdBrl: number; eurBrl: number; source: ExchangeRateSource }> {
  try {
    return await fetchFromPtax(date);
  } catch (error) {
    console.warn('PTAX (Bacen) failed, using fallback:', error);
    return await fetchFromFallback();
  }
}

export function useExchangeRate(date?: string): ExchangeRates {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['exchange-rates-ptax', date],
    queryFn: () => fetchRates(date),
    staleTime: date ? Infinity : 30 * 60 * 1000,
    refetchInterval: false, // Automatic update disabled per request
    retry: 2,
    enabled: true,
  });

  return {
    usdBrl: data?.usdBrl ?? null,
    eurBrl: data?.eurBrl ?? null,
    source: data?.source ?? null,
    loading: isLoading || isFetching,
    refetch,
  };
}
