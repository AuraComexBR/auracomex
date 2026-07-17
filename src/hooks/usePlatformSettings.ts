import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings' as any)
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as unknown as { id: string; logo_url: string | null; logo_dark_url: string | null; updated_at: string };
    },
    staleTime: 5 * 60 * 1000,
  });
}
