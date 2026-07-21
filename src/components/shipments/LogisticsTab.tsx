import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PortSelect } from '@/components/shared/PortSelect';
import { CountrySelect } from '@/components/shared/CountrySelect';
import { MapPin, Ship, Plane, Truck, ArrowRight, Save, CalendarIcon, Settings, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  shipment: any;
  quoteId?: string;
  onUpdate?: () => void;
}

const modeIcons: Record<string, typeof Ship> = {
  ocean_fcl: Ship, ocean_lcl: Ship, air: Plane, road: Truck, multimodal: Ship,
};

const DEFAULT_STATUSES = [
  { label: 'Aprovado', value: 'approved', position: 0 },
  { label: 'Reservado', value: 'booked', position: 1 },
  { label: 'Em Trânsito', value: 'in_transit', position: 2 },
  { label: 'Atracou', value: 'arrived', position: 3 },
  { label: 'Entregue', value: 'delivered', position: 4 },
  { label: 'Cancelado', value: 'cancelled', position: 5 },
];

export function LogisticsTab({ shipment, quoteId, onUpdate }: Props) {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const { isFullAccess } = usePermissions();
  const queryClient = useQueryClient();
  const Icon = modeIcons[shipment.transport_mode] || Ship;

  // Fetch custom status options from DB
  const { data: dbStatusOptions = [] } = useQuery({
    queryKey: ['shipment-status-options', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('shipment_status_options') as any)
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('position');
      if (error) throw error;
      return data as { id: string; label: string; value: string; position: number }[];
    },
    enabled: !!profile?.company_id,
  });

  // Merge: use DB options if available, otherwise defaults
  const statusOptions = dbStatusOptions.length > 0 ? dbStatusOptions : DEFAULT_STATUSES;

  const [showStatusManager, setShowStatusManager] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusValue, setNewStatusValue] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  async function seedDefaults() {
    if (!profile?.company_id || dbStatusOptions.length > 0) return;
    await (supabase.from('shipment_status_options') as any).insert(
      DEFAULT_STATUSES.map(s => ({
        company_id: profile.company_id,
        label: s.label,
        value: s.value,
        position: s.position,
      }))
    );
    queryClient.invalidateQueries({ queryKey: ['shipment-status-options'] });
  }

  async function handleAddStatus() {
    if (!newStatusLabel.trim() || !profile?.company_id) return;
    const value = newStatusValue.trim() || newStatusLabel.trim().toLowerCase().replace(/\s+/g, '_');

    // Check for duplicate value
    const existingValues = statusOptions.map(s => s.value);
    if (existingValues.includes(value)) {
      toast.error('Esse status já existe');
      return;
    }

    // Seed defaults first if needed
    if (dbStatusOptions.length === 0) {
      await seedDefaults();
    }

    // Re-fetch to get correct position after potential seed
    const { data: current } = await (supabase.from('shipment_status_options') as any)
      .select('position')
      .eq('company_id', profile.company_id)
      .order('position', { ascending: false })
      .limit(1);
    const nextPosition = current && current.length > 0 ? current[0].position + 1 : DEFAULT_STATUSES.length;

    const { error } = await (supabase.from('shipment_status_options') as any).insert({
      company_id: profile.company_id,
      label: newStatusLabel.trim(),
      value,
      position: nextPosition,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Status adicionado');
    setNewStatusLabel('');
    setNewStatusValue('');
    queryClient.invalidateQueries({ queryKey: ['shipment-status-options'] });
  }

  async function handleDeleteStatus(id: string) {
    const { error } = await (supabase.from('shipment_status_options') as any).delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Status removido');
    queryClient.invalidateQueries({ queryKey: ['shipment-status-options'] });
  }

  async function handleReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || dbStatusOptions.length === 0) return;
    const reordered = [...statusOptions];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Update positions in DB
    const updates = reordered.map((s, i) => {
      if ('id' in s) {
        return (supabase.from('shipment_status_options') as any)
          .update({ position: i })
          .eq('id', (s as any).id);
      }
      return null;
    }).filter(Boolean);

    try {
      await Promise.all(updates);
      queryClient.invalidateQueries({ queryKey: ['shipment-status-options'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Fetch partners for this shipment
  const { data: shipmentPartners = [] } = useQuery({
    queryKey: ['shipment-partners-logistics', shipment.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_partners')
        .select('*, clients:client_id(id, name, type)')
        .eq('shipment_id', shipment.id)
        .order('created_at');
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch quote_items to know container count for FCL
  const { data: quoteItems = [] } = useQuery({
    queryKey: ['logistics-quote-items', shipment.id],
    queryFn: async () => {
      // Find the quote linked to this shipment
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id')
        .eq('shipment_id', shipment.id)
        .limit(1);
      if (!quotes || quotes.length === 0) return [];
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quotes[0].id)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const isFCL = shipment.transport_mode === 'ocean_fcl' || shipment.transport_mode === 'multimodal';
  const containerCount = isFCL ? Math.max(quoteItems.length, 1) : 0;

  // Parse existing container_number as JSON array or comma-separated
  const parseContainerNumbers = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  };

  const [form, setForm] = useState({
    origin_city: shipment.origin_city || '',
    origin_country: shipment.origin_country || '',
    origin_port: shipment.origin_port || '',
    destination_city: shipment.destination_city || '',
    destination_country: shipment.destination_country || '',
    destination_port: shipment.destination_port || '',
    carrier: shipment.carrier || '',
    vessel_flight: shipment.vessel_flight || '',
    booking_number: shipment.booking_number || '',
    master_bl: shipment.master_bl || '',
    house_bl: shipment.house_bl || '',
    ce_mercante_manifest: shipment.ce_mercante_manifest || '',
    ce_mercante_master: shipment.ce_mercante_master || '',
    ce_mercante_house: shipment.ce_mercante_house || '',
    etd: shipment.etd || '',
    eta: shipment.eta || '',
    atd: shipment.atd || '',
    ata: shipment.ata || '',
    status: shipment.status || 'draft',
    shipper_id: (shipment as any).shipper_id || '',
    consignee_id: (shipment as any).consignee_id || '',
    notify_id: (shipment as any).notify_id || '',
    courier_provider: (shipment as any).courier_provider || '',
    courier_tracking_number: (shipment as any).courier_tracking_number || '',
  });

  const [containerNumbers, setContainerNumbers] = useState<string[]>(() => {
    const existing = parseContainerNumbers(shipment.container_number);
    // Pad to containerCount
    const arr = [...existing];
    while (arr.length < containerCount) arr.push('');
    return arr;
  });

  // Update container numbers array when containerCount changes
  useEffect(() => {
    if (containerCount > 0) {
      setContainerNumbers(prev => {
        const arr = [...prev];
        while (arr.length < containerCount) arr.push('');
        return arr.slice(0, Math.max(containerCount, arr.filter(Boolean).length));
      });
    }
  }, [containerCount]);

  const [saving, setSaving] = useState(false);

  const partnerOptions = shipmentPartners
    .map((sp: any) => sp.clients)
    .filter(Boolean);

  const stops = [
    { label: t('shipments.origin'), city: form.origin_city, country: form.origin_country, active: true },
    ...(form.origin_port ? [{ label: 'Port/Airport', city: form.origin_port, country: '', active: form.status === 'booked' || form.status === 'in_transit' }] : []),
    ...(form.destination_port ? [{ label: 'Port/Airport', city: form.destination_port, country: '', active: form.status === 'arrived' }] : []),
    { label: t('shipments.destination'), city: form.destination_city, country: form.destination_country, active: form.status === 'delivered' },
  ];

  async function handleSave() {
    setSaving(true);
    try {
      const containerNumberValue = containerNumbers.filter(Boolean).length > 0
        ? JSON.stringify(containerNumbers.map(s => s.trim()))
        : null;

      const updates: Record<string, any> = {
        origin_city: form.origin_city || null,
        origin_country: form.origin_country || null,
        origin_port: form.origin_port || null,
        destination_city: form.destination_city || null,
        destination_country: form.destination_country || null,
        destination_port: form.destination_port || null,
        carrier: form.carrier || null,
        vessel_flight: form.vessel_flight || null,
        booking_number: form.booking_number || null,
        master_bl: form.master_bl || null,
        house_bl: form.house_bl || null,
        ce_mercante_manifest: form.ce_mercante_manifest || null,
        ce_mercante_master: form.ce_mercante_master || null,
        ce_mercante_house: form.ce_mercante_house || null,
        etd: form.etd || null,
        eta: form.eta || null,
        atd: form.atd || null,
        ata: form.ata || null,
        status: form.status,
        container_number: containerNumberValue,
        shipper_id: form.shipper_id || null,
        consignee_id: form.consignee_id || null,
        notify_id: form.notify_id || null,
        courier_provider: form.courier_provider || null,
        courier_tracking_number: form.courier_tracking_number || null,
      };

      const auditLogs: { field_name: string; old_value: string | null; new_value: string | null }[] = [];
      const allFields = [
        'origin_city', 'origin_country', 'origin_port',
        'destination_city', 'destination_country', 'destination_port',
        'carrier', 'vessel_flight', 'booking_number',
        'master_bl', 'house_bl', 'ce_mercante_manifest', 'ce_mercante_master', 'ce_mercante_house',
        'etd', 'eta', 'atd', 'ata', 'status', 'container_number',
        'shipper_id', 'consignee_id', 'notify_id',
        'courier_provider', 'courier_tracking_number',
      ];
      for (const dbKey of allFields) {
        const oldVal = shipment[dbKey]?.toString() || '';
        const newVal = (updates[dbKey]?.toString()) || '';
        if (oldVal !== newVal) {
          auditLogs.push({ field_name: dbKey, old_value: oldVal || null, new_value: newVal || null });
        }
      }

      const { error } = await (supabase.from('shipments') as any).update(updates).eq('id', shipment.id);
      if (error) throw error;

      if (auditLogs.length > 0 && profile) {
        await (supabase.from('shipment_audit_log') as any).insert(
          auditLogs.map(log => ({
            ...log,
            shipment_id: shipment.id,
            quote_id: quoteId || null,
            company_id: shipment.company_id,
            user_id: user?.id || null,
          }))
        );
      }

      toast.success(t('quotes.changes_saved'));
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const updateField = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  function DateField({ label, fieldKey }: { label: string; fieldKey: string }) {
    const value = (form as any)[fieldKey];
    const dateValue = value ? new Date(value) : undefined;
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !dateValue && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateValue ? format(dateValue, 'dd/MM/yyyy') : 'Selecionar...'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={(d) => updateField(fieldKey, d ? d.toISOString() : '')}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  function PartnerSelect({ label, fieldKey }: { label: string; fieldKey: string }) {
    const value = (form as any)[fieldKey];
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Select value={value || '_none'} onValueChange={(v) => updateField(fieldKey, v === '_none' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">—</SelectItem>
            {partnerOptions.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardContent className="p-6 space-y-6">
        {/* Visual route */}
        <div className="flex items-center justify-between py-8">
          {stops.map((stop, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                  stop.active ? 'border-status-transit bg-status-transit/10 text-status-transit' : 'border-border bg-secondary text-muted-foreground'
                }`}>
                  {i === 0 || i === stops.length - 1 ? <MapPin className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <p className="mt-2 text-sm font-semibold text-center">{stop.city}</p>
                <p className="text-xs text-muted-foreground">{stop.country}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{stop.label}</p>
              </div>
              {i < stops.length - 1 && (
                <div className="flex-1 mx-4 flex items-center">
                  <div className={`h-0.5 flex-1 ${stop.active ? 'bg-status-transit' : 'bg-border'}`} />
                  <ArrowRight className={`w-4 h-4 mx-1 ${stop.active ? 'text-status-transit' : 'text-muted-foreground'}`} />
                  <div className={`h-0.5 flex-1 ${stop.active ? 'bg-status-transit' : 'bg-border'}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="pt-4 border-t border-border">
          <div className="max-w-xs space-y-1">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold">Status</Label>
              {isFullAccess && (
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowStatusManager(true)}>
                  <Settings className="w-3 h-3" />
                </Button>
              )}
            </div>
            <Select value={form.status} onValueChange={async (v) => {
              const oldStatus = form.status;
              updateField('status', v);
              try {
                const { error } = await (supabase.from('shipments') as any).update({ status: v }).eq('id', shipment.id);
                if (error) throw error;
                if (profile) {
                  await (supabase.from('shipment_audit_log') as any).insert({
                    shipment_id: shipment.id,
                    quote_id: quoteId || null,
                    company_id: shipment.company_id,
                    user_id: user?.id || null,
                    field_name: 'status',
                    old_value: oldStatus,
                    new_value: v,
                  });
                }
                toast.success(t('quotes.changes_saved'));
                onUpdate?.();
              } catch (err: any) {
                updateField('status', oldStatus);
                toast.error(err.message);
              }
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Manager Dialog */}
        <Dialog open={showStatusManager} onOpenChange={setShowStatusManager}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerenciar Status de Embarque</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                {statusOptions.map((s, idx) => (
                  <div
                    key={s.value}
                    draggable={dbStatusOptions.length > 0 && 'id' in s}
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={() => { if (dragIdx !== null) { handleReorder(dragIdx, idx); setDragIdx(null); } }}
                    onDragEnd={() => setDragIdx(null)}
                    className={cn(
                      "flex items-center justify-between py-1.5 px-2 rounded bg-secondary/50 cursor-grab active:cursor-grabbing transition-opacity",
                      dragIdx === idx && "opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">{s.label} <span className="text-xs text-muted-foreground">({s.value})</span></span>
                    </div>
                    {dbStatusOptions.length > 0 && 'id' in s && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteStatus((s as any).id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do status..."
                  value={newStatusLabel}
                  onChange={e => setNewStatusLabel(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddStatus} disabled={!newStatusLabel.trim()}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Editable route fields */}
        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('shipments.origin')}</h4>
            <div className="space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input value={form.origin_city} onChange={e => updateField('origin_city', e.target.value)} placeholder="Endereço de origem..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">País</Label>
              <CountrySelect value={form.origin_country} onChange={(v) => updateField('origin_country', v)} placeholder="Selecionar país..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Porto/Aeroporto</Label>
              <PortSelect value={form.origin_port} onChange={(code) => updateField('origin_port', code)} transportMode={shipment.transport_mode} placeholder="Buscar porto/aeroporto..." />
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('shipments.destination')}</h4>
            <div className="space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input value={form.destination_city} onChange={e => updateField('destination_city', e.target.value)} placeholder="Endereço de destino..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">País</Label>
              <CountrySelect value={form.destination_country} onChange={(v) => updateField('destination_country', v)} placeholder="Selecionar país..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Porto/Aeroporto</Label>
              <PortSelect value={form.destination_port} onChange={(code) => updateField('destination_port', code)} transportMode={shipment.transport_mode} placeholder="Buscar porto/aeroporto..." />
            </div>
          </div>
        </div>

        {/* Participants: Carrier, Shipper, Consignee, Notify */}
        <div className="pt-4 border-t border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Participantes</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Carrier — stores partner name as text */}
            <div className="space-y-1">
              <Label className="text-xs">{t('shipments.carrier')}</Label>
              <Select value={form.carrier || '_none'} onValueChange={(v) => updateField('carrier', v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {partnerOptions.map((p: any) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PartnerSelect label="Shipper" fieldKey="shipper_id" />
            <PartnerSelect label="Consignee" fieldKey="consignee_id" />
            <PartnerSelect label="Notify" fieldKey="notify_id" />
          </div>
        </div>

        {/* Documents & References — reordered: Booking → Master → House → CEs */}
        <div className="pt-4 border-t border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Documentos & Referências</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Booking</Label>
              <Input value={form.booking_number} onChange={e => updateField('booking_number', e.target.value)} placeholder="Número Booking..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Master (BL/AWB)</Label>
              <Input value={form.master_bl} onChange={e => updateField('master_bl', e.target.value)} placeholder="Número Master..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">House (BL/AWB)</Label>
              <Input value={form.house_bl} onChange={e => updateField('house_bl', e.target.value)} placeholder="Número House..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CE Mercante Manifest</Label>
              <Input value={form.ce_mercante_manifest} onChange={e => updateField('ce_mercante_manifest', e.target.value)} placeholder="CE Manifest..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CE Mercante Master</Label>
              <Input value={form.ce_mercante_master} onChange={e => updateField('ce_mercante_master', e.target.value)} placeholder="CE Master..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CE Mercante House</Label>
              <Input value={form.ce_mercante_house} onChange={e => updateField('ce_mercante_house', e.target.value)} placeholder="CE House..." />
            </div>
          </div>
        </div>

        {/* Container numbers — dynamic based on FCL items */}
        {isFCL && containerCount > 0 && (
          <div className="pt-4 border-t border-border space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">
              Containers ({containerCount})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {containerNumbers.slice(0, Math.max(containerCount, containerNumbers.length)).map((cn, idx) => (
                <div key={idx} className="space-y-1">
                  <Label className="text-xs">
                    Container #{idx + 1}
                    {quoteItems[idx]?.container_type && (
                      <span className="ml-1 text-muted-foreground">({quoteItems[idx].container_type})</span>
                    )}
                  </Label>
                  <Input
                    placeholder="Ex: MSKU1234567"
                    value={cn}
                    onChange={(e) => {
                      const updated = [...containerNumbers];
                      updated[idx] = e.target.value.toUpperCase();
                      setContainerNumbers(updated);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="pt-4 border-t border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Datas</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DateField label="Departure (ETD)" fieldKey="etd" />
            <DateField label="Arrive (ETA)" fieldKey="eta" />
            <DateField label="Departure (ATD)" fieldKey="atd" />
            <DateField label="Arrive (ATA)" fieldKey="ata" />
          </div>
        </div>

        {/* Transport details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
          <div className="space-y-1">
            <Label className="text-xs">Vessel/Flight</Label>
            <Input value={form.vessel_flight} onChange={e => updateField('vessel_flight', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Courier</Label>
            <Select
              value={form.courier_provider || '_none'}
              onValueChange={(v) => updateField('courier_provider', v === '_none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">—</SelectItem>
                <SelectItem value="DHL">DHL</SelectItem>
                <SelectItem value="FEDEX">FedEx</SelectItem>
                <SelectItem value="UPS">UPS</SelectItem>
                <SelectItem value="TNT">TNT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Nº de Rastreio Courier</Label>
            <Input
              value={form.courier_tracking_number}
              onChange={e => updateField('courier_tracking_number', e.target.value)}
              placeholder="Ex: 5132057442"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}