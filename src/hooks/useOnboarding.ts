import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  path: string;
  done: boolean;
};

export function useOnboarding() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const companyId = profile?.company_id;

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status', companyId],
    enabled: !!companyId && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const [company, partners, banks, users, quotes, shipments] = await Promise.all([
        supabase.from('companies').select('cnpj').eq('id', companyId!).maybeSingle(),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId!),
        supabase.from('company_bank_accounts' as any).select('id', { count: 'exact', head: true }).eq('company_id', companyId!),
        supabase.from('profiles').select('user_id', { count: 'exact', head: true }).eq('company_id', companyId!),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('company_id', companyId!),
        supabase.from('shipments').select('id', { count: 'exact', head: true }).eq('company_id', companyId!),
      ]);

      return {
        hasCnpj: !!(company.data as any)?.cnpj,
        partners: partners.count ?? 0,
        banks: banks.count ?? 0,
        users: users.count ?? 0,
        quotes: quotes.count ?? 0,
        shipments: shipments.count ?? 0,
      };
    },
  });

  const steps: OnboardingStep[] = [
    {
      id: 'company',
      label: 'Complete os dados da sua empresa',
      description: 'CNPJ, endereço e prefixo de referências.',
      path: '/settings',
      done: !!data?.hasCnpj,
    },
    {
      id: 'partner',
      label: 'Cadastre seu primeiro parceiro',
      description: 'Clientes, fornecedores e agentes.',
      path: '/registrations',
      done: (data?.partners ?? 0) > 0,
    },
    {
      id: 'bank',
      label: 'Cadastre uma conta bancária',
      description: 'Necessária para o módulo financeiro.',
      path: '/settings?tab=bancos',
      done: (data?.banks ?? 0) > 0,
    },
    {
      id: 'team',
      label: 'Convide sua equipe',
      description: 'Adicione operadores, vendedores e financeiro.',
      path: '/settings?tab=usuarios',
      done: (data?.users ?? 0) > 1,
    },
    {
      id: 'quote',
      label: 'Crie sua primeira cotação',
      description: 'Simule custos e envie propostas em PDF.',
      path: '/quotes',
      done: (data?.quotes ?? 0) > 0,
    },
    {
      id: 'shipment',
      label: 'Acompanhe seu primeiro embarque',
      description: 'Converta uma cotação aprovada em embarque.',
      path: '/shipments',
      done: (data?.shipments ?? 0) > 0,
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);
  const dismissed = !!(profile as any)?.onboarding_dismissed_at;
  const tourSeen = !!(profile as any)?.onboarding_tour_seen_at;

  async function dismiss() {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ onboarding_dismissed_at: new Date().toISOString() } as any)
      .eq('user_id', user.id);
    qc.invalidateQueries({ queryKey: ['profile'] });
    window.location.reload();
  }

  async function markTourSeen() {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ onboarding_tour_seen_at: new Date().toISOString() } as any)
      .eq('user_id', user.id);
  }

  return { steps, doneCount, progress, dismissed, tourSeen, dismiss, markTourSeen, isLoading };
}