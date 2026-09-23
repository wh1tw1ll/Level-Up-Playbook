// ── PREP VIEW v2 — Upcoming meetings + Generate + post-meeting notes ──
// Calls /api/prep for stored agendas + meetings, /api/prep/upcoming for calendar events

function renderPrepView() {
  var container = document.getElementById('prep-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'prep-container';
    container.className = 'prep-container';
    var view = document.getElementById('view-prep');
    if (view) { view.innerHTML = ''; view.appendChild(container); }
    else { document.body.appendChild(container); }
  }
  container.innerHTML = '<div class="prep-loading"><div class="luna-spinner"></div> Loading prep data...</div>';

  // Fetch both endpoints in parallel
  Promise.all([
    fetch('/api/prep').then(function(r) { if (!r.ok) throw new Error('Prep API ' + r.status); return r.json(); }),
    fetch('/api/prep/upcoming').then(function(r) { if (!r.ok) throw new Error('Upcoming API ' + r.status); return r.json(); }),
  ])
    .then(function(results) {
      var prepData = results[0];
      var upcomingData = results[1];
      renderPrepFull(container, prepData, upcomingData);
    })
    .catch(function(err) {
      container.innerHTML = '<div class="prep-empty">⚠ Failed to load prep data: ' + escapeHtml(err.message) + '</div>';
    });
}

// ── Expose to window for onclick handlers ──
window.renderPrepView = renderPrepView;

// ── RENDER ──
function renderPrepFull(container, prepData, upcomingData) {
  var meetings = prepData.meetings || [];
  var agenda = prepData.agenda || {};
  var perMeetingAgendas = prepData.perMeetingAgendas || [];
  var upcomingEvents = upcomingData.events || [];
  var pastEvents = upcomingData.past || [];
  var allAgendas = upcomingData.allAgendas || [];

  var html = '';

  // ── UPCOMING MEETINGS SECTION ──
  html += '<div class="prep-upcoming-wrap">';
  html += '<div class="prep-section-title">';
  html += '<span>📅</span> Upcoming Meetings';
  if (upcomingEvents.length > 0) {
    html += '<button class="prep-gen-all-btn" onclick="generateAllAgendas()">Generate All Agendas</button>';
  }
  html += '</div>';

  if (upcomingEvents.length > 0) {
    html += '<div class="prep-upcoming-list">';
    upcomingEvents.forEach(function(ev, i) {
      var timeStr = '';
      try {
        var dt = new Date(ev.start);
        timeStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      } catch(e) { timeStr = ev.start; }

      var locationHtml = ev.location ? '<span class="prep-ev-loc">📍 ' + escapeHtml(ev.location) + '</span>' : '';
      var attendeeHtml = '';
      if (ev.attendees && ev.attendees.length > 0) {
        var names = ev.attendees.slice(0, 4).map(function(a) { return escapeHtml(a.name || a.email || ''); }).join(', ');
        if (ev.attendees.length > 4) names += ' +' + (ev.attendees.length - 4);
        attendeeHtml = '<span class="prep-ev-attendees">👥 ' + names + '</span>';
      }

      var cardClass = ev.hasAgenda ? 'prep-upcoming-card has-agenda' : 'prep-upcoming-card';

      html += '<div class="' + cardClass + '" data-event-id="' + escapeHtml(ev.eventId || '') + '">';
      html += '<div class="prep-upcoming-header">';
      html += '<div class="prep-upcoming-info">';
      html += '<div class="prep-upcoming-subject">' + escapeHtml(ev.subject) + '</div>';
      html += '<div class="prep-upcoming-time">' + timeStr + '</div>';
      html += '</div>';
      html += '<div class="prep-upcoming-actions">';

      // Show "Regenerate" if already has an agenda, "Generate" otherwise
      if (ev.hasAgenda) {
        html += '<button class="prep-regenerate-btn" onclick="generateMeetingAgenda(\'' + escapeHtml(ev.eventId) + '\', \'' + escapeHtmlAttr(ev.subject) + '\', \'' + escapeHtmlAttr(ev.start) + '\')">🔄 Regenerate</button>';
        html += '<button class="prep-toggle-agenda-btn" onclick="toggleUpcomingAgenda(this)">📋 Show Agenda</button>';
      } else {
        html += '<button class="prep-generate-btn" onclick="generateMeetingAgenda(\'' + escapeHtml(ev.eventId) + '\', \'' + escapeHtmlAttr(ev.subject) + '\', \'' + escapeHtmlAttr(ev.start) + '\')">Generate</button>';
      }

      html += '</div>'; // actions
      html += '</div>'; // header

      // Additional info row
      html += '<div class="prep-upcoming-meta">' + locationHtml + ' ' + attendeeHtml + '</div>';

      // Agenda body (hidden unless toggled)
      if (ev.hasAgenda && ev.agendaHtml) {
        html += '<div class="prep-upcoming-agenda" style="display:none">';
        html += '<div class="prep-upcoming-agenda-content">' + ev.agendaHtml + '</div>';
        html += '</div>';
      }

      // Generate status (shown after clicking generate)
      html += '<div class="prep-gen-status" style="display:none"></div>';

      html += '</div>'; // card
    });
    html += '</div>';
  } else {
    html += '<div class="prep-empty-sm">No upcoming meetings in the next 72 hours.</div>';
  }
  html += '</div>';

  // ── GENERATED AGENDA CARDS (from database) ──
  if (perMeetingAgendas.length > 0) {
    html += '<div class="prep-agenda-wrap">';
    html += '<div class="prep-section-title"><span>📋</span> Generated Agendas <span class="prep-count-badge">' + perMeetingAgendas.length + '</span></div>';
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
      html += '<div class="prep-agenda-card-body" style="display:none"><div class="prep-agenda-card-content">' + (ag.agendaHtml || 'No agenda generated yet.') + '</div></div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
  }

  // ── 48-HOUR AGENDA ──
  var upcomingActions = agenda.upcomingActions || [];
  html += '<div class="prep-agenda-wrap">';
  html += '<div class="prep-section-title"><span>⏰</span> 48-Hour Agenda <span class="prep-count-badge">' + upcomingActions.length + '</span></div>';
  html += '<div class="prep-agenda" id="prep-agenda">';
  if (upcomingActions.length > 0) {
    var sorted = upcomingActions.slice().sort(function(a, b) {
      var aOwner = (a.owner || '').toLowerCase();
      var bOwner = (b.owner || '').toLowerCase();
      if (aOwner.indexOf('whitney') !== -1 && bOwner.indexOf('whitney') === -1) return -1;
      if (aOwner.indexOf('whitney') === -1 && bOwner.indexOf('whitney') !== -1) return 1;
      return 0;
    });
    sorted.forEach(function(item) {
      var ownerLabel = item.owner ? '<span class="prep-agenda-owner">' + escapeHtml(item.owner) + '</span>' : '';
      var statusClass = '';
      var statusLabel = '';
      if (item.status === 'completed' || item.done === true) {
        statusClass = 'prep-status-done'; statusLabel = '✓ Done';
      } else if (item.status === 'in_progress') {
        statusClass = 'prep-status-progress'; statusLabel = 'In Progress';
      } else {
        statusClass = 'prep-status-open'; statusLabel = 'Open';
      }
      html += '<div class="prep-agenda-item">';
      html += '<div class="prep-agenda-text">' + escapeHtml(item.text || item.title || item.actionText || '') + '</div>';
      html += '<div class="prep-agenda-meta">' + ownerLabel + ' <span class="prep-status-badge ' + statusClass + '">' + statusLabel + '</span></div>';
      html += '</div>';
    });
  } else {
    html += '<div class="prep-empty-sm">No priority actions in the next 48 hours.</div>';
  }
  html += '</div>';
  html += '</div>';

  // ── MEETING BROWSER (post-meeting notes) ──
  html += '<div class="prep-section-title"><span>📝</span> Past Meeting Notes <span class="prep-count-badge">' + meetings.length + '</span></div>';
  html += '<div class="prep-browser">';

  // Filter
  html += '<div class="prep-filter-row">';
  html += '<select id="prep-meeting-filter" class="prep-filter-select" onchange="prepFilterMeetings(this.value)">';
  html += '<option value="">All Notes</option>';
  meetings.forEach(function(m, i) {
    var label = escapeHtml(m.title || 'Meeting ' + (i + 1));
    if (m.date) label += ' — ' + escapeHtml(m.date.substring(0, 10));
    html += '<option value="' + i + '">' + label + '</option>';
  });
  html += '</select>';
  html += '<span class="prep-meeting-count">' + meetings.length + ' note' + (meetings.length !== 1 ? 's' : '') + '</span>';
  html += '</div>';

  // Sidebar
  html += '<div class="prep-sidebar" id="prep-sidebar">';
  meetings.forEach(function(m, i) {
    var label = escapeHtml(m.title || 'Meeting ' + (i + 1));
    var dateStr = m.date ? '<span class="prep-meeting-date">' + escapeHtml(m.date.substring(0, 10)) + '</span>' : '';
    var actionCount = (m.actions || []).length;
    var countBadge = actionCount > 0 ? '<span class="prep-action-count">' + actionCount + '</span>' : '';
    html += '<div class="prep-meeting-item" data-idx="' + i + '" onclick="prepSelectMeeting(' + i + ')">';
    html += '<div class="prep-meeting-item-title">' + label + '</div>';
    html += '<div class="prep-meeting-item-meta">' + dateStr + countBadge + '</div>';
    html += '</div>';
  });
  html += '</div>';

  // Main detail
  html += '<div class="prep-main" id="prep-main">';
  html += '<div class="prep-placeholder">Select a meeting from the sidebar to view notes and action items.</div>';
  html += '</div>';

  html += '</div>'; // prep-browser

  container.innerHTML = html;
  container._prepData = prepData;
  container._prepMeetings = meetings;
  container._upcomingEvents = upcomingEvents;
}

// ── UPCOMING MEETING ACTIONS ──

function generateMeetingAgenda(eventId, subject, startTime) {
  var button = event.target || document.activeElement;
  var card = button ? button.closest('.prep-upcoming-card') : null;
  var statusEl = card ? card.querySelector('.prep-gen-status') : null;
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = '⏳ Sending generation request...';
    statusEl.className = 'prep-gen-status prep-gen-pending';
  }

  fetch('/api/prep/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meetingSubject: subject,
      meetingTime: startTime,
      eventId: eventId,
    }),
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (statusEl) {
        if (data.success) {
          statusEl.innerHTML = '✅ ' + escapeHtml(data.message) + ' (check back in ~30 min)';
          statusEl.className = 'prep-gen-status prep-gen-success';
          // Disable the button so user can't spam
          if (button) button.disabled = true;
        } else {
          statusEl.innerHTML = '❌ Failed: ' + escapeHtml(data.error || 'Unknown error');
          statusEl.className = 'prep-gen-status prep-gen-error';
        }
      }
    })
    .catch(function(err) {
      if (statusEl) {
        statusEl.innerHTML = '❌ Network error: ' + escapeHtml(err.message);
        statusEl.className = 'prep-gen-status prep-gen-error';
      }
    });
}
window.generateMeetingAgenda = generateMeetingAgenda;

function generateAllAgendas() {
  var container = document.getElementById('prep-container');
  if (!container || !container._upcomingEvents) return;
  var events = container._upcomingEvents;
  var count = 0;
  events.forEach(function(ev) {
    if (!ev.hasAgenda) {
      // Find the card and trigger generation
      var card = container.querySelector('.prep-upcoming-card[data-event-id="' + escapeHtmlAttr(ev.eventId) + '"]');
      if (card) {
        var btn = card.querySelector('.prep-generate-btn');
        if (btn) {
          btn.click();
          count++;
        }
      }
    }
  });
  var statusEl = container.querySelector('.prep-gen-status:last-child');
  if (statusEl) {
    statusEl.innerHTML = '📋 Generating agendas for ' + count + ' meeting(s)...';
    statusEl.style.display = 'block';
  }
}
window.generateAllAgendas = generateAllAgendas;

function toggleUpcomingAgenda(btn) {
  var card = btn.closest('.prep-upcoming-card');
  if (!card) return;
  var body = card.querySelector('.prep-upcoming-agenda');
  if (body) {
    if (body.style.display === 'none' || body.style.display === '') {
      body.style.display = 'block';
      btn.textContent = '📋 Hide Agenda';
    } else {
      body.style.display = 'none';
      btn.textContent = '📋 Show Agenda';
    }
  }
}
window.toggleUpcomingAgenda = toggleUpcomingAgenda;

// ── MEETING BROWSER ──

function prepSelectMeeting(idx) {
  var container = document.getElementById('prep-container');
  if (!container || !container._prepMeetings) return;
  var meetings = container._prepMeetings;
  var meeting = meetings[parseInt(idx)];
  if (!meeting) return;

  var items = container.querySelectorAll('.prep-meeting-item');
  items.forEach(function(el) { el.classList.remove('active'); });
  var activeItem = container.querySelector('.prep-meeting-item[data-idx="' + idx + '"]');
  if (activeItem) activeItem.classList.add('active');

  var main = document.getElementById('prep-main');
  if (!main) return;

  var summary = meeting.summary || '';
  var summaryFull = summary;

  var html = '';
  html += '<div class="prep-detail-header">';
  html += '<h2 class="prep-detail-title">' + escapeHtml(meeting.title || 'Meeting') + '</h2>';
  if (meeting.date) {
    html += '<div class="prep-detail-date">' + escapeHtml(new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })) + '</div>';
  }
  if (meeting.web_url) {
    html += '<a class="prep-detail-link" href="' + escapeHtml(meeting.web_url) + '" target="_blank" rel="noopener">Open in Granola ↗</a>';
  }
  html += '</div>';

  // Notes section
  html += '<div class="prep-detail-section">';
  html += '<div class="prep-detail-section-title">📝 Notes</div>';
  if (summaryFull) {
    html += '<div class="prep-detail-summary">' + escapeHtml(summaryFull) + '</div>';
  } else {
    html += '<div class="prep-empty-sm">No Granola notes for this meeting.</div>';
  }
  html += '</div>';

  // Action items
  var actions = meeting.actions || [];
  html += '<div class="prep-detail-section">';
  html += '<div class="prep-detail-section-title">✅ Action Items <span class="prep-action-badge">' + actions.length + '</span></div>';
  if (actions.length > 0) {
    html += '<div class="prep-actions-list">';
    actions.forEach(function(a) {
      var ownerStr = a.owner ? '<span class="prep-action-owner">' + escapeHtml(a.owner) + '</span>' : '';
      var statusClass = '';
      var statusLabel = '';
      if (a.status === 'completed' || a.done === true) {
        statusClass = 'prep-status-done'; statusLabel = '✓ Done';
      } else if (a.status === 'in_progress') {
        statusClass = 'prep-status-progress'; statusLabel = 'In Progress';
      } else {
        statusClass = 'prep-status-open'; statusLabel = 'Open';
      }
      html += '<div class="prep-action-item">';
      html += '<div class="prep-action-text">' + escapeHtml(a.text || a.actionText || '') + '</div>';
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
window.prepSelectMeeting = prepSelectMeeting;

function prepFilterMeetings(value) {
  var container = document.getElementById('prep-container');
  if (!container || !container._prepMeetings) return;
  var items = container.querySelectorAll('.prep-meeting-item');
  items.forEach(function(el, i) {
    if (value === '') {
      el.style.display = '';
    } else {
      el.style.display = parseInt(el.getAttribute('data-idx')) === parseInt(value) ? '' : 'none';
    }
  });
  if (value !== '') {
    prepSelectMeeting(parseInt(value));
  } else {
    var main = document.getElementById('prep-main');
    if (main) main.innerHTML = '<div class="prep-placeholder">Select a meeting from the sidebar to view notes and action items.</div>';
    items.forEach(function(el) { el.classList.remove('active'); });
  }
}
window.prepFilterMeetings = prepFilterMeetings;

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
window.toggleAgendaCard = toggleAgendaCard;

// ── HELPERS ──
function escapeHtml(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeHtmlAttr(s) {
  if (!s) return '';
  return escapeHtml(s).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

// ── INJECT STYLES ──
(function injectPrepStyles() {
  if (document.getElementById('prep-styles-v2')) return;
  var style = document.createElement('style');
  style.id = 'prep-styles-v2';
  style.textContent =
    '.prep-container{max-width:1400px;margin:0 auto;padding:24px;flex:1 0 auto;width:100%}' +
    '.prep-loading{padding:60px 24px;text-align:center;color:var(--muted);font-size:14px;display:flex;align-items:center;justify-content:center;gap:10px}' +
    '.prep-empty{padding:60px 24px;text-align:center;color:var(--muted);font-size:14px}' +
    '.prep-empty-sm{padding:20px;text-align:center;color:var(--muted);font-size:13px}' +
    '.prep-section-title{font-size:18px;font-weight:700;color:var(--charcoal);margin-bottom:12px;display:flex;align-items:center;gap:8px}' +
    '.prep-count-badge{background:var(--teal);color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:10px}' +
    // Upcoming meetings
    '.prep-upcoming-wrap{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:24px}' +
    '.prep-upcoming-list{display:flex;flex-direction:column;gap:8px}' +
    '.prep-upcoming-card{border:1px solid var(--border);border-radius:8px;padding:12px 16px;background:var(--bg)}' +
    '.prep-upcoming-card.has-agenda{border-color:var(--teal);border-left:3px solid var(--teal)}' +
    '.prep-upcoming-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}' +
    '.prep-upcoming-info{flex:1;min-width:0}' +
    '.prep-upcoming-subject{font-size:14px;font-weight:600;color:var(--charcoal);margin-bottom:2px}' +
    '.prep-upcoming-time{font-size:12px;color:var(--muted)}' +
    '.prep-upcoming-actions{display:flex;gap:6px;flex-shrink:0;align-items:center}' +
    '.prep-upcoming-meta{font-size:11px;color:var(--muted);margin-top:6px;display:flex;gap:12px;flex-wrap:wrap}' +
    '.prep-ev-loc{white-space:nowrap}' +
    '.prep-ev-attendees{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px}' +
    '.prep-generate-btn{padding:5px 14px;border:none;border-radius:6px;background:var(--teal);color:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .12s}' +
    '.prep-generate-btn:hover{opacity:.85}' +
    '.prep-generate-btn:disabled{opacity:.4;cursor:default}' +
    '.prep-regenerate-btn{padding:5px 14px;border:1px solid var(--teal);border-radius:6px;background:transparent;color:var(--teal);font-size:12px;font-weight:600;cursor:pointer}' +
    '.prep-toggle-agenda-btn{padding:5px 14px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--charcoal);font-size:12px;font-weight:500;cursor:pointer}' +
    '.prep-upcoming-agenda{border-top:1px solid var(--border);margin-top:10px;padding-top:10px}' +
    '.prep-upcoming-agenda-content{font-size:13px;line-height:1.6;white-space:pre-wrap}' +
    '.prep-upcoming-agenda-content b{color:var(--teal)}' +
    '.prep-gen-status{font-size:12px;margin-top:8px;padding:6px 10px;border-radius:6px}' +
    '.prep-gen-pending{background:rgba(230,200,124,0.1);color:#e6c87c}' +
    '.prep-gen-success{background:rgba(100,200,100,0.1);color:#6dd66d}' +
    '.prep-gen-error{background:rgba(200,80,80,0.1);color:#e06060}' +
    '.prep-gen-all-btn{padding:6px 16px;border:none;border-radius:6px;background:var(--teal);color:#fff;font-size:12px;font-weight:600;cursor:pointer;margin-left:auto}' +
    // Agenda cards
    '.prep-agenda-wrap{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:24px}' +
    '.prep-meeting-agendas{display:flex;flex-direction:column;gap:4px}' +
    '.prep-agenda-card{border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg)}' +
    '.prep-agenda-card.prep-agenda-lite{border-color:rgba(230,200,124,0.3);background:rgba(230,200,124,0.04)}' +
    '.prep-agenda-card-header{display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;font-size:13px;color:var(--charcoal);font-weight:600;transition:background .12s;user-select:none}' +
    '.prep-agenda-card-header:hover{background:var(--teal-light)}' +
    '.prep-agenda-card-chevron{font-size:10px;color:var(--muted);flex-shrink:0;width:12px;text-align:center}' +
    '.prep-agenda-card-subject{flex:1;min-width:0;word-break:break-word}' +
    '.prep-agenda-card-time{font-size:11px;color:var(--muted);font-weight:400;white-space:nowrap;flex-shrink:0}' +
    '.prep-agenda-badge-lite{font-size:10px;background:rgba(230,200,124,0.15);color:#e6c87c;padding:2px 8px;border-radius:8px;font-weight:600}' +
    '.prep-agenda-card-body{border-top:1px solid var(--border);padding:12px 16px;background:var(--card)}' +
    '.prep-agenda-card-content{font-size:13px;line-height:1.6;color:var(--charcoal);white-space:pre-wrap}' +
    '.prep-agenda-card-content b{color:var(--teal)}' +
    // 48-hour agenda items
    '.prep-agenda{display:flex;flex-direction:column;gap:6px}' +
    '.prep-agenda-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;gap:12px;flex-wrap:wrap}' +
    '.prep-agenda-text{flex:1;font-size:14px;font-weight:600;color:var(--charcoal);min-width:0;word-break:break-word}' +
    '.prep-agenda-meta{display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap}' +
    '.prep-agenda-owner{font-size:11px;color:var(--muted);background:var(--cool);padding:2px 8px;border-radius:10px;font-weight:600}' +
    // Meeting browser
    '.prep-browser{display:grid;grid-template-columns:240px 1fr;gap:16px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:24px}' +
    '.prep-filter-row{grid-column:1 / -1;display:flex;align-items:center;gap:12px;margin-bottom:4px}' +
    '.prep-filter-select{padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:inherit;background:var(--card);color:var(--charcoal);outline:none;cursor:pointer}' +
    '.prep-filter-select:focus{border-color:var(--teal)}' +
    '.prep-meeting-count{font-size:12px;color:var(--muted);font-weight:500}' +
    '.prep-sidebar{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px;max-height:calc(100vh - 350px);overflow-y:auto}' +
    '.prep-meeting-item{padding:8px 10px;border-radius:6px;cursor:pointer;transition:background .12s;margin-bottom:2px}' +
    '.prep-meeting-item:hover{background:var(--teal-light)}' +
    '.prep-meeting-item.active{background:var(--teal-light);border-left:3px solid var(--teal)}' +
    '.prep-meeting-item-title{font-size:12px;font-weight:600;color:var(--charcoal);line-height:1.3}' +
    '.prep-meeting-item-meta{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)}' +
    '.prep-action-count{background:var(--teal);color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px}' +
    '.prep-main{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:16px 20px;min-height:250px}' +
    '.prep-placeholder{padding:40px 20px;text-align:center;color:var(--muted);font-size:14px}' +
    '.prep-detail-header{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)}' +
    '.prep-detail-title{font-size:18px;font-weight:700;color:var(--charcoal);margin-bottom:4px}' +
    '.prep-detail-date{font-size:12px;color:var(--muted)}' +
    '.prep-detail-link{display:inline-block;font-size:12px;color:var(--teal);text-decoration:none;font-weight:600}' +
    '.prep-detail-link:hover{text-decoration:underline}' +
    '.prep-detail-section{margin-bottom:16px}' +
    '.prep-detail-section-title{font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:8px;display:flex;align-items:center;gap:8px}' +
    '.prep-detail-summary{font-size:13px;line-height:1.6;color:var(--charcoal);padding:10px 14px;background:var(--card);border-radius:6px;border:1px solid var(--border)}' +
    '.prep-action-badge{background:var(--teal);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px}' +
    '.prep-actions-list{display:flex;flex-direction:column;gap:4px}' +
    '.prep-action-item{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--card);border:1px solid var(--border);border-radius:6px;gap:10px;flex-wrap:wrap}' +
    '.prep-action-text{flex:1;font-size:12px;color:var(--charcoal);word-break:break-word}' +
    '.prep-action-meta{display:flex;align-items:center;gap:8px;flex-shrink:0}' +
    '.prep-action-owner{font-size:11px;color:var(--charcoal);background:var(--cool);padding:1px 6px;border-radius:8px;font-weight:600}' +
    '.prep-status-badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;text-transform:uppercase;letter-spacing:.04em;display:inline-block}' +
    '.prep-status-open{background:#fef4e0;color:#a05c00}' +
    '.prep-status-progress{background:#e0f0fe;color:#1a6bc4}' +
    '.prep-status-done{background:#e0f5e0;color:#257d25}' +
    '[data-theme="dark"] .prep-status-open{background:rgba(160,92,0,0.15);color:#f0c060}' +
    '[data-theme="dark"] .prep-status-progress{background:rgba(26,107,196,0.15);color:#7ab8f4}' +
    '[data-theme="dark"] .prep-status-done{background:rgba(37,125,37,0.15);color:#6fd96f}' +
    '@media (max-width:800px){.prep-browser{grid-template-columns:1fr}.prep-sidebar{max-height:none}.prep-container{padding:16px}}';
  document.head.appendChild(style);
})();