import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Eye, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  TRACKING_FIELD_REGISTRY,
  TRACKING_FIELD_GROUP_LABELS,
  TRACKING_FIELD_GROUP_ORDER,
  normalizeTrackingFieldVisibility,
  type TrackingFieldVisibility,
} from '@/lib/trackingFieldRegistry';

interface Props {
  client: { id: string; name: string; tracking_field_visibility?: unknown } | null;
  onClose: () => void;
}

/** Configuração de quais campos aparecem no Portal de Tracking desse
 *  cliente — por padrão nada aparece (o usuário precisa revisar e marcar
 *  explicitamente o que esse cliente pode ver, tanto na visão colapsada
 *  quanto na expandida). Ver src/lib/trackingFieldRegistry.ts. */
export function TrackingVisibilityDialog({ client, onClose }: Props) {
  const queryClient = useQueryClient();
  const [visibility, setVisibility] = useState<TrackingFieldVisibility>({ collapsed: [], expanded: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) setVisibility(normalizeTrackingFieldVisibility(client.tracking_field_visibility));
  }, [client]);

  if (!client) return null;

  function toggle(view: 'collapsed' | 'expanded', key: string, checked: boolean) {
    setVisibility(prev => {
      const set = new Set(prev[view]);
      if (checked) set.add(key); else set.delete(key);
      return { ...prev, [view]: Array.from(set) };
    });
  }

  function toggleAllInGroup(view: 'collapsed' | 'expanded', keys: string[], checked: boolean) {
    setVisibility(prev => {
      const set = new Set(prev[view]);
      keys.forEach(k => (checked ? set.add(k) : set.delete(k)));
      return { ...prev, [view]: Array.from(set) };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await (supabase.from('clients') as any)
        .update({ tracking_field_visibility: visibility })
        .eq('id', client!.id);
      if (error) throw error;
      toast.success('Visibilidade do tracking atualizada.');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Tracking — {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Marque quais campos esse cliente pode ver no portal de tracking — na linha resumo (colapsada)
            e/ou no detalhe (expandida). Campos não marcados nem chegam a sair do servidor pro navegador
            do cliente. Novo cliente começa sem nada marcado.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-6">
          {TRACKING_FIELD_GROUP_ORDER.map((group) => {
            const fields = TRACKING_FIELD_REGISTRY.filter(f => f.group === group);
            const keys = fields.map(f => f.key);
            const allCollapsed = keys.every(k => visibility.collapsed.includes(k));
            const allExpanded = keys.every(k => visibility.expanded.includes(k));
            return (
              <div key={group} className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <h3 className="text-sm font-semibold">{TRACKING_FIELD_GROUP_LABELS[group]}</h3>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={allCollapsed}
                        onCheckedChange={(c) => toggleAllInGroup('collapsed', keys, !!c)}
                      />
                      Marcar tudo (Colapsada)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={allExpanded}
                        onCheckedChange={(c) => toggleAllInGroup('expanded', keys, !!c)}
                      />
                      Marcar tudo (Expandida)
                    </label>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left font-medium py-1">Campo</th>
                      <th className="text-center font-medium py-1 w-24">Colapsada</th>
                      <th className="text-center font-medium py-1 w-24">Expandida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => (
                      <tr key={f.key} className="border-t border-border/60">
                        <td className="py-1.5 pr-2">
                          <span>{f.label}</span>
                          {f.hint && <span className="block text-[11px] text-muted-foreground">{f.hint}</span>}
                        </td>
                        <td className="py-1.5 text-center">
                          <Checkbox
                            checked={visibility.collapsed.includes(f.key)}
                            onCheckedChange={(c) => toggle('collapsed', f.key, !!c)}
                          />
                        </td>
                        <td className="py-1.5 text-center">
                          <Checkbox
                            checked={visibility.expanded.includes(f.key)}
                            onCheckedChange={(c) => toggle('expanded', f.key, !!c)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
