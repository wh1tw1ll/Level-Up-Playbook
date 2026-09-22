# Section 0 — Full System Map
Generated: 2026-09-21 17:30 ET

---

## 0a. Every Cron I Own

| # | Name | Schedule | Reads | Writes To | State | Last Run | Notes |
|---|------|----------|-------|-----------|-------|----------|-------|
| 1 | LUNA Morning Scan | 0 6 * * * (6 AM daily) | MFP + Level Up email inboxes | DOVA Action Tracker (4456864287772548) | **PAUSED** | Jul 16 OK | Skill-based (luna skill), full inbox scan v2 |
| 2 | LUNA Evening Scan | 0 19 * * * (7 PM daily) | MFP + Level Up email inboxes | DOVA Action Tracker (4456864287772548) | **PAUSED** | Jul 15 OK | Skill-based, same as morning |
| 3 | LUNA Daily Action Scan | 30 5 * * * (5:30 AM) | Granola notes + Smartsheet | DOVA Action Tracker (4456864287772548) | **PAUSED** | Never ran | Created Sep 17, paused same day |
| 4 | Granola Staging | 0 7 * * * (7 AM) | Granola API notes → stage into sheet | Staging area → DOVA Action Tracker via promote | **PAUSED** | Sep 20 OK | Script: granola_cron_stage.py |
| 5 | Level Up Mail Scan | 0 8 * * * (8 AM) | Level Up email (wwilliams@levelup-pd.com) | DOVA Action Tracker (4456864287772548) | **PAUSED** | Sep 20 OK | Script-based body commitment extraction |
| 6 | MFP Mail Scan | 30 8 * * * (8:30 AM) | MFP email | MFP Action Tracker (5109402316263300) | **PAUSED** | Never ran | Created Sep 17, paused same day |
| 7 | Outlook Flagged Sync | every 5m | Outlook flagged items | Local script only | **PAUSED** | Sep 15 ERROR | no_agent, bash script; erroring before pause |
| 8 | LUNA Dispatch Watcher | every 2m | Dispatch queue | Reads: DOVA Action Tracker | **PAUSED** | Sep 15 ERROR | no_agent, Python; erroring before pause |
| 9 | Outbox Ingest | 0 * * * 1-5 (hourly weekdays) | Claude Outbox sheet (107689561771908) | DOVA Action Tracker via /api/admin/ingest-outbox | **PAUSED** | Sep 18 OK | Curls live API endpoint |
| 10 | Context Requests Poller | every 30m | Context Requests sheet (6019591785631620) | Opens rows → triggers Hermes response | **PAUSED** | Sep 20 OK | Reads open rows, delivers context |
| 11 | Prep Map Populate | every 360m (6h) | Prep Map sheet (1007659559112580) | Same sheet — populates agenda data | **RUNNING** | Never ran | no_agent bash script; .sh file may not exist |
| 12 | Agenda Generator | every 60m | /api/prep endpoint? | Delivers to chat | **RUNNING** | Sep 21 ERROR | no_agent bash script; erroring each cycle |

**Total:** 12 crons. 10 paused. 2 running but both erroring (Prep Map Populate never ran, Agenda Generator errors every cycle).

---

## 0b. Data Flow — One Action Item End to End

### Path A: Granola Meeting Note → Screen

```
Granola desktop app records meeting
  ↓
Granola API (public-api.granola.ai/v1) stores note
  ↓
[CRON: Granola Staging, 7 AM] ← PAUSED
  → granola_cron_stage.py reads notes via curl + Granola API token
  → Extracts action-like lines using keyword pattern match (ACT_KW list)
  → Writes to DOVA Action Tracker rows via Smartsheet API
    Columns written: Action ID, Status, Owner, (ExtractionId: NOT WRITTEN)
  → Also writes to "staging" area? Need to verify path
  ↓
[CRON: Level Up Mail Scan, 8 AM] ← PAUSED  
  → Python script scans Granola API + email
  → Extracts commitments from email body text
  → Writes to DOVA Action Tracker
  ↓
[On page load]
  → renderDailyManager() in app-daily-manager.js
  → Calls loadTasks() → fetch('/api/tasks')
  → api/index.js route: lists all tasks from DOVA Action Tracker via Smartsheet API
  → Returns JSON { tasks: [...], rowCount, totalInSheet, truncated }
  → Renders task items in #task-list with filters, sorting, status badges
  ↓
[HOP MISSING: ExtractionId not written by extractors]
  → The ExtractionId column (index 0) at 1375775527571332 exists
  → Nothing currently writes to it
  → Result: no dedup, blind append every cycle → 226 rows, many duplicates
```

### Path B: Prep View (meeting notes grouped by action items)

```
User clicks PREP tab
  ↓
setView('prep') in app-core.js
  ↓
renderPrepView() in app-prep.js
  → fetch('/api/prep')
  → prep.js handler:
    → Fetches Granola notes (last 14 days) via public-api.granola.ai/v1
    → Fetches DOVA Action Tracker sheet via Smartsheet API
    → Parses Action ID format: [Granola: MeetingName (YYYY-MM-DD)] text
    → Groups actions by meeting name + date
    → Returns { meetings: [...], agenda: {...} }
  ↓
renderPrepData() renders:
  → 48-hour agenda section (priority actions)
  → Meeting browser (sidebar list → detail view)
  → Action items grouped under each meeting
```

### Path C: Manual Entry → Screen

```
User types in Smartsheet directly (Action Tracker)
  ↓
Smartsheet saves row
  ↓
[On page load or refresh]
  → fetch('/api/tasks') reads live from Smartsheet
  → No caching layer — always live
```

### Path D: Claude Outbox → Screen

```
Hermes generates an action item
  → Writes to Claude Outbox sheet (107689561771908)
  ↓
[CRON: Outbox Ingest, hourly M-F] ← PAUSED
  → curl https://level-up-playbook.vercel.app/api/admin/ingest-outbox
  → Reads Outbox rows, writes to DOVA Action Tracker
  ↓
[On page load] → same Path A tail
```

**Key broken hop:** ExtractionId is never written. No dedup exists. Every cron cycle blindly appends.

---

## 0c. Every Smartsheet I Write To

| Sheet | ID | Rows | Written By | Frequency | Still Used? |
|------|-----|------|-----------|-----------|------------|
| **DOVA Action Tracker** | 4456864287772548 | 226 | All extraction crons, outbox ingest, promote, manual | Multiple times daily | **YES — primary** |
| **Personal Action Log** | 2802755367554948 | 154 | Unknown — may be legacy | ? | Likely **stale** |
| **MFP Action Tracker** | 5109402316263300 | 12 | MFP Mail Scan cron (PAUSED, never ran) | Never ran | **Intended** but empty |
| **Claude Outbox** | 107689561771908 | 0 | Hermes writes outbox items | When triggered | **YES — outbox source** |
| **Context Requests** | 6019591785631620 | 1 | Hermes/UI writes request rows | On demand | **YES — active** |
| **Prep Map** | 1007659559112580 | 13 | Prep Map Populate cron | every 6h (never ran) | **Intended** but sparse |
| **Budget Snapshot** | 1918121356251012 | 4 | DOVA dashboard reads this | On dashboard load | **YES — DOVA panel** |

**Unknown:** Personal Action Log (154 rows, no cron writes to it). May be legacy from earlier phase.

---

## 0d. Both Deployments — Route by Route

### level-up-playbook.vercel.app (also deployed as luci-by-levelup.vercel.app)

| Route | Handler | Auth Gate | Data Source | Still Called? |
|------|---------|-----------|-------------|-------------|
| /api/check-auth | checkAuth | None (bypass) | Cookie check | YES |
| /api/verify-password | verifyPassword | None (bypass) | SITE_PASSWORD env | YES |
| /api/chat | chatHandler | requireSiteAuth | KB + LLM (OpenRouter/Anthropic) | YES |
| /api/prep | prepHandler | None (bypass) | Granola API + Smartsheet 4456864287772548 | YES (new) |
| /api/stage | stageHandler | requireSiteAuth | DOVA Action Tracker | YES |
| /api/promote | promoteHandler | requireSiteAuth | DOVA Action Tracker | YES |
| /api/ss-ops | ssOpsHandler | requireSiteAuth | Smartsheet | YES |
| /api/admin/batch | adminBatch | requireSiteAuth | Smartsheet | Rare |
| /api/dova | dovaHandler | N/A (PASSWORD_ALLOWED) | DOVA Smartsheet | YES (client) |
| /api/dova-setup | dovaSetupHandler | requireSiteAuth | DOVA Smartsheet | Rare |
| /api/dova-seed | dovaSeedHandler | requireSiteAuth | DOVA Smartsheet | Rare |
| /api/dova-workspace | dovaWorkspaceHandler | requireSiteAuth | Smartsheet | Rare |
| /api/dova-update-schedule | dovaUpdateSchedule | requireSiteAuth | DOVA schedule | Rare |
| /api/chiefs | chiefsHandler | requireSiteAuth | KC Chiefs Smartsheet | Possibly stale |
| /api/chiefs-v3 | chiefsV3Handler | requireSiteAuth | KC Chiefs Smartsheet | Possibly stale |
| /api/sync/flagged-store | — | requireSiteAuth | Outlook flagged items | Rare |
| /api/outlook/flagged | — | requireSiteAuth | Outlook | Rare |
| /api/outlook/action-items | actionItems | requireSiteAuth | Outlook | Rare |
| /api/outlook/email | emailHandler | requireSiteAuth | Outlook | Rare |
| /api/outlook/calendar | calendarHandler | requireSiteAuth | Outlook | Rare |
| /api/sharepoint/search | sharepointSearch | requireSiteAuth | SharePoint | Rare |
| /api/sharepoint/read | sharepointRead | requireSiteAuth | SharePoint | Rare |
| /api/actions | — | PASSWORD_ALLOWED | DOVA Tracker (filtered) | YES (client DOVA) |
| /api/client/actions | — | PASSWORD_ALLOWED | DOVA Tracker (filtered) | YES (client DOVA) |
| /api/logo | — | PASSWORD_ALLOWED | Static | YES |
| /api/state | — | requireSiteAuth | Multiple sheets | YES |
| /api/admin/create-outbox | — | requireSiteAuth | Claude Outbox | Rare |
| /api/admin/ingest-outbox | — | requireSiteAuth | Outbox → DOVA Tracker | Cron only |
| /api/admin/cleanup | — | requireSiteAuth | Smartsheet | Rare |
| /api/admin/setup-phase2 | — | requireSiteAuth | Smartsheet | Rare |
| /api/admin/resolve-duplicates | — | requireSiteAuth | DOVA Tracker | Rare |
| /api/admin/delete-sheet | — | requireSiteAuth | Smartsheet | Rare |
| /api/admin/add-source-confidence | — | requireSiteAuth | DOVA Tracker | Rare |
| /api/admin/normalize-sources | — | requireSiteAuth | DOVA Tracker | Rare |
| /api/admin/update-picklists | — | requireSiteAuth | DOVA Tracker | Rare |
| /api/admin/request-blank-project-tri | — | requireSiteAuth | DOVA Tracker | Rare |
| /api/admin/clean | — | requireSiteAuth | DOVA Tracker | Rare |
| /api/prep-map | prepMapHandler | requireSiteAuth | Prep Map sheet | Rare |
| /api/extract-from-note | extractFromNote | requireSiteAuth | Granola note | Rare |
| /api/admin/scan-stragglers | — | requireSiteAuth | DOVA Tracker | Rare |
| /api/admin/fix-stragglers | — | requireSiteAuth | DOVA Tracker | Rare |
| /api/dova-dashboard | — | requireSiteAuth | DOVA Smartsheet | YES |

### dova-dashboard-ten.vercel.app
Client-facing DOVA dashboard. Static HTML + SPA JS. Reads /api/client/actions and /api/dova from the main API via rewrites. No own server-side routes. Rewrites proxy to level-up-playbook.vercel.app.

---

## 0e. Tokens — Current State

| Token | Source | Scopes | Can Write? | Status |
|-------|--------|--------|-----------|--------|
| **Smartsheet** (`ChRJVB...`) | Hardcoded in scripts, env var on Vercel | Full sheet access (OWNER level) | YES | Working. Verified 226-row read. |
| **Granola API** (`grn_Xt3QX...`) | Hardcoded in prep.js, granola scripts, env var | Notes read-only (v1/notes) | NO (read-only API) | Working. Returns notes. |
| **Microsoft Graph** (OAuth delegated) | Browser has delegated token after sign-in | User.Read, Calendars.Read, Mail.Read, Files.ReadWrite.All, Sites.ReadWrite.All | YES (files, mail) | Only available in browser after Microsoft sign-in. No server-side refresh token stored. |
| **Procore** (refresh token) | Vercel env var PROCORE_REFRESH_TOKEN | Procore API scoped to project | YES | Working but Procore button removed from UI. Still accessible at /procore/login. |
| **Anthropic** | Vercel env var | Claude API | N/A | Working for chat. |
| **OpenRouter** | Vercel env var | LLM API gateway | N/A | Working, primary for LUNA. |
| **Telegram Bot** | Vercel env var | Telegram API | YES | Working, used for cron delivery. |

---

## 0f. What Is Broken or Half-Built

1. **EXTRACTION KEY (CRITICAL):** ExtractionId column exists but NOTHING writes to it. Every cron cycle blindly appends. 226 rows today; will grow unbounded. No dedup at any point in the pipeline.

2. **ACCEPTANCE GATE (CRITICAL):** No gate exists. Any sentence with an action keyword gets a row. This is why 188 of 226 rows are "meeting-note fragments" (as diagnosed earlier).

3. **STATUS TOGGLE BUG (app-tasks.js line 117):** fetch doesn't reject on HTTP errors. 401/403/500 all land in .then(). UI flips to Complete even when Smartsheet rejects the write. User gets false confirmations.

4. **REMINDER PANEL POLL RATE:** Fetches every 30 seconds (120 Smartsheet calls/hour/tab). Should read store, not direct fetch. Too fast.

5. **TASKS VIEW REDIRECT:** renderTasksView() in app-tasks.js now creates HTML inline + calls renderDailyManager(). This was rebuilt today (Sep 21). Not battle-tested. The HTML template may miss critical elements the daily manager expects.

6. **PREP VIEW:** Built today (Sep 21). app-prep.js + /api/prep endpoint. Not battle-tested. Meeting grouping relies on the Action ID format `[Granola: MeetingName (YYYY-MM-DD)]` which may not match actual data.

7. **MFP ACTION TRACKER:** 12 rows. MFP Mail Scan cron never actually ran (created Sep 17, paused same day). MFP is not being tracked.

8. **PERSONAL ACTION LOG:** 154 rows. No cron writes to it. Unknown if still in use or legacy.

9. **CLAUDE OUTBOX:** 0 rows. Outbox Ingest cron works (last ran Sep 18 OK) but no items to ingest. Hermes may not be writing to it.

10. **PREP MAP POPULATE CRON:** Running but script (run_prep_map_populate.sh) may not exist. Never successfully ran. 13 sparse rows on the sheet.

11. **AGENDA GENERATOR CRON:** Running but errors every 60m. Bash script (generate-agenda.sh) may be broken.

12. **.ENV PROLIFERATION:** 12 .env files in repo root (counted: .env, .env.clean, .env.development, .env.fromcli, .env.full, .env.local, .env.prod, .env.prod2, .env.production, .env.telegram, .env.test, .env.vercel). .prod and .prod2 are both 2,077 bytes. git log shows none committed (clean history). 12 is too many; should consolidate to .env + .env.production.

13. **DOUBLE DEPLOYMENT:** Both level-up-playbook.vercel.app and luci-by-levelup.vercel.app deploy the same code. luci-by-levelup missing critical secret env vars (LU_CLIENT_SECRET, ANTHROPIC_API_KEY, etc.). Microsoft sign-in broken there.

14. **TOKEN SCOPE GAP:** Microsoft Graph OAuth token exists only in browser (delegated via sign-in). No server-side stored refresh token. If user closes browser or signs out, no cron can access mail/calendar/files. This is why mail scans run via Outlook COM bridge (Session 0 limitation).

15. **OUTLOOK COM BRIDGE:** Only works when an interactive desktop session exists. Cron runs in Session 0. Schtasks /IT bridge requires logged-in user. Mail scan crons have been running "successfully" but may be hitting errors silently.