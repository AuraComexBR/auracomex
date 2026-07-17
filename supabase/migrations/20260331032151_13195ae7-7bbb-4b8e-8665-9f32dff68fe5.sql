
-- ============================================
-- 1. Fix overly permissive ANON policies
-- ============================================

-- CLIENTS: restrict anon to only clients with a tax_id (needed for tracking lookup)
DROP POLICY IF EXISTS "Anon can read clients for tracking" ON public.clients;
CREATE POLICY "Anon can read clients for tracking"
  ON public.clients FOR SELECT TO anon
  USING (tax_id IS NOT NULL);

-- COMPANIES: restrict anon to only companies that have clients with tax_id (tracking-linked)
DROP POLICY IF EXISTS "Anon can read company by cnpj" ON public.companies;
CREATE POLICY "Anon can read company by cnpj"
  ON public.companies FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.company_id = companies.id AND c.tax_id IS NOT NULL
    )
  );

-- SHIPMENTS: restrict anon to only shipments linked to a client with tax_id
DROP POLICY IF EXISTS "Anon can read shipments for tracking" ON public.shipments;
CREATE POLICY "Anon can read shipments for tracking"
  ON public.shipments FOR SELECT TO anon
  USING (
    client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = shipments.client_id AND c.tax_id IS NOT NULL
    )
  );

-- QUOTES: restrict anon to only quotes linked to a client with tax_id
DROP POLICY IF EXISTS "Anon can read quotes for tracking" ON public.quotes;
CREATE POLICY "Anon can read quotes for tracking"
  ON public.quotes FOR SELECT TO anon
  USING (
    client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = quotes.client_id AND c.tax_id IS NOT NULL
    )
  );

-- ============================================
-- 2. Fix privilege escalation in user_roles
-- ============================================

-- Drop the existing admin policy and recreate with superadmin assignment prevention
DROP POLICY IF EXISTS "Admins can manage company roles" ON public.user_roles;
CREATE POLICY "Admins can manage company roles"
  ON public.user_roles FOR ALL TO public
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND get_user_company_id(user_id) = get_user_company_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND get_user_company_id(user_id) = get_user_company_id(auth.uid())
    AND role != 'superadmin'::app_role
  );
