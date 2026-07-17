/**
 * Migração de usuários: cria no Auth os usuários que só existiam no banco antigo
 * (profiles/user_roles migrados, sem auth.users correspondente) e limpa os
 * registros órfãos.
 *
 * COMO USAR (PowerShell, na pasta do projeto):
 *
 *   $env:SUPABASE_URL="https://pqiuxojgjmqhdajdhgqk.supabase.co"
 *   $env:SERVICE_ROLE_KEY="COLE_A_SERVICE_ROLE_KEY_AQUI"
 *   node scripts/migrate-users.mjs
 *
 * A SERVICE_ROLE_KEY fica em: Supabase Dashboard -> Settings -> API -> service_role (secret).
 *
 * Todos os usuários criados recebem a MESMA senha temporária abaixo e são
 * marcados com must_change_password = true (trocam no primeiro acesso).
 */

import { createClient } from '@supabase/supabase-js';

const TEMP_PASSWORD = 'Aura@2026'; // troque se quiser outra senha temporária

const url = process.env.SUPABASE_URL;
const key = process.env.SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Defina SUPABASE_URL e SERVICE_ROLE_KEY nas variáveis de ambiente.');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

// 1. Coleta todos os emails já existentes no Auth (paginado)
async function getAuthEmails() {
  const emails = new Map(); // email -> id
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) emails.set(u.email?.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
    page++;
  }
  return emails;
}

async function main() {
  console.log('🔎 Lendo usuários do Auth...');
  const authEmails = await getAuthEmails();

  // 2. Lê profiles migrados + role de cada um
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('user_id, email, full_name, company_id');
  if (pErr) throw pErr;

  const { data: roles, error: rErr } = await admin
    .from('user_roles')
    .select('user_id, role');
  if (rErr) throw rErr;

  const roleByUser = new Map(roles.map((r) => [r.user_id, r.role]));

  // 3. Filtra os que precisam ser criados (email não existe no Auth)
  const toCreate = profiles.filter(
    (p) => p.email && !authEmails.has(p.email.toLowerCase()),
  );

  if (toCreate.length === 0) {
    console.log('✅ Nenhum usuário para criar. Todos já existem no Auth.');
  } else {
    console.log(`\n📋 ${toCreate.length} usuário(s) para criar:\n`);
    for (const p of toCreate) {
      const role = roleByUser.get(p.user_id) || 'operator';
      const { error } = await admin.auth.admin.createUser({
        email: p.email,
        password: TEMP_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: p.full_name || p.email,
          company_id: p.company_id,
          role,
          must_change_password: 'true',
        },
      });
      if (error) {
        console.log(`  ❌ ${p.email} (${role}) — ${error.message}`);
      } else {
        console.log(`  ✅ ${p.email} (${role})`);
      }
    }
  }

  // 4. Limpa registros órfãos (user_id que não existe mais no Auth)
  console.log('\n🧹 Limpando profiles/roles órfãos (IDs antigos da migração)...');
  const freshAuthEmails = await getAuthEmails();
  const validIds = new Set(freshAuthEmails.values());

  const { data: allProfiles } = await admin.from('profiles').select('user_id');
  const orphanProfileIds = [...new Set(
    (allProfiles || []).map((p) => p.user_id).filter((id) => !validIds.has(id)),
  )];

  if (orphanProfileIds.length > 0) {
    await admin.from('user_roles').delete().in('user_id', orphanProfileIds);
    await admin.from('profiles').delete().in('user_id', orphanProfileIds);
    console.log(`  🗑️  Removidos ${orphanProfileIds.length} registro(s) órfão(s).`);
  } else {
    console.log('  Nada a limpar.');
  }

  console.log(`\n🎉 Concluído. Senha temporária de todos: ${TEMP_PASSWORD}`);
  console.log('   (cada um troca no primeiro acesso).');
}

main().catch((e) => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
