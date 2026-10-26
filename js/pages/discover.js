let allGrants = [];
let shown = [];

async function loadGrants() {
  const status = document.getElementById('grant-status');
  status.textContent = 'Searching Grants.gov...';

  const data = await callFn('discover-grants', {
    focus_areas: answers.focus_areas || [],
    mission: answers.mission || ''
  });

  if (!data || !data.grants) {
    status.textContent = "Couldn't load grants right now. Try Refresh in a minute.";
    return;
  }

  allGrants = data.grants.map(g => ({ ...g, score: matchScore(g) }));
  status.textContent = `Found ${allGrants.length} grants.`;
  filterGrants();
  loadPastAwards();
}

function matchScore(g) {
  let score = 35;
  const text = (g.title + ' ' + (g.description || '')).toLowerCase();

  (answers.focus_areas || []).forEach(area => {
    if (text.includes(area.toLowerCase())) score += 14;
  });

  let bonus = 0;
  (answers.mission || '').toLowerCase().split(/\W+/).forEach(w => {
    if (w.length > 4 && text.includes(w)) bonus += 2;
  });
  score += Math.min(bonus, 12);

  if (text.includes('501(c)(3)') && answers.entity_type != '501(c)(3) nonprofit') score -= 20;

  return Math.max(0, Math.min(99, score));
}

function filterGrants() {
  const q = document.getElementById('search-box').value.toLowerCase().trim();
  const sort = document.getElementById('sort-select').value;

  shown = allGrants.filter(g => g.title.toLowerCase().includes(q));

  if (sort == 'score') {
    shown.sort((a, b) => b.score - a.score);
  } else {
    // forecasted grants have no close date, push them to the bottom
    shown.sort((a, b) => {
      if (!a.close_date) return 1;
      if (!b.close_date) return -1;
      return toDate(a.close_date) - toDate(b.close_date);
    });
  }

  drawGrants();
}

function drawGrants() {
  const html = shown.map((g, i) => {
    const color = g.score >= 70 ? 'high' : g.score >= 45 ? 'mid' : 'low';
    return `
      <div class="grant">
        <span class="score ${color}">${g.score}% match</span>
        <h3>${esc(g.title)}</h3>
        <p class="small">${esc(g.agency)} | Closes: ${g.close_date || 'Not listed'}</p>
        <p>Award: ${money(g.award_ceiling)}</p>
        <button class="btn-outline" onclick="saveGrant(${i})">Save</button>
        <button class="btn-outline" onclick="draftFor(${i})">Write proposal</button>
        <a href="https://www.grants.gov/search-results-detail/${g.id}" target="_blank">View on Grants.gov</a>
      </div>`;
  }).join('');

  document.getElementById('grant-list').innerHTML = html || '<p>No grants match your search.</p>';
}

async function saveGrant(i) {
  const g = shown[i];

  const { data: dupe } = await db.from('grants').select('id').eq('user_id', user.id).eq('title', g.title).maybeSingle();
  if (dupe) {
    toast('Already saved.');
    return;
  }

  await db.from('grants').insert({
    user_id: user.id,
    title: g.title,
    funder: g.agency,
    amount: g.award_ceiling || null,
    deadline: g.close_date ? toDate(g.close_date).toISOString().slice(0, 10) : null,
    match_score: g.score
  });

  if (g.close_date) {
    await db.from('deadlines').insert({
      user_id: user.id,
      title: g.title,
      due_date: toDate(g.close_date).toISOString().slice(0, 10)
    });
  }

  toast('Grant saved!');
}

function draftFor(i) {
  const g = shown[i];
  showScreen('generator');
  document.getElementById('gen-grant').value = g.title;
  document.getElementById('gen-funder').value = g.agency;
  document.getElementById('gen-amount').value = g.award_ceiling ? money(g.award_ceiling) : '';
}

async function loadPastAwards() {
  const data = await callFn('usaspending-search', {
    keywords: answers.focus_areas || [],
    location: answers.primary_location || ''
  });

  const html = (data && data.results || []).map(a => `
    <div class="grant">
      <h3>${esc(a.recipient)}</h3>
      <p>${money(a.amount)} from ${esc(a.agency)}</p>
    </div>`).join('');

  document.getElementById('past-awards').innerHTML = html || '<p class="small">No past awards found.</p>';
}
