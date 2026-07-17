CREATE TABLE IF NOT EXISTS public.app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_major boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view releases"
ON public.app_releases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Superadmin manages releases"
ON public.app_releases FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER app_releases_updated
BEFORE UPDATE ON public.app_releases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_release_reads (
  user_id uuid NOT NULL,
  release_id uuid NOT NULL REFERENCES public.app_releases(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, release_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_release_reads TO authenticated;
GRANT ALL ON public.user_release_reads TO service_role;
ALTER TABLE public.user_release_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reads"
ON public.user_release_reads FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

INSERT INTO public.app_releases (version, title, summary, highlights, is_major, published_at)
VALUES
('1.0.0','Lançamento oficial do Aura',
 'Plataforma de gestão para freight forwarders com cotações, embarques, financeiro e tracking.',
 '[
   {"icon":"Rocket","label":"Cotações e embarques","description":"Fluxo completo do orçamento à entrega."},
   {"icon":"DollarSign","label":"Financeiro integrado","description":"Contas a pagar, fixas e visão por processo."},
   {"icon":"Ship","label":"Tracking ao cliente","description":"Portal público por PIN para acompanhamento."}
 ]'::jsonb, true, now() - interval '30 days'),
('1.1.0','Notas de Débito ao cliente + Personalização',
 'Novo módulo de faturamento ao cliente e identidade visual por empresa.',
 '[
   {"icon":"FileText","label":"DN ao Cliente","description":"Emita notas de débito em BRL com câmbio editável por linha."},
   {"icon":"Landmark","label":"Dados bancários","description":"Cadastre contas por moeda em Configurações."},
   {"icon":"Palette","label":"Cores da empresa","description":"Personalize a cor das suas propostas e documentos."},
   {"icon":"Wallet","label":"Contas a Receber","description":"Toda DN emitida vira automaticamente conta a receber no Financeiro."}
 ]'::jsonb, false, now())
ON CONFLICT (version) DO NOTHING;