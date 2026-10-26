window.onload = async () => {
  await loadPages();

  const { data } = await db.auth.getSession();
  if (data.session) {
    user = data.session.user;
    await afterLogin();
  } else {
    showScreen('landing');
  }
};
