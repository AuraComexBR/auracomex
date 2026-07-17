import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, KeyRound, Smartphone, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { changePasswordSchema, totpCodeSchema } from '@/lib/schemas';
import { format } from 'date-fns';

export function SecuritySection() {
  return (
    <div className="space-y-6">
      <ChangePasswordCard />
      <TwoFactorCard />
      <AccessHistoryCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsed = changePasswordSchema.safeParse({ newPassword, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha atualizada');
      setNewPassword('');
      setConfirm('');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao atualizar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <CardTitle>Alterar senha</CardTitle>
        </div>
        <CardDescription>
          Use uma senha forte com no mínimo 8 caracteres, maiúsculas, minúsculas e números.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirmar</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !newPassword}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Atualizar senha
        </Button>
      </CardContent>
    </Card>
  );
}

function TwoFactorCard() {
  const qc = useQueryClient();
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const { data: factors, refetch } = useQuery({
    queryKey: ['mfa-factors'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });

  const verified = factors?.totp?.find((f) => f.status === 'verified');

  async function startEnroll() {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `TOTP ${Date.now()}`,
      });
      if (error) throw error;
      setFactorId(data.id);
      setOtpauthUrl(data.totp.uri);
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: data.id });
      if (chErr) throw chErr;
      setChallengeId(ch.id);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao iniciar 2FA');
      setEnrolling(false);
    }
  }

  async function confirmEnroll() {
    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!factorId || !challengeId) return;
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });
      if (error) throw error;
      toast.success('2FA ativado');
      setEnrolling(false);
      setFactorId(null);
      setChallengeId(null);
      setOtpauthUrl(null);
      setCode('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Código inválido');
    }
  }

  async function removeFactor(id: string) {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      toast.success('2FA removido');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          <CardTitle>Autenticação em dois fatores (2FA)</CardTitle>
        </div>
        <CardDescription>
          Adicione uma camada extra usando um app autenticador (Google Authenticator, 1Password, Authy).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verified ? (
          <div className="flex items-center justify-between p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <div>
                <div className="font-medium text-sm">2FA ativo</div>
                <div className="text-xs text-muted-foreground">{verified.friendly_name || 'TOTP'}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeFactor(verified.id)}>
              Remover
            </Button>
          </div>
        ) : !enrolling ? (
          <Button onClick={startEnroll}>Ativar 2FA</Button>
        ) : (
          <div className="space-y-3">
            {otpauthUrl && (
              <div className="flex flex-col items-center gap-3 p-4 rounded-md bg-white">
                <QRCodeSVG value={otpauthUrl} size={180} />
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Escaneie com seu app autenticador e digite o código de 6 dígitos abaixo.
                </p>
              </div>
            )}
            <div className="space-y-2 max-w-xs">
              <Label>Código de 6 dígitos</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                className="font-mono text-center tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmEnroll} disabled={code.length !== 6}>Confirmar</Button>
              <Button variant="ghost" onClick={() => { setEnrolling(false); setFactorId(null); setChallengeId(null); setOtpauthUrl(null); setCode(''); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccessHistoryCard() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['access-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_logs' as any)
        .select('id, ip, user_agent, city, country, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <CardTitle>Histórico de acessos</CardTitle>
        </div>
        <CardDescription>Últimos 20 acessos registrados na sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem registros ainda.</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="flex items-start justify-between text-xs p-2 rounded-md border border-border/50 bg-muted/20">
                <div className="space-y-0.5">
                  <div className="font-medium">
                    {[l.city, l.country].filter(Boolean).join(', ') || 'Local desconhecido'}
                  </div>
                  <div className="text-muted-foreground font-mono">{l.ip || '—'}</div>
                  <div className="text-muted-foreground truncate max-w-xs">{l.user_agent || '—'}</div>
                </div>
                <div className="text-muted-foreground whitespace-nowrap ml-3">
                  {format(new Date(l.created_at), 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}