import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOCS_BUCKET = "shipment-documents";

/** Extrai o path do storage de uma URL pública/assinada antiga ou de um path cru. */
function extractDocPath(fileUrlOrPath: string | null | undefined): string {
  if (!fileUrlOrPath) return "";
  const value = String(fileUrlOrPath);
  for (const marker of [
    `/object/public/${DOCS_BUCKET}/`,
    `/object/sign/${DOCS_BUCKET}/`,
    `/${DOCS_BUCKET}/`,
  ]) {
    const i = value.indexOf(marker);
    if (i !== -1) return decodeURIComponent(value.slice(i + marker.length).split("?")[0]);
  }
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { action, tax_id, pin, client_id, filter, shipment_ids, quote_ids } = body as any;

    // Step 1: Lookup client by tax_id
    if (action === "lookup") {
      if (!tax_id || typeof tax_id !== "string") {
        return jsonResponse({ error: "tax_id is required" }, 400);
      }

      const cleanTaxId = tax_id.replace(/\D/g, "");
      if (cleanTaxId.length !== 11 && cleanTaxId.length !== 14) {
        return jsonResponse({ error: "Invalid tax_id (CPF ou CNPJ)" }, 400);
      }

      const { data: client, error } = await adminClient
        .from("clients")
        .select("id, name, company_id, tax_id")
        .eq("tax_id", cleanTaxId)
        .single();

      if (error || !client) {
        return jsonResponse({ error: "Client not found" }, 404);
      }

      // Only return minimal info - no PII
      return jsonResponse({ client_id: client.id, name: client.name, company_id: client.company_id });
    }

    // Step 2: Authenticate with PIN (first 4 digits of CNPJ)
    if (action === "auth") {
      if (!client_id || !pin) {
        return jsonResponse({ error: "client_id and pin are required" }, 400);
      }

      const { data: client } = await adminClient
        .from("clients")
        .select("tax_id")
        .eq("id", client_id)
        .single();

      if (!client) {
        return jsonResponse({ error: "Client not found" }, 404);
      }

      const expectedPin = (client.tax_id || "").replace(/\D/g, "").slice(-4);
      if (pin !== expectedPin) {
        return jsonResponse({ error: "Invalid PIN" }, 401);
      }

      // Return company info (minimal fields only)
      const { data: clientFull } = await adminClient
        .from("clients")
        .select("company_id")
        .eq("id", client_id)
        .single();

      const { data: company } = await adminClient
        .from("companies")
        .select("id, name, logo_url")
        .eq("id", clientFull!.company_id)
        .single();

      return jsonResponse({ authenticated: true, company });
    }

    // Step 3: Get tracking data (requires valid client_id)
    if (action === "shipments") {
      if (!client_id || !filter) {
        return jsonResponse({ error: "client_id and filter required" }, 400);
      }

      // O status do embarque não é mais um enum fixo — a empresa cadastra
      // status personalizados em Logística > Gerenciar Status (ex.:
      // "financeiro", "lançar_di", "aguard._nacionalização"). Uma lista fixa
      // de status "ativos" fazia qualquer status personalizado sumir do
      // tracking do cliente, em qualquer aba. Agora "Finalizado" é só o que
      // realmente terminou (arrived/delivered); "Em Andamento" é tudo que
      // não é finalizado, rascunho ou cancelado — cobre qualquer status
      // personalizado que a empresa venha a criar.
      const finishedStatuses = ["arrived", "delivered"];
      const excludedFromActive = [...finishedStatuses, "draft", "cancelled"];

      let query = adminClient
        .from("shipments")
        .select("id, reference_number, status, transport_mode, incoterm, origin_city, origin_country, origin_port, transshipment, destination_city, destination_country, destination_port, etd, eta, atd, ata, carrier, vessel_flight, booking_number, master_bl, house_bl, container_number, container_demurrage_deadlines, container_return_dates, next_update, courier_provider, courier_tracking_number, company_id, customs_channel, duimp_number, physical_location, customs_registration_date, terminal_entry_date, demurrage_deadline, storage_deadline, cargo_delivered_at, invoice_sent_at, client_reference, invoice_number, container_quantity, free_time, shipper_id")
        .eq("client_id", client_id);

      query = filter === "active"
        ? query.not("status", "in", `(${excludedFromActive.join(",")})`)
        : query.in("status", finishedStatuses);

      const { data: shipmentsData } = await query.order("created_at", { ascending: false });
      const shipments = shipmentsData || [];

      // Categoria de cada status (fixo ou personalizado) da empresa — orienta
      // a linha do tempo genérica de 5 marcos no front (Reservado/Origem/
      // Trânsito/Desembaraço/Entregue), já que não dá mais pra assumir uma
      // lista fixa de status.
      const companyId = shipments[0]?.company_id;
      let statusOptions: any[] = [];
      if (companyId) {
        const { data: opts } = await adminClient
          .from("shipment_status_options")
          .select("value, label, category")
          .eq("company_id", companyId)
          .order("position");
        statusOptions = opts || [];
      }

      // Referência do cliente agora também é gravada direto no embarque
      // (shipments.client_reference), espelhada da cotação de origem. Pra
      // embarques antigos que nunca passaram pela aba Logística depois desse
      // espelho existir, cai de volta pro valor da cotação (quotes.client_reference).
      const shipmentIds = shipments.map((s: any) => s.id);
      const refMap = new Map<string, string>();
      if (shipmentIds.length > 0) {
        const { data: qs } = await adminClient
          .from("quotes")
          .select("shipment_id, client_reference")
          .in("shipment_id", shipmentIds);
        for (const q of qs || []) {
          if (q.shipment_id && q.client_reference) refMap.set(q.shipment_id, q.client_reference);
        }
      }

      // Transbordo é salvo só como código de porto — resolve o nome pra
      // exibição em lote pelos códigos usados.
      const transshipCodes = [...new Set(shipments.map((s: any) => s.transshipment).filter(Boolean))];
      const portMap = new Map<string, { code: string; name: string; city: string | null; country_code: string }>();
      if (transshipCodes.length > 0) {
        const { data: ports } = await adminClient
          .from("ports")
          .select("code, name, city, country_code")
          .in("code", transshipCodes);
        for (const p of ports || []) portMap.set(p.code, p);
      }

      // Shipper (exportador/embarcador) é uma empresa cadastrada em "clients"
      // (mesma tabela usada pra parceiros do processo), referenciada por
      // shipments.shipper_id — resolve o nome em lote pros embarques que têm.
      const shipperIds = [...new Set(shipments.map((s: any) => s.shipper_id).filter(Boolean))];
      const shipperMap = new Map<string, string>();
      if (shipperIds.length > 0) {
        const { data: shippers } = await adminClient
          .from("clients")
          .select("id, name")
          .in("id", shipperIds);
        for (const sh of shippers || []) shipperMap.set(sh.id, sh.name);
      }

      const enrichedShipments = shipments.map((s: any) => ({
        ...s,
        client_reference: s.client_reference || refMap.get(s.id) || null,
        transshipment_info: s.transshipment ? (portMap.get(s.transshipment) || { code: s.transshipment, name: s.transshipment, city: null, country_code: "" }) : null,
        shipper_name: s.shipper_id ? (shipperMap.get(s.shipper_id) || null) : null,
      }));

      return jsonResponse({ shipments: enrichedShipments, status_options: statusOptions });
    }

    if (action === "quotes") {
      if (!client_id) {
        return jsonResponse({ error: "client_id required" }, 400);
      }

      const { data } = await adminClient
        .from("quotes")
        .select("id, quote_number, status, transport_mode, origin, destination, valid_until, created_at")
        .eq("client_id", client_id)
        .neq("status", "converted")
        .order("created_at", { ascending: false });

      return jsonResponse({ quotes: data || [] });
    }

    // Diário do processo — só as entradas marcadas como visíveis no
    // tracking (visible_tracking = true), mesmo padrão de "documents".
    if (action === "events") {
      if (!shipment_ids || shipment_ids.length === 0) {
        return jsonResponse({ events: [] });
      }

      const { data } = await adminClient
        .from("shipment_events")
        .select("id, shipment_id, event_date, category, note")
        .in("shipment_id", shipment_ids)
        .eq("visible_tracking", true)
        .order("event_date", { ascending: false });

      return jsonResponse({ events: data || [] });
    }

    if (action === "documents") {
      let docs: any[] = [];
      if (shipment_ids && shipment_ids.length > 0) {
        // Também inclui documentos da cotação que originou cada embarque
        // (docs anexados na fase de cotação ficam com quote_id e shipment_id nulo).
        const { data: linkedQuotes } = await adminClient
          .from("quotes")
          .select("id, shipment_id")
          .in("shipment_id", shipment_ids);

        const quoteToShipment = new Map<string, string>();
        for (const q of linkedQuotes || []) {
          if (q.id && q.shipment_id) quoteToShipment.set(q.id, q.shipment_id);
        }
        const linkedQuoteIds = [...quoteToShipment.keys()];

        const orParts = [`shipment_id.in.(${shipment_ids.join(",")})`];
        if (linkedQuoteIds.length > 0) {
          orParts.push(`quote_id.in.(${linkedQuoteIds.join(",")})`);
        }

        const { data } = await adminClient
          .from("documents")
          .select("id, name, file_url, shipment_id, quote_id, document_type, custom_category")
          .or(orParts.join(","))
          .eq("visible_tracking", true);

        // Normaliza: doc de cotação recebe o shipment_id do embarque (pro front agrupar)
        docs = (data || []).map((d: any) => ({
          ...d,
          shipment_id: d.shipment_id || (d.quote_id ? quoteToShipment.get(d.quote_id) : null),
        }));
      } else if (quote_ids && quote_ids.length > 0) {
        const { data } = await adminClient
          .from("documents")
          .select("id, name, file_url, shipment_id, quote_id, document_type, custom_category")
          .in("quote_id", quote_ids)
          .eq("visible_tracking", true);
        docs = data || [];
      }

      // Gera URLs assinadas (bucket privado). Cliente já validado por CNPJ+PIN.
      const signed = await Promise.all(
        docs.map(async (d) => {
          const path = extractDocPath(d.file_url);
          if (!path) return d;
          const { data: s } = await adminClient.storage
            .from("shipment-documents")
            .createSignedUrl(path, 60 * 60);
          return { ...d, file_url: s?.signedUrl || d.file_url };
        }),
      );

      return jsonResponse({ documents: signed });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
