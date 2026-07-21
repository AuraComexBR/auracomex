import { useAuth } from '@/contexts/AuthContext';

const FULL_ACCESS_ROLES = ['admin', 'diretor', 'gerente', 'superadmin'];

const QUOTES_ACCESS_ROLES = [
  ...FULL_ACCESS_ROLES,
  'coordenador_comercial', 'inside', 'salesperson',
];

const SHIPMENTS_ACCESS_ROLES = [
  ...QUOTES_ACCESS_ROLES,
  'coordenador_operacional', 'operator', 'operador',
];

const FINANCIAL_ACCESS_ROLES = [
  ...SHIPMENTS_ACCESS_ROLES,
  'coordenador_financeiro', 'financeiro',
];

const OVERHEAD_ACCESS_ROLES = ['admin', 'diretor', 'gerente', 'coordenador_financeiro', 'financeiro', 'superadmin'];

const SETTINGS_ROLES = ['admin', 'diretor', 'gerente', 'superadmin'];

export type Permissions = ReturnType<typeof usePermissions>;

export function usePermissions() {
  const { role } = useAuth();
  const r = role || '';

  const isSuperadmin = r === 'superadmin';
  const isFullAccess = FULL_ACCESS_ROLES.includes(r);
  const isSalesperson = r === 'salesperson';

  const canAccessDashboard = true;
  const canAccessQuotes = QUOTES_ACCESS_ROLES.includes(r) || isFullAccess;
  const canAccessShipments = SHIPMENTS_ACCESS_ROLES.includes(r) || isFullAccess;
  const canAccessFinancial = FINANCIAL_ACCESS_ROLES.includes(r) || isFullAccess;
  const canAccessOverhead = OVERHEAD_ACCESS_ROLES.includes(r);
  const canAccessRegistrations = !['financeiro'].includes(r);
  const canAccessSettings = SETTINGS_ROLES.includes(r);
  const canAccessSuperAdmin = isSuperadmin;

  const isScopedToOwnProcesses = isSalesperson;

  const canVerifyCharges = ['coordenador_operacional', 'operator', 'operador', ...FULL_ACCESS_ROLES].includes(r);
  const canProcessPayments = ['coordenador_financeiro', 'financeiro', ...FULL_ACCESS_ROLES].includes(r);

  return {
    role: r,
    isSuperadmin,
    isFullAccess,
    isSalesperson,
    isScopedToOwnProcesses,
    canAccessDashboard,
    canAccessQuotes,
    canAccessShipments,
    canAccessFinancial,
    canAccessOverhead,
    canAccessRegistrations,
    canAccessSettings,
    canAccessSuperAdmin,
    canVerifyCharges,
    canProcessPayments,
  };
}

// Plano Básico só oferece papéis simples (sem hierarquia/coordenadores). Professional e
// Business liberam os 13 papéis completos. 'client' e 'superadmin' não entram nessa lista
// porque nunca são atribuíveis pelos formulários de convite/edição de qualquer plano.
export const BASIC_PLAN_ROLES = ['admin', 'operator', 'financeiro', 'viewer'] as const;

export function getAssignableRolesForPlan<T extends string>(allRoles: readonly T[], plan: string | undefined): T[] {
  if (plan === 'starter') {
    return allRoles.filter((r) => (BASIC_PLAN_ROLES as readonly string[]).includes(r));
  }
  return [...allRoles];
}

export const ROLE_LABELS: Record<string, Record<'pt' | 'en', string>> = {
  superadmin: { pt: 'Superadmin', en: 'Superadmin' },
  admin: { pt: 'Administrador', en: 'Administrator' },
  diretor: { pt: 'Diretor', en: 'Director' },
  gerente: { pt: 'Gerente', en: 'Manager' },
  coordenador_comercial: { pt: 'Coordenador Comercial', en: 'Commercial Coordinator' },
  inside: { pt: 'Inside Sales', en: 'Inside Sales' },
  coordenador_operacional: { pt: 'Coordenador Operacional', en: 'Operations Coordinator' },
  operator: { pt: 'Operador', en: 'Operator' },
  coordenador_financeiro: { pt: 'Coordenador Financeiro', en: 'Financial Coordinator' },
  financeiro: { pt: 'Financeiro', en: 'Financial' },
  salesperson: { pt: 'Vendedor', en: 'Salesperson' },
  viewer: { pt: 'Visualizador', en: 'Viewer' },
  client: { pt: 'Cliente', en: 'Client' },
};
