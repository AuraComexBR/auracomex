import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyAccess } from '@/hooks/useCompanyAccess';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSalespersonClients } from '@/hooks/useSalespersonClients';
import { Search, Filter, FileText, CalendarIcon, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ModeIcon } from '@/components/shared/ModeIcon';
import { ShipmentDetail } from '@/components/shipments/ShipmentDetail';
import { DuplicateShipmentDialog } from '@/components/shipments/DuplicateShipmentDialog';
import { Badge } from '@/components/ui/badge';
import { format, isToday } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/shared/SortableHeader';


export default function Shipments() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { isSalesperson, clientIds } = useSalespersonClients();
  const { isExpired } = useCompanyAccess();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duplicateShipment, setDuplicateShipment] = useState<any | null>(null);
  const queryClient = useQueryClient();

  // Fetch custom status options for label mapping
  const { data: statusOptions = [] } = useQuery({
    queryKey: ['shipment-status-options', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('shipment_status_options') as any)
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('position');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const statusLabelMap = new Map<string, string>(
    statusOptions.map((o: any) => [o.value, o.label])
  );

  const { data: shipments = [], refetch } = useQuery({
    queryKey: ['shipments', isSalesperson, clientIds],
    queryFn: async () => {
      let query = supabase
        .from('shipments')
        .select('id, reference_number, status, transport_mode, origin_city, origin_country, destination_city, destination_country, etd, eta, client_id, updated_at, last_accessed_at, next_update, clients(name)')
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

  const filtered = shipments.filter((s: any) =>
    s.reference_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.origin_city?.toLowerCase().includes(search.toLowerCase()) ||
    s.destination_city?.toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sortState, toggleSort } = useTableSort<any>(filtered, {
    reference_number: (r) => r.reference_number,
    client: (r) => r.clients?.name,
    origin: (r) => r.origin_city,
    destination: (r) => r.destination_city,
    etd: (r) => r.etd,
    eta: (r) => r.eta,
    status: (r) => statusLabelMap.get(r.status) || r.status,
    next_update: (r) => r.next_update,
    updated_at: (r) => r.updated_at,
  }, { storageKey: profile?.user_id ? `aura:sort:${profile.user_id}:shipments` : undefined });

  async function updateShipmentField(id: string, field: string, value: any) {
    try {
      const { error } = await (supabase.from('shipments') as any).update({ [field]: value }).eq('id', id);
      if (error) throw error;
      toast.success(t('quotes.changes_saved'));
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (selectedId) {
    return <ShipmentDetail id={selectedId} onBack={() => { refetch(); setSelectedId(null); }} />;
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('shipments.title')}</h1>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('shipments.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader label={t('shipments.reference')} sortKey="reference_number" state={sortState} onToggle={toggleSort} />
                <SortableHeader label={t('shipments.client')} sortKey="client" state={sortState} onToggle={toggleSort} />
                <SortableHeader label={t('shipments.origin')} sortKey="origin" state={sortState} onToggle={toggleSort} />
                <SortableHeader label={t('shipments.destination')} sortKey="destination" state={sortState} onToggle={toggleSort} />
                <SortableHeader label={t('shipments.etd')} sortKey="etd" state={sortState} onToggle={toggleSort} />
                <SortableHeader label={t('shipments.eta')} sortKey="eta" state={sortState} onToggle={toggleSort} />
                <SortableHeader label="Status" sortKey="status" state={sortState} onToggle={toggleSort} />
                <SortableHeader label="Next Update" sortKey="next_update" state={sortState} onToggle={toggleSort} />
                <SortableHeader label="Última Atividade" sortKey="updated_at" state={sortState} onToggle={toggleSort} />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    {t('common.no_data')}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((s: any) => {
                  const updatedToday = s.updated_at ? isToday(new Date(s.updated_at)) : false;
                  const accessedToday = s.last_accessed_at ? isToday(new Date(s.last_accessed_at)) : false;
                  const rowBg = updatedToday
                    ? 'bg-emerald-500/10'
                    : accessedToday
                      ? 'bg-yellow-500/10'
                      : 'bg-red-500/5';
                  return (
                  <TableRow key={s.id} className={`group ${rowBg}`}>
                    <TableCell
                      className="font-mono font-medium cursor-pointer hover:underline"
                      onClick={() => setSelectedId(s.id)}
                    >
                      {s.reference_number}
                    </TableCell>
                    <TableCell className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                      {(s.clients as any)?.name || '-'}
                    </TableCell>
                    <TableCell className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                      {s.origin_city}{s.origin_country ? `, ${s.origin_country}` : ''}
                    </TableCell>
                    <TableCell className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                      {s.destination_city}{s.destination_country ? `, ${s.destination_country}` : ''}
                    </TableCell>
                    <TableCell className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                      {s.etd ? format(new Date(s.etd), 'dd/MM/yy') : '-'}
                    </TableCell>
                    <TableCell className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                      {s.eta ? format(new Date(s.eta), 'dd/MM/yy') : '-'}
                    </TableCell>
                    {/* Read-only Status from Logistics */}
                    <TableCell className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                      {statusLabelMap.has(s.status) ? (
                        <StatusBadge status={s.status} label={statusLabelMap.get(s.status)} />
                      ) : (
                        <StatusBadge status={s.status} />
                      )}
                    </TableCell>
                    {/* Inline-editable Next Update */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <InlineNextUpdate
                        value={s.next_update}
                        onChange={(d) => updateShipmentField(s.id, 'next_update', d)}
                      />
                    </TableCell>
                    {/* Activity indicator */}
                    <TableCell>
                      <ActivityIndicator updatedAt={s.updated_at} lastAccessedAt={(s as any).last_accessed_at} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDuplicateShipment(s)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('shipments.duplicate')}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DuplicateShipmentDialog
        shipment={duplicateShipment}
        onClose={() => setDuplicateShipment(null)}
        onDuplicated={() => {
          setDuplicateShipment(null);
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }}
      />
    </div>
  );
}

function ActivityIndicator({ updatedAt, lastAccessedAt }: { updatedAt: string; lastAccessedAt: string | null }) {
  const updatedToday = isToday(new Date(updatedAt));
  const accessedToday = lastAccessedAt ? isToday(new Date(lastAccessedAt)) : false;

  let color: string;
  let label: string;

  if (updatedToday) {
    color = 'bg-emerald-500';
    label = 'Atualizado hoje';
  } else if (accessedToday) {
    color = 'bg-yellow-500';
    label = 'Acessado hoje, sem atualização';
  } else {
    color = 'bg-red-500';
    label = 'Não acessado hoje';
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full", color)} />
          <span className="text-xs text-muted-foreground">
            {format(new Date(updatedAt), 'dd/MM/yy')}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function InlineNextUpdate({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const dateValue = value ? new Date(value) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-7 text-xs px-2 font-normal justify-start w-[110px]",
            !dateValue && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-1 h-3 w-3" />
          {dateValue ? format(dateValue, 'dd/MM/yy') : 'Definir...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(d) => onChange(d ? d.toISOString() : null)}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
