window.onload = async () => {
  await loadPages();

  if (!window.SUPABASE_CONFIG.url) {
    showScreen('landing');
    toast('Supabase is not set up yet, see config.js');
    return;
  }

  const { data } = await db.auth.getSession();
  if (data.session) {
    user = data.session.user;
    await afterLogin();
  } else {
    showScreen('landing');
  }
};
