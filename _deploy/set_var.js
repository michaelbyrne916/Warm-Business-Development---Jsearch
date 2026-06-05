// Generic n8n instance variable setter (create or update by key).
// Usage: node _deploy/set_var.js KEY VALUE
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
const env = mcp.mcpServers['n8n-mcp'].env;
const BASE = env.N8N_API_URL.replace(/\/+$/, '') + '/api/v1';
const KEY = env.N8N_API_KEY;
const H = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };

const VAR_KEY = process.argv[2];
const VAR_VAL = process.argv[3];
if (!VAR_KEY || VAR_VAL === undefined) { console.error('Usage: node set_var.js KEY VALUE'); process.exit(1); }

async function listVars() {
  let all = [], cursor = null;
  do {
    const res = await fetch(BASE + '/variables' + (cursor ? `?cursor=${cursor}` : ''), { headers: H });
    if (!res.ok) throw new Error(`GET /variables ${res.status}: ${await res.text()}`);
    const j = await res.json();
    all = all.concat(j.data || []);
    cursor = j.nextCursor || null;
  } while (cursor);
  return all;
}

async function main() {
  const vars = await listVars();
  const existing = vars.find(v => v.key === VAR_KEY);
  if (!existing) {
    const res = await fetch(`${BASE}/variables`, { method: 'POST', headers: H, body: JSON.stringify({ key: VAR_KEY, value: VAR_VAL }) });
    console.log(`${VAR_KEY} created status:`, res.status);
  } else if (existing.value === VAR_VAL) {
    console.log(`${VAR_KEY} already '${VAR_VAL}', no change.`);
  } else {
    let res = await fetch(`${BASE}/variables/${existing.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ key: VAR_KEY, value: VAR_VAL }) });
    if (!res.ok) res = await fetch(`${BASE}/variables/${existing.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ key: VAR_KEY, value: VAR_VAL }) });
    if (!res.ok) {
      await fetch(`${BASE}/variables/${existing.id}`, { method: 'DELETE', headers: H });
      res = await fetch(`${BASE}/variables`, { method: 'POST', headers: H, body: JSON.stringify({ key: VAR_KEY, value: VAR_VAL }) });
    }
    console.log(`${VAR_KEY} update status:`, res.status);
  }
  const after = await listVars();
  const v2 = after.find(v => v.key === VAR_KEY);
  console.log(`${VAR_KEY} now =`, v2 ? v2.value : '(missing)');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
