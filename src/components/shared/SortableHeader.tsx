import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SortState } from '@/hooks/useTableSort';

interface Props {
  label: React.ReactNode;
  sortKey: string;
  state: SortState;
  onToggle: (key: string) => void;
  className?: string;
  align?: 'left' | 'right' | 'center';
  /** Conteúdo extra ao lado do rótulo (ex: lupa de busca ou funil de filtro da coluna),
   *  fora do botão de ordenação, pra ter seu próprio clique independente. */
  right?: React.ReactNode;
}

export function SortableHeader({ label, sortKey, state, onToggle, className, align = 'left', right }: Props) {
  const active = state.key === sortKey && state.dir !== null;
  const Icon = !active ? ArrowUpDown : state.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <div className={cn('inline-flex items-center gap-1', align === 'right' && 'ml-auto flex-row-reverse')}>
        <button
          type="button"
          onClick={() => onToggle(sortKey)}
          className={cn(
            'inline-flex items-center gap-1.5 hover:text-foreground transition-colors select-none',
            active ? 'text-foreground' : 'text-muted-foreground',
            align === 'right' && 'flex-row-reverse',
            align === 'center' && 'mx-auto',
          )}
        >
          <span>{label}</span>
          <Icon className={cn('w-3.5 h-3.5', active ? 'opacity-100' : 'opacity-50')} />
        </button>
        {right}
      </div>
    </TableHead>
  );
}