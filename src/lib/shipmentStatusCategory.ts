// Categorias fixas que orientam a linha do tempo genérica do tracking do
// cliente. Cada status de embarque (fixo ou personalizado, cadastrado em
// Logística > Gerenciar Status) pertence a uma dessas categorias — é isso
// que permite montar uma linha do tempo de 5 marcos que funciona mesmo com
// status totalmente customizados pela empresa (ex.: "financeiro",
// "lançar_di", "dta").
export const STATUS_CATEGORY_ORDER = ['booking', 'origin', 'transit', 'customs', 'delivered'] as const;
export type StatusCategory = typeof STATUS_CATEGORY_ORDER[number] | 'cancelled';

export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  booking: 'Reservado',
  origin: 'Origem',
  transit: 'Trânsito',
  customs: 'Desembaraço',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const STATUS_CATEGORY_OPTIONS: { value: StatusCategory; label: string }[] = [
  ...STATUS_CATEGORY_ORDER.map((c) => ({ value: c, label: STATUS_CATEGORY_LABELS[c] })),
  { value: 'cancelled', label: STATUS_CATEGORY_LABELS.cancelled },
];

export const STATUS_CATEGORY_COLORS: Record<StatusCategory, string> = {
  booking: 'bg-indigo-500/10 text-indigo-600',
  origin: 'bg-blue-500/10 text-blue-600',
  transit: 'bg-amber-500/10 text-amber-600',
  customs: 'bg-purple-500/10 text-purple-600',
  delivered: 'bg-green-500/10 text-green-600',
  cancelled: 'bg-red-500/10 text-red-600',
};

export interface StatusOption {
  value: string;
  label: string;
  category?: string;
  position?: number;
}

// Status padrão usados quando a empresa ainda não personalizou nada em
// Gerenciar Status (mesma lista de LogisticsTab.tsx, agora com categoria).
export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { label: 'Aprovado', value: 'approved', position: 0, category: 'booking' },
  { label: 'Atracou', value: 'arrived', position: 1, category: 'customs' },
  { label: 'Cancelado', value: 'cancelled', position: 2, category: 'cancelled' },
  { label: 'Coletado', value: 'collected_at_origin', position: 3, category: 'origin' },
  { label: 'Docs', value: 'docs_at_origin', position: 4, category: 'origin' },
  { label: 'Entregue', value: 'delivered', position: 5, category: 'delivered' },
  { label: 'Reservado', value: 'booked', position: 6, category: 'booking' },
  { label: 'Trânsito', value: 'in_transit', position: 7, category: 'transit' },
];

/** Resolve a categoria de um status: usa a categoria cadastrada, senão cai no padrão 'transit'. */
export function resolveStatusCategory(status: string, statusOptions: StatusOption[]): StatusCategory {
  const found = statusOptions.find((o) => o.value === status);
  const category = found?.category;
  if (category && (STATUS_CATEGORY_ORDER as readonly string[]).includes(category)) return category as StatusCategory;
  if (category === 'cancelled') return 'cancelled';
  return 'transit';
}
