import { useEffect, useState, useMemo } from 'react';
import { CollapsibleCard } from '@/components/shared/CollapsibleCard';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CARRIER_LABEL_BY_MODE } from '@/lib/carrierLabel';
import { toast } from 'sonner';

interface Props {
  shipment: any;
  quoteId?: string;
  onUpdate?: () => void;
}

/** Shipper/Armador/Notify/Consignee do embarque — vivia na aba Logística,
 * mudou pra aba Empresas (junto com a lista de empresas do processo, que é
 * a fonte das opções aqui). Salva na hora a cada troca de Select, igual ao
 * Status na Logística — não tem botão "Salvar" próprio. */
export function ShipmentPartnersCard({ shipment, quoteId, onUpdate }: Props) {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Fallback pra embarque avulso sem cotação — o caso normal lê de
  // quote_partners abaixo, refletindo na hora qualquer empresa
  // adicionada/removida na aba Empresas.
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

  const { data: ownCompany } = useQuery({
    queryKey: ['own-company-logistics', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', profile!.company_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const partnerOptions = useMemo(() => {
    const linked = (quoteId ? quotePartners : shipmentPartners)
      .map((sp: any) => sp.clients)
      .filter(Boolean);
    const always: any[] = [];
    if (ownCompany?.name) {
      always.push({ id: ownCompany.id, name: ownCompany.name, partner_category: '__own' });
    }
    const clientId = (shipment as any).client_id;
    const clientName = (shipment as any).clients?.name;
    if (clientId && clientName) {
      always.push({ id: clientId, name: clientName, partner_category: '__client' });
    }
    const combined = [...always, ...linked];
    const seen = new Set<string>();
    return combined.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, quotePartners, shipmentPartners, ownCompany, shipment]);

  const carrierCategoriesByMode: Record<string, string[]> = {
    ocean_fcl: ['ocean_carrier', 'co_loader'],
    ocean_lcl: ['co_loader', 'ocean_carrier'],
    air: ['air_carrier'],
    road: ['road_carrier'],
    multimodal: ['ocean_carrier', 'co_loader', 'air_carrier', 'road_carrier'],
  };

  function partnerCategoryLabel(category?: string | null) {
    if (!category) return '';
    if (category === '__own') return ' (Sua empresa)';
    if (category === '__client') return ' (Cliente do processo)';
    const translated = t(`registrations.category_${category}`);
    const label = translated !== `registrations.category_${category}` ? translated : category;
    return ` (${label})`;
  }

  const [values, setValues] = useState({
    shipper_id: (shipment as any).shipper_id || '',
    consignee_id: (shipment as any).consignee_id || '',
    notify_id: (shipment as any).notify_id || '',
    carrier: shipment.carrier || '',
  });

  async function saveField(fieldKey: string, value: string) {
    const oldValue = (values as any)[fieldKey] || '';
    setValues((v) => ({ ...v, [fieldKey]: value }));
    try {
      const { error } = await (supabase.from('shipments') as any).update({
        [fieldKey]: value || null,
        updated_at: new Date().toISOString(),
      }).eq('id', shipment.id);
      if (error) throw error;
      if (profile) {
        await (supabase.from('shipment_audit_log') as any).insert({
          shipment_id: shipment.id,
          quote_id: quoteId || null,
          company_id: shipment.company_id,
          user_id: user?.id || null,
          field_name: fieldKey,
          old_value: oldValue || null,
          new_value: value || null,
        });
      }
      toast.success(t('quotes.changes_saved'));
      onUpdate?.();
    } catch (err: any) {
      setValues((v) => ({ ...v, [fieldKey]: oldValue }));
      toast.error(err.message);
    }
  }

  // Preenche o Armador sozinho quando existe exatamente uma empresa da
  // categoria certa pro modal vinculada ao processo, e já persiste — igual
  // ao comportamento que já existia na Logística.
  useEffect(() => {
    if (values.carrier) return;
    const relevantCategories = carrierCategoriesByMode[shipment.transport_mode] || [];
    const matches = partnerOptions.filter((p: any) => relevantCategories.includes(p.partner_category));
    if (matches.length === 1) {
      saveField('carrier', matches[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerOptions.map((p: any) => p.id).join(','), shipment.transport_mode, values.carrier]);

  function PartnerSelect({ label, fieldKey }: { label: string; fieldKey: string }) {
    const value = (values as any)[fieldKey];
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Select value={value || '_none'} onValueChange={(v) => saveField(fieldKey, v === '_none' ? '' : v)}>
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
    <CollapsibleCard title="Shipper, Armador, Notify & Consignee">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PartnerSelect label="Shipper" fieldKey="shipper_id" />
        {/* Carrier — rótulo muda com o modal, mas grava sempre no mesmo campo (nome do parceiro em texto) */}
        <div className="space-y-1">
          <Label className="text-xs">{CARRIER_LABEL_BY_MODE[shipment.transport_mode] || t('shipments.carrier')}</Label>
          <Select value={values.carrier || '_none'} onValueChange={(v) => saveField('carrier', v === '_none' ? '' : v)}>
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
    </CollapsibleCard>
  );
}
