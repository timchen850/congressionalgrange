const checklist = [
  { id: 'ein', text: 'EIN (tax ID number)' },
  { id: 'irs_letter', text: 'IRS 501(c)(3) letter' },
  { id: 'budget', text: 'Current year budget' },
  { id: 'financials', text: "Last year's financial statements" },
  { id: 'board', text: 'List of board members' },
  { id: 'form990', text: 'Most recent Form 990' },
  { id: 'sam', text: 'Active SAM.gov registration' },
  { id: 'uei', text: 'UEI number' }
];

let checked = {};
try {
  checked = JSON.parse(localStorage.getItem('checklist')) || {};
} catch (e) {
  checked = {};
}

function saveChecks() {
  localStorage.setItem('checklist', JSON.stringify(checked));
}

function loadReadiness() {
  document.getElementById('checklist').innerHTML = checklist.map(c => `
    <li><label class="option">
      <input type="checkbox" ${checked[c.id] ? 'checked' : ''} onchange="toggleItem('${c.id}')">${c.text}
    </label></li>`).join('');

  if (answers.ein) document.getElementById('ein-input').value = answers.ein;

  const sam = localStorage.getItem('samDate');
  if (sam) document.getElementById('sam-date').value = sam;

  updateScore();
  showSam();
}

function toggleItem(id) {
  checked[id] = !checked[id];
  saveChecks();
  updateScore();
}

function getReadiness() {
  const done = checklist.filter(c => checked[c.id]).length;
  return Math.round(done / checklist.length * 100);
}

function updateScore() {
  const pct = getReadiness();
  document.getElementById('ready-fill').style.width = pct + '%';
  document.getElementById('ready-score').textContent = `You're ${pct}% ready.`;
}

async function checkIRS() {
  const ein = document.getElementById('ein-input').value.replace(/\D/g, '');
  const box = document.getElementById('irs-result');

  if (ein.length != 9) {
    box.innerHTML = '<p class="error">An EIN has 9 digits.</p>';
    return;
  }

  box.innerHTML = '<p>Checking...</p>';
  const data = await callFn('irs-verify', { ein });

  if (!data) {
    box.innerHTML = "<p class=\"error\">Couldn't reach the IRS lookup. Try again later.</p>";
    return;
  }
  if (!data.found) {
    box.innerHTML = "<p class=\"error\">That EIN isn't in the IRS list. New orgs can take a few months to show up.</p>";
    return;
  }

  if (data.is_501c3) {
    checked.ein = true;
    checked.irs_letter = true;
    saveChecks();
    loadReadiness();
  }

  box.innerHTML = `
    <div class="card">
      <h3>${esc(data.name)}</h3>
      <p>${esc(data.city)}, ${esc(data.state)}</p>
      <p>${data.is_501c3 ? 'Confirmed 501(c)(3)' : 'Listed as ' + esc(data.status) + ', not 501(c)(3)'}</p>
    </div>`;
}

function saveSamDate() {
  localStorage.setItem('samDate', document.getElementById('sam-date').value);
  showSam();
}

function showSam() {
  const date = localStorage.getItem('samDate');
  const el = document.getElementById('sam-status');

  if (!date) {
    el.textContent = 'Enter your expiration date so we can remind you.';
    return;
  }

  const days = daysUntil(date);
  if (days < 0) el.textContent = 'Your registration expired! Renew it now.';
  else if (days < 60) el.textContent = `Expires in ${days} days. Renewals can take weeks, so start now.`;
  else el.textContent = `Good for ${days} more days.`;
}
