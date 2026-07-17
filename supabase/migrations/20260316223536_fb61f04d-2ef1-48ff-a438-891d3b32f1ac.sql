
-- CRITICAL FIX 1: Remove "Users can insert own roles" - allows privilege escalation
-- (any user could insert role 'superadmin' for themselves!)
-- The handle_new_user trigger uses SECURITY DEFINER and bypasses RLS, so this policy is not needed.
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

-- CRITICAL FIX 2: "Admins can manage roles" has NO company_id check
-- An admin from Company A could manage roles of Company B users!
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage company roles" ON public.user_roles
FOR ALL
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND get_user_company_id(user_id) = get_user_company_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND get_user_company_id(user_id) = get_user_company_id(auth.uid())
);
