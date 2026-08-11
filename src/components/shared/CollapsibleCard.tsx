import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerExtra?: React.ReactNode;
  contentClassName?: string;
}

/** Card colapsável reutilizável — usado nas abas Logística/Geral do embarque
 * (aba Geral mesclada na Logística após "virar embarque") pra permitir
 * expandir/colapsar cada bloco de campos independentemente. */
export function CollapsibleCard({ title, children, defaultOpen = false, headerExtra, contentClassName }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="glass">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between py-3 cursor-pointer select-none">
            <CardTitle className="text-sm">{title}</CardTitle>
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => headerExtra && e.stopPropagation()}>
              {headerExtra}
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className={cn('pt-0 space-y-4', contentClassName)}>
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
