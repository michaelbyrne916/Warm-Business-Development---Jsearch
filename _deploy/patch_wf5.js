// WF5 deploy patcher — removes stage>=2 completed auto-archive; updates sticky note.
// Usage: node _deploy/patch_wf5.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
const env = mcp.mcpServers['n8n-mcp'].env;
const BASE = env.N8N_API_URL.replace(/\/+$/, '') + '/api/v1';
const KEY = env.N8N_API_KEY;
const H = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };
const WF_ID = 'acdY3wEi8Y7RElks';
const classifyCode = fs.readFileSync(path.join(__dirname, 'wf5_classify.js'), 'utf8');

async function put(wf) {
  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings };
  let res = await fetch(`${BASE}/workflows/${WF_ID}`, { method: 'PUT', headers: H, body: JSON.stringify(body) });
  if (!res.ok) {
    const s = wf.settings || {};
    const safe = {};
    for (const k of ['executionOrder','saveDataErrorExecution','saveDataSuccessExecution','saveManualExecutions','callerPolicy']) {
      if (s[k] !== undefined) safe[k] = s[k];
    }
    body.settings = safe;
    res = await fetch(`${BASE}/workflows/${WF_ID}`, { method: 'PUT', headers: H, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`PUT failed ${res.status}: ${await res.text()}`);
    console.log('PUT with trimmed settings:', JSON.stringify(safe));
  }
}

async function main() {
  const wf = await (await fetch(`${BASE}/workflows/${WF_ID}`, { headers: H })).json();
  const byId = {}; for (const n of wf.nodes) byId[n.id] = n;

  byId['wf5-classify'].parameters.jsCode = classifyCode;

  byId['wf5-sticky'].parameters.content = `## WF5: Maintenance & Dedupe\n\nRuns daily at 6am to keep the Outreach Queue clean.\n\n**Flow:**\n1. Read all rows from Outreach Queue\n2. Classify rows: rejected, stale, dupes, ARCHIVED\n3. Append archive candidates to Archive tab\n4. Clear queue data rows\n5. Rewrite only active/keep rows back\n6. Send daily summary email\n\n**Archive reasons:**\n- rejected: approval_status=rejected\n- stale_pending: pending + posted >14 days ago\n- dupe_removed: duplicate email in queue\n- reconciliation_archived: approval_status=ARCHIVED (set by WF6 after Cold BD handoff)\n\n**NOTE: stage>=2 completed auto-archive removed.**\nWF6 now owns terminal archiving of finished contacts.\nWF6 sets ARCHIVED after Sequence Tracker append; WF5 sweeps it next morning.\n\n**Schedule:** Daily at 6:00 AM\n\n**Env vars needed:**\n- GOOGLE_SHEETS_ID\n- GMAIL_SENDER`;

  await put(wf);

  const after = await (await fetch(`${BASE}/workflows/${WF_ID}`, { headers: H })).json();
  const a = {}; for (const n of after.nodes) a[n.id] = n;
  console.log('=== WF5 PATCH COMPLETE ===');
  console.log('active:', after.active, '| nodeCount:', after.nodes.length);
  console.log('classify has no followUpStage>=2 completed block:', !/followUpStage >= 2/.test(a['wf5-classify'].parameters.jsCode));
  console.log('classify still has archived sweep:', /reconciliation_archived/.test(a['wf5-classify'].parameters.jsCode));
  console.log('classify still has rejected sweep:', /rejected/.test(a['wf5-classify'].parameters.jsCode));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
