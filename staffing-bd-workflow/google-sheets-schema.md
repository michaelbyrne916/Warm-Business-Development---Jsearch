# Google Sheets Workbook Schema

Create a single Google Sheets workbook with these 7 tabs.
Column headers must match exactly (case-sensitive) for the workflow column mapping to work.

---

## Tab 1: Targeting

The control panel. Add rows here to define what jobs to search for.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| search_id | Text | Unique ID for this search config | `srch_001` |
| role_keywords | Text | Comma-separated role terms to search | `Software Engineer, Backend Developer` |
| locations | Text | Comma-separated target locations | `Austin TX, Remote` |
| employment_type | Text | `FULLTIME`, `CONTRACT`, `PARTTIME` | `FULLTIME` |
| excluded_keywords | Text | Comma-separated terms to penalize | `junior, intern` |
| excluded_company_types | Text | Comma-separated types to exclude | `staffing, recruiting, RPO` |
| active | Boolean | `true` to include in runs | `true` |
| last_run | DateTime | Auto-updated by workflow | (auto) |

**Sample row:**
```
srch_001 | Software Engineer, Backend Developer | Austin TX, Denver CO | FULLTIME | junior,intern | staffing,recruiting | true |
```

---

## Tab 2: Opportunities

System of record for all discovered job openings.

| Column | Type | Description |
|--------|------|-------------|
| opportunity_id | Text | MD5 hash of domain+title+location (12 chars) |
| company_name | Text | Employer name |
| company_domain | Text | Clean domain (e.g., `stripe.com`) |
| company_type | Text | `direct_employer`, `staffing_firm`, `unclear` |
| company_summary | Text | From Clearbit enrichment |
| job_title | Text | Exact job title from posting |
| location | Text | City, State |
| employment_type | Text | `direct_hire`, `contract`, `unknown` |
| source_name | Text | `JSearch/RapidAPI` |
| source_url | URL | Apply link |
| posted_date | DateTime | When job was posted |
| date_found | DateTime | When workflow discovered it |
| job_description | Text | First 3000 chars of JD |
| skills | Text | Comma-separated tech skills detected |
| seniority | Text | `junior`, `mid`, `senior` |
| match_score | Number | 0-100 relevance score |
| company_classification | Text | `direct_employer`, `staffing_firm`, `unclear` |
| company_classification_reason | Text | How it was classified |
| status | Text | See status values below |

**Status values:** `discovered` → `qualified` → `contact_found` → `draft_ready` → `sent` / `rejected` / `needs_review`

---

## Tab 3: Contacts

One row per opportunity with the best contact found.

| Column | Type | Description |
|--------|------|-------------|
| opportunity_id | Text | FK to Opportunities tab |
| contact_name | Text | Full name |
| contact_title | Text | Job title |
| contact_email | Email | Work email |
| contact_phone | Text | Phone if available |
| linkedin_url | URL | LinkedIn profile URL |
| source_of_contact | Text | `hunter.io`, `manual`, etc. |
| confidence_score | Number | 0-100 score |
| contact_reasoning | Text | Why this contact was selected |

---

## Tab 4: Outreach Queue

Drafts pending human review. Set `approval_status = approved` to trigger send.

| Column | Type | Description |
|--------|------|-------------|
| opportunity_id | Text | FK to Opportunities tab |
| email_subject | Text | Generated subject line |
| email_body | Text | Generated first-touch email |
| followup_email_body | Text | Generated follow-up email |
| linkedin_message | Text | Generated LinkedIn message (<300 chars) |
| personalization_notes | Text | LLM explanation of personalization choices |
| why_this_company | Text | Why this company is a BD target |
| why_this_contact | Text | Why this person was selected |
| approval_status | Text | `pending` / **`approved`** / `rejected` / `needs_review` |
| sent_status | Text | `unsent` / `sent` |
| sent_timestamp | DateTime | When email was sent |

**Human review workflow:**
1. Review the Google Doc for this opportunity (link in company summary or search by opportunity_id)
2. Edit email if needed directly in this sheet
3. Change `approval_status` from `pending` to `approved`
4. WF4 will pick it up within 2 hours (or trigger manually)

---

## Tab 5: Sent Log

Immutable record of all sent emails.

| Column | Type | Description |
|--------|------|-------------|
| opportunity_id | Text | |
| contact_email | Email | |
| company_domain | Text | Used for suppression lookup |
| sent_timestamp | DateTime | |
| email_subject | Text | |
| follow_up_status | Text | `scheduled`, `sent`, `skipped` |

---

## Tab 6: Errors

Workflow errors logged here for review.

| Column | Type | Description |
|--------|------|-------------|
| timestamp | DateTime | |
| workflow_name | Text | Which workflow failed |
| node_name | Text | Which node failed |
| error_message | Text | Error text |
| input_data | Text | JSON-stringified context |

---

## Tab 7: Suppression List

Prevents re-outreach within the configured window.

| Column | Type | Description |
|--------|------|-------------|
| company_domain | Text | |
| contact_email | Email | |
| suppressed_until | DateTime | Date after which this entry expires |
| reason | Text | Why suppressed (e.g., `Email sent`) |
| added_date | DateTime | When this suppression was added |

---

## Quick Setup Steps

1. Create a new Google Sheet
2. Rename Sheet1 to `Targeting`, add all 7 tabs
3. Add header rows exactly as shown above (row 1 = headers)
4. Copy the Sheet ID from the URL and add to `.env` as `GOOGLE_SHEETS_ID`
5. Add at least one row to Targeting tab with `active = true`
6. Share the sheet with the Google service account used by n8n (if self-hosted),
   or connect via OAuth2 credential in n8n Cloud
