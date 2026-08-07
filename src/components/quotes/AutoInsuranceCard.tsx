import React, { useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { calcSeguroInternacional } from '@/lib/costEstimate';
import { DebouncedInput } from '@/components/quotes/estimate/DebouncedInput';

interface Props {
  quoteId: string;
  companyId?: string;
  /** id do processo (quotes.id) — mesmo valor de quoteId, mantido explícito por clareza */
  quote: { id: string; seguro_auto?: boolean | null; seguro_taxa_pct?: number | null } | null | undefined;
  readOnly?: boolean;
}

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Card "Seguro Internacional" da aba Taxas.
 *
 * Todo processo já nasce com a fórmula padrão de seguro aplicada (Custo + Frete
 * + 10% Despesas + 10% Lucro Esperado + Impostos, x taxa da seguradora). O
 * valor calculado só é exibido aqui; ele só passa a compor o processo (vira
 * uma taxa real em quote_charges, contabilizada no total e na Estimativa de
 * Custo) quando o checkbox "Incluir no processo" está marcado. Desmarcando,
 * a taxa automática é removida e o processo deixa de ter esse custo.
 */
export function AutoInsuranceCard({ quoteId, companyId, quote, readOnly }: Props) {
  const qc = useQueryClient();

  // Base de cálculo vem da Estimativa de Custo (Custo/VMCV, Frete Internacional
  // e Impostos já convertidos para USD). Sem uma estimativa criada ainda não
  // há base confiável para calcular o seguro.
  const { data: basis } = useQuery({
    queryKey: ['cost-estimate-insurance-basis', quoteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cost_estimates')
        .select('vmcv_usd, frete_intl_usd, ii_usd, ipi_usd, pis_usd, cofins_usd, icms_usd')
        .eq('quote_id', quoteId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        vmcv_usd: number; frete_intl_usd: number;
        ii_usd: number; ipi_usd: number; pis_usd: number; cofins_usd: number; icms_usd: number;
      } | null;
    },
    enabled: !!quoteId,
  });

  const { data: autoCharge } = useQuery({
    queryKey: ['quote-charge-auto-insurance', quoteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('quote_charges')
        .select('id, buy_amount, sell_amount, currency')
        .eq('quote_id', quoteId)
        .eq('is_auto_insurance', true)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; buy_amount: number; sell_amount: number; currency: string } | null;
    },
    enabled: !!quoteId,
  });

  const taxaPct = Number(quote?.seguro_taxa_pct ?? 0.16);
  const auto = quote?.seguro_auto !== false; // default true enquanto carrega

  const breakdown = useMemo(() => calcSeguroInternacional({
    custoUsd: Number(basis?.vmcv_usd || 0),
    freteUsd: Number(basis?.frete_intl_usd || 0),
    impostosUsd: Number(basis?.ii_usd || 0) + Number(basis?.ipi_usd || 0) + Number(basis?.pis_usd || 0)
      + Number(basis?.cofins_usd || 0) + Number(basis?.icms_usd || 0),
    taxaPct,
  }), [basis, taxaPct]);

  const hasBasis = !!basis && (breakdown.custo > 0 || breakdown.frete > 0);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['quote-charge-auto-insurance', quoteId] });
    qc.invalidateQueries({ queryKey: ['quote-charges', quoteId] });
    qc.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
    qc.invalidateQueries({ queryKey: ['cost-estimate', quoteId] });
  };

  // Mantém a taxa automática sincronizada com o valor calculado sempre que o
  // checkbox estiver marcado (ex.: mudou o câmbio, os impostos, o frete etc.).
  const syncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!auto || !hasBasis || readOnly) return;
    const key = `${autoCharge?.id || ''}:${breakdown.valorSeguro}`;
    if (syncedRef.current === key) return;
    if (autoCharge && Number(autoCharge.sell_amount) === breakdown.valorSeguro && Number(autoCharge.buy_amount) === breakdown.valorSeguro) {
      syncedRef.current = key;
      return;
    }
    syncedRef.current = key;
    (async () => {
      if (autoCharge) {
        await (supabase as any).from('quote_charges')
          .update({ buy_amount: breakdown.valorSeguro, sell_amount: breakdown.valorSeguro })
          .eq('id', autoCharge.id);
      } else if (!autoCharge && companyId) {
        await (supabase as any).from('quote_charges').insert({
          quote_id: quoteId,
          company_id: companyId,
          description: 'SEGURO INTERNACIONAL (CÁLCULO AUTOMÁTICO)',
          charge_type: 'freight',
          leg: 'freight',
          currency: 'USD',
          billing_unit: 'fixed',
          buy_amount: breakdown.valorSeguro,
          sell_amount: breakdown.valorSeguro,
          is_auto_insurance: true,
        });
      }
      invalidateAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, hasBasis, readOnly, breakdown.valorSeguro, autoCharge?.id, companyId]);

  const handleToggle = async (checked: boolean) => {
    if (readOnly) return;
    try {
      await (supabase as any).from('quotes').update({ seguro_auto: checked }).eq('id', quoteId);
      if (!checked && autoCharge) {
        await (supabase as any).from('quote_charges').delete().eq('id', autoCharge.id);
      }
      qc.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
      invalidateAll();
      toast.success(checked ? 'Seguro incluído no processo.' : 'Seguro removido do processo.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar o seguro do processo.');
    }
  };

  const handleTaxaChange = async (v: number) => {
    if (readOnly) return;
    const clean = Math.max(0, v || 0);
    await (supabase as any).from('quotes').update({ seguro_taxa_pct: clean }).eq('id', quoteId);
    qc.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
  };

  return (
    <Card className="glass border-primary/20">
      <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-medium">Seguro Internacional</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Calculado automaticamente: (Custo + Frete + 10% Despesas + 10% Lucro Esperado + Impostos) x Taxa da seguradora.
                Marque para incluir esse valor como taxa do processo.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`seguro-auto-${quoteId}`}
            checked={auto}
            disabled={readOnly}
            onCheckedChange={(c) => handleToggle(!!c)}
          />
          <Label htmlFor={`seguro-auto-${quoteId}`} className="text-xs cursor-pointer select-none">
            Incluir no processo
          </Label>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasBasis ? (
          <p className="text-xs text-muted-foreground italic py-2">
            Crie a Estimativa de Custo (com valor da mercadoria e frete) para calcular o seguro automaticamente.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div><span className="text-muted-foreground block">Custo</span><span className="font-mono">US$ {fmtUSD(breakdown.custo)}</span></div>
            <div><span className="text-muted-foreground block">Frete</span><span className="font-mono">US$ {fmtUSD(breakdown.frete)}</span></div>
            <div><span className="text-muted-foreground block">Despesas (10%)</span><span className="font-mono">US$ {fmtUSD(breakdown.despesas)}</span></div>
            <div><span className="text-muted-foreground block">Lucro Esperado (10%)</span><span className="font-mono">US$ {fmtUSD(breakdown.lucroEsperado)}</span></div>
            <div><span className="text-muted-foreground block">Impostos</span><span className="font-mono">US$ {fmtUSD(breakdown.impostos)}</span></div>
            <div><span className="text-muted-foreground block">Soma das Verbas</span><span className="font-mono">US$ {fmtUSD(breakdown.somaVerbas)}</span></div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Taxa</span>
              <DebouncedInput
                disabled={readOnly}
                type="number"
                step="0.0001"
                value={taxaPct}
                onCommit={handleTaxaChange}
                className="h-7 text-xs"
              />
            </div>
            <div className="rounded-md bg-primary/5 px-2 py-1 flex flex-col justify-center">
              <span className="text-muted-foreground block">Valor do Seguro</span>
              <span className="font-mono font-bold text-primary">US$ {fmtUSD(breakdown.valorSeguro)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
