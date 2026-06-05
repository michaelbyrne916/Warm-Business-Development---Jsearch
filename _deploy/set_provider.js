// Flip n8n instance variable LLM_PROVIDER -> 'anthropic' and report ANTHROPIC_MODEL.
// Usage: node _deploy/set_provider.js [value]   (default value: anthropic)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
const env = mcp.mcpServers['n8n-mcp'].env;
const BASE = env.N8N_API_URL.replace(/\/+$/, '') + '/api/v1';
const KEY = env.N8N_API_KEY;
const H = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };
const TARGET = process.argv[2] || 'anthropic';

const mask = (k, v) => /key|secret|token|password/i.test(k) ? '***masked***' : v;

async function listVars() {
  let all = [], cursor = null;
  do {
    const url = BASE + '/variables' + (cursor ? `?cursor=${cursor}` : '');
    const res = await fetch(url, { headers: H });
    if (!res.ok) throw new Error(`GET /variables ${res.status}: ${await res.text()}`);
    const j = await res.json();
    all = all.concat(j.data || []);
    cursor = j.nextCursor || null;
  } while (cursor);
  return all;
}

async function main() {
  const vars = await listVars();
  console.log('--- current variables ---');
  for (const v of vars) console.log(`${v.key} = ${mask(v.key, v.value)}`);

  const lp = vars.find(v => v.key === 'LLM_PROVIDER');
  const am = vars.find(v => v.key === 'ANTHROPIC_MODEL');
  console.log('\nANTHROPIC_MODEL present:', !!am, am ? `(value: ${am.value})` : '(MISSING -> node falls back to claude-opus-4-6)');

  if (!lp) {
    const res = await fetch(`${BASE}/variables`, { method: 'POST', headers: H, body: JSON.stringify({ key: 'LLM_PROVIDER', value: TARGET }) });
    console.log('LLM_PROVIDER created:', res.status);
  } else if (lp.value === TARGET) {
    console.log(`LLM_PROVIDER already '${TARGET}', no change.`);
  } else {
    // try PUT, then PATCH, then DELETE+POST
    let res = await fetch(`${BASE}/variables/${lp.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ key: 'LLM_PROVIDER', value: TARGET }) });
    if (!res.ok) {
      console.log('PUT failed', res.status, '- trying PATCH');
      res = await fetch(`${BASE}/variables/${lp.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ key: 'LLM_PROVIDER', value: TARGET }) });
    }
    if (!res.ok) {
      console.log('PATCH failed', res.status, '- trying DELETE + POST');
      const del = await fetch(`${BASE}/variables/${lp.id}`, { method: 'DELETE', headers: H });
      console.log('delete status', del.status);
      res = await fetch(`${BASE}/variables`, { method: 'POST', headers: H, body: JSON.stringify({ key: 'LLM_PROVIDER', value: TARGET }) });
    }
    console.log('LLM_PROVIDER update final status:', res.status);
  }

  const after = await listVars();
  const lp2 = after.find(v => v.key === 'LLM_PROVIDER');
  console.log('\nLLM_PROVIDER now =', lp2 ? lp2.value : '(missing)');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
