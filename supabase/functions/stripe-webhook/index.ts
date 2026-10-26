import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

// service role key so we can update any user's plan
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  } catch (e) {
    console.log('bad signature', e);
    return new Response('bad signature', { status: 400 });
  }

  const obj = event.data.object as Record<string, any>;

  if (event.type === 'checkout.session.completed') {
    await db.from('profiles')
      .update({ plan: obj.metadata.plan, stripe_customer_id: obj.customer })
      .eq('id', obj.metadata.user_id);
  }

  if (event.type === 'customer.subscription.deleted') {
    await db.from('profiles').update({ plan: 'free' }).eq('stripe_customer_id', obj.customer);
  }

  return new Response('ok');
});
