import { createClient } from '@supabase/supabase-js';
import { authenticate, loadTlsOptions } from './_lib';

/**
 * Autenticação real (TLS mútuo) no Portal Único Siscomex.
 *
 * Isto roda como função serverless Node.js no Vercel — não no Supabase
 * Edge Function (Deno Deploy), porque esse runtime não suporta apresentar
 * um certificado cliente numa conexão TLS. Confirmado com teste real: sem
 * certificado, o Portal Único devolve "received fatal alert:
 * HandshakeFailure" antes mesmo da camada HTTP.
 *
 * Cada empresa (company_id) usa o PRÓPRIO certificado e credenciais,
 * nunca compartilhados entre tenants do AuraComex — isolamento reforçado
 * pelo RLS do bucket `company-certificates` e da tabela
 * `company_portalunico_configs` (ambos escopados por company_id).
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const { company_id } = req.body || {};
  if (!company_id) {
    res.status(400).json({ success: false, error: 'company_id é obrigatório' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis de ambiente do Vercel (VITE_SUPABASE_URL já é reaproveitada automaticamente).' });
    return;
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: config, error: configError } = await supabase
      .from('company_portalunico_configs').select('*')
      .eq('company_id', company_id).eq('is_active', true).maybeSingle();
    if (configError) throw configError;
    if (!config) { res.status(404).json({ success: false, error: 'Nenhuma credencial do Portal Único cadastrada para esta empresa.' }); return; }

    const tlsResult = await loadTlsOptions(supabase, config);
    if ('error' in tlsResult) { res.status(tlsResult.status).json({ success: false, error: tlsResult.error }); return; }

    const result = await authenticate(tlsResult.tlsOptions, config.role_type || 'IMPEXP');
    await supabase
      .from('company_portalunico_configs')
      .update({ last_tested_at: new Date().toISOString(), last_test_success: result.success })
      .eq('company_id', company_id);

    if (!result.success) { res.status(400).json(result); return; }
    res.status(200).json({ success: true, message: 'Autenticado com sucesso no Portal Único Siscomex.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Erro interno' });
  }
}
