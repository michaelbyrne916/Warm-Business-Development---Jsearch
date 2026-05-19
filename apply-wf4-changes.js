const fs = require('fs');
const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjE4OGVjMi0yMDhjLTRmMTQtYTRmNy0yNWY3NjJkYzE3YTMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzQ3ZGU1N2YtMGUzNi00MTBkLWI4YTUtNWM1MmMyNDg4YzY4IiwiaWF0IjoxNzc0NTY2ODE3LCJleHAiOjE3NzcxMDA0MDB9.Q6QDZkjicCcWjOUquWyCgfkHfF2U5QmicGg2nX7rXgk';

const wf4 = JSON.parse(fs.readFileSync(
  'C:/Users/Michael/OneDrive/Documents/Claude - N8N/staffing-bd-workflow/backups/wf4-backup-2026-04-07T21-40-34.json',
  'utf8'
));

// ── Prepare Send Fields ──────────────────────────────────────────────────────
// Adds reply-chain subject (Re: email_1_subject) for stages 1 and 2
const newPrepareSendCode = `return $input.all().map(item => {
  const d = item.json;
  const stage = parseInt(d.follow_up_stage || '0');
  let sendSubject, sendBody;

  if (stage === 0) {
    // Email 1 — original send
    sendSubject = d.email_1_subject || '';
    sendBody = d.email_1_body || '';
  } else {
    // Emails 2 and 3 — reply chain using Re: prefix on original subject
    sendSubject = 'Re: ' + (d.email_1_subject || d.company_name || '');
    sendBody = d.email_body || '';
  }

  // Strip any embedded unsubscribe line
  sendBody = sendBody.replace(/\\n?If you do not wish to receive any communication please reply with the subject line UNSUBSCRIBE/gi, '').trim();

  // Convert newlines to <br> for HTML email rendering
  const sendBodyHtml = sendBody.replace(/\\n/g, '<br>');

  return { json: { ...d, _send_subject: sendSubject, _send_body: sendBody, _send_body_html: sendBodyHtml } };
});`;

// ── Build Follow-up Sequence ─────────────────────────────────────────────────
// Stage 1 (email 2): built when stage 0 sends — scheduled 3 business days out
// Stage 2 (email 3): built when stage 1 sends — scheduled 7 calendar days out
const newBuildFollowUpCode = `// Build follow-up queue entries using pre-generated email content from WF3
// Stage 1 (email 2): triggered when stage 0 sends — 3 business days out
// Stage 2 (email 3): triggered when stage 1 sends — 7 calendar days out

const results = [];
const now = new Date();

const addCalendarDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r.toISOString().split('T')[0];
};

const addBusinessDays = (d, n) => {
  const r = new Date(d);
  let added = 0;
  while (added < n) {
    r.setDate(r.getDate() + 1);
    const dow = r.getDay();
    if (dow !== 0 && dow !== 6) added++; // skip weekends
  }
  return r.toISOString().split('T')[0];
};

const allItems = $('Check Suppression').all();

for (const item of allItems) {
  const data = item.json;
  const stage = parseInt(data.follow_up_stage || '0');

  if (stage === 0) {
    // Email 1 just sent — queue Email 2 for 3 business days from now
    results.push({ json: {
      opportunity_id: data.opportunity_id || '',
      contact_email: data.contact_email || '',
      contact_name: data.contact_name || '',
      company_name: data.company_name || '',
      company_domain: data.company_domain || '',
      job_title: data.job_title || '',
      location: data.location || '',
      email_1_subject: data.email_1_subject || '',
      email_1_body: data.email_1_body || '',
      email_2_subject: data.email_2_subject || '',
      email_2_body: data.email_2_body || '',
      email_3_subject: data.email_3_subject || '',
      email_3_body: data.email_3_body || '',
      email_body: data.email_2_body || '',          // what Prepare Send Fields reads
      approval_status: 'approved',
      sent_status: 'unsent',
      follow_up_stage: 1,
      scheduled_date: addBusinessDays(now, 3),
      posted_date: data.posted_date || '',
      source_url: data.source_url || ''
    }});

  } else if (stage === 1) {
    // Email 2 just sent — queue Email 3 for 7 calendar days from now
    results.push({ json: {
      opportunity_id: data.opportunity_id || '',
      contact_email: data.contact_email || '',
      contact_name: data.contact_name || '',
      company_name: data.company_name || '',
      company_domain: data.company_domain || '',
      job_title: data.job_title || '',
      location: data.location || '',
      email_1_subject: data.email_1_subject || '',
      email_1_body: data.email_1_body || '',
      email_2_subject: data.email_2_subject || '',
      email_2_body: data.email_2_body || '',
      email_3_subject: data.email_3_subject || '',
      email_3_body: data.email_3_body || '',
      email_body: data.email_3_body || '',          // what Prepare Send Fields reads
      approval_status: 'approved',
      sent_status: 'unsent',
      follow_up_stage: 2,
      scheduled_date: addCalendarDays(now, 7),
      posted_date: data.posted_date || '',
      source_url: data.source_url || ''
    }});
  }
  // stage 2 (email 3) — no further follow-ups
}

return results;`;

// ── Apply node changes ───────────────────────────────────────────────────────
wf4.nodes = wf4.nodes.map(node => {
  if (node.name === 'Prepare Send Fields') {
    node.parameters.jsCode = newPrepareSendCode;
    console.log('Updated: Prepare Send Fields');
  }
  if (node.name === 'Build Follow-up Sequence') {
    node.parameters.jsCode = newBuildFollowUpCode;
    console.log('Updated: Build Follow-up Sequence');
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

const { availableInMCP, binaryMode, ...cleanSettings } = wf4.settings || {};
const wf4Payload = {
  name: wf4.name,
  nodes: wf4.nodes,
  connections: wf4.connections,
  settings: cleanSettings,
  staticData: wf4.staticData || null
};

putWorkflow('QG8tNjLdKCQkZpWA', wf4Payload)
  .then(r => console.log('WF4 updated successfully, HTTP', r.status))
  .catch(e => console.error('WF4 update FAILED:', e.message));
