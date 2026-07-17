CREATE POLICY "Anon can read quotes for tracking"
  ON public.quotes FOR SELECT TO anon
  USING (true);