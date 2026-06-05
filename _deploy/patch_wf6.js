// WF6 deploy patcher — 8-email expansion:
//   - n05: completion trigger stage 7 (+ legacy stage-2 guard), Current Touch '1', _archive_payload
//   - n07: strip _company_for_summary before Sequence Tracker write
//   - new n14 (Split for OQ Archive): emits archive items from n05._archive_payload
//   - new n15 (Mark OQ Archived): Google Sheets appendOrUpdate on OQ, sets approval_status=ARCHIVED
//   - rewire: n08 -> n14 -> n15 -> n09 (was n08 -> n09)
// Usage: node _deploy/patch_wf6.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
const env = mcp.mcpServers['n8n-mcp'].env;
const BASE = env.N8N_API_URL.replace(/\/+$/, '') + '/api/v1';
const KEY = env.N8N_API_KEY;
const H = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };
const WF_ID = 'Zyba7eIcS0berpVA';

const n05Code = fs.readFileSync(path.join(__dirname, 'wf6_n05.js'), 'utf8');
const n07Code = fs.readFileSync(path.join(__dirname, 'wf6_n07.js'), 'utf8');
const n14Code = fs.readFileSync(path.join(__dirname, 'wf6_n14.js'), 'utf8');

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
  const byId = {};
  for (const n of wf.nodes) byId[n.id] = n;

  // --- Update n05 (Filter + Join + Dedup) ---
  byId['n05'].parameters.jsCode = n05Code;

  // --- Update n07 (Split Out to_add Items) ---
  byId['n07'].parameters.jsCode = n07Code;

  // --- Shift n09 and n10 right to make room for two new nodes ---
  byId['n09'].position = [2200, 160];
  byId['n10'].position = [2420, 160];

  // --- Add new node n14: Split for OQ Archive ---
  const n14 = {
    id: 'n14',
    name: 'Split for OQ Archive',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1760, 160],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: n14Code
    }
  };
  wf.nodes.push(n14);

  // --- Add new node n15: Mark OQ Archived ---
  const n15 = {
    id: 'n15',
    name: 'Mark OQ Archived',
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: 4,
    position: [1980, 160],
    credentials: {
      googleSheetsOAuth2Api: { id: '7dIWwoowtD1RTjmu', name: 'Google Sheets account' }
    },
    parameters: {
      operation: 'appendOrUpdate',
      documentId: { __rl: true, value: '192SvtVdg3hA0f4ZvHSWZTX2FG1HOzU_vw8jQA9md6no', mode: 'id' },
      sheetName: { __rl: true, value: 'Outreach Queue', mode: 'name' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          opportunity_id: '={{ $json.opportunity_id }}',
          approval_status: 'ARCHIVED'
        },
        matchingColumns: ['opportunity_id'],
        schema: [
          { id: 'opportunity_id', displayName: 'opportunity_id', required: false, defaultMatch: true, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'approval_status', displayName: 'approval_status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false }
        ]
      },
      options: {}
    }
  };
  wf.nodes.push(n15);

  // --- Rewire connections ---
  // Remove: Append to Sequence Tracker -> Prepare Handoff Summary
  // Add:    Append to Sequence Tracker -> Split for OQ Archive -> Mark OQ Archived -> Prepare Handoff Summary
  wf.connections['Append to Sequence Tracker'] = {
    main: [[{ node: 'Split for OQ Archive', type: 'main', index: 0 }]]
  };
  wf.connections['Split for OQ Archive'] = {
    main: [[{ node: 'Mark OQ Archived', type: 'main', index: 0 }]]
  };
  wf.connections['Mark OQ Archived'] = {
    main: [[{ node: 'Prepare Handoff Summary', type: 'main', index: 0 }]]
  };

  // --- Update sticky note ---
  byId['n13'].parameters.content = `## WF6: Warm → Cold Handoff\n\nRuns every Sunday at 5am.\n\n**Completion triggers (8-email expansion):**\n- 8-email contacts: \`follow_up_stage === 7\` (all 8 emails sent)\n- Legacy 3-email contacts: \`follow_up_stage === 2\` AND \`email_4_body\` blank\n\n**Flow:**\n1. Read OQ, Contacts tab, Sequence Tracker\n2. Filter to completion-stage rows (sent, not REJECT/ARCHIVED/HELD, ≥5 days since last send)\n3. Dedup against Sequence Tracker\n4. IF contacts to add:\n   a. Split + append to Sequence Tracker (Current Touch = 1)\n   b. Split for OQ Archive → Mark OQ Archived (sets approval_status=ARCHIVED on all OQ rows for each opportunity_id)\n   c. Send handoff summary email\n5. ELSE: send no-contacts summary\n\n**Archive ownership:**\nWF6 sets ARCHIVED after Sequence Tracker append.\nWF5 sweeps ARCHIVED rows out of OQ next morning.\n\n**Current Touch:** set to 1 (cold sequence starts fresh from Touch 1).`;

  await put(wf);

  // --- Verify ---
  const after = await (await fetch(`${BASE}/workflows/${WF_ID}`, { headers: H })).json();
  const a = {};
  for (const n of after.nodes) a[n.id] = n;

  console.log('=== WF6 PATCH COMPLETE ===');
  console.log('active:', after.active, '| nodeCount:', after.nodes.length, '(expect 15)');
  console.log('n05 has 8-email trigger (followUpStage === 7):', /followUpStage === 7/.test(a['n05'].parameters.jsCode));
  console.log('n05 has legacy trigger (isLegacyComplete):', /isLegacyComplete/.test(a['n05'].parameters.jsCode));
  console.log('n05 Current Touch is 1:', /Current Touch.*1/.test(a['n05'].parameters.jsCode));
  console.log('n05 has _archive_payload:', /_archive_payload/.test(a['n05'].parameters.jsCode));
  console.log('n07 strips _company_for_summary:', /_company_for_summary/.test(a['n07'].parameters.jsCode));
  console.log('n14 exists (Split for OQ Archive):', !!a['n14']);
  console.log('n15 exists (Mark OQ Archived):', !!a['n15']);
  const conns = after.connections;
  console.log('n08 -> n14:', conns['Append to Sequence Tracker']?.main[0]?.[0]?.node === 'Split for OQ Archive');
  console.log('n14 -> n15:', conns['Split for OQ Archive']?.main[0]?.[0]?.node === 'Mark OQ Archived');
  console.log('n15 -> n09:', conns['Mark OQ Archived']?.main[0]?.[0]?.node === 'Prepare Handoff Summary');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
