-- Add 'Docs na Origem' status option for all companies that already have custom
-- status options configured, right after 'collected_at_origin'
-- (position 3, since approved=0, booked=1, collected_at_origin=2).
INSERT INTO public.shipment_status_options (company_id, label, value, position)
SELECT DISTINCT company_id, 'Docs na Origem', 'docs_at_origin', 3
FROM public.shipment_status_options
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipment_status_options s2
  WHERE s2.company_id = shipment_status_options.company_id AND s2.value = 'docs_at_origin'
);

-- Shift positions of statuses that come after 'collected_at_origin' (position >= 3) up by 1,
-- to make room for the new 'docs_at_origin' status at position 3.
UPDATE public.shipment_status_options
SET position = position + 1
WHERE value NOT IN ('approved', 'booked', 'collected_at_origin', 'docs_at_origin')
AND position >= 3
AND company_id IN (
  SELECT company_id FROM public.shipment_status_options WHERE value = 'docs_at_origin'
);
