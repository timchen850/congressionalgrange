let deadlines = [];

async function loadDeadlines() {
  const { data } = await db.from('deadlines').select('*').eq('user_id', user.id).order('due_date');
  deadlines = data || [];
  drawDeadlines();
}

function dueLabel(d) {
  if (d.done) return 'Done';
  const days = daysUntil(d.due_date);
  if (days < 0) return 'Overdue!';
  if (days == 0) return 'Due today';
  if (days == 1) return 'Due tomorrow';
  return days + ' days left';
}

function drawDeadlines() {
  const html = deadlines.map(d => `
    <li class="card">
      <b>${esc(d.title)}</b> - ${d.due_date} (${dueLabel(d)})
      ${d.done ? '' : `<button class="btn-outline" onclick="markDone(${d.id})">Mark done</button>`}
      <button class="btn-outline" onclick="deleteDeadline(${d.id})">Delete</button>
    </li>`).join('');

  document.getElementById('deadline-list').innerHTML = html || '<p>No deadlines yet. Save a grant or add one above.</p>';
}

async function addDeadline() {
  const title = document.getElementById('dl-title').value.trim();
  const date = document.getElementById('dl-date').value;

  if (!title || !date) {
    toast('Fill in both boxes.');
    return;
  }

  await db.from('deadlines').insert({ user_id: user.id, title, due_date: date });

  document.getElementById('dl-title').value = '';
  document.getElementById('dl-date').value = '';
  loadDeadlines();
}

async function markDone(id) {
  await db.from('deadlines').update({ done: true }).eq('id', id);
  loadDeadlines();
}

async function deleteDeadline(id) {
  if (!confirm('Delete this deadline?')) return;
  await db.from('deadlines').delete().eq('id', id);
  loadDeadlines();
}

function downloadCalendar() {
  const open = deadlines.filter(d => !d.done);
  if (open.length == 0) {
    toast('No open deadlines to export.');
    return;
  }

  // .ics needs \r\n line endings or Outlook won't open it
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Grange AI//EN'];
  open.forEach(d => {
    lines.push('BEGIN:VEVENT');
    lines.push('UID:grange-' + d.id + '@grangeai.net');
    lines.push('DTSTART;VALUE=DATE:' + d.due_date.replace(/-/g, ''));
    lines.push('SUMMARY:' + d.title.replace(/,/g, '\\,'));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  a.download = 'grant-deadlines.ics';
  a.click();
}
