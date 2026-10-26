import { cors, json, dbFor, getUser, askAI, embed } from '../_shared/helpers.ts';

const LIMITS: Record<string, number> = { free: 2, starter: 10, pro: 30 };

// How close a chunk has to be to count as the same topic (1 is identical).
// Their own past writing uses 0.72. Example proposals from other groups use 0.82
// because 0.72 let off-topic ones in. Grant proposals all use the same words, so
// I tested with real embeddings: unrelated proposals scored 0.78 to 0.81 and
// related ones scored 0.87 to 0.89. 0.82 sits in the gap.
const OWN_WRITING_CUTOFF = 0.72;
const EXAMPLE_CUTOFF = 0.82;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const user = await getUser(req);
  if (!user) return json({ error: 'Please log in' }, 401);

  const { prompt, query } = await req.json();
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
  if (query) {
    const embedding = await embed(query);

    const { data: past } = await db.rpc('match_document_chunks', {
      query_embedding: embedding, match_count: 3, min_similarity: OWN_WRITING_CUTOFF,
    });
    if (past && past.length > 0) {
      full += '\n\nHere is some of their past writing. Match the style:\n';
      full += past.map((p: { content: string }) => p.content).join('\n---\n');
    }

    const { data: examples } = await db.rpc('match_exemplar_chunks', {
      query_embedding: embedding, match_count: 3, min_similarity: EXAMPLE_CUTOFF,
    });
    if (examples && examples.length > 0) {
      full += '\n\nHere are example proposals from other groups. Learn how they are organized, but never copy their words or facts:\n';
      full += examples.map((x: { content: string }) => x.content).join('\n---\n');
    }
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
