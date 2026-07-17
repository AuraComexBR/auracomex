
-- Create enum for client/partner types
CREATE TYPE public.client_type AS ENUM ('client', 'supplier', 'carrier', 'agent');

-- Add type column to clients table
ALTER TABLE public.clients ADD COLUMN type client_type NOT NULL DEFAULT 'client';

-- Unique index to prevent duplicate CNPJ per company
CREATE UNIQUE INDEX idx_clients_tax_id_company ON public.clients(tax_id, company_id) WHERE tax_id IS NOT NULL AND tax_id != '';
