import { cors, json, getUser } from '../_shared/helpers.ts';

const PRICES: Record<string, string | undefined> = {
  starter_monthly: Deno.env.get('PRICE_STARTER_MONTHLY'),
  starter_yearly: Deno.env.get('PRICE_STARTER_YEARLY'),
  pro_monthly: Deno.env.get('PRICE_PRO_MONTHLY'),
  pro_yearly: Deno.env.get('PRICE_PRO_YEARLY'),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const user = await getUser(req);
  if (!user) return json({ error: 'Please log in' }, 401);

  const { plan, billing } = await req.json();
  const price = PRICES[`${plan}_${billing}`];
  if (!price) return json({ error: 'Unknown plan' }, 400);

  const site = req.headers.get('origin') ?? 'https://grangeai.net';

  // stripe takes form data, not json
  const form = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: site + '/?payment=success',
    cancel_url: site + '/?payment=cancelled',
    customer_email: user.email ?? '',
    'metadata[user_id]': user.id,
    'metadata[plan]': plan,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + Deno.env.get('STRIPE_SECRET_KEY'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  const session = await res.json();
  if (!res.ok) {
    console.log(session);
    return json({ error: 'Stripe error' }, 500);
  }

  return json({ url: session.url });
});
