// ── PREP VIEW v3 — Unified meeting list ──
// One list: click a meeting → generate agenda (upcoming) or view full notes (past).
// Agenda export to Word (.doc) client-side. No separate stacked sections.
// Calls /api/prep for stored agendas + past notes, /api/prep/upcoming for calendar events.

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

  Promise.all([
    fetch('/api/prep').then(function(r) { if (!r.ok) throw new Error('Prep API ' + r.status); return r.json(); }),
    fetch('/api/prep/upcoming').then(function(r) { if (!r.ok) throw new Error('Upcoming API ' + r.status); return r.json(); }),
  ])
    .then(function(results) {
      renderPrepUnified(container, results[0], results[1]);
    })
    .catch(function(err) {
      container.innerHTML = '<div class="prep-empty">⚠ Failed to load prep data: ' + escapeHtml(err.message) + '</div>';
    });
}
window.renderPrepView = renderPrepView;

// ── DATA MODEL ──
// card types: 'upcoming' (calendar event) | 'past' (Granola note)
// Each card: { type, id, subject, timeISO, timeLabel, location, attendees, hasAgenda, agendaHtml, notes, webUrl, actions, status }

function renderPrepUnified(container, prepData, upcomingData) {
  var meetings = prepData.meetings || [];       // past Granola notes (full summaries now)
  var priorityActions = (prepData.agenda && prepData.agenda.upcomingActions) || [];
  var storedAgendas = (upcomingData.allAgendas || []).concat(prepData.perMeetingAgendas || []);
  var upcomingEvents = upcomingData.events || [];

  // Normalize stored agendas by lowercased subject for matching
  var agendaBySubject = {};
  storedAgendas.forEach(function(ag) {
    var key = (ag.meetingSubject || '').toLowerCase().trim();
    if (key && !agendaBySubject[key]) agendaBySubject[key] = ag;
  });
  function findAgenda(subject) {
    if (!subject) return null;
    // Denylist: these meetings never get a fuzzy-matched agenda (keep meeting, drop agenda)
    var subjLower = String(subject).toLowerCase();
    if (subjLower.indexOf('boldyn') !== -1 || subjLower.indexOf('design team') !== -1) return null;
    // Word-overlap scoring, same as server. Handles "i5 LED Coordination" vs "...Design Coordination".
    function norm(s) {
      return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter(function(w) { return w.length > 2 && ['the','and','for','with','you','our','are','per','re'].indexOf(w) === -1; });
    }
    var a = norm(subject);
    if (a.length === 0) return null;
    var best = null;
    var bestScore = 0;
    for (var k in agendaBySubject) {
      var b = norm(k);
      if (b.length === 0) continue;
      var short = a.length < b.length ? a : b;
      var long = a.length < b.length ? b : a;
      var overlap = short.filter(function(w) { return long.indexOf(w) !== -1; }).length;
      var score = overlap / short.length;
      if (score > bestScore) { bestScore = score; best = k; }
    }
    if (best && bestScore >= 0.7) return agendaBySubject[best];
    return null;
  }

  // Build cards
  var cards = [];

  upcomingEvents.forEach(function(ev) {
    var ag = findAgenda(ev.subject);
    cards.push({
      type: 'upcoming',
      id: 'up-' + (ev.eventId || ev.subject + ev.start),
      subject: ev.subject || 'Untitled',
      timeISO: ev.start || '',
      timeLabel: formatTime(ev.start),
      location: ev.location || '',
      attendees: ev.attendees || [],
      hasAgenda: !!(ag && ag.agendaHtml),
      agendaHtml: (ag && ag.agendaHtml) || ev.agendaHtml || '',
      notes: '',
      webUrl: '',
      actions: [],
      isPast: false,
    });
  });

  // Past meetings (Granola notes) newest first
  meetings.forEach(function(m, i) {
    var ag = findAgenda(m.title);
    var dateISO = m.date || '';
    cards.push({
      type: 'past',
      id: 'past-' + i + '-' + (m.title || '').replace(/[^a-zA-Z0-9]+/g, '-').substring(0, 40),
      subject: m.title || 'Untitled Meeting',
      timeISO: dateISO,
      timeLabel: m.date ? formatDate(m.date) : '',
      location: '',
      attendees: [],
      hasAgenda: !!(ag && ag.agendaHtml),
      agendaHtml: (ag && ag.agendaHtml) || '',
      notes: m.summary || '',
      webUrl: m.web_url || '',
      actions: (m.actions || []).map(function(a) {
        return { text: a.actionText || a.text || '', owner: a.owner || '', status: a.status || '' };
      }),
      isPast: true,
    });
  });

  // Sort: upcoming by start time asc; past by date desc. Upcoming first in list.
  var upcomingCards = cards.filter(function(c) { return c.type === 'upcoming'; })
    .sort(function(a, b) { return new Date(a.timeISO || 0) - new Date(b.timeISO || 0); });
  var pastCards = cards.filter(function(c) { return c.type === 'past'; })
    .sort(function(a, b) { return new Date(b.timeISO || 0) - new Date(a.timeISO || 0); });
  var allCards = upcomingCards.concat(pastCards);

  container._cards = allCards;
  container._priorityActions = priorityActions;

  var html = '';

  // Header + filter chips
  html += '<div class="prep-toolbar">';
  html += '<div class="prep-filters">';
  html += '<button class="prep-filter-chip active" data-filter="all" onclick="prepSetFilter(this)">All <span class="prep-chip-count">' + allCards.length + '</span></button>';
  html += '<button class="prep-filter-chip" data-filter="upcoming" onclick="prepSetFilter(this)">Upcoming <span class="prep-chip-count">' + upcomingCards.length + '</span></button>';
  html += '<button class="prep-filter-chip" data-filter="past" onclick="prepSetFilter(this)">Past <span class="prep-chip-count">' + pastCards.length + '</span></button>';
  html += '<button class="prep-filter-chip" data-filter="agenda" onclick="prepSetFilter(this)">Has Agenda <span class="prep-chip-count">' + allCards.filter(function(c){return c.hasAgenda;}).length + '</span></button>';
  html += '</div>';
  html += '<div class="prep-toolbar-hint">Click a meeting to expand. Upcoming → generate an agenda. Past → full notes.</div>';
  html += '</div>';

  // Unified meeting list
  html += '<div class="prep-meeting-list" id="prep-meeting-list">';
  if (allCards.length === 0) {
    html += '<div class="prep-empty">No meetings found. Sign in with Microsoft to see your calendar.</div>';
  } else {
    allCards.forEach(function(card, idx) {
      html += renderCard(card, idx);
    });
  }
  html += '</div>';

  // Priority actions — compact collapsible, default collapsed
  html += '<div class="prep-priority-wrap">';
  html += '<div class="prep-priority-header" onclick="togglePriority()">';
  html += '<span class="prep-priority-chevron" id="prep-priority-chevron">▶</span>';
  html += '<span>⏰ Priority Actions (48h) <span class="prep-count-badge">' + priorityActions.length + '</span></span>';
  html += '</div>';
  html += '<div class="prep-priority-body" id="prep-priority-body" style="display:none">';
  if (priorityActions.length > 0) {
    html += '<div class="prep-agenda">';
    priorityActions.forEach(function(item) {
      var ownerLabel = item.owner ? '<span class="prep-agenda-owner">' + escapeHtml(item.owner) + '</span>' : '';
      var done = item.status === 'completed' || item.done === true;
      var prog = item.status === 'in_progress';
      var statusClass = done ? 'prep-status-done' : (prog ? 'prep-status-progress' : 'prep-status-open');
      var statusLabel = done ? '✓ Done' : (prog ? 'In Progress' : 'Open');
      html += '<div class="prep-agenda-item">';
      html += '<div class="prep-agenda-text">' + escapeHtml(item.text || item.title || item.actionText || '') + '</div>';
      html += '<div class="prep-agenda-meta">' + ownerLabel + ' <span class="prep-status-badge ' + statusClass + '">' + statusLabel + '</span></div>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div class="prep-empty-sm">No priority actions in the next 48 hours.</div>';
  }
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  // Delegated click handlers (avoids inline quoting bugs)
  wirePrepEvents(container);
}

// ── CARD RENDER ──
function renderCard(card, idx) {
  var html = '';
  var expanded = idx === 0 ? '' : '';

  var badge = '';
  if (card.type === 'upcoming') {
    badge = '<span class="prep-badge prep-badge-upcoming">Upcoming</span>';
  } else {
    badge = '<span class="prep-badge prep-badge-past">Past</span>';
  }
  if (card.hasAgenda) badge += '<span class="prep-badge prep-badge-agenda">📋 Agenda</span>';

  var metaBits = [];
  if (card.timeLabel) metaBits.push('<span class="prep-meta-time">🕒 ' + escapeHtml(card.timeLabel) + '</span>');
  if (card.location) metaBits.push('<span class="prep-meta-loc">📍 ' + escapeHtml(card.location) + '</span>');
  if (card.attendees && card.attendees.length > 0) {
    var names = card.attendees.slice(0, 4).map(function(a) { return escapeHtml(a.name || a.email || ''); }).join(', ');
    if (card.attendees.length > 4) names += ' +' + (card.attendees.length - 4);
    metaBits.push('<span class="prep-meta-people">👥 ' + names + '</span>');
  }
  if (card.type === 'past' && card.actions.length > 0) {
    metaBits.push('<span class="prep-meta-actions">✅ ' + card.actions.length + ' actions</span>');
  }

  html += '<div class="prep-card" data-card-id="' + escapeHtmlAttr(card.id) + '" data-type="' + card.type + '" data-has-agenda="' + (card.hasAgenda ? '1' : '0') + '">';
  html += '<div class="prep-card-header" onclick="prepToggleCard(this)">';
  html += '<span class="prep-card-chevron">▶</span>';
  html += '<div class="prep-card-info">';
  html += '<div class="prep-card-subject">' + escapeHtml(card.subject) + ' ' + badge + '</div>';
  if (metaBits.length > 0) html += '<div class="prep-card-meta">' + metaBits.join('') + '</div>';
  html += '</div>';
  html += '</div>';
  html += '<div class="prep-card-body" style="display:none">';
  html += renderCardBody(card);
  html += '</div>';
  html += '</div>';
  return html;
}

function renderCardBody(card) {
  var html = '';
  if (card.type === 'upcoming') {
    if (card.hasAgenda) {
      html += '<div class="prep-card-actions-row">';
      html += '<button class="prep-export-btn" data-export="' + escapeHtmlAttr(card.id) + '">⬇ Export to Word</button>';
      html += '<button class="prep-regenerate-btn" data-generate="' + escapeHtmlAttr(card.id) + '">🔄 Regenerate</button>';
      html += '</div>';
      html += '<div class="prep-agenda-content">' + card.agendaHtml + '</div>';
    } else {
      html += '<div class="prep-card-actions-row">';
      html += '<button class="prep-generate-btn" data-generate="' + escapeHtmlAttr(card.id) + '">Generate Agenda</button>';
      html += '</div>';
      html += '<div class="prep-gen-status" style="display:none"></div>';
      html += '<div class="prep-card-hint">Writes a Context Request; LUCI builds the agenda and it appears here (usually within 30 min).</div>';
    }
  } else {
    // Past meeting: notes + actions + agenda if exists
    if (card.hasAgenda) {
      html += '<div class="prep-card-actions-row">';
      html += '<button class="prep-export-btn" data-export="' + escapeHtmlAttr(card.id) + '">⬇ Export Agenda to Word</button>';
      html += '</div>';
      html += '<div class="prep-agenda-content">' + card.agendaHtml + '</div>';
      html += '<div class="prep-notes-divider"></div>';
    }
    if (card.webUrl) {
      html += '<div class="prep-card-linkrow"><a href="' + escapeHtmlAttr(card.webUrl) + '" target="_blank" rel="noopener">Open in Granola ↗</a></div>';
    }
    html += '<div class="prep-detail-section-title">📝 Notes</div>';
    if (card.notes) {
      html += '<div class="prep-detail-summary">' + mdToHtml(card.notes) + '</div>';
    } else {
      html += '<div class="prep-empty-sm">No Granola notes for this meeting.</div>';
    }
    if (card.actions.length > 0) {
      html += '<div class="prep-detail-section-title" style="margin-top:14px">✅ Action Items <span class="prep-action-badge">' + card.actions.length + '</span></div>';
      html += '<div class="prep-actions-list">';
      card.actions.forEach(function(a) {
        var ownerStr = a.owner ? '<span class="prep-action-owner">' + escapeHtml(a.owner) + '</span>' : '';
        var statusClass = 'prep-status-open';
        var statusLabel = 'Open';
        if (a.status === 'completed' || a.done === true) { statusClass = 'prep-status-done'; statusLabel = '✓ Done'; }
        else if (a.status === 'in_progress') { statusClass = 'prep-status-progress'; statusLabel = 'In Progress'; }
        html += '<div class="prep-action-item">';
        html += '<div class="prep-action-text">' + escapeHtml(a.text) + '</div>';
        html += '<div class="prep-action-meta">' + ownerStr + ' <span class="prep-status-badge ' + statusClass + '">' + statusLabel + '</span></div>';
        html += '</div>';
      });
      html += '</div>';
    }
  }
  return html;
}

// ── CARD ACTIONS (delegated) ──
function wirePrepEvents(container) {
  container.querySelectorAll('.prep-generate-btn, .prep-regenerate-btn').forEach(function(btn) {
    btn.addEventListener('click', function(ev) {
      ev.stopPropagation();
      var cardId = btn.getAttribute('data-generate');
      var card = container._cards.find(function(c) { return c.id === cardId; });
      if (!card) return;
      prepRequestAgenda(container, card, btn);
    });
  });
  container.querySelectorAll('.prep-export-btn').forEach(function(btn) {
    btn.addEventListener('click', function(ev) {
      ev.stopPropagation();
      var cardId = btn.getAttribute('data-export');
      var card = container._cards.find(function(c) { return c.id === cardId; });
      if (!card) return;
      exportAgendaToWord(card.subject, card.agendaHtml);
    });
  });
}

function prepRequestAgenda(container, card, button) {
  var body = button.closest('.prep-card-body');
  var statusEl = body ? body.querySelector('.prep-gen-status') : null;
  if (!statusEl) {
    // create one inline if needed
    if (body) {
      statusEl = document.createElement('div');
      statusEl.className = 'prep-gen-status';
      body.insertBefore(statusEl, body.firstChild);
    }
  }
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = '⏳ Sending generation request...';
    statusEl.className = 'prep-gen-status prep-gen-pending';
  }
  button.disabled = true;

  fetch('/api/prep/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meetingSubject: card.subject,
      meetingTime: card.timeISO || new Date().toISOString(),
      eventId: card.id.replace(/^up-/, ''),
    }),
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (statusEl) {
        if (data.success) {
          statusEl.innerHTML = '✅ ' + escapeHtml(data.message);
          statusEl.className = 'prep-gen-status prep-gen-success';
        } else {
          statusEl.innerHTML = '❌ Failed: ' + escapeHtml(data.error || 'Unknown error');
          statusEl.className = 'prep-gen-status prep-gen-error';
          button.disabled = false;
        }
      }
    })
    .catch(function(err) {
      if (statusEl) {
        statusEl.innerHTML = '❌ Network error: ' + escapeHtml(err.message);
        statusEl.className = 'prep-gen-status prep-gen-error';
      }
      button.disabled = false;
    });
}

// ── EXPORT AGENDA TO WORD ──
function exportAgendaToWord(subject, agendaHtml) {
  var cleanSubject = (subject || 'Agenda').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  var bodyHtml = agendaHtml || '<p>No agenda content.</p>';
  var wordHtml =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><title>' + escapeHtml(cleanSubject) + '</title>' +
    '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
    '<style>' +
    '@page WordSection1{size:8.5in 11.0in;margin:1.0in 1.0in 1.0in 1.0in}' +
    'div.WordSection1{page:WordSection1}' +
    'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a;line-height:1.4}' +
    'h1{font-size:18pt;color:#184655;margin-bottom:2pt}' +
    'h2{font-size:14pt;color:#184655;margin-top:12pt;margin-bottom:4pt}' +
    'h3{font-size:12pt;color:#184655;margin-top:10pt;margin-bottom:3pt}' +
    'h4{font-size:11pt;color:#184655;margin-top:8pt;margin-bottom:3pt}' +
    'p{margin:4pt 0}' +
    'ul,ol{margin:4pt 0 4pt 18pt}' +
    'li{margin:2pt 0}' +
    'strong{color:#111}' +
    '</style></head>' +
    '<body><div class="WordSection1">' +
    '<h1>' + escapeHtml(cleanSubject) + '</h1>' +
    '<p style="color:#666;font-size:9pt">Generated by L.U.C.I. - Level Up Central Intelligence | ' + new Date().toLocaleString() + '</p>' +
    '<hr style="border:none;border-top:1px solid #999">' +
    bodyHtml +
    '</div></body></html>';

  var blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = cleanSubject + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
}
window.exportAgendaToWord = exportAgendaToWord;

// ── UI HELPERS ──
function prepToggleCard(header) {
  var card = header.closest('.prep-card');
  if (!card) return;
  var body = card.querySelector('.prep-card-body');
  var chevron = card.querySelector('.prep-card-chevron');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (chevron) chevron.textContent = isOpen ? '▶' : '▼';
}
window.prepToggleCard = prepToggleCard;

function prepSetFilter(btn) {
  var container = document.getElementById('prep-container');
  if (!container || !container._cards) return;
  var filter = btn.getAttribute('data-filter');
  container.querySelectorAll('.prep-filter-chip').forEach(function(chip) { chip.classList.remove('active'); });
  btn.classList.add('active');
  var list = document.getElementById('prep-meeting-list');
  if (!list) return;
  list.querySelectorAll('.prep-card').forEach(function(card) {
    var type = card.getAttribute('data-type');
    var hasAgenda = card.getAttribute('data-has-agenda') === '1';
    var show = false;
    if (filter === 'all') show = true;
    else if (filter === 'upcoming') show = type === 'upcoming';
    else if (filter === 'past') show = type === 'past';
    else if (filter === 'agenda') show = hasAgenda;
    card.style.display = show ? '' : 'none';
  });
}
window.prepSetFilter = prepSetFilter;

function togglePriority() {
  var body = document.getElementById('prep-priority-body');
  var chevron = document.getElementById('prep-priority-chevron');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (chevron) chevron.textContent = isOpen ? '▶' : '▼';
}
window.togglePriority = togglePriority;

// ── LIGHT MARKDOWN → HTML (for Granola notes) ──
function mdToHtml(md) {
  if (!md) return '';
  var lines = md.split(/\r?\n/);
  var html = '';
  var inList = false;
  var listType = '';

  function closeList() {
    if (inList) { html += '</' + listType + '>'; inList = false; listType = ''; }
  }

  lines.forEach(function(raw) {
    var line = raw;
    var trimmed = line.trim();

    if (trimmed === '') { closeList(); return; }

    // Headings
    var hMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (hMatch) {
      closeList();
      var level = hMatch[1].length;
      html += '<h' + Math.min(level + 1, 4) + '>' + inlineMd(hMatch[2]) + '</h' + Math.min(level + 1, 4) + '>';
      return;
    }

    // Bullet list
    var bMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bMatch) {
      if (!inList || listType !== 'ul') { closeList(); inList = true; listType = 'ul'; html += '<ul>'; }
      html += '<li>' + inlineMd(bMatch[1]) + '</li>';
      return;
    }

    // Numbered list
    var nMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (nMatch) {
      if (!inList || listType !== 'ol') { closeList(); inList = true; listType = 'ol'; html += '<ol>'; }
      html += '<li>' + inlineMd(nMatch[1]) + '</li>';
      return;
    }

    // Bold-lead line (e.g. "**Next Steps**") -> paragraph
    closeList();
    html += '<p>' + inlineMd(trimmed) + '</p>';
  });
  closeList();
  return html;
}

function inlineMd(s) {
  if (!s) return '';
  var esc = escapeHtml(s);
  // Bold
  esc = esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Inline code
  esc = esc.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links
  esc = esc.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return esc;
}

// ── HELPERS ──
function formatTime(iso) {
  if (!iso) return '';
  try {
    var dt = new Date(iso);
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (e) { return iso; }
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    var dt = new Date(iso);
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) { return iso; }
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function escapeHtmlAttr(s) {
  if (s === null || s === undefined) return '';
  return escapeHtml(s).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

// ── INJECT STYLES v3 ──
(function injectPrepStylesV3() {
  if (document.getElementById('prep-styles-v3')) return;
  var style = document.createElement('style');
  style.id = 'prep-styles-v3';
  style.textContent =
    '.prep-container{max-width:1200px;margin:0 auto;padding:24px;flex:1 0 auto;width:100%}' +
    '.prep-loading{padding:60px 24px;text-align:center;color:var(--muted);font-size:14px;display:flex;align-items:center;justify-content:center;gap:10px}' +
    '.prep-empty{padding:60px 24px;text-align:center;color:var(--muted);font-size:14px}' +
    '.prep-empty-sm{padding:20px;text-align:center;color:var(--muted);font-size:13px}' +
    // Toolbar
    '.prep-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}' +
    '.prep-filters{display:flex;gap:6px;flex-wrap:wrap}' +
    '.prep-filter-chip{padding:6px 14px;border:1px solid var(--border);border-radius:20px;background:var(--card);color:var(--charcoal);font-size:12px;font-weight:600;cursor:pointer;transition:all .12s}' +
    '.prep-filter-chip:hover{border-color:var(--teal)}' +
    '.prep-filter-chip.active{background:var(--teal);border-color:var(--teal);color:#fff}' +
    '.prep-chip-count{opacity:.7;font-weight:400;margin-left:4px}' +
    '.prep-toolbar-hint{font-size:11px;color:var(--muted)}' +
    // Unified list
    '.prep-meeting-list{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}' +
    '.prep-card{border:1px solid var(--border);border-radius:10px;background:var(--card);overflow:hidden;transition:border-color .12s}' +
    '.prep-card:hover{border-color:var(--teal)}' +
    '.prep-card-header{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;cursor:pointer;user-select:none}' +
    '.prep-card-header:hover{background:var(--teal-light)}' +
    '.prep-card-chevron{font-size:10px;color:var(--muted);flex-shrink:0;width:12px;text-align:center;margin-top:3px}' +
    '.prep-card-info{flex:1;min-width:0}' +
    '.prep-card-subject{font-size:14px;font-weight:600;color:var(--charcoal);line-height:1.35;word-break:break-word}' +
    '.prep-card-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:5px}' +
    '.prep-meta-time,.prep-meta-loc,.prep-meta-people,.prep-meta-actions{font-size:11px;color:var(--muted)}' +
    '.prep-badge{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;margin-left:6px;vertical-align:middle;text-transform:uppercase;letter-spacing:.03em}' +
    '.prep-badge-upcoming{background:var(--teal);color:#fff}' +
    '.prep-badge-past{background:var(--cool);color:var(--charcoal)}' +
    '.prep-badge-agenda{background:rgba(24,70,85,0.12);color:var(--teal)}' +
    '.prep-card-body{border-top:1px solid var(--border);padding:14px 18px;background:var(--bg)}' +
    '.prep-card-actions-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}' +
    '.prep-generate-btn{padding:7px 18px;border:none;border-radius:6px;background:var(--teal);color:#fff;font-size:13px;font-weight:600;cursor:pointer}' +
    '.prep-generate-btn:hover{opacity:.85}' +
    '.prep-generate-btn:disabled{opacity:.4;cursor:default}' +
    '.prep-regenerate-btn{padding:7px 18px;border:1px solid var(--teal);border-radius:6px;background:transparent;color:var(--teal);font-size:13px;font-weight:600;cursor:pointer}' +
    '.prep-export-btn{padding:7px 18px;border:none;border-radius:6px;background:#2d6a4f;color:#fff;font-size:13px;font-weight:600;cursor:pointer}' +
    '.prep-export-btn:hover{opacity:.88}' +
    '.prep-card-hint{font-size:11px;color:var(--muted);margin-top:8px}' +
    '.prep-agenda-content{font-size:13px;line-height:1.6;color:var(--charcoal)}' +
    '.prep-agenda-content h3{font-size:15px;margin:10px 0 4px;color:var(--teal)}' +
    '.prep-agenda-content h4{font-size:13px;margin:8px 0 4px;color:var(--teal)}' +
    '.prep-agenda-content p{margin:5px 0}' +
    '.prep-agenda-content ul,.prep-agenda-content ol{margin:4px 0 4px 20px}' +
    '.prep-agenda-content li{margin:2px 0}' +
    '.prep-notes-divider{border-top:1px solid var(--border);margin:14px 0}' +
    '.prep-card-linkrow{margin-bottom:12px}' +
    '.prep-card-linkrow a{font-size:12px;color:var(--teal);text-decoration:none;font-weight:600}' +
    '.prep-card-linkrow a:hover{text-decoration:underline}' +
    '.prep-detail-section-title{font-size:13px;font-weight:700;color:var(--charcoal);margin-bottom:8px}' +
    '.prep-detail-summary{font-size:13px;line-height:1.65;color:var(--charcoal);padding:12px 14px;background:var(--card);border:1px solid var(--border);border-radius:8px;max-height:60vh;overflow-y:auto}' +
    '.prep-detail-summary h1,.prep-detail-summary h2,.prep-detail-summary h3,.prep-detail-summary h4{color:var(--teal);margin:10px 0 4px}' +
    '.prep-detail-summary h1{font-size:15px}.prep-detail-summary h2{font-size:14px}' +
    '.prep-detail-summary p{margin:5px 0}' +
    '.prep-detail-summary ul,.prep-detail-summary ol{margin:4px 0 4px 20px}' +
    '.prep-detail-summary li{margin:2px 0}' +
    '.prep-detail-summary code{background:rgba(190,209,198,0.2);padding:1px 4px;border-radius:4px;font-size:12px}' +
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
    // Priority actions
    '.prep-priority-wrap{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 16px}' +
    '.prep-priority-header{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:var(--charcoal);cursor:pointer;user-select:none}' +
    '.prep-priority-chevron{font-size:10px;color:var(--muted)}' +
    '.prep-priority-body{margin-top:10px}' +
    '.prep-count-badge{background:var(--teal);color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:10px}' +
    '.prep-agenda{display:flex;flex-direction:column;gap:6px}' +
    '.prep-agenda-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;gap:12px;flex-wrap:wrap}' +
    '.prep-agenda-text{flex:1;font-size:13px;font-weight:600;color:var(--charcoal);min-width:0;word-break:break-word}' +
    '.prep-agenda-meta{display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap}' +
    '.prep-agenda-owner{font-size:11px;color:var(--muted);background:var(--cool);padding:2px 8px;border-radius:10px;font-weight:600}' +
    '.prep-gen-status{font-size:12px;margin:0 0 10px;padding:6px 10px;border-radius:6px}' +
    '.prep-gen-pending{background:rgba(230,200,124,0.1);color:#e6c87c}' +
    '.prep-gen-success{background:rgba(100,200,100,0.1);color:#6dd66d}' +
    '.prep-gen-error{background:rgba(200,80,80,0.1);color:#e06060}' +
    '@media (max-width:800px){.prep-container{padding:16px}.prep-card-meta{gap:8px}}';
  document.head.appendChild(style);
})();