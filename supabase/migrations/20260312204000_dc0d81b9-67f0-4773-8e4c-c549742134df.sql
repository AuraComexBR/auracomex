
-- Update handle_new_user to also create the company
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id UUID;
BEGIN
  -- If company_id provided in metadata, use it; otherwise create a new company
  IF NEW.raw_user_meta_data->>'company_name' IS NOT NULL THEN
    INSERT INTO public.companies (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'))
    RETURNING id INTO _company_id;
  ELSE
    _company_id := COALESCE((NEW.raw_user_meta_data->>'company_id')::UUID, gen_random_uuid());
  END IF;

  -- Create profile
  INSERT INTO public.profiles (user_id, company_id, full_name, email)
  VALUES (
    NEW.id,
    _company_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );

  -- Assign default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'operator'));

  RETURN NEW;
END;
$function$;
