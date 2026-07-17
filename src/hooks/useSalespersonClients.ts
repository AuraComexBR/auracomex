import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

/**
 * If user is a salesperson, returns their client IDs.
 * Otherwise returns null (meaning no filter needed).
 */
export function useSalespersonClients() {
  const { user, role } = useAuth();
  const isSalesperson = role === 'salesperson';

  const { data: clientIds } = useQuery({
    queryKey: ['salesperson-clients', user?.id],
    enabled: isSalesperson && !!user,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('clients')
        .select('id') as any)
        .eq('salesperson_id', user!.id);
      if (error) throw error;
      return (data || []).map((c: any) => c.id as string);
    },
  });

  return {
    isSalesperson,
    clientIds: isSalesperson ? (clientIds || []) : null,
  };
}
