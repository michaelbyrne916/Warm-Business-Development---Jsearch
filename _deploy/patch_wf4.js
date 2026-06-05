// WF4 deploy patcher — swaps 2 code nodes, adds email_4..8 to Write Follow-ups columns.
// Usage: node _deploy/patch_wf4.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
const env = mcp.mcpServers['n8n-mcp'].env;
const BASE = env.N8N_API_URL.replace(/\/+$/, '') + '/api/v1';
const KEY = env.N8N_API_KEY;
const H = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };
const WF_ID = 'QG8tNjLdKCQkZpWA';

const buildFollowups = fs.readFileSync(path.join(__dirname, 'wf4_build_followups.js'), 'utf8');
const prepareSend = fs.readFileSync(path.join(__dirname, 'wf4_prepare_send.js'), 'utf8');

const NEW_EMAIL_FIELDS = ['email_4_subject','email_4_body','email_5_subject','email_5_body','email_6_subject','email_6_body','email_7_subject','email_7_body','email_8_subject','email_8_body'];

async function put(body) {
  let res = await fetch(`${BASE}/workflows/${WF_ID}`, { method: 'PUT', headers: H, body: JSON.stringify(body) });
  if (!res.ok) {
    console.log(`PUT(full settings) failed ${res.status}: ${await res.text()}`);
    const s = body.settings || {};
    const safe = {};
    for (const k of ['executionOrder','saveDataErrorExecution','saveDataSuccessExecution','saveManualExecutions','saveExecutionProgress','executionTimeout','timezone','errorWorkflow','callerPolicy']) {
      if (s[k] !== undefined) safe[k] = s[k];
    }
    body.settings = safe;
    res = await fetch(`${BASE}/workflows/${WF_ID}`, { method: 'PUT', headers: H, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`PUT(safe) failed ${res.status}: ${await res.text()}`);
    console.log('PUT succeeded with trimmed settings:', JSON.stringify(safe));
  }
}

async function main() {
  const wf = await (await fetch(`${BASE}/workflows/${WF_ID}`, { headers: H })).json();
  const byId = {};
  for (const n of wf.nodes) byId[n.id] = n;

  byId['wf4-build-followups'].parameters.jsCode = buildFollowups;
  byId['wf4-prepare-send-fields'].parameters.jsCode = prepareSend;

  const cols = byId['wf4-write-followups'].parameters.columns;
  for (const f of NEW_EMAIL_FIELDS) {
    cols.value[f] = `={{ $json.${f} }}`;
    if (!cols.schema.some(s => s.id === f)) {
      cols.schema.push({ id: f, displayName: f, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true });
    }
  }

  await put({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });

  const after = await (await fetch(`${BASE}/workflows/${WF_ID}`, { headers: H })).json();
  const a = {};
  for (const n of after.nodes) a[n.id] = n;
  console.log('=== WF4 PATCH COMPLETE ===');
  console.log('active:', after.active, '| nodeCount:', after.nodes.length);
  console.log('build-followups references nextStage>7:', /nextStage > 7/.test(a['wf4-build-followups'].parameters.jsCode));
  console.log('build-followups has empty-body guard:', /legacy 3-email/.test(a['wf4-build-followups'].parameters.jsCode));
  console.log('prepare-send uses email_+idx:', /email_' \+ idx \+ '_body/.test(a['wf4-prepare-send-fields'].parameters.jsCode));
  console.log('write-followups value keys:', Object.keys(a['wf4-write-followups'].parameters.columns.value).length, '(expect 28)');
  console.log('email_8_body in write value:', 'email_8_body' in a['wf4-write-followups'].parameters.columns.value);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
