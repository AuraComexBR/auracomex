import { supabase } from '@/integrations/supabase/client';

export interface AuditChange {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

interface LogAuditChangesParams {
  /** Id da cotação — sempre presente, é o elo estável entre a fase de cotação e a de embarque. */
  quoteId?: string | null;
  /** Id do embarque — só existe depois da conversão. */
  shipmentId?: string | null;
  companyId: string;
  userId?: string | null;
  changes: AuditChange[];
}

/**
 * Registra alterações no histórico unificado da referência (cotação + embarque).
 * Usa a mesma tabela shipment_audit_log, mas gravando quote_id sempre que
 * disponível — isso é o que permite consultar o histórico completo de uma
 * referência (em qualquer fase) com uma única query por quote_id.
 */
export async function logAuditChanges({ quoteId, shipmentId, companyId, userId, changes }: LogAuditChangesParams) {
  if (!changes.length || !companyId) return;
  if (!quoteId && !shipmentId) return;
  try {
    const { error } = await (supabase.from('shipment_audit_log') as any).insert(
      changes.map((c) => ({
        ...c,
        quote_id: quoteId || null,
        shipment_id: shipmentId || null,
        company_id: companyId,
        user_id: userId || null,
      }))
    );
    if (error) console.error('[auditLog] falha ao gravar histórico:', error);
  } catch (err) {
    // Histórico é best-effort: uma falha aqui não deve interromper o fluxo principal de salvar.
    console.error('[auditLog] falha ao gravar histórico:', err);
  }
}

/** Atalho para registrar um único evento (ex.: "Taxa adicionada", "Status alterado"). */
export async function logAuditEvent(params: LogAuditChangesParams extends infer P
  ? Omit<P, 'changes'> & { field_name: string; old_value?: string | null; new_value?: string | null }
  : never) {
  const { field_name, old_value, new_value, ...rest } = params as any;
  await logAuditChanges({ ...rest, changes: [{ field_name, old_value: old_value ?? null, new_value: new_value ?? null }] });
}

// ---- Leitura/exibição do histórico ----
// Nomes de campo compartilhados entre HistoryPanel (cotação+embarque) e
// ActivityTab (embarque avulso), pra não duplicar a lista em dois lugares.
export const AUDIT_FIELD_LABELS: Record<string, Record<'pt' | 'en', string>> = {
  // Geral
  client_id: { pt: 'Cliente', en: 'Client' },
  origin: { pt: 'Origem', en: 'Origin' },
  destination: { pt: 'Destino', en: 'Destination' },
  transport_mode: { pt: 'Modal', en: 'Transport Mode' },
  incoterm: { pt: 'Incoterm', en: 'Incoterm' },
  valid_until: { pt: 'Validade da Cotação', en: 'Valid Until' },
  status: { pt: 'Status', en: 'Status' },
  cargo_summary: { pt: 'Resumo da Carga', en: 'Cargo Summary' },
  charge: { pt: 'Taxa', en: 'Charge' },
  partner: { pt: 'Parceiro', en: 'Partner' },
  debit_note: { pt: 'Debit Note', en: 'Debit Note' },
  estimate: { pt: 'Estimativa', en: 'Estimate' },
  conversion: { pt: 'Conversão', en: 'Conversion' },
  // Logística
  origin_city: { pt: 'Cidade Origem', en: 'Origin City' },
  origin_country: { pt: 'País Origem', en: 'Origin Country' },
  origin_port: { pt: 'Porto Origem', en: 'Origin Port' },
  destination_city: { pt: 'Cidade Destino', en: 'Destination City' },
  destination_country: { pt: 'País Destino', en: 'Destination Country' },
  destination_port: { pt: 'Porto Destino', en: 'Destination Port' },
  carrier: { pt: 'Transportadora', en: 'Carrier' },
  vessel_flight: { pt: 'Navio/Voo', en: 'Vessel/Flight' },
  booking_number: { pt: 'Booking', en: 'Booking #' },
  container_number: { pt: 'Container', en: 'Container #' },
  weight_kg: { pt: 'Peso (kg)', en: 'Weight (kg)' },
  volume_cbm: { pt: 'Volume (m³)', en: 'Volume (cbm)' },
  packages: { pt: 'Volumes', en: 'Packages' },
  cargo_description: { pt: 'Carga', en: 'Cargo' },
  etd: { pt: 'ETD', en: 'ETD' },
  eta: { pt: 'ETA', en: 'ETA' },
};

export function getAuditFieldLabel(field: string, language: 'pt' | 'en') {
  return AUDIT_FIELD_LABELS[field]?.[language] || field;
}

/**
 * Monta a frase legível de uma alteração do histórico, tipo:
 * "alterou Status de "Rascunho" para "Reservado"" — o nome de quem fez
 * a mudança é prefixado por quem renderiza (o componente já sabe o nome).
 */
export function formatAuditSentence(
  log: { field_name: string; old_value: string | null; new_value: string | null },
  language: 'pt' | 'en'
): string {
  const field = getAuditFieldLabel(log.field_name, language);
  const oldV = log.old_value?.trim();
  const newV = log.new_value?.trim();

  if (language === 'en') {
    if (oldV && newV) return `changed ${field} from "${oldV}" to "${newV}"`;
    if (!oldV && newV) return `set ${field} to "${newV}"`;
    if (oldV && !newV) return `cleared ${field} (was "${oldV}")`;
    return `updated ${field}`;
  }

  if (oldV && newV) return `alterou ${field} de "${oldV}" para "${newV}"`;
  if (!oldV && newV) return `definiu ${field} como "${newV}"`;
  if (oldV && !newV) return `removeu ${field} (era "${oldV}")`;
  return `atualizou ${field}`;
}
