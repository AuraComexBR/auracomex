import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Ship, FileText, DollarSign, Database,
  Settings, ChevronLeft, ChevronRight, Anchor, ArrowLeft, CreditCard, LifeBuoy
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupportSheet } from '@/components/support/SupportButton';
import { APP_VERSION } from '@/lib/version';

const allNavItems = [
  { key: 'nav.dashboard', icon: LayoutDashboard, path: '/', permission: 'canAccessDashboard' as const },
  { key: 'nav.quotes', icon: FileText, path: '/quotes', permission: 'canAccessQuotes' as const },
  { key: 'nav.shipments', icon: Ship, path: '/shipments', permission: 'canAccessShipments' as const },
  { key: 'nav.financial', icon: DollarSign, path: '/financial', permission: 'canAccessFinancial' as const },
  { key: 'nav.registrations', icon: Database, path: '/registrations', permission: 'canAccessRegistrations' as const },
  { key: 'nav.settings', icon: Settings, path: '/settings', permission: 'canAccessSettings' as const },
];

export function AppSidebar() {
  // Auto-colapsa em telas menores que 1024px (notebooks pequenos/tablets)
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024,
  );
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = (e: MediaQueryListEvent) => {
      // Colapsa automaticamente ao encolher a janela; ao expandir, o usuário decide
      if (e.matches) setCollapsed(true);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  const { t } = useLanguage();
  const { isSuperadmin, activeCompanyName, exitCompany, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const queryClient = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ['company', profile?.company_id],
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();
      return data;
    },
    enabled: !!profile,
  });

  // Fase 3: badge de contas a pagar vencidas
  const { data: overdueCount = 0 } = useQuery({
    queryKey: ['sidebar-overdue-payables', profile?.company_id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('accounts_payable' as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'aberto')
        .lt('due_date', today);
      return count ?? 0;
    },
    enabled: !!profile?.company_id,
    refetchInterval: 60_000,
  });

  const logoUrl = (company as any)?.logo_url;
  const companyName = company?.name || 'Aura Comex';

  const navItems = allNavItems.filter(item => (permissions as any)[item.permission]);

  async function handleExitCompany() {
    await exitCompany();
    queryClient.clear();
    navigate('/admin');
  }

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex border-b border-sidebar-border",
        collapsed ? "items-center justify-center p-3" : "flex-col items-center gap-2 px-2 py-4"
      )}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName}
            title={companyName}
            className={cn(
              "object-contain shrink-0",
              collapsed ? "w-10 h-10" : "w-full h-auto max-h-40"
            )}
          />
        ) : (
          <div className={cn(
            "flex items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0",
            collapsed ? "w-10 h-10" : "w-full h-32"
          )}>
            <Anchor className={collapsed ? "w-5 h-5" : "w-10 h-10"} />
          </div>
        )}
        {!collapsed && (
          <span className="text-[10px] font-mono text-sidebar-foreground/50 mt-1">
            v{APP_VERSION}
          </span>
        )}
      </div>

      {/* Superadmin company banner */}
      {isSuperadmin && activeCompanyName && (
        <div className={cn(
          "border-b border-sidebar-border",
          collapsed ? "px-2 py-2" : "px-3 py-3"
        )}>
          {!collapsed ? (
            <button
              onClick={handleExitCompany}
              className="flex items-center gap-2 w-full px-2 py-2 rounded-lg bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Acessando</p>
                <p className="font-medium truncate text-xs">{activeCompanyName}</p>
              </div>
            </button>
          ) : (
            <button
              onClick={handleExitCompany}
              className="flex items-center justify-center w-full py-2 rounded-lg bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20 transition-colors"
              title={`Voltar ao Painel (${activeCompanyName})`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Nav + Quick Notes */}
      <div className="flex-1 flex flex-col overflow-hidden py-4 px-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.key}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary/10 text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="flex-1">{t(item.key)}</span>}
                {item.path === '/financial' && overdueCount > 0 && (
                  <span
                    className={cn(
                      "text-[10px] font-bold rounded-full bg-red-500 text-white",
                      collapsed ? "absolute -mt-6 ml-4 w-4 h-4 flex items-center justify-center" : "px-1.5 py-0.5 min-w-[20px] text-center"
                    )}
                    title={`${overdueCount} conta(s) vencida(s)`}
                  >
                    {overdueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <button
          data-tour="support"
          onClick={() => setSupportOpen(true)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
        >
          <LifeBuoy className="w-5 h-5 shrink-0" />
          {!collapsed && <span>{t('nav.support')}</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
      
      {!collapsed && (
        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-[10px] text-center text-sidebar-foreground/40 font-medium uppercase tracking-wider">
            Aura Comex by Brasa Digital
          </p>
        </div>
      )}
      <SupportSheet open={supportOpen} onOpenChange={setSupportOpen} />
    </aside>
  );
}

