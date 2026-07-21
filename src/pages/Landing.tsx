import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Ship,
  FileText,
  DollarSign,
  BarChart3,
  Clock,
  Shield,
  CheckCircle2,
  ArrowRight,
  Users,
  Globe,
  Menu,
  MessageCircle,
  Lock,
  Smartphone,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import HeroMockup from "@/components/landing/HeroMockup";

const WHATSAPP_NUMBER = "5511969705295";
const WHATSAPP_MESSAGE = "Olá! Vi a página do Aura Comex e quero saber mais.";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const PRICING_SUMMARY = [
  {
    key: "basic",
    name: "Básico",
    price: "R$ 129,99",
    priceNote: "por usuário/mês, a partir do 3º usuário",
    description: "Para quem quer sair da planilha e organizar a operação.",
    features: ["Até 30 embarques/mês", "Usuários ilimitados", "Cotações + PDF profissional", "Financeiro (contas a pagar/receber)"],
    highlight: false,
  },
  {
    key: "professional",
    name: "Professional",
    price: "R$ 199,99",
    priceNote: "por usuário/mês, a partir do 3º usuário",
    description: "Para equipes que precisam de permissões e controle comercial.",
    features: ["Até 100 embarques/mês", "Tudo do Básico", "Perfis de acesso (RBAC) completos", "Comissão de vendedor com forecast"],
    highlight: true,
  },
  {
    key: "business",
    name: "Business",
    price: "Fale conosco",
    priceNote: "condições negociadas",
    description: "Para operações maiores, sem limites de embarques ou usuários.",
    features: ["Embarques ilimitados", "Tudo do Professional", "Múltiplas empresas", "Suporte dedicado"],
    highlight: false,
  },
];

function Landing() {
  const navigate = useNavigate();
  const { data: platformSettings } = usePlatformSettings();
  const platformLogo = platformSettings?.logo_url;
  const [mobileOpen, setMobileOpen] = useState(false);

  const goToSignup = () => navigate("/signup");
  const goToPricing = () => navigate("/precos");
  const goToLogin = () => navigate("/");

  return (
    <div className="min-h-screen bg-[hsl(240,17%,5%)] text-[hsl(240,11%,89%)]">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[hsl(240,17%,5%)]/80 border-b border-[hsl(240,13%,16%)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <button onClick={() => navigate("/landing")} className="flex items-center gap-2">
            {platformLogo ? (
              <img src={platformLogo} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div className="flex flex-col items-start">
                <span className="text-xl font-bold tracking-tight">
                  <span className="text-[hsl(213,100%,50%)]">Aura</span> Comex
                </span>
                <span className="text-[10px] text-[hsl(240,5%,58%)] font-medium -mt-1">by Brasa Digital</span>
              </div>
            )}
          </button>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPricing}
              className="text-[hsl(240,11%,89%)] hover:text-[hsl(213,100%,50%)]"
            >
              Preços
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToLogin}
              className="text-[hsl(240,11%,89%)] hover:text-[hsl(213,100%,50%)]"
            >
              Entrar
            </Button>
            <Button
              size="sm"
              onClick={goToSignup}
              className="bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)]"
            >
              Começar grátis
            </Button>
          </div>

          {/* Mobile nav */}
          <div className="flex sm:hidden items-center gap-2">
            <Button
              size="sm"
              onClick={goToSignup}
              className="bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)]"
            >
              Começar grátis
            </Button>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-[hsl(240,11%,89%)]" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="bg-[hsl(240,17%,5%)] border-[hsl(240,13%,16%)] text-[hsl(240,11%,89%)]"
              >
                <div className="flex flex-col gap-4 mt-10">
                  <Button
                    variant="ghost"
                    className="justify-start text-lg text-[hsl(240,11%,89%)]"
                    onClick={() => {
                      setMobileOpen(false);
                      goToPricing();
                    }}
                  >
                    Preços
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start text-lg text-[hsl(240,11%,89%)]"
                    onClick={() => {
                      setMobileOpen(false);
                      goToLogin();
                    }}
                  >
                    Entrar
                  </Button>
                  <a
                    href={WHATSAPP_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-lg px-4 py-2 text-[hsl(240,11%,89%)]"
                  >
                    <MessageCircle className="h-5 w-5 text-[hsl(160,73%,46%)]" />
                    Falar no WhatsApp
                  </a>
                  <Button
                    className="mt-2 bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)]"
                    onClick={() => {
                      setMobileOpen(false);
                      goToSignup();
                    }}
                  >
                    Começar grátis
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* ─── 1. HERO ─── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(213,100%,50%)]/5 to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(213,100%,50%)]/5 blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-block text-sm font-medium text-[hsl(213,100%,50%)] tracking-wide uppercase mb-4 border border-[hsl(213,100%,50%)]/20 rounded-full px-4 py-1.5 bg-[hsl(213,100%,50%)]/5">
              Para agentes de carga que querem crescer sem complicação
            </span>
            <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold leading-tight mb-6">
              Pare de perder tempo com planilhas.{" "}
              <span className="text-[hsl(213,100%,50%)]">Gerencie tudo em um só lugar.</span>
            </h1>
            <p className="text-lg md:text-xl text-[hsl(240,5%,58%)] max-w-xl mx-auto lg:mx-0 mb-8">
              Embarques, cotações, documentos e financeiro — numa plataforma simples, feita para quem opera com equipe enxuta.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-6">
              <Button
                size="lg"
                onClick={goToSignup}
                className="bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)] text-base px-8 py-6 rounded-xl shadow-[0_0_30px_hsl(213,100%,50%,0.3)] w-full sm:w-auto"
              >
                Começar grátis <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-[hsl(240,13%,9%)] border-[hsl(240,13%,16%)] text-[hsl(240,11%,89%)] hover:bg-[hsl(240,13%,16%)] hover:text-[hsl(240,11%,89%)] text-base px-8 py-6 rounded-xl w-full"
                >
                  <MessageCircle className="mr-2 h-5 w-5 text-[hsl(160,73%,46%)]" />
                  Falar no WhatsApp
                </Button>
              </a>
            </div>
            <p className="text-sm text-[hsl(240,5%,58%)]">14 dias grátis · Sem cartão de crédito · Cancele quando quiser</p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 mt-10 text-sm text-[hsl(240,5%,58%)]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[hsl(160,73%,46%)]" /> Sem cartão de crédito
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[hsl(160,73%,46%)]" /> Setup em minutos
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[hsl(160,73%,46%)]" /> Suporte em português
              </div>
            </div>
          </div>

          <div className="mt-4 lg:mt-0">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ─── 2. O PROBLEMA ─── */}
      <section className="py-20 px-6 border-t border-[hsl(240,13%,16%)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Você ainda gerencia processos por e-mail e Excel?</h2>
          <p className="text-[hsl(240,5%,58%)] text-lg max-w-2xl mx-auto mb-8">
            A maioria dos pequenos agentes de carga perde horas por dia com planilhas, WhatsApp e e-mails soltos. Enquanto
            isso, informações se perdem, cotações atrasam e o financeiro fica no escuro.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Clock, title: "Horas perdidas", desc: "Copiando dados entre planilhas e e-mails todos os dias", color: "hsl(350,89%,60%)" },
              { icon: DollarSign, title: "Sistemas caros", desc: "Ferramentas robustas custam mais do que sua operação permite", color: "hsl(38,92%,50%)" },
              { icon: Shield, title: "Informações soltas", desc: "Sem histórico centralizado, dados se perdem com facilidade", color: "hsl(350,89%,60%)" },
            ].map((item) => (
              <Card key={item.title} className="bg-[hsl(240,13%,9%)] border-[hsl(240,13%,16%)] text-left">
                <CardContent className="p-6">
                  <item.icon className="h-8 w-8 mb-3" style={{ color: item.color }} />
                  <h3 className="font-semibold text-[hsl(240,11%,89%)] mb-1">{item.title}</h3>
                  <p className="text-sm text-[hsl(240,5%,58%)]">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-10 text-[hsl(213,100%,50%)] font-medium text-lg">
            O Aura foi criado para resolver exatamente isso — simples, acessível e direto ao ponto.
          </p>
        </div>
      </section>

      {/* ─── 3. BENEFÍCIOS ─── */}
      <section className="py-20 px-6 bg-[hsl(240,13%,8%)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Tudo que você precisa para operar com eficiência</h2>
          <p className="text-center text-[hsl(240,5%,58%)] mb-12 max-w-2xl mx-auto">
            Chega de alternar entre 5 ferramentas diferentes. O Aura centraliza sua operação.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Ship, title: "Embarques", desc: "Controle completo de cada processo, do booking à entrega", color: "hsl(213,100%,50%)" },
              { icon: FileText, title: "Cotações", desc: "Crie e envie cotações profissionais em minutos", color: "hsl(160,73%,46%)" },
              { icon: DollarSign, title: "Financeiro", desc: "Contas a pagar/receber, câmbio e margem por processo", color: "hsl(38,92%,50%)" },
              { icon: BarChart3, title: "Visão geral", desc: "Dashboard com indicadores em tempo real da sua operação", color: "hsl(213,100%,50%)" },
              { icon: Globe, title: "Multi-modal", desc: "Marítimo FCL/LCL, aéreo, rodoviário e multimodal", color: "hsl(160,73%,46%)" },
              { icon: Users, title: "Multi-usuário", desc: "Times inteiros trabalhando no mesmo processo, com permissões por perfil", color: "hsl(38,92%,50%)" },
              { icon: Smartphone, title: "Rapidez", desc: "Interface leve e rápida — funciona até no celular", color: "hsl(213,100%,50%)" },
              { icon: Lock, title: "Segurança", desc: "Dados protegidos com controle de acesso por perfil (RBAC)", color: "hsl(240,11%,89%)" },
            ].map((b) => (
              <Card
                key={b.title}
                className="bg-[hsl(240,17%,5%)] border-[hsl(240,13%,16%)] hover:border-[hsl(213,100%,50%)]/30 transition-colors"
              >
                <CardContent className="p-6">
                  <b.icon className="h-7 w-7 mb-3" style={{ color: b.color }} />
                  <h3 className="font-semibold text-[hsl(240,11%,89%)] mb-1">{b.title}</h3>
                  <p className="text-sm text-[hsl(240,5%,58%)]">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. COMPARATIVO ─── */}
      <section className="py-20 px-6 border-t border-[hsl(240,13%,16%)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Por que escolher o Aura?</h2>
          <p className="text-center text-[hsl(240,5%,58%)] mb-10">Veja como nos comparamos com as alternativas que você já conhece.</p>
          <div className="overflow-x-auto">
            <div className="min-w-[640px] grid grid-cols-4 gap-0 rounded-2xl overflow-hidden border border-[hsl(240,13%,16%)]">
              {/* header row */}
              <div className="py-4 px-4 bg-[hsl(240,13%,9%)]" />
              <div className="py-4 px-4 text-center bg-[hsl(213,100%,50%)]/10 border-x border-[hsl(213,100%,50%)]/30">
                <span className="text-[hsl(213,100%,50%)] font-bold text-base">Aura</span>
              </div>
              <div className="py-4 px-4 text-center text-[hsl(240,5%,58%)] bg-[hsl(240,13%,9%)] text-sm font-medium">
                Sistemas tradicionais
              </div>
              <div className="py-4 px-4 text-center text-[hsl(240,5%,58%)] bg-[hsl(240,13%,9%)] text-sm font-medium">Planilhas</div>

              {[
                ["Preço acessível", true, false, true],
                ["Setup rápido (minutos)", true, false, true],
                ["Cotações profissionais", true, true, false],
                ["Controle financeiro", true, true, false],
                ["Fácil de usar", true, false, true],
                ["Gestão de documentos", true, true, false],
                ["Multi-usuário com permissões", true, true, false],
                ["Funciona no celular", true, false, true],
              ].map(([label, aura, trad, plan], i) => (
                <Fragment key={i}>
                  <div
                    key={`label-${i}`}
                    className={`py-3 px-4 text-sm text-[hsl(240,11%,89%)] flex items-center ${
                      i % 2 === 0 ? "bg-[hsl(240,17%,5%)]" : "bg-[hsl(240,13%,8%)]"
                    }`}
                  >
                    {label as string}
                  </div>
                  <div
                    key={`aura-${i}`}
                    className={`py-3 px-4 text-center flex items-center justify-center border-x border-[hsl(213,100%,50%)]/30 ${
                      i % 2 === 0 ? "bg-[hsl(213,100%,50%)]/[0.07]" : "bg-[hsl(213,100%,50%)]/[0.1]"
                    }`}
                  >
                    {aura ? (
                      <CheckCircle2 className="h-5 w-5 text-[hsl(160,73%,46%)]" />
                    ) : (
                      <span className="text-[hsl(240,5%,58%)]">—</span>
                    )}
                  </div>
                  <div
                    key={`trad-${i}`}
                    className={`py-3 px-4 text-center flex items-center justify-center ${
                      i % 2 === 0 ? "bg-[hsl(240,17%,5%)]" : "bg-[hsl(240,13%,8%)]"
                    }`}
                  >
                    {trad ? (
                      <Check className="h-5 w-5 text-[hsl(240,5%,58%)]" />
                    ) : (
                      <span className="text-[hsl(240,5%,58%)]">—</span>
                    )}
                  </div>
                  <div
                    key={`plan-${i}`}
                    className={`py-3 px-4 text-center flex items-center justify-center ${
                      i % 2 === 0 ? "bg-[hsl(240,17%,5%)]" : "bg-[hsl(240,13%,8%)]"
                    }`}
                  >
                    {plan ? (
                      <Check className="h-5 w-5 text-[hsl(240,5%,58%)]" />
                    ) : (
                      <span className="text-[hsl(240,5%,58%)]">—</span>
                    )}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. COMO FUNCIONA ─── */}
      <section className="py-24 px-6 bg-[hsl(240,13%,8%)]">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Comece em minutos, sem burocracia</h2>
          <p className="text-[hsl(240,5%,58%)] mb-16 max-w-xl mx-auto">
            Sem cartão de crédito, sem contrato de fidelidade. Teste 14 dias grátis e decida com calma.
          </p>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            <div className="hidden md:block absolute top-7 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-[hsl(213,100%,50%)]/40 via-[hsl(160,73%,46%)]/40 to-[hsl(38,92%,50%)]/40" />
            {[
              {
                step: "1",
                title: "Crie sua conta",
                desc: "Cadastro em menos de 2 minutos. Sem cartão de crédito.",
                color: "hsl(213,100%,50%)",
              },
              {
                step: "2",
                title: "Configure sua operação",
                desc: "Cadastre clientes, parceiros e comece a lançar embarques.",
                color: "hsl(160,73%,46%)",
              },
              {
                step: "3",
                title: "Deixe as planilhas para trás",
                desc: "Cotações, financeiro e documentos, tudo num só lugar.",
                color: "hsl(38,92%,50%)",
              },
            ].map((s) => (
              <div key={s.step} className="relative flex flex-col items-center">
                <div
                  className="h-14 w-14 rounded-full bg-[hsl(240,13%,8%)] border-2 flex items-center justify-center text-xl font-bold mb-4"
                  style={{ borderColor: s.color, color: s.color }}
                >
                  {s.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-[hsl(240,5%,58%)] max-w-[220px]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. SOBRE ─── */}
      <section className="py-20 px-6 border-t border-[hsl(240,13%,16%)] bg-gradient-to-br from-[hsl(240,17%,5%)] via-[hsl(240,17%,5%)] to-[hsl(213,100%,50%)]/[0.04]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr,1fr] gap-10 items-center">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold mb-4">Nossa missão</h2>
            <p className="text-lg text-[hsl(240,5%,58%)] mb-6">
              Acreditamos que tecnologia de ponta não deveria ser exclusividade de grandes operadores. O Aura nasceu para
              democratizar a gestão logística — oferecendo uma plataforma completa, acessível e fácil de usar para agentes
              de carga de qualquer tamanho.
            </p>
            <p className="text-[hsl(213,100%,50%)] font-medium">Feito por quem entende logística, para quem vive logística.</p>
          </div>
          <div className="rounded-2xl border border-[hsl(240,13%,16%)] bg-[hsl(240,13%,9%)] p-8 text-center lg:text-left">
            <p className="text-4xl font-extrabold text-[hsl(213,100%,50%)] mb-1">100%</p>
            <p className="text-sm text-[hsl(240,5%,58%)] mb-6">focado em agentes de carga de pequeno e médio porte</p>
            <div className="h-px bg-[hsl(240,13%,16%)] mb-6" />
            <p className="text-4xl font-extrabold text-[hsl(160,73%,46%)] mb-1">14 dias</p>
            <p className="text-sm text-[hsl(240,5%,58%)]">grátis, sem cartão, para você validar na prática</p>
          </div>
        </div>
      </section>

      {/* ─── 7. PREÇOS ─── */}
      <section className="py-20 px-6 bg-[hsl(240,13%,8%)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Planos que cabem na sua operação</h2>
          <p className="text-center text-[hsl(240,5%,58%)] mb-12 max-w-2xl mx-auto">
            Comece grátis por 14 dias, sem cartão de crédito. Veja o resumo abaixo ou confira todos os detalhes na página de preços.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {PRICING_SUMMARY.map((p) => (
              <Card
                key={p.key}
                className={
                  p.highlight
                    ? "bg-[hsl(240,17%,5%)] border-[hsl(213,100%,50%)]/50 shadow-[0_0_40px_hsl(213,100%,50%,0.15)] flex flex-col"
                    : "bg-[hsl(240,17%,5%)] border-[hsl(240,13%,16%)] flex flex-col"
                }
              >
                <CardContent className="p-6 flex flex-col flex-1">
                  {p.highlight && (
                    <span className="self-start text-[10px] font-semibold tracking-wide uppercase text-[hsl(213,100%,50%)] bg-[hsl(213,100%,50%)]/10 border border-[hsl(213,100%,50%)]/30 rounded-full px-2.5 py-1 mb-3">
                      Mais escolhido
                    </span>
                  )}
                  <h3 className="text-xl font-bold mb-1 text-[hsl(240,11%,89%)]">{p.name}</h3>
                  <p className="text-sm text-[hsl(240,5%,58%)] mb-4">{p.description}</p>
                  <div className="mb-1">
                    <span className="text-3xl font-extrabold text-[hsl(240,11%,89%)]">{p.price}</span>
                  </div>
                  <p className="text-xs text-[hsl(240,5%,58%)] mb-6">{p.priceNote}</p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-[hsl(160,73%,46%)] mt-0.5 shrink-0" />
                        <span className="text-[hsl(240,11%,89%)]">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={goToPricing}
                    variant={p.highlight ? "default" : "outline"}
                    className={
                      p.highlight
                        ? "bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)]"
                        : "border-[hsl(240,13%,16%)] text-[hsl(240,11%,89%)] hover:bg-[hsl(240,13%,9%)]"
                    }
                  >
                    Ver detalhes <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-sm text-[hsl(240,5%,58%)] mt-8">
            Quer ver todos os recursos e add-ons?{" "}
            <button onClick={goToPricing} className="text-[hsl(213,100%,50%)] hover:underline font-medium">
              Confira a página de preços completa
            </button>
            .
          </p>
        </div>
      </section>

      {/* ─── 8. FAQ ─── */}
      <section className="py-20 px-6 border-t border-[hsl(240,13%,16%)]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {[
              {
                q: "Quanto custa o Aura?",
                a: "O plano Básico começa em R$ 129,99 por usuário/mês e o Professional em R$ 199,99 por usuário/mês (valores a partir do 3º usuário). O Business é sob consulta, sem limites de embarques ou usuários. Veja todos os detalhes na página de preços.",
              },
              {
                q: "Preciso de cartão de crédito para testar?",
                a: "Não. O cadastro é gratuito por 14 dias e não pede cartão de crédito.",
              },
              {
                q: "Preciso instalar alguma coisa?",
                a: "Não. O Aura funciona 100% no navegador. Basta acessar com login e senha — no computador, tablet ou celular.",
              },
              {
                q: "Funciona no celular?",
                a: "Sim! A plataforma é totalmente responsiva. Você pode acompanhar seus processos de qualquer lugar.",
              },
              {
                q: "Quantos usuários posso ter?",
                a: "Depende do plano escolhido. Todos os planos permitem múltiplos usuários, com controle de permissão por perfil.",
              },
              {
                q: "Como migro meus dados?",
                a: "Nossa equipe pode ajudar na importação dos seus dados atuais durante o onboarding. Fale com a gente pelo WhatsApp.",
              },
            ].map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-[hsl(240,13%,16%)] rounded-lg px-4 bg-[hsl(240,13%,9%)]"
              >
                <AccordionTrigger className="text-[hsl(240,11%,89%)] hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="text-[hsl(240,5%,58%)]">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ─── 9. CTA FINAL ─── */}
      <section className="py-24 px-6 bg-gradient-to-b from-[hsl(240,13%,8%)] to-[hsl(240,17%,5%)]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para deixar as planilhas para trás?</h2>
          <p className="text-lg text-[hsl(240,5%,58%)] mb-8 max-w-xl mx-auto">
            Crie sua conta grátis agora ou fale com a gente no WhatsApp para tirar suas dúvidas antes de começar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Button
              size="lg"
              onClick={goToSignup}
              className="bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)] text-base px-10 py-6 rounded-xl shadow-[0_0_40px_hsl(213,100%,50%,0.25)] w-full sm:w-auto"
            >
              Começar grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="bg-[hsl(240,13%,9%)] border-[hsl(240,13%,16%)] text-[hsl(240,11%,89%)] hover:bg-[hsl(240,13%,16%)] hover:text-[hsl(240,11%,89%)] text-base px-10 py-6 rounded-xl w-full"
              >
                <MessageCircle className="mr-2 h-5 w-5 text-[hsl(160,73%,46%)]" />
                Falar no WhatsApp
              </Button>
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[hsl(240,5%,58%)]">
            <span>✓ 14 dias grátis</span>
            <span>✓ Sem cartão de crédito</span>
            <span>✓ 100% online</span>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[hsl(240,13%,16%)] py-12 px-6 bg-[hsl(240,13%,8%)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-sm text-[hsl(240,5%,58%)]">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="text-lg font-bold tracking-tight text-[hsl(240,11%,89%)]">
              <span className="text-[hsl(213,100%,50%)]">Aura</span> Comex
            </span>
            <span className="text-xs">by Brasa Digital</span>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="flex flex-wrap items-center justify-center gap-6 mb-2">
              <button onClick={goToPricing} className="hover:text-[hsl(240,11%,89%)] transition-colors">
                Preços
              </button>
              <a href="/termos" className="hover:text-[hsl(240,11%,89%)] transition-colors">
                Termos de uso
              </a>
              <a href="/privacidade" className="hover:text-[hsl(240,11%,89%)] transition-colors">
                Privacidade
              </a>
              <a href="mailto:contato@brasadigital.com.br" className="hover:text-[hsl(240,11%,89%)] transition-colors">
                Contato
              </a>
            </div>
            <p>© {new Date().getFullYear()} Aura Comex. Todos os direitos reservados.</p>
            <p className="text-xs opacity-70">contato@brasadigital.com.br</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
