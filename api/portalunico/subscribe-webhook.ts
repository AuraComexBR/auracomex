import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { authenticate, authenticatedRequest, loadTlsOptions } from './_lib';

/**
 * Assina, no Portal Único Siscomex, os eventos de push da DUIMP que
 * interessam pro tracking (canal, situação, registro, retificação,
 * diagnóstico) — ver docs.portalunico.siscomex.gov.br/pages/webhooks/.
 *
 * Não existe (ainda) endpoint público de CONSULTA síncrona de DUIMP pra
 * intervenientes privados — só a assinatura de eventos, então é assim que
 * o AuraComex fica sabendo quando o canal ou a situação de uma DUIMP muda,
 * sem precisar ficar consultando de tempos em tempos.
 *
 * Cada empresa assina com o PRÓPRIO certificado (mesma mTLS do
 * test-connection.ts) e recebe um `webhook_secret` só dela — é esse secret
 * que a supabase/functions/portalunico-webhook usa pra confirmar de qual
 * empresa é cada notificação recebida.
 */

const EVENTOS_DUIMP_IMPORTADOR = [
  'dimp-situacao-import',
  'dimp-registro-import',
  'dimp-retifica-import',
  'dimp-diag-import',
];

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
    res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis de ambiente do Vercel.' });
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

    const authResult = await authenticate(tlsResult.tlsOptions, config.role_type || 'IMPEXP');
    if (!authResult.success) { res.status(400).json(authResult); return; }

    // Reaproveita o secret já existente (permite rodar de novo sem perder
    // as assinaturas antigas), ou gera um novo na primeira vez.
    const webhookSecret: string = config.webhook_secret || crypto.randomBytes(24).toString('hex');
    const webhookEndpoint = `${supabaseUrl}/functions/v1/portalunico-webhook`;

    const existingIds: Record<string, number> = config.webhook_subscription_ids || {};
    const subscriptionIds: Record<string, number> = { ...existingIds };
    const errors: Record<string, string> = {};

    for (const evento of EVENTOS_DUIMP_IMPORTADOR) {
      try {
        const alreadySubscribed = existingIds[evento];
        const response = await authenticatedRequest(
          tlsResult.tlsOptions,
          { token: authResult.token, csrfToken: authResult.csrfToken },
          {
            method: alreadySubscribed ? 'PUT' : 'POST',
            path: alreadySubscribed ? `/portal/api/ext/webhook/${alreadySubscribed}` : '/portal/api/ext/webhook',
            body: {
              ...(alreadySubscribed ? { id: alreadySubscribed } : {}),
              evento,
              endpoint: webhookEndpoint,
              chaveSecreta: webhookSecret,
            },
          },
        );
        if (response.status >= 200 && response.status < 300 && response.body?.id) {
          subscriptionIds[evento] = response.body.id;
        } else {
          errors[evento] = response.body?.message || `status ${response.status}`;
        }
      } catch (err: any) {
        errors[evento] = err?.message || 'erro desconhecido';
      }
    }

    const anySuccess = Object.keys(subscriptionIds).length > 0;
    await supabase
      .from('company_portalunico_configs')
      .update({
        webhook_secret: webhookSecret,
        webhook_subscription_ids: subscriptionIds,
        webhook_active: anySuccess,
      })
      .eq('company_id', company_id);

    if (!anySuccess) {
      res.status(400).json({ success: false, error: 'Não foi possível assinar nenhum evento no Portal Único.', details: errors });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Notificações automáticas ativadas (${Object.keys(subscriptionIds).length}/${EVENTOS_DUIMP_IMPORTADOR.length} eventos).`,
      subscriptions: subscriptionIds,
      errors: Object.keys(errors).length ? errors : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Erro interno' });
  }
}
