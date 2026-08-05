import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AccountsPayableTab from '@/components/financial/AccountsPayableTab';
import AccountsReceivableTab from '@/components/financial/AccountsReceivableTab';
import FixedAccountsTab from '@/components/financial/FixedAccountsTab';

// "Movimentações" — lançamentos financeiros, por processo (Despesa/Receita,
// vinculados a cotação/embarque) e Geral (despesas fixas e variáveis da
// empresa, sem vínculo com processo). Separado da Visão Geral (KPIs
// consolidados) em FinancialCompany.tsx.
const VALID = ['pagar', 'receber', 'geral'] as const;
type TabKey = typeof VALID[number];

export default function FinancialProcess() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const active: TabKey = (VALID as readonly string[]).includes(raw || '') ? (raw as TabKey) : 'receber';

  return (
    <div className="space-y-6 animate-slide-in">
      <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pagar">Despesa por Processo</TabsTrigger>
          <TabsTrigger value="receber">Receita por Processo</TabsTrigger>
          <TabsTrigger value="geral">Geral</TabsTrigger>
        </TabsList>
        <TabsContent value="pagar"><AccountsPayableTab /></TabsContent>
        <TabsContent value="receber"><AccountsReceivableTab /></TabsContent>
        <TabsContent value="geral"><FixedAccountsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
