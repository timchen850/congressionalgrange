import { cors, json, dbFor, getUser } from '../_shared/helpers.ts';

const model = new Supabase.ai.Session('gte-small');

// split on paragraphs so we don't cut sentences in half
function chunk(text: string, size = 1000) {
  const out: string[] = [];
  let cur = '';
  for (const para of text.split(/\n\s*\n/)) {
    if (cur && (cur + para).length > size) {
      out.push(cur.trim());
      cur = '';
    }
    cur += para + '\n\n';
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const user = await getUser(req);
  if (!user) return json({ error: 'Please log in' }, 401);

  const { text = '', label = 'Untitled' } = await req.json();
  if (text.length < 200) return json({ error: 'Text is too short' }, 400);

  const db = dbFor(req);
  const pieces = chunk(text);

  for (const piece of pieces) {
    const embedding = await model.run(piece, { mean_pool: true, normalize: true });
    const { error } = await db.from('document_chunks').insert({
      user_id: user.id,
      label,
      content: piece,
      embedding,
    });
    if (error) return json({ error: error.message }, 500);
  }

  return json({ ok: true, pieces: pieces.length });
});
