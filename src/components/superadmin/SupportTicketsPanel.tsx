import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LifeBuoy, Building2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAllTickets, useUpdateTicket, useDeleteTicket } from '@/hooks/useSupportTickets';
import { TicketThread } from '@/components/support/TicketThread';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { STATUS_LABEL, STATUS_COLOR, CATEGORY_LABEL, PRIORITY_LABEL, ticketStatuses, ticketPriorities, type TicketStatus } from '@/lib/ticketSchemas';

export function SupportTicketsPanel() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const { data: tickets = [], isLoading } = useAllTickets({ status: statusFilter });
  const [selected, setSelected] = useState<any | null>(null);
  const update = useUpdateTicket();
  const del = useDeleteTicket();

  // Mantém `selected` sincronizado quando a lista é revalidada após um update
  useEffect(() => {
    if (!selected) return;
    const fresh = tickets.find((t: any) => t.id === selected.id);
    if (fresh && (fresh.status !== selected.status || fresh.priority !== selected.priority)) {
      setSelected(fresh);
    }
  }, [tickets, selected]);

  const openCount = tickets.filter((t: any) => t.status === 'aberto').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            Suporte
            {openCount > 0 && <Badge className="bg-status-attention/20 text-status-attention">{openCount} aberto(s)</Badge>}
          </CardTitle>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {ticketStatuses.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && tickets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum ticket.</p>
        )}
        <div className="space-y-2">
          {tickets.map((t: any) => (
            <div
              key={t.id}
              className="w-full border border-border rounded-lg p-3 hover:bg-secondary/40 transition-colors flex items-start gap-3"
            >
              <button onClick={() => setSelected(t)} className="flex-1 text-left">
                <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.title}</span>
                    <Badge className={STATUS_COLOR[t.status as TicketStatus]}>{STATUS_LABEL[t.status as TicketStatus]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[t.category as keyof typeof CATEGORY_LABEL]}</Badge>
                    <Badge variant="outline" className="text-[10px]">Prio: {PRIORITY_LABEL[t.priority as keyof typeof PRIORITY_LABEL]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" />{t.companies?.name ?? '—'} · {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                </div>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir ticket?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{t.title}" será removido permanentemente, incluindo todas as mensagens. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground"
                      onClick={() => del.mutate(t.id, {
                        onSuccess: () => { toast.success('Ticket excluído'); if (selected?.id === t.id) setSelected(null); },
                        onError: (e: any) => toast.error(e.message ?? 'Erro ao excluir'),
                      })}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {selected?.title}
              {selected && <Badge className={STATUS_COLOR[selected.status as TicketStatus]}>{STATUS_LABEL[selected.status as TicketStatus]}</Badge>}
            </DialogTitle>
            {selected?.companies?.name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3 h-3" />{selected.companies.name}</p>
            )}
          </DialogHeader>
          {selected && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select value={selected.status} onValueChange={(v) => {
                    setSelected({ ...selected, status: v });
                    update.mutate({ id: selected.id, status: v as any });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ticketStatuses.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Prioridade</p>
                  <Select value={selected.priority} onValueChange={(v) => {
                    setSelected({ ...selected, priority: v });
                    update.mutate({ id: selected.id, priority: v as any });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ticketPriorities.map(p => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <TicketThread ticketId={selected.id} ticketDescription={selected.description} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}