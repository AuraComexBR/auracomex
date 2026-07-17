import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRole } = await adminClient
      .from("user_roles").select("role").eq("user_id", caller.id).single();

    const body = await req.json();
    const { email, full_name, company_id, role, department, redirect_to } = body;

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: email, full_name, role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperadmin = callerRole?.role === "superadmin";
    const isCompanyAdmin = callerRole?.role === "admin";

    if (!isSuperadmin && !isCompanyAdmin) {
      return new Response(JSON.stringify({ error: "Permissões insuficientes" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetCompanyId = company_id;

    if (isCompanyAdmin && !isSuperadmin) {
      const { data: callerProfile } = await adminClient
        .from("profiles").select("company_id").eq("user_id", caller.id).single();
      if (!callerProfile) {
        return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetCompanyId = callerProfile.company_id;
      if (role === "superadmin" || role === "admin") {
        return new Response(JSON.stringify({ error: "Não é permitido atribuir este cargo" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!targetCompanyId) {
      return new Response(JSON.stringify({ error: "company_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirect_to || undefined,
      data: {
        full_name,
        company_id: targetCompanyId,
        role,
        department: department || null,
        must_change_password: "false",
        invited: "true",
      },
    });

    if (inviteError) {
      const status = /already|registered|exists/i.test(inviteError.message) ? 409 : 400;
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user: invited.user, invited: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});