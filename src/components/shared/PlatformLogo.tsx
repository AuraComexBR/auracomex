import { Anchor } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { cn } from '@/lib/utils';

interface PlatformLogoProps {
  className?: string;
  iconClassName?: string;
  size?: number;
  alt?: string;
  /**
   * 'light' (default) usa o logo padrão (para fundos claros).
   * 'dark' usa o logo em versão clara/branca (para fundos escuros). Fallback para o padrão se não houver.
   */
  variant?: 'light' | 'dark';
}

/**
 * Exibe o logo global da plataforma (definido pelo superadmin).
 * Fallback: ícone Anchor em quadrado com bg primary.
 * NÃO usar dentro de contextos de empresa cliente (usar o logo da própria empresa).
 */
export function PlatformLogo({ className, iconClassName, size = 48, alt = 'Logo', variant = 'light' }: PlatformLogoProps) {
  const { data: platformSettings } = usePlatformSettings();
  const logoUrl = variant === 'dark'
    ? (platformSettings?.logo_dark_url || platformSettings?.logo_url)
    : platformSettings?.logo_url;

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={alt}
        className={cn('object-contain shrink-0 max-w-none', className)}
        style={{ height: size, width: 'auto' }}
      />
    );
  }

  return (
    <div
      className={cn('flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <Anchor className={cn('w-7 h-7', iconClassName)} />
    </div>
  );
}