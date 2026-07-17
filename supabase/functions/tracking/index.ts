import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

      const expectedPin = (client.tax_id || "").replace(/\D/g, "").substring(0, 4);
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

      const activeStatuses = ["approved", "booked", "in_transit"];
      const finishedStatuses = ["arrived", "delivered"];
      const statuses = filter === "active" ? activeStatuses : finishedStatuses;

      const { data } = await adminClient
        .from("shipments")
        .select("id, reference_number, status, transport_mode, incoterm, origin_city, origin_country, origin_port, destination_city, destination_country, destination_port, etd, eta, atd, ata, carrier, vessel_flight, booking_number, master_bl, house_bl, container_number, next_update, courier_provider, courier_tracking_number")
        .eq("client_id", client_id)
        .in("status", statuses)
        .order("created_at", { ascending: false });

      return jsonResponse({ shipments: data || [] });
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

    if (action === "documents") {
      if (shipment_ids && shipment_ids.length > 0) {
        const { data } = await adminClient
          .from("documents")
          .select("id, name, file_url, shipment_id, quote_id")
          .in("shipment_id", shipment_ids)
          .eq("visible_tracking", true);
        return jsonResponse({ documents: data || [] });
      }

      if (quote_ids && quote_ids.length > 0) {
        const { data } = await adminClient
          .from("documents")
          .select("id, name, file_url, shipment_id, quote_id")
          .in("quote_id", quote_ids)
          .eq("visible_tracking", true);
        return jsonResponse({ documents: data || [] });
      }

      return jsonResponse({ documents: [] });
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
