import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useHasAddon, ADDON_META, type AddonKey } from '@/hooks/useSubscription';

interface Props {
  addon: AddonKey;
  children: ReactNode;
  /** Renderiza apenas quando não tem acesso (usa fallback vazio ao invés de card) */
  silent?: boolean;
}

export function ModuleGate({ addon, children, silent }: Props) {
  const hasAccess = useHasAddon(addon);
  if (hasAccess) return <>{children}</>;
  if (silent) return null;

  const meta = ADDON_META[addon];
  return (
    <Card className="glass border-dashed">
      <CardContent className="p-8 text-center flex flex-col items-center gap-3">
        <div className="rounded-full bg-primary/10 p-3">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">{meta.label}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{meta.description}</p>
        <p className="text-xs text-muted-foreground">
          Este recurso faz parte de um add-on que não está ativo no seu plano.
        </p>
        <Button asChild className="mt-2">
          <Link to="/settings#assinatura">
            <Sparkles className="w-4 h-4 mr-2" />
            Fazer upgrade
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Hook helper para casos onde queremos apenas desabilitar botões inline. */
export function useAddonGate(addon: AddonKey) {
  const hasAccess = useHasAddon(addon);
  return {
    hasAccess,
    lockedTitle: hasAccess ? undefined : `Add-on necessário: ${ADDON_META[addon].label}`,
  };
}