-- Add department and must_change_password to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Update the handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id UUID;
BEGIN
  IF NEW.raw_user_meta_data->>'company_id' IS NOT NULL THEN
    _company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
  ELSIF NEW.raw_user_meta_data->>'company_name' IS NOT NULL THEN
    INSERT INTO public.companies (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'))
    RETURNING id INTO _company_id;
  ELSE
    _company_id := gen_random_uuid();
  END IF;

  INSERT INTO public.profiles (user_id, company_id, full_name, email, department, must_change_password)
  VALUES (
    NEW.id,
    _company_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'department',
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false)
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'operator'));

  RETURN NEW;
END;
$function$;

-- RLS: superadmin policies
CREATE POLICY "Superadmin can view all companies"
ON public.companies FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmin can update all companies"
ON public.companies FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmin can insert companies"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmin can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmin can manage all roles"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));