// ── DOVA ARENA DASHBOARD ──
// Professional layout matching dova-dashboard-ten.vercel.app
// Adapted for LUCI dark theme

function renderDovaDashboard() {
  var el = document.getElementById('dova-dashboard');
  if (!el) return;
  el.innerHTML = '<div class="dova-skeleton"><div class="dova-loader"></div>Loading DOVA Dashboard...</div>';

  // Fetch all data in parallel
  Promise.all([
    fetch('/api/client/actions').then(function(r) { if (!r.ok) return null; return r.json(); }),
    fetch('/api/dova?sheet=BS').then(function(r) { if (!r.ok) return null; return r.json(); }),
    fetch('/api/outlook/calendar?days=14').then(function(r) { if (!r.ok) return null; return r.json(); })
  ]).then(function(results) {
    var actionsData = results[0];
    var budgetData = results[1];
    var calData = results[2];

    var rows = (actionsData && actionsData.rows) || [];
    var budgetRows = (budgetData && budgetData.rows) || [];
    var meetings = (calData && calData.value) || [];

    // ── Action item KPIs ──
    var open = rows.filter(function(r) { return r.Status !== 'Complete'; });
    var overdue = open.filter(function(r) { return isOverdue(r['Due Date']); });
    var inProgress = open.filter(function(r) { return r.Status === 'In Progress'; });

    // ── Budget helpers ──
    function findBudget(label) {
      for (var i = 0; i < budgetRows.length; i++) {
        if (budgetRows[i].Item && String(budgetRows[i].Item).toLowerCase().indexOf(label.toLowerCase()) >= 0) {
          return budgetRows[i];
        }
      }
      return null;
    }
    function fmtBudget(n) {
      if (n == null || n === '') return '—';
      var v = parseFloat(String(n).replace(/[$,]/g, ''));
      if (isNaN(v)) return n;
      return '$' + (v / 1000000).toFixed(0) + 'M';
    }

    // ── Build the HTML ──
    var html = '';

    // Top bar
    html += '<div class="dova-topbar">';
    html += '<div class="dova-topbar-title">DOVA Arena — Rancho Cordova, CA</div>';
    html += '<div class="dova-topbar-right">';
    html += '  <span class="dova-live-dot"></span> <span class="dova-live-label">SMARTSHEET</span>';
    html += '  <span class="dova-live-status">Live</span>';
    html += '  <span class="dova-update-time" id="dova-update-time"></span>';
    html += '</div>';
    html += '</div>';

    // Main layout: sidebar + content
    html += '<div class="dova-body">';

    // ── Sidebar ──
    html += '<div class="dova-sidebar">';
    html += '<div class="dova-sidebar-nav">';
    html += '  <button class="dova-nav-tab active" data-dova-view="overview" onclick="switchDovaView(\'overview\')">📊 Overview</button>';
    html += '  <button class="dova-nav-tab" data-dova-view="schedule" onclick="switchDovaView(\'schedule\')">📅 Schedule</button>';
    html += '  <button class="dova-nav-tab" data-dova-view="actions" onclick="switchDovaView(\'actions\')">📝 Action Log <span class="dova-nav-count">' + open.length + '</span></button>';
    html += '  <button class="dova-nav-tab" data-dova-view="budget" onclick="switchDovaView(\'budget\')">💰 Budget</button>';
    html += '</div>';
    html += '<div class="dova-sidebar-footer">Powered by LUCI</div>';
    html += '</div>';

    // ── Content area ──
    html += '<div class="dova-content">';

    // ── OVERVIEW TAB (default) ──
    html += '<div class="dova-view-pane active" id="dova-view-overview">';

    // Row 1: Quick Links + KPIs
    html += '<div class="dova-section-row">';

    // Quick Links card
    html += '<div class="dova-card dova-card-third">';
    html += '<div class="dova-card-header">Quick Links</div>';
    html += '<div class="dova-card-body dova-quick-links">';
    html += '  <a class="dova-quick-link" href="#" onclick="openSharePointFolder(\'Drawings\');return false">📄 Drawings</a>';
    html += '  <a class="dova-quick-link" href="#" onclick="openSharePointFolder(\'Meeting Minutes\');return false">📋 Meeting Minutes</a>';
    html += '  <a class="dova-quick-link" href="#" onclick="showToast(\'Budget file coming soon\', 2000);return false">📊 Budget File <span class="dova-soon">SOON</span></a>';
    html += '  <a class="dova-quick-link" href="#" onclick="showToast(\'Draw package coming soon\', 2000);return false">💰 Current Draw Package <span class="dova-soon">SOON</span></a>';
    html += '</div>';
    html += '</div>';

    // KPI cards
    html += '<div class="dova-card dova-card-third">';
    html += '<div class="dova-card-header">Action Item Summary</div>';
    html += '<div class="dova-card-body dova-kpi-grid">';
    html += '  <div class="dova-kpi"><div class="dova-kpi-label">Open</div><div class="dova-kpi-val gold">' + open.length + '</div></div>';
    html += '  <div class="dova-kpi"><div class="dova-kpi-label">Overdue</div><div class="dova-kpi-val red">' + overdue.length + '</div></div>';
    html += '  <div class="dova-kpi"><div class="dova-kpi-label">In Progress</div><div class="dova-kpi-val blue">' + inProgress.length + '</div></div>';
    html += '  <div class="dova-kpi"><div class="dova-kpi-label">Total</div><div class="dova-kpi-val">' + rows.length + '</div></div>';
    html += '</div>';
    html += '</div>';

    // Priority Action Items (top 5 overdue)
    html += '<div class="dova-card dova-card-third">';
    html += '<div class="dova-card-header">Priority Action Items</div>';
    html += '<div class="dova-card-body dova-priority-list">';
    var priorities = open.sort(function(a,b) {
      var ad = a['Due Date'] || '9999-12-31';
      var bd = b['Due Date'] || '9999-12-31';
      return ad.localeCompare(bd);
    }).slice(0, 5);
    if (priorities.length) {
      priorities.forEach(function(r) {
        var od = isOverdue(r['Due Date']);
        html += '<div class="dova-priority-item">';
        html += '  <span class="dova-priority-dot ' + (od ? 'red' : '') + '"></span>';
        html += '  <span class="dova-priority-text">' + escapeHtml(r['Action ID'] || r.actionItem || '') + '</span>';
        html += '  <span class="dova-priority-meta">' + (r.Owner ? escapeHtml(r.Owner) : '') + (r['Due Date'] ? ' · ' + escapeHtml(r['Due Date']) : '') + '</span>';
        html += '</div>';
      });
    } else {
      html += '<div class="dova-empty">No open action items</div>';
    }
    html += '</div>';
    html += '</div>';

    html += '</div>'; // end section row

    // Row 2: Budget Overview
    html += '<div class="dova-section-title">Budget Overview <a href="#" onclick="switchDovaView(\'budget\');return false">View Full Detail →</a></div>';
    html += '<div class="dova-section-source">Source: <a href="#" onclick="showToast(\'Excel file coming soon\',2000);return false">Excel · 260810_DOVA Master Budget + Draw.xlsx</a></div>';

    // Budget categories
    var budgetCats = [
      { label: 'ARENA', filter: 'arena' },
      { label: 'PUBLIC REALM', filter: 'public realm' },
      { label: 'CUP', filter: 'cup' }
    ];
    budgetCats.forEach(function(cat) {
      var catRow = findBudget(cat.filter);
      html += '<div class="dova-budget-cat">';
      html += '  <div class="dova-budget-cat-label">' + cat.label + '</div>';
      html += '  <div class="dova-budget-row"><span>Hard Cost</span><span class="dova-budget-val">' + fmtBudget(catRow ? catRow['Hard Cost'] || catRow.Amount : null) + '</span></div>';
      html += '  <div class="dova-budget-row"><span>Soft Cost</span><span class="dova-budget-val">' + fmtBudget(catRow ? catRow['Soft Cost'] || '' : null) + '</span></div>';
      html += '  <div class="dova-budget-row"><span>Contingency</span><span class="dova-budget-val">' + fmtBudget(catRow ? catRow.Contingency || '' : null) + '</span></div>';
      html += '  <div class="dova-budget-row dova-budget-total"><span>Total</span><span class="dova-budget-val">' + fmtBudget(catRow ? catRow['Total Budget'] || catRow.Amount : null) + '</span></div>';
      html += '</div>';
    });

    // Grand Total
    var total = findBudget('total') || findBudget('grand');
    html += '<div class="dova-budget-cat dova-budget-grand">';
    html += '  <div class="dova-budget-cat-label">GRAND TOTAL</div>';
    html += '  <div class="dova-budget-row"><span>Hard Cost</span><span class="dova-budget-val">' + fmtBudget(total ? total['Hard Cost'] || '' : null) + '</span></div>';
    html += '  <div class="dova-budget-row"><span>Soft Cost</span><span class="dova-budget-val">' + fmtBudget(total ? total['Soft Cost'] || '' : null) + '</span></div>';
    html += '  <div class="dova-budget-row"><span>Contingency</span><span class="dova-budget-val">' + fmtBudget(total ? total.Contingency || '' : null) + '</span></div>';
    html += '  <div class="dova-budget-row dova-budget-total"><span>Grand Total</span><span class="dova-budget-val">' + fmtBudget(total ? total['Total Budget'] || total.Amount : null) + '</span></div>';
    html += '</div>';

    // Row 3: Near Term Critical Path + Meetings
    html += '<div class="dova-section-title">NEAR TERM CRITICAL PATH ACTIVITIES</div>';
    html += '<div class="dova-section-source">Source: <a href="https://app.smartsheet.com/workspace" target="_blank">Smartsheet · DOVA Overview Schedule</a></div>';

    // Schedule table
    html += '<div class="dova-card">';
    html += '<table class="dova-schedule-table">';
    html += '<thead><tr><th>MILESTONE</th><th>STATUS</th><th>START</th><th>FINISH</th></tr></thead>';
    html += '<tbody>';
    var milestones = [
      ['AOR Interim Agreement Execution', 'In Progress', 'Sep 14, 2026', 'Sep 14, 2026'],
      ['Schematic Design Release', 'Not Started', 'Sep 14, 2026', 'Sep 14, 2026'],
      ['50% SD Package (Rough Grading Permit Set)', 'Not Started', 'Sep 14, 2026', 'Oct 16, 2026'],
      ['100% SD Package', 'Not Started', 'Oct 19, 2026', 'Nov 20, 2026'],
      ['50% DD Package (UG/Utility/Foundation Permit Set)', 'Not Started', 'Nov 23, 2026', 'Jan 1, 2027'],
      ['Superstructure Permit Package', 'Not Started', 'Mar 25, 2027', 'Mar 25, 2027'],
      ['Cultural Resources Report Complete', 'Not Started', 'Oct 12, 2026', 'Oct 23, 2026']
    ];
    milestones.forEach(function(m) {
      var statusClass = 'dova-status-' + m[1].toLowerCase().replace(/\s+/g, '');
      html += '<tr><td class="dova-milestone-name">' + m[0] + '</td><td><span class="dova-status-pill ' + statusClass + '">' + m[1] + '</span></td><td>' + m[2] + '</td><td>' + m[3] + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '</div>';

    // Nearterm Meetings
    html += '<div class="dova-section-title">Nearterm Meetings</div>';
    if (meetings.length) {
      html += '<div class="dova-card">';
      html += '<table class="dova-meetings-table">';
      html += '<thead><tr><th>WHEN</th><th>MEETING</th><th>DURATION</th><th>LOCATION</th></tr></thead>';
      html += '<tbody>';
      var now = new Date();
      var upcomingMeetings = meetings.filter(function(m) {
        var start = new Date(m.start.dateTime || m.start.date);
        return start > now;
      }).sort(function(a,b) {
        return new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date);
      }).slice(0, 10);

      upcomingMeetings.forEach(function(m) {
        var start = new Date(m.start.dateTime || m.start.date);
        var end = new Date(m.end.dateTime || m.end.date);
        var duration = Math.round((end - start) / 60000);
        var when = start.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) + ' · ' + start.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
        var durStr = duration >= 60 ? Math.round(duration/60) + 'h ' + (duration%60) + 'm' : duration + ' min';
        html += '<tr><td class="dova-meeting-when">' + when + '</td><td class="dova-meeting-title">' + escapeHtml(m.subject) + '</td><td>' + durStr + '</td><td>' + escapeHtml(m.location && m.location.displayName ? m.location.displayName : '') + '</td></tr>';
      });
      html += '</tbody></table>';
      html += '<div class="dova-section-source" style="padding:8px 12px">Source: Outlook Calendar · wwilliams@levelup-pd.com · Next 2 weeks</div>';
      html += '</div>';
    } else {
      html += '<div class="dova-empty" style="padding:12px">No upcoming meetings found.</div>';
    }

    html += '</div>'; // end overview pane

    // ── SCHEDULE TAB ──
    html += '<div class="dova-view-pane" id="dova-view-schedule">';
    html += '<div class="dova-section-title">DOVA Overview Schedule</div>';
    html += '<p style="color:var(--muted);font-size:13px;margin-bottom:16px">Full schedule data available in Smartsheet. Key milestones shown in Overview tab.</p>';
    html += '<div class="dova-card"><div class="dova-card-body" style="padding:20px;text-align:center;color:var(--muted)">';
    html += '  <a href="https://app.smartsheet.com/workspace" target="_blank" style="color:var(--accent);text-decoration:none">Open in Smartsheet →</a>';
    html += '</div></div>';
    html += '</div>';

    // ── ACTION LOG TAB ──
    html += '<div class="dova-view-pane" id="dova-view-actions">';
    html += '<div class="dova-section-title">Open Action Items (' + open.length + ')</div>';
    if (open.length) {
      html += '<div class="dova-card"><div class="dova-card-body" style="max-height:600px;overflow-y:auto">';
      open.slice(0, 100).forEach(function(r) {
        var od = isOverdue(r['Due Date']);
        html += '<div class="dova-action-row' + (od ? ' dova-action-overdue' : '') + '">';
        html += '  <span class="dova-action-icon">' + (od ? '⚠' : r.Status === 'In Progress' ? '◐' : '○') + '</span>';
        html += '  <span class="dova-action-text">' + escapeHtml(r['Action ID'] || r.actionItem || '') + '</span>';
        html += '  <span class="dova-action-meta">' + (r.Owner ? '👤 ' + escapeHtml(r.Owner) : '') + '</span>';
        html += '  <span class="dova-action-meta">' + (r['Due Date'] ? '📅 ' + escapeHtml(r['Due Date']) : '') + '</span>';
        html += '</div>';
      });
      if (open.length > 100) {
        html += '<div style="padding:12px;text-align:center;color:var(--muted);font-size:13px">+' + (open.length - 100) + ' more items</div>';
      }
      html += '</div></div>';
    } else {
      html += '<div class="dova-empty">All caught up — no open action items.</div>';
    }
    html += '</div>';

    // ── BUDGET TAB ──
    html += '<div class="dova-view-pane" id="dova-view-budget">';
    html += '<div class="dova-section-title">Budget Snapshot</div>';
    html += '<div class="dova-section-source">Source: <a href="#" onclick="showToast(\'Excel file coming soon\',2000);return false">Excel · 260810_DOVA Master Budget + Draw.xlsx</a></div>';
    if (budgetRows.length) {
      html += '<div class="dova-card">';
      html += '<table class="dova-budget-table">';
      html += '<thead><tr><th>Category</th><th>Hard Cost</th><th>Soft Cost</th><th>Contingency</th><th>Total</th></tr></thead>';
      html += '<tbody>';
      budgetRows.forEach(function(r) {
        html += '<tr><td class="dova-budget-item">' + escapeHtml(r.Item || '') + '</td>';
        html += '<td>' + fmtBudget(r['Hard Cost'] || r.Amount) + '</td>';
        html += '<td>' + fmtBudget(r['Soft Cost'] || '') + '</td>';
        html += '<td>' + fmtBudget(r.Contingency || '') + '</td>';
        html += '<td class="dova-budget-total-cell">' + fmtBudget(r['Total Budget'] || r.Amount) + '</td></tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    } else {
      html += '<div class="dova-empty">No budget data loaded.</div>';
    }
    html += '</div>';

    html += '</div>'; // end content
    html += '</div>'; // end body

    el.innerHTML = html;
    document.getElementById('dova-update-time').textContent = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  }).catch(function(e) {
    el.innerHTML = '<div class="dova-skeleton" style="padding:60px;text-align:center;color:var(--muted)">⚠ Could not load DOVA Dashboard: ' + escapeHtml(e.message) + '</div>';
  });
}

// ── Tab switching ──
function switchDovaView(view) {
  document.querySelectorAll('.dova-nav-tab').forEach(function(t) { t.classList.remove('active'); });
  var tab = document.querySelector('.dova-nav-tab[data-dova-view="' + view + '"]');
  if (tab) tab.classList.add('active');
  document.querySelectorAll('.dova-view-pane').forEach(function(p) { p.classList.remove('active'); });
  var pane = document.getElementById('dova-view-' + view);
  if (pane) pane.classList.add('active');
}

// ── SharePoint folder opener ──
function openSharePointFolder(folderName) {
  // Redirect to SharePoint documents — specific folder TBD
  showToast(folderName + ' — SharePoint integration coming soon', 2000);
}

// ── Overdue helper (shared with client dashboard) ──
function isOverdue(d) {
  if (!d) return false;
  return new Date(d + 'T12:00:00') < new Date();
}