import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Activity, ArrowRight } from 'lucide-react';

interface Props {
  shipmentId: string;
  companyId: string;
}

const fieldLabels: Record<string, Record<string, string>> = {
  origin_city: { pt: 'Cidade Origem', en: 'Origin City' },
  origin_country: { pt: 'País Origem', en: 'Origin Country' },
  origin_port: { pt: 'Porto Origem', en: 'Origin Port' },
  destination_city: { pt: 'Cidade Destino', en: 'Destination City' },
  destination_country: { pt: 'País Destino', en: 'Destination Country' },
  destination_port: { pt: 'Porto Destino', en: 'Destination Port' },
  carrier: { pt: 'Transportadora', en: 'Carrier' },
  vessel_flight: { pt: 'Navio/Voo', en: 'Vessel/Flight' },
  booking_number: { pt: 'Booking', en: 'Booking #' },
  container_number: { pt: 'Container', en: 'Container #' },
  weight_kg: { pt: 'Peso (kg)', en: 'Weight (kg)' },
  volume_cbm: { pt: 'Volume (m³)', en: 'Volume (cbm)' },
  packages: { pt: 'Volumes', en: 'Packages' },
  cargo_description: { pt: 'Carga', en: 'Cargo' },
  status: { pt: 'Status', en: 'Status' },
  etd: { pt: 'ETD', en: 'ETD' },
  eta: { pt: 'ETA', en: 'ETA' },
};

export function ActivityTab({ shipmentId, companyId }: Props) {
  const { t, language } = useLanguage();

  const { data: logs = [] } = useQuery({
    queryKey: ['shipment-audit', shipmentId],
    queryFn: async () => {
      // shipment_audit_log.user_id não tem FK declarada para profiles, então o embed
      // `profiles:user_id(...)` falha com 400 no PostgREST. Busca os nomes à parte.
      const { data, error } = await (supabase
        .from('shipment_audit_log') as any)
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) return [];
      const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
      let nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      }
      return rows.map((r: any) => ({ ...r, profiles: { full_name: nameMap.get(r.user_id) || null } }));
    },
  });

  function getFieldLabel(field: string) {
    return fieldLabels[field]?.[language] || field;
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          {t('shipments.activity')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('common.no_data')}</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{getFieldLabel(log.field_name)}</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="line-through">{log.old_value || '—'}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="font-semibold text-foreground">{log.new_value || '—'}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.profiles?.full_name || 'Sistema'} · {format(new Date(log.changed_at), 'dd/MM/yy HH:mm')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
