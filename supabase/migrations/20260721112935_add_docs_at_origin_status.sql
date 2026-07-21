-- Add 'docs_at_origin' ("Docs na Origem") shipment status, right after 'collected_at_origin'.
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'docs_at_origin' AFTER 'collected_at_origin';
