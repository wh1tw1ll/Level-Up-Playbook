// ── PLAYBOOK SEARCH, SIDEBAR, RENDER ──

// ── PLAYBOOK SEARCH ────────────────────────────────────────────────
function pbSearchType(val) {
  activeSearch = val.trim();
  renderPlaybook();
  var count = document.getElementById('pb-search-count');
  if (count) {
    var filtered = getFiltered();
    count.textContent = activeSearch ? filtered.length + ' results' : '';
  }
}
function pbSearch() {
  var input = document.getElementById('pb-search-input');
  if (input) pbSearchType(input.value);
}

// ── SIDEBAR TOGGLE ──────────────────────────────────────────────────
function toggleSidebar() {
  var sidebar = document.getElementById('playbook-sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
}

// ── STATS BAR ───────────────────────────────────────────────────────
// ── REMINDERS ──────────────────────────────────────────────────────
function renderReminders() {
  var el = document.getElementById('luna-reminders');
  if (!el) return;
  var now = new Date();
  var day = now.getDate();
  var month = now.getMonth();
  var year = now.getFullYear();
  var monthKey = year + '-' + month;

  var dismissed = {};
  try { var d = localStorage.getItem('lu_remind_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}

  var reminders = [];

  var drawDue = new Date(year, month, 10);
  if (day > 10) drawDue.setMonth(month + 1);
  var drawDays = Math.round((drawDue - now) / 86400000);
  var drawId = 'draw_' + monthKey;
  if (!dismissed[drawId]) reminders.push({
    id: drawId, icon: '💰', title: 'Monthly Draw Package',
    desc: 'Due in ' + drawDays + ' day' + (drawDays !== 1 ? 's' : ''),
    urgent: drawDays <= 3, warn: drawDays <= 7 && drawDays > 3
  });

  var expDue = new Date(year, month, 5);
  if (day > 5) expDue.setMonth(month + 1);
  var expDays = Math.round((expDue - now) / 86400000);
  var expId = 'expense_' + monthKey;
  if (!dismissed[expId]) reminders.push({
    id: expId, icon: '🧾', title: 'Monthly Expense Report',
    desc: 'Due in ' + expDays + ' day' + (expDays !== 1 ? 's' : ''),
    urgent: expDays <= 3, warn: expDays <= 7 && expDays > 3
  });

  var friday = new Date(now);
  friday.setDate(now.getDate() + (5 - now.getDay() + 7) % 7);
  if (now.getDay() > 5) friday.setDate(friday.getDate() + 7);
  if (now.getDay() === 5 && now.getHours() >= 17) friday.setDate(friday.getDate() + 7);
  var calDays = Math.round((friday - now) / 86400000);
  var calId = 'calendar_w' + year + '_' + (function(n){while(n<0)n+=7;return Math.floor((n-friday.getDay()+7)/7);})(now.getDay()) + '_' + friday.getDate();
  calId = 'cal_' + friday.getFullYear() + '_' + friday.getMonth() + '_' + friday.getDate();
  if (!dismissed[calId]) reminders.push({
    id: calId, icon: '📅', title: 'Weekly Events Calendar',
    desc: calDays === 0 ? 'Due today' : 'Due in ' + calDays + ' day' + (calDays !== 1 ? 's' : ''),
    urgent: calDays <= 1, warn: calDays <= 2 && calDays > 1
  });

  var html = '';
  reminders.forEach(function(r) {
    var bg = r.urgent ? '#fce8e8' : r.warn ? '#fef4e0' : 'var(--card)';
    var border = r.urgent ? '#e74c3c' : r.warn ? '#e67e22' : 'var(--border)';
    var txtColor = r.urgent ? '#c0392b' : r.warn ? '#a05c00' : 'var(--muted)';
    html += '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:' + bg + ';border:1px solid ' + border + ';border-radius:8px;margin-bottom:6px">'
      + '<span style="font-size:18px">' + r.icon + '</span>'
      + '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--charcoal)">' + escapeHtml(r.title) + '</div>'
      + '<div style="font-size:12px;color:' + txtColor + '">' + escapeHtml(r.desc) + '</div></div>'
      + (r.urgent ? '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#e74c3c;background:rgba(231,76,60,.12);padding:3px 8px;border-radius:6px">Due Soon</span>' : '')
      + (r.warn ? '<span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#e67e22">Coming Up</span>' : '')
      + '<button onclick="dismissReminder(\'' + r.id + '\')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:4px" title="Dismiss">&times;</button>'
      + '</div>';
  });

  el.innerHTML = html;
}

function dismissReminder(id) {
  var dismissed = {};
  try { var d = localStorage.getItem('lu_remind_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}
  dismissed[id] = true;
  try { localStorage.setItem('lu_remind_dismiss', JSON.stringify(dismissed)); } catch(e) {}
  renderReminders();
}

// ── PLAYBOOK RENDER ───────────────────────────────────────────────
function getFiltered() {
  return KB.filter(function(s) {
    if (activePhase && activePhase !== 'All Phases') {
      if (!s.phases.includes('All Phases') && !s.phases.includes(activePhase)) return false;
    }
    if (activeTopic) {
      var has = s.topics.some(function(t) { return t.toLowerCase().includes(activeTopic.toLowerCase()); });
      if (!has) return false;
    }
    if (activeSearch) {
      var q = activeSearch.toLowerCase();
      var hay = [s.title, s.num].concat(s.topics || []).concat(s.h2 || []).concat(s.content || []).concat(s.bullets || []).join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
}

function renderPlaybook() {
  if (!kbLoaded) {
    var container = document.getElementById('sections-container');
    if (container) container.innerHTML = '<div style="padding:60px 24px;text-align:center"><div class="luna-spinner"></div> <span style="color:var(--muted);font-size:14px">Loading playbook...</span></div>';
    return;
  }
  renderSidebar();
  renderSections();
}

function renderSidebar() {
  var pp = document.getElementById('phase-pills');
  if (pp) {
    pp.innerHTML = PHASES.map(function(p) {
      var act = activePhase === p ? ' active' : '';
      return '<button class="phase-pill' + act + '" onclick="setPhase(' + jsCallArg(p) + ')">' + escapeHtml(p) + '</button>';
    }).join('');
  }
  var tc = document.getElementById('topic-chips');
  if (tc) {
    tc.innerHTML = ALL_TOPICS.slice(0, 40).map(function(t) {
      var act = activeTopic === t ? ' active' : '';
      return '<button class="topic-chip' + act + '" onclick="setTopic(' + jsCallArg(t) + ')">' + escapeHtml(t) + '</button>';
    }).join('');
  }
}

function renderSections() {
  var container = document.getElementById('sections-container');
  var meta = document.getElementById('results-meta');
  if (!container) return;

  var filtered = getFiltered();
  var showGroups = true;

  if (meta) {
    var allExpanded = Object.keys(collapsedGroups).length === 0;
    var label = (filtered.length === KB.length) ? (KB.length + ' sections') : (filtered.length + ' of ' + KB.length + ' sections');
    meta.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'
      + '<span>' + label + '</span>'
      + '<div style="display:flex;gap:6px">'
      + '<button onclick="' + (allExpanded ? 'collapseAllGroups()' : 'expandAllGroups()') + '" style="background:var(--cool);border:none;padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--charcoal)">' + (allExpanded ? 'Collapse All' : 'Expand All') + '</button>'
      + '</div></div>';
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">No sections match your filters. <button class="back-btn" style="color:var(--teal);text-decoration:underline" onclick="clearFilters()">Clear filters</button></div>';
    return;
  }

  var html = '';
  var seenGroups = {};

  filtered.forEach(function(s) {
    var gk = showGroups ? grpKey(s.num) : null;

    if (showGroups && !seenGroups[gk]) {
      seenGroups[gk] = true;
      var gInfo = GROUPS[gk];
      var collapsed = collapsedGroups[gk] === true;
      if (gInfo) {
        html += '<div class="kb-group' + (collapsed ? ' collapsed' : '') + '" onclick="toggleGroup(' + jsCallArg(gk) + ')">'
          + '<span class="kb-group-chevron">▼</span>'
          + '<span class="kb-group-title">' + escapeHtml(gInfo.label) + '</span>'
          + '<span class="kb-group-desc">' + escapeHtml(gInfo.desc) + '</span>'
          + '</div>';
      }
    }

    if (showGroups && collapsedGroups[gk] === true) return;

    var isOpen = openSections[s.num] === true;
    var phaseTags = (s.phases || []).map(function(p) {
      return '<span class="sec-phase-tag">' + escapeHtml(p) + '</span>';
    }).join('');

    html += '<div class="section-card' + (isOpen ? ' open' : '') + '" data-num="' + escapeHtml(s.num) + '">'
      + '<div class="section-card-header" onclick="toggleSection(' + jsCallArg(s.num) + ')">'
      + '<span class="sec-badge">' + escapeHtml(s.num) + '</span>'
      + '<div style="flex:1">'
      + '<div class="sec-title">' + escapeHtml(s.title) + '</div>'
      + '<div class="sec-phases">' + phaseTags + '</div>'
      + '</div>'
      + '<span class="sec-chevron">' + (isOpen ? '▲' : '▼') + '</span>'
      + '</div>'
      + '<div class="section-card-body">';

    var h2s = s.h2 || [];
    var content = s.content || [];
    var bullets = s.bullets || [];

    if (h2s.length > 0) {
      var perSection = Math.ceil(content.length / h2s.length);
      h2s.forEach(function(heading, idx) {
        var subId = s.num + '_' + idx;
        var subOpen = openSubsecs[subId] === true;
        html += '<div class="subsec">'
          + '<div class="subsec-header" onclick="toggleSubsec(' + jsCallArg(subId) + ')">'
          + '<span class="subsec-chevron">' + (subOpen ? '▼' : '▶') + '</span>'
          + '<span>' + escapeHtml(heading) + '</span>'
          + '</div>'
          + '<div class="subsec-body" style="display:' + (subOpen ? 'block' : 'none') + '">';
        var start = idx * perSection;
        var chunk = content.slice(start, start + perSection);
        chunk.forEach(function(p) {
          html += '<p>' + escapeHtml(p) + '</p>';
        });
        html += '</div></div>';
      });
    } else {
      content.forEach(function(p) {
        html += '<p>' + escapeHtml(p) + '</p>';
      });
    }

    if (bullets.length > 0) {
      html += '<ul>';
      bullets.forEach(function(b) {
        html += '<li>' + escapeHtml(b) + '</li>';
      });
      html += '</ul>';
    }

    if (s.related && s.related.length > 0) {
      html += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;align-items:center">'
        + '<span style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">See also:</span>';
      s.related.forEach(function(r) {
        html += '<span style="font-size:11px;padding:3px 9px;background:var(--teal-light);color:var(--teal);border-radius:6px;cursor:pointer;font-weight:600" onclick="jumpTo(\'' + escapeHtml(String(r)) + '\')">S' + escapeHtml(String(r)) + '</span>';
      });
      html += '</div>';
    }

    html += '</div></div>';
  });

  container.innerHTML = html;
}

function toggleGroup(gk) {
  if (collapsedGroups[gk]) delete collapsedGroups[gk];
  else collapsedGroups[gk] = true;
  renderSections();
}

function toggleSection(num) {
  if (openSections[num]) delete openSections[num];
  else openSections[num] = true;
  renderSections();
}

function toggleSubsec(id) {
  if (openSubsecs[id]) delete openSubsecs[id];
  else openSubsecs[id] = true;
  renderSections();
}

function setPhase(p) {
  activePhase = (activePhase === p) ? null : p;
  activeTopic = null;
  if (activePhase) collapsedGroups = {};
  renderPlaybook();
}

function setTopic(t) {
  activeTopic = (activeTopic === t) ? null : t;
  if (activeTopic) collapsedGroups = {};
  renderPlaybook();
}

function clearFilters() {
  activePhase = null;
  activeTopic = null;
  activeSearch = '';
  var si = document.getElementById('luna-hero-input');
  if (si) si.value = '';
  collapsedGroups = {'1':true, '6':true, '13':true, '18':true, '37':true};
  openSections = {};
  openSubsecs = {};
  renderPlaybook();
}

function expandAllGroups() {
  collapsedGroups = {};
  renderSections();
}

function collapseAllGroups() {
  collapsedGroups = {'1':true, '6':true, '13':true, '18':true, '37':true};
  openSections = {};
  openSubsecs = {};
  renderSections();
}