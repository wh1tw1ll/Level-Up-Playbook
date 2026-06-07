// Level Up Playbook — Templates data
window.__TEMPLATES = {
  "01_Risk_Register.xlsx": {
    name: "Risk Register",
    desc: "Full risk register with probability/impact scoring, mitigation tracking, and status dropdowns. 30 rows, auto-IDs.",
    category: "Project Controls",
    section: "17",
    icon: "\u26a0\ufe0f",
    data: "",
  },
  "02_Action_Item_Log.xlsx": {
    name: "Action Item Log",
    desc: "Track all open action items by meeting source, owner, due date, and status. Auto-generates AI-XXX IDs.",
    category: "Project Controls",
    section: "11",
    icon: "\u2705",
    data: "",
  },
  "03_Change_Order_Log.xlsx": {
    name: "Change Order Log",
    desc: "Log all change events from identification through execution with running contract value totals.",
    category: "Project Controls",
    section: "16",
    icon: "\ud83d\udd04",
    data: "",
  },
  "04_Meeting_Agenda_and_Minutes.xlsx": {
    name: "Meeting Agenda & Minutes",
    desc: "Three-tab workbook: OAC Agenda (12 standard items), Meeting Minutes (decisions/action items/carry-forward), Design Review Agenda.",
    category: "Meetings",
    section: "11",
    icon: "\ud83d\udccb",
    data: "",
  },
  "07_Budget_Tracker.xlsx": {
    name: "Budget Tracker + Contingency Log",
    desc: "Two-tab: full project budget by category with variance and % complete, plus contingency draw-down log.",
    category: "Financial",
    section: "14",
    icon: "\ud83d\udcb0",
    data: "",
  },
  "08_Pay_App_Review_Checklist.xlsx": {
    name: "Pay Application Review Checklist",
    desc: "SOV, lien waiver, field verification, and draw package checklist for certifying contractor pay applications.",
    category: "Financial",
    section: "14",
    icon: "\ud83e\uddfe",
    data: "",
  },
  "09_Punch_List_Log.xlsx": {
    name: "Punch List Log",
    desc: "200-row punch list with location, trade, priority, credit tracking, and status dropdowns.",
    category: "Field & Construction",
    section: "35",
    icon: "\ud83d\udccc",
    data: "",
  },
  "10_Weekly_Report_Template.xlsx": {
    name: "Weekly Report Template",
    desc: "Health summary, schedule milestones, budget overview, top issues, and action items.",
    category: "Reporting",
    section: "12",
    icon: "\ud83d\udcca",
    data: "",
  },
  "11_Vendor_Evaluation_Matrix.xlsx": {
    name: "Vendor Evaluation Matrix",
    desc: "Weighted scoring matrix for up to 4 vendors across 7 criteria with auto-calculated totals.",
    category: "Contracts & Procurement",
    section: "20",
    icon: "\ud83c\udfc6",
    data: "",
  },
  "12_FFE_Procurement_Tracker.xlsx": {
    name: "FF&E / OS&E Procurement Tracker",
    desc: "100-row tracker with lead time calculation, delivery tracking, and furnished/installed-by dropdowns.",
    category: "Field & Construction",
    section: "27",
    icon: "\ud83e\ude91",
    data: "",
  },
};

const PHASE_GUIDE = {
  'Pre-Development': {
    icon: '🏗',
    desc: 'You are just getting started. Focus on mobilization, governance, and getting the team aligned.',
    sections: [
      { num: 'DC', why: 'Set up your document control system on Day 1' },
      { num: '4', why: 'Follow the Day 1 mobilization plan immediately' },
      { num: '5', why: 'Establish governance and decision-making authority' },
      { num: '6', why: 'Map all stakeholders and set communication expectations' },
      { num: '9', why: 'Stand up project controls — budget, schedule, risk' },
      { num: '32', why: 'Review the procurement timeline — some items start NOW' },
      { num: '27', why: 'Build the initial risk register' },
      { num: '33', why: 'Identify all utility and district coordination requirements' },
    ]
  },
  'Schematic Design': {
    icon: '✏️',
    desc: 'Design is taking shape. Push for program compliance, engage long-lead vendors, and do your first VE pass.',
    sections: [
      { num: '13', why: 'Manage the design team — SD deliverables and review' },
      { num: '35', why: 'Phase Gate 1 VE — highest flexibility, act now' },
      { num: '32', why: 'Scoreboard and seating LOIs should be in flight' },
      { num: '17', why: 'Sports specialty workstreams need early decisions' },
      { num: '10', why: 'Validate budget against SD estimate' },
      { num: '36', why: 'Start sponsorship spec review — identify partnership opportunities' },
      { num: '12', why: 'Evaluate delivery method and begin CM/GC procurement' },
    ]
  },
  'Design Development': {
    icon: '📐',
    desc: 'Systems are being defined. Last chance for major scope changes. Operators must be at the table.',
    sections: [
      { num: '13', why: 'DD design review — program, budget, league standards' },
      { num: '35', why: 'Phase Gate 2 VE — run a formal workshop if gap >5%' },
      { num: '34', why: 'DAS, CNS, F&B, scoreboard — deep dive coordination' },
      { num: '19', why: 'Technology consultant must finalize network architecture' },
      { num: '20', why: 'Engage operations team NOW — not after CDs' },
      { num: '18', why: 'FF&E procurement plan should be started' },
      { num: '14', why: 'Pre-application meetings with AHJ — do not wait' },
      { num: '36', why: 'Bidder-partner sequencing — identify partnership-eligible packages' },
    ]
  },
  'CDs & Bid': {
    icon: '📋',
    desc: 'Documents are being finalized and bid out. Procurement integrity and schedule are the priorities.',
    sections: [
      { num: '12', why: 'Manage the bid process — RFP, interview, selection' },
      { num: '35', why: 'Phase Gate 3 — GMP reconciliation VE as bids come in' },
      { num: '14', why: 'Permit submission — confirm all AHJ comments are resolved' },
      { num: '32', why: 'All long-lead items should be under contract by now' },
      { num: '36', why: 'Post-bid: open partnership conversations before contract execution' },
      { num: '10', why: 'GMP reconciliation — line by line against the budget' },
      { num: '27', why: 'Update risk register — construction risks are now primary' },
    ]
  },
  'Construction': {
    icon: '🔨',
    desc: 'Build phase. Field oversight, change management, and schedule recovery are your daily work.',
    sections: [
      { num: '15', why: 'Field oversight protocol — minimum 3 days/week on site' },
      { num: '16', why: 'Every PCO gets reviewed the same way — every time' },
      { num: '11', why: 'Schedule management — protect the event opening date' },
      { num: '10', why: 'Monthly draw package review and cost-to-complete forecast' },
      { num: '21', why: 'Commissioning must start before construction is complete' },
      { num: '20', why: 'Operations readiness workstreams running in parallel' },
      { num: '34', why: 'Specialty scope coordination — DAS, scoreboard, seating' },
      { num: '24', why: 'Weekly and monthly reporting must be consistent' },
    ]
  },
  'Closeout': {
    icon: '✅',
    desc: 'Finishing strong. Punch list, CO, retainage, and turnover are all happening simultaneously.',
    sections: [
      { num: '22', why: 'Punch list management — systematic, documented, enforced' },
      { num: '14', why: 'CO and TCO process — confirm all conditions are tracked' },
      { num: '21', why: 'Systems commissioning and O&M turnover' },
      { num: '23', why: 'Closeout plan — as-builts, warranties, final budget' },
      { num: '18', why: 'FF&E installation and inventory' },
      { num: '28', why: 'Final draw package checklist' },
      { num: '10', why: 'Final budget reconciliation and retainage release' },
    ]
  },
  'Opening': {
    icon: '🎉',
    desc: 'Game day. Operations readiness, event simulation, and first event execution.',
    sections: [
      { num: '20', why: 'First event readiness checklist — run it item by item' },
      { num: '34', why: 'All specialty systems must be commissioned and tested' },
      { num: '21', why: 'Confirm all systems are in warranty and O&M is transferred' },
      { num: '29', why: 'Know the common problems — be ready with Level Up responses' },
    ]
  }
};

const DT_TREE = {
  root: {
    q: "What's the situation?",
    opts: [
      { label: '💰 Budget or cost issue', next: 'budget' },
      { label: '📅 Schedule concern', next: 'schedule' },
      { label: '🔨 Contractor problem', next: 'contractor' },
      { label: '📋 Change order received', next: 'co' },
      { label: '🏗 Design issue', next: 'design' },
      { label: '🔌 Specialty scope question', next: 'specialty' },
      { label: '📄 Permit or AHJ issue', next: 'ahj' },
      { label: '🏁 Getting ready to open', next: 'opening' },
    ]
  },
  budget: {
    q: "What kind of budget issue?",
    opts: [
      { label: 'Budget is over the target', next: 'budget_over' },
      { label: 'GMP came in higher than expected', next: 'budget_gmp' },
      { label: 'Contingency is being depleted', next: 'budget_contingency' },
      { label: 'Need to find savings', next: 'budget_ve' },
    ]
  },
  budget_over: {
    a: `<strong>Budget over target — what to do now:</strong><br><br>
1. Prepare a gap analysis (current estimate vs. approved budget, line by line)<br>
2. Present the owner with a menu of options: VE opportunities, scope reductions, alternate systems, phasing, additional funding<br>
3. Never present a gap without options — the owner needs to make a decision, not just receive bad news<br><br>
See <a onclick="closeDecisionTree();jumpTo('10')">§10 Budget Management</a> and <a onclick="closeDecisionTree();jumpTo('35')">§35 Value Engineering</a> for detailed procedures.`,
    secs: ['10', '35', '29']
  },
  budget_gmp: {
    a: `<strong>GMP over estimate — Phase Gate 3 VE:</strong><br><br>
When the GMP comes in high, focus VE on trade package alternates — not full redesigns. Work with the CM/GC to identify: alternate products within spec, scope clarifications, and items that can be deferred.<br><br>
Also check whether any high-cost items are partnership candidates before cutting them. See <a onclick="closeDecisionTree();jumpTo('35')">§35 VE Procedures</a> §35.5 and <a onclick="closeDecisionTree();jumpTo('36')">§36 Sponsorship Coordination</a>.`,
    secs: ['35', '36', '10']
  },
  budget_contingency: {
    a: `<strong>Contingency depletion:</strong><br><br>
A 25% depletion of any contingency tier triggers a mandatory owner briefing. Present: what has been drawn, why, what is remaining, and the projected remaining exposure.<br><br>
See <a onclick="closeDecisionTree();jumpTo('10')">§10.3</a> for contingency strategy and tier definitions. Log every draw in the contingency log.`,
    secs: ['10', '27', '9']
  },
  budget_ve: {
    a: `<strong>Looking for savings — start with Tier 1:</strong><br><br>
Best opportunities in order: structural system efficiency, building envelope simplification, MEP rightsizing, back-of-house finishes, site work.<br><br>
Before cutting anything, check if it's a partnership candidate. See <a onclick="closeDecisionTree();jumpTo('35')">§35.4 VE Opportunities</a> and <a onclick="closeDecisionTree();jumpTo('35')">§35.5 VE-to-Partnership Conversion</a>.`,
    secs: ['35', '36', '10']
  },
  schedule: {
    q: "What's the schedule concern?",
    opts: [
      { label: 'Design is running behind', next: 'sched_design' },
      { label: 'Construction is behind schedule', next: 'sched_const' },
      { label: 'Event opening date is at risk', next: 'sched_event' },
      { label: 'A subcontractor is causing delays', next: 'sched_sub' },
    ]
  },
  sched_design: {
    a: `<strong>Design behind schedule:</strong><br><br>
Issue formal written notice to the design team within 5 business days. Request a written recovery plan with specific dates. Track weekly. Escalate to design firm principal if recovery plan is not being executed.<br><br>
See <a onclick="closeDecisionTree();jumpTo('11')">§11 Schedule Management</a> and <a onclick="closeDecisionTree();jumpTo('29')">§29 Common Problems</a> §29.1.`,
    secs: ['11', '29', '7']
  },
  sched_const: {
    a: `<strong>Construction behind schedule:</strong><br><br>
Require a written recovery plan from the CM/GC within 5 business days. The plan must show how lost time is recovered — not just a revised end date. Review the critical path: is this activity truly on the critical path, or does it have float?<br><br>
See <a onclick="closeDecisionTree();jumpTo('11')">§11.4 Recovery Planning</a>.`,
    secs: ['11', '15', '9']
  },
  sched_event: {
    a: `<strong>Event opening date at risk:</strong><br><br>
This is a Level 1 escalation. Immediately brief the Level Up principal and owner executive. Prepare a gap analysis: days needed vs. days available, critical path items that must compress, and cost of acceleration.<br><br>
See <a onclick="closeDecisionTree();jumpTo('11')">§11.5 Aligning to Event Deadline</a> and <a onclick="closeDecisionTree();jumpTo('29')">§29.7</a>.`,
    secs: ['11', '29', '20']
  },
  sched_sub: {
    a: `<strong>Subcontractor causing delays:</strong><br><br>
This is the CM/GC's contractual responsibility — push them to manage it. Document all delay events with dates. The CM/GC must issue cure notices to performing subs. Level Up tracks and reports delay events but does not direct subcontractors directly.<br><br>
See <a onclick="closeDecisionTree();jumpTo('15')">§15 Field Oversight</a>.`,
    secs: ['15', '11', '16']
  },
  contractor: {
    q: "What's the contractor issue?",
    opts: [
      { label: 'Quality deficiency observed', next: 'cont_quality' },
      { label: 'Pay application seems inflated', next: 'cont_payapp' },
      { label: 'Contractor is not cooperating', next: 'cont_coop' },
      { label: 'Buyout is moving too slowly', next: 'cont_buyout' },
    ]
  },
  cont_quality: {
    a: `<strong>Quality deficiency:</strong><br><br>
Document with photos in the field deficiency log immediately. Issue a formal written deficiency notice within 24 hours. Define the required corrective action, the spec reference, and the deadline. Never verbal-only on quality issues.<br><br>
See <a onclick="closeDecisionTree();jumpTo('15')">§15.2-15.3 Quality Observation and Deficiency Tracking</a>.`,
    secs: ['15', '22', '7']
  },
  cont_payapp: {
    a: `<strong>Pay application review:</strong><br><br>
Compare claimed percent complete against your independent field observation. Request documentation for stored materials. Verify lien waivers are current. Never certify more than what you can independently verify.<br><br>
See <a onclick="closeDecisionTree();jumpTo('10')">§10.6 Pay Application Review</a> and <a onclick="closeDecisionTree();jumpTo('28')">§28 Draw Checklist</a>.`,
    secs: ['10', '28', '15']
  },
  cont_buyout: {
    a: `<strong>Slow buyout:</strong><br><br>
Hold a weekly buyout status meeting with CM/GC. Any package more than 2 weeks behind triggers a written explanation from the CM/GC. Unbid packages create GMP exposure — track every one.<br><br>
See <a onclick="closeDecisionTree();jumpTo('12')">§12.4 Buyout Tracking</a> and <a onclick="closeDecisionTree();jumpTo('29')">§29.3</a>.`,
    secs: ['12', '29', '10']
  },
  co: {
    q: "What kind of change order situation?",
    opts: [
      { label: 'Reviewing a PCO from the contractor', next: 'co_review' },
      { label: 'Owner wants to add scope', next: 'co_owner' },
      { label: 'Contractor claims a design error caused extra cost', next: 'co_error' },
    ]
  },
  co_review: {
    a: `<strong>PCO review — check four things in order:</strong><br><br>
1. <strong>Entitlement:</strong> Is the contractor contractually entitled to this change?<br>
2. <strong>Scope:</strong> Is the described scope accurate and complete?<br>
3. <strong>Pricing:</strong> Are labor hours and materials reasonable and verifiable?<br>
4. <strong>Schedule:</strong> Is claimed schedule impact on the critical path?<br><br>
See <a onclick="closeDecisionTree();jumpTo('16')">§16 Change Management Playbook</a> for the full review process.`,
    secs: ['16', '10', '9']
  },
  co_owner: {
    a: `<strong>Owner-directed scope addition:</strong><br><br>
Before the owner directs any additional scope: get a rough order of magnitude cost from the CM/GC, confirm budget availability, and get written owner direction. Never instruct the contractor to proceed on verbal direction alone.<br><br>
See <a onclick="closeDecisionTree();jumpTo('16')">§16.4 Preventing Unauthorized Work</a>.`,
    secs: ['16', '5', '7']
  },
  co_error: {
    a: `<strong>Design error change order:</strong><br><br>
Design errors are the architect's liability, not the owner's. Document the discrepancy between drawings and field conditions. The architect must review and issue a clarification or correction. Cost responsibility depends on the contract — typically design errors are A/E liability.<br><br>
See <a onclick="closeDecisionTree();jumpTo('16')">§16.5 Claims Avoidance</a>.`,
    secs: ['16', '13', '7']
  },
  design: {
    q: "What's the design issue?",
    opts: [
      { label: 'Design does not match the program', next: 'des_program' },
      { label: 'Spec question on a specialty scope', next: 'specialty' },
      { label: 'League standards conflict', next: 'des_league' },
    ]
  },
  des_program: {
    a: `<strong>Program compliance issue:</strong><br><br>
Issue a formal design review comment requiring the architect to revise. Reference the program document or owner brief. Every comment needs a specific resolution, not just acknowledgment.<br><br>
See <a onclick="closeDecisionTree();jumpTo('13')">§13.3 Design Deliverable Reviews</a>.`,
    secs: ['13', '5', '7']
  },
  des_league: {
    a: `<strong>League standards conflict:</strong><br><br>
League standards are non-negotiable. Identify the specific standard, the current design non-compliance, and the required modification. Escalate to the owner — they manage the franchise relationship with the league.<br><br>
See <a onclick="closeDecisionTree();jumpTo('13')">§13.5 League Standards Coordination</a>.`,
    secs: ['13', '17', '6']
  },
  specialty: {
    q: "Which specialty scope?",
    opts: [
      { label: 'DAS / Cellular', next: 'spec_das' },
      { label: 'Scoreboard / LED', next: 'spec_score' },
      { label: 'F&B / Concessionaire', next: 'spec_fb' },
      { label: 'Access Control / Ticketing', next: 'spec_ac' },
      { label: 'Playing Surface', next: 'spec_turf' },
    ]
  },
  spec_das: {
    a: `<strong>DAS — key decision points:</strong><br><br>
First decide your procurement model: Carrier-Direct, Neutral Host (Boldyn, ExteNet), or Owner-Funded. Neutral host is most common for major venues. Critical: build 6-12 weeks for carrier acceptance testing into the schedule — this is after installation.<br><br>
See <a onclick="closeDecisionTree();jumpTo('34')">§34 DAS Deep Dive</a> for full procurement, coordination, and watch items.`,
    secs: ['34', '32', '19']
  },
  spec_score: {
    a: `<strong>Scoreboard / LED — order NOW:</strong><br><br>
If you haven't ordered yet, check the schedule immediately. Lead time is 12-24 months. The structural interface drawings must be in the structural engineer's hands before the roof is designed. Confirm pixel pitch meets league broadcast standards.<br><br>
See <a onclick="closeDecisionTree();jumpTo('34')">§34 Scoreboard Deep Dive</a>.`,
    secs: ['34', '32', '17']
  },
  spec_fb: {
    a: `<strong>F&B / Concessionaire:</strong><br><br>
If F&B operator is not engaged by Design Development, you will have kitchen redesigns, POS retrofits, and health department delays. Engage now. Coordinate pouring rights with naming rights category exclusions before either contract is signed.<br><br>
See <a onclick="closeDecisionTree();jumpTo('34')">§34 F&B Deep Dive</a> and <a onclick="closeDecisionTree();jumpTo('36')">§36.6 Pouring Rights</a>.`,
    secs: ['34', '36', '32']
  },
  spec_ac: {
    a: `<strong>Access Control / Ticketing:</strong><br><br>
Confirm your access control system is certified for integration with your ticketing platform BEFORE procurement. Not all systems integrate. Run credential load testing at full venue capacity before opening — not small scale.<br><br>
See <a onclick="closeDecisionTree();jumpTo('34')">§34 Access Control Deep Dive</a>.`,
    secs: ['34', '19', '20']
  },
  spec_turf: {
    a: `<strong>Playing Surface:</strong><br><br>
Natural turf: allow 6-12 months grow-in time before first event — build this into the schedule. Synthetic: G-Max and HIC testing required before any sport is played. Confirm field drainage is civil-engineered before slab is poured.<br><br>
See <a onclick="closeDecisionTree();jumpTo('34')">§34 Playing Surface Deep Dive</a>.`,
    secs: ['34', '17', '21']
  },
  ahj: {
    q: "What's the permit or AHJ issue?",
    opts: [
      { label: 'Permit is taking too long', next: 'ahj_delay' },
      { label: 'Failed inspection', next: 'ahj_fail' },
      { label: 'TCO conditions holding up occupancy', next: 'ahj_tco' },
    ]
  },
  ahj_delay: {
    a: `<strong>Permit delay:</strong><br><br>
Request a meeting with the plan reviewer directly. Offer to answer questions in person. If delay continues, escalate to the building department supervisor. Some jurisdictions allow expedited review for a fee — evaluate this option.<br><br>
See <a onclick="closeDecisionTree();jumpTo('14')">§14 Permitting and AHJ Coordination</a> and <a onclick="closeDecisionTree();jumpTo('29')">§29.4</a>.`,
    secs: ['14', '29', '11']
  },
  ahj_fail: {
    a: `<strong>Failed inspection:</strong><br><br>
Document the specific items cited. Issue a written response to the CM/GC with the corrective action required and a 48-hour completion deadline for life safety items. Re-inspection must be scheduled immediately after corrections are complete.<br><br>
See <a onclick="closeDecisionTree();jumpTo('14')">§14.5 CO Review Process</a>.`,
    secs: ['14', '15', '22']
  },
  ahj_tco: {
    a: `<strong>TCO conditions blocking final CO:</strong><br><br>
Every TCO condition must be tracked individually in the TCO conditions log. Each item needs an owner, a deadline, and a verification method. Final CO cannot be requested until ALL conditions are resolved and confirmed by the AHJ.<br><br>
See <a onclick="closeDecisionTree();jumpTo('14')">§14.5</a> and <a onclick="closeDecisionTree();jumpTo('22')">§22.6 Final CO and Retainage</a>.`,
    secs: ['14', '22', '23']
  },
  opening: {
    a: `<strong>Getting ready to open — the critical list:</strong><br><br>
1. <strong>Event simulation</strong> — at least one full dry run before public event<br>
2. <strong>DAS</strong> — all carrier acceptance tests complete<br>
3. <strong>Access control</strong> — credential load test at full capacity<br>
4. <strong>POS</strong> — end-to-end payment test with real transactions<br>
5. <strong>Life safety</strong> — all systems commissioned and signed off<br>
6. <strong>CO/TCO</strong> — confirmed occupancy for event day attendance<br><br>
See <a onclick="closeDecisionTree();jumpTo('20')">§20 Operations Readiness</a> First Event Readiness Checklist.`,
    secs: ['20', '34', '21']
  },
  cont_coop: {
    a: `<strong>Contractor not cooperating:</strong><br><br>
Everything goes in writing. Send a formal written notice for every verbal commitment that is not followed through on. If non-cooperation is systemic, escalate to the owner immediately — this is a contractual performance issue. Document a pattern before formal cure notice.<br><br>
See <a onclick="closeDecisionTree();jumpTo('7')">§7 Communication Protocols</a> and <a onclick="closeDecisionTree();jumpTo('16')">§16.5 Claims Avoidance</a>.`,
    secs: ['7', '16', '29']
  }
};