import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModeIcon } from '@/components/shared/ModeIcon';
import { Ship, MapPin, ArrowRight, Package, FileText, Download, Eye, Calendar, Clock, Lock, AlertTriangle, BellRing, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { StatusTimeline } from '@/components/tracking/StatusTimeline';
import { buildTimeline } from '@/lib/shipmentTimeline';
import { countryCodeToFlag } from '@/lib/countryFlag';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { buildCourierTrackingUrl } from '@/lib/utils';

const statusLabels: Record<string, string> = {
  approved: 'Aprovado',
  booked: 'Reservado',
  collected_at_origin: 'Coletado',
  docs_at_origin: 'Docs',
  in_transit: 'Trânsito',
  arrived: 'Chegou',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  draft: 'Rascunho',
  quoting: 'Cotando',
  sent: 'Enviada',
  rejected: 'Rejeitada',
  converted: 'Convertida',
};

const statusColors: Record<string, string> = {
  approved: 'bg-emerald-500/10 text-emerald-600',
  booked: 'bg-indigo-500/10 text-indigo-600',
  collected_at_origin: 'bg-indigo-500/10 text-indigo-600',
  docs_at_origin: 'bg-indigo-500/10 text-indigo-600',
  in_transit: 'bg-amber-500/10 text-amber-600',
  arrived: 'bg-emerald-500/10 text-emerald-600',
  delivered: 'bg-green-500/10 text-green-600',
  cancelled: 'bg-red-500/10 text-red-600',
  draft: 'bg-gray-500/10 text-gray-600',
  quoting: 'bg-yellow-500/10 text-yellow-600',
  sent: 'bg-blue-500/10 text-blue-600',
  rejected: 'bg-red-500/10 text-red-600',
  converted: 'bg-green-500/10 text-green-600',
};

type FilterTab = 'active' | 'finished' | 'quotes';

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

  // Shipments query via edge function
  const { data: shipments = [] } = useQuery({
    queryKey: ['tracking-shipments', clientId, filter],
    queryFn: async () => {
      const result = await callTracking({ action: 'shipments', client_id: clientId, filter });
      return result.shipments || [];
    },
    enabled: !!clientId && authenticated && filter !== 'quotes',
  });

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
                {shipments.map((s: any) => (
                  <ShipmentCard key={s.id} shipment={s} docs={trackingDocs.filter((d: any) => d.shipment_id === s.id)} />
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

function ShipmentCard({ shipment: s, docs }: { shipment: any; docs: any[] }) {
  const { steps, kpis } = buildTimeline(s);
  const originFlag = countryCodeToFlag(s.origin_country || '');
  const destFlag = countryCodeToFlag(s.destination_country || '');

  return (
    <Card className="glass hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono font-bold text-lg">{s.reference_number}</span>
            <Badge className={statusColors[s.status] || ''}>
              {statusLabels[s.status] || s.status}
            </Badge>
            <ModeIcon mode={s.transport_mode} showLabel />
            {s.incoterm && <Badge variant="outline">{s.incoterm}</Badge>}
          </div>

          {/* Rota */}
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="text-lg leading-none">{originFlag}</span>
            <span className="font-medium">
              {s.origin_city || s.origin_port || '—'}
              {s.origin_country ? `, ${s.origin_country}` : ''}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-lg leading-none">{destFlag}</span>
            <span className="font-medium">
              {s.destination_city || s.destination_port || '—'}
              {s.destination_country ? `, ${s.destination_country}` : ''}
            </span>
          </div>

          {/* KPIs */}
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

          {/* Timeline */}
          {!kpis.isCancelled && <StatusTimeline steps={steps} />}

          {/* Detalhes */}
          {(s.carrier || s.vessel_flight || s.master_bl || s.house_bl || s.booking_number || s.container_number) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs pt-2 border-t border-border">
              {s.carrier && <DetailItem label="Cia/Armador" value={s.carrier} />}
              {s.vessel_flight && <DetailItem label="Navio/Voo" value={s.vessel_flight} />}
              {s.booking_number && <DetailItem label="Booking" value={s.booking_number} />}
              {s.master_bl && <DetailItem label="Master BL/AWB" value={s.master_bl} />}
              {s.house_bl && <DetailItem label="House BL/AWB" value={s.house_bl} />}
              {s.container_number && <DetailItem label="Contêiner" value={s.container_number} />}
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

          <DocsSection docs={docs} />
        </div>
      </CardContent>
    </Card>
  );
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
            <Badge className={statusColors[q.status] || ''}>
              {statusLabels[q.status] || q.status}
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
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span>{doc.name}</span>
          </div>
          {doc.file_url && (
            <div className="flex gap-1">
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
