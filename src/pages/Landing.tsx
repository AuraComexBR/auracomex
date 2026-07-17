import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Ship, FileText, DollarSign, BarChart3, Clock, Shield, CheckCircle2, ArrowRight, Star, Users, Zap, Globe, ChevronDown, Anchor, Plane, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

const DEMO_LINK = "#agendar"; // Replace with Calendly/WhatsApp link

function Landing() {
  const navigate = useNavigate();
  const { data: platformSettings } = usePlatformSettings();
  const platformLogo = platformSettings?.logo_url;

  const scrollToDemo = () => {
    const el = document.getElementById("agendar");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[hsl(240,17%,5%)] text-[hsl(240,11%,89%)]">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[hsl(240,17%,5%)]/80 border-b border-[hsl(240,13%,16%)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            {platformLogo ? (
              <img src={platformLogo} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight">
                  <span className="text-[hsl(213,100%,50%)]">Aura</span> Comex
                </span>
                <span className="text-[10px] text-muted-foreground font-medium -mt-1">by Brasa Digital</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/precos")} className="text-[hsl(240,11%,89%)] hover:text-[hsl(213,100%,50%)] hidden sm:inline-flex">
              Preços
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-[hsl(240,11%,89%)] hover:text-[hsl(213,100%,50%)]">
              Entrar
            </Button>
            <Button size="sm" onClick={scrollToDemo} className="bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)]">
              Agendar Demo
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── 1. ACIMA DA DOBRA ─── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(213,100%,50%)]/5 to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(213,100%,50%)]/5 blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="inline-block text-sm font-medium text-[hsl(213,100%,50%)] tracking-wide uppercase mb-4 border border-[hsl(213,100%,50%)]/20 rounded-full px-4 py-1.5 bg-[hsl(213,100%,50%)]/5">
            Para agentes de carga que querem crescer sem complicação
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
            Pare de perder tempo com planilhas.{" "}
            <span className="text-[hsl(213,100%,50%)]">Gerencie tudo em um só lugar.</span>
          </h1>
          <p className="text-lg md:text-xl text-[hsl(240,5%,58%)] max-w-2xl mx-auto mb-8">
            Embarques, cotações, documentos e financeiro — numa plataforma simples, feita para quem opera com equipe enxuta.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Button size="lg" onClick={scrollToDemo} className="bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)] text-base px-8 py-6 rounded-xl shadow-[0_0_30px_hsl(187,94%,43%,0.3)]">
              Agendar Demonstração <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-[hsl(240,5%,58%)]">Sem compromisso · 30 minutos · 100% online</p>

          {/* Mini social proof */}
          <div className="flex items-center justify-center gap-6 mt-10 text-sm text-[hsl(240,5%,58%)]">
            <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[hsl(160,73%,46%)]" /> Sem cartão de crédito</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[hsl(160,73%,46%)]" /> Setup em minutos</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[hsl(160,73%,46%)]" /> Suporte em português</div>
          </div>
        </div>
      </section>

      {/* ─── 2. SEÇÃO DE LEADS ─── */}
      <section className="py-20 px-6 border-t border-[hsl(222,20%,12%)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Você ainda gerencia processos por e-mail e Excel?</h2>
          <p className="text-[hsl(240,5%,58%)] text-lg max-w-2xl mx-auto mb-8">
            A maioria dos pequenos agentes de carga perde horas por dia com planilhas, WhatsApp e e-mails soltos. Enquanto isso, informações se perdem, cotações atrasam e o financeiro fica no escuro.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Clock, title: "Horas perdidas", desc: "Copiando dados entre planilhas e e-mails todos os dias" },
              { icon: DollarSign, title: "Sistemas caros", desc: "Ferramentas como CargoWise custam mais que sua operação permite" },
              { icon: Shield, title: "Informações soltas", desc: "Sem histórico centralizado, dados se perdem com facilidade" },
            ].map((item) => (
              <Card key={item.title} className="bg-[hsl(240,13%,9%)] border-[hsl(240,13%,16%)] text-left">
                <CardContent className="p-6">
                  <item.icon className="h-8 w-8 text-[hsl(350,89%,60%)] mb-3" />
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

      {/* ─── 3. SEÇÃO DE PROVA ─── */}
      <section className="py-20 px-6 bg-[hsl(240,13%,8%)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">O que dizem os agentes que usam o Aura</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Ricardo M.", role: "Agente de Carga — SP", quote: "Finalmente um sistema que cabe no meu bolso e resolve o que eu preciso. Larguei as planilhas em uma semana." },
              { name: "Fernanda L.", role: "Freight Forwarder — RJ", quote: "A equipe é pequena, mas agora parece que somos o dobro. Tudo organizado num lugar só." },
              { name: "Carlos A.", role: "Despachante — SC", quote: "Em 30 minutos de demo eu já entendi que era o que eu precisava. Simples assim." },
            ].map((t) => (
              <Card key={t.name} className="bg-[hsl(240,17%,5%)] border-[hsl(240,13%,16%)]">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-3">
                    {[1,2,3,4,5].map(s => <Star key={s} className="h-4 w-4 fill-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" />)}
                  </div>
                  <p className="text-sm text-[hsl(240,11%,89%)] mb-4 italic">"{t.quote}"</p>
                  <p className="text-sm font-semibold text-[hsl(240,11%,89%)]">{t.name}</p>
                  <p className="text-xs text-[hsl(240,5%,58%)]">{t.role}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. BENEFÍCIOS ─── */}
      <section className="py-20 px-6 border-t border-[hsl(222,20%,12%)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Tudo que você precisa para operar com eficiência</h2>
          <p className="text-center text-[hsl(240,5%,58%)] mb-12 max-w-2xl mx-auto">Chega de alternar entre 5 ferramentas diferentes. O Aura centraliza sua operação.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Ship, title: "Embarques", desc: "Controle completo de cada processo, do booking à entrega" },
              { icon: FileText, title: "Cotações", desc: "Crie e envie cotações profissionais em minutos" },
              { icon: DollarSign, title: "Financeiro", desc: "Contas a pagar/receber, câmbio e margem por processo" },
              { icon: BarChart3, title: "Visão geral", desc: "Dashboard com KPIs em tempo real da sua operação" },
              { icon: Globe, title: "Multi-modal", desc: "Marítimo FCL/LCL, aéreo, rodoviário e multimodal" },
              { icon: Users, title: "Parceiros", desc: "Gerencie clientes, agentes, armadores e transportadoras" },
              { icon: Zap, title: "Rapidez", desc: "Interface leve e rápida — funciona até no celular" },
              { icon: Shield, title: "Segurança", desc: "Dados protegidos com controle de acesso por perfil" },
            ].map((b) => (
              <Card key={b.title} className="bg-[hsl(240,13%,9%)] border-[hsl(240,13%,16%)] hover:border-[hsl(213,100%,50%)]/30 transition-colors">
                <CardContent className="p-6">
                  <b.icon className="h-7 w-7 text-[hsl(213,100%,50%)] mb-3" />
                  <h3 className="font-semibold text-[hsl(240,11%,89%)] mb-1">{b.title}</h3>
                  <p className="text-sm text-[hsl(240,5%,58%)]">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. DIFERENCIADORES ─── */}
      <section className="py-20 px-6 bg-[hsl(240,13%,8%)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Por que escolher o Aura?</h2>
          <p className="text-center text-[hsl(240,5%,58%)] mb-10">Veja como nos comparamos com as alternativas que você já conhece.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(240,13%,16%)]">
                  <th className="text-left py-4 px-4 text-[hsl(240,5%,58%)] font-medium"></th>
                  <th className="py-4 px-4 text-center">
                    <span className="text-[hsl(213,100%,50%)] font-bold">Aura</span>
                  </th>
                  <th className="py-4 px-4 text-center text-[hsl(240,5%,58%)]">Sistemas tradicionais</th>
                  <th className="py-4 px-4 text-center text-[hsl(240,5%,58%)]">Planilhas</th>
                </tr>
              </thead>
              <tbody>
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
                  <tr key={i} className="border-b border-[hsl(240,13%,16%)]/50">
                    <td className="py-3 px-4 text-[hsl(240,11%,89%)]">{label as string}</td>
                    <td className="py-3 px-4 text-center">{aura ? <CheckCircle2 className="h-5 w-5 text-[hsl(160,73%,46%)] mx-auto" /> : <span className="text-[hsl(240,5%,58%)]">—</span>}</td>
                    <td className="py-3 px-4 text-center">{trad ? <CheckCircle2 className="h-5 w-5 text-[hsl(240,5%,58%)] mx-auto" /> : <span className="text-[hsl(240,5%,58%)]">—</span>}</td>
                    <td className="py-3 px-4 text-center">{plan ? <CheckCircle2 className="h-5 w-5 text-[hsl(240,5%,58%)] mx-auto" /> : <span className="text-[hsl(240,5%,58%)]">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── 6. COMO FUNCIONA ─── */}
      <section className="py-20 px-6 border-t border-[hsl(222,20%,12%)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Comece em 3 passos simples</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Agende a demo", desc: "Escolha o melhor horário. Leva menos de 1 minuto." },
              { step: "2", title: "Veja o Aura ao vivo", desc: "Em 30 minutos mostramos como o Aura resolve sua operação." },
              { step: "3", title: "Comece a usar", desc: "Setup rápido, importação de dados e suporte dedicado." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <div className="h-14 w-14 rounded-full bg-[hsl(213,100%,50%)]/10 border border-[hsl(213,100%,50%)]/30 flex items-center justify-center text-[hsl(213,100%,50%)] text-xl font-bold mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-[hsl(240,5%,58%)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 7. OFERTA (O que será mostrado na demo) ─── */}
      <section className="py-20 px-6 bg-[hsl(240,13%,8%)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">O que você vai ver na demonstração</h2>
          <p className="text-[hsl(240,5%,58%)] mb-10 max-w-xl mx-auto">Uma visão completa de como o Aura pode simplificar sua operação — personalizada para o seu caso.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
            {[
              "Gestão completa de embarques",
              "Criação e envio de cotações",
              "Controle financeiro por processo",
              "Upload e organização de documentos",
              "Dashboard com indicadores em tempo real",
              "Controle de acesso por perfil de usuário",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-3">
                <CheckCircle2 className="h-5 w-5 text-[hsl(213,100%,50%)] mt-0.5 shrink-0" />
                <span className="text-[hsl(240,11%,89%)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 8. SOBRE ─── */}
      <section className="py-20 px-6 border-t border-[hsl(222,20%,12%)]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Nossa missão</h2>
          <p className="text-lg text-[hsl(240,5%,58%)] mb-6">
            Acreditamos que tecnologia de ponta não deveria ser exclusividade de grandes operadores. O Aura nasceu para democratizar a gestão logística — oferecendo uma plataforma completa, acessível e fácil de usar para agentes de carga de qualquer tamanho.
          </p>
          <p className="text-[hsl(213,100%,50%)] font-medium">
            Feito por quem entende logística, para quem vive logística.
          </p>
        </div>
      </section>

      {/* ─── 9. PROVA SOCIAL COM INTENÇÃO ─── */}
      <section className="py-20 px-6 bg-[hsl(240,13%,8%)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Feito para quem opera no dia a dia</h2>
          <p className="text-center text-[hsl(240,5%,58%)] mb-10">Não importa o tamanho da sua operação — o Aura se adapta.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: Anchor,
                title: "Agente solo",
                desc: "Você faz tudo sozinho e precisa de organização para não perder prazos. O Aura centraliza embarques, cotações e documentos para que nada escape.",
                quote: "\"Era eu e o Excel. Agora é eu e o Aura — e rende muito mais.\""
              },
              {
                icon: Users,
                title: "Equipe de 3-5 pessoas",
                desc: "Operacional, comercial e financeiro precisam das mesmas informações. Com o Aura, todos acessam o mesmo processo em tempo real, cada um com suas permissões.",
                quote: "\"Todo mundo sabe o que está acontecendo sem precisar perguntar.\""
              },
            ].map((a) => (
              <Card key={a.title} className="bg-[hsl(240,17%,5%)] border-[hsl(240,13%,16%)]">
                <CardContent className="p-6">
                  <a.icon className="h-8 w-8 text-[hsl(213,100%,50%)] mb-3" />
                  <h3 className="font-bold text-lg text-[hsl(240,11%,89%)] mb-2">{a.title}</h3>
                  <p className="text-sm text-[hsl(240,5%,58%)] mb-4">{a.desc}</p>
                  <p className="text-sm italic text-[hsl(213,100%,50%)]">{a.quote}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 10. FAQ ─── */}
      <section className="py-20 px-6 border-t border-[hsl(222,20%,12%)]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {[
              { q: "Quanto custa o Aura?", a: "O Aura tem planos acessíveis pensados para pequenos agentes. Na demonstração apresentamos as opções e encontramos o melhor plano para sua operação." },
              { q: "Preciso instalar alguma coisa?", a: "Não. O Aura funciona 100% no navegador. Basta acessar com login e senha — no computador, tablet ou celular." },
              { q: "Funciona no celular?", a: "Sim! A plataforma é totalmente responsiva. Você pode acompanhar seus processos de qualquer lugar." },
              { q: "Quantos usuários posso ter?", a: "Depende do plano escolhido. Todos os planos permitem múltiplos usuários com controle de permissão por perfil." },
              { q: "Como migro meus dados?", a: "Nossa equipe ajuda na importação dos seus dados atuais durante o onboarding. Sem dor de cabeça." },
              { q: "Quanto tempo dura a demonstração?", a: "Cerca de 30 minutos. Mostramos o Aura funcionando ao vivo e tiramos todas as suas dúvidas." },
            ].map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-[hsl(240,13%,16%)] rounded-lg px-4 bg-[hsl(240,13%,9%)]">
                <AccordionTrigger className="text-[hsl(240,11%,89%)] hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="text-[hsl(240,5%,58%)]">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ─── 11. PONTO FINAL + CTA ─── */}
      <section id="agendar" className="py-24 px-6 bg-gradient-to-b from-[hsl(240,13%,8%)] to-[hsl(240,17%,5%)]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para deixar as planilhas para trás?
          </h2>
          <p className="text-lg text-[hsl(240,5%,58%)] mb-6 max-w-xl mx-auto">
            Agende uma demonstração gratuita de 30 minutos e veja como o Aura pode transformar sua operação.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Button size="lg" onClick={scrollToDemo} className="bg-[hsl(213,100%,50%)] text-[hsl(240,17%,5%)] hover:bg-[hsl(213,100%,58%)] text-base px-10 py-6 rounded-xl shadow-[0_0_40px_hsl(187,94%,43%,0.25)]">
              Agendar Demonstração <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-[hsl(240,5%,58%)]">
            <span>✓ Sem compromisso</span>
            <span>✓ 30 minutos</span>
            <span>✓ 100% online</span>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[hsl(222,20%,12%)] py-12 px-6 bg-[hsl(240,13%,8%)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-sm text-[hsl(240,5%,58%)]">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="text-lg font-bold tracking-tight text-[hsl(240,11%,89%)]">
              <span className="text-[hsl(213,100%,50%)]">Aura</span> Comex
            </span>
            <span className="text-xs">by Brasa Digital</span>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="flex items-center gap-6 mb-2">
              <a href="/termos" className="hover:text-[hsl(240,11%,89%)] transition-colors">Termos de uso</a>
              <a href="/privacidade" className="hover:text-[hsl(240,11%,89%)] transition-colors">Privacidade</a>
              <a href="mailto:contato@brasadigital.com.br" className="hover:text-[hsl(240,11%,89%)] transition-colors">Contato</a>
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
