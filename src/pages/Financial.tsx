import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OverviewTab from '@/components/financial/OverviewTab';
import FixedAccountsTab from '@/components/financial/FixedAccountsTab';
import AccountsPayableTab from '@/components/financial/AccountsPayableTab';
import AccountsReceivableTab from '@/components/financial/AccountsReceivableTab';

const VALID = ['geral', 'receber', 'pagar', 'fixas'] as const;
type TabKey = typeof VALID[number];

export default function Financial() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const active: TabKey = (VALID as readonly string[]).includes(raw || '') ? (raw as TabKey) : 'geral';

  return (
    <div className="space-y-6 animate-slide-in">
      <h1 className="text-2xl font-bold tracking-tight">{t('financial.page_title')}</h1>

      <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
          <TabsTrigger value="pagar">Por Processo</TabsTrigger>
          <TabsTrigger value="fixas">Contas Fixas</TabsTrigger>
        </TabsList>
        <TabsContent value="geral"><OverviewTab /></TabsContent>
        <TabsContent value="receber"><AccountsReceivableTab /></TabsContent>
        <TabsContent value="pagar"><AccountsPayableTab /></TabsContent>
        <TabsContent value="fixas"><FixedAccountsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
