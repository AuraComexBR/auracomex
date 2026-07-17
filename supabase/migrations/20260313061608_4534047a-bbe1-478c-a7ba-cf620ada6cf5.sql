
-- Add new role values to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador_comercial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inside';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador_operacional';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador_financeiro';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';
