# KC Chiefs Command Center - Dashboard Build Guide (manual UI)

Companion to smartsheet-bot-prompts-FINAL.md. The bot creates and fills the 13 sheets. Widgets cannot be placed via API (PUT/POST/DELETE on /sights/{id}/widgets return 500), so this whole guide is manual in the Smartsheet UI: open the dashboard (Sight 2958782033618820) > Edit.

Data this matches: $265M budget, Q4 2030 Substantial Completion, Olathe KS, CMAR/GMP, Turner & Townsend (Prime) + Level Up. Live figures are a representative ~Q3 2028 construction snapshot.

## Color + style system (use everywhere)

- Dashboard background: #0F0F1A (set by the bot in Prompt 6)
- Widget card background: #1A1A2E (every widget, no exceptions, or the dark theme breaks)
- Chiefs red (primary data): #E31837
- Chiefs gold (secondary data / accents / links): #FFB81C
- Neutral gray (minor categories): #8A8AA3
- Status: GREEN #1D9E75, YELLOW #EF9F27, RED #E24B4A
- Text: white titles, light gray #D0D0E0 body
- Grid: 6 columns wide. Build top to bottom. Keep rows flush.

For every widget: settings > Background Color > custom #1A1A2E, title text white.

-----

## ROW 1 - Header band

Widget A: TITLE / Rich Text, span 4 columns

- Line 1: "KC CHIEFS TRAINING FACILITY" (white, bold, largest)
- Line 2: "Project Command Center  |  Turner & Townsend + Level Up" (gold #FFB81C, smaller)
- Optional line 3 (small, gray): "A single source of truth that keeps priorities visible, decisions organized, and Chiefs leadership informed."

Widget B: METRIC, span 2 columns, background #E31837 (the one red tile, the page anchor)

- Source: 06 - KPI Metrics > "Substantial Completion" > Value
- Title: "SUBSTANTIAL COMPLETION", value "Q4 2030", white text

-----

## ROW 2 - KPI strip (six 1-column metric widgets)

All six: METRIC widget, source 06 - KPI Metrics, pick the Value cell. Background #1A1A2E, label gray, value white. Exceptions noted.

1. "TOTAL BUDGET" -> $265.0M
1. "COMMITTED" -> $219.2M
1. "BILLED TO DATE" -> $92.9M
1. "PERCENT SPENT" -> 35% (value color #FFB81C)
1. "CONTINGENCY" -> $14.2M
1. "SCHEDULE" -> On Track (value color green #1D9E75)

-----

## ROW 3 - Health Scorecard + charts

Widget C: PROJECT HEALTH SCORECARD, span 2 columns (top-right priority element)

- Source: 13 - Health Scorecard, six rows
- Build as a 2x3 grid of status tiles or a small grid. Each tile shows Category + a colored dot/fill from Status: GREEN #1D9E75, YELLOW #EF9F27, RED #E24B4A.
- Budget GREEN, Schedule GREEN, Procurement YELLOW, Risk GREEN, Quality GREEN, Safety GREEN.
- This is the most recognizable element from the proposal's page-19 mockup. Keep it high and right.

Widget D: CHART, span 2 columns. Title "Budget by Category ($M)"

- Source: 01 - Budget, columns Category + Planned Amount, all 12 rows
- Type: Column. Series color #E31837. Legend off, value labels off, axis text light gray if available.

Widget E: CHART, span 2 columns. Title "Cash Flow Curve (Cumulative $M)"

- Source: 05 - Cash Flow Curve, columns Quarter + Planned Cumulative + Actual Cumulative, all 18 rows
- Type: Line, smooth if available
- Planned series: #FFB81C, dashed if available. Actual series: #E31837, solid.
- Legend on (two series). The actual line stopping at Q3 2028 against the full planned curve is the money shot: reads instantly as a live, tracked project.

-----

## ROW 4 - Working grids

For grid widgets, conditional-format the underlying SHEET first; grid widgets inherit sheet formatting, so this is how color gets into the grid.

Widget F: GRID/REPORT, span 3 columns. Title "Milestone Schedule"

- Source: 02 - Schedule, columns Milestone, Target Date, Variance, Status
- Sheet conditional format: Status In Progress = gold #FFB81C fill, Complete = green, At Risk = red.

Widget G: GRID/REPORT, span 3 columns. Title "Action Items"

- Source: 03 - Action Items, columns Item, Owner, Due Date, Priority
- Sheet conditional format: Priority High = red fill/text, Medium = gold.

-----

## ROW 5 - Procurement + decisions

Widget H: GRID/REPORT, span 4 columns. Title "Procurement & Long-Lead Buyout"

- Source: 07 - Procurement & Buyout, columns Package, Budget Value, Need-By, Status
- Sheet conditional format: Status "Long Lead - Track" = red. The generator row in red proves you are managing the top schedule risk in front of the client.

Widget I: GRID/REPORT, span 2 columns. Title "Upcoming Key Decisions"

- Source: 08 - Upcoming Key Decisions, columns Decision, Needed By, Status
- Most owner-pleasing widget on the page. Title it exactly "Upcoming Key Decisions" to match the proposal language.

-----

## ROW 6 - Look-ahead + risk

Widget J: GRID/REPORT, span 3 columns. Title "Next 90 Days"

- Source: 09 - 90-Day Look-Ahead, columns Activity, Start, Finish, Owner
- Sheet conditional format: In Progress rows gold.

Widget K: GRID/REPORT, span 3 columns. Title "Top Risks & Mitigation"

- Source: 10 - Risk Register, columns Risk, Rating, Trend, Mitigation
- Sheet conditional format: Rating High = red, Medium = gold. Mitigation column next to each risk is what makes this a risk register, not a worry list.

-----

## ROW 7 - Budget position + team

Widget L: CHART, span 2 columns. Title "Budget vs Paid vs Remaining"

- Source: 12 - Budget Position. Stacked bar of Paid to Date, Remaining to Spend, Uncommitted Balance (or three metric cards if a clean stack is not available).
- Colors: Paid #E31837, Remaining #FFB81C, Uncommitted #8A8AA3.

Three METRIC cards, 1 column each, source 12 - Budget Position:

- "PAID TO DATE" -> $83.0M
- "RETAINAGE HELD" -> $9.9M
- "REMAINING" -> $172.1M

Widget M: GRID/REPORT, span 1 column (or 2). Title "Project Team"

- Source: 11 - Project Team, columns Name, Role (add Firm if space). Shows accountability at a glance.

-----

## ROW 8 - Snapshot + visual/document hub

Widget N: GRID/REPORT, span 3 columns. Title "Project Snapshot"

- Source: 04 - Project Snapshot, columns Metric + Value (hide Notes for the dashboard). 14 rows read like a fact sheet.

Widget O: IMAGE or WEB CONTENT, span 3 columns. Title "Project Renderings"

- Drop in a concept/massing rendering. Swap for real design renderings as they come.

-----

## ROW 9 - Document shortcuts + camera

Widget P: SHORTCUT group, span 4 columns. Title "Document Shortcuts", gold #FFB81C link text
Links (use these exact labels to mirror the proposal): Executive Schedule, OAC Minutes, Monthly Reports, Drawings, Budget Tracker, Pay Apps, Renderings, Procurement Log, Site Photos. Point the four sheet-backed ones (Budget Tracker -> 01, Executive Schedule -> 02, Procurement Log -> 07, Monthly Reports -> dashboard archive) at real permalinks; leave the rest as placeholders to fill when live.

Widget Q: WEB CONTENT, span 2 columns. Title "Live Jobsite Camera"

- No site yet. Use a placeholder tile: "Live jobsite camera - activates at groundbreaking. OxBlue / EarthCam feed embeds here." Honest and forward-looking beats an empty black box.

-----

## Finishing pass (5 minutes, biggest visual payoff)

1. Drag widget edges so every row is flush. Uneven gaps are the number-one tell of a homemade dashboard.
1. Confirm every widget background is #1A1A2E. One stray white widget ruins the theme.
1. Exit edit mode, go full screen (expand icon), then F11 in the browser. Present from that view, never from edit mode.
1. Click every shortcut once so nothing 404s in front of the client.

## Demo flow (about 90 seconds)

Header and KPI strip ("$265M budget, $219M committed, 35% billed, contingency healthy") -> Health Scorecard (six greens and one yellow) -> budget and cash flow charts ("actuals tracking plan") -> Upcoming Key Decisions (pause here, owner's favorite) -> procurement with the generator long-lead in red ("already managing your top schedule risk") -> Next 90 Days -> risk register. One screen, one story: you run it, they decide, nothing surprises them.

## Framing reminder

Live committed/spent/cash-flow figures are a representative ~Q3 2028 construction snapshot so the tool shows populated. Budget total, schedule, location, delivery, and scope are real from the RFP. Present the live numbers as "representative data showing your command center in operation during construction."