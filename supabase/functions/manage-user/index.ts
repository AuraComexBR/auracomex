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
    const isSuperadmin = callerRole?.role === "superadmin";
    const isCompanyAdmin = callerRole?.role === "admin";
    if (!isSuperadmin && !isCompanyAdmin) {
      return new Response(JSON.stringify({ error: "Permissões insuficientes" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as "list_status" | "toggle_active";

    // Ensure target users belong to caller's company (for admins)
    async function assertSameCompany(userIds: string[]) {
      if (isSuperadmin) return true;
      const { data: callerProfile } = await adminClient
        .from("profiles").select("company_id").eq("user_id", caller.id).single();
      if (!callerProfile) return false;
      const { data: targets } = await adminClient
        .from("profiles").select("user_id, company_id").in("user_id", userIds);
      return (targets || []).every((t) => t.company_id === callerProfile.company_id);
    }

    if (action === "list_status") {
      const userIds: string[] = body.user_ids || [];
      if (userIds.length === 0) {
        return new Response(JSON.stringify({ statuses: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!(await assertSameCompany(userIds))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const statuses: Record<string, boolean> = {};
      for (const uid of userIds) {
        const { data } = await adminClient.auth.admin.getUserById(uid);
        const bannedUntil = (data?.user as any)?.banned_until;
        const isActive = !bannedUntil || new Date(bannedUntil) <= new Date();
        statuses[uid] = isActive;
      }
      return new Response(JSON.stringify({ statuses }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_active") {
      const userId: string = body.user_id;
      const active: boolean = !!body.active;
      if (!userId) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (userId === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode desativar a si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!(await assertSameCompany([userId]))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: targetRole } = await adminClient
        .from("user_roles").select("role").eq("user_id", userId).single();
      if (targetRole?.role === "superadmin") {
        return new Response(JSON.stringify({ error: "Não é permitido alterar superadmin" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: active ? "none" : "876000h",
      } as any);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, active }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});