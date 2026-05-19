/**
 * WF4 — Check Suppression
 * Checks each approved row against the suppression window.
 * Also deduplicates within the current execution batch.
 * Input:  Approved Outreach Queue rows
 * Output: Same rows with _is_suppressed and _suppression_reason flags
 */
const SUPPRESSION_DAYS = parseInt($env.DUPLICATE_SUPPRESSION_DAYS || '30');
const results = [];
const seenThisBatch = new Set();

for (const item of $input.all()) {
  const row = { ...item.json };
  const domainKey = (row.company_domain || '').toLowerCase().trim();
  const emailKey = (row.contact_email || '').toLowerCase().trim();
  const batchKey = `${domainKey}|${emailKey}`;

  let isSuppressed = false;
  let suppressionReason = '';

  // 1. Deduplicate within current execution batch
  if (seenThisBatch.has(batchKey)) {
    isSuppressed = true;
    suppressionReason = `Duplicate in current send batch (${batchKey})`;
  } else {
    seenThisBatch.add(batchKey);

    // 2. Check sent_timestamp from Outreach Queue row (if re-sent previously)
    if (row.sent_timestamp && row.sent_timestamp !== '') {
      try {
        const sentDate = new Date(row.sent_timestamp);
        const now = new Date();
        const daysSince = (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < SUPPRESSION_DAYS) {
          isSuppressed = true;
          suppressionReason = `Already sent ${Math.round(daysSince)} day(s) ago (suppression window: ${SUPPRESSION_DAYS} days)`;
        }
      } catch (e) {
        // Invalid date — continue
      }
    }
  }

  // 3. Safety check: skip rows without contact email
  if (!emailKey) {
    isSuppressed = true;
    suppressionReason = 'No contact email — cannot send';
  }

  row._is_suppressed = isSuppressed;
  row._suppression_reason = suppressionReason;
  results.push({ json: row });
}

return results;
