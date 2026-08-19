-- Índices de cobertura para FKs identificadas pelo advisor de performance do Supabase
-- (tabelas pequenas hoje, mas evita seq scan em joins/cascatas conforme crescem)
CREATE INDEX IF NOT EXISTS accountability_estimate_id_idx
  ON public.accountability (estimate_id);

CREATE INDEX IF NOT EXISTS accountability_items_comprovante_document_id_idx
  ON public.accountability_items (comprovante_document_id);

CREATE INDEX IF NOT EXISTS accountability_items_source_expense_id_idx
  ON public.accountability_items (source_expense_id);

CREATE INDEX IF NOT EXISTS quote_charges_sent_in_debit_note_id_idx
  ON public.quote_charges (sent_in_debit_note_id);

CREATE INDEX IF NOT EXISTS shipment_events_company_id_idx
  ON public.shipment_events (company_id);

-- Corrige "Auth RLS Initialization Plan": auth.uid() era reavaliado por linha,
-- troca por (select auth.uid()) pra ser avaliado uma única vez por query.
ALTER POLICY portalunico_webhook_events_select_own_company
  ON public.portalunico_webhook_events
  USING (
    company_id IN (
      SELECT profiles.company_id
      FROM profiles
      WHERE profiles.user_id = (select auth.uid())
    )
  );
