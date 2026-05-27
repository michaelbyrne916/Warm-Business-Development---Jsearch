# HANDOFF LOG — 2026-05-20 — WF-RECON Reconciliation Arc

This file contains the full narrative for the WF4 desync incident and the three-phase reconciliation arc (Phase C / E / E.5) that fixed it. CLAUDE.md links here in its change log and otherwise carries only steady-state guidance.

---

## Change log rows (extracted from CLAUDE.md)

| Date | Workflow | Change |
|------|----------|--------|
| 2026-05-20 | WF-RECON Phase C | Built read-only reconciliation preview workflow `CCQu4oRXAXzQ32Rl` (6 nodes: Manual Trigger → 4 sheet reads → Classify Contacts Code node). No writes wired. Classifies 566 non-rejected OQ rows into 5 buckets keyed off Sent Log truth. AmEx added to Excluded Companies (row 246, total 245). dedup_check confirmed 497 warm_complete contacts are 100% net-new to Cold BD Sequence Tracker (0 overlap with 9,079 unique tracker emails). Assertion PASS (566 == 566). Phase E writes pending Mike's go-ahead. **WF4 remains DEACTIVATED.** |
| 2026-05-20 | WF-RECON Phase E | Built and ran reconciliation write workflow `EspXcizSIo9hSLcN` (22 nodes, exec 9843, 25.6s, PASS). 5 branches executed: A (3 mid_sequence scheduled_date→2026-05-25), B (38 fresh_keep reconciliation_status='reviewed_keep' after OQ col_26 renamed to reconciliation_status), C (24 excluded_archive approval_status='ARCHIVED'), D (4 held_campaign_overlap approval_status='HELD'), E (497 warm_complete appended to Cold BD Sequence Tracker). Verification: pre_tracker=9082, post_tracker=9579, delta=+497. **Option D chosen for Branch E Write 2** — skipped OQ field update for warm_complete; relied on Sequence Tracker email dedup as the WF6 re-migration guard. |
| 2026-05-20 | WF4 | Reactivated post-Phase E. Schedule (8/10/12/2/4pm PDT Mon-Fri) resumed. |
| 2026-05-20 | WF4 exec 9848 | Manual run, 566 OQ rows read, 21 approved+unsent reached Suppression Gate, **all 21 blocked by Suppression List** (legitimate 30-day windows from prior real sends). Zero emails sent, 21 entries to Errors tab. Diagnosis: the 21 were part of the 497 warm_complete bucket whose OQ remained stale per Phase E Option D. |
| 2026-05-20 | WF-RECON Phase E.5 | Closed the Option D gap. One-shot workflow `tjBavdMpdfqt03FF` (12 nodes, exec 9949, 14.6s, PASS) updated all 497 warm_complete OQ rows to `approval_status='ARCHIVED'`. Verify: warm_complete_now_archived=497, still_not_archived=0, post-archive total ARCHIVED=521 (24 from Phase E + 497 from E.5). Of the 497, only 21 were 'approved' pre-E.5; 476 were 'pending' (would never have matched WF4's filter). Workflow deleted post-run. |
| 2026-05-20 | WF4 exec 9950 | First post-E.5 scheduled run (23:00 UTC / 4pm PDT). Filter result: **0 approved+unsent+due rows**. Chain halted at Attach Suppression List with 0 output items. Zero sends, zero suppression-blocked entries, zero Errors tab writes. **Suppression noise eliminated as designed.** |

---

## 2026-05-20 — WF4 desync fix (VALIDATED) — the bug that motivated the arc

- **Bug 1 (sent-flag overwrite):** `Write Follow-ups to Queue` operation `appendOrUpdate` → `append`. The follow-up write's `matchingColumns: [opportunity_id, follow_up_stage]` was clobbering `Update Outreach Queue Sent`'s `sent_status=sent` write back to `unsent` on the just-sent stage-0 row, producing a single merged stage-1/unsent row instead of two distinct rows. Result: Outreach Queue desynced from Sent Log truth on every WF4 run since the follow-up flow was wired in — ~566 corrupted rows estimated.
- **Bug 2 (phantom follow-ups, source still pre-Gmail):** `Build Follow-up Sequence` resourced from `$('Send via Gmail').all()` with `$('Prepare Send Fields').itemMatching(sentItem.pairedItem.item)` pairedItem bridge, filtering to items with a real Gmail `id` and no `error`. The prior `b42098b` fix (reading `Prepare Send Fields`) was still **pre-DRY_RUN gate and pre-Gmail-failure drop-off** — items dropped by DRY_RUN or `continueOnFail: true` Gmail failures still got follow-ups scheduled. b42098b reduced the blast radius from 50 → 5 but didn't restore post-send truth.
- **Validated** (WF4 exec 9818, manual run with WF4 deactivated): test contact `TEST-WF4-20260520` produced exactly **2 rows** — stage-0 with `sent_status=sent` and timestamp; stage-1 `sent_status=unsent` scheduled 2026-05-25 (+3 business days). `Build Follow-up Sequence` output count = **1** (post-send truth). Sent Log + Suppression List each got 1 new entry. **PASS.** All test artifacts cleaned up.
- **Version:** 124 → 125. Snapshot: [../snapshots/WF4-QG8tNjLdKCQkZpWA-pre-bug1-bug2-fix-2026-05-20.json](../snapshots/WF4-QG8tNjLdKCQkZpWA-pre-bug1-bug2-fix-2026-05-20.json) (revert reference; also available as n8n UI version 124).
- **CRITICAL during the arc — WF4 remained DEACTIVATED.** Must NOT reactivate until the reconciliation workflow rebuilds the ~566 corrupted Outreach Queue rows from Sent Log truth. Reactivating before reconciliation would re-send Email 1 to contacts the desynced queue wrongly showed as `unsent`.

---

## 2026-05-20 (session 2) — WF-RECON Phase C reconciliation preview built

- **Built:** Workflow `WF-RECON Phase C — Reconciliation Preview (Read-Only)` (id `CCQu4oRXAXzQ32Rl`). 6 nodes: Manual Trigger → Read Outreach Queue → Read Sent Log → Read Excluded Companies → Read Sequence Tracker → Classify Contacts (Code, runOnceForAllItems). **No write nodes — preview only.** Saved to [../workflows/wf-recon-phase-c-preview.json](../workflows/wf-recon-phase-c-preview.json).
- **Classification rules (in order, first match wins):**
  1. `excluded_archive` — `company_name` substring-matches any row in Excluded Companies (WF1 convention).
  2. `held_campaign_overlap` — `opportunity_id` in HOLD list: `4487ac861d0a`, `d0eff2075a84`, `f680494b6b8f`, `be2b65c90332`. Will be suppressed until `today+90 days` (`2026-08-18`) in Phase E.
  3. `warm_complete_migrate_cold` — Sent Log shows ≥3 warm sends → archive with `archive_reason='migrated_cold'` and migrate to Cold BD Sequence Tracker (`industry='Other'`, `needs_classification='TRUE'`, classified later by Cold BD's existing Industry Cleanup workflow `IEGH7Eak7fDmR2Mg`).
  4. `mid_sequence_reconcile` — 1–2 warm sends. **Stale (last send >14 days ago):** `approval_status='pending'`, scheduled_date blank, manual review. **Non-stale:** `approval_status='approved'`, `follow_up_stage=send_count`, `scheduled_date=today+3 business days`.
  5. `fresh_keep` — 0 warm sends. No update.
- **Latest preview execution (`exec 9833`, 2026-05-20 17:29:22, post-AmEx exclusion):**
  - Inputs: OQ=566 / non-reject=566, Sent Log=4,268, Excluded=245, Sequence Tracker=9,082 (9,079 unique emails).
  - Bucket counts: `excluded_archive: 24`, `held_campaign_overlap: 4`, `warm_complete_migrate_cold: 497`, `mid_sequence_reconcile: 3`, `fresh_keep: 38`.
  - Mid-sequence recency: all 3 in `<=7` band (Amanda/Amber/Caitlyn). Stale=false. Proposed `scheduled_date=2026-05-25` (shift from 2026-05-22, +3 business days from 5/20). **Approved by Mike.**
  - **dedup_check:** `warm_complete_count=497`, `sequence_tracker_unique_emails=9,079`, `already_in_cold=0`, `net_new_to_migrate=497`, `already_in_cold_emails=[]`. All 497 warm-complete contacts are net-new to the cold sheet — no risk of duplicate cold-sequence enrollment.
  - **Assertion: PASS** (566 classified == 566 non-reject).
- **AmEx exclusion:** Row 246 appended to Excluded Companies tab via one-shot webhook workflow (deleted after use): `company_name='american express'`, `type='enterprise'`. Reason (off-sheet): AmEx uses an MSP for staffing — not a direct-hire target. The `ukemailfraud@americanexpress.com` contact was also a fraud intake inbox, not a hiring contact. Moved opp `fb9495223ca2` from `fresh_keep` → `excluded_archive` (counts shifted 23→24 and 39→38 between exec 9827 and 9833).
- **Mid-session critical open items (resolved by session 3):**
  - WF4 remained DEACTIVATED. Phase E not yet built. 3 mid-sequence contacts (Amanda/Toll Brothers `9ca65578ff5a`, Amber/52TEN `bc292e817a9e`, Caitlyn/Vanguard `0d3112ff9b1e`) scheduled 2026-05-25. 4 held contacts (Alex@ca-mgmt.com, Amel.ali@agilityrobotics.com, Bernice@focusmovement.sg, Chad.forman@spartannash.com) suppressed until 2026-08-18. 497 warm-complete contacts pending cold migration.

---

## 2026-05-20 (session 3) — Phase E + E.5 reconciliation arc complete; WF4 reactivated clean

- **Phase E** (`EspXcizSIo9hSLcN`, exec 9843, PASS): all 5 branches executed. Cold BD Sequence Tracker 9,082 → 9,579 (+497 net new). OQ updates: 3 mid_sequence rescheduled to 2026-05-25 (Toll/52TEN/Vanguard), 38 fresh_keep stamped `reconciliation_status='reviewed_keep'` (OQ col_26 renamed to `reconciliation_status` manually by Mike), 24 excluded_archive → ARCHIVED, 4 held_campaign_overlap → HELD. **Branch E Write 2 skipped per Option D** — relied on WF6's Sequence Tracker email dedup (filter 5) to block re-migration. Suppression-list write for HELD rows deferred (out of scope).

- **WF4 reactivation diagnostic (exec 9848):** Mike reactivated WF4 between Phase E and Phase E.5. Manual run caught 21 approved+unsent OQ rows. ALL 21 were already in the Suppression List (3–4 entries each, 30-day windows from prior real sends). Suppression Gate blocked all 21. Zero emails sent.

- **False-premise check + reject:** Initial hypothesis was that the 21 suppressions might be phantoms from the desync incident. Cross-reference workflow `yzmUCkig5lZdSwVt` (built, executed, deleted) verified each of the 21 has 3-4 real Sent Log entries. Suppression entries are legitimate. Zero rows deleted from Suppression List. No harm done. Workflow deleted post-confirmation.

- **Root cause:** The 21 are a subset of the 497 warm_complete contacts. Phase E migrated them to Cold BD but left OQ `approval_status='approved'`/'pending', `sent_status='unsent'`, `follow_up_stage='0'` because of Option D. WF4 saw them as sendable; Suppression Gate caught the duplicate send attempts. Steady-state Errors-tab noise.

- **Phase E.5** (`tjBavdMpdfqt03FF`, exec 9949, PASS, workflow deleted post-run): one-shot updated all 497 warm_complete OQ rows to `approval_status='ARCHIVED'`. Pre-state of the 497 bucket: 21 'APPROVED', 476 'PENDING'. Post-state OQ: 521 ARCHIVED (24+497), 3 APPROVED (Toll/52TEN/Vanguard mid_sequence, future scheduled_date), 4 HELD.

- **WF4 first post-E.5 scheduled run (exec 9950, 23:00 UTC):** Schedule-triggered. Read 566 OQ → filter to **0 approved+unsent+due**. Chain halted at Attach Suppression List with 0 output items. Zero sends, zero suppression-blocked entries, zero Errors tab writes. Noise eliminated.

- **End state of the arc:**
  - OQ: 566 rows. 3 'approved' (mid_sequence due 2026-05-25), 4 'HELD', 521 'ARCHIVED', ~38 'pending' (fresh_keep awaiting manual approval).
  - Sent Log: 4,268 rows (source of truth, unchanged through arc).
  - Suppression List: 4,220 rows (all legitimate, none deleted).
  - Cold BD Sequence Tracker: 9,579 rows.
  - WF4: ACTIVE. Next email send: 2026-05-25 (3 mid_sequence contacts).
