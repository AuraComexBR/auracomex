CREATE POLICY "Superadmin can delete companies"
ON public.companies FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));