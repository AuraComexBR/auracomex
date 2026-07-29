import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OverviewTab from '@/components/financial/OverviewTab';
import FixedAccountsTab from '@/components/financial/FixedAccountsTab';
import AccountsPayableTab from '@/components/financial/AccountsPayableTab';
import AccountsReceivableTab from '@/components/financial/AccountsReceivableTab';

const VALID = ['geral', 'receber', 'pagar', 'fixas'] as const;
type TabKey = typeof VALID[number];

export default function Financial() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const active: TabKey = (VALID as readonly string[]).includes(raw || '') ? (raw as TabKey) : 'geral';

  return (
    <div className="space-y-6 animate-slide-in">
      <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-x-1 gap-y-2 py-1.5">
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          <span className="mx-1.5 hidden sm:flex items-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Por Processo</span>
          <TabsTrigger value="receber">Valores a Receber</TabsTrigger>
          <TabsTrigger value="pagar">Valores a Pagar</TabsTrigger>
          <span className="mx-1.5 hidden sm:block h-4 w-px bg-border" />
          <span className="mx-1.5 hidden sm:flex items-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Despesas Gerais</span>
          <TabsTrigger value="fixas">Despesas Gerais da Empresa</TabsTrigger>
        </TabsList>
        <TabsContent value="geral"><OverviewTab /></TabsContent>
        <TabsContent value="receber"><AccountsReceivableTab /></TabsContent>
        <TabsContent value="pagar"><AccountsPayableTab /></TabsContent>
        <TabsContent value="fixas"><FixedAccountsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
