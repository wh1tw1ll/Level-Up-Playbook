// ── PREP VIEW — Meeting notes & action items grouped by meeting ──
// Rendered by setView('prep'). Fetches /api/prep for data.

function renderPrepView() {
  var container = document.getElementById('prep-container');
  if (!container) {
    // Create container if view-prep div exists but is empty
    container = document.createElement('div');
    container.id = 'prep-container';
    container.className = 'prep-container';
    var view = document.getElementById('view-prep');
    if (view) {
      view.innerHTML = '';
      view.appendChild(container);
    } else {
      // Fallback: append to body if no view-prep exists
      container.style.position = 'relative';
      document.body.appendChild(container);
    }
  }
  container.innerHTML = '<div class="prep-loading"><div class="luna-spinner"></div> Loading meetings...</div>';

  fetch('/api/prep')
    .then(function(r) {
      if (!r.ok) throw new Error('Server returned ' + r.status);
      return r.json();
    })
    .then(function(data) {
      renderPrepData(container, data);
    })
    .catch(function(err) {
      container.innerHTML = '<div class="prep-empty">⚠ Failed to load prep data: ' + escapeHtml(err.message) + '</div>';
    });
}

function renderPrepData(container, data) {
  var meetings = data.meetings || [];
  var agenda = data.agenda || [];
  var perMeetingAgendas = data.perMeetingAgendas || [];

  var html = '';

  // ── PER-MEETING AGENDAS (coming soon meetings, from generator) ──
  if (perMeetingAgendas.length > 0) {
    html += '<div class="prep-agenda-wrap">';
    html += '<div class="prep-section-title"><span>📋</span> Upcoming Meeting Agendas</div>';
    html += '<div class="prep-meeting-agendas" id="prep-meeting-agendas">';
    perMeetingAgendas.forEach(function(ag) {
      var hasNotes = ag.hasPriorNotes ? '' : 'prep-agenda-lite';
      html += '<div class="prep-agenda-card ' + hasNotes + '" data-subject="' + escapeHtml(ag.meetingSubject) + '">';
      html += '<div class="prep-agenda-card-header" onclick="toggleAgendaCard(this)">';
      html += '<span class="prep-agenda-card-chevron">▶</span>';
      html += '<span class="prep-agenda-card-subject">' + escapeHtml(ag.meetingSubject) + '</span>';
      if (ag.meetingTime) {
        try {
          var dt = new Date(ag.meetingTime);
          var timeStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
          html += '<span class="prep-agenda-card-time">' + escapeHtml(timeStr) + '</span>';
        } catch(e) {
          html += '<span class="prep-agenda-card-time">' + escapeHtml(ag.meetingTime) + '</span>';
        }
      }
      if (!ag.hasPriorNotes) html += '<span class="prep-agenda-badge-lite">No prior context</span>';
      html += '</div>';
      html += '<div class="prep-agenda-card-body" style="display:none"><div class="prep-agenda-card-content">' + ag.agendaHtml + '</div></div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
  }

  // ── 48-HOUR AGENDA SECTION ──
  html += '<div class="prep-agenda-wrap">';
  html += '<div class="prep-section-title"><span>⏰</span> 48-Hour Agenda</div>';
  html += '<div class="prep-agenda" id="prep-agenda">';
  if (agenda.length > 0) {
    // Sort: Whitney items first, then by due date
    var sorted = agenda.slice().sort(function(a, b) {
      var aOwner = (a.owner || '').toLowerCase();
      var bOwner = (b.owner || '').toLowerCase();
      // Whitney first
      if (aOwner.indexOf('whitney') !== -1 && bOwner.indexOf('whitney') === -1) return -1;
      if (aOwner.indexOf('whitney') === -1 && bOwner.indexOf('whitney') !== -1) return 1;
      // Then by due date if available
      if (a.dueDate && b.dueDate) {
        if (a.dueDate < b.dueDate) return -1;
        if (a.dueDate > b.dueDate) return 1;
      }
      return 0;
    });
    sorted.forEach(function(item) {
      var ownerLabel = item.owner ? '<span class="prep-agenda-owner">' + escapeHtml(item.owner) + '</span>' : '';
      var dueLabel = item.dueDate ? '<span class="prep-agenda-due">' + escapeHtml(item.dueDate) + '</span>' : '';
      var statusClass = '';
      var statusLabel = '';
      if (item.status === 'completed' || item.done === true) {
        statusClass = 'prep-status-done';
        statusLabel = '✓ Done';
      } else if (item.status === 'in_progress') {
        statusClass = 'prep-status-progress';
        statusLabel = 'In Progress';
      } else {
        statusClass = 'prep-status-open';
        statusLabel = 'Open';
      }
      html += '<div class="prep-agenda-item">';
      html += '<div class="prep-agenda-text">' + escapeHtml(item.text || item.title || '') + '</div>';
      html += '<div class="prep-agenda-meta">' + ownerLabel + dueLabel + ' <span class="prep-status-badge ' + statusClass + '">' + statusLabel + '</span></div>';
      html += '</div>';
    });
  } else {
    html += '<div class="prep-empty-sm">No priority actions in the next 48 hours.</div>';
  }
  html += '</div>';
  html += '</div>';

  // ── MEETING BROWSER ──
  html += '<div class="prep-browser">';

  // Filter dropdown at top
  html += '<div class="prep-filter-row">';
  html += '<select id="prep-meeting-filter" class="prep-filter-select" onchange="prepFilterMeetings(this.value)">';
  html += '<option value="">All Meetings</option>';
  meetings.forEach(function(m, i) {
    var label = escapeHtml(m.title || 'Meeting ' + (i + 1));
    if (m.date) label += ' — ' + escapeHtml(m.date);
    html += '<option value="' + i + '">' + label + '</option>';
  });
  html += '</select>';
  html += '<span class="prep-meeting-count">' + meetings.length + ' meeting' + (meetings.length !== 1 ? 's' : '') + '</span>';
  html += '</div>';

  // Left sidebar: meeting list
  html += '<div class="prep-sidebar" id="prep-sidebar">';
  meetings.forEach(function(m, i) {
    var label = escapeHtml(m.title || 'Meeting ' + (i + 1));
    var dateStr = m.date ? '<span class="prep-meeting-date">' + escapeHtml(m.date) + '</span>' : '';
    var actionCount = (m.actions || []).length;
    var countBadge = actionCount > 0 ? '<span class="prep-action-count">' + actionCount + '</span>' : '';
    html += '<div class="prep-meeting-item" data-idx="' + i + '" onclick="prepSelectMeeting(' + i + ')">';
    html += '<div class="prep-meeting-item-title">' + escapeHtml(label) + '</div>';
    html += '<div class="prep-meeting-item-meta">' + dateStr + countBadge + '</div>';
    html += '</div>';
  });
  html += '</div>';

  // Right main area: meeting detail
  html += '<div class="prep-main" id="prep-main">';
  html += '<div class="prep-placeholder">Select a meeting from the left to view details.</div>';
  html += '</div>';

  html += '</div>'; // prep-browser

  container.innerHTML = html;

  // Store data for interaction handlers
  container._prepData = data;
  container._prepMeetings = meetings;
}

function prepSelectMeeting(idx) {
  var container = document.getElementById('prep-container');
  if (!container || !container._prepMeetings) return;
  var meetings = container._prepMeetings;
  var meeting = meetings[parseInt(idx)];
  if (!meeting) return;

  // Highlight selected sidebar item
  var items = container.querySelectorAll('.prep-meeting-item');
  items.forEach(function(el) { el.classList.remove('active'); });
  var activeItem = container.querySelector('.prep-meeting-item[data-idx="' + idx + '"]');
  if (activeItem) activeItem.classList.add('active');

  var main = document.getElementById('prep-main');
  if (!main) return;

  var summary = meeting.summary || '';
  var summaryTrunc = summary.length > 500 ? summary.substring(0, 500) + '…' : summary;

  var html = '';

  // Meeting header
  html += '<div class="prep-detail-header">';
  html += '<h2 class="prep-detail-title">' + escapeHtml(meeting.title || 'Meeting') + '</h2>';
  if (meeting.date) {
    html += '<div class="prep-detail-date">' + escapeHtml(meeting.date) + '</div>';
  }
  if (meeting.web_url) {
    html += '<a class="prep-detail-link" href="' + escapeHtml(meeting.web_url) + '" target="_blank" rel="noopener">Open in Granola ↗</a>';
  }
  html += '</div>';

  // Summary
  if (summaryTrunc) {
    html += '<div class="prep-detail-section">';
    html += '<div class="prep-detail-section-title">Summary</div>';
    html += '<div class="prep-detail-summary">' + escapeHtml(summaryTrunc) + '</div>';
    html += '</div>';
  }

  // Action items
  var actions = meeting.actions || [];
  html += '<div class="prep-detail-section">';
  html += '<div class="prep-detail-section-title">Action Items <span class="prep-action-badge">' + actions.length + '</span></div>';
  if (actions.length > 0) {
    html += '<div class="prep-actions-list">';
    actions.forEach(function(a) {
      var ownerStr = a.owner ? '<span class="prep-action-owner">' + escapeHtml(a.owner) + '</span>' : '';
      var statusClass = '';
      var statusLabel = '';
      if (a.status === 'completed' || a.done === true) {
        statusClass = 'prep-status-done';
        statusLabel = '✓ Done';
      } else if (a.status === 'in_progress') {
        statusClass = 'prep-status-progress';
        statusLabel = 'In Progress';
      } else {
        statusClass = 'prep-status-open';
        statusLabel = 'Open';
      }
      html += '<div class="prep-action-item">';
      html += '<div class="prep-action-text">' + escapeHtml(a.text || '') + '</div>';
      html += '<div class="prep-action-meta">' + ownerStr + ' <span class="prep-status-badge ' + statusClass + '">' + statusLabel + '</span></div>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div class="prep-empty-sm">No action items for this meeting.</div>';
  }
  html += '</div>';

  main.innerHTML = html;
}

function toggleAgendaCard(header) {
  var body = header.nextElementSibling;
  if (!body) return;
  var chevron = header.querySelector('.prep-agenda-card-chevron');
  if (body.style.display === 'none' || body.style.display === '') {
    body.style.display = 'block';
    if (chevron) chevron.textContent = '▼';
  } else {
    body.style.display = 'none';
    if (chevron) chevron.textContent = '▶';
  }
}

function prepFilterMeetings(value) {
  var container = document.getElementById('prep-container');
  if (!container || !container._prepMeetings) return;
  var meetings = container._prepMeetings;
  var items = container.querySelectorAll('.prep-meeting-item');

  items.forEach(function(el, i) {
    if (value === '') {
      el.style.display = '';
    } else {
      el.style.display = parseInt(el.getAttribute('data-idx')) === parseInt(value) ? '' : 'none';
    }
  });

  // If filtering to a specific meeting, select it automatically
  if (value !== '') {
    prepSelectMeeting(parseInt(value));
  } else {
    // Clear detail area
    var main = document.getElementById('prep-main');
    if (main) {
      main.innerHTML = '<div class="prep-placeholder">Select a meeting from the left to view details.</div>';
    }
    items.forEach(function(el) { el.classList.remove('active'); });
  }
}

// ── INJECT INLINE STYLES ONCE ──
(function injectPrepStyles() {
  if (document.getElementById('prep-styles')) return;
  var style = document.createElement('style');
  style.id = 'prep-styles';
  style.textContent =
    '.prep-container{' +
      'max-width:1400px;margin:0 auto;padding:24px;flex:1 0 auto;width:100%;' +
    '}' +
    '.prep-loading{' +
      'padding:60px 24px;text-align:center;color:var(--muted);font-size:14px;display:flex;align-items:center;justify-content:center;gap:10px;' +
    '}' +
    '.prep-empty{' +
      'padding:60px 24px;text-align:center;color:var(--muted);font-size:14px;' +
    '}' +
    '.prep-empty-sm{' +
      'padding:20px;text-align:center;color:var(--muted);font-size:13px;' +
    '}' +
    '.prep-section-title{' +
      'font-size:18px;font-weight:700;color:var(--charcoal);margin-bottom:12px;display:flex;align-items:center;gap:8px;' +
    '}' +
    '.prep-agenda-wrap{' +
      'background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:24px;' +
    '}' +
    '.prep-meeting-agendas{' +
      'display:flex;flex-direction:column;gap:4px;' +
    '}' +
    '.prep-agenda-card{' +
      'border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg);' +
    '}' +
    '.prep-agenda-card.prep-agenda-lite{' +
      'border-color:rgba(230,200,124,0.3);background:rgba(230,200,124,0.04);' +
    '}' +
    '.prep-agenda-card-header{' +
      'display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;font-size:13px;' +
      'color:var(--charcoal);font-weight:600;transition:background .12s;user-select:none;' +
    '}' +
    '.prep-agenda-card-header:hover{' +
      'background:var(--teal-light);' +
    '}' +
    '.prep-agenda-card-chevron{' +
      'font-size:10px;color:var(--muted);flex-shrink:0;width:12px;text-align:center;' +
    '}' +
    '.prep-agenda-card-subject{' +
      'flex:1;min-width:0;word-break:break-word;' +
    '}' +
    '.prep-agenda-card-time{' +
      'font-size:11px;color:var(--muted);font-weight:400;white-space:nowrap;flex-shrink:0;' +
    '}' +
    '.prep-agenda-badge-lite{' +
      'font-size:10px;background:rgba(230,200,124,0.15);color:#e6c87c;padding:2px 8px;border-radius:8px;font-weight:600;flex-shrink:0;' +
    '}' +
    '.prep-agenda-card-body{' +
      'border-top:1px solid var(--border);padding:12px 16px;background:var(--card);' +
    '}' +
    '.prep-agenda-card-content{' +
      'font-size:13px;line-height:1.6;color:var(--charcoal);white-space:pre-wrap;' +
    '}' +
    '.prep-agenda-card-content b{' +
      'color:var(--teal);' +
    '}' +
    '.prep-agenda{' +
      'display:flex;flex-direction:column;gap:6px;' +
    '}' +
    '.prep-agenda-item{' +
      'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;gap:12px;flex-wrap:wrap;' +
    '}' +
    '.prep-agenda-text{' +
      'flex:1;font-size:14px;font-weight:600;color:var(--charcoal);min-width:0;word-break:break-word;' +
    '}' +
    '.prep-agenda-meta{' +
      'display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap;' +
    '}' +
    '.prep-agenda-owner{' +
      'font-size:11px;color:var(--muted);background:var(--cool);padding:2px 8px;border-radius:10px;font-weight:600;' +
    '}' +
    '.prep-agenda-due{' +
      'font-size:11px;color:var(--muted);white-space:nowrap;' +
    '}' +
    '.prep-browser{' +
      'display:grid;grid-template-columns:260px 1fr;gap:20px;' +
    '}' +
    '.prep-filter-row{' +
      'grid-column:1 / -1;display:flex;align-items:center;gap:12px;margin-bottom:4px;' +
    '}' +
    '.prep-filter-select{' +
      'padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;background:var(--card);color:var(--charcoal);outline:none;cursor:pointer;max-width:320px;' +
    '}' +
    '.prep-filter-select:focus{' +
      'border-color:var(--teal);' +
    '}' +
    '.prep-meeting-count{' +
      'font-size:12px;color:var(--muted);font-weight:500;' +
    '}' +
    '.prep-sidebar{' +
      'background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:8px;max-height:calc(100vh - 300px);overflow-y:auto;position:sticky;top:116px;' +
    '}' +
    '.prep-meeting-item{' +
      'padding:10px 12px;border-radius:8px;cursor:pointer;transition:background .12s;margin-bottom:2px;' +
    '}' +
    '.prep-meeting-item:hover{' +
      'background:var(--teal-light);' +
    '}' +
    '.prep-meeting-item.active{' +
      'background:var(--teal-light);border-left:3px solid var(--teal);' +
    '}' +
    '.prep-meeting-item-title{' +
      'font-size:13px;font-weight:600;color:var(--charcoal);margin-bottom:2px;line-height:1.3;' +
    '}' +
    '.prep-meeting-item-meta{' +
      'display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);' +
    '}' +
    '.prep-meeting-date{' +
      'font-size:11px;color:var(--muted);' +
    '}' +
    '.prep-action-count{' +
      'background:var(--teal);color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px;' +
    '}' +
    '.prep-main{' +
      'background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;min-height:300px;' +
    '}' +
    '.prep-placeholder{' +
      'padding:40px 20px;text-align:center;color:var(--muted);font-size:14px;' +
    '}' +
    '.prep-detail-header{' +
      'margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);' +
    '}' +
    '.prep-detail-title{' +
      'font-size:20px;font-weight:700;color:var(--charcoal);margin-bottom:4px;' +
    '}' +
    '.prep-detail-date{' +
      'font-size:13px;color:var(--muted);margin-bottom:6px;' +
    '}' +
    '.prep-detail-link{' +
      'display:inline-block;font-size:13px;color:var(--teal);text-decoration:none;font-weight:600;margin-top:4px;' +
    '}' +
    '.prep-detail-link:hover{' +
      'text-decoration:underline;' +
    '}' +
    '.prep-detail-section{' +
      'margin-bottom:20px;' +
    '}' +
    '.prep-detail-section-title{' +
      'font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:10px;display:flex;align-items:center;gap:8px;' +
    '}' +
    '.prep-detail-summary{' +
      'font-size:14px;line-height:1.65;color:var(--charcoal);padding:12px 16px;background:var(--bg);border-radius:8px;border:1px solid var(--border);' +
    '}' +
    '.prep-action-badge{' +
      'background:var(--teal);color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:10px;' +
    '}' +
    '.prep-actions-list{' +
      'display:flex;flex-direction:column;gap:4px;' +
    '}' +
    '.prep-action-item{' +
      'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;gap:12px;flex-wrap:wrap;' +
    '}' +
    '.prep-action-text{' +
      'flex:1;font-size:13px;color:var(--charcoal);word-break:break-word;line-height:1.4;' +
    '}' +
    '.prep-action-meta{' +
      'display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap;' +
    '}' +
    '.prep-action-owner{' +
      'font-size:11px;color:var(--charcoal);background:var(--cool);padding:2px 8px;border-radius:10px;font-weight:600;' +
    '}' +
    '.prep-status-badge{' +
      'font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.04em;display:inline-block;' +
    '}' +
    '.prep-status-open{' +
      'background:#fef4e0;color:#a05c00;' +
    '}' +
    '.prep-status-progress{' +
      'background:#e0f0fe;color:#1a6bc4;' +
    '}' +
    '.prep-status-done{' +
      'background:#e0f5e0;color:#257d25;' +
    '}' +
    '[data-theme="dark"] .prep-status-open{' +
      'background:rgba(160,92,0,0.15);color:#f0c060;' +
    '}' +
    '[data-theme="dark"] .prep-status-progress{' +
      'background:rgba(26,107,196,0.15);color:#7ab8f4;' +
    '}' +
    '[data-theme="dark"] .prep-status-done{' +
      'background:rgba(37,125,37,0.15);color:#6fd96f;' +
    '}' +
    '@media (max-width:800px){' +
      '.prep-browser{grid-template-columns:1fr}' +
      '.prep-sidebar{position:relative;top:0;max-height:none;overflow-y:visible}' +
      '.prep-container{padding:16px}' +
    '}';
  document.head.appendChild(style);
})();