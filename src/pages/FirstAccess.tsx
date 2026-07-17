import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { PlatformLogo } from '@/components/shared/PlatformLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export default function FirstAccess() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Detect invite flow (Supabase sends #type=invite in URL hash)
  const isInvite = typeof window !== 'undefined' && window.location.hash.includes('type=invite');
  const invitedMeta = (user?.user_metadata as any)?.invited === 'true' || (user?.user_metadata as any)?.invited === true;
  const isInviteFlow = isInvite || invitedMeta;

  if (!user) return <Navigate to="/" replace />;
  if (profile && !profile.must_change_password && !isInviteFlow) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwords_dont_match') || 'As senhas não coincidem');
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('auth.password_too_short') || 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { invited: false },
      });
      if (pwError) throw pwError;

      // Update profile to mark password changed
      const { error: profError } = await supabase
        .from('profiles')
        .update({ must_change_password: false } as any)
        .eq('user_id', user!.id);
      if (profError) throw profError;

      toast.success(t('auth.password_changed') || 'Senha alterada com sucesso!');
      // Force reload to pick up the profile change
      window.location.href = '/';
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <PlatformLogo size={72} />
        </div>

        <Card className="glass">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <KeyRound className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-xl">
              {t('auth.change_password') || 'Alterar Senha'}
            </CardTitle>
            <CardDescription>
              {t('auth.first_access_desc') || 'Este é seu primeiro acesso. Por favor, defina uma nova senha.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('auth.new_password') || 'Nova Senha'}</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('auth.confirm_password') || 'Confirmar Senha'}</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (t('common.loading') || 'Salvando...') : (t('auth.change_password') || 'Alterar Senha')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
