// Tiny Supabase Management API helper (HTTPS only). Never logs the token.
//   SUPABASE_ACCESS_TOKEN=<personal access token> SUPABASE_PROJECT_REF=<ref>
const API = 'https://api.supabase.com/v1';
const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Set ${k}`); process.exit(1); } return v; };

export async function mgmt(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${API}/projects/${need('SUPABASE_PROJECT_REF')}${path}`, {
    method, headers: { authorization: `Bearer ${need('SUPABASE_ACCESS_TOKEN')}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Management API ${method} ${path}: ${r.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
export const mgmtQuery = (query) => mgmt('/database/query', { method: 'POST', body: { query } });
