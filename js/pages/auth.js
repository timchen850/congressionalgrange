let signingUp = false;

function toggleSignUp() {
  signingUp = !signingUp;
  document.getElementById('login-title').textContent = signingUp ? 'Create an account' : 'Log in';
  document.getElementById('switch-link').textContent = signingUp
    ? 'Already have an account? Log in'
    : "Don't have an account? Sign up";
}

async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const pw = document.getElementById('password').value;
  const err = document.getElementById('login-error');

  if (!email || !pw) {
    err.textContent = 'Please enter your email and password.';
    return;
  }
  if (signingUp && pw.length < 6) {
    err.textContent = 'Password needs to be at least 6 characters.';
    return;
  }

  const res = signingUp
    ? await db.auth.signUp({ email, password: pw })
    : await db.auth.signInWithPassword({ email, password: pw });

  if (res.error) {
    err.textContent = res.error.message;
    return;
  }

  // signUp with email confirmation on gives back no session
  if (!res.data.session) {
    err.textContent = 'Check your email to confirm your account.';
    return;
  }

  err.textContent = '';
  user = res.data.user;
  await afterLogin();
}

async function logInWithGoogle() {
  await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
}

async function afterLogin() {
  document.getElementById('navbar').classList.remove('hidden');

  const { data } = await db.from('onboarding_answers').select('answers').eq('user_id', user.id).maybeSingle();

  if (data && data.answers) {
    answers = data.answers;
    showScreen('dashboard');
  } else {
    startOnboarding();
  }
}

async function logOut() {
  await db.auth.signOut();
  user = null;
  answers = {};
  allGrants = [];
  document.getElementById('navbar').classList.add('hidden');
  showScreen('landing');
}
