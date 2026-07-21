import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "content-disposition",
};

// Tables exported, in dependency order.
// Each entry: [tableName, filterColumn|null]
// filterColumn = column used to scope by company; null = not company-scoped
// (used for auxiliary tables that follow via FKs — e.g. quote_items scoped by quote_id).
const COMPANY_TABLES: Array<[string, string | null]> = [
  ["companies", "id"],
  ["company_subscriptions", "company_id"],
  ["company_addons", "company_id"],
  ["company_bank_accounts", "company_id"],
  ["company_siscomex_configs", "company_id"],
  ["profiles", "company_id"],
  // user_roles handled separately (no company_id column)
  ["clients", "company_id"],
  ["ports", "company_id"],
  ["charge_catalog", "company_id"],
  ["shipment_status_options", "company_id"],
  ["overhead_categories", "company_id"],
  ["overhead_expenses", "company_id"],
  ["overhead_entries", "company_id"],
  ["quotes", "company_id"],
  ["quote_items", null], // via quote_id
  ["quote_charges", null],
  ["quote_partners", null],
  ["quote_comments", null],
  ["cost_estimates", "company_id"],
  ["cost_estimate_items", null],
  ["cost_estimate_expenses", null],
  ["shipments", "company_id"],
  ["shipment_partners", null],
  ["shipment_audit_log", null],
  ["documents", "company_id"],
  ["tasks", "company_id"],
  ["charges", "company_id"],
  ["charge_lines", null],
  ["accounts_payable", "company_id"],
  ["accounts_receivable", "company_id"],
  ["debit_notes", "company_id"],
  ["debit_note_items", null],
  ["notifications", "company_id"],
  ["support_tickets", "company_id"],
  ["support_ticket_messages", null],
  ["activity_log", "company_id"],
];

// For each auxiliary table (filterColumn=null), how to fetch it for a company.
const AUX_FETCHERS: Record<
  string,
  (admin: any, companyId: string | null) => Promise<any[]>
> = {
  quote_items: async (admin, companyId) => fetchByParent(admin, "quote_items", "quote_id", "quotes", companyId),
  quote_charges: async (admin, companyId) => fetchByParent(admin, "quote_charges", "quote_id", "quotes", companyId),
  quote_partners: async (admin, companyId) => fetchByParent(admin, "quote_partners", "quote_id", "quotes", companyId),
  quote_comments: async (admin, companyId) => fetchByParent(admin, "quote_comments", "quote_id", "quotes", companyId),
  cost_estimate_items: async (admin, companyId) =>
    fetchByParent(admin, "cost_estimate_items", "cost_estimate_id", "cost_estimates", companyId),
  cost_estimate_expenses: async (admin, companyId) =>
    fetchByParent(admin, "cost_estimate_expenses", "cost_estimate_id", "cost_estimates", companyId),
  shipment_partners: async (admin, companyId) =>
    fetchByParent(admin, "shipment_partners", "shipment_id", "shipments", companyId),
  shipment_audit_log: async (admin, companyId) =>
    fetchByParent(admin, "shipment_audit_log", "shipment_id", "shipments", companyId),
  charge_lines: async (admin, companyId) => fetchByParent(admin, "charge_lines", "charge_id", "charges", companyId),
  debit_note_items: async (admin, companyId) =>
    fetchByParent(admin, "debit_note_items", "debit_note_id", "debit_notes", companyId),
  support_ticket_messages: async (admin, companyId) =>
    fetchByParent(admin, "support_ticket_messages", "ticket_id", "support_tickets", companyId),
};

async function fetchByParent(
  admin: any,
  table: string,
  fk: string,
  parentTable: string,
  companyId: string | null,
): Promise<any[]> {
  let parentQ = admin.from(parentTable).select("id");
  if (companyId) parentQ = parentQ.eq("company_id", companyId);
  const { data: parents, error: pErr } = await parentQ;
  if (pErr) throw pErr;
  const ids = (parents ?? []).map((p: any) => p.id);
  if (ids.length === 0) return [];
  // Chunk to avoid IN () limit
  const chunks: string[][] = [];
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const rows: any[] = [];
  for (const c of chunks) {
    const { data, error } = await admin.from(table).select("*").in(fk, c);
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

function sqlLiteral(v: any): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "NULL";
    return String(v);
  }
  if (Array.isArray(v)) {
    // Try to detect element type; default to text
    const inner = v.map((el) => {
      if (el === null || el === undefined) return "NULL";
      if (typeof el === "number") return String(el);
      return `'${String(el).replace(/'/g, "''")}'`;
    });
    return `ARRAY[${inner.join(",")}]`;
  }
  if (typeof v === "object") {
    // jsonb / json
    const s = JSON.stringify(v).replace(/'/g, "''");
    return `'${s}'::jsonb`;
  }
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function buildInserts(table: string, rows: any[]): string {
  if (!rows || rows.length === 0) {
    return `-- ${table}: 0 rows\n`;
  }
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const lines: string[] = [`-- ${table}: ${rows.length} rows`];
  for (const row of rows) {
    const values = cols.map((c) => sqlLiteral(row[c])).join(", ");
    lines.push(
      `INSERT INTO public."${table}" (${colList}) VALUES (${values}) ON CONFLICT (id) DO NOTHING;`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function dumpCompany(
  admin: any,
  companyId: string | null,
  companyName: string,
): Promise<string> {
  const parts: string[] = [];
  parts.push(
    `-- === COMPANY: ${companyName} (${companyId ?? "ALL"}) ===\n`,
  );

  for (const [table, filterCol] of COMPANY_TABLES) {
    let rows: any[] = [];
    try {
      if (filterCol === null) {
        const fetcher = AUX_FETCHERS[table];
        if (!fetcher) continue;
        rows = await fetcher(admin, companyId);
      } else {
        let q = admin.from(table).select("*");
        if (companyId) q = q.eq(filterCol, companyId);
        const { data, error } = await q;
        if (error) throw error;
        rows = data ?? [];
      }
      parts.push(buildInserts(table, rows));
    } catch (err: any) {
      parts.push(`-- ERROR dumping ${table}: ${err.message}\n`);
    }
  }

  // user_roles: get profile user_ids for this company, then their roles
  try {
    let profQ = admin.from("profiles").select("user_id");
    if (companyId) profQ = profQ.eq("company_id", companyId);
    const { data: profs } = await profQ;
    const userIds = (profs ?? []).map((p: any) => p.user_id);
    if (userIds.length > 0) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("*")
        .in("user_id", userIds);
      parts.push(buildInserts("user_roles", roles ?? []));
    } else {
      parts.push(`-- user_roles: 0 rows\n`);
    }
  } catch (err: any) {
    parts.push(`-- ERROR dumping user_roles: ${err.message}\n`);
  }

  return parts.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();
    const role = roleRow?.role;
    const allowed = ["admin", "diretor", "superadmin"];
    if (!role || !allowed.includes(role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Backup é sempre escopado à própria empresa do usuário logado — inclusive para
    // superadmin. Não aceita mais companyId/scope=all vindos do corpo da requisição
    // (essa opção existia antes pra permitir baixar backup de qualquer empresa ou de
    // todas de uma vez direto da tela de Configurações, o que foi removido de propósito).
    const scope: "company" = "company";
    let targetCompanyId: string | null = null;

    {
      const { data: prof } = await admin
        .from("profiles")
        .select("company_id")
        .eq("user_id", caller.id)
        .single();
      if (!prof?.company_id) {
        return new Response(JSON.stringify({ error: "No company" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetCompanyId = prof.company_id;
    }

    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}`;

    let sql = "";
    let filenameScope = "";

    const header = (label: string) =>
      `-- Aura Comex — Database Backup\n-- Scope: ${label}\n-- Generated (UTC): ${now.toISOString()}\n-- Generated by: ${caller.email}\n--\n-- To restore into another Postgres/Supabase:\n--   psql <connection_string> -f <this-file>.sql\n-- The dump uses INSERT ... ON CONFLICT (id) DO NOTHING; run inside a fresh public schema with the same table structure.\n--\n\nSET session_replication_role = 'replica';\nBEGIN;\n\n`;
    const footer = `\nCOMMIT;\nSET session_replication_role = 'origin';\n-- End of backup\n`;

    const { data: comp } = await admin
      .from("companies")
      .select("id, name")
      .eq("id", targetCompanyId!)
      .single();
    if (!comp) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    filenameScope = (comp.name || "company")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    sql = header(`Company: ${comp.name} (${comp.id})`);
    sql += await dumpCompany(admin, comp.id, comp.name);
    sql += footer;

    // Best-effort audit log
    try {
      await admin.from("activity_log").insert({
        company_id: targetCompanyId,
        user_id: caller.id,
        action: "backup_download",
        details: { scope, target_company_id: targetCompanyId },
      } as any);
    } catch {
      // ignore if columns don't match
    }

    const filename = `aura-backup-${filenameScope}-${stamp}.sql`;

    return new Response(sql, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("backup-database error", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});