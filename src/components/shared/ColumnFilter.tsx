import { Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Funil no cabeçalho da coluna: mesmo padrão do ColumnSearch, mas pra filtro
// por checkboxes (ex: Status, Modal).
export function ColumnFilter({ open, onOpenChange, active, title, onClear, children, contentClassName }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  active: boolean;
  title: string;
  onClear: () => void;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('shrink-0', active ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
          title="Filtrar"
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-56 p-3', contentClassName)} align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            {active && (
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={onClear}>
                Limpar
              </button>
            )}
          </div>
          <div className="space-y-1.5">{children}</div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
