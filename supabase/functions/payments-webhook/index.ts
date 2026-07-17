import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook, PLAN_PRICE_MAP, ADDON_PRICE_MAP } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

function priceKeyOf(item: any): string | null {
  return item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || null;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function upsertFromSubscription(subscription: any, env: StripeEnv) {
  const companyId = subscription.metadata?.company_id;
  if (!companyId) {
    console.error('No company_id in subscription metadata', subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceKey = priceKeyOf(item);
  if (!priceKey) {
    console.error('No price lookup_key on subscription item', subscription.id);
    return;
  }
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const supa = getSupabase();

  // Plan subscription
  if (PLAN_PRICE_MAP[priceKey]) {
    const meta = PLAN_PRICE_MAP[priceKey];
    const status = subscription.status === 'trialing' ? 'trial'
                 : subscription.status === 'active' ? 'active'
                 : subscription.status === 'past_due' ? 'past_due'
                 : subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'incomplete_expired' ? 'canceled'
                 : 'active';
    const { error: planErr } = await supa.from('company_subscriptions').upsert({
      company_id: companyId,
      plan: meta.plan,
      status,
      seats_limit: meta.seats,
      shipments_limit: meta.shipments,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceKey,
      current_period_end: isoFromUnix(periodEnd),
      environment: env,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });
    if (planErr) console.error('company_subscriptions upsert failed:', planErr);
    return;
  }

  // Add-on subscription
  if (ADDON_PRICE_MAP[priceKey]) {
    const addonKey = ADDON_PRICE_MAP[priceKey];
    const active = subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due';
    const { error: addonErr } = await supa.from('company_addons').upsert({
      company_id: companyId,
      addon_key: addonKey,
      active,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceKey,
      environment: env,
      activated_at: active ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,addon_key' });
    if (addonErr) console.error('company_addons upsert failed:', addonErr);
    return;
  }

  console.warn('Unknown price lookup_key:', priceKey);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const supa = getSupabase();
  const item = subscription.items?.data?.[0];
  const priceKey = priceKeyOf(item);

  if (priceKey && ADDON_PRICE_MAP[priceKey]) {
    await supa.from('company_addons').update({
      active: false,
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', subscription.id);
    return;
  }

  await supa.from('company_subscriptions').update({
    status: 'canceled',
    updated_at: new Date().toISOString(),
  }).eq('stripe_subscription_id', subscription.id);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  console.log('Webhook event:', event.type);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'subscription.created':
    case 'subscription.updated':
      await upsertFromSubscription(event.data.object, env);
      break;
    case 'customer.subscription.deleted':
    case 'subscription.canceled':
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log('Unhandled:', event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const rawEnv = new URL(req.url).searchParams.get('env');
  if (rawEnv !== 'sandbox' && rawEnv !== 'live') {
    console.error('Invalid env:', rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: 'invalid env' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Webhook error', { status: 400 });
  }
});