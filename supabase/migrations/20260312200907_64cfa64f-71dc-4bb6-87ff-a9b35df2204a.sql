
-- Fix overly permissive INSERT policies

-- Companies: only allow insert for authenticated users (signup flow)
DROP POLICY "Anyone can insert company" ON public.companies;
CREATE POLICY "Authenticated users can create company" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Profiles: restrict to own profile creation
DROP POLICY "System can insert profiles" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- User roles: restrict to own role assignment  
DROP POLICY "System can insert roles" ON public.user_roles;
CREATE POLICY "Users can insert own roles" ON public.user_roles
  FOR INSERT WITH CHECK (user_id = auth.uid());
