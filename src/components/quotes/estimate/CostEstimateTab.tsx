import React, { useMemo, useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calculator, FileDown, Plus, Trash2, RefreshCw, Link2, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';

import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useCostEstimate, computeBreakdown, EstimateItemRow, EstimateExpenseRow, EstimateRow, syncEstimateFromCharges, syncEstimateItemsFromQuote } from '@/hooks/useCostEstimate';
import { syncGeneralFieldsToEstimate } from '@/lib/estimateHeaderSync';
import { pct, toBRL } from '@/lib/costEstimate';
import { toast } from 'sonner';
import { EstimatePdfDialog } from './EstimatePdfDialog';
import { DebouncedInput } from './DebouncedInput';
import { FloatingSaveButton } from './FloatingSaveButton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { ChargeLike } from '@/lib/estimateSync';
import { chargesHaveInsurance } from '@/lib/estimateSync';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

export interface CostEstimateTabHandle {
  enterEdit: () => void;
  requestCancel: () => void;
  forceExit: () => void;
  hasEstimate: boolean;
}

interface Props {
  quoteId: string;
  quote: any;
  quoteItems: any[];
  quotePartners?: any[];
  companyId?: string;
  charges?: ChargeLike[];
  getBillingMultiplier?: (unit: string) => number;
  onStateChange?: (state: { editMode: boolean; dirtyCount: number; hasEstimate: boolean }) => void;
}

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

import { cn } from '@/lib/utils';

const tmpId = () => `tmp_${Math.random().toString(36).slice(2, 11)}`;
const isTmp = (id: string) => id.startsWith('tmp_');

type DraftEstimate = EstimateRow;
type DraftItem = EstimateItemRow & { _new?: boolean };
type DraftExpense = EstimateExpenseRow & { _new?: boolean };

export const CostEstimateTab = forwardRef<CostEstimateTabHandle, Props>(function CostEstimateTab(
  { quoteId, quote, quoteItems, quotePartners = [], companyId, charges, getBillingMultiplier, onStateChange },
  ref,
) {
  const { data, isLoading, createEstimate, deleteEstimate, invalidate } = useCostEstimate(quoteId, companyId);
  const { usdBrl: latestUsdBrl, eurBrl: latestEurBrl, refetch: refetchRates, loading: ratesLoadingQuery } = useExchangeRate();
  const [frozenUsdBrl, setFrozenUsdBrl] = useState<number | null>(null);
  const [frozenEurBrl, setFrozenEurBrl] = useState<number | null>(null);

  useEffect(() => {
    if (latestUsdBrl && frozenUsdBrl === null) setFrozenUsdBrl(latestUsdBrl);
    if (latestEurBrl && frozenEurBrl === null) setFrozenEurBrl(latestEurBrl);
  }, [latestUsdBrl, latestEurBrl]);

  // Taxa efetiva é calculada mais abaixo, após declarar draftEstimate/editMode.
  const queryClient = useQueryClient();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ===== Modo edição =====
  const [editMode, setEditMode] = useState(false);
  const [draftEstimate, setDraftEstimate] = useState<DraftEstimate | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftExpenses, setDraftExpenses] = useState<DraftExpense[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [deletedExpenseIds, setDeletedExpenseIds] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ncmLookupLoading, setNcmLookupLoading] = useState<string | null>(null);
  const snapshotRef = useRef<{ estimate: any; items: any[]; expenses: any[] } | null>(null);


  const serverEstimate = data?.estimate || null;
  const serverItems = data?.items || [];
  const serverExpenses = data?.expenses || [];

  // Quando em modo edição → usa rascunho; senão usa dados do servidor
  const estimate = editMode ? draftEstimate : serverEstimate;
  const items: DraftItem[] = editMode ? draftItems : (serverItems as DraftItem[]);
  const expenses: DraftExpense[] = editMode ? draftExpenses : (serverExpenses as DraftExpense[]);

  // Taxa efetiva: valor do CAMPO (editado/persistido) tem prioridade sobre a taxa puxada do sistema.
  // Só cai para o câmbio do sistema (frozen) quando o campo está vazio/zerado.
  const usdBrl = Number((estimate as any)?.usd_brl || 0) || frozenUsdBrl || 0;
  const eurBrl = Number((estimate as any)?.eur_brl || 0) || frozenEurBrl || 0;

  const breakdown = useMemo(
    () => computeBreakdown(estimate, items, expenses),
    [estimate, items, expenses]
  );

  const hasInsurance = useMemo(() => chargesHaveInsurance(charges), [charges]);

  const { data: siscomexConfig } = useQuery({
    queryKey: ['siscomex-config', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('company_siscomex_configs')
        .select('is_active')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) return null;
      return data || { is_active: true }; // Fallback para true para permitir busca na base local mesmo sem config
    },
    enabled: !!companyId,
  });

  const handleNcmLookup = async (itemId: string, ncm: string) => {
    if (!ncm || ncm.length < 4) {
      toast.error('Informe um NCM válido');
      return;
    }
    
    setNcmLookupLoading(itemId);
    try {
      const { data, error } = await supabase.functions.invoke('siscomex-gateway', {
        body: { action: 'get_ncm_rates', ncm, company_id: companyId }
      });

      if (error) throw error;
      if (data?.success && data.rates) {
        patchItem(itemId, {
          aliq_ii: data.rates.ii,
          aliq_ipi: data.rates.ipi,
          aliq_pis: data.rates.pis,
          aliq_cofins: data.rates.cofins
        });
        toast.success(`Alíquotas oficiais para o NCM ${ncm} atualizadas diretamente da Receita Federal.`);

      } else {
        throw new Error(data?.error || 'NCM não encontrado ou erro na consulta');
      }
    } catch (err: any) {
      console.error('NCM Lookup error:', err);
      toast.error(err.message || 'Falha ao buscar alíquotas do Siscomex');
    } finally {
      setNcmLookupLoading(null);
    }
  };


  // ===== Diff (dirty count) =====
  const dirtyCount = useMemo(() => {
    if (!editMode || !snapshotRef.current || !draftEstimate) return 0;
    let n = 0;
    const snap = snapshotRef.current;
    // estimate fields
    Object.keys(draftEstimate).forEach((k) => {
      const a = (draftEstimate as any)[k];
      const b = (snap.estimate as any)[k];
      if (String(a ?? '') !== String(b ?? '')) n++;
    });
    // items
    draftItems.forEach((it) => {
      if (it._new) { n++; return; }
      const orig = snap.items.find((x: any) => x.id === it.id);
      if (!orig) return;
      Object.keys(it).forEach((k) => {
        if (k === '_new') return;
        if (String((it as any)[k] ?? '') !== String(orig[k] ?? '')) n++;
      });
    });
    // expenses
    draftExpenses.forEach((e) => {
      if (e._new) { n++; return; }
      const orig = snap.expenses.find((x: any) => x.id === e.id);
      if (!orig) return;
      Object.keys(e).forEach((k) => {
        if (k === '_new') return;
        if (String((e as any)[k] ?? '') !== String(orig[k] ?? '')) n++;
      });
    });
    n += deletedItemIds.length + deletedExpenseIds.length;
    return n;
  }, [editMode, draftEstimate, draftItems, draftExpenses, deletedItemIds, deletedExpenseIds]);

  const hasDirty = dirtyCount > 0;

  // ===== Entrar/Sair do modo edição =====
  const enterEdit = useCallback(() => {
    if (!serverEstimate) return;
    snapshotRef.current = {
      estimate: { ...serverEstimate },
      items: serverItems.map(i => ({ ...i })),
      expenses: serverExpenses.map(e => ({ ...e })),
    };
    setDraftEstimate({ ...serverEstimate });
    setDraftItems(serverItems.map(i => ({ ...i })));
    setDraftExpenses(serverExpenses.map(e => ({ ...e })));
    setDeletedItemIds([]);
    setDeletedExpenseIds([]);
    setSaveState('idle');
    setEditMode(true);

  }, [serverEstimate, serverItems, serverExpenses]);

  const exitEdit = useCallback(() => {
    setEditMode(false);
    setDraftEstimate(null);
    setDraftItems([]);
    setDraftExpenses([]);
    setDeletedItemIds([]);
    setDeletedExpenseIds([]);
    snapshotRef.current = null;
  }, []);

  // Sincroniza dados da aba geral automaticamente (background)
  useEffect(() => {
    if (serverEstimate?.id && quote && !editMode) {
      // Sincroniza em segundo plano sem disparar re-render imediato no rascunho
      syncGeneralFieldsToEstimate(serverEstimate.id, quote, quotePartners)
        .then(() => {
          // Opcional: invalidar query para atualizar a UI se algo mudou
          // queryClient.invalidateQueries({ queryKey: ['cost-estimate', quoteId] });
        });
    }
  }, [serverEstimate?.id, quote, quotePartners, editMode]);

  // Aplica patches ao rascunho ao entrar em modo edição se houver divergência residual
  useEffect(() => {
    if (editMode && draftEstimate && quote) {
      const patch: Partial<DraftEstimate> = {};
      
      if (!draftEstimate.carrier) {
        const mode = quote?.transport_mode;
        let suggested = '';
        if (mode === 'air') {
          const ciaAerea = quotePartners.find((qp: any) => (qp.clients?.partner_category === 'air_carrier') || (qp.partner_category === 'air_carrier'));
          suggested = ciaAerea?.clients?.name || ciaAerea?.name || 'CONSOLIDADO';
        } else if (mode === 'ocean_lcl') {
          suggested = 'CONSOLIDADO';
        } else if (mode === 'ocean_fcl') {
          const armador = quotePartners.find((qp: any) => (qp.clients?.partner_category === 'ocean_carrier') || (qp.partner_category === 'ocean_carrier'));
          suggested = armador?.clients?.name || armador?.name || '';
        }
        if (suggested) patch.carrier = suggested;
      }

      const generalTransit = String(quote.transit_time || '');
      if (draftEstimate.transito !== generalTransit) patch.transito = generalTransit;

      const generalIncoterm = quote.incoterm || '';
      if (draftEstimate.incoterm !== generalIncoterm) patch.incoterm = generalIncoterm;

      if (draftEstimate.rota_origem !== (quote.origin || '')) patch.rota_origem = quote.origin || '';
      if (draftEstimate.rota_destino !== (quote.destination || '')) patch.rota_destino = quote.destination || '';

      if (Object.keys(patch).length > 0) {
        setDraftEstimate(prev => prev ? { ...prev, ...patch } : prev);
      }
    }
  }, [editMode, !!draftEstimate, quote, quotePartners]);

  const requestCancel = () => {
    if (hasDirty) setCancelOpen(true);
    else exitEdit();
  };

  // Expor métodos para o pai (QuoteDetail) controlar o modo edição via ref
  useImperativeHandle(ref, () => ({
    enterEdit,
    requestCancel,
    forceExit: exitEdit,
    hasEstimate: !!serverEstimate,
  }), [enterEdit, requestCancel, exitEdit, serverEstimate]);

  // Notifica o pai sobre mudanças de estado
  useEffect(() => {
    onStateChange?.({ editMode, dirtyCount, hasEstimate: !!serverEstimate });
  }, [editMode, dirtyCount, serverEstimate, onStateChange]);

  // ===== beforeunload =====
  useEffect(() => {
    if (!editMode || !hasDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editMode, hasDirty]);

  // ===== Handlers locais (apenas mutam draft) =====
  const patchEstimate = async (patch: Partial<DraftEstimate>) => {
    setDraftEstimate(d => d ? { ...d, ...patch } : d);

    // Se alterou a data fiscal, buscar câmbio histórico
    if (patch.data_fiscal) {
      setLoadingRates(true);
      try {
        const cleanDate = patch.data_fiscal.replace(/-/g, '');
        const [usdRes, eurRes] = await Promise.all([
          fetch(`https://economia.awesomeapi.com.br/json/daily/USD-BRL/?start_date=${cleanDate}&end_date=${cleanDate}`),
          fetch(`https://economia.awesomeapi.com.br/json/daily/EUR-BRL/?start_date=${cleanDate}&end_date=${cleanDate}`)
        ]);
        const usdData = await usdRes.json();
        const eurData = await eurRes.json();
        
        const usd = parseFloat(usdData[0]?.bid) || 0;
        const eur = parseFloat(eurData[0]?.bid) || 0;
        
        if (usd > 0 || eur > 0) {
          setDraftEstimate(d => d ? { 
            ...d, 
            usd_brl: usd || d.usd_brl, 
            eur_brl: eur || d.eur_brl 
          } : d);
          toast.info(`Câmbio atualizado para a data ${new Date(patch.data_fiscal).toLocaleDateString('pt-BR')}`);
        } else {
          toast.warning('Não foi possível encontrar o câmbio para esta data.');
        }
      } catch (err) {
        console.error('Failed to fetch historical rates', err);
      } finally {
        setLoadingRates(false);
      }
    }
  };
  const patchItem = (id: string, patch: Partial<DraftItem>) => {
    setDraftItems(arr => arr.map(i => i.id === id ? { ...i, ...patch } : i));
  };
  const patchExpense = (id: string, patch: Partial<DraftExpense>) => {
    setDraftExpenses(arr => arr.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const addItem = () => {
    if (!estimate || !companyId) return;
    const novo: DraftItem = {
      id: tmpId(),
      estimate_id: estimate.id,
      company_id: companyId,
      quote_item_id: null,
      ordem: draftItems.length,
      ncm: '',
      nome: `Item ${draftItems.length + 1}`,
      peso: 0,
      quantidade: 1,
      vmcv_unit_usd: 0,
      aliq_ii: 0, aliq_ipi: 0, aliq_pis: 2.1, aliq_cofins: 9.65, aliq_icms: 18,
      ipi_na_base_icms: true,
      destinacao: 'consumo_final',
      cofins_adicional: false,
      _new: true,
    };
    setDraftItems(arr => [...arr, novo]);
  };
  const removeItem = (id: string) => {
    setDraftItems(arr => arr.filter(i => i.id !== id));
    if (!isTmp(id)) setDeletedItemIds(arr => [...arr, id]);
  };
  const addExpense = (descricao = '') => {
    if (!estimate || !companyId) return;
    const novo: DraftExpense = {
      id: tmpId(),
      estimate_id: estimate.id,
      company_id: companyId,
      descricao: descricao || 'NOVA DESPESA',
      valor_brl: 0,
      valor_original: 0,
      moeda_original: 'BRL',
      aduaneira: false,
      ordem: draftExpenses.length,
      source_charge_id: null,
      category: 'local',
      _new: true,
    };
    setDraftExpenses(arr => [...arr, novo]);
  };
  const removeExpense = (id: string) => {
    setDraftExpenses(arr => arr.filter(e => e.id !== id));
    if (!isTmp(id)) setDeletedExpenseIds(arr => [...arr, id]);
  };

  // ===== Salvamento em lote =====
  const handleSave = useCallback(async () => {
    if (!editMode || !draftEstimate || !snapshotRef.current) return;
    if (!hasDirty) return;
    setSaveState('saving');
    try {
      const snap = snapshotRef.current;
      const ops: Promise<any>[] = [];

      // 1. estimate (campos editáveis)
      const estPatch: any = {};
      const editableEstKeys = [
        'incoterm', 'frequencia', 'transito', 'carrier', 'rota_origem', 'rota_destino',
        'data_fiscal', 'usd_brl', 'eur_brl', 'rateio_metodo',
        'acrescimos_usd', 'deducoes_usd', 'frete_intl_usd', 'seguro_intl_usd', 'category',
        'taxa_siscomex_brl', 'afrmm_brl', 'afrmm_auto',
      ];
      editableEstKeys.forEach(k => {
        const a = (draftEstimate as any)[k];
        const b = (snap.estimate as any)[k];
        if (String(a ?? '') !== String(b ?? '')) estPatch[k] = a;
      });
      if (Object.keys(estPatch).length > 0) {
        ops.push((supabase as any).from('cost_estimates').update(estPatch).eq('id', draftEstimate.id));
      }

      // 2. items
      draftItems.forEach((it, idx) => {
        const { _new, id, ...rest } = it as any;
        if (_new) {
          ops.push((supabase as any).from('cost_estimate_items').insert({ ...rest, ordem: idx }));
        } else {
          const orig = snap.items.find((x: any) => x.id === id);
          if (!orig) return;
          const patch: any = {};
          Object.keys(rest).forEach(k => {
            if (String(rest[k] ?? '') !== String(orig[k] ?? '')) patch[k] = rest[k];
          });
          if (idx !== orig.ordem) patch.ordem = idx;
          if (Object.keys(patch).length > 0) {
            ops.push((supabase as any).from('cost_estimate_items').update(patch).eq('id', id));
          }
        }
      });
      deletedItemIds.forEach(id => {
        ops.push((supabase as any).from('cost_estimate_items').delete().eq('id', id));
      });

      // 3. expenses
      draftExpenses.forEach((e, idx) => {
        const { _new, id, ...rest } = e as any;
        if (_new) {
          ops.push((supabase as any).from('cost_estimate_expenses').insert({ ...rest, ordem: idx }));
        } else {
          const orig = snap.expenses.find((x: any) => x.id === id);
          if (!orig) return;
          const patch: any = {};
          Object.keys(rest).forEach(k => {
            if (String(rest[k] ?? '') !== String(orig[k] ?? '')) patch[k] = rest[k];
          });
          if (idx !== orig.ordem) patch.ordem = idx;
          if (Object.keys(patch).length > 0) {
            ops.push((supabase as any).from('cost_estimate_expenses').update(patch).eq('id', id));
          }
        }
      });
      deletedExpenseIds.forEach(id => {
        ops.push((supabase as any).from('cost_estimate_expenses').delete().eq('id', id));
      });

      const results = await Promise.all(ops);
      const firstErr = results.find((r: any) => r?.error);
      if (firstErr) throw new Error((firstErr as any).error.message);

      // ===== Push reverso: Estimativa → Taxas/Carga (espelho bidirecional) =====
      const reverseOps: Promise<any>[] = [];
      // 4. Despesas com source_charge_id → atualiza quote_charges (descrição, valor convertido, aduaneira)
      for (const e of draftExpenses) {
        if (!e.source_charge_id || (e as any)._new) continue;
        const orig = snap.expenses.find((x: any) => x.id === e.id);
        if (!orig) continue;
        const descChanged = String(e.descricao) !== String(orig.descricao);
        const valChanged = String(e.valor_brl) !== String(orig.valor_brl);
        const aduChanged = String(e.aduaneira) !== String(orig.aduaneira);
        if (!descChanged && !valChanged && !aduChanged) continue;
        reverseOps.push((async () => {
          const { data: ch } = await (supabase as any).from('quote_charges')
            .select('currency, buy_amount').eq('id', e.source_charge_id).maybeSingle();
          if (!ch) return;
          const patch: any = {};
          if (descChanged) patch.description = e.descricao;
          if (aduChanged) patch.aduaneira = e.aduaneira;
          if (valChanged) {
            const cur = (ch.currency || 'BRL').toUpperCase();
            const usd = draftEstimate.usd_brl || 0;
            const eur = draftEstimate.eur_brl || 0;
            if (cur === 'BRL') patch.buy_amount = Number(e.valor_brl);
            else if (cur === 'USD' && usd > 0) patch.buy_amount = Number(e.valor_brl) / usd;
            else if (cur === 'EUR' && eur > 0) patch.buy_amount = Number(e.valor_brl) / eur;
          }
          await (supabase as any).from('quote_charges').update(patch).eq('id', e.source_charge_id);
        })());
      }
      // 5. Itens com quote_item_id → atualiza quote_items (nome/NCM/peso/quantidade)
      for (const it of draftItems) {
        if (!it.quote_item_id || (it as any)._new) continue;
        const orig = snap.items.find((x: any) => x.id === it.id);
        if (!orig) continue;
        const patch: any = {};
        if (String(it.nome) !== String(orig.nome)) patch.commodity = it.nome;
        if (String(it.ncm ?? '') !== String(orig.ncm ?? '')) patch.ncm_code = it.ncm;
        if (String(it.peso) !== String(orig.peso)) patch.weight_kg = Number(it.peso);
        if (String(it.quantidade) !== String(orig.quantidade)) patch.packages = Math.round(Number(it.quantidade));
        if (Object.keys(patch).length > 0) {
          reverseOps.push((supabase as any).from('quote_items').update(patch).eq('id', it.quote_item_id));
        }
      }
      if (reverseOps.length > 0) {
        await Promise.all(reverseOps);
        queryClient.invalidateQueries({ queryKey: ['quote-charges', quoteId] });
        queryClient.invalidateQueries({ queryKey: ['quote-items', quoteId] });
      }

      setSaveState('saved');
      toast.success(`Estimativa salva (${dirtyCount} alteração${dirtyCount > 1 ? 'ões' : ''}).`);
      invalidate();
      setTimeout(() => { exitEdit(); }, 900);
    } catch (err: any) {
      setSaveState('idle');
      toast.error(err.message || 'Erro ao salvar estimativa');
    }
  }, [editMode, draftEstimate, draftItems, draftExpenses, deletedItemIds, deletedExpenseIds, hasDirty, dirtyCount, invalidate, exitEdit, queryClient, quoteId]);

  // Atalho Ctrl/Cmd + S
  useEffect(() => {
    if (!editMode) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editMode, handleSave]);

  // ===== Ações imediatas (fora do rascunho) =====
  const handleCreate = async () => {
    setCreating(true);
    try {
      // Regra de auto-preenchimento do Carrier (Cia / Armador) baseada no modal e categoria
      let autoCarrier = '';
      const mode = quote?.transport_mode;
      
      if (mode === 'air') {
        // Aéreo: CIA Aérea, se não tiver preencher com "CONSOLIDADO"
        const ciaAerea = quotePartners.find((qp: any) => 
          (qp.clients?.partner_category === 'air_carrier') || 
          (qp.partner_category === 'air_carrier')
        );
        autoCarrier = ciaAerea?.clients?.name || ciaAerea?.name || 'CONSOLIDADO';
      } else if (mode === 'ocean_fcl') {
        // FCL: Armador
        const armador = quotePartners.find((qp: any) => 
          (qp.clients?.partner_category === 'ocean_carrier') ||
          (qp.partner_category === 'ocean_carrier')
        );
        autoCarrier = armador?.clients?.name || armador?.name || '';
      } else if (mode === 'ocean_lcl') {
        // LCL: Sempre preencher com "CONSOLIDADO"
        autoCarrier = 'CONSOLIDADO';
      }

      console.log('DEBUG handleCreate:', { mode, autoCarrier, quotePartners });

      const est = await createEstimate({
        quoteItems,
        incoterm: quote?.incoterm,
        origem: quote?.origin,
        destino: quote?.destination,
        usd_brl: usdBrl || 0,
        eur_brl: eurBrl || 0,
        carrier: autoCarrier,
        transito: quote?.transit_time ? String(quote.transit_time) : undefined,
      });
      if (est && companyId && charges && charges.length > 0 && getBillingMultiplier && usdBrl) {
        try {
          await syncEstimateFromCharges(est.id, companyId, charges, { usd_brl: usdBrl, eur_brl: eurBrl || 0 }, getBillingMultiplier);
        } catch (err) { console.error('sync charges failed', err); }
        invalidate();
      }
      toast.success('Estimativa criada com dados da cotação.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const refreshRates = async () => {
    if (!serverEstimate || !usdBrl) return;
    const { error } = await (supabase as any).from('cost_estimates')
      .update({ usd_brl: usdBrl, eur_brl: eurBrl || 0 })
      .eq('id', serverEstimate.id);
    if (error) { toast.error(error.message); return; }
    invalidate();
    toast.success('Câmbio atualizado.');
  };

  // ===== Auto-sync silencioso: Taxas/Carga → Estimativa =====
  // Sempre que charges/quoteItems/câmbio mudam e o usuário NÃO está editando,
  // reprojetamos a estimativa a partir das fontes (espelho automático).
  const chargesKey = useMemo(() => JSON.stringify(charges || []), [charges]);
  const itemsKey = useMemo(() => JSON.stringify((quoteItems || []).map((q: any) => ({
    id: q.id, commodity: q.commodity, ncm_code: q.ncm_code,
    weight_kg: q.weight_kg, packages: q.packages, container_qty: q.container_qty,
  }))), [quoteItems]);
  const lastSyncedRef = useRef<{ estimateId: string; charges: string; items: string; usd: number; eur: number } | null>(null);
  useEffect(() => {
    if (!serverEstimate || !companyId || editMode) return;
    const last = lastSyncedRef.current;
    if (last
      && last.estimateId === serverEstimate.id
      && last.charges === chargesKey
      && last.items === itemsKey
      && last.usd === (usdBrl || 0)
      && last.eur === (eurBrl || 0)) {
      return;
    }
    lastSyncedRef.current = {
      estimateId: serverEstimate.id,
      charges: chargesKey,
      items: itemsKey,
      usd: usdBrl || 0,
      eur: eurBrl || 0,
    };
    let cancelled = false;
    (async () => {
      try {
        if (charges && getBillingMultiplier && usdBrl) {
          await syncEstimateFromCharges(
            serverEstimate.id, companyId, charges,
            { usd_brl: usdBrl, eur_brl: eurBrl || 0 },
            getBillingMultiplier,
          );
        }
        if (quoteItems && quoteItems.length > 0) {
          await syncEstimateItemsFromQuote(
            serverEstimate.id, companyId,
            serverItems.map(i => ({
              id: i.id, quote_item_id: i.quote_item_id, nome: i.nome, ncm: i.ncm,
              peso: Number(i.peso), quantidade: Number(i.quantidade),
              vmcv_unit_usd: Number(i.vmcv_unit_usd),
              aliq_ii: Number(i.aliq_ii), aliq_ipi: Number(i.aliq_ipi),
              aliq_pis: Number(i.aliq_pis), aliq_cofins: Number(i.aliq_cofins),
              aliq_icms: Number(i.aliq_icms),
            })),
            (quoteItems || []).map((q: any) => ({
              id: q.id, commodity: q.commodity, ncm_code: q.ncm_code,
              weight_kg: q.weight_kg, packages: q.packages, container_qty: q.container_qty,
            })),
          );
        }
        if (!cancelled) invalidate();
      } catch (err) {
        console.error('auto-sync estimativa falhou', err);
        // libera o gate para tentar novamente na próxima mudança
        lastSyncedRef.current = null;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverEstimate?.id, editMode, chargesKey, itemsKey, usdBrl, eurBrl, companyId]);

  const guardStructural = (action: () => void) => {
    if (editMode) {
      toast.error('Saia do modo edição (Cancelar ou Salvar) antes de sincronizar.');
      return;
    }
    action();
  };

  if (isLoading) return <Card className="glass"><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>;

  if (!estimate) {
    return (
      <Card className="glass">
        <CardContent className="py-12 text-center space-y-4">
          <Calculator className="w-12 h-12 mx-auto text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Nenhuma estimativa de custo</h3>
            <p className="text-sm text-muted-foreground mt-1">Crie uma estimativa completa com valor no embarque, valor desembaraçado, II, IPI, PIS, COFINS, ICMS e despesas nacionais.</p>
          </div>
          <Button onClick={handleCreate} disabled={creating || !companyId}>
            <Plus className="w-4 h-4 mr-2" /> Criar Estimativa de Custo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const usdRate = estimate.usd_brl || 0;
  const totalUsd = breakdown?.total_usd || 0;
  const ro = !editMode; // read-only

  return (
    <div className="space-y-4">
      {/* Alertas de Dados Pendentes */}
      {!editMode && serverEstimate && (
        <div className="space-y-2">
          {(estimate.usd_brl || 0) <= 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm animate-pulse">
              <Info className="w-4 h-4" />
              <span><strong>Câmbio Pendente:</strong> O valor do dólar não foi definido. Atualize o câmbio ou edite manualmente para calcular os impostos em BRL.</span>
            </div>
          )}
          {items.some(it => (it.vmcv_unit_usd || 0) <= 0) && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <Info className="w-4 h-4" />
              <span><strong>Valores Unitários Pendentes:</strong> Alguns itens estão com valor US$ zerado. Sem o valor da mercadoria (VMCV), os impostos não podem ser calculados corretamente.</span>
            </div>
          )}
          {items.some(it => !it.nome || it.nome.trim() === '') && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              <Info className="w-4 h-4" />
              <span><strong>Identificação de Itens:</strong> Alguns itens não possuem descrição vinda da cotação. Preencha o nome do item para facilitar a identificação.</span>
            </div>
          )}
        </div>
      )}

      {breakdown?.rateio_igualitario_fallback && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <Info className="w-4 h-4" />
          <span><strong>Rateio igualitário aplicado:</strong> o denominador do método selecionado ({estimate?.rateio_metodo}) está zerado. Frete, seguro, acréscimos e deduções foram rateados igualmente entre os itens. Preencha VMCV/Peso/Quantidade para um rateio correto.</span>
        </div>
      )}

      {/* Cabeçalho */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Cabeçalho da Estimativa</CardTitle>
            {editMode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                Modo edição{hasDirty ? ` · ${dirtyCount} alteração${dirtyCount > 1 ? 'ões' : ''}` : ''}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/30" title="Alterações nas abas Taxas e Carga refletem aqui automaticamente. Salvar a estimativa reflete de volta nas taxas e itens vinculados.">
              <Link2 className="w-3 h-3" /> Espelho automático Taxas/Carga
            </span>
            <Button size="sm" variant="outline" onClick={() => guardStructural(refreshRates)}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar câmbio</Button>
            <Button size="sm" onClick={() => setPdfOpen(true)} disabled={editMode}><FileDown className="w-3.5 h-3.5 mr-1" /> PDF</Button>
            {serverEstimate && !editMode && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Descartar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1"><Label className="text-xs">Incoterm</Label><DebouncedInput disabled value={estimate.incoterm || ''} onCommit={() => {}} className="bg-muted/20" /></div>
          <div className="space-y-1"><Label className="text-xs">Trânsito</Label><DebouncedInput disabled value={estimate.transito || ''} onCommit={() => {}} placeholder="7 A 10 DIAS" className="bg-muted/20" /></div>
          <div className="space-y-1">
            <Label className="text-xs">Cia / Carrier</Label>
            <DebouncedInput 
              disabled 
              value={estimate.carrier || ''} 
              onCommit={() => {}}
              className="h-10 text-xs font-semibold bg-muted/20"
              placeholder="Preenchimento automático"
            />
          </div>
          <div className="space-y-1"><Label className="text-xs">Rota - Origem</Label><DebouncedInput disabled value={estimate.rota_origem || ''} onCommit={() => {}} className="bg-muted/20" /></div>
          <div className="space-y-1"><Label className="text-xs">Rota - Destino</Label><DebouncedInput disabled value={estimate.rota_destino || ''} onCommit={() => {}} className="bg-muted/20" /></div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              Data Fiscal {loadingRates && <RefreshCw className="w-3 h-3 animate-spin text-primary" />}
            </Label>
            <Input 
              type="date" 
              disabled={ro || loadingRates} 
              value={estimate.data_fiscal} 
              onChange={(e) => patchEstimate({ data_fiscal: e.target.value })} 
              className={loadingRates ? "opacity-50" : ""}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">Câmbio USD/BRL {(estimate.usd_brl || 0) <= 0 && <span className="text-amber-500 font-bold" title="Obrigatório">*</span>}</Label>
            <DebouncedInput 
              disabled={ro} 
              type="number" 
              step="0.0001" 
              value={estimate.usd_brl} 
              onCommit={(v) => patchEstimate({ usd_brl: v })} 
              className={(estimate.usd_brl || 0) <= 0 ? "border-amber-300 bg-amber-50/30" : ""}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              Taxa Siscomex (BRL)
              <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">Taxa fixa cobrada por DI. Entra na base do ICMS e compõe o custo total.</TooltipContent>
              </Tooltip></TooltipProvider>
            </Label>
            <DebouncedInput
              disabled={ro}
              type="number"
              step="0.01"
              value={(estimate as any).taxa_siscomex_brl || 0}
              onCommit={(v) => patchEstimate({ taxa_siscomex_brl: v } as any)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              AFRMM (BRL)
              <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">Adicional ao Frete p/ Renovação da Marinha Mercante — 8% sobre o frete marítimo + R$ 20,00. Só se aplica em modal marítimo.</TooltipContent>
              </Tooltip></TooltipProvider>
            </Label>
            <div className="flex gap-1">
              <DebouncedInput
                disabled={ro || !!(estimate as any).afrmm_auto}
                type="number"
                step="0.01"
                value={
                  (estimate as any).afrmm_auto && (quote?.transport_mode === 'ocean_fcl' || quote?.transport_mode === 'ocean_lcl')
                    ? Number((((estimate.frete_intl_usd || 0) * (estimate.usd_brl || 0) * 0.08) + 20).toFixed(2))
                    : ((estimate as any).afrmm_brl || 0)
                }
                onCommit={(v) => patchEstimate({ afrmm_brl: v } as any)}
              />
              <Button
                type="button"
                size="sm"
                variant={(estimate as any).afrmm_auto ? 'default' : 'outline'}
                disabled={ro}
                onClick={() => {
                  const next = !(estimate as any).afrmm_auto;
                  const patch: any = { afrmm_auto: next };
                  if (next && (quote?.transport_mode === 'ocean_fcl' || quote?.transport_mode === 'ocean_lcl')) {
                    patch.afrmm_brl = Number((((estimate.frete_intl_usd || 0) * (estimate.usd_brl || 0) * 0.08) + 20).toFixed(2));
                  }
                  patchEstimate(patch);
                }}
                title="Auto = 8% do frete marítimo + R$ 20,00"
                className="h-9 px-2 text-[10px] shrink-0"
              >
                Auto
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Itens */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">Itens (NCM e alíquotas)</CardTitle>
            <Badge variant="outline" className="text-[10px] font-normal" title="Alíquotas obtidas em tempo real do Simulador Oficial da Receita Federal (Siscomex)">
              Fonte: Receita Federal (Siscomex)
            </Badge>
          </div>
          <Button size="sm" variant="outline" onClick={addItem} disabled={ro}><Plus className="w-3.5 h-3.5 mr-1" /> Item</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[180px] h-8 py-0 align-middle whitespace-nowrap">Nome</TableHead>
                <TableHead className="min-w-[150px] h-8 py-0 align-middle whitespace-nowrap">NCM</TableHead>
                <TableHead className="min-w-[72px] h-8 py-0 align-middle whitespace-nowrap">Qtd</TableHead>
                <TableHead className="min-w-[100px] h-8 py-0 align-middle whitespace-nowrap">Peso (kg)</TableHead>
                <TableHead className="min-w-[120px] h-8 py-0 align-middle whitespace-nowrap" title="VMCV — preço FOB/EXW unitário">Valor unit. US$</TableHead>
                <TableHead className="min-w-[76px] h-8 py-0 align-middle text-right whitespace-nowrap">II %</TableHead>
                <TableHead className="min-w-[76px] h-8 py-0 align-middle text-right whitespace-nowrap">IPI %</TableHead>
                <TableHead className="min-w-[76px] h-8 py-0 align-middle text-right whitespace-nowrap">PIS %</TableHead>
                <TableHead className="min-w-[86px] h-8 py-0 align-middle text-right whitespace-nowrap">COFINS %</TableHead>
                <TableHead className="min-w-[76px] h-8 py-0 align-middle text-right whitespace-nowrap">ICMS %</TableHead>
                <TableHead className="w-40 h-8 py-0 align-middle text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-help">Destinação <Info className="w-3 h-3 text-muted-foreground" /></span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Define se o IPI entra na base de cálculo do ICMS.<br />
                        <strong>Consumo final</strong> (uso/imobilizado): IPI entra na base.<br />
                        <strong>Revenda / Industrialização</strong>: IPI fica fora da base (CF art. 155 §2º XI).
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right min-w-[110px] h-8 py-0 align-middle whitespace-nowrap">Total US$</TableHead>
                <TableHead className="w-8 h-8 py-0 align-middle"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => {
                const b = breakdown?.itemBreakdowns[idx];
                return (
                  <TableRow key={it.id}>
                    <TableCell className="p-1">
                      <DebouncedInput 
                        disabled={ro} 
                        className={`h-7 text-xs ${!it.nome ? "border-blue-300 bg-blue-50/30" : ""}`} 
                        value={it.nome} 
                        onCommit={(v) => patchItem(it.id, { nome: v })} 
                        placeholder="Nome"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <div className="flex gap-1">
                        <DebouncedInput 
                          disabled={ro} 
                          className="h-7 text-xs flex-1" 
                          value={it.ncm || ''} 
                          onCommit={(v) => patchItem(it.id, { ncm: v })} 
                          placeholder="NCM" 
                        />
                        {siscomexConfig?.is_active && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 shrink-0" 
                            onClick={() => handleNcmLookup(it.id, it.ncm || '')}
                            disabled={ro || ncmLookupLoading === it.id}
                          >
                            {ncmLookupLoading === it.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Search className="h-3 w-3 text-primary" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="p-1">
                      <DebouncedInput 
                        disabled={ro} 
                        className={`h-7 text-sm text-right tabular-nums ${(it.quantidade || 0) <= 0 ? "border-amber-300 bg-amber-50/30" : ""}`} 
                        type="number" 
                        value={it.quantidade} 
                        onCommit={(v) => patchItem(it.id, { quantidade: v })} 
                      />
                    </TableCell>
                    <TableCell className="p-1"><DebouncedInput disabled={ro} className="h-7 text-sm text-right tabular-nums" type="number" step="0.001" value={it.peso} onCommit={(v) => patchItem(it.id, { peso: v })} /></TableCell>
                    <TableCell className="p-1">
                      <DebouncedInput 
                        disabled={ro} 
                        className={`h-7 text-sm text-right tabular-nums ${(it.vmcv_unit_usd || 0) <= 0 ? "border-amber-400 bg-amber-50" : ""}`} 
                        type="number" 
                        step="0.01" 
                        value={it.vmcv_unit_usd} 
                        onCommit={(v) => patchItem(it.id, { vmcv_unit_usd: v })} 
                        placeholder="VMCV"
                      />
                    </TableCell>
                    <TableCell className="p-1"><DebouncedInput disabled={ro} className="h-7 px-2 text-right tabular-nums text-sm" type="number" step="0.01" value={it.aliq_ii} onCommit={(v) => patchItem(it.id, { aliq_ii: v })} /></TableCell>
                    <TableCell className="p-1"><DebouncedInput disabled={ro} className="h-7 px-2 text-right tabular-nums text-sm" type="number" step="0.01" value={it.aliq_ipi} onCommit={(v) => patchItem(it.id, { aliq_ipi: v })} /></TableCell>
                    <TableCell className="p-1"><DebouncedInput disabled={ro} className="h-7 px-2 text-right tabular-nums text-sm" type="number" step="0.01" value={it.aliq_pis} onCommit={(v) => patchItem(it.id, { aliq_pis: v })} /></TableCell>
                    <TableCell className="p-1">
                      <div className="flex items-center gap-1">
                        <DebouncedInput disabled={ro} className="h-7 px-2 text-right tabular-nums text-sm flex-1" type="number" step="0.01" value={it.aliq_cofins} onCommit={(v) => patchItem(it.id, { aliq_cofins: v })} />
                        <TooltipProvider><Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant={it.cofins_adicional ? 'default' : 'ghost'}
                              disabled={ro}
                              onClick={() => patchItem(it.id, { cofins_adicional: !it.cofins_adicional })}
                              className="h-7 px-1 text-[9px] shrink-0"
                            >+1%</Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">Adicional de 1% COFINS-Importação (Lei 12.844/13). Habilite para NCMs sujeitos ao adicional.</TooltipContent>
                        </Tooltip></TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell className="p-1"><DebouncedInput disabled={ro} className="h-7 px-2 text-right tabular-nums text-sm" type="number" step="0.01" value={it.aliq_icms} onCommit={(v) => patchItem(it.id, { aliq_icms: v })} /></TableCell>
                    <TableCell className="p-1 text-center">
                      {(() => {
                        const dest = it.destinacao
                          ?? (it.ipi_na_base_icms === false ? 'revenda_industrializacao' : 'consumo_final');
                        return (
                          <Select
                            value={dest}
                            disabled={ro}
                            onValueChange={(v) => patchItem(it.id, {
                              destinacao: v as 'consumo_final' | 'revenda_industrializacao',
                              ipi_na_base_icms: v === 'consumo_final',
                            })}
                          >
                            <SelectTrigger className="h-7 text-[10px] px-2"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="consumo_final">Consumo</SelectItem>
                              <SelectItem value="revenda_industrializacao">Revenda</SelectItem>
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="p-1 text-right font-mono text-xs">{fmtUSD(Number(it.vmcv_unit_usd || 0) * Number(it.quantidade || 0))}</TableCell>
                    <TableCell className="p-1"><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(it.id)} disabled={ro}><Trash2 className="w-3 h-3 text-destructive" /></Button></TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-6">Nenhum item. Adicione ou recrie a estimativa.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cards de Custos Agrupados em Linhas Únicas */}
      <div className="space-y-4">
        {/* Card Origem */}
        <Card className="glass">
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">1. Custos de Origem</CardTitle>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-[10px] uppercase h-fit">Origem</Badge>
              <div className="text-right">
                <span className="text-[9px] uppercase text-muted-foreground block leading-none">Subtotal em Reais</span>
                <span className="font-mono font-bold text-primary text-sm">
                  R$ {fmtBRL(expenses.filter(e => e.category === 'origin').reduce((acc, e) => acc + (e.valor_brl || 0), 0))}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-[10px] uppercase">Descrição</TableHead>
                  <TableHead className="h-8 text-[10px] uppercase text-right w-32">Moeda Orig.</TableHead>
                  <TableHead className="h-8 text-[10px] uppercase text-right w-32">Conversão BRL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.filter(e => e.category === 'origin').length > 0 ? (
                  expenses.filter(e => e.category === 'origin').map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="py-2 text-xs">{e.descricao}</TableCell>
                      <TableCell className="py-2 text-xs text-right font-mono">
                        {e.moeda_original || 'BRL'} {fmtBRL(e.valor_original || e.valor_brl)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-right font-mono">R$ {fmtBRL(e.valor_brl)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-[10px] text-muted-foreground italic">Sem custos de origem mapeados</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Card Frete */}
        <Card className="glass">
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">2. Custos de Frete Internacional</CardTitle>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-[10px] uppercase h-fit">Frete & Seguro</Badge>
              <div className="text-right">
                <span className="text-[9px] uppercase text-muted-foreground block leading-none">Subtotal em Reais</span>
                <span className="font-mono font-bold text-primary text-sm">R$ {fmtBRL(((estimate?.frete_intl_usd || 0) + (estimate?.seguro_intl_usd || 0)) * (estimate?.usd_brl || 0))}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">


            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-[10px] uppercase">Descrição</TableHead>
                  <TableHead className="h-8 text-[10px] uppercase text-right w-32">Moeda Orig.</TableHead>
                  <TableHead className="h-8 text-[10px] uppercase text-right w-32">Conversão BRL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.filter(e => e.category === 'freight').length > 0 ? (
                  expenses.filter(e => e.category === 'freight').map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="py-2 text-xs">{e.descricao}</TableCell>
                      <TableCell className="py-2 text-xs text-right font-mono">
                        {e.moeda_original || 'USD'} {fmtBRL(e.valor_original || (e.valor_brl / (estimate.usd_brl || 1)))}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-right font-mono">R$ {fmtBRL(e.valor_brl)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-[10px] text-muted-foreground italic">Sem custos de frete mapeados</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Card Destino */}
        <Card className="glass">
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">3. Custos de Destino / Nacionais</CardTitle>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-[10px] uppercase h-fit">Destino</Badge>
              <div className="text-right">
                <span className="text-[9px] uppercase text-muted-foreground block leading-none">Subtotal em Reais</span>
                <span className="font-mono font-bold text-primary text-sm">
                  R$ {fmtBRL(expenses.filter(e => e.category === 'destination' || e.category === 'local' || !e.category).reduce((acc, e) => acc + (e.valor_brl || 0), 0))}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-[10px] uppercase">Descrição</TableHead>
                  <TableHead className="h-8 text-[10px] uppercase text-right w-32">Moeda Orig.</TableHead>
                  <TableHead className="h-8 text-[10px] uppercase text-right w-32">Conversão BRL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.filter(e => e.category === 'destination' || e.category === 'local' || !e.category).length > 0 ? (
                  expenses.filter(e => e.category === 'destination' || e.category === 'local' || !e.category).map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="py-2 text-xs">{e.descricao}</TableCell>
                      <TableCell className="py-2 text-xs text-right font-mono">
                        {e.moeda_original || 'BRL'} {fmtBRL(e.valor_original || e.valor_brl)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-right font-mono">R$ {fmtBRL(e.valor_brl)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-[10px] text-muted-foreground italic">Sem custos de destino mapeados</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Card Impostos */}
        <Card className="glass">
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">4. Impostos Brasileiros (Estimado)</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">Calculado</Badge>
              <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {breakdown ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-2">
                <div className="border-r border-border/50 pr-4">
                  <span className="text-[9px] uppercase text-muted-foreground block">I.I.</span>
                  <span className="font-mono text-sm">R$ {fmtBRL(toBRL(breakdown.ii_usd, estimate?.usd_brl || 0))}</span>
                </div>
                <div className="border-r border-border/50 pr-4">
                  <span className="text-[9px] uppercase text-muted-foreground block">I.P.I.</span>
                  <span className="font-mono text-sm">R$ {fmtBRL(toBRL(breakdown.ipi_usd, estimate?.usd_brl || 0))}</span>
                </div>
                <div className="border-r border-border/50 pr-4">
                  <span className="text-[9px] uppercase text-muted-foreground block">P.I.S.</span>
                  <span className="font-mono text-sm">R$ {fmtBRL(toBRL(breakdown.pis_usd, estimate?.usd_brl || 0))}</span>
                </div>
                <div className="border-r border-border/50 pr-4">
                  <span className="text-[9px] uppercase text-muted-foreground block">COFINS</span>
                  <span className="font-mono text-sm">R$ {fmtBRL(toBRL(breakdown.cofins_usd, estimate?.usd_brl || 0))}</span>
                </div>
                <div className="border-r border-border/50 pr-4">
                  <span className="text-[9px] uppercase text-muted-foreground block text-blue-600">I.C.M.S.</span>
                  <span className="font-mono text-sm font-bold text-blue-600">R$ {fmtBRL(toBRL(breakdown.icms_usd, estimate?.usd_brl || 0))}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase text-muted-foreground block font-bold">Total Impostos</span>
                  <span className="font-mono text-base font-bold text-red-600">R$ {fmtBRL(toBRL(breakdown.subtotal_usd - breakdown.vmld_usd, estimate?.usd_brl || 0))}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground italic">Aguardando cálculo...</div>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Totalizador */}
      {breakdown && (
        <Card className="glass">
          <CardHeader><CardTitle className="text-base">Cálculo Consolidado</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead className="text-right">US$</TableHead>
                  <TableHead className="text-right">R$</TableHead>
                  <TableHead className="text-right w-20">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const rows: Array<[string, number, boolean, boolean, boolean]> = [
                    ['Valor da mercadoria (VMCV)', breakdown.vmcv_usd, true, false, true],
                  ];

                  // Adiciona despesas de origem mapeadas individualmente
                  expenses.filter(e => e.category === 'origin').forEach(e => {
                    rows.push([e.descricao, (e.valor_brl || 0) / (estimate.usd_brl || 1), false, false, true]);
                  });

                  rows.push(['Valor no embarque (VMLE)', breakdown.vmle_usd, true, false, true]);

                  // Adiciona despesas de frete/seguro mapeadas individualmente
                  expenses.filter(e => e.category === 'freight').forEach(e => {
                    rows.push([e.descricao, (e.valor_brl || 0) / (estimate.usd_brl || 1), false, false, true]);
                  });

                  rows.push(
                    ['Valor desembaraçado (VMLD)', breakdown.vmld_usd, true, false, true],
                    ['I.I.', breakdown.ii_usd, false, false, true],
                    ['I.P.I.', breakdown.ipi_usd, false, false, true],
                    ['P.I.S.', breakdown.pis_usd, false, false, true],
                    ['COFINS', breakdown.cofins_usd, false, false, true],
                    ['I.C.M.S.', breakdown.icms_usd, false, false, true],
                    ['SUBTOTAL', breakdown.subtotal_usd, true, false, true]
                  );

                  // Adiciona despesas nacionais/destino mapeadas individualmente
                  expenses.filter(e => e.category === 'destination' || e.category === 'local' || !e.category).forEach(e => {
                    rows.push([e.descricao, (e.valor_brl || 0) / (estimate.usd_brl || 1), false, false, true]);
                  });

                  rows.push(['TOTAL', breakdown.total_usd, true, false, true]);

                  return rows.map((row) => {
                    const [label, val, bold, isNotContracted, showPct] = row;
                    return (
                      <TableRow key={label} className={bold ? 'font-semibold bg-muted/30' : ''}>
                        <TableCell>{label}</TableCell>
                        {isNotContracted ? (
                          <>
                            <TableCell colSpan={2} className="text-right font-mono italic text-muted-foreground">Seguro não contratado</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-right font-mono">{fmtUSD(val)}</TableCell>
                            <TableCell className="text-right font-mono">{fmtBRL(val * usdRate)}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {showPct && Math.abs(val) > 0 ? pct(val, totalUsd).toFixed(2) : '—'}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <EstimatePdfDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        quote={quote}
        estimate={estimate as any}
        items={items as any}
        expenses={expenses as any}
        breakdown={breakdown}
        hasInsurance={hasInsurance}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem {dirtyCount} alteração{dirtyCount > 1 ? 'ões' : ''} não salva{dirtyCount > 1 ? 's' : ''}. Sair sem salvar irá descartá-las.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setCancelOpen(false); exitEdit(); }}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta estimativa?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os itens e despesas calculados serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || !serverEstimate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!serverEstimate) return;
                setDeleting(true);
                try {
                  await deleteEstimate(serverEstimate.id);
                  toast.success('Estimativa descartada');
                  setDeleteOpen(false);
                } catch (err: any) {
                  toast.error(err.message || 'Erro ao excluir estimativa');
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FloatingSaveButton
        visible={editMode}
        dirtyCount={dirtyCount}
        state={saveState}
        onSave={handleSave}
      />
    </div>
  );
});