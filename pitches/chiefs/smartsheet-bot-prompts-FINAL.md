# KC Chiefs Command Center - Final Bot Prompts (RFP-aligned)

Run in order. Wait for the bot to confirm success and report sheet/column IDs before sending the next prompt.

Real parameters pulled from the RFP (Owners_Rep_RFP_Ver4_Final):

- Budget: ~$265,000,000 hard and soft costs
- Delivery: Construction Manager at Risk with GMP
- Substantial Completion: Q4 2030
- Location: Olathe, Kansas
- Owner: Kansas City Chiefs Football Club (with Hunt Midwest)
- Owner's Rep team: Turner & Townsend (Prime) + Level Up (sub)
- Future expansion preserved for ~2040; concurrent Mixed-Use Master Plan and Olathe School District Stadium

FRAMING NOTE: committed, spent, and cash-flow actuals below are a representative mid-construction snapshot (as of ~Q3 2028) so the dashboard shows the tool populated and in use. The budget total, schedule targets, location, delivery method, and scope are real from the RFP. In the interview, present the live figures as "representative data showing how your command center operates during construction." If you'd rather show a true pre-design state (near-zero actuals), say so and I'll swap those values.

Account: Level Up Project Development (token provided separately)
Workspace ID: 180213104568196
Dashboard (Sight) ID: 2958782033618820

-----

## PROMPT 1 - Ground rules + create all sheets

You are working in the Smartsheet account for Level Up Project Development via the REST API at <https://api.smartsheet.com/2.0>. Authenticate every request with `Authorization: Bearer <TOKEN>`.

HARD RULES, do not deviate:

1. Do NOT call any dashboard widget endpoints. PUT /sights/{id}/widgets/{widgetId}, DELETE widget endpoints, and POST widget creation all return 500 and are unsupported. Widgets are added manually in the UI. If you are about to call a widget endpoint, stop.
1. All sheets go inside workspace 180213104568196 via POST /workspaces/180213104568196/sheets. Not Home, not any other folder.
1. After creating each sheet, record and report the sheetId and every columnId. Do not guess IDs later.
1. On any failure, show the full error response before retrying. Do not silently retry more than once.

Create these 13 sheets (creation only, no rows yet). Primary column noted.

1. "01 - Budget": Category (TEXT_NUMBER, primary) | Planned Amount (TEXT_NUMBER) | Committed Amount (TEXT_NUMBER) | Spent to Date (TEXT_NUMBER) | Percent Complete (TEXT_NUMBER) | Status (PICKLIST: Complete, On Track, Watch, At Risk, Not Started, Healthy)
1. "02 - Schedule": Milestone (TEXT_NUMBER, primary) | Baseline Date (DATE) | Target Date (DATE) | Variance (TEXT_NUMBER) | Status (PICKLIST: Complete, In Progress, Not Started, At Risk) | Owner (TEXT_NUMBER)
1. "03 - Action Items": Item (TEXT_NUMBER, primary) | Owner (TEXT_NUMBER) | Due Date (DATE) | Priority (PICKLIST: High, Medium, Low) | Status (PICKLIST: Complete, In Progress, Not Started, Blocked) | Notes (TEXT_NUMBER)
1. "04 - Project Snapshot": Metric (TEXT_NUMBER, primary) | Value (TEXT_NUMBER) | Notes (TEXT_NUMBER)
1. "05 - Cash Flow Curve": Quarter (TEXT_NUMBER, primary) | Planned Cumulative (TEXT_NUMBER) | Actual Cumulative (TEXT_NUMBER)
1. "06 - KPI Metrics": KPI (TEXT_NUMBER, primary) | Value (TEXT_NUMBER)
1. "07 - Procurement & Buyout": Package (TEXT_NUMBER, primary) | Scope (TEXT_NUMBER) | Budget Value (TEXT_NUMBER) | Target Award (TEXT_NUMBER) | Lead Time (TEXT_NUMBER) | Need-By (TEXT_NUMBER) | Status (PICKLIST: Long Lead - Track, Planning, Released, Awarded, Delivered, Not Started)
1. "08 - Upcoming Key Decisions": Decision (TEXT_NUMBER, primary) | Detail (TEXT_NUMBER) | Needed By (DATE) | Owner Action (TEXT_NUMBER) | Status (PICKLIST: Open, In Review, Decided)
1. "09 - 90-Day Look-Ahead": Activity (TEXT_NUMBER, primary) | Start (DATE) | Finish (DATE) | Owner (TEXT_NUMBER) | Status (PICKLIST: In Progress, Scheduled, Complete)
1. "10 - Risk Register": Risk (TEXT_NUMBER, primary) | Category (TEXT_NUMBER) | Rating (PICKLIST: High, Medium, Low) | Trend (PICKLIST: Up, Steady, Down) | Mitigation (TEXT_NUMBER)
1. "11 - Project Team": Name (TEXT_NUMBER, primary) | Role (TEXT_NUMBER) | Firm (TEXT_NUMBER) | Phase Focus (TEXT_NUMBER) | Allocation (TEXT_NUMBER)
1. "12 - Budget Position": Measure (TEXT_NUMBER, primary) | Amount (TEXT_NUMBER)
1. "13 - Health Scorecard": Category (TEXT_NUMBER, primary) | Status (PICKLIST: GREEN, YELLOW, RED) | Note (TEXT_NUMBER)

Output a table: sheet name, sheetId, each column title + columnId.

-----

## PROMPT 2 - Budget, Schedule, Snapshot

Use reported IDs. One batch POST /sheets/{sheetId}/rows per sheet, each row "toBottom": true. Dollars as plain numbers (28000000), percents as plain numbers (71), dates ISO. No format strings; if a format attempt errors, drop it.

### 01 - Budget (Category | Planned | Committed | Spent | Percent Complete | Status)

1. Design / Engineering | 28000000 | 27500000 | 20000000 | 71 | On Track
1. Structural | 42000000 | 41000000 | 18000000 | 43 | On Track
1. Architectural / Envelope | 38000000 | 37000000 | 6000000 | 16 | On Track
1. MEP | 34000000 | 34000000 | 9500000 | 28 | Watch
1. Site Work / Civil | 22000000 | 21000000 | 12000000 | 55 | On Track
1. Sports Turf & Field Systems | 9000000 | 3000000 | 0 | 0 | Not Started
1. Technology / AV / Security | 18000000 | 14000000 | 1200000 | 7 | Watch
1. FF&E / OS&E | 16000000 | 6000000 | 300000 | 2 | Not Started
1. Team Store, Food Service & Museum | 12000000 | 3000000 | 0 | 0 | Not Started
1. Permitting & Soft Costs | 9000000 | 8200000 | 5400000 | 60 | On Track
1. Site Acquisition | 19000000 | 19000000 | 19000000 | 100 | Complete
1. Contingency | 18000000 | 5500000 | 1500000 | 8 | Healthy

Verify Planned sums to 265000000; report it. (Committed sums to 219200000, Spent to 92900000.)

### 02 - Schedule (Milestone | Baseline Date | Target Date | Variance | Status | Owner)

Baseline = Target, Variance "0 days".

1. Owner's Rep Notice of Award | 2026-06-18 | 2026-06-18 | 0 days | Complete | Chiefs / Hunt Midwest
1. Program Validation Complete | 2026-09-30 | 2026-09-30 | 0 days | Complete | OR + Football Ops
1. AOR / Design Team Onboarded | 2026-11-13 | 2026-11-13 | 0 days | Complete | OR / Chiefs
1. Schematic Design Complete | 2027-04-30 | 2027-04-30 | 0 days | Complete | Design Team
1. Design Development Complete | 2027-09-30 | 2027-09-30 | 0 days | Complete | Design Team
1. GMP Established & Executed | 2028-01-29 | 2028-01-29 | 0 days | Complete | OR / CMAR
1. Construction Mobilization | 2028-03-15 | 2028-03-15 | 0 days | Complete | CMAR
1. Foundations Complete | 2028-09-15 | 2028-09-15 | 0 days | In Progress | CMAR
1. Structure Topped Out | 2029-04-30 | 2029-04-30 | 0 days | Not Started | CMAR
1. Building Dry-In | 2029-11-30 | 2029-11-30 | 0 days | Not Started | CMAR
1. Substantial Completion | 2030-10-15 | 2030-10-15 | 0 days | Not Started | CMAR / OR
1. Facility Operational | 2030-12-15 | 2030-12-15 | 0 days | Not Started | Chiefs

### 04 - Project Snapshot (Metric | Value | Notes)

1. Project Name | KC Chiefs Training Facility | Olathe, Kansas
1. Project Type | NFL Training & Performance Facility | Football ops, recovery, offices, Training Camp
1. Total Project Budget | $265,000,000 | Hard and soft costs
1. Delivery Method | CM at Risk (GMP) | Per RFP
1. Owner | Kansas City Chiefs Football Club | With Hunt Midwest
1. Owner's Representative | Turner & Townsend + Level Up | T&T Prime, Level Up sub
1. Target Substantial Completion | Q4 2030 | Per RFP
1. Future Expansion | Planned ~2040 | Preserve expansion zones and infrastructure
1. Campus Context | Mixed-Use Master Plan + Olathe School Dist. Stadium | Independent, coordinated
1. Delivery Priority | Football operations first | Secure, team-first environment
1. Owner-Procured Packages | Tech, security, FF&E, turf, team store, food service, museum | OR-coordinated
1. Current Snapshot | Representative construction view | Demo data, mid-construction
1. Schedule Status | On Track | Tracking to Q4 2030
1. Contingency | $18.0M held, $14.2M remaining | 6.8% of budget

Report row counts.

-----

## PROMPT 3 - Action Items, Cash Flow, KPIs

Same rules. One batch per sheet.

### 03 - Action Items (Item | Owner | Due Date | Priority | Status | Notes)

1. Resolve foundation rebar RFI #084 | Gary Berlin | 2028-09-12 | High | In Progress | Coordinate with SER and CM
1. Approve electrical switchgear submittal | Whitney Williams | 2028-09-05 | High | In Progress | Long-lead, protect Q4 delivery
1. Reconcile GMP allowance for site utilities | Greg Wieting | 2028-09-20 | High | In Progress | Vs civil final design
1. Finalize sports turf procurement strategy | Whitney Williams | 2028-10-03 | Medium | Not Started | Reverse-schedule from opening
1. Coordinate technology / DAS design-assist | Jacob Ortmann | 2028-09-25 | Medium | In Progress | With CM and AV vendor
1. Review structural steel erection sequence | Jordan Ward | 2028-09-18 | Medium | In Progress | Constructability input
1. Validate FF&E budget vs current pricing | Leslie Policar | 2028-10-01 | Medium | Not Started | Market escalation check
1. Confirm KC subcontractor coverage, MEP | Nick Seaton | 2028-09-22 | Medium | In Progress | Local market intelligence
1. Prepare Q3 monthly owner report | Jacob Ortmann | 2028-09-28 | Medium | In Progress | Exec dashboard plus narrative

### 05 - Cash Flow Curve (Quarter | Planned Cumulative | Actual Cumulative; millions, blank where noted)

1. Q3 2026 | 6 | 5.4
1. Q4 2026 | 14 | 12.8
1. Q1 2027 | 22 | 20.6
1. Q2 2027 | 30 | 28.4
1. Q3 2027 | 38 | 36.1
1. Q4 2027 | 47 | 44.8
1. Q1 2028 | 58 | 55.9
1. Q2 2028 | 74 | 71.2
1. Q3 2028 | 92 | 92.9
1. Q4 2028 | 112 | (blank)
1. Q1 2029 | 134 | (blank)
1. Q2 2029 | 156 | (blank)
1. Q3 2029 | 178 | (blank)
1. Q4 2029 | 199 | (blank)
1. Q1 2030 | 219 | (blank)
1. Q2 2030 | 237 | (blank)
1. Q3 2030 | 252 | (blank)
1. Q4 2030 | 265 | (blank)

### 06 - KPI Metrics (KPI | Value; text strings, do not convert)

1. Total Budget | $265.0M
1. Committed | $219.2M
1. Billed to Date | $92.9M
1. Percent Spent | 35%
1. Contingency Remaining | $14.2M
1. Substantial Completion | Q4 2030
1. Schedule Status | On Track
1. Open Action Items | 9

Report row counts.

-----

## PROMPT 4 - Procurement, Decisions, Look-Ahead, Risk

Same rules. One batch per sheet.

### 07 - Procurement & Buyout (Package | Scope | Budget Value | Target Award | Lead Time | Need-By | Status)

1. Structural Steel | Frame and misc metals | 28000000 | Q1 2028 | 28 wks | Q3 2028 | Awarded
1. Electrical Switchgear | Main gear and distribution | 5400000 | Q1 2028 | 40 wks | Q4 2028 | Awarded
1. Mechanical Equipment | AHUs, RTUs, chillers | 7800000 | Q1 2028 | 32 wks | Q3 2028 | Awarded
1. Standby Generators | Emergency power | 2400000 | Q1 2028 | 44 wks | Q1 2029 | Long Lead - Track
1. Curtain Wall / Glazing | Exterior envelope | 8200000 | Q2 2028 | 24 wks | Q1 2029 | Awarded
1. Sports Turf & Field Systems | Indoor and outdoor fields | 9000000 | Q3 2029 | 16 wks | Q1 2030 | Planning
1. Technology / AV / DAS | Comms, AV, converged network | 14000000 | Q4 2028 | 26 wks | Q3 2029 | Planning
1. Security / Access Control | Cameras, access, credentialing | 6500000 | Q1 2029 | 18 wks | Q3 2029 | Planning
1. FF&E / OS&E | Furniture, fixtures, equipment | 16000000 | Q1 2029 | 20 wks | Q2 2030 | Planning
1. Food Service / Cafe Equipment | Kitchen, dining, cafe | 5500000 | Q2 2029 | 18 wks | Q2 2030 | Not Started
1. Team Store & Retail Fixtures | Retail systems and graphics | 3500000 | Q3 2029 | 16 wks | Q3 2030 | Not Started
1. Museum & Experience Elements | Exhibits and experience | 4800000 | Q3 2029 | 22 wks | Q3 2030 | Not Started
1. Signage / Wayfinding / Graphics | Branding and wayfinding | 4200000 | Q2 2029 | 14 wks | Q2 2030 | Not Started
1. Medical / Training Equipment | Performance and recovery | 6000000 | Q1 2030 | 16 wks | Q3 2030 | Not Started

### 08 - Upcoming Key Decisions (Decision | Detail | Needed By | Owner Action | Status)

1. Approve FF&E standard and budget | Furniture, fixtures, equipment program | 2028-10-15 | Ownership | Open
1. Select sports turf system | Indoor and outdoor field surfaces | 2028-11-30 | Football ops + ownership | Open
1. Approve security / access control standard | Credentialing and zoning | 2028-11-15 | Ownership + security | Open
1. Approve museum / experience concept budget | Exhibits and fan experience | 2028-12-15 | Ownership | Open
1. Confirm team store retail program | Retail fit-out and systems | 2029-01-15 | Ownership | Open
1. Authorize contingency draw for site utilities | Civil scope reconciliation | 2028-10-01 | Finance | Open

### 09 - 90-Day Look-Ahead (Activity | Start | Finish | Owner | Status)

1. Complete foundation pours, Zone B | 2028-09-01 | 2028-10-15 | CMAR | In Progress
1. Begin structural steel erection | 2028-09-20 | 2028-12-20 | CMAR | Scheduled
1. Switchgear delivery and set | 2028-10-10 | 2028-10-25 | CMAR / Owner | Scheduled
1. Underground MEP rough-in | 2028-09-05 | 2028-11-10 | CMAR | In Progress
1. Technology / DAS design-assist workshops | 2028-09-15 | 2028-11-15 | OR + AV vendor | Scheduled
1. Issue FF&E procurement package | 2028-10-01 | 2028-10-20 | OR | Scheduled
1. Q3 owner report and budget review | 2028-09-25 | 2028-10-05 | OR | Scheduled
1. Sports turf vendor RFQ | 2028-10-15 | 2028-11-05 | OR | Scheduled

### 10 - Risk Register (Risk | Category | Rating | Trend | Mitigation)

1. Long-lead generator delivery | Schedule | High | Steady | Expedite, weekly vendor tracking, protect Q1 2029 need-by
1. Construction cost escalation | Budget | Medium | Down | GMP locked, escalation allowance holding
1. Technology / DAS integration complexity | Schedule | Medium | Steady | Early design-assist, dedicated coordination lane
1. FF&E and specialty package pricing | Budget | Medium | Up | Early procurement, market validation
1. KC labor capacity, MEP trades | Schedule | Medium | Steady | Subcontractor engagement, local outreach
1. Future 2040 expansion constraints | Scope | Low | Steady | Preserve expansion zones, monitor infrastructure decisions

Report row counts.

-----

## PROMPT 5 - Team, Budget Position, Health Scorecard

Same rules. One batch per sheet.

### 11 - Project Team (Name | Role | Firm | Phase Focus | Allocation)

1. David Bower, AIA | Principal-in-Charge | Turner & Townsend | Executive oversight, client leadership, design | 30% to 20%
1. Greg Wieting | Senior Project Manager | Level Up | Pre-development, CM procurement, GMP, budget | 50% to 20%
1. Whitney Williams | Project Manager (embedded) | Level Up | Day-to-day lead, primary owner/AOR/CM contact | 10% to 100%
1. Gary Berlin, RA | Project Manager (embedded) | Turner & Townsend | Owner-procured scopes, design coordination | 10% to 100%
1. Jacob Ortmann | Assistant Project Manager | Turner & Townsend | Document control, action items, reporting | 0% to 100%
1. Tom Harrison | Sports Practice Lead | Turner & Townsend | Senior executive oversight, T&T resources | 5%
1. Allison Baker | Regional Lead | Turner & Townsend | Final escalation, executive decisions | As needed
1. Leslie Policar | Estimator | Turner & Townsend | Cost benchmarking, VE, GMP support | 5% to 10%
1. Nick Seaton | KC Cost Estimator | Turner & Townsend | KC market cost validation, subcontractors | 0% to 10%
1. Jordan Ward | Field Advisor | Level Up | Constructability, quality, field review | 0% to 10%

### 12 - Budget Position (Measure | Amount)

1. Total Budget | 265000000
1. Committed / Bought Out | 219200000
1. Billed to Date | 92900000
1. Paid to Date | 83000000
1. Retainage Held | 9900000
1. Remaining to Spend | 172100000
1. Uncommitted Balance | 45800000

### 13 - Health Scorecard (Category | Status | Note)

1. Budget | GREEN | Within GMP, contingency at $14.2M
1. Schedule | GREEN | Tracking to Q4 2030 substantial completion
1. Procurement | YELLOW | Generators long-lead under active tracking
1. Risk | GREEN | Top risks identified with mitigation
1. Quality | GREEN | QA/QC program active with CM
1. Safety | GREEN | Zero lost-time incidents, active monitoring

Report row counts.

-----

## PROMPT 6 - Dashboard settings + verification

1. PUT /sights/2958782033618820 with body:

```json
{ "backgroundColor": "#0f0f1a", "columnCount": 6 }
```

If either property is rejected, report the exact error and stop. No widget endpoints as a workaround.

1. Verification, then a final summary:

- GET /workspaces/180213104568196 and confirm all 13 sheets exist inside it
- Confirm row counts: Budget 12, Schedule 12, Action Items 9, Snapshot 14, Cash Flow 18, KPI 8, Procurement 14, Decisions 6, Look-Ahead 8, Risk 6, Team 10, Budget Position 7, Scorecard 6
- Confirm Budget Planned sums to 265000000
- Confirm dashboard backgroundColor and columnCount took effect
- List permalinks for all 13 sheets and the dashboard

Do not print the API token anywhere in your output.

-----

## After the bot finishes: manual widget build

Widgets are UI-only. Full layout in kc-chiefs-dashboard-build-guide.md (Parts B/D/E). Priority widgets:

- Header band, span 4: "KC CHIEFS TRAINING FACILITY" / "Project Command Center | Turner & Townsend + Level Up". Optional subtitle: "A single source of truth that keeps priorities visible, decisions organized, and Chiefs leadership informed."
- Substantial Completion anchor, span 2, red #E31837 background: "SUBSTANTIAL COMPLETION / Q4 2030" (sheet 06).
- Project Health Scorecard, top-right: six status tiles from sheet 13. GREEN #1D9E75, YELLOW #EF9F27, RED #E24B4A.
- KPI strip: six metric cards from sheet 06.
- Charts: Budget by Category (column, red) from sheet 01; Cash Flow Curve (line, gold planned dashed + red actual, actual ends Q3 2028) from sheet 05.
- Grids (conditional-format the sheet first so color carries into the widget): Schedule (02), Action Items (03), Procurement with long-lead row red (07), Upcoming Key Decisions (08), 90-Day Look-Ahead (09), Risk Register (10), Project Team (11), Project Snapshot (04).
- Budget position: stacked bar from sheet 12 (Paid #E31837, Remaining #FFB81C, Uncommitted #8A8AA3) plus Paid / Retainage / Remaining metric cards.
- Document Shortcuts row, gold links: Executive Schedule, OAC Minutes, Monthly Reports, Drawings, Budget Tracker, Pay Apps, Renderings, Procurement Log, Site Photos.
- Live jobsite camera: placeholder tile "Live jobsite camera - activates at groundbreaking."

All widget backgrounds #1A1A2E. Present from full-screen view mode, never edit mode.
