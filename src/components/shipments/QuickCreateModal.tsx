import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PortSelect } from '@/components/shared/PortSelect';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function QuickCreateModal({ open, onClose, onCreated }: Props) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    origin_city: '',
    origin_country: '',
    origin_port: '',
    destination_city: '',
    destination_country: '',
    destination_port: '',
    transport_mode: 'ocean_fcl' as string,
    incoterm: 'FOB',
    cargo_description: '',
  });

  async function handleCreate() {
    if (!profile) return;
    setLoading(true);
    try {
      // Generate sequential reference via RPC
      const { data: refNum, error: rpcErr } = await supabase.rpc('next_reference', { p_company_id: profile.company_id });
      if (rpcErr) throw rpcErr;
      const { error } = await supabase.from('shipments').insert([{
        company_id: profile.company_id,
        reference_number: refNum,
        origin_city: form.origin_city,
        origin_country: form.origin_country,
        origin_port: form.origin_port || null,
        destination_city: form.destination_city,
        destination_country: form.destination_country,
        destination_port: form.destination_port || null,
        transport_mode: form.transport_mode as any,
        incoterm: form.incoterm,
        cargo_description: form.cargo_description,
        status: 'approved' as any,
        created_by: profile.user_id,
      }]);
      if (error) throw error;
      toast.success(t('shipments.new') + ': ' + refNum);
      onCreated();
      setForm({
        origin_city: '', origin_country: '', origin_port: '',
        destination_city: '', destination_country: '', destination_port: '',
        transport_mode: 'ocean_fcl', incoterm: 'FOB', cargo_description: '',
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('shipments.quick_create')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('shipments.origin')}</Label>
              <Input
                placeholder="São Paulo"
                value={form.origin_city}
                onChange={(e) => setForm({ ...form, origin_city: e.target.value })}
              />
              <Input
                placeholder="BR"
                value={form.origin_country}
                onChange={(e) => setForm({ ...form, origin_country: e.target.value })}
              />
              <PortSelect
                value={form.origin_port}
                onChange={(v) => setForm({ ...form, origin_port: v })}
                transportMode={form.transport_mode}
                placeholder="Porto/Aeroporto origem"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('shipments.destination')}</Label>
              <Input
                placeholder="Rotterdam"
                value={form.destination_city}
                onChange={(e) => setForm({ ...form, destination_city: e.target.value })}
              />
              <Input
                placeholder="NL"
                value={form.destination_country}
                onChange={(e) => setForm({ ...form, destination_country: e.target.value })}
              />
              <PortSelect
                value={form.destination_port}
                onChange={(v) => setForm({ ...form, destination_port: v })}
                transportMode={form.transport_mode}
                placeholder="Porto/Aeroporto destino"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('shipments.mode')}</Label>
              <Select value={form.transport_mode} onValueChange={(v) => setForm({ ...form, transport_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['ocean_fcl', 'ocean_lcl', 'air', 'road', 'multimodal'].map((m) => (
                    <SelectItem key={m} value={m}>{t(`mode.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('shipments.incoterm')}</Label>
              <Select value={form.incoterm} onValueChange={(v) => setForm({ ...form, incoterm: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['EXW', 'FOB', 'CIF', 'CFR', 'DDP', 'DAP', 'FCA'].map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('shipments.cargo_desc')}</Label>
            <Input
              placeholder="e.g. 20 pallets of electronics"
              value={form.cargo_description}
              onChange={(e) => setForm({ ...form, cargo_description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={loading || !form.origin_city || !form.destination_city}>
              {loading ? t('common.loading') : t('common.create')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
