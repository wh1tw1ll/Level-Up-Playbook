// ── LEVEL UP PLAYBOOK ─ APP.JS ──────────────────────────────────────
// Clean rewrite. All state, data, and behavior in this file. v20260609-2

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

// Status helper — backward-compatible: done:true = 'completed'
function getItemStatus(item) {
  if (item.status === 'in_progress') return 'in_progress';
  if (item.status === 'completed' || item.done === true) return 'completed';
  return 'open';
}
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
var KB = window.__KB || [];  // Preloaded from data/kb.js
var TEMPLATES = window.__TEMPLATES || {};
var GLOSSARY = window.__GLOSSARY || {};
var ALL_TOPICS = [];

// Synchronous KB init — runs immediately since data is preloaded
var kbLoaded = false;
function initKB() {
  if (kbLoaded || !KB.length) return;
  var set = {};
  KB.forEach(function(s) { (s.topics || []).forEach(function(t) { set[t] = true; }); });
  ALL_TOPICS = Object.keys(set).sort();
  kbLoaded = true;
  // If playbook view is active, re-render
  if (currentView === 'playbook') renderPlaybook();
  // Update footer with KB count
  var footerEl = document.getElementById('footer-status-text');
  if (footerEl) {
    var status = luUser && luUser.authenticated ? 'Signed in: ' + luUser.email : 'Not signed in';
    footerEl.textContent = 'JS OK · ' + status + ' · KB=' + KB.length;
  }
}
// Run immediately
initKB();

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

function fmtNum(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
        initDailyBriefing();
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
    var calMeta = document.getElementById('cal-card-meta');
    var spMeta = document.getElementById('sp-card-meta');

    if (luUser && luUser.authenticated) {
      if (signInBtn) signInBtn.style.display = 'none';
      if (userInfo) userInfo.style.display = 'flex';
      if (userName) userName.textContent = luUser.name || luUser.email;

      // Show immediate connected status, then try to fetch live previews
      if (calMeta) calMeta.textContent = '✓ Connected';
      if (spMeta) spMeta.textContent = '✓ Connected';

      // Fetch live calendar preview
      if (calMeta && !calMeta._fetching) {
        calMeta._fetching = true;
        calMeta.textContent = 'Loading...';
        fetch('/api/outlook/calendar?days=14', { credentials: 'include' })
          .then(function(r) { if (!r.ok) throw new Error('' + r.status); return r.json(); })
          .then(function(data) {
            var evs = data.value || [];
            var upcoming = evs.filter(function(e) {
              var s = new Date(e.start.dateTime || e.start.date);
              return s > new Date();
            });
            if (upcoming.length === 0) { calMeta.textContent = 'No upcoming events'; return; }
            var next = new Date(upcoming[0].start.dateTime || upcoming[0].start.date);
            var timeStr = next.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            var countStr = upcoming.length > 1 ? ' +' + (upcoming.length - 1) + ' more' : '';
            calMeta.textContent = 'Next: ' + timeStr + countStr;
          })
          .catch(function() { calMeta.textContent = '✓ Calendar'; })
          .then(function() { calMeta._fetching = false; });
      }
    } else {
      if (signInBtn) signInBtn.style.display = 'flex';
      if (userInfo) userInfo.style.display = 'none';
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
  document.documentElement.setAttribute('data-btn-theme', t === 'dark' ? '☽' : '☀');
  var btn = document.getElementById('theme-btn');
  if (btn) { btn.textContent = t === 'dark' ? '☽' : '☀'; btn.style.opacity = '1'; }
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
        else if (view === 'calendar') renderCalendar();
    else if (view === 'mfp') renderMFP();
    else if (target) {
      // Unknown view with existing div — show it empty (legacy routes)
    } else {
      // View doesn't exist at all — redirect to luna
      currentView = 'luna';
      target = document.getElementById('view-luna');
      if (target) target.classList.add('active');
      renderHero();
    }
    } catch(err) {
        console.error('setView error:', err);
      }
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
    var millerOut = H && H.commitments ? fm((H.commitments.find(function(c){return c.company && c.company.indexOf('MILLER')>=0;}) || {}).balance) : '';
    el.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px">'
      + '<div style="font-size:13px;color:var(--muted);margin-bottom:4px">CURRENT PHASE <span style="color:#c0392b;font-weight:700">| ' + daysPast + '</span></div>'
      + '<div style="font-size:18px;font-weight:700;color:var(--charcoal);margin-bottom:8px">Post-Opening / Active Closeout</div>'
      + '<div style="font-size:14px;color:var(--charcoal);line-height:1.6">Home opener April 4, 2026 completed. Targeting final completion ' + (S ? S.target_completion : 'July 31, 2026') + '. Active workstreams: punch list closeout, cost recovery audit (delivery June 30), Lemartec contract closeout, HVAC service agreement transfer, Day 2 owner requests log.</div>'
    + '</div>'
    + '<div class="mfp-grid">'
    + '<div class="mfp-card" onclick="openMFPModal(\'issues\')"><div class="mfp-card-head"><span class="mfp-icon">🔴</span><span class="mfp-card-title">Live Issues</span><span class="mfp-badge red">5 HIGH</span></div><div class="mfp-card-summary">ARQ payment hold (~$1.5M), cost recovery audit deadline (Jun 30), Lemartec punch list disputes, HVAC contractor departure risk, Lemartec indirect cost gap ($39.5M).</div><div class="mfp-expand-content"></div></div>'
        + '<div class="mfp-card" onclick="openMFPModal(\'financials\')"><div class="mfp-card-head"><span class="mfp-icon">\uD83D\uDCB0</span><span class="mfp-card-title">Financials</span></div><div class="mfp-card-summary">Total budget: ' + budgetVal + '. Stadium: ' + stadiumVal + ' revised, ' + pctComplete + ' complete. Miller Electric outstanding: ' + millerOut + '. Retainage: ' + retainVal + '.</div><div class="mfp-expand-content"></div></div>'
        + '<div class="mfp-card" onclick="openMFPModal(\'punchlist\')"><div class="mfp-card-head"><span class="mfp-icon">\uD83D\uDCCB</span><span class="mfp-card-title">Punch List</span><span class="mfp-badge warn">Active</span></div><div class="mfp-card-summary">Tile installation deficiency and surface-mounted electrical conduit (spec required concealed) are active disputes with Lemartec. Position: correction, not credit.</div><div class="mfp-expand-content"></div></div>'
        + '<div class="mfp-card" onclick="showMFPDetail(\'day2\')"><div class="mfp-card-head"><span class="mfp-icon">🏗</span><span class="mfp-card-title">Day 2 Items</span><span class="mfp-badge warn">60+</span></div><div class="mfp-card-summary">Owner-directed post-opening scope. 10 tracked in closeout meetings — concourse signage, team store, club finishing, broadcast platforms, plaza landscaping, security screening, parking, F&B upgrades, AV system, suite FF&E. Each requires scope definition, cost estimate, owner authorization.</div><div class="mfp-expand-content"></div></div>'
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
                                  body: '<div style="margin-bottom:16px"><strong style="font-size:15px;color:var(--charcoal)">5 High Priority Issues</strong></div>'
                                    + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
                                    + '<strong>1. ARQ Payment Hold</strong><br>~$1.5M in Feb-Apr invoices on hold. Disputed work quality and incomplete deliverables. Escalated to owner for resolution.<br>'
                                    + '<span style="font-size:11px;color:var(--muted)">Owner: Graham Oxley | Priority: High | Target: Jun 2026</span></div>'
                                    + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
                                    + '<strong>2. Cost Recovery Audit — Final Delivery</strong><br>Forensic audit of Kroll COs and Lemartec indirect costs. June 30, 2026 deadline. $21.5M potential savings identified across 13 Kroll PDFs. Key findings: Miller Electric ($84.9M), Baker Concrete ($61.8M), Right Way Plumbing ($20.2M).<br>'
                                    + '<span style="font-size:11px;color:var(--muted)">Lead: Whitney | Priority: Critical | Deadline: Jun 30, 2026</span></div>'
                                    + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
                                    + '<strong>3. Punch List: Tile Installation Deficiency</strong><br>Surface-mounted electrical conduit violates spec requiring concealed. Position: correction, not credit. Active dispute with Lemartec — not a change order, a quality/compliance issue.<br>'
                                    + '<span style="font-size:11px;color:var(--muted)">Disputed with Lemartec | Priority: High | Status: Open</span></div>'
                                    + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
                                    + '<strong>4. HVAC Service Agreement — Hill York</strong><br>Contractor departure risk. Service agreement for post-opening HVAC maintenance pending signature. Urgent — need executed agreement before Hill York demobilizes.<br>'
                                    + '<span style="font-size:11px;color:var(--muted)">Priority: Urgent | Status: Pending Signature</span></div>'
                                    + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
                                    + '<strong>5. Lemartec Indirect Costs</strong><br>$39.5M indirect cost payment gap. General requirements, general conditions, CM fee, and insurance unpaid. Cost recovery audit includes review of these line items.<br>'
                                    + '<span style="font-size:11px;color:var(--muted)">Status: Open | Part of Cost Recovery Audit</span></div>'
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

                            // BUDGET ARC — full evolution from closing to current
                                                        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;padding:12px 16px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">'
                                                          + '<div style="flex:1;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Budget at Closing</span><strong style="font-size:15px">' + fm(Su.budget_at_closing) + '</strong></div>'
                                                          + '<span style="font-size:18px;color:var(--muted)">→</span>'
                                                          + '<div style="flex:1;text-align:center;background:var(--teal-light);border-radius:8px;padding:8px"><span style="font-size:10px;color:var(--teal);display:block;font-weight:600">+ Realized Changes</span><strong style="font-size:15px;color:var(--teal)">+' + fm(Su.realized_changes) + '</strong></div>'
                                                          + '<span style="font-size:18px;color:var(--muted)">→</span>'
                                                          + '<div style="flex:1;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Current Total Budget</span><strong style="font-size:15px">' + fm(Su.total_budget) + '</strong></div>'
                                                          + '</div>'
                                                          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:16px">'
                                                          + '<div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Paid to Date</span><strong style="font-size:16px">' + fm(Su.paid_to_date) + '</strong></div>'
                                                          + '<div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Incurred to Date</span><strong style="font-size:16px">' + fm(Su.incurred_to_date) + '</strong></div>'
                                                          + '<div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Past Due</span><strong style="font-size:16px;color:#c0392b">' + fm(Su.past_due) + '</strong></div>'
                                                          + '<div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center"><span style="font-size:10px;color:var(--muted);display:block">Retainage</span><strong style="font-size:16px">' + fm(Su.retainage_held) + '</strong></div>'
                                                          + '</div>'

                            // HARD vs SOFT costs side by side
                                                        var softTotal = (S ? S.design_total : 0) + ((S && S.ffe_budget) || 0) + ((S && S.freight) || 0) + ((S && S.customs_duties) || 0) + ((S && S.contingency) || 0);
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
                              + '<strong>🎨 Design Team (' + (S.design_team ? S.design_team.length : 0) + ' firms)</strong>'
                              + '<strong style="font-size:16px;color:#4a90d9">' + fm(S.design_total) + '</strong>'
                              + '</div>'
                              + '<div style="max-height:300px;overflow-y:auto;margin-top:6px">';

                            // Sort design team by fee descending
                                                        var sortedDesign = (S.design_team || []).slice().sort(function(a,b){ return b.fee - a.fee; });
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

                            (S.ffe_breakdown || []).forEach(function(f){
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

                            var subs = (H && H.commitments) || [];
                                                        if (subs.length) subs.sort(function(a,b){ return (b.revised||0) - (a.revised||0); });
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

    // ── ACTION ITEMS ────────────────────────────────────────────────────
  var aiSort = 'created';
  var aiFilter = 'all';
  var aiEditId = null;

  function loadActions(tab) {
    tab = tab || window.aiTab || 'team';
    try { return JSON.parse(localStorage.getItem('lu_actions_' + tab) || '[]'); }
    catch(e) { return []; }
  }
  function fetchLunaChecklist() {
    var tab = window.aiTab || 'team';
    fetch('data/checklist.json?' + Date.now())
      .then(function(r) { if (!r.ok) throw new Error('No checklist'); return r.json(); })
      .then(function(data) {
        var items = data.items || [];
        if (!items.length) return;
        var local = loadActions(tab);
        var localIds = {};
        local.forEach(function(i) { if (i.id) localIds[i.id] = true; });
        var merged = local.slice();
        var added = 0;
        items.forEach(function(item) {
          if (!localIds[item.id]) {
            merged.push(item);
            localIds[item.id] = true;
            added++;
          }
        });
        saveActions(merged, tab);
        if (added) renderActions();
      })
      .catch(function() {});
  }
  function saveActions(items, tab) {
    tab = tab || window.aiTab || 'team';
    try { localStorage.setItem('lu_actions_' + tab, JSON.stringify(items)); } catch(e) {}
  }

  // Auto-fetch LUNA checklist from server on first load
  if (!window._lunaChecklistFetched) {
    window._lunaChecklistFetched = true;
    setTimeout(fetchLunaChecklist, 500);
  }
  function renderActions() {
    var el = document.getElementById('actions-content');
    if (!el) return;
    var tab = window.aiTab || 'team';
    var items = loadActions(tab);

    // Tab bar + filters row
    el.innerHTML = '<div class="ai-bar">'
      + '<div class="ai-tabs">'
      + '<button onclick="switchActionTab(\'team\')" style="' + (tab==='team'?'font-weight:700;color:var(--teal);border-bottom:2px solid var(--teal)':'color:var(--muted)') + '">Team</button>'
      + '<button onclick="switchActionTab(\'personal\')" style="' + (tab==='personal'?'font-weight:700;color:var(--teal);border-bottom:2px solid var(--teal)':'color:var(--muted)') + '">Personal</button>'
      + '</div>'
      + '<div class="ai-controls">'
      + '<select onchange="aiFilter=this.value;renderActions()" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--charcoal);font-size:12px;font-family:inherit">'
      + '<option value="all"' + (aiFilter==='all'?' selected':'') + '>All</option>'
      + '<option value="active"' + (aiFilter==='active'?' selected':'') + '>Active</option>'
      + '<option value="done"' + (aiFilter==='done'?' selected':'') + '>Done</option>'
      + '</select>'
      + '<select onchange="aiSort=this.value;renderActions()" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--charcoal);font-size:12px;font-family:inherit">'
      + '<option value="created"' + (aiSort==='created'?' selected':'') + '>Newest</option>'
      + '<option value="due"' + (aiSort==='due'?' selected':'') + '>Due date</option>'
      + '<option value="priority"' + (aiSort==='priority'?' selected':'') + '>Priority</option>'
      + '</select>'
      + '</div>'
      + '</div>'
      + '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:14px">'
      + '<button class="btn-primary" onclick="showAddActionModal()" style="width:100%;justify-content:center;padding:10px">+ New Action Item</button>'
      + '</div>';

    // Filter + sort
    var filtered = items.filter(function(item) {
      if (aiFilter === 'active') return !item.done;
      if (aiFilter === 'done') return item.done;
      return true;
    });
    var sorted = filtered.slice().sort(function(a,b) {
      if (aiSort === 'due') {
        if (!a.dueDate && !b.dueDate) return b.ts - a.ts;
        if (!a.dueDate) return 1; if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (aiSort === 'priority') {
        var rank = { urgent:0, high:1, medium:2, low:3 };
        var ar = rank[a.priority||'medium']||2, br = rank[b.priority||'medium']||2;
        if (ar !== br) return ar - br;
        return b.ts - a.ts;
      }
      return b.ts - a.ts;
    });

    if (sorted.length === 0) {
      el.innerHTML += '<div class="empty-state">'
        + '<div class="empty-state-icon">' + (tab==='team'?'👥':'✅') + '</div>'
        + '<div class="empty-state-title">No ' + (aiFilter !== 'all' ? aiFilter + ' ' : '') + tab + ' action items</div>'
        + '<div class="empty-state-desc">' + (items.length === 0 ? 'Add your first item above.' : 'No items match the current filter.') + '</div></div>';
      return;
    }

    el.innerHTML += '<div class="ai-list">' + sorted.map(function(item, i) {
      var origIdx = items.indexOf(item);
      var date = item.ts ? new Date(item.ts).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
      var dueStr = item.dueDate ? (function(d){var t=new Date(d+'T12:00:00'),n=new Date(),diff=Math.ceil((t-n)/86400000);return diff<0?diff===0?'Due today':'Overdue by '+Math.abs(diff)+'d':diff===0?'Due today':'Due in '+diff+'d'})(item.dueDate) : '';
      var dueWarn = item.dueDate && new Date(item.dueDate+'T12:00:00') < new Date();
      var priColor = item.priority === 'urgent' ? '#c0392b' : item.priority === 'high' ? '#e67e22' : item.priority === 'medium' ? '#f1c40f' : '#95a5a6';
      var priLabel = item.priority || 'medium';
      var catColors = { meeting:'#3498db', financial:'#27ae60', field:'#e67e22', design:'#9b59b6', closeout:'#1abc9c', other:'#95a5a6' };
      var catColor = catColors[item.category] || '#95a5a6';

      return '<div class="ai-item" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:6px;display:flex;align-items:flex-start;gap:10px;transition:opacity .2s' + (item.done ? ';opacity:.55' : '') + '">'
        + '<input type="checkbox" ' + (item.done ? 'checked' : '') + ' onchange="toggleAction(' + origIdx + ')" style="margin-top:2px;cursor:pointer;width:16px;height:16px;flex-shrink:0">'
        + '<div style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">'
        + '<span class="ai-pri-badge" style="background:' + priColor + ';color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;text-transform:uppercase">' + priLabel + '</span>'
        + (item.category ? '<span style="background:' + catColor + '20;color:' + catColor + ';font-size:10px;font-weight:600;padding:1px 7px;border-radius:10px">' + item.category + '</span>' : '')
        + (item.dueDate ? '<span style="font-size:11px;color:' + (dueWarn?'#c0392b':'var(--muted)') + ';font-weight:' + (dueWarn?'700':'400') + '">' + dueStr + '</span>' : '')
        + '</div>'
        + '<div class="ai-text" style="font-size:14px;color:var(--charcoal);line-height:1.4;cursor:pointer" onclick="editAction(' + origIdx + ')" title="Click to edit">' + (item.done ? '<s style="opacity:.6">' : '') + escapeHtml(item.text) + (item.done ? '</s>' : '') + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-top:3px">Added ' + date + (item.author ? ' by ' + escapeHtml(item.author) : '') + '</div>'
        + '</div>'
        + '<button onclick="removeAction(' + origIdx + ')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:2px;line-height:1;flex-shrink:0" title="Remove">×</button>'
        + '</div>';
    }).join('') + '</div>';
  }

  function switchActionTab(t) {
    window.aiTab = t;
    renderActions();
  }

  function showAddActionModal() {
    var html = '<div class="modal-dialog" style="max-width:480px">'
      + '<div class="modal-header"><div class="modal-title">+ New Action Item</div>'
      + '<button class="chat-close" onclick="closeModal(\'modal-action-edit\')">×</button></div>'
      + '<div class="modal-body">'
      + '<label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px">What needs to be done?</label>'
      + '<input id="ai-new-text" placeholder="Describe the action item..." style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:14px;background:var(--bg);color:var(--charcoal);outline:none;margin-bottom:12px">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
      + '<div><label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px">Priority</label>'
      + '<select id="ai-new-priority" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--charcoal);font-family:inherit;font-size:13px">'
      + '<option value="urgent">🔴 Urgent</option><option value="high" selected>🟠 High</option><option value="medium">🟡 Medium</option><option value="low">⚪ Low</option>'
      + '</select></div>'
      + '<div><label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px">Category</label>'
      + '<select id="ai-new-category" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--charcoal);font-family:inherit;font-size:13px">'
      + '<option value="">None</option><option value="meeting">Meeting</option><option value="financial">Financial</option><option value="field">Field</option><option value="design">Design</option><option value="closeout">Closeout</option><option value="other">Other</option>'
      + '</select></div>'
      + '</div>'
      + '<div style="margin-bottom:12px"><label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px">Due date (optional)</label>'
      + '<input id="ai-new-due" type="date" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--charcoal);font-family:inherit;font-size:13px">'
      + '</div>'
      + '<button class="btn-primary" onclick="commitAddAction()" style="width:100%;justify-content:center;padding:10px">Add Item</button>'
      + '</div></div>';
    showModal('modal-action-edit', html);
  }

  function commitAddAction() {
    var text = document.getElementById('ai-new-text');
    if (!text || !text.value.trim()) return;
    var tab = window.aiTab || 'team';
    var items = loadActions(tab);
    var author = (luUser && luUser.name) ? (luUser.name.split(' ')[0]) : '';
    items.unshift({
          id: Date.now() + '_' + Math.random().toString(36).slice(2,6),
          text: text.value.trim(),
          done: false,
          status: 'open',
          ts: Date.now(),
      author: author,
      priority: document.getElementById('ai-new-priority').value,
      category: document.getElementById('ai-new-category').value,
      dueDate: document.getElementById('ai-new-due').value || null
    });
    saveActions(items, tab);
    closeModal('modal-action-edit');
    renderActions();
  }

  function editAction(idx) {
    var tab = window.aiTab || 'team';
    var items = loadActions(tab);
    var item = items[idx];
    if (!item) return;
    var tab2 = tab; // capture tab for commitEditAction
    var html = '<div class="modal-dialog" style="max-width:480px">'
      + '<div class="modal-header"><div class="modal-title">✏️ Edit Action Item</div>'
      + '<button class="chat-close" onclick="closeModal(\'modal-action-edit\')">×</button></div>'
      + '<div class="modal-body">'
      + '<label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px">Description</label>'
      + '<input id="ai-edit-text" value="' + escapeHtml(item.text).replace(/"/g,'&quot;') + '" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:14px;background:var(--bg);color:var(--charcoal);outline:none;margin-bottom:12px">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
      + '<div><label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px">Priority</label>'
      + '<select id="ai-edit-priority" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--charcoal);font-family:inherit;font-size:13px">'
      + '<option value="urgent"' + (item.priority==='urgent'?' selected':'') + '>🔴 Urgent</option>'
      + '<option value="high"' + (item.priority==='high'?' selected':'') + '>🟠 High</option>'
      + '<option value="medium"' + (!item.priority || item.priority==='medium'?' selected':'') + '>🟡 Medium</option>'
      + '<option value="low"' + (item.priority==='low'?' selected':'') + '>⚪ Low</option>'
      + '</select></div>'
      + '<div><label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px">Category</label>'
      + '<select id="ai-edit-category" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--charcoal);font-family:inherit;font-size:13px">'
      + '<option value=""' + (!item.category?' selected':'') + '>None</option>'
      + '<option value="meeting"' + (item.category==='meeting'?' selected':'') + '>Meeting</option>'
      + '<option value="financial"' + (item.category==='financial'?' selected':'') + '>Financial</option>'
      + '<option value="field"' + (item.category==='field'?' selected':'') + '>Field</option>'
      + '<option value="design"' + (item.category==='design'?' selected':'') + '>Design</option>'
      + '<option value="closeout"' + (item.category==='closeout'?' selected':'') + '>Closeout</option>'
      + '<option value="other"' + (item.category==='other'?' selected':'') + '>Other</option>'
      + '</select></div>'
      + '</div>'
      + '<div style="margin-bottom:12px"><label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px">Due date (optional)</label>'
      + '<input id="ai-edit-due" type="date" value="' + (item.dueDate || '') + '" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--charcoal);font-family:inherit;font-size:13px">'
      + '</div>'
      + '<div style="display:flex;gap:8px">'
      + '<button class="btn-primary" onclick="commitEditAction(' + idx + ')" style="flex:1;justify-content:center;padding:10px">Save</button>'
      + '<button class="back-btn" onclick="closeModal(\'modal-action-edit\')" style="flex:1;justify-content:center;padding:10px">Cancel</button>'
      + '</div>'
      + '</div></div>';
    window._aiEditTab = tab;
    showModal('modal-action-edit', html);
  }

  function commitEditAction(idx) {
    var tab = window._aiEditTab || window.aiTab || 'team';
    var items = loadActions(tab);
    var item = items[idx];
    if (!item) return;
    var textEl = document.getElementById('ai-edit-text');
    if (!textEl || !textEl.value.trim()) return;
    item.text = textEl.value.trim();
    item.priority = document.getElementById('ai-edit-priority').value;
    item.category = document.getElementById('ai-edit-category').value;
    item.dueDate = document.getElementById('ai-edit-due').value || null;
    saveActions(items, tab);
    closeModal('modal-action-edit');
    renderActions();
  }

  function toggleAction(i) {
    var tab = window.aiTab || 'team';
    var items = loadActions(tab);
    if (items[i]) {
      // Cycle: open → in_progress → completed → open
      var st = getItemStatus(items[i]);
      items[i].status = st === 'completed' ? 'open' : st === 'in_progress' ? 'completed' : 'in_progress';
      items[i].done = items[i].status === 'completed';
    }
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

// ── CALENDAR ──────────────────────────────────────────────────────────
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

// ── MODALS ─────────────────────────────────────────────────────────
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
// Called by 78 decision tree answer links
function closeDecisionTree() {
  closeModal('modal-decision-tree');
  closeModal('modal-decision-tree-alt');
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
      appendMsg('ai', "Hi " + (luUser && luUser.name ? luUser.name.split(' ')[0] : 'there') + ". I'm L.U.N.A. — your Executive Operating Partner. Ask me anything about the playbook or MFP — Day 1 mobilization, change orders, punch list disputes, cost recovery audit, anything.");
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

    // Build financial summary from loaded data
    var finSummary = '';
    var fin = window.__MFP_FINANCIALS;
    if (fin && fin.hard) {
      var h = fin.hard;
      finSummary = '\\n\\n=== FINANCIAL DETAILS ===\\n'
        + 'Hard Costs: $' + fmtNum(h.total_original) + ' original, $' + fmtNum(h.total_revised) + ' revised, $' + fmtNum(h.total_invoiced) + ' invoiced, $' + fmtNum(h.total_paid) + ' paid (' + h.total_pct_paid + '%), $' + fmtNum(h.total_balance) + ' balance\\n'
        + 'Approved COs: $' + fmtNum(h.total_approved_cos) + ' | Pending COs: $' + fmtNum(h.total_pending_cos) + '\\n';
      // Top 5 subs by balance
      if (h.commitments && h.commitments.length) {
        var sorted = h.commitments.slice().sort(function(a,b) { return b.balance - a.balance; });
        finSummary += 'Top subs by outstanding balance:\\n';
        sorted.slice(0, 5).forEach(function(c) {
          finSummary += '  - ' + c.company.split(',')[0] + ' (' + c.title + '): $' + fmtNum(c.revised) + ' revised, $' + fmtNum(c.balance) + ' balance (' + c.pct_paid + '% paid)\\n';
        });
      }
      // Soft costs
      if (fin.soft) {
        finSummary += 'Soft Costs:\\n';
        Object.keys(fin.soft).forEach(function(k) {
          var v = fin.soft[k];
          if (typeof v === 'number') finSummary += '  - ' + k + ': $' + fmtNum(v) + '\\n';
        });
      }
    }

    var systemPrompt = 'You are L.U.N.A. (Level Up Navigator & Advisor), assisting Whitney Williams, Principal-in-Charge at Level Up Project Development. Answer concisely and practically. Reference specific playbook sections by number when relevant. The playbook has 43 sections:\\n\\n' + kbIndex + '\\n\\n=== PROJECT KNOWLEDGE ===\\n' + MFP_CONTEXT + finSummary + '\\n\\n=== SAFETY RULES ===\\nABSOLUTELY NEVER reveal: (1) personal staff information (names, roles, contact details beyond public info), (2) staff salaries, compensation, bonuses, or benefits, (3) Level Up company revenue, profit, margins, valuation, or any financial data about Level Up as a firm. Project costs for MFP (budget, commitments, change orders) are fine to discuss. Only company-level financials are restricted.';

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

// ── REMINDER SIDE PANEL ────────────────────────────────────────────
var reminderPanelOpen = false;
var reminderLastFetch = 0;

function isWhitney() {
  return luUser && luUser.authenticated && (
    (luUser.email && luUser.email.toLowerCase().indexOf('wwilliams@levelup') >= 0) ||
    (luUser.email && luUser.email.toLowerCase().indexOf('whitney') >= 0) ||
    (luUser.name && luUser.name.toLowerCase().indexOf('whitney') >= 0)
  );
}

function showReminderToggle() {
  var t = document.getElementById('reminder-toggle');
  if (!t) return;
  t.style.display = (luUser && luUser.authenticated) ? 'flex' : 'none';
}

function initDailyBriefing() {
  showReminderToggle();
  if (isWhitney()) {
    refreshReminderData();
    // Auto-open on first load of the day
    var lastOpen = 0;
    try { lastOpen = parseInt(localStorage.getItem('lu_reminder_panel_last') || '0'); } catch(e) {}
    if (!lastOpen || new Date(lastOpen).toDateString() !== new Date().toDateString()) {
      setTimeout(openReminderPanel, 800);
      try { localStorage.setItem('lu_reminder_panel_last', Date.now()); } catch(e) {}
    }
  }
}

function openReminderPanel() {
  var panel = document.getElementById('reminder-panel');
  var toggle = document.getElementById('reminder-toggle');
  if (panel) {
    panel.style.display = 'flex';
    setTimeout(function() { panel.classList.remove('closed'); }, 10);
  }
  if (toggle) toggle.style.display = 'none';
  reminderPanelOpen = true;
  renderReminderPanel();
}

function closeReminderPanel() {
  var panel = document.getElementById('reminder-panel');
  var toggle = document.getElementById('reminder-toggle');
  if (panel) {
    panel.classList.add('closed');
    setTimeout(function() {
      panel.style.display = 'none';
      if (toggle && luUser && luUser.authenticated) toggle.style.display = 'flex';
    }, 300);
  }
  reminderPanelOpen = false;
}

function switchReminderTab(tab) {
  document.querySelectorAll('.reminder-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-rtab') === tab);
  });
  var a = document.getElementById('reminder-panel-actions');
  var m = document.getElementById('reminder-panel-meetings');
  if (a) a.style.display = tab === 'actions' ? 'block' : 'none';
  if (m) m.style.display = tab === 'meetings' ? 'block' : 'none';
  if (tab === 'meetings') renderReminderMeetings();
  else renderReminderActions();
}

function renderReminderPanel() {
  switchReminderTab('actions');
  renderReminderActions();
  setTimeout(renderReminderMeetings, 200);
}

// ── PANEL: ACTION ITEMS WITH CHECKBOXES ───────────────────────────
function renderReminderActions() {
  var el = document.getElementById('reminder-panel-actions');
  if (!el) return;
  var footer = document.getElementById('reminder-panel-footer-text');
  if (footer) footer.textContent = 'Updating...';

  // Load directly from the Action Items system's localStorage
  var teamItems = [];
  var personalItems = [];
  try {
    teamItems = JSON.parse(localStorage.getItem('lu_actions_team') || '[]');
    personalItems = JSON.parse(localStorage.getItem('lu_actions_personal') || '[]');
  } catch(e) {}

  // Separate MFP vs Level Up items using keyword check
  var mfpKeywords = ['mfp','freedom park','stadium','lemartec','punch','change order','cost recovery','arq','miller','baker','hvac','scoreboard','commissioning','closeout','pco','invoice','draw','pay app','retainage','tco','permitting','boldyn','das','seating','concession'];

  var mfpItems = [];    // Team = MFP
  var levelUpItems = []; // Personal = Level Up (everything else)

  teamItems.forEach(function(item, idx) {
    if (item.done) return;
    var txt = (item.text || '').toLowerCase();
    var isMFP = mfpKeywords.some(function(kw) { return txt.indexOf(kw) >= 0; });
    if (isMFP || isWhitney()) {
      // For everyone: Team items matching MFP keywords = MFP items
      // For Whitney: ALL team items qualify
      (isMFP ? mfpItems : levelUpItems).push({
        item: item, idx: idx, tab: 'team', source: 'team'
      });
    } else {
      levelUpItems.push({
        item: item, idx: idx, tab: 'team', source: 'team'
      });
    }
  });

  personalItems.forEach(function(item, idx) {
    if (item.done) return;
    var txt = (item.text || '').toLowerCase();
    var isMFP = mfpKeywords.some(function(kw) { return txt.indexOf(kw) >= 0; });
    (isMFP ? mfpItems : levelUpItems).push({
      item: item, idx: idx, tab: 'personal', source: 'personal'
    });
  });

  // Sort each group: urgent first, then by recency
  function sortGroup(arr) {
    arr.sort(function(a,b) {
      var rank = { urgent:0, high:1, medium:2, low:3 };
      var ar = rank[a.item.priority]||2, br = rank[b.item.priority]||2;
      if (ar !== br) return ar - br;
      return (b.item.ts || 0) - (a.item.ts || 0);
    });
  }
  sortGroup(mfpItems);
  sortGroup(levelUpItems);

  var html = '';
  var toggleIcon = document.getElementById('reminder-toggle-count');
  var totalOpen = mfpItems.length + levelUpItems.length;

  // --- MFP SECTION ---
  if (mfpItems.length > 0) {
    html += '<div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px">🔴 MFP / Team (' + mfpItems.length + ')</div>';
    mfpItems.slice(0, 25).forEach(function(entry) {
      var item = entry.item;
      var priColor = item.priority === 'urgent' ? '#c0392b' : item.priority === 'high' ? '#e67e22' : '#95a5a6';
      var date = item.ts ? new Date(item.ts).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
      html += '<div class="rp-item" style="opacity:' + (item.done ? '.55' : '1') + '">'
        + '<input type="checkbox" class="rp-item-checkbox" ' + (item.done ? 'checked' : '') + ' onchange="panelToggleAction(\'' + entry.tab + '\',' + entry.idx + ')" style="margin-top:2px;width:14px;height:14px;flex-shrink:0;cursor:pointer">'
        + '<div class="rp-item-text" style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:2px">'
        + '<span style="background:' + priColor + ';color:#fff;font-size:9px;font-weight:700;padding:0 6px;border-radius:8px;text-transform:uppercase">' + (item.priority || 'medium') + '</span>'
        + (item.dueDate ? '<span style="font-size:10px;color:' + (new Date(item.dueDate+'T12:00:00') < new Date() ? '#c0392b' : 'var(--muted)') + '">' + item.dueDate + '</span>' : '')
        + '</div>'
        + '<div style="font-size:13px;color:var(--charcoal);line-height:1.4">' + (item.done ? '<s style="opacity:.6">' : '') + escapeHtml(item.text) + (item.done ? '</s>' : '') + '</div>'
        + '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + date + (item.author ? ' by ' + escapeHtml(item.author) : '') + '</div>'
        + '</div>'
        + '</div>';
    });
  }

  // --- LEVEL UP SECTION ---
  if (levelUpItems.length > 0) {
    html += '<div style="font-size:11px;font-weight:700;color:#4a90d9;text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px;margin-top:4px">📋 Level Up / Personal (' + levelUpItems.length + ')</div>';
    levelUpItems.slice(0, 15).forEach(function(entry) {
      var item = entry.item;
      var priColor = item.priority === 'urgent' ? '#c0392b' : item.priority === 'high' ? '#e67e22' : '#95a5a6';
      var date = item.ts ? new Date(item.ts).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
      html += '<div class="rp-item" style="opacity:' + (item.done ? '.55' : '1') + '">'
        + '<input type="checkbox" class="rp-item-checkbox" ' + (item.done ? 'checked' : '') + ' onchange="panelToggleAction(\'' + entry.tab + '\',' + entry.idx + ')" style="margin-top:2px;width:14px;height:14px;flex-shrink:0;cursor:pointer">'
        + '<div class="rp-item-text" style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:2px">'
        + '<span style="background:' + priColor + ';color:#fff;font-size:9px;font-weight:700;padding:0 6px;border-radius:8px;text-transform:uppercase">' + (item.priority || 'medium') + '</span>'
        + (item.dueDate ? '<span style="font-size:10px;color:' + (new Date(item.dueDate+'T12:00:00') < new Date() ? '#c0392b' : 'var(--muted)') + '">' + item.dueDate + '</span>' : '')
        + '</div>'
        + '<div style="font-size:13px;color:var(--charcoal);line-height:1.4">' + (item.done ? '<s style="opacity:.6">' : '') + escapeHtml(item.text) + (item.done ? '</s>' : '') + '</div>'
        + '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + date + (item.author ? ' by ' + escapeHtml(item.author) : '') + '</div>'
        + '</div>'
        + '</div>';
    });
  }

  // Empty state
  if (!html) {
    html = '<div class="rp-empty"><div class="rp-empty-icon">✅</div>All caught up! No open action items.</div>';
  }

  // Update badge count on toggle button
  if (toggleIcon) toggleIcon.textContent = totalOpen > 9 ? '9+' : totalOpen;

  el.innerHTML = html;
  if (footer) footer.textContent = totalOpen + ' open item' + (totalOpen !== 1 ? 's' : '') + ' · Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}

// Panel checkbox handler - toggles done/undone in the Action Items system
function panelToggleAction(tab, idx) {
  var items = [];
  try { items = JSON.parse(localStorage.getItem('lu_actions_' + tab) || '[]'); } catch(e) {}
  if (items[idx]) {
    items[idx].done = !items[idx].done;
    try { localStorage.setItem('lu_actions_' + tab, JSON.stringify(items)); } catch(e) {}
  }
  // Re-render panel AND the main Action Items view if visible
  renderReminderActions();
  if (document.getElementById('view-actions').classList.contains('active')) {
    renderActions();
  }
}

function renderReminderMeetings() {
  var el = document.getElementById('reminder-panel-meetings');
  if (!el) return;
  if (!luUser || !luUser.authenticated) {
    el.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">🔒</div>Sign in to see your calendar.</div>';
    return;
  }

  el.innerHTML = '<div class="reminder-loader">Loading meetings...</div>';

  fetch('/api/outlook/calendar?days=1', { credentials: 'include' })
    .then(function(r) {
      if (!r.ok) throw new Error('Calendar fetch failed');
      return r.json();
    })
    .then(function(data) {
      var events = data.value || [];
      var now = new Date();
      var endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      var todayEvents = events.filter(function(e) {
        var start = new Date(e.start.dateTime || e.start.date);
        return start >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && start <= endOfDay;
      });
      todayEvents.sort(function(a,b) {
        return new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date);
      });

      var html = '';
      if (todayEvents.length === 0) {
        var upcomingThisWeek = events.filter(function(e) {
          var start = new Date(e.start.dateTime || e.start.date);
          var weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
          weekEnd.setHours(23, 59, 59, 0);
          return start > now && start <= weekEnd;
        }).slice(0, 5);
        if (upcomingThisWeek.length > 0) {
          html += '<div style="font-size:11px;font-weight:700;color:var(--muted);padding:4px 0 6px">📅 Upcoming This Week</div>';
          upcomingThisWeek.forEach(function(e) {
            var start = new Date(e.start.dateTime || e.start.date);
            var timeStr = start.toLocaleTimeString([], { weekday:'short', hour:'2-digit', minute:'2-digit' });
            html += '<div class="rp-meeting"><span class="rp-meeting-time">' + timeStr + '</span><div class="rp-meeting-detail"><div class="rp-meeting-subject">' + escapeHtml(e.subject || '(No title)') + '</div>' + (e.location && e.location.displayName ? '<div class="rp-meeting-loc"> ' + escapeHtml(e.location.displayName) + '</div>' : '') + '</div></div>';
          });
        } else {
          html = '<div class="rp-empty"><div class="rp-empty-icon">📅</div>No meetings today.</div>';
        }
      } else {
        html += '<div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px"> Today\'s Meetings</div>';
        todayEvents.forEach(function(e) {
          var start = new Date(e.start.dateTime || e.start.date);
          var end = new Date(e.end.dateTime || e.end.date);
          var timeStr = start.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + '-' + end.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
          var isNow = now >= start && now <= end;
          html += '<div class="rp-meeting" style="' + (isNow ? 'border-left-color:#e74c3c;background:#fce8e8' : '') + '"><span class="rp-meeting-time">' + timeStr + '</span><div class="rp-meeting-detail"><div class="rp-meeting-subject">' + escapeHtml(e.subject || '(No title)') + '</div>' + (e.location && e.location.displayName ? '<div class="rp-meeting-loc"> ' + escapeHtml(e.location.displayName) + '</div>' : '') + (isNow ? '<div style="font-size:11px;color:#c0392b;font-weight:600;margin-top:2px"> In progress</div>' : '') + '</div></div>';
        });
      }
      el.innerHTML = html;
    })
    .catch(function() {
      el.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">⚠️</div>Could not load calendar.</div>';
    });
}

// ── EMAIL SCANNER — saves directly into Action Items system ───────
function refreshReminderData() {
  if (!luUser || !luUser.authenticated) return;
  if (Date.now() - reminderLastFetch < 15 * 60 * 1000) return;
  reminderLastFetch = Date.now();
  scanMFPEmails();
}

function scanMFPEmails() {
  if (!isWhitney()) return;
  fetch('/api/outlook/action-items?limit=150&days=21', { credentials: 'include' })
    .then(function(r) {
      if (!r.ok) throw new Error('Failed (' + r.status + ')');
      return r.json();
    })
    .then(function(data) {
      var emails = data.value || [];
      if (!emails.length) return;
      extractActionItemsFromEmails(emails);
    })
    .catch(function(err) {
      console.log('MFP email scan:', err.message);
    });
}

function extractActionItemsFromEmails(emails) {
  var targets = ['whitney', 'justin williams', 'jordan ward', 'wwilliams', 'justin.williams', 'jordan.ward'];
  var mfpKW = [
    'mfp','freedom park','stadium','lemartec','punch','change order','cost recovery',
    'arq','miller','baker','hvac','scoreboard','commissioning','closeout','pco','invoice',
    'draw','pay app','retainage','tco','permitting','boldyn','das','seating','concession',
    'ff&e','punch list','deficiency','scope','contract','submittal','rfp','rfi',
    'schedule','delay','accelerat','owner','graham','devon','victor'
  ];

  var mfpItems = [];
  var luItems = [];
  var seenMFP = {};
  var seenLU = {};

  emails.forEach(function(email) {
    var subject = (email.subject || '').toLowerCase();
    var preview = (email.bodyPreview || '').toLowerCase();
    var from = (email.from && email.from.emailAddress) ? (email.from.emailAddress.name || email.from.emailAddress.address) : '';
    var combined = subject + ' ' + preview;

    // Check if MFP-related
    var isMFP = mfpKW.some(function(kw) { return combined.indexOf(kw) >= 0; });

    // Check if it mentions a target person or is TO Whitney
    var mentionsTarget = targets.some(function(t) { return combined.indexOf(t) >= 0; });
    if (!mentionsTarget) {
      var toMe = (email.toRecipients || []).some(function(r) {
        var addr = (r.emailAddress && r.emailAddress.address || '').toLowerCase();
        return addr.indexOf('wwilliams@levelup') >= 0 || addr.indexOf('whitney') >= 0;
      });
      if (!toMe) return;
    }

    // Extract action text from subject
    var actionText = email.subject || preview.slice(0, 120);
    actionText = actionText.replace(/^(re:|fwd:)\s*/i, '').trim();
    if (actionText.length > 140) actionText = actionText.slice(0, 140) + '...';
    if (!actionText) return;

    // Dedup key
    var key = actionText.toLowerCase().slice(0, 40);
    var dedupMap = isMFP ? seenMFP : seenLU;
    if (dedupMap[key]) return;
    dedupMap[key] = true;

    // Priority based on keywords
    var priority = 'medium';
    var urgentKW = ['urgent','asap','due today','overdue','critical','blocking','stop work','cure notice','deadline'];
    var highKW = ['action required','please review','needs approval','pending','open item','request'];
    if (urgentKW.some(function(k) { return combined.indexOf(k) >= 0; })) priority = 'urgent';
    else if (highKW.some(function(k) { return combined.indexOf(k) >= 0; })) priority = 'high';

    // Determine assignment
    var assignedTo = '';
    if (combined.indexOf('jordan') >= 0) assignedTo = 'Jordan Ward';
    else if (combined.indexOf('justin') >= 0) assignedTo = 'Justin Williams';
    else if (combined.indexOf('whitney') >= 0 || combined.indexOf('wwilliams') >= 0) assignedTo = 'Whitney Williams';

    var date = new Date(email.receivedDateTime);
    var actionItem = {
      id: 'email_' + email.receivedDateTime + '_' + Math.random().toString(36).slice(2,6),
      text: (isMFP ? '' : '[LU] ') + actionText,
      done: false,
      ts: date.getTime(),
      author: 'L.U.N.A. (Email)',
      priority: priority,
      category: isMFP ? 'meeting' : 'other',
      dueDate: null,
      emailFrom: from,
      assignedTo: assignedTo
    };

    if (isMFP) {
      mfpItems.push(actionItem);
    } else {
      luItems.push(actionItem);
    }
  });

  // Save MFP items to Team action items (merge with existing)
  mergeEmailItems('team', mfpItems);
  // Save non-MFP items to Personal action items
  mergeEmailItems('personal', luItems);

  // Re-render panel if open
  if (reminderPanelOpen) renderReminderActions();
}

function mergeEmailItems(tab, newItems) {
  if (!newItems.length) return;
  var existing = [];
  try { existing = JSON.parse(localStorage.getItem('lu_actions_' + tab) || '[]'); } catch(e) {}
  
  // Build dedup set from existing items
  var existingKeys = {};
  existing.forEach(function(item) {
    if (item.id) existingKeys[item.id] = true;
    // Also dedup by text
    if (item.text) existingKeys['txt_' + item.text.toLowerCase().slice(0, 40)] = true;
  });

  var added = 0;
  newItems.forEach(function(item) {
    if (existingKeys[item.id]) return;
    if (existingKeys['txt_' + (item.text || '').toLowerCase().slice(0, 40)]) return;
    existing.unshift(item);
    existingKeys[item.id] = true;
    added++;
  });

  if (added > 0) {
    try { localStorage.setItem('lu_actions_' + tab, JSON.stringify(existing)); } catch(e) {}
  }
}

// ── UPDATED PLAYBOOK SEARCH WITH DROPDOWN ────────────────────────────
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
    // Initialize daily briefing/side panel
    initDailyBriefing();

  // Update footer status
  if (footer) {
    var status = luUser && luUser.authenticated ? 'Signed in: ' + luUser.email : 'Not signed in';
    footer.textContent = 'JS OK · ' + status + ' · KB=' + KB.length;
  }

  // Render home page — currently no fixed stats bar
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
          renderBriefing();
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

      // Fetch with 30s timeout
            var controller = new AbortController();
            var timeoutId = setTimeout(function() { controller.abort(); }, 30000);
            fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: q }] }),
              signal: controller.signal
            })
            .then(function(r) { clearTimeout(timeoutId); return r.text().then(function(text) { return { ok: r.ok, status: r.status, text: text }; }); })
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
                        // Apply chat filter BEFORE writing to DOM
                        var sn = [
                          /(?:salary|compensation|pay|wage|bonus)['\":]?\s*\$?\d[\d,.]*/gi,
                          /(?:revenue|profit|margin|earnings|income)['\":]?\s*\$?\d[\d,.]*/gi,
                          /Level Up['\"]?\s*(?:revenue|profit|margin|earnings|valuation|income)/gi
                        ];
                        sn.forEach(function(p) { reply = reply.replace(p, '[REDACTED]'); });
                        results.innerHTML = '<div class=\"luna-result-q\"><span class=\"luna-result-q-icon\">Q:</span>' + escapeHtml(q) + '</div>'
                          + '<div class=\"luna-result-a\">' + reply + '</div>';
                heroResults[q] = { q: q, a: reply };
        try { localStorage.setItem(cacheKey, JSON.stringify({ answer: reply, ts: Date.now() })); } catch(e){}
      })
      .catch(function(err) {
              if (btn) btn.disabled = false;
              document.querySelectorAll('.luna-hero-quick').forEach(function(b) { b.disabled = false; });
              var msg = (err.name === 'AbortError') ? 'Request timed out after 30s. Please try again.' : 'Network error: ' + (err.message || err);
              results.innerHTML = '<div class=\"luna-result-q\"><span class=\"luna-result-q-icon\">Q:</span>' + escapeHtml(q) + '</div>'
                + '<div class=\"luna-result-a\">' + msg + '</div>';
            });
    }


// ── DAILY BRIEFING ───────────────────────────────────────────────────
function buildBriefing() {
  if (!kbLoaded) return '<div style="padding:12px;text-align:center;color:var(--muted);font-size:13px">Loading briefing...</div>';
  var now = new Date();
  var day = now.getDate();
  var month = now.getMonth();
  var year = now.getFullYear();
  var monthKey = year + '-' + month;

  // Dismissed state
  var dismissed = {};
  try { var d = localStorage.getItem('lu_brief_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}
  var briefId = 'brief_' + year + '_' + month + '_' + now.getDate();
  if (dismissed[briefId]) return '';

  // Financial data
  var fin = window.__MFP_FINANCIALS;
  var Su = fin && fin.summary ? fin.summary : null;

  // Reminder deadlines (same logic as renderReminders)
  var drawDue = new Date(year, month, 10);
  if (day > 10) drawDue.setMonth(month + 1);
  var drawDays = Math.round((drawDue - now) / 86400000);

  var expDue = new Date(year, month, 5);
  if (day > 5) expDue.setMonth(month + 1);
  var expDays = Math.round((expDue - now) / 86400000);

  // Action items
  var items = [];

  if (Su) {
    // Project pulse
    var pulse = Su.days_past_baseline > 0 ? '🔴' : '🟢';
    items.push({ icon: pulse, label: 'MFP Stadium', detail: Su.days_past_baseline + ' days past baseline, targeting ' + Su.target_completion });

    // Past due
    if (Su.past_due > 0) {
      items.push({ icon: '⚠️', label: 'Past Due Invoices', detail: '$' + Math.round(Su.past_due/1000000) + 'M outstanding', urgent: true });
    }

    // Cost recovery deadline
    var crDue = new Date(2026, 5, 30);
    var crDays = Math.round((crDue - now) / 86400000);
    if (crDays > 0 && crDays <= 30) {
      items.push({ icon: '🔍', label: 'Cost Recovery Deadline', detail: crDays + ' days until Jun 30 target ($9M+)', urgent: crDays <= 14 });
    }

    // ARQ hold
    items.push({ icon: '🔴', label: 'ARQ Payment Hold', detail: '~$1.5M Feb-Apr invoices on hold', urgent: true });

    // Lemartec indirects
    if (Su.lemartec_indirects_outstanding > 0) {
      items.push({ icon: '💰', label: 'Lemartec Indirects Gap', detail: '$' + Math.round(Su.lemartec_indirects_outstanding/1000000) + 'M unpaid' });
    }
  }

  // Draw package
  if (drawDays <= 7) {
    items.push({ icon: '📄', label: 'Monthly Draw Package', detail: 'Due in ' + drawDays + ' day' + (drawDays !== 1 ? 's' : ''), urgent: drawDays <= 3 });
  }

  // Expense report
  if (expDays <= 5) {
    items.push({ icon: '🧾', label: 'Monthly Expense Report', detail: 'Due in ' + expDays + ' day' + (expDays !== 1 ? 's' : ''), warn: expDays <= 3 });
  }

  // HVAC
    items.push({ icon: '🔧', label: 'HVAC Service Agreement', detail: 'Hill York — pending signature', urgent: true });

    // CO Watchdog findings — top 3 high severity
        var wd = window.__CO_WATCHDOG;
        if (wd && wd.subcontractors) {
          var topFindings = wd.subcontractors.filter(function(f) {
            return f.forensic_notes && f.forensic_notes.length > 0;
          }).sort(function(a,b) {
            return (b.potential_savings || 0) - (a.potential_savings || 0);
          }).slice(0, 3);
          topFindings.forEach(function(f) {
            items.push({
              icon: '🔍',
              label: f.name + ' — $' + fmtNum(f.potential_savings) + ' savings',
              detail: (f.forensic_notes && f.forensic_notes[0]) || '',
              urgent: true
            });
          });
        }

  // Build HTML
  var greeting = 'Good ' + (now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening');
  var dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  var html = '<div class="briefing-card" id="briefing-card">'
    + '<div class="briefing-header">'
    + '<div>'
    + '<div class="briefing-greeting">' + greeting + (luUser && luUser.name ? ', ' + luUser.name.split(' ')[0] : '') + '</div>'
    + '<div class="briefing-date">' + dateStr + '</div>'
    + '</div>'
    + '<button class="briefing-close" onclick="dismissBriefing()" title="Dismiss for today">×</button>'
    + '</div>'
    + '<div class="briefing-section-label">Today\'s Action Items</div>'
    + '<div class="briefing-items">';

  items.forEach(function(item) {
    var bg = item.urgent ? '#fce8e8' : item.warn ? '#fef4e0' : 'var(--bg)';
    var border = item.urgent ? '#e74c3c' : item.warn ? '#e67e22' : 'var(--border)';
    html += '<div class="briefing-item" style="background:' + bg + ';border-left:3px solid ' + border + '">'
      + '<span class="briefing-item-icon">' + item.icon + '</span>'
      + '<div class="briefing-item-text">'
      + '<div class="briefing-item-label">' + item.label + '</div>'
      + '<div class="briefing-item-detail">' + item.detail + '</div>'
      + '</div>'
      + '</div>';
  });

  html += '</div>';

  // Budget snapshot
  if (Su) {
    html += '<div class="briefing-section-label">Budget Snapshot</div>'
      + '<div class="briefing-budget">'
      + '<div class="briefing-budget-item"><span>Total Budget</span><strong>$' + Math.round(Su.total_budget/1000000) + 'M</strong></div>'
      + '<div class="briefing-budget-item"><span>Paid to Date</span><strong>$' + Math.round(Su.paid_to_date/1000000) + 'M</strong></div>'
      + '<div class="briefing-budget-item"><span>Past Due</span><strong style="color:#c0392b">$' + Math.round(Su.past_due/1000000) + 'M</strong></div>'
      + '<div class="briefing-budget-item"><span>Retainage</span><strong>$' + Math.round(Su.retainage_held/1000000) + 'M</strong></div>'
      + '</div>';
  }

  html += '</div>';
  return html;
}

function renderBriefing() {
  var el = document.getElementById('luna-briefing');
  if (!el) return;
  el.innerHTML = buildBriefing();
}

function dismissBriefing() {
  var now = new Date();
  var briefId = 'brief_' + now.getFullYear() + '_' + now.getMonth() + '_' + now.getDate();
  var dismissed = {};
  try { var d = localStorage.getItem('lu_brief_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}
  dismissed[briefId] = true;
  try { localStorage.setItem('lu_brief_dismiss', JSON.stringify(dismissed)); } catch(e) {}
  var el = document.getElementById('luna-briefing');
  if (el) el.innerHTML = '';
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
