// ── LEVEL UP PLAYBOOK ─ APP.JS ──────────────────────────────────────
// Clean rewrite. All state, data, and behavior in this file. v20260607

// ── STATE ─────────────────────────────────────────────────────────
var luUser = null;
var currentView = 'luna';
var currentPbView = 'sections';
var activePhase = null;
var activeTopic = null;
var activeSearch = '';
var collapsedGroups = {'1':true, '6':true, '13':true, '18':true, '37':true};  // {} = all expanded
var openSections = {};
var openSubsecs = {};
var chatHistory = [];
var lunaHistory = [];
var chatOpen = false;
var projectContext = null;
var heroResults = {};

var PHASES = ['Pre-Construction','Design','Construction','Closeout','Post-Opening','All Phases'];
var GROUPS = {
  '1':  {label:'GROUP 1 — FOUNDATION', desc:'Purpose, philosophy, roles, governance'},
  '6':  {label:'GROUP 2 — PROJECT SETUP', desc:'Mobilization, tools, communications'},
  '13': {label:'GROUP 3 — CONTROLS', desc:'Budget, schedule, change, risk'},
  '18': {label:'GROUP 4 — PHASE EXECUTION', desc:'Contract through closeout'},
  '37': {label:'GROUP 5 — REFERENCE', desc:'Standards, templates, problems'}
};
var GKEYS = [1, 6, 13, 18, 37];
window.aiTab = window.aiTab || 'team';

// ── DATA LOADED FROM EXTERNAL FILES ───────────────────────────────
var MFP_CONTEXT = window.__MFP_CONTEXT || '';
var KB = [];  // Loaded async from data/kb.json
var TEMPLATES = window.__TEMPLATES || {};
var GLOSSARY = window.__GLOSSARY || {};
var ALL_TOPICS = [];

// Async KB loader
var kbLoaded = false;
async function loadKB() {
  if (kbLoaded) return;
  try {
    var r = await fetch('data/kb.json?v=20260607');
    KB = await r.json();
    var set = {};
    KB.forEach(function(s) { (s.topics || []).forEach(function(t) { set[t] = true; }); });
    ALL_TOPICS = Object.keys(set).sort();
    kbLoaded = true;
    // If playbook view is active, re-render
        if (currentView === 'playbook') renderPlaybook();
        // Update diag bar with actual KB count
        var footerEl = document.getElementById('footer-status-text');
            if (footerEl) {
              var status = luUser && luUser.authenticated ? 'Signed in: ' + luUser.email : 'Not signed in';
              footerEl.textContent = 'JS OK · ' + status + ' · KB=' + KB.length;
            }
  } catch(e) {
    console.error('Failed to load KB:', e);
  }
}
// Start loading KB immediately
loadKB();

function grpKey(n) {
  var num = Number(n);
  var g = 1;
  for (var i = 0; i < GKEYS.length; i++) if (num >= GKEYS[i]) g = GKEYS[i];
  return String(g);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function jsCallArg(v) {
  // Build an argument string safe for use inside an onclick="..." attribute
  // Wraps the value in &quot; so it survives HTML attribute parsing
  return '&quot;' + String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,"\\'") + '&quot;';
}



function getCookie(name) {
  var match = ('; ' + document.cookie).match(';\\s*' + name + '=([^;]*)');
  return match ? decodeURIComponent(match[1]) : null;
}

// ── AUTH ──────────────────────────────────────────────────────────
function checkAuthFromCookie() {
  var raw = getCookie('lu_session');
  if (raw) {
    try {
      var data = JSON.parse(raw);
      if (data && data.name && data.expires_at && Date.now() < data.expires_at) {
        luUser = { authenticated: true, name: data.name, email: data.email };
        return true;
      }
    } catch(e) {}
  }
  luUser = null;
  return false;
}

async function tryRefresh() {
  try {
    var res = await fetch('/auth/me', { credentials: 'include' });
    if (res.ok) {
      var data = await res.json();
      if (data.authenticated) {
        luUser = { authenticated: true, name: data.name, email: data.email };
        updateAuthUI();
        return true;
      }
    }
  } catch(e) {}
  return false;
}

function updateAuthUI() {
  var signInBtn = document.getElementById('auth-signin-btn');
  var userInfo = document.getElementById('auth-user-info');
  var userName = document.getElementById('auth-user-name');
  var emailMeta = document.getElementById('email-card-meta');
  var calMeta = document.getElementById('cal-card-meta');
  var spMeta = document.getElementById('sp-card-meta');

  if (luUser && luUser.authenticated) {
    if (signInBtn) signInBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userName) userName.textContent = luUser.name || luUser.email;
    if (emailMeta) emailMeta.textContent = '✓ ' + (luUser.email || 'Connected');
    if (calMeta) calMeta.textContent = '✓ Connected';
    if (spMeta) spMeta.textContent = '✓ Connected';
  } else {
    if (signInBtn) signInBtn.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
    if (emailMeta) emailMeta.textContent = 'Sign in to enable';
    if (calMeta) calMeta.textContent = 'Sign in to enable';
    if (spMeta) spMeta.textContent = 'Sign in to enable';
  }
}

function signInWithMicrosoft() {
  try { localStorage.setItem('lu_return_view', currentView || 'home'); } catch(e) {}
  window.location.href = '/auth/login';
}

function signOut() {
  document.cookie = 'lu_session=; Path=/; Max-Age=0';
  window.location.href = '/auth/logout';
}

// ── THEME ─────────────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  var btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = t === 'dark' ? '☽' : '☀';
}

function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme') || 'light';
  var next = cur === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('lu_theme', next); } catch(e) {}
}

// ── VIEW ROUTING ──────────────────────────────────────────────────
function jumpTo(num) {
  setView('playbook');
  setPlaybookView('sections');
  openSections[num] = true;
  collapsedGroups = {};
  setTimeout(function() {
    renderSections();
    var el = document.querySelector('.section-card[data-num="' + num + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function goHome() {
  setView('luna');
}

function setPlaybookView(subview) {
  currentPbView = subview;
  // Update sub-nav tabs
  document.querySelectorAll('.subnav-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-pbview') === subview);
  });
  renderPbView();
}

function renderPbView() {
  if (currentPbView === 'sections') {
    renderPlaybook();
  } else if (currentPbView === 'templates') {
    renderTemplates();
  } else if (currentPbView === 'guide') {
    renderPhaseGuideInline();
  } else if (currentPbView === 'decision') {
    renderDecisionTreeInline();
  }
  // Show the right sub-view div
  document.querySelectorAll('.pb-subview').forEach(function(v) { v.classList.remove('active'); });
  var map = { sections:'pb-sections-view', templates:'pb-templates-view', guide:'pb-guide-view', decision:'pb-decision-view' };
  var el = document.getElementById(map[currentPbView]);
  if (el) el.classList.add('active');
}

function setView(view) {
  try {
  currentView = view;

  // Hide all views, show target
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  var target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  // Nav tab highlight — only 3 main tabs now
  var navMap = { playbook:'nav-playbook', projects:'nav-projects', actions:'nav-actions', mfp:'nav-projects', luna:'nav-luna' };
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  var tabId = navMap[view];
  if (tabId) {
    var tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');
  }

  // Sub-nav visibility
  var subnav = document.getElementById('subnav-playbook');
  if (subnav) subnav.style.display = (view === 'playbook') ? 'flex' : 'none';

  window.scrollTo(0, 0);

  // View-specific render
  if (view === 'luna') { renderHero(); }
  else if (view === 'playbook') renderPbView();
  else if (view === 'projects') renderProjects();
  else if (view === 'actions') renderActions();
  else if (view === 'sharepoint') renderSharePoint();
  else if (view === 'email') renderEmail();
  else if (view === 'calendar') renderCalendar();
  else if (view === 'mfp') renderMFP();
  } catch(err) {
      console.error('setView error:', err);
    }
}

function updateHomeGreeting() {
  var el = document.getElementById('home-greeting');
  if (!el) return;
  var h = new Date().getHours();
  var g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  if (luUser && luUser.authenticated && luUser.name) {
    var firstName = (luUser.name || '').split(' ')[0];
    if (firstName) g += ', ' + firstName;
  }
  el.textContent = g;
    renderReminders();
  }

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
function renderStats() {
  var el = document.getElementById('home-greeting');
  if (!el) return;
  // Remove existing stats bar if present
  var existing = document.getElementById('stats-bar');
  if (existing) existing.remove();
  // Build stats
  var stats = [
    { icon: '📚', label: 'Sections', value: KB.length || '—' },
    { icon: '📑', label: 'Templates', value: Object.keys(TEMPLATES).length || '—' },
    { icon: '🔴', label: 'Active Issues', value: '5' },
    { icon: '🔍', label: 'Cost Recovery', value: 'Jun 30' },
  ];
  var html = '<div id="stats-bar" class="stats-bar">';
  stats.forEach(function(s) {
    html += '<div class="stat-item"><span class="stat-item-icon">' + s.icon + '</span><div><div class="stat-item-label">' + s.label + '</div><div class="stat-item-value">' + s.value + '</div></div></div>';
  });
  html += '</div>';
  el.insertAdjacentHTML('afterend', html);
}

// ── REMINDERS ──────────────────────────────────────────────────────
function renderReminders() {
  var el = document.getElementById('luna-reminders');
  if (!el) return;
  var now = new Date();
  var day = now.getDate();
  var month = now.getMonth();
  var year = now.getFullYear();
  var monthKey = year + '-' + month;

  // Get dismissed state
  var dismissed = {};
  try { var d = localStorage.getItem('lu_remind_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}

  var reminders = [];

  // Monthly Draw Package — due 10th
  var drawDue = new Date(year, month, 10);
  if (day > 10) drawDue.setMonth(month + 1);
  var drawDays = Math.round((drawDue - now) / 86400000);
  var drawId = 'draw_' + monthKey;
  if (!dismissed[drawId]) reminders.push({
    id: drawId, icon: '💰', title: 'Monthly Draw Package',
    desc: 'Due in ' + drawDays + ' day' + (drawDays !== 1 ? 's' : ''),
    urgent: drawDays <= 3, warn: drawDays <= 7 && drawDays > 3
  });

  // Monthly Expense Report — due 5th
  var expDue = new Date(year, month, 5);
  if (day > 5) expDue.setMonth(month + 1);
  var expDays = Math.round((expDue - now) / 86400000);
  var expId = 'expense_' + monthKey;
  if (!dismissed[expId]) reminders.push({
    id: expId, icon: '🧾', title: 'Monthly Expense Report',
    desc: 'Due in ' + expDays + ' day' + (expDays !== 1 ? 's' : ''),
    urgent: expDays <= 3, warn: expDays <= 7 && expDays > 3
  });

  // Weekly Events Calendar — due Friday
  var friday = new Date(now);
  friday.setDate(now.getDate() + (5 - now.getDay() + 7) % 7);
  if (now.getDay() > 5) friday.setDate(friday.getDate() + 7);
  if (now.getDay() === 5 && now.getHours() >= 17) friday.setDate(friday.getDate() + 7);
  var calDays = Math.round((friday - now) / 86400000);
  var calId = 'calendar_w' + year + '_' + (function(n){while(n<0)n+=7;return Math.floor((n-friday.getDay()+7)/7);})(now.getDay()) + '_' + friday.getDate();
  // simpler ID
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
      // Each H2 is a collapsible subsection
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

        // Related sections cross-references
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
  // Auto-expand groups when filtering by phase
  if (activePhase) collapsedGroups = {};
  renderPlaybook();
}

function setTopic(t) {
  activeTopic = (activeTopic === t) ? null : t;
  if (activeTopic) collapsedGroups = {};
  renderPlaybook();
}

var searchTimer = null;
function applySearch(q) {
  if (searchTimer) clearTimeout(searchTimer);
  var searchWrap = document.querySelector('.search-wrap');
  var existing = document.getElementById('search-results-dropdown');
  if (existing) existing.remove();
  searchTimer = setTimeout(function() {
    activeSearch = (q || '').trim();
    if (!activeSearch) {
      // Clear search results dropdown
      var dd = document.getElementById('search-results-dropdown');
      if (dd) dd.remove();
      if (currentView === 'playbook') renderSections();
      return;
    }
    var ql = activeSearch.toLowerCase();
    var results = [];

    // Search playbook sections
    if (window.__KNOWLEDGE_BASE) {
      window.__KNOWLEDGE_BASE.forEach(function(s) {
        var match = (s.title && s.title.toLowerCase().indexOf(ql) >= 0) || (s.body && s.body.toLowerCase().indexOf(ql) >= 0);
        if (match) results.push({type: 'playbook', label: 'Section ' + s.id + ': ' + s.title, id: s.id, preview: (s.body || '').substring(0, 120)});
      });
    }

    // Search templates
    if (window.__TEMPLATES) {
      Object.keys(window.__TEMPLATES).forEach(function(k) {
        var t = window.__TEMPLATES[k];
        var match = (t.name && t.name.toLowerCase().indexOf(ql) >= 0) || (t.desc && t.desc.toLowerCase().indexOf(ql) >= 0) || (k && k.toLowerCase().indexOf(ql) >= 0);
        if (match) results.push({type: 'template', label: 'Template: ' + t.name, id: k, preview: (t.desc || '').substring(0, 120)});
      });
    }

    // Search projects/mfp
    var projectKeywords = ['mfp', 'freedom park', 'stadium', 'lemartec', 'arq', 'punch', 'financial', 'budget', 'change order', 'closeout', 'miller', 'day 2', 'issue'];
    if (ql && projectKeywords.some(function(kw) { return kw.indexOf(ql) >= 0 || ql.indexOf(kw) >= 0; })) {
      results.push({type: 'project', label: 'Project: Miami Freedom Park Stadium', id: 'mfp', preview: 'Post-opening closeout. Home opener April 4, 2026. Active workstreams: punch list closeout, cost recovery audit, Lemartec contract closeout.'});
    }

    // Highlight function
    function highlightText(text, query) {
      if (!query || !text) return text;
      var re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      return text.replace(re, '<mark style="background:#fff3a8;padding:1px 2px;border-radius:2px">$1</mark>');
    }

    // Render dropdown
    if (results.length) {
      var searchRect = searchWrap ? searchWrap.getBoundingClientRect() : {left: 0, top: 0, width: 0};
      var dd = document.createElement('div');
      dd.id = 'search-results-dropdown';
      dd.style.cssText = 'position:fixed;top:' + (searchRect.bottom + 4) + 'px;left:' + searchRect.left + 'px;width:' + Math.max(searchRect.width, 300) + 'px;max-height:400px;overflow-y:auto;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:1000;padding:8px 0';
      dd.innerHTML = '<div style="padding:6px 14px 8px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)">' + results.length + ' result' + (results.length > 1 ? 's' : '') + ' for "' + activeSearch + '"</div>';
      results.forEach(function(r) {
        var icon = r.type === 'playbook' ? '\uD83D\uDCD6' : r.type === 'template' ? '\uD83D\uDCC1' : '\uD83C\uDFDF';
        var onClick = "var dd=document.getElementById('search-results-dropdown');if(dd)dd.remove();document.getElementById('search-input').value='';activeSearch='';";
        if (r.type === 'playbook') onClick += "setView('playbook');jumpTo('" + r.id + "');";
        else if (r.type === 'template') onClick += "setView('templates');";
        else if (r.type === 'project') onClick += "setView('mfp');";
        dd.innerHTML += '<div class="search-result-item" style="padding:10px 14px;cursor:pointer;transition:background .1s;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--teal-light)\'" onmouseout="this.style.background=\'\'" onclick="' + onClick + '">'
          + '<div style="display:flex;align-items:center;gap:8px">'
          + '<span>' + icon + '</span>'
          + '<span style="font-size:13px;font-weight:600;color:var(--charcoal);flex:1">' + highlightText(r.label, activeSearch) + '</span>'
          + (r.id ? '<span style="font-size:10px;color:var(--muted);background:var(--cool);padding:2px 6px;border-radius:4px">' + r.type + '</span>' : '')
          + '</div>'
          + (r.preview ? '<div style="font-size:12px;color:var(--muted);margin-top:3px;line-height:1.4">' + highlightText(r.preview, activeSearch) + '</div>' : '')
          + '</div>';
      });
      document.body.appendChild(dd);

      // Click outside to close
      var closeHandler = function(e) {
        if (!dd.contains(e.target) && e.target.id !== 'search-input') {
          dd.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(function() { document.addEventListener('click', closeHandler); }, 10);
    }

    // Also render playbook with results if on that view
    if (activeSearch) collapsedGroups = {};
    if (currentView === 'playbook') renderSections();
  }, 250);
}

function clearFilters() {
  activePhase = null;
  activeTopic = null;
  activeSearch = '';
  var si = document.getElementById('luna-hero-input');
  if (si) si.value = '';
  // Reset to clean collapsed state
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


// ── PROJECTS / MFP ────────────────────────────────────────────────
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
  grid.innerHTML = '<div class="mfp-card" onclick="setView(\'mfp\')" style="cursor:pointer">'
    + '<div class="mfp-card-head">'
    + '<span class="mfp-icon">🏟</span>'
    + '<span class="mfp-card-title">Miami Freedom Park Stadium</span>'
    + '<span class="mfp-badge red">Active</span>'
    + '</div>'
    + '<div class="mfp-card-summary">Post-opening closeout. Home opener April 4, 2026. cost recovery audit, punch list disputes with Lemartec, ARQ payment hold, HVAC service agreement.</div>'
    + '<div class="mfp-card-bullets">'
    + 'Total commitments: ' + stadiumRevised + '<br>'
    + 'Paid: ' + stadiumPaid + ', Balance: ' + stadiumBal + '<br>'
    + 'Hard cost budget: ' + stadiumBudget + '<br>'
    + 'Cost recovery target: $9M+<br>'
    + 'Audit final delivery: June 30, 2026'
    + '</div>'
    + '</div>'
    + '<div class="mfp-card" style="opacity:.6;cursor:pointer" onclick="alert(\'Sixers arena pursuit — currently in pitch phase\')">'
    + '<div class="mfp-card-head">'
    + '<span class="mfp-icon">🏀</span>'
    + '<span class="mfp-card-title">Sixers Arena (Philadelphia)</span>'
    + '<span class="mfp-badge">Pursuit</span>'
    + '</div>'
    + '<div class="mfp-card-summary">Pitch package complete for EVP Alex Kafenbaum. DD phase. Targeting Q1/Q2 2031 opening.</div>'
    + '</div>'
    + '<div class="mfp-card" style="opacity:.6;cursor:pointer" onclick="alert(\'DOVA Sacramento — SD phase\')">'
    + '<div class="mfp-card-head">'
    + '<span class="mfp-icon">🏗</span>'
    + '<span class="mfp-card-title">DOVA (Sacramento)</span>'
    + '<span class="mfp-badge">Pursuit</span>'
    + '</div>'
    + '<div class="mfp-card-summary">SD phase. Targeting late 2027 / early 2028 opening.</div>'
    + '</div>';
}

function renderMFP() {
  var el = document.getElementById('mfp-content');
  if (!el) return;
  var F = window.__MFP_FINANCIALS;
  var S = F ? F.summary : null;
  var H = F ? F.hard : null;
  function fm(n){ if (n==null) return '$0'; var s=Math.abs(n).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,'); return '$'+s; }
  // Ensure MFP_DETAILS is available for inline card expansion
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
    var millerOut = H ? fm(H.commitments.find(function(c){return c.company.indexOf('MILLER')>=0;}).balance) : '';
    el.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px">'
      + '<div style="font-size:13px;color:var(--muted);margin-bottom:4px">CURRENT PHASE <span style="color:#c0392b;font-weight:700">| ' + daysPast + '</span></div>'
      + '<div style="font-size:18px;font-weight:700;color:var(--charcoal);margin-bottom:8px">Post-Opening / Active Closeout</div>'
      + '<div style="font-size:14px;color:var(--charcoal);line-height:1.6">Home opener April 4, 2026 completed. Targeting final completion ' + (S ? S.target_completion : 'July 31, 2026') + '. Active workstreams: punch list closeout, cost recovery audit (delivery June 30), Lemartec contract closeout, HVAC service agreement transfer, Day 2 owner requests log.</div>'
    + '</div>'
    + '<div class="mfp-grid">'
    + '<div class="mfp-card" onclick="openMFPModal(\'issues\')"><div class="mfp-card-head"><span class="mfp-icon">\uD83D\uDD34</span><span class="mfp-card-title">Live Issues</span><span class="mfp-badge red">4 HIGH</span></div><div class="mfp-card-summary">ARQ payment hold (~$1.5M Feb-Apr invoices), cost recovery audit deadline, Lemartec punch list disputes, HVAC contractor departure risk, Lemartec indirect cost gap.</div><div class="mfp-expand-content"></div></div>'
        + '<div class="mfp-card" onclick="openMFPModal(\'financials\')"><div class="mfp-card-head"><span class="mfp-icon">\uD83D\uDCB0</span><span class="mfp-card-title">Financials</span></div><div class="mfp-card-summary">Total budget: ' + budgetVal + '. Stadium: ' + stadiumVal + ' revised, ' + pctComplete + ' complete. Miller Electric outstanding: ' + millerOut + '. Retainage: ' + retainVal + '.</div><div class="mfp-expand-content"></div></div>'
        + '<div class="mfp-card" onclick="openMFPModal(\'punchlist\')"><div class="mfp-card-head"><span class="mfp-icon">\uD83D\uDCCB</span><span class="mfp-card-title">Punch List</span><span class="mfp-badge warn">Active</span></div><div class="mfp-card-summary">Tile installation deficiency and surface-mounted electrical conduit (spec required concealed) are active disputes with Lemartec. Position: correction, not credit.</div><div class="mfp-expand-content"></div></div>'
        + '<div class="mfp-card" onclick="openMFPModal(\'day2\')"><div class="mfp-card-head"><span class="mfp-icon">\uD83C\uDFD7</span><span class="mfp-card-title">Day 2 Items</span><span class="mfp-badge warn">60+</span></div><div class="mfp-card-summary">Owner-directed post-opening scope. Each requires scope definition, cost estimate, owner authorization. Distinct from punch list.</div><div class="mfp-expand-content"></div></div>'
        + '<div class="mfp-card" onclick="openMFPModal(\'stakeholders\')"><div class="mfp-card-head"><span class="mfp-icon">\uD83D\uDC65</span><span class="mfp-card-title">Stakeholders</span></div><div class="mfp-card-summary">Owner: Graham Oxley (day-to-day), Devon McCorkle &amp; Victor Oliver (approvers). CM/GC: Lemartec. AOR: ARQ.</div><div class="mfp-expand-content"></div></div>'
    + '</div>'
    + '<div style="margin-top:24px"><button class="btn-primary" onclick="toggleChat()">Ask L.U.N.A. about MFP \u2192</button></div>';
    // Export modal function globally so card onclick handlers work
    window.openMFPModal = showMFPDetail;
    }
    function toggleMFPExpand(card, view) {
          var content = card.querySelector('.mfp-expand-content');
          if (!content) return;
          if (content.innerHTML) {
            content.innerHTML = '';
            content.style.display = 'none';
            card.classList.remove('expanded');
            return;
          }
          var details = window.__MFP_DETAILS;
          if (!details || !details[view]) return;
          content.innerHTML = details[view].body;
          content.style.display = 'block';
          card.classList.add('expanded');
        }

        function showMFPDetail(view) {
                          var details = {
                issues: {
                  icon: '🔴', title: 'Live Issues',
                  body: '<div style="margin-bottom:16px"><strong style="font-size:15px;color:var(--charcoal)">4 High Priority Issues</strong></div>'
                    + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
                    + '<strong>1. ARQ Payment Hold</strong><br>~$1.5M in Feb-Apr invoices on hold. Disputed work quality and incomplete deliverables.<br>'
                    + '<span style="font-size:11px;color:var(--muted)">Owner: Graham Oxley | Status: Open</span></div>'
                    + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
                    + '<strong>2. Punch List: Tile Installation Deficiency</strong><br>Surface-mounted electrical conduit violates spec requiring concealed. Position: correction, not credit.<br>'
                    + '<span style="font-size:11px;color:var(--muted)">Disputed with Lemartec | Status: Open</span></div>'
                    + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
                    + '<strong>3. HVAC Service Agreement — Hill York</strong><br>Contractor departure risk. Urgent — pending signature.<br>'
                    + '<span style="font-size:11px;color:var(--muted)">Status: Urgent / Pending Signature</span></div>'
                    + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
                    + '<strong>4. Lemartec Indirect Costs</strong><br>$39.5M indirect cost payment gap. General requirements, general conditions, CM fee, and insurance unpaid.<br>'
                    + '<span style="font-size:11px;color:var(--muted)">Status: Open</span></div>'
                },
                financials: {
                          icon: '💰', title: 'Financials',
                          body: (function(){
                            var F = window.__MFP_FINANCIALS;
                            if (!F) return '<div style="padding:24px;text-align:center;color:var(--muted)">Financial data not loaded.</div>';
                            var H = F.hard;
                            var S = F.soft;
                            var Su = F.summary;
                            function fm(n){ if (n==null) return '—'; var s=Math.abs(n).toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,'); return (n<0?'($':'\$')+s+(n<0?')':''); }

                            var html = '<div style="margin-bottom:16px">'
                              + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
                              + '<strong style="font-size:16px">Budget Overview</strong>'
                              + '<span style="font-size:11px;color:var(--muted)">From Procore + Budget Files</span>'
                              + '</div>'
                              + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:16px">'
                              + '<div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Total Budget</span><strong style="font-size:16px">' + fm(Su.total_budget) + '</strong></div>'
                              + '<div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Paid to Date</span><strong style="font-size:16px">' + fm(Su.paid_to_date) + '</strong></div>'
                              + '<div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Past Due</span><strong style="font-size:16px;color:#c0392b">' + fm(Su.past_due) + '</strong></div>'
                              + '<div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Retainage</span><strong style="font-size:16px">' + fm(Su.retainage_held) + '</strong></div>'
                              + '</div>'

                            // HARD vs SOFT costs side by side
                            var softTotal = S.design_total + (S.ffe_budget || 0) + (S.freight || 0) + (S.customs_duties || 0) + (S.contingency || 0);
                            var allHardCosts = H.total_revised;
                            var allSoftCosts = softTotal;
                            var grandTotal = allHardCosts + allSoftCosts;

                            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'
                              + '<div style="background:#eaf7f5;border:1px solid var(--teal);border-radius:10px;padding:16px">'
                              + '<span style="font-size:11px;color:var(--teal);font-weight:700;text-transform:uppercase;display:block;margin-bottom:6px">🔨 Hard Costs (Procore)</span>'
                              + '<strong style="font-size:20px;color:var(--charcoal)">' + fm(allHardCosts) + '</strong><br>'
                              + '<span style="font-size:12px;color:var(--muted)">' + H.commitments.length + ' active commitments · ' + fm(H.total_original) + ' base + ' + fm(H.total_approved_cos) + ' COs</span>'
                              + '</div>'
                              + '<div style="background:#f0f4ff;border:1px solid #4a90d9;border-radius:10px;padding:16px">'
                              + '<span style="font-size:11px;color:#4a90d9;font-weight:700;text-transform:uppercase;display:block;margin-bottom:6px">📄 Soft Costs (Budget Files)</span>'
                              + '<strong style="font-size:20px;color:var(--charcoal)">' + fm(allSoftCosts) + '</strong><br>'
                              + '<span style="font-size:12px;color:var(--muted)">Design fees, FF&E, freight, duties, contingency</span>'
                              + '</div>'
                              + '</div>'

                            // ESTIMATED TOTAL
                            html += '<div style="background:var(--charcoal);color:#fff;border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">'
                              + '<strong>Estimated Total Project Cost (Hard + Soft)</strong>'
                              + '<strong style="font-size:20px">' + fm(grandTotal) + '</strong>'
                              + '</div>'

                            // === SOFT COSTS BREAKDOWN ===
                            html += '<div style="font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:10px">Soft Cost Breakdown</div>'
                              // Design Team
                              + '<div style="background:#f0f4ff;border:1px solid #4a90d9;border-radius:10px;padding:14px;margin-bottom:10px">'
                              + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                              + '<strong>🎨 Design Team (' + S.design_team.length + ' firms)</strong>'
                              + '<strong style="font-size:16px;color:#4a90d9">' + fm(S.design_total) + '</strong>'
                              + '</div>'
                              + '<div style="max-height:300px;overflow-y:auto;margin-top:6px">';

                            // Sort design team by fee descending
                            var sortedDesign = S.design_team.slice().sort(function(a,b){ return b.fee - a.fee; });
                            sortedDesign.forEach(function(d,i){
                              html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px">'
                                + '<div><strong>' + d.firm + '</strong><br><span style="font-size:11px;color:var(--muted)">' + d.scope + '</span></div>'
                                + '<strong>' + fm(d.fee) + '</strong></div>';
                            });

                            html += '</div></div>'

                              // FF&E
                              + '<div style="background:#fffbee;border:1px solid #e6a817;border-radius:10px;padding:14px;margin-bottom:10px">'
                              + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                              + '<strong>🪑 FF&E Budget</strong>'
                              + '<strong style="font-size:16px;color:#e6a817">' + fm(S.ffe_budget) + '</strong>'
                              + '</div>';

                            S.ffe_breakdown.forEach(function(f){
                              html += '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--charcoal);padding:3px 0;border-bottom:1px solid var(--border)">'
                                + '<span>' + f.category + '</span>'
                                + '<span>' + fm(f.amount) + '</span></div>';
                            });

                            html += '</div>'

                              // Other Soft Costs
                              + '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">'
                              + '<strong>📊 Other Identified Soft Costs</strong>'
                              + '<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--border);margin-top:6px"><span>Freight</span><strong>' + fm(S.freight) + '</strong></div>'
                              + '<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--border)"><span>Customs Duties / Tariffs</span><strong>' + fm(S.customs_duties) + '</strong></div>'
                              + '<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0"><span>Contingency</span><strong>' + fm(S.contingency) + '</strong></div>'
                              + '</div>'

                              // PENDING ITEMS
                              + '<div style="background:#fff4f0;border:1px solid #d35400;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px">'
                              + '<strong>⚠️ Soft Costs Still Pending from Files:</strong><br>'
                              + '<span style="color:var(--muted)">OCIP/Insurance, Legal Fees, Owner\'s Rep Fees (Level Up), Commissioning — not yet sourced from available budget documents.</span>'
                              + '</div>'

                            // SUBCONTRACTOR TABLE
                            html += '<div style="font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:10px">Subcontractor Breakdown — Hard Costs</div>'
                              + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;background:var(--card);margin-bottom:16px">'
                              + '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px">'
                              + '<thead><tr style="background:var(--teal);color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.3px">'
                              + '<th style="padding:10px 8px;text-align:left">#</th>'
                              + '<th style="padding:10px 8px;text-align:left">Subcontractor</th>'
                              + '<th style="padding:10px 8px;text-align:left">Scope</th>'
                              + '<th style="padding:10px 8px;text-align:right">Base</th>'
                              + '<th style="padding:10px 8px;text-align:right">Approved COs</th>'
                              + '<th style="padding:10px 8px;text-align:right">Revised</th>'
                              + '<th style="padding:10px 8px;text-align:right">Paid</th>'
                              + '<th style="padding:10px 8px;text-align:right">%</th>'
                              + '<th style="padding:10px 8px;text-align:right">Balance</th>'
                              + '</tr></thead><tbody>';

                            var subs = H.commitments;
                            subs.sort(function(a,b){ return b.revised - a.revised; });
                            subs.forEach(function(sub,i){
                              var coClass = sub.co < 0 ? 'color:#c0392b' : '';
                              html += '<tr style="border-top:1px solid var(--border)">'
                                + '<td style="padding:7px 8px;color:var(--muted)">' + (i+1) + '</td>'
                                + '<td style="padding:7px 8px;font-weight:600;white-space:nowrap">' + sub.company.replace(/,? (INC|LLC|CORP|CO).*/,'') + '</td>'
                                + '<td style="padding:7px 8px;color:var(--muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sub.title + '">' + sub.title + '</td>'
                                + '<td style="padding:7px 8px;text-align:right;white-space:nowrap">' + fm(sub.orig) + '</td>'
                                + '<td style="padding:7px 8px;text-align:right;white-space:nowrap;' + coClass + '">' + fm(sub.co) + '</td>'
                                + '<td style="padding:7px 8px;text-align:right;white-space:nowrap;font-weight:700">' + fm(sub.revised) + '</td>'
                                + '<td style="padding:7px 8px;text-align:right;white-space:nowrap">' + fm(sub.paid) + '</td>'
                                + '<td style="padding:7px 8px;text-align:right;white-space:nowrap">' + sub.pct_paid.toFixed(1) + '%</td>'
                                + '<td style="padding:7px 8px;text-align:right;white-space:nowrap;font-weight:600' + (sub.balance > 1000000 ? ';color:#c0392b' : '') + '">' + fm(sub.balance) + '</td>'
                                + '</tr>';
                            });

                            html += '<tr style="border-top:2px solid var(--charcoal);background:var(--teal-light);font-weight:700">'
                              + '<td style="padding:9px 8px"></td>'
                              + '<td style="padding:9px 8px"><strong>TOTAL</strong></td>'
                              + '<td style="padding:9px 8px"></td>'
                              + '<td style="padding:9px 8px;text-align:right">' + fm(H.total_original) + '</td>'
                              + '<td style="padding:9px 8px;text-align:right">' + fm(H.total_approved_cos) + '</td>'
                              + '<td style="padding:9px 8px;text-align:right">' + fm(H.total_revised) + '</td>'
                              + '<td style="padding:9px 8px;text-align:right">' + fm(H.total_paid) + '</td>'
                              + '<td style="padding:9px 8px;text-align:right">' + H.total_pct_paid.toFixed(1) + '%</td>'
                              + '<td style="padding:9px 8px;text-align:right">' + fm(H.total_balance) + '</td>'
                              + '</tr>'

                            html += '</tbody></table></div>'

                            // Links
                            html += '<div style="margin-top:12px;padding:12px;background:var(--teal-light);border-radius:8px;font-size:13px">'
                              + '<strong>🔗 Quick Links</strong><br>'
                              + '• <a href="https://app.procore.com/2916773/project/commitments" target="_blank" style="color:var(--teal)">Procore — Commitments</a><br>'
                              + '• <a href="https://app.procore.com/2916773/project/drawings" target="_blank" style="color:var(--teal)">Procore — Drawing Set</a><br>'
                              + '• <a href="https://app.procore.com/2916773/project/change_orders" target="_blank" style="color:var(--teal)">Procore — Change Orders</a><br>'
                              + '• <a href="https://app.procore.com/2916773/project/budget" target="_blank" style="color:var(--teal)">Procore — Budget</a>'
                              + '</div>'

                            return html;
                          })()
                        },
                punchlist: {
                  icon: '📋', title: 'Punch List',
                  body: '<div style="margin-bottom:16px"><strong>Active Punch List Closeout</strong> <span style="font-size:12px;color:var(--muted)">— Stadium is open and operational</span></div>'
                    + '<div style="background:var(--bg);border-radius:8px;padding:14px;margin-bottom:12px">'
                    + '<strong>Primary Disputes:</strong><br>'
                    + '• <strong>Tile Installation Deficiency</strong> — Disputed with Lemartec. Position: correction, not credit.<br>'
                    + '• <strong>Surface-Mounted Electrical Conduit</strong> — Spec required concealed. Position: correction, not credit.<br><br>'
                    + '<strong>Note:</strong> Day 2 items (60+ owner-directed post-opening scope) are distinct from punch list. Each needs scope definition, cost estimate, and owner authorization.</div>'
                    + '<div style="padding:12px;background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;font-size:13px">'
                    + '<strong>⚡ Position:</strong> Correction, not credit. We hold that defective work must be corrected at the contractor\'s cost. This is not a change order issue — it\'s a quality/compliance issue under the existing contract.</div>'
                },
                day2: {
                  icon: '🏗', title: 'Day 2 Items',
                  body: '<div style="margin-bottom:12px"><strong>Owner-Directed Post-Opening Scope</strong> <span style="font-size:12px;color:var(--muted)">— 60+ items in various stages</span></div>'
                    + '<div style="margin-bottom:12px;padding:10px 14px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--muted)">Day 2 items are owner-directed scope additions <strong>after the stadium opened</strong> (April 4, 2026). Distinct from punch list (defect corrections under existing contracts). Each needs scope definition, cost estimate, and owner authorization.</div>'
                    + '<div style="font-size:13px;font-weight:700;color:var(--charcoal);margin-bottom:8px">Known Day 2 Items</div>'
                    + '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:12px">'
                    + '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--teal);color:#fff;font-size:11px;text-transform:uppercase">'
                    + '<th style="padding:8px 10px;text-align:left">Item</th><th style="padding:8px 10px;text-align:left">Category</th><th style="padding:8px 10px;text-align:center">Status</th></tr></thead><tbody>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Concourse signage & wayfinding additions</td><td style="padding:8px 10px;color:var(--muted)">Signage</td><td style="padding:8px 10px;text-align:center"><span style="background:#eaf7f5;color:var(--teal);padding:2px 8px;border-radius:4px;font-size:11px">In Progress</span></td></tr>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Team store expansion / retail fixturing</td><td style="padding:8px 10px;color:var(--muted)">Retail</td><td style="padding:8px 10px;text-align:center"><span style="background:#eaf7f5;color:var(--teal);padding:2px 8px;border-radius:4px;font-size:11px">In Progress</span></td></tr>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Premium club / lounge finishing items</td><td style="padding:8px 10px;color:var(--muted)">Interiors</td><td style="padding:8px 10px;text-align:center"><span style="background:#fff8e1;color:#e6a817;padding:2px 8px;border-radius:4px;font-size:11px">Awaiting Scope</span></td></tr>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Broadcast / camera platform additions</td><td style="padding:8px 10px;color:var(--muted)">Technology</td><td style="padding:8px 10px;text-align:center"><span style="background:#fff8e1;color:#e6a817;padding:2px 8px;border-radius:4px;font-size:11px">Awaiting Scope</span></td></tr>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Plaza / boulevard site furnishing & landscaping</td><td style="padding:8px 10px;color:var(--muted)">Site</td><td style="padding:8px 10px;text-align:center"><span style="background:#fce8e8;color:#c0392b;padding:2px 8px;border-radius:4px;font-size:11px">Not Started</span></td></tr>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Additional security screening equipment</td><td style="padding:8px 10px;color:var(--muted)">Security</td><td style="padding:8px 10px;text-align:center"><span style="background:#eaf7f5;color:var(--teal);padding:2px 8px;border-radius:4px;font-size:11px">In Progress</span></td></tr>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Parking lot improvements & striping</td><td style="padding:8px 10px;color:var(--muted)">Site</td><td style="padding:8px 10px;text-align:center"><span style="background:#fff8e1;color:#e6a817;padding:2px 8px;border-radius:4px;font-size:11px">Awaiting Scope</span></td></tr>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Hospitality / F&B concession upgrades</td><td style="padding:8px 10px;color:var(--muted)">F&B</td><td style="padding:8px 10px;text-align:center"><span style="background:#fce8e8;color:#c0392b;padding:2px 8px;border-radius:4px;font-size:11px">Not Started</span></td></tr>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Audio/visual system enhancements (upper bowl)</td><td style="padding:8px 10px;color:var(--muted)">Technology</td><td style="padding:8px 10px;text-align:center"><span style="background:#fff8e1;color:#e6a817;padding:2px 8px;border-radius:4px;font-size:11px">Awaiting Scope</span></td></tr>'
                    + '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px">Suite-level interior finishing & FF&E complete</td><td style="padding:8px 10px;color:var(--muted)">Interiors</td><td style="padding:8px 10px;text-align:center"><span style="background:#eaf7f5;color:var(--teal);padding:2px 8px;border-radius:4px;font-size:11px">In Progress</span></td></tr>'
                    + '</tbody></table></div>'
                    + '<div style="background:#fff4f0;border:1px solid #d35400;border-radius:8px;padding:10px 14px;font-size:12px;color:var(--charcoal)">'
                    + '<strong>📋 Note:</strong> Full Day 2 tracker maintained in closeout meetings. These 10 items are a representative sample — total is 60+ owner requests in various stages. Status source: weekly closeout meeting notes.</div>'
                },
                stakeholders: {
                  icon: '👥', title: 'Stakeholders',
                  body: '<div style="margin-bottom:16px"><strong>Project Stakeholders</strong></div>'
                    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
                    + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>Owner</strong><br>Miami Freedom Park, LLC<br>Jorge Mas · Jose Mas<br><span style="font-size:12px;color:var(--muted)">Graham Oxley (day-to-day)<br>Devon McCorkle (approver)<br>Victor Oliver (approver)</span></div>'
                    + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>CM / GC</strong><br>Lemartec Corporation<br><span style="font-size:12px;color:var(--muted)">Construction Manager as Agent</span></div>'
                    + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>Architect of Record</strong><br>Arquitectonica (ARQ)<br><span style="font-size:12px;color:var(--muted)">Agreement executed July 27, 2023</span></div>'
                    + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>Design Architect</strong><br>MANICA Architecture<br><span style="font-size:12px;color:var(--muted)">Agreement executed July 27, 2023</span></div>'
                    + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>Cost Recovery Audit</strong><br>Independent analyst (confidential)<br><span style="font-size:12px;color:var(--muted)">Target: $9M+ recoverable<br>Delivery: June 30</span></div>'
                    + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>IMCF Operations</strong><br>Antonio Torres Roman (Lead)<br>Kaitlyn Stolzenberg<br>Nelson Fuentes (Facilities)</div>'
                    + '</div>'
                }
              };
              window.__MFP_DETAILS = details;
              var d = details[view];
              if (!d) return;

              // Build modal HTML with resize handle
              var html = '<div class="modal-dialog" style="max-width:' + (view === 'financials' ? '960' : '680') + 'px">'
                + '<div class="modal-header"><div class="modal-title">' + d.icon + ' ' + d.title + '</div>'
                + '<button class="chat-close" onclick="closeModal(\'modal-mfp-detail\')">×</button></div>'
                + '<div class="modal-body" style="padding:20px 24px">' + d.body + '</div>'
                + '<div class="modal-resize-handle"></div></div>';

              var existing = document.getElementById('modal-mfp-detail');
              if (!existing) {
                var overlay = document.createElement('div');
                overlay.id = 'modal-mfp-detail';
                overlay.className = 'modal-overlay';
                overlay.onclick = function(e) { if (e.target === this) closeModal('modal-mfp-detail'); };
                document.body.appendChild(overlay);
              }
              document.getElementById('modal-mfp-detail').innerHTML = html;
              document.getElementById('modal-mfp-detail').classList.add('open');

              // ── DRAGGABLE ──
              var dialog = document.querySelector('#modal-mfp-detail .modal-dialog');
              var header = document.querySelector('#modal-mfp-detail .modal-header');
              if (dialog && header) {
                var dragOffX = 0, dragOffY = 0, dragActive = false;
                header.onmousedown = function(e) {
                  if (e.target.closest('button')) return;
                  dragActive = true;
                  dragOffX = e.clientX - dialog.offsetLeft;
                  dragOffY = e.clientY - dialog.offsetTop;
                  dialog.classList.add('dragging');
                  e.preventDefault();
                };
                document.onmousemove = function(e) {
                  if (!dragActive) return;
                  var overlay = document.getElementById('modal-mfp-detail');
                  var oRect = overlay.getBoundingClientRect();
                  var maxW = oRect.width - dialog.offsetWidth;
                  var maxH = oRect.height - dialog.offsetHeight;
                  var x = Math.max(0, Math.min(maxW, e.clientX - dragOffX));
                  var y = Math.max(0, Math.min(maxH, e.clientY - dragOffY));
                  dialog.style.left = x + 'px';
                  dialog.style.top = y + 'px';
                  dialog.style.margin = '0';
                };
                document.onmouseup = function() {
                  if (dragActive) {
                    dragActive = false;
                    dialog.classList.remove('dragging');
                  }
                };
              }

              // ── RESIZABLE ──
              var handle = document.querySelector('#modal-mfp-detail .modal-resize-handle');
              if (dialog && handle) {
                var resizeActive = false, startX, startY, startW, startH;
                handle.onmousedown = function(e) {
                  resizeActive = true;
                  startX = e.clientX;
                  startY = e.clientY;
                  startW = dialog.offsetWidth;
                  startH = dialog.offsetHeight;
                  dialog.classList.add('resizing');
                  e.preventDefault();
                  e.stopPropagation();
                };
                handle._resizeMove = function(e) {
                  if (!resizeActive) return;
                  var overlay = document.getElementById('modal-mfp-detail');
                  var oRect = overlay.getBoundingClientRect();
                  var newW = Math.max(320, Math.min(oRect.width - 40, startW + (e.clientX - startX)));
                  var newH = Math.max(200, Math.min(oRect.height - 40, startH + (e.clientY - startY)));
                  dialog.style.width = newW + 'px';
                  dialog.style.height = newH + 'px';
                  dialog.style.maxWidth = 'none';
                  dialog.style.maxHeight = 'none';
                };
                handle._resizeUp = function() {
                  if (resizeActive) {
                    resizeActive = false;
                    dialog.classList.remove('resizing');
                  }
                };
                // Use event listeners directly (not ondocument to avoid conflict with drag)
                document.addEventListener('mousemove', handle._resizeMove);
                document.addEventListener('mouseup', handle._resizeUp);
              }
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
    var isOpen = catState[cat] === true;
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

// ── L.U.N.A. RESPONSE FORMATTER ───────────────────────────────────
// Converts markdown links to clickable navigation in the Playbook
function formatLunaResponse(text) {
  if (!text) return '';
  var html = escapeHtml(text);
  // Convert [text](template:key) → click to open Templates tab
  html = html.replace(/\[([^\]]+)\]\(template:([^)]+)\)/g,
    '<a href="#" onclick="setView(\'templates\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert [text](section:num) → click to open Playbook at section
  html = html.replace(/\[([^\]]+)\]\(section:(\d+)\)/g,
    '<a href="#" onclick="setView(\'playbook\');jumpTo(\'$2\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert [text](templates) → click to open Templates tab
  html = html.replace(/\[([^\]]+)\]\(templates\)/g,
    '<a href="#" onclick="setView(\'templates\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert [text](playbook) → click to open Playbook tab
  html = html.replace(/\[([^\]]+)\]\(playbook\)/g,
    '<a href="#" onclick="setView(\'playbook\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert [text](projects) → click to open Projects tab
  html = html.replace(/\[([^\]]+)\]\(projects\)/g,
    '<a href="#" onclick="setView(\'projects\');return false" style="color:var(--teal);text-decoration:underline;font-weight:600">$1</a>');
  // Convert external markdown links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" style="color:var(--teal);text-decoration:underline">$1</a>');
  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');
  return html;
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
function loadActions(tab) {
  tab = tab || window.aiTab || 'team';
  try { return JSON.parse(localStorage.getItem('lu_actions_' + tab) || '[]'); }
  catch(e) { return []; }
}
function saveActions(items, tab) {
  tab = tab || window.aiTab || 'team';
  try { localStorage.setItem('lu_actions_' + tab, JSON.stringify(items)); } catch(e) {}
}

function renderActions() {
  var el = document.getElementById('actions-content');
  if (!el) return;
  var tab = window.aiTab || 'team';
  var items = loadActions(tab);

  el.innerHTML = '<div style="display:flex;gap:0;margin-bottom:18px;border-bottom:1px solid var(--border)">'
    + '<button onclick="switchActionTab(\'team\')" style="background:none;border:none;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;color:' + (tab==='team'?'var(--teal)':'var(--muted)') + ';border-bottom:2px solid ' + (tab==='team'?'var(--teal)':'transparent') + '">Team</button>'
    + '<button onclick="switchActionTab(\'personal\')" style="background:none;border:none;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;color:' + (tab==='personal'?'var(--teal)':'var(--muted)') + ';border-bottom:2px solid ' + (tab==='personal'?'var(--teal)':'transparent') + '">Personal</button>'
    + '</div>'
    + '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">'
    + '<div style="display:flex;gap:8px">'
    + '<input id="action-input" placeholder="Add a ' + tab + ' action item..." style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:14px;background:var(--bg);color:var(--charcoal);outline:none">'
    + '<button class="btn-primary" onclick="addAction()">Add</button>'
    + '</div></div>';

  if (items.length === 0) {
    el.innerHTML += '<div class="empty-state">'
      + '<div class="empty-state-icon">' + (tab==='team' ? '👥' : '✅') + '</div>'
      + '<div class="empty-state-title">No ' + tab + ' action items yet</div>'
      + '<div class="empty-state-desc">Add your first ' + (tab==='team'?'team':'personal') + ' action item above. ' + (tab==='team' ? 'Team items are shared visibility across Level Up.' : 'Personal items are just for you.') + '</div></div>';
  } else {
    el.innerHTML += '<div>' + items.map(function(item, i) {
      var date = item.ts ? new Date(item.ts).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px">'
        + '<input type="checkbox" ' + (item.done ? 'checked' : '') + ' onchange="toggleAction(' + i + ')" style="cursor:pointer;width:16px;height:16px">'
        + '<div style="flex:1">'
        + '<div style="font-size:14px;color:var(--charcoal)' + (item.done ? ';text-decoration:line-through;opacity:.5' : '') + '">' + escapeHtml(item.text) + '</div>'
        + (date ? '<div style="font-size:11px;color:var(--muted);margin-top:2px">Added ' + date + (item.author ? ' by ' + escapeHtml(item.author) : '') + '</div>' : '')
        + '</div>'
        + '<button class="back-btn" onclick="removeAction(' + i + ')" style="color:#c0392b;font-size:12px">Remove</button>'
        + '</div>';
    }).join('') + '</div>';
  }
  var inp = document.getElementById('action-input');
  if (inp) inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') addAction(); });
}

function switchActionTab(t) {
  window.aiTab = t;
  renderActions();
}
function addAction() {
  var inp = document.getElementById('action-input');
  if (!inp || !inp.value.trim()) return;
  var tab = window.aiTab || 'team';
  var items = loadActions(tab);
  var author = (luUser && luUser.name) ? (luUser.name.split(' ')[0]) : '';
  items.unshift({ text: inp.value.trim(), done: false, ts: Date.now(), author: author });
  saveActions(items, tab);
  renderActions();
}

function toggleAction(i) {
  var tab = window.aiTab || 'team';
  var items = loadActions(tab);
  if (items[i]) items[i].done = !items[i].done;
  saveActions(items, tab);
  renderActions();
}

function removeAction(i) {
  var tab = window.aiTab || 'team';
  var items = loadActions(tab);
  items.splice(i, 1);
  saveActions(items, tab);
  renderActions();
}

// ── SHAREPOINT ─────────────────────────────────────────────────────
function openSharePoint() { setView('sharepoint'); }
function openEmail()      { setView('email'); }
function openCalendar()   { setView('calendar'); }

function renderSharePoint() {
  var el = document.getElementById('sp-content');
  if (!el) return;
  if (!luUser || !luUser.authenticated) {
    el.innerHTML = signInEmptyState('📁','Connect SharePoint','Sign in with your Microsoft account to search Level Up SharePoint documents.');
    return;
  }
  el.innerHTML = '<div class="sp-search-row">'
    + '<input id="sp-search" class="sp-search-input" type="text" placeholder="Search SharePoint files (e.g. Lemartec, punch list, change order)...">'
    + '<button class="btn-primary" onclick="doSharePointSearch()">Search</button>'
    + '</div>'
    + '<div class="sp-chips">'
    + '<span class="sp-chips-label">QUICK:</span>'
    + ['Lemartec','cost recovery','punch list','change order','invoice','HVAC','closeout','schedule'].map(function(q) {
        return '<button class="sp-chip" onclick="quickSharePoint(' + jsCallArg(q) + ')">' + escapeHtml(q) + '</button>';
      }).join('')
    + '</div>'
    + '<div id="sp-results"><div style="color:var(--muted);padding:20px 0">Type a search above or pick a quick search to find files.</div></div>';
  setTimeout(function() {
    var inp = document.getElementById('sp-search');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') doSharePointSearch(); });
    }
  }, 100);
}

function quickSharePoint(q) {
  var inp = document.getElementById('sp-search');
  if (inp) inp.value = q;
  doSharePointSearch();
}

function doSharePointSearch() {
  var inp = document.getElementById('sp-search');
  var results = document.getElementById('sp-results');
  if (!inp || !results) return;
  var query = inp.value.trim();
  if (!query) return;
  results.innerHTML = '<div style="color:var(--muted);padding:20px 0">Searching for "' + escapeHtml(query) + '"...</div>';
  fetch('/api/sharepoint/search?query=' + encodeURIComponent(query) + '&limit=20', { credentials: 'include' })
    .then(function(r) {
      if (!r.ok) {
        if (r.status === 401) {
          document.cookie = 'lu_session=; Path=/; Max-Age=0';
          luUser = null; updateAuthUI();
          results.innerHTML = '<div style="padding:24px;background:var(--card);border:1px solid var(--border);border-radius:8px">Session expired. <button class="signin-btn" onclick="signInWithMicrosoft()" style="margin-top:8px">Sign in again</button></div>';
        } else {
          results.innerHTML = '<div style="padding:24px;color:#c0392b">Search error (' + r.status + '). Please try again.</div>';
        }
        throw new Error('search failed');
      }
      return r.json();
    })
    .then(function(data) {
      var hits = (data.value && data.value[0] && data.value[0].hitsContainers && data.value[0].hitsContainers[0] && data.value[0].hitsContainers[0].hits) || [];
      if (!hits.length) {
        results.innerHTML = '<div style="padding:24px;color:var(--muted)">No files found for "' + escapeHtml(query) + '".</div>';
        return;
      }
      var icons = { pdf:'📄', docx:'📝', doc:'📝', xlsx:'📊', xls:'📊', pptx:'📽', ppt:'📽', msg:'📧' };
      var html = '<div style="font-size:13px;color:var(--muted);margin-bottom:12px">' + hits.length + ' result' + (hits.length===1?'':'s') + '</div>';
      hits.forEach(function(h) {
        var r = h.resource;
        var ext = (r.name || '').split('.').pop().toLowerCase();
        var icon = icons[ext] || '📄';
        var modified = r.lastModifiedDateTime ? new Date(r.lastModifiedDateTime).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
        var author = (r.lastModifiedBy && r.lastModifiedBy.user && r.lastModifiedBy.user.displayName) || '';
        var snippet = (h.summary || '').replace(/<[^>]+>/g, '').slice(0, 200);
        html += '<a class="file-result" href="' + escapeHtml(r.webUrl) + '" target="_blank">'
          + '<div style="display:flex;gap:12px;align-items:flex-start">'
          + '<span style="font-size:24px;flex-shrink:0">' + icon + '</span>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-weight:600;font-size:14px;color:var(--charcoal);margin-bottom:4px">' + escapeHtml(r.name) + '</div>'
          + (snippet ? '<div style="font-size:12px;color:var(--muted);margin-bottom:6px;line-height:1.4">' + escapeHtml(snippet) + '</div>' : '')
          + '<div style="font-size:11px;color:var(--muted)">' + modified + (author ? ' · ' + escapeHtml(author) : '') + '</div>'
          + '</div></div></a>';
      });
      results.innerHTML = html;
    })
    .catch(function(){});
}

function signInEmptyState(icon, title, desc) {
  return '<div class="empty-state">'
    + '<div class="empty-state-icon">' + icon + '</div>'
    + '<div class="empty-state-title">' + escapeHtml(title) + '</div>'
    + '<div class="empty-state-desc">' + escapeHtml(desc) + '</div>'
    + '<button class="signin-btn" onclick="signInWithMicrosoft()">'
    + '<svg width="16" height="16" viewBox="0 0 21 21"><rect width="10" height="10" fill="#F25022"/><rect x="11" width="10" height="10" fill="#7FBA00"/><rect y="11" width="10" height="10" fill="#00A4EF"/><rect x="11" y="11" width="10" height="10" fill="#FFB900"/></svg>'
    + 'Sign in with Microsoft</button></div>';
}

// ── EMAIL ──────────────────────────────────────────────────────────
function renderEmail() {
  var el = document.getElementById('email-content');
  if (!el) return;
  if (!luUser || !luUser.authenticated) {
    el.innerHTML = signInEmptyState('📧','Connect Outlook','Sign in with your Microsoft account to view recent emails.');
    return;
  }
  el.innerHTML = '<div id="email-list"><div style="color:var(--muted);padding:20px 0">Loading...</div></div>';
  fetch('/api/outlook/email?limit=25', { credentials: 'include' })
    .then(function(r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
    .then(function(data) {
      var list = document.getElementById('email-list');
      var emails = data.value || [];
      if (!emails.length) {
        list.innerHTML = '<div style="padding:24px;color:var(--muted)">No emails found.</div>';
        return;
      }
      list._emails = emails;
      list.innerHTML = emails.map(function(e, i) {
        var from = (e.from && e.from.emailAddress) ? (e.from.emailAddress.name || e.from.emailAddress.address) : 'Unknown';
        var date = new Date(e.receivedDateTime).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        return '<div class="email-row" onclick="openEmailIdx(' + i + ')">'
          + '<div class="email-row-head">'
          + '<span class="email-subject' + (e.isRead ? '' : ' unread') + '">' + escapeHtml(e.subject || '(no subject)') + '</span>'
          + '<span class="email-date">' + date + '</span>'
          + '</div>'
          + '<div class="email-from">' + escapeHtml(from) + '</div>'
          + '<div class="email-preview">' + escapeHtml((e.bodyPreview || '').slice(0, 140)) + '</div>'
          + '</div>';
      }).join('');
    })
    .catch(function(err) {
      var msg = err.message || '';
      if (msg.indexOf('401') >= 0) {
        // Try silent refresh before giving up
        tryRefresh().then(function(ok) {
          if (ok) { renderEmail(); }
          else {
            document.cookie = 'lu_session=; Path=/; Max-Age=0';
            luUser = null; updateAuthUI();
            document.getElementById('email-content').innerHTML = signInEmptyState('📧','Sign in to view email','Connect your Microsoft account to see your Outlook inbox.');
          }
        });
      } else {
        document.getElementById('email-list').innerHTML = '<div style="padding:24px;color:#c0392b">Error loading emails: ' + escapeHtml(msg) + '</div>';
      }
    });
}

function openEmailIdx(i) {
  var list = document.getElementById('email-list');
  if (list && list._emails && list._emails[i] && list._emails[i].webLink) {
    window.open(list._emails[i].webLink, '_blank');
  }
}

// ── CALENDAR ───────────────────────────────────────────────────────
function renderCalendar() {
  var el = document.getElementById('calendar-content');
  if (!el) return;
  if (!luUser || !luUser.authenticated) {
    el.innerHTML = signInEmptyState('📅','Connect Outlook Calendar','Sign in with your Microsoft account to view upcoming meetings.');
    return;
  }
  el.innerHTML = '<div id="cal-list"><div style="color:var(--muted);padding:20px 0">Loading...</div></div>';
  fetch('/api/outlook/calendar?days=14', { credentials: 'include' })
    .then(function(r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
    .then(function(data) {
      var list = document.getElementById('cal-list');
      var events = data.value || [];
      if (!events.length) {
        list.innerHTML = '<div style="padding:24px;color:var(--muted)">No upcoming events in the next 14 days.</div>';
        return;
      }
      var byDate = {};
      events.forEach(function(ev) {
        var start = new Date(ev.start.dateTime || ev.start.date);
        var key = start.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(ev);
      });
      var todayStr = new Date().toDateString();
      list.innerHTML = Object.entries(byDate).map(function(entry) {
        var dateLabel = entry[0], dayEvs = entry[1];
        var isToday = new Date(dayEvs[0].start.dateTime || dayEvs[0].start.date).toDateString() === todayStr;
        var header = '<div class="cal-date-header' + (isToday ? ' today' : '') + '">' + (isToday ? 'TODAY — ' : '') + escapeHtml(dateLabel) + '</div>';
        var rows = dayEvs.map(function(ev) {
          var s = new Date(ev.start.dateTime || ev.start.date);
          var e2 = new Date(ev.end.dateTime || ev.end.date);
          var allDay = !ev.start.dateTime;
          var time = allDay ? 'All day' : s.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) + ' – ' + e2.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
          var loc = ev.location && ev.location.displayName ? ev.location.displayName : '';
          return '<div class="cal-event' + (isToday ? ' today' : '') + '">'
            + '<div class="cal-event-time">' + escapeHtml(time) + '</div>'
            + '<div style="flex:1">'
            + '<div class="cal-event-title">' + escapeHtml(ev.subject || '(no title)') + '</div>'
            + (loc ? '<div class="cal-event-loc">📍 ' + escapeHtml(loc) + '</div>' : '')
            + '</div></div>';
        }).join('');
        return header + rows;
      }).join('');
    })
    .catch(function(err) {
      var msg = err.message || '';
      if (msg.indexOf('401') >= 0) {
        // Token expired - clear lu_session and prompt re-signin
        document.cookie = 'lu_session=; Path=/; Max-Age=0';
        luUser = null; updateAuthUI();
        document.getElementById('calendar-content').innerHTML = signInEmptyState('📅','Session expired','Your Microsoft sign-in expired. Sign in again to view your calendar.');
      } else {
        document.getElementById('cal-list').innerHTML = '<div style="padding:24px;color:#c0392b">Error loading calendar: ' + escapeHtml(msg) + '</div>';
      }
    });
}

// ── PHASE GUIDE MODAL ──────────────────────────────────────────────
function openPhaseGuide() {
  var body = document.getElementById('pg-body');
  if (!body) return;
  if (typeof PHASE_GUIDE === 'undefined') {
    body.innerHTML = '<div style="padding:20px;color:var(--muted)">Phase Guide data not loaded.</div>';
    document.getElementById('modal-phase-guide').classList.add('open');
    return;
  }
  var html = '';
  var phases = Object.keys(PHASE_GUIDE);
  phases.forEach(function(phase, idx) {
    var pid = 'pg-phase-' + idx;
    var data = PHASE_GUIDE[phase];
    html += '<div class="pg-phase">'
      + '<div class="pg-phase-header" onclick="togglePgPhase(' + jsCallArg(pid) + ')">'
      + '<span class="pg-phase-chevron" id="' + pid + '-chev">▶</span>'
      + '<span>' + (data.icon || '📖') + ' ' + escapeHtml(phase) + '</span>'
      + '</div>'
      + '<div class="pg-phase-body" id="' + pid + '" style="display:none">';
    if (data.desc) {
      html += '<p style="margin-bottom:12px;font-size:14px">' + escapeHtml(data.desc) + '</p>';
    }
    if (data.sections && data.sections.length) {
      html += '<h4>Key sections for this phase</h4><ul>';
      data.sections.forEach(function(s) {
        html += '<li><strong>Section ' + s.num + '</strong> &mdash; ' + escapeHtml(s.why) + '</li>';
      });
      html += '</ul>';
    }
    html += '</div></div>';
  });
  body.innerHTML = html;
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
  if (typeof PHASE_GUIDE === 'undefined') {
    body.innerHTML = '<div style="padding:20px;color:var(--muted)">Phase Guide data not loaded.</div>';
    return;
  }
  var html = '';
  var phases = Object.keys(PHASE_GUIDE);
  phases.forEach(function(phase, idx) {
    var pid = 'pgi-phase-' + idx;
    var data = PHASE_GUIDE[phase];
    html += '<div class="pg-phase">'
      + '<button class="pg-phase-header" onclick="togglePgPhaseInline(' + jsCallArg(pid) + ')">'
      + '<span class="pg-phase-chevron" id="' + pid + '-chev">▶</span>'
      + '<span>' + (data.icon || '📖') + ' ' + escapeHtml(phase) + '</span>'
      + '</button>'
      + '<div class="pg-phase-body" id="' + pid + '" style="display:none">';
    (data.items || []).forEach(function(item) {
      html += '<div class="pg-item">' + escapeHtml(item) + '</div>';
    });
    html += '</div></div>';
  });
  body.innerHTML = html;
}
function togglePgPhaseInline(pid) {
  var body = document.getElementById(pid);
  var chev = document.getElementById(pid + '-chev');
  if (!body) return;
  var isHidden = body.style.display === 'none' || !body.style.display;
  body.style.display = isHidden ? 'block' : 'none';
  if (chev) chev.textContent = isHidden ? '▼' : '▶';
}

// ── MODALS ─────────────────────────────────────────────────────────
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function showModal(id, html) {
  var el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'modal-overlay';
    el.onclick = function(e) { if (e.target === el) el.classList.remove('open'); };
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  setTimeout(function() { el.classList.add('open'); }, 10);
  }

// ── CHAT ───────────────────────────────────────────────────────────
function toggleChat() {
  chatOpen = !chatOpen;
  var d = document.getElementById('chat-drawer');
  if (d) d.classList.toggle('open', chatOpen);
  if (chatOpen) {
    if (chatHistory.length === 0) {
      appendMsg('ai', "Hi Whitney. I'm L.U.N.A. — your Executive Operating Partner. Ask me anything about the playbook or MFP — Day 1 mobilization, change orders, punch list disputes, cost recovery audit, anything.");
    }
    setTimeout(function() {
      var ci = document.getElementById('chat-input');
      if (ci) ci.focus();
    }, 100);
  }
}
var chatExpanded = false;
function toggleChatSize() {
  chatExpanded = !chatExpanded;
  var d = document.getElementById('chat-drawer');
  if (!d) return;
  if (chatExpanded) {
    d.style.width = '90vw';
    d.style.maxHeight = '90vh';
    d.style.right = '5vw';
    d.style.bottom = '5vh';
  } else {
    d.style.width = '400px';
    d.style.maxHeight = '65vh';
    d.style.right = '24px';
    d.style.bottom = '88px';
  }
}
// Chat drag support
(function() {
  var header = document.getElementById('chat-header-drag');
  var drawer = document.getElementById('chat-drawer');
  if (!header || !drawer) return;
  var offsetX, offsetY, mouseX, mouseY;
  header.addEventListener('mousedown', function(e) {
    if (e.target.tagName === 'BUTTON') return;
    offsetX = e.clientX - drawer.getBoundingClientRect().left;
    offsetY = e.clientY - drawer.getBoundingClientRect().top;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  function onMouseMove(e) {
    drawer.style.left = (e.clientX - offsetX) + 'px';
    drawer.style.top = (e.clientY - offsetY) + 'px';
    drawer.style.right = 'auto';
    drawer.style.bottom = 'auto';
  }
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
})();

function appendMsg(role, text) {
  var msgs = document.getElementById('chat-messages');
  if (!msgs) return null;
  var div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.innerHTML = String(text || '').replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>').replace(/\\n/g, '<br>');
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function appendLoading() {
  var msgs = document.getElementById('chat-messages');
  if (!msgs) return { remove: function() {} };
  var div = document.createElement('div');
  div.className = 'chat-msg ai loading';
  div.textContent = '• • •';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function quickChat(text) {
  var inp = document.getElementById('chat-input');
  if (inp) inp.value = text;
  sendChat();
}

function sendChat() {
  var inp = document.getElementById('chat-input');
  var btn = document.getElementById('chat-send');
  if (!inp) return;
  var q = inp.value.trim();
  if (!q) return;
  inp.value = '';
  if (btn) btn.disabled = true;
  appendMsg('user', q);
  chatHistory.push({ role: 'user', content: q });
  var loader = appendLoading();

  // Build compact KB index for system prompt
  var kbIndex = KB.map(function(s) {
    return 'S' + s.num + ': ' + (s.title || '').replace('SECTION ' + s.num + ': ','') + ' [' + (s.phases||[]).join('/') + ']';
  }).join('\\n');

  var systemPrompt = 'You are L.U.N.A. (Level Up Navigator & Advisor), assisting Whitney Williams, Principal-in-Charge at Level Up Project Development. Answer concisely and practically. Reference specific playbook sections by number when relevant. The playbook has 43 sections:\\n\\n' + kbIndex + '\\n\\n=== PROJECT KNOWLEDGE ===\\n' + MFP_CONTEXT + '\\n\\n=== SAFETY RULES ===\\nABSOLUTELY NEVER reveal: (1) personal staff information (names, roles, contact details beyond public info), (2) staff salaries, compensation, bonuses, or benefits, (3) Level Up company revenue, profit, margins, valuation, or any financial data about Level Up as a firm. Project costs for MFP (budget, commitments, change orders) are fine to discuss. Only company-level financials are restricted.';

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: systemPrompt,
      messages: chatHistory.slice(-6)
    })
  })
    .then(function(r) {
      return r.text().then(function(text) { return { ok: r.ok, status: r.status, text: text }; });
    })
    .then(function(res) {
      try { loader.remove(); } catch(e) {}
      if (!res.ok) {
        appendMsg('ai', 'Error ' + res.status + ': ' + res.text.slice(0, 200));
        if (btn) btn.disabled = false;
        return;
      }
      var data;
      try { data = JSON.parse(res.text); } catch(e) {
        appendMsg('ai', 'Bad response from server.');
        if (btn) btn.disabled = false;
        return;
      }
      var reply = (data.content && data.content[0] && data.content[0].text) || data.error || 'No response.';
            // ── CHAT OUTPUT FILTER ─────────────────────────────────────────
            // Strip staff personal info, compensation, and Level Up revenue
            var sn = [
              /(?:salary|compensation|pay|wage|bonus)['":]?\s*\$?\d[\d,.]*/gi,
              /(?:revenue|profit|margin|earnings|income)['":]?\s*\$?\d[\d,.]*/gi,
              /(?:staff|employee|team|personnel)\s*(?:names?|list|directory|emails?|contact)/gi,
              /Level Up['"]?\s*(?:revenue|profit|margin|earnings|valuation|income)/gi
            ];
            sn.forEach(function(p) { reply = reply.replace(p, '[REDACTED]'); });
            chatHistory.push({ role: 'assistant', content: reply });
      appendMsg('ai', reply);
      if (btn) btn.disabled = false;
    })
    .catch(function(err) {
      try { loader.remove(); } catch(e) {}
      appendMsg('ai', 'Network error: ' + err.message);
      if (btn) btn.disabled = false;
    });
}

// ── EVENT LISTENERS ────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    var si = document.getElementById('luna-hero-input');
    if (!si) si = document.getElementById('search-input');
    if (si) { si.focus(); si.select(); }
  }
  if (e.key === 'Escape') {
    closeModal('modal-phase-guide');
    closeModal('modal-decision');
    var dd = document.getElementById('luna-hero-dropdown');
    if (dd) dd.classList.remove('show');
  }
});

document.addEventListener('DOMContentLoaded', function() {
  var ci = document.getElementById('chat-input');
  if (ci) {
    ci.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
  }
});

// ── INIT ───────────────────────────────────────────────────────────
function init() {
  // Set initial footer status
  var footer = document.getElementById('footer-status-text');
  if (footer) footer.textContent = 'JS OK · Initializing...';

  // Theme
  try {
    var savedTheme = localStorage.getItem('lu_theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  } catch(e) {}

  // Auth
  checkAuthFromCookie();
  updateAuthUI();

  // Update footer status
  if (footer) {
    var status = luUser && luUser.authenticated ? 'Signed in: ' + luUser.email : 'Not signed in';
    footer.textContent = 'JS OK · ' + status + ' · KB=' + KB.length;
  }

  // Render stats on home page
      renderStats();
      // Update data sync timestamp
      var freqEl = document.querySelector('.luna-status-freq');
      if (freqEl) {
        freqEl.textContent = 'Data: static as of Jun 8';
      }
    var urlParams = new URLSearchParams(window.location.search);
    var authSuccess = urlParams.get('auth') === 'success';
    var returnView = 'luna';
    if (authSuccess) {
      history.replaceState({}, '', '/');
      try {
        returnView = localStorage.getItem('lu_return_view') || 'luna';
        localStorage.removeItem('lu_return_view');
      } catch(e) {}
    }

    setView(returnView);
    }

  // ── L.U.N.A. HERO (default home view) ───────────────────────────────
    function renderHero() {
      var results = document.getElementById('luna-hero-results');
      if (results && Object.keys(heroResults).length > 0) {
        var html = '';
        for (var key in heroResults) {
          var entry = heroResults[key];
          html += '<div class=\"luna-result-q\"><span class=\"luna-result-q-icon\">Q:</span>' + escapeHtml(entry.q) + '</div>';
          html += '<div class=\"luna-result-a\">' + escapeHtml(entry.a) + '</div>';
        }
        results.innerHTML = html;
      }
      setTimeout(function() {
        var inp = document.getElementById('luna-hero-input');
        if (inp) inp.focus();
      }, 200);
    }

    function heroSearch() {
      var inp = document.getElementById('luna-hero-input');
      if (!inp) return;
      var q = inp.value.trim();
      if (!q) return;
      inp.value = '';
      // Clear dropdown
      var dd = document.getElementById('luna-hero-dropdown');
      if (dd) { dd.classList.remove('show'); dd.innerHTML = ''; }
      // Also remove from server-side search result
      heroDoAsk(q);
    }

    function heroSearchType(val) {
      var dd = document.getElementById('luna-hero-dropdown');
      if (!dd) return;
      var q = val.trim();
      if (!q) { dd.classList.remove('show'); dd.innerHTML = ''; return; }
      var ql = q.toLowerCase();
      var results = [];

      // Search KB
            KB.forEach(function(s) {
              var hay = [s.title, s.num].concat(s.topics || []).concat(s.h2 || []).concat(s.content || []).concat(s.bullets || []).join(' ').toLowerCase();
              if (hay.indexOf(ql) >= 0) {
                // Build a smarter excerpt: find the matching content chunk
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
                results.push({type:'playbook', label:'Section ' + s.num + ': ' + (s.title || ''), id:s.num, preview:preview});
              }
            });

      // Search templates
      for (var key in TEMPLATES) {
        var t = TEMPLATES[key];
        if ((t.name && t.name.toLowerCase().indexOf(ql) >= 0) || (t.desc && t.desc.toLowerCase().indexOf(ql) >= 0)) {
          results.push({type:'template', label:'Template: ' + (t.name||key), id:key, preview:(t.desc||'').substring(0,120)});
        }
      }

      // Search project context
      var projectKW = ['mfp','freedom park','stadium','lemartec','arq','punch','budget','change order','closeout','miller'];
      if (projectKW.some(function(kw){return kw.indexOf(ql)>=0||ql.indexOf(kw)>=0;})) {
        results.push({type:'project', label:'Project: Miami Freedom Park Stadium', id:'mfp', preview:'Post-opening closeout. Active workstreams: punch list closeout, cost recovery audit, Lemartec contract closeout.'});
      }

      if (results.length === 0) { dd.classList.remove('show'); dd.innerHTML = ''; return; }

      // Highlight function
      function hl(text) {
        if (!text) return '';
        var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
        return text.replace(re, '<mark>$1</mark>');
      }

      var icons = {playbook:'📚', template:'📑', project:'🏟'};
      var html = '<div class=\"luna-hero-dropdown-inner\">';
      html += '<div style=\"padding:6px 14px 8px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)\">' + results.length + ' result' + (results.length>1?'s':'') + ' for &quot;' + escapeHtml(q) + '&quot;</div>';
      results.slice(0, 20).forEach(function(r) {
              var icon = icons[r.type]||'📄';
              var onClick = "var dd=document.getElementById('luna-hero-dropdown');if(dd){dd.classList.remove('show');dd.innerHTML=''}document.getElementById('luna-hero-input').value='';";
              if (r.type === 'playbook') onClick += "setView('playbook');setPlaybookView('sections');jumpTo('" + r.id + "');";
              else if (r.type === 'template') onClick += "setView('playbook');setPlaybookView('templates');";
              else if (r.type === 'project') onClick += "setView('mfp');";
              html += '<div class="luna-hero-dd-item" onclick="' + onClick + '">'
                + '<span class="luna-hero-dd-icon">' + icon + '</span>'
                + '<div style="flex:1;min-width:0">'
                + '<div class="luna-hero-dd-text">' + hl(r.label) + '</div>'
                + (r.preview ? '<div class="luna-hero-dd-desc">' + hl(r.preview.substring(0, 160)) + '</div>' : '')
                + '</div><span class="luna-hero-dd-src">' + r.type + '</span></div>';
      });
      html += '</div>';
      dd.innerHTML = html;
      dd.classList.add('show');

      // Click outside to close
      var closeHandler = function(e) {
        if (!dd.contains(e.target) && e.target.id !== 'luna-hero-input') {
          dd.classList.remove('show');
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(function() { document.addEventListener('click', closeHandler); }, 10);
    }

    function heroQuick(q) {
      var inp = document.getElementById('luna-hero-input');
      if (inp) inp.value = q;
      heroSearch();
    }

    function heroDoAsk(q) {
      var btn = document.querySelector('.luna-hero-btn');
      var results = document.getElementById('luna-hero-results');
      if (!results) return;

      if (btn) btn.disabled = true;
      document.querySelectorAll('.luna-hero-quick').forEach(function(b) { b.disabled = true; });

      // Show loading
      results.innerHTML = '<div class=\"luna-result-q\"><span class=\"luna-result-q-icon\">Q:</span>' + escapeHtml(q) + '</div>'
        + '<div class=\"luna-result-a loading\">Thinking...</div>';
      results.scrollIntoView({ behavior: 'smooth', block: 'end' });

      // Check cache (1-hour)
      var cacheKey = 'luna_' + q.toLowerCase().trim().replace(/[^a-z0-9]/g,'_').slice(0,80);
      try {
        var cached = JSON.parse(localStorage.getItem(cacheKey));
        if (cached && cached.ts > Date.now() - 3600000) {
          results.innerHTML = '<div class=\"luna-result-q\"><span class=\"luna-result-q-icon\">Q:</span>' + escapeHtml(q) + '</div>'
            + '<div class=\"luna-result-a\">' + cached.answer + '</div>';
          heroResults[q] = { q: q, a: cached.answer };
          if (btn) btn.disabled = false;
          document.querySelectorAll('.luna-hero-quick').forEach(function(b) { b.disabled = false; });
          return;
        }
      } catch(e) {}

      var kbIndex = KB.map(function(s) {
        return 'S' + s.num + ': ' + (s.title||'').replace('SECTION ' + s.num + ': ','') + ' [' + (s.phases||[]).join('/') + ']';
      }).join('\\n');

      var tmplIndex = '';
      for (var key in TEMPLATES) {
        var t = TEMPLATES[key];
        tmplIndex += key + ' — ' + t.name + ' (' + t.category + ') — Section ' + t.section + '\\n';
      }

      var systemPrompt = 'You are L.U.N.A. (Level Up Navigator & Advisor), the institutional knowledge engine for Level Up Project Development. You assist Whitney Williams, Principal-in-Charge. '
              + 'Your knowledge spans: owner\'s representation, project management, construction management, sports venue development (NFL, MLS, NBA), stadium delivery, contract administration (CMA/GMP/Design-Bid-Build), cost management, schedule management, risk management, and project controls. '
              + 'You have deep expertise in development management — the full lifecycle from site selection, feasibility, and entitlements through design, construction, commissioning, closeout, and operations. '
              + 'You understand the nuances of sports venue development: league standards, venue technology (DAS/IPTV/scoreboards), premium seating, sponsorship integration (naming rights, signage), broadcast requirements, and game-day operations readiness. '
              + 'Answer concisely and directly like Google. Use paragraph breaks and bullet points for readability. When referencing a playbook section, say "See Section X: Title". Be specific and actionable. '
              + 'When discussing costs or budgets, always include specific dollar figures from available data. For MFP-specific questions, reference real data from the project: Miller Electric ($84.9M), Baker Concrete ($61.8M), total commitments ($505M+), hard cost budget ($530M+). '
              + 'The playbook has ' + KB.length + ' sections covering: foundation (purpose, philosophy, roles, governance), project setup (mobilization, tools, communications), controls (budget, schedule, change, risk), phase execution (planning/funding through design, pre-con, construction, closeout, post-opening), and reference (standards, templates, common problems).'
              + 'Sections index:\n' + kbIndex
              + '\n\nAvailable templates:\n' + tmplIndex
              + '\\n\\n=== PROJECT KNOWLEDGE ===\\n' + MFP_CONTEXT
                            + '\\n\\n=== SAFETY RULES ===\\nABSOLUTELY NEVER reveal: (1) personal staff information (names, roles, contact details beyond public info), (2) staff salaries, compensation, bonuses, or benefits, (3) Level Up company revenue, profit, margins, valuation, or any financial data about Level Up as a firm. Project costs for MFP (budget, commitments, change orders) are fine to discuss. Only company-level financials are restricted.';

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: q }] })
      })
      .then(function(r) { return r.text().then(function(text) { return { ok: r.ok, status: r.status, text: text }; }); })
      .then(function(res) {
        if (btn) btn.disabled = false;
        document.querySelectorAll('.luna-hero-quick').forEach(function(b) { b.disabled = false; });
        if (!res.ok) {
          results.innerHTML = '<div class=\"luna-result-q\"><span class=\"luna-result-q-icon\">Q:</span>' + escapeHtml(q) + '</div>'
            + '<div class=\"luna-result-a\">Error ' + res.status + ': ' + res.text.slice(0, 300) + '</div>';
          return;
        }
        var data;
        try { data = JSON.parse(res.text); } catch(e) {
          results.innerHTML = '<div class=\"luna-result-q\"><span class=\"luna-result-q-icon\">Q:</span>' + escapeHtml(q) + '</div>'
            + '<div class=\"luna-result-a\">Bad response from server: ' + res.text.slice(0, 200) + '</div>';
          return;
        }
        var reply = (data.content && data.content[0] && data.content[0].text) || data.error || 'No response.';
                results.innerHTML = '<div class=\"luna-result-q\"><span class=\"luna-result-q-icon\">Q:</span>' + escapeHtml(q) + '</div>'
                  + '<div class=\"luna-result-a\">' + reply + '</div>';
                // Apply chat filter to hero search results too
                var sn = [
                  /(?:salary|compensation|pay|wage|bonus)['":]?\s*\$?\d[\d,.]*/gi,
                  /(?:revenue|profit|margin|earnings|income)['":]?\s*\$?\d[\d,.]*/gi,
                  /Level Up['"]?\s*(?:revenue|profit|margin|earnings|valuation|income)/gi
                ];
                sn.forEach(function(p) { reply = reply.replace(p, '[REDACTED]'); });
                heroResults[q] = { q: q, a: reply };
        try { localStorage.setItem(cacheKey, JSON.stringify({ answer: reply, ts: Date.now() })); } catch(e){}
      })
      .catch(function(err) {
        if (btn) btn.disabled = false;
        document.querySelectorAll('.luna-hero-quick').forEach(function(b) { b.disabled = false; });
        results.innerHTML = '<div class=\"luna-result-q\"><span class=\"luna-result-q-icon\">Q:</span>' + escapeHtml(q) + '</div>'
          + '<div class=\"luna-result-a\">Network error: ' + (err.message || err) + '</div>';
      });
    }


// ── PASSWORD GATE ───────────────────────────────────────────────────
// Immediate visual feedback handler — fires before verifyPassword
function handlePasswordClick() {
  var btn = document.getElementById('password-btn');
  if (btn) { btn.style.transform = 'scale(0.96)'; btn.style.opacity = '0.8'; }
  setTimeout(function() {
    if (btn) { btn.style.transform = ''; btn.style.opacity = ''; }
    verifyPassword();
  }, 100);
}

function verifyPassword() {
  var inp = document.getElementById('password-input');
  var btn = document.getElementById('password-btn');
  var err = document.getElementById('password-error');
  if (!inp || !btn) return;
  var pw = inp.value.trim();
  if (!pw) { err.textContent = 'Please enter a password.'; err.style.display = 'block'; return; }
  btn.disabled = true;
  btn.textContent = 'Checking...';
  err.style.display = 'none';
  fetch('/api/verify-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  }).then(function(r) {
    if (!r.ok) {
      if (r.status === 401) throw new Error('Incorrect password');
      throw new Error('Server error (' + r.status + ')');
    }
    return r.json();
  }).then(function(data) {
    if (data.valid) {
      document.getElementById('password-overlay').classList.remove('open');
      document.getElementById('password-overlay').style.display = 'none';
    }
  }).catch(function(e) {
    err.textContent = e.message;
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Unlock';
    inp.value = '';
    inp.focus();
  });
}

// Check auth on page load — hide password overlay if cookie exists
(function checkSiteAuth() {
  fetch('/api/check-auth').then(function(r) { return r.json(); }).then(function(data) {
    var overlay = document.getElementById('password-overlay');
    if (!overlay) return;
    if (data.authed) {
      overlay.classList.remove('open');
      overlay.style.display = 'none';
    } else {
      // Not authed — focus the password input for immediate typing
      var inp = document.getElementById('password-input');
      if (inp) setTimeout(function() { inp.focus(); }, 300);
    }
  }).catch(function() {
    // Overlay stays visible by default — focus password input
    var inp = document.getElementById('password-input');
    if (inp) setTimeout(function() { inp.focus(); }, 300);
  });
})();

// ── BOOT ──────────────────────────────────────────────────────────
init();
