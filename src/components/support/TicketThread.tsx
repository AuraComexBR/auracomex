import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketMessages, usePostMessage } from '@/hooks/useSupportTickets';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Shield, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { messageSchema } from '@/lib/ticketSchemas';

export function TicketThread({ ticketId, ticketDescription }: { ticketId: string; ticketDescription?: string }) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = useTicketMessages(ticketId);
  const post = usePostMessage();
  const [body, setBody] = useState('');

  async function handleSend() {
    const parsed = messageSchema.safeParse({ body });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    try {
      await post.mutateAsync({ ticketId, body: parsed.data.body });
      setBody('');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-3">
      {ticketDescription && (
        <div className="p-3 rounded-lg bg-secondary/40 border border-border/50 text-sm whitespace-pre-wrap">
          {ticketDescription}
        </div>
      )}

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {messages.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground text-center py-4">Sem respostas ainda.</p>
        )}
        {messages.map((m: any) => {
          const isMe = m.author_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : ''}`}>
              {!isMe && (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.is_staff ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {m.is_staff ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground' : m.is_staff ? 'bg-primary/10' : 'bg-secondary'}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {m.is_staff && !isMe && 'Suporte · '}{format(new Date(m.created_at), 'dd/MM HH:mm')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 pt-2 border-t">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva uma resposta..."
          rows={3}
          maxLength={4000}
        />
        <Button onClick={handleSend} disabled={post.isPending || !body.trim()} size="sm" className="w-full">
          {post.isPending ? 'Enviando...' : 'Enviar resposta'}
        </Button>
      </div>
    </div>
  );
}