const steps = [
  {
    title: 'Tell us about your organization',
    fields: [
      { key: 'org_name', label: 'Organization name', type: 'text', required: true },
      { key: 'entity_type', label: 'What kind of organization are you?', type: 'radio', required: true,
        options: ['501(c)(3) nonprofit', 'Other nonprofit', 'Fiscal sponsorship', 'Government / tribal', 'Not a nonprofit', 'Not sure'] },
      { key: 'ein', label: 'EIN', type: 'text' },
      { key: 'year_founded', label: 'Year founded', type: 'number' }
    ]
  },
  {
    title: 'What do you work on?',
    fields: [
      { key: 'mission', label: 'Mission statement', type: 'textarea', required: true },
      { key: 'focus_areas', label: 'Focus areas', type: 'multi',
        options: ['Education', 'Housing', 'Food Security', 'Health', 'Environment', 'Arts', 'Youth', 'Veterans', 'Workforce', 'Community Development'] },
      { key: 'beneficiaries', label: 'Who do you serve?', type: 'textarea' }
    ]
  },
  {
    title: 'Where do you work?',
    fields: [
      { key: 'geo_focus', label: 'Geographic focus', type: 'radio', required: true,
        options: ['Local', 'Regional', 'Statewide', 'National', 'International'] },
      { key: 'primary_location', label: 'City and state (like Austin, TX)', type: 'text', required: true },
      { key: 'people_served', label: 'People served per year', type: 'number' }
    ]
  },
  {
    title: 'Your size',
    fields: [
      { key: 'annual_budget', label: 'Annual budget', type: 'select', required: true,
        options: ['<$100K', '$100K-$500K', '$500K-$1M', '$1M-$5M', '$5M+'] },
      { key: 'staff_count', label: 'Full time staff', type: 'number' },
      { key: 'applied_before', label: 'Have you applied for grants before?', type: 'radio', options: ['Yes', 'No'] }
    ]
  }
];

let step = 0;

function startOnboarding() {
  step = 0;
  showScreen('onboarding');
  drawStep();
}

function fieldHtml(f) {
  const val = answers[f.key] || '';
  let html = `<label>${f.label}${f.required ? ' *' : ''}</label>`;

  if (f.type == 'text' || f.type == 'number') {
    html += `<input type="${f.type}" id="f-${f.key}" value="${esc(val)}">`;
  } else if (f.type == 'textarea') {
    html += `<textarea id="f-${f.key}" rows="3">${esc(val)}</textarea>`;
  } else if (f.type == 'select') {
    html += `<select id="f-${f.key}"><option value="">Pick one</option>`;
    f.options.forEach(o => {
      html += `<option ${val == o ? 'selected' : ''}>${o}</option>`;
    });
    html += '</select>';
  } else {
    const type = f.type == 'radio' ? 'radio' : 'checkbox';
    f.options.forEach(o => {
      const on = val == o || (Array.isArray(val) && val.includes(o));
      html += `<label class="option"><input type="${type}" name="f-${f.key}" value="${o}" ${on ? 'checked' : ''}>${o}</label>`;
    });
  }
  return html;
}

function drawStep() {
  const s = steps[step];
  document.getElementById('ob-title').textContent = s.title;
  document.getElementById('ob-step-label').textContent = `Step ${step + 1} of ${steps.length}`;
  document.getElementById('progress-fill').style.width = (step / steps.length * 100) + '%';
  document.getElementById('ob-fields').innerHTML = s.fields.map(fieldHtml).join('');
  document.getElementById('ob-next').textContent = step == steps.length - 1 ? 'Finish' : 'Continue';
  document.getElementById('ob-error').textContent = '';
}

function readStep() {
  steps[step].fields.forEach(f => {
    if (f.type == 'radio') {
      const picked = document.querySelector(`input[name="f-${f.key}"]:checked`);
      answers[f.key] = picked ? picked.value : '';
    } else if (f.type == 'multi') {
      const boxes = document.querySelectorAll(`input[name="f-${f.key}"]:checked`);
      answers[f.key] = [...boxes].map(b => b.value);
    } else {
      answers[f.key] = document.getElementById('f-' + f.key).value.trim();
    }
  });
}

function stepOk() {
  const missing = steps[step].fields.find(f => f.required && !answers[f.key]);
  if (missing) {
    document.getElementById('ob-error').textContent = 'Please answer: ' + missing.label;
    return false;
  }
  return true;
}

async function nextStep() {
  readStep();
  if (!stepOk()) return;

  if (step < steps.length - 1) {
    step++;
    drawStep();
  } else {
    await finishOnboarding();
  }
}

function prevStep() {
  readStep();
  if (step > 0) {
    step--;
    drawStep();
  }
}

async function finishOnboarding() {
  const btn = document.getElementById('ob-next');
  btn.disabled = true;

  const { error } = await db.from('onboarding_answers').upsert({ user_id: user.id, answers });

  if (error) {
    btn.disabled = false;
    document.getElementById('ob-error').textContent = "Couldn't save, try again.";
    return;
  }

  await db.from('profiles').upsert({
    id: user.id,
    org_name: answers.org_name,
    org_type: answers.entity_type,
    ein: answers.ein
  });

  btn.disabled = false;
  toast('Profile saved!');
  showScreen('dashboard');
}
