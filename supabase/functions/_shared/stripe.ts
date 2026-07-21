import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@22.0.2";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = 'sandbox' | 'live';

export function getConnectionApiKey(env: StripeEnv): string {
  return env === 'sandbox'
    ? getEnv('STRIPE_SANDBOX_API_KEY')
    : getEnv('STRIPE_LIVE_API_KEY');
}

// Conecta direto na API oficial do Stripe (api.stripe.com), sem passar por
// gateway de terceiro. Antes isso ia via connector-gateway.lovable.dev,
// o que deixava checkout/portal de cobrança dependentes da conta da Lovable
// continuar ativa — risco desnecessário já que as chaves aqui já são as
// chaves reais da conta Stripe.
export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);

  return new Stripe(connectionApiKey, {
    apiVersion: '2026-03-25.dahlia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function verifyWebhook(req: Request, env: StripeEnv): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === 'sandbox'
    ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }

  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`)
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}

// Aura plan/add-on catalog — maps human-readable price IDs to internal keys.
// "Básico" reaproveita o valor 'starter' do enum do banco (subscription_plan) pra
// não precisar de migration — só o rótulo exibido mudou (ver PLAN_LABEL). O preço
// no Stripe é por assento (tiered/volume: 1º usuário R$149,99, 2º R$139,99, 3º+
// R$129,99 cada), então quantity no checkout = nº de usuários, não fixo em 1.
export const PLAN_PRICE_MAP: Record<string, { kind: 'plan'; plan: 'starter' | 'professional' | 'business'; seats: number | null; shipments: number | null }> = {
  aura_basic_monthly:        { kind: 'plan', plan: 'starter',      seats: null, shipments: 30 },
  aura_professional_monthly: { kind: 'plan', plan: 'professional', seats: null, shipments: 100 },
  aura_business_monthly:     { kind: 'plan', plan: 'business',     seats: null, shipments: null },
};

export const ADDON_PRICE_MAP: Record<string, 'cost_estimate_premium' | 'tracking_portal' | 'ai_import'> = {
  aura_addon_cost_estimate_monthly: 'cost_estimate_premium',
  aura_addon_tracking_monthly:      'tracking_portal',
  aura_addon_ai_import_monthly:     'ai_import',
};