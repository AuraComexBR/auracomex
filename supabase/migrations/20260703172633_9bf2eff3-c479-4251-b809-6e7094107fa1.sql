-- 1. Ajusta FK debit_note_id para ON DELETE SET NULL
ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS accounts_payable_debit_note_id_fkey;
ALTER TABLE public.accounts_payable
  ADD CONSTRAINT accounts_payable_debit_note_id_fkey
  FOREIGN KEY (debit_note_id) REFERENCES public.debit_notes(id) ON DELETE SET NULL;

-- 2. Backfill: preenche shipment_id em contas a pagar cuja cotação já virou processo
UPDATE public.accounts_payable ap
SET shipment_id = s.id
FROM public.quotes q
JOIN public.shipments s ON s.reference_number = q.base_reference
WHERE ap.shipment_id IS NULL
  AND ap.quote_id = q.id;