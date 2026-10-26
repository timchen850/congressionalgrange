import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, json, chunk, embed } from '../_shared/helpers.ts';

// Adds one example proposal to the library. Only we can run this, it needs the service role key.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== 'Bearer ' + serviceKey) {
    return json({ error: 'Not allowed' }, 401);
  }

  const { text = '', title, funder_type, source_url, license, usage = 'learn_from' } = await req.json();
  if (text.length < 200) return json({ error: 'Text is too short' }, 400);

  // we only learn from proposals that have a license we wrote down
  if (usage == 'learn_from' && !license) {
    return json({ error: 'Add the license first, or set usage to reference_only' }, 400);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const pieces = chunk(text);

  for (const piece of pieces) {
    const embedding = await embed(piece);
    const { error } = await db.from('exemplar_chunks').insert({
      title, funder_type, source_url, license, usage,
      content: piece,
      embedding,
    });
    if (error) return json({ error: error.message }, 500);
  }

  return json({ ok: true, pieces: pieces.length });
});
