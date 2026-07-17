
CREATE TYPE public.ticket_category AS ENUM ('bug','sugestao','duvida','outro');
CREATE TYPE public.ticket_status   AS ENUM ('aberto','em_andamento','resolvido','fechado');
CREATE TYPE public.ticket_priority AS ENUM ('baixa','media','alta');

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category public.ticket_category NOT NULL DEFAULT 'duvida',
  priority public.ticket_priority NOT NULL DEFAULT 'media',
  status public.ticket_status NOT NULL DEFAULT 'aberto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members view own tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE POLICY "company members create tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "superadmin updates tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR created_by = auth.uid()
  );

CREATE POLICY "superadmin deletes tickets"
  ON public.support_tickets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  is_staff boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view messages of accessible tickets"
  ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.company_id = public.get_user_company_id(auth.uid())
          OR public.has_role(auth.uid(), 'superadmin')
        )
    )
  );

CREATE POLICY "post messages on accessible tickets"
  ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.company_id = public.get_user_company_id(auth.uid())
          OR public.has_role(auth.uid(), 'superadmin')
        )
    )
  );

CREATE INDEX idx_support_tickets_company ON public.support_tickets(company_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_ticket_messages_ticket ON public.support_ticket_messages(ticket_id);
