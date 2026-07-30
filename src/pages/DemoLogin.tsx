import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Credenciais do usuário técnico "Aura Demo" — empresa fictícia com dados fake,
// resetados automaticamente todo início de hora (função reset_demo_data no Supabase).
// Não há dado real de cliente nenhum aqui; a senha não precisa ser secreta.
const DEMO_EMAIL = 'demo@auracomex.app';
const DEMO_PASSWORD = 'AuraDemo!Visita2026#xk9';

export default function DemoLogin() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (attempted.current || loading) return;
    attempted.current = true;

    signIn(DEMO_EMAIL, DEMO_PASSWORD).then(({ error }) => {
      if (error) {
        setError('Não foi possível entrar no ambiente de demonstração agora. Tente novamente em instantes.');
      } else {
        navigate('/dashboard', { replace: true });
      }
    });
  }, [user, loading, signIn, navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-background px-4">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <p className="text-destructive font-medium mb-2">{error}</p>
            <button
              className="text-sm text-primary underline"
              onClick={() => { attempted.current = false; setError(null); }}
            >
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <div className="animate-pulse text-muted-foreground mb-2">Preparando seu ambiente de demonstração...</div>
            <p className="text-xs text-muted-foreground">
              Você está entrando com dados fictícios, só para conhecer o Aura. Nada aqui é real.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
