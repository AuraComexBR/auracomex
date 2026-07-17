
-- Add salesperson to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'salesperson';

-- Add salesperson_id column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS salesperson_id uuid;
