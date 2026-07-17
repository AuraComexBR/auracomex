import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { groupByCurrency, formatCurrencyMap } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useHasAddon } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Save, Copy, FileText, Building2, Bell, CheckCircle, TrendingDown, TrendingUp, Send, MapPin, DollarSign, Activity, Package, Info, Users, ShoppingCart, Undo2, Calculator, Pencil, X, RotateCw } from 'lucide-react';
import { CostEstimateTab, type CostEstimateTabHandle } from './estimate/CostEstimateTab';
import { FloatingSaveButton } from './estimate/FloatingSaveButton';
import { QuotePdfPreviewDialog } from './QuotePdfPreviewDialog';
import { DebitNotesTab } from './DebitNotesTab';
import { ClientDebitNotesTab } from './ClientDebitNotesTab';
import { Receipt } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { ModeIcon } from '@/components/shared/ModeIcon';
import { PortSelect } from '@/components/shared/PortSelect';
import { ModeFields, emptyCargoItem, type CargoItem, calcItemCbm, calcItemWeight, calcChargeableWeight, getEffectiveVolume } from './ModeFields';
import { countryCodeToFlag, extractCountryFromPort } from '@/lib/countryFlag';
import { BenchmarkCard } from '@/components/shared/BenchmarkCard';
import { format } from 'date-fns';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { LogisticsTab } from '@/components/shipments/LogisticsTab';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { collectPercentUpdates, computePercentCharge, isCollectFeeName, isPercentCharge, type PercentChargeLike, type CollectFxRates } from '@/lib/collectFee';
import { PercentBaseDialog } from '@/components/quotes/PercentBaseDialog';

import { DocumentsTab } from '@/components/shipments/DocumentsTab';
import { ActivityTab } from '@/components/shipments/ActivityTab';

const LEGS = ['origin', 'freight', 'destination'] as const;
const CURRENCIES = ['USD', 'BRL', 'EUR', 'GBP', 'CNY'];
const BILLING_UNITS = ['fixed', 'per_wm', 'per_cw', 'per_container', 'per_container_20', 'per_container_40', 'per_bl', 'percent'] as const;

// Group container types by size (20' vs 40'). Reefer/OT/FR agrupam pelo prefixo.
function containerSize(type?: string | null): 20 | 40 | null {
  if (!type) return null;
  if (type.startsWith('20')) return 20;
  if (type.startsWith('40')) return 40;
  return null;
}
const INCOTERMS_BY_MODE: Record<string, string[]> = {
  ocean_fcl: ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
  ocean_lcl: ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
  air: ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
  road: ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
  multimodal: ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
};

function playBellSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(830, ctx.currentTime);
    osc.frequency.setValueAtTime(1050, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(830, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio not available
  }
}

function fireConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

interface Props {
  quoteId: string;
  onBack: () => void;
  /** When provided, renders in "shipment mode" with extra tabs */
  shipmentId?: string;
}

export function QuoteDetail({ quoteId, onBack, shipmentId }: Props) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { isFullAccess } = usePermissions();
  const queryClient = useQueryClient();
  const legacyEstimateFlag = !!(profile as any)?.estimateEnabled;
  const hasEstimateAddon = useHasAddon('cost_estimate_premium');
  // Mantém compat com a flag antiga da empresa; add-on comercial libera o mesmo módulo.
  const estimateEnabled = legacyEstimateFlag && hasEstimateAddon;
  const [reverting, setReverting] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const isShipmentMode = !!shipmentId;

  const [form, setForm] = useState({
    client_id: '',
    origin: '',
    transshipment: '',
    destination: '',
    transport_mode: 'ocean_fcl',
    currency: 'USD',
    valid_until: '',
    notes: '',
    status: 'quoting',
    incoterm: '',
    transit_time: '',
    free_time: '',
    payment_terms: '',
    proposal_notes: '',
    storage_fee_amount: '',
    storage_fee_currency: 'BRL',
    storage_fee_note: '',
  });
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([{ ...emptyCargoItem }]);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [chargeForm, setChargeForm] = useState({
    charge_catalog_id: '',
    description: '',
    charge_type: 'freight',
    leg: 'freight',
    amount: '',
    currency: 'USD',
    partner_id: '',
    billing_unit: 'fixed',
  });
  // Charge percentual sendo configurada (dialog aberto)
  const [percentDialogChargeId, setPercentDialogChargeId] = useState<string | null>(null);
  const [addingSide, setAddingSide] = useState<'buy' | 'sell' | 'both' | null>(null);
  const [addChargeOpen, setAddChargeOpen] = useState(false);
  const [bidirectional, setBidirectional] = useState(true);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [chargeDescSearch, setChargeDescSearch] = useState('');
  const [showChargeSuggestions, setShowChargeSuggestions] = useState(false);
  const chargeDescInputRef = useRef<HTMLInputElement>(null);
  const [commentText, setCommentText] = useState('');
  const [zeroChargeConfirm, setZeroChargeConfirm] = useState<{ side: 'buy' | 'sell'; amount: number } | null>(null);

  // Aba ativa controlada + integração com a aba Estimativa
  const [activeTab, setActiveTab] = useState<string>(isShipmentMode ? 'logistics' : 'general');
  const [estimateState, setEstimateState] = useState({ editMode: false, dirtyCount: 0, hasEstimate: false });
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [leaveTabOpen, setLeaveTabOpen] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const estimateRef = useRef<CostEstimateTabHandle>(null);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);

  // Handler para o botão voltar: se houver alterações não salvas, confirma antes.
  const handleBackClick = () => {
    if (hasChanges && form.status !== 'converted' && !isShipmentMode) {
      setBackConfirmOpen(true);
      return;
    }
    onBack();
  };

  const handleTabChange = (next: string) => {
    // Se estiver editando a estimativa e houver alterações não salvas
    if (estimateState.editMode && estimateState.dirtyCount > 0 && next !== 'estimate') {
      setPendingTab(next);
      setLeaveTabOpen(true);
      return;
    }
    
    // Se estiver editando a cotação (campos gerais, carga, etc) e houver alterações não salvas
    if (isEditing && hasChanges && next !== activeTab) {
      setPendingTab(next);
      setShowUnsavedConfirm(true);
      return;
    }

    setActiveTab(next);
  };

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote-detail', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, clients(name)')
        .eq('id', quoteId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ['quote-items', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const { data: charges = [] } = useQuery({
    queryKey: ['quote-charges', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_charges')
        .select('*, clients:partner_id(name)' as any)
        .eq('quote_id', quoteId)
        .order('created_at');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['charge-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_catalog' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-select'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name, partner_category').eq('type', 'client').order('name');
      return data || [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners-select'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name, type, partner_category').order('name');
      return data || [];
    },
  });

  // Quote-specific partners (only these appear in charge partner dropdown)
  const { data: quotePartners = [] } = useQuery({
    queryKey: ['quote-partners', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_partners' as any)
        .select('*, clients:client_id(id, name, type, partner_category)')
        .eq('quote_id', quoteId)
        .order('created_at');
      if (error) throw error;
      return data as any[];
    },
  });

  // Shipment data (only when in shipment mode)
  const { data: shipment } = useQuery({
    queryKey: ['shipment', shipmentId],
    enabled: isShipmentMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, clients(name)')
        .eq('id', shipmentId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  async function handleRevertToQuote() {
    if (!shipmentId) return;
    setReverting(true);
    try {
      await supabase.from('charge_lines').delete().eq('shipment_id', shipmentId);
      await supabase.from('shipment_partners').delete().eq('shipment_id', shipmentId);
      await supabase.from('documents').delete().eq('shipment_id', shipmentId);
      await supabase.from('activity_log').delete().eq('shipment_id', shipmentId);
      await supabase.from('shipment_audit_log').delete().eq('shipment_id', shipmentId);
      await supabase.from('charges').delete().eq('shipment_id', shipmentId);
      const { error: quoteErr } = await supabase.from('quotes').update({
        status: 'draft' as any,
        shipment_id: null,
      }).eq('id', quoteId);
      if (quoteErr) throw quoteErr;
      const { error: shipErr } = await supabase.from('shipments').delete().eq('id', shipmentId);
      if (shipErr) throw shipErr;
      toast.success(t('shipments.reverted_to_quote'));
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      onBack();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReverting(false);
      setShowRevertConfirm(false);
    }
  }

  useEffect(() => {
    if (quote) {
      setForm({
        client_id: quote.client_id || '',
        origin: quote.origin || '',
        transshipment: (quote as any).transshipment || '',
        destination: quote.destination || '',
        transport_mode: quote.transport_mode || 'ocean_fcl',
        currency: quote.currency || 'USD',
        valid_until: quote.valid_until ? format(new Date(quote.valid_until), 'yyyy-MM-dd') : '',
        notes: quote.notes || '',
        status: quote.status || 'draft',
        incoterm: (quote as any).incoterm || '',
        transit_time: (quote as any).transit_time?.toString() || '',
        free_time: (quote as any).free_time?.toString() || '',
        payment_terms: (quote as any).payment_terms || '',
        proposal_notes: (quote as any).proposal_notes || '',
        storage_fee_amount: (quote as any).storage_fee_amount != null ? String((quote as any).storage_fee_amount) : '',
        storage_fee_currency: (quote as any).storage_fee_currency || 'BRL',
        storage_fee_note: (quote as any).storage_fee_note || '',
      });
    }
  }, [quote]);

  useEffect(() => {
    if (items.length > 0) {
      setCargoItems(items.map((item: any) => ({
        id: item.id,
        container_type: item.container_type || '20GP',
        container_qty: item.container_qty || 1,
        container_number: item.container_number || '',
        weight_kg: item.weight_kg?.toString() || '',
        volume_cbm: item.volume_cbm?.toString() || '',
        chargeable_weight: item.chargeable_weight?.toString() || '',
        length_cm: item.length_cm?.toString() || '',
        width_cm: item.width_cm?.toString() || '',
        height_cm: item.height_cm?.toString() || '',
        packages: item.packages?.toString() || '',
        ncm_code: item.ncm_code || '',
        commodity: item.commodity || '',
        dangerous_goods: item.dangerous_goods || false,
        vehicle_type: item.vehicle_type || '',
        cargo_value: item.cargo_value?.toString() || '',
        cargo_value_currency: item.cargo_value_currency || 'USD',
        notes: item.notes || '',
      })));
    }
  }, [items]);

  const incoterms = useMemo(() => INCOTERMS_BY_MODE[form.transport_mode] || INCOTERMS_BY_MODE.ocean_fcl, [form.transport_mode]);

  // Cargo metrics for billing unit calculations
  const cargoMetrics = useMemo(() => {
    const totalWeight = cargoItems.reduce((s, i) => s + calcItemWeight(i), 0);
    const totalCbm = cargoItems.reduce((s, i) => s + getEffectiveVolume(i), 0);
    const totalChargeable = calcChargeableWeight(cargoItems, form.transport_mode);
    let totalContainers20 = 0;
    let totalContainers40 = 0;
    for (const i of cargoItems) {
      const qty = Number((i as any).container_qty) || 1;
      const size = containerSize((i as any).container_type);
      if (size === 20) totalContainers20 += qty;
      else if (size === 40) totalContainers40 += qty;
    }
    const totalContainers = totalContainers20 + totalContainers40;
    return { totalWeight, totalCbm, totalChargeable, totalContainers, totalContainers20, totalContainers40 };
  }, [cargoItems, form.transport_mode]);

  // Check if form or cargo items have changed compared to original quote/items
  const hasChanges = useMemo(() => {
    if (!quote) return false;
    
    const formChanged = 
      form.client_id !== (quote.client_id || '') ||
      form.origin !== (quote.origin || '') ||
      (form.transshipment || '') !== ((quote as any).transshipment || '') ||
      form.destination !== (quote.destination || '') ||
      form.transport_mode !== (quote.transport_mode || 'ocean_fcl') ||
      form.currency !== (quote.currency || 'USD') ||
      form.status !== (quote.status || 'draft') ||
      (form.incoterm || '') !== ((quote as any).incoterm || '') ||
      (form.transit_time || '') !== ((quote as any).transit_time?.toString() || '') ||
      (form.free_time || '') !== ((quote as any).free_time?.toString() || '') ||
      (form.notes || '') !== (quote.notes || '') ||
      (form.payment_terms || '') !== ((quote as any).payment_terms || '') ||
      (form.proposal_notes || '') !== ((quote as any).proposal_notes || '') ||
      (form.storage_fee_amount || '') !== ((quote as any).storage_fee_amount != null ? String((quote as any).storage_fee_amount) : '') ||
      (form.storage_fee_currency || 'BRL') !== ((quote as any).storage_fee_currency || 'BRL') ||
      (form.storage_fee_note || '') !== ((quote as any).storage_fee_note || '');

    if (formChanged) return true;

    if (cargoItems.length !== items.length) return true;

    for (let i = 0; i < cargoItems.length; i++) {
      const ci = cargoItems[i];
      const oi = items[i];
      if (!oi) return true;
      if (
        (ci.container_type || '') !== (oi.container_type || '') ||
        (ci.container_qty || 0) !== (oi.container_qty || 0) ||
        (ci.container_number || '') !== ((oi as any).container_number || '') ||
        (ci.commodity || '') !== (oi.commodity || '') ||
        parseFloat(ci.weight_kg || '0') !== (oi.weight_kg || 0) ||
        parseFloat(ci.volume_cbm || '0') !== (oi.volume_cbm || 0) ||
        parseFloat(ci.chargeable_weight || '0') !== (oi.chargeable_weight || 0) ||
        (ci.ncm_code || '') !== (oi.ncm_code || '') ||
        parseFloat(ci.length_cm || '0') !== ((oi as any).length_cm || 0) ||
        parseFloat(ci.width_cm || '0') !== ((oi as any).width_cm || 0) ||
        parseFloat(ci.height_cm || '0') !== ((oi as any).height_cm || 0) ||
        parseInt(ci.packages || '0') !== ((oi as any).packages || 0) ||
        !!ci.dangerous_goods !== !!(oi as any).dangerous_goods ||
        (ci.vehicle_type || '') !== ((oi as any).vehicle_type || '') ||
        parseFloat(ci.cargo_value || '0') !== ((oi as any).cargo_value || 0) ||
        (ci.cargo_value_currency || 'USD') !== ((oi as any).cargo_value_currency || 'USD') ||
        (ci.notes || '') !== ((oi as any).notes || '')
      ) return true;
    }

    return false;
  }, [form, cargoItems, quote, items]);

  const dirtyCount = hasChanges ? 1 : 0;

  // Se a aba Estimativa estiver desabilitada para a empresa, volta para 'general'.
  useEffect(() => {
    if (!estimateEnabled && activeTab === 'estimate') {
      setActiveTab(isShipmentMode ? 'logistics' : 'general');
    }
  }, [estimateEnabled, activeTab, isShipmentMode]);

  // Aviso nativo do navegador ao recarregar/fechar com alterações não salvas.
  useEffect(() => {
    if (!hasChanges || form.status === 'converted' || isShipmentMode) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges, form.status, isShipmentMode]);

  // Helper to get billing multiplier for a charge
  function getChargeMultiplier(billingUnit: string): number {
    switch (billingUnit) {
      case 'per_cw': return cargoMetrics.totalChargeable;
      case 'per_ton': return cargoMetrics.totalWeight / 1000;
      case 'per_cbm': return cargoMetrics.totalCbm;
      case 'per_wm': return Math.max(cargoMetrics.totalWeight / 1000, cargoMetrics.totalCbm);
      case 'per_container': return cargoMetrics.totalContainers;
      case 'per_container_20': return cargoMetrics.totalContainers20;
      case 'per_container_40': return cargoMetrics.totalContainers40;
      case 'per_bl': return 1;
      default: return 1; // 'fixed'
    }
  }

  // Show charges including zero amounts (1.6)
  const buyCharges = charges.filter((c: any) => c.buy_amount != null && c.buy_amount >= 0 && (c.buy_amount > 0 || c.sell_amount === 0 || c.sell_amount == null));
  const sellCharges = charges.filter((c: any) => c.sell_amount != null && c.sell_amount >= 0 && (c.sell_amount > 0 || c.buy_amount === 0 || c.buy_amount == null));

  // Helper: check if a charge is a discount (DESCONTO in description)
  const isDiscount = (c: any) => (c.description || '').toUpperCase().includes('DESCONTO');

  // Currency-grouped totals (accounting for billing unit multipliers and DESCONTO)
  const buyByCurrency = groupByCurrency(charges, (c: any) => c.currency || 'USD', (c: any) => {
    const val = c.billing_unit === 'percent'
      ? (Number(c.computed_buy_amount) || 0)
      : (Number(c.buy_amount) || 0) * getChargeMultiplier(c.billing_unit || 'fixed');
    return isDiscount(c) ? -val : val;
  });
  const sellByCurrency = groupByCurrency(charges, (c: any) => c.currency || 'USD', (c: any) => {
    const val = c.billing_unit === 'percent'
      ? (Number(c.computed_sell_amount) || 0)
      : (Number(c.sell_amount) || 0) * getChargeMultiplier(c.billing_unit || 'fixed');
    return isDiscount(c) ? -val : val;
  });
  const allCurrencies = [...new Set([...Object.keys(buyByCurrency), ...Object.keys(sellByCurrency)])];
  const profitByCurrency: Record<string, number> = {};
  const marginByCurrency: Record<string, number> = {};
  allCurrencies.forEach((cur) => {
    const sell = sellByCurrency[cur] || 0;
    const buy = buyByCurrency[cur] || 0;
    profitByCurrency[cur] = sell - buy;
    marginByCurrency[cur] = sell > 0 ? ((sell - buy) / sell) * 100 : 0;
  });

  // BRL consolidation using daily FX rate - Manual update only
  const { usdBrl: latestUsdBrl, eurBrl: latestEurBrl, loading: ratesLoading, refetch: refetchRates } = useExchangeRate();
  const [usdBrl, setUsdBrl] = useState<number | null>(null);
  const [eurBrl, setEurBrl] = useState<number | null>(null);

  useEffect(() => {
    if (latestUsdBrl && usdBrl === null) setUsdBrl(latestUsdBrl);
    if (latestEurBrl && eurBrl === null) setEurBrl(latestEurBrl);
  }, [latestUsdBrl, latestEurBrl]);

  const fxRates: Record<string, number | null> = {
    BRL: 1,
    USD: usdBrl,
    EUR: eurBrl,
  };
  const convertibleCurrencies = new Set(['BRL', 'USD', 'EUR']);
  const toBRL = (amount: number, currency: string): number | null => {
    const rate = fxRates[currency];
    if (rate == null) return null;
    return amount * rate;
  };
  const sumToBRL = (map: Record<string, number>) => {
    let total = 0;
    let unsupported = 0;
    for (const [cur, val] of Object.entries(map)) {
      const conv = toBRL(val, cur);
      if (conv == null) unsupported += 1; else total += conv;
    }
    return { total, unsupported };
  };
  const buyBRL = sumToBRL(buyByCurrency);
  const sellBRL = sumToBRL(sellByCurrency);
  const profitBRLValue = sellBRL.total - buyBRL.total;
  const marginBRLValue = sellBRL.total > 0 ? (profitBRLValue / sellBRL.total) * 100 : 0;
  const unsupportedCurrencies = [...new Set([
    ...Object.keys(buyByCurrency).filter(c => !convertibleCurrencies.has(c)),
    ...Object.keys(sellByCurrency).filter(c => !convertibleCurrencies.has(c)),
  ])];
  const ratesAvailable = usdBrl != null && eurBrl != null;
  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtMoney = (cur: string, v: number) => `${cur} ${v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const detailLine = (map: Record<string, number>) => {
    const entries = Object.entries(map).filter(([, v]) => v !== 0);
    if (entries.length === 0) return '—';
    return entries.map(([cur, v]) => fmtMoney(cur, v)).join(' + ');
  };

  // Legacy totals for backward compat (syncTotals, BenchmarkCard) - with DESCONTO support
  const totalBuy = charges.reduce((s: number, c: any) => {
    const val = c.buy_amount || 0;
    return s + (isDiscount(c) ? -val : val);
  }, 0);
  const totalSell = charges.reduce((s: number, c: any) => {
    const val = c.sell_amount || 0;
    return s + (isDiscount(c) ? -val : val);
  }, 0);
  const profit = totalSell - totalBuy;
  const margin = totalSell > 0 ? (profit / totalSell) * 100 : 0;

  const legLabels: Record<string, string> = {
    origin: t('quotes.leg_origin'),
    freight: t('quotes.leg_freight'),
    destination: t('quotes.leg_destination'),
  };

  const legColors: Record<string, string> = {
    origin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    freight: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    destination: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  };

  const legBorderLeftColors: Record<string, string> = {
    origin: 'border-l-blue-500',
    freight: 'border-l-emerald-500',
    destination: 'border-l-amber-500',
  };

  // Country flags derived from origin/destination
  const originFlag = countryCodeToFlag(extractCountryFromPort(form.origin));
  const destFlag = countryCodeToFlag(extractCountryFromPort(form.destination));

  async function syncTotals() {
    const { data } = await supabase
      .from('quote_charges')
      .select('buy_amount, sell_amount')
      .eq('quote_id', quoteId);
    if (!data) return;
    const tb = data.reduce((s, c) => s + (c.buy_amount || 0), 0);
    const ts = data.reduce((s, c) => s + (c.sell_amount || 0), 0);
    await supabase.from('quotes').update({ total_buy: tb, total_sell: ts } as any).eq('id', quoteId);
  }

  // Recalcula todas as taxas percentuais (Collect Fee etc.) da cotação após qualquer alteração
  // em charges base. Persiste os novos buy_amount/sell_amount.
  async function recalcPercentCharges() {
    const { data } = await supabase
      .from('quote_charges')
      .select('id, description, currency, billing_unit, buy_amount, sell_amount, percent_base_charge_ids, computed_buy_amount, computed_sell_amount')
      .eq('quote_id', quoteId);
    if (!data || data.length === 0) return;
    const fx: CollectFxRates = { USD: usdBrl, BRL: 1, EUR: eurBrl };
    const updates = collectPercentUpdates(data as unknown as PercentChargeLike[], fx, getChargeMultiplier);
    for (const u of updates) {
      await supabase.from('quote_charges').update({ computed_buy_amount: u.computed_buy_amount, computed_sell_amount: u.computed_sell_amount } as any).eq('id', u.id);
    }
  }

  const handleCancelEdition = useCallback(() => {
    if (quote) {
      setForm({
        client_id: quote.client_id || '',
        origin: quote.origin || '',
        transshipment: (quote as any).transshipment || '',
        destination: quote.destination || '',
        transport_mode: quote.transport_mode || 'ocean_fcl',
        currency: quote.currency || 'USD',
        valid_until: quote.valid_until ? format(new Date(quote.valid_until), 'yyyy-MM-dd') : '',
        notes: quote.notes || '',
        status: quote.status || 'draft',
        incoterm: (quote as any).incoterm || '',
        transit_time: (quote as any).transit_time?.toString() || '',
        free_time: (quote as any).free_time?.toString() || '',
        payment_terms: (quote as any).payment_terms || '',
        proposal_notes: (quote as any).proposal_notes || '',
        storage_fee_amount: (quote as any).storage_fee_amount != null ? String((quote as any).storage_fee_amount) : '',
        storage_fee_currency: (quote as any).storage_fee_currency || 'BRL',
        storage_fee_note: (quote as any).storage_fee_note || '',
      });
    }
    if (items.length > 0) {
      setCargoItems(items.map((item: any) => ({
        id: item.id,
        container_type: item.container_type || '20GP',
        container_qty: item.container_qty || 1,
        container_number: item.container_number || '',
        weight_kg: item.weight_kg?.toString() || '',
        volume_cbm: item.volume_cbm?.toString() || '',
        chargeable_weight: item.chargeable_weight?.toString() || '',
        length_cm: item.length_cm?.toString() || '',
        width_cm: item.width_cm?.toString() || '',
        height_cm: item.height_cm?.toString() || '',
        packages: item.packages?.toString() || '',
        ncm_code: item.ncm_code || '',
        commodity: item.commodity || '',
        dangerous_goods: item.dangerous_goods || false,
        vehicle_type: item.vehicle_type || '',
        cargo_value: item.cargo_value?.toString() || '',
        cargo_value_currency: item.cargo_value_currency || 'USD',
        notes: item.notes || '',
      })));
    } else {
      setCargoItems([{ ...emptyCargoItem }]);
    }
    setIsEditing(false);
  }, [quote, items]);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    try {
      setSaveState('saving');
      const { error } = await supabase.from('quotes').update({
        client_id: form.client_id || null,
        origin: form.origin || null,
        transshipment: form.transshipment || null,
        destination: form.destination || null,
        transport_mode: form.transport_mode as any,
        currency: form.currency,
        valid_until: form.valid_until || null,
        notes: form.notes || null,
        status: form.status as any,
        incoterm: (form.incoterm && form.incoterm !== 'NONE') ? form.incoterm : null,
        transit_time: parseInt(form.transit_time) || null,
        free_time: parseInt(form.free_time) || null,
        payment_terms: form.payment_terms || null,
        proposal_notes: form.proposal_notes || null,
        storage_fee_amount: form.storage_fee_amount ? parseFloat(form.storage_fee_amount) : null,
        storage_fee_currency: form.storage_fee_amount ? (form.storage_fee_currency || 'BRL') : null,
        storage_fee_note: form.storage_fee_note || null,
      } as any).eq('id', quoteId);
      if (error) throw error;

      const seenItemIds = new Set<string>();
      const itemPayload = (item: CargoItem) => ({
          quote_id: quoteId,
          company_id: profile.company_id,
          container_type: item.container_type || null,
          container_qty: item.container_qty || null,
          container_number: item.container_number || null,
          weight_kg: parseFloat(item.weight_kg) || null,
          volume_cbm: parseFloat(item.volume_cbm) || null,
          chargeable_weight: parseFloat(item.chargeable_weight) || null,
          length_cm: parseFloat(item.length_cm) || null,
          width_cm: parseFloat(item.width_cm) || null,
          height_cm: parseFloat(item.height_cm) || null,
          packages: parseInt(item.packages) || null,
          ncm_code: item.ncm_code || null,
          commodity: item.commodity || null,
          dangerous_goods: item.dangerous_goods,
          vehicle_type: item.vehicle_type || null,
          cargo_value: parseFloat(item.cargo_value) || null,
          cargo_value_currency: item.cargo_value_currency || 'USD',
          notes: item.notes || null,
        });
      for (const item of cargoItems) {
        if (item.id) {
          seenItemIds.add(item.id);
          const { error: itemErr } = await supabase
            .from('quote_items' as any)
            .update(itemPayload(item))
            .eq('id', item.id)
            .eq('quote_id', quoteId);
          if (itemErr) throw itemErr;
        } else {
          const { data: insertedItem, error: itemErr } = await supabase
            .from('quote_items' as any)
            .insert(itemPayload(item))
            .select('id')
            .single();
          if (itemErr) throw itemErr;
          const insertedId = (insertedItem as any)?.id;
          if (insertedId) seenItemIds.add(insertedId);
        }
      }
      if (seenItemIds.size > 0) {
        await supabase.from('quote_items').delete().eq('quote_id', quoteId).not('id', 'in', `(${Array.from(seenItemIds).join(',')})`);
      } else {
        await supabase.from('quote_items').delete().eq('quote_id', quoteId);
      }

      await syncTotals();
      queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quote-items', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['cost-estimate', quoteId] });
      toast.success(t('quotes.changes_saved'));
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message);
      setSaveState('idle');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!profile) return;
    // Guard: prevent double-conversion
    if (form.status === 'converted' || form.status === 'approved' || quote?.shipment_id) {
      toast.info(t('quotes.already_converted') || 'Esta cotação já foi convertida em embarque.');
      return;
    }
    try {
      // Sync totals first
      await syncTotals();

      // Use the quote number as the shipment reference (unified numbering)
      const refNumber = quote?.quote_number || `SHP-${Date.now().toString(36).toUpperCase()}`;

      // Fetch port metadata for origin and destination
      let originCity = '';
      let originCountry = '';
      let destCity = '';
      let destCountry = '';

      if (form.origin) {
        const { data: originPort } = await supabase
          .from('ports')
          .select('city, country_name, country_code')
          .eq('code', form.origin)
          .maybeSingle();
        if (originPort) {
          originCity = originPort.city || '';
          originCountry = originPort.country_name || originPort.country_code || '';
        }
      }
      if (form.destination) {
        const { data: destPort } = await supabase
          .from('ports')
          .select('city, country_name, country_code')
          .eq('code', form.destination)
          .maybeSingle();
        if (destPort) {
          destCity = destPort.city || '';
          destCountry = destPort.country_name || destPort.country_code || '';
        }
      }

      // Create shipment from quote data
      const { data: newShipment, error: shipError } = await supabase.from('shipments').insert({
        company_id: profile.company_id,
        reference_number: refNumber,
        client_id: form.client_id || null,
        transport_mode: form.transport_mode as any,
        origin_port: form.origin || null,
        origin_city: originCity || null,
        origin_country: originCountry || null,
        destination_port: form.destination || null,
        destination_city: destCity || null,
        destination_country: destCountry || null,
        status: 'approved' as any,
        created_by: profile.user_id,
      }).select('id').single();
      if (shipError) throw shipError;

      // Copy quote_charges to charge_lines
      if (charges.length > 0) {
        const chargeLinesToInsert: any[] = [];
        for (const qc of charges) {
          if ((qc.buy_amount || 0) > 0) {
            chargeLinesToInsert.push({
              shipment_id: newShipment.id,
              company_id: profile.company_id,
              direction: 'payable' as const,
              description: qc.description,
              charge_type: qc.charge_type || 'freight',
              amount: qc.buy_amount,
              currency: qc.currency || 'USD',
              partner_id: qc.partner_id || null,
              exchange_rate: 1,
              tax_rate: 0,
            });
          }
          if ((qc.sell_amount || 0) > 0) {
            chargeLinesToInsert.push({
              shipment_id: newShipment.id,
              company_id: profile.company_id,
              direction: 'receivable' as const,
              description: qc.description,
              charge_type: qc.charge_type || 'freight',
              amount: qc.sell_amount,
              currency: qc.currency || 'USD',
              partner_id: qc.partner_id || null,
              exchange_rate: 1,
              tax_rate: 0,
            });
          }
        }
        if (chargeLinesToInsert.length > 0) {
          await supabase.from('charge_lines').insert(chargeLinesToInsert as any);
        }
      }

      // Copy quote_partners to shipment_partners
      if (quotePartners.length > 0) {
        const spInsert = quotePartners.map((qp: any) => ({
          shipment_id: newShipment.id,
          company_id: profile.company_id,
          client_id: qp.client_id || qp.clients?.id,
        })).filter((sp: any) => sp.client_id);
        if (spInsert.length > 0) {
          await supabase.from('shipment_partners').insert(spInsert as any);
        }
      }

      // Update quote: link shipment and set status to converted
      const { error } = await supabase.from('quotes').update({
        status: 'converted' as any,
        shipment_id: newShipment.id,
      }).eq('id', quoteId);
      if (error) throw error;

      setForm((f) => ({ ...f, status: 'converted' }));
      queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });

      // Celebration!
      playBellSound();
      fireConfetti();
      toast.success(t('quotes.converted_to_shipment'));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleAddCharge(side: 'buy' | 'sell' | 'both', opts?: { keepOpen?: boolean }) {
    if (!profile || !chargeForm.description.trim()) return;
    if (!chargeForm.partner_id) {
      toast.error(t('financial.partner_required') || 'Selecione uma empresa');
      return;
    }

    const amount = parseFloat(chargeForm.amount) || 0;
    
    // 1.6 - Zero charge confirmation via in-app dialog
    if (amount === 0) {
      setZeroChargeConfirm({ side: side === 'both' ? 'buy' : side, amount });
      return;
    }

    await executeAddCharge(side, amount, opts);
  }

  async function executeAddCharge(side: 'buy' | 'sell' | 'both', amount: number, opts?: { keepOpen?: boolean }) {
    if (!profile || !chargeForm.description.trim()) return;
    setAddingSide(side);
    try {
      const isPercent = chargeForm.billing_unit === 'percent';
      const insertRow: any = {
        quote_id: quoteId,
        company_id: profile.company_id,
        description: chargeForm.description.trim(),
        charge_type: chargeForm.charge_type,
        leg: chargeForm.leg,
        charge_catalog_id: chargeForm.charge_catalog_id || null,
        buy_amount: side === 'buy' || side === 'both' ? amount : 0,
        sell_amount: side === 'sell' || side === 'both' ? amount : 0,
        currency: isPercent ? 'USD' : chargeForm.currency,
        partner_id: chargeForm.partner_id || null,
        billing_unit: chargeForm.billing_unit,
      };
      if (isPercent) {
        insertRow.percent_base_charge_ids = [];
        insertRow.computed_buy_amount = 0;
        insertRow.computed_sell_amount = 0;
      }
      const { data: inserted, error } = await supabase.from('quote_charges').insert(insertRow as any).select('id').single();
      if (error) throw error;

      setChargeForm({ charge_catalog_id: '', description: '', charge_type: 'freight', leg: 'freight', amount: '', currency: 'USD', partner_id: '', billing_unit: 'fixed' });
      setChargeDescSearch('');
      await recalcPercentCharges();
      await syncTotals();
      queryClient.invalidateQueries({ queryKey: ['quote-charges', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['cost-estimate', quoteId] });
      toast.success(t('financial.charge_added'));
      if (isPercent && inserted?.id) {
        // Abre o dialog para selecionar as taxas base logo após criar
        setPercentDialogChargeId(inserted.id as string);
        setAddChargeOpen(false);
      } else if (!opts?.keepOpen) {
        setAddChargeOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingSide(null);
    }
  }

  async function handleDeleteCharge(chargeId: string) {
    try {
      const { error } = await supabase.from('quote_charges').delete().eq('id', chargeId);
      if (error) throw error;
      await recalcPercentCharges();
      await syncTotals();
      queryClient.invalidateQueries({ queryKey: ['quote-charges', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['cost-estimate', quoteId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleUpdateCharge(chargeId: string, updates: Record<string, any>) {
    try {
      const { error } = await supabase.from('quote_charges').update(updates as any).eq('id', chargeId);
      if (error) throw error;
      await recalcPercentCharges();
      await syncTotals();
      queryClient.invalidateQueries({ queryKey: ['quote-charges', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['cost-estimate', quoteId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleCloneCharge(charge: any, newAmount: number, targetSide: 'buy' | 'sell', partnerId?: string) {
    if (!profile) return;
    try {
      const { error } = await supabase.from('quote_charges').insert({
        quote_id: quoteId,
        company_id: profile.company_id,
        description: charge.description,
        charge_type: charge.charge_type,
        leg: charge.leg,
        charge_catalog_id: charge.charge_catalog_id,
        buy_amount: targetSide === 'buy' ? newAmount : 0,
        sell_amount: targetSide === 'sell' ? newAmount : 0,
        currency: charge.currency,
        partner_id: partnerId ?? charge.partner_id ?? null,
        billing_unit: charge.billing_unit || 'fixed',
      } as any);
      if (error) throw error;
      await recalcPercentCharges();
      await syncTotals();
      queryClient.invalidateQueries({ queryKey: ['quote-charges', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['cost-estimate', quoteId] });
      toast.success(t('financial.charge_added'));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (isLoading || !quote) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">{t('common.loading')}</div>;
  }

  // Financial visibility: only process owner (created_by) or admin can see/edit financial data
  const isProcessOwner = profile?.user_id === quote.created_by;
  const canSeeFinancials = isFullAccess || isProcessOwner;
  const canEditCharges = !isShipmentMode || isFullAccess || isProcessOwner;

  const showPort = form.transport_mode !== 'road';

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Zero charge confirmation dialog */}
      <AlertDialog open={!!zeroChargeConfirm} onOpenChange={(open) => { if (!open) setZeroChargeConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('quotes.zero_charge_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {chargeForm.description || ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setZeroChargeConfirm(null)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (zeroChargeConfirm) {
                executeAddCharge(zeroChargeConfirm.side, zeroChargeConfirm.amount);
              }
              setZeroChargeConfirm(null);
            }}>{t('common.confirm') || 'Confirmar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Revert confirmation dialog (shipment mode only) */}
      {showRevertConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold">{t('shipments.revert_confirm_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('shipments.revert_confirm_desc')}</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowRevertConfirm(false)} disabled={reverting}>
                  {t('common.cancel')}
                </Button>
                <Button variant="destructive" onClick={handleRevertToQuote} disabled={reverting}>
                  {reverting ? '...' : t('shipments.revert_to_quote')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBackClick}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-mono">{quote.quote_number}</h1>
            {isShipmentMode && shipment && <StatusBadge status={shipment.status} />}
            {!isShipmentMode && <StatusBadge status={form.status} />}
            <ModeIcon mode={form.transport_mode} showLabel />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.find((c: any) => c.id === form.client_id)?.name || '-'} ·{' '}
            {originFlag && <span className="text-base mr-1">{originFlag}</span>}
            {form.origin || '?'} →{' '}
            {destFlag && <span className="text-base mr-1">{destFlag}</span>}
            {form.destination || '?'}
          </p>
        </div>
        {!isShipmentMode && form.status === 'converted' && (
          <div className="flex items-center gap-1.5 text-green-600 font-semibold text-sm">
            <CheckCircle className="w-4 h-4" />
            {t('quote_status.converted')}
          </div>
        )}

        {!isShipmentMode && 
         form.status !== 'converted' && 
         activeTab !== 'estimate' && 
         activeTab !== 'documents' && 
         activeTab !== 'comments' && activeTab !== 'charges' && (
          <Button
            variant={isEditing ? "outline" : "default"}
            onClick={() => {
              if (isEditing) {
                handleCancelEdition();
              } else {
                setIsEditing(true);
              }
            }}
            className="gap-1.5"
          >
            {isEditing ? (
              <><X className="w-4 h-4" /> Cancelar Edição</>
            ) : (
              <><Pencil className="w-4 h-4" /> Editar Cotação</>
            )}
          </Button>
        )}
        {activeTab === 'estimate' ? (
          estimateState.editMode ? (
            <Button variant="outline" onClick={() => estimateRef.current?.requestCancel()}>
              <X className="w-4 h-4 mr-1" />
              Cancelar Edição
              {estimateState.dirtyCount > 0 && (
                <span className="ml-2 text-xs opacity-80">({estimateState.dirtyCount})</span>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => estimateRef.current?.enterEdit()}
              disabled={!estimateState.hasEstimate}
              title={!estimateState.hasEstimate ? 'Crie a estimativa primeiro' : 'Editar Estimativa'}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Editar Estimativa
            </Button>
          )
        ) : null}
      </div>

      {/* KPI Cards - hidden for non-owner in shipment mode */}
      {canSeeFinancials && (
      <div className="space-y-2">
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          {ratesLoading && <span>Carregando câmbio…</span>}
          {!ratesLoading && ratesAvailable && (
            <div className="flex items-center gap-2">
              <span className="font-mono">
                Câmbio: USD {usdBrl!.toFixed(4)} · EUR {eurBrl!.toFixed(4)}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={() => {
                  refetchRates().then((res) => {
                    if (res.data) {
                      setUsdBrl(res.data.usdBrl);
                      setEurBrl(res.data.eurBrl);
                      toast.success(t('common.updated'));
                    }
                  });
                }}
                disabled={ratesLoading}
              >
                <RotateCw className={cn("h-3 w-3", ratesLoading && "animate-spin")} />
              </Button>
            </div>
          )}
          {!ratesLoading && !ratesAvailable && (
            <span className="text-amber-500">Câmbio indisponível — exibindo por moeda</span>
          )}
          {unsupportedCurrencies.length > 0 && ratesAvailable && (
            <span className="text-amber-500">
              · {unsupportedCurrencies.length} moeda(s) não convertida(s): {unsupportedCurrencies.join(', ')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{t('quotes.total_buy')}</p>
              {ratesAvailable ? (
                <>
                  <div className="text-lg font-bold font-mono">{fmtBRL(buyBRL.total)}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1 truncate" title={detailLine(buyByCurrency)}>
                    {detailLine(buyByCurrency)}
                  </div>
                </>
              ) : (
                <div className="text-lg font-bold font-mono">{formatCurrencyMap(buyByCurrency)}</div>
              )}
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{t('quotes.total_sell')}</p>
              {ratesAvailable ? (
                <>
                  <div className="text-lg font-bold font-mono">{fmtBRL(sellBRL.total)}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1 truncate" title={detailLine(sellByCurrency)}>
                    {detailLine(sellByCurrency)}
                  </div>
                </>
              ) : (
                <div className="text-lg font-bold font-mono">{formatCurrencyMap(sellByCurrency)}</div>
              )}
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{t('financial.profit')}</p>
              {ratesAvailable ? (
                <>
                  <div className={`text-lg font-bold font-mono ${profitBRLValue >= 0 ? 'text-status-completed' : 'text-status-urgent'}`}>
                    {fmtBRL(profitBRLValue)}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
                    {Object.keys(profitByCurrency).length === 0 ? '—' : Object.entries(profitByCurrency).map(([cur, v]) => fmtMoney(cur, v)).join(' + ')}
                  </div>
                </>
              ) : (
                <div className="text-lg font-bold font-mono">
                  {Object.entries(profitByCurrency).map(([cur, val]) => (
                    <span key={cur} className={`block ${val >= 0 ? 'text-status-completed' : 'text-status-urgent'}`}>
                      {cur} {val.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ))}
                  {Object.keys(profitByCurrency).length === 0 && '-'}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{t('financial.margin')}</p>
              {ratesAvailable ? (
                <>
                  <div className={`text-lg font-bold font-mono ${marginBRLValue >= 0 ? 'text-status-completed' : 'text-status-urgent'}`}>
                    {sellBRL.total > 0 ? `${marginBRLValue.toFixed(1)}%` : '—'}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    sobre venda em BRL
                  </div>
                </>
              ) : (
                <div className="text-lg font-bold font-mono">
                  {Object.entries(marginByCurrency).map(([cur, val]) => (
                    <span key={cur} className="block">{cur} {val.toFixed(1)}%</span>
                  ))}
                  {Object.keys(marginByCurrency).length === 0 && '-'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 pb-28">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general" className="gap-1.5">
            <Info className="w-4 h-4" /> {t('quotes.general')}
          </TabsTrigger>
          <TabsTrigger value="cargo" className="gap-1.5">
            <Package className="w-4 h-4" /> {t('quotes.cargo')}
          </TabsTrigger>
          <TabsTrigger value="partners" className="gap-1.5">
            <Users className="w-4 h-4" /> {t('quotes.partners_tab')}
          </TabsTrigger>
          <TabsTrigger value="charges" className="gap-1.5">
            <ShoppingCart className="w-4 h-4" /> Taxas
          </TabsTrigger>
          {estimateEnabled && (
            <TabsTrigger value="estimate" className="gap-1.5">
              <Calculator className="w-4 h-4" /> Estimativa
            </TabsTrigger>
          )}
          <TabsTrigger value="debit_notes" className="gap-1.5">
            <Receipt className="w-4 h-4" /> DN Parceiros
          </TabsTrigger>
          <TabsTrigger value="client_dn" className="gap-1.5">
            <DollarSign className="w-4 h-4" /> DN Cliente
          </TabsTrigger>
          {/* Documents tab available in both modes */}
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="w-4 h-4" /> {t('shipments.documents')}
          </TabsTrigger>
          {isShipmentMode && (
            <>
              <TabsTrigger value="logistics" className="gap-1.5">
                <MapPin className="w-4 h-4" /> {t('shipments.logistics')}
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5">
                <Activity className="w-4 h-4" /> {t('shipments.activity')}
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="comments" className="gap-1.5">
            <Send className="w-4 h-4" /> {t('quotes.comments')}
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card className="glass">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('shipments.client')}</Label>
                  <Select 
                    value={form.client_id} 
                    onValueChange={(v) => setForm({ ...form, client_id: v })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger><SelectValue placeholder={t('quotes.select_client')} /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('shipments.mode')}</Label>
                  <Select 
                    value={form.transport_mode} 
                    onValueChange={(v) => setForm({ ...form, transport_mode: v })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['ocean_fcl', 'ocean_lcl', 'air', 'road', 'multimodal'].map((m) => (
                        <SelectItem key={m} value={m}>{t(`mode.${m}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!isShipmentMode && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('shipments.status')}</Label>
                    {form.status === 'converted' ? (
                      <div className="flex items-center gap-1.5 h-10 px-3 rounded-md border bg-muted text-sm font-medium">
                        <CheckCircle className="w-4 h-4 text-status-completed" />
                        {t(`quote_status.${form.status}`)}
                      </div>
                    ) : (
                      <Select 
                        value={form.status} 
                        onValueChange={(v) => {
                          setForm({ ...form, status: v });
                          if (v === 'approved') {
                            handleApprove();
                          }
                        }}
                        disabled={!isEditing}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['quoting', 'sent', 'approved', 'rejected'].map((s) => (
                            <SelectItem key={s} value={s}>{t(`quote_status.${s}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('shipments.origin')}</Label>
                  {showPort ? (
                    <PortSelect
                      value={form.origin}
                      onChange={(v) => setForm({ ...form, origin: v })}
                      disabled={!isEditing}
                      placeholder={t('quotes.search_port')}
                    />
                  ) : (
                    <Input 
                      value={form.origin} 
                      onChange={(e) => setForm({ ...form, origin: e.target.value })} 
                      placeholder="São Paulo, BR" 
                      disabled={!isEditing}
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('shipments.destination')}</Label>
                  {showPort ? (
                    <PortSelect
                      value={form.destination}
                      onChange={(v) => setForm({ ...form, destination: v })}
                      transportMode={form.transport_mode}
                      disabled={!isEditing}
                      placeholder={t('quotes.search_port')}
                    />
                  ) : (
                    <Input 
                      value={form.destination} 
                      onChange={(e) => setForm({ ...form, destination: e.target.value })} 
                      placeholder="Curitiba, BR" 
                      disabled={!isEditing}
                    />
                  )}
                </div>
              </div>

              {/* Transshipment */}
              {showPort && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Transbordo</Label>
                    <PortSelect
                      value={form.transshipment}
                      onChange={(v) => setForm({ ...form, transshipment: v })}
                      transportMode={form.transport_mode}
                      disabled={!isEditing}
                      placeholder="Porto de transbordo (opcional)"
                    />
                  </div>
                </div>
              )}

              {/* Route visual display */}
              {(form.origin || form.destination) && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border flex-wrap">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {originFlag && <span className="mr-1">{originFlag}</span>}
                    {form.origin || '?'}
                  </span>
                  {form.transshipment && (
                    <>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-sm font-medium text-amber-600">
                        {countryCodeToFlag(extractCountryFromPort(form.transshipment)) && (
                          <span className="mr-1">{countryCodeToFlag(extractCountryFromPort(form.transshipment))}</span>
                        )}
                        {form.transshipment}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground">→</span>
                  <span className="text-sm font-medium">
                    {destFlag && <span className="mr-1">{destFlag}</span>}
                    {form.destination || '?'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('quotes.incoterm')}</Label>
                  <Select 
                    value={form.incoterm} 
                    onValueChange={(v) => setForm({ ...form, incoterm: v })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {form.transport_mode === 'road' && <SelectItem value="NONE">— Sem incoterm —</SelectItem>}
                      {incoterms.map((ic) => (
                        <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('quotes.valid_until')}</Label>
                  <Input 
                    type="date" 
                    value={form.valid_until} 
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })} 
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('quotes.transit_time')}</Label>
                  <Input 
                    type="number" 
                    value={form.transit_time} 
                    onChange={(e) => setForm({ ...form, transit_time: e.target.value })} 
                    placeholder="0" 
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                    disabled={!isEditing}
                  />
                </div>
                {form.transport_mode?.startsWith('ocean') && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('quotes.free_time')}</Label>
                    <Input 
                      type="number" 
                      value={form.free_time} 
                      onChange={(e) => setForm({ ...form, free_time: e.target.value })} 
                      placeholder="0" 
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      disabled={!isEditing}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotes.notes')}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={t('quotes.notes_placeholder')}
                  rows={3}
                  disabled={!isEditing}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Condições de pagamento</Label>
                  <Textarea
                    value={form.payment_terms}
                    onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                    placeholder="Ex: 50% na chegada, saldo em 30 dias"
                    rows={3}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Observações comerciais (proposta)</Label>
                  <Textarea
                    value={form.proposal_notes}
                    onChange={(e) => setForm({ ...form, proposal_notes: e.target.value })}
                    placeholder="Texto que aparecerá na proposta em PDF"
                    rows={3}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              {form.transport_mode === 'ocean_lcl' && (
                <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Armazenagem no destino (informativo)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Este valor <strong>não</strong> compõe o total da cotação — aparece na proposta apenas para informação ao cliente (geralmente pago diretamente ao armazém).
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-[140px_100px_1fr] gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.storage_fee_amount}
                        onChange={(e) => setForm({ ...form, storage_fee_amount: e.target.value })}
                        placeholder="0,00"
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Moeda</Label>
                      <Select
                        value={form.storage_fee_currency}
                        onValueChange={(v) => setForm({ ...form, storage_fee_currency: v })}
                        disabled={!isEditing}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BRL">BRL</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Observação</Label>
                      <Input
                        value={form.storage_fee_note}
                        onChange={(e) => setForm({ ...form, storage_fee_note: e.target.value })}
                        placeholder={
                          form.destination?.toLowerCase().includes('santos')
                            ? 'Pago diretamente ao armazém em Santos'
                            : 'Pago diretamente ao armazém no destino'
                        }
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cargo Tab */}
        <TabsContent value="cargo">
          <Card className="glass">
            <CardContent className="pt-6 space-y-4">
              {hasChanges && form.status !== 'converted' && !isShipmentMode && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 px-3 py-2 text-xs flex items-center gap-2">
                  <Bell className="w-4 h-4 shrink-0" />
                  <span>
                    Você tem alterações não salvas nos containers/carga. Clique em <strong>Salvar</strong> antes de sair, ou serão perdidas ao recarregar a página.
                  </span>
                </div>
              )}
              <ModeFields 
                mode={form.transport_mode} 
                items={cargoItems} 
                onChange={setCargoItems} 
                readOnly={isShipmentMode || form.status === 'converted'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners">
          <Card className="glass">
            <CardContent className="pt-6 space-y-4">
              <QuotePartnersList
                quoteId={quoteId}
                companyId={profile?.company_id || ''}
                partners={partners}
                quotePartners={quotePartners}
                onChanged={() => queryClient.invalidateQueries({ queryKey: ['quote-partners', quoteId] })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charges Tab */}
        <TabsContent value="charges">
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                {canEditCharges && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setAddChargeOpen(true)}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Taxa
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPdfPreviewOpen(true)}
                  className="gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Pré-visualizar Proposta (PDF)
                </Button>
                {isShipmentMode && isFullAccess && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setShowRevertConfirm(true)}
                  >
                    <Undo2 className="w-4 h-4" />
                    {t('shipments.revert_to_quote')}
                  </Button>
                )}
              </div>
            </div>
            {/* Benchmarks - only in quote mode, not shipment mode */}
            {!shipmentId && profile && form.origin && form.destination && (
              <BenchmarkCard
                companyId={profile.company_id}
                clientId={form.client_id || null}
                transportMode={form.transport_mode}
                originPort={form.origin}
                destinationPort={form.destination}
                currentProfit={profit}
              />
            )}
            {/* Add charge dialog - only for authorized users */}
            {canEditCharges && (
              <Dialog open={addChargeOpen} onOpenChange={(o) => { setAddChargeOpen(o); if (!o) { setChargeForm({ charge_catalog_id: '', description: '', charge_type: 'freight', leg: 'freight', amount: '', currency: 'USD', partner_id: '', billing_unit: 'fixed' }); setChargeDescSearch(''); } }}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{t('quotes.add_charge')}</DialogTitle>
                  </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                  {/* Leg filter + Description with autocomplete */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('financial.description')}</Label>
                    <div className="flex gap-2 items-center">
                      {/* Leg filter buttons */}
                      <div className="flex gap-1 shrink-0">
                        {LEGS.map((leg) => (
                          <Button
                            key={leg}
                            type="button"
                            size="sm"
                            variant={chargeForm.leg === leg ? 'default' : 'outline'}
                            className="h-8 text-xs px-2.5"
                            onClick={() => setChargeForm({ ...chargeForm, leg })}
                          >
                            {legLabels[leg]}
                          </Button>
                        ))}
                      </div>
                       {/* Description input */}
                       <div className="relative flex-1">
                         <Input
                           ref={chargeDescInputRef}
                           value={chargeForm.description}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            const shouldSuggest = isCollectFeeName(val) && chargeForm.billing_unit !== 'percent';
                            setChargeForm({
                              ...chargeForm,
                              description: val,
                              ...(shouldSuggest ? { billing_unit: 'percent' as const } : {}),
                            });
                            setChargeDescSearch(val);
                            setShowChargeSuggestions(true);
                          }}
                          onFocus={() => setShowChargeSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowChargeSuggestions(false), 200)}
                          placeholder="THC, BL FEE, OCEAN FREIGHT..."
                          style={{ textTransform: 'uppercase' }}
                        />
                         {showChargeSuggestions && (() => {
                          const activeLeg = chargeForm.leg;
                          const filtered = catalog
                            .filter((c: any) => {
                              const legs: string[] = c.legs || [];
                              if (!legs.includes(activeLeg)) return false;
                              if (chargeDescSearch.length >= 1) {
                                return c.name.toLowerCase().includes(chargeDescSearch.toLowerCase());
                              }
                              return true;
                            })
                            .slice(0, 8);
                          const exactMatch = catalog.some((c: any) => c.name.toLowerCase() === chargeDescSearch.toLowerCase());
                           if (!(filtered.length > 0 || (chargeDescSearch.length >= 2 && !exactMatch))) return null;
                           const rect = chargeDescInputRef.current?.getBoundingClientRect();
                           if (!rect) return null;
                           return createPortal(
                             <div
                               style={{
                                 position: 'fixed',
                                 top: rect.bottom + 4,
                                 left: rect.left,
                                 width: rect.width,
                                 zIndex: 9999,
                               }}
                               className="bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto"
                             >
                              {filtered.map((s: any) => (
                                <button
                                  key={s.id}
                                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setChargeForm({ ...chargeForm, description: s.name, charge_catalog_id: s.id });
                                    setChargeDescSearch('');
                                    setShowChargeSuggestions(false);
                                  }}
                                >
                                  <span>{s.name}</span>
                                  <div className="flex gap-1">
                                    {((s.legs as string[]) || []).map((l: string) => (
                                      <span key={l} className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">{legLabels[l] || l}</span>
                                    ))}
                                  </div>
                                </button>
                              ))}
                              {chargeDescSearch.length >= 2 && !exactMatch && (
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm text-primary font-medium border-t"
                                  onMouseDown={async (e) => {
                                    e.preventDefault();
                                    if (!profile) return;
                                    try {
                                      const { data, error } = await supabase.from('charge_catalog' as any).insert({
                                        company_id: profile.company_id,
                                        name: chargeDescSearch.trim().toUpperCase(),
                                        legs: [chargeForm.leg],
                                      } as any).select('*').single();
                                      if (error) throw error;
                                      setChargeForm({ ...chargeForm, description: (data as any).name, charge_catalog_id: (data as any).id });
                                      setChargeDescSearch('');
                                      setShowChargeSuggestions(false);
                                      queryClient.invalidateQueries({ queryKey: ['charge-catalog'] });
                                      toast.success(t('quotes.add_to_catalog'));
                                    } catch (err: any) {
                                      toast.error(err.message);
                                    }
                                  }}
                                >
                                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                                  {t('quotes.add_to_catalog')}: "{chargeDescSearch.trim()}"
                                </button>
                              )}
                             </div>,
                             document.body
                           );
                        })()}
                      </div>
                    </div>
                  </div>
                  {/* Empresa — client + quote partners */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('financial.partner')}</Label>
                    <Select value={chargeForm.partner_id} onValueChange={(v) => setChargeForm({ ...chargeForm, partner_id: v })}>
                      <SelectTrigger><SelectValue placeholder={t('financial.select_partner')} /></SelectTrigger>
                      <SelectContent>
                        {form.client_id && (() => {
                          const client = clients.find((c: any) => c.id === form.client_id);
                          return client ? <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem> : null;
                        })()}
                        {quotePartners
                          .filter((qp: any) => (qp.clients?.id || qp.client_id) !== form.client_id)
                          .map((qp: any) => {
                            const pId = qp.clients?.id || qp.client_id;
                            const pName = qp.clients?.name || '-';
                            const pCategory = qp.clients?.partner_category;
                            const label = pCategory ? `${pName} (${t(`registrations.category_${pCategory}`) !== `registrations.category_${pCategory}` ? t(`registrations.category_${pCategory}`) : pCategory})` : pName;
                            return (
                              <SelectItem key={pId} value={pId}>
                                {label}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-end gap-4 mt-3">
                  {/* Grupo 1: Base + Moeda + Valor */}
                  <div className="flex gap-2 items-end">
                     <Select value={chargeForm.billing_unit} onValueChange={(v) => setChargeForm({ ...chargeForm, billing_unit: v })}>
                       <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                       <SelectContent>
                         {BILLING_UNITS.map((u) => {
                           const mixed = cargoMetrics.totalContainers20 > 0 && cargoMetrics.totalContainers40 > 0;
                           // Força escolher 20' ou 40' quando a carga é mista
                           if (u === 'per_container' && mixed) {
                             return <SelectItem key={u} value={u} disabled>{t(`quotes.billing_${u}`)} (carga mista — escolha 20' ou 40')</SelectItem>;
                           }
                           if (u === 'per_container_20' && cargoMetrics.totalContainers20 === 0) return null;
                           if (u === 'per_container_40' && cargoMetrics.totalContainers40 === 0) return null;
                           return <SelectItem key={u} value={u}>{t(`quotes.billing_${u}`)}</SelectItem>;
                         })}
                       </SelectContent>
                     </Select>
                    <Select value={chargeForm.currency} onValueChange={(v) => setChargeForm({ ...chargeForm, currency: v })} disabled={chargeForm.billing_unit === 'percent'}>
                      <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder={chargeForm.billing_unit === 'percent' ? '%' : '0.00'}
                      value={chargeForm.amount}
                      onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                      className="w-28 h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {chargeForm.billing_unit === 'percent' && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap self-center">
                        % das taxas base (defina após criar)
                      </span>
                    )}
                    {chargeForm.billing_unit !== 'fixed' && chargeForm.billing_unit !== 'percent' && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap self-center">
                        {chargeForm.billing_unit === 'per_cw' && `× ${cargoMetrics.totalChargeable.toFixed(2)} kg`}
                        {chargeForm.billing_unit === 'per_ton' && `× ${(cargoMetrics.totalWeight / 1000).toFixed(3)} ton`}
                        {chargeForm.billing_unit === 'per_cbm' && `× ${cargoMetrics.totalCbm.toFixed(4)} m³`}
                        {chargeForm.billing_unit === 'per_wm' && (() => {
                          const tons = cargoMetrics.totalWeight / 1000;
                          const cbm = cargoMetrics.totalCbm;
                          const winner = tons >= cbm ? `${tons.toFixed(3)} ton` : `${cbm.toFixed(4)} m³`;
                          return `× ${winner} (W/M)`;
                        })()}
                        {chargeForm.billing_unit === 'per_container' && `× ${cargoMetrics.totalContainers} cntr`}
                        {chargeForm.billing_unit === 'per_container_20' && `× ${cargoMetrics.totalContainers20} cntr 20'`}
                        {chargeForm.billing_unit === 'per_container_40' && `× ${cargoMetrics.totalContainers40} cntr 40'`}
                        {chargeForm.billing_unit === 'per_bl' && `× 1 BL`}
                      </span>
                    )}
                  </div>

                  <div className="h-6 w-px bg-border" />

                  {/* Bidirecional switch */}
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Switch checked={bidirectional} onCheckedChange={setBidirectional} />
                    <span>Bidirecional (mesmo valor em compra e venda)</span>
                  </label>
                </div>
                <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                  <Button variant="ghost" onClick={() => setAddChargeOpen(false)}>{t('common.cancel')}</Button>
                  <div className="flex gap-2 flex-wrap">
                    {bidirectional ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleAddCharge('both', { keepOpen: true })}
                          disabled={addingSide !== null || !chargeForm.description.trim()}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Adicionar e criar outra
                        </Button>
                        <Button
                          onClick={() => handleAddCharge('both')}
                          disabled={addingSide !== null || !chargeForm.description.trim()}
                        >
                          Adicionar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                          onClick={() => handleAddCharge('buy', { keepOpen: true })}
                          disabled={addingSide !== null || !chargeForm.description.trim()}
                        >
                          <TrendingDown className="w-3.5 h-3.5 mr-1" />
                          {chargeForm.billing_unit === 'percent' ? '% Compra' : t('quotes.add_buy')}
                        </Button>
                        <Button
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => handleAddCharge('sell', { keepOpen: true })}
                          disabled={addingSide !== null || !chargeForm.description.trim()}
                        >
                          <TrendingUp className="w-3.5 h-3.5 mr-1" />
                          {chargeForm.billing_unit === 'percent' ? '% Venda' : t('quotes.add_sell')}
                        </Button>
                      </>
                    )}
                  </div>
                </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {!canSeeFinancials && isShipmentMode && (
              <Card className="glass">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">Informações financeiras restritas ao vendedor do processo.</p>
                </CardContent>
              </Card>
            )}

            {/* Split View: Buy left, Sell right */}
            {canSeeFinancials && (() => {
              // Build combined partner list: client + quote partners
              const clientEntry = form.client_id ? clients.find((c: any) => c.id === form.client_id) : null;
              const qpEntries = quotePartners.map((qp: any) => ({ 
                id: qp.clients?.id || qp.client_id, 
                name: qp.clients?.name || '-', 
                type: qp.clients?.type,
                partner_category: qp.clients?.partner_category
              }));
              const combinedPartners = [
                ...(clientEntry ? [{ id: clientEntry.id, name: clientEntry.name, type: 'client' }] : []),
                ...qpEntries.filter((qp: any) => qp.id !== form.client_id),
              ];
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChargeColumn
                    title={t('quotes.total_buy')}
                    charges={buyCharges}
                    amountKey="buy_amount"
                    totalByCurrency={buyByCurrency}
                    legLabels={legLabels}
                    legColors={legColors}
                    legBorderLeftColors={legBorderLeftColors}
                    onDelete={canEditCharges ? handleDeleteCharge : () => {}}
                    onUpdate={canEditCharges ? handleUpdateCharge : async () => {}}
                    onClone={(charge, amount, partnerId) => handleCloneCharge(charge, amount, 'sell', partnerId)}
                    colorClass="text-blue-600"
                    borderClass="border-blue-500/20"
                    cloneLabel={t('quotes.clone_to_sell')}
                    partners={combinedPartners}
                    defaultClonePartnerId={form.client_id || ''}
                    cargoMetrics={cargoMetrics}
                    readOnly={!canEditCharges}
                    showReconciliation={isShipmentMode && canSeeFinancials}
                    currentUserId={profile?.user_id}
                    onPercentClick={(id) => setPercentDialogChargeId(id)}
                  />
                  <ChargeColumn
                    title={t('quotes.total_sell')}
                    charges={sellCharges}
                    amountKey="sell_amount"
                    totalByCurrency={sellByCurrency}
                    legLabels={legLabels}
                    legColors={legColors}
                    legBorderLeftColors={legBorderLeftColors}
                    onDelete={canEditCharges ? handleDeleteCharge : () => {}}
                    onUpdate={canEditCharges ? handleUpdateCharge : async () => {}}
                    onClone={(charge, amount, partnerId) => handleCloneCharge(charge, amount, 'buy', partnerId)}
                    colorClass="text-emerald-600"
                    borderClass="border-emerald-500/20"
                    cloneLabel={t('quotes.clone_to_buy')}
                    partners={combinedPartners}
                    cargoMetrics={cargoMetrics}
                    readOnly={!canEditCharges}
                    onPercentClick={(id) => setPercentDialogChargeId(id)}
                  />
                </div>
              );
            })()}

            {/* Profit summary removido — informação já exibida no card de Lucro acima */}
          </div>
        </TabsContent>

        {/* Cost Estimate Tab */}
        {estimateEnabled && (
          <TabsContent value="estimate">
            <CostEstimateTab
              ref={estimateRef}
              quoteId={quoteId}
              quote={quote}
              quoteItems={cargoItems}
              quotePartners={quotePartners}
              companyId={profile?.company_id}
              charges={charges as any}
              getBillingMultiplier={getChargeMultiplier}
              onStateChange={setEstimateState}
            />
          </TabsContent>
        )}

        {/* Debit Notes Tab */}
        <TabsContent value="debit_notes">
          <DebitNotesTab
            quoteId={quoteId}
            companyId={profile?.company_id || ''}
            partners={(() => {
              const allowedIds = new Set(
                (quotePartners as any[]).map((qp) => qp.client_id).filter(Boolean)
              );
              return (partners as any[])
                .filter((p) => allowedIds.has(p.id))
                .map((p) => ({ id: p.id, name: p.name, partner_category: p.partner_category }));
            })()}
          />
        </TabsContent>

        <TabsContent value="client_dn">
          <ClientDebitNotesTab
            quoteId={quoteId}
            companyId={profile?.company_id || ''}
            clientId={(quote as any)?.client_id || null}
          />
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments">
          <Card className="glass">
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('quotes.add_comment')}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  className="self-end"
                  disabled={!commentText.trim()}
                  onClick={async () => {
                    if (!profile || !commentText.trim()) return;
                    try {
                      const { error } = await supabase.from('quote_comments' as any).insert({
                        quote_id: quoteId,
                        company_id: profile.company_id,
                        user_id: profile.user_id,
                        content: commentText.trim(),
                      });
                      if (error) throw error;
                      setCommentText('');
                      queryClient.invalidateQueries({ queryKey: ['quote-comments', quoteId] });
                      toast.success(t('quotes.comment_added'));
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {t('common.create')}
                </Button>
              </div>
              <QuoteCommentsList quoteId={quoteId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents tab - available in both modes */}
        <TabsContent value="documents">
          {isShipmentMode && shipment ? (
            <DocumentsTab 
              shipmentId={shipmentId!} 
              companyId={shipment.company_id} 
              quoteId={quoteId} 
              onGeneratePdf={() => setPdfPreviewOpen(true)}
            />
          ) : profile ? (
            <DocumentsTab 
              shipmentId={quoteId} 
              companyId={profile.company_id} 
              isQuoteMode 
              onGeneratePdf={() => setPdfPreviewOpen(true)}
            />
          ) : null}
        </TabsContent>

        {/* Shipment-specific tabs (only in shipment mode) */}
        {isShipmentMode && shipment && (
          <>
            <TabsContent value="logistics">
              <LogisticsTab shipment={shipment} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] })} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab shipmentId={shipmentId!} companyId={shipment.company_id} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {!isShipmentMode && activeTab !== 'estimate' && activeTab !== 'documents' && activeTab !== 'comments' && (
        <FloatingSaveButton
          visible={(isEditing || activeTab === 'cargo') && hasChanges && form.status !== 'converted'}
          dirtyCount={dirtyCount}
          state={saveState}
          onSave={handleSave}
        />
      )}

      <QuotePdfPreviewDialog
        quoteId={quoteId}
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
      />

      <AlertDialog open={leaveTabOpen} onOpenChange={setLeaveTabOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem {estimateState.dirtyCount} alteração{estimateState.dirtyCount > 1 ? 'ões' : ''} não salva{estimateState.dirtyCount > 1 ? 's' : ''} na Estimativa. Trocar de aba irá descartá-las.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTab(null)}>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              estimateRef.current?.forceExit();
              if (pendingTab) setActiveTab(pendingTab);
              setPendingTab(null);
              setLeaveTabOpen(false);
            }}>Descartar e sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnsavedConfirm} onOpenChange={setShowUnsavedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas nesta aba. Se você mudar de aba agora, essas alterações serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingTab(null);
              setShowUnsavedConfirm(false);
            }}>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingTab) {
                setIsEditing(false);
                setActiveTab(pendingTab);
                setPendingTab(null);
                setShowUnsavedConfirm(false);
              }
            }}>Descartar e mudar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas nesta cotação (incluindo containers/carga). Se sair agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setBackConfirmOpen(false);
                await handleSave();
                onBack();
              }}
            >
              Salvar e sair
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                setBackConfirmOpen(false);
                onBack();
              }}
            >
              Descartar e sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PercentBaseDialog
        quoteId={quoteId}
        chargeId={percentDialogChargeId}
        charges={charges}
        usdBrl={usdBrl}
        eurBrl={eurBrl}
        getChargeMultiplier={getChargeMultiplier}
        onClose={() => setPercentDialogChargeId(null)}
      />
    </div>
  );
}

/* ── Charge Column Sub-component ── */
interface ChargeColumnProps {
  title: string;
  charges: any[];
  amountKey: 'buy_amount' | 'sell_amount';
  totalByCurrency: Record<string, number>;
  legLabels: Record<string, string>;
  legColors: Record<string, string>;
  legBorderLeftColors: Record<string, string>;
  onDelete: (id: string) => void;
  onClone: (charge: any, newAmount: number, partnerId?: string) => Promise<void>;
  onUpdate: (id: string, updates: Record<string, any>) => Promise<void>;
  colorClass: string;
  borderClass: string;
  cloneLabel: string;
  partners: any[];
  defaultClonePartnerId?: string;
  cargoMetrics?: { totalWeight: number; totalCbm: number; totalChargeable: number; totalContainers: number; totalContainers20: number; totalContainers40: number };
  readOnly?: boolean;
  showReconciliation?: boolean;
  currentUserId?: string;
  onPercentClick?: (chargeId: string) => void;
}

function ChargeColumn({ title, charges, amountKey, totalByCurrency, legLabels, legColors, legBorderLeftColors, onDelete, onClone, onUpdate, colorClass, borderClass, cloneLabel, partners, defaultClonePartnerId, cargoMetrics, readOnly, showReconciliation, currentUserId, onPercentClick }: ChargeColumnProps) {
  const { t } = useLanguage();
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [cloneAmount, setCloneAmount] = useState('');
  const [clonePartnerId, setClonePartnerId] = useState(defaultClonePartnerId || '');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editLeg, setEditLeg] = useState('');

  function getBillingRef(unit: string): string {
    if (!cargoMetrics) return '';
    switch (unit) {
      case 'per_cw': return `${cargoMetrics.totalChargeable.toFixed(2)} kg`;
      case 'per_ton': return `${(cargoMetrics.totalWeight / 1000).toFixed(3)} ton`;
      case 'per_cbm': return `${cargoMetrics.totalCbm.toFixed(4)} m³`;
      case 'per_wm': {
        const tons = cargoMetrics.totalWeight / 1000;
        const cbm = cargoMetrics.totalCbm;
        return tons >= cbm ? `${tons.toFixed(3)} ton (W/M)` : `${cbm.toFixed(4)} m³ (W/M)`;
      }
      case 'per_container': return `${cargoMetrics.totalContainers} cntr`;
      case 'per_container_20': return `${cargoMetrics.totalContainers20} cntr 20'`;
      case 'per_container_40': return `${cargoMetrics.totalContainers40} cntr 40'`;
      case 'per_bl': return '1 BL';
      default: return '';
    }
  }

  function getBillingMultiplier(unit: string): number {
    if (!cargoMetrics) return 1;
    switch (unit) {
      case 'per_cw': return cargoMetrics.totalChargeable;
      case 'per_ton': return cargoMetrics.totalWeight / 1000;
      case 'per_cbm': return cargoMetrics.totalCbm;
      case 'per_wm': return Math.max(cargoMetrics.totalWeight / 1000, cargoMetrics.totalCbm);
      case 'per_container': return cargoMetrics.totalContainers;
      case 'per_container_20': return cargoMetrics.totalContainers20;
      case 'per_container_40': return cargoMetrics.totalContainers40;
      case 'per_bl': return 1;
      default: return 1;
    }
  }

  async function handleCloneConfirm(charge: any) {
    const amount = parseFloat(cloneAmount);
    if (!amount || amount <= 0) return;
    setCloneLoading(true);
    await onClone(charge, amount, clonePartnerId || undefined);
    setCloneLoading(false);
    setCloningId(null);
    setCloneAmount('');
    setClonePartnerId('');
  }

  const groupedByLegAndPartner = useMemo(() => {
    const result: Record<string, { partnerId: string; partnerName: string; partnerCategory: string; charges: any[] }[]> = {};
    for (const leg of LEGS) {
      const legCharges = charges.filter((c: any) => c.leg === leg);
      const partnerMap = new Map<string, { partnerName: string; partnerCategory: string; charges: any[] }>();
      for (const c of legCharges) {
        const pid = c.partner_id || '__none__';
        const pname = c.clients?.name || t('financial.no_partner');
        const pcategory = c.clients?.partner_category || '';
        if (!partnerMap.has(pid)) {
          partnerMap.set(pid, { partnerName: pname, partnerCategory: pcategory, charges: [] });
        }
        partnerMap.get(pid)!.charges.push(c);
      }
      result[leg] = Array.from(partnerMap.entries()).map(([partnerId, data]) => ({
        partnerId,
        ...data,
      }));
    }
    return result;
  }, [charges, t]);

  const totalsByLeg = useMemo(() => {
    const result: Record<string, Record<string, number>> = { origin: {}, freight: {}, destination: {} };
    for (const c of charges) {
      const leg = (c.leg as string) || 'freight';
      if (!result[leg]) result[leg] = {};
      const isPct = c.billing_unit === 'percent';
      const cur = isPct ? 'USD' : (c.currency || 'USD');
      let val: number;
      if (isPct) {
        val = Number(amountKey === 'buy_amount' ? c.computed_buy_amount : c.computed_sell_amount) || 0;
      } else {
        const mult = c.billing_unit && c.billing_unit !== 'fixed' ? getBillingMultiplier(c.billing_unit) : 1;
        val = (c[amountKey] || 0) * mult;
      }
      result[leg][cur] = (result[leg][cur] || 0) + val;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charges, amountKey, cargoMetrics]);

  return (
    <Card className={`glass border ${borderClass}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm ${colorClass}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('financial.description')}</TableHead>
              <TableHead>{t('quotes.leg')}</TableHead>
              <TableHead className="text-right">{t('financial.amount')}</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {charges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">{t('common.no_data')}</TableCell>
              </TableRow>
            ) : (
              LEGS.map((leg) => {
                const partnerGroups = groupedByLegAndPartner[leg] || [];
                if (partnerGroups.length === 0) return null;
                return (
                  <React.Fragment key={leg}>
                    {partnerGroups.map((group) => (
                      <React.Fragment key={`${leg}-${group.partnerId}`}>
                        {/* Partner sub-header with enhanced styling */}
                        <TableRow className={`bg-muted/30 border-t border-l-4 ${legBorderLeftColors[leg] || ''}`}>
                          <TableCell colSpan={4} className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${legColors[leg] || ''}`}>
                                {legLabels[leg] || leg}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-sm font-bold text-foreground">
                                  {group.partnerName}
                                </span>
                                {group.partnerCategory && (
                                  <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
                                    {t(`registrations.category_${group.partnerCategory}`) !== `registrations.category_${group.partnerCategory}` 
                                      ? t(`registrations.category_${group.partnerCategory}`) 
                                      : group.partnerCategory}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {group.charges.map((c: any) => (
                          <React.Fragment key={c.id}>
                            <TableRow
                              className={`${readOnly ? '' : 'cursor-pointer'} hover:bg-muted/40 transition-colors`}
                              onClick={() => {
                                if (readOnly) return;
                                if (c.billing_unit === 'percent' && onPercentClick) {
                                  onPercentClick(c.id);
                                  return;
                                }
                                if (editingId === c.id) return;
                                setEditingId(c.id);
                                setEditAmount(String(c[amountKey] || 0));
                                setEditLeg(c.leg || 'freight');
                              }}
                            >
                              <TableCell className="font-medium text-sm pl-8">
                                <div>
                                  {c.description}
                                  <span className={`ml-1.5 text-[10px] border rounded px-1 py-0.5 ${c.billing_unit === 'percent' ? 'text-primary border-primary/40 bg-primary/10' : 'text-muted-foreground'}`}>
                                    {t(`quotes.billing_${c.billing_unit || 'fixed'}`)}
                                  </span>
                                  {c.billing_unit === 'percent' && (!c.percent_base_charge_ids || c.percent_base_charge_ids.length === 0) && (
                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                      Selecionar taxas base
                                    </span>
                                  )}
                                </div>
                                {c.billing_unit === 'percent' ? (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                    {(Number(c[amountKey]) || 0).toFixed(2)}% × base = USD {(Number(amountKey === 'buy_amount' ? c.computed_buy_amount : c.computed_sell_amount) || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                ) : c.billing_unit && c.billing_unit !== 'fixed' && getBillingRef(c.billing_unit) && (() => {
                                  const unitPrice = editingId === c.id ? (parseFloat(editAmount) || 0) : (c[amountKey] || 0);
                                  const mult = getBillingMultiplier(c.billing_unit);
                                  const total = unitPrice * mult;
                                  return (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                      {getBillingRef(c.billing_unit)} × {c.currency || 'USD'} {unitPrice.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = {c.currency || 'USD'} {total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {editingId === c.id ? (
                                  <div className="flex gap-1">
                                    {(['origin', 'freight', 'destination'] as const).map((leg) => (
                                      <button
                                        key={leg}
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${editLeg === leg ? legColors[leg] : 'text-muted-foreground'}`}
                                        onMouseDown={(e) => { e.preventDefault(); setEditLeg(leg); }}
                                      >
                                        {legLabels[leg]}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${legColors[c.leg] || ''}`}>
                                    {legLabels[c.leg] || c.leg}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm" onClick={(e) => e.stopPropagation()}>
                                {editingId === c.id ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-xs text-muted-foreground">{c.currency || 'USD'}</span>
                                    <Input
                                      type="number"
                                      value={editAmount}
                                      onChange={(e) => setEditAmount(e.target.value)}
                                      className="h-7 w-28 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const val = parseFloat(editAmount) || 0;
                                          onUpdate(c.id, { [amountKey]: val, leg: editLeg });
                                          setEditingId(null);
                                        }
                                        if (e.key === 'Escape') setEditingId(null);
                                      }}
                                      onBlur={() => {
                                        const val = parseFloat(editAmount) || 0;
                                        if (val !== (c[amountKey] || 0) || editLeg !== c.leg) {
                                          onUpdate(c.id, { [amountKey]: val, leg: editLeg });
                                        }
                                        setEditingId(null);
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <>
                                    {c.billing_unit === 'percent' ? (
                                      <>
                                        <span className="text-xs text-muted-foreground mr-1">USD</span>
                                        {(Number(amountKey === 'buy_amount' ? c.computed_buy_amount : c.computed_sell_amount) || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </>
                                    ) : c.billing_unit && c.billing_unit !== 'fixed' ? (
                                      <>
                                        <span className="text-xs text-muted-foreground mr-1">{c.currency || 'USD'}</span>
                                        {((c[amountKey] || 0) * getBillingMultiplier(c.billing_unit)).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-xs text-muted-foreground mr-1">{c.currency || 'USD'}</span>
                                        {(c[amountKey] || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </>
                                    )}
                                  </>
                                )}
                              </TableCell>
                              {!readOnly && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title={cloneLabel}
                                    onClick={() => {
                                      setCloningId(cloningId === c.id ? null : c.id);
                                      setCloneAmount(String(c[amountKey] || 0));
                                      setClonePartnerId(defaultClonePartnerId || '');
                                    }}
                                  >
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(c.id)}>
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                              )}
                            </TableRow>
                            {showReconciliation && amountKey === 'buy_amount' && (
                              <ReconciliationRow
                                charge={c}
                                cargoMetrics={cargoMetrics}
                                onUpdate={onUpdate}
                                currentUserId={currentUserId}
                              />
                            )}
                            {cloningId === c.id && (
                              <TableRow className="bg-muted/20">
                                <TableCell colSpan={4}>
                                  <div className="flex items-center gap-2 py-1 flex-wrap">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">{cloneLabel}:</span>
                                    <Select value={clonePartnerId} onValueChange={setClonePartnerId}>
                                      <SelectTrigger className="h-8 w-44 text-xs">
                                        <SelectValue placeholder={t('financial.select_partner')} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {partners.map((p: any) => {
                                          const categoryLabel = p.partner_category ? ` (${t(`registrations.category_${p.partner_category}`) !== `registrations.category_${p.partner_category}` ? t(`registrations.category_${p.partner_category}`) : p.partner_category})` : '';
                                          return (
                                            <SelectItem key={p.id} value={p.id}>
                                              {p.name}{categoryLabel}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="number"
                                      placeholder="0.00"
                                      value={cloneAmount}
                                      onChange={(e) => setCloneAmount(e.target.value)}
                                      className="h-8 w-32 font-mono text-sm"
                                      autoFocus
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleCloneConfirm(c); if (e.key === 'Escape') setCloningId(null); }}
                                    />
                                    {c.billing_unit && c.billing_unit !== 'fixed' && getBillingRef(c.billing_unit) && (() => {
                                      const unitPrice = parseFloat(cloneAmount) || 0;
                                      const mult = getBillingMultiplier(c.billing_unit);
                                      const total = unitPrice * mult;
                                      return (
                                        <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                                          {getBillingRef(c.billing_unit)} × {c.currency || 'USD'} {unitPrice.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = <strong>{c.currency || 'USD'} {total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                        </span>
                                      );
                                    })()}
                                    <Button size="sm" className="h-8" disabled={cloneLoading} onClick={() => handleCloneConfirm(c)}>
                                      {cloneLoading ? '...' : t('common.create')}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setCloningId(null)}>
                                      {t('common.cancel')}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })
            )}
            {charges.length > 0 && (
              <>
                {LEGS.map((leg) => {
                  const entries = Object.entries(totalsByLeg[leg] || {});
                  if (entries.length === 0) return null;
                  return (
                    <TableRow key={`subtotal-${leg}`} className={`bg-muted/10 border-l-4 ${legBorderLeftColors[leg] || ''}`}>
                      <TableCell colSpan={2} className="text-xs font-medium pl-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${legColors[leg] || ''}`}>
                          {legLabels[leg] || leg}
                        </span>
                        <span className="ml-2 text-muted-foreground">{t('financial.subtotal') || 'Subtotal'}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {entries.map(([cur, val]) => (
                          <span key={cur} className="block">{cur} {val.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell colSpan={2}>{t('financial.total')}</TableCell>
                <TableCell className={`text-right font-mono ${colorClass}`}>
                  {Object.entries(totalByCurrency).map(([cur, val]) => (
                    <span key={cur} className="block">{cur} {val.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  ))}
                </TableCell>
                <TableCell />
              </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Quote Comments List ── */
function QuoteCommentsList({ quoteId }: { quoteId: string }) {
  const { t } = useLanguage();
  const { data: comments = [] } = useQuery({
    queryKey: ['quote-comments', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_comments' as any)
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data as any[];
      if (rows.length === 0) return [];
      // Fetch profile names for all user_ids
      const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      return rows.map((r: any) => ({ ...r, author_name: nameMap.get(r.user_id) || '-' }));
    },
  });

  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{t('common.no_data')}</p>;
  }

  return (
    <div className="space-y-3">
      {comments.map((c: any) => (
        <div key={c.id} className="border rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{c.author_name}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), 'dd/MM/yy HH:mm')}</span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Quote Partners List ── */
interface QuotePartnersListProps {
  quoteId: string;
  companyId: string;
  partners: any[];
  quotePartners: any[];
  onChanged: () => void;
}

function QuotePartnersList({ quoteId, companyId, partners, quotePartners, onChanged }: QuotePartnersListProps) {
  const { t } = useLanguage();
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [adding, setAdding] = useState(false);

  const addedClientIds = new Set(quotePartners.map((qp: any) => qp.clients?.id || qp.client_id));
  const filteredPartners = partners
    .filter((p: any) => !addedClientIds.has(p.id))
    .filter((p: any) => searchText.length >= 1 && p.name.toLowerCase().includes(searchText.toLowerCase()));

  async function handleAdd(partnerId: string) {
    if (!partnerId || !companyId) return;
    setAdding(true);
    try {
      const { error } = await supabase.from('quote_partners' as any).insert({
        quote_id: quoteId,
        client_id: partnerId,
        company_id: companyId,
      });
      if (error) throw error;
      setSearchText('');
      setShowSuggestions(false);
      onChanged();
      toast.success(t('quotes.partner_added'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      const { error } = await supabase.from('quote_partners' as any).delete().eq('id', id);
      if (error) throw error;
      onChanged();
      toast.success(t('quotes.partner_removed'));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Input
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={t('quotes.add_partner')}
        />
        {showSuggestions && filteredPartners.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filteredPartners.slice(0, 10).map((p: any) => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAdd(p.id);
                }}
                disabled={adding}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{p.name}</span>
                </div>
                {p.partner_category ? (
                  <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
                    {t(`registrations.category_${p.partner_category}`) !== `registrations.category_${p.partner_category}` 
                      ? t(`registrations.category_${p.partner_category}`) 
                      : p.partner_category}
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {quotePartners.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t('quotes.no_partners')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('shipments.client')}</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotePartners.map((qp: any) => (
              <TableRow key={qp.id}>
                <TableCell className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{qp.clients?.name || '-'}</span>
                  {qp.clients?.partner_category ? (
                    <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
                      {t(`registrations.category_${qp.clients.partner_category}`) !== `registrations.category_${qp.clients.partner_category}` 
                        ? t(`registrations.category_${qp.clients.partner_category}`) 
                        : qp.clients.partner_category}
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(qp.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/* ── Reconciliation Row (Cotado vs Cobrado do fornecedor) ── */
const VARIANCE_REASONS = ['peso', 'cubagem', 'cambio', 'sobrestadia', 'reajuste', 'outros'] as const;
const VARIANCE_LABELS: Record<string, string> = {
  peso: 'Peso', cubagem: 'Cubagem', cambio: 'Câmbio',
  sobrestadia: 'Sobrestadia', reajuste: 'Reajuste', outros: 'Outros',
};

function ReconciliationRow({ charge, cargoMetrics, onUpdate, currentUserId }: {
  charge: any;
  cargoMetrics?: { totalWeight: number; totalCbm: number; totalChargeable: number; totalContainers: number; totalContainers20: number; totalContainers40: number };
  onUpdate: (id: string, updates: Record<string, any>) => Promise<void>;
  currentUserId?: string;
}) {
  const mult = (() => {
    if (!cargoMetrics) return 1;
    switch (charge.billing_unit) {
      case 'per_cw': return cargoMetrics.totalChargeable;
      case 'per_ton': return cargoMetrics.totalWeight / 1000;
      case 'per_cbm': return cargoMetrics.totalCbm;
      case 'per_wm': return Math.max(cargoMetrics.totalWeight / 1000, cargoMetrics.totalCbm);
      case 'per_container': return cargoMetrics.totalContainers;
      case 'per_container_20': return cargoMetrics.totalContainers20;
      case 'per_container_40': return cargoMetrics.totalContainers40;
      case 'per_bl': return 1;
      default: return 1;
    }
  })();
  const quotedTotal = (Number(charge.buy_amount) || 0) * mult;
  const actualUnit = charge.buy_amount_actual;
  const actualTotal = actualUnit != null ? Number(actualUnit) * mult : null;
  const confirmed = !!charge.buy_actual_confirmed_at;
  const delta = actualTotal != null ? actualTotal - quotedTotal : 0;
  const deltaPct = quotedTotal > 0 && actualTotal != null ? (delta / quotedTotal) * 100 : 0;
  const cur = charge.currency || 'USD';
  const [inputVal, setInputVal] = useState(actualUnit != null ? String(actualUnit) : '');
  const [reason, setReason] = useState<string>(charge.buy_variance_reason || '');

  useEffect(() => {
    setInputVal(actualUnit != null ? String(actualUnit) : '');
    setReason(charge.buy_variance_reason || '');
  }, [actualUnit, charge.buy_variance_reason]);

  const deltaColor =
    actualTotal == null ? 'text-muted-foreground' :
    Math.abs(delta) < 0.01 ? 'text-muted-foreground' :
    delta < 0 ? 'text-emerald-600' :
    Math.abs(deltaPct) <= 5 ? 'text-amber-500' : 'text-destructive';

  const saveActual = () => {
    const val = inputVal === '' ? null : parseFloat(inputVal);
    if (val !== null && isNaN(val)) return;
    if (val === (actualUnit ?? null)) return;
    onUpdate(charge.id, { buy_amount_actual: val });
  };

  const saveReason = (v: string) => {
    setReason(v);
    onUpdate(charge.id, { buy_variance_reason: v || null });
  };

  const confirmActual = () => {
    if (actualUnit == null && inputVal === '') return;
    const val = inputVal === '' ? actualUnit : parseFloat(inputVal);
    onUpdate(charge.id, {
      buy_amount_actual: val,
      buy_actual_confirmed_at: new Date().toISOString(),
      buy_actual_confirmed_by: currentUserId || null,
    });
  };

  const reopen = () => {
    onUpdate(charge.id, {
      buy_actual_confirmed_at: null,
      buy_actual_confirmed_by: null,
    });
  };

  return (
    <TableRow className={confirmed ? 'bg-emerald-500/5' : 'bg-muted/10'}>
      <TableCell colSpan={4} className="py-1.5 pl-8 pr-2">
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span className="text-muted-foreground uppercase tracking-wide">Cobrado:</span>
          <span className="text-muted-foreground">{cur}</span>
          <Input
            type="number"
            value={inputVal}
            disabled={confirmed}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={saveActual}
            placeholder={String(charge.buy_amount ?? '0')}
            className="h-6 w-24 text-xs font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {actualTotal != null && (
            <>
              <span className="text-muted-foreground">
                Total: <span className="font-mono">{cur} {actualTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </span>
              <span className={`font-mono font-semibold ${deltaColor}`}>
                Δ {delta >= 0 ? '+' : ''}{delta.toFixed(2)} ({deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
              </span>
            </>
          )}
          {actualTotal != null && Math.abs(delta) >= 0.01 && (
            <Select value={reason} onValueChange={saveReason} disabled={confirmed}>
              <SelectTrigger className="h-6 w-32 text-[11px]">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                {VARIANCE_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{VARIANCE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex items-center gap-1">
            {confirmed ? (
              <>
                <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1">
                  <CheckCircle className="w-3 h-3" /> Conferido
                </Badge>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={reopen}>
                  Reabrir
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                disabled={inputVal === '' && actualUnit == null}
                onClick={confirmActual}
              >
                <CheckCircle className="w-3 h-3 mr-1" /> Conferir
              </Button>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function QuotePartnersTab({ quoteId, quotePartners, partners, companyId, onChanged }: { quoteId: string; quotePartners: any[]; partners: any[]; companyId: string | null; onChanged: () => void }) {
  const { t } = useLanguage();
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [adding, setAdding] = useState(false);

  const addedClientIds = new Set(quotePartners.map((qp: any) => qp.clients?.id || qp.client_id));
  const filteredPartners = partners
    .filter((p: any) => !addedClientIds.has(p.id))
    .filter((p: any) => searchText.length >= 1 && p.name.toLowerCase().includes(searchText.toLowerCase()));

  async function handleAdd(partnerId: string) {
    if (!partnerId || !companyId) return;
    setAdding(true);
    try {
      const { error } = await supabase.from('quote_partners' as any).insert({
        quote_id: quoteId,
        client_id: partnerId,
        company_id: companyId,
      });
      if (error) throw error;
      setSearchText('');
      setShowSuggestions(false);
      onChanged();
      toast.success(t('quotes.partner_added'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      const { error } = await supabase.from('quote_partners' as any).delete().eq('id', id);
      if (error) throw error;
      onChanged();
      toast.success(t('quotes.partner_removed'));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Input
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={t('quotes.add_partner')}
        />
        {showSuggestions && filteredPartners.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filteredPartners.slice(0, 10).map((p: any) => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAdd(p.id);
                }}
                disabled={adding}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{p.name}</span>
                </div>
                {p.partner_category ? (
                  <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
                    {t(`registrations.category_${p.partner_category}`) !== `registrations.category_${p.partner_category}` 
                      ? t(`registrations.category_${p.partner_category}`) 
                      : p.partner_category}
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {quotePartners.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t('quotes.no_partners')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('shipments.client')}</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotePartners.map((qp: any) => (
              <TableRow key={qp.id}>
                <TableCell className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{qp.clients?.name || '-'}</span>
                  {qp.clients?.partner_category ? (
                    <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
                      {t(`registrations.category_${qp.clients.partner_category}`) !== `registrations.category_${qp.clients.partner_category}` 
                        ? t(`registrations.category_${qp.clients.partner_category}`) 
                        : qp.clients.partner_category}
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(qp.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
