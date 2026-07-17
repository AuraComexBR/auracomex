import { useQuery } from '@tanstack/react-query';

interface ExchangeRates {
  usdBrl: number | null;
  eurBrl: number | null;
  loading: boolean;
  refetch: () => Promise<any>;
}

async function fetchRates(date?: string): Promise<{ usdBrl: number; eurBrl: number }> {
  const fetchFromAwesome = async () => {
    if (date) {
      const cleanDate = date.replace(/-/g, '');
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      
      if (cleanDate !== today) {
        const [usdRes, eurRes] = await Promise.all([
          fetch(`https://economia.awesomeapi.com.br/json/daily/USD-BRL/?start_date=${cleanDate}&end_date=${cleanDate}`),
          fetch(`https://economia.awesomeapi.com.br/json/daily/EUR-BRL/?start_date=${cleanDate}&end_date=${cleanDate}`)
        ]);

        if (!usdRes.ok || !eurRes.ok) throw new Error('AwesomeAPI Historical Failed');
        
        const usdData = await usdRes.json();
        const eurData = await eurRes.json();

        return {
          usdBrl: parseFloat(usdData[0]?.bid) || 0,
          eurBrl: parseFloat(eurData[0]?.bid) || 0,
        };
      }
    }

    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
    if (!res.ok) throw new Error('AwesomeAPI Current Failed');
    const data = await res.json();
    return {
      usdBrl: parseFloat(data.USDBRL?.bid) || 0,
      eurBrl: parseFloat(data.EURBRL?.bid) || 0,
    };
  };

  const fetchFromFallback = async () => {
    try {
      // Primary Fallback: ExchangeRate-API (v4)
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) throw new Error('ExchangeRate-API Failed');
      const data = await res.json();
      
      const usdBrl = data.rates.BRL;
      const eurRate = data.rates.EUR;
      const eurBrl = usdBrl / eurRate; // Cross rate triangulation

      return { usdBrl, eurBrl };
    } catch (e) {
      // Secondary Fallback: Open ER-API
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('Open ER-API Failed');
      const data = await res.json();
      
      const usdBrl = data.rates.BRL;
      const eurRate = data.rates.EUR;
      const eurBrl = usdBrl / eurRate;

      return { usdBrl, eurBrl };
    }
  };

  try {
    const rates = await fetchFromAwesome();
    if (rates.usdBrl === 0) throw new Error('Invalid AwesomeAPI data');
    return rates;
  } catch (error) {
    console.warn('Primary exchange API failed, using fallback:', error);
    return await fetchFromFallback();
  }
}

export function useExchangeRate(date?: string): ExchangeRates {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['exchange-rates', date],
    queryFn: () => fetchRates(date),
    staleTime: date ? Infinity : 30 * 60 * 1000,
    refetchInterval: false, // Automatic update disabled per request
    retry: 2,
    enabled: true,
  });

  return {
    usdBrl: data?.usdBrl ?? null,
    eurBrl: data?.eurBrl ?? null,
    loading: isLoading || isFetching,
    refetch,
  };
}
