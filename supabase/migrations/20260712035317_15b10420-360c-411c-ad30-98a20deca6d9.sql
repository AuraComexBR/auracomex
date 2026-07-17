
-- Signup público: rate-limit por IP e unicidade de CNPJ
CREATE TABLE public.signup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  email TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_signup_attempts_ip_time ON public.signup_attempts(ip, created_at DESC);

GRANT ALL ON public.signup_attempts TO service_role;
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signup_attempts_superadmin_read" ON public.signup_attempts
  FOR SELECT USING (public.has_role(auth.uid(), 'superadmin'));

-- Unicidade de CNPJ (normalizado: só dígitos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_cnpj_digits
  ON public.companies ((regexp_replace(cnpj, '[^0-9]', '', 'g')))
  WHERE cnpj IS NOT NULL AND length(regexp_replace(cnpj, '[^0-9]', '', 'g')) > 0;
