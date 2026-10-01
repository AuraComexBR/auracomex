import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, LockOpen, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

/**
 * Acesso restrito (Full Access) para reabrir processos marcados como
 * Finalizado. Um processo finalizado fica travado para edição em toda a
 * aplicação (interface + banco); esta é a única porta para destravá-lo,
 * em caso de erro de lançamento ou necessidade de correção.
 */
export function ReopenShipmentsSection() {
  const { profile } = useAuth();
  const { isFullAccess } = usePermissions();
  const queryClient = useQueryClient();
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string } | null>(null);

  const { data: finalized = [], isLoading } = useQuery({
    queryKey: ['finalized-shipments', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('shipments') as any)
        .select('id, reference_number, status, updated_at, clients:client_id(name)')
        .eq('company_id', profile?.company_id)
        .eq('is_finalized', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!profile?.company_id && isFullAccess,
  });

  async function handleReopen(id: string) {
    setReopeningId(id);
    try {
      const { error } = await supabase.rpc('reopen_shipment' as any, { p_shipment_id: id } as any);
      if (error) throw error;
      toast.success('Processo reaberto. Agora pode ser editado novamente.');
      queryClient.invalidateQueries({ queryKey: ['finalized-shipments', profile?.company_id] });
      queryClient.invalidateQueries({ queryKey: ['shipment', id] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['quote-shipment', id] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reabrir o processo.');
    } finally {
      setReopeningId(null);
      setConfirmTarget(null);
    }
  }

  if (!isFullAccess) {
    return null;
  }

  return (
    <Card className="glass overflow-hidden border-amber-500/20">
      <CardHeader className="bg-amber-500/5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-lg">Reabrir Processos Finalizados</CardTitle>
        </div>
        <CardDescription>
          Um processo marcado como Finalizado fica travado para edição (Logística, Financeiro, Documentos,
          Diário e Parceiros). Reabra aqui somente em caso de erro de lançamento — a ação fica registrada no
          histórico do processo.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : finalized.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum processo finalizado no momento.
          </p>
        ) : (
          <div className="space-y-2">
            {finalized.map((s: any) => {
              const label = s.reference_number || s.id;
              const clientName = s.clients?.name || '—';
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{label}</span>
                      <Badge variant="outline" className="text-xs">{s.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {clientName} · atualizado em {format(new Date(s.updated_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    disabled={reopeningId === s.id}
                    onClick={() => setConfirmTarget({ id: s.id, label })}
                  >
                    {reopeningId === s.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LockOpen className="w-4 h-4" />
                    )}
                    Reabrir
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir processo {confirmTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              O processo voltará a ficar editável em todas as abas. Essa ação fica registrada no histórico
              do processo. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmTarget && handleReopen(confirmTarget.id)}>
              Reabrir processo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
