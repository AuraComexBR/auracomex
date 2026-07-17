// Cliente HTTP para a API do Resend (https://resend.com/docs/api-reference/emails/send-email)
// Substitui o antigo @lovable.dev/email-js, que só funciona dentro do Lovable Cloud.

export interface ResendEmailPayload {
  to: string;
  from?: string;
  sender_domain?: string;
  subject: string;
  html?: string;
  text?: string;
  message_id?: string;
  idempotency_key?: string;
  unsubscribe_token?: string;
}

export class EmailAPIError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "EmailAPIError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const DEFAULT_FROM_NAME = "Aura Comex";

/**
 * Envia um email via Resend. Lança EmailAPIError com `status` populado em
 * caso de falha, para que o chamador (process-email-queue) possa distinguir
 * 429 (rate limit) e 403 (proibido/domínio não verificado) de outros erros,
 * do mesmo jeito que fazia com o antigo sendLovableEmail.
 */
export async function sendResendEmail(
  payload: ResendEmailPayload,
  opts: { apiKey: string; defaultDomain?: string },
): Promise<{ id: string }> {
  const domain = payload.sender_domain || opts.defaultDomain;
  const from = payload.from || (domain ? `${DEFAULT_FROM_NAME} <noreply@${domain}>` : undefined);

  if (!from) {
    throw new EmailAPIError(
      "Missing 'from' address: forneça payload.from ou payload.sender_domain (ou configure RESEND_DEFAULT_DOMAIN)",
      400,
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
    "Content-Type": "application/json",
  };
  // Idempotência: evita envio duplicado se o mesmo request for retentado
  if (payload.idempotency_key) {
    headers["Idempotency-Key"] = payload.idempotency_key;
  }

  const body: Record<string, unknown> = {
    from,
    to: [payload.to],
    subject: payload.subject,
  };
  if (payload.html) body.html = payload.html;
  if (payload.text) body.text = payload.text;
  if (payload.unsubscribe_token) {
    body.headers = {
      "List-Unsubscribe": `<https://${domain}/unsubscribe?token=${payload.unsubscribe_token}>`,
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const data = await res.json();
    return { id: data.id };
  }

  const errorBody = await res.json().catch(() => ({}));
  const message = errorBody?.message || `Resend API error (HTTP ${res.status})`;

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
    throw new EmailAPIError(message, 429, retryAfterSeconds);
  }

  if (res.status === 401 || res.status === 403) {
    throw new EmailAPIError(message, 403);
  }

  throw new EmailAPIError(message, res.status);
}
