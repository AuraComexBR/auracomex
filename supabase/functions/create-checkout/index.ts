import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@22.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StripeEnv = 'sandbox' | 'live';

function getEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

function createStripeClient(env: StripeEnv): Stripe {
  const apiKey = env === 'sandbox' ? getEnv('STRIPE_SANDBOX_API_KEY') : getEnv('STRIPE_LIVE_API_KEY');
  return new Stripe(apiKey, {
    apiVersion: '2026-03-25.dahlia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; companyId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9-]+$/.test(options.companyId)) throw new Error("Invalid companyId");
  const found = await stripe.customers.search({
    query: `metadata['company_id']:'${options.companyId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      await stripe.customers.update(customer.id, {
        metadata: { ...customer.metadata, company_id: options.companyId },
      });
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { company_id: options.companyId },
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const priceId: string = body.priceId;
    const environment: StripeEnv = body.environment === 'live' ? 'live' : 'sandbox';
    const returnUrl: string = body.returnUrl;
    // Quantidade de assentos — só é relevante pra preços por volume (plano Básico).
    // Add-ons e outros planos ignoram isso na prática (quantity 1).
    const seats: number = Number.isInteger(body.seats) && body.seats > 0 ? body.seats : 1;

    if (!priceId || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return new Response(JSON.stringify({ error: 'Invalid priceId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: profile } = await supabase.from('profiles').select('company_id, email').eq('user_id', userData.user.id).maybeSingle();
    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: 'No company found for user' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const stripe = createStripeClient(environment);
    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) {
      return new Response(JSON.stringify({ error: 'Price not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const stripePrice = prices.data[0];

    const customerId = await resolveOrCreateCustomer(stripe, {
      email: profile.email || userData.user.email || undefined,
      companyId: profile.company_id,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: seats }],
      mode: 'subscription',
      ui_mode: 'embedded_page',
      return_url: returnUrl,
      customer: customerId,
      metadata: {
        company_id: profile.company_id,
        user_id: userData.user.id,
        price_lookup_key: priceId,
      },
      subscription_data: {
        metadata: {
          company_id: profile.company_id,
          user_id: userData.user.id,
          price_lookup_key: priceId,
        },
      },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('create-checkout error:', e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});