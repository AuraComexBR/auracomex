import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, X, Mail, Users, Ship, CreditCard, ExternalLink, ArrowUpRight } from 'lucide-react';
import { useSubscription, PLAN_LABEL, ADDON_META, type AddonKey } from '@/hooks/useSubscription';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';
import { PaymentTestModeBanner } from '@/components/billing/PaymentTestModeBanner';
import { getStripeEnvironment, isPaymentsConfigured } from '@/lib/stripe';
import { toast } from 'sonner';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const COMMERCIAL_ADDONS: AddonKey[] = ['cost_estimate_premium', 'tracking_portal', 'ai_import'];

const PLAN_PRICES: Record<'starter' | 'professional' | 'business', { price: string; priceId: string }> = {
  starter:      { price: 'R$ 297', priceId: 'aura_starter_monthly' },
  professional: { price: 'R$ 697', priceId: 'aura_professional_monthly' },
  business:     { price: 'R$ 1.497', priceId: 'aura_business_monthly' },
};

const ADDON_PRICES: Record<'cost_estimate_premium' | 'tracking_portal' | 'ai_import', string> = {
  cost_estimate_premium: 'aura_addon_cost_estimate_monthly',
  tracking_portal:       'aura_addon_tracking_monthly',
  ai_import:             'aura_addon_ai_import_monthly',
};

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    trial: { label: 'Trial', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    past_due: { label: 'Em atraso', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    canceled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground border-border' },
  };
  const m = map[status] || map.active;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

export default function Billing() {
  const { profile } = useAuth();
  const { data: sub, isLoading } = useSubscription();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: usage } = useQuery({
    queryKey: ['billing-usage', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return { users: 0, shipmentsThisMonth: 0 };
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [users, shipments] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id),
        supabase.from('shipments').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id).gte('created_at', monthStart.toISOString()),
      ]);
      return { users: users.count ?? 0, shipmentsThisMonth: shipments.count ?? 0 };
    },
    enabled: !!profile?.company_id,
  });

  const { data: subRow } = useQuery({
    queryKey: ['company-subscription-row', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data } = await supabase.from('company_subscriptions').select('stripe_customer_id, stripe_subscription_id').eq('company_id', profile.company_id).maybeSingle();
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const hasStripeSub = !!subRow?.stripe_subscription_id;
  const isCourtesy = !hasStripeSub && (sub?.plan === 'business') && sub?.status === 'active';

  async function openPortal() {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/billing`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message || 'Falha ao abrir portal');
      window.open(data.url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir portal');
    } finally {
      setPortalLoading(false);
    }
  }

  function handleSubscribe(priceId: string) {
    if (!isPaymentsConfigured()) {
      toast.error('Pagamentos ainda não estão ativos nesta build.');
      return;
    }
    openCheckout({ priceId });
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!sub) return <div className="p-6 text-muted-foreground">Nenhuma assinatura encontrada.</div>;

  return (
    <div className="space-y-6 animate-slide-in">
      <PaymentTestModeBanner />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assinatura</h1>
        <p className="text-sm text-muted-foreground">Gerencie o plano e os add-ons da sua empresa.</p>
      </div>

      {sub.status === 'past_due' && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400">
          Seu último pagamento falhou. Atualize o método de pagamento para manter o acesso.
        </div>
      )}

      {/* Plano */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Plano {PLAN_LABEL[sub.plan]}
              {isCourtesy && <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/30">Cortesia</Badge>}
            </CardTitle>
          </div>
          {statusBadge(sub.status)}
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <UsageStat icon={Users} label="Usuários" value={usage?.users ?? 0} limit={sub.seatsLimit} />
          <UsageStat icon={Ship} label="Embarques este mês" value={usage?.shipmentsThisMonth ?? 0} limit={sub.shipmentsLimit} />
          <div className="text-sm">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
              {sub.status === 'trial' ? 'Trial termina em' : 'Próximo ciclo'}
            </p>
            <p className="font-medium">
              {sub.status === 'trial' && sub.trialEndsAt
                ? new Date(sub.trialEndsAt).toLocaleDateString('pt-BR')
                : sub.currentPeriodEnd
                ? new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR')
                : '—'}
            </p>
          </div>
        </CardContent>
        {!isCourtesy && (
          <CardContent className="pt-0 flex flex-wrap gap-2">
            {hasStripeSub ? (
              <Button onClick={openPortal} disabled={portalLoading} variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                {portalLoading ? 'Abrindo…' : 'Gerenciar assinatura'}
              </Button>
            ) : (
              <Button onClick={() => handleSubscribe(PLAN_PRICES[sub.plan].priceId)}>
                <CreditCard className="w-4 h-4 mr-2" />
                Assinar plano {PLAN_LABEL[sub.plan]} — {PLAN_PRICES[sub.plan].price}/mês
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {/* Trocar de plano */}
      {!isCourtesy && (
        <Card className="glass">
          <CardHeader><CardTitle>Mudar de plano</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['starter', 'professional', 'business'] as const).map((p) => (
              <div key={p} className={`p-4 rounded-lg border ${sub.plan === p ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/40'}`}>
                <p className="font-semibold">{PLAN_LABEL[p]}</p>
                <p className="text-sm text-muted-foreground mb-3">{PLAN_PRICES[p].price}/mês</p>
                {sub.plan === p ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Plano atual</Badge>
                ) : hasStripeSub ? (
                  <Button size="sm" variant="outline" onClick={openPortal} disabled={portalLoading}>
                    <ArrowUpRight className="w-4 h-4 mr-1" />Trocar
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => handleSubscribe(PLAN_PRICES[p].priceId)}>Assinar</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add-ons */}
      <Card className="glass">
        <CardHeader><CardTitle>Add-ons</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {COMMERCIAL_ADDONS.map((key) => {
            const active = sub.addons.has(key);
            const meta = ADDON_META[key];
            const includedInBusiness = sub.plan === 'business';
            return (
              <div key={key} className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-card/40">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {active ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-muted-foreground" />}
                    <p className="font-medium">{meta.label}</p>
                  </div>
                  <p className="text-sm text-muted-foreground pl-6">{meta.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline" className={active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : ''}>
                    {active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {!active && !includedInBusiness && !isCourtesy && (
                    <Button size="sm" variant="outline" onClick={() => handleSubscribe(ADDON_PRICES[key as 'cost_estimate_premium' | 'tracking_portal' | 'ai_import'])}>
                      <CreditCard className="w-4 h-4 mr-1" />Assinar R$ 197
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* CTA comercial */}
      <Card className="glass">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Precisa de outro plano ou add-on?</p>
            <p className="text-sm text-muted-foreground">Fale com nosso comercial e ajustamos sua assinatura.</p>
          </div>
          <Button asChild>
            <a href="mailto:contato@auracomex.app?subject=Aura%20-%20Ajuste%20de%20plano">
              <Mail className="w-4 h-4 mr-2" />Falar com comercial
            </a>
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) closeCheckout(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar assinatura</DialogTitle>
          </DialogHeader>
          {checkoutElement}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsageStat({ icon: Icon, label, value, limit }: { icon: any; label: string; value: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  return (
    <div>
      <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className="font-medium">
        {value}
        <span className="text-muted-foreground text-sm"> / {limit ?? '∞'}</span>
      </p>
      {limit && (
        <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
          <div className={`h-full ${pct > 85 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}