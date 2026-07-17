import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const PERIOD_OPTIONS = [
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '180 dias' },
  { value: '365', label: '1 ano' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onSuccess: () => void;
}

export function RenewAccessDialog({ open, onOpenChange, companyId, companyName, onSuccess }: Props) {
  const [period, setPeriod] = useState('30');
  const [saving, setSaving] = useState(false);

  async function handleRenew() {
    setSaving(true);
    try {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + parseInt(period));

      const { error } = await supabase
        .from('companies')
        .update({ access_expires_at: newDate.toISOString() } as any)
        .eq('id', companyId);
      if (error) throw error;

      toast.success(`Acesso de "${companyName}" renovado por ${period} dias!`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renovar Acesso</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Renovar acesso de <strong>{companyName}</strong> a partir de hoje.
        </p>
        <div className="space-y-2">
          <Label>Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleRenew} disabled={saving} className="w-full">
          {saving ? 'Renovando...' : 'Confirmar Renovação'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
