import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useSubscription, PLAN_LABEL } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';

export function PlanBadge() {
  const { data } = useSubscription();
  if (!data) return null;

  const isTrial = data.status === 'trial';
  const isPastDue = data.status === 'past_due';

  return (
    <Link
      to="/settings#assinatura"
      className={cn(
        'hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
        isPastDue
          ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
          : isTrial
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
          : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20',
      )}
      title="Ver assinatura"
    >
      <Sparkles className="w-3 h-3" />
      {PLAN_LABEL[data.plan]}
      {isTrial && <span className="opacity-70">· trial</span>}
      {isPastDue && <span className="opacity-70">· em atraso</span>}
    </Link>
  );
}