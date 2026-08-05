import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { OverheadCategory, OverheadExpense, OverheadKind, useOverheadExpenses, useOverheadEntries } from '@/hooks/useOverhead';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: OverheadKind;
  /** Presente só ao editar uma despesa/receita recorrente já existente (via
   *  lápis na lista) — nesse caso o toggle "Recorrente" fica travado em sim,
   *  já que um lançamento avulso não tem essa edição. */
  expense: OverheadExpense | null;
  referenceMonth: string;
  categories: OverheadCategory[];
};

const emptyRecurring: Partial<OverheadExpense> = {
  name: '', amount_default: 0, currency: 'BRL', recurrence: 'monthly',
  due_day: 5, start_date: new Date().toISOString().slice(0, 10), active: true,
};

export function TransactionModal({ open, onOpenChange, kind, expense, referenceMonth, categories }: Props) {
  const { upsert } = useOverheadExpenses();
  const { createOneOff } = useOverheadEntries(referenceMonth);

  const [recurring, setRecurring] = useState(true);
  const [form, setForm] = useState<Partial<OverheadExpense>>(emptyRecurring);
  // Campos exclusivos do modo avulso (não recorrente)
  const [oneOffDueDate, setOneOffDueDate] = useState(new Date().toISOString().slice(0, 10));

  const isExpense = kind === 'despesa';
  const label = isExpense ? 'despesa' : 'receita';
  const paymentFieldLabel = isExpense ? 'Forma de pagamento' : 'Forma de recebimento';

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setRecurring(true);
      setForm({ ...expense });
    } else {
      setRecurring(true);
      setForm({ ...emptyRecurring, kind } as any);
      setOneOffDueDate(new Date().toISOString().slice(0, 10));
    }
  }, [expense, open, kind]);

  async function save() {
    if (!form.name?.trim()) return;
    if (recurring) {
      await upsert.mutateAsync({ ...form, kind } as any);
    } else {
      await createOneOff.mutateAsync({
        name: form.name.trim(),
        category_id: form.category_id || null,
        amount: Number(form.amount_default) || 0,
        currency: form.currency || 'BRL',
        due_date: oneOffDueDate,
        notes: form.notes || null,
        kind,
      });
    }
    onOpenChange(false);
  }

  const saving = upsert.isPending || createOneOff.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{expense ? `Editar ${label}` : `Nova ${label}`}</DialogTitle>
          <DialogDescription>
            {isExpense
              ? 'Despesa da empresa, sem vínculo com processo/cotação.'
              : 'Receita da empresa, sem vínculo com processo/cotação.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Descrição</Label>
            <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={form.category_id || 'none'} onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.filter((c) => c.active && c.kind === kind).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Valor</Label>
            <Input type="number" step="0.01" value={form.amount_default ?? 0}
              onChange={(e) => setForm({ ...form, amount_default: parseFloat(e.target.value) || 0 })} />
          </div>

          <div className="space-y-1.5">
            <Label>Moeda</Label>
            <Select value={form.currency || 'BRL'} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{paymentFieldLabel}</Label>
            <Input value={form.payment_method || ''} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} />
          </div>

          {/* Recorrente ou não — decide quais campos de data aparecem abaixo. */}
          <div className="col-span-2 flex items-center gap-3 rounded-md border border-border/50 bg-muted/20 p-3">
            <Switch checked={recurring} disabled={!!expense} onCheckedChange={setRecurring} />
            <div>
              <Label className="text-sm">Recorrente</Label>
              <p className="text-xs text-muted-foreground">
                {recurring ? 'Repete automaticamente todo mês (ou outra periodicidade).' : 'Lançamento único, só neste mês.'}
              </p>
            </div>
          </div>

          {recurring ? (
            <>
              <div className="space-y-1.5">
                <Label>Recorrência</Label>
                <Select value={form.recurrence || 'monthly'} onValueChange={(v: any) => setForm({ ...form, recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="bimonthly">Bimestral</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dia de vencimento</Label>
                <Input type="number" min={1} max={28} value={form.due_day ?? 5}
                  onChange={(e) => setForm({ ...form, due_day: parseInt(e.target.value) || 5 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="date" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim (opcional)</Label>
                <Input type="date" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} />
              </div>
              {expense && (
                <div className="col-span-2 flex items-center gap-3 rounded-md border border-border/50 bg-muted/20 p-3">
                  <Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                  <Label className="text-sm">Ativa</Label>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Data de vencimento</Label>
              <Input type="date" value={oneOffDueDate} onChange={(e) => setOneOffDueDate(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Centro de custo</Label>
            <Input value={form.cost_center || ''} onChange={(e) => setForm({ ...form, cost_center: e.target.value })} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.name?.trim()}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
