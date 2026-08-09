import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Integração com o Portal Único Siscomex (PUCOMEX) — DIFERENTE da
 * integração já existente com o Serpro Integra Comex (company_siscomex_configs
 * / função siscomex-gateway, produto pago separado). Aqui usamos a "Chave de
 * Acesso" (Client-Id/Client-Secret) que cada empresa gera com o próprio
 * certificado digital dentro do Portal Único — nunca uma credencial
 * compartilhada entre empresas/tenants do AuraComex.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { action, company_id, client_id, client_secret, role_type, certificate_path, certificate_password } = body as any;

    if (!company_id) {
      return jsonResponse({ success: false, error: "company_id é obrigatório" }, 400);
    }

    // Só grava configuração aqui (sem chamada de rede) — a autenticação real
    // no Portal Único exige TLS mútuo (certificado cliente na conexão), e o
    // runtime do Supabase Edge Function (Deno Deploy) não suporta isso.
    // Confirmado com teste real: "received fatal alert: HandshakeFailure".
    // A chamada de teste/consulta de verdade mora em api/portalunico/*.ts,
    // rodando como função serverless Node.js no Vercel.
    if (action === "save_config") {
      if (!client_id || !client_secret) {
        return jsonResponse({ success: false, error: "client_id e client_secret são obrigatórios" }, 400);
      }

      const { error } = await adminClient
        .from("company_portalunico_configs")
        .upsert(
          {
            company_id,
            client_id,
            client_secret,
            role_type: role_type || "IMPEXP",
            certificate_path: certificate_path ?? undefined,
            certificate_password: certificate_password ?? undefined,
            is_active: true,
          },
          { onConflict: "company_id" },
        );

      if (error) throw error;
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: "Ação inválida" }, 400);
  } catch (err) {
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Erro interno" }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
