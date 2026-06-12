# LUCI — Level Up Central Intelligence
## Complete Platform Specification

---

## 1. IDENTITY & BRAND

**Name:** LUCI (Level Up Central Intelligence)
**Tagline:** "Project Intelligence, In Your Pocket"
**Backend Engine:** LUNA (Level Up Network Agent) — runs on Hermes Agent framework
**Frontend Brand:** LUCI — what the user sees and interacts with

LUCI is not a dashboard. It is not a document repository. It is a **project intelligence operating system** — the single source of truth for everything happening across every Level Up project. It replaces the daily briefing email, the shared drive of spreadsheets, the Slack threads asking "what's the status on X," and the mental burden of tracking 50+ open items across multiple stakeholders.

### Visual Identity
- Color system: Deep charcoal backgrounds (#0e1419), cream/ink text, LUNA green (#8BED1C) as accent
- Dark mode by default, light mode toggle
- Logo: LUCI lockup (horizontal + square), LUNA face icon
- Typography: DM Sans (UI), DM Mono (data/code)
- Design principle: **Information density without clutter** — every pixel earns its place

### Tone
- Professional but direct
- Zero corporate fluff
- Data-forward: numbers, dates, names, decisions
- Trustworthy: always labels assumptions vs. facts

---

## 2. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────┐
│                  LUCI FRONTEND                   │
│  Single-page app · Vanilla JS · No framework    │
│  Deployed on Vercel · Static-first              │
├─────────────────────────────────────────────────┤
│  LUNA CHAT  │  PLAYBOOK  │  BRIEFING  │  MFP    │
│  (ask anything) │ (kb)  │ (side panel) │(project)│
├─────────────────────────────────────────────────┤
│              INTEGRATION LAYER                   │
├─────────┬──────────┬──────────┬─────────────────┤
│Outlook  │ Procore  │  Local   │   File System   │
│(Graph)  │ (API)    │(COM)     │   (PDFs/data)   │
├─────────┴──────────┴──────────┴─────────────────┤
│                 LUNA BACKEND                     │
│  Hermes Agent · Cron jobs · Memory · Skills     │
│  Runs locally on Whitney's Windows machine       │
└─────────────────────────────────────────────────┘
```

---

## 3. CORE VIEWS

### 3.1 HOME / LUCI LAUNCH
The landing page. Not a dashboard — a **command center**.

**Elements:**
- **LUCI lockup** (animated wordmark, not static)
- **Hero search bar** — dominant, centered. "Ask anything about your projects, contracts, budget, schedule..."
- **Quick action chips** — 8 contextual buttons below search based on what matters RIGHT NOW (urgent items, upcoming deadlines, etc.)
- **Briefing card** — Greeting + date, then a compact snapshot of critical items (replaces the old full briefing)
- **Clippy character** — bottom-right, peeking in, with contextual suggestions
- **Recent searches** — last 5 searches, clickable to re-run
- **Footer strip** — auth status, last sync time, data freshness

### 3.2 PLAYBOOK (knowledge base)
The institutional brain. Everything Level Up knows about project development.

**Layout:**
- Left sidebar: Phase filters, topic filters, search
- Main content: Expandable section cards with searchable content
- Sub-views: Sections, Templates, Phase Reading Guide, Decision Tree

**Features:**
- Full-text search across all sections, topics, and content
- Phase-based filtering (Pre-Construction through Closeout)
- Topic tagging and filtering
- Collapsible sections with remember-state
- Decision tree: "What do I do?" — walks through project situation to recommended action
- Templates: Downloadable/printable templates for every project document
- Contract knowledge base: AI-extracted terms from every subcontract (LD rates, warranty, scope, payment terms, insurance)

### 3.3 BRIEFING SIDE PANEL
The daily operational nerve center. Slides out from the right.

**Three tabs:**
1. **Actions** — All open action items, flagged emails, urgent items. Checkboxes to cycle through Open → In Progress → Complete.
2. **Meetings** — Today's and upcoming meetings from Outlook calendar. Shows prep items, past meeting minutes, action item follow-ups.
3. **Reminders** — Recurring deadlines: draw packages, expense reports, weekly calendar, CO audits.

**Behavior:**
- Opens from "Action Items" nav tab, reminder toggle button (bottom-left), or keyboard shortcut
- Auto-refreshes every 30 seconds while open
- Badge count on toggle button shows open items
- Stays open across navigation — persistent
- Can be pinned open in wide window mode
- Keyboard shortcut: `A` key opens actions tab, `M` opens meetings, `R` opens reminders

### 3.4 PROJECT VIEW (MFP Stadium)
Dedicated project intelligence page for each active project.

**Sections:**
- **Financial Pulse** — Budget vs. actual, paid to date, retainage, past due, approved COs, pending COs
- **Contract Dashboard** — All 53+ subcontracts with amounts, status, executed date, LD rates, warranty period
- **Punch List** — Live punch items with status, days open, responsible party
- **Schedule** — Key milestones, baseline vs. actual, critical path risks
- **Change Order Tracker** — All PCOs, TCOs, approved/pending/denied
- **Cost Recovery** — Active recovery items, potential savings, forensic audit findings
- **Documents** — Quick access to key contracts, drawings, specs
- **Team** — Project directory with roles and contact info

### 3.5 LUNA CHAT (drawer)
AI chat that knows everything the playbook knows.

**Behavior:**
- Opens from Clippy icon, drag handle, or keyboard shortcut (`Cmd+K` / `Ctrl+K`)
- Three sizes: small (chat bubble), medium (drawer), full (overlay)
- **Context-aware**: When playbook section is open, chat knows which section you're viewing
- **Memory**: Remembers recent conversations within session
- **Source citations**: Every answer links to the playbook section, contract clause, or data source
- **Follow-up suggestions**: After answering, suggests 3 related questions
- **Conversation branching**: Can go back to earlier responses and branch
- **Voice input** (future): Dictate questions on mobile

---

## 4. NEW FEATURES & TOGGLES

### 4.1 SITE-WIDE TOGGLE BAR (Top-Right)
A compact settings bar with quick toggles:

| Toggle | Default | Description |
|--------|---------|-------------|
| 🌙 Theme | Dark | Dark/Light mode |
| 🔔 Notifications | On | Browser notification for urgent items |
| 📊 Data freshness | Live | "Live" vs "Cached" — toggle real-time API calls |
| 🔄 Auto-refresh | 30s | Dropdown: Off / 15s / 30s / 60s / 5min |
| 📋 Compact mode | Off | Tighter spacing, more info per screen |
| 🔍 Expert mode | Off | Shows raw data, contract clauses, API responses |
| 🎯 Focus mode | Off | Hides everything except current task |
| 📌 Pin panel | Off | Keep side panel open always |

### 4.2 CLIPPY INTELLIGENCE ICON
Not a paperclip. Not a gimmick. A **genuinely useful AI assistant that anticipates needs**.

**Appearance:**
- Animated SVG face (LUNA logo mark — the green hexagonal shape with a subtle face)
- Sits in bottom-right corner, slightly overlapping the content
- On hover: Expands to show a compact suggestion card
- On idle (no interaction for 2+ minutes): Gently pulses or does a subtle "peek" animation
- Has "eyes" that follow mouse movement subtly (parallax)

**Behavior Modes:**

| Mode | Trigger | Shows |
|------|---------|-------|
| **Idle** | No activity 2+ min | "You have 3 overdue action items" or "Next meeting in 15 min" |
| **Context** | User viewing a section | "I see you're looking at contract terms. Want me to flag any that have unusual LD rates?" |
| **Proactive** | New data arrives | "New flagged email from Graham about cost recovery" |
| **Suggestion** | User pauses typing | "Need help drafting that email?" or "Should I check if any subs are past due?" |
| **Error** | Something fails | Data not loading — clicks to investigate |

**Click Actions:**
- Single click: Opens LUNA chat with contextual prompt
- Double click: Opens full chat overlay
- Drag: Reposition anywhere on screen (position remembered)
- Right-click: Quick menu (Briefing, New Action Item, What's New, Settings)

**Suggestion Cards:**
Pop up above Clippy with auto-dismiss (15s). Examples:
- "📧 3 flagged emails need attention"
- "💰 Draw package due tomorrow"
- "📅 OAC meeting in 1 hour — prep?"
- "🔍 Cost recovery audit found $200K in potential savings"
- "⚠️ Qualico pending COs exceed $1.5M — review?"
- "🏗️ Site visit log needs sign-off from Friday"

### 4.3 DASHBOARD WIDGET SYSTEM
Users can customize their home view with draggable, resizable widgets.

**Available Widgets:**
1. **Financial Pulse** — Budget % spent, burn rate, forecast
2. **Action Items** — Open/high-priority items
3. **Upcoming Meetings** — Next 5 with prep countdown
4. **Weather** — Jobsite weather (next 5 days)
5. **Schedule Critical Path** — Next 3 critical milestones
6. **Change Order Heat Map** — Subs with most pending COs
7. **Risk Register** — Top 5 active risks
8. **Flagged Email Stream** — Latest flagged emails as scrollable feed
9. **Punch List Countdown** — Open vs. closed, aging items
10. **Contract Expiry Watch** — Warranty periods, insurance expirations
11. **Cost Recovery Progress** — Tracked savings vs. target
12. **Site Photo Feed** — Latest photos from Procore
13. **Team Availability** — Who's in office/field/out today

**Widget Controls:**
- Drag to reorder
- Resize (3 widths: 1/3, 2/3, full)
- Collapse to title bar only
- Remove from view
- Settings gear per widget (data source, refresh rate, display options)

### 4.4 COMMAND PALETTE (`Cmd+K` / `Ctrl+K`)
Everything is searchable. Press `Cmd+K` and start typing.

**Searchable:**
- Any playbook section or topic
- Any contract or subcontract
- Any person on the project
- Any action item
- Any meeting (past or upcoming)
- Any template
- Any command: "Create action item", "Open briefing", "Refresh data", "New flagged email"
- Any keyboard shortcut

**Results categorized:**
- 🔍 Playbook sections
- 📄 Contracts
- 👤 People
- ✅ Actions
- 📅 Meetings
- ⚡ Commands
- 🔗 Shortcuts

### 4.5 ALERT CENTER
Bell icon in top bar. Collects all notifications in one place.

**Alert Types:**
- **Urgent** (red): Past due items, budget overruns, missed deadlines
- **Warning** (yellow): Approaching deadlines, pending approvals, expiring insurance
- **Info** (blue): New data synced, meetings starting soon, new flagged emails
- **Success** (green): Items completed, milestones reached, recovery savings captured

**Alert Sources:**
- Procore sync (new COs, schedule changes)
- Outlook (flagged emails, meeting reminders)
- Local scripts (punch list updates, inspection results)
- LUNA analysis (cost recovery findings, risk identification)
- System (sync failures, auth expiry)

**Behavior:**
- Pills show unread count
- Click opens scrollable feed with mark-read
- Can snooze or dismiss individual alerts
- Clicking an alert takes you to the relevant view
- Alerts persist across sessions until dismissed

### 4.6 KEYBOARD SHORTCUTS (Full Cheatsheet)

| Shortcut | Action |
|----------|--------|
| `?` | Show keyboard help overlay |
| `Cmd+K` / `Ctrl+K` | Command palette |
| `A` | Open actions panel |
| `M` | Open meetings panel |
| `R` | Open reminders panel |
| `Esc` | Close panel / modal |
| `Cmd+Enter` | Send chat message |
| `Cmd+F` | Search playbook |
| `Cmd+1-4` | Switch views (LUNA/Playbook/Projects/Actions) |
| `Cmd+ArrowUp` | Toggle theme |
| `Cmd+Shift+R` | Refresh all data |
| `Cmd+.` | Toggle compact mode |
| `Cmd+Shift+F` | Toggle focus mode |
| `Cmd+Shift+P` | Pin/unpin side panel |
| `/` | Quick search (when not in input field) |
| `Cmd+Up/Down` | Scroll between sections |

### 4.7 DATA FRESHNESS INDICATOR
Every data display shows its age and source.

**Format:** "🟢 Live · 2 min ago" or "🟡 Cached · 3 hours ago" or "🔴 Stale · 2 days ago"

**Data Sources Labeled:**
- "📊 Procore API"
- "📧 Outlook Graph"
- "💻 Local sync"
- "📁 Static file"
- "🧠 LUNA analysis"

### 4.8 MULTI-PROJECT VIEW
Toggle between projects without losing context.

**Currently:** Miami Freedom Park (active)
**Coming:** Chase Stadium, Mercedes-Benz Stadium ops, Miller Electric Center, Porsche HQ, Atlanta Connector Park

**Behavior:**
- Project selector in top bar
- Each project has its own data, contracts, team, schedule
- Playbook is shared across all projects (institutional knowledge)
- Briefing panel aggregates across projects or filters to one
- Action items can be tagged per project
- Widgets can show cross-project rollups

### 4.9 EXPORT / SHARE
Every view should be shareable.

**Export options:**
- 📄 PDF (formatted report)
- 📊 CSV (data tables)
- 📋 Clipboard (text summary)
- 🔗 Share link (deep link to specific section/item)
- 📧 Email (send as formatted summary)

**Share targets:**
- Copy link to clipboard
- Email to stakeholder
- Download as report

### 4.10 MOBILE RESPONSIVE
Full functionality on phone.

**Breakpoints:**
- Desktop (1200px+): Full layout with pin-able side panel
- Tablet (768-1199px): Side panel overlays, widgets reflow to 2-col
- Phone (<768px): Single column, bottom sheet navigation, chat takes full screen

**Phone-specific:**
- Bottom nav bar instead of top tabs
- Swipe gestures (swipe right for panel, left for chat)
- Pull-to-refresh data
- Touch-friendly checkboxes and buttons (44px minimum)
- LUNA chat as full-screen with keyboard-aware input
- Clippy as floating action button (FAB)

---

## 5. DATA ARCHITECTURE

### 5.1 STATIC DATA (shipped with app)
- `data/kb.js` — Playbook knowledge base (~120 sections)
- `data/contracts_kb.js` — AI-extracted contract terms
- `data/mfp_financials.js` — Project financial data with live Procore sync
- `data/mfp_context.js` — Project overview, team, milestones
- `data/contracts_master.js` — Master list of all 53 subcontracts
- `data/contract_terms.js` — Full extracted terms for 10+ major subs
- `data/templates.js` — Document templates
- `data/checklist.json` — LUNA-generated action item checklist

### 5.2 LIVE DATA (API calls)
- `/api/outlook/flagged` — Flagged emails from Graph API + local sync
- `/api/outlook/calendar` — Upcoming meetings from Graph API
- `/api/outlook/action-items` — AI-extracted action items from emails
- `/api/chat` — LUNA chat endpoint (DeepSeek + contract context)
- `/api/procore/data` — Live Procore commitments data
- `/api/sync/flagged-store` — MFP flagged email store

### 5.3 LOCAL DATA (browser storage)
- `lu_actions_team` / `lu_actions_personal` — Action items
- `lu_theme` — Theme preference
- `lu_session` — Auth session
- `lu_auth` / `lu_auth_mfp` — OAuth refresh tokens (HttpOnly)
- `lu_remind_dismiss` — Dismissed reminders
- `lu_brief_dismiss` — Dismissed briefing cards
- `lu_return_view` — Post-auth return view
- `lu_reminder_panel_last` — Last panel open timestamp
- `collapsedGroups` — Playbook collapsed sections
- Widget layout preferences (future)

### 5.4 SYNCED DATA (Hermes cron jobs)
- Weekly Procore snapshot → `data/mfp_financials.js`
- Daily flagged email sync (Outlook COM) → `/api/sync/flagged-store`
- Weekly cost recovery audit → CO watchdog data
- Contract term extraction (PDF → JS files)

---

## 6. USER FLOWS

### 6.1 Morning Check-In
1. Open LUCI → Greeted by name, date, weather
2. Briefing card shows: 3 urgent items, next meeting in 45 min
3. Clippy suggests: "3 flagged emails need attention"
4. Click Clippy → Chat opens: "Summarize my flagged emails"
5. LUNA returns: "3 emails — Graham requesting cost recovery docs (urgent), Baker change order approval (high), Qualico RFI response (medium)"
6. Click "Actions" tab in side panel → Items are listed with priorities
7. Click checkbox on Baker CO → Mark in progress
8. Click reminder for draw package → Opens checklist
9. Done. 90 seconds. No emails opened.

### 6.2 Contract Research
1. Open LUCI → Click Playbook → Search "liquidated damages"
2. Results show 5 sections, 12 contracts with LD data
3. Click contract → Full terms: $30K/day LD, 10% cap, 14-day grace
4. Clippy suggests: "Want me to compare LD rates across all subs?"
5. Click → LUNA returns comparison table sorted by LD rate
6. Click "Baker Concrete" → Opens full contract summary with all provisions
7. Done. 30 seconds. No PDFs opened.

### 6.3 Change Order Review
1. Open MFP project view → CO Tracker widget
2. Sees: 12 pending COs totaling $2.1M
3. Clippy: "3 COs flagged as high risk — review before today's OAC"
4. Click highest-risk CO → Shows: original amount, revised, scope change justification
5. LUNA analysis: "This CO increases concrete quantities by 18% above bid — recommend challenging unit prices"
6. Click "Create action item" → Pre-fills: "Challenge Qualico CO-042 unit prices"
7. Add due date: today
8. Done. 45 seconds. No spreadsheets.

### 6.4 Weekly Report Generation
1. Open LUCI → Press `Cmd+K` → Type "weekly report"
2. Select "Generate Weekly Report"
3. LUNA auto-collects: financial snapshot, schedule updates, open/closed action items, CO activity, punch list progress, flagged communications
4. Preview report → Clippy: "Looks good. Notable: 3 items missing owner decisions"
5. Click "Export PDF" → Downloads formatted report
6. Click "Email to stakeholders" → Opens Outlook draft with report embedded
7. Done. 2 minutes. Was a 4-hour task.

---

## 7. TECHNICAL REQUIREMENTS

### 7.1 Frontend
- Vanilla JS (no React/Vue/Angular — keeps deployment simple)
- Single-page app with hash-based routing
- CSS custom properties for theming
- No build step needed — HTML/CSS/JS deployed directly
- Total JS bundle < 500KB (currently ~200KB)
- Lighthouse score target: 95+ Performance, 100 Accessibility

### 7.2 Backend (Vercel Serverless)
- Node.js serverless functions
- API routes for: auth, chat, outlook, procore, sync, check-auth
- Cookie-based auth (HttpOnly + Secure)
- Max 12 serverless functions (Vercel Hobby limit)
- 15-second function timeout max

### 7.3 Integrations
- **Microsoft Graph API**: Calendar, Mail, User info (OAuth 2.0)
- **Procore API**: Commitments, documents, projects (OAuth 2.0)
- **Outlook COM** (local): Flagged emails via pywin32 (bypasses cross-tenant Graph limits)
- **Hermes Agent**: Cron jobs, session management, skills, memory

### 7.4 Security
- Password gate on site load (single shared team password)
- Microsoft OAuth for individual user auth
- Procore OAuth for project data
- HttpOnly cookies for refresh tokens
- CSRF protection on state-changing endpoints
- No sensitive data in URL parameters

---

## 8. IMPLEMENTATION PRIORITIES

### Phase 1 (Current — DONE)
- [x] Playbook knowledge base with search
- [x] Contract extraction and search
- [x] Financial dashboards (MFP)
- [x] Action items (local storage)
- [x] Auth (password gate + Microsoft OAuth)
- [x] Briefing side panel (Actions, Meetings, Reminders)
- [x] Clippy icon
- [x] LUNA chat (basic)
- [x] Dark/light theme
- [x] Procore data sync (manual)
- [x] Check-auth endpoint (fixes refresh persistence)

### Phase 2 (Next — IN PROGRESS)
- [ ] Clippy proactive suggestions
- [ ] Command palette (`Cmd+K`)
- [ ] Compact mode toggle
- [ ] Focus mode toggle
- [ ] Auto-refresh with configurable interval
- [ ] Data freshness indicators
- [ ] Flagged email stream in side panel
- [ ] Keyboard shortcuts cheatsheet
- [ ] Meeting prep view (auto-generated from calendar + action items)
- [ ] Widget system (draggable home view cards)

### Phase 3 (Medium-term)
- [ ] Multi-project support
- [ ] Mobile responsive layout
- [ ] Export/Share (PDF, CSV, link)
- [ ] Alert center (bell icon with notification feed)
- [ ] Voice input for LUNA chat
- [ ] Weekly report auto-generation
- [ ] Clippy drag-to-reposition
- [ ] Weather widget
- [ ] Site photo feed widget
- [ ] Touch gestures for mobile

### Phase 4 (Long-term)
- [ ] Real-time Procore webhook sync
- [ ] Team presence/availability
- [ ] Document preview (PDF inline viewer)
- [ ] Collaborative annotations on documents
- [ ] Automated decision log from meeting minutes
- [ ] AI-generated weekly narratives
- [ ] Predictive budget forecasting
- [ ] Subcontractor performance scoring
- [ ] Integration with Smartsheet / SharePoint
- [ ] Mobile app (PWA with offline support)

---

## 9. DESIGN PRINCIPLES

1. **One-click to information**: Every piece of data is reachable in at most 2 clicks or 1 search
2. **Proactive, not reactive**: Show things before the user asks
3. **Trust but verify**: Always label data source and freshness
4. **Progressive disclosure**: Start compact, reveal detail on demand
5. **Zero empty states**: Every screen has something useful, even if it's "No data yet — here's what to do"
6. **Keyboard first**: Every action has a shortcut
7. **Mobile matters**: 40% of usage will be on phone
8. **Dark by default**: Construction professionals work early mornings and late nights
9. **Accessible**: WCAG 2.1 AA minimum
10. **Fast**: Every interaction under 100ms (perceived), data loads under 2s

---

## 10. MEASUREMENT & SUCCESS CRITERIA

- **Time-to-insight**: How many seconds from opening LUCI to finding a specific contract clause? Target: <10s
- **Morning check-in duration**: Time from open to fully caught up. Target: <2 min
- **Action item closure rate**: % of items closed within due date. Target: >85%
- **Meeting prep time**: Time to prepare for OAC. Target: <5 min
- **Weekly report generation**: Target: <3 min (was 2-4 hours)
- **User retention**: Opens daily, multiple times per day
- **Data freshness**: Never more than 1 hour stale for critical data
- **Search success rate**: First search finds what they need >90% of the time
