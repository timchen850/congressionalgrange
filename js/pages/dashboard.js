async function loadDashboard() {
  if (answers.org_name) {
    document.getElementById('greeting').textContent = 'Welcome, ' + answers.org_name + '!';
  }

  const [grants, drafts, dls] = await Promise.all([
    db.from('grants').select('id').eq('user_id', user.id),
    db.from('proposals').select('id').eq('user_id', user.id),
    db.from('deadlines').select('*').eq('user_id', user.id).eq('done', false).order('due_date')
  ]);

  const nGrants = grants.data ? grants.data.length : 0;
  const nDrafts = drafts.data ? drafts.data.length : 0;
  const upcoming = (dls.data || []).filter(d => daysUntil(d.due_date) >= 0);
  const ready = getReadiness();

  document.getElementById('stat-saved').textContent = nGrants;
  document.getElementById('stat-drafts').textContent = nDrafts;
  document.getElementById('stat-deadlines').textContent = upcoming.length;
  document.getElementById('stat-ready').textContent = ready + '%';

  let list = upcoming.slice(0, 5).map(d => {
    const days = daysUntil(d.due_date);
    return `<li>${esc(d.title)} - ${days == 0 ? 'due today' : 'due in ' + days + ' days'}</li>`;
  }).join('');
  document.getElementById('dash-deadlines').innerHTML = list || '<li>No deadlines yet.</li>';

  let todo = '';
  if (nGrants == 0) todo += `<li><a href="#" onclick="showScreen('discover')">Find your first grant</a></li>`;
  if (ready < 100) todo += `<li><a href="#" onclick="showScreen('readiness')">Finish your readiness checklist</a></li>`;
  if (nDrafts == 0) todo += `<li><a href="#" onclick="showScreen('generator')">Write your first proposal</a></li>`;
  document.getElementById('next-steps').innerHTML = todo || '<li>You\'re all caught up!</li>';
}
