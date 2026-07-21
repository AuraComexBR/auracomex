import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Building2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

const PLAN_LABEL: Record<string, string> = {
  starter: 'Básico',
  professional: 'Professional',
  business: 'Business',
};

function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PlatformMetrics() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_subscriptions' as any)
        .select('company_id, plan, status, mrr_cents, trial_ends_at')
        .order('company_id');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando métricas…</div>;
  }

  const payingStatuses = ['active', 'past_due'];
  const mrrCents = data
    .filter((s) => payingStatuses.includes(s.status))
    .reduce((sum, s) => sum + (s.mrr_cents || 0), 0);

  const activeCompanies = data.filter((s) => ['active', 'trial'].includes(s.status)).length;
  const pastDueCount = data.filter((s) => s.status === 'past_due').length;

  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const trialsExpiringSoon = data.filter(
    (s) => s.status === 'trial' && s.trial_ends_at && new Date(s.trial_ends_at) <= in7Days
  ).length;
  const trialsActive = data.filter((s) => s.status === 'trial').length;

  const planCounts: Record<string, number> = {};
  data
    .filter((s) => ['active', 'trial'].includes(s.status))
    .forEach((s) => { planCounts[s.plan] = (planCounts[s.plan] || 0) + 1; });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="glass">
          <CardContent className="p-4 flex flex-col justify-center min-h-[88px]">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />MRR
            </p>
            <p className="text-xl font-bold truncate">{fmtBRL(mrrCents)}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex flex-col justify-center min-h-[88px]">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" />Empresas ativas
            </p>
            <p className="text-xl font-bold">{activeCompanies}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex flex-col justify-center min-h-[88px]">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />Em trial
            </p>
            <p className="text-xl font-bold">{trialsActive}</p>
          </CardContent>
        </Card>
        <Card className={trialsExpiringSoon > 0 ? 'glass border-amber-500/40' : 'glass'}>
          <CardContent className="p-4 flex flex-col justify-center min-h-[88px]">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />Trial acaba em 7d
            </p>
            <p className={`text-xl font-bold ${trialsExpiringSoon > 0 ? 'text-amber-500' : ''}`}>{trialsExpiringSoon}</p>
          </CardContent>
        </Card>
        <Card className={pastDueCount > 0 ? 'glass border-red-500/40' : 'glass'}>
          <CardContent className="p-4 flex flex-col justify-center min-h-[88px]">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />Em atraso
            </p>
            <p className={`text-xl font-bold ${pastDueCount > 0 ? 'text-red-500' : ''}`}>{pastDueCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Por plano:</span>
        {Object.keys(PLAN_LABEL).map((p) => (
          <Badge key={p} variant="outline" className="gap-1">
            {PLAN_LABEL[p]}: {planCounts[p] || 0}
          </Badge>
        ))}
      </div>
    </div>
  );
}
