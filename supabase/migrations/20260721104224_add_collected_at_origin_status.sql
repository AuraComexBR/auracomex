-- Add 'collected_at_origin' ("Coletado na Origem") shipment status, right after 'booked'.
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'collected_at_origin' AFTER 'booked';
