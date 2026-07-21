-- Unifica o histórico de alterações: passa a cobrir toda e qualquer fase
-- da referência (cotação e embarque), não só a aba Logística do embarque.
--
-- shipment_id deixa de ser obrigatório (mudanças feitas ainda na fase de
-- cotação, antes de existir um embarque, não têm shipment_id).
-- quote_id é adicionado e deve ser preenchido sempre que a referência tiver
-- uma cotação vinculada (é o identificador estável que não muda entre as
-- fases de cotação e embarque, permitindo consultar o histórico completo
-- com uma única query por quote_id).

ALTER TABLE public.shipment_audit_log
  ALTER COLUMN shipment_id DROP NOT NULL;

ALTER TABLE public.shipment_audit_log
  ADD COLUMN quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_shipment_audit_log_quote_id
  ON public.shipment_audit_log(quote_id);

-- Garante que todo registro esteja amarrado a pelo menos uma referência.
ALTER TABLE public.shipment_audit_log
  ADD CONSTRAINT shipment_audit_log_has_reference
  CHECK (shipment_id IS NOT NULL OR quote_id IS NOT NULL);
