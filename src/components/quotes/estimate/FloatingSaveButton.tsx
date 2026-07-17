import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

type State = 'idle' | 'saving' | 'saved';

interface Props {
  visible: boolean;
  dirtyCount: number;
  state: State;
  onSave: () => void;
}

export function FloatingSaveButton({ visible, dirtyCount, state, onSave }: Props) {
  if (!visible) return null;

  const hasChanges = dirtyCount > 0;
  const isSaving = state === 'saving';
  const isSaved = state === 'saved';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2">
      <Button
        onClick={onSave}
        disabled={!hasChanges || isSaving}
        size="lg"
        className={cn(
          'shadow-xl backdrop-blur-md border transition-all',
          isSaved
            ? 'bg-[hsl(165_70%_45%)] hover:bg-[hsl(165_70%_45%)] text-white border-[hsl(165_70%_55%)]'
            : hasChanges
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary/40'
              : 'bg-muted text-muted-foreground border-border'
        )}
        title="Atalho: Ctrl/Cmd + S"
      >
        {isSaving ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
        ) : isSaved ? (
          <><Check className="w-4 h-4 mr-2" /> Salvo</>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            {hasChanges ? `Salvar Alterações (${dirtyCount})` : 'Sem alterações'}
            <span className="ml-3 text-[10px] opacity-70 hidden sm:inline">Ctrl+S</span>
          </>
        )}
      </Button>
    </div>
  );
}