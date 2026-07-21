import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSalespersonClients } from '@/hooks/useSalespersonClients';
import { groupByCurrency } from '@/lib/utils';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { calcItemCbm, calcItemWeight, calcChargeableWeight, getEffectiveVolume } from '@/components/quotes/ModeFields';
import { Plus, Search, Copy, CircleCheck, XCircle, FileText, Clock, Ship, Sparkles } from 'lucide-react';
import { QuoteCreateModal } from '@/components/quotes/QuoteCreateModal';
import { QuoteDetail } from '@/components/quotes/QuoteDetail';
import { DuplicateQuoteDialog } from '@/components/quotes/DuplicateQuoteDialog';
import { RejectQuoteDialog } from '@/components/quotes/RejectQuoteDialog';
import { AiImportQuoteModal } from '@/components/quotes/AiImportQuoteModal';
import { useAddonGate } from '@/components/billing/ModuleGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ModeIcon } from '@/components/shared/ModeIcon';
import { format, startOfMonth } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/shared/SortableHeader';

function getSentIconColor(quote: any): string {
  if (quote.sent_at) return 'text-status-completed';
  const created = new Date(quote.created_at).getTime();
  const now = Date.now();
  const hours24 = 24 * 60 * 60 * 1000;
  if (now - created > hours24) return 'text-orange-500';
  return 'text-muted-foreground';
}

function getSentTooltip(quote: any, t: (key: string) => string): string {
  if (quote.sent_at) return `${t('quotes.sent_at')}: ${format(new Date(quote.sent_at), 'dd/MM/yy HH:mm')}`;
  const created = new Date(quote.created_at).getTime();
  const now = Date.now();
  const hours24 = 24 * 60 * 60 * 1000;
  if (now - created > hours24) return t('quotes.not_sent_warning');
  return t('quotes.mark_sent');
}

function computeQuoteProfitBrl(q: any, usdBrl: number, eurBrl: number): number {
  const qCharges = q.quote_charges || [];
  const qItems = (q.quote_items || []).map((item: any) => ({
    container_type: item.container_type || '20GP',
    container_qty: item.container_qty || 1,
    weight_kg: String(item.weight_kg || ''),
    volume_cbm: String(item.volume_cbm || ''),
    chargeable_weight: String(item.chargeable_weight || ''),
    length_cm: String(item.length_cm || ''),
    width_cm: String(item.width_cm || ''),
    height_cm: String(item.height_cm || ''),
    packages: String(item.packages || ''),
    ncm_code: item.ncm_code || '',
    commodity: item.commodity || '',
    dangerous_goods: item.dangerous_goods || false,
    vehicle_type: item.vehicle_type || '',
  }));
  const totalWeight = qItems.reduce((s: number, i: any) => s + calcItemWeight(i), 0);
  const totalCbm = qItems.reduce((s: number, i: any) => s + getEffectiveVolume(i), 0);
  const totalChargeable = calcChargeableWeight(qItems, q.transport_mode);
  const totalContainers = qItems.reduce((s: number, i: any) => s + (i.container_qty || 1), 0);
  const totalContainers20 = qItems.reduce((s: number, i: any) => s + ((i.container_type || '').startsWith('20') ? (i.container_qty || 1) : 0), 0);
  const totalContainers40 = qItems.reduce((s: number, i: any) => s + ((i.container_type || '').startsWith('40') ? (i.container_qty || 1) : 0), 0);
  const mult = (unit: string) => {
    switch (unit) {
      case 'per_cw': return totalChargeable;
      case 'per_ton': return totalWeight / 1000;
      case 'per_cbm': return totalCbm;
      case 'per_container': return totalContainers;
      case 'per_container_20': return totalContainers20;
      case 'per_container_40': return totalContainers40;
      case 'per_bl': return 1;
      default: return 1;
    }
  };
  const sellMap = groupByCurrency(qCharges, (c: any) => c.currency || 'USD', (c: any) => (c.sell_amount || 0) * mult(c.billing_unit || 'fixed'));
  const buyMap = groupByCurrency(qCharges, (c: any) => c.currency || 'USD', (c: any) => (c.buy_amount || 0) * mult(c.billing_unit || 'fixed'));
  const allCurs = [...new Set([...Object.keys(sellMap), ...Object.keys(buyMap)])];
  let totalBrl = 0;
  allCurs.forEach((cur) => {
    const val = (sellMap[cur] || 0) - (buyMap[cur] || 0);
    if (cur === 'BRL') totalBrl += val;
    else if (cur === 'USD') totalBrl += val * (usdBrl || 0);
    else if (cur === 'EUR') totalBrl += val * (eurBrl || 0);
    else totalBrl += val * (usdBrl || 0);
  });
  return totalBrl;
}

export default function Quotes() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { usdBrl, eurBrl } = useExchangeRate();
  const { isSalesperson, clientIds } = useSalespersonClients();
  const { profile } = useAuth();
  const aiImportGate = useAddonGate('ai_import');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [duplicateQuote, setDuplicateQuote] = useState<any>(null);
  const [rejectQuote, setRejectQuote] = useState<any>(null);

  // All quotes for the list (excluding approved/converted)
  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes', isSalesperson, clientIds],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select('id, quote_number, status, transport_mode, origin, destination, valid_until, created_at, sent_at, client_id, currency, clients(name), quote_charges(id, sell_amount, buy_amount, currency, billing_unit), quote_items(container_type, container_qty, weight_kg, volume_cbm, chargeable_weight, length_cm, width_cm, height_cm, packages, commodity, dangerous_goods, vehicle_type)')
        .not('status', 'in', '("approved","converted")')
        .order('created_at', { ascending: false });
      
      if (isSalesperson && clientIds && clientIds.length > 0) {
        query = query.in('client_id', clientIds);
      } else if (isSalesperson) {
        return [];
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Stats: quotes this month (all statuses)
  const monthStart = startOfMonth(new Date()).toISOString();
  const { data: monthTotal = 0 } = useQuery({
    queryKey: ['quotes-month-total', isSalesperson, clientIds],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart);
      if (isSalesperson && clientIds && clientIds.length > 0) {
        query = query.in('client_id', clientIds);
      } else if (isSalesperson) return 0;
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Stats: pending response — sent but no approval/rejection (all months)
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['quotes-pending', isSalesperson, clientIds],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .in('status', ['quoting', 'draft', 'sent']);
      if (isSalesperson && clientIds && clientIds.length > 0) {
        query = query.in('client_id', clientIds);
      } else if (isSalesperson) return 0;
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Stats: converted to shipment (this month only)
  const { data: convertedCount = 0 } = useQuery({
    queryKey: ['quotes-converted', isSalesperson, clientIds],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .in('status', ['approved', 'converted'])
        .gte('updated_at', monthStart);
      if (isSalesperson && clientIds && clientIds.length > 0) {
        query = query.in('client_id', clientIds);
      } else if (isSalesperson) return 0;
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const filtered = quotes.filter((q: any) =>
    q.quote_number?.toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sortState, toggleSort } = useTableSort<any>(filtered, {
    quote_number: (r) => r.quote_number,
    client: (r) => r.clients?.name,
    origin: (r) => r.origin,
    destination: (r) => r.destination,
    profit: (r) => computeQuoteProfitBrl(r, usdBrl, eurBrl),
    valid_until: (r) => r.valid_until,
    status: (r) => r.status,
  }, { storageKey: profile?.user_id ? `aura:sort:${profile.user_id}:quotes` : undefined });

  async function handleMarkSent(e: React.MouseEvent, quote: any) {
    e.stopPropagation();
    if (quote.sent_at) return; // Already sent
    try {
      const { error } = await (supabase.from('quotes') as any)
        .update({ sent_at: new Date().toISOString(), status: 'sent' })
        .eq('id', quote.id);
      if (error) throw error;
      toast.success(t('quotes.marked_sent_success'));
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (selectedQuoteId) {
    return (
      <QuoteDetail
        quoteId={selectedQuoteId}
        onBack={() => {
          setSelectedQuoteId(null);
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('quotes.title')}</h1>
        <div className="flex gap-2">
          {/* Importar com IA — escondido por hora enquanto a integração de IA está sendo ajustada.
              Pra reativar: descomenta este bloco. */}
          {false && (
            <Button
              variant="outline"
              onClick={() => {
                if (!aiImportGate.hasAccess) {
                  toast.info('Este recurso é um add-on. Ative em Assinatura.');
                  return;
                }
                setAiImportOpen(true);
              }}
              title={aiImportGate.lockedTitle}
              className={!aiImportGate.hasAccess ? 'opacity-60' : ''}
            >
              <Sparkles className="w-4 h-4 mr-2" />Importar com IA
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />{t('quotes.new')}</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('quotes.month_total')}</p>
              <p className="text-2xl font-bold">{monthTotal}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/10 p-2.5">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('quotes.pending_response')}</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-status-completed/10 p-2.5">
              <Ship className="w-5 h-5 text-status-completed" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('quotes.converted_count')}</p>
              <p className="text-2xl font-bold">{convertedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader label={t('quotes.number')} sortKey="quote_number" state={sortState} onToggle={toggleSort} />
                <SortableHeader label={t('shipments.client')} sortKey="client" state={sortState} onToggle={toggleSort} />
                <SortableHeader label={t('shipments.origin')} sortKey="origin" state={sortState} onToggle={toggleSort} />
                <SortableHeader label={t('shipments.destination')} sortKey="destination" state={sortState} onToggle={toggleSort} />
                <SortableHeader label="Lucro Estimado" sortKey="profit" state={sortState} onToggle={toggleSort} className="text-right" align="right" />
                <SortableHeader label={t('quotes.valid_until')} sortKey="valid_until" state={sortState} onToggle={toggleSort} />
                <SortableHeader label={t('shipments.status')} sortKey="status" state={sortState} onToggle={toggleSort} />
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">{t('common.no_data')}</TableCell></TableRow>
              ) : (
                sorted.map((q: any) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer hover:bg-secondary/50"
                    onClick={() => setSelectedQuoteId(q.id)}
                  >
                    <TableCell className="font-mono font-medium">{q.quote_number}</TableCell>
                    <TableCell>{(q.clients as any)?.name || '-'}</TableCell>
                    <TableCell>{q.origin || '-'}</TableCell>
                    <TableCell>{q.destination || '-'}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {(() => {
                        const qCharges = (q as any).quote_charges || [];
                        const qItems = ((q as any).quote_items || []).map((item: any) => ({
                          container_type: item.container_type || '20GP',
                          container_qty: item.container_qty || 1,
                          weight_kg: String(item.weight_kg || ''),
                          volume_cbm: String(item.volume_cbm || ''),
                          chargeable_weight: String(item.chargeable_weight || ''),
                          length_cm: String(item.length_cm || ''),
                          width_cm: String(item.width_cm || ''),
                          height_cm: String(item.height_cm || ''),
                          packages: String(item.packages || ''),
                          ncm_code: item.ncm_code || '',
                          commodity: item.commodity || '',
                          dangerous_goods: item.dangerous_goods || false,
                          vehicle_type: item.vehicle_type || '',
                        }));
                        
                        const totalWeight = qItems.reduce((s: number, i: any) => s + calcItemWeight(i), 0);
                        const totalCbm = qItems.reduce((s: number, i: any) => s + getEffectiveVolume(i), 0);
                        const totalChargeable = calcChargeableWeight(qItems, q.transport_mode);
                        const totalContainers = qItems.reduce((s: number, i: any) => s + (i.container_qty || 1), 0);
                        const totalContainers20 = qItems.reduce((s: number, i: any) => s + ((i.container_type || '').startsWith('20') ? (i.container_qty || 1) : 0), 0);
                        const totalContainers40 = qItems.reduce((s: number, i: any) => s + ((i.container_type || '').startsWith('40') ? (i.container_qty || 1) : 0), 0);
                        
                        function getMultiplier(unit: string): number {
                          switch (unit) {
                            case 'per_cw': return totalChargeable;
                            case 'per_ton': return totalWeight / 1000;
                            case 'per_cbm': return totalCbm;
                            case 'per_container': return totalContainers;
                            case 'per_container_20': return totalContainers20;
                            case 'per_container_40': return totalContainers40;
                            case 'per_bl': return 1;
                            default: return 1;
                          }
                        }
                        
                        const sellMap = groupByCurrency(qCharges, (c: any) => c.currency || 'USD', (c: any) => (c.sell_amount || 0) * getMultiplier(c.billing_unit || 'fixed'));
                        const buyMap = groupByCurrency(qCharges, (c: any) => c.currency || 'USD', (c: any) => (c.buy_amount || 0) * getMultiplier(c.billing_unit || 'fixed'));
                        const allCurs = [...new Set([...Object.keys(sellMap), ...Object.keys(buyMap)])];
                        const profitMap: Record<string, number> = {};
                        allCurs.forEach((cur) => { profitMap[cur] = (sellMap[cur] || 0) - (buyMap[cur] || 0); });
                        
                        // Convert all to BRL
                        let totalBrl = 0;
                        Object.entries(profitMap).forEach(([cur, val]) => {
                          if (cur === 'BRL') totalBrl += val;
                          else if (cur === 'USD') totalBrl += val * (usdBrl || 0);
                          else if (cur === 'EUR') totalBrl += val * (eurBrl || 0);
                          else totalBrl += val * (usdBrl || 0);
                        });
                        
                        return (
                          <span className={totalBrl >= 0 ? 'text-status-completed' : 'text-status-urgent'}>
                            R$ {totalBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{q.valid_until ? format(new Date(q.valid_until), 'dd/MM/yy') : '-'}</TableCell>
                    <TableCell><StatusBadge status={q.status} /></TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1">
                        {/* Mark as sent */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => handleMarkSent(e, q)}
                            >
                              <CircleCheck className={`w-4 h-4 ${getSentIconColor(q)}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{getSentTooltip(q, t)}</TooltipContent>
                        </Tooltip>

                        {/* Reject */}
                        {q.status !== 'rejected' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRejectQuote(q);
                                }}
                              >
                                <XCircle className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('quotes.reject')}</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Duplicate */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDuplicateQuote(q);
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('quotes.duplicate')}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <QuoteCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['quotes'] })}
      />

      <AiImportQuoteModal
        open={aiImportOpen}
        onClose={() => setAiImportOpen(false)}
        onCreated={(quoteId) => {
          setAiImportOpen(false);
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
          setSelectedQuoteId(quoteId);
        }}
      />

      <DuplicateQuoteDialog
        quote={duplicateQuote}
        onClose={() => setDuplicateQuote(null)}
        onDuplicated={() => {
          setDuplicateQuote(null);
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }}
      />

      <RejectQuoteDialog
        quote={rejectQuote}
        onClose={() => setRejectQuote(null)}
        onRejected={() => {
          setRejectQuote(null);
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }}
      />
    </div>
  );
}
