const plans = {
  starter: { monthly: 14.99, yearly: 120 },
  pro: { monthly: 35.99, yearly: 300 }
};

let billing = 'monthly';

function setBilling(type) {
  billing = type;
  document.getElementById('monthly-btn').classList.toggle('on', type == 'monthly');
  document.getElementById('yearly-btn').classList.toggle('on', type == 'yearly');

  const per = type == 'monthly' ? ' / month' : ' / year';
  document.getElementById('starter-price').textContent = '$' + plans.starter[type] + per;
  document.getElementById('pro-price').textContent = '$' + plans.pro[type] + per;
}

async function buyPlan(plan) {
  if (!user) {
    showScreen('login');
    return;
  }

  const data = await callFn('create-checkout', { plan, billing });
  if (data && data.url) {
    window.location.href = data.url;
  } else {
    toast("Couldn't start checkout.");
  }
}
