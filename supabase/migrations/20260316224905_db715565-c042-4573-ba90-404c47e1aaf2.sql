-- Allow superadmin to update their own profile's company_id (for switching company context)
DROP POLICY IF EXISTS "Superadmin can update own profile" ON public.profiles;

CREATE POLICY "Superadmin can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid() AND has_role(auth.uid(), 'superadmin'::app_role)
)
WITH CHECK (
  user_id = auth.uid() AND has_role(auth.uid(), 'superadmin'::app_role)
);