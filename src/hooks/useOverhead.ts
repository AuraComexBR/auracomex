import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type OverheadCategory = {
  id: string;
  company_id: string;
  name: string;
  color: string | null;
  active: boolean;
};

export type OverheadExpense = {
  id: string;
  company_id: string;
  name: string;
  category_id: string | null;
  supplier_id: string | null;
  amount_default: number;
  currency: string;
  recurrence: 'monthly' | 'bimonthly' | 'quarterly' | 'yearly';
  due_day: number;
  start_date: string;
  end_date: string | null;
  payment_method: string | null;
  cost_center: string | null;
  active: boolean;
  notes: string | null;
};

export type OverheadEntry = {
  id: string;
  company_id: string;
  overhead_expense_id: string;
  reference_month: string;
  due_date: string;
  amount: number;
  currency: string;
  amount_brl: number | null;
  status: 'pending' | 'paid' | 'late' | 'cancelled';
  paid_at: string | null;
  payment_proof_url: string | null;
  notes: string | null;
};

function monthsBetween(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}
function fitsRecurrence(rec: string, start: Date, ref: Date) {
  const diff = monthsBetween(start, ref);
  if (diff < 0) return false;
  switch (rec) {
    case 'monthly': return true;
    case 'bimonthly': return diff % 2 === 0;
    case 'quarterly': return diff % 3 === 0;
    case 'yearly': return diff % 12 === 0;
    default: return true;
  }
}

export function useOverheadCategories() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const companyId = profile?.company_id;

  const query = useQuery({
    queryKey: ['overhead_categories', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('overhead_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as OverheadCategory[];
    },
    enabled: !!companyId,
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<OverheadCategory> & { name: string }) => {
      const payload: any = { ...input, company_id: companyId };
      const { error } = input.id
        ? await (supabase as any).from('overhead_categories').update(payload).eq('id', input.id)
        : await (supabase as any).from('overhead_categories').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overhead_categories', companyId] }); toast.success('Categoria salva'); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('overhead_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overhead_categories', companyId] }); toast.success('Categoria removida'); },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, upsert, remove };
}

export function useOverheadExpenses() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const companyId = profile?.company_id;

  const query = useQuery({
    queryKey: ['overhead_expenses', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('overhead_expenses')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as OverheadExpense[];
    },
    enabled: !!companyId,
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<OverheadExpense> & { name: string }) => {
      const payload: any = { ...input, company_id: companyId };
      const { error } = input.id
        ? await (supabase as any).from('overhead_expenses').update(payload).eq('id', input.id)
        : await (supabase as any).from('overhead_expenses').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overhead_expenses', companyId] }); toast.success('Despesa salva'); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('overhead_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overhead_expenses', companyId] }); toast.success('Despesa removida'); },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, upsert, remove };
}

export function useOverheadEntries(referenceMonth: string) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const companyId = profile?.company_id;

  const query = useQuery({
    queryKey: ['overhead_entries', companyId, referenceMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('overhead_entries')
        .select('*')
        .eq('reference_month', referenceMonth)
        .order('due_date');
      if (error) throw error;
      return (data || []) as OverheadEntry[];
    },
    enabled: !!companyId && !!referenceMonth,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data: expenses, error: e1 } = await (supabase as any)
        .from('overhead_expenses')
        .select('*')
        .eq('active', true);
      if (e1) throw e1;
      const ref = new Date(referenceMonth + 'T00:00:00');
      const rows: any[] = [];
      for (const exp of (expenses || []) as OverheadExpense[]) {
        const start = new Date(exp.start_date + 'T00:00:00');
        const end = exp.end_date ? new Date(exp.end_date + 'T00:00:00') : null;
        if (end && ref > end) continue;
        if (!fitsRecurrence(exp.recurrence, start, ref)) continue;
        const day = Math.min(Math.max(1, exp.due_day || 5), 28);
        const due = `${referenceMonth.slice(0, 7)}-${String(day).padStart(2, '0')}`;
        rows.push({
          company_id: companyId,
          overhead_expense_id: exp.id,
          reference_month: referenceMonth,
          due_date: due,
          amount: exp.amount_default,
          currency: exp.currency,
          status: 'pending',
        });
      }
      if (rows.length === 0) return 0;
      const { error } = await (supabase as any)
        .from('overhead_entries')
        .upsert(rows, { onConflict: 'overhead_expense_id,reference_month', ignoreDuplicates: true });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['overhead_entries', companyId, referenceMonth] }); toast.success(`${n} lançamento(s) gerados`); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<OverheadEntry> }) => {
      const { error } = await (supabase as any).from('overhead_entries').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['overhead_entries', companyId, referenceMonth] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('overhead_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overhead_entries', companyId, referenceMonth] }); toast.success('Removido'); },
    onError: (e: any) => toast.error(e.message),
  });

  const createOneOff = useMutation({
    mutationFn: async (input: {
      name: string;
      category_id?: string | null;
      amount: number;
      currency: string;
      due_date: string; // yyyy-MM-dd
      notes?: string | null;
    }) => {
      const due = input.due_date;
      const day = Math.min(Math.max(1, parseInt(due.slice(8, 10)) || 1), 28);
      const { data: exp, error: e1 } = await (supabase as any)
        .from('overhead_expenses')
        .insert({
          company_id: companyId,
          name: `[Avulso] ${input.name}`,
          category_id: input.category_id || null,
          amount_default: input.amount,
          currency: input.currency,
          recurrence: 'monthly',
          due_day: day,
          start_date: due,
          end_date: due,
          active: false,
          notes: input.notes || null,
        })
        .select('id')
        .single();
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any)
        .from('overhead_entries')
        .insert({
          company_id: companyId,
          overhead_expense_id: exp.id,
          reference_month: referenceMonth,
          due_date: due,
          amount: input.amount,
          currency: input.currency,
          status: 'pending',
          notes: input.notes || null,
        });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overhead_entries', companyId, referenceMonth] });
      qc.invalidateQueries({ queryKey: ['overhead_expenses', companyId] });
      toast.success('Despesa avulsa adicionada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, generate, update, remove, createOneOff };
}