// ── TASKS VIEW — Inline widget reading from STORE ──
// Loaded via app-tasks.js after app-core, app-playbook, app-projects

function renderTasksView() {
  var el = document.getElementById('tasks-widget');
  if (!el) return;
  el.innerHTML = '<div style="padding:60px 24px;text-align:center"><div class="luna-spinner"></div> <span style="color:var(--muted);font-size:14px">Loading tasks...</span></div>';

  loadSTORE().then(function(rows) {
    // Build filter and sort
    var filtered = rows.filter(function(r) {
      if (r.status === 'Complete') return false;
      // Exclude meeting notes by default
      var cat = (r.category || '').toLowerCase();
      if (cat === 'meeting note') return false;
      return true;
    });

    // Sort: by due date (null last), then by project
    filtered.sort(function(a, b) {
      var ad = a.dueDate || '9999-12-31';
      var bd = b.dueDate || '9999-12-31';
      if (ad !== bd) return ad.localeCompare(bd);
      return (a.project || '').localeCompare(b.project || '');
    });

    // Group by project
    var groups = {};
    filtered.forEach(function(r) {
      var proj = r.project || 'Unassigned';
      if (!groups[proj]) groups[proj] = [];
      groups[proj].push(r);
    });

    // Build project order
    var projectOrder = ['DOVA', 'MFP', 'Business', 'Sphere', 'Level Up', 'Unassigned'];

    var html = '<div style="padding:0 24px 24px;max-width:1000px">';

    // Count stats
    var projectCounts = {};
    filtered.forEach(function(r) {
      var p = r.project || 'Unassigned';
      projectCounts[p] = (projectCounts[p] || 0) + 1;
    });
    html += '<div style="font-size:13px;color:var(--muted);margin-bottom:16px">'
      + filtered.length + ' open tasks · '
      + Object.keys(projectCounts).length + ' projects'
      + '</div>';

    // Render tasks grouped by project
    projectOrder.forEach(function(proj) {
      var items = groups[proj];
      if (!items) return;
      html += '<div style="margin-bottom:20px">'
        + '<div style="font-size:15px;font-weight:700;color:var(--charcoal);margin-bottom:8px;display:flex;align-items:center;gap:8px">'
        + '<span class="proj-badge" style="background:var(--teal-light);color:var(--teal);font-size:11px;padding:2px 10px;border-radius:12px">'
        + proj + '</span>'
        + '<span style="font-size:12px;color:var(--muted);font-weight:400">' + items.length + '</span>'
        + '</div>';

      items.slice(0, 50).forEach(function(r) {
        var overdue = r.dueDate && new Date(r.dueDate + 'T12:00:00') < new Date();
        var hot = r.hotTopic;
        var statusColor = r.status === 'In Progress' ? '#e67e22' : overdue ? '#c0392b' : 'var(--muted)';
        var statusIcon = r.status === 'In Progress' ? '◐' : overdue ? '⚠' : '○';

        html += '<div class="task-card" style="background:var(--card);border:1px solid ' + (overdue ? '#c0392b33' : hot ? '#e67e2233' : 'var(--border)') + ';border-radius:8px;padding:10px 14px;margin-bottom:4px;display:flex;align-items:flex-start;gap:10px;transition:background .15s">'
          + '<button class="task-status-btn" onclick="taskCycleStatus(' + r.rowId + ')" style="flex:0 0 20px;width:20px;height:20px;border:1.5px solid ' + statusColor + ';border-radius:4px;background:none;color:' + statusColor + ';cursor:pointer;font-size:12px;font-weight:600;padding:0;margin-top:2px;display:flex;align-items:center;justify-content:center" title="Click to cycle: Not Started → In Progress → Complete">' + statusIcon + '</button>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:14px;font-weight:500;color:var(--charcoal);line-height:1.4;word-break:break-word">' + escapeHtml(r.actionItem || '') + '</div>'
          + '<div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;align-items:center">'
          + (r.owner ? '<span style="font-size:11px;color:var(--muted)">👤 ' + escapeHtml(r.owner) + '</span>' : '')
          + (r.dueDate ? '<span style="font-size:11px;color:' + (overdue ? '#c0392b' : 'var(--muted)') + ';font-weight:' + (overdue ? '700' : '400') + '">📅 ' + escapeHtml(r.dueDate) + '</span>' : '')
          + (r.responsibleFirm ? '<span style="font-size:11px;color:var(--muted)">🏢 ' + escapeHtml(r.responsibleFirm) + '</span>' : '')
          + (r.hotTopic ? '<span style="font-size:10px;background:var(--danger);color:#fff;padding:1px 6px;border-radius:4px;font-weight:600">🔥</span>' : '')
          + (r.status && r.status !== 'Not Started' ? '<span style="font-size:11px;color:' + (r.status === 'In Progress' ? '#e67e22' : '#27ae60') +';font-weight:600">' + escapeHtml(r.status) + '</span>' : '')
          + '</div>'
          + (r.statusNote ? '<div style="font-size:12px;color:var(--muted);margin-top:3px;font-style:italic">' + escapeHtml(r.statusNote) + '</div>' : '')
          + '</div>'
          + '</div>';
      });
      html += '</div>';
    });

    // Empty state
    if (!filtered.length) {
      html = '<div style="padding:60px 24px;text-align:center;color:var(--muted)">'
        + '<div style="font-size:40px;margin-bottom:12px">✅</div>'
        + '<div style="font-size:16px;font-weight:600;color:var(--charcoal)">All caught up</div>'
        + '<div style="font-size:13px;margin-top:4px">No open action items in the tracker.</div>'
        + '</div>';
    }

    html += '</div>';

    // Add widget styles once
    if (!document.getElementById('tasks-widget-style')) {
      var style = document.createElement('style');
      style.id = 'tasks-widget-style';
      style.textContent = '.task-card:hover{background:var(--hover)!important}.task-status-btn:hover{opacity:.8}';
      document.head.appendChild(style);
    }

    el.innerHTML = html;

  }).catch(function(e) {
    el.innerHTML = '<div style="padding:60px 24px;text-align:center;color:var(--muted)">⚠ Error: ' + escapeHtml(e.message) + '</div>';
  });
}

// ── Task status cycle ──
function taskCycleStatus(rowId) {
  var row = STORE.rows.find(function(r) { return String(r.rowId) === String(rowId); });
  if (!row) return;
  var next = row.status === 'In Progress' ? 'Complete' : row.status === 'Complete' ? 'Not Started' : 'In Progress';
  fetch('/api/tasks/' + rowId + '?source=' + (row.source || 'project'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: next })
  }).then(function() {
    // Update STORE locally
    row.status = next;
    renderTasksView();
  }).catch(function() {
    renderTasksView();
  });
}