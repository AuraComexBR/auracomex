import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AccountsPayableTab from '@/components/financial/AccountsPayableTab';
import AccountsReceivableTab from '@/components/financial/AccountsReceivableTab';

// Financeiro ligado a cotações/embarques (Valores a Receber/Pagar) — separado
// do financeiro da empresa (Visão Geral + Despesas Fixas) em FinancialCompany.tsx,
// porque são fluxos de trabalho diferentes: este aqui é o dia a dia por processo.
const VALID = ['receber', 'pagar'] as const;
type TabKey = typeof VALID[number];

export default function FinancialProcess() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const active: TabKey = (VALID as readonly string[]).includes(raw || '') ? (raw as TabKey) : 'receber';

  return (
    <div className="space-y-6 animate-slide-in">
      <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="space-y-4">
        <TabsList>
          <TabsTrigger value="receber">Valores a Receber</TabsTrigger>
          <TabsTrigger value="pagar">Valores a Pagar</TabsTrigger>
        </TabsList>
        <TabsContent value="receber"><AccountsReceivableTab /></TabsContent>
        <TabsContent value="pagar"><AccountsPayableTab /></TabsContent>
      </Tabs>
    </div>
  );
}
