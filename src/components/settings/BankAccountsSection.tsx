import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Pencil, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

type BankAccount = {
  id: string;
  bank_name: string;
  branch: string | null;
  account_number: string | null;
  account_holder: string;
  tax_id: string | null;
  currency: string;
  iban: string | null;
  swift: string | null;
  pix_key: string | null;
  is_default: boolean;
  active: boolean;
};

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CNY'];

const emptyForm = (): Partial<BankAccount> => ({
  bank_name: '', branch: '', account_number: '', account_holder: '', tax_id: '',
  currency: 'BRL', iban: '', swift: '', pix_key: '', is_default: false, active: true,
});

export function BankAccountsSection() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<BankAccount> | null>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ['company_bank_accounts', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_bank_accounts' as any)
        .select('*')
        .eq('company_id', profile!.company_id)
        .order('is_default', { ascending: false })
        .order('currency');
      if (error) throw error;
      return (data ?? []) as unknown as BankAccount[];
    },
  });

  function openNew() { setEditing(emptyForm()); setOpen(true); }
  function openEdit(a: BankAccount) { setEditing({ ...a }); setOpen(true); }

  async function save() {
    if (!editing || !profile?.company_id) return;
    if (!editing.bank_name || !editing.account_holder) {
      toast.error('Preencha banco e titular'); return;
    }
    try {
      const payload: any = { ...editing, company_id: profile.company_id };
      // Se marcar como default, desmarcar outros da mesma moeda
      if (editing.is_default) {
        await supabase.from('company_bank_accounts' as any)
          .update({ is_default: false })
          .eq('company_id', profile.company_id)
          .eq('currency', editing.currency);
      }
      if (editing.id) {
        const { error } = await supabase.from('company_bank_accounts' as any)
          .update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('company_bank_accounts' as any).insert(payload);
        if (error) throw error;
      }
      toast.success('Conta bancária salva');
      setOpen(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ['company_bank_accounts'] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta conta?')) return;
    const { error } = await supabase.from('company_bank_accounts' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Conta excluída');
    qc.invalidateQueries({ queryKey: ['company_bank_accounts'] });
  }

  const f = editing || {};
  const set = (k: keyof BankAccount, v: any) => setEditing(p => ({ ...(p || {}), [k]: v }));
  const isForeign = (f.currency || 'BRL') !== 'BRL';

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Dados Bancários</CardTitle>
          <CardDescription>
            Contas exibidas nas Notas de Débito emitidas ao cliente. Marque uma como padrão por moeda.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova conta</Button>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Moeda</TableHead>
                <TableHead>Ag/Conta</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(a => (
                <TableRow key={a.id}>
                  <TableCell>{a.bank_name}</TableCell>
                  <TableCell>{a.account_holder}</TableCell>
                  <TableCell><Badge variant="outline">{a.currency}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{[a.branch, a.account_number].filter(Boolean).join(' / ')}</TableCell>
                  <TableCell>{a.is_default && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar conta bancária' : 'Nova conta bancária'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Banco *</Label><Input value={f.bank_name || ''} onChange={e => set('bank_name', e.target.value)} /></div>
            <div><Label>Agência</Label><Input value={f.branch || ''} onChange={e => set('branch', e.target.value)} /></div>
            <div><Label>Conta</Label><Input value={f.account_number || ''} onChange={e => set('account_number', e.target.value)} /></div>
            <div className="col-span-2"><Label>Titular *</Label><Input value={f.account_holder || ''} onChange={e => set('account_holder', e.target.value)} /></div>
            <div><Label>CNPJ/CPF do titular</Label><Input value={f.tax_id || ''} onChange={e => set('tax_id', e.target.value)} /></div>
            <div>
              <Label>Moeda</Label>
              <Select value={f.currency || 'BRL'} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isForeign && (
              <>
                <div><Label>IBAN</Label><Input value={f.iban || ''} onChange={e => set('iban', e.target.value)} /></div>
                <div><Label>SWIFT/BIC</Label><Input value={f.swift || ''} onChange={e => set('swift', e.target.value)} /></div>
              </>
            )}
            {(f.currency || 'BRL') === 'BRL' && (
              <div className="col-span-2"><Label>Chave PIX</Label><Input value={f.pix_key || ''} onChange={e => set('pix_key', e.target.value)} /></div>
            )}
            <div className="flex items-center gap-2 col-span-2">
              <Switch checked={!!f.is_default} onCheckedChange={v => set('is_default', v)} />
              <Label>Conta padrão para esta moeda</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
