import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Circle, X, Sparkles, ArrowRight, Rocket } from 'lucide-react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useProductTour } from './ProductTour';

export function OnboardingChecklist() {
  const { steps, doneCount, progress, dismissed, dismiss, isLoading } = useOnboarding();
  const { startTour } = useProductTour();

  if (isLoading || dismissed || doneCount === steps.length) return null;

  return (
    <Card className="glass border-primary/30" data-tour="checklist">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Primeiros passos no Aura</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {doneCount} de {steps.length} concluídos — vamos configurar sua conta
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={startTour} className="gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5" /> Fazer tour
            </Button>
            <Button variant="ghost" size="icon" onClick={dismiss} title="Dispensar">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-1.5">
          {steps.map((s) => (
            <li key={s.id}>
              <Link
                to={s.path}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  s.done ? 'opacity-60' : 'hover:bg-secondary/60'
                }`}
              >
                {s.done ? (
                  <div className="w-5 h-5 rounded-full bg-status-completed/20 text-status-completed flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${s.done ? 'line-through' : ''}`}>{s.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                </div>
                {!s.done && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}