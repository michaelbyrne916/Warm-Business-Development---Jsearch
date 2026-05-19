# 10 Pillars Solutions — System Overview
**Last updated:** 2026-05-13  
**Instance:** michaelbyrne916.app.n8n.cloud  
**Owner:** Michael Byrne — michael@10pillarssolutions.com

This document tracks all active, queued, and archived automation projects across 10 Pillars Solutions. It is the strategic map — for implementation detail, see CLAUDE.md (system spec) and individual project logs.

---

## System Status at a Glance

| Project | Status | Target / Notes |
|---------|--------|---------------|
| Warm Outreach Pipeline | **LAUNCH-READY** | Activation Sunday 2026-05-17 |
| Cold BD Plan / Cold Outreach | **LAUNCH-READY** | Activation Sunday 2026-05-17 |
| Strategic ABM System | **COMPLETE** | In production |
| PillarSignal | **SCRAPPED** | Archived — indefinite hold |
| SLED Signal Intelligence Tool | **DESIGN COMPLETE** | Queued for build — target late May / early June 2026 |
| Recruiting Sourcing Platform | **QUEUED FOR AUDIT** | Target week of 2026-05-18 |

---

## Project 1 — Warm Outreach Pipeline

**Status: LAUNCH-READY — Activation Sunday 2026-05-17**

End-to-end n8n automation that discovers staffing opportunities at direct-employer companies, finds the hiring manager, generates personalized 3-email outreach sequences via GPT-4o-mini, stages them for human approval, sends via Gmail, and hands off warm-but-unresponsive contacts to the cold BD system after all 3 emails are sent.

### Workflow Index

| Workflow | ID | Trigger | Status | Purpose |
|----------|----|---------|--------|---------|
| WF1: Lead Discovery | `3qPmKNCZseEzvFNj` | Schedule — 7am Mon-Fri | ACTIVE | JSearch API → classify → dedup → write qualified opportunities |
| WF2: Contact Discovery | `2uWLVQ4JS1zXwztO` | Manual / WF1 trigger | ACTIVE | Hunter.io contact lookup for qualified opportunities |
| WF3: Outreach Draft | `T1jTXreAw0uZ2TOD` | Manual | ACTIVE | GPT-4o-mini generates 3-email sequence per contact |
| WF4: Approved Send | `QG8tNjLdKCQkZpWA` | Schedule — 8/10/12/2/4pm Mon-Fri | ACTIVE (DRY_RUN=true until 5/17) | Sends approved Gmail outreach; DRY_RUN gate controls live sends |
| WF5: Maintenance | `acdY3wEi8Y7RElks` | Schedule — daily 6am | ACTIVE | Archives and dedupes Outreach Queue; REJECT cleanup |
| WF6: Warm to Cold Handoff | `Zyba7eIcS0berpVA` | Schedule — Sunday 5am | ACTIVE | Moves warm-complete contacts to cold campaign pool |

### Pre-Launch Checklist

- [x] WF1→WF2 auto-chain re-enabled
- [x] WF4 DRY_RUN confirmed = "true" (Gmail sends blocked)
- [x] retryOnFail applied to all Sheets write nodes (WF2/4/5)
- [x] WF6 REJECT guard hardened (belt-and-suspenders vs. WF5 failure)
- [ ] **ACTIVATION DAY:** Flip DRY_RUN = "false" before 8am 2026-05-17

### Sunday 5/17 Activation — Warm Pipeline

On 2026-05-17, before 8am: flip `DRY_RUN` = `"false"` in n8n Variables. WF4 will begin live sends at 8am. No other workflow changes required for the warm pipeline.

**Audit and decision record:** See [LAUNCH_PREP_2026-05-13.md](LAUNCH_PREP_2026-05-13.md)

---

## Project 2 — Cold BD Plan / Cold Outreach

**Status: LAUNCH-READY — Activation Sunday 2026-05-17**

Automated cold email campaign system using Instantly.ai. Receives warm-unresponsive contacts from WF6 on Sunday mornings, groups them by industry, generates AI email templates via the Claude API, uploads campaigns and contacts to Instantly.ai, and sends a preview approval email to Mike before any live campaign is created. Event handlers (BD1/BD6/BD7) manage account activation, replies, and unsubscribes in real time.

### Workflow Index

| Workflow | ID | Trigger | Status | Purpose |
|----------|----|---------|--------|---------|
| WF7: Cold Campaign Sunday Batch | `Bk4CkgOMr6t6XTG6` | Schedule — Sunday 6am | **INACTIVE** (activate 5/17) | Generates cold email templates via Claude API, uploads to Instantly |
| BD1: Account Activation | `mBwEPWcdbx7b3dUA` | Schedule — hourly | ACTIVE | Handles Instantly.ai account activation events |
| BD4: Pool Management | `RDjbWgriKOm1tmgX` | Schedule — occasional | ACTIVE | Manages cold BD lead pool |
| BD6: Reply and Pause | `QGx4yebi4Exr2E4e` | Schedule — hourly | ACTIVE | Detects Instantly.ai replies, pauses sequences |
| BD7: Unsubscribe and DNC | `A0QxPVYHNkIBIrHU` | Schedule — hourly | ACTIVE | Handles unsubscribes, adds to DNC (Airtable) |

### Pre-Launch Checklist

- [x] WF7 source filter: new contacts gated to `source = project1_warmout` only
- [x] WF7 LAUNCH_DATE = `2026-05-10` (ensures Week 1 ramp tier on activation day)
- [x] WF6 REJECT guard hardened (prevents rejected OQ rows entering Sequence Tracker)
- [x] retryOnFail applied to all WF7 Sheets write nodes (n11/n19/n21/n23)
- [ ] **ACTIVATION DAY:** Activate WF7 (`Bk4CkgOMr6t6XTG6`) before 6am 2026-05-17

### Sunday 5/17 Activation — Cold Pipeline

1. Activate WF7 from the n8n workflow list before 6am
2. WF6 runs at 5am → populates Sequence Tracker with `source=project1_warmout` contacts
3. WF7 runs at 6am → groups by industry, generates Claude API templates, sends preview approval email
4. Review preview email → click approve link → Instantly campaigns created + contacts uploaded
5. Week 1 volume: dailyLimit=30/inbox × 3 inboxes = 90/day; weeklyCap=75/industry group

**Known open item (v2 backlog):** BD7 unsubscribes write to Airtable only. No automated sync to warm pipeline suppression list in Google Sheets. Manual cross-check required at current volume; BD7→Sheets sync targeted 2–3 weeks post-launch.

**Audit and decision record:** See [LAUNCH_PREP_2026-05-13.md](LAUNCH_PREP_2026-05-13.md)

---

## Project 3 — Strategic ABM System

**Status: COMPLETE**

Account-based marketing targeting layer that defines and maintains the ICP (Ideal Client Profile) criteria driving WF1's job searches. Implemented as the Targeting tab in Google Sheets, managed manually by Mike with n8n reading it on each WF1 run.

Targeting criteria include: role keywords, locations, employment types, excluded keywords, and excluded company types. WF1 builds a cross-product of role_keywords × locations for each active Targeting row on every daily run.

**No active build work needed.** Targeting criteria updates are self-service via the Google Sheet.

---

## Project 4 — PillarSignal

**Status: SCRAPPED — Archived, indefinite hold**

PillarSignal was a planned signal intelligence platform intended to aggregate buying signals (job postings, funding, tech stack changes, news events) into a prioritized lead feed for proactive BD outreach. The concept was to surface accounts showing intent signals before a staffing need became a formal job posting.

**Why archived:** The warm outreach pipeline (Project 1) and cold campaign system (Project 2) together cover the core BD motion at current scale. PillarSignal would have required significant data infrastructure investment (Airtable → Supabase migration, custom signal ingestion pipelines) without a clear near-term ROI relative to the launch priorities. The project is archived pending future strategic direction — it may be revisited if the BD pipeline matures and a higher-intent signal layer becomes the next bottleneck.

**What is NOT happening:** The previously planned Airtable → Supabase migration has been removed from the roadmap. Airtable remains the store for BD7 DNC/unsubscribe data at current scale.

**Revenue pipeline status:** PillarSignal is not feeding the revenue pipeline and has no active data flows. It is not referenced in any live workflow.

---

## Project 5 — SLED Signal Intelligence Tool

**Status: DESIGN COMPLETE — Queued for build, target late May / early June 2026**

A signal intelligence tool focused on State, Local, and Education (SLED) government sector opportunities. Designed to monitor procurement signals, contract awards, and agency technology initiatives to surface staffing opportunities in the public sector before they become competitive RFPs.

Design is complete. Build has not started. Queued behind the 2026-05-17 warm+cold launch — will begin once the launch is stable and the first post-launch monitoring week (week of 2026-05-18) is complete.

---

## Project 6 — Recruiting Sourcing Platform

**Status: QUEUED FOR AUDIT — Target week of 2026-05-18**

An internal recruiting workflow automation platform to support candidate sourcing, pipeline management, and submission tracking for 10 Pillars' active placements. The existing process is manual; this project would add n8n automation layers to reduce sourcing time and improve pipeline visibility.

Audit begins the week of 2026-05-18 — the goal is to map the current manual process, identify automation insertion points, and produce a scoped build plan. No implementation has started.

---

## Cross-System Revenue Pipeline

```
[Signal Layer]          [Warm Outreach Pipeline]        [Cold BD Plan]
PillarSignal            WF1: Lead Discovery              WF7: Cold Campaign Batch
(ARCHIVED)              WF2: Contact Discovery           (Instantly.ai)
                        WF3: Outreach Draft                    ▲
                        WF4: Approved Send                     │
                        WF5: Maintenance                       │
                              │                                │
                              └─── WF6: Warm to Cold ─────────┘
                                   Handoff (Sunday 5am)

[ABM Layer]             [Event Handlers]
Strategic ABM           BD1: Account Activation
(Targeting Sheet)       BD6: Reply and Pause
                        BD7: Unsubscribe + DNC
                        (all Instantly.ai events)

[Future / Queued]
SLED Signal Intelligence Tool (design complete)
Recruiting Sourcing Platform (audit queued)
```

PillarSignal is **not** part of the live revenue pipeline. It is archived and has no active connections to any workflow.

---

## Key Infrastructure

| Component | Provider | Purpose |
|-----------|----------|---------|
| Workflow automation | n8n Cloud (`michaelbyrne916.app.n8n.cloud`) | All workflow execution |
| Job data | JSearch (RapidAPI) | Opportunity discovery |
| Contact data | Hunter.io | Email + title lookup |
| Cold email platform | Instantly.ai | Cold campaign sending and inbox management |
| Email sending (warm) | Gmail (3 inboxes) | WF4 approved outreach |
| LLM — outreach drafts | GPT-4o-mini (OpenAI) | WF3 email generation |
| LLM — cold templates | claude-sonnet-4-5 (Anthropic) | WF7 template generation |
| Data store | Google Sheets | All pipeline data (Opportunities, Contacts, OQ, etc.) |
| DNC store | Airtable | Instantly.ai unsubscribes (BD7) |

---

## Global Safety Rules

- **DRY_RUN = "true"** blocks all WF4 Gmail sends without deactivating the workflow. Flip to `"false"` on launch day only.
- **WF4 follow-up nodes** (`wf4-build-followups`, `wf4-write-followups`) are production-confirmed working. Do not modify — the validator flags them as false positives due to cross-node reference patterns.
- **No email is sent without human approval.** WF4 requires `approval_status = "approved"` set manually in the Outreach Queue sheet.
- **WF7 must not be activated before 2026-05-17.** Sequence Tracker must first be populated by WF6.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-13 | Document created. Warm Outreach Pipeline marked launch-ready (2026-05-17). Cold BD Plan / WF7 added to workflow index, marked launch-ready (2026-05-17). Strategic ABM marked complete. PillarSignal marked scrapped/archived; Airtable→Supabase migration removed from roadmap. SLED Signal Intelligence Tool confirmed design-complete, queued late May/early June. Recruiting Sourcing Platform confirmed queued for audit week of 2026-05-18. Revenue pipeline map updated — PillarSignal removed from live pipeline. Cross-reference: LAUNCH_PREP_2026-05-13.md for full audit/decision record. |
