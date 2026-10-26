import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

export function dbFor(req: Request) {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
}

export async function getUser(req: Request) {
  const { data } = await dbFor(req).auth.getUser();
  return data.user;
}

async function gemini(prompt: string, model: string) {
  const key = Deno.env.get('GEMINI_API_KEY');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!res.ok) throw new Error('gemini ' + res.status);

  const data = await res.json();
  // gemini sometimes splits the answer into a few parts
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: { text?: string }) => p.text ?? '').join('');
}

async function groq(prompt: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + Deno.env.get('GROQ_API_KEY'),
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error('groq ' + res.status);

  const data = await res.json();
  return data.choices[0].message.content;
}

// gemini goes down a lot when it's busy so fall back to groq
export async function askAI(prompt: string, model = 'gemini-2.5-flash') {
  try {
    const text = await gemini(prompt, model);
    if (text) return text;
  } catch (e) {
    console.log(e);
  }
  return await groq(prompt);
}
