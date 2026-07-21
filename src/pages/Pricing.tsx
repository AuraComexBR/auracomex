import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { ADDON_META } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';

const PLANS = [
  {
    key: 'basic',
    name: 'Básico',
    price: 'R$ 129,99',
    priceSuffix: '/usuário',
    description: 'Para sair da planilha e organizar a operação.',
    priceDetails: '1º usuário R$ 149,99 · 2º R$ 139,99 · 3º em diante R$ 129,99 cada.',
    features: ['Até 30 embarques/mês', 'Usuários ilimitados (preço por assento)', 'Cotações + PDF profissional', 'Embarques com workflow', 'Financeiro (AP/AR)', 'Cadastros e Dashboard', 'Suporte por email'],
    highlight: false,
  },
  {
    key: 'professional',
    name: 'Professional',
    price: 'R$ 199,99',
    priceSuffix: '/usuário',
    description: 'Para equipes com permissões e controle comercial.',
    priceDetails: '1º usuário R$ 249,99 · 2º R$ 229,99 · 3º em diante R$ 199,99 cada.',
    features: ['Até 100 embarques/mês', 'Tudo do Básico', 'Perfis de acesso completos (RBAC)', 'Comissão de vendedor com forecast', 'Suporte prioritário'],
    highlight: true,
  },
  {
    key: 'business',
    name: 'Business',
    price: 'Fale conosco',
    priceSuffix: '',
    description: 'Sem limites, condições negociadas com nosso time.',
    priceDetails: null,
    features: ['Embarques ilimitados', 'Usuários ilimitados', 'Tudo do Professional', 'Todos os add-ons inclusos', 'Múltiplas empresas', 'Suporte dedicado'],
    highlight: false,
    contactOnly: true,
  },
];

const COMMERCIAL_ADDONS = ['cost_estimate_premium'] as const;

export default function Pricing() {
  const navigate = useNavigate();
  const { data: platformSettings } = usePlatformSettings();
  const logo = platformSettings?.logo_url;
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleDetails(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleCta() {
    if (user) navigate('/settings#assinatura');
    else navigate('/signup');
  }

  function handleContactSales() {
    window.location.href = 'mailto:contato@auracomex.app?subject=Aura%20Business%20-%20Quero%20negociar';
  }

  return (
    <div className="min-h-screen bg-[hsl(240,17%,5%)] text-[hsl(240,11%,89%)]">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[hsl(240,17%,5%)]/80 border-b border-[hsl(240,13%,16%)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <button onClick={() => navigate('/landing')} className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-xl font-bold tracking-tight">
                <span className="text-[hsl(213,100%,50%)]">Aura</span> Comex
              </span>
            )}
          </button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-[hsl(240,11%,89%)]">Entrar</Button>
            <Button size="sm" onClick={() => navigate('/signup')} className="bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)]">
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-12 px-6 text-center max-w-3xl mx-auto">
        <span className="inline-block text-xs font-medium text-[hsl(213,100%,50%)] tracking-wide uppercase mb-4 border border-[hsl(213,100%,50%)]/20 rounded-full px-4 py-1.5 bg-[hsl(213,100%,50%)]/5">
          Planos e preços
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
          Escolha o plano certo para sua operação
        </h1>
        <p className="text-lg text-[hsl(240,5%,58%)]">
          Comece pelo básico e adicione recursos conforme seu time cresce.
        </p>
      </section>

      {/* Plans */}
      <section className="px-6 pb-20 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {PLANS.map((p) => (
          <Card
            key={p.key}
            className={
              p.highlight
                ? 'h-full flex flex-col bg-[hsl(240,13%,9%)] border-[hsl(213,100%,50%)]/50 shadow-[0_0_40px_hsl(213,100%,50%,0.15)]'
                : 'h-full flex flex-col bg-[hsl(240,13%,9%)] border-[hsl(240,13%,16%)]'
            }
          >
            <CardContent className="p-6 flex flex-col flex-1">
              {p.highlight ? (
                <span className="self-start text-[10px] font-semibold tracking-wide uppercase text-[hsl(213,100%,50%)] bg-[hsl(213,100%,50%)]/10 border border-[hsl(213,100%,50%)]/30 rounded-full px-2.5 py-1 mb-3">
                  Mais escolhido
                </span>
              ) : (
                <div className="h-[26px] mb-3" />
              )}
              <h3 className="text-xl font-bold mb-1 text-[hsl(240,11%,89%)]">{p.name}</h3>
              <p className="text-sm text-[hsl(240,5%,58%)] mb-4">{p.description}</p>
              <div className="mb-1">
                <span className="text-4xl font-extrabold text-[hsl(240,11%,89%)]">{p.price}</span>
                <span className="text-[hsl(240,5%,58%)]">{p.priceSuffix || (p.contactOnly ? '' : '/mês')}</span>
              </div>
              {p.priceDetails ? (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => toggleDetails(p.key)}
                    className="inline-flex items-center gap-1 text-xs text-[hsl(213,100%,50%)] hover:underline"
                  >
                    Saiba mais sobre o preço
                    <ChevronDown className={`w-3 h-3 transition-transform ${expanded[p.key] ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded[p.key] && (
                    <p className="text-xs text-[hsl(240,5%,58%)] mt-2">{p.priceDetails}</p>
                  )}
                </div>
              ) : (
                <div className="mb-4 h-[18px]" />
              )}
              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-[hsl(160,73%,46%)] mt-0.5 shrink-0" />
                    <span className="text-[hsl(240,11%,89%)]">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={p.contactOnly ? handleContactSales : handleCta}
                className={
                  p.highlight
                    ? 'bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)]'
                    : 'bg-[hsl(240,13%,9%)] border-[hsl(240,13%,16%)] text-[hsl(240,11%,89%)] hover:bg-[hsl(240,13%,16%)] hover:text-[hsl(240,11%,89%)]'
                }
                variant={p.highlight ? 'default' : 'outline'}
              >
                {p.contactOnly ? 'Falar com vendas' : (user ? 'Assinar agora' : 'Começar 14 dias grátis')} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Add-ons */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">Add-ons</h2>
          <p className="text-[hsl(240,5%,58%)]">Recursos extras, cobrados à parte nos planos Básico e Professional — já inclusos no Business.</p>
        </div>
        <div className="grid grid-cols-1 max-w-sm mx-auto gap-6">
          {COMMERCIAL_ADDONS.map((key) => {
            const meta = ADDON_META[key];
            return (
              <Card key={key} className="bg-[hsl(240,13%,9%)] border-[hsl(240,13%,16%)]">
                <CardContent className="p-6">
                  <Sparkles className="w-6 h-6 text-[hsl(213,100%,50%)] mb-3" />
                  <h3 className="font-semibold mb-2 text-[hsl(240,11%,89%)]">{meta.label}</h3>
                  <p className="text-sm text-[hsl(240,5%,58%)]">{meta.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FAQ curto */}
      <section className="px-6 pb-24 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">Perguntas frequentes</h2>
        <div className="space-y-3">
          {[
            { q: 'Posso trocar de plano depois?', a: 'Sim, a qualquer momento. Upgrades são imediatos, downgrades entram no próximo ciclo.' },
            { q: 'Como funcionam os add-ons?', a: 'São recursos extras que você adiciona aos planos Básico e Professional, cobrados separadamente. No Business já vêm todos inclusos.' },
            { q: 'Tem período de teste?', a: 'Sim, novos cadastros começam com 14 dias grátis.' },
            { q: 'Preciso instalar algo?', a: 'Não. O Aura roda 100% no navegador, inclusive celular.' },
          ].map((f) => (
            <div key={f.q} className="border border-[hsl(240,13%,16%)] rounded-lg p-4 bg-[hsl(240,13%,9%)]">
              <p className="font-medium mb-1">{f.q}</p>
              <p className="text-sm text-[hsl(240,5%,58%)]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}