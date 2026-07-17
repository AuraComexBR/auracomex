ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS incoterm text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS transit_time integer;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS free_time integer;