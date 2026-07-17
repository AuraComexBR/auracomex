ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_tour_seen_at timestamptz;