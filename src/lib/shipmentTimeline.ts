import { STATUS_CATEGORY_ORDER, STATUS_CATEGORY_LABELS, resolveStatusCategory, type StatusOption } from './shipmentStatusCategory';

export type StepState = 'done' | 'current' | 'pending';

export interface TimelineStep {
  key: string;
  label: string;
  date?: string | null;
  hint?: string;
  state: StepState;
}

export interface TimelineKpis {
  transitTime: number | null;
  daysInTransit: number | null;
  daysRemaining: number | null;
  isDelayed: boolean;
  arrivingSoon: boolean;
  isCancelled: boolean;
  isFinished: boolean;
}

function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// A linha do tempo não é mais amarrada a uma lista fixa de status: qualquer
// status (inclusive personalizados cadastrados em Logística > Gerenciar
// Status) pertence a uma das 5 categorias genéricas (booking/origin/transit/
// customs/delivered), e é essa categoria que decide qual marco acende. Isso
// evita que embarques com status como "financeiro" ou "lançar_di" fiquem
// com a linha do tempo inteira "pendente" só por não bater com um valor
// específico esperado.
export function buildTimeline(shipment: any, statusOptions: StatusOption[] = []): { steps: TimelineStep[]; kpis: TimelineKpis } {
  const status: string = shipment.status || 'approved';
  const category = resolveStatusCategory(status, statusOptions);
  const isCancelled = category === 'cancelled';
  const isFinished = category === 'delivered';

  const today = startOfDay(new Date());
  const etd = shipment.etd ? new Date(shipment.etd) : null;
  const eta = shipment.eta ? new Date(shipment.eta) : null;
  const atd = shipment.atd ? new Date(shipment.atd) : null;
  const ata = shipment.ata ? new Date(shipment.ata) : null;

  const transitTime = etd && eta ? diffDays(eta, etd) : null;
  const daysInTransit =
    category === 'transit' && (atd || etd)
      ? Math.max(0, diffDays(today, atd || etd!))
      : null;
  const daysRemaining = eta && !isFinished ? diffDays(eta, today) : null;
  const isDelayed = !!eta && !isFinished && !isCancelled && today > startOfDay(eta);
  const arrivingSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3 && !isFinished;

  const currentIdx = isCancelled ? -1 : STATUS_CATEGORY_ORDER.indexOf(category as any);

  const rawSteps: Array<Omit<TimelineStep, 'state'> & { categoryKey: typeof STATUS_CATEGORY_ORDER[number] }> = [
    { key: 'booking', categoryKey: 'booking', label: STATUS_CATEGORY_LABELS.booking, date: shipment.created_at },
    { key: 'origin', categoryKey: 'origin', label: STATUS_CATEGORY_LABELS.origin, hint: shipment.booking_number || undefined },
    { key: 'transit', categoryKey: 'transit', label: STATUS_CATEGORY_LABELS.transit, date: atd?.toISOString() || etd?.toISOString() || null, hint: shipment.vessel_flight || undefined },
    { key: 'customs', categoryKey: 'customs', label: STATUS_CATEGORY_LABELS.customs, date: ata?.toISOString() || eta?.toISOString() || null },
    { key: 'delivered', categoryKey: 'delivered', label: STATUS_CATEGORY_LABELS.delivered, date: null },
  ];

  const steps: TimelineStep[] = rawSteps.map((s, idx) => {
    let state: StepState = 'pending';
    if (isCancelled) {
      state = idx === 0 ? 'done' : 'pending';
    } else if (currentIdx === -1) {
      state = 'pending';
    } else if (idx < currentIdx) {
      state = 'done';
    } else if (idx === currentIdx) {
      state = isFinished && s.categoryKey === 'delivered' ? 'done' : 'current';
    }
    return { key: s.key, label: s.label, date: s.date, hint: s.hint, state };
  });

  return {
    steps,
    kpis: { transitTime, daysInTransit, daysRemaining, isDelayed, arrivingSoon, isCancelled, isFinished },
  };
}
