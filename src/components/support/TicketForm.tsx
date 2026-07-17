import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ticketFormSchema, CATEGORY_LABEL, PRIORITY_LABEL, ticketCategories, ticketPriorities, type TicketFormValues } from '@/lib/ticketSchemas';
import { useCreateTicket } from '@/hooks/useSupportTickets';

export function TicketForm({ onSuccess }: { onSuccess?: () => void }) {
  const [values, setValues] = useState<TicketFormValues>({
    title: '', description: '', category: 'duvida', priority: 'media',
  });
  const create = useCreateTicket();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ticketFormSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      toast.success('Ticket enviado! Nossa equipe responderá em breve.');
      setValues({ title: '', description: '', category: 'duvida', priority: 'media' });
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar ticket');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Título</Label>
        <Input
          value={values.title}
          onChange={(e) => setValues(v => ({ ...v, title: e.target.value }))}
          placeholder="Resumo do que aconteceu"
          maxLength={120}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={values.category} onValueChange={(v) => setValues(vs => ({ ...vs, category: v as any }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ticketCategories.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={values.priority} onValueChange={(v) => setValues(vs => ({ ...vs, priority: v as any }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ticketPriorities.map(p => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={values.description}
          onChange={(e) => setValues(v => ({ ...v, description: e.target.value }))}
          placeholder="Descreva o problema, sugestão ou dúvida em detalhes. Inclua passos para reproduzir se for um bug."
          rows={6}
          maxLength={4000}
        />
        <p className="text-xs text-muted-foreground">{values.description.length}/4000</p>
      </div>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? 'Enviando...' : 'Enviar ticket'}
      </Button>
    </form>
  );
}