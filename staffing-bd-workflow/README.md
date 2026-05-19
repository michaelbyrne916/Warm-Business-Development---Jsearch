# Staffing BD Workflow — n8n Automation Package

An end-to-end business development pipeline for staffing companies. Finds target job openings, filters out competing staffing firms, identifies hiring managers, enriches contact data, generates personalized outreach with an LLM, and stages everything for human review before any email is sent.

---

## Architecture

```
[Targeting Sheet] ──► WF1: Lead Discovery (daily 7am)
                           │  JSearch API → Normalize → Score → Filter
                           │  LLM classifies companies (direct vs. staffing)
                           │  Writes to: Opportunities tab
                           ▼
                      WF2: Contact Discovery (chained)
                           │  Clearbit → company enrichment
                           │  Hunter.io → contact emails + titles
                           │  Ranks contacts by title relevance to role
                           │  Writes to: Contacts tab
                           ▼
                      WF3: Outreach Draft Generation (chained)
                           │  LLM (OpenAI GPT-4o or Claude) generates:
                           │    - Subject + first-touch email
                           │    - Follow-up email + LinkedIn message
                           │    - Personalization notes
                           │  Writes to: Outreach Queue tab
                           │  Creates: Google Doc review packet
                           ▼
               [Human Review — set approval_status = "approved"]
                           ▼
                      WF4: Approved Send (every 2hrs Mon-Fri)
                           │  Suppression check (30-day dedup window)
                           │  DRY_RUN gate (safe testing mode)
                           │  Sends via Gmail
                           │  Writes to: Sent Log tab
                           ▼
                      WF5: Maintenance & Dedupe (daily 6am)
                           │  Deduplicates Opportunities + Contacts
                           │  Expires old suppressions
                           │  Sends daily ops summary email
```

---

## Workflows

| # | Name | ID | Trigger | Purpose |
|---|------|----|---------|---------|
| 1 | WF1: Lead Discovery | `VqowdMoinZ9VvRpQ` | Daily 7am + Manual | Searches JSearch, filters, writes opportunities |
| 2 | WF2: Contact Discovery | `2uWLVQ4JS1zXwztO` | Called by WF1 + Manual | Enriches company + finds hiring manager |
| 3 | WF3: Outreach Draft Generation | `T1jTXreAw0uZ2TOD` | Called by WF2 + Manual | LLM outreach generation + Google Docs |
| 4 | WF4: Approved Send | `QG8tNjLdKCQkZpWA` | Every 2hrs Mon-Fri + Manual | Sends approved emails, logs sent |
| 5 | WF5: Maintenance & Dedupe | `acdY3wEi8Y7RElks` | Daily 6am + Manual | Dedup, expire suppressions, daily report |

---

## Providers

| Stage | Provider | Why |
|-------|----------|-----|
| Job Source | JSearch (RapidAPI) | Aggregates Google Jobs, LinkedIn Jobs, Indeed |
| Company Enrichment | Clearbit | Domain → description, industry, employee count |
| Contact Discovery | Hunter.io | Domain search → emails + titles with confidence |
| LLM (primary) | OpenAI GPT-4o | n8n native node, strong JSON output |
| LLM (alternate) | Anthropic Claude | Switchable via `LLM_PROVIDER=anthropic` |
| Email | Gmail | n8n native node |
| Review Storage | Google Sheets + Docs | Free, collaborative, easy to share |

---

## Files in This Package

```
staffing-bd-workflow/
├── .env.example                    # All required env variables with docs
├── README.md                       # This file
├── SETUP.md                        # Step-by-step setup instructions
├── google-sheets-schema.md         # All 7 tab schemas + sample data
├── code-nodes/
│   ├── wf1-normalize-jobs.js       # JSearch → common schema mapping
│   ├── wf1-score-jobs.js           # Job relevance scoring (0-100)
│   ├── wf1-staffing-keyword-filter.js  # Rules-based firm detection
│   ├── wf2-score-rank-contacts.js  # Title-based contact scoring
│   ├── wf3-build-outreach-prompt.js    # LLM prompt assembly
│   ├── wf3-parse-llm-response.js   # OpenAI/Claude response parser
│   └── wf4-check-suppression.js    # Dedup + suppression gate
└── test-data/
    └── sample-jsearch-response.json   # Mock JSearch response for dry-run testing
```

---

## Safety Features

- **No auto-send**: WF4 only sends rows where `approval_status = "approved"` (set by human)
- **DRY_RUN mode**: Set `DRY_RUN=true` to run full pipeline without sending any email
- **Suppression list**: Prevents re-outreach to same company+contact within 30 days (configurable)
- **Batch dedup**: Prevents duplicate sends within same execution run
- **Error logging**: All workflow failures write to the Errors sheet tab
- **No LinkedIn scraping**: Uses only public/compliant APIs (JSearch, Hunter.io, Clearbit)

---

## Human Review Process

1. After WF3 runs, check:
   - **Outreach Queue** tab (Google Sheets) for new `pending` rows
   - **BD Outreach Review Docs** folder (Google Drive) for per-lead review packets
2. Each Google Doc contains: company summary, role details, contact info, email drafts, personalization notes
3. Edit the email directly in the Outreach Queue sheet if needed
4. Change `approval_status` from `pending` to `approved`
5. WF4 picks it up automatically within 2 hours (or trigger manually)

---

## Status Flow

```
discovered → qualified → contact_found → draft_ready → approved → sent
                                                      ↘ rejected
                                                      ↘ needs_review
```

---

## Switching LLM Provider

In n8n Variables, change `LLM_PROVIDER`:
- `openai` → Uses GPT-4o via OpenAI API (default, uses n8n HTTP node)
- `anthropic` → Uses Claude via Anthropic API (HTTP request node)

Cost estimate per lead (GPT-4o): ~$0.02–0.05 depending on JD length.

---

## Testing Without Real API Calls

1. Set `DRY_RUN=true` (prevents email sends)
2. In WF1: disable the JSearch API node, replace with a Set node containing sample data from `test-data/sample-jsearch-response.json`
3. Trigger each workflow manually, step by step
4. Review execution logs in n8n to see data at each step

---

## Future Improvements

- **Apollo.io integration**: Replace Hunter + Clearbit with single Apollo API (better data, one key)
- **Slack notifications**: Alert `#bd-pipeline` channel when new `needs_review` items appear
- **Inbound webhook**: Accept job lists from partners via webhook trigger
- **Follow-up scheduler**: Auto-schedule follow-up email at day 5 if no response
- **A/B subject testing**: Randomize subject lines, track open rates
- **News enrichment**: Add Perplexity/Tavily lookup for company news to strengthen personalization
- **LinkedIn Sales Nav**: Add LinkedIn contact data when budget allows

---

## Quick Reference — Workflow IDs

These IDs are needed for the `WF2_CONTACT_DISCOVERY_ID` and `WF3_OUTREACH_DRAFT_ID` env vars:

```
WF1 (Lead Discovery):           VqowdMoinZ9VvRpQ
WF2 (Contact Discovery):        2uWLVQ4JS1zXwztO
WF3 (Outreach Draft Gen):       T1jTXreAw0uZ2TOD
WF4 (Approved Send):            QG8tNjLdKCQkZpWA
WF5 (Maintenance & Dedupe):     acdY3wEi8Y7RElks
```
