
-- Fix: Allow superadmin and management roles to delete shipments
DROP POLICY IF EXISTS "Users can delete company shipments" ON public.shipments;

CREATE POLICY "Users can delete company shipments" ON public.shipments
FOR DELETE TO public
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
  )
);
