import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, ExternalLink, FileCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  companyId: string;
}

/**
 * O client do Supabase, ao receber um status non-2xx de uma Edge Function,
 * joga fora o corpo da resposta e só expõe uma mensagem genérica
 * ("Edge Function returned a non-2xx status code") no `error.message`. O
 * corpo de verdade (com a mensagem detalhada que a função devolveu, ex. o
 * erro real do Portal Único) fica em `error.context`, que é a Response
 * crua — precisa ser lido manualmente.
 */
async function extractFunctionErrorMessage(error: any): Promise<string> {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const body = await error.context.clone().json();
      if (body?.error) return body.error as string;
    }
  } catch {
    // corpo não era JSON ou já foi consumido — cai no fallback abaixo
  }
  return error?.message || 'Erro desconhecido';
}

/**
 * Cada empresa cadastra AQUI sua própria credencial do Portal Único
 * Siscomex — nunca compartilhada entre empresas/tenants do AuraComex.
 *
 * A autenticação real do Portal Único exige TLS mútuo (o certificado
 * digital A1 sendo apresentado na própria conexão) — a Chave de Acesso
 * (Client-Id/Client-Secret) sozinha não basta, confirmado via teste real
 * (handshake TLS falha sem o certificado). Por isso o certificado é
 * obrigatório aqui, guardado no bucket privado `company-certificates`
 * (isolado por empresa via RLS) e usado pela função serverless Node.js do
 * Vercel (api/portalunico/*.ts) — o runtime do Supabase Edge Function não
 * suporta apresentar certificado cliente numa conexão TLS.
 */
export function PortalUnicoConfigWizard({ companyId }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['company-portalunico-config', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('company_portalunico_configs') as any)
        .select('client_id, role_type, is_active, certificate_path, last_tested_at, last_test_success')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      toast.error('Selecione um arquivo de certificado (.pfx ou .p12)');
      return;
    }
    setCertificateFile(file);
  }

  async function handleSave() {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error('Informe o Client-Id e o Client-Secret gerados no Portal Único');
      return;
    }
    if (!config?.certificate_path && (!certificateFile || !certificatePassword.trim())) {
      toast.error('O certificado digital (.pfx/.p12) e a senha são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      let certificatePath: string | undefined;
      if (certificateFile) {
        const fileExt = certificateFile.name.split('.').pop();
        certificatePath = `${companyId}/portalunico_cert_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('company-certificates')
          .upload(certificatePath, certificateFile, { upsert: true });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase.functions.invoke('portalunico-gateway', {
        body: {
          action: 'save_config',
          company_id: companyId,
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          certificate_path: certificatePath,
          certificate_password: certificatePassword.trim() || undefined,
        },
      });
      if (error) throw new Error(await extractFunctionErrorMessage(error));
      if (!data?.success) throw new Error(data?.error || 'Falha ao salvar credenciais');
      toast.success('Credenciais do Portal Único salvas.');
      setClientSecret('');
      setCertificateFile(null);
      setCertificatePassword('');
      queryClient.invalidateQueries({ queryKey: ['company-portalunico-config', companyId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const response = await fetch('/api/portalunico/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        toast.error(data?.error || `Falha ao autenticar no Portal Único (status ${response.status})`);
      } else {
        toast.success(data.message || 'Conexão validada com sucesso.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao chamar a função de teste');
    } finally {
      setTesting(false);
      queryClient.invalidateQueries({ queryKey: ['company-portalunico-config', companyId] });
    }
  }

  return (
    <Card className="glass">
      <CardContent className="pt-6 space-y-4">
        <p className="text-xs text-muted-foreground">
          Gere a Chave de Acesso em{' '}
          <a
            href="https://portalunico.siscomex.gov.br/portal/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline inline-flex items-center gap-1"
          >
            Portal Único <ExternalLink className="w-3 h-3" />
          </a>
          {' '}→ Perfil do Usuário → Chaves de Acesso → Incluir (Tipo: Pessoa Física). O certificado
          digital (.pfx/.p12) é o mesmo que você usa pra acessar o Portal Único — cada empresa deve
          usar sua própria chave e certificado, nunca compartilhados entre contas.
        </p>

        {config?.client_id && (
          <div className="flex items-center gap-2 text-xs rounded-md border border-border px-3 py-2 flex-wrap">
            <span className="text-muted-foreground">Chave atual:</span>
            <span className="font-mono">{config.client_id.slice(0, 6)}…</span>
            {config.certificate_path && (
              <Badge variant="outline" className="gap-1"><FileCode className="w-3 h-3" /> Certificado cadastrado</Badge>
            )}
            {config.last_tested_at && (
              <span className="flex items-center gap-1 ml-auto">
                {config.last_test_success ? (
                  <Badge className="bg-green-500/10 text-green-600 gap-1"><CheckCircle2 className="w-3 h-3" /> Conectado</Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-600 gap-1"><XCircle className="w-3 h-3" /> Falhou</Badge>
                )}
                <span className="text-muted-foreground">{format(new Date(config.last_tested_at), 'dd/MM/yyyy HH:mm')}</span>
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Client-Id (Chave)</Label>
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Gerado no Portal Único" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Client-Secret (Senha)</Label>
            <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Gerado no Portal Único" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Certificado Digital (.pfx/.p12)</Label>
            <div
              className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileCode className={`h-6 w-6 ${certificateFile ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium text-center">
                {certificateFile ? certificateFile.name : config?.certificate_path ? 'Substituir certificado atual' : 'Clique para selecionar'}
              </span>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pfx,.p12" onChange={handleFileChange} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Senha do Certificado</Label>
            <Input
              type="password"
              value={certificatePassword}
              onChange={(e) => setCertificatePassword(e.target.value)}
              placeholder={config?.certificate_path ? 'Preencha se for substituir o certificado' : 'Senha do arquivo .pfx'}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !config?.client_id}>
            {testing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Testar Conexão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
