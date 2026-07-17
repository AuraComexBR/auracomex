import { AlertTriangle } from 'lucide-react';
import { useCompanyAccess } from '@/hooks/useCompanyAccess';

export function ExpiredBanner() {
  const { isExpired, daysRemaining } = useCompanyAccess();

  if (!isExpired && (daysRemaining === null || daysRemaining > 15)) return null;

  const isWarning = !isExpired && daysRemaining !== null && daysRemaining <= 15;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${
      isExpired
        ? 'bg-destructive text-destructive-foreground'
        : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-b border-yellow-500/30'
    }`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      {isExpired
        ? 'O acesso da sua empresa expirou. O sistema está em modo somente-leitura. Entre em contato com o administrador.'
        : `Atenção: o acesso da sua empresa expira em ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}.`}
    </div>
  );
}
