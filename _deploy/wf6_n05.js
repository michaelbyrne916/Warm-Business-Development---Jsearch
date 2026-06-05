const oqRows = $('Read Outreach Queue').all().map(i => i.json);
const contactsRows = $('Read Contacts Tab').all().map(i => i.json);
const trackerRows = $('Read Sequence Tracker').all().map(i => i.json);

// Build contact_email -> contact_title lookup from Contacts tab
const contactsMap = {};
for (const row of contactsRows) {
  const key = (row.contact_email || '').toLowerCase().trim();
  if (key) contactsMap[key] = row.contact_title || '';
}

// Build dedup Set from Sequence Tracker Email column
const existingEmails = new Set(
  trackerRows.map(r => (r.Email || '').toLowerCase().trim()).filter(Boolean)
);

function derivePersona(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('ciso')) return 'CISO';
  if (t.includes('cto') || t.includes('chief technology')) return 'CTO';
  if (t.includes('cio') || t.includes('chief information')) return 'CIO';
  if (t.includes('ceo') || t.includes('president') || t.includes('founder')) return 'CEO/President';
  if (t.includes('vp') || t.includes('vice president')) return 'VP';
  if (t.includes('director')) return 'Director';
  if (t.includes('manager')) return 'Manager';
  if (t.includes('engineer')) return 'Engineering';
  return 'Other';
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const to_add = [];
const _archive_payload = []; // opportunity_ids for OQ archive after Sequence Tracker write
const skipped = [];

for (const row of oqRows) {
  const sentStatus = (row.sent_status || '').toLowerCase().trim();
  if (sentStatus !== 'sent') continue;

  // Belt-and-suspenders exclusion guard
  const statusUpper = (row.approval_status || '').toUpperCase();
  if (statusUpper === 'REJECT' || statusUpper === 'ARCHIVED' || statusUpper === 'HELD') continue;

  const followUpStage = parseInt(row.follow_up_stage, 10);

  // Completion trigger: 8-email sequence done (stage 7) OR legacy 3-email done (stage 2, no email_4_body).
  // Does NOT match current 8-email contacts passing through stage 2 (they have email_4_body).
  const is8EmailComplete = followUpStage === 7;
  const isLegacyComplete = followUpStage === 2 && !(row.email_4_body || '').trim();
  if (!is8EmailComplete && !isLegacyComplete) continue;

  // Filter: sent_timestamp >= 5 calendar days ago
  const sentTimestamp = row.sent_timestamp ? new Date(row.sent_timestamp) : null;
  if (!sentTimestamp || isNaN(sentTimestamp.getTime())) continue;
  const daysSinceSent = Math.floor((today - sentTimestamp) / (1000 * 60 * 60 * 24));
  if (daysSinceSent < 5) continue;

  const email = (row.contact_email || '').toLowerCase().trim();
  if (!email) continue;

  if (existingEmails.has(email)) {
    skipped.push(email);
    continue;
  }

  const contactTitle = contactsMap[email] || '';
  const nameParts = (row.contact_name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ');

  to_add.push({
    'Email': row.contact_email,
    'First Name': firstName,
    'Last Name': lastName,
    'Title': contactTitle,
    'Persona': derivePersona(contactTitle),
    'Company': row.company_name || '',
    'Domain': row.company_domain || '',
    'Industry': '',
    'Source': 'project1_warmout',
    'Current Touch': '1',
    'Wave': 'Safe_to_Send',
    'Status': 'Active',
    'warm_origin': 'TRUE',
    'Date Added to Sequence': today.toISOString().split('T')[0],
    '_company_for_summary': row.company_name || ''
  });

  // Store opportunity_id for Mark OQ Archived step.
  // Matching on opportunity_id alone archives ALL OQ rows for this contact (stages 0-7),
  // so WF5 cleans them all up next morning via the reconciliation_archived sweep.
  _archive_payload.push({ opportunity_id: row.opportunity_id || '' });
}

const companies_added = to_add.map(c => c._company_for_summary).filter(Boolean).join('\n');

return [{ json: { to_add, _archive_payload, skipped, to_add_count: to_add.length, skipped_count: skipped.length, companies_added } }];
