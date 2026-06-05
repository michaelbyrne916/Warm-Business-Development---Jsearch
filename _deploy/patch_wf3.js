// WF3 deploy patcher — swaps 2 code nodes, rebuilds Write columns, bumps max_tokens.
// Usage: node _deploy/patch_wf3.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
const env = mcp.mcpServers['n8n-mcp'].env;
const BASE = env.N8N_API_URL.replace(/\/+$/, '') + '/api/v1';
const KEY = env.N8N_API_KEY;
const WF_ID = 'T1jTXreAw0uZ2TOD';

const buildPromptCode = fs.readFileSync(path.join(__dirname, 'wf3_build_prompt.js'), 'utf8');
const parseCode = fs.readFileSync(path.join(__dirname, 'wf3_parse.js'), 'utf8');

const NEW_EMAIL_FIELDS = ['email_4_subject','email_4_body','email_5_subject','email_5_body','email_6_subject','email_6_body','email_7_subject','email_7_body','email_8_subject','email_8_body'];

async function main() {
  const getRes = await fetch(`${BASE}/workflows/${WF_ID}`, { headers: { 'X-N8N-API-KEY': KEY } });
  if (!getRes.ok) throw new Error(`GET failed ${getRes.status}: ${await getRes.text()}`);
  const wf = await getRes.json();

  const byId = {};
  for (const n of wf.nodes) byId[n.id] = n;

  // 1. Build Outreach Prompt
  byId['wf3-build-prompt'].parameters.jsCode = buildPromptCode;

  // 2. Parse LLM Response
  byId['wf3-parse-response'].parameters.jsCode = parseCode;

  // 3. Write to Outreach Queue — add email_4..8 to value map + schema
  const writeCols = byId['wf3-write-outreach-queue'].parameters.columns;
  for (const f of NEW_EMAIL_FIELDS) {
    writeCols.value[f] = `={{ $json.${f} }}`;
    if (!writeCols.schema.some(s => s.id === f)) {
      writeCols.schema.push({ id: f, displayName: f, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true });
    }
  }

  // 4. max_tokens 2500 -> 6000 on both LLM calls
  for (const id of ['wf3-claude-call','wf3-openai-call']) {
    const jb = byId[id].parameters.jsonBody;
    byId[id].parameters.jsonBody = jb.replace(/"max_tokens":\s*2500/, '"max_tokens": 6000');
  }

  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings };
  let putRes = await fetch(`${BASE}/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    console.log(`PUT(full settings) failed ${putRes.status}: ${errText}`);
    // Fallback: trim settings to universally-accepted subset
    const s = wf.settings || {};
    const safe = {};
    for (const k of ['executionOrder','saveDataErrorExecution','saveDataSuccessExecution','saveManualExecutions','saveExecutionProgress','executionTimeout','timezone','errorWorkflow','callerPolicy']) {
      if (s[k] !== undefined) safe[k] = s[k];
    }
    body.settings = safe;
    putRes = await fetch(`${BASE}/workflows/${WF_ID}`, {
      method: 'PUT',
      headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!putRes.ok) throw new Error(`PUT(safe settings) failed ${putRes.status}: ${await putRes.text()}`);
    console.log('PUT succeeded with trimmed settings subset:', JSON.stringify(safe));
  }

  const after = await (await fetch(`${BASE}/workflows/${WF_ID}`, { headers: { 'X-N8N-API-KEY': KEY } })).json();
  const a = {};
  for (const n of after.nodes) a[n.id] = n;
  console.log('=== WF3 PATCH COMPLETE ===');
  console.log('active:', after.active);
  console.log('nodeCount:', after.nodes.length);
  console.log('build-prompt jsCode length:', a['wf3-build-prompt'].parameters.jsCode.length);
  console.log('parse jsCode length:', a['wf3-parse-response'].parameters.jsCode.length);
  console.log('write value keys:', Object.keys(a['wf3-write-outreach-queue'].parameters.columns.value).length, '(expect 31)');
  console.log('write schema entries:', a['wf3-write-outreach-queue'].parameters.columns.schema.length, '(expect 32)');
  console.log('email_8_body in write value:', 'email_8_body' in a['wf3-write-outreach-queue'].parameters.columns.value);
  console.log('claude max_tokens 6000:', /"max_tokens":\s*6000/.test(a['wf3-claude-call'].parameters.jsonBody));
  console.log('openai max_tokens 6000:', /"max_tokens":\s*6000/.test(a['wf3-openai-call'].parameters.jsonBody));
  console.log('claude still 2500?:', /"max_tokens":\s*2500/.test(a['wf3-claude-call'].parameters.jsonBody));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
