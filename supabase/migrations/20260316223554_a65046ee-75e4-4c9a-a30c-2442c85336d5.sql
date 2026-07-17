
-- Fix ports: restrict write operations to admin/superadmin only
DROP POLICY IF EXISTS "Authenticated users can delete ports" ON public.ports;
DROP POLICY IF EXISTS "Authenticated users can insert ports" ON public.ports;
DROP POLICY IF EXISTS "Authenticated users can update ports" ON public.ports;

CREATE POLICY "Admins can insert ports" ON public.ports
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can update ports" ON public.ports
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can delete ports" ON public.ports
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));
