const db = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

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
