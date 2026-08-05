import OverviewTab from '@/components/financial/OverviewTab';

// Visão Geral (KPIs consolidados do financeiro) — Despesas Fixas/variáveis
// da empresa (antes uma segunda aba aqui) mudou pra aba "Geral" dentro de
// "Movimentações" (FinancialProcess.tsx), junto de Despesa/Receita por
// Processo, já que também é um lançamento financeiro, só sem vínculo com
// cotação/embarque.
export default function FinancialCompany() {
  return (
    <div className="space-y-6 animate-slide-in">
      <OverviewTab />
    </div>
  );
}
