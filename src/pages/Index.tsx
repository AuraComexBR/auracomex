import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrencyMapShort } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useSalespersonClients } from '@/hooks/useSalespersonClients';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  Ship, FileText, AlertTriangle, CheckCircle,
  Plus, Send, TrendingUp, Clock, ArrowRight, DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';

export default function Index() {
  const { t } = useLanguage();
  const { profile, user } = useAuth();
  const { canAccessQuotes, canAccessShipments, canAccessFinancial, isScopedToOwnProcesses } = usePermissions();
  const { clientIds } = useSalespersonClients();

  // Build a client filter for salesperson scoping
  const scopeFilter = isScopedToOwnProcesses && clientIds ? clientIds : null;

  // --- KPI Queries ---

  const { data: shipmentStats } = useQuery({
    queryKey: ['dashboard-shipments', scopeFilter],
    enabled: canAccessShipments,
    queryFn: async () => {
      let query = supabase
        .from('shipments')
        .select('id, status', { count: 'exact' });
      if (scopeFilter && scopeFilter.length > 0) {
        query = query.in('client_id', scopeFilter);
      } else if (scopeFilter && scopeFilter.length === 0) {
        return { active: 0, total: 0 };
      }
      const { data } = await query;
      const active = (data || []).filter((s: any) =>
        ['booked', 'in_transit', 'arrived'].includes(s.status)
      ).length;
      return { active, total: (data || []).length };
    },
  });

  const { data: quoteStats } = useQuery({
    queryKey: ['dashboard-quotes', scopeFilter],
    enabled: canAccessQuotes,
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select('id, status, created_by');
      if (scopeFilter && scopeFilter.length > 0) {
        query = query.in('client_id', scopeFilter);
      } else if (isScopedToOwnProcesses && user) {
        query = query.eq('created_by', user.id);
      }
      const { data } = await query;
      const pending = (data || []).filter((q: any) => q.status === 'sent').length;
      const drafts = (data || []).filter((q: any) => q.status === 'draft').length;
      return { pending, drafts, total: (data || []).length };
    },
  });

  const { data: financialStats } = useQuery({
    queryKey: ['dashboard-financial', scopeFilter],
    enabled: canAccessFinancial,
    queryFn: async () => {
      let query = supabase
        .from('charge_lines')
        .select('amount, direction, currency');
      if (scopeFilter && scopeFilter.length > 0) {
        const { data: shipmentIds } = await supabase
          .from('shipments')
          .select('id')
          .in('client_id', scopeFilter);
        const ids = (shipmentIds || []).map((s: any) => s.id);
        if (ids.length === 0) return { byCurrency: {} };
        query = query.in('shipment_id', ids);
      }
      const { data } = await query;
      const byCurrency: Record<string, { rec: number; pay: number; profit: number }> = {};
      (data || []).forEach((c: any) => {
        const cur = c.currency || 'USD';
        if (!byCurrency[cur]) byCurrency[cur] = { rec: 0, pay: 0, profit: 0 };
        if (c.direction === 'receivable') {
          byCurrency[cur].rec += Number(c.amount);
        } else {
          byCurrency[cur].pay += Number(c.amount);
        }
      });
      Object.values(byCurrency).forEach((v) => { v.profit = v.rec - v.pay; });
      return { byCurrency };
    },
  });

  // Commission query for salesperson
  const { data: commissionTotal } = useQuery({
    queryKey: ['dashboard-commission', scopeFilter],
    enabled: isScopedToOwnProcesses && !!scopeFilter && scopeFilter.length > 0,
    queryFn: async () => {
      if (!scopeFilter || scopeFilter.length === 0) return 0;

      // Get the first day of the current month
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get completed shipments from salesperson's clients finalized before this month
      const { data: completedShipments } = await supabase
        .from('shipments')
        .select('id, client_id, updated_at')
        .in('client_id', scopeFilter)
        .eq('status', 'delivered')
        .lt('updated_at', firstOfMonth);

      if (!completedShipments || completedShipments.length === 0) return 0;

      const shipmentIds = completedShipments.map((s: any) => s.id);

      // Get receivable charge_lines for those shipments
      const { data: charges } = await supabase
        .from('charge_lines')
        .select('shipment_id, amount')
        .in('shipment_id', shipmentIds)
        .eq('direction', 'receivable');

      if (!charges || charges.length === 0) return 0;

      // Get commission rates for the clients
      const clientIdsSet = [...new Set(completedShipments.map((s: any) => s.client_id))];
      const { data: clients } = await supabase
        .from('clients')
        .select('id, commission_rate')
        .in('id', clientIdsSet as string[]);

      const clientRateMap: Record<string, number> = {};
      (clients || []).forEach((c: any) => {
        if (c.commission_rate != null) clientRateMap[c.id] = Number(c.commission_rate);
      });

      // Build shipment→client map
      const shipmentClientMap: Record<string, string> = {};
      completedShipments.forEach((s: any) => {
        shipmentClientMap[s.id] = s.client_id;
      });

      // Calculate total commission
      let total = 0;
      charges.forEach((ch: any) => {
        const clientId = shipmentClientMap[ch.shipment_id];
        const rate = clientRateMap[clientId] ?? 0;
        total += Number(ch.amount) * (rate / 100);
      });

      return total;
    },
  });

  // Commission forecast (not yet released) for salesperson
  const { data: commissionForecast } = useQuery({
    queryKey: ['dashboard-commission-forecast', scopeFilter],
    enabled: isScopedToOwnProcesses && !!scopeFilter && scopeFilter.length > 0,
    queryFn: async () => {
      if (!scopeFilter || scopeFilter.length === 0) return 0;

      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get shipments that are in progress OR delivered this month (not yet released)
      const { data: ongoingShipments } = await supabase
        .from('shipments')
        .select('id, client_id, status, updated_at')
        .in('client_id', scopeFilter)
        .in('status', ['booked', 'in_transit', 'arrived', 'delivered'] as any);

      // Filter: exclude delivered before this month (those are already "released")
      const filtered = (ongoingShipments || []).filter((s: any) => {
        if (s.status === 'delivered') {
          return s.updated_at >= firstOfMonth; // delivered this month = not yet released
        }
        return true; // in progress
      });

      if (filtered.length === 0) return 0;

      const shipmentIds = filtered.map((s: any) => s.id);

      const { data: charges } = await supabase
        .from('charge_lines')
        .select('shipment_id, amount')
        .in('shipment_id', shipmentIds)
        .eq('direction', 'receivable');

      if (!charges || charges.length === 0) return 0;

      const clientIdsSet = [...new Set(filtered.map((s: any) => s.client_id))];
      const { data: clients } = await supabase
        .from('clients')
        .select('id, commission_rate')
        .in('id', clientIdsSet as string[]);

      const clientRateMap: Record<string, number> = {};
      (clients || []).forEach((c: any) => {
        if (c.commission_rate != null) clientRateMap[c.id] = Number(c.commission_rate);
      });

      const shipmentClientMap: Record<string, string> = {};
      filtered.forEach((s: any) => {
        shipmentClientMap[s.id] = s.client_id;
      });

      let total = 0;
      charges.forEach((ch: any) => {
        const clientId = shipmentClientMap[ch.shipment_id];
        const rate = clientRateMap[clientId] ?? 0;
        total += Number(ch.amount) * (rate / 100);
      });

      return total;
    },
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_log')
        .select('id, action, details, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Build KPI cards based on permissions
  const kpis = [];

  if (canAccessShipments) {
    kpis.push({
      label: t('dashboard.active_shipments'),
      value: String(shipmentStats?.active ?? 0),
      icon: Ship,
      sub: `${shipmentStats?.total ?? 0} total`,
      color: 'text-status-transit',
    });
  }

  if (canAccessQuotes) {
    kpis.push({
      label: t('dashboard.pending_approvals'),
      value: String(quoteStats?.pending ?? 0),
      icon: Clock,
      sub: `${quoteStats?.drafts ?? 0} ${t('status.draft').toLowerCase()}`,
      color: 'text-status-attention',
    });
  }

  if (canAccessFinancial) {
    const byCur = financialStats?.byCurrency || {};
    const recMap: Record<string, number> = {};
    const profitMap: Record<string, number> = {};
    Object.entries(byCur).forEach(([cur, v]) => {
      recMap[cur] = v.rec;
      profitMap[cur] = v.profit;
    });
    kpis.push({
      label: t('dashboard.revenue_mtd'),
      value: formatCurrencyMapShort(recMap),
      icon: TrendingUp,
      sub: `${t('financial.profit')}: ${formatCurrencyMapShort(profitMap)}`,
      color: 'text-status-completed',
    });
  }

  if (isScopedToOwnProcesses) {
    kpis.push({
      label: t('dashboard.commission_available'),
      value: `$${((commissionTotal ?? 0) / 1000).toFixed(1)}K`,
      icon: DollarSign,
      sub: t('dashboard.commission_subtitle'),
      color: 'text-status-completed',
    });
    kpis.push({
      label: t('dashboard.commission_forecast'),
      value: `$${((commissionForecast ?? 0) / 1000).toFixed(1)}K`,
      icon: TrendingUp,
      sub: t('dashboard.commission_forecast_subtitle'),
      color: 'text-status-attention',
    });
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('dashboard.welcome')}, {profile?.full_name?.split(' ')[0]}
          </p>
        </div>
      </div>

      {/* Commission forecast warning */}
      {isScopedToOwnProcesses && (commissionForecast ?? 0) > 0 && (
        <Alert className="border-status-attention/50 bg-status-attention/10">
          <AlertTriangle className="h-4 w-4 text-status-attention" />
          <AlertDescription className="text-sm">
            {t('dashboard.commission_forecast_warning')}
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      {kpis.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
          { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }[Math.min(kpis.length, 4)] ?? 'lg:grid-cols-4'
        }`}>
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="glass hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {kpi.label}
                    </p>
                    <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-secondary ${kpi.color}`}>
                    <kpi.icon className="w-5 h-5" />
                  </div>
                </div>
                <p className={`text-xs mt-2 font-medium text-muted-foreground`}>
                  {kpi.sub}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">
            {t('dashboard.recent_activity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.no_data')}</p>
            ) : (
              recentActivity.map((activity: any) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="text-sm">{activity.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activity.details}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
