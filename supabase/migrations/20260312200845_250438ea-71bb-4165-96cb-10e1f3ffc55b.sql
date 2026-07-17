
-- =============================================
-- FreightFlow SaaS - Multi-Tenant Database Schema
-- =============================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer', 'client');
CREATE TYPE public.shipment_status AS ENUM ('draft', 'quoted', 'booked', 'in_transit', 'arrived', 'delivered', 'cancelled');
CREATE TYPE public.transport_mode AS ENUM ('ocean_fcl', 'ocean_lcl', 'air', 'road', 'multimodal');
CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'approved', 'rejected', 'converted');
CREATE TYPE public.charge_type AS ENUM ('freight', 'handling', 'customs', 'insurance', 'documentation', 'storage', 'other');
CREATE TYPE public.document_type AS ENUM ('bl', 'invoice', 'packing_list', 'certificate_origin', 'customs_declaration', 'insurance', 'other');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.notification_type AS ENUM ('deadline_warning', 'approval_needed', 'document_uploaded', 'status_change', 'general');

-- 2. COMPANIES (Tenants)
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 3. PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  language TEXT NOT NULL DEFAULT 'pt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. USER ROLES
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'operator',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. CLIENTS (external clients of the company)
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  contact_person TEXT,
  address TEXT,
  tax_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 6. SHIPMENTS
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  reference_number TEXT NOT NULL,
  status shipment_status NOT NULL DEFAULT 'draft',
  transport_mode transport_mode NOT NULL DEFAULT 'ocean_fcl',
  incoterm TEXT,
  origin_city TEXT,
  origin_country TEXT,
  origin_port TEXT,
  destination_city TEXT,
  destination_country TEXT,
  destination_port TEXT,
  carrier TEXT,
  vessel_flight TEXT,
  booking_number TEXT,
  container_number TEXT,
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  atd TIMESTAMPTZ,
  ata TIMESTAMPTZ,
  cargo_description TEXT,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  packages INTEGER,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- 7. CHARGES (financial)
CREATE TABLE public.charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  charge_type charge_type NOT NULL DEFAULT 'freight',
  description TEXT NOT NULL,
  buy_amount NUMERIC NOT NULL DEFAULT 0,
  buy_currency TEXT NOT NULL DEFAULT 'USD',
  sell_amount NUMERIC NOT NULL DEFAULT 0,
  sell_currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC DEFAULT 1,
  tax_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

-- 8. DOCUMENTS
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  document_type document_type NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 9. QUOTES
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  shipment_id UUID REFERENCES public.shipments(id),
  quote_number TEXT NOT NULL,
  status quote_status NOT NULL DEFAULT 'draft',
  transport_mode transport_mode NOT NULL DEFAULT 'ocean_fcl',
  origin TEXT,
  destination TEXT,
  valid_until TIMESTAMPTZ,
  total_buy NUMERIC DEFAULT 0,
  total_sell NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- 10. TASKS
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  shipment_id UUID REFERENCES public.shipments(id),
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 11. NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  type notification_type NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 12. ACTIVITY LOG
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  shipment_id UUID REFERENCES public.shipments(id),
  user_id UUID,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile (company_id must be set via signup metadata)
  INSERT INTO public.profiles (user_id, company_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'company_id')::UUID, gen_random_uuid()),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  -- Assign default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'operator'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RLS POLICIES (Multi-Tenant by company_id)
-- =============================================

-- Companies: users see their own company
CREATE POLICY "Users can view own company" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can update own company" ON public.companies
  FOR UPDATE USING (id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert company" ON public.companies
  FOR INSERT WITH CHECK (true);

-- Profiles: users see own company profiles
CREATE POLICY "Users can view company profiles" ON public.profiles
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Clients
CREATE POLICY "Users can view company clients" ON public.clients
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company clients" ON public.clients
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company clients" ON public.clients
  FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company clients" ON public.clients
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));

-- Shipments
CREATE POLICY "Users can view company shipments" ON public.shipments
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company shipments" ON public.shipments
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company shipments" ON public.shipments
  FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company shipments" ON public.shipments
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Charges
CREATE POLICY "Users can view company charges" ON public.charges
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company charges" ON public.charges
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company charges" ON public.charges
  FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company charges" ON public.charges
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));

-- Documents
CREATE POLICY "Users can view company documents" ON public.documents
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company documents" ON public.documents
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company documents" ON public.documents
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));

-- Quotes
CREATE POLICY "Users can view company quotes" ON public.quotes
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company quotes" ON public.quotes
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company quotes" ON public.quotes
  FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company quotes" ON public.quotes
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));

-- Tasks
CREATE POLICY "Users can view company tasks" ON public.tasks
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company tasks" ON public.tasks
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company tasks" ON public.tasks
  FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company tasks" ON public.tasks
  FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));

-- Notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Activity log
CREATE POLICY "Users can view company activity" ON public.activity_log
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company activity" ON public.activity_log
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- =============================================
-- TRIGGERS for updated_at
-- =============================================
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STORAGE for documents
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('shipment-documents', 'shipment-documents', false);

CREATE POLICY "Users can view company docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'shipment-documents');
CREATE POLICY "Users can upload docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'shipment-documents');
CREATE POLICY "Users can delete docs" ON storage.objects
  FOR DELETE USING (bucket_id = 'shipment-documents');
