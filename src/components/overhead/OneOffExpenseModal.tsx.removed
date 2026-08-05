import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { OverheadCategory, useOverheadEntries } from '@/hooks/useOverhead';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  referenceMonth: string;
  categories: OverheadCategory[];
};

export function OneOffExpenseModal({ open, onOpenChange, referenceMonth, categories }: Props) {
  const { createOneOff } = useOverheadEntries(referenceMonth);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('none');
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('BRL');
  const [dueDate, setDueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setName(''); setCategoryId('none'); setAmount(0); setCurrency('BRL');
      setDueDate(new Date().toISOString().slice(0, 10)); setNotes('');
    }
  }, [open]);

  async function save() {
    if (!name.trim() || !amount || !dueDate) return;
    await createOneOff.mutateAsync({
      name: name.trim(),
      category_id: categoryId === 'none' ? null : categoryId,
      amount,
      currency,
      due_date: dueDate,
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova despesa avulsa</DialogTitle>
          <DialogDescription>Custo pontual, não vinculado a processo nem recorrente.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Descrição</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Compra de material" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.filter(c => c.active).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <Input type="number" step="0.01" value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Moeda</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Data de vencimento</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={createOneOff.isPending || !name.trim() || !amount || !dueDate}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}