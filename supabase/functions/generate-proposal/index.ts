import { cors, json, dbFor, getUser, askAI } from '../_shared/helpers.ts';

const LIMITS: Record<string, number> = { free: 2, starter: 10, pro: 30 };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const user = await getUser(req);
  if (!user) return json({ error: 'Please log in' }, 401);

  const { prompt } = await req.json();
  if (!prompt) return json({ error: 'Missing prompt' }, 400);

  const db = dbFor(req);

  const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const limit = LIMITS[profile?.plan ?? 'free'] ?? 2;

  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await db.from('proposal_usage').select('count')
    .eq('user_id', user.id).eq('day', today).maybeSingle();
  const used = usage?.count ?? 0;

  if (used >= limit) {
    return json({ error: `You've used all ${limit} drafts for today. Try again tomorrow.` }, 429);
  }

  let full = prompt;
  const { data: past } = await db.from('document_chunks').select('content').eq('user_id', user.id).limit(3);
  if (past && past.length > 0) {
    full += '\n\nHere is some of their past writing. Match the style:\n';
    full += past.map((p) => p.content).join('\n---\n');
  }

  try {
    const text = await askAI(full);
    await db.from('proposal_usage').upsert({ user_id: user.id, day: today, count: used + 1 });
    return json({ text });
  } catch (e) {
    console.log(e);
    return json({ error: "Couldn't write the draft right now, try again in a minute." }, 503);
  }
});
