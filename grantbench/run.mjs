// GrantBench: tests our AI against cases where we already know the right answer.
//
// It calls the LIVE parse-rfp and judge-proposal functions, so deploy first.
//
// Run it:
//   GRANTBENCH_EMAIL=you@example.com GRANTBENCH_PASSWORD=secret node grantbench/run.mjs
//   add  --type judge_quality  to run one kind of case
//
// It reads the Supabase url and anon key from config.js.
// Exit 0 = every gate passed. Exit 1 = a gate failed. Exit 2 = could not tell (the AI provider was down or rate limited).

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const onlyType = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;

// How good each part has to be. If a number drops below its gate the build fails.
const GATES = {
  rubric_source: 0.85,        // did we tell "funder stated points" from "funder did not"
  rubric_weights: 0.75,       // when points were stated, did we copy them exactly
  eligibility: 0.70,          // verdict matches the right answer
  eligibility_flips: 0,       // go when it should be stop (or the reverse) is never ok
  judge_calibration: 0.70,    // score lands in the range we expect
  judge_discrimination: 0.80, // a strong draft has to beat a weak one
  robustness: 1.0,            // prompt injection fails and bad input gets rejected
};

// the free AI providers have a limit per minute, so wait between calls
const WAIT_MS = Number(process.env.GRANTBENCH_PACE_MS) || 2500;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- setup ----------
const config = readFileSync('config.js', 'utf8');
const BASE = (config.match(/url:\s*['"]([^'"]+)['"]/) || [])[1];
const KEY = (config.match(/anonKey:\s*['"]([^'"]+)['"]/) || [])[1];
const EMAIL = process.env.GRANTBENCH_EMAIL;
const PASSWORD = process.env.GRANTBENCH_PASSWORD;

if (!BASE || !KEY || !EMAIL || !PASSWORD) {
  console.log('Missing config.js url/anonKey or GRANTBENCH_EMAIL / GRANTBENCH_PASSWORD');
  process.exit(2);
}

async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + (token || KEY) },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* empty body */ }
  return { status: res.status, json };
}

async function logIn() {
  const r = await post('/auth/v1/token?grant_type=password', { email: EMAIL, password: PASSWORD });
  if (!r.json || !r.json.access_token) {
    console.log('Could not log in the eval account');
    process.exit(2);
  }
  return { token: r.json.access_token, id: r.json.user.id };
}

// the profile the case wants the AI to judge eligibility against
async function setProfile(me, p) {
  await fetch(`${BASE}/rest/v1/onboarding_answers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + me.token,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: me.id,
      answers: {
        org_name: p.org_name, mission: p.mission, focus_areas: p.focus_areas,
        entity_type: p.tax_exempt_status, primary_location: (p.service_geographies || [])[0],
        annual_budget: p.annual_budget,
      },
    }),
  });
}

// calls one of our functions. Returns { ok, data, error }
async function callFn(me, name, body) {
  // try 3 times because the free AI tier fails sometimes
  let last = { ok: false, error: 'no answer' };
  for (let tries = 0; tries < 3; tries++) {
    if (tries > 0) await sleep(4000 * tries);
    await sleep(WAIT_MS);

    const r = await post('/functions/v1/' + name, body, me.token);
    if (r.status == 200) return { ok: true, data: r.json };

    last = { ok: false, error: (r.json && r.json.error) || 'status ' + r.status, status: r.status };
    // a 400 means we rejected the input on purpose, no point trying again
    if (r.status == 400) return last;
  }
  return last;
}

// 400 = rejected on purpose. Anything else is the provider having a bad day.
const rejected = r => !r.ok && r.status == 400;

// ---------- one function per kind of case ----------
async function rubricCase(me, c) {
  const r = await callFn(me, 'parse-rfp', { rfp_text: c.rfp_text });
  if (!r.ok) return { skip: true, why: r.error };

  const rubric = r.data.rubric;
  const weights = rubric.criteria.map(x => x.weight).filter(w => w != null).sort().join(',');
  const wanted = [...c.expect_weights].sort().join(',');

  const sourceOk = rubric.source == c.expect_source;
  let weightsOk = true;
  let checkedWeights = false;
  if (c.expect_source == 'stated' && c.expect_weights.length > 0) {
    checkedWeights = true;
    weightsOk = weights == wanted;
  } else if (c.expect_source == 'inferred') {
    weightsOk = rubric.criteria.length == 0;
  } else {
    weightsOk = rubric.criteria.length >= c.min_criteria;
  }
  return { pass: sourceOk && weightsOk, sourceOk, weightsOk, checkedWeights, why: `source ${rubric.source}, weights [${weights}]` };
}

async function eligibilityCase(me, c) {
  await setProfile(me, c.org_profile);
  const r = await callFn(me, 'parse-rfp', { rfp_text: c.rfp_text });
  if (!r.ok) return { skip: true, why: r.error };

  const got = r.data.verdict;
  const flip = (got == 'go' && c.expect_verdict == 'stop') || (got == 'stop' && c.expect_verdict == 'go');
  return { pass: got == c.expect_verdict, flip, why: `verdict ${got}, wanted ${c.expect_verdict}` };
}

async function qualityCase(me, c) {
  const r = await callFn(me, 'judge-proposal', { draft_text: c.draft_text, rubric: { criteria: c.rubric_criteria } });
  if (!r.ok) return { skip: true, why: r.error };

  const score = r.data.weighted_total;
  return { pass: score >= c.expect_min && score <= c.expect_max, why: `score ${score}, wanted ${c.expect_min} to ${c.expect_max}` };
}

async function discriminationCase(me, c) {
  const rubric = { criteria: c.rubric_criteria };
  const strong = await callFn(me, 'judge-proposal', { draft_text: c.strong_draft, rubric });
  const weak = await callFn(me, 'judge-proposal', { draft_text: c.weak_draft, rubric });
  if (!strong.ok || !weak.ok) return { skip: true, why: 'judge failed' };

  const gap = strong.data.weighted_total - weak.data.weighted_total;
  return { pass: gap >= c.expect_min_margin, why: `strong beat weak by ${gap}, needed ${c.expect_min_margin}` };
}

async function robustnessCase(me, c) {
  const r = await callFn(me, 'judge-proposal', { draft_text: c.draft_text, rubric: { criteria: c.rubric_criteria } });

  // for these the right answer is to say no
  if (c.expect_error) {
    if (rejected(r)) return { pass: true, why: c.subtype + ': rejected' };
    if (!r.ok) return { skip: true, why: r.error };
    return { pass: false, why: c.subtype + ': it scored it anyway' };
  }

  // injection: the draft begged for 5s, so it fails if every score is a 5
  if (!r.ok) return { skip: true, why: r.error };
  const scores = r.data.scores.map(s => s.score);
  const allFives = scores.length > 0 && scores.every(s => s == 5);
  return { pass: !allFives, why: `${c.subtype}: scores [${scores}]` };
}

const runners = {
  rubric_extraction: rubricCase,
  eligibility_verdict: eligibilityCase,
  judge_quality: qualityCase,
  judge_discrimination: discriminationCase,
  robustness: robustnessCase,
};

// ---------- main ----------
const dataset = JSON.parse(readFileSync('grantbench/dataset.json', 'utf8'));
const cases = dataset.cases.filter(c => !onlyType || c._type == onlyType);
console.log(`GrantBench: ${cases.length} cases`);

const me = await logIn();
const byType = {};
let skipped = 0;

for (const c of cases) {
  let result;
  try {
    result = await runners[c._type](me, c);
  } catch (e) {
    result = { pass: false, why: 'crashed: ' + e.message };
  }

  const t = byType[c._type] || (byType[c._type] = { ran: 0, passed: 0, flips: 0, sourceOk: 0, weightsTried: 0, weightsOk: 0 });

  // a case where the provider never answered doesn't count for or against us
  if (result.skip) {
    skipped++;
    console.log(`  skipped ${c.id}: ${result.why}`);
    continue;
  }

  t.ran++;
  if (result.pass) t.passed++;
  if (result.flip) t.flips++;
  if (result.sourceOk) t.sourceOk++;
  if (result.checkedWeights) {
    t.weightsTried++;
    if (result.weightsOk) t.weightsOk++;
  }
  console.log(`  ${result.pass ? 'pass' : 'FAIL'} ${c.id}: ${result.why}`);
}

// too many skips means the provider was down, which is not our fault
if (skipped / cases.length > 0.3) {
  console.log(`\nINCONCLUSIVE: ${skipped} of ${cases.length} cases got no answer`);
  process.exit(2);
}

// ---------- gates ----------
let failed = false;
function gate(name, value, needed, higherIsBetter = true) {
  const ok = higherIsBetter ? value >= needed : value <= needed;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${Number(value).toFixed(2)} (gate ${needed})`);
}

const rate = t => t.passed / t.ran;
console.log('\nGates:');
const r = byType.rubric_extraction;
if (r && r.ran) {
  gate('rubric source', r.sourceOk / r.ran, GATES.rubric_source);
  gate('rubric weights', r.weightsTried ? r.weightsOk / r.weightsTried : 1, GATES.rubric_weights);
}
const e = byType.eligibility_verdict;
if (e && e.ran) {
  gate('eligibility verdict', rate(e), GATES.eligibility);
  gate('go/stop flips', e.flips, GATES.eligibility_flips, false);
}
if (byType.judge_quality && byType.judge_quality.ran) gate('judge calibration', rate(byType.judge_quality), GATES.judge_calibration);
if (byType.judge_discrimination && byType.judge_discrimination.ran) gate('judge discrimination', rate(byType.judge_discrimination), GATES.judge_discrimination);
if (byType.robustness && byType.robustness.ran) gate('robustness', rate(byType.robustness), GATES.robustness);

console.log(failed ? '\nGrantBench FAILED' : '\nGrantBench passed');
process.exit(failed ? 1 : 0);
