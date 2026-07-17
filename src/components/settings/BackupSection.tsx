import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Download, Loader2, ShieldAlert, Database } from 'lucide-react';
import { toast } from 'sonner';

type Scope = { kind: 'own' } | { kind: 'company'; companyId: string } | { kind: 'all' };

export function BackupSection() {
  const { profile, session } = useAuth();
  const { isSuperadmin, role } = usePermissions();
  const canUse = ['admin', 'diretor', 'superadmin'].includes(role);
  const [busy, setBusy] = useState<null | 'own' | 'company' | 'all'>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>('');

  const { data: companies = [] } = useQuery({
    queryKey: ['backup-companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isSuperadmin,
  });

  if (!canUse) return null;

  async function runBackup(scope: Scope, busyKind: 'own' | 'company' | 'all') {
    setBusy(busyKind);
    try {
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      const body: Record<string, unknown> = {};
      if (scope.kind === 'company') body.companyId = scope.companyId;
      if (scope.kind === 'all') body.scope = 'all';

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-database`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Falha (${res.status}): ${txt.slice(0, 200)}`);
      }

      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `aura-backup-${Date.now()}.sql`;

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      toast.success('Backup gerado com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar backup');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Backup do Banco de Dados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Gera um arquivo <code className="text-xs bg-muted px-1 py-0.5 rounded">.sql</code> restaurável com todos
            os dados da empresa (cotações, embarques, clientes, taxas, financeiro, etc.). Use para migrar para outro
            sistema ou como cópia de segurança.
          </p>
          <p>
            Para restaurar em outro Postgres/Supabase:{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">psql &lt;conexao&gt; -f arquivo.sql</code>
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <strong>Atenção:</strong> o arquivo contém dados sensíveis. Armazene em local seguro e não compartilhe.
          </div>
        </div>

        {/* Own company backup */}
        {!isSuperadmin && (
          <Button
            onClick={() => runBackup({ kind: 'own' }, 'own')}
            disabled={busy !== null}
            className="gap-2"
          >
            {busy === 'own' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar backup completo (SQL)
          </Button>
        )}

        {/* Superadmin: per company + all */}
        {isSuperadmin && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="space-y-2">
              <div className="text-sm font-medium">Backup por empresa</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="sm:w-80">
                    <SelectValue placeholder="Selecionar empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => runBackup({ kind: 'company', companyId: selectedCompany }, 'company')}
                  disabled={busy !== null || !selectedCompany}
                  className="gap-2"
                >
                  {busy === 'company' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Baixar backup desta empresa
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Backup global</div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={busy !== null} className="gap-2">
                    {busy === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Baixar backup de TODAS as empresas
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Gerar backup completo de todas as empresas?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso pode demorar alguns minutos e gerar um arquivo grande. O arquivo conterá dados de todas as{' '}
                      {companies.length} empresas da plataforma. Confirme apenas se você tem permissão para lidar com
                      esses dados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => runBackup({ kind: 'all' }, 'all')}>
                      Gerar backup
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}