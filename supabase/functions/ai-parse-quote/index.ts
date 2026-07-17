import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um assistente especialista em comércio exterior (freight forwarding).
Receberá imagens/PDFs de Commercial Invoice e/ou Packing List.
Extraia os dados estruturados para preencher uma nova cotação logística.
Regras:
- Use SEMPRE códigos ISO 3166-1 alpha-2 para país (ex: BR, CN, US, DE).
- Incoterm em letras maiúsculas (EXW, FCA, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP).
- Currency em ISO (USD, EUR, BRL, CNY).
- direction: "IMP" se o destino for Brasil e a origem outro país; "EXP" se origem Brasil e destino outro; senão melhor estimativa.
- transport_mode_guess: "ocean_fcl" | "ocean_lcl" | "air" | "road". Se peso baixo (<1000kg) e valor alto, geralmente "air". Se total CBM < 15 e marítimo, "ocean_lcl". Senão "ocean_fcl".
- Não invente dados ausentes; deixe vazio quando não souber.
- Combine informações do Invoice e do Packing List (peso, volume, etc.).`;

interface ExtractedItem {
  commodity: string;
  ncm_code?: string;
  specification?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  total_amount?: number;
  weight_kg?: number;
  volume_cbm?: number;
  packages?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const files: { name: string; mime: string; base64: string }[] = body?.files || [];
    if (!Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (files.length > 4) {
      return new Response(JSON.stringify({ error: "Máximo 4 arquivos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build multimodal content
    const userContent: any[] = [
      { type: "text", text: "Extraia os dados dos documentos abaixo e chame a função extract_quote." },
    ];
    for (const f of files) {
      const dataUrl = `data:${f.mime};base64,${f.base64}`;
      if (f.mime === "application/pdf") {
        userContent.push({
          type: "file",
          file: { filename: f.name, file_data: dataUrl },
        });
      } else {
        userContent.push({ type: "image_url", image_url: { url: dataUrl } });
      }
    }

    const tool = {
      type: "function",
      function: {
        name: "extract_quote",
        description: "Retorna os dados estruturados extraídos dos documentos para criar uma cotação.",
        parameters: {
          type: "object",
          properties: {
            shipper_name: { type: "string" },
            shipper_country: { type: "string", description: "ISO alpha-2" },
            shipper_address: { type: "string" },
            shipper_tax_id: { type: "string" },
            consignee_name: { type: "string" },
            consignee_country: { type: "string", description: "ISO alpha-2" },
            consignee_address: { type: "string" },
            consignee_tax_id: { type: "string" },
            invoice_number: { type: "string" },
            invoice_date: { type: "string", description: "YYYY-MM-DD se possível" },
            incoterm: { type: "string" },
            origin_port: { type: "string" },
            destination_port: { type: "string" },
            currency: { type: "string" },
            transport_mode_guess: { type: "string", enum: ["ocean_fcl", "ocean_lcl", "air", "road"] },
            direction: { type: "string", enum: ["IMP", "EXP"] },
            total_amount: { type: "number" },
            total_weight_kg: { type: "number" },
            total_volume_cbm: { type: "number" },
            total_packages: { type: "number" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  commodity: { type: "string" },
                  ncm_code: { type: "string" },
                  specification: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                  unit_price: { type: "number" },
                  total_amount: { type: "number" },
                  weight_kg: { type: "number" },
                  volume_cbm: { type: "number" },
                  packages: { type: "number" },
                },
                required: ["commodity"],
              },
            },
          },
          required: ["transport_mode_guess", "direction", "currency", "items"],
        },
      },
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extract_quote" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha ao processar com IA" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: extracted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-parse-quote error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});