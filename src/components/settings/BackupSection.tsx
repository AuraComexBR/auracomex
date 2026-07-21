import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ShieldAlert, Database } from 'lucide-react';
import { toast } from 'sonner';

// Cada empresa só pode gerar backup da própria base. A opção de escolher outra
// empresa ou baixar o backup de TODAS foi removida daqui de propósito — essa
// página é escopada à empresa logada. Um painel de superadmin separado (se um dia
// existir) é o lugar certo para operações entre empresas, não aqui.

export function BackupSection() {
  const { session } = useAuth();
  const { role } = usePermissions();
  const canUse = ['admin', 'diretor', 'superadmin'].includes(role);
  const [busy, setBusy] = useState(false);

  if (!canUse) return null;

  async function runBackup() {
    setBusy(true);
    try {
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-database`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
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
      setBusy(false);
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

        <Button onClick={runBackup} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Baixar backup completo (SQL)
        </Button>
      </CardContent>
    </Card>
  );
}