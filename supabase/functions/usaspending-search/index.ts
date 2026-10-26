import { cors, json } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const { keywords = [], location = '' } = await req.json();
  if (keywords.length === 0) return json({ results: [] });

  const filters: Record<string, unknown> = {
    award_type_codes: ['02', '03', '04', '05'],
    keywords,
    time_period: [{ start_date: '2022-01-01', end_date: new Date().toISOString().slice(0, 10) }],
  };

  // pull "TX" out of "Austin, TX"
  const state = location.match(/\b([A-Z]{2})\b/);
  if (state) filters.recipient_locations = [{ country: 'USA', state: state[1] }];

  const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters,
      fields: ['Recipient Name', 'Award Amount', 'Awarding Agency'],
      limit: 10,
    }),
  });
  if (!res.ok) return json({ results: [] });

  const data = await res.json();
  const results = data.results.map((r: Record<string, unknown>) => ({
    recipient: r['Recipient Name'],
    amount: r['Award Amount'],
    agency: r['Awarding Agency'],
  }));

  return json({ results });
});
