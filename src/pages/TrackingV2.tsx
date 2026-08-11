import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { ColumnSearch } from '@/components/shared/ColumnSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModeIcon } from '@/components/shared/ModeIcon';
import { Ship, MapPin, ArrowRight, Package, FileText, Download, Eye, Calendar, Clock, Lock, AlertTriangle, BellRing, ExternalLink, ChevronDown, NotebookPen, RefreshCw, LogOut } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { buildTimeline } from '@/lib/shipmentTimeline';
import { FlagIcon } from '@/components/shared/FlagIcon';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { buildCourierTrackingUrl, cn } from '@/lib/utils';
import { STATUS_CATEGORY_COLORS, DEFAULT_STATUS_OPTIONS, resolveStatusCategory, type StatusOption } from '@/lib/shipmentStatusCategory';
import { parseContainerNumbers, parseContainerDates } from '@/lib/containerNumbers';
import { DOC_TYPE_LABELS } from '@/lib/documentCategory';
import { normalizeTrackingFieldVisibility, type TrackingFieldVisibility } from '@/lib/trackingFieldRegistry';

// ============================================================================
// TrackingV2 — layout reformulado do portal de rastreamento do cliente.
// Página PARALELA à Tracking.tsx original (não usada em produção ainda),
// criada só pra comparação/validação antes de substituir a atual. Mesma
// lógica de dados (auth por PIN, queries, docs, diário do processo) — a
// diferença é a estrutura das colunas/linhas da lista de embarques:
//
//   Colapsada: Ref - Ref.Cliente - Status - ETA - ETD - Limite Devolução -
//              DUIMP (cor pelo canal) - Físico
//   Expandida: + linha Shipper/Armador/Navio/Origem-Destino/Transit Time/
//              Free Time, + linha Invoice/BL/Containers (dinâmico)
// ============================================================================

const quoteStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  quoting: 'Cotando',
  sent: 'Enviada',
  rejected: 'Rejeitada',
  converted: 'Convertida',
};

const quoteStatusColors: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-600',
  quoting: 'bg-yellow-500/10 text-yellow-600',
  sent: 'bg-blue-500/10 text-blue-600',
  rejected: 'bg-red-500/10 text-red-600',
  converted: 'bg-green-500/10 text-green-600',
};

type FilterTab = 'active' | 'finished' | 'quotes';

// DUIMP colorido pelo canal de conferência — mesmas cores usadas no badge de
// Canal (verde/amarelo/vermelho), aplicadas diretamente no texto do número
// DUIMP na visão colapsada (sem badge, pra caber na linha).
const CUSTOMS_CHANNEL_LABELS: Record<string, { label: string; badgeClass: string; textClass: string }> = {
  green: { label: 'Canal Verde', badgeClass: 'bg-green-500/10 text-green-600', textClass: 'text-green-600' },
  yellow: { label: 'Canal Amarelo', badgeClass: 'bg-amber-500/10 text-amber-600', textClass: 'text-amber-600' },
  red: { label: 'Canal Vermelho', badgeClass: 'bg-red-500/10 text-red-600', textClass: 'text-red-600' },
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  booking: 'Reserva',
  origin: 'Origem',
  transit: 'Trânsito',
  customs: 'Desembaraço',
  delivery: 'Entrega',
  billing: 'Faturamento',
  update: 'Atualização',
};

/** Dias até uma data-limite (negativo = já venceu). */
function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

async function callTracking(body: any) {
  const { data, error } = await supabase.functions.invoke('tracking', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// Sessão do tracking fica guardada no sessionStorage (por CNPJ), não em
// localStorage — mesmo padrão da página original.
function trackingSessionKey(clientCnpj: string) {
  return `aura:trackingv2:auth:${clientCnpj}`;
}

export default function TrackingV2() {
  const { clientCnpj } = useParams<{ clientCnpj: string }>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>('active');
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [company, setCompany] = useState<any>(null);
  const [fieldVisibility, setFieldVisibility] = useState<TrackingFieldVisibility>({ collapsed: [], expanded: [] });
  const [logoError, setLogoError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data: platformSettings } = usePlatformSettings();

  useEffect(() => {
    if (!clientCnpj) return;
    try {
      const raw = sessionStorage.getItem(trackingSessionKey(clientCnpj));
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.authenticated) {
          setAuthenticated(true);
          setCompany(saved.company || null);
          setFieldVisibility(normalizeTrackingFieldVisibility(saved.field_visibility));
        }
      }
    } catch {
      // ignore
    }
  }, [clientCnpj]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('trackingv2-'),
      });
    } finally {
      setRefreshing(false);
    }
  }

  function handleLogout() {
    if (clientCnpj) {
      try { sessionStorage.removeItem(trackingSessionKey(clientCnpj)); } catch { /* ignore */ }
    }
    setAuthenticated(false);
    setCompany(null);
    setFieldVisibility({ collapsed: [], expanded: [] });
    setPin('');
  }

  const { data: lookupResult, isLoading: lookupLoading } = useQuery({
    queryKey: ['trackingv2-lookup', clientCnpj],
    queryFn: async () => {
      const result = await callTracking({ action: 'lookup', tax_id: clientCnpj });
      setClientId(result.client_id);
      setClientName(result.name);
      return result;
    },
    enabled: !!clientCnpj,
    retry: false,
  });

  const { data: shipmentsResult, dataUpdatedAt: shipmentsUpdatedAt } = useQuery({
    queryKey: ['trackingv2-shipments', clientId, filter],
    queryFn: async () => {
      const result = await callTracking({ action: 'shipments', client_id: clientId, filter, field_visibility_mode: true });
      // A visibilidade vem fresca em toda consulta de shipments — mantém a
      // sessão do navegador do cliente em dia mesmo se a empresa mudou a
      // configuração em Cadastros depois que ele já tinha logado.
      if (result.field_visibility) {
        const visibility = normalizeTrackingFieldVisibility(result.field_visibility);
        setFieldVisibility(visibility);
        if (clientCnpj) {
          try {
            const raw = sessionStorage.getItem(trackingSessionKey(clientCnpj));
            const saved = raw ? JSON.parse(raw) : {};
            sessionStorage.setItem(trackingSessionKey(clientCnpj), JSON.stringify({ ...saved, authenticated: true, field_visibility: visibility }));
          } catch {
            // ignore
          }
        }
      }
      return { shipments: result.shipments || [], statusOptions: (result.status_options || []) as StatusOption[] };
    },
    enabled: !!clientId && authenticated && filter !== 'quotes',
  });
  const shipments = shipmentsResult?.shipments ?? [];
  const statusOptions = shipmentsResult?.statusOptions?.length ? shipmentsResult.statusOptions : DEFAULT_STATUS_OPTIONS;
  const statusLabelMap = new Map<string, string>(statusOptions.map((o) => [o.value, o.label]));

  const [searchRef, setSearchRef] = useState('');
  const [searchClientRef, setSearchClientRef] = useState('');
  const [searchInvoice, setSearchInvoice] = useState('');
  const [searchCarrier, setSearchCarrier] = useState('');
  const [searchVessel, setSearchVessel] = useState('');
  const [searchRefOpen, setSearchRefOpen] = useState(false);
  const [searchClientRefOpen, setSearchClientRefOpen] = useState(false);
  const [searchInvoiceOpen, setSearchInvoiceOpen] = useState(false);
  const [searchCarrierOpen, setSearchCarrierOpen] = useState(false);
  const [searchVesselOpen, setSearchVesselOpen] = useState(false);

  const filteredShipments = shipments.filter((s: any) => {
    const matchesRef = !searchRef || s.reference_number?.toLowerCase().includes(searchRef.toLowerCase());
    const matchesClientRef = !searchClientRef || s.client_reference?.toLowerCase().includes(searchClientRef.toLowerCase());
    const matchesInvoice = !searchInvoice || s.invoice_number?.toLowerCase().includes(searchInvoice.toLowerCase());
    const matchesCarrier = !searchCarrier || s.carrier?.toLowerCase().includes(searchCarrier.toLowerCase());
    const matchesVessel = !searchVessel || s.vessel_flight?.toLowerCase().includes(searchVessel.toLowerCase());
    return matchesRef && matchesClientRef && matchesInvoice && matchesCarrier && matchesVessel;
  });

  const { sorted: sortedShipments, sortState, toggleSort } = useTableSort<any>(filteredShipments, {
    reference_number: (r) => r.reference_number,
    client_reference: (r) => r.client_reference,
    status: (r) => statusLabelMap.get(r.status) || r.status,
    eta: (r) => r.eta,
    etd: (r) => r.etd,
    demurrage_deadline: (r) => earliestDemurrageDeadline(r),
    duimp_number: (r) => r.duimp_number,
    physical_location: (r) => r.physical_location,
  });

  const { data: quotes = [], dataUpdatedAt: quotesUpdatedAt } = useQuery({
    queryKey: ['trackingv2-quotes', clientId],
    queryFn: async () => {
      const result = await callTracking({ action: 'quotes', client_id: clientId });
      return result.quotes || [];
    },
    enabled: !!clientId && authenticated && filter === 'quotes',
  });

  const lastUpdatedAt = Math.max(shipmentsUpdatedAt || 0, quotesUpdatedAt || 0);

  // Ref. e Status são baseline (sempre aparecem); o resto das colunas da
  // visão colapsada é opt-in, configurado por cliente em Cadastros > Clientes
  // > Tracking (ver src/lib/trackingFieldRegistry.ts).
  const isCollapsedVisible = (key: string) => fieldVisibility.collapsed.includes(key);
  const OPTIONAL_COLLAPSED_KEYS = ['client_reference', 'etd', 'eta', 'demurrage_deadline_calc', 'duimp_number', 'physical_location'];
  const visibleCollapsedColumnCount = 2 + OPTIONAL_COLLAPSED_KEYS.filter(isCollapsedVisible).length;

  const shipmentIds = shipments.map((s: any) => s.id);
  const { data: trackingDocs = [] } = useQuery({
    queryKey: ['trackingv2-docs', shipmentIds],
    queryFn: async () => {
      if (shipmentIds.length === 0) return [];
      const result = await callTracking({ action: 'documents', shipment_ids: shipmentIds });
      return result.documents || [];
    },
    enabled: shipmentIds.length > 0 && authenticated,
  });

  const { data: trackingEvents = [] } = useQuery({
    queryKey: ['trackingv2-events', shipmentIds],
    queryFn: async () => {
      if (shipmentIds.length === 0) return [];
      const result = await callTracking({ action: 'events', shipment_ids: shipmentIds });
      return result.events || [];
    },
    enabled: shipmentIds.length > 0 && authenticated,
  });

  const quoteIds = quotes.map((q: any) => q.id);
  const { data: quoteDocs = [] } = useQuery({
    queryKey: ['trackingv2-quote-docs', quoteIds],
    queryFn: async () => {
      if (quoteIds.length === 0) return [];
      const result = await callTracking({ action: 'documents', quote_ids: quoteIds });
      return result.documents || [];
    },
    enabled: quoteIds.length > 0 && authenticated,
  });

  if (!clientCnpj) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">CPF/CNPJ não informado.</p>
      </div>
    );
  }

  if (lookupLoading || (!lookupResult && !clientId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Package className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
      </div>
    );
  }

  const handlePinSubmit = async () => {
    try {
      const result = await callTracking({ action: 'auth', client_id: clientId, pin });
      if (result.authenticated) {
        const visibility = normalizeTrackingFieldVisibility(result.field_visibility);
        setAuthenticated(true);
        setCompany(result.company);
        setFieldVisibility(visibility);
        setPinError(false);
        if (clientCnpj) {
          try {
            sessionStorage.setItem(trackingSessionKey(clientCnpj), JSON.stringify({ authenticated: true, company: result.company, field_visibility: visibility }));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      setPinError(true);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm mx-4">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Acesso ao Tracking</h2>
              <p className="text-sm text-muted-foreground">
                Digite a senha de 4 dígitos para acessar.
              </p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handlePinSubmit(); }} className="space-y-3">
              <Input
                type="password"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(false); }}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
              {pinError && (
                <p className="text-sm text-destructive text-center">Senha incorreta.</p>
              )}
              <Button type="submit" className="w-full" disabled={pin.length < 4}>
                Acessar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-4 py-6 flex items-center gap-4">
          {company?.logo_url && !logoError ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-12 w-auto max-w-[180px] object-contain"
              onError={() => setLogoError(true)}
            />
          ) : platformSettings?.logo_url ? (
            <img
              src={platformSettings.logo_url}
              alt="Logo"
              className="h-12 w-auto max-w-[180px] object-contain"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Ship className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{company?.name || 'Rastreamento'}</h1>
            <p className="text-sm text-muted-foreground">{clientName} — Portal de Rastreamento</p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', refreshing && 'animate-spin')} />
                Atualizar
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} title="Sair">
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Sair
              </Button>
            </div>
            {lastUpdatedAt > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Atualizado às {format(new Date(lastUpdatedAt), 'HH:mm:ss')}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-8 space-y-6">
        <div className="flex gap-2">
          <Button variant={filter === 'active' ? 'default' : 'outline'} onClick={() => setFilter('active')} size="sm">
            Em Andamento
          </Button>
          <Button variant={filter === 'finished' ? 'default' : 'outline'} onClick={() => setFilter('finished')} size="sm">
            Finalizados
          </Button>
          <Button variant={filter === 'quotes' ? 'default' : 'outline'} onClick={() => setFilter('quotes')} size="sm">
            Cotações
          </Button>
        </div>

        {filter !== 'quotes' && (
          <>
            {shipments.length === 0 ? (
              <Card className="glass">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>Nenhum embarque encontrado.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass overflow-hidden">
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="whitespace-nowrap">
                        {/* Ref. e Status são sempre exibidos — identidade da
                            linha e categoria do status são estruturais, não
                            dá pra esconder do jeito que o resto dos campos dá. */}
                        <SortableHeader
                          label="Ref." sortKey="reference_number" state={sortState} onToggle={toggleSort} className="h-7 px-2 text-[11px]"
                          right={<ColumnSearch value={searchRef} onChange={setSearchRef} open={searchRefOpen} onOpenChange={setSearchRefOpen} />}
                        />
                        {isCollapsedVisible('client_reference') && (
                          <SortableHeader
                            label="Ref. Cliente" sortKey="client_reference" state={sortState} onToggle={toggleSort} className="h-7 px-2 text-[11px]"
                            right={<ColumnSearch value={searchClientRef} onChange={setSearchClientRef} open={searchClientRefOpen} onOpenChange={setSearchClientRefOpen} />}
                          />
                        )}
                        <SortableHeader label="Status" sortKey="status" state={sortState} onToggle={toggleSort} className="h-7 px-2 text-[11px]" />
                        {isCollapsedVisible('etd') && (
                          <SortableHeader label="ETD" sortKey="etd" state={sortState} onToggle={toggleSort} className="h-7 px-2 text-[11px]" />
                        )}
                        {isCollapsedVisible('eta') && (
                          <SortableHeader label="ETA" sortKey="eta" state={sortState} onToggle={toggleSort} className="h-7 px-2 text-[11px]" />
                        )}
                        {isCollapsedVisible('demurrage_deadline_calc') && (
                          <SortableHeader label="Limite Devolução" sortKey="demurrage_deadline" state={sortState} onToggle={toggleSort} className="h-7 px-2 text-[11px]" />
                        )}
                        {isCollapsedVisible('duimp_number') && (
                          <SortableHeader label="DUIMP" sortKey="duimp_number" state={sortState} onToggle={toggleSort} className="h-7 px-2 text-[11px]" />
                        )}
                        {isCollapsedVisible('physical_location') && (
                          <SortableHeader label="Físico" sortKey="physical_location" state={sortState} onToggle={toggleSort} className="h-7 px-2 text-[11px]" />
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedShipments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={visibleCollapsedColumnCount} className="text-center py-8 text-muted-foreground">
                            Nenhum resultado encontrado para a busca.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedShipments.map((s: any) => (
                          <ShipmentRow
                            key={s.id}
                            shipment={s}
                            docs={trackingDocs.filter((d: any) => d.shipment_id === s.id)}
                            events={trackingEvents.filter((e: any) => e.shipment_id === s.id)}
                            statusOptions={statusOptions}
                            defaultExpanded={false}
                            fieldVisibility={fieldVisibility}
                            colSpan={visibleCollapsedColumnCount}
                          />
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {filter === 'quotes' && (
          <>
            {quotes.length === 0 ? (
              <Card className="glass">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma cotação encontrada.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {quotes.map((q: any) => (
                  <QuoteCard key={q.id} quote={q} docs={quoteDocs.filter((d: any) => d.quote_id === q.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function shortDate(value?: string | null) {
  return value ? format(new Date(value), 'dd/MM/yy') : '—';
}

// Limite Devolução por container = Entrada no Terminal + FreeTime (início/fim
// da contagem, respectivamente). Monta a lista de prazos calculados, um por
// container que tenha Entrada no Terminal preenchida — cai no prazo antigo
// (container_demurrage_deadlines) pra containers sem Entrada no Terminal mas
// com esse campo legado já preenchido.
function containerDeadlines(s: any): Array<{ deadline: string; returned: boolean }> {
  const terminalEntries = parseContainerDates(s.container_terminal_entry_dates);
  const legacyDeadlines = parseContainerDates(s.container_demurrage_deadlines);
  const returnDates = parseContainerDates(s.container_return_dates);
  const freeTime = s.free_time != null ? Number(s.free_time) : null;
  const count = Math.max(
    parseContainerNumbers(s.container_number).length,
    terminalEntries.length,
    legacyDeadlines.length,
    returnDates.length,
  );
  const list: Array<{ deadline: string; returned: boolean }> = [];
  for (let i = 0; i < count; i++) {
    let deadline: string | null = null;
    if (terminalEntries[i] && freeTime != null) {
      deadline = addDays(new Date(terminalEntries[i]), freeTime).toISOString();
    } else if (legacyDeadlines[i]) {
      deadline = legacyDeadlines[i];
    }
    if (deadline) list.push({ deadline, returned: !!returnDates[i] });
  }
  return list;
}

// Limite Devolução exibido na coluna/ordenação — não considera se o
// container já foi devolvido (é só "qual é o prazo", informativo).
// Prioridade: 1) prazos por container (Entrada Terminal + FreeTime, ou o
// campo legado); 2) ATA + FreeTime (fallback quando não há Entrada no
// Terminal registrada por container); 3) campo antigo demurrage_deadline.
function earliestDemurrageDeadline(s: any): string | null {
  const list = containerDeadlines(s);
  if (list.length > 0) {
    return list.reduce((min, x) => (new Date(x.deadline).getTime() < new Date(min).getTime() ? x.deadline : min), list[0].deadline);
  }
  if (s.ata && s.free_time != null) {
    return addDays(new Date(s.ata), Number(s.free_time) || 0).toISOString();
  }
  return s.demurrage_deadline || null;
}

// Prazo pendente pro alerta de "limite de devolução vencido/vencendo" — igual
// ao earliestDemurrageDeadline, mas ignora containers já devolvidos. Se todos
// os containers já têm devolução registrada, não há mais risco de demurrage
// e o alerta não deve aparecer.
function pendingDemurrageDeadline(s: any): string | null {
  const list = containerDeadlines(s);
  if (list.length > 0) {
    const pending = list.filter((x) => !x.returned);
    if (pending.length === 0) return null;
    return pending.reduce((min, x) => (new Date(x.deadline).getTime() < new Date(min).getTime() ? x.deadline : min), pending[0].deadline);
  }
  // Sem prazo por container: se todos os containers do embarque já têm data
  // de devolução registrada, considera devolvido por completo.
  const containers = parseContainerNumbers(s.container_number);
  const returnDates = parseContainerDates(s.container_return_dates);
  if (containers.length > 0 && returnDates.filter(Boolean).length >= containers.length) return null;
  if (s.ata && s.free_time != null) {
    return addDays(new Date(s.ata), Number(s.free_time) || 0).toISOString();
  }
  return s.demurrage_deadline || null;
}

// Prazo 1º Período de Armazenagem = Entrada no Terminal + 10 dias, por
// container (mesma lógica do Limite Devolução, mas com prazo fixo de 10 dias
// em vez do FreeTime). Cai no campo antigo storage_deadline só quando não há
// nenhuma Entrada no Terminal por container (embarques legados).
function earliestStorageDeadline(s: any): string | null {
  const terminalEntries = parseContainerDates(s.container_terminal_entry_dates);
  const deadlines = terminalEntries.filter(Boolean).map((d) => addDays(new Date(d), 10).toISOString());
  if (deadlines.length > 0) {
    return deadlines.reduce((min, d) => (new Date(d).getTime() < new Date(min).getTime() ? d : min));
  }
  return s.storage_deadline || null;
}

function ShipmentRow({ shipment: s, docs, events, statusOptions, defaultExpanded, fieldVisibility, colSpan }: {
  shipment: any; docs: any[]; events: any[]; statusOptions: StatusOption[]; defaultExpanded: boolean;
  fieldVisibility: TrackingFieldVisibility; colSpan: number;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isCollapsedVisible = (key: string) => fieldVisibility.collapsed.includes(key);
  const isExpandedVisible = (key: string) => fieldVisibility.expanded.includes(key);
  const { kpis } = buildTimeline(s, statusOptions);
  const category = resolveStatusCategory(s.status, statusOptions);
  const statusMeta = statusOptions.find((o) => o.value === s.status);
  const statusLabel = statusMeta?.label || s.status;
  const statusBadgeClass = STATUS_CATEGORY_COLORS[category] || '';
  const containers = parseContainerNumbers(s.container_number);
  const containerReturnDates = parseContainerDates(s.container_return_dates);
  const channelMeta = s.customs_channel ? CUSTOMS_CHANNEL_LABELS[s.customs_channel] : null;
  const demurrageDeadline = earliestDemurrageDeadline(s);
  const pendingDeadline = pendingDemurrageDeadline(s);
  const demurrageDays = !kpis.isFinished && !kpis.isCancelled && !s.cargo_delivered_at ? daysUntil(pendingDeadline) : null;
  const storageDays = !kpis.isFinished && !kpis.isCancelled && !s.cargo_delivered_at ? daysUntil(earliestStorageDeadline(s)) : null;
  const demurrageUrgent = demurrageDays !== null && demurrageDays <= 3;

  return (
    <>
      {/* Linha resumo — Ref / Ref.Cliente / Status / ETA / ETD / Limite
          Devolução / DUIMP (cor pelo canal) / Físico. Clicável pra expandir. */}
      <TableRow
        className="cursor-pointer whitespace-nowrap hover:bg-muted/40"
        onClick={() => setExpanded((e) => !e)}
      >
        <TableCell className="py-1 px-2 font-mono font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform', expanded && 'rotate-180')} />
            {s.reference_number}
          </span>
        </TableCell>
        {isCollapsedVisible('client_reference') && (
          <TableCell className="py-1 px-2">
            {s.client_reference ? <Badge variant="outline" className="font-mono font-normal text-[10px] px-1.5 py-0">{s.client_reference}</Badge> : '—'}
          </TableCell>
        )}
        <TableCell className="py-1 px-2"><Badge className={cn(statusBadgeClass, 'text-[10px] px-1.5 py-0 whitespace-nowrap')}>{statusLabel}</Badge></TableCell>
        {isCollapsedVisible('etd') && (
          <TableCell className={cn('py-1 px-2', s.atd && 'font-semibold text-emerald-600')} title={s.atd ? 'Data real' : 'Estimativa'}>
            {shortDate(s.atd || s.etd)}
          </TableCell>
        )}
        {isCollapsedVisible('eta') && (
          <TableCell className={cn('py-1 px-2', s.ata && 'font-semibold text-emerald-600')} title={s.ata ? 'Data real' : 'Estimativa'}>
            {shortDate(s.ata || s.eta)}
          </TableCell>
        )}
        {isCollapsedVisible('demurrage_deadline_calc') && (
          <TableCell className={cn('py-1 px-2', demurrageUrgent && 'text-red-600 font-semibold')}>
            {shortDate(demurrageDeadline)}
          </TableCell>
        )}
        {isCollapsedVisible('duimp_number') && (
          <TableCell className={cn('py-1 px-2 font-mono max-w-[130px] truncate', channelMeta?.textClass || '')} title={channelMeta?.label}>
            {s.duimp_number || '—'}
          </TableCell>
        )}
        {isCollapsedVisible('physical_location') && (
          <TableCell className="py-1 px-2 max-w-[140px] truncate" title={s.physical_location || ''}>
            {s.physical_location || '—'}
          </TableCell>
        )}
      </TableRow>

      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className="p-0">
            <div className="space-y-4 p-5 bg-muted/20 border-t border-border">

            {/* Status - Modal - Origem - Transbordo(se houver) - Destino - Incoterm */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <Badge className={statusBadgeClass}>{statusLabel}</Badge>
              <ModeIcon mode={s.transport_mode} showLabel />
              {isExpandedVisible('route') && (
                <>
                  <span className="flex items-center gap-1.5 font-medium">
                    <FlagIcon country={s.origin_country} />
                    {s.origin_city || countryFallback(s.origin_country) || '—'}
                  </span>
                  {s.transshipment_info && (
                    <>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        Transbordo: {s.transshipment_info.name || s.transshipment_info.code}
                      </span>
                    </>
                  )}
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <span className="flex items-center gap-1.5 font-medium">
                    <FlagIcon country={s.destination_country} />
                    {s.destination_city || countryFallback(s.destination_country) || '—'}
                  </span>
                </>
              )}
              {isExpandedVisible('incoterm') && s.incoterm && <Badge variant="outline">{s.incoterm}</Badge>}
              {channelMeta && <Badge className={channelMeta.badgeClass}>{channelMeta.label}</Badge>}
            </div>

            {/* Linha 2 — Shipper / Armador / Navio / Origem e Destino / Transit Time / Free Time */}
            {(isExpandedVisible('shipper_name') || isExpandedVisible('carrier') || isExpandedVisible('vessel_flight') || isExpandedVisible('route') || isExpandedVisible('transit_time_calc') || isExpandedVisible('free_time')) && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-3 rounded-lg bg-background">
                {isExpandedVisible('shipper_name') && <DetailItem label="Shipper" value={s.shipper_name || '—'} />}
                {isExpandedVisible('carrier') && <DetailItem label="Armador" value={s.carrier || '—'} />}
                {isExpandedVisible('vessel_flight') && <DetailItem label="Navio" value={s.vessel_flight || '—'} />}
                {isExpandedVisible('route') && (
                  <DetailItem
                    label="Origem e Destino"
                    value={`${s.origin_city || countryFallback(s.origin_country) || '—'} → ${s.destination_city || countryFallback(s.destination_country) || '—'}`}
                  />
                )}
                {isExpandedVisible('transit_time_calc') && <DetailItem label="Transit Time" value={kpis.transitTime !== null ? `${kpis.transitTime} dias` : '—'} />}
                {isExpandedVisible('free_time') && <DetailItem label="Free Time" value={s.free_time != null ? `${s.free_time} dias` : '—'} />}
              </div>
            )}

            {/* Linha 3 — Invoice / BL / Containers (dinâmico, 1 card por container) */}
            {(isExpandedVisible('invoice_number') || isExpandedVisible('bl') || isExpandedVisible('container_numbers')) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-background">
                {isExpandedVisible('invoice_number') && <DetailItem label="Invoice" value={s.invoice_number || '—'} />}
                {isExpandedVisible('bl') && <DetailItem label="BL" value={s.master_bl || s.house_bl || '—'} />}
                {isExpandedVisible('container_numbers') && (
                  containers.length > 0 ? (
                    containers.map((c, i) => (
                      <DetailItem
                        key={i}
                        label={`Container #${i + 1}${isExpandedVisible('container_return') && containerReturnDates[i] ? ` — Devolvido em ${shortDate(containerReturnDates[i])}` : ''}`}
                        value={c}
                        mono
                      />
                    ))
                  ) : (
                    <DetailItem label="Container" value="—" />
                  )
                )}
              </div>
            )}

            {/* Linha do tempo removida nessa versão — as colunas Status/ETD/ETA/
                Limite Devolução já cobrem o essencial sem o componente de marcos. */}
            {kpis.isCancelled && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-500/10 rounded-md px-3 py-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Processo cancelado.</span>
              </div>
            )}

            {/* Courier tracking */}
            {isExpandedVisible('courier') && s.courier_tracking_number && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Rastreio Courier{s.courier_provider ? ` — ${s.courier_provider}` : ''}
                  </span>
                  <span className="font-mono text-sm font-semibold">{s.courier_tracking_number}</span>
                </div>
                {buildCourierTrackingUrl(s.courier_provider, s.courier_tracking_number) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(
                        buildCourierTrackingUrl(s.courier_provider, s.courier_tracking_number)!,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Rastrear
                  </Button>
                )}
              </div>
            )}

            {/* Alertas */}
            {kpis.arrivingSoon && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-500/10 rounded-md px-3 py-2">
                <BellRing className="w-4 h-4" />
                <span>Chegada prevista em {kpis.daysRemaining} dia(s).</span>
              </div>
            )}
            {isExpandedVisible('next_update') && s.next_update && (
              <div className="text-xs text-muted-foreground">
                Próxima atualização: {format(new Date(s.next_update), 'dd/MM/yyyy')}
              </div>
            )}

            {(isCollapsedVisible('demurrage_deadline_calc') || isExpandedVisible('demurrage_deadline_calc')) && demurrageDays !== null && (
              <div className={cn(
                'flex items-center gap-2 text-xs rounded-md px-3 py-2',
                demurrageDays < 0 ? 'text-red-600 bg-red-500/10' : demurrageDays <= 3 ? 'text-amber-700 bg-amber-500/10' : 'hidden'
              )}>
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {demurrageDays < 0
                    ? `Limite de devolução vencido há ${Math.abs(demurrageDays)} dia(s).`
                    : `Limite de devolução vence em ${demurrageDays} dia(s).`}
                </span>
              </div>
            )}
            {isExpandedVisible('storage_deadline_calc') && storageDays !== null && (
              <div className={cn(
                'flex items-center gap-2 text-xs rounded-md px-3 py-2',
                storageDays < 0 ? 'text-red-600 bg-red-500/10' : storageDays <= 3 ? 'text-amber-700 bg-amber-500/10' : 'hidden'
              )}>
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {storageDays < 0
                    ? `1º período de armazenagem vencido há ${Math.abs(storageDays)} dia(s).`
                    : `1º período de armazenagem vence em ${storageDays} dia(s).`}
                </span>
              </div>
            )}

            {/* Diário do processo */}
            {events.length > 0 && (
              <div className="pt-2 border-t border-border space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <NotebookPen className="w-3 h-3" /> Diário do Processo
                </p>
                <div className="space-y-2">
                  {events.map((ev: any) => (
                    <div key={ev.id} className="flex items-start gap-3 text-sm">
                      <span className="text-xs text-muted-foreground shrink-0 w-20 pt-0.5">
                        {format(new Date(ev.event_date), 'dd/MM/yyyy')}
                      </span>
                      <div className="min-w-0">
                        <Badge variant="outline" className="mb-1 font-normal">
                          {EVENT_CATEGORY_LABELS[ev.category] || ev.category}
                        </Badge>
                        <p className="whitespace-pre-wrap">{ev.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de documentos */}
            <DocsSection docs={docs} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function countryFallback(code?: string | null) {
  return code || '';
}

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold truncate', mono && 'font-mono')} title={value}>{value}</div>
    </div>
  );
}

function QuoteCard({ quote: q, docs }: { quote: any; docs: any[] }) {
  return (
    <Card className="glass hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-lg">{q.quote_number}</span>
            <Badge className={quoteStatusColors[q.status] || ''}>
              {quoteStatusLabels[q.status] || q.status}
            </Badge>
            <ModeIcon mode={q.transport_mode} showLabel />
          </div>
          {(q.origin || q.destination) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{q.origin || '—'}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span>{q.destination || '—'}</span>
            </div>
          )}
          <div className="flex gap-6 text-xs text-muted-foreground">
            {q.created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(q.created_at), 'dd/MM/yyyy')}
              </span>
            )}
            {q.valid_until && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Válida até: {format(new Date(q.valid_until), 'dd/MM/yyyy')}
              </span>
            )}
          </div>
          <DocsSection docs={docs} />
        </div>
      </CardContent>
    </Card>
  );
}

function DocsSection({ docs }: { docs: any[] }) {
  if (docs.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-1">Documentos</p>
      {docs.map((doc: any) => (
        <div key={doc.id} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="truncate">{doc.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {doc.custom_category || DOC_TYPE_LABELS[doc.document_type] || ''}
            </span>
          </div>
          {doc.file_url && (
            <div className="flex gap-1 shrink-0">
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-accent rounded">
                <Eye className="w-4 h-4 text-muted-foreground" />
              </a>
              <a href={doc.file_url} download target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-accent rounded">
                <Download className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
