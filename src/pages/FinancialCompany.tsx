import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OverviewTab from '@/components/financial/OverviewTab';
import FixedAccountsTab from '@/components/financial/FixedAccountsTab';

// Financeiro da empresa (Visão Geral consolidada + Despesas Fixas/overhead) —
// separado do financeiro por processo (Valores a Receber/Pagar) em
// FinancialProcess.tsx, pra não misturar administração da empresa com a
// operação do dia a dia de cada cotação/embarque.
const VALID = ['geral', 'fixas'] as const;
type TabKey = typeof VALID[number];

export default function FinancialCompany() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const active: TabKey = (VALID as readonly string[]).includes(raw || '') ? (raw as TabKey) : 'geral';

  return (
    <div className="space-y-6 animate-slide-in">
      <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="fixas">Despesas Fixas</TabsTrigger>
        </TabsList>
        <TabsContent value="geral"><OverviewTab /></TabsContent>
        <TabsContent value="fixas"><FixedAccountsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
