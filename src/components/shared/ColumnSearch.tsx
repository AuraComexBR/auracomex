import { Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Lupa no cabeçalho da coluna: abre um popover pequeno com o campo de busca
// daquela coluna só, em vez de uma linha de busca fixa ocupando espaço ou um
// campo de busca único pra várias colunas ao mesmo tempo.
export function ColumnSearch({ value, onChange, open, onOpenChange }: {
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('shrink-0', value ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
          title="Buscar"
          onClick={(e) => e.stopPropagation()}
        >
          <Search className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar..."
          className="h-7 text-xs"
        />
      </PopoverContent>
    </Popover>
  );
}
