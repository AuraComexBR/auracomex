import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TicketFormValues, TicketStatus, TicketPriority } from '@/lib/ticketSchemas';

export function useMyTickets() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['support-tickets', 'company', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useAllTickets(filter?: { status?: TicketStatus | 'all' }) {
  return useQuery({
    queryKey: ['support-tickets', 'admin', filter?.status ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('support_tickets' as any)
        .select('*, companies(name)')
        .order('created_at', { ascending: false });
      if (filter?.status && filter.status !== 'all') q = q.eq('status', filter.status);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useTicketMessages(ticketId: string | null) {
  return useQuery({
    queryKey: ['support-ticket-messages', ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_ticket_messages' as any)
        .select('*')
        .eq('ticket_id', ticketId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateTicket() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: TicketFormValues) => {
      if (!user || !profile?.company_id) throw new Error('Não autenticado');
      const { data, error } = await supabase
        .from('support_tickets' as any)
        .insert({
          company_id: profile.company_id,
          created_by: user.id,
          title: values.title,
          description: values.description,
          category: values.category,
          priority: values.priority,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  });
}

export function usePostMessage() {
  const { user, isSuperadmin } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, body }: { ticketId: string; body: string }) => {
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('support_ticket_messages' as any)
        .insert({
          ticket_id: ticketId,
          author_id: user.id,
          is_staff: !!isSuperadmin,
          body,
        } as any);
      if (error) throw error;
      // Se for staff respondendo, muda status para em_andamento se estava aberto
      if (isSuperadmin) {
        await supabase
          .from('support_tickets' as any)
          .update({ status: 'em_andamento' } as any)
          .eq('id', ticketId)
          .eq('status', 'aberto');
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['support-ticket-messages', vars.ticketId] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, priority }: { id: string; status?: TicketStatus; priority?: TicketPriority }) => {
      const patch: any = {};
      if (status) patch.status = status;
      if (priority) patch.priority = priority;
      const { error } = await supabase.from('support_tickets' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('support_tickets' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  });
}