ALTER TABLE public.debit_note_items
  ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1;