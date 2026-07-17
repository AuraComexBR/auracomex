import { Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TimelineStep } from '@/lib/shipmentTimeline';

interface Props {
  steps: TimelineStep[];
}

export function StatusTimeline({ steps }: Props) {
  return (
    <div className="w-full">
      {/* Desktop */}
      <div className="hidden md:flex items-start justify-between relative">
        {steps.map((s, idx) => {
          const isLast = idx === steps.length - 1;
          const nextDone = !isLast && steps[idx + 1].state === 'done';
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center relative">
              {!isLast && (
                <div
                  className={cn(
                    'absolute top-3 left-1/2 w-full h-0.5',
                    s.state === 'done' || nextDone ? 'bg-emerald-500/70' : 'bg-border'
                  )}
                />
              )}
              <Dot state={s.state} />
              <div className="mt-2 text-center px-1">
                <div className={cn('text-xs font-medium', s.state === 'pending' ? 'text-muted-foreground' : 'text-foreground')}>
                  {s.label}
                </div>
                {s.date && (
                  <div className="text-[10px] text-muted-foreground">{format(new Date(s.date), 'dd/MM/yyyy')}</div>
                )}
                {s.hint && <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{s.hint}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="md:hidden flex flex-col gap-2">
        {steps.map((s) => (
          <div key={s.key} className="flex items-center gap-3">
            <Dot state={s.state} />
            <div className="flex-1">
              <div className={cn('text-sm', s.state === 'pending' ? 'text-muted-foreground' : 'text-foreground font-medium')}>
                {s.label}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.date ? format(new Date(s.date), 'dd/MM/yyyy') : 'Pendente'}
                {s.hint ? ` • ${s.hint}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dot({ state }: { state: TimelineStep['state'] }) {
  if (state === 'done') {
    return (
      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center z-10 ring-2 ring-background">
        <Check className="w-3.5 h-3.5 text-white" />
      </div>
    );
  }
  if (state === 'current') {
    return (
      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center z-10 ring-2 ring-background animate-pulse">
        <div className="h-2 w-2 rounded-full bg-white" />
      </div>
    );
  }
  return <div className="h-6 w-6 rounded-full border-2 border-border bg-background z-10" />;
}