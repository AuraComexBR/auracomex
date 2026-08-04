import { useState, useEffect, useMemo } from 'react';
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
import { MapPin, Ship, Plane, Truck, ArrowRight, CalendarIcon, Settings, Plus, Trash2, GripVertical, ExternalLink, ArrowDownAZ, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { getCourierTrackingUrl } from '@/lib/courierTracking';

interface Props {
  shipment: any;
  quoteId?: string;
  onUpdate?: () => void;
}

const modeIcons: Record<string, typeof Ship> = {
  ocean_fcl: Ship, ocean_lcl: Ship, air: Plane, road: Truck, multimodal: Ship,
};

const INCOTERMS_BY_MODE: Record<string, string[]> = {
  ocean_fcl: ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
  ocean_lcl: ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
  air: ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
  road: ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
  multimodal: ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
};

// Campos de data: comparados por instante (getTime), não por string — o
// Supabase devolve timestamps num formato diferente de Date.toISOString()
// (ex: "+00:00" em vez de "Z"), então comparar como texto detecta uma
// "mudança" que não existe e trava o auto-save num loop infinito.
const DATE_FIELDS = new Set(['etd', 'eta', 'atd', 'ata']);

// Rótulo do "Carrier" muda de acordo com o modal — o dado salvo é o mesmo
// campo (carrier), só muda como ele é chamado na tela.
const CARRIER_LABEL_BY_MODE: Record<string, string> = {
  ocean_fcl: 'Armador',
  ocean_lcl: 'Co-Loader',
  air: 'Cia Aérea',
  road: 'Transportadora',
  multimodal: 'Armador',
};

// Ordem alfabética por padrão (pedido do usuário) — o usuário ainda pode
// reordenar arrastando na tela de Gerenciar Status, ou clicar em "Ordenar
// A-Z" pra voltar pra essa ordem a qualquer momento.
const DEFAULT_STATUSES = [
  { label: 'Aprovado', value: 'approved', position: 0 },
  { label: 'Atracou', value: 'arrived', position: 1 },
  { label: 'Cancelado', value: 'cancelled', position: 2 },
  { label: 'Coletado', value: 'collected_at_origin', position: 3 },
  { label: 'Docs', value: 'docs_at_origin', position: 4 },
  { label: 'Entregue', value: 'delivered', position: 5 },
  { label: 'Reservado', value: 'booked', position: 6 },
  { label: 'Trânsito', value: 'in_transit', position: 7 },
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

  async function handleSortAlphabetically() {
    if (dbStatusOptions.length === 0) return;
    const sorted = [...dbStatusOptions].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    try {
      await Promise.all(sorted.map((s, i) =>
        (supabase.from('shipment_status_options') as any).update({ position: i }).eq('id', s.id)
      ));
      queryClient.invalidateQueries({ queryKey: ['shipment-status-options'] });
      toast.success('Status ordenados de A a Z');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Fetch partners for this shipment (fallback for standalone shipments with
  // no linked quote — the normal case reads from quote_partners below instead,
  // so companies added/removed in the aba Empresas show up right away here).
  const { data: shipmentPartners = [] } = useQuery({
    queryKey: ['shipment-partners-logistics', shipment.id],
    enabled: !quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_partners')
        .select('*, clients:client_id(id, name, type, partner_category)')
        .eq('shipment_id', shipment.id)
        .order('created_at');
      if (error) throw error;
      return data as any[];
    },
  });

  // Empresas vinculadas ao processo na aba Empresas (quote_partners) — fonte
  // principal das opções de Shipper/Armador/Notify/Consignee, pra qualquer
  // empresa adicionada lá aparecer aqui na hora, sem precisar converter de
  // novo. partner_category vem junto pra ajudar a preencher (ex: sugerir
  // o Armador sozinho quando só tem uma transportadora do modal certo).
  const { data: quotePartners = [] } = useQuery({
    queryKey: ['quote-partners-logistics', quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_partners' as any)
        .select('*, clients:client_id(id, name, type, partner_category)')
        .eq('quote_id', quoteId!)
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
    transshipment: (shipment as any).transshipment || '',
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
    incoterm: (shipment as any).incoterm || '',
    transport_mode: shipment.transport_mode || 'ocean_fcl',
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

  // Prioriza quote_partners (aba Empresas) quando há uma cotação vinculada —
  // shipment_partners só serve de fallback pra embarque avulso sem cotação.
  const partnerOptions = (quoteId ? quotePartners : shipmentPartners)
    .map((sp: any) => sp.clients)
    .filter(Boolean);

  // Categorias de empresa (cadastradas na aba Empresas) que fazem sentido
  // como Armador/Transportadora pra cada modal — usado tanto pra rotular as
  // opções quanto pra preencher o campo sozinho quando não há ambiguidade.
  const carrierCategoriesByMode: Record<string, string[]> = {
    ocean_fcl: ['ocean_carrier', 'co_loader'],
    ocean_lcl: ['co_loader', 'ocean_carrier'],
    air: ['air_carrier'],
    road: ['road_carrier'],
    multimodal: ['ocean_carrier', 'co_loader', 'air_carrier', 'road_carrier'],
  };

  function partnerCategoryLabel(category?: string | null) {
    if (!category) return '';
    const translated = t(`registrations.category_${category}`);
    const label = translated !== `registrations.category_${category}` ? translated : category;
    return ` (${label})`;
  }

  const stops = [
    { label: t('shipments.origin'), city: form.origin_city, country: form.origin_country, active: true },
    ...(form.origin_port ? [{ label: 'Port/Airport', city: form.origin_port, country: '', active: form.status === 'booked' || form.status === 'in_transit' }] : []),
    ...(form.transshipment ? [{ label: 'Transbordo', city: form.transshipment, country: '', active: form.status === 'in_transit' }] : []),
    ...(form.destination_port ? [{ label: 'Port/Airport', city: form.destination_port, country: '', active: form.status === 'arrived' }] : []),
    { label: t('shipments.destination'), city: form.destination_city, country: form.destination_country, active: form.status === 'delivered' },
  ];

  // Detecta alterações pendentes (contra o que já está salvo no embarque) pra
  // disparar o auto-save — Logística não tem mais botão "Salvar" próprio.
  const hasChanges = useMemo(() => {
    const fieldsToCheck: (keyof typeof form)[] = [
      'origin_city', 'origin_country', 'origin_port', 'transshipment',
      'destination_city', 'destination_country', 'destination_port',
      'carrier', 'vessel_flight', 'booking_number',
      'master_bl', 'house_bl', 'ce_mercante_manifest', 'ce_mercante_master', 'ce_mercante_house',
      'etd', 'eta', 'atd', 'ata', 'incoterm', 'transport_mode',
      'shipper_id', 'consignee_id', 'notify_id',
      'courier_provider', 'courier_tracking_number',
    ];
    for (const key of fieldsToCheck) {
      const newVal = (form as any)[key] ?? '';
      const oldVal = (shipment as any)[key] ?? '';
      if (DATE_FIELDS.has(key)) {
        // Datas voltam do banco com formatação diferente de Date.toISOString()
        // (ex: "+00:00" em vez de "Z"), mesmo sendo o mesmo instante — comparar
        // como string aqui fazia o auto-save entrar em loop infinito.
        const newTime = newVal ? new Date(newVal).getTime() : null;
        const oldTime = oldVal ? new Date(oldVal).getTime() : null;
        if (newTime !== oldTime) return true;
        continue;
      }
      if (String(newVal) !== String(oldVal)) return true;
    }
    const existingContainers = parseContainerNumbers(shipment.container_number);
    const currentContainers = containerNumbers.filter(Boolean);
    if (existingContainers.length !== currentContainers.length) return true;
    for (let i = 0; i < currentContainers.length; i++) {
      if ((existingContainers[i] || '') !== (currentContainers[i] || '')) return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, containerNumbers, shipment]);

  // Auto-save: nenhum botão "Salvar" próprio — qualquer alteração grava
  // sozinha depois de uma pausa curta de digitação (status continua salvando
  // na hora, como já era, pelo próprio Select de status).
  useEffect(() => {
    if (!hasChanges || saving) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, containerNumbers, hasChanges, saving]);

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
        transshipment: form.transshipment || null,
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
        incoterm: (form.incoterm && form.incoterm !== 'NONE') ? form.incoterm : null,
        transport_mode: form.transport_mode as any,
        container_number: containerNumberValue,
        shipper_id: form.shipper_id || null,
        consignee_id: form.consignee_id || null,
        notify_id: form.notify_id || null,
        courier_provider: form.courier_provider || null,
        courier_tracking_number: form.courier_tracking_number || null,
        // Setado explicitamente em vez de depender só do trigger do banco,
        // pra "Última Atividade" na lista de Embarques sempre refletir a mudança.
        updated_at: new Date().toISOString(),
        // Toda alteração no processo empurra o Next Update pro dia seguinte,
        // como lembrete automático de acompanhamento.
        next_update: addDays(new Date(), 1).toISOString(),
      };

      const auditLogs: { field_name: string; old_value: string | null; new_value: string | null }[] = [];
      const allFields = [
        'origin_city', 'origin_country', 'origin_port', 'transshipment',
        'destination_city', 'destination_country', 'destination_port',
        'carrier', 'vessel_flight', 'booking_number',
        'master_bl', 'house_bl', 'ce_mercante_manifest', 'ce_mercante_master', 'ce_mercante_house',
        'etd', 'eta', 'atd', 'ata', 'status', 'incoterm', 'transport_mode', 'container_number',
        'shipper_id', 'consignee_id', 'notify_id',
        'courier_provider', 'courier_tracking_number',
      ];
      for (const dbKey of allFields) {
        const oldVal = shipment[dbKey]?.toString() || '';
        const newVal = (updates[dbKey]?.toString()) || '';
        if (DATE_FIELDS.has(dbKey)) {
          const oldTime = shipment[dbKey] ? new Date(shipment[dbKey]).getTime() : null;
          const newTime = updates[dbKey] ? new Date(updates[dbKey]).getTime() : null;
          if (oldTime !== newTime) {
            auditLogs.push({ field_name: dbKey, old_value: oldVal || null, new_value: newVal || null });
          }
          continue;
        }
        if (oldVal !== newVal) {
          auditLogs.push({ field_name: dbKey, old_value: oldVal || null, new_value: newVal || null });
        }
      }

      const { error } = await (supabase.from('shipments') as any).update(updates).eq('id', shipment.id);
      if (error) throw error;

      // Modal e Incoterm são espelhados com a aba Geral (tabela quotes) — editar
      // aqui também atualiza a cotação de origem, pra nunca ficarem divergentes.
      if (quoteId) {
        await supabase.from('quotes').update({
          transport_mode: updates.transport_mode,
          incoterm: updates.incoterm,
        } as any).eq('id', quoteId);
        queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
      }

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

  // Preenche o Armador sozinho quando existe exatamente uma empresa da
  // categoria certa pro modal vinculada ao processo — ex: só uma
  // transportadora rodoviária cadastrada em Empresas com modal Rodoviário.
  useEffect(() => {
    if (form.carrier) return;
    const relevantCategories = carrierCategoriesByMode[form.transport_mode] || [];
    const matches = partnerOptions.filter((p: any) => relevantCategories.includes(p.partner_category));
    if (matches.length === 1) {
      updateField('carrier', matches[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerOptions.map((p: any) => p.id).join(','), form.transport_mode, form.carrier]);

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
              <SelectItem key={p.id} value={p.id}>{p.name}{partnerCategoryLabel(p.partner_category)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardContent className="p-6 space-y-6">
        {/* Visual route — altura reduzida à metade de novo (largura e fontes seguem originais) */}
        <div className="flex items-center justify-between py-0">
          {stops.map((stop, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                  stop.active ? 'border-status-transit bg-status-transit/10 text-status-transit' : 'border-border bg-secondary text-muted-foreground'
                }`}>
                  {i === 0 || i === stops.length - 1 ? <MapPin className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                </div>
                <p className="mt-1 text-sm font-semibold text-center leading-none uppercase">{stop.city}</p>
              </div>
              {i < stops.length - 1 && (
                <div className="flex-1 mx-4 flex items-center">
                  <div className={`h-0.5 flex-1 ${stop.active ? 'bg-status-transit' : 'bg-border'}`} />
                  <ArrowRight className={`w-8 h-8 mx-1 ${stop.active ? 'text-status-transit' : 'text-muted-foreground'}`} />
                  <div className={`h-0.5 flex-1 ${stop.active ? 'bg-status-transit' : 'bg-border'}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Status - Incoterm - Modal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="space-y-1">
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
                const { error } = await (supabase.from('shipments') as any).update({
                  status: v,
                  updated_at: new Date().toISOString(),
                  next_update: addDays(new Date(), 1).toISOString(),
                }).eq('id', shipment.id);
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

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Incoterm</Label>
            <Select value={form.incoterm} onValueChange={(v) => updateField('incoterm', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {form.transport_mode === 'road' && <SelectItem value="NONE">— Sem incoterm —</SelectItem>}
                {(INCOTERMS_BY_MODE[form.transport_mode] || INCOTERMS_BY_MODE.ocean_fcl).map((ic) => (
                  <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Modal</Label>
            <Select value={form.transport_mode} onValueChange={(v) => updateField('transport_mode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['ocean_fcl', 'ocean_lcl', 'air', 'road', 'multimodal'].map((m) => (
                  <SelectItem key={m} value={m}>{t(`mode.${m}`)}</SelectItem>
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
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleSortAlphabetically} disabled={dbStatusOptions.length === 0}>
                  <ArrowDownAZ className="w-3.5 h-3.5 mr-1.5" /> Ordenar A-Z
                </Button>
              </div>
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

        {/* Coleta - Porto/Aeroporto Origem - Porto/Aeroporto Destino - Entrega */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-border">
          <div className="space-y-1">
            <Label className="text-xs">Coleta</Label>
            <Input value={form.origin_city} onChange={e => updateField('origin_city', e.target.value)} placeholder="Endereço de coleta..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Porto/Aeroporto Origem</Label>
            <PortSelect value={form.origin_port} onChange={(code) => updateField('origin_port', code)} transportMode={form.transport_mode} placeholder="Buscar porto/aeroporto..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Porto/Aeroporto Destino</Label>
            <PortSelect value={form.destination_port} onChange={(code) => updateField('destination_port', code)} transportMode={form.transport_mode} placeholder="Buscar porto/aeroporto..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entrega</Label>
            <Input value={form.destination_city} onChange={e => updateField('destination_city', e.target.value)} placeholder="Endereço de entrega..." />
          </div>

          <div className="space-y-1">
            <CountrySelect value={form.origin_country} onChange={(v) => updateField('origin_country', v)} placeholder="País..." />
          </div>
          {form.transport_mode !== 'road' ? (
            <div className="col-span-2 flex justify-center">
              <div className="w-1/2">
                <PortSelect value={form.transshipment} onChange={(code) => updateField('transshipment', code)} transportMode={form.transport_mode} placeholder="Transbordo (opcional)..." />
              </div>
            </div>
          ) : (
            <div className="col-span-2" />
          )}
          <div className="space-y-1">
            <CountrySelect value={form.destination_country} onChange={(v) => updateField('destination_country', v)} placeholder="País..." />
          </div>
        </div>

        {/* Participantes: Shipper - Armador/Cia Aérea/Co-Loader/Transportadora - Notify - Consignee */}
        <div className="pt-4 border-t border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Participantes</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PartnerSelect label="Shipper" fieldKey="shipper_id" />
            {/* Carrier — rótulo muda com o modal, mas grava sempre no mesmo campo (nome do parceiro em texto) */}
            <div className="space-y-1">
              <Label className="text-xs">{CARRIER_LABEL_BY_MODE[form.transport_mode] || t('shipments.carrier')}</Label>
              <Select value={form.carrier || '_none'} onValueChange={(v) => updateField('carrier', v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {partnerOptions.map((p: any) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}{partnerCategoryLabel(p.partner_category)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PartnerSelect label="Notify" fieldKey="notify_id" />
            <PartnerSelect label="Consignee" fieldKey="consignee_id" />
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
          {shipment.transport_mode === 'air' && (
            <>
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
                <div className="flex items-center gap-2">
                  <Input
                    value={form.courier_tracking_number}
                    onChange={e => updateField('courier_tracking_number', e.target.value)}
                    placeholder="Ex: 5132057442"
                    className="flex-1"
                  />
                  {(() => {
                    const url = getCourierTrackingUrl(form.courier_provider, form.courier_tracking_number);
                    return url ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Rastrear
                        </a>
                      </Button>
                    ) : null;
                  })()}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Indicador de auto-save — não tem mais botão "Salvar" próprio */}
        {saving && (
          <div className="flex justify-end pt-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando…
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}