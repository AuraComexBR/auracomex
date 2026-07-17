import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { calcEstimativa, EstimateInput, EstimateBreakdown } from '@/lib/costEstimate';
import { mapChargesToEstimate, mergeItemsWithQuoteItems, ChargeLike, FxRates, QuoteItemLike, ExistingItem } from '@/lib/estimateSync';

export interface EstimateRow {
  id: string;
  company_id: string;
  quote_id: string;
  status: string;
  incoterm: string | null;
  frequencia: string | null;
  transito: string | null;
  carrier: string | null;
  rota_origem: string | null;
  rota_destino: string | null;
  data_fiscal: string;
  usd_brl: number;
  eur_brl: number;
  rateio_metodo: 'valor' | 'peso' | 'quantidade';
  acrescimos_usd: number;
  deducoes_usd: number;
  frete_intl_usd: number;
  seguro_intl_usd: number;
  taxa_siscomex_brl?: number;
  afrmm_brl?: number;
  afrmm_auto?: boolean;
}

export interface EstimateItemRow {
  id: string;
  estimate_id: string;
  company_id: string;
  quote_item_id: string | null;
  ordem: number;
  ncm: string | null;
  nome: string;
  peso: number;
  quantidade: number;
  vmcv_unit_usd: number;
  aliq_ii: number;
  aliq_ipi: number;
  aliq_pis: number;
  aliq_cofins: number;
  aliq_icms: number;
  ipi_na_base_icms?: boolean;
  destinacao?: 'consumo_final' | 'revenda_industrializacao';
  cofins_adicional?: boolean;
}

export interface EstimateExpenseRow {
  id: string;
  estimate_id: string;
  company_id: string;
  descricao: string;
      valor_brl: number;
      valor_original: number;
      moeda_original: string;
      aduaneira: boolean;
      ordem: number;
      source_charge_id?: string | null;
      category?: 'origin' | 'freight' | 'destination' | 'local' | null;
}

export function useCostEstimate(quoteId: string, companyId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['cost-estimate', quoteId],
    queryFn: async () => {
      const { data: est } = await (supabase as any)
        .from('cost_estimates')
        .select('*')
        .eq('quote_id', quoteId)
        .maybeSingle();
      if (!est) return { estimate: null, items: [], expenses: [] };

      const [{ data: items }, { data: expenses }] = await Promise.all([
        (supabase as any).from('cost_estimate_items').select('*').eq('estimate_id', est.id).order('ordem'),
        (supabase as any).from('cost_estimate_expenses').select('*').eq('estimate_id', est.id).order('ordem'),
      ]);
      return {
        estimate: est as EstimateRow,
        items: (items || []) as EstimateItemRow[],
        expenses: (expenses || []) as EstimateExpenseRow[],
      };
    },
    enabled: !!quoteId,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cost-estimate', quoteId] });

  const createEstimate = async (seed: { quoteItems: any[]; incoterm?: string; origem?: string; destino?: string; usd_brl: number; eur_brl: number; carrier?: string; transito?: string; }) => {
    if (!companyId) throw new Error('Empresa não identificada');
    const { data: est, error } = await (supabase as any)
      .from('cost_estimates')
      .insert({
        company_id: companyId,
        quote_id: quoteId,
        incoterm: seed.incoterm,
        rota_origem: seed.origem,
        rota_destino: seed.destino,
        usd_brl: seed.usd_brl,
        eur_brl: seed.eur_brl,
        carrier: seed.carrier,
        transito: seed.transito,
      })
      .select()
      .single();
    if (error) throw error;

    const validQuoteItems = seed.quoteItems.filter(qi => qi?.id);
    if (validQuoteItems.length > 0) {
      const itemsPayload = validQuoteItems.map((qi, idx) => ({
        estimate_id: est.id,
        company_id: companyId,
        quote_item_id: qi.id,
        ordem: idx,
        ncm: qi.ncm_code || null,
        nome: qi.commodity || '',
        peso: Number(qi.weight_kg) || 0,
        quantidade: Number(qi.packages) || Number(qi.container_qty) || 0,
        vmcv_unit_usd: 0,
        aliq_ii: 0,
        aliq_ipi: 0,
        aliq_pis: 2.1,
        aliq_cofins: 9.65,
        aliq_icms: 18,
      }));
      await (supabase as any)
        .from('cost_estimate_items')
        .upsert(itemsPayload, { onConflict: 'estimate_id,quote_item_id' });
    }
    invalidate();
    return est;
  };

  const deleteEstimate = async (estimateId: string) => {
    await (supabase as any).from('cost_estimate_items').delete().eq('estimate_id', estimateId);
    await (supabase as any).from('cost_estimate_expenses').delete().eq('estimate_id', estimateId);
    const { error } = await (supabase as any).from('cost_estimates').delete().eq('id', estimateId);
    if (error) throw error;
    invalidate();
  };

  return { ...query, createEstimate, deleteEstimate, invalidate };
}

/**
 * Sincroniza Frete/Seguro/Acréscimos/Deduções e Despesas Nacionais a partir das charges.
 * Preserva despesas adicionadas manualmente (sem source_charge_id).
 */
export async function syncEstimateFromCharges(
  estimateId: string,
  companyId: string,
  charges: ChargeLike[],
  fx: FxRates,
  getMultiplier: (unit: string) => number,
): Promise<{ ignoredCount: number }> {
  const mapped = mapChargesToEstimate(charges, fx, getMultiplier);

  // 1. atualiza componentes internacionais
  const { error: updErr } = await (supabase as any)
    .from('cost_estimates')
    .update({
      frete_intl_usd: mapped.frete_intl_usd,
      seguro_intl_usd: mapped.seguro_intl_usd,
      acrescimos_usd: mapped.acrescimos_usd,
      deducoes_usd: mapped.deducoes_usd,
    })
    .eq('id', estimateId);
  if (updErr) throw updErr;

  // 2. remove despesas antigas vindas de charges (preserva manuais)
  await (supabase as any)
    .from('cost_estimate_expenses')
    .delete()
    .eq('estimate_id', estimateId)
    .not('source_charge_id', 'is', null);

  // 3. insere novas despesas mapeadas
  if (mapped.expenses.length > 0) {
    const payload = mapped.expenses.map((e, idx) => ({
      estimate_id: estimateId,
      company_id: companyId,
      descricao: e.descricao,
      valor_brl: e.valor_brl,
      valor_original: e.valor_original,
      moeda_original: e.moeda_original,
      aduaneira: e.aduaneira,
      source_charge_id: e.source_charge_id,
      category: e.category,
      ordem: 1000 + idx, // após despesas manuais
    }));
    const { error: insErr } = await (supabase as any).from('cost_estimate_expenses').insert(payload);
    if (insErr) throw insErr;
  }

  return { ignoredCount: mapped.ignored.length };
}

/**
 * Sincroniza os itens da estimativa com os quote_items, preservando alíquotas/VMCV.
 */
export async function syncEstimateItemsFromQuote(
  estimateId: string,
  companyId: string,
  existing: ExistingItem[],
  qItems: QuoteItemLike[],
): Promise<{ added: number; updated: number; orphaned: number; unchanged: number }> {
  const validQItems = qItems.filter(q => q?.id);
  const { data: freshExisting } = await (supabase as any)
    .from('cost_estimate_items')
    .select('id,quote_item_id,nome,ncm,peso,quantidade,vmcv_unit_usd,aliq_ii,aliq_ipi,aliq_pis,aliq_cofins,aliq_icms,ordem')
    .eq('estimate_id', estimateId)
    .order('ordem');

  let currentExisting = ((freshExisting && freshExisting.length >= existing.length) ? freshExisting : existing) as ExistingItem[];

  const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();
  const hasFiscalData = (e: ExistingItem) => Number(e.vmcv_unit_usd || 0) > 0
    || Number(e.aliq_ii || 0) > 0
    || Number(e.aliq_ipi || 0) > 0;
  const score = (e: ExistingItem, quoteItemId: string) =>
    (hasFiscalData(e) ? 100 : 0)
    + (e.quote_item_id === quoteItemId ? 10 : 0)
    - Number((e as any).ordem || 0) / 1000;

  const duplicateIds = new Set<string>();
  const replacements = new Map<string, ExistingItem>();
  const currentQuoteItemIds = new Set(validQItems.map(q => q.id));
  const quoteKeyCounts = new Map<string, number>();
  validQItems.forEach(q => {
    const key = `${norm(q.commodity)}|${norm(q.ncm_code)}`;
    quoteKeyCounts.set(key, (quoteKeyCounts.get(key) || 0) + 1);
  });

  for (const qi of validQItems) {
    const qName = norm(qi.commodity);
    const qNcm = norm(qi.ncm_code);
    const qKey = `${qName}|${qNcm}`;
    const candidates = currentExisting.filter(e => {
      if (duplicateIds.has(e.id)) return false;
      if (e.quote_item_id === qi.id) return true;
      if (e.quote_item_id && currentQuoteItemIds.has(e.quote_item_id)) return false;
      if ((quoteKeyCounts.get(qKey) || 0) > 1) return false;
      const sameName = qName && norm(e.nome) === qName;
      const sameNcm = qNcm && norm(e.ncm) === qNcm;
      return Boolean((sameName && sameNcm) || (sameName && !qNcm) || (sameNcm && !qName));
    });

    if (candidates.length <= 1) continue;

    const keep = [...candidates].sort((a, b) => score(b, qi.id) - score(a, qi.id))[0];
    replacements.set(keep.id, { ...keep, quote_item_id: qi.id });
    candidates.forEach(c => { if (c.id !== keep.id) duplicateIds.add(c.id); });
  }

  if (duplicateIds.size > 0) {
    const { error } = await (supabase as any)
      .from('cost_estimate_items')
      .delete()
      .in('id', Array.from(duplicateIds));
    if (error) throw error;
    currentExisting = currentExisting
      .filter(e => !duplicateIds.has(e.id))
      .map(e => replacements.get(e.id) || e);
  }

  const merged = mergeItemsWithQuoteItems(currentExisting, validQItems);

  // Índice por quote_item_id já existente (evita duplicar insert se algum prev ficou para trás).
  const existingByQuoteItemId = new Map(currentExisting.filter(e => e.quote_item_id).map(e => [e.quote_item_id!, e]));

  const eq = (a: any, b: any) => Number(a || 0) === Number(b || 0);
  const eqStr = (a: any, b: any) => (a || '') === (b || '');

  let added = 0, updated = 0, unchanged = 0;
  for (let i = 0; i < merged.length; i++) {
    const m = merged[i];
    if (m.action === 'update' && m.estimate_item_id) {
      const prev = currentExisting.find(e => e.id === m.estimate_item_id);
      if (prev
        && eqStr(prev.nome, m.data.nome)
        && eqStr(prev.ncm, m.data.ncm)
        && eq(prev.peso, m.data.peso)
        && eq(prev.quantidade, m.data.quantidade)
        && prev.quote_item_id === m.data.quote_item_id) {
        unchanged += 1;
        continue;
      }
      const { error } = await (supabase as any)
        .from('cost_estimate_items')
        .update({ ...m.data, ordem: i })
        .eq('id', m.estimate_item_id);
      if (error) throw error;
      updated += 1;
    } else {
      // Defesa: se já existe item com este quote_item_id, faz update em vez de insert.
      const dup = existingByQuoteItemId.get(m.data.quote_item_id);
      if (dup) {
        const { error } = await (supabase as any)
          .from('cost_estimate_items')
          .update({ ...m.data, ordem: i })
          .eq('id', dup.id);
        if (error) throw error;
        updated += 1;
        continue;
      }
      const { data: liveDup } = await (supabase as any)
        .from('cost_estimate_items')
        .select('id')
        .eq('estimate_id', estimateId)
        .eq('quote_item_id', m.data.quote_item_id)
        .order('ordem')
        .limit(1);
      const liveDupId = Array.isArray(liveDup) ? liveDup[0]?.id : liveDup?.id;
      if (liveDupId) {
        const { error } = await (supabase as any)
          .from('cost_estimate_items')
          .update({ ...m.data, ordem: i })
          .eq('id', liveDupId);
        if (error) throw error;
        updated += 1;
        continue;
      }
      const { error } = await (supabase as any)
        .from('cost_estimate_items')
        .upsert({ ...m.data, estimate_id: estimateId, company_id: companyId, ordem: i }, { onConflict: 'estimate_id,quote_item_id' });
      if (error) throw error;
      added += 1;
    }
  }

  // Itens órfãos (na estimativa sem quote_item_id correspondente nos quote_items atuais)
  const validQuoteItemIds = new Set(validQItems.map(q => q.id));
  const orphans = currentExisting.filter(e => e.quote_item_id && !validQuoteItemIds.has(e.quote_item_id));

  return { added, updated, orphaned: orphans.length, unchanged };
}

/** Hook utilitário para gravar atualizações com debounce */
export function useDebouncedSave<T>(value: T, onSave: (v: T) => Promise<void> | void, delay = 1500) {
  const ref = useRef<T>(value);
  const [saving, setSaving] = useState(false);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; ref.current = value; return; }
    ref.current = value;
    const t = setTimeout(async () => {
      setSaving(true);
      try { await onSave(ref.current); } finally { setSaving(false); }
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return saving;
}

export function computeBreakdown(
  estimate: EstimateRow | null,
  items: EstimateItemRow[],
  expenses: EstimateExpenseRow[]
): EstimateBreakdown | null {
  if (!estimate) return null;
  const input: EstimateInput = {
    acrescimos_usd: estimate.acrescimos_usd || 0,
    deducoes_usd: estimate.deducoes_usd || 0,
    frete_intl_usd: estimate.frete_intl_usd || 0,
    seguro_intl_usd: estimate.seguro_intl_usd || 0,
    usd_brl: estimate.usd_brl || 0,
    rateio_metodo: estimate.rateio_metodo || 'valor',
    taxa_siscomex_brl: Number((estimate as any).taxa_siscomex_brl || 0),
    afrmm_brl: (estimate as any).afrmm_auto
      ? Number((((estimate.frete_intl_usd || 0) * (estimate.usd_brl || 0) * 0.08) + 20).toFixed(2))
      : Number((estimate as any).afrmm_brl || 0),
    items: items.map(i => ({
      id: i.id, nome: i.nome, ncm: i.ncm || undefined,
      peso: Number(i.peso), quantidade: Number(i.quantidade),
      vmcv_unit_usd: Number(i.vmcv_unit_usd),
      aliq_ii: Number(i.aliq_ii), aliq_ipi: Number(i.aliq_ipi),
      aliq_pis: Number(i.aliq_pis), aliq_cofins: Number(i.aliq_cofins),
      aliq_icms: Number(i.aliq_icms),
        destinacao: (i.destinacao
          ?? (i.ipi_na_base_icms === false ? 'revenda_industrializacao' : 'consumo_final')),
        cofins_adicional: !!i.cofins_adicional,
    })),
    expenses: expenses.map(e => ({ descricao: e.descricao, valor_brl: Number(e.valor_brl), aduaneira: e.aduaneira, category: e.category })),
  };
  return calcEstimativa(input);
}