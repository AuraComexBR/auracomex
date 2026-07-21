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
