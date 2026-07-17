import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionPlan = 'starter' | 'professional' | 'business';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled';
export type AddonKey = 'cost_estimate_premium' | 'tracking_portal' | 'ai_import' | 'multi_company';

export interface SubscriptionData {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  seatsLimit: number | null;
  shipmentsLimit: number | null;
  addons: Set<AddonKey>;
}

export const ADDON_META: Record<AddonKey, { label: string; description: string; commercial: boolean }> = {
  cost_estimate_premium: {
    label: 'Estimativa de Custo Premium',
    description: 'Cálculo fiscal completo (II, IPI, PIS, COFINS, ICMS por estado, VMLD e despesas aduaneiras).',
    commercial: true,
  },
  tracking_portal: {
    label: 'Portal de Tracking do Cliente',
    description: 'Link público com PIN para o cliente acompanhar o embarque em tempo real.',
    commercial: true,
  },
  ai_import: {
    label: 'IA para Importar Cotações',
    description: 'Cole o email/PDF do agente e a IA cria a cotação preenchida automaticamente.',
    commercial: true,
  },
  multi_company: {
    label: 'Multi-empresa (Grupo)',
    description: 'Painel Superadmin para gerenciar várias empresas do mesmo grupo.',
    commercial: false,
  },
};

export function useSubscription() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  return useQuery<SubscriptionData | null>({
    queryKey: ['subscription', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const [subRes, addonsRes] = await Promise.all([
        supabase.from('company_subscriptions' as any).select('*').eq('company_id', companyId).maybeSingle(),
        supabase.from('company_addons' as any).select('addon_key, active').eq('company_id', companyId).eq('active', true),
      ]);
      const sub = subRes.data as any;
      if (!sub) return null;
      const explicit = new Set<AddonKey>(((addonsRes.data as any[]) || []).map((r) => r.addon_key as AddonKey));
      // Business inclui todos os add-ons comerciais automaticamente (multi_company é sempre explícito).
      const addons = new Set<AddonKey>(explicit);
      if (sub.plan === 'business' && (sub.status === 'active' || sub.status === 'trial')) {
        addons.add('cost_estimate_premium');
        addons.add('tracking_portal');
        addons.add('ai_import');
      }
      return {
        plan: sub.plan,
        status: sub.status,
        trialEndsAt: sub.trial_ends_at,
        currentPeriodEnd: sub.current_period_end,
        seatsLimit: sub.seats_limit,
        shipmentsLimit: sub.shipments_limit,
        addons,
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHasAddon(addon: AddonKey): boolean {
  const { data } = useSubscription();
  return !!data?.addons.has(addon);
}

export const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  starter: 'Starter',
  professional: 'Professional',
  business: 'Business',
};