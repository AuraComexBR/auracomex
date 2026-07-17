
-- Platform-wide settings (single row)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert the single row
INSERT INTO public.platform_settings (id) VALUES (gen_random_uuid());

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read platform settings (public pages need this)
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  TO public
  USING (true);

-- Only superadmin can update
CREATE POLICY "Superadmin can update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));
