import { cors, json, dbFor, getUser, chunk, embed } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const user = await getUser(req);
  if (!user) return json({ error: 'Please log in' }, 401);

  const { text = '', label = 'Untitled' } = await req.json();
  if (text.length < 200) return json({ error: 'Text is too short' }, 400);

  const db = dbFor(req);
  const pieces = chunk(text);

  for (const piece of pieces) {
    const embedding = await embed(piece);
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
