ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS sent_at timestamptz DEFAULT NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT NULL;