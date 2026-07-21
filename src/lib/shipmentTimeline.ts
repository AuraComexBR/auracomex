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

const STATUS_ORDER = ['approved', 'booked', 'collected_at_origin', 'docs_at_origin', 'in_transit', 'arrived', 'delivered'] as const;

function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function buildTimeline(shipment: any): { steps: TimelineStep[]; kpis: TimelineKpis } {
  const status: string = shipment.status || 'approved';
  const isCancelled = status === 'cancelled';
  const isFinished = status === 'delivered' || status === 'arrived';

  const today = startOfDay(new Date());
  const etd = shipment.etd ? new Date(shipment.etd) : null;
  const eta = shipment.eta ? new Date(shipment.eta) : null;
  const atd = shipment.atd ? new Date(shipment.atd) : null;
  const ata = shipment.ata ? new Date(shipment.ata) : null;

  const transitTime = etd && eta ? diffDays(eta, etd) : null;
  const daysInTransit =
    (status === 'in_transit') && (atd || etd)
      ? Math.max(0, diffDays(today, atd || etd!))
      : null;
  const daysRemaining = eta && !isFinished ? diffDays(eta, today) : null;
  const isDelayed = !!eta && !isFinished && !isCancelled && today > startOfDay(eta);
  const arrivingSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3 && !isFinished;

  const currentIdx = STATUS_ORDER.indexOf(status as any);

  const rawSteps: Array<Omit<TimelineStep, 'state'> & { statusKey: typeof STATUS_ORDER[number] }> = [
    { key: 'approved', statusKey: 'approved', label: 'Aprovado', date: shipment.created_at },
    { key: 'booked', statusKey: 'booked', label: 'Reservado', hint: shipment.booking_number || undefined },
    { key: 'collected_at_origin', statusKey: 'collected_at_origin', label: 'Coletado', date: null },
    { key: 'docs_at_origin', statusKey: 'docs_at_origin', label: 'Docs', date: null },
    { key: 'in_transit', statusKey: 'in_transit', label: 'Embarcado', date: atd?.toISOString() || etd?.toISOString() || null, hint: shipment.vessel_flight || undefined },
    { key: 'arrived', statusKey: 'arrived', label: 'Chegou', date: ata?.toISOString() || eta?.toISOString() || null },
    { key: 'delivered', statusKey: 'delivered', label: 'Entregue', date: null },
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
      state = isFinished && s.statusKey === 'delivered' ? 'done' : 'current';
    }
    return { key: s.key, label: s.label, date: s.date, hint: s.hint, state };
  });

  return {
    steps,
    kpis: { transitTime, daysInTransit, daysRemaining, isDelayed, arrivingSoon, isCancelled, isFinished },
  };
}