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

  // Show dropdown matching Luna search style
  var dd = document.getElementById('pb-hero-dropdown');
  if (!dd) return;
  var q = val.trim();
  if (!q) { dd.classList.remove('show'); dd.innerHTML = ''; return; }
  var ql = q.toLowerCase();

  var results = [];

  // Search KB
  KB.forEach(function(s) {
    var hay = [s.title, s.num].concat(s.topics || []).concat(s.h2 || []).concat(s.content || []).concat(s.bullets || []).join(' ').toLowerCase();
    if (hay.indexOf(ql) >= 0) {
      var preview = '';
      var contents = s.content || [];
      var bullets = s.bullets || [];
      for (var ci = 0; ci < contents.length; ci++) {
        if (contents[ci].toLowerCase().indexOf(ql) >= 0) {
          preview = contents[ci].substring(0, 160);
          break;
        }
      }
      if (!preview) {
        for (var bi = 0; bi < bullets.length; bi++) {
          if (bullets[bi].toLowerCase().indexOf(ql) >= 0) {
            preview = bullets[bi].substring(0, 160);
            break;
          }
        }
      }
      if (!preview && s.h2 && s.h2.length) preview = s.h2[0].substring(0, 120);
      if (!preview) preview = (s.content || []).slice(0, 2).join(' ').substring(0, 120);
      results.push({ type:'section', label:'S' + s.num + ': ' + (s.title || ''), id:s.num, preview:preview });
    }
  });

  // Search templates
  for (var key in TEMPLATES) {
    var t = TEMPLATES[key];
    if ((t.name && t.name.toLowerCase().indexOf(ql) >= 0) || (t.desc && t.desc.toLowerCase().indexOf(ql) >= 0)) {
      results.push({ type:'template', label:'Template: ' + (t.name||key), id:key, preview:(t.desc||'').substring(0,120) });
    }
  }

  // Search topics
  ALL_TOPICS.forEach(function(tp) {
    if (tp.toLowerCase().indexOf(ql) >= 0) {
      results.push({ type:'topic', label:'Topic: ' + tp, id:tp, preview:'' });
    }
  });

  if (results.length === 0) { dd.classList.remove('show'); dd.innerHTML = ''; return; }

  function hl(text) {
    if (!text) return '';
    var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  var icons = { section:'📚', template:'📑', topic:'🏷️' };
  var html = '<div class="luna-hero-dropdown-inner">';
  html += '<div style="padding:6px 14px 8px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)">' + results.length + ' result' + (results.length>1?'s':'') + ' for "' + escapeHtml(q) + '"</div>';
  results.slice(0, 15).forEach(function(r) {
    var icon = icons[r.type]||'📄';
    var onClick = "var dd=document.getElementById('pb-hero-dropdown');if(dd){dd.classList.remove('show');dd.innerHTML=''}document.getElementById('pb-search-input').value='';";
    if (r.type === 'section') onClick += "setView('playbook');setPlaybookView('sections');jumpTo('" + r.id + "');";
    else if (r.type === 'template') onClick += "setView('playbook');setPlaybookView('templates');";
    else if (r.type === 'topic') onClick += "pbSearchType('" + r.id.replace(/'/g,"\\'") + "');";
    html += '<div class="pb-hero-dd-item" onclick="' + onClick + '">'
      + '<span class="pb-hero-dd-icon">' + icon + '</span>'
      + '<div style="flex:1;min-width:0">'
      + '<div class="pb-hero-dd-text">' + hl(r.label) + '</div>'
      + (r.preview ? '<div class="pb-hero-dd-desc">' + hl(r.preview.substring(0, 160)) + '</div>' : '')
      + '</div><span class="pb-hero-dd-src">' + r.type + '</span></div>';
  });
  html += '</div>';
  dd.innerHTML = html;
  dd.classList.add('show');

  // Click outside to close
  var closeHandler = function(e) {
    if (!dd.contains(e.target) && e.target.id !== 'pb-search-input') {
      dd.classList.remove('show');
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(function() { document.removeEventListener('click', closeHandler); document.addEventListener('click', closeHandler); }, 10);
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

// dismissReminder is now in app-core.js

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

// ── TEMPLATES ─────────────────────────────────────────────────────
function renderTemplates() {
  var grid = document.getElementById('templates-grid');
  if (!grid) return;
  var keys = Object.keys(TEMPLATES);
  if (!keys.length) {
    grid.innerHTML = '<div style="padding:40px;color:var(--muted);text-align:center">No templates configured.</div>';
    return;
  }

  // Read saved category state from localStorage
  var catState = {};
  try { var savedCats = localStorage.getItem('lu_tmpl_cats'); if (savedCats) catState = JSON.parse(savedCats); } catch(e) {}

  // Group by category
  var byCategory = {};
  keys.forEach(function(k) {
    var t = TEMPLATES[k];
    var cat = t.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ key: k, t: t });
  });

  var categoryOrder = ['Project Controls','Financial','Meetings','Contracts & Procurement','Field & Construction','Reporting','Other'];
  var orderedCats = categoryOrder.filter(function(c) { return byCategory[c]; })
    .concat(Object.keys(byCategory).filter(function(c) { return categoryOrder.indexOf(c) < 0; }));

  var html = '<div style="margin-bottom:24px">'
    + '<div style="font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:4px">' + keys.length + ' Templates</div>'
    + '<div style="font-size:13px;color:var(--muted)">Branded Excel workbooks. Click to expand a category, then preview or download.</div>'
    + '</div>';

  orderedCats.forEach(function(cat) {
    var items = byCategory[cat];
    // Always start collapsed — ignore saved state
      var isOpen = false;
    var catIcon = cat === 'Project Controls' ? '📊' : cat === 'Financial' ? '💰' : cat === 'Meetings' ? '📋' : cat === 'Contracts & Procurement' ? '📝' : cat === 'Field & Construction' ? '🔨' : cat === 'Reporting' ? '📈' : '📁';
    html += '<div style="margin-bottom:10px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--card);transition:box-shadow .2s">'
      + '<div class="tmpl-cat-header" onclick="toggleTmplCat(' + jsCallArg(cat) + ')" style="display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;user-select:none;transition:all .15s">'
      + '<span style="font-size:18px">' + catIcon + '</span>'
      + '<span style="font-size:14px;font-weight:700;color:var(--charcoal);flex:1">' + escapeHtml(cat) + '</span>'
      + '<span class="tmpl-chevron" style="font-size:11px;color:var(--teal);transition:transform .2s ease;background:var(--teal-light);padding:2px 8px;border-radius:6px">' + (isOpen ? '▲' : '▼') + ' ' + items.length + '</span>'
      + '</div>'
      + '<div class="tmpl-cat-body" style="' + (isOpen ? 'display:block' : 'display:none') + ';padding:6px 20px 20px;border-top:1px solid var(--border)">'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';

    items.forEach(function(item) {
      var k = item.key;
      var t = item.t;
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:16px;display:flex;flex-direction:column;transition:box-shadow .15s">'
        + '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">'
        + '<span style="font-size:22px;flex-shrink:0">' + (t.icon || '📊') + '</span>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:700;color:var(--charcoal);line-height:1.3">' + escapeHtml(t.name || k) + '</div>'
        + '<div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.4">' + escapeHtml(t.desc || '') + '</div>'
        + '</div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;margin-top:auto;flex-wrap:wrap">'
        + '<button style="flex:1;padding:8px 12px;background:var(--teal);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit" onclick="previewTemplate(' + jsCallArg(k) + ')">Preview</button>'
        + '<button style="flex:1;padding:8px 12px;background:var(--cool);color:var(--charcoal);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit" onclick="downloadTemplate(' + jsCallArg(k) + ')">Download</button>'
        + '</div>'
        + '<div style="display:flex;gap:6px;margin-top:6px;font-size:10px;color:var(--muted)">'
        + (t.section ? '<span style="background:var(--cool);padding:2px 6px;border-radius:4px">Section ' + escapeHtml(t.section) + '</span>' : '')
        + '<span style="background:var(--cool);padding:2px 6px;border-radius:4px;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(k) + '</span>'
        + '</div>'
        + '</div>';
    });

    html += '</div></div></div>';
  });

  grid.innerHTML = html;
}

function toggleTmplCat(cat) {
  var state = {};
  try { var saved = localStorage.getItem('lu_tmpl_cats'); if (saved) state = JSON.parse(saved); } catch(e) {}
  state[cat] = !state[cat];
  try { localStorage.setItem('lu_tmpl_cats', JSON.stringify(state)); } catch(e) {}
  renderTemplates();
}

function downloadTemplate(key) {
  var t = TEMPLATES[key];
  if (!t) return;
  var url = 'https://raw.githubusercontent.com/wh1tw1ll/Level-Up-Playbook/main/templates/' + encodeURIComponent(key);
  var btn = event && event.target ? event.target : null;
  if (btn) { btn.disabled = true; btn.textContent = 'Downloading...'; }
  fetch(url).then(function(r) {
    if (!r.ok) throw new Error('File not found');
    return r.blob();
  }).then(function(blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = key;
    document.body.appendChild(a);
    a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 10000);
        closeModal('modal-template-preview');
    if (btn) { btn.disabled = false; btn.textContent = 'Download'; }
  }).catch(function(err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Download'; }
    // Fallback: try opening in new tab
    window.open(url, '_blank');
  });
}

function previewTemplate(key) {
  var t = TEMPLATES[key];
  if (!t) return;
  var html = '<div class="modal-dialog" style="max-width:640px">'
    + '<div class="modal-header">'
    + '<div class="modal-title">' + (t.icon || '📊') + ' ' + escapeHtml(t.name || key) + '</div>'
    + '<button class="chat-close" onclick="closeModal(\'modal-template-preview\')">×</button>'
    + '</div>'
    + '<div class="modal-body" style="padding:20px 24px">'
    + '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">'
    + '<span style="background:var(--teal-light);color:var(--teal);font-size:12px;font-weight:600;padding:4px 10px;border-radius:6px">' + escapeHtml(t.category || 'General') + '</span>'
    + (t.section ? '<span style="background:var(--cool);color:var(--charcoal);font-size:12px;font-weight:600;padding:4px 10px;border-radius:6px">Section ' + escapeHtml(t.section) + '</span>' : '')
    + '<span style="background:var(--cool);color:var(--charcoal);font-size:12px;padding:4px 10px;border-radius:6px">' + escapeHtml(key) + '</span>'
    + '</div>'
    + '<p style="font-size:14px;line-height:1.7;color:var(--charcoal);margin-bottom:20px">' + escapeHtml(t.desc || '') + '</p>'
    + '<div style="background:var(--bg);border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.6;color:var(--muted)">'
    + '✅ Ready to use — contains working formulas, data validation dropdowns, and conditional formatting.<br>'
    + '📥 Click <strong>Download</strong> to get a fillable .xlsx file you can edit in Excel.'
    + '</div>'
    + '<div style="margin-top:20px;display:flex;gap:10px">'
    + '<button class="btn-primary" onclick="downloadTemplate(\'' + key.replace(/'/g,"\\'") + '\')">📥 Download Now</button>'
    + '<button style="flex:1;padding:10px 20px;font-size:14px;background:var(--cool);color:var(--charcoal);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600" onclick="closeModal(\'modal-template-preview\')">Close</button>'
    + '</div>'
    + '</div></div>';
      showModal('modal-template-preview', html);
    }

// ── PHASE GUIDE MODAL ───────────────────────────────────────────────
// Auto-generated from KB data — always in sync with playbook content
var PHASE_ORDER = ['Pre-Development','Schematic Design','Design Development','CDs & Bid','Construction','Closeout','Opening'];
var PHASE_ICONS = {'Pre-Development':'🔍','Schematic Design':'✏️','Design Development':'📐','CDs & Bid':'📋','Construction':'🏗️','Closeout':'✅','Opening':'🎉'};

function buildPhaseGuideHTML() {
  if (!kbLoaded || !KB.length) return '<div style="padding:20px;color:var(--muted)">Playbook not loaded yet.</div>';
  var html = '';
  PHASE_ORDER.forEach(function(phase, idx) {
    var pid = 'pg-phase-' + idx;
    // Find sections for this phase
    var phaseSections = KB.filter(function(s) {
      return s.phases && s.phases.indexOf(phase) >= 0;
    });
    // Also include "All Phases" sections that aren't already listed
    var allPhaseSections = KB.filter(function(s) {
      return s.phases && s.phases.indexOf('All Phases') >= 0 && s.phases.indexOf(phase) < 0;
    });
    var icon = PHASE_ICONS[phase] || '📖';
    html += '<div class="pg-phase">'
      + '<button class="pg-phase-header" onclick="togglePgPhase(' + jsCallArg(pid) + ')">'
      + '<span class="pg-phase-chevron" id="' + pid + '-chev">▶</span>'
      + '<span>' + icon + ' ' + escapeHtml(phase) + '</span>'
      + '<span style="margin-left:auto;font-size:11px;color:var(--muted)">' + phaseSections.length + ' sections</span>'
      + '</button>'
      + '<div class="pg-phase-body" id="' + pid + '" style="display:none">';
    if (phaseSections.length) {
      html += '<h4>Phase-Specific Sections</h4><ul>';
      phaseSections.forEach(function(s) {
        html += '<li><strong>Section ' + s.num + '</strong> — ' + escapeHtml(s.title.replace('SECTION ' + s.num + ': ','')) + '</li>';
      });
      html += '</ul>';
    }
    if (allPhaseSections.length) {
      html += '<h4>Foundation (Applies to All Phases)</h4><ul>';
      allPhaseSections.forEach(function(s) {
        html += '<li><strong>Section ' + s.num + '</strong> — ' + escapeHtml(s.title.replace('SECTION ' + s.num + ': ','')) + '</li>';
      });
      html += '</ul>';
    }
    html += '</div></div>';
  });
  return html;
}

function openPhaseGuide() {
  var body = document.getElementById('pg-body');
  if (!body) return;
  body.innerHTML = buildPhaseGuideHTML();
  document.getElementById('modal-phase-guide').classList.add('open');
}

function togglePgPhase(pid) {
  var body = document.getElementById(pid);
  var chev = document.getElementById(pid + '-chev');
  if (!body) return;
  var isHidden = body.style.display === 'none' || !body.style.display;
  body.style.display = isHidden ? 'block' : 'none';
  if (chev) chev.textContent = isHidden ? '▼' : '▶';
}

// ── DECISION TREE DATA ──────────────────────────────────────────────
var DT_TREE = {
  root: {
    q: 'What do you need help with?',
    opts: [
      { label: '💰 I received a change order', next: 'co_received' },
      { label: '📅 The project schedule is slipping', next: 'schedule_slip' },
      { label: '✅ Punch list dispute with the GC', next: 'punch_dispute' },
      { label: '🏗️ I need to set up a new project', next: 'new_project' },
      { label: '📊 Budget concern / cost overrun', next: 'budget_concern' },
      { label: '📝 Contract or legal issue', next: 'contract_issue' },
      { label: '🔒 Closeout preparation', next: 'closeout_prep' },
      { label: '⚠️ Risk identified on the project', next: 'risk_id' }
    ]
  },
  co_received: {
    q: 'Is the change order within the original scope of work?',
    opts: [
      { label: '✅ Yes, it is within scope', next: 'co_scope_yes' },
      { label: '❌ No, it is out of scope', next: 'co_scope_no' },
      { label: '🤷 Not sure yet', next: 'co_unsure' }
    ]
  },
  co_scope_yes: {
    answer: 'Since the work is within scope, focus on pricing validation:\n\n1. **Review the pricing** — Is the markup reasonable? Check labor, materials, equipment, and subcontractor costs against your estimate.\n2. **Verify quantities** — Do the quantities match field measurements?\n3. **Check for duplication** — Has any of this work already been covered in the base contract or a previous CO?\n4. **Negotiate if needed** — Challenge line items that seem high.\n5. **Document your review** — Use the CO review checklist (Section 16).\n6. **Route for approval** — Follow the governance structure in Section 4.\n\n**Key sections:** Section 16 (Change Management), Section 14 (Budget Management), Section 4 (Governance)',
    sections: ['16', '14', '4']
  },
  co_scope_no: {
    answer: 'Out-of-scope change orders require careful handling:\n\n1. **Document the scope gap** — Clearly show why this is outside the original contract scope.\n2. **Get multiple quotes** — If possible, get competitive pricing.\n3. **Prepare a challenge package** — Include contract references, scope documents, and your analysis.\n4. **Escalate if needed** — Follow the dispute resolution process in the contract.\n5. **Track as a potential recovery item** — If the GC is pushing scope that should be theirs, flag for cost recovery.\n\n**Key sections:** Section 16 (Change Management), Section 30 (Cost Recovery), Section 42 (Common Problems)',
    sections: ['16', '30', '42']
  },
  co_unsure: {
    answer: 'If you\'re unsure whether the work is in scope:\n\n1. **Pull the contract scope documents** — Review the original scope of work, drawings, and specifications.\n2. **Compare to the CO description** — Line by line, does the CO describe work already required?\n3. **Consult the design team** — Ask the AOR if the work was implied by the design intent.\n4. **Check previous COs** — Has similar work been approved before?\n5. **If still unclear, flag it** — Better to challenge and be wrong than pay for something twice.\n\n**Key sections:** Section 16 (Change Management), Section 18 (Contract Negotiation), Section 22 (Design Management)',
    sections: ['16', '18', '22']
  },
  schedule_slip: {
    q: 'Is the slip on the critical path?',
    opts: [
      { label: '🔴 Yes, it affects the critical path', next: 'sched_critical' },
      { label: '🟡 No, it is non-critical', next: 'sched_noncritical' },
      { label: '🤷 I need to determine this', next: 'sched_analyze' }
    ]
  },
  sched_critical: {
    answer: 'A critical path slip requires immediate action:\n\n1. **Quantify the impact** — How many days? What is the new completion date?\n2. **Identify root cause** — Is it the GC, a sub, design, owner-directed change, or force majeure?\n3. **Develop a recovery schedule** — Compression, acceleration, resequencing, or added shifts.\n4. **Assess cost impact** — Acceleration costs, delay damages, liquidated damages exposure.\n5. **Communicate to stakeholders** — Owner, lender, design team, and key subs.\n6. **Document everything** — Daily reports, meeting minutes, correspondence.\n\n**Key sections:** Section 15 (Schedule Management), Section 16 (Change Management), Section 24 (Field Oversight)',
    sections: ['15', '16', '24']
  },
  sched_noncritical: {
    answer: 'Non-critical path slips are manageable but should not be ignored:\n\n1. **Monitor the float** — How much total float does this activity have?\n2. **Track the trend** — Is this a one-time slip or a pattern?\n3. **Notify the responsible party** — Make sure they know they\'re burning float.\n4. **Update the schedule** — Reflect the current reality in the master schedule.\n5. **Report in weekly meetings** — Keep stakeholders informed.\n\n**Key sections:** Section 15 (Schedule Management), Section 11 (Meeting Cadence)',
    sections: ['15', '11']
  },
  sched_analyze: {
    answer: 'To determine if an activity is on the critical path:\n\n1. **Look at the master schedule** — Find the activity in the CPM schedule.\n2. **Check total float** — If total float is 0 or negative, it\'s on the critical path.\n3. **Trace the longest path** — The critical path is the longest sequence of dependent activities.\n4. **Ask the scheduler** — The GC\'s scheduler can confirm.\n5. **Use a simple rule** — If this activity is delayed by one day, does the project completion date move? If yes, it\'s critical.\n\n**Key sections:** Section 15 (Schedule Management)',
    sections: ['15']
  },
  punch_dispute: {
    q: 'What type of punch list issue are you dealing with?',
    opts: [
      { label: '🔨 Trade workmanship defect', next: 'punch_trade' },
      { label: '📐 Design / specification issue', next: 'punch_design' },
      { label: '💰 GC wants to issue credit instead of correcting', next: 'punch_credit' }
    ]
  },
  punch_trade: {
    answer: 'Trade workmanship defects should be corrected, not credited:\n\n1. **Document thoroughly** — Photos, videos, measurements, and specification references.\n2. **Reference the spec** — Show exactly where the work deviates from the contract documents.\n3. **Demand correction** — The trade contractor is responsible for meeting the spec.\n4. **Escalate to the GC** — If the trade refuses, the GC is responsible for enforcing the subcontract.\n5. **Track in the punch list system** — Use Procore or your tracking log.\n6. **Position: correction, not credit** — You paid for a specified result, not a discount.\n\n**Key sections:** Section 35 (Punch List), Section 24 (Field Oversight), Section 42 (Common Problems)',
    sections: ['35', '24', '42']
  },
  punch_design: {
    answer: 'Design-related punch items need coordination with the design team:\n\n1. **Review the contract documents** — Is the issue a design error or a construction deviation?\n2. **Engage the AOR** — Arquitectonica (ARQ) should clarify design intent.\n3. **Determine responsibility** — Design error = AOR\'s issue. Construction deviation = trade\'s issue.\n4. **Document the decision** — Get the AOR\'s written direction.\n5. **Track separately** — Design-related items may need a different resolution path than trade defects.\n\n**Key sections:** Section 35 (Punch List), Section 22 (Design Management), Section 34 (Commissioning)',
    sections: ['35', '22', '34']
  },
  punch_credit: {
    answer: 'When the GC offers a credit instead of correction:\n\n1. **Hold your position** — The standard is correction, not credit. You paid for a specified result.\n2. **Ask why they can\'t correct** — Is it a schedule constraint? Material availability? Trade refusal?\n3. **Evaluate the credit offer** — Is it fair market value for the defect? Usually not.\n4. **Consider the long-term impact** — Will this affect operations, maintenance, or fan experience?\n5. **Escalate if needed** — This is a common GC tactic during closeout. Stay firm.\n\n**Key sections:** Section 35 (Punch List), Section 30 (Cost Recovery), Section 42 (Common Problems)',
    sections: ['35', '30', '42']
  },
  new_project: {
    answer: 'Setting up a new project requires systematic mobilization:\n\n1. **Day 1 Mobilization** — Use Section 8 checklist: team roster, communication plan, document control, financial setup.\n2. **Establish governance** — Decision-making authority, approval thresholds, meeting cadence (Section 4).\n3. **Set up tools and systems** — Procore, accounting, document management, schedule platform (Section 9).\n4. **Define roles** — Owner, CM, design team, subs — who does what (Section 3).\n5. **Create communication protocols** — Reporting, meeting schedule, escalation paths (Section 10).\n6. **Establish budget and schedule baselines** — Sections 14 and 15.\n7. **Set up risk register** — Section 17.\n\n**Key sections:** Section 8 (Mobilization), Section 4 (Governance), Section 9 (Tools), Section 3 (Roles), Section 10 (Communications)',
    sections: ['8', '4', '9', '3', '10']
  },
  budget_concern: {
    q: 'What type of budget issue are you seeing?',
    opts: [
      { label: '📈 Costs are running over budget', next: 'budget_over' },
      { label: '❓ I need to verify current budget status', next: 'budget_status' },
      { label: '🔍 I want to find cost recovery opportunities', next: 'budget_recovery' }
    ]
  },
  budget_over: {
    answer: 'Cost overruns require immediate analysis:\n\n1. **Identify the variance** — Which line items are over? By how much?\n2. **Determine the cause** — Scope change, pricing error, quantity overrun, inefficiency?\n3. **Check for offsets** — Are there under-runs elsewhere that can absorb the overrun?\n4. **Review change orders** — Have approved COs already covered this?\n5. **Assess contingency** — How much contingency remains? Is this a valid use?\n6. **Report to stakeholders** — Transparent communication about the variance and recovery plan.\n7. **Implement controls** — Tighter review of new COs, weekly forecast updates.\n\n**Key sections:** Section 14 (Budget Management), Section 16 (Change Management), Section 13 (Project Controls)',
    sections: ['14', '16', '13']
  },
  budget_status: {
    answer: 'To check current budget status:\n\n1. **Pull the latest budget report** — From Procore or the CM\'s monthly draw.\n2. **Compare original vs revised budget** — How much has changed through COs?\n3. **Check paid-to-date vs incurred** — Are there significant gaps?\n4. **Review retainage** — How much is being held?\n5. **Forecast final costs** — Based on current trends, what\'s the projected final cost?\n6. **Update the owner** — Monthly budget summary with variance explanations.\n\n**Key sections:** Section 14 (Budget Management), Section 12 (Reporting Framework)',
    sections: ['14', '12']
  },
  budget_recovery: {
    answer: 'Cost recovery is a systematic process:\n\n1. **Review all change orders** — Look for duplicate charges, scope overlaps, pricing errors.\n2. **Check for VE credits** — Were value engineering savings passed to the owner?\n3. **Audit quantities** — Are billed quantities matching field measurements?\n4. **Review OCIP credits** — Has the owner received insurance premium credits?\n5. **Look for defective work** — Work that needs redoing should not be paid at full price.\n6. **Engage the cost recovery analyst** — MFP has an independent analyst targeting $9M+ recovery by June 30.\n\n**Key sections:** Section 30 (Cost Recovery), Section 14 (Budget Management), Section 16 (Change Management)',
    sections: ['30', '14', '16']
  },
  contract_issue: {
    answer: 'Contract issues require careful, documented handling:\n\n1. **Review the contract terms** — Pull the specific clause that applies.\n2. **Document everything** — Correspondence, meeting notes, approvals, and denials.\n3. **Identify the breach or dispute** — What exactly is the issue?\n4. **Follow the dispute resolution process** — Most contracts have a step-by-step process.\n5. **Engage legal counsel if needed** — Don\'t hesitate to involve the owner\'s attorney.\n6. **Protect the owner\'s position** — Preserve all rights, don\'t waive claims inadvertently.\n7. **Track in the risk register** — Legal issues are project risks that need monitoring.\n\n**Key sections:** Section 18 (Contract Negotiation), Section 17 (Risk Management), Section 42 (Common Problems)',
    sections: ['18', '17', '42']
  },
  closeout_prep: {
    answer: 'Closeout is a structured process — start early:\n\n1. **Punch list** — Systematic walkthroughs, documentation, and tracking. Position: correction, not credit.\n2. **Commissioning** — All systems tested and verified: HVAC, electrical, fire, AV, security.\n3. **Documentation** — As-builts, O&M manuals, warranties, training records.\n4. **CO closeout** — Finalize all pending change orders.\n5. **Retainage release** — Process for releasing retainage to subs.\n6. **Certificate of Occupancy** — Coordinate with AHJ for TCO / final CO.\n7. **Demobilization** — Site cleanup, trailer removal, final accounting.\n8. **Owner transition** — Turn over all documentation, keys, access, and systems.\n\n**Key sections:** Section 35 (Punch List), Section 34 (Commissioning), Section 36 (Closeout), Section 33 (Operations Readiness)',
    sections: ['35', '34', '36', '33']
  },
  risk_id: {
    answer: 'When a risk is identified, follow this process:\n\n1. **Document the risk** — Description, probability, impact, timeframe.\n2. **Assess severity** — Use the risk matrix: probability x impact = risk score.\n3. **Assign an owner** — Who is responsible for monitoring and mitigation?\n4. **Develop mitigation plan** — What actions reduce probability or impact?\n5. **Set trigger points** — When does the risk become an issue requiring escalation?\n6. **Track in the risk register** — Review at every project meeting.\n7. **Communicate** — Stakeholders should know about high-severity risks.\n\n**Key sections:** Section 17 (Risk Management), Section 13 (Project Controls), Section 42 (Common Problems)',
    sections: ['17', '13', '42']
  }
};

// ── DECISION TREE MODAL ────────────────────────────────────────────
var dtPath = ['root'];

function openDecisionTree() {
  dtPath = ['root'];
  renderDecisionTree();
  document.getElementById('modal-decision').classList.add('open');
}

function renderDecisionTree() {
  var body = document.getElementById('dt-body');
  if (!body) return;
  if (typeof DT_TREE === 'undefined') {
    body.innerHTML = '<div style="padding:20px;color:var(--muted)">Decision tree not loaded.</div>';
    return;
  }
  var cur = DT_TREE[dtPath[dtPath.length-1]];
  if (!cur) {
    body.innerHTML = '<div style="padding:20px;color:var(--muted)">No more questions.</div>';
    return;
  }
  if (cur.answer) {
    body.innerHTML = '<div style="padding:20px"><div style="font-size:15px;font-weight:600;color:var(--charcoal);margin-bottom:12px">' + escapeHtml(cur.answer) + '</div>'
      + (cur.sections ? '<div style="font-size:13px;color:var(--muted);margin-bottom:16px">See sections: ' + cur.sections.join(', ') + '</div>' : '')
      + '<button class="btn-primary" onclick="dtReset()">Start over</button></div>';
    return;
  }
  body.innerHTML = '<div style="padding:8px"><div style="font-size:16px;font-weight:600;color:var(--charcoal);margin-bottom:16px">' + escapeHtml(cur.q) + '</div>'
    + cur.opts.map(function(opt) {
      return '<button class="topbar-btn" style="display:block;width:100%;background:var(--cool);color:var(--charcoal);text-align:left;padding:11px 14px;margin-bottom:6px;font-size:14px" onclick="dtChoose(' + jsCallArg(opt.next) + ')">' + escapeHtml(opt.label) + '</button>';
    }).join('')
    + (dtPath.length > 1 ? '<button class="back-btn" onclick="dtBack()" style="margin-top:12px">← Back</button>' : '')
    + '</div>';
}

function dtChoose(next) { dtPath.push(next); renderDecisionTree(); }
function dtBack()       { if (dtPath.length > 1) dtPath.pop(); renderDecisionTree(); }
function dtReset()      { dtPath = ['root']; renderDecisionTree(); }

// ── DECISION TREE (INLINE VERSION - used in Playbook tab) ──────────
var dtPathInline = ['root'];
function renderDecisionTreeInline() {
  var body = document.getElementById('dt-body-inline');
  if (!body) return;
  var cur = typeof DT_TREE !== 'undefined' ? DT_TREE[dtPathInline[dtPathInline.length-1]] : null;
  if (!cur) {
    body.innerHTML = '<div style="padding:20px;color:var(--muted)">Decision tree not available.</div>';
    return;
  }
  if (cur.answer) {
    body.innerHTML = '<div class="dt-answer">' + escapeHtml(cur.answer) + '</div>'
      + (cur.sections ? '<div class="dt-meta">See sections: ' + cur.sections.join(', ') + '</div>' : '')
      + '<button class="btn-primary" onclick="dtResetInline()">Start over</button>';
    return;
  }
  body.innerHTML = '<div class="dt-q">' + escapeHtml(cur.q) + '</div>'
    + cur.opts.map(function(opt) {
      return '<button class="dt-opt" onclick="dtChooseInline(' + jsCallArg(opt.next) + ')">' + escapeHtml(opt.label) + '</button>';
    }).join('')
    + (dtPathInline.length > 1 ? '<button id="dt-back" class="back-btn" onclick="dtBackInline()">← Back</button>' : '');
}
function dtChooseInline(next) { dtPathInline.push(next); renderDecisionTreeInline(); }
function dtBackInline() { if (dtPathInline.length > 1) dtPathInline.pop(); renderDecisionTreeInline(); }
function dtResetInline() { dtPathInline = ['root']; renderDecisionTreeInline(); }

// ── INLINE PHASE GUIDE ─────────────────────────────────────────────
function renderPhaseGuideInline() {
  var body = document.getElementById('pg-body-inline');
  if (!body) return;
  body.innerHTML = buildPhaseGuideHTML();
}
function togglePgPhaseInline(pid) {
  var body = document.getElementById(pid);
  var chev = document.getElementById(pid + '-chev');
  if (!body) return;
  var isHidden = body.style.display === 'none' || !body.style.display;
  body.style.display = isHidden ? 'block' : 'none';
  if (chev) chev.textContent = isHidden ? '▼' : '▶';
}

function closeDecisionTree() {
  closeModal('modal-decision-tree');
  closeModal('modal-decision-tree-alt');
}