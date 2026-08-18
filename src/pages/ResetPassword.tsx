import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlatformLogo } from '@/components/shared/PlatformLogo';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    // Check if we have a recovery session from the URL hash (implicit flow)
    const hash = window.location.hash;
    const hasRecoveryHash = hash.includes('type=recovery');
    if (hasRecoveryHash) {
      setReady(true);
    }

    // PKCE flow: the link redirects with ?code=... in the query string. The Supabase
    // client already starts exchanging that code for a session (detectSessionInUrl) as
    // soon as the module is imported — before this effect runs and registers the
    // PASSWORD_RECOVERY listener below. If the exchange finishes first, the event is
    // missed and `ready` never becomes true even for a valid, unused link. When there's
    // any sign of a recovery flow (hash or ?code=), check getSession() directly to cover
    // that race, in addition to keeping the listener for the case where the exchange
    // completes after mount.
    const hasRecoveryCode = new URLSearchParams(window.location.search).has('code');
    if (hasRecoveryHash || hasRecoveryCode) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true);
        }
      });
    }

    // Also listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t('auth.passwords_no_match'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t('auth.password_updated'));
      navigate('/');
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
            <CardTitle className="text-xl">{t('auth.new_password')}</CardTitle>
            <CardDescription>{t('auth.new_password_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <p className="text-center text-muted-foreground">{t('auth.invalid_recovery_link')}</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('auth.new_password')}</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('auth.confirm_password')}</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '...' : t('auth.update_password')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
