-- Corrige exclusão de empresa: quote_items, quote_charges, charge_lines,
-- shipment_audit_log, quote_comments e quote_partners têm uma FK direta pra
-- companies(id) sem ON DELETE CASCADE (mesmo já cascateando via quote_id/shipment_id).
-- Isso bloqueia "DELETE FROM companies" com erro de foreign key sempre que a empresa
-- já teve alguma cotação/embarque. Encontra o nome real da constraint (gerado
-- automaticamente pelo Postgres) e recria com CASCADE.
DO $$
DECLARE
  tbl text;
  cons text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['quote_items', 'quote_charges', 'charge_lines', 'shipment_audit_log', 'quote_comments', 'quote_partners']
  LOOP
    SELECT tc.constraint_name INTO cons
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = tbl
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'company_id'
    LIMIT 1;

    IF cons IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, cons);
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE', tbl, cons);
    END IF;
  END LOOP;
END $$;
