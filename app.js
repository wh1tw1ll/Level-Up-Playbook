// ── LEVEL UP PLAYBOOK ─ APP.JS ──────────────────────────────────────
// Clean rewrite. All state, data, and behavior in this file. v20260607

// ── STATE ─────────────────────────────────────────────────────────
var luUser = null;
var currentView = 'home';
var activePhase = null;
var activeTopic = null;
var activeSearch = '';
var collapsedGroups = {'1':true, '6':true, '13':true, '18':true, '37':true};  // {} = all expanded
var openSections = {};     // section.num -> true if expanded
var openSubsecs = {};      // subsection ID -> true if expanded
var chatHistory = [];
var lunaHistory = [];
var chatOpen = false;
var projectContext = null;

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
        var diag = document.getElementById('lu-diag');
        if (diag) {
          var status = luUser && luUser.authenticated ? 'Signed in: ' + luUser.email : 'Not signed in';
          diag.innerHTML = 'JS OK · ' + status + ' · KB=' + KB.length + ' · HomePlaybookProjectsTemplatesActionsL.U.N.A.Diag';
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
  openSections[num] = true;
  collapsedGroups = {};
  setTimeout(function() {
    renderSections();
    var el = document.querySelector('.section-card[data-num="' + num + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function setView(view) {
  try {
  currentView = view;

  // Hide all views, show target
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  var target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  // Nav tab highlight
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  var tab = document.getElementById('nav-' + view);
  if (tab) tab.classList.add('active');
  else {
    // Fallback: highlight related top-level tab
    var related = { sharepoint: 'home', email: 'home', calendar: 'home', mfp: 'projects' }[view];
    if (related) {
      var rt = document.getElementById('nav-' + related);
      if (rt) rt.classList.add('active');
    }
  }

  window.scrollTo(0, 0);

  // View-specific render
  if (view === 'home') updateHomeGreeting();
  else if (view === 'playbook') renderPlaybook();
  else if (view === 'projects') renderProjects();
  else if (view === 'templates') renderTemplates();
  else if (view === 'actions') renderActions();
  else if (view === 'sharepoint') renderSharePoint();
  else if (view === 'email') renderEmail();
  else if (view === 'calendar') renderCalendar();
  else if (view === 'mfp') renderMFP();
    else if (view === 'luna') renderLuna();
    } catch(err) {
    var diag = document.getElementById('lu-diag');
    if (diag) diag.innerHTML = '<span style="color:#ff6b6b">ERROR in setView(' + view + '): ' + err.message + ' at ' + (err.stack||'').split('\n')[1] + '</span>';
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

// ── REMINDERS ──────────────────────────────────────────────────────
function renderReminders() {
  var el = document.getElementById('home-reminders');
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
  var showGroups = !activePhase && !activeTopic && !activeSearch;

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
  searchTimer = setTimeout(function() {
    activeSearch = (q || '').trim();
    // When searching, auto-expand all groups so results are visible
    if (activeSearch) collapsedGroups = {};
    if (currentView !== 'playbook') setView('playbook');
    else renderSections();
  }, 250);
}

function clearFilters() {
  activePhase = null;
  activeTopic = null;
  activeSearch = '';
  var si = document.getElementById('search-input');
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
  grid.innerHTML = '<div class="mfp-card" onclick="setView(\'mfp\')">'
    + '<div class="mfp-card-head">'
    + '<span class="mfp-icon">🏟</span>'
    + '<span class="mfp-card-title">Miami Freedom Park Stadium</span>'
    + '<span class="mfp-badge red">Active</span>'
    + '</div>'
    + '<div class="mfp-card-summary">Post-opening closeout. Home opener April 4, 2026. Kroll audit, punch list disputes with Lemartec, ARQ payment hold, HVAC service agreement.</div>'
    + '<div class="mfp-card-bullets">'
    + '· Lemartec: $553M revised, 94.2% complete<br>'
    + '· Kroll cost recovery target: $9M+<br>'
    + '· Audit final delivery: June 30, 2026'
    + '</div>'
    + '</div>'
    + '<div class="mfp-card" style="opacity:.6;cursor:default" onclick="alert(\'Sixers arena pursuit \\u2014 currently in pitch phase\')">'
    + '<div class="mfp-card-head">'
    + '<span class="mfp-icon">🏀</span>'
    + '<span class="mfp-card-title">Sixers Arena (Philadelphia)</span>'
    + '<span class="mfp-badge">Pursuit</span>'
    + '</div>'
    + '<div class="mfp-card-summary">Pitch package complete for EVP Alex Kafenbaum. DD phase. Targeting Q1/Q2 2031 opening.</div>'
    + '</div>'
    + '<div class="mfp-card" style="opacity:.6;cursor:default" onclick="alert(\'DOVA Sacramento \\u2014 SD phase\')">'
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
  el.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px">'
    + '<div style="font-size:13px;color:var(--muted);margin-bottom:4px">CURRENT PHASE</div>'
    + '<div style="font-size:18px;font-weight:700;color:var(--charcoal);margin-bottom:8px">Post-Opening / Active Closeout</div>'
    + '<div style="font-size:14px;color:var(--charcoal);line-height:1.6">Home opener April 4, 2026 — completed. Active workstreams: punch list closeout, Kroll cost recovery audit (delivery June 30), Lemartec contract closeout, HVAC service agreement transfer, Day 2 owner requests log.</div>'
    + '</div>'
    + '<div class="mfp-grid">'
    + '<div class="mfp-card" onclick="showMFPDetail(\'issues\')"><div class="mfp-card-head"><span class="mfp-icon">🔴</span><span class="mfp-card-title">Live Issues</span><span class="mfp-badge red">5 HIGH</span></div><div class="mfp-card-summary">ARQ payment hold (~$1.5M Feb-Apr invoices), Kroll audit deadline, Lemartec punch list disputes, HVAC contractor departure risk, Lemartec indirect cost gap.</div></div>'
    + '<div class="mfp-card" onclick="showMFPDetail(\'financials\')"><div class="mfp-card-head"><span class="mfp-icon">💰</span><span class="mfp-card-title">Financials</span></div><div class="mfp-card-summary">Total budget: $824M. Stadium: $553M revised, 94.2% complete. Miller Electric: $28M outstanding. ARQ: ~$1.5M on hold. Retainage held: $25.5M.</div></div>'
    + '<div class="mfp-card" onclick="showMFPDetail(\'punchlist\')"><div class="mfp-card-head"><span class="mfp-icon">📋</span><span class="mfp-card-title">Punch List</span><span class="mfp-badge warn">Active</span></div><div class="mfp-card-summary">Tile installation deficiency and surface-mounted electrical conduit (spec required concealed) are active disputes with Lemartec. Position: correction, not credit.</div></div>'
    + '<div class="mfp-card" onclick="showMFPDetail(\'kroll\')"><div class="mfp-card-head"><span class="mfp-icon">🔍</span><span class="mfp-card-title">Cost Recovery / Kroll</span><span class="mfp-badge warn">Jun 30</span></div><div class="mfp-card-summary">Independent analyst engaged. Target: $9M+ recoverable. Scope: CO clawbacks, VE credits, OCIP, quantity verification, duplicate COs, defective work credits.</div></div>'
    + '<div class="mfp-card" onclick="showMFPDetail(\'day2\')"><div class="mfp-card-head"><span class="mfp-icon">🏗</span><span class="mfp-card-title">Day 2 Items</span><span class="mfp-badge warn">60+</span></div><div class="mfp-card-summary">Owner-directed post-opening scope. Each requires scope definition, cost estimate, owner authorization. Distinct from punch list.</div></div>'
    + '<div class="mfp-card" onclick="showMFPDetail(\'stakeholders\')"><div class="mfp-card-head"><span class="mfp-icon">👥</span><span class="mfp-card-title">Stakeholders</span></div><div class="mfp-card-summary">Owner: Graham Oxley (day-to-day), Devon McCorkle &amp; Victor Oliver (approvers). CM/GC: Lemartec. AOR: ARQ. Cost Recovery: Kroll.</div></div>'
    + '</div>'
    + '<div style="margin-top:24px"><button class="btn-primary" onclick="toggleChat()">Ask L.U.N.A. about MFP →</button></div>';
    }

    function showMFPDetail(view) {
      var details = {
        issues: {
          icon: '🔴', title: 'Live Issues',
          body: '<div style="margin-bottom:16px"><strong style="font-size:15px;color:var(--charcoal)">5 High Priority Issues</strong></div>'
            + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
            + '<strong>1. ARQ Payment Hold</strong><br>~$1.5M in Feb-Apr invoices on hold. Disputed work quality and incomplete deliverables.<br>'
            + '<span style="font-size:11px;color:var(--muted)">Owner: Graham Oxley | Status: Open</span></div>'
            + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
            + '<strong>2. Kroll Cost Recovery Audit</strong><br>Independent analyst engaged. Target: $9M+ recoverable. Delivery: June 30, 2026.<br>'
            + '<span style="font-size:11px;color:var(--muted)">Owner: Whitney Williams | Status: In Progress</span></div>'
            + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
            + '<strong>3. Punch List: Tile Installation Deficiency</strong><br>Surface-mounted electrical conduit violates spec requiring concealed. Position: correction, not credit.<br>'
            + '<span style="font-size:11px;color:var(--muted)">Disputed with Lemartec | Status: Open</span></div>'
            + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
            + '<strong>4. HVAC Service Agreement — Hill York</strong><br>Contractor departure risk. Urgent — pending signature.<br>'
            + '<span style="font-size:11px;color:var(--muted)">Status: Urgent / Pending Signature</span></div>'
            + '<div style="background:#fce8e8;border:1px solid #e74c3c;border-radius:8px;padding:12px 14px;margin-bottom:10px">'
            + '<strong>5. Lemartec Indirect Costs</strong><br>$39.5M indirect cost payment gap. General requirements, general conditions, CM fee, and insurance unpaid.<br>'
            + '<span style="font-size:11px;color:var(--muted)">Status: Open</span></div>'
        },
        financials: {
          icon: '💰', title: 'Financials',
          body: '<div style="margin-bottom:12px"><strong style="font-size:15px">Budget Summary</strong> <span style="font-size:12px;color:var(--muted)">(as of May 13, 2026)</span></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
            + '<div style="background:var(--bg);border-radius:8px;padding:12px"><span style="font-size:11px;color:var(--muted);display:block">Total Budget</span><strong style="font-size:18px">$824.2M</strong></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:12px"><span style="font-size:11px;color:var(--muted);display:block">Paid to Date</span><strong style="font-size:18px">$412.7M</strong></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:12px"><span style="font-size:11px;color:var(--muted);display:block">Incurred to Date</span><strong style="font-size:18px">$440.4M</strong></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:12px"><span style="font-size:11px;color:var(--muted);display:block">Past Due</span><strong style="font-size:18px;color:#c0392b">$11.8M</strong></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:12px"><span style="font-size:11px;color:var(--muted);display:block">Base Contract</span><strong style="font-size:18px">$530.4M</strong></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:12px"><span style="font-size:11px;color:var(--muted);display:block">Approved COs</span><strong style="font-size:18px">$45.3M</strong></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:12px"><span style="font-size:11px;color:var(--muted);display:block">Retainage Held</span><strong style="font-size:18px">$25.5M</strong></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:12px"><span style="font-size:11px;color:var(--muted);display:block">% Complete</span><strong style="font-size:18px">94.2%</strong></div>'
            + '</div>'
            + '<div style="margin-top:16px;padding:12px;background:var(--teal-light);border-radius:8px;font-size:13px">'
            + '<strong>Stadium Direct Costs:</strong> $530.4M base + $45.3M approved COs + $30.4M direct cost passthrough = $612.7M committed.<br>'
            + '<strong>Lemartec Indirects:</strong> $39.6M total (GR $4M, GC $18.9M, CM fee $16.1M, insurance $0.1M) — all unpaid.<br>'
            + '<strong>Miller Electric:</strong> $28M outstanding</div>'
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
        kroll: {
          icon: '🔍', title: 'Cost Recovery — Kroll Audit',
          body: '<div style="margin-bottom:16px"><strong>Kroll Independent Cost Recovery Audit</strong> <span style="font-size:12px;color:var(--muted)">— Delivery: June 30, 2026</span></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px;text-align:center"><span style="font-size:11px;color:var(--muted);display:block">Recovery Target</span><strong style="font-size:22px;color:var(--teal)">$9M+</strong></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px;text-align:center"><span style="font-size:11px;color:var(--muted);display:block">Deadline</span><strong style="font-size:18px">Jun 30</strong></div>'
            + '</div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px;font-size:13px">'
            + '<strong>Audit Scope:</strong><br>• CO clawbacks (overpriced / unjustified change orders)<br>• Value Engineering (VE) credits not properly applied<br>• OCIP insurance credit reconciliation<br>• Quantity verification (paid for but not installed)<br>• Duplicate COs (same scope charged twice)<br>• Defective work credits (correction costs back-charged)</div>'
        },
        day2: {
          icon: '🏗', title: 'Day 2 Items',
          body: '<div style="margin-bottom:16px"><strong>Owner-Directed Post-Opening Scope</strong> <span style="font-size:12px;color:var(--muted)">— 60+ items in various stages</span></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px;font-size:13px">'
            + 'Day 2 items are owner-directed scope additions after the stadium opened. They are <strong>distinct from punch list</strong> items (which are defect corrections under existing contracts).<br><br>'
            + '<strong>Each Day 2 item requires:</strong><br>'
            + '1. Scope definition<br>2. Cost estimate<br>3. Owner authorization<br><br>'
            + '<strong>Current status:</strong> Multiple items in various stages — from initial request through approved and in progress.</div>'
        },
        stakeholders: {
          icon: '👥', title: 'Stakeholders',
          body: '<div style="margin-bottom:16px"><strong>Project Stakeholders</strong></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>Owner</strong><br>Miami Freedom Park, LLC<br>Jorge Mas · Jose Mas<br><span style="font-size:12px;color:var(--muted)">Graham Oxley (day-to-day)<br>Devon McCorkle (approver)<br>Victor Oliver (approver)</span></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>CM / GC</strong><br>Lemartec Corporation<br><span style="font-size:12px;color:var(--muted)">Construction Manager as Agent</span></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>Architect of Record</strong><br>Arquitectonica (ARQ)<br><span style="font-size:12px;color:var(--muted)">Agreement executed July 27, 2023</span></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>Design Architect</strong><br>MANICA Architecture<br><span style="font-size:12px;color:var(--muted)">Agreement executed July 27, 2023</span></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>Cost Recovery</strong><br>Kroll<br><span style="font-size:12px;color:var(--muted)">Target: $9M+ recoverable<br>Delivery: June 30</span></div>'
            + '<div style="background:var(--bg);border-radius:8px;padding:14px"><strong>IMCF Operations</strong><br>Antonio Torres Roman (Lead)<br>Kaitlyn Stolzenberg<br>Nelson Fuentes (Facilities)</div>'
            + '</div>'
        }
      };
      var d = details[view];
      if (!d) return;
      var html = '<div class="modal-dialog" style="max-width:680px">'
        + '<div class="modal-header"><div class="modal-title">' + d.icon + ' ' + d.title + '</div>'
        + '<button class="chat-close" onclick="closeModal(\'modal-mfp-detail\')">×</button></div>'
        + '<div class="modal-body" style="padding:20px 24px">' + d.body + '</div></div>';
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

  var catState = {};
  try { var saved = localStorage.getItem('lu_tmpl_cats'); if (saved) catState = JSON.parse(saved); } catch(e) {}

  // Group by category
  var byCategory = {};
  keys.forEach(function(k) {
    var t = TEMPLATES[k];
    var cat = t.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ key: k, t: t });
  });

  var categoryOrder = ['Foundation','Project Controls','Construction','Closeout','Project Setup','Other'];
  var orderedCats = categoryOrder.filter(function(c) { return byCategory[c]; })
    .concat(Object.keys(byCategory).filter(function(c) { return categoryOrder.indexOf(c) < 0; }));

  var html = '<div style="font-size:13px;color:var(--muted);margin-bottom:20px">' + keys.length + ' Excel templates, all branded with Level Up styling. Click a category to expand.</div>';

  orderedCats.forEach(function(cat) {
    var items = byCategory[cat];
    var isOpen = catState[cat] === true;
    html += '<div class="tmpl-cat" style="margin-bottom:8px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:var(--card);transition:box-shadow .2s">'
          + '<div class="tmpl-cat-header" onclick="toggleTmplCat(' + jsCallArg(cat) + ')" style="display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;user-select:none;transition:background .15s" onmouseover="this.style.background=\'var(--teal-light)\'" onmouseout="this.style.background=\'\'">'
          + '<span class="tmpl-chevron" style="font-size:10px;color:var(--teal);transition:transform .2s ease">' + (isOpen ? '▼' : '▶') + '</span>'
          + '<span style="font-size:13px;font-weight:700;color:var(--charcoal);flex:1">' + escapeHtml(cat) + '</span>'
          + '<span style="font-size:11px;color:var(--muted);font-weight:600;background:var(--cool);padding:3px 10px;border-radius:10px">' + items.length + '</span>'
          + '</div>'
          + '<div class="tmpl-cat-body" style="' + (isOpen ? 'display:block' : 'display:none') + ';padding:6px 18px 18px;border-top:1px solid var(--border);animation:' + (isOpen ? 'fadeIn .2s ease' : '') + '">'
          + '<div class="mfp-grid">';

    items.forEach(function(item) {
      var k = item.key;
      var t = item.t;
      html += '<div class="mfp-card">'
        + '<div class="mfp-card-head">'
        + '<span class="mfp-icon">' + (t.icon || '📊') + '</span>'
        + '<span class="mfp-card-title">' + escapeHtml(t.name || k) + '</span>'
        + (t.section ? '<span class="mfp-badge">§' + escapeHtml(t.section) + '</span>' : '')
        + '</div>'
        + '<div class="mfp-card-summary">' + escapeHtml(t.desc || '') + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:14px">'
        + '<button class="btn-primary" style="flex:1;padding:8px 14px;font-size:13px" onclick="previewTemplate(' + jsCallArg(k) + ')">Preview</button>'
        + '<button style="flex:1;padding:8px 14px;font-size:13px;background:var(--cool);color:var(--charcoal);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600" onclick="downloadTemplate(' + jsCallArg(k) + ')">Download</button>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-top:8px">' + escapeHtml(k) + '</div>'
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
    + '<input id="sp-search" class="sp-search-input" type="text" placeholder="Search SharePoint files (e.g. Lemartec, punch list, Kroll)...">'
    + '<button class="btn-primary" onclick="doSharePointSearch()">Search</button>'
    + '</div>'
    + '<div class="sp-chips">'
    + '<span class="sp-chips-label">QUICK:</span>'
    + ['Lemartec','Kroll audit','punch list','change order','invoice','HVAC','closeout','schedule'].map(function(q) {
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
  var html = '';
  var phases = Object.keys(PHASE_GUIDE);
  phases.forEach(function(phase, idx) {
    var pid = 'pg-phase-' + idx;
    var data = PHASE_GUIDE[phase];
    html += '<div class="pg-phase">'
      + '<div class="pg-phase-header" onclick="togglePgPhase(' + jsCallArg(pid) + ')">'
      + '<span class="pg-phase-chevron" id="' + pid + '-chev">▶</span>'
      + '<span>' + escapeHtml(phase) + '</span>'
      + '</div>'
      + '<div class="pg-phase-body" id="' + pid + '" style="display:none">';
    if (data.essential) {
      html += '<h4>Essential reading</h4><ul>';
      data.essential.forEach(function(s) { html += '<li>' + escapeHtml(s) + '</li>'; });
      html += '</ul>';
    }
    if (data.supporting) {
      html += '<h4>Supporting</h4><ul>';
      data.supporting.forEach(function(s) { html += '<li>' + escapeHtml(s) + '</li>'; });
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
      appendMsg('ai', "Hi Whitney. I'm L.U.N.A. — your Executive Operating Partner. Ask me anything about the playbook or MFP — Day 1 mobilization, change orders, punch list disputes, Kroll audit, anything.");
    }
    setTimeout(function() {
      var ci = document.getElementById('chat-input');
      if (ci) ci.focus();
    }, 100);
  }
}

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

  var systemPrompt = 'You are L.U.N.A. (Level Up Navigator & Advisor), assisting Whitney Williams, Principal-in-Charge at Level Up Project Development. Answer concisely and practically. Reference specific playbook sections by number when relevant. The playbook has 43 sections:\n\n' + kbIndex + '\n\n=== PROJECT KNOWLEDGE ===\n' + MFP_CONTEXT;

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
    var si = document.getElementById('search-input');
    if (si) { si.focus(); si.select(); }
  }
  if (e.key === 'Escape') {
    closeModal('modal-phase-guide');
    closeModal('modal-decision');
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
  var diag = document.getElementById('lu-diag');
  if (diag) diag.textContent = 'Initializing...';

  // Theme
  try {
    var savedTheme = localStorage.getItem('lu_theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  } catch(e) {}

  // Auth
  checkAuthFromCookie();
  updateAuthUI();

  // Diag with test buttons
  if (diag) {
    var status = luUser && luUser.authenticated ? 'Signed in: ' + luUser.email : 'Not signed in';
    diag.innerHTML = 'JS OK · ' + status + ' · KB=' + KB.length + ' · ' +
          '<button onclick="setView(\'home\')" style="background:#fff;color:#000;border:none;padding:2px 8px;margin-left:6px;border-radius:3px;cursor:pointer;font-family:monospace;font-size:11px">Home</button>' +
          '<button onclick="setView(\'playbook\')" style="background:#fff;color:#000;border:none;padding:2px 8px;margin-left:4px;border-radius:3px;cursor:pointer;font-family:monospace;font-size:11px">Playbook</button>' +
          '<button onclick="setView(\'projects\')" style="background:#fff;color:#000;border:none;padding:2px 8px;margin-left:4px;border-radius:3px;cursor:pointer;font-family:monospace;font-size:11px">Projects</button>' +
          '<button onclick="setView(\'templates\')" style="background:#fff;color:#000;border:none;padding:2px 8px;margin-left:4px;border-radius:3px;cursor:pointer;font-family:monospace;font-size:11px">Templates</button>' +
          '<button onclick="setView(\'actions\')" style="background:#fff;color:#000;border:none;padding:2px 8px;margin-left:4px;border-radius:3px;cursor:pointer;font-family:monospace;font-size:11px">Actions</button>' +
          '<button onclick="setView(\'luna\')" style="background:#fff;color:#000;border:none;padding:2px 8px;margin-left:4px;border-radius:3px;cursor:pointer;font-family:monospace;font-size:11px">L.U.N.A.</button>' +
          '<button onclick="alert(\'currentView=\'+currentView+\'\\nactive view: \'+document.querySelector(\'.view.active\').id+\'\\nKB length: \'+KB.length+\'\\nPHASES: \'+PHASES.length+\'\\nALL_TOPICS: \'+ALL_TOPICS.length)" style="background:#fff;color:#000;border:none;padding:2px 8px;margin-left:4px;border-radius:3px;cursor:pointer;font-family:monospace;font-size:11px">Diag</button>';
  }

  // Routing
  var urlParams = new URLSearchParams(window.location.search);
  var authSuccess = urlParams.get('auth') === 'success';
  var returnView = 'home';
  if (authSuccess) {
    history.replaceState({}, '', '/');
    try {
      returnView = localStorage.getItem('lu_return_view') || 'home';
      localStorage.removeItem('lu_return_view');
    } catch(e) {}
  }

  setView(returnView);
  }

  // ── L.U.N.A. TAB ──────────────────────────────────────────────────
  function renderLuna() {
    // Focus input when tab opens
    setTimeout(function() {
      var inp = document.getElementById('luna-input');
      if (inp) inp.focus();
    }, 100);
    // Show previous conversation if any
    var results = document.getElementById('luna-results');
    if (results && lunaHistory.length > 0) {
      var html = '<div class="luna-history">';
      for (var i = 0; i < lunaHistory.length; i++) {
        var entry = lunaHistory[i];
        html += '<div class="luna-result-q"><span class="luna-result-q-icon">Q:</span>' + escapeHtml(entry.q) + '</div>';
        html += '<div class="luna-result-a">' + escapeHtml(entry.a) + '</div>';
      }
      html += '</div>';
      results.innerHTML = html;
    }
  }

  function lunaAsk() {
    var inp = document.getElementById('luna-input');
    var btn = document.querySelector('.luna-btn');
    if (!inp) return;
    var q = inp.value.trim();
    if (!q) return;
    inp.value = '';
    lunaDoAsk(q, btn);
  }

  function lunaAskQuick(q) {
    var btn = document.querySelector('.luna-btn');
    lunaDoAsk(q, btn);
  }

  function lunaDoAsk(q, btn) {
      if (btn) btn.disabled = true;
      // Disable all quick buttons
      document.querySelectorAll('.luna-quick').forEach(function(b) { b.disabled = true; });

      var results = document.getElementById('luna-results');
      if (!results) return;

      // Clear previous results — Google-style, fresh every search
      results.innerHTML = '';

      // Add question bubble
      var qDiv = document.createElement('div');
      qDiv.className = 'luna-result-q';
      qDiv.innerHTML = '<span class="luna-result-q-icon">Q:</span>' + escapeHtml(q);
      results.appendChild(qDiv);

      // Add loading answer bubble
      var aDiv = document.createElement('div');
      aDiv.className = 'luna-result-a loading';
      aDiv.textContent = 'Thinking...';
      results.appendChild(aDiv);

            // Check response cache (1-hour expiry)
            var cacheKey = 'luna_' + q.toLowerCase().trim().replace(/[^a-z0-9]/g,'_').slice(0,80);
            try {
              var cached = JSON.parse(localStorage.getItem(cacheKey));
              if (cached && cached.ts > Date.now() - 3600000) {
                aDiv.className = 'luna-result-a';
                aDiv.textContent = cached.answer;
                if (btn) btn.disabled = false;
                document.querySelectorAll('.luna-quick').forEach(function(b) { b.disabled = false; });
                setTimeout(function() { results.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 100);
                return;
              }
            } catch(e) {}

            // Build system prompt with KB index + template index
      var kbIndex = KB.map(function(s) {
        return 'S' + s.num + ': ' + (s.title || '').replace('SECTION ' + s.num + ': ','') + ' [' + (s.phases||[]).join('/') + ']';
      }).join('\\n');

      var tmplIndex = '';
      for (var key in TEMPLATES) {
        var t = TEMPLATES[key];
        tmplIndex += key + ' — ' + t.name + ' (' + t.category + ') — Section ' + t.section + '\\n';
      }

      var systemPrompt = 'You are L.U.N.A. (Level Up Navigator & Advisor), assisting Whitney Williams, Principal-in-Charge at Level Up Project Development. '
              + 'This is a search interface — answer concisely and directly like Google. Use paragraph breaks and bullet points for readability. '
              + 'When the user asks about a template, name the exact template file and the playbook section it belongs to (e.g. "Go to Templates → 03_Change_Order_Log.xlsx" or "See Section 16"). '
              + 'When referencing a playbook section, say "See Section X: Title". Be specific and actionable. '
              + 'The playbook has 43 sections:\n\n' + kbIndex
              + '\n\nAvailable templates:\n' + tmplIndex
              + '\n\n=== PROJECT KNOWLEDGE ===\n' + MFP_CONTEXT;

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [{ role: 'user', content: q }]
        })
      })
        .then(function(r) {
          return r.text().then(function(text) { return { ok: r.ok, status: r.status, text: text }; });
        })
        .then(function(res) {
          aDiv.className = 'luna-result-a';
          if (btn) btn.disabled = false;
          document.querySelectorAll('.luna-quick').forEach(function(b) { b.disabled = false; });
          if (!res.ok) {
            aDiv.textContent = 'Error ' + res.status + ': ' + res.text.slice(0, 300);
            return;
          }
          var data;
          try { data = JSON.parse(res.text); } catch(e) {
            aDiv.textContent = 'Bad response from server: ' + res.text.slice(0, 200);
            return;
          }
          var reply = (data.content && data.content[0] && data.content[0].text) || data.error || 'No response.';
                    aDiv.textContent = reply;
                    // Cache the response
                    try { localStorage.setItem(cacheKey, JSON.stringify({ answer: reply, ts: Date.now() })); } catch(e){}
        })
        .catch(function(err) {
          aDiv.className = 'luna-result-a';
          aDiv.textContent = 'Network error: ' + (err.message || err);
          if (btn) btn.disabled = false;
          document.querySelectorAll('.luna-quick').forEach(function(b) { b.disabled = false; });
        });

      // Scroll results into view
      setTimeout(function() { results.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 100);
    }

  if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
