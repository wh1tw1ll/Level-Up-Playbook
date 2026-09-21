// ── PROJECTS / MFP / DOVA ──

// ── PROJECTS ────────────────────────────────────────────────────────
function renderProjects() {
  var grid = document.getElementById('projects-grid');
  if (!grid) return;
  var F = window.__MFP_FINANCIALS;
  var H = F ? F.hard : null;
  var S = F ? F.summary : null;
  var stadiumRevised = H ? '$' + Math.abs(H.total_revised).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '$553M';
  var stadiumPct = H ? (H.total_pct_paid).toFixed(1) + '%' : '94.2%';
  var stadiumPaid = H ? '$' + Math.abs(H.total_paid).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '';
  var stadiumBal = H ? '$' + Math.abs(H.total_balance).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '';
  var stadiumBudget = S ? '$' + Math.abs(S.stadium_base_contract || S.total_budget || 0).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '$530M';
  grid.innerHTML = '<div class="mfp-card chiefs-card" onclick="setView(\'mfp-dashboard\')" style="cursor:pointer">'
      + '<div class="mfp-card-head">'
      + '<span class="mfp-icon" style="font-size:18px">🏟</span>'
      + '<span class="mfp-card-title">Miami Freedom Park Stadium</span>'
      + '<span class="mfp-badge" style="background:#E31837;color:#fff">Active</span>'
      + '</div>'
      + '<div class="mfp-card-summary">Post-opening closeout. Home opener April 4, 2026. Cost recovery audit, punch list disputes with Lemartec, ARQ payment hold, HVAC service agreement.</div>'
      + '<div class="mfp-card-bullets chiefs-stats" id="mfp-card-stats">'
      + 'Total commitments: ' + stadiumRevised + '<br>'
      + 'Paid: ' + stadiumPaid + ', Balance: ' + stadiumBal + '<br>'
      + 'Hard cost budget: ' + stadiumBudget + '<br>'
      + 'Cost recovery target: $9M+<br>'
      + 'Audit final delivery: June 30, 2026'
      + '</div>'
      + '</div>'
    + '<div class="mfp-card chiefs-card" onclick="window.open(\'https://dova-dashboard-ten.vercel.app/\', \'_blank\')" style="cursor:pointer">'
          + '<div class="mfp-card-head">'
          + '<span class="mfp-icon" style="font-size:18px">🏗</span>'
          + '<span class="mfp-card-title">DOVA Arena (Sacramento)</span>'
          + '<span class="mfp-badge" style="background:#1B3A5C;color:#fff">Active</span>'
          + '</div>'
          + '<div class="mfp-card-summary">Multi-purpose arena in Rancho Cordova, CA. 8,032 seats, ~200K SF. SD phase in progress. Construction target Apr 2027.</div>'
          + '<div class="mfp-card-bullets dova-stats">'
          + 'Budget: $275.9M (May Estimate)<br>'
          + 'Site: 2875 Kilgore Rd, 28 acres<br>'
          + 'Design: Perkins&Will | CM/GC: McCarthy<br>'
          + '</div>'
          + '</div>';
}

function renderMFP() {
  var el = document.getElementById('mfp-content');
  if (!el) return;
  var F = window.__MFP_FINANCIALS;
  var S = F ? F.summary : null;
  var H = F ? F.hard : null;
  function fm(n){ if (n==null) return '$0'; var s=Math.abs(n).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,'); return '$'+s; }
  if (!window.__MFP_DETAILS) {
    showMFPDetail('issues');
    var mfpModal = document.getElementById('modal-mfp-detail');
    if (mfpModal) mfpModal.classList.remove('open');
  }
  var stadiumVal = S ? fm(S.stadium_base_contract) : '$530M';
  var pctComplete = S ? S.stadium_pct_complete.toFixed(1) + '%' : '94.2%';
  var budgetVal = S ? fm(S.total_budget) : '$824M';
  var paidVal = S ? fm(S.paid_to_date) : '';
  var retainVal = S ? fm(S.retainage_held) : '';
  var pastDueVal = S ? fm(S.past_due) : '';
  var approvedCOs = S ? fm(S.approved_cos_total) : '';
  
  var daysPast = S ? S.days_past_baseline + ' days past baseline' : '153 days past baseline';
  var millerOut = H && H.commitments ? fm((H.commitments.find(function(c){return c.company && c.company.indexOf('MILLER')>=0;}) || {}).balance) : '';
  el.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px">'
    + '<div style="font-size:13px;color:var(--muted);margin-bottom:4px">CURRENT PHASE <span style="color:#c0392b;font-weight:700">| ' + daysPast + '</span></div>'
    + '<div style="font-size:18px;font-weight:700;color:var(--charcoal);margin-bottom:8px">Post-Opening / Active Closeout</div>'
    + '<div style="font-size:14px;color:var(--charcoal);line-height:1.6">Home opener April 4, 2026 completed. Targeting final completion ' + (S ? S.target_completion : 'July 31, 2026') + '. Active workstreams: punch list closeout, cost recovery audit (delivery June 30), Lemartec contract closeout, HVAC service agreement transfer, Day 2 owner requests log.</div>'
    + '</div>'
    + '<div class="mfp-grid">'
    + '<div class="mfp-card" onclick="openMFPModal(\'issues\')"><div class="mfp-card-head"><span class="mfp-icon">🔴</span><span class="mfp-card-title">Live Issues</span><span class="mfp-badge red">5 HIGH</span></div><div class="mfp-card-summary">ARQ payment hold (~$1.5M), cost recovery audit deadline (Jun 30), Lemartec punch list disputes, HVAC contractor departure risk, Lemartec indirect cost gap ($39.5M).</div><div class="mfp-expand-content"></div></div>'
    + '<div class="mfp-card" onclick="openMFPModal(\'financials\')"><div class="mfp-card-head"><span class="mfp-icon">💰</span><span class="mfp-card-title">Financials</span></div><div class="mfp-card-summary">Total budget: ' + budgetVal + '. Stadium: ' + stadiumVal + ' revised, ' + pctComplete + ' complete. Miller Electric outstanding: ' + millerOut + '. Retainage: ' + retainVal + '.</div><div class="mfp-expand-content"></div></div>'
    + '<div class="mfp-card" onclick="openMFPModal(\'punchlist\')"><div class="mfp-card-head"><span class="mfp-icon">📋</span><span class="mfp-card-title">Punch List</span><span class="mfp-badge warn">Active</span></div><div class="mfp-card-summary">Tile installation deficiency and surface-mounted electrical conduit (spec required concealed) are active disputes with Lemartec. Position: correction, not credit.</div><div class="mfp-expand-content"></div></div>'
    + '<div class="mfp-card" onclick="showMFPDetail(\'day2\')"><div class="mfp-card-head"><span class="mfp-icon">🏗</span><span class="mfp-card-title">Day 2 Items</span><span class="mfp-badge warn">60+</span></div><div class="mfp-card-summary">Owner-directed post-opening scope. 10 tracked in closeout meetings — concourse signage, team store, club finishing, broadcast platforms, plaza landscaping, security screening, parking, F&B upgrades, AV system, suite FF&E. Each requires scope definition, cost estimate, owner authorization.</div><div class="mfp-expand-content"></div></div>'
    + '<div class="mfp-card" onclick="openMFPModal(\'stakeholders\')"><div class="mfp-card-head"><span class="mfp-icon">👥</span><span class="mfp-card-title">Stakeholders</span></div><div class="mfp-card-summary">Owner: Graham Oxley (day-to-day), Devon McCorkle &amp; Victor Oliver (approvers). CM/GC: Lemartec. AOR: ARQ.</div><div class="mfp-expand-content"></div></div>'
    + '</div>'
    + '<div style="margin-top:24px"><button class="btn-primary" onclick="toggleChat()">Ask LUCI about MFP →</button></div>';
  window.openMFPModal = showMFPDetail;
}

// ── MFP COMMAND CENTER ────────────────────────────────────────────────
function renderMFPDashboard() {
  var el = document.getElementById('mfp-dashboard');
  if (!el) return;
  var F = window.__MFP_FINANCIALS || {};
  var H = F.hard || {};
  var S = F.summary || {};
  var soft = F.soft || {};
  var ctx = window.__MFP_CONTEXT || '';
  var totalRev = H.total_revised ? Math.abs(H.total_revised).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '505M';
  var totalPaid = H.total_paid ? Math.abs(H.total_paid).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '400M';
  var totalBal = H.total_balance ? Math.abs(H.total_balance).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '105M';
  var pctPaid = H.total_pct_paid ? H.total_pct_paid.toFixed(1) : '79.1';
  var baseBudget = S.stadium_base_contract || S.total_budget || 824000000;
  var budgetStr = '$' + Math.abs(baseBudget).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,');

  var fm = function(n) { if (n == null) return '$0'; return '$' + Math.abs(n).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,'); };

  var topSubs = [];
  if (H.commitments) {
    var sorted = H.commitments.slice().sort(function(a,b) { return b.balance - a.balance; });
    topSubs = sorted.slice(0, 8);
  }

  var softTotal = soft.design_total || 28451538;
  var ffeTotal = soft.ffe_budget || 15767602;
  var freightTotal = soft.freight || 16112254;
  var customsTotal = soft.customs_duties || 13989138;
  var contTotal = soft.contingency || 15500000;
  var allSoft = softTotal + ffeTotal + freightTotal + customsTotal + contTotal;

  var html = '<div class="mfp-live-badge">Live \u00b7 Financials as of Jun 8</div>';
  html += '<div class="mfp-row">';
  html += '<div class="mfp-header-band"><div class="mfp-header-title">MIAMI FREEDOM PARK STADIUM</div><div class="mfp-header-sub">Command Center \u00b7 Level Up Project Development \u00b7 Miami, FL</div><div class="mfp-header-desc">Post-opening closeout. Home opener April 4, 2026. Active workstreams: punch list, cost recovery audit, Lemartec contract closeout.</div></div>';
  html += '<div class="mfp-anchor"><div class="mfp-anchor-label">HOME OPENER</div><div class="mfp-anchor-value">Apr 4, 2026</div></div></div>';

  html += '<div class="mfp-row mfp-kpi-row">';
  var kpis = [
    ['Total Budget', 'TOTAL BUDGET', '', budgetStr],
    ['Hard Cost Revised', 'HARD COSTS', '', '$' + (Math.abs(H.total_revised || 505000000) / 1000000).toFixed(0) + 'M'],
    ['Paid to Date', 'PAID TO DATE', '', '$' + (Math.abs(H.total_paid || 400000000) / 1000000).toFixed(0) + 'M'],
    ['Percent Paid', 'PAID %', 'gold', pctPaid + '%'],
    ['Outstanding Balance', 'BALANCE', '', '$' + (Math.abs(H.total_balance || 105000000) / 1000000).toFixed(0) + 'M'],
    ['Soft Costs Total', 'SOFT COSTS', '', '$' + Math.round(allSoft / 1000000) + 'M'],
    ['Pending COs', 'PENDING COs', '', '$' + (Math.abs(H.total_pending_cos || 4.8) / 1000000).toFixed(1) + 'M'],
    ['Project Status', 'STATUS', 'green', 'Post-Opening / Closeout']
  ];
  kpis.forEach(function(kp) {
    html += '<div class="mfp-kpi"><div class="mfp-kpi-label">' + kp[1] + '</div><div class="mfp-kpi-val ' + kp[2] + '">' + kp[3] + '</div></div>';
  });
  html += '</div>';

  html += '<div class="mfp-row">';
  html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Project Health Scorecard</div><div class="mfp-scorecard">';
  var scoreItems = [
    ['Budget', 'GREEN'], ['Schedule', 'GREEN'], ['Punch List', 'YELLOW'],
    ['Cost Recovery', 'GREEN'], ['Safety', 'GREEN'], ['Closeout', 'YELLOW']
  ];
  scoreItems.forEach(function(si) {
    var c = si[1] === 'GREEN' ? 'green' : si[1] === 'YELLOW' ? 'yellow' : 'red';
    html += '<div class="mfp-score-item"><span class="mfp-dot mfp-dot-' + c + '"></span><span class="mfp-score-cat">' + si[0] + '</span></div>';
  });
  html += '</div></div>';
  html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Hard Cost Budget ($M)</div><div class="mfp-chart-wrap"><canvas id="mfp-chart-budget"></canvas></div></div>';
  html += '</div>';

  html += '<div class="mfp-row">';
  html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Active Workstreams</div><div class="mfp-workstreams">';
  var ws = [
    { label: 'Punch List Closeout', status: 'Active', detail: 'Tile deficiency, conduit dispute with Lemartec. Correction, not credit.' },
    { label: 'Cost Recovery Audit', status: 'Active', detail: 'Target $9M+. Final delivery June 30, 2026.' },
    { label: 'Day 2 Items', status: 'Active', detail: '60+ owner-directed items. 10 tracked in closeout.' },
    { label: 'HVAC Service Agreement', status: 'In Progress', detail: 'Negotiating terms with Lemartec sub.' },
    { label: 'ARQ Payment Hold', status: 'Active', detail: 'Outstanding AOR invoices under review.' },
    { label: 'Commissioning Completion', status: 'Completed', detail: 'All systems verified.' }
  ];
  ws.forEach(function(w) {
    var sc = w.status === 'Active' ? ' chiefs-pill-gold' : w.status === 'Completed' ? ' chiefs-pill-green' : ' chiefs-pill-gray';
    html += '<div class="mfp-ws-item"><div class="mfp-ws-label">' + w.label + '</div><div><span class="chiefs-pill' + sc + '">' + w.status + '</span></div><div class="mfp-ws-detail">' + w.detail + '</div></div>';
  });
  html += '</div></div>';
  html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Cost Recovery Progress</div><div class="mfp-chart-wrap"><canvas id="mfp-chart-recovery"></canvas></div><div class="mfp-bp-metrics"><div class="mfp-bp-metric"><div class="mfp-kpi-label">TARGET</div><div class="mfp-kpi-val">$9M</div></div><div class="mfp-bp-metric"><div class="mfp-kpi-label">IDENTIFIED</div><div class="mfp-kpi-val chiefs-pill-gold" style="padding:2px 10px;border-radius:10px">$6.2M</div></div><div class="mfp-bp-metric"><div class="mfp-kpi-label">RECOVERED</div><div class="mfp-kpi-val" style="color:var(--teal)">$4.1M</div></div></div></div></div>';

  // Row 5: Soft Costs Breakdown
  html += '<div class="mfp-row">';
  html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Soft Costs Breakdown <span style="font-weight:400;color:var(--muted)">Total: ' + fm(allSoft) + '</span></div><table class="chiefs-table"><thead><tr><th>Category</th><th>Amount</th><th>% of Soft</th></tr></thead><tbody>';
  var softItems = [
    ['Design Team Fees', softTotal, softTotal/allSoft],
    ['FF&E Budget', ffeTotal, ffeTotal/allSoft],
    ['Freight', freightTotal, freightTotal/allSoft],
    ['Customs Duties / Tariffs', customsTotal, customsTotal/allSoft],
    ['Contingency', contTotal, contTotal/allSoft]
  ];
  softItems.forEach(function(si) {
    var amt = '$' + Math.round(si[1] / 1000000) + 'M';
    var pct = (si[2] * 100).toFixed(0) + '%';
    html += '<tr><td class="chiefs-cell-primary">' + si[0] + '</td><td>' + amt + '</td><td>' + pct + '</td></tr>';
  });
  html += '</tbody></table></div>';
  html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Design Team <span style="font-weight:400;color:var(--muted)">Top firms by fee</span></div><table class="chiefs-table"><thead><tr><th>Firm</th><th>Scope</th><th>Fee</th></tr></thead><tbody>';
  if (soft.design_team) {
    soft.design_team.slice(0, 10).forEach(function(dt) {
      html += '<tr><td class="chiefs-cell-primary">' + dt.firm + '</td><td>' + dt.scope + '</td><td>' + fm(dt.fee) + '</td></tr>';
    });
  }
  html += '</tbody></table></div></div>';

  // Row 6: Top Subcontractors + FF&E
  html += '<div class="mfp-row">';
  html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Top Subcontractors by Outstanding Balance</div><table class="chiefs-table"><thead><tr><th>Subcontractor</th><th>Trade</th><th>Revised</th><th>Balance</th><th>% Paid</th></tr></thead><tbody>';
  topSubs.forEach(function(c) {
    var balCls = c.pct_paid < 70 ? ' chiefs-pill-red' : c.pct_paid < 85 ? ' chiefs-pill-gold' : ' chiefs-pill-green';
    html += '<tr><td class="chiefs-cell-primary">' + c.company.split(',')[0] + '</td><td>' + c.title + '</td><td>' + fm(c.revised) + '</td><td>' + fm(c.balance) + '</td><td><span class="chiefs-pill' + balCls + '">' + c.pct_paid.toFixed(0) + '%</span></td></tr>';
  });
  html += '</tbody></table></div>';
  html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">FF&E by Category <span style="font-weight:400;color:var(--muted)">Total: ' + fm(ffeTotal) + '</span></div><table class="chiefs-table"><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>';
  if (soft.ffe_breakdown) {
    soft.ffe_breakdown.forEach(function(ffe) {
      html += '<tr><td class="chiefs-cell-primary">' + ffe.category + '</td><td>' + fm(ffe.amount) + '</td></tr>';
    });
  }
  html += '</tbody></table></div></div>';

  // Row 7: Key contracts + Stakeholders
  html += '<div class="mfp-row">';
  html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Key Contracts</div><table class="chiefs-table"><thead><tr><th>Contract</th><th>Firm</th><th>Value</th><th>Status</th></tr></thead><tbody>';
  var contracts = [
    ['GC/CM', 'Lemartec', '$530M', 'Closeout'],
    ['Architect', 'ARQ', '—', 'Hold'],
    ['Structural', 'Walter P Moore', '—', 'Active'],
    ['MEP', 'B & I Contractors', '—', 'Active'],
    ['Scoreboard', 'Daktronics', '—', 'Complete'],
    ['Security', 'Boldyn', '—', 'Active']
  ];
  contracts.forEach(function(c) {
    var scls = c[3] === 'Complete' ? ' chiefs-pill-green' : c[3] === 'Hold' ? ' chiefs-pill-red' : c[3] === 'Closeout' ? ' chiefs-pill-gold' : ' chiefs-pill-gray';
    html += '<tr><td class="chiefs-cell-primary">' + c[0] + '</td><td>' + c[1] + '</td><td>' + c[2] + '</td><td><span class="chiefs-pill' + scls + '">' + c[3] + '</span></td></tr>';
  });
  html += '</tbody></table></div>';
  html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Key Stakeholders</div><table class="chiefs-table"><thead><tr><th>Role</th><th>Name</th><th>Firm</th></tr></thead><tbody>';
  var stakeholders = [
    ['Owner (Day-to-Day)', 'Graham Oxley', 'MFP'],
    ['Owner (Approver)', 'Devon McCorkle', 'MFP'],
    ['Owner (Approver)', 'Victor Oliver', 'MFP'],
    ['Owner\'s Rep', 'Whitney Williams', 'Level Up'],
    ['Owner\'s Rep', 'Greg Wieting', 'Level Up'],
    ['Field Director', 'Jordan Ward', 'Level Up'],
    ['GC/CM', 'Jon Smith (PE)', 'Lemartec']
  ];
  stakeholders.forEach(function(sh) {
    html += '<tr><td class="chiefs-cell-primary">' + sh[0] + '</td><td>' + sh[1] + '</td><td>' + sh[2] + '</td></tr>';
  });
  html += '</tbody></table></div></div>';

  // Row 8: Key dates + Invoice summary
  html += '<div class="mfp-row">';
  html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Key Dates</div><table class="chiefs-table"><thead><tr><th>Milestone</th><th>Date</th><th>Status</th></tr></thead><tbody>';
  var dates = [
    ['Home Opener', 'Apr 4, 2026', 'Complete'],
    ['Cost Recovery Final', 'Jun 30, 2026', 'On Track'],
    ['Punch List Complete', 'Aug 2026', 'In Progress'],
    ['Final Lien Waivers', 'Sep 2026', 'In Progress'],
    ['Contract Closeout', 'Dec 2026', 'Not Started']
  ];
  dates.forEach(function(d) {
    var dcls = d[2] === 'Complete' ? ' chiefs-pill-green' : d[2] === 'On Track' ? ' chiefs-pill-green' : d[2] === 'In Progress' ? ' chiefs-pill-gold' : ' chiefs-pill-gray';
    html += '<tr><td class="chiefs-cell-primary">' + d[0] + '</td><td>' + d[1] + '</td><td><span class="chiefs-pill' + dcls + '">' + d[2] + '</span></td></tr>';
  });
  html += '</tbody></table></div>';
  html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Invoice Summary</div><div class="mfp-bp-metrics">';
  html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">HARD COST ORIGINAL</div><div class="mfp-kpi-val">$485M</div></div>';
  html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">APPROVED COs</div><div class="mfp-kpi-val" style="color:var(--teal)">$20.7M</div></div>';
  html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">INVOICED TO DATE</div><div class="mfp-kpi-val">$459M</div></div>';
  html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">PENDING COs</div><div class="mfp-kpi-val chiefs-pill-gold" style="padding:2px 6px;border-radius:6px">$4.8M</div></div>';
  html += '</div></div></div>';

  el.innerHTML = html;
  renderMFPCharts();
}

function renderMFPCharts() {
  if (typeof Chart === 'undefined') return;
  var teal = '#184655', gold = '#e6a817', slate = '#8A8AA3', txt = 'var(--charcoal)', grid = 'rgba(138,138,163,0.15)';
  Chart.defaults.color = txt; Chart.defaults.borderColor = grid;
  var F = window.__MFP_FINANCIALS || {};
  var H = F.hard || {};
  var S = F.summary || {};

  if (document.getElementById('mfp-chart-budget')) {
    var cats = ['Original', 'COs', 'Revised', 'Invoiced', 'Paid', 'Balance'];
    var vals = [
      Math.round((H.total_original || 485000000) / 1000000),
      Math.round((H.total_approved_cos || 20700000) / 1000000),
      Math.round((H.total_revised || 505000000) / 1000000),
      Math.round((H.total_invoiced || 459000000) / 1000000),
      Math.round((H.total_paid || 400000000) / 1000000),
      Math.round((H.total_balance || 105000000) / 1000000)
    ];
    new Chart(document.getElementById('mfp-chart-budget'), {
      type: 'bar',
      data: { labels: cats, datasets: [{ label: 'Amount ($M)', data: vals, backgroundColor: [teal, gold, teal, slate, '#1D9E75', '#E31837'], borderRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: txt, maxRotation: 45, font: { size: 10 } } }, y: { ticks: { color: txt } } } }
    });
  }

  if (document.getElementById('mfp-chart-recovery')) {
    new Chart(document.getElementById('mfp-chart-recovery'), {
      type: 'doughnut',
      data: {
        labels: ['Recovered', 'Identified', 'Remaining'],
        datasets: [{ data: [4.1, 2.1, 2.8], backgroundColor: [teal, gold, slate], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { color: txt, boxWidth: 12, padding: 8 } } }
      }
    });
  }
}