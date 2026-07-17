import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReleases, Release } from '@/hooks/useReleases';
import * as Icons from 'lucide-react';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (Icons as any)[name] || Sparkles;
  return <Icon className={className} />;
}

/** Se `mode='auto'`, abre quando há releases não lidas. Se `mode='manual'`, controlado por `open`. */
export function ReleaseNotesDialog({
  mode = 'auto',
  open: openProp,
  onOpenChange,
}: {
  mode?: 'auto' | 'manual';
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const { releases, unread, markRead } = useReleases();
  const [internalOpen, setInternalOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const list: Release[] = mode === 'auto' ? unread : releases;
  const open = mode === 'auto' ? internalOpen : !!openProp;

  useEffect(() => {
    if (mode === 'auto' && unread.length > 0 && !internalOpen) {
      setIndex(0);
      setInternalOpen(true);
    }
  }, [mode, unread.length]);

  const setOpen = (o: boolean) => {
    if (mode === 'auto') setInternalOpen(o);
    onOpenChange?.(o);
  };

  if (list.length === 0) return null;
  const current = list[Math.min(index, list.length - 1)];
  if (!current) return null;

  async function handleAck() {
    if (mode === 'auto') await markRead(current.id);
    if (index < list.length - 1) setIndex(i => i + 1);
    else setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle className="flex items-center gap-2">
              Novidades
              <Badge variant="outline" className="font-mono">v{current.version}</Badge>
              {current.is_major && <Badge className="bg-primary/20 text-primary">Grande atualização</Badge>}
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            {format(new Date(current.published_at), 'dd/MM/yyyy')}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-base">{current.title}</h3>
            {current.summary && <p className="text-sm text-muted-foreground mt-1">{current.summary}</p>}
          </div>

          {current.highlights?.length > 0 && (
            <div className="space-y-2">
              {current.highlights.map((h, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-secondary/40 border border-border/50">
                  <div className="w-9 h-9 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <DynamicIcon name={h.icon} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{h.label}</div>
                    <div className="text-xs text-muted-foreground">{h.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {list.length > 1 && (
            <div className="text-center text-xs text-muted-foreground">
              {index + 1} de {list.length}
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === 'auto' && (
            <Button variant="ghost" onClick={() => setOpen(false)}>Ver depois</Button>
          )}
          <Button onClick={handleAck}>
            {index < list.length - 1 ? 'Próxima' : mode === 'auto' ? 'Entendi' : 'Fechar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}