import { Ship, TrendingUp, FileText, MoreHorizontal } from "lucide-react";

/**
 * Ilustração estilizada do produto para o hero da landing page.
 * Não é um screenshot real — é um mockup visual simplificado que
 * representa a experiência do dashboard do Aura Comex.
 */
function HeroMockup() {
  const shipments = [
    { code: "AC-2451", client: "Global Trade Ltda", status: "Em trânsito", color: "hsl(160,73%,46%)", bg: "hsl(160,73%,46%)" },
    { code: "AC-2452", client: "Nordeste Import.", status: "Aguardando doc.", color: "hsl(38,92%,50%)", bg: "hsl(38,92%,50%)" },
    { code: "AC-2453", client: "Rio Comex S.A.", status: "Novo", color: "hsl(213,100%,50%)", bg: "hsl(213,100%,50%)" },
  ];

  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0">
      {/* glow atrás do card */}
      <div className="absolute -inset-8 bg-[hsl(213,100%,50%)]/10 blur-[60px] rounded-full pointer-events-none" />

      <div className="relative rounded-2xl border border-[hsl(240,13%,16%)] bg-[hsl(240,13%,8%)] shadow-2xl overflow-hidden">
        {/* barra de topo estilo navegador */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(240,13%,16%)] bg-[hsl(240,13%,9%)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(350,89%,60%)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(38,92%,50%)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(160,73%,46%)]/70" />
          <div className="ml-3 flex-1 text-[11px] text-[hsl(240,5%,58%)] bg-[hsl(240,17%,5%)] rounded-md px-3 py-1 truncate border border-[hsl(240,13%,16%)]">
            app.auracomex.com/dashboard
          </div>
        </div>

        {/* corpo do "app" */}
        <div className="p-4 space-y-4">
          {/* header do dashboard */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[hsl(240,5%,58%)]">Visão geral</p>
              <p className="text-sm font-semibold text-[hsl(240,11%,89%)]">Sua operação hoje</p>
            </div>
            <div className="h-7 w-7 rounded-full bg-[hsl(213,100%,50%)]/15 border border-[hsl(213,100%,50%)]/30 flex items-center justify-center">
              <Ship className="h-3.5 w-3.5 text-[hsl(213,100%,50%)]" />
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[hsl(240,13%,16%)] bg-[hsl(240,17%,5%)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[hsl(240,5%,58%)] mb-1">Cotações em aberto</p>
              <p className="text-lg font-bold text-[hsl(240,11%,89%)]">R$ 42.500</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-[hsl(160,73%,46%)]" />
                <span className="text-[10px] text-[hsl(160,73%,46%)] font-medium">+18% este mês</span>
              </div>
            </div>
            <div className="rounded-lg border border-[hsl(240,13%,16%)] bg-[hsl(240,17%,5%)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[hsl(240,5%,58%)] mb-1">Embarques ativos</p>
              <p className="text-lg font-bold text-[hsl(240,11%,89%)]">27</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[hsl(240,13%,16%)] overflow-hidden">
                <div className="h-full w-[68%] rounded-full bg-[hsl(213,100%,50%)]" />
              </div>
            </div>
          </div>

          {/* mini tabela de embarques */}
          <div className="rounded-lg border border-[hsl(240,13%,16%)] bg-[hsl(240,17%,5%)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(240,13%,16%)]">
              <span className="text-[11px] font-medium text-[hsl(240,11%,89%)] flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-[hsl(240,5%,58%)]" /> Embarques recentes
              </span>
              <MoreHorizontal className="h-3.5 w-3.5 text-[hsl(240,5%,58%)]" />
            </div>
            <div>
              {shipments.map((s, i) => (
                <div
                  key={s.code}
                  className={`flex items-center justify-between px-3 py-2 text-[11px] ${
                    i !== shipments.length - 1 ? "border-b border-[hsl(240,13%,16%)]/60" : ""
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-[hsl(240,11%,89%)] font-medium">{s.code}</span>
                    <span className="text-[hsl(240,5%,58%)]">{s.client}</span>
                  </div>
                  <span
                    className="text-[10px] font-medium rounded-full px-2 py-0.5"
                    style={{ color: s.color, backgroundColor: `${s.bg}1A`, border: `1px solid ${s.bg}4D` }}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* badge flutuante */}
      <div className="absolute -bottom-4 -right-4 rounded-xl border border-[hsl(240,13%,16%)] bg-[hsl(240,13%,9%)] shadow-xl px-3 py-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[hsl(160,73%,46%)] animate-pulse" />
        <span className="text-[11px] font-medium text-[hsl(240,11%,89%)]">Tudo em dia</span>
      </div>
    </div>
  );
}

export default HeroMockup;
