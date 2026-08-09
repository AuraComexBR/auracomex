-- Follow-up diário do processo: campos de desembaraço/prazos + diário de
-- eventos datados por embarque. Inspirado na planilha de follow-up usada
-- manualmente com clientes (canal de parametrização, registro de DI, entrada
-- no terminal, prazos de demurrage/armazenagem, e um "diário" com data de
-- cada atualização até a entrega/faturamento).

-- 1. Campos novos em shipments — todos opcionais, não quebram nada existente.
ALTER TABLE public.shipments
  ADD COLUMN customs_channel text CHECK (customs_channel IN ('green', 'yellow', 'red')),
  ADD COLUMN customs_registration_date timestamptz,
  ADD COLUMN terminal_entry_date timestamptz,
  ADD COLUMN demurrage_deadline timestamptz,
  ADD COLUMN storage_deadline timestamptz,
  ADD COLUMN cargo_delivered_at timestamptz,
  ADD COLUMN invoice_sent_at timestamptz;

COMMENT ON COLUMN public.shipments.customs_channel IS 'Canal de parametrização da DI: green/yellow/red';
COMMENT ON COLUMN public.shipments.customs_registration_date IS 'Data de registro da Declaração de Importação';
COMMENT ON COLUMN public.shipments.terminal_entry_date IS 'Data de entrada da carga no terminal/recinto alfandegado';
COMMENT ON COLUMN public.shipments.demurrage_deadline IS 'Prazo final do freetime antes de começar a gerar demurrage';
COMMENT ON COLUMN public.shipments.storage_deadline IS 'Prazo final do 1º período de armazenagem';
COMMENT ON COLUMN public.shipments.cargo_delivered_at IS 'Data em que a carga foi efetivamente entregue ao cliente';
COMMENT ON COLUMN public.shipments.invoice_sent_at IS 'Data em que o faturamento do processo foi enviado';

-- 2. Diário do processo — cada linha é uma atualização datada (equivalente à
-- coluna OBS. da planilha), com controle de quais entradas aparecem no
-- portal de tracking do cliente (mesmo padrão de documents.visible_tracking).
CREATE TABLE public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_date timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL DEFAULT 'update' CHECK (category IN ('booking', 'origin', 'transit', 'customs', 'delivery', 'billing', 'update')),
  note text NOT NULL,
  visible_tracking boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_shipment_events_shipment_id ON public.shipment_events(shipment_id, event_date DESC);

CREATE POLICY "Users can view company shipment events" ON public.shipment_events
  FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());

CREATE POLICY "Users can insert company shipment events" ON public.shipment_events
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id());

CREATE POLICY "Users can update company shipment events" ON public.shipment_events
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id());

CREATE POLICY "Users can delete company shipment events" ON public.shipment_events
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id());

-- Portal de tracking usa a service role key na edge function (bypassa RLS),
-- mas mantemos a policy anon por consistência com o resto do schema
-- (shipments/documents já têm policies "Anon can read... for tracking").
CREATE POLICY "Anon can read visible tracking events" ON public.shipment_events
  FOR SELECT TO anon
  USING (visible_tracking = true);
