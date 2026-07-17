import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border border-border',
  quoting: 'status-new border',
  quoted: 'status-new border',
  booked: 'status-transit border',
  in_transit: 'status-transit border animate-pulse-neon',
  arrived: 'status-attention border',
  delivered: 'status-completed border',
  cancelled: 'bg-destructive/10 text-destructive border border-destructive/30',
  sent: 'status-transit border',
  approved: 'status-completed border',
  rejected: 'status-urgent border',
  converted: 'status-new border',
  pending: 'status-attention border',
  in_progress: 'status-transit border',
  completed: 'status-completed border',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  label?: string;
}

export function StatusBadge({ status, className, label: customLabel }: StatusBadgeProps) {
  const { t } = useLanguage();
  const label = customLabel
    || (t(`status.${status}`) !== `status.${status}`
      ? t(`status.${status}`)
      : t(`quote_status.${status}`) !== `quote_status.${status}`
        ? t(`quote_status.${status}`)
        : status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        statusStyles[status] || 'bg-muted text-muted-foreground',
        className
      )}
    >
      {label}
    </span>
  );
}
