const sections = [
  'Executive Summary',
  'Statement of Need',
  'Project Description',
  'Goals and Outcomes',
  'Evaluation Plan',
  'Budget Summary',
  'Organization Background'
];

function val(id) {
  return document.getElementById(id).value.trim();
}

function buildPrompt() {
  let p = `Write a grant proposal for the "${val('gen-grant')}" grant from ${val('gen-funder') || 'the funder'}.\n`;
  if (val('gen-amount')) p += `We are asking for ${val('gen-amount')}.\n`;

  p += '\nAbout us:\n';
  p += `Name: ${answers.org_name}\n`;
  p += `Type: ${answers.entity_type}\n`;
  p += `Mission: ${answers.mission}\n`;
  p += `Location: ${answers.primary_location}\n`;
  if (answers.beneficiaries) p += `Who we serve: ${answers.beneficiaries}\n`;
  p += `Budget: ${answers.annual_budget}\n`;

  p += `\nThe project: ${val('gen-project')}\n`;

  // long RFPs blow past the token limit
  const rfp = val('gen-rfp').slice(0, 15000);
  if (rfp) p += `\nFunder instructions:\n${rfp}\n`;

  p += `\nUse these sections: ${sections.join(', ')}.\n`;
  p += 'Write in plain language. If you are not sure about a fact, write [VERIFY: what to check].';
  return p;
}

async function generateProposal() {
  const btn = document.getElementById('gen-btn');
  if (btn.disabled) return;

  if (!val('gen-project')) {
    toast('Describe the project first.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Writing... (about a minute)';

  const data = await callFn('generate-proposal', { prompt: buildPrompt() });

  btn.disabled = false;
  btn.textContent = 'Write my draft';

  if (!data || !data.text) {
    toast(data && data.error ? data.error : 'Something went wrong, try again.');
    return;
  }

  showDraft(data.text);
}

function showDraft(text) {
  document.getElementById('gen-output').classList.remove('hidden');
  document.getElementById('draft').innerHTML = esc(text)
    .replace(/\[VERIFY:[^\]]*\]/g, m => `<span class="verify">${m}</span>`);
}

function draftText() {
  return document.getElementById('draft').innerText;
}

function copyDraft() {
  navigator.clipboard.writeText(draftText())
    .then(() => toast('Copied!'))
    .catch(() => toast('Copy failed, select the text and copy it by hand.'));
}

function downloadDraft() {
  const name = (val('gen-grant') || 'proposal').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([draftText()], { type: 'text/plain' }));
  a.download = name + '.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function saveDraft() {
  const { error } = await db.from('proposals').insert({
    user_id: user.id,
    grant_title: val('gen-grant'),
    content: draftText()
  });
  toast(error ? "Couldn't save the draft." : 'Draft saved!');
  if (!error) loadDrafts();
}

let savedDrafts = [];

async function loadDrafts() {
  const { data } = await db.from('proposals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  savedDrafts = data || [];

  const html = savedDrafts.map((d, i) => `
    <li>${esc(d.grant_title || 'Untitled')} - ${d.created_at.slice(0, 10)}
      <button class="btn-outline" onclick="openDraft(${i})">Open</button>
    </li>`).join('');
  document.getElementById('draft-list').innerHTML = html || '<li>No saved drafts yet.</li>';
}

function openDraft(i) {
  const d = savedDrafts[i];
  document.getElementById('gen-grant').value = d.grant_title || '';
  showDraft(d.content);
  window.scrollTo(0, document.getElementById('gen-output').offsetTop);
}
