DROP POLICY IF EXISTS "Finance/admin can manage bank accounts" ON public.company_bank_accounts;
CREATE POLICY "Finance/admin can manage bank accounts"
ON public.company_bank_accounts
FOR ALL
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor')
    OR has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'coordenador_financeiro')
    OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'superadmin')
  )
)
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor')
    OR has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'coordenador_financeiro')
    OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'superadmin')
  )
);