# Setup Instructions

## Prerequisites

Before starting, you need accounts/API keys for:

| Service | Purpose | Free Tier | Signup |
|---------|---------|-----------|--------|
| n8n Cloud | Workflow runtime | ✓ (active) | Already set up |
| RapidAPI (JSearch) | Job search | 200 req/mo | https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch |
| Clearbit | Company enrichment | 50 req/mo | https://dashboard.clearbit.com |
| Hunter.io | Contact discovery | 25 searches/mo | https://hunter.io |
| OpenAI | Outreach generation | Pay-per-use | api-keys |https://platform.openai.com/
| Anthropic (optional) | Alt LLM | Pay-per-use | https://console.anthropic.com |
| Google Workspace | Sheets + Docs + Gmail | Free | Already set up |

---

## Step 1 — Create Google Sheets Workbook

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Rename it: `Staffing BD — Pipeline`
3. Create 7 tabs with these exact names (case-sensitive):
   - `Targeting`
   - `Opportunities`
   - `Contacts`
   - `Outreach Queue`
   - `Sent Log`
   - `Errors`
   - `Suppression List`
4. Add header rows to each tab per `google-sheets-schema.md`
5. Copy the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
   ```
6. Add one test row to the Targeting tab:
   ```
   search_id: test_001
   role_keywords: Software Engineer
   locations: Austin TX
   employment_type: FULLTIME
   excluded_keywords: junior,intern
   excluded_company_types: staffing,recruiting
   active: true
   ```

---

## Step 2 — Create Google Drive Folder for Review Docs

1. Go to [drive.google.com](https://drive.google.com)
2. Create a folder: `BD Outreach Review Docs`
3. Copy the **Folder ID** from the URL:
   ```
   https://drive.google.com/drive/folders/YOUR_FOLDER_ID_HERE
   ```

---

## Step 3 — Configure n8n Environment Variables

In your n8n Cloud instance:
1. Go to **Settings > Variables**
2. Add each variable from `.env.example` with your real values:

```
JSEARCH_API_KEY          = your RapidAPI key
JSEARCH_API_HOST         = jsearch.p.rapidapi.com
CLEARBIT_API_KEY         = your Clearbit key
HUNTER_API_KEY           = your Hunter.io key
LLM_PROVIDER             = openai
OPENAI_API_KEY           = your OpenAI key
ANTHROPIC_API_KEY        = your Anthropic key (optional)
ANTHROPIC_MODEL          = claude-opus-4-6
GOOGLE_SHEETS_ID         = your Sheet ID from Step 1
GOOGLE_DOCS_FOLDER_ID    = your Folder ID from Step 2
GMAIL_SENDER             = your.email@gmail.com
WF2_CONTACT_DISCOVERY_ID = 2uWLVQ4JS1zXwztO
WF3_OUTREACH_DRAFT_ID    = T1jTXreAw0uZ2TOD
APPROVAL_REQUIRED        = true
DRY_RUN                  = true
DUPLICATE_SUPPRESSION_DAYS = 30
MIN_MATCH_SCORE          = 60
MIN_CONFIDENCE_SCORE     = 70
```

> **Keep `DRY_RUN=true` until you've reviewed at least 3 full pipeline runs.**

---

## Step 4 — Configure n8n Credentials

In n8n Cloud (**Credentials** section), create these:

### Google Sheets OAuth2
1. Add credential → Google Sheets OAuth2 API
2. Follow OAuth2 flow with your Google account
3. Name it exactly: `Google Sheets` (matches credential name in workflows)

### Google Docs OAuth2
1. Add credential → Google Docs OAuth2 API
2. Same Google account
3. Name it: `Google Docs`

### Gmail OAuth2
1. Add credential → Gmail OAuth2 API
2. Same Google account
3. Name it: `Gmail`

---

## Step 5 — Fix Google Sheets Node Credential Linking

> This step is required because the `documentId` field format needs to be set via the UI.

For each of the 5 workflows, open each Google Sheets node and:
1. Click on the `documentId` field
2. Switch to **Expression** mode
3. Enter: `{{ $env.GOOGLE_SHEETS_ID }}`
4. Re-select the sheet tab name from the dropdown
5. Save the node

**Affected nodes (by workflow):**
- WF1: Read Targeting Sheet, Write Rejected/Needs Review/Qualified to Sheet, Write Error to Sheet
- WF2: Write to Contacts Sheet, Update Opportunity Status, Write Error to Sheet
- WF3: Write to Outreach Queue, Update Opportunity to draft_ready, Write Error to Sheet
- WF4: Read Approved Rows, Read/Write Suppression List, Write to Sent Log, Update sheets × 2
- WF5: Read All Opportunities, Read All Contacts, Read Suppression List, Read Sent Log

> This is the most time-consuming setup step. Plan ~30-45 minutes. The logic is already wired — you're just linking credentials.

---

## Step 6 — Test Each Workflow Independently

Test in this order, one at a time:

### Test WF1 (Lead Discovery)
1. Ensure Targeting tab has one test row (`active = true`)
2. Open WF1 in n8n → click **Test workflow**
3. Expected: jobs appear in Opportunities tab, WF2 is triggered
4. Check Errors tab for any failures

### Test WF2 (Contact Discovery)
1. Trigger manually with test opportunity data
2. Expected: contacts appear in Contacts tab
3. Clearbit may return 404 for unknown domains — that's normal

### Test WF3 (Outreach Draft Generation)
1. Trigger manually with test opportunity + contact data
2. Expected: row in Outreach Queue, Google Doc created in review folder
3. Check LLM output quality — adjust prompt if needed

### Test WF4 (Approved Send) — DRY RUN first
1. Set `approval_status = approved` on one Outreach Queue row
2. Trigger WF4 manually
3. With `DRY_RUN=true`: no email sent, row is still processed and logged
4. Check execution log to see what WOULD have been sent
5. When satisfied, set `DRY_RUN=false` and test with one real email to yourself

### Test WF5 (Maintenance)
1. Trigger manually
2. Expected: summary email arrives, console shows dedupe stats

---

## Step 7 — Activate Schedules

Once all 5 workflows pass testing:

1. **WF5 (Maintenance)** — activate first. Runs daily at 6am.
2. **WF4 (Approved Send)** — activate next. Runs every 2 hours Mon-Fri.
3. **WF1 (Lead Discovery)** — activate last. Runs daily at 7am Mon-Fri.
4. WF2 and WF3 are trigger-only (called by WF1) — they activate automatically.

---

## Common Issues

### "No data returned from Google Sheets"
- Verify the Sheet ID is correct in n8n Variables
- Verify the tab name matches exactly (case-sensitive)
- Check that the OAuth credential has access to the sheet

### "JSearch returned 0 results"
- Check `JSEARCH_API_KEY` is set correctly
- Test the API key directly: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
- Try broader role keywords in the Targeting tab

### "Clearbit returned 404"
- Normal for small or obscure companies
- Workflow continues gracefully with empty company_summary

### "Hunter.io returned 0 emails"
- Normal for small companies or strict privacy policies
- Opportunity gets marked `needs_review` — review manually

### "LLM response parse error"
- LLM returned non-JSON — check the `email_body` field which contains the raw response
- Edit approval_status to `needs_review` and fix manually
- If frequent, adjust the system prompt in WF3's Build Outreach Prompt node

### Google Sheets "Expected object but got string" validation warning
- This is a validator schema format warning, not a runtime error
- Fix by re-selecting the documentId field in the n8n UI (Step 5 above)
- Workflows run correctly before this fix but UI shows red warning icon
