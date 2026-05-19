# WF6 — Warm to Cold Handoff: Design Spec

**Date:** 2026-04-28
**Project:** CLAUDE - N8N (Warm Outreach Pipeline)
**Author:** Michael Byrne / Claude

---

## Purpose

WF6 bridges the two 10 Pillars Solutions outreach systems. Once a warm contact has completed the full 3-email sequence with no reply (handled manually via rejection), WF6 promotes them into the Cold BD Plan's Sequence Tracker as a fresh "Active" contact starting at touch 4. This prevents duplicated prospecting effort and ensures every worked lead continues through the funnel.

---

## Trigger

Cron: **Every Sunday at 5:00am** (runs once weekly, outside business hours)

---

## Data Sources

| Sheet | Google Sheets ID | Tab |
|---|---|---|
| Outreach Queue | `192SvtVdg3hA0f4ZvHSWZTX2FG1HOzU_vw8jQA9md6no` | Outreach Queue |
| Contacts | `192SvtVdg3hA0f4ZvHSWZTX2FG1HOzU_vw8jQA9md6no` | Contacts |
| Sequence Tracker | `1F2A8TtN5wOuHjvzcO0XYvu-DPmrQWNVaMklT6FTgF9Q` | Sheet1 |

Both sheets live on the same Google account. Use the same named Google Sheets credential for all reads/writes.

---

## Node Architecture

```
[Cron Trigger]
      |
[Read Outreach Queue]         — all rows, no filtersUI
      |
[Read Contacts Tab]           — full tab for contact_title lookup
      |
[Read Sequence Tracker]       — full tab for dedup
      |
[Filter + Join + Dedup]       — Code node: outputs 1 summary item
      |                          { to_add[], skipped[], companies_added }
[IF: to_add.length > 0]
   |                    |
[Split Out to_add]     [Gmail Summary]  ← false branch (0 contacts)
   |                                       reads Code node output directly
[Append to Sequence Tracker]
   |
[Gmail Summary]                         ← true branch
                                           reads Code node via $('Filter + Join + Dedup')
```

---

## Node Specifications

### Node 1 — Read Outreach Queue
- **Type:** Google Sheets → Read
- **Sheet:** Outreach Queue tab
- **filtersUI:** None — read ALL rows, filter in code
- **alwaysOutputData:** true (handles empty sheet gracefully)
- **Credential:** Named Google Sheets credential

### Node 2 — Read Contacts Tab
- **Type:** Google Sheets → Read
- **Sheet:** Contacts tab (same spreadsheet)
- **Purpose:** Source of `contact_title` for each contact, joined by `contact_email`
- **alwaysOutputData:** true

### Node 3 — Read Sequence Tracker
- **Type:** Google Sheets → Read
- **Sheet:** Sequence Tracker (Cold BD Plan spreadsheet)
- **Purpose:** Build email Set for dedup check
- **alwaysOutputData:** true

### Node 4 — Filter, Join & Dedup (Code Node — JavaScript)

**Inputs:** Items from Node 1, Node 2, Node 3 via `$('Node Name').all()`

**Step 1 — Filter Outreach Queue**

Keep rows where ALL are true:
- `sent_status` (trim + lowercase) === `"sent"`
- `follow_up_stage` (parsed as integer) === `2` (0-indexed: 0=email1, 1=email2, 2=email3 → stage 2 = all 3 sent)
- `sent_timestamp` is a valid date AND is 5 or more calendar days before today

Rows where `approval_status` = `"rejected"` are already archived by WF5 before Sunday — no additional check needed.

**Step 2 — Build Contacts lookup map**

```js
const contactsMap = {};
for (const row of contactsData) {
  contactsMap[row.contact_email?.toLowerCase().trim()] = row.contact_title || "";
}
```

**Step 3 — Build Sequence Tracker dedup Set**

```js
const existingEmails = new Set(
  trackerData.map(r => r.Email?.toLowerCase().trim()).filter(Boolean)
);
```

**Step 4 — Derive persona from contact_title**

```js
function derivePersona(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("ciso"))                          return "CISO";
  if (t.includes("cto") || t.includes("chief technology"))  return "CTO";
  if (t.includes("cio") || t.includes("chief information")) return "CIO";
  if (t.includes("ceo") || t.includes("president") || t.includes("founder")) return "CEO/President";
  if (t.includes("vp") || t.includes("vice president"))     return "VP";
  if (t.includes("director"))                               return "Director";
  if (t.includes("manager"))                                return "Manager";
  if (t.includes("engineer"))                               return "Engineering";
  return "Other";
}
```

**Step 5 — Split to_add / skipped**

For each filtered OQ row:
- If `contact_email` (lowercase + trim) is in `existingEmails` → push to `skipped[]`
- Otherwise → join contact_title, derive persona, build output row → push to `to_add[]`

**Output row shape for `to_add[]`:**

```js
{
  first_name:    nameParts[0],
  last_name:     nameParts.slice(1).join(" "),
  email:         contact_email,
  title:         contact_title,         // from Contacts tab join
  persona:       derivePersona(contact_title),
  company:       company_name,
  domain:        company_domain,
  industry:      "",                    // intentionally blank
  source:        "project1_warmout",
  current_touch: 4,
  wave:          "Safe_to_Send",
  status:        "Active",
  warm_origin:   true,
  date_added:    new Date().toISOString().split("T")[0],  // YYYY-MM-DD
  _company_for_summary: company_name    // internal, for Gmail summary
}
```

**Returns:** One n8n item containing:
```js
{
  to_add: [...],          // array of contact objects ready for append
  skipped: [...],         // array of skipped emails (already in Sequence Tracker)
  to_add_count: n,
  skipped_count: n,
  companies_added: "Acme Corp\nWidget Co\n..."  // pre-joined string for Gmail body
}
```
The Code node outputs a single summary item. The Split Out step (Node 5a) expands `to_add[]` into individual n8n items for the Append node. Gmail on both branches references the Code node output via `$('Filter + Join + Dedup').first().json`.

**Sticky note on this node:**
> Joins Outreach Queue → Contacts tab on contact_email to get real contact title (job_title in OQ is the posted job, not the person's role). Deduplicates against Sequence Tracker before appending. Persona derived from contact_title keyword mapping.

### Node 5 — IF: Contacts to Add?
- **Condition:** `{{ $json.to_add.length > 0 }}`
- **True branch** → Node 5a (Split Out), then Node 6 (Append), then Node 7 (Gmail)
- **False branch** → Node 7 (Gmail, zero-count message)

### Node 5a — Split Out to_add Items
- **Type:** Code node (JavaScript)
- **Purpose:** Expands the `to_add[]` array from the summary item into individual n8n items so the Append node processes one row per contact
- **Logic:** `return $json.to_add.map(contact => ({ json: contact }));`

### Node 6 — Append to Sequence Tracker
- **Type:** Google Sheets → Append
- **Sheet:** Sequence Tracker (Cold BD Plan)
- **Mapping:**

| Sequence Tracker Column | Value |
|---|---|
| First Name | `{{ $json.first_name }}` |
| Last Name | `{{ $json.last_name }}` |
| Email | `{{ $json.email }}` |
| Title | `{{ $json.title }}` |
| Persona | `{{ $json.persona }}` |
| Company | `{{ $json.company }}` |
| Domain | `{{ $json.domain }}` |
| Industry | *(blank)* |
| Source | `project1_warmout` |
| current_touch | `4` |
| wave | `Safe_to_Send` |
| status | `Active` |
| warm_origin | `TRUE` |
| date_added | `{{ $json.date_added }}` |
| Direct Phone / Mobile / LinkedIn / City / State | *(blank)* |

### Node 7 — Gmail Summary (both branches)
- **To:** michael@10pillarssolutions.com
- **Subject:** `WF6 Handoff | {{ $now.toFormat('yyyy-MM-dd') }} | {{ $('Filter + Join + Dedup').first().json.to_add_count }} contacts moved to Cold BD Plan`
- **Body:** Pre-compute in a Code node before Gmail (same pattern as WF4's `Prepare Send Fields`):

```js
const summary = $('Filter + Join + Dedup').first().json;
return [{
  json: {
    _subject: `WF6 Handoff | ${new Date().toISOString().split('T')[0]} | ${summary.to_add_count} contacts moved to Cold BD Plan`,
    _body: `WF6 Warm → Cold Handoff Complete\n\nContacts added to Cold BD Plan: ${summary.to_add_count}\nSkipped (already in sequence): ${summary.skipped_count}\n\nCompanies added:\n${summary.companies_added}`
  }
}];
```

- **Credential:** Named Gmail credential (same as WF4)

---

## Field Mapping Summary

| Sequence Tracker | Source | Notes |
|---|---|---|
| First Name | `contact_name` (split) | Split on first space |
| Last Name | `contact_name` (split) | Remainder after first space |
| Email | `contact_email` | Join key for dedup |
| Title | `contact_title` | From Contacts tab via email join |
| Persona | Derived from `contact_title` | Keyword mapping in code |
| Company | `company_name` | |
| Domain | `company_domain` | |
| Industry | *(blank)* | Mostly blank in existing data — not worth joining |
| Source | `"project1_warmout"` | Hardcoded |
| current_touch | `4` | Picks up where warm sequence left off |
| wave | `"Safe_to_Send"` | Cold BD Plan wave designation |
| status | `"Active"` | Enters cold sequence immediately |
| warm_origin | `TRUE` | Flags this as a warm handoff contact |
| date_added | today (YYYY-MM-DD) | |

---

## Filter Logic

Outreach Queue rows qualify for handoff when:
1. `sent_status` = `"sent"` — all emails delivered
2. `follow_up_stage` = `2` — all 3 emails sent (0-indexed)
3. `sent_timestamp` ≤ today minus 5 days — cooling-off period before cold handoff

Replied and unsubscribed contacts are excluded automatically: the user manually sets `approval_status = "rejected"` on those rows, and WF5 archives them daily — they are gone before Sunday's WF6 run.

---

## Error Handling

- All three sheet reads use `alwaysOutputData: true` to avoid breaking the chain on empty tabs
- The IF node prevents the Append node from running with an empty array
- If the Contacts tab has no match for a given `contact_email`, `contact_title` defaults to `""` and persona defaults to `"Other"` — the row still transfers
- Gmail sends regardless of outcome (both IF branches) so Michael always gets a Sunday summary

---

## What This Workflow Does NOT Do

- Does not modify the Outreach Queue (no status update after handoff — WF5 handles archiving separately)
- Does not activate contacts in Instantly.ai — that is handled by the Cold BD Plan's own workflows
- Does not deduplicate within a single WF6 run (Hunter.io guarantees one contact per opportunity, so within-batch duplication is not expected)
