import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function digits(s: string) {
  return (s || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  try {
    const body = await req.json();
    const companyName = String(body.companyName || "").trim();
    const cnpj = digits(String(body.cnpj || ""));
    const adminName = String(body.adminName || "").trim();
    const adminEmail = String(body.adminEmail || "").trim().toLowerCase();
    const password = String(body.password || "");
    const acceptedTerms = !!body.acceptedTerms;

    if (!companyName || companyName.length < 2) {
      return json({ error: "Nome da empresa inválido" }, 400);
    }
    if (cnpj.length !== 14) {
      return json({ error: "CNPJ deve conter 14 dígitos" }, 400);
    }
    if (!adminName || adminName.length < 2) {
      return json({ error: "Nome do administrador inválido" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return json({ error: "Email inválido" }, 400);
    }
    if (password.length < 8) {
      return json({ error: "Senha deve ter no mínimo 8 caracteres" }, 400);
    }
    if (!acceptedTerms) {
      return json({ error: "É necessário aceitar os termos" }, 400);
    }

    // Rate-limit: máx 5 tentativas / hora por IP
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("signup_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) {
      return json({ error: "Muitas tentativas. Tente novamente mais tarde." }, 429);
    }

    await admin.from("signup_attempts").insert({ ip, email: adminEmail, success: false });

    // CNPJ único
    const { data: existingCnpj } = await admin
      .from("companies")
      .select("id")
      .filter("cnpj", "not.is", null);
    if (existingCnpj?.some((c: any) => digits(c.cnpj || "") === cnpj)) {
      return json({ error: "Já existe uma empresa cadastrada com este CNPJ" }, 409);
    }

    // Cria a company (o trigger cria a subscription trial 14d)
    const { data: company, error: companyErr } = await admin
      .from("companies")
      .insert({ name: companyName, cnpj, email: adminEmail })
      .select("id, name")
      .single();
    if (companyErr || !company) throw companyErr || new Error("Falha ao criar empresa");

    // Cria o usuário admin
    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: adminName,
        company_id: company.id,
        role: "admin",
        must_change_password: "false",
      },
    });
    if (userErr || !created?.user) {
      // rollback: apaga a company
      await admin.from("companies").delete().eq("id", company.id);
      return json({ error: userErr?.message || "Falha ao criar usuário" }, 400);
    }

    await admin
      .from("signup_attempts")
      .update({ success: true })
      .eq("ip", ip)
      .eq("email", adminEmail)
      .gte("created_at", since);

    return json({ ok: true, companyId: company.id });
  } catch (err: any) {
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}