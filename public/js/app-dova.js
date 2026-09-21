// ── DOVA ARENA DASHBOARD — Embedded view replacing the dead redirect ──
// Reads STORE for actions + Budget Snapshot for budget figures

function renderDovaDashboard() {
  var el = document.getElementById('dova-dashboard');
  if (!el) return;
  el.innerHTML = '<div class="dova-skeleton"><div class="dova-loader"></div>Loading Command Center...</div>';

  // Fetch budget snapshot + STORE in parallel
  Promise.all([
    fetch('/api/dova?sheet=BS').then(function(r) { if (!r.ok) return null; return r.json(); }),
    loadSTORE()
  ]).then(function(results) {
    var budgetData = results[0];
    var rows = results[1];

    // Open DOVA actions from STORE
    var dovaActions = rows.filter(function(r) {
      var proj = (r.project || '').toLowerCase();
      return proj === 'dova' && r.status !== 'Complete';
    });

    // Budget snapshot data
    var budgetRows = budgetData && budgetData.rows ? budgetData.rows : [];
    function findBudget(label) {
      for (var i = 0; i < budgetRows.length; i++) {
        if (budgetRows[i].Item && String(budgetRows[i].Item).toLowerCase().indexOf(label.toLowerCase()) >= 0) {
          return budgetRows[i];
        }
      }
      return null;
    }

    var totalBudget = findBudget('total');
    var designBudget = findBudget('design');
    var constructionBudget = findBudget('construction');
    var contingency = findBudget('contingency');

    function fmt(n) {
      if (n == null || n === '') return '—';
      var v = parseFloat(String(n).replace(/[$,]/g, ''));
      if (isNaN(v)) return n;
      return '$' + Math.round(v / 1000000) + 'M';
    }

    // Build dashboard HTML
    var html = '<div class="mfp-live-badge">DOVA Arena · Sacramento, CA</div>';

    // Row 1: Header
    html += '<div class="mfp-row">';
    html += '<div class="mfp-header-band"><div class="mfp-header-title">DOVA ARENA</div><div class="mfp-header-sub">Owner\'s Rep · Level Up Project Development</div><div class="mfp-header-desc">Multi-purpose arena in Rancho Cordova, CA. 8,032 seats, ~200K SF. Schematic Design phase in progress.</div></div>';
    html += '<div class="mfp-anchor"><div class="mfp-anchor-label">CONSTRUCTION TARGET</div><div class="mfp-anchor-value">Apr 2027</div></div></div>';

    // Row 2: KPI strip
    html += '<div class="mfp-row mfp-kpi-row">';
    var kpis = [
      ['Total Budget', 'TOTAL BUDGET', '', fmt(totalBudget ? totalBudget['Total Budget'] || totalBudget.Amount : null)],
      ['Open Actions', 'OPEN ACTIONS', 'gold', dovaActions.length],
      ['Overdue Items', 'OVERDUE', 'red', dovaActions.filter(function(r){ return r.dueDate && new Date(r.dueDate+'T12:00:00') < new Date(); }).length],
      ['Design Phase', 'PHASE', 'green', 'Schematic Design'],
      ['Site Area', 'SITE', '', '28 acres'],
      ['Seats', 'SEATS', '', '8,032']
    ];
    kpis.forEach(function(kp) {
      html += '<div class="mfp-kpi"><div class="mfp-kpi-label">' + kp[1] + '</div><div class="mfp-kpi-val ' + kp[2] + '">' + kp[3] + '</div></div>';
    });
    html += '</div>';

    // Row 3: Budget breakdown + open actions
    html += '<div class="mfp-row">';
    // Budget summary
    html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Budget Snapshot</div>';
    html += '<table class="chiefs-table"><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>';
    if (budgetRows.length) {
      budgetRows.forEach(function(r) {
        html += '<tr><td class="chiefs-cell-primary">' + escapeHtml(r.Item || '') + '</td><td>' + fmt(r['Total Budget'] || r.Amount) + '</td></tr>';
      });
    } else {
      html += '<tr><td colspan="2" style="color:var(--muted);padding:12px;text-align:center">No budget data loaded</td></tr>';
    }
    html += '</tbody></table></div>';

    // Open actions list
    html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Open Action Items (' + dovaActions.length + ')</div>';
    if (dovaActions.length) {
      html += '<div style="max-height:400px;overflow-y:auto">';
      dovaActions.slice(0, 20).forEach(function(r) {
        var overdue = r.dueDate && new Date(r.dueDate + 'T12:00:00') < new Date();
        html += '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">'
          + '<div style="display:flex;align-items:center;gap:6px">'
          + '<span style="color:' + (overdue ? '#c0392b' : r.status === 'In Progress' ? '#e67e22' : 'var(--muted)') + ';font-size:10px">' + (overdue ? '⚠' : r.status === 'In Progress' ? '◐' : '○') + '</span>'
          + '<span style="flex:1;color:var(--charcoal)">' + escapeHtml(r.actionItem || '') + '</span>'
          + (r.owner ? '<span style="font-size:11px;color:var(--muted);white-space:nowrap">' + escapeHtml(r.owner) + '</span>' : '')
          + (r.dueDate ? '<span style="font-size:11px;color:' + (overdue ? '#c0392b' : 'var(--muted)') + ';white-space:nowrap">' + escapeHtml(r.dueDate) + '</span>' : '')
          + '</div></div>';
      });
      if (dovaActions.length > 20) {
        html += '<div style="padding:8px;text-align:center;font-size:12px;color:var(--muted)">+' + (dovaActions.length - 20) + ' more</div>';
      }
      html += '</div>';
    } else {
      html += '<div style="padding:20px;text-align:center;color:var(--muted)">No open actions</div>';
    }
    html += '</div></div>';

    // Row 4: Key team + milestones
    html += '<div class="mfp-row">';
    html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Key Project Team</div>';
    html += '<table class="chiefs-table"><thead><tr><th>Role</th><th>Firm</th></tr></thead><tbody>';
    var team = [
      ['Owner\'s Rep', 'Level Up Project Development'],
      ['Architect', 'Perkins&Will'],
      ['CM/GC', 'McCarthy'],
      ['Structural', 'TBD'],
      ['MEP', 'TBD']
    ];
    team.forEach(function(t) {
      html += '<tr><td class="chiefs-cell-primary">' + t[0] + '</td><td>' + t[1] + '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Key Milestones</div>';
    html += '<table class="chiefs-table"><thead><tr><th>Milestone</th><th>Date</th><th>Status</th></tr></thead><tbody>';
    var milestones = [
      ['SD Phase Complete', 'Dec 2026', 'In Progress'],
      ['Construction Start', 'Apr 2027', 'Not Started'],
      ['Substantial Completion', 'Apr 2028', 'Not Started']
    ];
    milestones.forEach(function(m) {
      var cls = m[2] === 'Complete' ? 'chiefs-pill-green' : m[2] === 'In Progress' ? 'chiefs-pill-gold' : 'chiefs-pill-gray';
      html += '<tr><td class="chiefs-cell-primary">' + m[0] + '</td><td>' + m[1] + '</td><td><span class="chiefs-pill ' + cls + '">' + m[2] + '</span></td></tr>';
    });
    html += '</tbody></table></div></div>';

    el.innerHTML = html;
  }).catch(function(e) {
    el.innerHTML = '<div style="padding:60px;text-align:center;color:var(--muted)">⚠ Could not load DOVA dashboard: ' + escapeHtml(e.message) + '</div>';
  });
}