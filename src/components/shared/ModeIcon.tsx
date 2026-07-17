import { Ship, Plane, Truck, Combine } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const icons: Record<string, typeof Ship> = {
  ocean_fcl: Ship,
  ocean_lcl: Ship,
  air: Plane,
  road: Truck,
  multimodal: Combine,
};

export function ModeIcon({ mode, showLabel = false }: { mode: string; showLabel?: boolean }) {
  const { t } = useLanguage();
  const Icon = icons[mode] || Ship;
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Icon className="w-4 h-4" />
      {showLabel && <span className="text-xs">{t(`mode.${mode}`)}</span>}
    </span>
  );
}
