window.onload = async () => {
  await loadPages();

  if (!window.SUPABASE_CONFIG.url) {
    showScreen('landing');
    toast('Supabase is not set up yet, see config.js');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') == 'success') toast('Thanks! Your plan is active.');
  if (params.get('payment') == 'cancelled') toast('Checkout cancelled.');
  if (params.has('payment')) history.replaceState(null, '', window.location.pathname);

  const { data } = await db.auth.getSession();
  if (data.session) {
    user = data.session.user;
    await afterLogin();
  } else {
    showScreen('landing');
  }
};
