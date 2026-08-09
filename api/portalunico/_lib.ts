import https from 'node:https';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lógica compartilhada entre test-connection.ts e subscribe-webhook.ts —
 * ambos precisam montar o mesmo par cert/key e fazer o mesmo handshake mTLS
 * contra o Portal Único (é o único jeito de autenticar, confirmado com
 * teste real: sem certificado o Portal devolve "HandshakeFailure" antes
 * mesmo da camada HTTP).
 *
 * Prefixo `_` no nome do arquivo faz o Vercel NÃO tratar isso como uma
 * rota — é só um módulo importado pelas funções de verdade.
 */

export const PORTAL_HOST = 'portalunico.siscomex.gov.br';

export type TlsOptions = { pfx: Buffer; passphrase: string } | { cert: string; key: string };

export async function loadTlsOptions(
  supabase: SupabaseClient,
  config: { certificate_pem_path?: string | null; certificate_path?: string | null; certificate_password?: string | null },
): Promise<{ tlsOptions: TlsOptions } | { error: string; status: number }> {
  if (config.certificate_pem_path) {
    const { data: pemBlob, error: pemDownloadError } = await supabase.storage
      .from('company-certificates')
      .download(config.certificate_pem_path);
    if (pemDownloadError || !pemBlob) {
      return { error: `Falha ao baixar o certificado PEM: ${pemDownloadError?.message || 'arquivo não encontrado'}`, status: 500 };
    }
    const pemText = await pemBlob.text();
    const certMatch = pemText.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
    const keyMatch = pemText.match(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/);
    if (!certMatch || !keyMatch) {
      return { error: 'O arquivo PEM cadastrado não tem um bloco CERTIFICATE e/ou PRIVATE KEY reconhecível.', status: 422 };
    }
    return { tlsOptions: { cert: certMatch[0], key: keyMatch[0] } };
  }

  if (config.certificate_path && config.certificate_password) {
    const { data: certBlob, error: downloadError } = await supabase.storage
      .from('company-certificates')
      .download(config.certificate_path);
    if (downloadError || !certBlob) {
      return { error: `Falha ao baixar o certificado: ${downloadError?.message || 'arquivo não encontrado'}`, status: 500 };
    }
    const certBuffer = Buffer.from(await certBlob.arrayBuffer());
    return { tlsOptions: { pfx: certBuffer, passphrase: config.certificate_password } };
  }

  return { error: 'Certificado digital (.pfx/.p12 ou PEM combinado) ainda não cadastrado para esta empresa.', status: 422 };
}

export type AuthResult =
  | { success: true; token: string; csrfToken: string }
  | { success: false; error: string; portal_status?: number; portal_response?: unknown };

/** POST /portal/api/autenticar — autentica via mTLS e devolve o JWT (Set-Token) + X-CSRF-Token pra usar nas próximas chamadas. */
export function authenticate(tlsOptions: TlsOptions, roleType: string): Promise<AuthResult> {
  return new Promise((resolve) => {
    const request = https.request(
      {
        hostname: PORTAL_HOST,
        path: '/portal/api/autenticar',
        method: 'POST',
        ...tlsOptions,
        headers: { 'Content-Type': 'application/json', 'Role-Type': roleType },
        timeout: 15000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          let parsedBody: any = null;
          try { parsedBody = rawBody ? JSON.parse(rawBody) : null; } catch { /* corpo não é JSON */ }

          const token = response.headers['set-token'] as string | undefined;
          const csrfToken = response.headers['x-csrf-token'] as string | undefined;
          const success = (response.statusCode || 0) < 300 && !!token;

          resolve(
            success
              ? { success: true, token: token!, csrfToken: csrfToken || '' }
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
    request.on('error', (err: any) => {
      resolve({ success: false, error: `Erro de conexão TLS com o Portal Único: ${err.message}` });
    });
    request.end();
  });
}

/** Chamada autenticada genérica pro Portal Único (depois do handshake inicial) — ainda precisa do mTLS em toda requisição, mais os headers Authorization/X-CSRF-Token do login. */
export function authenticatedRequest(
  tlsOptions: TlsOptions,
  auth: { token: string; csrfToken: string },
  options: { method: string; path: string; body?: unknown },
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const request = https.request(
      {
        hostname: PORTAL_HOST,
        path: options.path,
        method: options.method,
        ...tlsOptions,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth.token,
          'X-CSRF-Token': auth.csrfToken,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
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
          resolve({ status: response.statusCode || 0, body: parsedBody ?? rawBody });
        });
      },
    );
    request.on('timeout', () => { request.destroy(); reject(new Error('Tempo esgotado ao conectar no Portal Único.')); });
    request.on('error', (err: any) => reject(new Error(`Erro de conexão com o Portal Único: ${err.message}`)));
    if (payload) request.write(payload);
    request.end();
  });
}
