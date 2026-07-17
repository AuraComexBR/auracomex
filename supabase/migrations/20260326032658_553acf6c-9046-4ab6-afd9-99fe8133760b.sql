
-- Add 'approved' to the shipment_status enum
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'approved' BEFORE 'booked';
