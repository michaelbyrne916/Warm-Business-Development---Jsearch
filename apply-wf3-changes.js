const fs = require('fs');
const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjE4OGVjMi0yMDhjLTRmMTQtYTRmNy0yNWY3NjJkYzE3YTMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzQ3ZGU1N2YtMGUzNi00MTBkLWI4YTUtNWM1MmMyNDg4YzY4IiwiaWF0IjoxNzc0NTY2ODE3LCJleHAiOjE3NzcxMDA0MDB9.Q6QDZkjicCcWjOUquWyCgfkHfF2U5QmicGg2nX7rXgk';

const wf3 = JSON.parse(fs.readFileSync(
  'C:/Users/Michael/OneDrive/Documents/Claude - N8N/staffing-bd-workflow/backups/wf3-backup-2026-04-07T21-40-34.json',
  'utf8'
));

// ── Build Outreach Prompt ────────────────────────────────────────────────────
const newBuildPromptCode = fs.readFileSync(
  'C:/Users/Michael/OneDrive/Documents/Claude - N8N/staffing-bd-workflow/code-nodes/wf3-build-outreach-prompt.js',
  'utf8'
);

// ── Parse LLM Response ───────────────────────────────────────────────────────
const newParseCode = fs.readFileSync(
  'C:/Users/Michael/OneDrive/Documents/Claude - N8N/staffing-bd-workflow/code-nodes/wf3-parse-llm-response.js',
  'utf8'
);

// ── Apply node changes ───────────────────────────────────────────────────────
wf3.nodes = wf3.nodes.map(node => {
  if (node.name === 'Build Outreach Prompt') {
    node.parameters.jsCode = newBuildPromptCode;
    console.log('Updated: Build Outreach Prompt');
  }

  if (node.name === 'Parse LLM Response') {
    node.parameters.jsCode = newParseCode;
    console.log('Updated: Parse LLM Response');
  }

  if (node.name === 'Write to Outreach Queue') {
    const v = node.parameters.columns.value;
    // Add new metadata fields
    v.personalization_angle = '={{ $json.personalization_angle }}';
    v.recipient_reasoning = '={{ $json.recipient_reasoning }}';
    v.scaling_hypothesis = '={{ $json.scaling_hypothesis }}';
    // Remove old metadata fields
    delete v.personalization_notes;
    delete v.company_research_summary;
    delete v.why_this_message_is_relevant;
    delete v.why_this_contact;

    // Update schema array
    const removeIds = ['personalization_notes', 'company_research_summary', 'why_this_message_is_relevant', 'why_this_contact'];
    node.parameters.columns.schema = node.parameters.columns.schema.filter(s => !removeIds.includes(s.id));
    for (const id of ['personalization_angle', 'recipient_reasoning', 'scaling_hypothesis']) {
      if (!node.parameters.columns.schema.find(s => s.id === id)) {
        node.parameters.columns.schema.push({
          id, displayName: id, required: false, defaultMatch: false,
          display: true, type: 'string', canBeUsedToMatch: true
        });
      }
    }
    console.log('Updated: Write to Outreach Queue');
  }

  return node;
});

// ── PUT to n8n API ───────────────────────────────────────────────────────────
function putWorkflow(id, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'michaelbyrne916.app.n8n.cloud',
      path: `/api/v1/workflows/${id}`,
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Strip read-only fields that the PUT endpoint rejects
// Strip read-only / non-accepted fields
const { availableInMCP, binaryMode, ...cleanSettings } = wf3.settings || {};
const wf3Payload = {
  name: wf3.name,
  nodes: wf3.nodes,
  connections: wf3.connections,
  settings: cleanSettings,
  staticData: wf3.staticData || null
};

putWorkflow('T1jTXreAw0uZ2TOD', wf3Payload)
  .then(r => console.log('WF3 updated successfully, HTTP', r.status))
  .catch(e => console.error('WF3 update FAILED:', e.message));
