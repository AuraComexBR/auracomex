import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, DollarSign, Receipt, Target, Percent, Wallet } from 'lucide-react';
import { useOverheadEntries } from '@/hooks/useOverhead';
import { useExchangeRate } from '@/hooks/useExchangeRate';

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

function currentMonthISO() {
  // Mesmo bug do FixedAccountsTab.tsx: montar a data local e depois usar
  // toISOString() converte pra UTC, e em fusos atrás de UTC (Brasil, UTC-3)
  // isso pode empurrar o dia 1 pro dia 2 dependendo da hora local. Monta a
  // string direto do ano/mês locais pra evitar o desvio.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function OverviewTab() {
  const [referenceMonth, setReferenceMonth] = useState(currentMonthISO());
  const monthStart = referenceMonth;
  const monthEnd = useMemo(() => {
    const d = new Date(referenceMonth + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }, [referenceMonth]);

  const { usdBrl, eurBrl, loading: ratesLoading } = useExchangeRate();

  const toBRL = (amount: number, currency?: string | null) => {
    const v = Number(amount || 0);
    const c = (currency || 'BRL').toUpperCase();
    if (c === 'BRL') return v;
    if (c === 'USD') return v * (usdBrl || 0);
    if (c === 'EUR') return v * (eurBrl || 0);
    return v;
  };

  const { data: releasedShipmentIds = [] } = useQuery({
    queryKey: ['financial-overview-shipments', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('id')
        .eq('financial_released', true)
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd);
      if (error) throw error;
      return (data || []).map((s: any) => s.id as string);
    },
  });

  const { data: lines = [] } = useQuery({
    queryKey: ['financial-overview-lines', releasedShipmentIds.join(',')],
    enabled: releasedShipmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_lines')
        .select('amount, currency, direction, shipment_id')
        .in('shipment_id', releasedShipmentIds);
      if (error) throw error;
      return data || [];
    },
  });

  const entries = useOverheadEntries(referenceMonth);

  // Custo Variável = accounts_payable dos embarques liberados no mês (mesma competência da receita).
  const { data: payables = [] } = useQuery({
    queryKey: ['financial-overview-payables', releasedShipmentIds.join(',')],
    enabled: releasedShipmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_payable' as any)
        .select('amount, currency, status, shipment_id')
        .in('shipment_id', releasedShipmentIds)
        .neq('status', 'cancelado');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Dados de cada embarque liberado no mês — pra montar o detalhamento por
  // processo (referência + cliente) ao lado dos totais agregados.
  const { data: shipmentInfos = [] } = useQuery({
    queryKey: ['financial-overview-shipment-infos', releasedShipmentIds.join(',')],
    enabled: releasedShipmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('id, reference_number, clients(name)')
        .in('id', releasedShipmentIds);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fluxo previsto 30 dias
  const next30End = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcomingPayables = [] } = useQuery({
    queryKey: ['financial-upcoming-payables', today, next30End],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_payable' as any)
        .select('amount, currency, due_date, status')
        .eq('status', 'aberto')
        .gte('due_date', today)
        .lte('due_date', next30End);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const totals = useMemo(() => {
    let receita = 0;
    lines.forEach((l: any) => {
      if (l.direction === 'receivable') receita += toBRL(l.amount, l.currency);
    });
    const custoVar = payables.reduce((s: number, p: any) => s + toBRL(p.amount, p.currency), 0);
    const fixas = (entries.data || [])
      .filter((e: any) => e.status !== 'skipped')
      .reduce((s, e: any) => s + toBRL(e.amount, e.currency), 0);
    const lucroBruto = receita - custoVar;
    const lucroLiquido = lucroBruto - fixas;
    const margemBruta = receita > 0 ? (lucroBruto / receita) * 100 : 0;
    const margemLiquida = receita > 0 ? (lucroLiquido / receita) * 100 : 0;
    const pontoEquilibrio = margemBruta > 0 ? (fixas / (margemBruta / 100)) : 0;
    const fluxo30 = upcomingPayables.reduce((s: number, p: any) => s + toBRL(p.amount, p.currency), 0);
    return { receita, custoVar, fixas, lucroBruto, lucroLiquido, margemBruta, margemLiquida, pontoEquilibrio, fluxo30 };
  }, [lines, entries.data, payables, upcomingPayables, usdBrl, eurBrl]);

  // Detalhamento por processo — o valor real dentro do mês, embarque a
  // embarque, em vez de só o total agregado. Mesma base de dados dos KPIs
  // acima (embarques liberados ao financeiro no mês).
  const byProcess = useMemo(() => {
    const receitaMap = new Map<string, number>();
    lines.forEach((l: any) => {
      if (l.direction !== 'receivable') return;
      receitaMap.set(l.shipment_id, (receitaMap.get(l.shipment_id) || 0) + toBRL(l.amount, l.currency));
    });
    const custoMap = new Map<string, number>();
    payables.forEach((p: any) => {
      custoMap.set(p.shipment_id, (custoMap.get(p.shipment_id) || 0) + toBRL(p.amount, p.currency));
    });
    const infoMap = new Map(shipmentInfos.map((s: any) => [s.id, s]));
    return releasedShipmentIds
      .map((id) => {
        const info = infoMap.get(id);
        const receita = receitaMap.get(id) || 0;
        const custo = custoMap.get(id) || 0;
        const lucro = receita - custo;
        const margem = receita > 0 ? (lucro / receita) * 100 : 0;
        return {
          id,
          reference: info?.reference_number || '—',
          client: (info as any)?.clients?.name || '—',
          receita, custo, lucro, margem,
        };
      })
      .filter((r) => r.receita !== 0 || r.custo !== 0)
      .sort((a, b) => b.receita - a.receita);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, payables, shipmentInfos, releasedShipmentIds, usdBrl, eurBrl]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Valores convertidos para BRL {usdBrl ? `(USD ${usdBrl.toFixed(4)} · EUR ${(eurBrl || 0).toFixed(4)})` : ''}. Receita e custo variável usam embarques liberados ao financeiro no mês.
          {ratesLoading && ' · atualizando cotações...'}
        </p>
        <Input
          type="month"
          className="w-44"
          value={referenceMonth.slice(0, 7)}
          onChange={(e) => setReferenceMonth(e.target.value + '-01')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Receita Bruta" value={fmtBRL(totals.receita)} icon={<TrendingUp className="w-5 h-5" />} tone="emerald" />
        <KPI label="Custo Variável" value={fmtBRL(totals.custoVar)} icon={<TrendingDown className="w-5 h-5" />} tone="destructive" />
        <KPI label="Despesas Fixas" value={fmtBRL(totals.fixas)} icon={<Receipt className="w-5 h-5" />} tone="amber" />
        <KPI label="Lucro Líquido" value={fmtBRL(totals.lucroLiquido)} icon={<DollarSign className="w-5 h-5" />} tone={totals.lucroLiquido >= 0 ? 'emerald' : 'destructive'} highlight />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Lucro Bruto" value={fmtBRL(totals.lucroBruto)} icon={<DollarSign className="w-5 h-5" />} tone={totals.lucroBruto >= 0 ? 'emerald' : 'destructive'} />
        <KPI label="Margem Bruta" value={`${totals.margemBruta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} tone="blue" />
        <KPI label="Margem Líquida" value={`${totals.margemLiquida.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} tone="blue" />
        <KPI label="Ponto de Equilíbrio" value={fmtBRL(totals.pontoEquilibrio)} icon={<Target className="w-5 h-5" />} tone="blue" hint="Receita necessária para cobrir os custos fixos" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          label="A Pagar (30 dias)"
          value={fmtBRL(totals.fluxo30)}
          icon={<Wallet className="w-5 h-5" />}
          tone="amber"
          hint="Soma das contas em aberto com vencimento nos próximos 30 dias"
        />
      </div>

      <Card className="glass">
        <CardHeader><CardTitle className="text-base">Resultado do mês</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <Row label="Receita Bruta" value={fmtBRL(totals.receita)} />
            <Row label="(-) Custo Variável (processos)" value={fmtBRL(totals.custoVar)} negative />
            <Row label="= Lucro Bruto" value={fmtBRL(totals.lucroBruto)} bold />
            <Row label="(-) Despesas Fixas (subsistência)" value={fmtBRL(totals.fixas)} negative />
            <div className="h-px bg-border my-2" />
            <Row label="= Lucro Líquido" value={fmtBRL(totals.lucroLiquido)} bold highlight={totals.lucroLiquido >= 0 ? 'emerald' : 'destructive'} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle className="text-base">Resultado por processo</CardTitle></CardHeader>
        <CardContent>
          {byProcess.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum processo liberado ao financeiro neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byProcess.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/shipments?open=${r.id}`} className="text-primary hover:underline font-mono text-xs">
                        {r.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.client}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(r.receita)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{fmtBRL(r.custo)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${r.lucro >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{fmtBRL(r.lucro)}</TableCell>
                    <TableCell className={`text-right tabular-nums text-xs ${r.margem >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{r.margem.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, icon, tone, highlight, hint }: { label: string; value: string; icon: React.ReactNode; tone?: string; highlight?: boolean; hint?: string }) {
  const toneMap: Record<string, string> = {
    emerald: 'text-emerald-500',
    destructive: 'text-destructive',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
  };
  const color = toneMap[tone || ''] || 'text-foreground';
  return (
    <Card className={`glass ${highlight ? 'ring-1 ring-primary/40' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
            {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={`p-3 rounded-xl bg-secondary ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold, negative, highlight }: { label: string; value: string; bold?: boolean; negative?: boolean; highlight?: 'emerald' | 'destructive' }) {
  const cls = highlight === 'emerald' ? 'text-emerald-500' : highlight === 'destructive' ? 'text-destructive' : negative ? 'text-destructive' : '';
  return (
    <div className="flex justify-between items-center">
      <span className={bold ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''} ${cls}`}>{value}</span>
    </div>
  );
}