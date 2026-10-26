const screens = ['landing', 'login', 'onboarding', 'dashboard', 'discover',
  'readiness', 'generator', 'deadlines', 'chat', 'profile'];

const loaders = {
  dashboard: () => loadDashboard(),
  discover: () => { if (allGrants.length == 0) loadGrants(); },
  readiness: () => loadReadiness(),
  deadlines: () => loadDeadlines(),
  profile: () => loadProfile()
};

// each screen's html lives in pages/, pull them all in once at startup
async function loadPages() {
  const app = document.getElementById('app');
  let htmls;
  try {
    htmls = await Promise.all(screens.map(s => fetch('pages/' + s + '.html').then(r => r.text())));
  } catch (e) {
    app.innerHTML = '<p class="error">Could not load the pages. Open the site through a web server, not as a file.</p>';
    throw e;
  }

  screens.forEach((s, i) => {
    const section = document.createElement('section');
    section.id = s;
    section.className = 'screen hidden';
    section.innerHTML = htmls[i];
    app.appendChild(section);
  });
}

function showScreen(name) {
  screens.forEach(s => document.getElementById(s).classList.add('hidden'));
  document.getElementById(name).classList.remove('hidden');
  window.scrollTo(0, 0);

  if (loaders[name]) loaders[name]();
}
