// WF3 spot-test — clones the live generate+parse chain into a throwaway workflow,
// feeds one synthetic opportunity, prints the 8 emails + candidate_track, then deletes it.
// No OQ write node is included, so nothing touches the production sheet.
// Usage: node _deploy/spottest_wf3.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
const env = mcp.mcpServers['n8n-mcp'].env;
const ORIGIN = env.N8N_API_URL.replace(/\/+$/, '');
const BASE = ORIGIN + '/api/v1';
const KEY = env.N8N_API_KEY;
const WF_ID = 'T1jTXreAw0uZ2TOD';
const WEBHOOK_PATH = 'wf3-spottest-001';

const H = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };

const SAMPLE_CODE = `return [{ json: {
  opportunity_id: 'SPOTTEST-IT-001',
  company_name: 'Brightwave Robotics',
  company_domain: 'brightwaverobotics.com',
  company_industry: 'Industrial Automation and Robotics',
  company_hq: 'Fremont, CA',
  company_summary: 'Designs and builds autonomous mobile robots for warehouse and manufacturing logistics.',
  hiring_signals: 'Posted four engineering roles in the last two weeks and recently announced a Series B raise.',
  tech_stack: 'Python, ROS2, AWS, Kubernetes, C++',
  job_title: 'Senior Cloud Infrastructure Engineer',
  location: 'Fremont, CA (Hybrid)',
  seniority: 'Senior',
  employment_type: 'Full-time',
  skills: 'AWS, Kubernetes, Terraform, CI/CD, Python',
  job_description: 'We are looking for a Senior Cloud Infrastructure Engineer to scale the cloud platform that powers our robot fleet. You will own our AWS environment, build Kubernetes based deployment pipelines, harden security, and partner with the robotics software team to support real time data from hundreds of devices in the field. Experience with Terraform, observability tooling, and high availability systems matters.',
  contact_name: 'Dana Whitmore',
  contact_title: 'VP of Engineering',
  contact_email: 'dana.whitmore@brightwaverobotics.com',
  contact_reasoning: 'Most senior engineering leader and the likely owner or influencer of infrastructure hiring.',
  posted_date: '2026-06-01',
  source_url: 'https://example.com/jobs/brightwave-cloud-infra'
}}];`;

async function main() {
  const wf = await (await fetch(`${BASE}/workflows/${WF_ID}`, { headers: H })).json();
  const byName = {};
  for (const n of wf.nodes) byName[n.name] = n;
  const clone = (name) => JSON.parse(JSON.stringify(byName[name]));

  const cloneNames = ['Build Outreach Prompt','LLM Provider Router','Claude API Call','OpenAI GPT-4o Call','Merge LLM Output','Parse LLM Response'];
  const cloned = cloneNames.map(clone);

  const webhook = {
    id: 'st-webhook', name: 'ST Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2,
    position: [-400, 384],
    parameters: { httpMethod: 'POST', path: WEBHOOK_PATH, responseMode: 'lastNode', responseData: 'firstEntryJson', options: {} }
  };
  const sample = {
    id: 'st-sample', name: 'Sample Opportunity', type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [-180, 384], parameters: { jsCode: SAMPLE_CODE }
  };

  const nodes = [webhook, sample, ...cloned];
  const connections = {
    'ST Webhook': { main: [[{ node: 'Sample Opportunity', type: 'main', index: 0 }]] },
    'Sample Opportunity': { main: [[{ node: 'Build Outreach Prompt', type: 'main', index: 0 }]] },
    'Build Outreach Prompt': { main: [[{ node: 'LLM Provider Router', type: 'main', index: 0 }]] },
    'LLM Provider Router': { main: [
      [{ node: 'Claude API Call', type: 'main', index: 0 }],
      [{ node: 'OpenAI GPT-4o Call', type: 'main', index: 0 }]
    ] },
    'Claude API Call': { main: [[{ node: 'Merge LLM Output', type: 'main', index: 0 }]] },
    'OpenAI GPT-4o Call': { main: [[{ node: 'Merge LLM Output', type: 'main', index: 1 }]] },
    'Merge LLM Output': { main: [[{ node: 'Parse LLM Response', type: 'main', index: 0 }]] }
  };

  const createBody = { name: 'ZZ_SPOTTEST_WF3 (delete me)', nodes, connections, settings: { executionOrder: 'v1' } };
  const created = await (await fetch(`${BASE}/workflows`, { method: 'POST', headers: H, body: JSON.stringify(createBody) })).json();
  const stId = created.id;
  if (!stId) { console.log('CREATE FAILED:', JSON.stringify(created)); return; }
  console.log('spot-test workflow created:', stId);

  const act = await fetch(`${BASE}/workflows/${stId}/activate`, { method: 'POST', headers: H });
  console.log('activate status:', act.status);

  try {
    // small settle delay so the production webhook registers
    await new Promise(r => setTimeout(r, 3000));
    const resp = await fetch(`${ORIGIN}/webhook/${WEBHOOK_PATH}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const text = await resp.text();
    console.log('webhook status:', resp.status);
    let out;
    try { out = JSON.parse(text); } catch { out = null; }

    console.log('\n========== SPOT TEST RESULT ==========');
    if (out) {
      const r = Array.isArray(out) ? out[0] : out;
      console.log('candidate_track:', r.candidate_track);
      console.log('_parse_status:', r._parse_status);
      console.log('personalization_angle:', r.personalization_angle);
      console.log('recipient_reasoning:', r.recipient_reasoning);
      console.log('scaling_hypothesis:', r.scaling_hypothesis);
      for (let i = 1; i <= 8; i++) {
        console.log(`\n----- EMAIL ${i} -----`);
        console.log('SUBJECT:', r['email_' + i + '_subject']);
        console.log(r['email_' + i + '_body']);
      }
    } else {
      console.log('RAW RESPONSE (not JSON):\n', text.slice(0, 4000));
    }
    console.log('\n======================================');
  } finally {
    await fetch(`${BASE}/workflows/${stId}/deactivate`, { method: 'POST', headers: H });
    const del = await fetch(`${BASE}/workflows/${stId}`, { method: 'DELETE', headers: H });
    console.log('cleanup: deactivated + deleted, status', del.status);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
