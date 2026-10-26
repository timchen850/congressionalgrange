import { cors, json, dbFor, getUser, askAI } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const user = await getUser(req);
  if (!user) return json({ error: 'Please log in' }, 401);

  const { messages = [] } = await req.json();
  const db = dbFor(req);

  const { data: profile } = await db.from('onboarding_answers').select('answers').eq('user_id', user.id).maybeSingle();
  const { data: grants } = await db.from('grants').select('title, deadline').eq('user_id', user.id);

  let prompt = 'You help small nonprofits with grants. Keep answers short and simple.\n\n';
  prompt += 'Their organization: ' + JSON.stringify(profile?.answers ?? {}) + '\n';
  prompt += 'Their saved grants: ' + JSON.stringify(grants ?? []) + '\n\n';

  for (const m of messages) {
    prompt += `${m.role}: ${m.text}\n`;
  }
  prompt += 'assistant:';

  try {
    const reply = await askAI(prompt, 'gemini-2.5-flash-lite');
    return json({ reply });
  } catch (e) {
    console.log(e);
    return json({ error: 'The assistant is busy, try again.' }, 503);
  }
});
