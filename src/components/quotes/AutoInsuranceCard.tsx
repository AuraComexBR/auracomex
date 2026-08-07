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
import { calcTotalCargoValueUsd, CargoValueLike } from '@/lib/cargoValue';

interface QuotePartnerLike {
  client_id?: string | null;
  clients?: { id?: string; name?: string; partner_category?: string | null; insurance_rate_pct?: number | null } | null;
}

interface Props {
  quoteId: string;
  companyId?: string;
  quote: { id: string; seguro_auto?: boolean | null } | null | undefined;
  quotePartners?: QuotePartnerLike[];
  /** Itens da aba Resumo da Carga — Custo do seguro vem daqui (soma do Valor da Carga em USD). */
  cargoItems?: CargoValueLike[];
  readOnly?: boolean;
}

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Card "Seguro Internacional" da aba Taxas.
 *
 * A taxa NÃO é editável aqui — ela vem do cadastro da Seguradora (Cadastros >
 * Parceiros, categoria "Seguradora") vinculada ao processo na aba Parceiros.
 * Sem seguradora vinculada, cai no padrão da empresa (Configurações >
 * Empresa). O valor calculado só passa a compor o processo (vira uma taxa
 * real em quote_charges, contabilizada no total e na Estimativa de Custo)
 * quando o checkbox "Incluir no processo" está marcado.
 */
export function AutoInsuranceCard({ quoteId, companyId, quote, quotePartners = [], cargoItems = [], readOnly }: Props) {
  const qc = useQueryClient();

  // Frete Internacional e Impostos (II/IPI/PIS/COFINS/ICMS) ainda vêm da
  // Estimativa de Custo — só o Custo mudou de fonte (ver abaixo).
  const { data: basis } = useQuery({
    queryKey: ['cost-estimate-insurance-basis', quoteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cost_estimates')
        .select('frete_intl_usd, ii_usd, ipi_usd, pis_usd, cofins_usd, icms_usd')
        .eq('quote_id', quoteId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        frete_intl_usd: number;
        ii_usd: number; ipi_usd: number; pis_usd: number; cofins_usd: number; icms_usd: number;
      } | null;
    },
    enabled: !!quoteId,
  });

  // Custo = Valor Total da Carga (aba Resumo da Carga), somado em USD — não
  // depende mais de uma Estimativa de Custo existir.
  const { totalUsd: custoCargaUsd, hasNonUsd: cargaTemOutraMoeda } = useMemo(
    () => calcTotalCargoValueUsd(cargoItems),
    [cargoItems]
  );

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

  // Seguradora vinculada ao processo (aba Parceiros) — mesma fonte usada pra
  // Cia Aérea/Armador no Cabeçalho da Estimativa.
  const insurer = useMemo(
    () => quotePartners.find((qp) => qp.clients?.partner_category === 'insurance') || null,
    [quotePartners]
  );

  // Sem seguradora vinculada, cai no padrão cadastrado na empresa.
  const { data: companyDefault } = useQuery({
    queryKey: ['company-seguro-taxa-default', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await (supabase as any)
        .from('companies')
        .select('seguro_taxa_pct_default')
        .eq('id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data as { seguro_taxa_pct_default: number } | null;
    },
    enabled: !!companyId && !insurer,
  });

  const insurerRate = insurer?.clients?.insurance_rate_pct;
  const taxaResolved = insurerRate != null
    ? Number(insurerRate)
    : (companyDefault?.seguro_taxa_pct_default != null ? Number(companyDefault.seguro_taxa_pct_default) : null);
  const taxaSourceLabel = insurerRate != null
    ? `Seguradora: ${insurer?.clients?.name || 'sem nome'}`
    : (taxaResolved != null ? 'Padrão da empresa (nenhuma seguradora vinculada ao processo)' : null);

  const hasRate = taxaResolved != null;
  const taxaPct = taxaResolved ?? 0;
  const auto = quote?.seguro_auto !== false; // default true enquanto carrega

  const breakdown = useMemo(() => calcSeguroInternacional({
    custoUsd: custoCargaUsd,
    freteUsd: Number(basis?.frete_intl_usd || 0),
    impostosUsd: Number(basis?.ii_usd || 0) + Number(basis?.ipi_usd || 0) + Number(basis?.pis_usd || 0)
      + Number(basis?.cofins_usd || 0) + Number(basis?.icms_usd || 0),
    taxaPct,
  }), [custoCargaUsd, basis, taxaPct]);

  const hasBasis = breakdown.custo > 0 || breakdown.frete > 0;
  const canCalc = hasBasis && hasRate;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['quote-charge-auto-insurance', quoteId] });
    qc.invalidateQueries({ queryKey: ['quote-charges', quoteId] });
    qc.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
    qc.invalidateQueries({ queryKey: ['cost-estimate', quoteId] });
  };

  // Mantém a taxa automática sincronizada com o valor calculado sempre que o
  // checkbox estiver marcado (ex.: mudou o câmbio, os impostos, o frete, a
  // seguradora vinculada etc.).
  const syncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!auto || !canCalc || readOnly) return;
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
  }, [auto, canCalc, readOnly, breakdown.valorSeguro, autoCharge?.id, companyId]);

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
                Calculado automaticamente: (Custo + Frete + 10% Despesas + 10% Lucro Esperado + Impostos) x Taxa da seguradora
                vinculada ao processo (aba Parceiros). Marque para incluir esse valor como taxa do processo.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`seguro-auto-${quoteId}`}
            checked={auto}
            disabled={readOnly || !hasRate}
            onCheckedChange={(c) => handleToggle(!!c)}
          />
          <Label htmlFor={`seguro-auto-${quoteId}`} className="text-xs cursor-pointer select-none">
            Incluir no processo
          </Label>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasRate ? (
          <p className="text-xs text-muted-foreground italic py-2">
            Nenhuma taxa de seguro disponível. Vincule uma Seguradora ao processo na aba Parceiros (Cadastros &gt; Parceiros,
            categoria "Seguradora", com a Taxa de Seguro preenchida) ou defina uma taxa padrão em Configurações &gt; Empresa.
          </p>
        ) : !hasBasis ? (
          <p className="text-xs text-muted-foreground italic py-2">
            Informe o Valor da Carga (em USD) na aba Resumo da Carga para calcular o seguro automaticamente.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Custo</span>
                <span className="font-mono">US$ {fmtUSD(breakdown.custo)}</span>
                {cargaTemOutraMoeda && <span className="text-amber-600 text-[10px] block">* há itens de carga em outra moeda, não somados</span>}
              </div>
              <div><span className="text-muted-foreground block">Frete</span><span className="font-mono">US$ {fmtUSD(breakdown.frete)}</span></div>
              <div><span className="text-muted-foreground block">Despesas (10%)</span><span className="font-mono">US$ {fmtUSD(breakdown.despesas)}</span></div>
              <div><span className="text-muted-foreground block">Lucro Esperado (10%)</span><span className="font-mono">US$ {fmtUSD(breakdown.lucroEsperado)}</span></div>
              <div><span className="text-muted-foreground block">Impostos</span><span className="font-mono">US$ {fmtUSD(breakdown.impostos)}</span></div>
              <div><span className="text-muted-foreground block">Soma das Verbas</span><span className="font-mono">US$ {fmtUSD(breakdown.somaVerbas)}</span></div>
              <div>
                <span className="text-muted-foreground block">Taxa (fixa)</span>
                <span className="font-mono">{taxaPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%</span>
              </div>
              <div className="rounded-md bg-primary/5 px-2 py-1 flex flex-col justify-center">
                <span className="text-muted-foreground block">Valor do Seguro</span>
                <span className="font-mono font-bold text-primary">US$ {fmtUSD(breakdown.valorSeguro)}</span>
              </div>
            </div>
            {taxaSourceLabel && (
              <p className="text-[10px] text-muted-foreground italic">{taxaSourceLabel}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
