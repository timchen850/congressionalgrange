import { cors, json, getUser } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const user = await getUser(req);
  if (!user) return json({ error: 'Please log in' }, 401);

  const { ein } = await req.json();
  const digits = String(ein ?? '').replace(/\D/g, '');
  if (digits.length !== 9) return json({ error: 'EIN must be 9 digits' }, 400);

  const res = await fetch(`https://projects.propublica.org/nonprofits/api/v2/organizations/${digits}.json`);
  if (res.status === 404) return json({ found: false });
  if (!res.ok) return json({ error: 'Lookup failed' }, 502);

  const { organization: org } = await res.json();
  const code = org.subsection_code;

  return json({
    found: true,
    name: org.name,
    city: org.city,
    state: org.state,
    is_501c3: code === 3,
    status: `501(c)(${code})`,
  });
});
