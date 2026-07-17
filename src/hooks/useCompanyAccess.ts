import { useAuth } from '@/contexts/AuthContext';

export function useCompanyAccess() {
  const { profile, isSuperadmin } = useAuth();
  const companyExpiresAt = (profile as any)?.companyExpiresAt as string | null;

  if (isSuperadmin || !companyExpiresAt) {
    return { isExpired: false, expiresAt: null, daysRemaining: null };
  }

  const now = new Date();
  const expiresAt = new Date(companyExpiresAt);
  const diffMs = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    isExpired: daysRemaining <= 0,
    expiresAt,
    daysRemaining: Math.max(daysRemaining, 0),
  };
}
