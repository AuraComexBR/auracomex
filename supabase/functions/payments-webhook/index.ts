import { createClient } from "npm:@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }
  return _supabase;
}

function getEnv(key) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

async function verifyWebhook(req, env) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === "sandbox"
    ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp;
  const v1Signatures = [];
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
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}

const PLAN_PRICE_MAP = {
  aura_basic_monthly:        { kind: "plan", plan: "starter",      seats: null, shipments: 30 },
  aura_professional_monthly: { kind: "plan", plan: "professional", seats: null, shipments: 100 },
  aura_business_monthly:     { kind: "plan", plan: "business",     seats: null, shipments: null },
};

const ADDON_PRICE_MAP = {
  aura_addon_cost_estimate_monthly: "cost_estimate_premium",
  aura_addon_tracking_monthly:      "tracking_portal",
  aura_addon_ai_import_monthly:     "ai_import",
};

// Faixas de preço por assento (volume), espelhando o que está configurado no Stripe.
// Usado só pra calcular o MRR real no momento do webhook, sem precisar bater na API
// do Stripe de novo (quantity já vem no payload do evento).
const PLAN_SEAT_TIERS = {
  starter: [
    { upTo: 1, unitCents: 14999 },
    { upTo: 2, unitCents: 13999 },
    { upTo: Infinity, unitCents: 12999 },
  ],
  professional: [
    { upTo: 1, unitCents: 24999 },
    { upTo: 2, unitCents: 22999 },
    { upTo: Infinity, unitCents: 19999 },
  ],
  business: [
    { upTo: 1, unitCents: 39999 },
    { upTo: 2, unitCents: 36999 },
    { upTo: Infinity, unitCents: 33999 },
  ],
};

function computeMrrCents(plan, seats) {
  const tiers = PLAN_SEAT_TIERS[plan];
  if (!tiers || !seats || seats < 1) return 0;
  const tier = tiers.find((t) => seats <= t.upTo) || tiers[tiers.length - 1];
  return tier.unitCents * seats;
}

function priceKeyOf(item) {
  return item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || null;
}

function isoFromUnix(seconds) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function upsertFromSubscription(subscription, env) {
  const companyId = subscription.metadata?.company_id;
  if (!companyId) {
    console.error("No company_id in subscription metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceKey = priceKeyOf(item);
  if (!priceKey) {
    console.error("No price lookup_key on subscription item", subscription.id);
    return;
  }
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const supa = getSupabase();

  // Plan subscription
  if (PLAN_PRICE_MAP[priceKey]) {
    const meta = PLAN_PRICE_MAP[priceKey];
    const status = subscription.status === "trialing" ? "trial"
                 : subscription.status === "active" ? "active"
                 : subscription.status === "past_due" ? "past_due"
                 : subscription.status === "canceled" || subscription.status === "unpaid" || subscription.status === "incomplete_expired" ? "canceled"
                 : "active";
    const seats = item?.quantity || 1;
    const mrrCents = (status === "active" || status === "past_due") ? computeMrrCents(meta.plan, seats) : 0;
    const { error: planErr } = await supa.from("company_subscriptions").upsert({
      company_id: companyId,
      plan: meta.plan,
      status,
      seats_limit: meta.seats,
      shipments_limit: meta.shipments,
      seats_active: seats,
      mrr_cents: mrrCents,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceKey,
      current_period_end: isoFromUnix(periodEnd),
      environment: env,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" });
    if (planErr) console.error("company_subscriptions upsert failed:", planErr);
    return;
  }

  // Add-on subscription
  if (ADDON_PRICE_MAP[priceKey]) {
    const addonKey = ADDON_PRICE_MAP[priceKey];
    const active = subscription.status === "active" || subscription.status === "trialing" || subscription.status === "past_due";
    const { error: addonErr } = await supa.from("company_addons").upsert({
      company_id: companyId,
      addon_key: addonKey,
      active,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceKey,
      environment: env,
      activated_at: active ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,addon_key" });
    if (addonErr) console.error("company_addons upsert failed:", addonErr);
    return;
  }

  console.warn("Unknown price lookup_key:", priceKey);
}

async function handleSubscriptionDeleted(subscription, env) {
  const supa = getSupabase();
  const item = subscription.items?.data?.[0];
  const priceKey = priceKeyOf(item);

  if (priceKey && ADDON_PRICE_MAP[priceKey]) {
    await supa.from("company_addons").update({
      active: false,
      updated_at: new Date().toISOString(),
    }).eq("stripe_subscription_id", subscription.id);
    return;
  }

  await supa.from("company_subscriptions").update({
    status: "canceled",
    mrr_cents: 0,
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", subscription.id);
}

async function handleWebhook(req, env) {
  const event = await verifyWebhook(req, env);
  console.log("Webhook event:", event.type);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "subscription.created":
    case "subscription.updated":
      await upsertFromSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
    case "subscription.canceled":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log("Unhandled:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Invalid env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
