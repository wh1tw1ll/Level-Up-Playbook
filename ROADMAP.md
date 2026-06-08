# Level Up Platform Roadmap

**Owner:** Whitney Williams
**Platform:** L.U.N.A. (Level Up Navigator & Advisor)
**Repo:** github.com/wh1tw1ll/Level-Up-Playbook
**Live:** level-up-playbook.vercel.app

---

## Philosophy

The platform is not a document repository. It is the operating system for Level Up Project Development — the institutional brain that makes every project better than the last. Every feature should either (a) save time, (b) reduce risk, (c) surface money, or (d) build trust with clients. If it doesn't do at least one of those, it doesn't ship.

---

## Phase 1: Foundation (Current)

| Capability | Status | Notes |
|---|---|---|
| L.U.N.A. search (hero page) | Live | KB search, API-backed Q&A, cache, excerpt highlighting |
| Playbook (44 sections) | Live | Phase filter, topic filter, expand/collapse groups |
| Templates (10) | Live | Categories, preview/download |
| Phase Reading Guide (7 phases) | Live | Data-driven from PHASE_GUIDE |
| Decision Tree (What Do I Do?) | Live | 8 root options, deep paths |
| Projects view | Live | MFP with real financials, Sixers, DOVA |
| MFP detail view | Live | Financials table, issues, punch list, stakeholders |
| Action Items | Basic | Add/remove/toggle, team/personal tabs |
| Chat drawer | Live | API-backed, quick links |
| Theme toggle | Live | Light/dark with persistence |
| Responsive design | Live | Mobile-aware |
| Auth (Microsoft) | Deployed | Sign-in button, cookie session |

**Known gaps being addressed:**
- Procore API access — waiting on developer verification approval
- MFP email/SharePoint — blocked by MFA; Outlook Desktop setup pending user MFA approval on HermesLU
- .eml file support — gateway changes need correct source path identified

---

## Phase 2: Live Project Command Center (Next)

### 2.1 Procore Data Pipeline
- [ ] OAuth2 flow (once developer account approved)
- [ ] Weekly cron job: sync commitments, COs, punch items, RFIs, submittals
- [ ] Local cache with version tracking (what changed since last sync)
- [ ] Budget vs. actual dashboard with trending

### 2.2 Email Ingestion
- [ ] Outlook Desktop COM connection (once profile exists)
- [ ] Automated scanning for: payment applications, change orders, meeting notices, RFI responses
- [ ] Tagging and linking emails to projects
- [ ] Action item extraction from email threads

### 2.3 Calendar Integration
- [ ] Sync Level Up corporate calendar (Graph API)
- [ ] Meeting reminders with prep materials
- [ ] Automated post-meeting action item creation

### 2.4 Project Expansion
- [ ] Sixers Arena project page (mirror MFP structure)
- [ ] DOVA Sacramento project page
- [ ] Cross-project dashboard (all projects, all statuses, one view)
- [ ] Project creation wizard (new project setup checklist)

### 2.5 Proactive Intelligence (Cron-Driven)
- [ ] Daily briefing: what changed in Procore, what emails arrived, what's due
- [ ] Escalation alerts: pending approvals > 7 days, budget moves > 5%, unpaid invoices aging
- [ ] Milestone proximity warnings: "Draw package due in 3 days"
- [ ] Pattern alerts: "Miller Electric COs have been pending 14+ days"

---

## Phase 3: Institutional Memory & Pattern Recognition

### 3.1 Cross-Project Knowledge Base
- [ ] Tag projects to playbook sections (e.g., "Section 16: Change Management" linked to MFP CO history)
- [ ] Lessons-learned capture per project phase
- [ ] "This happened before" matching engine

### 3.2 Cost Reference Database
- [ ] Unit costs from actual projects (per SF, per seat, by trade)
- [ ] VE savings realized by category
- [ ] Contingency burn rate by project type

### 3.3 Vendor/Subcontractor Performance
- [ ] Scorecards by trade across projects
- [ ] Punch list density per subcontractor
- [ ] CO frequency and approval rate

---

## Phase 4: Client Portal

### 4.1 Client-Facing Views
- [ ] Read-only project dashboard per client
- [ ] Automated monthly report (PDF generation from live data)
- [ ] Issue tracking visible to client
- [ ] Document sharing with controlled access

### 4.2 Business Development
- [ ] Pitch deck generator (populate from project data)
- [ ] Level Up capability showcase (past projects, metrics, team)
- [ ] Fee proposal template with historical reference

---

## Phase 5: Mobile & Field

### 5.1 Field Operations
- [ ] Photo-to-punch-list (Jordan Ward in the field)
- [ ] Voice queries to LUNA
- [ ] Quick lookup: scope, budget, responsible party
- [ ] Offline-capable daily reports

### 5.2 Mobile Platform
- [ ] Progressive Web App (PWA) — installable, offline-cached
- [ ] Push notifications for alerts (draw packages, approvals, meetings)
- [ ] Quick camera capture for field observations

---

## Priority Ranking (What to Build First)

1. **Procore live sync** — unlocks real financial intelligence (blocked on API approval)
2. **Email integration** — unlocks proactive alerts (blocked on Outlook profile setup)
3. **Sixers/other project pages** — extends command center to all active work
4. **Action item auto-follow-up** — turns the current basic tab into a work management system
5. **Daily briefing cron** — first taste of proactive intelligence
6. **Client dashboard** — turns platform into revenue differentiator
7. **Cross-project pattern matching** — the real institutional brain

---

## Technical Principles

- **No fabricated data.** Every number on screen comes from a verified source.
- **AI is invisible to clients.** No bots, no automated client-facing messages.
- **Excel-native logs.** LUNA reads/writes Excel, does not replace it.
- **Permissions-first.** Only access data the user has permission to access.
- **Practical over perfect.** Ship working features; iterate on polish.
- **Commas in financials.** $530,448,817, not 530448817.

---

*This roadmap is living. Priorities shift with client needs and project phases. Revisit quarterly.*