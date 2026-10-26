const cfg = window.SUPABASE_CONFIG;
const db = cfg.url ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;

let user = null;
let answers = {};

async function callFn(name, body) {
  const { data, error } = await db.functions.invoke(name, { body });
  if (error) {
    console.log(name, error);
    return null;
  }
  return data;
}
