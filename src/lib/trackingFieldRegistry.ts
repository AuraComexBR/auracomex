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
 * FASE 1: campos de Logística e Empresas — os mesmos que a TrackingV2 já
 * exibia antes desse controle existir.
 * FASE 2 (atual): campos de Resumo da Carga (grupo `cargo`) — vêm da tabela
 * `quote_items` (não de `shipments`), ligada pelo `quotes.shipment_id`; um
 * embarque pode ter mais de um item de carga. O campo `notes` (observações)
 * de `quote_items` fica de fora de propósito — é texto livre normalmente
 * usado pra anotação interna, nunca exposto ao portal do cliente.
 * FASE 3 (atual): em vez de expor campos crus de Taxas/Estimativa, essa fase
 * só libera 4 PDFs já gerados no processo (Cotação/Estimativa/Numerário/
 * Prestação de Contas — grupo `documents`, ligados por `documents.custom_category`
 * usando os valores em `TRACKING_DOC_CATEGORY_MAP` abaixo) e um valor único
 * calculado: o total do Numerário (`numerario_total`, coluna
 * `cost_estimates.numerario_total_usd`, persistida ao salvar a aba Estimativa
 * — ver CostEstimateTab.tsx). Nenhum outro campo de Taxas/Estimativa é
 * exposto aqui (segue valendo o cuidado de nunca expor `buy_amount`).
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

export type TrackingFieldGroup = 'logistics' | 'partners' | 'cargo' | 'documents';

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
  cargo: 'Resumo da Carga',
  documents: 'Documentos',
};

export const TRACKING_FIELD_GROUP_ORDER: TrackingFieldGroup[] = ['logistics', 'partners', 'cargo', 'documents'];

/** Valor de `documents.custom_category` usado pra marcar cada um dos 4 PDFs
 *  gerados no processo — permite filtrar sem depender do nome do arquivo.
 *  Espelhado em CADA componente que gera esses PDFs (QuotePdfPreviewDialog,
 *  EstimatePdfDialog nos dois modos, AccountabilityPdfDialog) e na edge
 *  function `tracking` (FIELD_COLUMN_MAP não serve aqui — ver DOC_CATEGORY_MAP lá). */
export const TRACKING_DOC_CATEGORY_MAP: Record<string, string> = {
  doc_quote_pdf: 'tracking:quote_pdf',
  doc_estimate_pdf: 'tracking:estimate_pdf',
  doc_numerario_pdf: 'tracking:numerario_pdf',
  doc_accountability_pdf: 'tracking:accountability_pdf',
};

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

  // ===== Resumo da Carga (quote_items, por item) =====
  { key: 'cargo_container_type', label: 'Tipo de Container', group: 'cargo', hint: 'Tipo e quantidade por item.' },
  { key: 'cargo_weight', label: 'Peso (kg)', group: 'cargo' },
  { key: 'cargo_volume', label: 'Cubagem (m³)', group: 'cargo' },
  { key: 'cargo_chargeable_weight', label: 'Peso Taxável', group: 'cargo', hint: 'Calculado para aéreo/LCL.' },
  { key: 'cargo_dimensions', label: 'Dimensões (C x L x A)', group: 'cargo' },
  { key: 'cargo_packages', label: 'Volumes', group: 'cargo' },
  { key: 'cargo_commodity', label: 'Mercadoria', group: 'cargo' },
  { key: 'cargo_dangerous_goods', label: 'Carga Perigosa (IMO)', group: 'cargo' },
  { key: 'cargo_vehicle_type', label: 'Tipo de Veículo', group: 'cargo', hint: 'Só modal rodoviário.' },
  { key: 'cargo_ncm', label: 'NCM', group: 'cargo', hint: 'Classificação fiscal — avaliar antes de liberar.' },
  { key: 'cargo_value', label: 'Valor da Carga', group: 'cargo', hint: 'Valor comercial declarado da mercadoria.' },

  // ===== Documentos (PDFs do processo + 1 valor calculado) =====
  { key: 'doc_quote_pdf', label: 'PDF da Cotação', group: 'documents' },
  { key: 'doc_estimate_pdf', label: 'PDF da Estimativa', group: 'documents' },
  { key: 'doc_numerario_pdf', label: 'PDF Numerário', group: 'documents' },
  { key: 'doc_accountability_pdf', label: 'PDF Prestação de Contas', group: 'documents' },
  { key: 'numerario_total', label: 'Valor Estimado (Numerário)', group: 'documents', hint: 'Impostos + AFRMM + desembaraço/armazenagem destino + frete/seguro não-prepaid — valor a depositar, sem o valor da mercadoria.' },
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
