import { resolveCountryCode } from '@/lib/countries';
import { cn } from '@/lib/utils';

interface FlagIconProps {
  /** Either a 2-letter ISO code or a legacy free-form country name. */
  country: string | null | undefined;
  className?: string;
}

/**
 * Renders a country flag as an actual SVG image (via the `flag-icons` CSS
 * classes) instead of an emoji. Emoji flags don't render on Windows/Chrome
 * (the OS font lacks flag glyphs), so this is the cross-platform-safe way
 * to show a flag.
 */
export function FlagIcon({ country, className }: FlagIconProps) {
  const code = resolveCountryCode(country || '').toLowerCase();
  if (!code) return null;
  return (
    <span
      className={cn('fi inline-block rounded-[2px] align-middle', `fi-${code}`, className)}
      title={country || undefined}
    />
  );
}
