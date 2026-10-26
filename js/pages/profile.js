const labels = {
  org_name: 'Organization',
  entity_type: 'Type',
  ein: 'EIN',
  mission: 'Mission',
  focus_areas: 'Focus areas',
  primary_location: 'Location',
  annual_budget: 'Budget',
  staff_count: 'Staff'
};

async function loadProfile() {
  const { data } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan = data && data.plan ? data.plan : 'free';

  let html = '<div class="card">';
  html += '<p><b>Plan:</b> ' + plan.charAt(0).toUpperCase() + plan.slice(1) + '</p>';
  for (const key in labels) {
    let v = answers[key];
    if (Array.isArray(v)) v = v.join(', ');
    html += `<p><b>${labels[key]}:</b> ${esc(v) || '-'}</p>`;
  }
  document.getElementById('profile-info').innerHTML = html + '</div>';
}

function editProfile() {
  startOnboarding();
}

async function uploadPastProposal() {
  const box = document.getElementById('past-text');
  const status = document.getElementById('past-status');
  const text = box.value.trim();

  if (text.length < 200) {
    status.textContent = 'Paste a longer piece of writing (at least a few paragraphs).';
    return;
  }

  status.textContent = 'Saving...';
  const data = await callFn('rag-ingest', { text, label: 'Past proposal' });

  if (data && data.ok) {
    status.textContent = 'Saved! New drafts will use your writing style.';
    box.value = '';
  } else {
    status.textContent = "Couldn't save it.";
  }
}
