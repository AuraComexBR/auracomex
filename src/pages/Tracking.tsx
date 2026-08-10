import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModeIcon } from '@/components/shared/ModeIcon';
import { Ship, MapPin, ArrowRight, Package, FileText, Download, Eye, Calendar, Clock, Lock, AlertTriangle, BellRing, ExternalLink, ChevronDown, NotebookPen } from 'lucide-react';
import { format } from 'date-fns';
import { StatusTimeline } from '@/components/tracking/StatusTimeline';
import { buildTimeline } from '@/lib/shipmentTimeline';
import { FlagIcon } from '@/components/shared/FlagIcon';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { buildCourierTrackingUrl, cn } from '@/lib/utils';
import { CARRIER_LABEL_BY_MODE } from '@/lib/carrierLabel';
import { STATUS_CATEGORY_COLORS, DEFAULT_STATUS_OPTIONS, resolveStatusCategory, type StatusOption } from '@/lib/shipmentStatusCategory';
import { parseContainerNumbers } from '@/lib/containerNumbers';
import { DOC_TYPE_LABELS } from '@/lib/documentCategory';

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

const CUSTOMS_CHANNEL_LABELS: Record<string, { label: string; badgeClass: string }> = {
  green: { label: 'Canal Verde', badgeClass: 'bg-green-500/10 text-green-600' },
  yellow: { label: 'Canal Amarelo', badgeClass: 'bg-amber-500/10 text-amber-600' },
  red: { label: 'Canal Vermelho', badgeClass: 'bg-red-500/10 text-red-600' },
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

export default function Tracking() {
  const { clientCnpj } = useParams<{ clientCnpj: string }>();
  const [filter, setFilter] = useState<FilterTab>('active');
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [company, setCompany] = useState<any>(null);
  const [logoError, setLogoError] = useState(false);
  const { data: platformSettings } = usePlatformSettings();

  // Step 1: Lookup client by CNPJ via edge function
  const { data: lookupResult, isLoading: lookupLoading } = useQuery({
    queryKey: ['tracking-lookup', clientCnpj],
    queryFn: async () => {
      const result = await callTracking({ action: 'lookup', tax_id: clientCnpj });
      setClientId(result.client_id);
      setClientName(result.name);
      return result;
    },
    enabled: !!clientCnpj,
    retry: false,
  });

  // Shipments query via edge function — vem junto a categoria de cada status
  // da empresa (statusOptions), usada pra orientar a linha do tempo genérica.
  const { data: shipmentsResult } = useQuery({
    queryKey: ['tracking-shipments', clientId, filter],
    queryFn: async () => {
      const result = await callTracking({ action: 'shipments', client_id: clientId, filter });
      return { shipments: result.shipments || [], statusOptions: (result.status_options || []) as StatusOption[] };
    },
    enabled: !!clientId && authenticated && filter !== 'quotes',
  });
  const shipments = shipmentsResult?.shipments ?? [];
  const statusOptions = shipmentsResult?.statusOptions?.length ? shipmentsResult.statusOptions : DEFAULT_STATUS_OPTIONS;

  // Quotes query via edge function
  const { data: quotes = [] } = useQuery({
    queryKey: ['tracking-quotes', clientId],
    queryFn: async () => {
      const result = await callTracking({ action: 'quotes', client_id: clientId });
      return result.quotes || [];
    },
    enabled: !!clientId && authenticated && filter === 'quotes',
  });

  // Documents for shipments
  const shipmentIds = shipments.map((s: any) => s.id);
  const { data: trackingDocs = [] } = useQuery({
    queryKey: ['tracking-docs', shipmentIds],
    queryFn: async () => {
      if (shipmentIds.length === 0) return [];
      const result = await callTracking({ action: 'documents', shipment_ids: shipmentIds });
      return result.documents || [];
    },
    enabled: shipmentIds.length > 0 && authenticated,
  });

  // Diário do processo — só as atualizações marcadas como visíveis no tracking
  const { data: trackingEvents = [] } = useQuery({
    queryKey: ['tracking-events', shipmentIds],
    queryFn: async () => {
      if (shipmentIds.length === 0) return [];
      const result = await callTracking({ action: 'events', shipment_ids: shipmentIds });
      return result.events || [];
    },
    enabled: shipmentIds.length > 0 && authenticated,
  });

  // Documents for quotes
  const quoteIds = quotes.map((q: any) => q.id);
  const { data: quoteDocs = [] } = useQuery({
    queryKey: ['tracking-quote-docs', quoteIds],
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
        setAuthenticated(true);
        setCompany(result.company);
        setPinError(false);
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
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center gap-4">
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
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
              <div className="grid gap-4">
                {shipments.map((s: any, idx: number) => (
                  <ShipmentCard
                    key={s.id}
                    shipment={s}
                    docs={trackingDocs.filter((d: any) => d.shipment_id === s.id)}
                    events={trackingEvents.filter((e: any) => e.shipment_id === s.id)}
                    statusOptions={statusOptions}
                    defaultExpanded={shipments.length === 1 || idx === 0}
                  />
                ))}
              </div>
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

function ShipmentCard({ shipment: s, docs, events, statusOptions, defaultExpanded }: { shipment: any; docs: any[]; events: any[]; statusOptions: StatusOption[]; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { steps, kpis } = buildTimeline(s, statusOptions);
  const category = resolveStatusCategory(s.status, statusOptions);
  const statusMeta = statusOptions.find((o) => o.value === s.status);
  const statusLabel = statusMeta?.label || s.status;
  const statusBadgeClass = STATUS_CATEGORY_COLORS[category] || '';
  const containers = parseContainerNumbers(s.container_number);
  const carrierLabel = CARRIER_LABEL_BY_MODE[s.transport_mode] || 'Armador';
  const channelMeta = s.customs_channel ? CUSTOMS_CHANNEL_LABELS[s.customs_channel] : null;
  const demurrageDays = !kpis.isFinished && !kpis.isCancelled && !s.cargo_delivered_at ? daysUntil(s.demurrage_deadline) : null;
  const storageDays = !kpis.isFinished && !kpis.isCancelled && !s.cargo_delivered_at ? daysUntil(s.storage_deadline) : null;

  return (
    <Card className="glass hover:shadow-md transition-shadow">
      {/* Cabeçalho — sempre visível, clicável pra expandir/colapsar. Colapsado
          mostra o resumo completo (ref Aura, ref cliente, origem, destino,
          status); expandido mostra só a referência, pra não repetir a linha
          de baixo (que já traz tudo isso, mais completo). */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-5 flex items-center justify-between gap-3"
      >
        {expanded ? (
          <span className="font-mono font-bold text-lg">{s.reference_number}</span>
        ) : (
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <span className="font-mono font-bold text-lg shrink-0">{s.reference_number}</span>
            {s.client_reference && (
              <Badge variant="outline" className="font-mono font-normal shrink-0">{s.client_reference}</Badge>
            )}
            <span className="flex items-center gap-1.5 text-sm min-w-0">
              <FlagIcon country={s.origin_country} />
              <span className="truncate">{s.origin_city || s.origin_port || '—'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <FlagIcon country={s.destination_country} />
              <span className="truncate">{s.destination_city || s.destination_port || '—'}</span>
            </span>
            <Badge className={cn(statusBadgeClass, 'shrink-0')}>{statusLabel}</Badge>
          </div>
        )}
        <ChevronDown className={cn('w-5 h-5 text-muted-foreground shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-4 border-t border-border pt-4">
            {/* Status - Modal - Origem - Transbordo(se houver) - Destino - Incoterm */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
              {s.client_reference && (
                <Badge variant="outline" className="font-mono font-normal">{s.client_reference}</Badge>
              )}
              <Badge className={statusBadgeClass}>{statusLabel}</Badge>
              {channelMeta && <Badge className={channelMeta.badgeClass}>{channelMeta.label}</Badge>}
              <ModeIcon mode={s.transport_mode} showLabel />
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
              {s.incoterm && <Badge variant="outline">{s.incoterm}</Badge>}
            </div>

            {/* ETD - ETA - Transit Time - Restam */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30">
              <Kpi label="ETD" value={s.etd ? format(new Date(s.etd), 'dd/MM/yyyy') : '—'} />
              <Kpi label="ETA" value={s.eta ? format(new Date(s.eta), 'dd/MM/yyyy') : '—'} />
              <Kpi
                label="Transit Time"
                value={kpis.transitTime !== null ? `${kpis.transitTime} dias` : '—'}
              />
              <Kpi
                label={kpis.isDelayed ? 'Atraso' : kpis.isFinished ? 'Status' : 'Restam'}
                value={
                  kpis.isCancelled
                    ? 'Cancelado'
                    : kpis.isFinished
                    ? 'Concluído'
                    : kpis.isDelayed && kpis.daysRemaining !== null
                    ? `${Math.abs(kpis.daysRemaining)} dias`
                    : kpis.daysRemaining !== null
                    ? `${kpis.daysRemaining} dias`
                    : '—'
                }
                tone={kpis.isDelayed ? 'danger' : kpis.arrivingSoon ? 'warning' : 'default'}
              />
            </div>

            {/* Linha do tempo — 5 marcos genéricos, orientados pela categoria do status */}
            {!kpis.isCancelled ? (
              <StatusTimeline steps={steps} />
            ) : (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-500/10 rounded-md px-3 py-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Processo cancelado.</span>
              </div>
            )}

            {/* Armador - Navio - Nº Master */}
            {(s.carrier || s.vessel_flight || s.master_bl) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 text-xs pt-2 border-t border-border">
                <DetailItem label={carrierLabel} value={s.carrier || '—'} />
                <DetailItem label="Navio/Voo" value={s.vessel_flight || '—'} />
                <DetailItem label="Nº Master (BL/AWB)" value={s.master_bl || '—'} />
              </div>
            )}

            {/* Referências e prazos — mesmos campos da aba Logística interna,
                pra o cliente acompanhar sem precisar perguntar. Só aparecem
                quando preenchidos. */}
            {(s.invoice_number || s.container_quantity || s.free_time != null || s.terminal_entry_date || s.customs_registration_date || s.demurrage_deadline) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs pt-2 border-t border-border">
                {s.invoice_number && <DetailItem label="Nº Invoice" value={s.invoice_number} />}
                {s.container_quantity != null && <DetailItem label="Qtd. Container" value={String(s.container_quantity)} />}
                {s.free_time != null && <DetailItem label="FreeTime" value={`${s.free_time} dias`} />}
                {s.terminal_entry_date && <DetailItem label="Ent. Terminal" value={format(new Date(s.terminal_entry_date), 'dd/MM/yyyy')} />}
                {s.customs_registration_date && <DetailItem label="Registro DI" value={format(new Date(s.customs_registration_date), 'dd/MM/yyyy')} />}
                {s.demurrage_deadline && <DetailItem label="Demurrage" value={format(new Date(s.demurrage_deadline), 'dd/MM/yyyy')} />}
              </div>
            )}

            {/* Containers — sempre 3 por linha */}
            {containers.length > 0 && (
              <div className="pt-2 border-t border-border space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Containers</p>
                <div className="grid grid-cols-3 gap-2">
                  {containers.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-center font-mono text-xs font-semibold"
                    >
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Courier tracking */}
            {s.courier_tracking_number && (
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
            {kpis.isDelayed && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-500/10 rounded-md px-3 py-2">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  Atraso: ETA em {format(new Date(s.eta), 'dd/MM/yyyy')} já passou.
                </span>
              </div>
            )}
            {!kpis.isDelayed && kpis.arrivingSoon && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-500/10 rounded-md px-3 py-2">
                <BellRing className="w-4 h-4" />
                <span>Chegada prevista em {kpis.daysRemaining} dia(s).</span>
              </div>
            )}
            {s.next_update && (
              <div className="text-xs text-muted-foreground">
                Próxima atualização: {format(new Date(s.next_update), 'dd/MM/yyyy')}
              </div>
            )}

            {/* Alertas de prazo — demurrage e 1º período de armazenagem geram
                custo extra se estourarem, por isso ganham o mesmo destaque
                visual do alerta de atraso. */}
            {demurrageDays !== null && (
              <div className={cn(
                'flex items-center gap-2 text-xs rounded-md px-3 py-2',
                demurrageDays < 0 ? 'text-red-600 bg-red-500/10' : demurrageDays <= 3 ? 'text-amber-700 bg-amber-500/10' : 'hidden'
              )}>
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {demurrageDays < 0
                    ? `Prazo de demurrage vencido há ${Math.abs(demurrageDays)} dia(s).`
                    : `Prazo de demurrage vence em ${demurrageDays} dia(s).`}
                </span>
              </div>
            )}
            {storageDays !== null && (
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

            {/* Diário do processo — atualizações que a empresa marcou como
                visíveis no tracking, equivalente ao histórico datado que
                antes só existia numa planilha interna. */}
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
        </CardContent>
      )}
    </Card>
  );
}

function countryFallback(code?: string | null) {
  return code || '';
}

function Kpi({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  const toneCls =
    tone === 'danger' ? 'text-red-600' : tone === 'warning' ? 'text-amber-600' : 'text-foreground';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
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
