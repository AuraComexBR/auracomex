
-- Update existing shipments with 'booked' status to 'approved'
UPDATE public.shipments SET status = 'approved' WHERE status = 'booked';

-- Add 'Aprovado' status option for all companies that have status options configured
INSERT INTO public.shipment_status_options (company_id, label, value, position)
SELECT DISTINCT company_id, 'Aprovado', 'approved', 0
FROM public.shipment_status_options
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipment_status_options s2
  WHERE s2.company_id = shipment_status_options.company_id AND s2.value = 'approved'
);

-- Shift existing positions up by 1 for companies that just got the new status
UPDATE public.shipment_status_options
SET position = position + 1
WHERE value != 'approved'
AND company_id IN (
  SELECT company_id FROM public.shipment_status_options WHERE value = 'approved'
);
