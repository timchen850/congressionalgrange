function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// "2026-05-01" gets read as UTC and shows up a day early, so add a time
function toDate(str) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) str += 'T00:00:00';
  return new Date(str);
}

function daysUntil(str) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((toDate(str) - today) / 86400000);
}

function money(n) {
  if (!n || isNaN(n)) return 'Not listed';
  return '$' + Number(n).toLocaleString();
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
