import https from 'node:https';
import { createClient } from '@supabase/supabase-js';

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

const PORTAL_HOST = 'portalunico.siscomex.gov.br';

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

  // Reaproveita a VITE_SUPABASE_URL já existente no projeto (não é segredo,
  // já vai exposta no bundle do front-end mesmo) — só o service role key
  // precisa ser cadastrado à parte, esse sim nunca pode ter prefixo VITE_
  // (senão o Vite embute ele no JS do cliente).
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis de ambiente do Vercel (VITE_SUPABASE_URL já é reaproveitada automaticamente).' });
    return;
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: config, error: configError } = await supabase
      .from('company_portalunico_configs')
      .select('*')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) {
      res.status(404).json({ success: false, error: 'Nenhuma credencial do Portal Único cadastrada para esta empresa.' });
      return;
    }

    let tlsOptions: { pfx: Buffer; passphrase: string } | { cert: string; key: string };

    // Prioriza o PEM combinado quando cadastrado — evita o parser PKCS12 do
    // Node/OpenSSL3, que rejeita certificados A1 mais antigos com
    // "Unsupported PKCS12 PFX data" (algoritmos legados tipo RC2-40/3DES+SHA1).
    if (config.certificate_pem_path) {
      const { data: pemBlob, error: pemDownloadError } = await supabase.storage
        .from('company-certificates')
        .download(config.certificate_pem_path);
      if (pemDownloadError || !pemBlob) {
        throw new Error(`Falha ao baixar o certificado PEM: ${pemDownloadError?.message || 'arquivo não encontrado'}`);
      }
      const pemText = await pemBlob.text();
      const certMatch = pemText.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
      const keyMatch = pemText.match(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/);
      if (!certMatch || !keyMatch) {
        res.status(422).json({ success: false, error: 'O arquivo PEM cadastrado não tem um bloco CERTIFICATE e/ou PRIVATE KEY reconhecível.' });
        return;
      }
      tlsOptions = { cert: certMatch[0], key: keyMatch[0] };
    } else if (config.certificate_path && config.certificate_password) {
      const { data: certBlob, error: downloadError } = await supabase.storage
        .from('company-certificates')
        .download(config.certificate_path);
      if (downloadError || !certBlob) {
        throw new Error(`Falha ao baixar o certificado: ${downloadError?.message || 'arquivo não encontrado'}`);
      }
      const certBuffer = Buffer.from(await certBlob.arrayBuffer());
      tlsOptions = { pfx: certBuffer, passphrase: config.certificate_password };
    } else {
      res.status(422).json({ success: false, error: 'Certificado digital (.pfx/.p12 ou PEM combinado) ainda não cadastrado para esta empresa.' });
      return;
    }

    const result = await authenticate(tlsOptions, config.role_type || 'IMPEXP');

    await supabase
      .from('company_portalunico_configs')
      .update({ last_tested_at: new Date().toISOString(), last_test_success: result.success })
      .eq('company_id', company_id);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Erro interno' });
  }
}

function authenticate(
  tlsOptions: { pfx: Buffer; passphrase: string } | { cert: string; key: string },
  roleType: string,
): Promise<{ success: boolean; error?: string; message?: string; portal_status?: number; portal_response?: any }> {
  return new Promise((resolve) => {
    const request = https.request(
      {
        hostname: PORTAL_HOST,
        path: '/portal/api/autenticar',
        method: 'POST',
        ...tlsOptions,
        headers: {
          'Content-Type': 'application/json',
          'Role-Type': roleType,
        },
        timeout: 15000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          let parsedBody: any = null;
          try { parsedBody = rawBody ? JSON.parse(rawBody) : null; } catch { /* corpo não é JSON */ }

          const hasToken = !!response.headers['set-token'];
          const success = (response.statusCode || 0) < 300 && hasToken;

          resolve(
            success
              ? { success: true, message: 'Autenticado com sucesso no Portal Único Siscomex.' }
              : {
                  success: false,
                  error: parsedBody?.message || `Falha na autenticação com o Portal Único (status ${response.statusCode}).`,
                  portal_status: response.statusCode,
                  portal_response: parsedBody || rawBody || null,
                },
          );
        });
      },
    );

    request.on('timeout', () => {
      request.destroy();
      resolve({ success: false, error: 'Tempo esgotado ao conectar no Portal Único.' });
    });

    // Erros aqui incluem falha de handshake TLS (ex: senha do certificado
    // errada, certificado inválido/expirado, ou certificado ausente).
    request.on('error', (err: any) => {
      resolve({ success: false, error: `Erro de conexão TLS com o Portal Único: ${err.message}` });
    });

    request.end();
  });
}
