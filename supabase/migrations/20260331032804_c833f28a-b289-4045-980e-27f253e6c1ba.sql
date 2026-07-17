
-- ============================================
-- Remove ALL old overly-permissive storage policies
-- ============================================

-- Old shipment-documents policies (public role = includes anon)
DROP POLICY IF EXISTS "Users can delete docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view company docs" ON storage.objects;

-- Old company-logos policies (no ownership check)
DROP POLICY IF EXISTS "Users can delete company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view company logos" ON storage.objects;

-- ============================================
-- Remove anon policies from data tables
-- (will be replaced by tracking edge function)
-- ============================================
DROP POLICY IF EXISTS "Anon can read clients for tracking" ON public.clients;
DROP POLICY IF EXISTS "Anon can read company by cnpj" ON public.companies;
DROP POLICY IF EXISTS "Anon can read shipments for tracking" ON public.shipments;
DROP POLICY IF EXISTS "Anon can read quotes for tracking" ON public.quotes;
