-- O cadastro de portos/aeroportos estava falhando porque as policies de
-- INSERT/UPDATE/DELETE em public.ports dependiam de has_role(uuid, app_role),
-- que não existe/bate no banco atual (mesmo problema já visto em outras
-- tabelas nesta sessão). Reescreve usando EXISTS direto em user_roles,
-- que não depende da assinatura da função.

DROP POLICY IF EXISTS "Admins can insert ports" ON public.ports;
DROP POLICY IF EXISTS "Admins can update ports" ON public.ports;
DROP POLICY IF EXISTS "Admins can delete ports" ON public.ports;

CREATE POLICY "Admins can insert ports" ON public.ports
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins can update ports" ON public.ports
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins can delete ports" ON public.ports
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'superadmin')
  )
);
