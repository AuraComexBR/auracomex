
-- Remove duplicate status options per company (keep lowest position)
DELETE FROM public.shipment_status_options a
USING public.shipment_status_options b
WHERE a.company_id = b.company_id
  AND a.value = b.value
  AND a.id != b.id
  AND a.position > b.position;

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.shipment_status_options
ADD CONSTRAINT uq_company_status_value UNIQUE (company_id, value);
