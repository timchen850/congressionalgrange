// grants.gov blocks browser requests (CORS), so the site calls this instead
import { cors, json } from '../_shared/helpers.ts';

async function search(keyword: string) {
  try {
    const res = await fetch('https://api.grants.gov/v1/api/search2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, rows: 25, oppStatuses: 'forecasted|posted' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.oppHits ?? [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const body = await req.json();
  const areas: string[] = body.focus_areas?.length ? body.focus_areas.slice(0, 6) : ['community'];

  const results = await Promise.all(areas.map(search));

  const seen = new Set();
  const grants = [];
  results.forEach((hits, i) => {
    for (const h of hits) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      grants.push({
        id: h.id,
        title: h.title,
        agency: h.agency,
        close_date: h.closeDate || null,
        status: h.oppStatus,
        description: areas[i],
      });
    }
  });

  return json({ grants });
});
