const queueRows = $input.first().json.queueRows;
const today = new Date();

// Add internal index to each row
const rows = queueRows.map((row, i) => ({ ...row, _idx: i }));

// Dedupe within queue: keep most advanced row per email
const emailBest = new Map();
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const email = (row.contact_email || '').toLowerCase().trim();
  if (!email) continue;
  if (!emailBest.has(email)) {
    emailBest.set(email, i);
  } else {
    const bestIdx = emailBest.get(email);
    const bestStage = parseInt(rows[bestIdx].follow_up_stage || 0);
    const thisStage = parseInt(row.follow_up_stage || 0);
    if (thisStage > bestStage) {
      rows[bestIdx]._archive_reason = 'dupe_removed';
      emailBest.set(email, i);
    } else {
      row._archive_reason = 'dupe_removed';
    }
  }
}

const archiveItems = [];
const keepItems = [];

for (const row of rows) {
  if (row._archive_reason === 'dupe_removed') {
    archiveItems.push(row);
    continue;
  }
  const approvalStatus = (row.approval_status || '').toLowerCase().trim();

  // NOTE: the stage>=2 'completed' auto-archive was removed.
  // WF6 now owns terminal archiving of completed contacts.
  // WF6 sets approval_status='ARCHIVED' after Cold BD handoff;
  // the 'archived' sweep below then cleans the row up the next morning.
  // This ensures WF6's weekly Sunday run always sees stage-7 rows before they are swept.

  // Match 'reject' or 'rejected'
  if (approvalStatus === 'rejected' || approvalStatus === 'reject') {
    row._archive_reason = 'rejected';
    archiveItems.push(row);
    continue;
  }
  if (approvalStatus === 'pending' && row.posted_date) {
    const posted = new Date(row.posted_date);
    const daysSince = (today - posted) / (1000 * 60 * 60 * 24);
    if (daysSince > 14) {
      row._archive_reason = 'stale_pending';
      archiveItems.push(row);
      continue;
    }
  }
  // ARCHIVED is a terminal reconciliation state — move it out of the queue.
  // (HELD is intentionally NOT archived here — it stays in keepItems.)
  if (approvalStatus === 'archived') {
    row._archive_reason = 'reconciliation_archived';
    archiveItems.push(row);
    continue;
  }
  keepItems.push(row);
}

const breakdown = {};
for (const r of archiveItems) {
  const reason = r._archive_reason || 'unknown';
  breakdown[reason] = (breakdown[reason] || 0) + 1;
}

return [{
  json: {
    archiveItems,
    keepItems,
    stats: {
      total_in_queue: queueRows.length,
      archived: archiveItems.length,
      kept: keepItems.length,
      breakdown
    }
  }
}];
