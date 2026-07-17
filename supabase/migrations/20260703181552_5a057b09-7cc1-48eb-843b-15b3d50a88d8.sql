
CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip text,
  user_agent text,
  city text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_logs_user_created ON public.access_logs (user_id, created_at DESC);

GRANT SELECT ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own access logs"
  ON public.access_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
