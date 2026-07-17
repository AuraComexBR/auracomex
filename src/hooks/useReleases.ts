import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ReleaseHighlight = { icon: string; label: string; description: string };
export type Release = {
  id: string;
  version: string;
  title: string;
  summary: string | null;
  highlights: ReleaseHighlight[];
  is_major: boolean;
  published_at: string;
};

export function useReleases() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const releasesQ = useQuery({
    queryKey: ['app_releases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_releases' as any)
        .select('*')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Release[];
    },
  });

  const readsQ = useQuery({
    queryKey: ['user_release_reads', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_release_reads' as any)
        .select('release_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.release_id as string));
    },
  });

  const releases = releasesQ.data ?? [];
  const readIds = readsQ.data ?? new Set<string>();
  const unread = releases.filter(r => !readIds.has(r.id));

  async function markRead(releaseId: string) {
    if (!user?.id) return;
    await supabase.from('user_release_reads' as any).insert({ user_id: user.id, release_id: releaseId });
    qc.invalidateQueries({ queryKey: ['user_release_reads', user.id] });
  }

  async function markAllRead() {
    if (!user?.id || unread.length === 0) return;
    await supabase.from('user_release_reads' as any).insert(
      unread.map(r => ({ user_id: user.id, release_id: r.id }))
    );
    qc.invalidateQueries({ queryKey: ['user_release_reads', user.id] });
  }

  return { releases, unread, loading: releasesQ.isLoading || readsQ.isLoading, markRead, markAllRead };
}