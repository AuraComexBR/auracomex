import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Recebe as notificações PUSH de eventos da DUIMP enviadas pelo Portal
 * Único Siscomex (docs.portalunico.siscomex.gov.br/pages/webhooks/).
 *
 * NÃO precisa de certificado nem de JWT do Supabase pra receber — é o
 * Portal Único batendo direto nessa URL pública. A autenticidade da
 * notificação é validada pelo header `secret`, que foi gerado por nós e
 * enviado no momento da assinatura (api/portalunico/subscribe-webhook.ts),
 * e comparado com o que está salvo em company_portalunico_configs — cada
 * empresa tem o seu próprio, então isso também garante o isolamento
 * multi-tenant (o evento só pode atualizar embarques da empresa dona
 * daquele secret).
 *
 * Eventos tratados (todos com o mesmo formato-base): dimp-situacao-import,
 * dimp-registro-import, dimp-retifica-import, dimp-diag-import.
 * Ver: docs.portalunico.siscomex.gov.br/pages/duimp_eventos_intervenientes_privados/
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, secret, authorization, event-type, destinatario-tipo, destinatario-id",
};

const CANAL_MAP: Record<string, string> = {
  VERDE: "green",
  AMARELO: "yellow",
  VERMELHO: "red",
  CINZA: "gray",
};

// Situações que indicam que a DUIMP já passou do registro inicial —
// primeira vez que vemos uma dessas, gravamos customs_registration_date.
const SITUACOES_REGISTRADA = new Set([
  "REGISTRADA_AGUARDANDO_CANAL",
  "EM_CONFERENCIA_SELECIONADA",
  "DESEMBARACADA_AGUARDANDO_PENDENCIA_TRIBUTOS_ESTADUAIS",
  "DESEMBARACADA_AGUARDANDO_ENTREGA_CARGA",
  "DESEMBARACADA_CARGA_ENTREGUE",
  "ENTREGA_ANTECIPADA_AGUARDANDO_PENDENCIA_TRIBUTOS_ESTADUAIS",
  "ENTREGA_ANTECIPADA_AGUARDANDO_ENTREGA_CARGA",
  "ENTREGA_ANTECIPADA_CARGA_ENTREGUE",
]);

const SITUACOES_ENTREGUE = new Set([
  "DESEMBARACADA_CARGA_ENTREGUE",
  "ENTREGA_ANTECIPADA_CARGA_ENTREGUE",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secret = req.headers.get("secret");
    const eventType = req.headers.get("event-type") || "desconhecido";

    if (!secret) {
      // Sem secret não dá pra saber de qual empresa é — descarta.
      return jsonResponse({ received: false, error: "header 'secret' ausente" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: config, error: configError } = await supabase
      .from("company_portalunico_configs")
      .select("id, company_id")
      .eq("webhook_secret", secret)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) {
      // Secret desconhecido — pode ser assinatura antiga/revogada. Não
      // vaza informação, só descarta.
      return jsonResponse({ received: false, error: "secret não reconhecido" }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return jsonResponse({ received: true }, 200);
    }

    const numero: string | undefined = body?.identificacao?.numero;
    const versao: number | undefined = body?.identificacao?.versao != null ? Number(body.identificacao.versao) : undefined;
    const situacaoDuimp: string | undefined = body?.situacaoDuimp;
    const canalRaw: string | undefined = body?.canal;
    const message: string | undefined = body?.message;
    const dataEvento: string | undefined = body?.dataEvento;
    const eventDate = dataEvento ? new Date(dataEvento) : new Date();

    await supabase
      .from("company_portalunico_configs")
      .update({ webhook_last_event_at: new Date().toISOString() })
      .eq("id", config.id);

    if (!numero) {
      // Evento sem número de DUIMP identificável — só registra que chegou.
      return jsonResponse({ received: true, matched: false }, 200);
    }

    const { data: shipmentsFound, error: shipmentsError } = await supabase
      .from("shipments")
      .select("id, customs_channel, customs_registration_date, cargo_delivered_at")
      .eq("company_id", config.company_id)
      .eq("duimp_number", numero);

    if (shipmentsError) throw shipmentsError;

    if (!shipmentsFound || shipmentsFound.length === 0) {
      // DUIMP ainda não foi vinculada a nenhum embarque cadastrado — nada
      // pra atualizar, mas não é erro.
      return jsonResponse({ received: true, matched: false }, 200);
    }

    for (const shipment of shipmentsFound) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (versao != null) updates.duimp_version = versao;
      if (canalRaw && CANAL_MAP[canalRaw]) updates.customs_channel = CANAL_MAP[canalRaw];
      if (situacaoDuimp && SITUACOES_REGISTRADA.has(situacaoDuimp) && !shipment.customs_registration_date) {
        updates.customs_registration_date = eventDate.toISOString();
      }
      if (situacaoDuimp && SITUACOES_ENTREGUE.has(situacaoDuimp) && !shipment.cargo_delivered_at) {
        updates.cargo_delivered_at = eventDate.toISOString();
      }

      const { error: updateError } = await supabase
        .from("shipments")
        .update(updates)
        .eq("id", shipment.id);
      if (updateError) throw updateError;

      // Entra automaticamente no Diário do Processo, já visível no
      // tracking do cliente — é exatamente o mesmo mecanismo da aba
      // "Diário" que já existe, só que alimentado pelo Portal Único em
      // vez de alguém digitar manualmente.
      const { error: eventError } = await supabase.from("shipment_events").insert({
        shipment_id: shipment.id,
        company_id: config.company_id,
        event_date: eventDate.toISOString(),
        category: "customs",
        note: message || `Atualização da DUIMP ${numero} (${eventType})`,
        visible_tracking: true,
      });
      if (eventError) throw eventError;
    }

    return jsonResponse({ received: true, matched: true, shipments: shipmentsFound.length }, 200);
  } catch (err) {
    console.error("portalunico-webhook error", err);
    return jsonResponse({ received: false, error: err instanceof Error ? err.message : "Erro interno" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
