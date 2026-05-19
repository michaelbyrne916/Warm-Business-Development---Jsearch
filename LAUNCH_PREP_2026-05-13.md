# Launch Prep Event Log — 2026-05-13

**Session type:** Pre-launch batch execution + hardening  
**Target launch:** Sunday 2026-05-17, 5am/6am CDT  
**Author:** Claude (claude-sonnet-4-6) with Mike Byrne  
**System spec:** See CLAUDE.md — this document is the event record only

---

## 1. Scope and Date

**Date:** 2026-05-13

This session executed the complete launch preparation batch for the warm-to-cold BD pipeline. The pipeline routes stale warm leads (outreach complete, no reply, ≥5 days since final email) from the warm outreach system (WF1–WF5) into the cold campaign system (WF6→WF7→Instantly.ai).

The session covered:
- Safety verification (DRY_RUN gate, WF4 live send block)
- Read-only audits of WF6 source tagging and WF6 REJECT handling
- 8 discrete actions (ACTION 0–7) modifying WF1, WF2, WF3, WF7, and applying retryOnFail across WF2/4/5/7
- Follow-up action: WF6 REJECT filter added the same day (ACTION 8)
- CLAUDE.md updated: WF7 added to registry, missing IDs filled (WF2/3/5), 9 change log entries

---

## 2. Initial State

**Pipeline state at session start:**

| Component | State | Notes |
|-----------|-------|-------|
| WF1: Lead Discovery | ACTIVE | Running Mon–Fri 7am; WF1→WF2 auto-chain was DISABLED |
| WF2: Contact Discovery | ACTIVE | Runnable manually; auto-trigger from WF1 was off |
| WF3: Outreach Draft | ACTIVE | Dead node `wf3-create-doc` still attached (disabled, terminal) |
| WF4: Approved Send | ACTIVE | DRY_RUN = "true" in n8n Variables — all Gmail sends blocked |
| WF5: Maintenance | ACTIVE | Running nightly; no issues |
| WF6: Warm to Cold | ACTIVE | Running Sunday 5am; never yet run against real data |
| WF7: Cold Campaign | INACTIVE | Not yet activated; LAUNCH_DATE stale (2026-04-21); source filter missing |
| BD1/BD6/BD7 | ACTIVE | Instantly.ai event handlers, throttled to hourly |

**Why the pipeline was paused:**  
Domain warm-up period. WF4 was held in DRY_RUN mode to allow inbox reputation to build before live Gmail sends began. The WF1→WF2 auto-chain had also been deliberately disabled during an earlier debugging phase and not yet re-enabled.

---

## 3. Audit Findings

Read-only verifications conducted before and during the batch:

**DRY_RUN state confirmed safe**  
WF4 node `wf4-dry-run-gate` was inspected directly. Condition: `$vars.DRY_RUN notEquals "true"` — when the variable is `"true"`, the condition is FALSE, routing execution to the DRY RUN Log Only branch. All Gmail sends confirmed blocked. Safe to proceed with all other changes.

**WF4 follow-up cadence — static analysis vs. production evidence discrepancy**  
The n8n validator flagged `wf4-build-followups` and `wf4-write-followups` with "Code doesn't reference input data" — which would normally suggest broken logic. Audit finding: these nodes use cross-node references (`$('...').first().json`), not `$input`, making the warning a false positive. Production evidence confirmed: follow-up emails were successfully delivered to cclayton@eliassen.com, proving the nodes function correctly end-to-end. Decision: leave untouched.

**DNC silo gap**  
Instantly.ai unsubscribes are processed by BD7 and written to Airtable only. The warm pipeline's WF4 suppression list lives in Google Sheets. There is no automated sync between the two. At launch volume, this is manageable via manual cross-check, but poses a risk at scale.

**Stale LAUNCH_DATE in WF7**  
WF7 nodes n4 and n16 both contained `new Date('2026-04-21')` — a date from a prior planning cycle. Left uncorrected, this would have computed an inflated `weeksSinceLaunch` on activation day (2026-05-17), pushing the ramp tier too high and potentially over-sending in week 1.

**WF7 source filter gap**  
WF7 node n4 had no filter on the `source` field for new contacts entering the Sequence Tracker for the first time. Without it, any contact in the Master Contacts sheet (regardless of origin) could be picked up on the first Sunday run. The intent is warm-handoff-only for the initial launch.

**retryOnFail coverage gaps**  
Google Sheets write nodes across WF2, WF4, WF5, and WF7 lacked `retryOnFail`. WF1 had already been hardened after a 429 incident. The same pattern needed to be applied to the remaining workflows before high-volume launch.

**WF6 source tagging — confirmed correct**  
WF6 node n05 already writes `'Source': 'project1_warmout'` and `'warm_origin': 'TRUE'` to every Sequence Tracker row. No gap existed. WF7's filter on `contact.source === 'project1_warmout'` correctly targets this column.

**WF6 REJECT handling — gap identified, later hardened**  
WF6 node n02 reads the entire Outreach Queue with no `approval_status` filter. REJECT exclusion relied entirely on WF5 archiving rejected rows nightly before WF6's Sunday 5am trigger. If WF5 failed Saturday night, REJECTs could enter the Sequence Tracker. Addressed in ACTION 8.

---

## 4. Decisions Made

**Decision 1: WF4 follow-up nodes left enabled**  
`wf4-build-followups` and `wf4-write-followups` were flagged by the validator but confirmed working via production delivery evidence (cclayton@eliassen.com). Rationale: static analysis produces a false positive on cross-node reference patterns; touching these nodes would break the follow-up pipeline. Rule: do not modify these nodes without explicit instruction.

**Decision 2: Manual DNC handling for launch; BD7→Sheets sync deferred**  
The Airtable/Sheets DNC silo is a known gap but acceptable at launch volume. Mike will manually cross-check Instantly.ai unsubscribes against the warm pipeline suppression list during the first few weeks. Automated BD7→Sheets sync scoped as a v2 item, targeted 2–3 weeks post-cold-launch.

**Decision 3: source=project1_warmout filter enforced in WF7 n4**  
New contacts entering the Sequence Tracker for the first time must have `source === 'project1_warmout'` (case-insensitive). This gates the first cold Sunday run to warm-handoff contacts only, preventing any stray Master Contacts rows from being picked up. Existing contacts (already in Sequence Tracker) continue through their existing status/cadence logic unchanged.

**Decision 4: WF7 LAUNCH_DATE set to 2026-05-10**  
Setting LAUNCH_DATE to the activation date (2026-05-17) would compute `weeksSinceLaunch = 0`, hitting the Week 0 ramp tier (lowest volume). The intent is to start at Week 1 volume on day 1. By setting LAUNCH_DATE = 2026-05-10 (one week before activation), `weeksSinceLaunch = 1` on 2026-05-17, targeting the correct ramp tier: weeklyCap=75, dailyLimit=30 per inbox. Correction applied mid-session after an initial error (2026-05-17 was briefly patched before being corrected to 2026-05-10).

**Decision 5: WF1→WF2 auto-chain re-enabled**  
The chain (WF1 triggers WF2 on qualified opportunity discovery) had been disabled during debugging. Re-enabled so the pipeline runs end-to-end automatically Mon–Fri without manual intervention.

---

## 5. Actions Taken

### ACTION 0 — Safety Verification (read-only)
- **Workflow:** WF4 (`QG8tNjLdKCQkZpWA`)
- **Node:** `wf4-dry-run-gate`
- **Finding:** `$vars.DRY_RUN notEquals "true"` → FALSE when DRY_RUN = "true" → routes to DRY RUN Log Only. All sends blocked. Safe to proceed.
- **Change:** None.

### ACTION 1 — WF1→WF2 Chain Re-enabled
- **WF1** (`3qPmKNCZseEzvFNj`): enabled node `prepare-wf2-payload` (was `disabled: true`)
- **WF1** (`3qPmKNCZseEzvFNj`): enabled node `trigger-contact-discovery` (was `disabled: true`)
- **WF2** (`2uWLVQ4JS1zXwztO`): enabled node `wf2-trigger-exec` (was `disabled: true`)
- Both workflows saved and validated. Pre-existing Code node static-analysis errors only; 0 invalid connections.

### ACTION 2 — WF6 Source Tagging Verification (read-only)
- **Workflow:** WF6 (`Zyba7eIcS0berpVA`), node n05 (`Filter + Join + Dedup`)
- **Finding:** WF6 already writes `'Source': 'project1_warmout'` and `'warm_origin': 'TRUE'` to every Sequence Tracker row via the `to_add.push(...)` block.
- **Change:** None. WF7's filter (`contact.source === 'project1_warmout'`) already matched this schema.

### ACTION 3 — WF7 source=project1_warmout Filter Added
- **Workflow:** WF7 (`Bk4CkgOMr6t6XTG6`), node **n4** (`Filter, Stagger and Group Contacts`)
- **Change:** In the `!state` (new contact) path, added guard immediately before wave assignment:
  ```js
  if ((contact.source || '').toLowerCase().trim() !== 'project1_warmout') return;
  ```
- Existing contacts (already in Sequence Tracker) unaffected — they pass through existing status/cadence logic.

### ACTION 4 — WF7 LAUNCH_DATE Updated
- **Workflow:** WF7 (`Bk4CkgOMr6t6XTG6`)
- **Node n4:** `new Date('2026-04-21')` → `new Date('2026-05-10')`
- **Node n16** (`Prepare Instantly Upload Payload`): `new Date('2026-04-21')` → `new Date('2026-05-10')`
- Note: An intermediate incorrect value of `2026-05-17` was briefly applied and immediately corrected to `2026-05-10` in the same session.

### ACTION 5 — WF6 REJECT Handling Verification (read-only)
- **Workflow:** WF6 (`Zyba7eIcS0berpVA`), node n02 (`Read Outreach Queue`)
- **Finding:** No `approval_status` filter applied. REJECT exclusion relies on WF5's nightly `Classify and Dedupe` node archiving rejected rows before Sunday 5am.
- **Change:** None at this step. Risk flagged; hardened in ACTION 8.

### ACTION 6 — WF3 Dead Node Removed
- **Workflow:** WF3 (`T1jTXreAw0uZ2TOD`)
- **Node removed:** `wf3-create-doc` (`Create Google Doc Review Packet`)
- Was `disabled: true` with no downstream connections (terminal node). Safe to remove.
- Post-removal validation: `valid: true`, 0 errors.

### ACTION 7 — retryOnFail Applied to 21 Sheets Write Nodes
Settings: `retryOnFail: true, maxTries: 3, waitBetweenTries: 10000` (10 seconds between tries)

- **WF2** (`2uWLVQ4JS1zXwztO`) — 7 nodes: `wf2-write-contacts`, `wf2-update-opp-status`, `wf2-archive-unchecked`, `wf2-mark-archived`, `wf2-archive-rejected`, `wf2-mark-rejected`, `wf2-write-error`
- **WF4** (`QG8tNjLdKCQkZpWA`) — 7 nodes: `wf4-log-suppressed`, `wf4-write-sent-log`, `wf4-update-outreach-sent`, `wf4-update-opp-sent`, `wf4-add-suppression`, `wf4-write-error`, `wf4-write-followups`
- **WF5** (`acdY3wEi8Y7RElks`) — 3 nodes: `wf5-append-archive`, `wf5-rewrite-queue`, `wf5-write-error`
- **WF7** (`Bk4CkgOMr6t6XTG6`) — 4 nodes: `n11` (Append to Template Log), `n19` (Mark Templates Approved in Sheet), `n21` (Append to Campaign Log), `n23` (Update Sequence Tracker Touch Numbers)

### ACTION 8 — WF6 REJECT Filter Added (follow-up, same day)
- **Workflow:** WF6 (`Zyba7eIcS0berpVA`), node **n05** (`Filter + Join + Dedup`)
- **Change:** Added immediately after `if (sentStatus !== 'sent') continue;`:
  ```js
  // Belt-and-suspenders REJECT guard: exclude rows WF5 may have missed
  if ((row.approval_status || '').toUpperCase() === 'REJECT') continue;
  ```
- Case-insensitive, null-safe. Stops rejected contacts regardless of case variant in the sheet.
- Post-patch validation: 0 new errors. 5 pre-existing false positives unchanged (Sheets `Range` and Gmail `operation` validator bugs, present since WF6 was built). WF6 remains ACTIVE.

---

## 6. Verifications

**WF6 source tagging (ACTION 2)**  
Confirmed by reading node n05 code directly. The `to_add.push(...)` block unconditionally sets:
```js
'Source': 'project1_warmout',
'warm_origin': 'TRUE',
```
on every row that passes the filter. Column name is `Source` (capital S), which maps to `contact.source` (lowercase) in the Master Contacts sheet lookup used by WF7 n4. Schema alignment confirmed — no gap existed.

**WF6 REJECT handling (ACTION 5 → ACTION 8)**  
Initial audit found that WF6 node n02 reads all OQ rows unconditionally. The sticky note on WF6 confirmed the design intent ("WF5 archives rejected rows daily before Sunday 5am run") but this left a single point of failure. If WF5 failed Saturday night, any rows with `approval_status = REJECT` that had also reached `sent_status = sent` and `follow_up_stage = 2` and aged ≥5 days would have passed WF6's filters and been written to the Sequence Tracker. Once in the Sequence Tracker, they would be deduplicated on future runs but could be uploaded to Instantly.ai on the first Sunday run — difficult to reverse cleanly. ACTION 8 closes this gap with a direct in-loop guard.

---

## 7. Open Items / v2 Backlog

**BD7→Sheets DNC sync** *(target: 2–3 weeks post-cold-launch)*  
Instantly.ai unsubscribes processed by BD7 write to Airtable only. The warm pipeline suppression list is in Google Sheets. At scale, a contact could unsubscribe from a cold campaign and still receive warm outreach. Proposed fix: add a BD7 node that appends unsubscribe records to the Sheets suppression list in parallel with the Airtable write. Scope is small; deferred to post-launch to avoid scope creep before 5/17.

**Sent Log cadence spot-check — first 5–10 contacts**  
After WF7's first live run, manually verify the Sent Log sheet entries for the first batch to confirm: correct campaign IDs, correct touch numbers written to Sequence Tracker, and that follow-up scheduling (WF4) picks them up on the expected cadence.

**WF5 scope expansion** *(ongoing backlog)*  
WF5 currently archives/dedupes the Outreach Queue only. Potential expansions:
- Dedupe the Opportunities tab (catch duplicate company discoveries from WF1)
- Dedupe the Contacts tab (catch Hunter.io returning the same contact for different opportunities)
- Suppression list expiration (auto-expire old suppression entries to allow re-engagement after a cooling-off period)

**Apollo paid tier upgrade** *(deferred)*  
WF2 has an Apollo branch built and deployed but blocked — the free tier returns 406 errors on `contacts/search`. Upgrade to the $59/mo plan unlocks this. Until then, WF2 runs Hunter.io only.

**Cosmetic items — WF2**  
- Double-space in one node label (identified during session, not worth a save cycle)
- Em-dash encoding artifact in one outreach template subject line (renders correctly in Gmail; cosmetic only)

---

## 8. Sunday 5/17 Activation Sequence

Execute in order on Sunday 2026-05-17 before 5am CDT:

1. **Open n8n Variables panel** → verify `DRY_RUN` is still `"true"` (confirm no one changed it)
2. **Flip `DRY_RUN` = `"false"`** — this unlocks WF4 Gmail sends immediately; all queued approved rows will send on the next WF4 trigger (8am)
3. **Activate WF7** (`Bk4CkgOMr6t6XTG6`) from the workflow list — must be active before 6am or the Sunday run will be skipped
4. **Approve any pending Outreach Queue rows** in Google Sheets — WF4 will send them starting at 8am
5. **5am:** WF6 runs automatically → reads OQ, filters warm-complete contacts, dedupes against Sequence Tracker, appends qualified rows with `Source=project1_warmout`; sends handoff summary email to michael@10pillarssolutions.com
6. **6am:** WF7 runs automatically → reads Sequence Tracker, filters `source=project1_warmout` contacts, groups by industry, generates Claude API email templates, appends to Template Log, sends preview approval email to michael@10pillarssolutions.com
7. **Review WF7 preview email** → inspect generated templates per industry group; click the approve link to trigger Instantly campaign creation and contact upload
8. **Monitor BD1** → Instantly.ai will fire account activation events as campaigns go live; BD1 handles these automatically

**Volume on first run:**  
dailyLimit=30 per inbox × 3 cold inboxes (mbyrne@, michael.byrne@, michael@10pillarssol.com) = 90 total daily sends; weeklyCap=75 per industry group (Week 1 ramp tier, driven by LAUNCH_DATE=2026-05-10)

---

## 9. Post-Launch Monitoring — Week 1

**Monday 5/18 morning:**
- Check WF4 Sent Log — confirm rows were sent (not dry-run logged); verify sender rotation across 3 inboxes
- Check Sequence Tracker — confirm Sunday contacts have touch numbers populated (WF7 n23)
- Check Template Log — confirm industry group entries from Sunday's WF7 run
- Check Instantly.ai dashboard — confirm campaigns created and contacts uploaded; verify sending has started

**By Wednesday 5/21:**
- Spot-check 5–10 Sent Log entries against Instantly.ai campaign contacts — confirm no overlap (warm contacts should not be in cold campaigns and vice versa)
- Verify BD6 is pausing sequences on replies — check for any Instantly.ai replies that arrived without a corresponding WF4 send pause

**Flags to watch:**
- Any WF4 execution errors (Sheets 429s should now retry; persistent failures indicate a new issue)
- WF5 Saturday night execution history — verify it ran cleanly before the second Sunday (2026-05-24)
- Warm pipeline throughput — WF1 should continue generating new opportunities Mon–Fri; WF2 should auto-trigger on each new opportunity
- Instantly.ai sending health — watch for bounce rate or spam placement warnings in the first 72 hours

**Do not change during week 1:**
- `DRY_RUN` (now `"false"` — do not flip back unless there is an active problem)
- WF7 `LAUNCH_DATE` (must stay `2026-05-10` through the entire ramp schedule)
- WF4 follow-up nodes `wf4-build-followups` and `wf4-write-followups` (production-confirmed working; do not touch)
