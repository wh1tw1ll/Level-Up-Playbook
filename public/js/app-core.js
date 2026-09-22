// ── LEVEL UP APP CORE ──
// State, STORE, helpers, auth, theme, view routing. v20260609-2

// ── STATE ─────────────────────────────────────────────────────────
var luUser = null;
var currentView = 'luna';
var currentPbView = 'sections';
var activePhase = null;
var activeTopic = null;
var activeSearch = '';
var collapsedGroups = {'1':true, '6':true, '13':true, '18':true, '37':true};
var openSections = {};
var openSubsecs = {};
var chatHistory = [];
var lunaHistory = [];
var chatOpen = false;
var projectContext = null;
var heroResults = {};

// ── STORE: shared data layer for action items ──
// Single fetch, filtered in-memory by each view. Never reads localStorage as source.
var STORE = { rows: [], fetchedAt: null };

function loadSTORE(force) {
  if (STORE.rows.length && !force && Date.now() - STORE.fetchedAt < 60000)
    return Promise.resolve(STORE.rows);
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem('luci_tasks_cache')); } catch(e) {}
  if (cached && cached.rows && !force && Date.now() - (cached.fetchedAt || 0) < 300000) {
    STORE = { rows: cached.rows, fetchedAt: cached.fetchedAt || Date.now() };
    return Promise.resolve(STORE.rows);
  }
  return fetch('/api/tasks')
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(j) {
      STORE = { rows: j.tasks || [], fetchedAt: Date.now() };
      try { localStorage.setItem('luci_tasks_cache', JSON.stringify({ rows: STORE.rows, fetchedAt: STORE.fetchedAt })); } catch(e) {}
      return STORE.rows;
    })
    .catch(function(e) {
      if (STORE.rows.length) return STORE.rows;
      if (cached && cached.rows) {
        STORE = { rows: cached.rows, fetchedAt: cached.fetchedAt || Date.now() };
        return STORE.rows;
      }
      throw e;
    });
}

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
  if (kbLoaded) return;
  // Re-read from window — data scripts may have loaded after this file
  var data = window.__KB || [];
  if (!data.length) return;
  KB = data;
  CONTRACT_KB = window.__CONTRACT_KB || [];
  TEMPLATES = window.__TEMPLATES || {};
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

// ── DATE HELPERS (shared, used by Reminder Panel) ──
function isOverdue(row) {
  if (!row.dueDate) return false;
  var due = new Date(row.dueDate + 'T23:59:59');
  return due < new Date();
}
function isDueToday(row) {
  if (!row.dueDate) return false;
  var today = new Date();
  var due = new Date(row.dueDate + 'T00:00:00');
  return due.getFullYear() === today.getFullYear()
      && due.getMonth() === today.getMonth()
      && due.getDate() === today.getDate();
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function jsCallArg(v) {
  return '&quot;' + String(v).replace(/&/g,'&amp;').replace(/\"/g,'&quot;').replace(/'/g,"\\'") + '&quot;';
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
        // Hide password overlay since user is authenticated
        var overlay = document.getElementById('password-overlay');
        if (overlay) {
          overlay.classList.remove('open');
          overlay.style.display = 'none';
        }
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
    if (calMeta) calMeta.textContent = '✓ Connected';
    if (spMeta) spMeta.textContent = '✓ Connected';
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
  document.querySelectorAll('.pb-subview').forEach(function(v) { v.classList.remove('active'); });
  var map = { sections:'pb-sections-view', templates:'pb-templates-view', guide:'pb-guide-view', decision:'pb-decision-view' };
  var el = document.getElementById(map[currentPbView]);
  if (el) el.classList.add('active');
}

function setView(view) {
  try {
  currentView = view;

  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  var target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  var navMap = { playbook:'nav-playbook', projects:'nav-projects', tasks:'nav-tasks', actions:'nav-actions', prep:'nav-prep', mfp:'nav-projects', 'mfp-dashboard':'nav-projects', luna:'nav-luna' };
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  var tabId = navMap[view];
  if (tabId) {
    var tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');
  }

  var subnav = document.getElementById('subnav-playbook');
  if (subnav) subnav.style.display = (view === 'playbook') ? 'flex' : 'none';

  window.scrollTo(0, 0);

  if (view === 'luna') { renderHero(); }
  else if (view === 'playbook') renderPbView();
  else if (view === 'projects') renderProjects();
  else if (view === 'tasks' && typeof renderTasksView === 'function') renderTasksView();
  else if (view === 'mfp') renderMFP();
  else if (view === 'mfp-dashboard') renderMFPDashboard();
  else if (view === 'dova') renderDovaDashboard();
  else if (view === 'prep' && typeof renderPrepView === 'function') renderPrepView();
  else if (target) {
  } else {
      currentView = 'luna';
      target = document.getElementById('view-luna');
      if (target) target.classList.add('active');
      renderHero();
    }
  } catch(err) {
      console.error('setView error:', err);
    }
  }

// ── MODAL HELPERS (moved from app.js) ─────────────────────────────
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

// ── PASSWORD GATE (moved from app.js) ─────────────────────────────
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

// ── CHECK AUTH ON LOAD (moved from app.js) ────────────────────────
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

// ── REMINDER DISMISS (moved from app.js) ──────────────────────────
function dismissReminder(id) {
  var dismissed = {};
  try { var d = localStorage.getItem('lu_remind_dismiss'); if (d) dismissed = JSON.parse(d); } catch(e) {}
  dismissed[id] = true;
  try { localStorage.setItem('lu_remind_dismiss', JSON.stringify(dismissed)); } catch(e) {}
  // Refresh both home-page reminder cards (app-playbook.js) and panel reminders (app-luna.js)
  if (typeof renderReminders === 'function') renderReminders();
  if (typeof renderReminderReminders === 'function') renderReminderReminders();
}