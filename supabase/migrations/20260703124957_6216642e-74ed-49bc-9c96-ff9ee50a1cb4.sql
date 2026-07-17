ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tax_id_type text
  CHECK (tax_id_type IN ('CNPJ','CPF','FOREIGN'))
  DEFAULT 'CNPJ';

UPDATE public.clients
SET tax_id_type = CASE
  WHEN tax_id IS NULL OR length(regexp_replace(tax_id, '\D', '', 'g')) = 0 THEN 'CNPJ'
  WHEN length(regexp_replace(tax_id, '\D', '', 'g')) = 11 THEN 'CPF'
  WHEN length(regexp_replace(tax_id, '\D', '', 'g')) = 14 THEN 'CNPJ'
  ELSE 'FOREIGN'
END
WHERE tax_id_type IS NULL OR tax_id_type = 'CNPJ';