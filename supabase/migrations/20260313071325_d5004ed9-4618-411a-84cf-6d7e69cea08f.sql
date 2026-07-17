
UPDATE public.quotes SET status = 'quoting' WHERE status = 'draft';
UPDATE public.quotes SET status = 'approved' WHERE status = 'converted';
ALTER TABLE public.quotes ALTER COLUMN status SET DEFAULT 'quoting'::quote_status;
