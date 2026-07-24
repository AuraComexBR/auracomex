// Consulta CNPJ no servidor (não no navegador do usuário), pra evitar dois
// problemas do lookup direto pelo frontend:
//   1. A ReceitaWS bloqueia CORS pra chamadas vindas de um navegador no
//      plano gratuito, então um fallback feito no cliente nunca funciona.
//   2. A BrasilAPI (proxy pra Receita Federal) às vezes fica lenta/instável;
//      rodando a consulta no servidor conseguimos retry com mais tempo sem
//      travar a experiência do usuário.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LookupResult = { name: string; email: string; phone: string; address: string };

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function buildAddress(d: any): string {
  return [
    d.logradouro,
    d.numero,
    d.complemento,
    d.bairro,
    d.municipio ? `${d.municipio}/${d.uf}` : "",
    d.cep,
  ].filter(Boolean).join(", ");
}

async function tryBrasilApi(cnpj: string): Promise<LookupResult | "not_found" | null> {
  const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, 12000);
  if (res.status === 404) return "not_found";
  if (!res.ok) throw new Error(`BrasilAPI HTTP ${res.status}`);
  const data = await res.json();
  return {
    name: data.razao_social || data.nome_fantasia || "",
    email: data.email || "",
    phone: data.ddd_telefone_1
      ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}`
      : "",
    address: buildAddress(data),
  };
}

async function tryReceitaWs(cnpj: string): Promise<LookupResult | "not_found" | null> {
  const res = await fetchWithTimeout(`https://receitaws.com.br/v1/cnpj/${cnpj}`, 12000);
  if (!res.ok) throw new Error(`ReceitaWS HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === "ERROR") return "not_found";
  return {
    name: data.nome || data.fantasia || "",
    email: data.email || "",
    phone: data.telefone || "",
    address: buildAddress(data),
  };
}

// API pública da CNPJá (open.cnpja.com) — gratuita, sem cadastro/chave,
// limitada a 5 consultas/minuto por IP. Usada como terceira tentativa,
// já que o limite baixo faz mais sentido guardar pra quando as outras
// duas falharem.
async function tryCnpja(cnpj: string): Promise<LookupResult | "not_found" | null> {
  const res = await fetchWithTimeout(`https://open.cnpja.com/office/${cnpj}`, 12000);
  if (res.status === 404) return "not_found";
  if (!res.ok) throw new Error(`CNPJa HTTP ${res.status}`);
  const data = await res.json();
  const addr = data.address || {};
  const address = [
    addr.street,
    addr.number,
    addr.details,
    addr.district,
    addr.city && addr.state ? `${addr.city}/${addr.state}` : "",
    addr.zip,
  ].filter(Boolean).join(", ");
  const phone = Array.isArray(data.phones) && data.phones[0]
    ? `(${data.phones[0].area}) ${data.phones[0].number}`
    : "";
  const email = Array.isArray(data.emails) && data.emails[0] ? data.emails[0].address : "";
  return {
    name: data.company?.name || data.alias || "",
    email,
    phone,
    address,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    const clean = String(cnpj || "").replace(/\D/g, "");
    if (clean.length !== 14) {
      return json({ error: "CNPJ inválido" }, 400);
    }

    const providers = [tryBrasilApi, tryReceitaWs, tryCnpja];
    let lastError: unknown = null;
    for (const provider of providers) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await provider(clean);
          if (result === "not_found") {
            return json({ not_found: true });
          }
          if (result) {
            return json({ data: result });
          }
        } catch (err) {
          lastError = err;
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 800));
          }
        }
      }
    }

    console.error("lookup-cnpj: todos os provedores falharam", lastError);
    return json({ error: "Não foi possível consultar o CNPJ no momento" }, 502);
  } catch (err) {
    console.error("lookup-cnpj error", err);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
