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
| 2026-05-13 | WF3: Outreach Draft | ACTION 6: Deleted node `wf3-create-doc` (Create Google Doc Review Packet) — was already disabled, terminal node with no downstream connections. WF3 validates clean (0 errors). |
| 2026-05-13 | WF2/4/5/7: All | ACTION 7: Applied `retryOnFail: true, maxTries: 3, waitBetweenTries: 10000` to 21 Sheets write nodes: WF2 (7 nodes), WF4 (7 nodes), WF5 (3 nodes), WF7 (4 nodes: n11, n19, n21, n23). |
| 2026-05-13 | WF6: Warm to Cold | ACTION 8: Added explicit REJECT guard in node n05 (`Filter + Join + Dedup`) — after `sentStatus !== 'sent'` check, added `if ((row.approval_status || '').toUpperCase() === 'REJECT') continue;`. Belt-and-suspenders against WF5 failing to archive REJECTs before Sunday 5am. Validation: 0 new errors (5 pre-existing false positives unchanged). |
| 2026-05-20 | WF-RECON arc | Phase C/E/E.5 reconciliation arc + WF4 desync fix that motivated it. Final state: 521 ARCHIVED + 3 approved + 4 HELD + ~38 pending in OQ, +497 contacts to Cold BD Sequence Tracker, WF4 reactivated clean. Full narrative in [docs/HANDOFF-LOG-2026-05-20.md](docs/HANDOFF-LOG-2026-05-20.md). |
| 2026-05-22 | WF5: Maintenance | Fix: `Classify and Dedupe` node (`wf5-classify`) — added an `approval_status='archived'` → archive path so reconciliation-archived rows leave the queue. `HELD` rows intentionally left in `keepItems` (not archived). |
| 2026-05-22 | WF2: Contact Discovery | Fix: added a dedup check (Sent Log + Suppression List) on the automated path before the Contacts-sheet write; already-contacted contacts are skipped and logged to the Errors tab. Closes the re-contamination vector — resolves the 2026-05-19 "Cause 2" open item (WF2 suppression pre-filter). Manual reconciliation branch untouched. |
| 2026-05-22 | WF4: Approved Send | Fix: `Write Follow-ups to Queue` column map corrected — phantom `email_subject`/`email_body` columns (which existed on no OQ schema) replaced with the six real OQ columns `email_1/2/3_subject` + `email_1/2/3_body`. Follow-up rows now carry real email content. |
| 2026-05-22 | One-shots (run + archived) | `OcCiCbOgE3rrvyEl` (exec 10431) — 530 re-contaminated OQ rows archived. `YzE12kHEq6qX4DDR` (exec 10451) — 212 WF3 parsing-failure rows archived. `KjgSu0Rt36xZuGvB` (exec 10465) — 130 junk rows deleted (cleanup of a failed recovery append). `sR4yW5v1i8gJyJEJ` (exec 10469, Google Sheets `values:batchUpdate`) — 96 blank follow-up rows recovered, 576 cells written, `remaining_damaged_in_oq=0`. All four are archived in n8n (`isArchived`) and inactive. |
| 2026-05-26 | WF2: Contact Discovery | **Fix 1** — added Sent Log + Suppression List dedup to the `Find Unprocessed Contacts` cleanup branch (the Schedule/Manual-trigger path that previously bypassed all dedup). New nodes: `Read Sent Log Manual`, `Read Suppression List Manual`, `Dedup Manual Against Sent History`, `Route Manual Dedup Result`. Skipped contacts log to the existing `Log Skipped Contacts` (Errors tab, reused). NodeCount 48→52. |
| 2026-05-26 | WF2: Contact Discovery | **Fix 1.5** — added `Read Archive Manual` node and expanded `Dedup Manual Against Sent History` Code to also check `opportunity_id ∈ Archive`. `matched_in` taxonomy expanded to include `archive` (and combinations like `sent_log+archive`). Closes the cycling gap where contacts archived without ever being emailed (parsing failures) got re-triggered by WF3. NodeCount 52→53. |
| 2026-05-26 | One-shots (run + deleted) | `cTFM47Hum2Uv0y7q` (damage diagnostic, read-only): identified 1,246 re-contaminated OQ rows (52 of 414 parsing-failed had been emailed before; 1,148 had send_count ≥ 3). `65M10aiKdk5eZUMD` (exec 10928, ~9s, PASS) — Mike-triggered: 1,148 re-contaminated rows archived (`approval_status='ARCHIVED'` for pending/unsent rows where Sent Log send_count ≥ 3). `30VhHleKBj6dTrvh` (parsing-failed cross-ref diagnostic): found 414 pending parsing-failed rows; 213 (51%) repeat offenders in Archive. `HxAyGvZYpEwExAAk` (exec ~16:43Z, 6.1s, PASS) — 414 parsing-failed pending rows archived. All deleted post-run. |
| 2026-05-26 | WF5: Maintenance | Manual run via temporary webhook (exec 10935, 14.2s): 748 OQ → 414 archived to Archive sheet → 334 OQ post. Webhook trigger added then removed (nodeCount 20→21→20). Sent summary email confirms end-to-end run. |
| 2026-05-26 | WF1: Lead Discovery | **Cleanup** — deleted disabled+terminal `write-rejected` node; deleted two vestigial 1s `Wait` nodes (`wait-before-qualified`, `wait-before-needs-review`) since `retryOnFail:3, waitBetweenTries:10000` covers the 429 case; removed dead `_excluded_companies` field from `build-search-combos` (Staffing Keyword Filter reads Excluded Companies sheet directly). Net: 33 → 30 nodes. |
| 2026-05-26 | WF2: Contact Discovery | **Cleanup** — deleted never-activated Apollo fallback branch (4 nodes: `wf2-apollo-gate`, `wf2-prep-apollo`, `wf2-apollo-search`, `wf2-parse-apollo`); wired `Score & Rank Contacts` directly to `Confidence Gate`. Net: 53 → 49 nodes. |
| 2026-05-26 | WF3: Outreach Draft | **Root-cause fix for parsing-failure cycling** — Parse LLM Response no longer writes placeholder "parsing failed" rows to Outreach Queue. New flow: Parse LLM Response → Route Parse Result (IF on `_parse_status`) → success → Write to Outreach Queue / fail → Log Parse Failure (new Sheets node, appends diagnostic fields to Errors tab). Stops the WF2-cleanup-cycle-WF3-redraft loop at the source. Net: 13 → 15 nodes. |
| 2026-05-26 | WF4: Approved Send | **Cleanup** — deleted no-op `Check Suppression` node (its purpose was eaten by `Attach Suppression List`); re-pointed 4 downstream column-map refs from `$('Check Suppression')` to `$('Attach Suppression List')` in Write to Sent Log, Update Outreach Queue Sent, Update Opportunity to Sent, Add to Suppression List; wired `Attach Suppression List` directly to `Suppression Gate`. DRY_RUN paused for the change, restored after. Net: 24 → 23 nodes. |
| 2026-05-26 | WF6: Warm to Cold Handoff | **Filter hardening** — n05 belt-and-suspenders guard now excludes `REJECT`, `ARCHIVED`, and `HELD` (was REJECT only). Closes carry-over open ticket from 2026-05-20. |
| 2026-06-03 | WF3: Outreach Draft | **8-email expansion** — new NEPQ-arc system prompt (8-email sequence with problem-awareness cadence); sizzle routing by keyword track (IT/Finance/Construction); candidate sizzle injected verbatim (they/them pronouns, numbers preserved); max_tokens 2500→6000; OQ write now includes `email_4–8_subject/body` + `candidate_track` (10 new columns). Switched LLM from gpt-4o-mini to Claude Sonnet 4.6 (`$vars.ANTHROPIC_MODEL=claude-sonnet-4-6`) — gpt-4o-mini could not reliably preserve verbatim dollar amounts. `clean()` post-processor added: strips intra-word hyphens, 15+ banned clichés, placeholder fixes, trailing whitespace normalization. |
| 2026-06-03 | WF4: Approved Send | **8-email expansion** — `Build Follow-up Sequence` now stages 0–7 (8 emails total); cadence E1→E2 = +3 biz days, E2–E8 = +7 cal days weekly; empty-body guard skips next stage if `email_(n+1)_body` blank (protects legacy 3-email contacts); all 16 email fields carried forward on every follow-up row; `Write Follow-ups to Queue` schema expanded with `email_4–8_subject/body` (28 total columns). |
| 2026-06-03 | WF5: Maintenance | **Terminal archive ownership transferred to WF6** — removed `followUpStage >= 2` completed auto-archive block from `Classify and Dedupe`. WF6 now sets `approval_status='ARCHIVED'` after Cold BD handoff; WF5's existing `reconciliation_archived` sweep cleans up next morning. Sticky note updated. |
| 2026-06-03 | WF6: Warm to Cold Handoff | **8-email expansion** — completion trigger updated: `followUpStage === 7` (8-email done) OR `followUpStage === 2 && !email_4_body` (legacy 3-email done); `Current Touch` 4→1 (cold sequence starts fresh); new `Split for OQ Archive` + `Mark OQ Archived` nodes — after Sequence Tracker append, sets `approval_status='ARCHIVED'` on all OQ rows for each `opportunity_id`; rewired n08→n14→n15→n09. NodeCount 13→15. |
| 2026-06-05 | WF2: Contact Discovery | Option B location heuristic added to WF2. Score & Rank Contacts now applies -40 penalty for non-US email TLD, -20 for non-US source URL, us_assumed when no signal fires. contact_location_flag field added to Contacts sheet and Write to Contacts Sheet node. Confidence Gate interaction is intentional — non-US contacts score below 70 and route to needs_review instead of auto-triggering WF3. Manual UI re-save completed. |
| 2026-06-09 | Sent Log (sheet) / WF2 dedup | **Sent Log header row repaired.** Diagnostic found the `Sent Log` tab had **no header row** — row 1 was a real send record, so n8n keyed every column by that row's data values and there was no `contact_email` column. Both WF2 dedup nodes (`Dedup Against Sent History`, `Dedup Manual Against Sent History`) read `i.json.contact_email`, so the Sent-Log half of dedup matched **0 of 5,579 rows** (long-term dedup dead; 30-day dedup still covered via Suppression List, which has valid headers). **Fix:** Sheets API `batchUpdate` `insertDimension` inserted a blank row at top (preserving the row-1 record, now row 2), then wrote header `opportunity_id \| contact_email \| company_domain \| sent_timestamp \| email_subject \| follow_up_status` to A1–F1. Spreadsheet `192SvtVdg3hA0f4ZvHSWZTX2FG1HOzU_vw8jQA9md6no`. Verified: `has_contact_email_key=true`, 5,580 data rows populated. Applied via temp read-only workflow (created/fired/deleted). **Gap investigation (Sheets API `values.get A:F`):** no data loss — full history present (April 1,790 / May 3,392 / **June 526** rows through 2026-06-09; 0 interior blanks). The earlier "no rows since 2026-05-18" reading was a false alarm from sampling the physically-last n8n rows and assuming chronological order — the sheet's append order isn't strictly chronological. WF4 appends are working; WF2 dedup now sees full history. Minor: 1 stray row holds literal `sent_timestamp` in col D (harmless). |
| 2026-06-09 | OQ backfill (one-shot `ARwhzgXPDlJaYZ4s`) | **Emails 4–8 backfilled for all 442 legacy stage-2 contacts** (`follow_up_stage=2, sent_status=sent, email_4_body` blank) so they continue the 8-email arc instead of WF6 handing them to Cold BD at email 3. Built an inactive, manual-trigger one-shot: Read OQ → Filter Targets (LIMIT-chunked) → SplitInBatches → Build 4–8 prompt (WF3 system prompt + sizzle/`pickTrack` routing verbatim; outputs only emails 4–8; existing emails 1–3 passed in for continuity) → Claude API (`claude-haiku-4-5-20251001`, max_tokens 4000) → Parse + `clean()` → **write email_4–8 to the existing stage-2 row** (match `opportunity_id`) → **append new `follow_up_stage=3, approval_status=pending, sent_status=unsent, scheduled_date=2026-06-16` row** carrying all 8 emails. Populating `email_4_body` on the stage-2 row flips **OFF** WF6's legacy guard (`stage===2 && !email_4_body`), preventing the cold handoff; the new pending row gives WF4 something to send at email 4 once Mike approves. 3-contact **Sonnet** pilot verified quality (verbatim numbers, they/them, continuity, no dashes); switched to **Haiku** for the batch per cost. **Final read-only audit: 442 backfilled, 442 stage-3 pending rows (exactly one per contact), 0 duplicates, `legacy_blank_remaining=0`.** A mid-run concurrency incident (see Key Learnings) created 75 duplicate stage-3 rows; removed via a Sheets API `deleteDimension` cleanup one-shot. Bulk of the 442 run by Mike from the n8n UI (Manual Trigger, LIMIT=30, ~10 Executes). Workflow left inactive/manual as the record. |

### 2026-05-19 — WF4 phantom follow-up incident

- **Diagnosed:** `Build Follow-up Sequence` was reading `$('Check Suppression').all()` (all 50 approved rows) instead of `$('Prepare Send Fields').all()` (only the rows that cleared suppression + DRY_RUN). Result: 45 phantom stage-1 follow-ups scheduled for 2026-05-22 to contacts who never received Email 1, plus a recurring "Attach Suppression List → 0 → halt" loop blocking all subsequent WF4 runs.
- **Fix 1** (live in WF4 `QG8tNjLdKCQkZpWA`, exec 9761 baseline): `Build Follow-up Sequence` input source changed to `$('Prepare Send Fields').all()`. Committed locally as `b42098b`.
- **Fix 2** (one-shot cleanup workflow `r839lZSMkYZz7pnj`, exec 9773): deleted 45 Bucket A phantom rows, preserved 5 Bucket B legit follow-ups. Workflow archived in n8n (renamed `ARCHIVED — …`, inactive), retained as reference.
- **Resolved 2026-05-22:** Cause 2 (WF2 suppression pre-filter) closed by the 5/22 WF2 fix adding Sent Log + Suppression List dedup to the automated path before the Contacts-sheet write. See the 5/22 changelog row.

### 2026-05-26 — Re-contamination + parsing-failure cleanup; WF2 cleanup-branch dedup hardened

- **Damage diagnostic** (workflow `cTFM47Hum2Uv0y7q`, built/run/deleted): cross-referenced OQ vs Sent Log. Found 1,898 OQ rows total, 1,768 pending+unsent, **1,246 re-contaminated** (contact_email present in Sent Log) with breakdown by prior_sends: 98 (1), 653 (3), 170 (4), 274 (5), 51 (6). Genuinely fresh: 522.

- **Root-cause analysis:** WF2's existing main `Dedup Against Sent History` (added 5/22) was functioning correctly — exec 10831 showed 162 contacts in / 162 kept with zero matches, because Hunter's `Score & Rank Contacts` already filters out emails already in the Contacts sheet. But **WF2's `Find Unprocessed Contacts` cleanup branch** (Schedule + Manual triggers) bypassed all dedup — only checked if opportunity_id was in OQ, never checked Sent Log/Suppression/Archive. This was the re-contamination vector.

- **Fix 1** — Sent Log + Suppression List dedup added to cleanup branch. New chain: `Read Outreach Queue → Read Sent Log Manual → Read Suppression List Manual → Find Unprocessed Contacts → Dedup Manual Against Sent History → Route Manual Dedup Result → [Trigger WF3 Manual | Log Skipped Contacts]`. Separate Sent Log / Suppression reads (not reusing the main-branch versions) so the cleanup branch is self-contained against future trigger changes. Logging schema reuses existing `Log Skipped Contacts` Errors-tab node.

- **One-shot — Fix 2** (`65M10aiKdk5eZUMD`, exec 10928 triggered by Mike, ~9s, PASS): archived 1,148 OQ rows with prior_sends ≥ 3 (`approval_status='ARCHIVED'`). Breakdown by prior_sends: 3=653, 4=170, 5=274, 6=51. Verify: archived_now=1,148, still_pending=0. Workflow deleted post-run.

- **Parsing-failed cleanup diagnostic** (workflow `30VhHleKBj6dTrvh`, built/run/deleted): OQ post-Fix 2 + post-WF5-rewrite = 748 rows. **414 pending rows** with `email_1_subject` containing 'parsing failed' (literal: "Review needed, parsing failed"). Cross-ref against Archive sheet (8,594 total rows, 1,656 historical parsing failures): **213 of 414 (51%) are repeat offenders** — same contact_email in both current pending and historical archived. Every sample's `opportunity_id` matched — same opp re-cycled through WF3 multiple times. Top offender companies: Virta Health (34x), Highmark Health (17x), Cardinal Health (17x), G2i Inc. (12x), Lumen (12x). Top offender emails: karuna@onton.com (5x), sue.esplin@odpbusiness.com (4x), judyc@planet.com.tw (4x), mike@trueanomaly.space (4x).

- **One-shot — Step 3** (`HxAyGvZYpEwExAAk`, exec ~16:43Z, 6.1s, PASS): archived all 414 parsing-failed pending rows. Verify: archived_now=414, parsing_failed_pending_remaining=0. Workflow deleted post-run.

- **Fix 1.5** — Archive sheet check added to cleanup branch dedup. New node `Read Archive Manual` between Read Suppression List Manual and Find Unprocessed Contacts. `Dedup Manual Against Sent History` Code expanded to also check `opportunity_id ∈ archiveOppIds`. `matched_in` taxonomy now supports `archive` and combinations like `sent_log+archive`. Closes the cycling gap where parsing-failure contacts (archived without ever being emailed, so not in Sent Log) get re-detected by WF2's cleanup branch and re-drafted by WF3.

- **WF5 manual run** (exec 10935, 14.2s, via temporary webhook trigger added+removed): processed the 414 newly archived rows. 748 OQ pre → 414 archived to Archive sheet → 334 OQ post. Summary email sent.

- **End state:**
  - WF2: ACTIVE, 53 nodes. Cleanup branch now dedup-protected against sent_log, suppression_list, and archive (opp_id).
  - OQ: 334 rows. Mix of `pending` (fresh leads awaiting approval), `HELD`, `approved` (Phase E mid-sequence carryover).
  - Archive sheet: ~9,008 rows (8,594 pre + 414 new from this session).
  - WF4: ACTIVE. Steady-state.

### 2026-06-03 — 8-email warm sequence, sizzle routing, Claude Sonnet 4.6, archive ownership transfer

- **WF3: 8-email NEPQ-arc sequence** — new system prompt with problem-awareness cadence across 8 emails. Sizzle routing by keyword track (IT/Finance/Construction); candidate sizzle block injected verbatim with they/them pronouns, dollar figures, and certifications preserved. `max_tokens` 2500→6000. OQ schema expanded with `email_4–8_subject/body` + `candidate_track` (10 new columns). `clean()` post-processor strips intra-word hyphens, 15+ banned clichés, placeholder fragments, and trailing whitespace.

- **WF3: Provider switch gpt-4o-mini → Claude Sonnet 4.6** — gpt-4o-mini could not reliably preserve verbatim dollar amounts in email copy (e.g., "$125K/yr" would be paraphrased or dropped). Switched to `$vars.ANTHROPIC_MODEL=claude-sonnet-4-6`. Resolves dollar-preservation issue. Promotes "WF3 Claude branch JSON enforcement" ticket from deferred to active backlog — JSON schema enforcement via Anthropic tool-use API is now the next build.

- **WF4: 8-email follow-up expansion** — `Build Follow-up Sequence` stages 0–7 (8 emails). Cadence: E1→E2 = +3 biz days, E2–E8 = +7 cal days weekly. Empty-body guard: if `email_(n+1)_body` is blank, that stage is skipped — protects legacy 3-email contacts in OQ without requiring a data migration. All 16 email fields carried forward on every follow-up row. `Write Follow-ups to Queue` schema expanded to 28 total columns.

- **WF5: Archive ownership transferred to WF6** — removed the `followUpStage >= 2` completed auto-archive block from `Classify and Dedupe`. Ownership chain is now explicit: WF6 sets `approval_status='ARCHIVED'` after cold handoff → WF5's existing `reconciliation_archived` sweep catches any stragglers next morning. Avoids WF5 guessing at completion state from partial followUpStage reads.

- **WF6: 8-email completion trigger + archive write** — completion trigger updated to: `followUpStage === 7` (8-email done) OR `followUpStage === 2 && !email_4_body` (legacy 3-email done). `Current Touch` reset 4→1 (cold sequence starts fresh from touch 1). New `Split for OQ Archive` + `Mark OQ Archived` nodes appended after Sequence Tracker write — sets `approval_status='ARCHIVED'` on every OQ row for the opportunity_id. Rewired n08→n14→n15→n09. NodeCount 13→15.

---

## Open Tickets

Consolidated list of carry-over and current open items. New tickets added here; closed tickets removed.

- **WF3 JSON enforcement — ACTIVE** (originated 2026-05-26, elevated 2026-06-03). WF3 now uses Claude Sonnet 4.6 (`$vars.ANTHROPIC_MODEL`). The Anthropic Messages API has no `response_format: {type: "json_object"}` equivalent. Current reliance on prompt instructions alone means parsing failures are possible if Claude returns non-JSON preamble. Fix: implement Anthropic tool-use API with a `draft_sequence` tool whose input schema enforces the 8-email JSON structure. Next build when time allows.

- **WF3 parsing failure monitoring** (originated 2026-05-26, updated 2026-06-03). GPT-4o-mini-specific parsing failures are no longer relevant (provider switched). Monitor the Errors tab for Claude-specific failures — diagnostic fields (`opportunity_id`, `company_name`, `contact_email`, `raw_excerpt`, `llm_provider`) are still being written. If `llm_provider=anthropic` failures emerge, the JSON enforcement build above is the fix.

- **WF2 abuse-pattern email filter** (originated 2026-05-20). Block abuse/fraud/noreply local-parts (`fraud`, `abuse`, `phish`, `spam`, `dmarc`, `postmaster`, `noreply`) in contact discovery. Caught `ukemailfraud@americanexpress.com` only via post-hoc company exclusion. Debounce + LLM verdict both marked it `Safe to Send / KEEP`.

- **Cross-campaign suppression registry** (originated 2026-05-19). Candidate-marketing overlap discovered. Needs a shared suppression layer that covers warm outreach + cold BD + future campaigns. No build yet.

- **Haiku number-fidelity spot-check — OPEN** (originated 2026-06-09). The 442-contact emails 4–8 backfill used `claude-haiku-4-5-20251001` for cost. Only the 3-contact **Sonnet** pilot was eyeballed for verbatim number preservation; the ~439 **Haiku**-generated sets were not. Spot-check a sample of the Haiku output (emails 4 and 7 — candidate dollar figures like $1.5M–$10.7M, team sizes 40+, certifications PMP/Six Sigma/SAFe/Scrum) to confirm Haiku preserved them verbatim (per the documented smaller-model risk in Key Learnings). If degraded, regenerate the affected sets with a Claude Sonnet model.

- **WF6 legacy-guard re-verify after 2026-06-14 — OPEN** (originated 2026-06-09). The 442 backfilled stage-2 contacts now have `email_4_body` populated, so WF6's completion trigger (`followUpStage === 2 && !email_4_body`) should **skip** them (no Cold BD handoff). Re-check the WF6 execution after the Sunday **2026-06-14** run to confirm these ~442 are NOT archived/handed to Cold BD. The new `stage-3 / pending` rows stay gated until Mike approves them in WF4.

- **Workflows deferred from the 2026-05-26 audit** (not blockers):
  - WF1 double-routing pattern (Route by Pre-Filter → LLM → Route by Classification). Works correctly; flatten only if it becomes painful to maintain.
  - WF2 split into WF2a (contact discovery) and WF2b (archive + reject cleanup). Currently 49 nodes — manageable, but a split would be more maintainable.
  - WF5 `Regroup After Archive` / `Regroup After Keep` nodes are idiomatic n8n aggregate-then-fan-out-then-aggregate plumbing. Leave alone.

---

## Closed (logged for reference)

- **2026-05-26 — WF6 filter hardening:** `ARCHIVED` and `HELD` added to WF6 n05 REJECT guard. Was carry-over from 2026-05-20.
- **2026-05-22 — WF2 suppression pre-filter:** "Cause 2" from the 2026-05-19 phantom follow-up incident. Closed by 5/22 dedup-on-main-path fix; cleanup branch closed by 5/26 Fix 1 and Fix 1.5.

---

## Key Learnings

- **n8n silent-halt pattern:** `runOnceForAllItems` Code nodes do **not** execute when the upstream node outputs 0 items. Assert/safety nodes that rely on `$input.all()` are bypassed entirely on empty input (no error, execution just ends "success"). Fix: reference an upstream node explicitly, e.g. `$('Upstream Node').all().length`, so the safety node fires regardless of its direct input count. Apply to all future safety/assert nodes.
- **Follow-up scheduling rule:** Nodes that schedule downstream actions (follow-ups, retries, notifications) must source their input from a node that is **post-action-success**, never from the pre-gate queue. Sourcing pre-gate means scheduling actions for items that may never have actioned (the root cause of the 2026-05-19 WF4 phantom follow-up incident).
- **Option D trade-off — migrate without updating source = stale source:** When reconciling between systems, writing to the destination without updating the source row's status leaves stale source rows that re-trigger downstream workflows. Phase E's "skip Write 2 for warm_complete" was correct for blocking COLD re-migration (Sequence Tracker dedup catches it) but didn't cover WARM re-attempt by WF4. Lesson: when migrating between systems, also update source to a terminal state (e.g., `ARCHIVED`) even if the destination has its own dedup. Belt AND suspenders.
- **Suppression Gate as effective last-line-of-defense:** WF4's Suppression Gate caught 21 duplicate-send attempts during the gap between Phase E and Phase E.5 — zero emails sent in error despite the OQ desync. Layered safety (filter → suppression → DRY_RUN → retryOnFail) is worth the complexity. At least one layer catches each class of bug.
- **`approval_status` taxonomy:** WF4 only sends when `approval_status='approved'` (lowercased compare). Other values are ignored: `pending` (default fresh leads, gates until manual approval), `ARCHIVED` (completed/migrated), `HELD` (campaign-overlap pause), `REJECT` (hard-rejected). Use ARCHIVED for terminal "done" state.
- **WF4 DRY_RUN gate:** `$vars.DRY_RUN !== 'true'` (string `notEquals`). True branch (default) sends live; false branch logs only. Set env var `DRY_RUN='true'` to pause sends without deactivating the workflow.
- **Before deleting suppression entries, cross-reference Sent Log:** Suppression entries with empty `company_domain` can have many siblings per email (the 21 contacts in question had 68 total entries across them, avg 3.2 each — written by WF4 across multiple stages of the original sequence). All were legitimate. Always validate against source-of-truth Sent Log before deleting suppressions.
- **Cleanup-branch bypass — every safety filter must apply to every write path:** WF2's main Hunter/Apollo path had Sent Log dedup since 5/22, but the parallel `Find Unprocessed Contacts` cleanup branch (Schedule + Manual triggers → `Trigger WF3 Manual`) bypassed it entirely — only checked `opportunity_id ∈ OQ`. Result: 1,246 re-contaminated rows + 414 parsing-failed re-cycled rows accumulated despite the main dedup working as designed. Lesson: when adding a safety filter, audit ALL paths that lead to the protected write. A single unprotected branch defeats the filter for the entire workflow. Verified 2026-05-26 by exec-data analysis: main path showed 162/162 kept (correct) while accumulated damage in OQ grew unchecked.
- **Archive sheet is a legitimate dedup source for opp_id:** Contacts/opps archived without ever being emailed are invisible to Sent Log + Suppression List dedup (those only see actually-sent contacts). The Archive sheet is the only record of "this opp was attempted before and discarded." For workflows that should not retry archived items (e.g., WF3 redrafting parsing-failed contacts), add Archive `opportunity_id` check alongside Sent Log email check. Trade-off: Archive grows unbounded (~9,000 rows now); read cost scales linearly. Acceptable for now, may need archival pruning if it exceeds 50k.
- **One-shots: webhook + active + delete = fastest dev loop:** Across the 2026-05-26 session, all diagnostics and one-shots followed the pattern: create with Webhook trigger → activate → fire via `n8n_test_workflow` → capture response → delete. ~10-15s per cycle vs minutes-to-hours for the Manual-Trigger + UI-trigger flow. Same data-integrity guarantee (one-time, isolated, deletable). Use this for any read-only diagnostic and most one-shot writes; reserve Manual Trigger + UI-fire for production-state-changing runs that need an in-the-loop human checkpoint.
- **Triggering an active production workflow that lacks a webhook trigger:** Workflows with only Manual/Schedule triggers can't be fired via `n8n_test_workflow`. Pattern: add a temporary Webhook trigger node connected to the same downstream node the Manual Trigger feeds → fire → `removeNode` the webhook immediately. Used on WF5 (`acdY3wEi8Y7RElks`) on 2026-05-26 to clear the 414 parsing-failed rows. Two operations per side (add+connect, then remove), nodeCount returns to baseline.
- **Archive ownership belongs to the completing workflow, not the sweeper:** Terminal `ARCHIVED` writes should be done by the workflow that actually marks completion (WF6, on cold handoff), not by a general maintenance sweep (WF5). A sweeper guessing completion from `followUpStage >= N` is fragile when the stage threshold changes. Pattern: completing workflow sets `approval_status='ARCHIVED'`; sweeper only catches stragglers via the existing `reconciliation_archived` path. Cleaner ownership, survives schema expansion.
- **LLM provider for verbatim number preservation:** Smaller/cheaper models (gpt-4o-mini) paraphrase or drop verbatim dollar amounts, salaries, and certifications in generative copy — a known weakness at low temperature. Claude Sonnet 4.6 preserves them reliably. When email copy must carry verbatim financial figures or credentials, use a Claude model; don't optimize for cost at this node.
- **Empty-body guard for schema expansion:** When expanding an OQ schema (e.g., 3-email → 8-email), rows already in the queue only have the original columns. Rather than running a migration or blocking old contacts, add a guard at the follow-up staging node: if `email_(n+1)_body` is blank, skip that stage. The sequence terminates naturally at the last populated email. Same pattern applies to any future OQ column expansion.
- **Never re-fire `n8n_test_workflow` on a "No response from n8n server":** The MCP tool's wait is **client-side only and hard-caps at ~120 s** — a longer-running execution keeps running **server-side** and the production webhook drives it to completion. "No response" does NOT mean the run failed. Re-firing spawns **concurrent executions**: on 2026-06-09 this launched 3 overlapping backfill passes that shared `$getWorkflowStaticData('global')` (one run's `sd.results = []` reset wipes another's accumulator) and appended **75 duplicate stage-3 rows**. Rule: **fire once, then poll** `n8n_executions list` until the new execution shows `finished: true` before doing anything else — never re-fire. For multi-minute one-shots, either size chunks to finish within ~110 s so a single synchronous fire returns its result cleanly (used LIMIT=30 → ~84 s for the 4–8 backfill), or fire-once-and-poll. Editing an active workflow also de-registers its webhook until re-activated, which compounds the confusion.
- **Sheet with no header row breaks every read-by-column-name:** A Google Sheet tab whose row 1 is a data record (no header) makes n8n key each column by row-1's *values*, so `i.json.contact_email` is `undefined` for every row and any dedup/lookup-by-name silently matches nothing. (Sent Log was in this state since ~April; WF2's Sent-Log dedup was dead, only masked by the 30-day Suppression List which had valid headers.) Fix without data loss: Sheets API `batchUpdate` `insertDimension` to insert a blank row at the top, then write the header to A1:F1 (preserves the original row-1 record). Note n8n's Sheets *read* stops at the first blank row, so physical-tail sampling can falsely look like "no recent data" — use the Sheets API `values.get A:F` (returns the full used range) to audit true extent.
