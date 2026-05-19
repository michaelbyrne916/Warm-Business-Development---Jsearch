# WF6 — Warm to Cold Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new n8n workflow that runs every Sunday at 5am, reads completed warm outreach contacts from the CLAUDE-N8N Outreach Queue, and appends qualifying contacts into the Cold BD Plan Sequence Tracker for continued cold outreach.

**Architecture:** Seven logical steps — three Google Sheets reads, one Code node for filtering/joining/deduping, one IF gate, one Google Sheets append, and Gmail summary notifications on both branches. All filtering and field mapping is done in JavaScript code nodes; no filtersUI is used anywhere (known n8n gotcha: multi-row filtersUI silently returns only the first match).

**Tech Stack:** n8n-mcp MCP tools (`n8n_manage_credentials`, `n8n_create_workflow`, `n8n_update_partial_workflow`, `n8n_validate_workflow`, `n8n_test_workflow`), Google Sheets OAuth2, Gmail OAuth2, JavaScript Code nodes.

---

## Node Map (12 nodes total)

| # | Name | Type | Branch |
|---|---|---|---|
| 1 | Every Sunday at 5am | Schedule Trigger | — |
| 2 | Read Outreach Queue | Google Sheets Read | — |
| 3 | Read Contacts Tab | Google Sheets Read | — |
| 4 | Read Sequence Tracker | Google Sheets Read | — |
| 5 | Filter + Join + Dedup | Code (JS) | — |
| 6 | IF: Contacts to Add? | IF | — |
| 7 | Split Out to_add Items | Code (JS) | True |
| 8 | Append to Sequence Tracker | Google Sheets Append | True |
| 9 | Prepare Handoff Summary | Code (JS) | True |
| 10 | Send Handoff Summary | Gmail | True |
| 11 | Prepare No-Contacts Summary | Code (JS) | False |
| 12 | Send No-Contacts Summary | Gmail | False |

---

## Data Sources

| Sheet | Spreadsheet ID | Tab |
|---|---|---|
| Outreach Queue | `192SvtVdg3hA0f4ZvHSWZTX2FG1HOzU_vw8jQA9md6no` | Outreach Queue |
| Contacts Tab | `192SvtVdg3hA0f4ZvHSWZTX2FG1HOzU_vw8jQA9md6no` | Contacts |
| Sequence Tracker | `1F2A8TtN5wOuHjvzcO0XYvu-DPmrQWNVaMklT6FTgF9Q` | Sheet1 |

---

## Task 1: Discover Named Credentials

**Purpose:** Find the exact credential IDs and names for Google Sheets and Gmail before building any nodes. These are required for every sheet/Gmail node.

- [ ] **Step 1: List all credentials**

```
Tool: n8n_manage_credentials
Action: list
```

Expected: A list of credentials. Identify:
- The **Google Sheets** credential — likely named something like `"Google Sheets account"` or `"Michael's Google Sheets"`. Note its `id` and `name`.
- The **Gmail** credential — likely named `"Gmail"` or `"Michael's Gmail"`. Note its `id` and `name`.

- [ ] **Step 2: Record the credential values**

You will need these exact values for every node in subsequent tasks. Save them mentally or note them:
```
GOOGLE_SHEETS_CREDENTIAL_ID   = "___"
GOOGLE_SHEETS_CREDENTIAL_NAME = "___"
GMAIL_CREDENTIAL_ID           = "___"
GMAIL_CREDENTIAL_NAME         = "___"
```

---

## Task 2: Create Workflow Skeleton with Schedule Trigger

**Purpose:** Create the workflow and establish its ID. All subsequent tasks patch into this workflow by ID.

- [ ] **Step 1: Create the workflow**

```
Tool: n8n_create_workflow
```

```json
{
  "name": "WF6 — Warm to Cold Handoff",
  "nodes": [
    {
      "name": "Every Sunday at 5am",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 300],
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 5 * * 0"
            }
          ]
        }
      }
    }
  ],
  "connections": {},
  "settings": {
    "executionOrder": "v1"
  }
}
```

Expected: Response includes `"id": "XXXXXXXXXXXXXXXX"`. **Record this workflow ID** — every subsequent task uses it.

---

## Task 3: Add Three Google Sheets Read Nodes

**Purpose:** Add nodes 2, 3, and 4 — the three sheet reads that feed the code node.

**Critical gotcha:** Do NOT set any `filtersUI` on Google Sheets read nodes. Even single-condition filters silently return only one row regardless of `returnAllMatches`. All filtering happens in the code node. Set `alwaysOutputData: true` on every read node so an empty sheet doesn't break the downstream chain.

- [ ] **Step 1: Add Read Outreach Queue node**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add Google Sheets read node for Outreach Queue — all rows, no filters, alwaysOutputData"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Read Outreach Queue",
        "type": "n8n-nodes-base.googleSheets",
        "typeVersion": 4.5,
        "position": [220, 300],
        "parameters": {
          "operation": "read",
          "documentId": {
            "__rl": true,
            "value": "192SvtVdg3hA0f4ZvHSWZTX2FG1HOzU_vw8jQA9md6no",
            "mode": "id"
          },
          "sheetName": {
            "__rl": true,
            "value": "Outreach Queue",
            "mode": "name"
          },
          "options": {
            "alwaysOutputData": true
          }
        },
        "credentials": {
          "googleSheetsOAuth2Api": {
            "id": "[GOOGLE_SHEETS_CREDENTIAL_ID]",
            "name": "[GOOGLE_SHEETS_CREDENTIAL_NAME]"
          }
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Add Read Contacts Tab node**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add Google Sheets read node for Contacts tab — needed for contact_title lookup by email"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Read Contacts Tab",
        "type": "n8n-nodes-base.googleSheets",
        "typeVersion": 4.5,
        "position": [440, 300],
        "parameters": {
          "operation": "read",
          "documentId": {
            "__rl": true,
            "value": "192SvtVdg3hA0f4ZvHSWZTX2FG1HOzU_vw8jQA9md6no",
            "mode": "id"
          },
          "sheetName": {
            "__rl": true,
            "value": "Contacts",
            "mode": "name"
          },
          "options": {
            "alwaysOutputData": true
          }
        },
        "credentials": {
          "googleSheetsOAuth2Api": {
            "id": "[GOOGLE_SHEETS_CREDENTIAL_ID]",
            "name": "[GOOGLE_SHEETS_CREDENTIAL_NAME]"
          }
        }
      }
    }
  ]
}
```

- [ ] **Step 3: Add Read Sequence Tracker node**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add Google Sheets read node for Cold BD Plan Sequence Tracker — used to build dedup email Set"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Read Sequence Tracker",
        "type": "n8n-nodes-base.googleSheets",
        "typeVersion": 4.5,
        "position": [660, 300],
        "parameters": {
          "operation": "read",
          "documentId": {
            "__rl": true,
            "value": "1F2A8TtN5wOuHjvzcO0XYvu-DPmrQWNVaMklT6FTgF9Q",
            "mode": "id"
          },
          "sheetName": {
            "__rl": true,
            "value": "Sheet1",
            "mode": "name"
          },
          "options": {
            "alwaysOutputData": true
          }
        },
        "credentials": {
          "googleSheetsOAuth2Api": {
            "id": "[GOOGLE_SHEETS_CREDENTIAL_ID]",
            "name": "[GOOGLE_SHEETS_CREDENTIAL_NAME]"
          }
        }
      }
    }
  ]
}
```

- [ ] **Step 4: Wire the linear chain: Trigger → Read Outreach Queue → Read Contacts Tab → Read Sequence Tracker**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Connect trigger → three sheet read nodes in sequence"
```

```json
{
  "operations": [
    {"type": "addConnection", "source": "Every Sunday at 5am", "target": "Read Outreach Queue"},
    {"type": "addConnection", "source": "Read Outreach Queue", "target": "Read Contacts Tab"},
    {"type": "addConnection", "source": "Read Contacts Tab", "target": "Read Sequence Tracker"}
  ]
}
```

---

## Task 4: Add Filter + Join + Dedup Code Node

**Purpose:** The core logic node. Reads all three upstream sheet results, filters the Outreach Queue for completed contacts, joins with Contacts tab on `contact_email` to get `contact_title`, derives persona, and deduplicates against the Sequence Tracker. Outputs a single summary item with `to_add[]` and `skipped[]`.

**Important:** In Code nodes, reference upstream nodes with `$('Node Name').all()` — NOT `$node["Node Name"]` (that syntax is expression-field only, not Code node).

- [ ] **Step 1: Add the Filter + Join + Dedup node**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add core logic code node — filters OQ for completed contacts, joins Contacts tab for title, deduplicates against Sequence Tracker"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Filter + Join + Dedup",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [880, 300],
        "parameters": {
          "jsCode": "// Pull all upstream sheet data\nconst oqRows = $('Read Outreach Queue').all().map(i => i.json);\nconst contactsRows = $('Read Contacts Tab').all().map(i => i.json);\nconst trackerRows = $('Read Sequence Tracker').all().map(i => i.json);\n\n// Build Contacts lookup map: contact_email (lowercase) → contact_title\nconst contactsMap = {};\nfor (const row of contactsRows) {\n  const key = (row.contact_email || '').toLowerCase().trim();\n  if (key) contactsMap[key] = row.contact_title || '';\n}\n\n// Build Sequence Tracker dedup Set from Email column\nconst existingEmails = new Set(\n  trackerRows.map(r => (r.Email || '').toLowerCase().trim()).filter(Boolean)\n);\n\n// Derive Cold BD Plan persona category from contact title\nfunction derivePersona(title) {\n  const t = (title || '').toLowerCase();\n  if (t.includes('ciso')) return 'CISO';\n  if (t.includes('cto') || t.includes('chief technology')) return 'CTO';\n  if (t.includes('cio') || t.includes('chief information')) return 'CIO';\n  if (t.includes('ceo') || t.includes('president') || t.includes('founder')) return 'CEO/President';\n  if (t.includes('vp') || t.includes('vice president')) return 'VP';\n  if (t.includes('director')) return 'Director';\n  if (t.includes('manager')) return 'Manager';\n  if (t.includes('engineer')) return 'Engineering';\n  return 'Other';\n}\n\n// Today at midnight for date comparison\nconst today = new Date();\ntoday.setHours(0, 0, 0, 0);\n\nconst to_add = [];\nconst skipped = [];\n\nfor (const row of oqRows) {\n  // Filter: sent_status = 'sent'\n  const sentStatus = (row.sent_status || '').toLowerCase().trim();\n  if (sentStatus !== 'sent') continue;\n\n  // Filter: follow_up_stage = 2 (0-indexed: 0=email1, 1=email2, 2=email3)\n  const followUpStage = parseInt(row.follow_up_stage, 10);\n  if (followUpStage !== 2) continue;\n\n  // Filter: sent_timestamp is 5+ calendar days before today\n  const sentTimestamp = row.sent_timestamp ? new Date(row.sent_timestamp) : null;\n  if (!sentTimestamp || isNaN(sentTimestamp.getTime())) continue;\n  const daysSinceSent = Math.floor((today - sentTimestamp) / (1000 * 60 * 60 * 24));\n  if (daysSinceSent < 5) continue;\n\n  const email = (row.contact_email || '').toLowerCase().trim();\n  if (!email) continue;\n\n  // Dedup: skip if already in Sequence Tracker\n  if (existingEmails.has(email)) {\n    skipped.push(email);\n    continue;\n  }\n\n  // Join with Contacts tab to get real contact title\n  // (job_title in OQ is the posted job, not the person's role)\n  const contactTitle = contactsMap[email] || '';\n\n  // Split contact_name into first / last\n  const nameParts = (row.contact_name || '').trim().split(/\\s+/);\n  const firstName = nameParts[0] || '';\n  const lastName = nameParts.slice(1).join(' ');\n\n  to_add.push({\n    first_name: firstName,\n    last_name: lastName,\n    email: row.contact_email,\n    title: contactTitle,\n    persona: derivePersona(contactTitle),\n    company: row.company_name || '',\n    domain: row.company_domain || '',\n    industry: '',\n    source: 'project1_warmout',\n    current_touch: 4,\n    wave: 'Safe_to_Send',\n    status: 'Active',\n    warm_origin: true,\n    date_added: today.toISOString().split('T')[0],\n    _company_for_summary: row.company_name || ''\n  });\n}\n\n// Pre-join company list as a string for Gmail body\nconst companies_added = to_add\n  .map(c => c._company_for_summary)\n  .filter(Boolean)\n  .join('\\n');\n\nreturn [{\n  json: {\n    to_add,\n    skipped,\n    to_add_count: to_add.length,\n    skipped_count: skipped.length,\n    companies_added\n  }\n}];"
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Connect Read Sequence Tracker → Filter + Join + Dedup**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Connect Read Sequence Tracker to the core logic code node"
```

```json
{
  "operations": [
    {"type": "addConnection", "source": "Read Sequence Tracker", "target": "Filter + Join + Dedup"}
  ]
}
```

---

## Task 5: Add IF Node and Split Out Node

**Purpose:** IF node gates on `to_add.length > 0`. True branch routes to Split Out (which expands the `to_add[]` array into individual n8n items for the Append node). False branch routes to the zero-count Gmail.

- [ ] **Step 1: Add the IF node**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add IF gate — skip Append when no contacts qualify"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "IF: Contacts to Add?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [1100, 300],
        "parameters": {
          "conditions": {
            "options": {
              "caseSensitive": true,
              "leftValue": "",
              "typeValidation": "strict"
            },
            "conditions": [
              {
                "id": "condition1",
                "leftValue": "={{ $json.to_add_count }}",
                "rightValue": 0,
                "operator": {
                  "type": "number",
                  "operation": "gt"
                }
              }
            ],
            "combinator": "and"
          }
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Add the Split Out to_add Items node**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add code node that expands to_add[] array into individual n8n items for the Append node"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Split Out to_add Items",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1320, 160],
        "parameters": {
          "jsCode": "return $json.to_add.map(contact => ({ json: contact }));"
        }
      }
    }
  ]
}
```

- [ ] **Step 3: Wire Filter + Join + Dedup → IF, and IF true → Split Out**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Connect code node to IF gate, and IF true branch to Split Out"
```

```json
{
  "operations": [
    {"type": "addConnection", "source": "Filter + Join + Dedup", "target": "IF: Contacts to Add?"},
    {"type": "addConnection", "source": "IF: Contacts to Add?", "target": "Split Out to_add Items", "branch": "true"}
  ]
}
```

---

## Task 6: Add Append to Sequence Tracker Node

**Purpose:** For each individual contact item from Split Out, appends one row to the Cold BD Plan Sequence Tracker. Column names must match the Sequence Tracker sheet headers exactly (case-sensitive).

- [ ] **Step 1: Add the Append node**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add Google Sheets append node — writes each contact into Cold BD Plan Sequence Tracker"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Append to Sequence Tracker",
        "type": "n8n-nodes-base.googleSheets",
        "typeVersion": 4.5,
        "position": [1540, 160],
        "parameters": {
          "operation": "append",
          "documentId": {
            "__rl": true,
            "value": "1F2A8TtN5wOuHjvzcO0XYvu-DPmrQWNVaMklT6FTgF9Q",
            "mode": "id"
          },
          "sheetName": {
            "__rl": true,
            "value": "Sheet1",
            "mode": "name"
          },
          "columns": {
            "mappingMode": "defineBelow",
            "value": {
              "First Name": "={{ $json.first_name }}",
              "Last Name": "={{ $json.last_name }}",
              "Email": "={{ $json.email }}",
              "Title": "={{ $json.title }}",
              "Persona": "={{ $json.persona }}",
              "Company": "={{ $json.company }}",
              "Domain": "={{ $json.domain }}",
              "Industry": "",
              "Source": "project1_warmout",
              "current_touch": "={{ $json.current_touch }}",
              "wave": "={{ $json.wave }}",
              "status": "={{ $json.status }}",
              "warm_origin": "={{ $json.warm_origin }}",
              "date_added": "={{ $json.date_added }}"
            }
          },
          "options": {}
        },
        "credentials": {
          "googleSheetsOAuth2Api": {
            "id": "[GOOGLE_SHEETS_CREDENTIAL_ID]",
            "name": "[GOOGLE_SHEETS_CREDENTIAL_NAME]"
          }
        }
      }
    }
  ]
}
```

**Important — verify column names before running:** The Sequence Tracker column names in the mapping above must match the sheet headers exactly (case-sensitive). The screenshot showed `First Name`, `Last Name`, `Email`, `Title`, `Persona`, `Company`, `Domain`, `Industry`, `Source` — but columns like `current_touch`, `wave`, `status`, `warm_origin`, `date_added` were not visible. Before the test run in Task 10, open the Sequence Tracker sheet and confirm the exact header spellings for those columns. Adjust the mapping in this node if they differ (e.g., `Current Touch` vs `current_touch`).

- [ ] **Step 2: Connect Split Out → Append**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Connect Split Out to Append node"
```

```json
{
  "operations": [
    {"type": "addConnection", "source": "Split Out to_add Items", "target": "Append to Sequence Tracker"}
  ]
}
```

---

## Task 7: Add Gmail Summary Nodes (Both Branches)

**Purpose:** Both IF branches end in a Gmail summary to michael@10pillarssolutions.com. Both read summary data from `$('Filter + Join + Dedup').first().json` (not from `$json`) since by this point `$json` contains Append output on the true branch and IF output on the false branch.

Each branch gets its own Prepare (Code node) + Send (Gmail node) pair, following the WF4 pattern where string transforms are done in a Code node before Gmail to avoid expression limitations.

- [ ] **Step 1: Add Prepare Handoff Summary node (true branch)**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add code node to prepare Gmail subject + body for the contacts-added case"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Prepare Handoff Summary",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1760, 160],
        "parameters": {
          "jsCode": "const summary = $('Filter + Join + Dedup').first().json;\nconst dateStr = new Date().toISOString().split('T')[0];\nconst companiesHtml = summary.companies_added\n  ? summary.companies_added.replace(/\\n/g, '<br>')\n  : '(none)';\nreturn [{\n  json: {\n    _subject: `WF6 Handoff | ${dateStr} | ${summary.to_add_count} contacts moved to Cold BD Plan`,\n    _body_html: `<p><strong>WF6 Warm → Cold Handoff Complete</strong></p><p>Contacts added to Cold BD Plan: <strong>${summary.to_add_count}</strong><br>Skipped (already in sequence): ${summary.skipped_count}</p><p><strong>Companies added:</strong><br>${companiesHtml}</p>`\n  }\n}];"
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Add Send Handoff Summary Gmail node (true branch)**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add Gmail node to send handoff summary when contacts were added"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Send Handoff Summary",
        "type": "n8n-nodes-base.gmail",
        "typeVersion": 2.1,
        "position": [1980, 160],
        "parameters": {
          "sendTo": "michael@10pillarssolutions.com",
          "subject": "={{ $json._subject }}",
          "message": "={{ $json._body_html }}",
          "options": {
            "emailType": "html"
          }
        },
        "credentials": {
          "gmailOAuth2": {
            "id": "[GMAIL_CREDENTIAL_ID]",
            "name": "[GMAIL_CREDENTIAL_NAME]"
          }
        }
      }
    }
  ]
}
```

- [ ] **Step 3: Add Prepare No-Contacts Summary node (false branch)**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add code node to prepare Gmail subject + body for the zero-contacts case"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Prepare No-Contacts Summary",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1320, 440],
        "parameters": {
          "jsCode": "const summary = $('Filter + Join + Dedup').first().json;\nconst dateStr = new Date().toISOString().split('T')[0];\nreturn [{\n  json: {\n    _subject: `WF6 Handoff | ${dateStr} | 0 contacts moved to Cold BD Plan`,\n    _body_html: `<p><strong>WF6 Warm → Cold Handoff Complete</strong></p><p>No new contacts qualified for handoff this week.</p><p>Skipped (already in sequence): ${summary.skipped_count}</p>`\n  }\n}];"
        }
      }
    }
  ]
}
```

- [ ] **Step 4: Add Send No-Contacts Summary Gmail node (false branch)**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add Gmail node to send zero-count summary when no contacts qualified"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Send No-Contacts Summary",
        "type": "n8n-nodes-base.gmail",
        "typeVersion": 2.1,
        "position": [1540, 440],
        "parameters": {
          "sendTo": "michael@10pillarssolutions.com",
          "subject": "={{ $json._subject }}",
          "message": "={{ $json._body_html }}",
          "options": {
            "emailType": "html"
          }
        },
        "credentials": {
          "gmailOAuth2": {
            "id": "[GMAIL_CREDENTIAL_ID]",
            "name": "[GMAIL_CREDENTIAL_NAME]"
          }
        }
      }
    }
  ]
}
```

- [ ] **Step 5: Wire the remaining connections**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Wire all remaining connections — Append → Prepare → Gmail (true branch), IF false → Prepare → Gmail (false branch)"
```

```json
{
  "operations": [
    {"type": "addConnection", "source": "Append to Sequence Tracker", "target": "Prepare Handoff Summary"},
    {"type": "addConnection", "source": "Prepare Handoff Summary", "target": "Send Handoff Summary"},
    {"type": "addConnection", "source": "IF: Contacts to Add?", "target": "Prepare No-Contacts Summary", "branch": "false"},
    {"type": "addConnection", "source": "Prepare No-Contacts Summary", "target": "Send No-Contacts Summary"}
  ]
}
```

---

## Task 8: Add Sticky Note

**Purpose:** Explain the join and dedup logic for future maintainers.

- [ ] **Step 1: Add sticky note near the Filter + Join + Dedup node**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Add sticky note explaining the core code node logic"
```

```json
{
  "operations": [
    {
      "type": "addNode",
      "node": {
        "name": "Sticky Note — Dedup Logic",
        "type": "n8n-nodes-base.stickyNote",
        "typeVersion": 1,
        "position": [780, 460],
        "parameters": {
          "content": "## Filter + Join + Dedup Logic\n\n**Why 3 sheet reads?**\n- Outreach Queue: source contacts (sent_status=sent, follow_up_stage=2, 5+ days old)\n- Contacts Tab: join on contact_email → contact_title (job_title in OQ is the *posted job*, not the person's role)\n- Sequence Tracker: build dedup Set so we never double-add a contact\n\n**Persona mapping** derives from contact_title keywords (CTO, VP, Director, etc.)\n\n**Replied/unsubscribed contacts** are excluded automatically — user sets approval_status=rejected → WF5 archives them daily before Sunday 5am run.",
          "width": 380,
          "height": 200
        }
      }
    }
  ]
}
```

---

## Task 9: Validate the Workflow

**Purpose:** Run structural validation before activating. Fix any errors before proceeding.

- [ ] **Step 1: Validate the workflow**

```
Tool: n8n_validate_workflow
Workflow ID: [from Task 2]
```

Expected: `valid: true` with no errors. Warnings about missing credentials are acceptable at this stage if credentials haven't been set yet — but connection and node-structure errors must be zero.

- [ ] **Step 2: If there are errors, fix them**

Common issues and fixes:
- `"Missing connection"` → re-run the addConnection operation for the missing pair
- `"Unknown node type"` → check typeVersion, use `get_node` to confirm correct type string
- `"Invalid parameter"` → check the parameter name (e.g., `updates` not `parameters` in updateNode operations)
- `"Credential not found"` → confirm credential ID from Task 1 matches exactly

---

## Task 10: Manual Test Run

**Purpose:** Trigger the workflow manually to confirm it runs end-to-end without errors. Review execution output before activating on the cron schedule.

- [ ] **Step 1: Run the workflow manually**

```
Tool: n8n_test_workflow
Workflow ID: [from Task 2]
```

- [ ] **Step 2: Review the execution output**

Check each node's output:
- **Read Outreach Queue** → should return rows (or empty `{}` if OQ is empty)
- **Read Contacts Tab** → should return contact rows
- **Read Sequence Tracker** → should return existing tracker rows
- **Filter + Join + Dedup** → inspect `to_add_count` and `skipped_count` on the output item. If OQ has no qualifying rows, `to_add_count = 0` is correct.
- **IF: Contacts to Add?** → should route to the correct branch based on count
- **Append to Sequence Tracker** → if `to_add_count > 0`, verify rows appear in the Cold BD Plan sheet
- **Gmail nodes** → confirm summary email arrives at michael@10pillarssolutions.com

- [ ] **Step 3: If any node fails, diagnose and fix**

Key debugging patterns:
- If Filter + Join + Dedup throws `"Cannot read property of undefined"`: a sheet returned 0 rows and `alwaysOutputData` wasn't set → verify `alwaysOutputData: true` on all three read nodes
- If Append writes to wrong columns: the column names in `columns.value` must match the Sequence Tracker headers exactly (case-sensitive). Check sheet headers and adjust mapping.
- If Gmail fails: confirm Gmail credential is OAuth2 type (`gmailOAuth2`), not SMTP

---

## Task 11: Activate the Workflow

**Purpose:** Enable the Sunday 5am cron so it runs automatically going forward.

- [ ] **Step 1: Activate the workflow**

```
Tool: n8n_update_partial_workflow
Workflow ID: [from Task 2]
Intent: "Activate WF6 on Sunday 5am schedule"
```

```json
{
  "operations": [
    {"type": "activateWorkflow"}
  ]
}
```

Expected: Workflow status changes to `active: true`.

- [ ] **Step 2: Confirm activation**

```
Tool: n8n_get_workflow
Workflow ID: [from Task 2]
```

Confirm `"active": true` in the response. The workflow will next fire at 5:00am on the coming Sunday.

---

## Post-Build Checklist

- [ ] Workflow appears in n8n dashboard as **WF6 — Warm to Cold Handoff**, status Active
- [ ] All node names are descriptive (no "Google Sheets1", "Code", "Gmail1" defaults)
- [ ] No hardcoded credentials — all nodes reference named credential objects
- [ ] Sticky note visible on canvas near Filter + Join + Dedup node
- [ ] Test email received at michael@10pillarssolutions.com
- [ ] WF1–WF5 are unaffected (this workflow has no writes to Outreach Queue, Contacts tab, or any existing workflow's sheets)

---

## Appendix: Complete Code Node Reference

### Filter + Join + Dedup (Node 5) — full readable version

```javascript
const oqRows = $('Read Outreach Queue').all().map(i => i.json);
const contactsRows = $('Read Contacts Tab').all().map(i => i.json);
const trackerRows = $('Read Sequence Tracker').all().map(i => i.json);

// contact_email → contact_title lookup
const contactsMap = {};
for (const row of contactsRows) {
  const key = (row.contact_email || '').toLowerCase().trim();
  if (key) contactsMap[key] = row.contact_title || '';
}

// Dedup Set from Sequence Tracker Email column
const existingEmails = new Set(
  trackerRows.map(r => (r.Email || '').toLowerCase().trim()).filter(Boolean)
);

function derivePersona(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('ciso')) return 'CISO';
  if (t.includes('cto') || t.includes('chief technology')) return 'CTO';
  if (t.includes('cio') || t.includes('chief information')) return 'CIO';
  if (t.includes('ceo') || t.includes('president') || t.includes('founder')) return 'CEO/President';
  if (t.includes('vp') || t.includes('vice president')) return 'VP';
  if (t.includes('director')) return 'Director';
  if (t.includes('manager')) return 'Manager';
  if (t.includes('engineer')) return 'Engineering';
  return 'Other';
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const to_add = [];
const skipped = [];

for (const row of oqRows) {
  const sentStatus = (row.sent_status || '').toLowerCase().trim();
  if (sentStatus !== 'sent') continue;

  const followUpStage = parseInt(row.follow_up_stage, 10);
  if (followUpStage !== 2) continue;

  const sentTimestamp = row.sent_timestamp ? new Date(row.sent_timestamp) : null;
  if (!sentTimestamp || isNaN(sentTimestamp.getTime())) continue;
  const daysSinceSent = Math.floor((today - sentTimestamp) / (1000 * 60 * 60 * 24));
  if (daysSinceSent < 5) continue;

  const email = (row.contact_email || '').toLowerCase().trim();
  if (!email) continue;

  if (existingEmails.has(email)) {
    skipped.push(email);
    continue;
  }

  const contactTitle = contactsMap[email] || '';
  const nameParts = (row.contact_name || '').trim().split(/\s+/);

  to_add.push({
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' '),
    email: row.contact_email,
    title: contactTitle,
    persona: derivePersona(contactTitle),
    company: row.company_name || '',
    domain: row.company_domain || '',
    industry: '',
    source: 'project1_warmout',
    current_touch: 4,
    wave: 'Safe_to_Send',
    status: 'Active',
    warm_origin: true,
    date_added: today.toISOString().split('T')[0],
    _company_for_summary: row.company_name || ''
  });
}

const companies_added = to_add.map(c => c._company_for_summary).filter(Boolean).join('\n');

return [{ json: { to_add, skipped, to_add_count: to_add.length, skipped_count: skipped.length, companies_added } }];
```

### Split Out to_add Items (Node 7)

```javascript
return $json.to_add.map(contact => ({ json: contact }));
```

### Prepare Handoff Summary (Node 9 — true branch)

```javascript
const summary = $('Filter + Join + Dedup').first().json;
const dateStr = new Date().toISOString().split('T')[0];
const companiesHtml = summary.companies_added
  ? summary.companies_added.replace(/\n/g, '<br>')
  : '(none)';
return [{
  json: {
    _subject: `WF6 Handoff | ${dateStr} | ${summary.to_add_count} contacts moved to Cold BD Plan`,
    _body_html: `<p><strong>WF6 Warm → Cold Handoff Complete</strong></p><p>Contacts added to Cold BD Plan: <strong>${summary.to_add_count}</strong><br>Skipped (already in sequence): ${summary.skipped_count}</p><p><strong>Companies added:</strong><br>${companiesHtml}</p>`
  }
}];
```

### Prepare No-Contacts Summary (Node 11 — false branch)

```javascript
const summary = $('Filter + Join + Dedup').first().json;
const dateStr = new Date().toISOString().split('T')[0];
return [{
  json: {
    _subject: `WF6 Handoff | ${dateStr} | 0 contacts moved to Cold BD Plan`,
    _body_html: `<p><strong>WF6 Warm → Cold Handoff Complete</strong></p><p>No new contacts qualified for handoff this week.</p><p>Skipped (already in sequence): ${summary.skipped_count}</p>`
  }
}];
```
