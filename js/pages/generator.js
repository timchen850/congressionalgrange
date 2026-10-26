const sections = [
  'Executive Summary',
  'Statement of Need',
  'Project Description',
  'Goals and Outcomes',
  'Evaluation Plan',
  'Budget Summary',
  'Organization Background'
];

// rules that keep the AI from making stuff up
const rules = `RULES:
1. NO FABRICATION. Every number, date, and name must come from the information above. Never invent statistics, awards, partners, or staff.
2. NO UNSUPPORTED CAPACITY CLAIMS. Do not say we have programs, staff, or experience unless the information above says so.
3. If you need a fact you do not have, write [VERIFY: what to add] instead of guessing.
4. Write like a person. Do not use em dashes or phrases like "Here's the thing" or "It's worth noting". Do not use words like leverage, robust, or holistic.`;

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
  p += 'Write in plain language.\n\n' + rules;
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

  // the query is what we search past writing and examples with
  const query = val('gen-grant') + ' ' + val('gen-project');
  const data = await callFn('generate-proposal', { prompt: buildPrompt(), query });

  if (!data || !data.text) {
    btn.disabled = false;
    btn.textContent = 'Write my draft';
    toast(data && data.error ? data.error : 'Something went wrong, try again.');
    return;
  }

  btn.textContent = 'Fixing the voice...';
  const edited = await humanizeDraft(data.text);

  btn.disabled = false;
  btn.textContent = 'Write my draft';
  document.getElementById('scorecard').innerHTML = '';
  showDraft(edited);
}

// How many of the section headings are still in the text
function countSections(text) {
  return sections.filter(name => text.includes(name)).length;
}

// Second AI pass that makes the draft sound like a person wrote it.
// We only keep the new version if it passes every check, if not we keep the old one.
async function humanizeDraft(original) {
  if (original.length < 200) return original;

  const data = await callFn('edit-draft', { draft: original });
  if (!data || !data.text) return original;
  const rewritten = data.text;

  // check 1: no section was dropped
  if (countSections(rewritten) < countSections(original)) return original;

  // check 2: the length did not change by much
  if (rewritten.length < original.length * 0.8 || rewritten.length > original.length * 1.3) return original;

  // check 3: every [VERIFY] flag is still there
  const flags = text => (text.match(/\[VERIFY:/g) || []).length;
  if (flags(rewritten) < flags(original)) return original;

  // check 4: no code got added
  if (/<\s*(script|style|iframe|object|embed|link)/i.test(rewritten)) return original;

  return rewritten;
}

// Score the draft against the funder's rubric. If they never pasted one in Readiness we use a basic one.
let lastScores = [];
let lastWeakest = [];

async function scoreDraft() {
  let rubric = JSON.parse(localStorage.getItem('rubric') || 'null');
  if (rubric && rubric.criteria.length == 0) rubric = null;
  const box = document.getElementById('scorecard');
  box.innerHTML = '<p>Reviewing your draft...</p>';

  const data = await callFn('judge-proposal', { draft_text: draftText(), rubric });
  if (!data || !data.scores) {
    box.innerHTML = '<p class="error">Couldn\'t review the draft, try again in a minute.</p>';
    return;
  }

  lastScores = data.scores;
  lastWeakest = data.weakest;
  const rows = data.scores.map(s => `
    <li><b>${esc(s.criterion)}</b>: ${s.score}/5
      <span class="small">${esc(s.reasoning)}</span></li>`).join('');

  box.innerHTML = `
    <div class="card">
      <h3>Score: ${data.weighted_total}/100</h3>
      <p>${esc(data.summary)}</p>
      <ul>${rows}</ul>
      <p class="small">Weakest: ${data.weakest.map(esc).join(', ')}</p>
      <button class="btn-outline" onclick="fixWeakest()">Fix the weakest parts</button>
    </div>`;
}

// Sends the fix for each weak criterion back to the AI to rewrite just those parts
async function fixWeakest() {
  const fixes = lastScores.filter(s => lastWeakest.includes(s.criterion));
  toast('Rewriting the weak parts...');

  const data = await callFn('revise-proposal', { draft_text: draftText(), fixes });
  if (!data || !data.text) {
    toast('Couldn\'t revise the draft, try again.');
    return;
  }

  showDraft(data.text);
  scoreDraft();
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
