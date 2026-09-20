// ── LEVEL UP PLA// Clean rewrite. All state, data, and behavior in this file. v20260609-2

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
var CONTRACT_KB = window.__CONTRACT_KB || [];  // Contract knowledge from data/contracts_kb.js
var TEMPLATES = window.__TEMPLATES || {};
var GLOSSARY = window.__GLOSSARY || {};
var ALL_TOPICS = [];

// Merge contract KB into searchable KB
var FULL_KB = [];
function buildFullKB() {
  FULL_KB = KB.concat(CONTRACT_KB);
}

// Synchronous KB init — runs immediately since data is preloaded
var kbLoaded = false;
function initKB() {
  if (kbLoaded || !KB.length) return;
  buildFullKB();
  var set = {};
  KB.forEach(function(s) { (s.topics || []).forEach(function(t) { set[t] = true; }); });
  CONTRACT_KB.forEach(function(s) { (s.topics || []).forEach(function(t) { set[t] = true; }); });
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
  document.cookie = 'lu_auth=; Path=/; Max-Age=0';
  window.location.href = '/auth/logout';
}

// ── THEME ─────────────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.setAttribute('data-btn-theme', t === 'dark' ? '☽' : '☀');
  var btn = document.getElementById('theme-btn');
  if (btn) { btn.textContent = t === 'dark' ? '☽' : '☀'; btn.style.opacity = '1'; }
  // Theme-switch LUCI logos
    var lockup = document.querySelector('.luna-hero-lockup');
    if (lockup) lockup.src = lockup.getAttribute('data-' + t);
    var topbarLogo = document.querySelector('.topbar-logo');
    if (topbarLogo) topbarLogo.src = topbarLogo.getAttribute('data-' + t);
    var pwLogo = document.querySelector('.password-modal-logo img');
    if (pwLogo) pwLogo.src = pwLogo.getAttribute('data-' + t);
    var clippy = document.getElementById('luna-clippy-icon');
    if (clippy) clippy.src = clippy.getAttribute('data-' + t);
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

  // Nav tab highlight
    var navMap = { playbook:'nav-playbook', projects:'nav-projects', actions:'nav-actions', mfp:'nav-projects', 'mfp-dashboard':'nav-projects', chiefs:'nav-projects', luna:'nav-luna' };
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
            else if (view === 'mfp') renderMFP();
            else if (view === 'mfp-dashboard') renderMFPDashboard();
            else if (view === 'chiefs') renderChiefsDashboard();
            else if (view === 'dova') renderDovaDashboard();
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
  grid.innerHTML = '<div class="mfp-card chiefs-card" onclick="setView(\'mfp-dashboard\')" style="cursor:pointer">'
      + '<div class="mfp-card-head">'
      + '<span class="mfp-icon" style="font-size:18px">🏟</span>'
      + '<span class="mfp-card-title">Miami Freedom Park Stadium</span>'
      + '<span class="mfp-badge" style="background:#E31837;color:#fff">Active</span>'
      + '</div>'
      + '<div class="mfp-card-summary">Post-opening closeout. Home opener April 4, 2026. Cost recovery audit, punch list disputes with Lemartec, ARQ payment hold, HVAC service agreement.</div>'
      + '<div class="mfp-card-bullets chiefs-stats" id="mfp-card-stats">'
      + 'Total commitments: ' + stadiumRevised + '<br>'
      + 'Paid: ' + stadiumPaid + ', Balance: ' + stadiumBal + '<br>'
      + 'Hard cost budget: ' + stadiumBudget + '<br>'
      + 'Cost recovery target: $9M+<br>'
      + 'Audit final delivery: June 30, 2026'
      + '</div>'
      + '</div>'
    + '<div class="mfp-card chiefs-card" onclick="setView(\'dova\')" style="cursor:pointer">'
          + '<div class="mfp-card-head">'
          + '<span class="mfp-icon" style="font-size:18px">🏗</span>'
          + '<span class="mfp-card-title">DOVA Arena (Sacramento)</span>'
          + '<span class="mfp-badge" style="background:#1B3A5C;color:#fff">Active</span>'
          + '</div>'
          + '<div class="mfp-card-summary">Multi-purpose arena in Rancho Cordova, CA. 8,032 seats, ~200K SF. SD phase in progress. Construction target Apr 2027.</div>'
          + '<div class="mfp-card-bullets dova-stats">'
          + 'Budget: $275.9M (May Estimate)<br>'
          + 'Site: 2875 Kilgore Rd, 28 acres<br>'
          + 'Design: Perkins&Will | CM/GC: McCarthy<br>'
          + '</div>'
          + '</div>'
        + '<div class="mfp-card chiefs-card" onclick="alert(\'KC Chiefs Training Facility — Active pursuit. Proposal phase.\')" style="opacity:.6;cursor:pointer">'
        + '<div class="mfp-card-head">'
        + '<span class="mfp-icon chiefs-icon">▲</span>'
        + '<span class="mfp-card-title">Kansas City Chiefs — Training Facility</span>'
        + '<span class="mfp-badge" style="background:#FFB81C;color:#0f0f1a">Active Pursuit</span>'
        + '</div>'
        + '<div class="mfp-card-summary">Training Facility, Olathe KS. $265M budget, CMAR/GMP, Q4 2030. Turner & Townsend + Level Up.</div>'
        + '<div class="mfp-card-bullets chiefs-stats" id="chiefs-card-stats">'
        + 'Budget: $265M<br>'
        + 'Substantial Completion: Q4 2030<br>'
        + '<span class="chiefs-dot-green"></span> Schedule: On Track'
        + '</div>'
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
    + '<div style="margin-top:24px"><button class="btn-primary" onclick="toggleChat()">Ask LUCI about MFP →</button></div>';
    // Export modal function globally so card onclick handlers work
        window.openMFPModal = showMFPDetail;
            }

            // ── MFP COMMAND CENTER ────────────────────────────────────────
        function renderMFPDashboard() {
          var el = document.getElementById('mfp-dashboard');
          if (!el) return;
          var F = window.__MFP_FINANCIALS || {};
          var H = F.hard || {};
          var S = F.summary || {};
          var soft = F.soft || {};
          var ctx = window.__MFP_CONTEXT || '';
          var totalRev = H.total_revised ? Math.abs(H.total_revised).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '505M';
          var totalPaid = H.total_paid ? Math.abs(H.total_paid).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '400M';
          var totalBal = H.total_balance ? Math.abs(H.total_balance).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '105M';
          var pctPaid = H.total_pct_paid ? H.total_pct_paid.toFixed(1) : '79.1';
          var baseBudget = S.stadium_base_contract || S.total_budget || 824000000;
          var budgetStr = '$' + Math.abs(baseBudget).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,');

          // Format helper for numbers
          var fm = function(n) { if (n == null) return '$0'; return '$' + Math.abs(n).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,'); };

          // Top subs by balance
          var topSubs = [];
          if (H.commitments) {
            var sorted = H.commitments.slice().sort(function(a,b) { return b.balance - a.balance; });
            topSubs = sorted.slice(0, 8);
          }

          // Soft cost totals
          var softTotal = soft.design_total || 28451538;
          var ffeTotal = soft.ffe_budget || 15767602;
          var freightTotal = soft.freight || 16112254;
          var customsTotal = soft.customs_duties || 13989138;
          var contTotal = soft.contingency || 15500000;
          var allSoft = softTotal + ffeTotal + freightTotal + customsTotal + contTotal;

          var html = '<div class="mfp-live-badge">Live \u00b7 Financials as of Jun 8</div>';
          // Row 1: Header + SC anchor
          html += '<div class="mfp-row">';
          html += '<div class="mfp-header-band"><div class="mfp-header-title">MIAMI FREEDOM PARK STADIUM</div><div class="mfp-header-sub">Command Center \u00b7 Level Up Project Development \u00b7 Miami, FL</div><div class="mfp-header-desc">Post-opening closeout. Home opener April 4, 2026. Active workstreams: punch list, cost recovery audit, Lemartec contract closeout.</div></div>';
          html += '<div class="mfp-anchor"><div class="mfp-anchor-label">HOME OPENER</div><div class="mfp-anchor-value">Apr 4, 2026</div></div></div>';

          // Row 2: KPI strip
          html += '<div class="mfp-row mfp-kpi-row">';
          var kpis = [
            ['Total Budget', 'TOTAL BUDGET', '', budgetStr],
            ['Hard Cost Revised', 'HARD COSTS', '', '$' + (Math.abs(H.total_revised || 505000000) / 1000000).toFixed(0) + 'M'],
            ['Paid to Date', 'PAID TO DATE', '', '$' + (Math.abs(H.total_paid || 400000000) / 1000000).toFixed(0) + 'M'],
            ['Percent Paid', 'PAID %', 'gold', pctPaid + '%'],
            ['Outstanding Balance', 'BALANCE', '', '$' + (Math.abs(H.total_balance || 105000000) / 1000000).toFixed(0) + 'M'],
            ['Soft Costs Total', 'SOFT COSTS', '', '$' + Math.round(allSoft / 1000000) + 'M'],
            ['Pending COs', 'PENDING COs', '', '$' + (Math.abs(H.total_pending_cos || 4.8) / 1000000).toFixed(1) + 'M'],
            ['Project Status', 'STATUS', 'green', 'Post-Opening / Closeout']
          ];
          kpis.forEach(function(kp) {
            html += '<div class="mfp-kpi"><div class="mfp-kpi-label">' + kp[1] + '</div><div class="mfp-kpi-val ' + kp[2] + '">' + kp[3] + '</div></div>';
          });
          html += '</div>';

          // Row 3: Scorecard + Hard Cost Budget chart
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Project Health Scorecard</div><div class="mfp-scorecard">';
          var scoreItems = [
            ['Budget', 'GREEN'],
            ['Schedule', 'GREEN'],
            ['Punch List', 'YELLOW'],
            ['Cost Recovery', 'GREEN'],
            ['Safety', 'GREEN'],
            ['Closeout', 'YELLOW']
          ];
          scoreItems.forEach(function(si) {
            var c = si[1] === 'GREEN' ? 'green' : si[1] === 'YELLOW' ? 'yellow' : 'red';
            html += '<div class="mfp-score-item"><span class="mfp-dot mfp-dot-' + c + '"></span><span class="mfp-score-cat">' + si[0] + '</span></div>';
          });
          html += '</div></div>';
          // Budget bar chart
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Hard Cost Budget ($M)</div><div class="mfp-chart-wrap"><canvas id="mfp-chart-budget"></canvas></div></div>';
          html += '</div>';

          // Row 4: Active workstreams + Cost recovery
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Active Workstreams</div>';
          html += '<div class="mfp-workstreams">';
          var ws = [
            { label: 'Punch List Closeout', status: 'Active', detail: 'Tile deficiency, conduit dispute with Lemartec. Correction, not credit.' },
            { label: 'Cost Recovery Audit', status: 'Active', detail: 'Target $9M+. Final delivery June 30, 2026.' },
            { label: 'Day 2 Items', status: 'Active', detail: '60+ owner-directed items. 10 tracked in closeout.' },
            { label: 'HVAC Service Agreement', status: 'In Progress', detail: 'Negotiating terms with Lemartec sub.' },
            { label: 'ARQ Payment Hold', status: 'Active', detail: 'Outstanding AOR invoices under review.' },
            { label: 'Commissioning Completion', status: 'Completed', detail: 'All systems verified.' }
          ];
          ws.forEach(function(w) {
            var sc = w.status === 'Active' ? ' chiefs-pill-gold' : w.status === 'Completed' ? ' chiefs-pill-green' : ' chiefs-pill-gray';
            html += '<div class="mfp-ws-item"><div class="mfp-ws-label">' + w.label + '</div><div><span class="chiefs-pill' + sc + '">' + w.status + '</span></div><div class="mfp-ws-detail">' + w.detail + '</div></div>';
          });
          html += '</div></div>';
          // Cost recovery gauge
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Cost Recovery Progress</div><div class="mfp-chart-wrap"><canvas id="mfp-chart-recovery"></canvas></div><div class="mfp-bp-metrics"><div class="mfp-bp-metric"><div class="mfp-kpi-label">TARGET</div><div class="mfp-kpi-val">$9M</div></div><div class="mfp-bp-metric"><div class="mfp-kpi-label">IDENTIFIED</div><div class="mfp-kpi-val chiefs-pill-gold" style="padding:2px 10px;border-radius:10px">$6.2M</div></div><div class="mfp-bp-metric"><div class="mfp-kpi-label">RECOVERED</div><div class="mfp-kpi-val" style="color:var(--teal)">$4.1M</div></div></div></div></div>';

          // Row 5: Soft Costs Breakdown
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Soft Costs Breakdown <span style="font-weight:400;color:var(--muted)">Total: ' + fm(allSoft) + '</span></div><table class="chiefs-table"><thead><tr><th>Category</th><th>Amount</th><th>% of Soft</th></tr></thead><tbody>';
          var softItems = [
            ['Design Team Fees', softTotal, softTotal/allSoft],
            ['FF&E Budget', ffeTotal, ffeTotal/allSoft],
            ['Freight', freightTotal, freightTotal/allSoft],
            ['Customs Duties / Tariffs', customsTotal, customsTotal/allSoft],
            ['Contingency', contTotal, contTotal/allSoft]
          ];
          softItems.forEach(function(si) {
            var amt = '$' + Math.round(si[1] / 1000000) + 'M';
            var pct = (si[2] * 100).toFixed(0) + '%';
            html += '<tr><td class="chiefs-cell-primary">' + si[0] + '</td><td>' + amt + '</td><td>' + pct + '</td></tr>';
          });
          html += '</tbody></table></div>';
          // Design Team (top firms)
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Design Team <span style="font-weight:400;color:var(--muted)">Top firms by fee</span></div><table class="chiefs-table"><thead><tr><th>Firm</th><th>Scope</th><th>Fee</th></tr></thead><tbody>';
          if (soft.design_team) {
            soft.design_team.slice(0, 10).forEach(function(dt) {
              html += '<tr><td class="chiefs-cell-primary">' + dt.firm + '</td><td>' + dt.scope + '</td><td>' + fm(dt.fee) + '</td></tr>';
            });
          }
          html += '</tbody></table></div></div>';

          // Row 6: Top Subcontractors + FF&E Categories
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Top Subcontractors by Outstanding Balance</div><table class="chiefs-table"><thead><tr><th>Subcontractor</th><th>Trade</th><th>Revised</th><th>Balance</th><th>% Paid</th></tr></thead><tbody>';
          topSubs.forEach(function(c) {
            var balCls = c.pct_paid < 70 ? ' chiefs-pill-red' : c.pct_paid < 85 ? ' chiefs-pill-gold' : ' chiefs-pill-green';
            html += '<tr><td class="chiefs-cell-primary">' + c.company.split(',')[0] + '</td><td>' + c.title + '</td><td>' + fm(c.revised) + '</td><td>' + fm(c.balance) + '</td><td><span class="chiefs-pill' + balCls + '">' + c.pct_paid.toFixed(0) + '%</span></td></tr>';
          });
          html += '</tbody></table></div>';
          // FF&E breakdown
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">FF&E by Category <span style="font-weight:400;color:var(--muted)">Total: ' + fm(ffeTotal) + '</span></div><table class="chiefs-table"><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>';
          if (soft.ffe_breakdown) {
            soft.ffe_breakdown.forEach(function(ffe) {
              html += '<tr><td class="chiefs-cell-primary">' + ffe.category + '</td><td>' + fm(ffe.amount) + '</td></tr>';
            });
          }
          html += '</tbody></table></div></div>';

          // Row 7: Key contracts + Stakeholders
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Key Contracts</div><table class="chiefs-table"><thead><tr><th>Contract</th><th>Firm</th><th>Value</th><th>Status</th></tr></thead><tbody>';
          var contracts = [
            ['GC/CM', 'Lemartec', '$530M', 'Closeout'],
            ['Architect', 'ARQ', '—', 'Hold'],
            ['Structural', 'Walter P Moore', '—', 'Active'],
            ['MEP', 'B & I Contractors', '—', 'Active'],
            ['Scoreboard', 'Daktronics', '—', 'Complete'],
            ['Security', 'Boldyn', '—', 'Active']
          ];
          contracts.forEach(function(c) {
            var scls = c[3] === 'Complete' ? ' chiefs-pill-green' : c[3] === 'Hold' ? ' chiefs-pill-red' : c[3] === 'Closeout' ? ' chiefs-pill-gold' : ' chiefs-pill-gray';
            html += '<tr><td class="chiefs-cell-primary">' + c[0] + '</td><td>' + c[1] + '</td><td>' + c[2] + '</td><td><span class="chiefs-pill' + scls + '">' + c[3] + '</span></td></tr>';
          });
          html += '</tbody></table></div>';
          // Stakeholders
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Key Stakeholders</div><table class="chiefs-table"><thead><tr><th>Role</th><th>Name</th><th>Firm</th></tr></thead><tbody>';
          var stakeholders = [
            ['Owner (Day-to-Day)', 'Graham Oxley', 'MFP'],
            ['Owner (Approver)', 'Devon McCorkle', 'MFP'],
            ['Owner (Approver)', 'Victor Oliver', 'MFP'],
            ['Owner\'s Rep', 'Whitney Williams', 'Level Up'],
            ['Owner\'s Rep', 'Greg Wieting', 'Level Up'],
            ['Field Director', 'Jordan Ward', 'Level Up'],
            ['GC/CM', 'Jon Smith (PE)', 'Lemartec']
          ];
          stakeholders.forEach(function(sh) {
            html += '<tr><td class="chiefs-cell-primary">' + sh[0] + '</td><td>' + sh[1] + '</td><td>' + sh[2] + '</td></tr>';
          });
          html += '</tbody></table></div></div>';

          // Row 8: Key dates + Invoice status
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Key Dates</div><table class="chiefs-table"><thead><tr><th>Milestone</th><th>Date</th><th>Status</th></tr></thead><tbody>';
          var dates = [
            ['Home Opener', 'Apr 4, 2026', 'Complete'],
            ['Cost Recovery Final', 'Jun 30, 2026', 'On Track'],
            ['Punch List Complete', 'Aug 2026', 'In Progress'],
            ['Final Lien Waivers', 'Sep 2026', 'In Progress'],
            ['Contract Closeout', 'Dec 2026', 'Not Started']
          ];
          dates.forEach(function(d) {
            var dcls = d[2] === 'Complete' ? ' chiefs-pill-green' : d[2] === 'On Track' ? ' chiefs-pill-green' : d[2] === 'In Progress' ? ' chiefs-pill-gold' : ' chiefs-pill-gray';
            html += '<tr><td class="chiefs-cell-primary">' + d[0] + '</td><td>' + d[1] + '</td><td><span class="chiefs-pill' + dcls + '">' + d[2] + '</span></td></tr>';
          });
          html += '</tbody></table></div>';
          // Invoice summary
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Invoice Summary</div><div class="mfp-bp-metrics">';
          html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">HARD COST ORIGINAL</div><div class="mfp-kpi-val">$485M</div></div>';
          html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">APPROVED COs</div><div class="mfp-kpi-val" style="color:var(--teal)">$20.7M</div></div>';
          html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">INVOICED TO DATE</div><div class="mfp-kpi-val">$459M</div></div>';
          html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">PENDING COs</div><div class="mfp-kpi-val chiefs-pill-gold" style="padding:2px 6px;border-radius:6px">$4.8M</div></div>';
          html += '</div></div></div>';

          el.innerHTML = html;
          renderMFPCharts();
        }

        function renderMFPCharts() {
          if (typeof Chart === 'undefined') return;
          var teal = '#184655', gold = '#e6a817', slate = '#8A8AA3', txt = 'var(--charcoal)', grid = 'rgba(138,138,163,0.15)';
          Chart.defaults.color = txt; Chart.defaults.borderColor = grid;
          var F = window.__MFP_FINANCIALS || {};
          var H = F.hard || {};
          var S = F.summary || {};

          // Budget bar
          if (document.getElementById('mfp-chart-budget')) {
            var cats = ['Original', 'COs', 'Revised', 'Invoiced', 'Paid', 'Balance'];
            var vals = [
              Math.round((H.total_original || 485000000) / 1000000),
              Math.round((H.total_approved_cos || 20700000) / 1000000),
              Math.round((H.total_revised || 505000000) / 1000000),
              Math.round((H.total_invoiced || 459000000) / 1000000),
              Math.round((H.total_paid || 400000000) / 1000000),
              Math.round((H.total_balance || 105000000) / 1000000)
            ];
            new Chart(document.getElementById('mfp-chart-budget'), {
              type: 'bar',
              data: { labels: cats, datasets: [{ label: 'Amount ($M)', data: vals, backgroundColor: [teal, gold, teal, slate, '#1D9E75', '#E31837'], borderRadius: 3 }] },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: txt, maxRotation: 45, font: { size: 10 } } }, y: { ticks: { color: txt } } } }
            });
          }

          // Cost recovery gauge
          if (document.getElementById('mfp-chart-recovery')) {
            new Chart(document.getElementById('mfp-chart-recovery'), {
              type: 'doughnut',
              data: {
                labels: ['Recovered', 'Identified', 'Remaining'],
                datasets: [{ data: [4.1, 2.1, 2.8], backgroundColor: [teal, gold, slate], borderWidth: 0 }]
              },
              options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                  legend: { position: 'bottom', labels: { color: txt, boxWidth: 12, padding: 8 } }
                }
              }
            });
          }
        }

            // ── KC CHIEFS DASHBOARD ────────────────────────────────────────
    // ── KC CHIEFS DASHBOARD (rebuild per spec v1.0) ────────────
    var _chiefsData = {};
    var _chiefsSheetMeta = {};
    var _chiefsTimers = [];
    var _chiefsSortState = {};
    var _chiefsLastRefresh = 0;
    var _chiefsRefreshTimer = null;
    var _chiefsSectionErrors = {};

    var CHIEFS_SHEET_URLS = {
      '01':'https://app.smartsheet.com/sheets/p8C7HVqp3RrvQWwxwFGxJc7P8jHjWxv755Ghcp81',
      '02':'','03':'','04':'','05':'','06':'','07':'','08':'','09':'','10':'','11':'','12':'','13':''
    };

    var CHIEFS_DOCS = [
      {label:'Executive Schedule',url:''},{label:'Budget Tracker',url:''},
      {label:'Procurement Log',url:''},{label:'OAC Minutes',url:''},
      {label:'Monthly Reports',url:''},{label:'Drawings',url:''},
      {label:'Pay Apps',url:''},{label:'Renderings',url:''},{label:'Site Photos',url:''}
    ];

    function chiefsFmtCurrency(val) {
      if (val == null || val === '') return '-';
      var n = parseFloat(String(val).replace(/[$,]/g,''));
      if (isNaN(n)) return '-';
      if (Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      return '$' + Math.round(n).toLocaleString();
    }

    function chiefsFmtDate(d) {
      if (!d) return '-';
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      var now = new Date();
      var dm = (now.getFullYear() - dt.getFullYear()) * 12 + now.getMonth() - dt.getMonth();
      if (dm > 12) return dt.toLocaleDateString('en-US', { month:'short', year:'numeric' });
      return dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    }

    function chiefsStatusPill(status) {
      if (!status) return '<span class="chiefs-pill chiefs-pill-gray">---</span>';
      var s = String(status).toLowerCase().trim();
      if (['complete','awarded','on track','released','decided','healthy'].includes(s))
        return '<span class="chiefs-pill chiefs-pill-green">' + status + '</span>';
      if (['in progress','pending','in procurement','open','scheduled','medium'].includes(s))
        return '<span class="chiefs-pill chiefs-pill-gold">' + status + '</span>';
      if (['high','delayed','at risk','behind'].includes(s))
        return '<span class="chiefs-pill chiefs-pill-red">' + status + '</span>';
      return '<span class="chiefs-pill chiefs-pill-gray">' + (status || '---') + '</span>';
    }

    function chiefsRatingPill(rating) {
      if (!rating) return '<span class="chiefs-pill chiefs-pill-gray">---</span>';
      var r = String(rating).toLowerCase().trim();
      if (['high','red'].includes(r)) return '<span class="chiefs-pill chiefs-pill-red">High</span>';
      if (['medium','yellow'].includes(r)) return '<span class="chiefs-pill chiefs-pill-gold">Medium</span>';
      if (['low','green'].includes(r)) return '<span class="chiefs-pill chiefs-pill-green">Low</span>';
      return '<span class="chiefs-pill chiefs-pill-gray">' + rating + '</span>';
    }

    function chiefsTrendArrow(trend) {
      if (!trend) return '';
      var t = String(trend).toLowerCase().trim();
      if (['up','worsening'].includes(t)) return '<span style="color:#E31837">▲</span>';
      if (['down','improving'].includes(t)) return '<span style="color:var(--teal,#184655)">▼</span>';
      if (['flat','steady','stable'].includes(t)) return '<span style="color:var(--muted)">→</span>';
      return trend;
    }

    function chiefsSectionError(label, sheetKey) {
      return '<div class="chiefs-empty">Could not load ' + label
        + ' <button class="chiefs-retry-btn" onclick="chiefsRetrySheet(\'' + sheetKey + '\')">Retry</button></div>';
    }

    function chiefsSourceLink(sheetKey) {
      var url = CHIEFS_SHEET_URLS[sheetKey];
      return url ? '<a class="chiefs-source-link" href="' + url + '" target="_blank" rel="noopener" title="Open in Smartsheet">&#x1F517;</a>' : '';
    }

    function chiefsStaleTag(sheetKey) {
      var meta = _chiefsSheetMeta[sheetKey];
      if (!meta || !meta.updatedAt) return '';
      var dt = new Date(meta.updatedAt);
      var days = (Date.now() - dt.getTime()) / 86400000;
      if (days > 14) return '<span class="chiefs-stale-badge">&#x23F0; Updated ' + chiefsFmtDate(meta.updatedAt) + '</span>';
      return '';
    }

    function chiefsFetchSheet(sheetKey) {
      return fetch('/api/chiefs?sheet=' + sheetKey)
        .then(function(r) { if (!r.ok) throw new Error(sheetKey + ': ' + r.status); return r.json(); })
        .then(function(d) {
          _chiefsData[sheetKey] = d.rows || [];
          _chiefsSheetMeta[sheetKey] = { updatedAt: d.updatedAt || null, name: d.name || '' };
          delete _chiefsSectionErrors[sheetKey];
          return d.rows || [];
        })
        .catch(function(e) {
          _chiefsSectionErrors[sheetKey] = e.message;
          _chiefsData[sheetKey] = [];
          return [];
        });
    }

    function chiefsRetrySheet(sheetKey) {
      var el = document.getElementById('chiefs-dashboard');
      if (!el) return;
      chiefsFetchSheet(sheetKey).then(function() { buildChiefsDashboard(el); });
    }

    function chiefsSortRows(rows, colKey, dir) {
      if (!rows || !rows.length) return rows;
      return rows.slice().sort(function(a, b) {
        var va = a[colKey], vb = b[colKey];
        if (va == null) va = ''; if (vb == null) vb = '';
        var na = parseFloat(String(va).replace(/[$,]/g,''));
        var nb = parseFloat(String(vb).replace(/[$,]/g,''));
        if (!isNaN(na) && !isNaN(nb)) return dir === 'asc' ? na - nb : nb - na;
        var da = new Date(va), db = new Date(vb);
        if (!isNaN(da) && !isNaN(db)) return dir === 'asc' ? da - db : db - da;
        va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
        return dir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
      });
    }

    function chiefsBuildTable(sheetKey, columns, opts) {
      opts = opts || {};
      var rows = _chiefsData[sheetKey] || [];
      var err = _chiefsSectionErrors[sheetKey];
      var sectionKey = sheetKey + '-' + (columns[0] ? columns[0].key : 'col');
      var state = _chiefsSortState[sectionKey];

      if (err) return chiefsSectionError(opts.label || 'section', sheetKey);
      if (!rows || !rows.length) return '<div class="chiefs-empty">' + (opts.emptyText || 'No items') + '</div>';

      if (state && state.col) {
        rows = chiefsSortRows(rows, state.col, state.dir);
      } else if (opts.defaultSortCol) {
        rows = chiefsSortRows(rows, opts.defaultSortCol, opts.defaultSortDir || 'asc');
      }

      var cap = opts.cap || 0;
      var total = rows.length;
      if (cap > 0 && rows.length > cap) rows = rows.slice(0, cap);

      var h = '<div class="chiefs-table-wrap"><table class="chiefs-table"><thead><tr>';
      columns.forEach(function(c) {
        var asc = state && state.col === c.key && state.dir === 'asc';
        var desc = state && state.col === c.key && state.dir === 'desc';
        h += '<th onclick="chiefsSortTable(\'' + sectionKey + '\',\'' + c.key + '\')">' + c.label
          + (asc ? ' ▲' : desc ? ' ▼' : '') + '</th>';
      });
      h += '</tr></thead><tbody>';

      rows.forEach(function(row) {
        var isComplete = String(row.Status || '').toLowerCase().trim() === 'complete';
        h += '<tr' + (isComplete ? ' class="completed-row"' : '') + '>';
        columns.forEach(function(c) {
          var val = row[c.key];
          var cellHTML = '';
          if (c.fmt === 'currency') cellHTML = chiefsFmtCurrency(val);
          else if (c.fmt === 'date') cellHTML = chiefsFmtDate(val);
          else if (c.fmt === 'status') cellHTML = chiefsStatusPill(val);
          else if (c.fmt === 'rating') cellHTML = chiefsRatingPill(val);
          else if (c.fmt === 'trend') cellHTML = chiefsTrendArrow(val) + ' ' + (val || '');
          else cellHTML = val || '-';
          var overdue = (c.fmt === 'date' && val && !isComplete && new Date(val) < new Date() && !isNaN(new Date(val)));
          h += '<td' + (overdue ? ' class="chiefs-cell-overdue"' : c.key === columns[0].key ? ' class="chiefs-cell-primary"' : '') + '>' + cellHTML + '</td>';
        });
        h += '</tr>';
      });

      if (cap > 0 && total > cap) {
        h += '<tr><td colspan="' + columns.length + '" style="text-align:center;padding:6px;font-size:11px;color:var(--muted)">Showing ' + cap + ' of ' + total + ' items</td></tr>';
      }
      return h + '</tbody></table></div>';
    }

    function chiefsSortTable(sectionKey, colKey) {
      var state = _chiefsSortState[sectionKey] || { col: colKey, dir: 'asc' };
      if (state.col === colKey) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.col = colKey; state.dir = 'asc'; }
      _chiefsSortState[sectionKey] = state;
      var el = document.getElementById('chiefs-dashboard');
      if (el) buildChiefsDashboard(el);
    }

    // ── MAIN RENDER ───────────────────────────────────────────

    function renderChiefsDashboard() {
      var el = document.getElementById('chiefs-dashboard');
      if (!el) return;
      el.innerHTML = '<div class="chiefs-skeleton"><div class="chiefs-loader"></div>Loading Command Center...</div>';
      var sheets = ['01','02','03','04','05','06','07','08','09','10','11','12','13'];
      Promise.allSettled(sheets.map(function(s) { return chiefsFetchSheet(s); })).then(function() {
        buildChiefsDashboard(el);
        chiefsStartRefresh();
      });
    }

    function buildChiefsDashboard(el) {
      var d = _chiefsData;
      var hasAuthErr = Object.values(_chiefsSectionErrors).some(function(e) { return String(e).indexOf('401') >= 0 || String(e).indexOf('403') >= 0; });
      var now = new Date();
      var html = '';

      if (hasAuthErr) html += '<div class="chiefs-auth-banner">Smartsheet connection needs re-authorization</div>';

      // Live badge + refresh
      html += '<div class="chiefs-live-badge" id="chiefs-live-badge">';
      html += '<span class="chiefs-refresh-dot" id="chiefs-refresh-dot"></span> Updated '
        + now.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
      html += ' <button class="chiefs-refresh-btn" onclick="chiefsManualRefresh()">&#x21bb; Refresh</button>';
      html += '</div>';

      // ── ROW 1: Header ──
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-header-band">';
      html += '<div class="chiefs-header-title">';
      html += '<img src="assets/chiefs-logo.svg" style="height:32px;vertical-align:middle;margin-right:12px" alt="KC Chiefs">';
      html += 'KC CHIEFS TRAINING FACILITY &amp; HEADQUARTERS ' + chiefsSourceLink('02');
      html += '</div>';
      html += '<div class="chiefs-header-sub">Command Center &middot; T&amp;T + Level Up &middot; Olathe, Kansas</div>';
      html += '<div class="chiefs-header-desc">A single source of truth that keeps priorities visible, decisions organized, and Chiefs leadership informed.</div>';
      html += '</div>';
      html += '<div class="chiefs-anchor"><div class="chiefs-anchor-label">SUBSTANTIAL COMPLETION</div><div class="chiefs-anchor-value">'+(function(){var sched=d["02"];if(sched&&sched.rows&&sched.rows.length){var last=sched.rows[sched.rows.length-1];var dt=last["Target Date"]||last["Baseline Date"]||"";if(dt){var pd=Date.parse(dt);if(!isNaN(pd)){var d2=new Date(pd);return"Q"+(Math.floor(d2.getMonth()/3)+1)+" "+d2.getFullYear();}}}return"--";})()+'</div></div>';
      html += '</div>';

      // ── ROW 2: KPI Grid (left 50%) + Project Snapshot (right 50%) ──
      var kpiRows = d['06'] || [];
      html += '<div class="chiefs-row chiefs-top-row">';

      // Left: KPI Grid (2x3)
      html += '<div class="chiefs-widget chiefs-top-left">';
            html += '<div class="chiefs-widget-title">KPIs ' + chiefsSourceLink('06') + chiefsStaleTag('06') + '</div>';
            html += '<div class="chiefs-kpi-grid">';
      ['Total Budget','Committed','Billed to Date','Percent Spent','Contingency','Schedule Status'].forEach(function(kpiName) {
        var row = null;
        kpiRows.forEach(function(r) { if (r.KPI === kpiName) row = r; });
        var val = row ? row.Value : '-';
        var display = (kpiName === 'Percent Spent') ? val : chiefsFmtCurrency(val);
        var cls = '';
        if (kpiName === 'Contingency') cls = 'gold';
        else if (kpiName === 'Schedule Status' && val) {
          var sv = String(val).toLowerCase();
          cls = sv === 'on track' ? 'green' : sv === 'at risk' ? 'gold' : '';
        }
        var bar = '';
        if (kpiName === 'Percent Spent' && val) {
          var p = parseFloat(String(val).replace(/%/g,''));
          if (!isNaN(p)) bar = '<div class="chiefs-kpi-progress"><div class="chiefs-kpi-progress-fill" style="width:' + Math.min(p,100) + '%"></div></div>';
        }
        html += '<div class="chiefs-kpi"><div class="chiefs-kpi-label">' + kpiName.toUpperCase() + '</div><div class="chiefs-kpi-val ' + cls + '">' + display + '</div>' + bar + '</div>';
      });
      html += '</div></div>';

      // Right: Project Snapshot (Sheet 04)
      html += '<div class="chiefs-widget chiefs-top-right"><div class="chiefs-widget-title">Project Snapshot ' + chiefsSourceLink('04') + chiefsStaleTag('04') + '</div>';
      var snapRows = d['04'] || [];
      if (snapRows.length) {
        html += '<table class="chiefs-table"><tbody>';
        snapRows.forEach(function(r) { html += '<tr><td class="chiefs-cell-primary" style="width:40%">' + (r.Metric || '') + '</td><td>' + (r.Value || '') + '</td></tr>'; });
        html += '</tbody></table>';
      } else { html += '<div class="chiefs-empty">No snapshot data</div>'; }
      html += '</div></div>';

      // ── ROW 3: Docs + Camera (collapsible) ──
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-collapsible" id="chiefs-docs-section">';
      html += '<div class="chiefs-collapsible-header" onclick="chiefsToggleCollapse(\'chiefs-docs-section\')"><span class="chiefs-chevron">&#x25BC;</span> Documents &amp; Camera</div>';
      html += '<div class="chiefs-collapsible-body">';
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Document Shortcuts</div><div class="chiefs-doc-links">';
      CHIEFS_DOCS.forEach(function(doc) {
        html += doc.url
          ? '<a class="chiefs-doc-link" href="' + doc.url + '" target="_blank" rel="noopener">' + doc.label + '</a>'
          : '<span class="chiefs-doc-link disabled">' + doc.label + '</span>';
      });
      html += '</div></div>';
      html += '<div class="chiefs-widget chiefs-w1"><div class="chiefs-widget-title">Live Jobsite Camera</div><div class="chiefs-camera-ph"><div class="chiefs-camera-icon">&#x1F4F7;</div><div>Coming online with site mobilization</div></div></div>';
      html += '</div></div></div></div>';

      // ── ROW 4: Health + Charts (collapsible, 2x2 grid) ──
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-collapsible" id="chiefs-health-section">';
      html += '<div class="chiefs-collapsible-header" onclick="chiefsToggleCollapse(\'chiefs-health-section\')"><span class="chiefs-chevron">&#x25BC;</span> Health &amp; Charts</div>';
      html += '<div class="chiefs-collapsible-body">';

      // 2x2 grid
      // Top-left: Scorecard
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Project Health Scorecard ' + chiefsSourceLink('13') + chiefsStaleTag('13') + '</div>';
      var healthRows = d['13'] || [];
      if (healthRows.length) {
        html += '<div class="chiefs-scorecard">';
        healthRows.forEach(function(r) {
          var st = String(r.Status || '').toLowerCase().trim();
          var dc = st === 'green' ? 'chiefs-dot-green' : st === 'yellow' ? 'chiefs-dot-yellow' : 'chiefs-dot-red';
          html += '<div class="chiefs-score-item" title="' + (r.Note || '').replace(/\"/g,'') + '"><span class="chiefs-dot ' + dc + '"></span><span>' + (r.Category || '') + '</span></div>';
        });
        html += '</div>';
      } else { html += '<div class="chiefs-empty">No health data</div>'; }
      html += '</div>';

      // Top-right: Budget by Category doughnut chart
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Budget by Category ($M) ' + chiefsSourceLink('01') + chiefsStaleTag('01') + '</div>';
      html += (d['01'] && d['01'].length) ? '<div class="chiefs-chart-wrap"><canvas id="chiefs-chart-budget"></canvas></div>' : '<div class="chiefs-empty">No budget data</div>';
      html += '</div></div>';

      // Bottom row of 2x2
      html += '<div class="chiefs-row">';
      // Bottom-left: Cash Flow line chart
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Cash Flow Curve (Cumulative $M) ' + chiefsSourceLink('05') + chiefsStaleTag('05') + '</div>';
      var cfRows = d['05'] || [];
      html += (cfRows.length > 1) ? '<div class="chiefs-chart-wrap"><canvas id="chiefs-chart-cashflow"></canvas></div>' : '<div class="chiefs-empty">' + (cfRows.length ? 'Not enough data to chart' : 'No cash flow data') + '</div>';
      html += '</div>';

      // Bottom-right: Budget Consumption bar chart
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Budget Consumption $M ' + chiefsSourceLink('01') + chiefsStaleTag('01') + '</div>';
      html += (d['01'] && d['01'].length) ? '<div class="chiefs-chart-wrap"><canvas id="chiefs-chart-budgetbar"></canvas></div>' : '<div class="chiefs-empty">No budget data</div>';
      html += '</div></div>';

      html += '</div></div></div>';

      // ── ROW 5: Gantt Chart (collapsible) ──
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-collapsible" id="chiefs-gantt-section">';
      html += '<div class="chiefs-collapsible-header" onclick="chiefsToggleCollapse(\'chiefs-gantt-section\')"><span class="chiefs-chevron">&#x25BC;</span> Project Schedule (Gantt) ' + chiefsSourceLink('02') + ' ' + chiefsSourceLink('09') + '</div>';
      html += '<div class="chiefs-collapsible-body"><div id="chiefs-gantt-body"></div></div>';
      html += '</div></div>';

      // ── ROW 6: Next 90 Days (collapsible) ──
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-collapsible" id="chiefs-next90-section">';
      html += '<div class="chiefs-collapsible-header" onclick="chiefsToggleCollapse(\'chiefs-next90-section\')"><span class="chiefs-chevron">&#x25BC;</span> Next 90 Days ' + chiefsSourceLink('09') + chiefsStaleTag('09') + '</div>';
      html += '<div class="chiefs-collapsible-body">';
      var schedRows = d['09'] || [];
      var today = new Date();
      today.setHours(0,0,0,0);
      var upcoming = [];
      schedRows.forEach(function(r) {
        if (String(r.Type || '').trim() === 'Phase') return;
        var fin = r.Finish ? new Date(r.Finish) : null;
        if (fin && !isNaN(fin.getTime()) && fin >= today) {
          upcoming.push(r);
        }
      });
      upcoming.sort(function(a,b) {
        var da = a.Finish ? new Date(a.Finish) : new Date(9999,0,1);
        var db = b.Finish ? new Date(b.Finish) : new Date(9999,0,1);
        return da - db;
      });
      if (upcoming.length) {
        html += '<table class="chiefs-table"><thead><tr><th>Activity</th><th>Start</th><th>Finish</th><th>Owner</th></tr></thead><tbody>';
        var cap = Math.min(upcoming.length, 15);
        for (var i = 0; i < cap; i++) {
          var r = upcoming[i];
          html += '<tr><td class="chiefs-cell-primary">' + (r.Activity || '-') + '</td>'
            + '<td>' + chiefsFmtDate(r.Start) + '</td>'
            + '<td>' + chiefsFmtDate(r.Finish) + '</td>'
            + '<td>' + (r.Owner || '-') + '</td></tr>';
        }
        if (upcoming.length > 15) {
          html += '<tr><td colspan="4" style="text-align:center;padding:6px;font-size:11px;color:var(--muted)">Showing 15 of ' + upcoming.length + ' items</td></tr>';
        }
        html += '</tbody></table>';
      } else {
        html += '<div class="chiefs-empty">No upcoming activities in next 90 days</div>';
      }
      html += '</div></div></div>';

      // ── ROW 7: Action Items + Procurement (collapsible) ──
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-collapsible" id="chiefs-actions-section">';
      html += '<div class="chiefs-collapsible-header" onclick="chiefsToggleCollapse(\'chiefs-actions-section\')"><span class="chiefs-chevron">&#x25BC;</span> Action Items &amp; Procurement</div>';
      html += '<div class="chiefs-collapsible-body">';
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Action Items ' + chiefsSourceLink('03') + chiefsStaleTag('03') + '</div>';
      html += chiefsBuildTable('03', [{key:'Item',label:'Item'},{key:'Owner',label:'Owner'},{key:'Due Date',label:'Due',fmt:'date'},{key:'Priority',label:'Priority',fmt:'rating'}], { cap:10, defaultSortCol:'Due Date' });
      html += '</div>';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Procurement & Long-Lead ' + chiefsSourceLink('07') + chiefsStaleTag('07') + '</div>';
      html += chiefsBuildTable('07', [{key:'Package',label:'Package'},{key:'Budget Value',label:'Budget',fmt:'currency'},{key:'Need-By',label:'Need-By',fmt:'date'},{key:'Status',label:'Status',fmt:'status'}], { defaultSortCol:'Need-By' });
      html += '</div></div></div></div></div>';

      // ── ROW 8: Decisions + Risks (collapsible) ──
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-collapsible" id="chiefs-decisions-section">';
      html += '<div class="chiefs-collapsible-header" onclick="chiefsToggleCollapse(\'chiefs-decisions-section\')"><span class="chiefs-chevron">&#x25BC;</span> Decisions &amp; Risks</div>';
      html += '<div class="chiefs-collapsible-body">';
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Upcoming Key Decisions ' + chiefsSourceLink('08') + chiefsStaleTag('08') + '</div>';
      html += chiefsBuildTable('08', [{key:'Decision',label:'Decision'},{key:'Needed By',label:'Needed By',fmt:'date'},{key:'Status',label:'Status',fmt:'status'}], { defaultSortCol:'Needed By' });
      html += '</div>';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Top Risks & Mitigation ' + chiefsSourceLink('10') + chiefsStaleTag('10') + '</div>';
      html += chiefsBuildTable('10', [{key:'Risk',label:'Risk'},{key:'Rating',label:'Rating',fmt:'rating'},{key:'Trend',label:'Trend',fmt:'trend'},{key:'Mitigation',label:'Mitigation'}], { defaultSortCol:'Rating', defaultSortDir:'desc' });
      html += '</div></div></div></div></div>';

      // ── ROW 9: Budget Position (collapsible) ──
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-collapsible" id="chiefs-budgetpos-section">';
      html += '<div class="chiefs-collapsible-header" onclick="chiefsToggleCollapse(\'chiefs-budgetpos-section\')"><span class="chiefs-chevron">&#x25BC;</span> Budget Position</div>';
      html += '<div class="chiefs-collapsible-body">';
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2" style="flex:1"><div class="chiefs-widget-title">Budget Position ' + chiefsSourceLink('12') + chiefsStaleTag('12') + '</div>';
      html += '<div class="chiefs-chart-wrap"><canvas id="chiefs-chart-budgetpos"></canvas></div><div class="chiefs-bp-metrics" id="chiefs-bp-metrics"></div>';
      html += '</div></div></div></div></div>';

      // ── ROW 10: Project Team (collapsible) ──
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-collapsible" id="chiefs-team-section">';
      html += '<div class="chiefs-collapsible-header" onclick="chiefsToggleCollapse(\'chiefs-team-section\')"><span class="chiefs-chevron">&#x25BC;</span> Project Team</div>';
      html += '<div class="chiefs-collapsible-body">';
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2" style="flex:1"><div class="chiefs-widget-title">Project Team ' + chiefsSourceLink('11') + chiefsStaleTag('11') + '</div>';
      html += chiefsBuildTable('11', [{key:'Name',label:'Name'},{key:'Role',label:'Role'},{key:'Phase Focus',label:'Phase Focus'}], {});
      html += '</div></div></div></div></div>';

      el.innerHTML = html;

      // Restore collapsed state
      chiefsInitCollapse();

      // Render gantt if gantt section not collapsed
      var ganttSec = document.getElementById('chiefs-gantt-section');
      if (ganttSec && !ganttSec.classList.contains('collapsed')) {
        setTimeout(function(){ renderChiefsGantt('chiefs-gantt-body'); }, 50);
      }

      // Render charts
      renderChiefsCharts();
      chiefsRenderBPMetrics();

      // Convert budget chart to doughnut (overwrite if Chart.js loaded)
      setTimeout(function() {
        if (typeof Chart === 'undefined') return;
        var bd = _chiefsData['01'];
        var cb = document.getElementById('chiefs-chart-budget');
        if (bd && bd.length && cb) {
          var lb = [], am = [];
          bd.forEach(function(r) { lb.push(r.Category || ''); am.push(r['Planned Amount'] ? Math.round(r['Planned Amount'] / 1000000) : 0); });
          var root = document.documentElement;
          var cs = getComputedStyle(root);
          var txt = cs.getPropertyValue('--charcoal').trim() || '#181818';
          var teal = cs.getPropertyValue('--teal').trim() || '#184655';
          var gold = '#FFB81C', red = '#E31837', slate = '#8A8AA3';
          new Chart(cb, {
            type: 'doughnut',
            data: {
              labels: lb,
              datasets: [{
                data: am,
                backgroundColor: [teal, gold, red, slate, '#2D6A4F', '#7B2D8B'],
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right', labels: { color: txt, boxWidth: 12, font: { size: 10 } } }
              },
              cutout: '55%'
            }
          });
        }
        // Budget bar chart (consumption)
        var bb = document.getElementById('chiefs-chart-budgetbar');
        if (bd && bd.length && bb) {
          var lb2 = [], am2 = [];
          bd.forEach(function(r) { lb2.push(r.Category || ''); am2.push(r['Planned Amount'] ? Math.round(r['Planned Amount'] / 1000000) : 0); });
          var root2 = document.documentElement;
          var cs2 = getComputedStyle(root2);
          var txt2 = cs2.getPropertyValue('--charcoal').trim() || '#181818';
          var teal2 = cs2.getPropertyValue('--teal').trim() || '#184655';
          new Chart(bb, {
            type: 'bar',
            data: {
              labels: lb2,
              datasets: [{ label: 'Planned ($M)', data: am2, backgroundColor: teal2, borderRadius: 3 }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y',
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: txt2 } },
                y: { ticks: { color: txt2, font: { size: 9 } } }
              }
            }
          });
        }
      }, 100);
    }

    // ── COLLAPSE TOGGLE ────────────────────────────────────────────
    function chiefsToggleCollapse(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('collapsed');
      // Persist state
      var collapsed = new Set(JSON.parse(localStorage.getItem('kc_collapsed') || '[]'));
      if (el.classList.contains('collapsed')) {
        collapsed.add(id);
      } else {
        collapsed.delete(id);
      }
      localStorage.setItem('kc_collapsed', JSON.stringify(Array.from(collapsed)));
      // If expanding gantt, re-render
      if (id === 'chiefs-gantt-section' && !el.classList.contains('collapsed')) {
        setTimeout(function(){ renderChiefsGantt('chiefs-gantt-body'); }, 350);
      }
    }

    function chiefsInitCollapse() {
      // Restore collapsed state from localStorage
      var collapsed = new Set(JSON.parse(localStorage.getItem('kc_collapsed') || '[]'));
      document.querySelectorAll('.chiefs-collapsible').forEach(function(el) {
        if (collapsed.has(el.id)) el.classList.add('collapsed');
      });
    }

    // ── CHIEFS GANTT ──────────────────────────────────────────────
    function renderChiefsGantt(cid) {
      var container = document.getElementById(cid);
      if (!container) return;

      // Parse helper (available as parseDate in standalone, define locally for safety)
      function parseDate(str) {
        if (!str) return null;
        var d = new Date(str);
        if (!isNaN(d.getTime())) return d;
        // Try MM/DD/YYYY
        var m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) return new Date(parseInt(m[3]), parseInt(m[1])-1, parseInt(m[2]));
        // Try Mon DD, YYYY or Mon DD YYYY
        m = str.match(/^(\w+)\s+(\d{1,2}),?\s*(\d{4})$/);
        if (m) {
          var months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
          var mon = months[m[1].toLowerCase().substring(0,3)];
          if (mon !== undefined) return new Date(parseInt(m[3]), mon, parseInt(m[2]));
        }
        return null;
      }

      function fmtDate(d) {
        return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
      }

      // Collect items
      var phases = [];
      var milestones = [];
      var sched09 = _chiefsData['09'] || [];
      var sheet02 = _chiefsData['02'] || [];

      // Phases from Sheet 09 where Type === 'Phase'
      sched09.forEach(function(r) {
        if (String(r.Type || '').trim() !== 'Phase') return;
        var st = parseDate(r.Start);
        var fn = parseDate(r.Finish);
        if (!st || !fn) return;
        phases.push({ label: r.Activity || 'Phase', start: st, finish: fn, owner: r.Owner || '' });
      });

      // Milestones from Sheet 02
      sheet02.forEach(function(r) {
        var dt = parseDate(r['Target Date'] || r.Target);
        if (!dt) return;
        milestones.push({ label: r.Milestone || 'Milestone', date: dt, status: r.Status || '' });
      });

      if (!phases.length && !milestones.length) {
        container.innerHTML = '<div class="chiefs-empty">No schedule data to chart</div>';
        return;
      }

      // Determine date range
      var allDates = [];
      phases.forEach(function(p) { allDates.push(p.start, p.finish); });
      milestones.forEach(function(m) { allDates.push(m.date); });
      allDates.sort(function(a,b){ return a - b; });
      var minDate = allDates[0];
      var maxDate = allDates[allDates.length - 1];

      // Pad range by 30 days
      var pad = 30 * 86400000;
      var startRange = new Date(minDate.getTime() - pad);
      var endRange = new Date(maxDate.getTime() + pad);
      var totalMs = endRange.getTime() - startRange.getTime();

      // Chart dimensions
      var chartW = 900;
      var rowH = 28;
      var headerH = 50;
      var labelW = 180;
      var barPadL = labelW;
      var barAreaW = chartW - barPadL - 20;
      var totalH = headerH + (phases.length + milestones.length) * rowH + 30;

      function xPos(d) {
        var pct = (d.getTime() - startRange.getTime()) / totalMs;
        return barPadL + pct * barAreaW;
      }

      function barWidth(d1, d2) {
        var p1 = xPos(d1);
        var p2 = xPos(d2);
        return Math.max(p2 - p1, 4);
      }

      // Quarter headers
      function getQuarterLabel(d) {
        var q = Math.floor(d.getMonth() / 3) + 1;
        return 'Q' + q + ' ' + d.getFullYear();
      }

      function buildQuarters() {
        var quarters = [];
        var cur = new Date(startRange);
        cur.setDate(1);
        cur.setMonth(Math.floor(cur.getMonth() / 3) * 3);
        while (cur < endRange) {
          var qStart = new Date(cur);
          var qEnd = new Date(cur);
          qEnd.setMonth(qEnd.getMonth() + 3);
          quarters.push({ label: getQuarterLabel(qStart), start: qStart, end: qEnd });
          cur.setMonth(cur.getMonth() + 3);
        }
        return quarters;
      }

      var quarters = buildQuarters();

      // $ SPENT line position from Sheet 06 Percent Spent KPI
      var spentPct = 0;
      var kpi06 = _chiefsData['06'] || [];
      kpi06.forEach(function(r) {
        if (r.KPI === 'Percent Spent' && r.Value) {
          spentPct = parseFloat(String(r.Value).replace(/%/g,''));
          if (isNaN(spentPct)) spentPct = 0;
        }
      });

      var spentX = barPadL + (spentPct / 100) * barAreaW;

      // Build SVG
      var svg = '<svg width="100%" viewBox="0 0 ' + chartW + ' ' + totalH + '" style="background:transparent;font-family:inherit;overflow:visible">';

      // Defs
      svg += '<defs>'
        + '<linearGradient id="gantt-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,0,0,0.02)"/><stop offset="100%" stop-color="rgba(0,0,0,0.04)"/></linearGradient>'
        + '<filter id="gantt-shadow"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.15"/></filter>'
        + '</defs>';

      // Background
      svg += '<rect x="0" y="0" width="' + chartW + '" height="' + totalH + '" fill="url(#gantt-bg)" rx="6"/>';

      // Quarter grid lines and labels
      quarters.forEach(function(q) {
        var x1 = xPos(q.start);
        var x2 = xPos(q.end);
        svg += '<line x1="' + x1 + '" y1="0" x2="' + x1 + '" y2="' + totalH + '" stroke="rgba(138,138,163,0.1)" stroke-width="1"/>';
        svg += '<text x="' + (x1 + (x2 - x1) / 2) + '" y="' + (headerH - 18) + '" text-anchor="middle" font-size="10" fill="#8A8AA3" font-weight="600">' + q.label + '</text>';
      });

      // Quarter header background
      svg += '<rect x="' + barPadL + '" y="0" width="' + barAreaW + '" height="' + headerH + '" fill="rgba(0,0,0,0.03)" rx="4"/>';

      // Monthly tick lines
      var curMonth = new Date(startRange);
      curMonth.setDate(1);
      while (curMonth < endRange) {
        var mx = xPos(curMonth);
        svg += '<line x1="' + mx + '" y1="' + headerH + '" x2="' + mx + '" y2="' + totalH + '" stroke="rgba(138,138,163,0.06)" stroke-width="1" stroke-dasharray="3,3"/>';
        svg += '<text x="' + mx + '" y="' + (headerH - 4) + '" text-anchor="middle" font-size="8" fill="#8A8AA3">' + curMonth.toLocaleDateString('en-US',{month:'short'}) + '</text>';
        curMonth.setMonth(curMonth.getMonth() + 1);
      }

      // $ SPENT vertical line
      var spentColor = '#E31837';
      svg += '<line x1="' + spentX + '" y1="0" x2="' + spentX + '" y2="' + totalH + '" stroke="' + spentColor + '" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.6"/>';
      svg += '<rect x="' + (spentX - 30) + '" y="2" width="60" height="16" rx="3" fill="' + spentColor + '" opacity="0.85"/>';
      svg += '<text x="' + spentX + '" y="14" text-anchor="middle" font-size="9" fill="#fff" font-weight="700">$ SPENT</text>';

      // Today line
      var today = new Date();
      if (today >= startRange && today <= endRange) {
        var tx = xPos(today);
        svg += '<line x1="' + tx + '" y1="' + headerH + '" x2="' + tx + '" y2="' + totalH + '" stroke="#184655" stroke-width="1" stroke-dasharray="4,2" opacity="0.4"/>';
        svg += '<text x="' + tx + '" y="' + (headerH - 4) + '" text-anchor="middle" font-size="8" fill="#184655">Today</text>';
      }

      // Render phases
      var curY = headerH;
      phases.sort(function(a,b){ return a.start - b.start || a.finish - b.finish; });
      phases.forEach(function(p, idx) {
        var y = curY + 4;
        var h = rowH - 8;
        var x = xPos(p.start);
        var w = barWidth(p.start, p.finish);
        var rowBg = idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent';

        // Row background
        svg += '<rect x="0" y="' + curY + '" width="' + chartW + '" height="' + rowH + '" fill="' + rowBg + '"/>';

        // Label
        var label = p.label.length > 25 ? p.label.substring(0,24) + '...' : p.label;
        svg += '<text x="8" y="' + (curY + rowH / 2 + 4) + '" font-size="11" fill="#181818" font-weight="600" dominant-baseline="middle">' + label + '</text>';

        // Bar
        svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="#1A1A1A" filter="url(#gantt-shadow)" opacity="0.85"/>';

        // Tooltip
        var tooltip = fmtDate(p.start) + ' → ' + fmtDate(p.finish);
        svg += '<title>' + tooltip + '</title>';

        curY += rowH;
      });

      // Render milestones
      milestones.sort(function(a,b){ return a.date - b.date; });
      milestones.forEach(function(m, idx) {
        var y = curY + 4;
        var rowBg = idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent';

        // Row background
        svg += '<rect x="0" y="' + curY + '" width="' + chartW + '" height="' + rowH + '" fill="' + rowBg + '"/>';

        // Label
        var label = m.label.length > 25 ? m.label.substring(0,24) + '...' : m.label;
        svg += '<text x="8" y="' + (curY + rowH / 2 + 4) + '" font-size="11" fill="#181818" dominant-baseline="middle">' + label + '</text>';

        // Diamond marker (gold, rotated square)
        var cx = xPos(m.date);
        var cy = y + (rowH - 8) / 2;
        var sz = 7;
        var pts = (cx) + ',' + (cy - sz) + ' '
          + (cx + sz) + ',' + (cy) + ' '
          + (cx) + ',' + (cy + sz) + ' '
          + (cx - sz) + ',' + (cy);
        svg += '<polygon points="' + pts + '" fill="#FFB81C" stroke="#D4941A" stroke-width="1" filter="url(#gantt-shadow)"/>';

        // Tooltip
        svg += '<title>' + m.label + ' — ' + fmtDate(m.date) + (m.status ? ' [' + m.status + ']' : '') + '</title>';

        curY += rowH;
      });

      // Legend
      var legendY = totalH - 22;
      svg += '<rect x="' + (barPadL) + '" y="' + legendY + '" width="12" height="6" rx="2" fill="#1A1A1A" opacity="0.85"/>';
      svg += '<text x="' + (barPadL + 16) + '" y="' + (legendY + 6) + '" font-size="9" fill="#8A8AA3">Phase</text>';
      svg += '<polygon points="' + (barPadL + 70) + ',' + (legendY + 2) + ' ' + (barPadL + 76) + ',' + (legendY + 7) + ' ' + (barPadL + 70) + ',' + (legendY + 12) + ' ' + (barPadL + 64) + ',' + (legendY + 7) + '" fill="#FFB81C" stroke="#D4941A" stroke-width="0.5"/>';
      svg += '<text x="' + (barPadL + 82) + '" y="' + (legendY + 6) + '" font-size="9" fill="#8A8AA3">Milestone</text>';
      svg += '<line x1="' + (barPadL + 145) + '" y1="' + (legendY + 3) + '" x2="' + (barPadL + 160) + '" y2="' + (legendY + 3) + '" stroke="#E31837" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.6"/>';
      svg += '<text x="' + (barPadL + 166) + '" y="' + (legendY + 6) + '" font-size="9" fill="#8A8AA3">$ SPENT</text>';

      svg += '</svg>';

      container.innerHTML = svg;
    }
function renderChiefsCharts() {
      if (typeof Chart === 'undefined') return;
      var root = document.documentElement;
      var cs = getComputedStyle(root);
      var txt = cs.getPropertyValue('--charcoal').trim() || '#181818';
      var border = cs.getPropertyValue('--border').trim() || '#E2E2DE';
      var teal = cs.getPropertyValue('--teal').trim() || '#184655';
      var red = '#E31837', gold = '#FFB81C', slate = '#8A8AA3';
      Chart.defaults.color = txt;
      Chart.defaults.borderColor = 'rgba(138,138,163,0.15)';
      var grid = 'rgba(138,138,163,0.15)';

      // Budget bar (sheet 01) — now handled by buildChiefsDashboard setTimeout (doughnut)
            /* var bd = _chiefsData['01'];
            if (bd && bd.length && document.getElementById('chiefs-chart-budget')) {
              var lb = [], am = [];
              bd.forEach(function(r) { lb.push(r.Category || ''); am.push(r['Planned Amount'] ? Math.round(r['Planned Amount'] / 1000000) : 0); });
              new Chart(document.getElementById('chiefs-chart-budget'), {
                type: 'bar',
                data: { labels: lb, datasets: [{ label: 'Planned ($M)', data: am, backgroundColor: teal, borderRadius: 3 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: txt, maxRotation: 45, font: { size: 10 } } }, y: { ticks: { color: txt } } } }
              });
            } */

      // Cash flow (sheet 05)
      var cd = _chiefsData['05'];
      if (cd && cd.length > 1 && document.getElementById('chiefs-chart-cashflow')) {
        var ql = [], pl = [], ac = [];
        cd.forEach(function(r) { ql.push(r.Quarter || ''); pl.push(r['Planned Cumulative'] || 0); ac.push(r['Actual Cumulative'] != null ? r['Actual Cumulative'] : null); });
        new Chart(document.getElementById('chiefs-chart-cashflow'), {
          type: 'line',
          data: { labels: ql, datasets: [
            { label: 'Planned', data: pl, borderColor: slate, borderDash: [5,5], fill: false, pointRadius: 0, tension: 0.3 },
            { label: 'Actual', data: ac, borderColor: teal, backgroundColor: teal + '18', fill: '-1', pointRadius: 3, tension: 0.3, spanGaps: false }
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: txt, boxWidth: 12 } } }, scales: { x: { ticks: { color: txt, font: { size: 9 } } }, y: { ticks: { color: txt } } } }
        });
      }

      // Budget position (sheet 12)
      if (_chiefsData['12'] && document.getElementById('chiefs-chart-budgetpos')) {
        var bpd = _chiefsData['12'];
        var f = function(l) { for (var i=0; i<bpd.length; i++) { if (bpd[i].Measure && bpd[i].Measure.indexOf(l) >= 0) return Math.round((bpd[i].Amount||0)/1000000); } return 0; };
        new Chart(document.getElementById('chiefs-chart-budgetpos'), {
          type: 'bar',
          data: { labels: ['Budget Position'], datasets: [
            { label: 'Paid', data: [f('Paid')], backgroundColor: teal, borderRadius: 2 },
            { label: 'Retainage', data: [f('Retainage')], backgroundColor: gold, borderRadius: 2 },
            { label: 'Remaining', data: [f('Remaining')], backgroundColor: border, borderRadius: 2 }
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: txt, boxWidth: 12 } } }, scales: { x: { display: false }, y: { stacked: true, ticks: { color: txt } } }, indexAxis: 'y' }
        });
      }
    }

    function chiefsRenderBPMetrics() {
      var el = document.getElementById('chiefs-bp-metrics');
      if (!el) return;
      var bpd = _chiefsData['12'] || [];
      var fv = function(l) { for (var i=0; i<bpd.length; i++) { if (bpd[i].Measure && bpd[i].Measure.indexOf(l) >= 0) return chiefsFmtCurrency(bpd[i].Amount); } return '-'; };
      el.innerHTML = '<div class="chiefs-bp-metric"><div class="chiefs-kpi-label">PAID TO DATE</div><div class="chiefs-kpi-val">' + fv('Paid') + '</div></div>'
        + '<div class="chiefs-bp-metric"><div class="chiefs-kpi-label">RETAINAGE HELD</div><div class="chiefs-kpi-val gold">' + fv('Retainage') + '</div></div>'
        + '<div class="chiefs-bp-metric"><div class="chiefs-kpi-label">REMAINING</div><div class="chiefs-kpi-val">' + fv('Remaining') + '</div></div>';
    }

    // ── Refresh ───────────────────────────────────────────────

    function chiefsStartRefresh() {
      chiefsStopRefresh();
      _chiefsRefreshTimer = setInterval(function() {
        if (document.visibilityState === 'visible') chiefsRefreshAll();
      }, 600000);
      document.addEventListener('visibilitychange', function chiefsVisHandler() {
        if (document.visibilityState === 'visible' && Date.now() - _chiefsLastRefresh > 600000) chiefsRefreshAll();
      });
    }

    function chiefsStopRefresh() {
      if (_chiefsRefreshTimer) { clearInterval(_chiefsRefreshTimer); _chiefsRefreshTimer = null; }
    }

    function chiefsManualRefresh() {
      var btn = document.querySelector('.chiefs-refresh-btn');
      if (btn) btn.disabled = true;
      chiefsRefreshAll().then(function() { if (btn) btn.disabled = false; });
    }

    function chiefsRefreshAll() {
      var sheets = ['01','02','03','04','05','06','07','08','09','10','11','12','13'];
      return Promise.allSettled(sheets.map(function(s) { return chiefsFetchSheet(s); })).then(function() {
        _chiefsLastRefresh = Date.now();
        var el = document.getElementById('chiefs-dashboard');
        if (el) buildChiefsDashboard(el);
      });
    }

    // ── Theme change observer ─────────────────────────────────

    (function() {
      var ticking = false;
      var observer = new MutationObserver(function() {
        if (!ticking) { ticking = true;
          setTimeout(function() { ticking = false; renderChiefsCharts(); }, 200); }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
          })();

          function renderDovaDashboard() { window.location.href = '/api/dova-dashboard'; }

                              // ── LEVEL UP PLAYBOOK ─ APP.JS ──────────────────────────────────────

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
var CONTRACT_KB = window.__CONTRACT_KB || [];  // Contract knowledge from data/contracts_kb.js
var TEMPLATES = window.__TEMPLATES || {};
var GLOSSARY = window.__GLOSSARY || {};
var ALL_TOPICS = [];

// Merge contract KB into searchable KB
var FULL_KB = [];
function buildFullKB() {
  FULL_KB = KB.concat(CONTRACT_KB);
}

// Synchronous KB init — runs immediately since data is preloaded
var kbLoaded = false;
function initKB() {
  if (kbLoaded || !KB.length) return;
  buildFullKB();
  var set = {};
  KB.forEach(function(s) { (s.topics || []).forEach(function(t) { set[t] = true; }); });
  CONTRACT_KB.forEach(function(s) { (s.topics || []).forEach(function(t) { set[t] = true; }); });
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
  document.cookie = 'lu_auth=; Path=/; Max-Age=0';
  window.location.href = '/auth/logout';
}

// ── THEME ─────────────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.setAttribute('data-btn-theme', t === 'dark' ? '☽' : '☀');
  var btn = document.getElementById('theme-btn');
  if (btn) { btn.textContent = t === 'dark' ? '☽' : '☀'; btn.style.opacity = '1'; }
  // Theme-switch LUCI logos
    var lockup = document.querySelector('.luna-hero-lockup');
    if (lockup) lockup.src = lockup.getAttribute('data-' + t);
    var topbarLogo = document.querySelector('.topbar-logo');
    if (topbarLogo) topbarLogo.src = topbarLogo.getAttribute('data-' + t);
    var pwLogo = document.querySelector('.password-modal-logo img');
    if (pwLogo) pwLogo.src = pwLogo.getAttribute('data-' + t);
    var clippy = document.getElementById('luna-clippy-icon');
    if (clippy) clippy.src = clippy.getAttribute('data-' + t);
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

  // Nav tab highlight
    var navMap = { playbook:'nav-playbook', projects:'nav-projects', actions:'nav-actions', mfp:'nav-projects', 'mfp-dashboard':'nav-projects', chiefs:'nav-projects', luna:'nav-luna' };
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
            else if (view === 'mfp') renderMFP();
            else if (view === 'mfp-dashboard') renderMFPDashboard();
            else if (view === 'chiefs') renderChiefsDashboard();
            else if (view === 'dova') renderDovaDashboard();
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
  grid.innerHTML = '<div class="mfp-card chiefs-card" onclick="setView(\'mfp-dashboard\')" style="cursor:pointer">'
      + '<div class="mfp-card-head">'
      + '<span class="mfp-icon" style="font-size:18px">🏟</span>'
      + '<span class="mfp-card-title">Miami Freedom Park Stadium</span>'
      + '<span class="mfp-badge" style="background:#E31837;color:#fff">Active</span>'
      + '</div>'
      + '<div class="mfp-card-summary">Post-opening closeout. Home opener April 4, 2026. Cost recovery audit, punch list disputes with Lemartec, ARQ payment hold, HVAC service agreement.</div>'
      + '<div class="mfp-card-bullets chiefs-stats" id="mfp-card-stats">'
      + 'Total commitments: ' + stadiumRevised + '<br>'
      + 'Paid: ' + stadiumPaid + ', Balance: ' + stadiumBal + '<br>'
      + 'Hard cost budget: ' + stadiumBudget + '<br>'
      + 'Cost recovery target: $9M+<br>'
      + 'Audit final delivery: June 30, 2026'
      + '</div>'
      + '</div>'
    + '<div class="mfp-card chiefs-card" onclick="setView(\'dova\')" style="cursor:pointer">'
          + '<div class="mfp-card-head">'
          + '<span class="mfp-icon" style="font-size:18px">🏗</span>'
          + '<span class="mfp-card-title">DOVA Arena (Sacramento)</span>'
          + '<span class="mfp-badge" style="background:#1B3A5C;color:#fff">Active</span>'
          + '</div>'
          + '<div class="mfp-card-summary">Multi-purpose arena in Rancho Cordova, CA. 8,032 seats, ~200K SF. SD phase in progress. Construction target Apr 2027.</div>'
          + '<div class="mfp-card-bullets dova-stats">'
          + 'Budget: $275.9M (May Estimate)<br>'
          + 'Site: 2875 Kilgore Rd, 28 acres<br>'
          + 'Design: Perkins&Will | CM/GC: McCarthy<br>'
          + '</div>'
          + '</div>'
        + '<div class="mfp-card chiefs-card" onclick="alert(\'KC Chiefs Training Facility — Active pursuit. Proposal phase.\')" style="opacity:.6;cursor:pointer">'
        + '<div class="mfp-card-head">'
        + '<span class="mfp-icon chiefs-icon">▲</span>'
        + '<span class="mfp-card-title">Kansas City Chiefs — Training Facility</span>'
        + '<span class="mfp-badge" style="background:#FFB81C;color:#0f0f1a">Active Pursuit</span>'
        + '</div>'
        + '<div class="mfp-card-summary">Training Facility, Olathe KS. $265M budget, CMAR/GMP, Q4 2030. Turner & Townsend + Level Up.</div>'
        + '<div class="mfp-card-bullets chiefs-stats" id="chiefs-card-stats">'
        + 'Budget: $265M<br>'
        + 'Substantial Completion: Q4 2030<br>'
        + '<span class="chiefs-dot-green"></span> Schedule: On Track'
        + '</div>'
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
    + '<div style="margin-top:24px"><button class="btn-primary" onclick="toggleChat()">Ask LUCI about MFP →</button></div>';
    // Export modal function globally so card onclick handlers work
        window.openMFPModal = showMFPDetail;
            }

            // ── MFP COMMAND CENTER ────────────────────────────────────────
        function renderMFPDashboard() {
          var el = document.getElementById('mfp-dashboard');
          if (!el) return;
          var F = window.__MFP_FINANCIALS || {};
          var H = F.hard || {};
          var S = F.summary || {};
          var soft = F.soft || {};
          var ctx = window.__MFP_CONTEXT || '';
          var totalRev = H.total_revised ? Math.abs(H.total_revised).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '505M';
          var totalPaid = H.total_paid ? Math.abs(H.total_paid).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '400M';
          var totalBal = H.total_balance ? Math.abs(H.total_balance).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,') : '105M';
          var pctPaid = H.total_pct_paid ? H.total_pct_paid.toFixed(1) : '79.1';
          var baseBudget = S.stadium_base_contract || S.total_budget || 824000000;
          var budgetStr = '$' + Math.abs(baseBudget).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,');

          // Format helper for numbers
          var fm = function(n) { if (n == null) return '$0'; return '$' + Math.abs(n).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,'); };

          // Top subs by balance
          var topSubs = [];
          if (H.commitments) {
            var sorted = H.commitments.slice().sort(function(a,b) { return b.balance - a.balance; });
            topSubs = sorted.slice(0, 8);
          }

          // Soft cost totals
          var softTotal = soft.design_total || 28451538;
          var ffeTotal = soft.ffe_budget || 15767602;
          var freightTotal = soft.freight || 16112254;
          var customsTotal = soft.customs_duties || 13989138;
          var contTotal = soft.contingency || 15500000;
          var allSoft = softTotal + ffeTotal + freightTotal + customsTotal + contTotal;

          var html = '<div class="mfp-live-badge">Live \u00b7 Financials as of Jun 8</div>';
          // Row 1: Header + SC anchor
          html += '<div class="mfp-row">';
          html += '<div class="mfp-header-band"><div class="mfp-header-title">MIAMI FREEDOM PARK STADIUM</div><div class="mfp-header-sub">Command Center \u00b7 Level Up Project Development \u00b7 Miami, FL</div><div class="mfp-header-desc">Post-opening closeout. Home opener April 4, 2026. Active workstreams: punch list, cost recovery audit, Lemartec contract closeout.</div></div>';
          html += '<div class="mfp-anchor"><div class="mfp-anchor-label">HOME OPENER</div><div class="mfp-anchor-value">Apr 4, 2026</div></div></div>';

          // Row 2: KPI strip
          html += '<div class="mfp-row mfp-kpi-row">';
          var kpis = [
            ['Total Budget', 'TOTAL BUDGET', '', budgetStr],
            ['Hard Cost Revised', 'HARD COSTS', '', '$' + (Math.abs(H.total_revised || 505000000) / 1000000).toFixed(0) + 'M'],
            ['Paid to Date', 'PAID TO DATE', '', '$' + (Math.abs(H.total_paid || 400000000) / 1000000).toFixed(0) + 'M'],
            ['Percent Paid', 'PAID %', 'gold', pctPaid + '%'],
            ['Outstanding Balance', 'BALANCE', '', '$' + (Math.abs(H.total_balance || 105000000) / 1000000).toFixed(0) + 'M'],
            ['Soft Costs Total', 'SOFT COSTS', '', '$' + Math.round(allSoft / 1000000) + 'M'],
            ['Pending COs', 'PENDING COs', '', '$' + (Math.abs(H.total_pending_cos || 4.8) / 1000000).toFixed(1) + 'M'],
            ['Project Status', 'STATUS', 'green', 'Post-Opening / Closeout']
          ];
          kpis.forEach(function(kp) {
            html += '<div class="mfp-kpi"><div class="mfp-kpi-label">' + kp[1] + '</div><div class="mfp-kpi-val ' + kp[2] + '">' + kp[3] + '</div></div>';
          });
          html += '</div>';

          // Row 3: Scorecard + Hard Cost Budget chart
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Project Health Scorecard</div><div class="mfp-scorecard">';
          var scoreItems = [
            ['Budget', 'GREEN'],
            ['Schedule', 'GREEN'],
            ['Punch List', 'YELLOW'],
            ['Cost Recovery', 'GREEN'],
            ['Safety', 'GREEN'],
            ['Closeout', 'YELLOW']
          ];
          scoreItems.forEach(function(si) {
            var c = si[1] === 'GREEN' ? 'green' : si[1] === 'YELLOW' ? 'yellow' : 'red';
            html += '<div class="mfp-score-item"><span class="mfp-dot mfp-dot-' + c + '"></span><span class="mfp-score-cat">' + si[0] + '</span></div>';
          });
          html += '</div></div>';
          // Budget bar chart
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Hard Cost Budget ($M)</div><div class="mfp-chart-wrap"><canvas id="mfp-chart-budget"></canvas></div></div>';
          html += '</div>';

          // Row 4: Active workstreams + Cost recovery
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Active Workstreams</div>';
          html += '<div class="mfp-workstreams">';
          var ws = [
            { label: 'Punch List Closeout', status: 'Active', detail: 'Tile deficiency, conduit dispute with Lemartec. Correction, not credit.' },
            { label: 'Cost Recovery Audit', status: 'Active', detail: 'Target $9M+. Final delivery June 30, 2026.' },
            { label: 'Day 2 Items', status: 'Active', detail: '60+ owner-directed items. 10 tracked in closeout.' },
            { label: 'HVAC Service Agreement', status: 'In Progress', detail: 'Negotiating terms with Lemartec sub.' },
            { label: 'ARQ Payment Hold', status: 'Active', detail: 'Outstanding AOR invoices under review.' },
            { label: 'Commissioning Completion', status: 'Completed', detail: 'All systems verified.' }
          ];
          ws.forEach(function(w) {
            var sc = w.status === 'Active' ? ' chiefs-pill-gold' : w.status === 'Completed' ? ' chiefs-pill-green' : ' chiefs-pill-gray';
            html += '<div class="mfp-ws-item"><div class="mfp-ws-label">' + w.label + '</div><div><span class="chiefs-pill' + sc + '">' + w.status + '</span></div><div class="mfp-ws-detail">' + w.detail + '</div></div>';
          });
          html += '</div></div>';
          // Cost recovery gauge
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Cost Recovery Progress</div><div class="mfp-chart-wrap"><canvas id="mfp-chart-recovery"></canvas></div><div class="mfp-bp-metrics"><div class="mfp-bp-metric"><div class="mfp-kpi-label">TARGET</div><div class="mfp-kpi-val">$9M</div></div><div class="mfp-bp-metric"><div class="mfp-kpi-label">IDENTIFIED</div><div class="mfp-kpi-val chiefs-pill-gold" style="padding:2px 10px;border-radius:10px">$6.2M</div></div><div class="mfp-bp-metric"><div class="mfp-kpi-label">RECOVERED</div><div class="mfp-kpi-val" style="color:var(--teal)">$4.1M</div></div></div></div></div>';

          // Row 5: Soft Costs Breakdown
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Soft Costs Breakdown <span style="font-weight:400;color:var(--muted)">Total: ' + fm(allSoft) + '</span></div><table class="chiefs-table"><thead><tr><th>Category</th><th>Amount</th><th>% of Soft</th></tr></thead><tbody>';
          var softItems = [
            ['Design Team Fees', softTotal, softTotal/allSoft],
            ['FF&E Budget', ffeTotal, ffeTotal/allSoft],
            ['Freight', freightTotal, freightTotal/allSoft],
            ['Customs Duties / Tariffs', customsTotal, customsTotal/allSoft],
            ['Contingency', contTotal, contTotal/allSoft]
          ];
          softItems.forEach(function(si) {
            var amt = '$' + Math.round(si[1] / 1000000) + 'M';
            var pct = (si[2] * 100).toFixed(0) + '%';
            html += '<tr><td class="chiefs-cell-primary">' + si[0] + '</td><td>' + amt + '</td><td>' + pct + '</td></tr>';
          });
          html += '</tbody></table></div>';
          // Design Team (top firms)
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Design Team <span style="font-weight:400;color:var(--muted)">Top firms by fee</span></div><table class="chiefs-table"><thead><tr><th>Firm</th><th>Scope</th><th>Fee</th></tr></thead><tbody>';
          if (soft.design_team) {
            soft.design_team.slice(0, 10).forEach(function(dt) {
              html += '<tr><td class="chiefs-cell-primary">' + dt.firm + '</td><td>' + dt.scope + '</td><td>' + fm(dt.fee) + '</td></tr>';
            });
          }
          html += '</tbody></table></div></div>';

          // Row 6: Top Subcontractors + FF&E Categories
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Top Subcontractors by Outstanding Balance</div><table class="chiefs-table"><thead><tr><th>Subcontractor</th><th>Trade</th><th>Revised</th><th>Balance</th><th>% Paid</th></tr></thead><tbody>';
          topSubs.forEach(function(c) {
            var balCls = c.pct_paid < 70 ? ' chiefs-pill-red' : c.pct_paid < 85 ? ' chiefs-pill-gold' : ' chiefs-pill-green';
            html += '<tr><td class="chiefs-cell-primary">' + c.company.split(',')[0] + '</td><td>' + c.title + '</td><td>' + fm(c.revised) + '</td><td>' + fm(c.balance) + '</td><td><span class="chiefs-pill' + balCls + '">' + c.pct_paid.toFixed(0) + '%</span></td></tr>';
          });
          html += '</tbody></table></div>';
          // FF&E breakdown
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">FF&E by Category <span style="font-weight:400;color:var(--muted)">Total: ' + fm(ffeTotal) + '</span></div><table class="chiefs-table"><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>';
          if (soft.ffe_breakdown) {
            soft.ffe_breakdown.forEach(function(ffe) {
              html += '<tr><td class="chiefs-cell-primary">' + ffe.category + '</td><td>' + fm(ffe.amount) + '</td></tr>';
            });
          }
          html += '</tbody></table></div></div>';

          // Row 7: Key contracts + Stakeholders
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Key Contracts</div><table class="chiefs-table"><thead><tr><th>Contract</th><th>Firm</th><th>Value</th><th>Status</th></tr></thead><tbody>';
          var contracts = [
            ['GC/CM', 'Lemartec', '$530M', 'Closeout'],
            ['Architect', 'ARQ', '—', 'Hold'],
            ['Structural', 'Walter P Moore', '—', 'Active'],
            ['MEP', 'B & I Contractors', '—', 'Active'],
            ['Scoreboard', 'Daktronics', '—', 'Complete'],
            ['Security', 'Boldyn', '—', 'Active']
          ];
          contracts.forEach(function(c) {
            var scls = c[3] === 'Complete' ? ' chiefs-pill-green' : c[3] === 'Hold' ? ' chiefs-pill-red' : c[3] === 'Closeout' ? ' chiefs-pill-gold' : ' chiefs-pill-gray';
            html += '<tr><td class="chiefs-cell-primary">' + c[0] + '</td><td>' + c[1] + '</td><td>' + c[2] + '</td><td><span class="chiefs-pill' + scls + '">' + c[3] + '</span></td></tr>';
          });
          html += '</tbody></table></div>';
          // Stakeholders
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Key Stakeholders</div><table class="chiefs-table"><thead><tr><th>Role</th><th>Name</th><th>Firm</th></tr></thead><tbody>';
          var stakeholders = [
            ['Owner (Day-to-Day)', 'Graham Oxley', 'MFP'],
            ['Owner (Approver)', 'Devon McCorkle', 'MFP'],
            ['Owner (Approver)', 'Victor Oliver', 'MFP'],
            ['Owner\'s Rep', 'Whitney Williams', 'Level Up'],
            ['Owner\'s Rep', 'Greg Wieting', 'Level Up'],
            ['Field Director', 'Jordan Ward', 'Level Up'],
            ['GC/CM', 'Jon Smith (PE)', 'Lemartec']
          ];
          stakeholders.forEach(function(sh) {
            html += '<tr><td class="chiefs-cell-primary">' + sh[0] + '</td><td>' + sh[1] + '</td><td>' + sh[2] + '</td></tr>';
          });
          html += '</tbody></table></div></div>';

          // Row 8: Key dates + Invoice status
          html += '<div class="mfp-row">';
          html += '<div class="mfp-widget mfp-w3"><div class="mfp-widget-title">Key Dates</div><table class="chiefs-table"><thead><tr><th>Milestone</th><th>Date</th><th>Status</th></tr></thead><tbody>';
          var dates = [
            ['Home Opener', 'Apr 4, 2026', 'Complete'],
            ['Cost Recovery Final', 'Jun 30, 2026', 'On Track'],
            ['Punch List Complete', 'Aug 2026', 'In Progress'],
            ['Final Lien Waivers', 'Sep 2026', 'In Progress'],
            ['Contract Closeout', 'Dec 2026', 'Not Started']
          ];
          dates.forEach(function(d) {
            var dcls = d[2] === 'Complete' ? ' chiefs-pill-green' : d[2] === 'On Track' ? ' chiefs-pill-green' : d[2] === 'In Progress' ? ' chiefs-pill-gold' : ' chiefs-pill-gray';
            html += '<tr><td class="chiefs-cell-primary">' + d[0] + '</td><td>' + d[1] + '</td><td><span class="chiefs-pill' + dcls + '">' + d[2] + '</span></td></tr>';
          });
          html += '</tbody></table></div>';
          // Invoice summary
          html += '<div class="mfp-widget mfp-w2"><div class="mfp-widget-title">Invoice Summary</div><div class="mfp-bp-metrics">';
          html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">HARD COST ORIGINAL</div><div class="mfp-kpi-val">$485M</div></div>';
          html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">APPROVED COs</div><div class="mfp-kpi-val" style="color:var(--teal)">$20.7M</div></div>';
          html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">INVOICED TO DATE</div><div class="mfp-kpi-val">$459M</div></div>';
          html += '<div class="mfp-bp-metric"><div class="mfp-kpi-label">PENDING COs</div><div class="mfp-kpi-val chiefs-pill-gold" style="padding:2px 6px;border-radius:6px">$4.8M</div></div>';
          html += '</div></div></div>';

          el.innerHTML = html;
          renderMFPCharts();
        }

        function renderMFPCharts() {
          if (typeof Chart === 'undefined') return;
          var teal = '#184655', gold = '#e6a817', slate = '#8A8AA3', txt = 'var(--charcoal)', grid = 'rgba(138,138,163,0.15)';
          Chart.defaults.color = txt; Chart.defaults.borderColor = grid;
          var F = window.__MFP_FINANCIALS || {};
          var H = F.hard || {};
          var S = F.summary || {};

          // Budget bar
          if (document.getElementById('mfp-chart-budget')) {
            var cats = ['Original', 'COs', 'Revised', 'Invoiced', 'Paid', 'Balance'];
            var vals = [
              Math.round((H.total_original || 485000000) / 1000000),
              Math.round((H.total_approved_cos || 20700000) / 1000000),
              Math.round((H.total_revised || 505000000) / 1000000),
              Math.round((H.total_invoiced || 459000000) / 1000000),
              Math.round((H.total_paid || 400000000) / 1000000),
              Math.round((H.total_balance || 105000000) / 1000000)
            ];
            new Chart(document.getElementById('mfp-chart-budget'), {
              type: 'bar',
              data: { labels: cats, datasets: [{ label: 'Amount ($M)', data: vals, backgroundColor: [teal, gold, teal, slate, '#1D9E75', '#E31837'], borderRadius: 3 }] },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: txt, maxRotation: 45, font: { size: 10 } } }, y: { ticks: { color: txt } } } }
            });
          }

          // Cost recovery gauge
          if (document.getElementById('mfp-chart-recovery')) {
            new Chart(document.getElementById('mfp-chart-recovery'), {
              type: 'doughnut',
              data: {
                labels: ['Recovered', 'Identified', 'Remaining'],
                datasets: [{ data: [4.1, 2.1, 2.8], backgroundColor: [teal, gold, slate], borderWidth: 0 }]
              },
              options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                  legend: { position: 'bottom', labels: { color: txt, boxWidth: 12, padding: 8 } }
                }
              }
            });
          }
        }

            // ── KC CHIEFS DASHBOARD ────────────────────────────────────────
    var _chiefsData = {};
    var _chiefsTimers = [];

    function renderChiefsDashboard() {
      var el = document.getElementById('chiefs-dashboard');
      if (!el) return;
      el.innerHTML = '<div class="chiefs-skeleton"><div class="chiefs-loader"></div>Loading Command Center...</div>';
      var keys = ['01','02','03','04','05','06','07','08','09','10','11','12','13'];
      var fetches = keys.map(function(k) {
        return fetch('/api/chiefs?sheet=' + k).then(function(r){if(!r.ok)throw new Error(k+':'+r.status);return r.json();}).then(function(d){_chiefsData[k]=d;}).catch(function(e){_chiefsData[k]={error:true,message:e.message,rows:[],columns:[]};});
      });
      Promise.all(fetches).then(function(){buildDashboard(el);startChiefsRefresh();});
    }

    function buildDashboard(el) {
      var d = _chiefsData;
      var html = '<div class="chiefs-live-badge" id="chiefs-live-badge">Live \u00b7 Updated just now</div>';
      // Row 1: Header + SC anchor
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-header-band"><div class="chiefs-header-title">KC CHIEFS TRAINING FACILITY</div><div class="chiefs-header-sub">Project Command Center \u00b7 Turner & Townsend + Level Up \u00b7 Olathe, Kansas</div><div class="chiefs-header-desc">A single source of truth that keeps priorities visible, decisions organized, and Chiefs leadership informed.</div></div>';
      var scVal='Q4 2030'; if(d['06']&&d['06'].rows)d['06'].rows.forEach(function(r){if(r.KPI&&r.KPI.indexOf('Substantial')>=0)scVal=r.Value||scVal;});
      html += '<div class="chiefs-anchor"><div class="chiefs-anchor-label">SUBSTANTIAL COMPLETION</div><div class="chiefs-anchor-value">'+scVal+'</div></div></div>';
  
      // Row 2: KPI strip
      html += '<div class="chiefs-row chiefs-kpi-row">';
      [['Total Budget','TOTAL BUDGET',''],['Committed','COMMITTED',''],['Billed to Date','BILLED TO DATE',''],['Percent Spent','PERCENT SPENT','gold'],['Contingency Remaining','CONTINGENCY',''],['Schedule Status','SCHEDULE','green']].forEach(function(kp){
        var v='';if(d['06']&&d['06'].rows)d['06'].rows.forEach(function(r){if(r.KPI&&r.KPI.indexOf(kp[0])>=0)v=r.Value||'';});
        html += '<div class="chiefs-kpi"><div class="chiefs-kpi-label">'+kp[1]+'</div><div class="chiefs-kpi-val '+kp[2]+'">'+v+'</div></div>';
      });
      html += '</div>';
  
      // Row 3: Scorecard + charts
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Project Health Scorecard <a class="chiefs-source-link" href="'+(d['13']?d['13'].permalink:'#')+'" target="_blank" title="View source">&#x1F517;</a></div><div class="chiefs-scorecard">';
      if(d['13']&&d['13'].rows)d['13'].rows.forEach(function(r){var st=r.Status||'GREEN',c=st==='GREEN'?'green':st==='YELLOW'?'yellow':'red';html+='<div class="chiefs-score-item"><span class="chiefs-dot chiefs-dot-'+c+'"></span><span class="chiefs-score-cat">'+(r.Category||'')+'</span></div>';});
      html += '</div></div>';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Budget by Category ($M) <a class="chiefs-source-link" href="'+(d['01']?d['01'].permalink:'#')+'" target="_blank" title="View source">&#x1F517;</a></div><div class="chiefs-chart-wrap"><canvas id="chiefs-chart-budget"></canvas></div></div>';
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Cash Flow Curve (Cumulative $M) <a class="chiefs-source-link" href="'+(d['05']?d['05'].permalink:'#')+'" target="_blank" title="View source">&#x1F517;</a></div><div class="chiefs-chart-wrap"><canvas id="chiefs-chart-cashflow"></canvas></div></div></div>';
  
      // Row 4: Schedule + Action Items
      html += '<div class="chiefs-row">'+buildTable('02','Milestone Schedule',['Milestone','Target Date','Variance','Status'])+buildTable('03','Action Items',['Item','Owner','Due Date','Priority'])+'</div>';
  
      // Row 5: Procurement + Decisions
      html += '<div class="chiefs-row">'+buildTable('07','Procurement & Long-Lead Buyout',['Package','Budget Value','Need-By','Status']);
      html += '<div class="chiefs-widget chiefs-w2"><div class="chiefs-widget-title">Upcoming Key Decisions <a class="chiefs-source-link" href="'+(d['08']?d['08'].permalink:'#')+'" target="_blank" title="View source">&#x1F517;</a></div>'+buildTableInner('08',['Decision','Needed By','Status'])+'</div></div>';
  
      // Row 6: Look-ahead + Risk
      html += '<div class="chiefs-row">'+buildTable('09','Next 90 Days',['Activity','Start','Finish','Owner'])+buildTable('10','Top Risks & Mitigation',['Risk','Rating','Trend','Mitigation'])+'</div>';
  
      // Row 7: Budget position + Team + Camera
      html += '<div class="chiefs-row">';
      html += '<div class="chiefs-widget chiefs-w3"><div class="chiefs-widget-title">Budget Position <a class="chiefs-source-link" href="'+(d['12']?d['12'].permalink:'#')+'" target="_blank" title="View source">&#x1F517;</a></div><div class="chiefs-chart-wrap"><canvas id="chiefs-chart-budgetpos"></canvas></div><div class="chiefs-bp-metrics">';
      var bv=function(l){if(!d['12']||!d['12'].rows)return'';for(var i=0;i<d['12'].rows.length;i++){if(d['12'].rows[i].Measure&&d['12'].rows[i].Measure.indexOf(l)>=0)return'$'+Math.round(d['12'].rows[i].Amount/1000000)+'M';}return'';};
      html += '<div class="chiefs-bp-metric"><div class="chiefs-kpi-label">PAID TO DATE</div><div class="chiefs-kpi-val">'+bv('Paid')+'</div></div><div class="chiefs-bp-metric"><div class="chiefs-kpi-label">RETAINAGE HELD</div><div class="chiefs-kpi-val">'+bv('Retainage')+'</div></div><div class="chiefs-bp-metric"><div class="chiefs-kpi-label">REMAINING</div><div class="chiefs-kpi-val">'+bv('Remaining')+'</div></div>';
      html += '</div></div>'+buildTable('11','Project Team',['Name','Role','Firm']);
      html += '<div class="chiefs-widget chiefs-w1"><div class="chiefs-widget-title">Live Jobsite Camera</div><div class="chiefs-camera-ph"><div class="chiefs-camera-icon">&#x1F4F7;</div><div>Camera 1 \u00b7 South View</div><div class="chiefs-camera-sub">Activates at groundbreaking</div></div></div></div>';
  
      // Row 8: Snapshot + Doc shortcuts
      html += '<div class="chiefs-row">'+buildTable('04','Project Snapshot',['Metric','Value','Notes']);
      html += '<div class="chiefs-widget chiefs-w3"><div class="chiefs-widget-title">Document Shortcuts</div><div class="chiefs-doc-links">';
      [['Executive Schedule','02'],['Budget Tracker','01'],['Procurement Log','07'],['OAC Minutes',''],['Monthly Reports',''],['Drawings',''],['Pay Apps',''],['Renderings',''],['Site Photos','']].forEach(function(dl){
        var url=dl[1]&&d[dl[1]]?d[dl[1]].permalink:'#';html+='<a class="chiefs-doc-link" href="'+url+'" target="_blank">'+dl[0]+'</a>';
      });
      html += '</div></div></div>';
  
      el.innerHTML = html;
      renderCharts();
    }

    function buildTable(sk,title,cols){
      var d=_chiefsData[sk],pl=d&&d.permalink?d.permalink:'#';
      return '<div class="chiefs-widget chiefs-w3"><div class="chiefs-widget-title">'+title+' <a class="chiefs-source-link" href="'+pl+'" target="_blank" title="View source">&#x1F517;</a></div>'+buildTableInner(sk,cols)+'</div>';
    }

    function buildTableInner(sk,cols){
      var d=_chiefsData[sk];if(!d||!d.rows||!d.rows.length)return'<div class="chiefs-empty">No data</div>';
      var h='<table class="chiefs-table"><thead><tr>';cols.forEach(function(c){h+='<th>'+c+'</th>';});h+='</tr></thead><tbody>';
      d.rows.forEach(function(row){
        h+='<tr>';
        cols.forEach(function(c,i){
          var v=row[c]!==undefined&&row[c]!==null?row[c]:'',cls='';
          if(c==='Status'||c==='Priority'||c==='Rating'){
            var sv=String(v).toLowerCase();
            if(sv==='complete'||sv==='awarded'||sv==='on track'||sv==='healthy')cls=' chiefs-pill-green';
            else if(sv==='in progress'||sv==='planning'||sv==='watch'||sv==='medium')cls=' chiefs-pill-gold';
            else if(sv==='high'||sv==='at risk'||sv==='long lead - track')cls=' chiefs-pill-red';
            else if(sv==='not started'||sv==='')cls=' chiefs-pill-gray';
            else if(sv==='green')cls=' chiefs-pill-green';else if(sv==='yellow')cls=' chiefs-pill-gold';else if(sv==='red')cls=' chiefs-pill-red';
          }
          if(i===0)h+='<td class="chiefs-cell-primary">'+v+'</td>';
          else if(cls)h+='<td><span class="chiefs-pill'+cls+'">'+v+'</span></td>';
          else h+='<td>'+v+'</td>';
        });
        h+='</tr>';
      });
      return h+'</tbody></table>';
    }

    function renderCharts(){
      if(typeof Chart==='undefined')return;
      var red='#E31837',gold='#FFB81C',slate='#8A8AA3',txt='#D0D0E0',grid='rgba(138,138,163,0.15)';
      Chart.defaults.color=txt;Chart.defaults.borderColor=grid;
      // Budget bar
      var bd=_chiefsData['01'];
      if(bd&&bd.rows&&document.getElementById('chiefs-chart-budget')){
        var lb=[],am=[];bd.rows.forEach(function(r){lb.push(r.Category||'');var a=r['Planned Amount'];am.push(a?Math.round(a/1000000):0);});
        new Chart(document.getElementById('chiefs-chart-budget'),{type:'bar',data:{labels:lb,datasets:[{label:'Planned ($M)',data:am,backgroundColor:red,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:txt,maxRotation:45,font:{size:10}}},y:{ticks:{color:txt}}}}});
      }
      // Cash flow line
      var cd=_chiefsData['05'];
      if(cd&&cd.rows&&document.getElementById('chiefs-chart-cashflow')){
        var ql=[],pl=[],ac=[];cd.rows.forEach(function(r){ql.push(r.Quarter||'');pl.push(r['Planned Cumulative']||0);var a=r['Actual Cumulative'];ac.push(a!==null&&a!==undefined?a:null);});
        new Chart(document.getElementById('chiefs-chart-cashflow'),{type:'line',data:{labels:ql,datasets:[{label:'Planned',data:pl,borderColor:gold,backgroundColor:gold+'20',borderDash:[5,5],fill:false,pointRadius:0,tension:0.3},{label:'Actual',data:ac,borderColor:red,backgroundColor:red+'20',fill:false,pointRadius:3,tension:0.3,spanGaps:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:txt,boxWidth:12,padding:8}}},scales:{x:{ticks:{color:txt,font:{size:9},maxRotation:60}},y:{ticks:{color:txt}}}}});
      }
      // Budget position stacked bar
      var bpd=_chiefsData['12'];
      if(bpd&&bpd.rows&&document.getElementById('chiefs-chart-budgetpos')){
        var fa=function(l){for(var i=0;i<bpd.rows.length;i++){if(bpd.rows[i].Measure&&bpd.rows[i].Measure.indexOf(l)>=0)return Math.round((bpd.rows[i].Amount||0)/1000000);}return 0;};
        new Chart(document.getElementById('chiefs-chart-budgetpos'),{type:'bar',data:{labels:['Budget Position'],datasets:[{label:'Paid',data:[fa('Paid')],backgroundColor:red,borderRadius:2},{label:'Retainage',data:[fa('Retainage')],backgroundColor:gold,borderRadius:2},{label:'Remaining',data:[fa('Remaining')],backgroundColor:slate,borderRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:txt,boxWidth:12}}},scales:{x:{display:false},y:{stacked:true,ticks:{color:txt}}},indexAxis:'y'}});
      }
    }

    function startChiefsRefresh(){
      _chiefsTimers.forEach(function(t){clearTimeout(t);});_chiefsTimers=[];
      var tick=function(){
        _chiefsTimers.push(setTimeout(function(){
          var keys=['01','02','03','04','05','06','07','08','09','10','11','12','13'];
          Promise.all(keys.map(function(k){return fetch('/api/chiefs?sheet='+k).then(function(r){if(!r.ok)return null;return r.json();}).then(function(d){if(d&&!d.error){_chiefsData[k]=d;}}).catch(function(){});})).then(function(){
            var badge=document.getElementById('chiefs-live-badge');
            if(badge){
              var now=new Date(),t=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
              badge.innerHTML='Live \u00b7 Updated '+t;badge.classList.add('chiefs-pulse');
              setTimeout(function(){badge.classList.remove('chiefs-pulse');},1000);
            }
            tick();
          });
        },60000));
      };
      tick();
          }

          function renderDovaDashboard() { window.location.href = '/api/dova-dashboard'; }

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

// ── LUCI RESPONSE FORMATTER ───────────────────────────────────
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
      // Also refresh panel if it's open
      if (reminderPanelOpen) renderReminderActions();
    }

  function removeAction(i) {
    var tab = window.aiTab || 'team';
    var items = loadActions(tab);
    items.splice(i, 1);
    saveActions(items, tab);
    renderActions();
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

// ── SUMMON LUNA (Help button fly-in) ──────────────────────────────
function summonLuna() {
  var clippy = document.getElementById('luna-clippy');
  var btn = document.getElementById('help-btn');
  if (!clippy) return;
  // If already visible, just open the chat
  if (clippy.style.display !== 'none' && clippy.style.display !== '') {
    clippyClick();
    return;
  }
  // Remove any existing animation class
  clippy.classList.remove('luna-fly-in');
  // Show it but off-screen right
  clippy.style.display = 'block';
  // Force reflow, then trigger fly-in
  void clippy.offsetWidth;
  clippy.classList.add('luna-fly-in');
  // Hide the help button after summoning
  if (btn) btn.style.display = 'none';
}

function dismissLuna() {
  clippyTab();
}

// ── LUNA CLIPPY ────────────────────────────────────────────────────
var clippyState = 'full'; // 'full' | 'tab' | 'chat_open'
var clippySuggestions = [
  "Need to review a change order?",
  "Ask me about the project budget.",
  "Looking for a subcontractor?",
  "Check the latest MFP status.",
  "Need a template for a meeting?",
  "Ask me about punch list closeout."
];
var clippySuggestionTimer = null;

function clippyClick() {
  // If clippy is in tab mode, expand first
  if (clippyState === 'tab') {
    clippyExpand(); return;
  }
  // If the user just dragged the icon, don't open chat
  if (window.__clippyDragDist && window.__clippyDragDist() > 8) {
    return;
  }
  // Hide any suggestion
  hideClippySuggestion();
  // Position chat drawer near clippy before opening
  var clippy = document.getElementById('luna-clippy');
  var drawer = document.getElementById('chat-drawer');
  if (clippy && drawer && clippy.classList.contains('dragged')) {
    var cr = clippy.getBoundingClientRect();
    // Open the drawer above and slightly left of the icon
    drawer.style.left = Math.max(16, cr.left - 200) + 'px';
    drawer.style.top = Math.max(16, cr.top - 450) + 'px';
    drawer.style.right = 'auto';
    drawer.style.bottom = 'auto';
  }
  // Open chat
  toggleChat();
}

function clippyExpand() {
  clippyState = 'full';
  var clippy = document.getElementById('luna-clippy');
  var tab = document.getElementById('clippy-tab-standalone');
  if (clippy) { clippy.style.display = 'block'; clippy.classList.remove('tab-mode'); }
  if (tab) tab.style.display = 'none';
  // Reset suggestion timer
  scheduleClippySuggestion();
}

function clippyTab() {
  clippyState = 'tab';
  var clippy = document.getElementById('luna-clippy');
  var btn = document.getElementById('help-btn');
  if (clippy) { clippy.style.display = 'none'; }
  if (btn) btn.style.display = 'flex';
  hideClippySuggestion();
}

function showClippySuggestion(text) {
  var bubble = document.getElementById('clippy-suggestion');
  var txt = document.getElementById('clippy-suggestion-text');
  if (!bubble || !txt) return;
  txt.textContent = text || clippySuggestions[Math.floor(Math.random() * clippySuggestions.length)];
  bubble.style.display = 'block';
  // Auto hide after 8 seconds
  clearTimeout(clippySuggestionTimer);
  clippySuggestionTimer = setTimeout(hideClippySuggestion, 8000);
}

function hideClippySuggestion() {
  var bubble = document.getElementById('clippy-suggestion');
  if (bubble) bubble.style.display = 'none';
  clearTimeout(clippySuggestionTimer);
}

function scheduleClippySuggestion() {
  clearTimeout(clippySuggestionTimer);
  // Show a suggestion after 30s of inactivity (only if clippy is visible and chat isn't open)
  clippySuggestionTimer = setTimeout(function() {
    if (clippyState === 'full' && !chatOpen) {
      showClippySuggestion();
    }
  }, 30000);
}

// Initialize clippy on page load
(function() {
  // Start suggestion timer after page load
  setTimeout(scheduleClippySuggestion, 5000);
  // Allow right-click / long-press to dismiss clippy to tab
  var clippy = document.getElementById('luna-clippy');
  if (clippy) {
    clippy.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      clippyTab();
    });
  }
  // ── Draggable Clippy ──────────────────────────────────────────
    (function makeDraggable() {
      var el = document.getElementById('luna-clippy');
      if (!el) return;
      var startX, startY, origX, origY, dragging = false, dragDist = 0;
      function onStart(e) {
        if (e.button !== 0) return; // left-click only
        dragging = true;
        dragDist = 0;
        var pos = getComputedStyle(el);
        origX = parseInt(pos.left) || 0;
        origY = parseInt(pos.top) || 0;
        var pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        el.style.cursor = 'grabbing';
        el.style.transition = 'none';
        el.style.animation = 'none';
        document.body.style.userSelect = 'none';
      }
      function onMove(e) {
        if (!dragging) return;
        e.preventDefault();
        var pt = e.touches ? e.touches[0] : e;
        var dx = pt.clientX - startX;
        var dy = pt.clientY - startY;
        dragDist = Math.max(dragDist, Math.abs(dx), Math.abs(dy));
        el.style.left = (origX + dx) + 'px';
        el.style.top = (origY + dy) + 'px';
        if (!el.classList.contains('dragged')) {
          el.classList.add('dragged');
          var rect = el.getBoundingClientRect();
          el.style.left = rect.left + 'px';
          el.style.top = rect.top + 'px';
          el.style.bottom = 'auto';
          el.style.right = 'auto';
        }
      }
      function onEnd() {
        if (!dragging) return;
        dragging = false;
        el.style.cursor = 'grab';
        el.style.transition = '';
        el.style.animation = '';
        document.body.style.userSelect = '';
      }
      el.addEventListener('mousedown', onStart);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      el.addEventListener('touchstart', function(e) { onStart(e); }, {passive:true});
      document.addEventListener('touchmove', onMove, {passive:false});
      document.addEventListener('touchend', onEnd);
      el.style.cursor = 'grab';
      // Expose dragDist so clippyClick can check it
      window.__clippyDragDist = function() { return dragDist; };
    })();
})();

// ── CHAT ───────────────────────────────────────────────────────────
function toggleChat() {
  chatOpen = !chatOpen;
  var d = document.getElementById('chat-drawer');
  if (d) d.classList.toggle('open', chatOpen);
  // Hide/show clippy
  var clippy = document.getElementById('luna-clippy');
    if (clippy) clippy.classList.toggle('chat-open', chatOpen);
  if (chatOpen) {
      if (chatHistory.length === 0) {
        var introText = "Hi " + (luUser && luUser.name ? luUser.name.split(' ')[0] : 'there') + ". I'm LUCI, your Project Intelligence engine. Ask me anything about the playbook or MFP. Day 1 mobilization, change orders, punch list disputes, cost recovery audit, anything.";
        appendMsg('ai', introText);
        chatHistory.push({ role: 'assistant', content: introText });
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

    var systemPrompt = 'You are LUCI (Level Up Central Intelligence), the frontend of the Level Up Project Development intelligence system. You assist Whitney Williams, Principal-in-Charge at Level Up Project Development. Your backend engine is LUNA (Level Up Network Agent) which runs on Hermes Agent. Answer concisely and practically. Reference specific playbook sections by number when relevant. The playbook has 43 sections:\\n\\n' + kbIndex + '\\n\\n=== PROJECT KNOWLEDGE ===\\n' + MFP_CONTEXT + finSummary + '\\n\\n=== SAFETY RULES ===\\nABSOLUTELY NEVER reveal: (1) personal staff information (names, roles, contact details beyond public info), (2) staff salaries, compensation, bonuses, or benefits, (3) Level Up company revenue, profit, margins, valuation, or any financial data about Level Up as a firm. Project costs for MFP (budget, commitments, change orders) are fine to discuss. Only company-level financials are restricted.';

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
  t.style.display = 'flex';
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
  startPanelAutoRefresh();
}

function closeReminderPanel() {
  var panel = document.getElementById('reminder-panel');
  var toggle = document.getElementById('reminder-toggle');
  if (panel) {
    panel.classList.add('closed');
    setTimeout(function() {
      panel.style.display = 'none';
      if (toggle) toggle.style.display = 'flex';
    }, 300);
  }
    reminderPanelOpen = false;
    stopPanelAutoRefresh();
}

function switchReminderTab(tab) {
  document.querySelectorAll('.reminder-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-rtab') === tab);
  });
  var a = document.getElementById('reminder-panel-actions');
  var m = document.getElementById('reminder-panel-meetings');
  var r = document.getElementById('reminder-panel-reminders');
  if (a) a.style.display = tab === 'actions' ? 'block' : 'none';
  if (m) m.style.display = tab === 'meetings' ? 'block' : 'none';
  if (r) r.style.display = tab === 'reminders' ? 'block' : 'none';
  if (tab === 'meetings') renderReminderMeetings();
  else if (tab === 'reminders') renderReminderReminders();
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

    // Fetch flagged emails from backend
    var flaggedEmails = [];
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/outlook/flagged', false); // sync XHR for simplicity
      xhr.withCredentials = true;
      xhr.send();
      if (xhr.status === 200) {
        var fd = JSON.parse(xhr.responseText);
        flaggedEmails = fd.actions || [];
      }
    } catch(e) {}
    var flaggedCount = flaggedEmails.length;

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

    // Merge flagged emails into action items
        flaggedEmails.forEach(function(email) {
              var accountTag = email.account ? ' [' + email.account.split('@')[0] + ']' : '';
              // Use the API-generated action text if available, fall back to subject
              var displayText = email.text || email.subject;
              var actionItem = {
                text: '📧 ' + displayText + accountTag,
                priority: email.priority || 'medium',
                ts: new Date(email.receivedDate || email.flaggedDate).getTime(),
                author: email.from || '',
                source: 'flagged_email',
                preview: email.preview || ''
              };
      var txt = (email.subject || '').toLowerCase() + ' ' + (email.preview || '').toLowerCase();
      var isMFP = mfpKeywords.some(function(kw) { return txt.indexOf(kw) >= 0; });
      (isMFP ? mfpItems : levelUpItems).push({
        item: actionItem, idx: -1, tab: 'flagged', source: 'flagged'
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

    // Instruction note + refresh button
        html += '<div style="font-size:11px;color:var(--muted);padding:6px 2px 8px;border-bottom:1px solid var(--border);margin-bottom:6px;display:flex;align-items:center;gap:6px">'
          + '<span style="font-size:16px">🔄</span>'
          + '<span style="flex:1">Click the <strong>circle</strong> on each item to cycle: Open → In Progress → Complete</span>'
          + '<button onclick="refreshPanelActions()" style="background:none;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:11px;padding:3px 8px;color:var(--muted);font-family:inherit" title="Refresh from server">↻ Refresh</button>'
          + '</div>';

      // --- MFP SECTION ---
  if (mfpItems.length > 0) {
    html += '<div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px">🔴 MFP / Team (' + mfpItems.length + ')</div>';
    mfpItems.slice(0, 25).forEach(function(entry) {
      var item = entry.item;
      var st = getItemStatus(item);
      var statusIcon = st === 'completed' ? '✓' : st === 'in_progress' ? '◐' : '○';
      var priColor = item.priority === 'urgent' ? '#c0392b' : item.priority === 'high' ? '#e67e22' : '#95a5a6';
      var date = item.ts ? new Date(item.ts).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
      html += '<div class="rp-item status-' + st + '">'
        + '<button class="rp-status-btn ' + st + '" onclick="panelToggleAction(\'' + entry.tab + '\',' + entry.idx + ')" title="Click to cycle status">' + statusIcon + '</button>'
        + '<div class="rp-item-text" style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:2px">'
        + '<span style="background:' + priColor + ';color:#fff;font-size:9px;font-weight:700;padding:0 6px;border-radius:8px;text-transform:uppercase">' + (item.priority || 'medium') + '</span>'
        + '<span style="font-size:9px;color:' + (st === 'in_progress' ? '#e67e22' : st === 'completed' ? '#27ae60' : 'var(--muted)') + ';font-weight:600">' + st.replace('_',' ') + '</span>'
        + (item.dueDate ? '<span style="font-size:10px;color:' + (new Date(item.dueDate+'T12:00:00') < new Date() ? '#c0392b' : 'var(--muted)') + '">' + item.dueDate + '</span>' : '')
        + '</div>'
        + '<div style="font-size:13px;color:var(--charcoal);line-height:1.4">' + (st === 'completed' ? '<s style="opacity:.6">' : '') + escapeHtml(item.text) + (st === 'completed' ? '</s>' : '') + '</div>'
                + (item.preview && entry.source === 'flagged' ? '<div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(item.preview.substring(0, 120)) + '</div>' : '')
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
      var st = getItemStatus(item);
      var statusIcon = st === 'completed' ? '✓' : st === 'in_progress' ? '◐' : '○';
      var priColor = item.priority === 'urgent' ? '#c0392b' : item.priority === 'high' ? '#e67e22' : '#95a5a6';
      var date = item.ts ? new Date(item.ts).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
      html += '<div class="rp-item status-' + st + '">'
        + '<button class="rp-status-btn ' + st + '" onclick="panelToggleAction(\'' + entry.tab + '\',' + entry.idx + ')" title="Click to cycle status">' + statusIcon + '</button>'
        + '<div class="rp-item-text" style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:2px">'
        + '<span style="background:' + priColor + ';color:#fff;font-size:9px;font-weight:700;padding:0 6px;border-radius:8px;text-transform:uppercase">' + (item.priority || 'medium') + '</span>'
        + '<span style="font-size:9px;color:' + (st === 'in_progress' ? '#e67e22' : st === 'completed' ? '#27ae60' : 'var(--muted)') + ';font-weight:600">' + st.replace('_',' ') + '</span>'
        + (item.dueDate ? '<span style="font-size:10px;color:' + (new Date(item.dueDate+'T12:00:00') < new Date() ? '#c0392b' : 'var(--muted)') + '">' + item.dueDate + '</span>' : '')
        + '</div>'
        + '<div style="font-size:13px;color:var(--charcoal);line-height:1.4">' + (st === 'completed' ? '<s style="opacity:.6">' : '') + escapeHtml(item.text) + (st === 'completed' ? '</s>' : '') + '</div>'
                + (item.preview && entry.source === 'flagged' ? '<div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(item.preview.substring(0, 120)) + '</div>' : '')
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

  // Refresh panel actions from server
  function refreshPanelActions() {
    var el = document.getElementById('reminder-panel-actions');
    if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">⏳ Refreshing...</div>';
    // Clear flagged email cache by running the fetch again
    renderReminderActions();
  }

  // Auto-refresh panel every 30 seconds while open
  var panelRefreshTimer = null;
  function startPanelAutoRefresh() {
    stopPanelAutoRefresh();
    panelRefreshTimer = setInterval(function() {
      if (reminderPanelOpen) {
        renderReminderActions();
      }
    }, 30000);
  }
  function stopPanelAutoRefresh() {
    if (panelRefreshTimer) {
      clearInterval(panelRefreshTimer);
      panelRefreshTimer = null;
    }
  }

  // Panel click handler
function panelToggleAction(tab, idx) {
  var items = [];
  try { items = JSON.parse(localStorage.getItem('lu_actions_' + tab) || '[]'); } catch(e) {}
  if (items[idx]) {
    var st = getItemStatus(items[idx]);
    items[idx].status = st === 'completed' ? 'open' : st === 'in_progress' ? 'completed' : 'in_progress';
    items[idx].done = items[idx].status === 'completed';
    try { localStorage.setItem('lu_actions_' + tab, JSON.stringify(items)); } catch(e) {}
  }
  renderReminderActions();
  }

function renderReminderMeetings() {
  var el = document.getElementById('reminder-panel-meetings');
  if (!el) return;
  if (!luUser || !luUser.authenticated) {
    el.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">🔒</div>Sign in to see your calendar.</div>';
    return;
  }

  el.innerHTML = '<div class="reminder-loader">Loading meetings...</div>';

    var fetchUrl = '/api/outlook/calendar?days=7';
    // Also try the client's native calendar fetch via the browser
    fetch(fetchUrl, { credentials: 'include' })
      .then(function(r) {
        if (!r.ok) { return r.text().then(function(t) { throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 200)); }); }
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
      // --- TODAY'S MEETINGS ---
      todayEvents.sort(function(a,b) {
        return new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date);
      });

      var html = '';
      // Separate MFP vs Level Up meetings  
      var mfpKeywords = ['miami','freedom','park','mfp','stadium','lemartec','closeout','punch','cost recovery','arq','commissioning','owner meeting'];
      var mfpToday = [];
      var levelUpToday = [];
      todayEvents.forEach(function(e) {
        var txt = ((e.subject||'') + ' ' + (e._calendarName||'')).toLowerCase();
        var isMFP = mfpKeywords.some(function(kw) { return txt.indexOf(kw) >= 0; });
        (isMFP ? mfpToday : levelUpToday).push(e);
      });

      // Today's MFP meetings
      if (mfpToday.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px;display:flex;align-items:center;gap:6px"><span>🏟</span> MFP Today <span style="background:#c0392b;color:#fff;font-size:9px;padding:1px 7px;border-radius:8px">' + mfpToday.length + '</span></div>';
        mfpToday.forEach(function(e) {
          var start = new Date(e.start.dateTime || e.start.date);
          var end = new Date(e.end.dateTime || e.end.date);
          var timeStr = start.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + '-' + end.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
          var isNow = now >= start && now <= end;
          var calName = e._calendarName;
          html += '<div class="rp-meeting" style="' + (isNow ? 'border-left-color:#e74c3c;background:#fce8e8' : '') + '"><span class="rp-meeting-time">' + timeStr + '</span><div class="rp-meeting-detail"><div class="rp-meeting-subject">' + escapeHtml(e.subject || '(No title)') + '</div>'
            + (calName ? '<div style="font-size:10px;color:#c0392b;font-weight:500;margin-top:1px">📁 ' + escapeHtml(calName) + '</div>' : '')
            + (e.location && e.location.displayName ? '<div class="rp-meeting-loc"> ' + escapeHtml(e.location.displayName) + '</div>' : '')
            + (isNow ? '<div style="font-size:11px;color:#c0392b;font-weight:600;margin-top:2px">● In progress</div>' : '') + '</div></div>';
        });
      }

      // Today's Level Up meetings
      if (levelUpToday.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.04em;padding:4px 0 6px;margin-top:' + (mfpToday.length > 0 ? '6px' : '0') + ';display:flex;align-items:center;gap:6px"><span>📅</span> Level Up Today <span style="background:var(--teal);color:#fff;font-size:9px;padding:1px 7px;border-radius:8px">' + levelUpToday.length + '</span></div>';
        levelUpToday.forEach(function(e) {
          var start = new Date(e.start.dateTime || e.start.date);
          var end = new Date(e.end.dateTime || e.end.date);
          var timeStr = start.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + '-' + end.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
          var isNow = now >= start && now <= end;
          html += '<div class="rp-meeting" style="' + (isNow ? 'border-left-color:#e74c3c;background:#fce8e8' : '') + '"><span class="rp-meeting-time">' + timeStr + '</span><div class="rp-meeting-detail"><div class="rp-meeting-subject">' + escapeHtml(e.subject || '(No title)') + '</div>' + (e.location && e.location.displayName ? '<div class="rp-meeting-loc"> ' + escapeHtml(e.location.displayName) + '</div>' : '') + (isNow ? '<div style="font-size:11px;color:#c0392b;font-weight:600;margin-top:2px">● In progress</div>' : '') + '</div></div>';
        });
      }

      // --- UPCOMING THIS WEEK ---
      var upcomingThisWeek = events.filter(function(e) {
        var start = new Date(e.start.dateTime || e.start.date);
        var weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
        weekEnd.setHours(23, 59, 59, 0);
        // Skip today's events (already shown above)
        var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        return start > todayEnd && start <= weekEnd;
      }).slice(0, 10);

      if (upcomingThisWeek.length > 0) {
              if (html) html += '<div style="border-top:1px solid var(--border);margin:8px 0"></div>';
              html += '<div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.04em;padding:6px 0 6px">🔔 Later This Week (' + upcomingThisWeek.length + ')</div>';
              upcomingThisWeek.forEach(function(e) {
                var start = new Date(e.start.dateTime || e.start.date);
                var timeStr = start.toLocaleTimeString([], { weekday:'short', hour:'2-digit', minute:'2-digit' });
                var calName = e._calendarName;
                html += '<div class="rp-meeting" style="background:var(--teal-light);border-left-color:var(--teal);border-left-width:3px"><span class="rp-meeting-time" style="color:var(--teal);font-weight:600">🔔 ' + timeStr + '</span><div class="rp-meeting-detail"><div class="rp-meeting-subject">' + escapeHtml(e.subject || '(No title)') + '</div>'
                  + (calName ? '<div style="font-size:10px;color:var(--muted);font-weight:500;margin-top:1px">📁 ' + escapeHtml(calName) + '</div>' : '')
                  + (e.location && e.location.displayName ? '<div class="rp-meeting-loc"> ' + escapeHtml(e.location.displayName) + '</div>' : '') + '</div></div>';
              });
            }

      // Empty state
      if (!html) {
        html = '<div class="rp-empty"><div class="rp-empty-icon">📅</div>No meetings today or this week.</div>';
      }
      el.innerHTML = html;
    })
    .catch(function(err) {
          el.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">⚠️</div>' + escapeHtml(err.message || 'Could not load calendar.') + '</div>';
        });
        }

        // ── PANEL: REMINDERS TAB ──
        function renderReminderReminders() {
          var el = document.getElementById('reminder-panel-reminders');
          if (!el) return;
          var now = new Date();
          var day = now.getDate();
          var month = now.getMonth();
          var year = now.getFullYear();
          var dismissed = {};
          try { var d = localStorage.getItem('lu_remind_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}
          var reminders = [];
          var drawDue = new Date(year, month, 10);
          if (day > 10) drawDue.setMonth(month + 1);
          var drawDays = Math.round((drawDue - now) / 86400000);
          var drawId = 'draw_' + year + '-' + month;
          if (!dismissed[drawId]) reminders.push({ id: drawId, icon: '💰', title: 'Monthly Draw Package', desc: 'Due in ' + drawDays + ' day' + (drawDays !== 1 ? 's' : ''), urgent: drawDays <= 3, warn: drawDays <= 7 && drawDays > 3 });
          var expDue = new Date(year, month, 5);
          if (day > 5) expDue.setMonth(month + 1);
          var expDays = Math.round((expDue - now) / 86400000);
          var expId = 'expense_' + year + '-' + month;
          if (!dismissed[expId]) reminders.push({ id: expId, icon: '🧾', title: 'Monthly Expense Report', desc: 'Due in ' + expDays + ' day' + (expDays !== 1 ? 's' : ''), urgent: expDays <= 3, warn: expDays <= 7 && expDays > 3 });
          var friday = new Date(now);
          friday.setDate(now.getDate() + (5 - now.getDay() + 7) % 7);
          if (now.getDay() > 5) friday.setDate(friday.getDate() + 7);
          if (now.getDay() === 5 && now.getHours() >= 17) friday.setDate(friday.getDate() + 7);
          var calDays = Math.round((friday - now) / 86400000);
          var calId = 'cal_' + friday.getFullYear() + '_' + friday.getMonth() + '_' + friday.getDate();
          if (!dismissed[calId]) reminders.push({ id: calId, icon: '📅', title: 'Weekly Events Calendar', desc: calDays === 0 ? 'Due today' : 'Due in ' + calDays + ' day' + (calDays !== 1 ? 's' : ''), urgent: calDays <= 1, warn: calDays <= 2 && calDays > 1 });
          var html = '';
          reminders.forEach(function(r) {
            var bg = r.urgent ? '#fce8e8' : r.warn ? '#fef4e0' : 'var(--card)';
            var border = r.urgent ? '#e74c3c' : r.warn ? '#e67e22' : 'var(--border)';
            var txtColor = r.urgent ? '#c0392b' : r.warn ? '#a05c00' : 'var(--muted)';
            html += '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:8px;margin-bottom:6px">'
              + '<span style="font-size:18px">' + r.icon + '</span>'
              + '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--charcoal)">' + escapeHtml(r.title) + '</div>'
              + '<div style="font-size:12px;color:' + txtColor + '">' + escapeHtml(r.desc) + '</div></div>'
              + (r.urgent ? '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#e74c3c;background:rgba(231,76,60,.12);padding:3px 8px;border-radius:6px">Due Soon</span>' : '')
              + (r.warn ? '<span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#e67e22">Coming Up</span>' : '')
              + '<button onclick="dismissReminder(' + jsCallArg(r.id) + ')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:4px" title="Dismiss">&times;</button>'
              + '</div>';
          });
          if (!html) html = '<div class="rp-empty"><div class="rp-empty-icon">✅</div>No reminders.</div>';
          el.innerHTML = html;
          var footer = document.getElementById('reminder-panel-footer-text');
          if (footer) footer.textContent = reminders.length + ' reminder' + (reminders.length !== 1 ? 's' : '') + ' · Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
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
  var targets = ['whitney williams', 'justin williams', 'jordan ward', 'wwilliams', 'justin.williams', 'jordan.ward'];
  var targetShort = ['whitney', 'justin', 'jordan'];
  var mfpKW = [
    'mfp','freedom park','stadium','lemartec','punch','change order','cost recovery',
    'arq','miller','baker','hvac','scoreboard','commissioning','closeout','pco','invoice',
    'draw','pay app','retainage','tco','permitting','boldyn','das','seating','concession',
    'ff&e','punch list','deficiency','scope','contract','submittal','rfp','rfi',
    'schedule','delay','accelerat','owner','graham','devon','victor'
  ];

  // Action signal phrases — stronger signals mean higher likelihood this is a real action
  var actionSignals = [
    { words: ['please', 'can you', 'could you', 'need you to', 'action required', 'action item'], weight: 2 },
    { words: ['by end of', 'due by', 'deadline', 'asap', 'urgent', 'eod', 'eow'], weight: 2 },
    { words: ['review', 'approve', 'submit', 'provide', 'send', 'confirm', 'update', 'complete', 'finish'], weight: 1.5 },
    { words: ['assigned', 'ownership', 'task', 'to-do', 'todo', 'follow up', 'follow-up'], weight: 2 },
    { words: ['question', 'request', 'proposal', 'for review', 'needs your'], weight: 1 },
    { words: ['invoice', 'payment', 'pco', 'change order', 'draw', 'pay app'], weight: 1.5 },
    { words: ['meeting', 'call', 'agenda', 'schedule', 'calendar'], weight: 0.5 }
  ];

  function getDirectAssignment(combined, subject, from) {
    // Check if email body directly assigns to a target
    var assignments = [];
    targetShort.forEach(function(t, i) {
      var full = targets[i];
      // Direct assignment patterns: "Whitney - please", "Whitney: can you", "Justin, please", etc.
      var assignPatterns = [
        t + '\\s*[-:]\\s*please', t + '\\s*[-:]\\s*can you', t + '\\s*[-:]\\s*need',
        t + '\\s*[-:]\\s*review', t + '\\s*[-:]\\s*submit', t + '\\s*[-:]\\s*provide',
        'action.*' + t, t + '.*assigned', 'assigned to ' + t,
        t + '.*task', t + '.*to-do', t + '.*follow up'
      ];
      var matched = assignPatterns.some(function(p) {
        return new RegExp(p, 'i').test(combined);
      });
      if (matched) assignments.push(full);
    });
    // Also check if sent TO a specific person
    if (from && from.toLowerCase().indexOf('wwilliams@levelup') >= 0) {
      assignments.push('Whitney Williams');
    }
    return assignments;
  }

  function calculateActionScore(combined) {
    var score = 1.0; // baseline
    actionSignals.forEach(function(signal) {
      var matchCount = 0;
      signal.words.forEach(function(w) {
        if (combined.indexOf(w) >= 0) matchCount++;
      });
      if (matchCount > 0) score += signal.weight * matchCount;
    });
    return score;
  }

  var mfpItems = [];
  var luItems = [];
  var seenMFP = {};
  var seenLU = {};

  emails.forEach(function(email) {
    var subject = (email.subject || '').toLowerCase();
    var preview = (email.bodyPreview || '').toLowerCase();
    var from = (email.from && email.from.emailAddress) ? (email.from.emailAddress.name || email.from.emailAddress.address) : '';
    var combined = subject + ' ' + preview;

    // Check MFP relevance
    var isMFP = mfpKW.some(function(kw) { return combined.indexOf(kw) >= 0; });

    // Check if sent TO Whitney directly (primary recipient)
    var isDirectToMe = (email.toRecipients || []).some(function(r) {
      var addr = (r.emailAddress && r.emailAddress.address || '').toLowerCase();
      return addr.indexOf('wwilliams@levelup') >= 0 || addr.indexOf('whitney.williams') >= 0 || addr.indexOf('whitney@') >= 0;
    });

    // Check if Whitney is in TO or CC
    var isToOrCC = isDirectToMe || (email.ccRecipients || []).some(function(r) {
      var addr = (r.emailAddress && r.emailAddress.address || '').toLowerCase();
      return addr.indexOf('wwilliams@levelup') >= 0;
    });

    // Check if mentions target team members
    var mentionsTarget = targets.some(function(t) { return combined.indexOf(t) >= 0; });

    // Calculate action score
    var actionScore = calculateActionScore(combined);

    // Get direct assignments
    var assignments = getDirectAssignment(combined, subject, from);

    // DECISION: Is this a real action for the team?
    // Must have BOTH: (direct to me OR mentions target) AND (action score >= threshold)
    var isRealAction = false;
    var why = '';

    if (isDirectToMe && actionScore >= 2.0) {
      isRealAction = true;
      why = 'direct to me';
    } else if (assignments.length > 0) {
      isRealAction = true;
      why = 'assigned to: ' + assignments.join(', ');
    } else if (mentionsTarget && actionScore >= 2.5) {
      isRealAction = true;
      why = 'mentions team + action signals';
    } else if (isToOrCC && actionScore >= 3.0) {
      isRealAction = true;
      why = 'cc\'d with strong action signals';
    } else if (mentionsTarget && actionScore >= 1.5 && combined.indexOf('action') >= 0) {
      isRealAction = true;
      why = 'explicit action keyword';
    }

    if (!isRealAction) return;

    // Build a concise action text — prefer subject, but if subject is just "Re: X" use body snippet
    var actionText = email.subject || '';
    // If subject is too generic like "Re: meeting" or "Fwd: info", look for the action in the preview
    if (!actionText || actionText.length < 10 || /^(re:|fwd:)\s*(meeting|update|info|question|fyi|note)/i.test(actionText)) {
      // Try to extract action sentence from preview
      var sentences = preview.split(/[.!?]\s*/);
      var actionSentence = '';
      sentences.forEach(function(s) {
        var testS = s.toLowerCase();
        if (actionSignals.some(function(sig) { return sig.words.some(function(w) { return testS.indexOf(w) >= 0; }); })) {
          if (testS.length > 15 && testS.length < 200) {
            actionSentence = s;
          }
        }
      });
      if (actionSentence) {
        actionText = actionSentence.charAt(0).toUpperCase() + actionSentence.slice(1);
      } else {
        actionText = preview.slice(0, 140);
      }
    } else {
      actionText = actionText.replace(/^(re:|fwd:)\s*/i, '').trim();
    }

    if (actionText.length > 150) actionText = actionText.slice(0, 150) + '...';
    if (!actionText || actionText.length < 10) return;

    // Dedup by text
    var key = actionText.toLowerCase().slice(0, 50);
    var dedupMap = isMFP ? seenMFP : seenLU;
    if (dedupMap[key]) return;
    dedupMap[key] = true;

    // Priority based on signal strength
    var priority = 'medium';
    if (actionScore >= 4.0) priority = 'urgent';
    else if (actionScore >= 2.5) priority = 'high';

    // Determine who it's assigned to (prefer direct assignment detection)
    var assignedTo = assignments.length > 0 ? assignments[0] : '';
    if (!assignedTo) {
      if (combined.indexOf('jordan') >= 0) assignedTo = 'Jordan Ward';
      else if (combined.indexOf('justin') >= 0) assignedTo = 'Justin Williams';
      else if (combined.indexOf('whitney') >= 0) assignedTo = 'Whitney Williams';
    }

    var date = new Date(email.receivedDateTime);
    var actionItem = {
      id: 'email_' + email.receivedDateTime + '_' + Math.random().toString(36).slice(2,6),
      text: actionText + (assignments.length > 0 ? ' [' + assignments.join(', ') + ']' : ''),
      done: false,
      status: 'open',
      ts: date.getTime(),
      author: from || 'LUCI',
      priority: priority,
      category: isMFP ? 'meeting' : 'other',
      dueDate: null,
      assignedTo: assignedTo
    };

    if (isMFP) {
      mfpItems.push(actionItem);
    } else {
      luItems.push(actionItem);
    }
  });

  // Save MFP items to Team, non-MFP to Personal
  mergeEmailItems('team', mfpItems);
  mergeEmailItems('personal', luItems);

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
      // Async fallback: if cookie check failed, try /auth/me (reads HttpOnly lu_auth)
      if (!luUser || !luUser.authenticated) {
        tryRefresh();
      }
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

  // ── LUCI HERO (default home view) ────────────────────────────────
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

            // Search contracts KB
            CONTRACT_KB.forEach(function(s) {
              var hay = [s.title, s.num].concat(s.topics || []).concat(s.h2 || []).concat(s.content || []).concat(s.bullets || []).join(' ').toLowerCase();
              if (hay.indexOf(ql) >= 0) {
                var preview = (s.content || []).slice(0, 2).join(' | ').substring(0, 160) || (s.bullets || []).slice(0, 1).join(' ').substring(0, 120) || s.title;
                results.push({type:'contract', label:'Contract: ' + (s.title || ''), id:s.num, preview:preview});
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

      var icons = {playbook:'📚', template:'📑', project:'🏟', contract:'📝'};
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

      var systemPrompt = 'You are LUCI (Level Up Central Intelligence), the frontend of the Level Up Project Development intelligence system. You assist Whitney Williams, Principal-in-Charge. Your backend engine is LUNA (Level Up Network Agent). '
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
    // Remove the "Today's Action Items" section from middle of page
    // Action items are only in the Briefing side panel now

    html += '</div>';

  // Budget snapshot removed per Whitney request
    // Financial data is in the MFP Command Center dashboard now

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
    // Safety timeout — never hang on 'Checking...' forever
    var timedOut = false;
    var timeout = setTimeout(function() {
      timedOut = true;
      err.textContent = 'Request timed out. Try again.';
      err.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Unlock';
    }, 10000);
    fetch('/api/verify-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  }).then(function(r) {
      clearTimeout(timeout);
      if (timedOut) return;
      if (!r.ok) {
      if (r.status === 401) throw new Error('Incorrect password');
      throw new Error('Server error (' + r.status + ')');
    }
    return r.json();
  }).then(function(data) {
      if (data.valid || data.success) {
        document.getElementById('password-overlay').classList.remove('open');
        document.getElementById('password-overlay').style.display = 'none';
      } else {
        err.textContent = 'Unexpected response. Try again.';
        err.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Unlock';
      }
  }).catch(function(e) {
      clearTimeout(timeout);
            if (timedOut) return;
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
      // Auth check failed — ensure overlay is visible and focused
      var overlay = document.getElementById('password-overlay');
      if (overlay) {
        overlay.classList.add('open');
        overlay.style.display = '';
      }
      var inp = document.getElementById('password-input');
      if (inp) setTimeout(function() { inp.focus(); }, 300);
    });
})();

// ── BOOT ──────────────────────────────────────────────────────────
init();
