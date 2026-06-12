# Live Chiefs Dashboard in the Playbook Site - Bot Prompts

Goal: a "Kansas City Chiefs" card on the existing Projects tab. Clicking it opens an exec-facing, Chiefs-branded dashboard whose widgets are fed live from the Smartsheet workspace (ID 180213104568196, sheets 01-13). When Smartsheet is edited, the dashboard updates automatically (60-second refresh).

Architecture: Smartsheet API -> Vercel serverless function (token server-side) -> dashboard page polls the function. No widget API, no manual sync.

Run prompts in order. Wait for each to complete and report before the next.

-----

## PROMPT 1 - Recon (read-only, change nothing)

Open the level-up-playbook repo. Do not modify anything yet. Report back:

1. The framework: plain HTML/JS, Next.js, or other. List the files that render the Projects tab.
1. How serverless functions are structured (existing /api folder? Next.js API routes?).
1. How Microsoft OAuth gating works, and confirm new pages inherit it.
1. How env vars are referenced (process.env usage) and whether a .env.example exists.
   Output a short plan for where the new API route, the dashboard page, and the Projects card will live, matching the repo's existing conventions. Wait for my approval before building.

-----

## PROMPT 2 - Smartsheet config + discovery

1. Add two Vercel environment variables (tell me to set values in the Vercel dashboard, do not hardcode): SMARTSHEET_TOKEN and SMARTSHEET_WORKSPACE_ID=180213104568196.
1. Write a one-off discovery script (scripts/discover-smartsheet.js) that calls GET <https://api.smartsheet.com/2.0/workspaces/{SMARTSHEET_WORKSPACE_ID}> with the token, and writes config/chiefs-sheets.json mapping each sheet name ("01 - Budget" ... "13 - Health Scorecard") to { sheetId, permalink }.
1. Run it and show me the resulting JSON.
   HARD RULES: the token only ever appears in process.env reads. Never print it, never write it to any file, never send it to the browser.

-----

## PROMPT 3 - Serverless proxy API

Create one API route: GET /api/chiefs/[sheet] (or /api/chiefs?sheet=NN matching repo conventions). Behavior:

1. sheet param is the two-digit key (01-13); look up sheetId from config/chiefs-sheets.json. Unknown key -> 404 JSON.
1. Fetch GET <https://api.smartsheet.com/2.0/sheets/{sheetId}> with Authorization: Bearer {SMARTSHEET_TOKEN}.
1. Transform to clean JSON: { sheet, name, permalink, updatedAt, columns: [titles], rows: [{ColumnTitle: value}] }. Strip everything else.
1. Cache: response header Cache-Control: s-maxage=60, stale-while-revalidate=300. This is the live-refresh interval; Smartsheet edits appear within ~60s.
1. Errors: if Smartsheet returns non-200, respond { error: true, message } with status 502. Never leak the token or raw upstream headers.
1. Add GET /api/chiefs/health returning { ok: true, sheets: 13 } after verifying config loads.
   Deploy to a preview URL and show me /api/chiefs/health and /api/chiefs/01 output (values only, no token).

-----

## PROMPT 4 - Dashboard page (exec client-facing)

Create the dashboard page (e.g. /projects/chiefs), behind the existing Microsoft OAuth like every other page.

DESIGN SYSTEM (use exactly):

- Background #0F0F1A, cards #1A1A2E with 1px #2A2A44 border, radius 10px
- Chiefs red #E31837 (primary data), Chiefs gold #FFB81C (accents/links), gray #8A8AA3 (minor)
- Status: green #1D9E75, yellow #EF9F27, red #E24B4A
- Type: Barlow Condensed (headers, uppercase, letterspaced), Inter (body), IBM Plex Mono (numbers). Google Fonts.
- Tone: executive and clean. No raw JSON, no column IDs, no developer jargon anywhere on screen. Friendly labels only.
- Brand mark: red arrow glyph + "KC CHIEFS TRAINING FACILITY" wordmark. Leave an <img> slot (assets/chiefs-logo.png) that renders only if the file exists, so a licensed logo can be dropped in later.

LAYOUT, top to bottom (6-column grid, every widget fed from /api/chiefs/NN):

1. Header band: title + "Project Command Center | Turner & Townsend + Level Up | Olathe, Kansas", subtitle "A single source of truth that keeps priorities visible, decisions organized, and Chiefs leadership informed." Right side: solid red anchor tile "SUBSTANTIAL COMPLETION / Q4 2030" (from sheet 06).
1. KPI strip, six tiles from sheet 06: Total Budget, Committed, Billed to Date, Percent Spent (gold), Contingency, Schedule (green).
1. Row: Project Health scorecard (sheet 13, six tiles with colored status dots) | Budget by Category column chart (sheet 01, Planned Amount, red bars) | Cash Flow Curve line chart (sheet 05, planned gold dashed, actual red solid, actual line simply stops where Actual Cumulative is blank).
1. Row: Milestone Schedule table (sheet 02: Milestone, Target, Variance, Status pill) | Action Items table (sheet 03: Item, Owner, Due, Priority pill).
1. Row: Procurement & Long-Lead Buyout table (sheet 07; Status "Long Lead - Track" renders as a red pill) | Upcoming Key Decisions + Next 90 Days stacked (sheets 08, 09).
1. Row: Top Risks & Mitigation (sheet 10, Rating pills) | Project Team (sheet 11: Name, Role, Firm).
1. Row: Budget Position stacked bar (sheet 12: Paid red, Retainage gold, Remaining slate, with legend) | Document Shortcuts (gold pill links) | Live Jobsite Camera placeholder card ("Camera 1 - South View | Activates at groundbreaking").

Charts: Chart.js from cdnjs, dark-styled to match (no default white grid/legend). Status text -> pill colors: Complete/Awarded/On Track green, In Progress/Planning/Watch/Medium gold, High/At Risk/Long Lead red, Not Started gray.

-----

## PROMPT 5 - Live behavior + the cool stuff

1. Auto-refresh: each widget refetches its endpoint every 60s (SWR-style: render cached data instantly, update quietly in background). Header shows "Live . Updated {time}" with a subtle pulse on refresh. No spinners after first load; use skeleton cards on first load only.
1. Hover details: every KPI tile, chart point/bar, table row, and scorecard tile gets a styled dark tooltip with the underlying detail (e.g. KPI tile -> source sheet + last updated; budget bar -> Planned vs Committed vs Spent for that category from sheet 01; risk row -> full mitigation text; milestone row -> baseline vs target).
1. Click-through to back-of-house: every widget header gets a small gold "View source" icon-link that opens that sheet's Smartsheet permalink (from the config) in a new tab. Document Shortcuts link to the matching sheet permalinks too.
1. Error state: if an endpoint fails, the widget keeps its last good data and shows a quiet amber dot with tooltip "Reconnecting to Smartsheet" - never a broken card, never an error stack.
1. Responsive: stacks cleanly on tablet; the interview will likely be a laptop on a big screen, so optimize for 1080p+ full-screen first. Respect prefers-reduced-motion.

-----

## PROMPT 6 - Projects tab card

Add a "Kansas City Chiefs - Training Facility" card to the existing Projects tab, matching the existing card component style but skinned: thin red top border, gold "ACTIVE PURSUIT / OWNER'S REP" tag, three mini-stats pulled live from /api/chiefs/06 (Total Budget, Substantial Completion, Schedule status with green dot), and the brand mark. Whole card clicks through to /projects/chiefs. If the API is unreachable, show the card with static labels and no stats (never block the Projects tab on Smartsheet).

-----

## PROMPT 7 - QA + ship

1. Deploy preview. Verify: all 13 endpoints return data; dashboard renders every widget; edit one cell in Smartsheet (e.g. flip a Health Scorecard status to YELLOW) and confirm the dashboard reflects it within ~90 seconds without a manual reload.
1. Check: no token in any client bundle (search the built output for the token prefix), tooltips work, every View source link opens the right sheet, card renders on Projects tab, OAuth still gates everything, Lighthouse perf reasonable.
1. Report a checklist of pass/fail with screenshots, then promote to production.

-----

## Optional PROMPT 8 - True push updates (only if 60s isn't enough)

Replace polling with Smartsheet webhooks: POST /2.0/webhooks per sheet pointing at a new /api/chiefs/webhook route (handle the verification challenge handshake), and on callback bust the cache for that sheet. Skip unless the 60-second refresh feels slow in rehearsal; webhooks add failure modes you don't want to debug the night before June 17.

-----

## Notes for Whitney (not for the bot)

- Set SMARTSHEET_TOKEN in Vercel env settings yourself; don't paste it into the bot chat alongside these prompts. And regenerate the current token after the build, since it's been shared in plain text.
- The dashboard reads whatever is in the sheets, so run the smartsheet-bot-prompts-FINAL.md build first (or this dashboard will render empty tables).
- Rehearse the live edit: change a Smartsheet cell on your phone mid-demo and let the panel watch the dashboard update. That 10 seconds sells the whole PMIS story better than any slide.