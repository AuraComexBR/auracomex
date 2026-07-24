// Roda uma vez por dia (via pg_cron) e verifica documentos de clientes
// cadastrados com data de validade — quando faltam 7 dias ou menos pra
// vencer, manda um e-mail de alerta pro endereço de alertas configurado
// nas Configurações da empresa (companies.document_alert_email).
// Cada documento só gera um alerta (reminder_sent_at evita reenvio).
import { createClient } from "npm:@supabase/supabase-js@2";

const REMINDER_DAYS = 7;

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c
  ));
}

function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const claims = parseJwtClaims(authHeader.slice("Bearer ".length).trim());
  if (claims?.role !== "service_role") {
    return json({ error: "Forbidden" }, 403);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + REMINDER_DAYS);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: docs, error } = await supabase
    .from("documents")
    .select("id, name, expires_at, company_id, clients(name), companies(document_alert_email)")
    .not("client_id", "is", null)
    .is("reminder_sent_at", null)
    .gte("expires_at", todayStr)
    .lte("expires_at", cutoffStr);

  if (error) {
    console.error("check-expiring-documents: query failed", error);
    return json({ error: error.message }, 500);
  }

  let enqueued = 0;
  for (const doc of docs || []) {
    const alertEmail = (doc as any).companies?.document_alert_email;
    if (!alertEmail) continue; // empresa não configurou e-mail de alertas ainda

    const clientName = (doc as any).clients?.name || "";
    const html = `
      <p>O documento <strong>${escapeHtml(doc.name)}</strong>${clientName ? ` de <strong>${escapeHtml(clientName)}</strong>` : ""} vence em <strong>${formatDateBr(doc.expires_at as string)}</strong>.</p>
      <p>Acesse o Aura Comex para renovar ou atualizar esse documento antes do vencimento.</p>
    `.trim();

    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: alertEmail,
        subject: `Documento vencendo em breve: ${doc.name}`,
        html,
        label: "document_expiring",
        message_id: crypto.randomUUID(),
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("check-expiring-documents: enqueue failed", doc.id, enqueueError);
      continue;
    }

    await supabase
      .from("documents")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", doc.id);
    enqueued++;
  }

  return json({ checked: docs?.length || 0, enqueued });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
