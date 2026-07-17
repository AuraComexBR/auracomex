UPDATE public.charge_catalog SET name = UPPER(name) WHERE name <> UPPER(name);
UPDATE public.quote_charges SET description = UPPER(description) WHERE description <> UPPER(description);