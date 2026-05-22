> **Read `..\CLAUDE.md` first** for shared infrastructure, environment quirks, and the n8n REST fallback pattern. This file contains project-specific details only.

# Claude + N8N Workflow Builder

## Project Purpose
This project exists to help build high-quality, production-ready workflows in an N8N instance using Claude as the AI assistant.

## Available Tools

### N8N MCP Server (`n8n-mcp`)
Direct programmatic access to n8n. Operates in two modes:
- **Documentation mode** (no credentials needed) — searchable database of 1,396 nodes, 2,700+ templates, schemas, and docs
- **Live workflow management mode** (requires `N8N_API_URL` + `N8N_API_KEY`) — full CRUD on workflows, executions, and credentials

**Core MCP tools available:**
| Tool | Purpose |
|------|---------|
| `search_nodes` | Find nodes by keyword; filter by core/community/verified |
| `get_node` | Get full node details, docs, properties, versions |
| `validate_node` | Validate a node config against its schema |
| `validate_workflow` | Validate a full workflow object |
| `get_template` | Retrieve a workflow template by ID |
| `search_templates` | Find templates by keyword, node type, or task |
| `tools_documentation` | Get docs for any MCP tool by name or category |
| `list_workflows` | List all workflows in the n8n instance |
| `create_workflow` | Create a new workflow |
| `update_workflow` | Update an existing workflow (full or partial) |
| `delete_workflow` | Delete a workflow |
| `get_workflow` | Get a workflow by ID |
| `deploy_workflow` | Activate/deploy a workflow |
| `execute_workflow` | Test/run a workflow |
| `list_executions` | List past executions |
| `get_execution` | Get a specific execution result |
| `health_check` | Verify n8n instance connectivity |

> Most frequently used tool: `n8n_update_partial_workflow` (38,287 uses, 99.0% success rate)

### N8N Skills
Seven complementary Claude Code skills that activate automatically based on context:

| Skill | Triggers On | What It Provides |
|-------|------------|-----------------|
| **n8n Expression Syntax** | "expression", "$json", "{{}}", webhook data | Correct `{{}}` patterns, `$json`/`$node`/`$now`/`$env` usage, common mistakes |
| **n8n MCP Tools Expert** | "search nodes", "find node", "MCP tools" | Guides tool selection, nodeType format, validation profiles |
| **n8n Workflow Patterns** | "build workflow", "webhook", "pattern", "architecture" | 5 proven patterns: webhook, HTTP API, database, AI, scheduled |
| **n8n Validation Expert** | "validation", "error", "fix", "debug" | Error catalogs, auto-sanitization, false positive handling |
| **n8n Node Configuration** | "configure node", "property", "operation" | Operation-specific requirements, property dependencies |
| **n8n Code JavaScript** | JavaScript in Code nodes | Effective JS patterns, data access, libraries |
| **n8n Code Python** | Python in Code nodes | Python patterns, library limitations/availability |

Skills compose automatically — e.g. "Build and validate a webhook to Slack" triggers Patterns + MCP Tools + Configuration + Expression Syntax + Validation in sequence.

## How to Work (Standard Process)
1. User describes the workflow goal
2. Use `search_nodes` and `search_templates` to find relevant nodes and reference patterns
3. Use `get_node` to understand property schemas before configuring
4. Build or update the workflow via MCP tools
5. Use `validate_workflow` to check correctness before deploying
6. Use `deploy_workflow` / `execute_workflow` to activate and test
7. Summarize what was built and any important gotchas

## Workflow Quality Standards
- Use descriptive node names (e.g. "Fetch Customer from CRM", not "HTTP Request1")
- Add sticky notes to explain non-obvious logic or branch conditions
- Handle errors with Error Trigger nodes or try/catch logic where appropriate
- Prefer native N8N integration nodes over generic HTTP Request nodes when available
- Never hardcode credentials — always reference named credentials
- Webhook data lives at `{{$json.body.fieldName}}` not `{{$json.fieldName}}`

## Key Expression Syntax Rules
- Always wrap in `{{}}` in node fields: `{{$json.name}}`
- In Code nodes, access data directly without `{{}}`: `$json.name` or `$input.item.json.name`
- Webhook body: `{{$json.body.fieldName}}`
- Reference other nodes: `{{$node["Node Name"].json.fieldName}}`
- Current time: `{{$now}}` or `{{DateTime.now()}}`
- Environment variables: `{{$env.MY_VAR}}`

## Safety Rules
- **Never modify production workflows directly** — duplicate first, test in dev
- Always validate with `validate_workflow` before deploying
- Export/backup workflows before AI-assisted modifications
- Test edge cases: empty inputs, API failures, rate limits

---

## Active Workflow Registry

All workflows below are live on `michaelbyrne916.app.n8n.cloud` unless noted.

| Workflow | ID | Trigger | Status | Purpose |
|----------|----|---------|--------|---------|
| WF1: Lead Discovery | `3qPmKNCZseEzvFNj` | Schedule — 7am Mon-Fri | **ACTIVE** | JSearch API → classify → dedup → write qualified opportunities to sheet |
| WF2: Contact Discovery | `2uWLVQ4JS1zXwztO` | Manual / WF1 trigger | **ACTIVE** | Hunter.io contact lookup for qualified opportunities |
| WF3: Outreach Draft | `T1jTXreAw0uZ2TOD` | Manual | **ACTIVE** | GPT-4o-mini generates 3-email sequence per contact |
| WF4: Approved Send | `QG8tNjLdKCQkZpWA` | Schedule — 8/10/12/2/4pm Mon-Fri | **ACTIVE** | Sends approved Gmail outreach; DRY_RUN gate controls live sends |
| WF5: Maintenance | `acdY3wEi8Y7RElks` | Schedule — daily | **ACTIVE** | Archives and dedupes Outreach Queue |
| WF6: Warm to Cold Handoff | `Zyba7eIcS0berpVA` | Schedule — Sunday 5am | **ACTIVE** | Moves stale warm leads to cold campaign pool |
| WF7: Cold Campaign Batch | `Bk4CkgOMr6t6XTG6` | Schedule — Sunday 6am | **INACTIVE** (not yet activated) | Auto-generates cold email templates via Claude API, uploads campaigns + contacts to Instantly |
| BD1: Account Activation | `mBwEPWcdbx7b3dUA` | Schedule — hourly | **ACTIVE** | Handles Instantly.ai account activation events |
| BD4: Pool Management | `RDjbWgriKOm1tmgX` | Schedule — occasional | **ACTIVE** | Manages cold BD lead pool |
| BD6: Reply and Pause | `QGx4yebi4Exr2E4e` | Schedule — hourly | **ACTIVE** | Detects Instantly.ai replies, pauses sequences |
| BD7: Unsubscribe and DNC | `A0QxPVYHNkIBIrHU` | Schedule — hourly | **ACTIVE** | Handles unsubscribes, adds to DNC list |

---

## Operational Notes

### Pausing outbound email (domain warm-up / maintenance)
- **WF4 (Gmail sends):** Set n8n variable `DRY_RUN = 'true'` to hold all sends without deactivating the workflow. Approved rows stay queued and send on the next run after setting back to `'false'`. Nothing is lost or duplicated.
- **Instantly.ai cold emails:** Controlled inside Instantly.ai directly — n8n has no lever. BD1/BD6/BD7 are event handlers only, not senders.

### Google Sheets rate limits (429 errors)
- Google's quota is 6,000 write requests/minute per project. WF1 can exhaust this during large daily runs when many qualified opportunities are written in a burst.
- **Pattern applied in WF1:** `retryOnFail: true, maxTries: 3, waitBetweenTries: 10000` on all Google Sheets write nodes that process batches. Error handler wait (`Wait Before Write Error`) is set to **70 seconds** to outlast the 1-minute quota window before logging errors.
- If other workflows (WF2, WF4, WF5) start hitting 429s, apply the same retryOnFail pattern to their Sheets write nodes.

### updateNode partial workflow syntax
When using `n8n_update_partial_workflow`, the correct structure is:
```json
{"type": "updateNode", "nodeId": "node-id", "updates": {"parameters.fieldName": value, "retryOnFail": true}}
```
- Use dot-path keys in `updates` (e.g. `"parameters.amount"`)
- `patchNodeField` only works on string values — use `updateNode` for numbers and booleans

---

## Change Log

| Date | Workflow | Change |
|------|----------|--------|
| 2026-05-13 | WF1: Lead Discovery | Fixed cascading 429 rate limit failure: `Wait Before Write Error` 2s→70s; added `retryOnFail` (3 tries, 10s apart) to `Write Qualified Opportunity` and `Write Error to Sheet`. Manual test confirmed. |
| 2026-05-13 | WF1 + WF2: Chain | ACTION 1: Re-enabled WF1→WF2 auto-chain — un-disabled nodes `prepare-wf2-payload` and `trigger-contact-discovery` in WF1; un-disabled `wf2-trigger-exec` in WF2. |
| 2026-05-13 | WF6: Warm to Cold | ACTION 2 (read-only): Confirmed WF6 writes both `Source: 'project1_warmout'` and `warm_origin: 'TRUE'` to Sequence Tracker on every row via node n05. No change needed. |
| 2026-05-13 | WF7: Cold Campaign | ACTION 3: Added `source = "project1_warmout"` filter in node n4 (`Filter, Stagger and Group Contacts`) — new contacts (not yet in Sequence Tracker) are only included if their Master Contacts row has source = project1_warmout. Existing contacts continue through existing status/cadence logic unchanged. |
| 2026-05-13 | WF7: Cold Campaign | ACTION 4: Updated `LAUNCH_DATE` from `2026-04-21` to `2026-05-10` in both node n4 and node n16 (`Prepare Instantly Upload Payload`). |
| 2026-05-13 | WF6: Warm to Cold | ACTION 5 (read-only): WF6 does NOT filter by approval_status in its Sheets read — relies on WF5 archiving REJECTs daily before Sunday 5am. WF5 `Classify and Dedupe` node handles rejected rows. No change made; awaiting confirmation if explicit REJECT filter needed. |
| 2026-05-13 | WF3: Outreach Draft | ACTION 6: Deleted node `wf3-create-doc` (Create Google Doc Review Packet) — was already disabled, terminal node with no downstream connections. WF3 validates clean (0 errors). |
| 2026-05-13 | WF2/4/5/7: All | ACTION 7: Applied `retryOnFail: true, maxTries: 3, waitBetweenTries: 10000` to 21 Sheets write nodes: WF2 (7 nodes), WF4 (7 nodes), WF5 (3 nodes), WF7 (4 nodes: n11, n19, n21, n23). |
| 2026-05-13 | WF6: Warm to Cold | ACTION 8: Added explicit REJECT guard in node n05 (`Filter + Join + Dedup`) — after `sentStatus !== 'sent'` check, added `if ((row.approval_status || '').toUpperCase() === 'REJECT') continue;`. Belt-and-suspenders against WF5 failing to archive REJECTs before Sunday 5am. Validation: 0 new errors (5 pre-existing false positives unchanged). |
| 2026-05-20 | WF-RECON Phase C | Built read-only reconciliation preview workflow `CCQu4oRXAXzQ32Rl` (6 nodes: Manual Trigger → 4 sheet reads → Classify Contacts Code node). No writes wired. Classifies 566 non-rejected OQ rows into 5 buckets keyed off Sent Log truth. AmEx added to Excluded Companies (row 246, total 245). dedup_check confirmed 497 warm_complete contacts are 100% net-new to Cold BD Sequence Tracker (0 overlap with 9,079 unique tracker emails). Assertion PASS (566 == 566). Phase E writes pending Mike's go-ahead. **WF4 remains DEACTIVATED.** |
| 2026-05-20 | WF-RECON Phase E | Built and ran reconciliation write workflow `EspXcizSIo9hSLcN` (22 nodes, exec 9843, 25.6s, PASS). 5 branches executed: A (3 mid_sequence scheduled_date→2026-05-25), B (38 fresh_keep reconciliation_status='reviewed_keep' after OQ col_26 renamed to reconciliation_status), C (24 excluded_archive approval_status='ARCHIVED'), D (4 held_campaign_overlap approval_status='HELD'), E (497 warm_complete appended to Cold BD Sequence Tracker). Verification: pre_tracker=9082, post_tracker=9579, delta=+497. **Option D chosen for Branch E Write 2** — skipped OQ field update for warm_complete; relied on Sequence Tracker email dedup as the WF6 re-migration guard. |
| 2026-05-20 | WF4 | Reactivated post-Phase E. Schedule (8/10/12/2/4pm PDT Mon-Fri) resumed. |
| 2026-05-20 | WF4 exec 9848 | Manual run, 566 OQ rows read, 21 approved+unsent reached Suppression Gate, **all 21 blocked by Suppression List** (legitimate 30-day windows from prior real sends). Zero emails sent, 21 entries to Errors tab. Diagnosis: the 21 were part of the 497 warm_complete bucket whose OQ remained stale per Phase E Option D. |
| 2026-05-20 | WF-RECON Phase E.5 | Closed the Option D gap. One-shot workflow `tjBavdMpdfqt03FF` (12 nodes, exec 9949, 14.6s, PASS) updated all 497 warm_complete OQ rows to `approval_status='ARCHIVED'`. Verify: warm_complete_now_archived=497, still_not_archived=0, post-archive total ARCHIVED=521 (24 from Phase E + 497 from E.5). Of the 497, only 21 were 'approved' pre-E.5; 476 were 'pending' (would never have matched WF4's filter). Workflow deleted post-run. |
| 2026-05-20 | WF4 exec 9950 | First post-E.5 scheduled run (23:00 UTC / 4pm PDT). Filter result: **0 approved+unsent+due rows**. Chain halted at Attach Suppression List with 0 output items. Zero sends, zero suppression-blocked entries, zero Errors tab writes. **Suppression noise eliminated as designed.** |
| 2026-05-22 | WF5: Maintenance | Fix: `Classify and Dedupe` node (`wf5-classify`) — added an `approval_status='archived'` → archive path so reconciliation-archived rows leave the queue. `HELD` rows intentionally left in `keepItems` (not archived). |
| 2026-05-22 | WF2: Contact Discovery | Fix: added a dedup check (Sent Log + Suppression List) on the automated path before the Contacts-sheet write; already-contacted contacts are skipped and logged to the Errors tab. Closes the re-contamination vector — resolves the 2026-05-19 "Cause 2" open item (WF2 suppression pre-filter). Manual reconciliation branch untouched. |
| 2026-05-22 | WF4: Approved Send | Fix: `Write Follow-ups to Queue` column map corrected — phantom `email_subject`/`email_body` columns (which existed on no OQ schema) replaced with the six real OQ columns `email_1/2/3_subject` + `email_1/2/3_body`. Follow-up rows now carry real email content. |
| 2026-05-22 | One-shots (run + archived) | `OcCiCbOgE3rrvyEl` (exec 10431) — 530 re-contaminated OQ rows archived. `YzE12kHEq6qX4DDR` (exec 10451) — 212 WF3 parsing-failure rows archived. `KjgSu0Rt36xZuGvB` (exec 10465) — 130 junk rows deleted (cleanup of a failed recovery append). `sR4yW5v1i8gJyJEJ` (exec 10469, Google Sheets `values:batchUpdate`) — 96 blank follow-up rows recovered, 576 cells written, `remaining_damaged_in_oq=0`. All four are archived in n8n (`isArchived`) and inactive. |

### 2026-05-19 — WF4 phantom follow-up incident

- **Diagnosed:** `Build Follow-up Sequence` was reading `$('Check Suppression').all()` (all 50 approved rows) instead of `$('Prepare Send Fields').all()` (only the rows that cleared suppression + DRY_RUN). Result: 45 phantom stage-1 follow-ups scheduled for 2026-05-22 to contacts who never received Email 1, plus a recurring "Attach Suppression List → 0 → halt" loop blocking all subsequent WF4 runs.
- **Fix 1** (live in WF4 `QG8tNjLdKCQkZpWA`, exec 9761 baseline): `Build Follow-up Sequence` input source changed to `$('Prepare Send Fields').all()`. Committed locally as `b42098b`.
- **Fix 2** (one-shot cleanup workflow `r839lZSMkYZz7pnj`, exec 9773): deleted 45 Bucket A phantom rows, preserved 5 Bucket B legit follow-ups. Workflow archived in n8n (renamed `ARCHIVED — …`, inactive), retained as reference.
- **Open:** Cause 2 — WF2 should pre-filter contacts against the suppression list before writing to Outreach Queue. Ticketed for week of 2026-05-26 after observing a clean 5/22 follow-up cycle.

### 2026-05-20 — WF4 desync fix (VALIDATED)

- **Bug 1 (sent-flag overwrite):** `Write Follow-ups to Queue` operation `appendOrUpdate` → `append`. The follow-up write's `matchingColumns: [opportunity_id, follow_up_stage]` was clobbering `Update Outreach Queue Sent`'s `sent_status=sent` write back to `unsent` on the just-sent stage-0 row, producing a single merged stage-1/unsent row instead of two distinct rows. Result: Outreach Queue desynced from Sent Log truth on every WF4 run since the follow-up flow was wired in — ~566 corrupted rows estimated.
- **Bug 2 (phantom follow-ups, source still pre-Gmail):** `Build Follow-up Sequence` resourced from `$('Send via Gmail').all()` with `$('Prepare Send Fields').itemMatching(sentItem.pairedItem.item)` pairedItem bridge, filtering to items with a real Gmail `id` and no `error`. The prior `b42098b` fix (reading `Prepare Send Fields`) was still **pre-DRY_RUN gate and pre-Gmail-failure drop-off** — items dropped by DRY_RUN or `continueOnFail: true` Gmail failures still got follow-ups scheduled. b42098b reduced the blast radius from 50 → 5 but didn't restore post-send truth.
- **Validated** (WF4 exec 9818, manual run with WF4 deactivated): test contact `TEST-WF4-20260520` produced exactly **2 rows** — stage-0 with `sent_status=sent` and timestamp; stage-1 `sent_status=unsent` scheduled 2026-05-25 (+3 business days). `Build Follow-up Sequence` output count = **1** (post-send truth). Sent Log + Suppression List each got 1 new entry. **PASS.** All test artifacts cleaned up.
- **Version:** 124 → 125. Snapshot: [snapshots/WF4-QG8tNjLdKCQkZpWA-pre-bug1-bug2-fix-2026-05-20.json](snapshots/WF4-QG8tNjLdKCQkZpWA-pre-bug1-bug2-fix-2026-05-20.json) (revert reference; also available as n8n UI version 124).
- **CRITICAL — WF4 remains DEACTIVATED.** Must NOT reactivate until the reconciliation workflow rebuilds the ~566 corrupted Outreach Queue rows from Sent Log truth. Reactivating now would re-send Email 1 to contacts the desynced queue wrongly shows as `unsent`.
- **NEXT:** Phase C–E reconciliation build (design complete in prior planning, not yet built).
- **FUTURE TICKET:** Cross-campaign suppression registry — candidate-marketing overlap discovered 2026-05-19.

### 2026-05-20 (session 2) — WF-RECON Phase C reconciliation preview built

- **Built:** Workflow `WF-RECON Phase C — Reconciliation Preview (Read-Only)` (id `CCQu4oRXAXzQ32Rl`). 6 nodes: Manual Trigger → Read Outreach Queue → Read Sent Log → Read Excluded Companies → Read Sequence Tracker → Classify Contacts (Code, runOnceForAllItems). **No write nodes — preview only.** Saved to [workflows/wf-recon-phase-c-preview.json](workflows/wf-recon-phase-c-preview.json).
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
- **CRITICAL OPEN ITEMS:**
  - **WF4 remains DEACTIVATED.** Must NOT reactivate until Phase E rebuilds the ~566 corrupted OQ rows from Sent Log truth.
  - **Phase E not yet built.** Pending Mike's go-ahead. Will add 4 destination write branches: archive (excluded + migrated), suppress (held), update-in-place (mid-sequence reschedule + held pending status writes), and Cold BD append (warm_complete migration). Reconciliation Code logic is finalized; only the write wiring remains.
  - **3 mid-sequence contacts** scheduled 2026-05-25 after reconciliation: Amanda (Toll Brothers, opp `9ca65578ff5a`), Amber (52TEN, opp `bc292e817a9e`), Caitlyn (Vanguard, opp `0d3112ff9b1e`). All non-stale, follow_up_stage=1 (Email 2 due).
  - **4 held contacts** suppressed until `2026-08-18` (`today+90 days`): Alex@ca-mgmt.com (Chamberlin & Associates), Amel.ali@agilityrobotics.com (Agility Robotics), Bernice@focusmovement.sg (Exodus Movement), Chad.forman@spartannash.com (SpartanNash). All had 1 warm send before the campaign-overlap hold.
  - **497 warm-complete contacts** pending cold migration; `net_new_to_migrate=497` (0 overlap with existing Sequence Tracker).
  - **WF2 future ticket:** Block abuse/fraud/noreply local-parts (`fraud`, `abuse`, `phish`, `spam`, `dmarc`, `postmaster`, `noreply`) in contact discovery — caught `ukemailfraud@americanexpress.com` only via post-hoc company exclusion. Debounce + LLM verdict both marked it `Safe to Send / KEEP`.
  - **FUTURE TICKET (carry-over):** Cross-campaign suppression registry — candidate-marketing overlap discovered 2026-05-19.

### 2026-05-20 (session 3) — Phase E + E.5 reconciliation arc complete; WF4 reactivated clean

- **Phase E** (`EspXcizSIo9hSLcN`, exec 9843, PASS): all 5 branches executed. Cold BD Sequence Tracker 9,082 → 9,579 (+497 net new). OQ updates: 3 mid_sequence rescheduled to 2026-05-25 (Toll/52TEN/Vanguard), 38 fresh_keep stamped `reconciliation_status='reviewed_keep'` (OQ col_26 renamed to `reconciliation_status` manually by Mike), 24 excluded_archive → ARCHIVED, 4 held_campaign_overlap → HELD. **Branch E Write 2 skipped per Option D** — relied on WF6's Sequence Tracker email dedup (filter 5) to block re-migration. Suppression-list write for HELD rows deferred (out of scope).

- **WF4 reactivation diagnostic (exec 9848):** Mike reactivated WF4 between Phase E and Phase E.5. Manual run caught 21 approved+unsent OQ rows. ALL 21 were already in the Suppression List (3–4 entries each, 30-day windows from prior real sends). Suppression Gate blocked all 21. Zero emails sent.

- **False-premise check + reject:** Initial hypothesis was that the 21 suppressions might be phantoms from the desync incident. Cross-reference workflow `yzmUCkig5lZdSwVt` (built, executed, deleted) verified each of the 21 has 3-4 real Sent Log entries. Suppression entries are legitimate. Zero rows deleted from Suppression List. No harm done. Workflow deleted post-confirmation.

- **Root cause:** The 21 are a subset of the 497 warm_complete contacts. Phase E migrated them to Cold BD but left OQ `approval_status='approved'`/'pending', `sent_status='unsent'`, `follow_up_stage='0'` because of Option D. WF4 saw them as sendable; Suppression Gate caught the duplicate send attempts. Steady-state Errors-tab noise.

- **Phase E.5** (`tjBavdMpdfqt03FF`, exec 9949, PASS, workflow deleted post-run): one-shot updated all 497 warm_complete OQ rows to `approval_status='ARCHIVED'`. Pre-state of the 497 bucket: 21 'APPROVED', 476 'PENDING'. Post-state OQ: 521 ARCHIVED (24+497), 3 APPROVED (Toll/52TEN/Vanguard mid_sequence, future scheduled_date), 4 HELD.

- **WF4 first post-E.5 scheduled run (exec 9950, 23:00 UTC):** Schedule-triggered. Read 566 OQ → filter to **0 approved+unsent+due**. Chain halted at Attach Suppression List with 0 output items. Zero sends, zero suppression-blocked entries, zero Errors tab writes. Noise eliminated.

- **End state:**
  - OQ: 566 rows. 3 'approved' (mid_sequence due 2026-05-25), 4 'HELD', 521 'ARCHIVED', ~38 'pending' (fresh_keep awaiting manual approval).
  - Sent Log: 4,268 rows (source of truth, unchanged through arc).
  - Suppression List: 4,220 rows (all legitimate, none deleted).
  - Cold BD Sequence Tracker: 9,579 rows.
  - WF4: ACTIVE. Next email send: 2026-05-25 (3 mid_sequence contacts).

- **Open follow-ups (non-blocking):**
  - Cross-campaign suppression registry (carry-over from 2026-05-19).
  - **WF6 filter hardening:** WF6 only recognizes `approval_status='REJECT'` as exclusion. `ARCHIVED` and `HELD` are NOT in WF6's filter — currently safe because warm_complete rows are in Sequence Tracker (dedup filter 5 catches them) and excluded/held rows have other gate failures. Worth a future pass to add `ARCHIVED`/`HELD` to WF6's REJECT guard.
  - WF2 abuse-pattern email filter (carry-over from session 2).

---

## Key Learnings

- **n8n silent-halt pattern:** `runOnceForAllItems` Code nodes do **not** execute when the upstream node outputs 0 items. Assert/safety nodes that rely on `$input.all()` are bypassed entirely on empty input (no error, execution just ends "success"). Fix: reference an upstream node explicitly, e.g. `$('Upstream Node').all().length`, so the safety node fires regardless of its direct input count. Apply to all future safety/assert nodes.
- **Follow-up scheduling rule:** Nodes that schedule downstream actions (follow-ups, retries, notifications) must source their input from a node that is **post-action-success**, never from the pre-gate queue. Sourcing pre-gate means scheduling actions for items that may never have actioned (the root cause of the 2026-05-19 WF4 phantom follow-up incident).
- **Option D trade-off — migrate without updating source = stale source:** When reconciling between systems, writing to the destination without updating the source row's status leaves stale source rows that re-trigger downstream workflows. Phase E's "skip Write 2 for warm_complete" was correct for blocking COLD re-migration (Sequence Tracker dedup catches it) but didn't cover WARM re-attempt by WF4. Lesson: when migrating between systems, also update source to a terminal state (e.g., `ARCHIVED`) even if the destination has its own dedup. Belt AND suspenders.
- **Suppression Gate as effective last-line-of-defense:** WF4's Suppression Gate caught 21 duplicate-send attempts during the gap between Phase E and Phase E.5 — zero emails sent in error despite the OQ desync. Layered safety (filter → suppression → DRY_RUN → retryOnFail) is worth the complexity. At least one layer catches each class of bug.
- **`approval_status` taxonomy:** WF4 only sends when `approval_status='approved'` (lowercased compare). Other values are ignored: `pending` (default fresh leads, gates until manual approval), `ARCHIVED` (completed/migrated), `HELD` (campaign-overlap pause), `REJECT` (hard-rejected). Use ARCHIVED for terminal "done" state.
- **WF4 DRY_RUN gate:** `$vars.DRY_RUN !== 'true'` (string `notEquals`). True branch (default) sends live; false branch logs only. Set env var `DRY_RUN='true'` to pause sends without deactivating the workflow.
- **Before deleting suppression entries, cross-reference Sent Log:** Suppression entries with empty `company_domain` can have many siblings per email (the 21 contacts in question had 68 total entries across them, avg 3.2 each — written by WF4 across multiple stages of the original sequence). All were legitimate. Always validate against source-of-truth Sent Log before deleting suppressions.
