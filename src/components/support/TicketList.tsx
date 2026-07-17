import { useState } from 'react';
import { useMyTickets } from '@/hooks/useSupportTickets';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { STATUS_LABEL, STATUS_COLOR, CATEGORY_LABEL } from '@/lib/ticketSchemas';
import { TicketThread } from './TicketThread';
import { format } from 'date-fns';

export function TicketList() {
  const { data: tickets = [], isLoading } = useMyTickets();
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando...</p>;
  if (tickets.length === 0)
    return <p className="text-sm text-muted-foreground text-center py-8">Você ainda não abriu tickets.</p>;

  return (
    <div className="space-y-2">
      {tickets.map((t: any) => (
        <Collapsible key={t.id} open={openId === t.id} onOpenChange={(o) => setOpenId(o ? t.id : null)}>
          <div className="border border-border rounded-lg overflow-hidden">
            <CollapsibleTrigger className="w-full p-3 hover:bg-secondary/40 transition-colors">
              <div className="flex items-start gap-3 text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.title}</span>
                    <Badge className={STATUS_COLOR[t.status as keyof typeof STATUS_COLOR]}>{STATUS_LABEL[t.status as keyof typeof STATUS_LABEL]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[t.category as keyof typeof CATEGORY_LABEL]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${openId === t.id ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 border-t border-border">
                <TicketThread ticketId={t.id} ticketDescription={t.description} />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}