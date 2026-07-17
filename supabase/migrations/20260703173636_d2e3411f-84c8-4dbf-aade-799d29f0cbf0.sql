ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS accounts_payable_dn_requires_link;
ALTER TABLE public.accounts_payable
  ADD CONSTRAINT accounts_payable_dn_requires_link
  CHECK (source <> 'debit_note' OR debit_note_id IS NOT NULL);