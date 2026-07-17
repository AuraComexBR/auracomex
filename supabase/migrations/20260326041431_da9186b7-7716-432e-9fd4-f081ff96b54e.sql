
ALTER TABLE public.documents ADD COLUMN visible_tracking boolean NOT NULL DEFAULT false;

CREATE POLICY "Users can update company documents"
  ON public.documents FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Anon can read tracking documents"
  ON public.documents FOR SELECT TO anon
  USING (visible_tracking = true);
