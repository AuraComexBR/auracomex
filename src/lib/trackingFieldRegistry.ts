/**
 * Registro central dos campos configuráveis do Portal de Tracking (cliente).
 *
 * Cada empresa decide, POR CLIENTE, quais campos aparecem na visão colapsada
 * (linha resumo da lista) e quais aparecem na visão expandida (detalhe ao
 * clicar) — configurado em Cadastros > Clientes > "Tracking" (só disponível
 * pra registros do tipo `client`). Guardado em `clients.tracking_field_visibility`
 * como `{ collapsed: string[], expanded: string[] }`, usando as chaves (`key`)
 * definidas aqui.
 *
 * FASE 1 (atual): campos de Logística e Empresas — os mesmos que a TrackingV2
 * já exibia antes desse controle existir. Resumo da Carga, Taxas e Estimativa
 * ficam pra próximas fases (a de Taxas precisa de cuidado extra: nunca expor
 * `buy_amount`, que é custo/margem interna, nem que seja por engano — por
 * isso não existe ali um campo genérico "valor", só "valor de venda").
 *
 * IMPORTANTE: a edge function `tracking` (supabase/functions/tracking/index.ts)
 * roda em runtime Deno separado e não importa este arquivo — ela mantém uma
 * cópia da mesma lista de chaves→colunas (ver `FIELD_COLUMN_MAP` lá). Se
 * adicionar/remover/renomear uma chave aqui, espelhar lá também.
 *
 * Por padrão (novo cliente, ou cliente que nunca foi configurado), as duas
 * listas vêm vazias — nada aparece no tracking até a empresa revisar e
 * marcar explicitamente o que aquele cliente pode ver.
 */

export type TrackingFieldGroup = 'logistics' | 'partners';

export interface TrackingFieldDef {
  key: string;
  label: string;
  group: TrackingFieldGroup;
  /** Breve nota de contexto, exibida como ajuda na tela de configuração. */
  hint?: string;
}

export const TRACKING_FIELD_GROUP_LABELS: Record<TrackingFieldGroup, string> = {
  logistics: 'Logística',
  partners: 'Empresas',
};

export const TRACKING_FIELD_GROUP_ORDER: TrackingFieldGroup[] = ['logistics', 'partners'];

export const TRACKING_FIELD_REGISTRY: TrackingFieldDef[] = [
  // ===== Logística =====
  { key: 'client_reference', label: 'Ref. do Cliente', group: 'logistics' },
  { key: 'invoice_number', label: 'Invoice', group: 'logistics' },
  { key: 'free_time', label: 'Free Time', group: 'logistics' },
  { key: 'transit_time_calc', label: 'Transit Time', group: 'logistics', hint: 'Calculado como ETA − ETD.' },
  { key: 'route', label: 'Origem e Destino', group: 'logistics', hint: 'Cidade/porto de origem e destino, e transbordo se houver.' },
  { key: 'vessel_flight', label: 'Navio / Voo', group: 'logistics' },
  { key: 'booking_number', label: 'Booking', group: 'logistics' },
  { key: 'bl', label: 'BL (Master / House)', group: 'logistics' },
  { key: 'ce_mercante', label: 'CE Mercante', group: 'logistics' },
  { key: 'etd', label: 'ETD', group: 'logistics', hint: 'Mostra ATD (real) quando existir; senão a estimativa.' },
  { key: 'eta', label: 'ETA', group: 'logistics', hint: 'Mostra ATA (real) quando existir; senão a estimativa.' },
  { key: 'incoterm', label: 'Incoterm', group: 'logistics' },
  { key: 'transport_mode', label: 'Modal', group: 'logistics' },
  { key: 'courier', label: 'Courier (aéreo)', group: 'logistics', hint: 'Transportadora e número de rastreio courier.' },
  { key: 'customs_channel', label: 'Canal (parametrização)', group: 'logistics' },
  { key: 'duimp_number', label: 'Número DUIMP', group: 'logistics' },
  { key: 'physical_location', label: 'Físico (localização da carga)', group: 'logistics' },
  { key: 'customs_registration_date', label: 'Registro DI', group: 'logistics' },
  { key: 'cargo_delivered_at', label: 'Carga Entregue', group: 'logistics' },
  { key: 'invoice_sent_at', label: 'Faturamento Enviado', group: 'logistics' },
  { key: 'container_numbers', label: 'Número(s) do Container', group: 'logistics' },
  { key: 'container_seals', label: 'Lacre(s) do Container', group: 'logistics' },
  { key: 'container_terminal_entry', label: 'Entrada no Terminal (por container)', group: 'logistics' },
  { key: 'container_return', label: 'Devolvido em (por container)', group: 'logistics' },
  { key: 'demurrage_deadline_calc', label: 'Limite Devolução', group: 'logistics', hint: 'Calculado: Entrada no Terminal + FreeTime.' },
  { key: 'storage_deadline_calc', label: '1º Período de Armazenagem', group: 'logistics', hint: 'Calculado: Entrada no Terminal + 10 dias.' },
  { key: 'next_update', label: 'Próxima Atualização', group: 'logistics' },

  // ===== Empresas =====
  { key: 'shipper_name', label: 'Shipper', group: 'partners' },
  { key: 'carrier', label: 'Armador / Cia', group: 'partners' },
];

export interface TrackingFieldVisibility {
  collapsed: string[];
  expanded: string[];
}

export const EMPTY_TRACKING_FIELD_VISIBILITY: TrackingFieldVisibility = { collapsed: [], expanded: [] };

export function normalizeTrackingFieldVisibility(raw: unknown): TrackingFieldVisibility {
  const v = (raw || {}) as Partial<TrackingFieldVisibility>;
  return {
    collapsed: Array.isArray(v.collapsed) ? v.collapsed.filter((k): k is string => typeof k === 'string') : [],
    expanded: Array.isArray(v.expanded) ? v.expanded.filter((k): k is string => typeof k === 'string') : [],
  };
}
